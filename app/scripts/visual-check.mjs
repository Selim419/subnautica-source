// Chrome DevTools Protocol harness - zero dependencies (Node 22+ has a global WebSocket).
//
// Verifies design work by measuring the real layout instead of eyeballing it:
// horizontal overflow, clickable text that wraps, text clipped inside a clipping
// container, and which base path the fonts actually resolved to. Screenshots go
// to disk so the change can be looked at too.
//
//   node scripts/visual-check.mjs measure   <url> [width:height ...]
//   node scripts/visual-check.mjs shots     <url> <outDir> [width:height ...]
//   node scripts/visual-check.mjs signature <url> [width:height ...]
//   node scripts/visual-check.mjs signature --geometry <url> [width:height ...]
//
// `measure` is page-probe.js. Its output gained `clippedText` in this task and
// the gain is deliberately additive: `overflow` is computed from the document's
// own scrollWidth, so a page whose only defect is a heading overhanging a
// `overflow: hidden` ancestor reads as clean no matter how many widths it is
// measured at. `clippedText` is the check for that class - see the comment at
// the top of the block in page-probe.js.
//
// `signature` is the machine check for "did this stylesheet change change the
// rendering?". It hashes computed style **including** `color` and
// `background-color`, so it moves for any palette edit by design.
//
// `signature --geometry` is the same walk with a box-model-only property set: no
// colour, no gradient, no shadow, no filter, no font metrics. That makes it the
// right check for a change that *intends* to alter colour and typeface - capture
// it before and after and diff the two dumps. Anything that moves is either a real
// layout regression or the deliberate consequence of different glyph widths, and
// the dump names which element and which property so the two can be told apart.
// It is a regression detector, not an equality gate: a task that swaps the typeface
// is *supposed* to move every heading's box.
//
// Dev tool only. Never wire this into CI: the runner is Linux without a browser
// and the script exits 3 with a clear message when it cannot find one.

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]
const PORT = 9335
const PROBE = resolve(import.meta.dirname, 'page-probe.js')
const PROFILE = resolve(process.env.TEMP, 'opencode', 'cdp-profile3')
const SEND_TIMEOUT = 60000

// Runs inside the page. Returns one record per element: a stable identity plus
// the resolved layout that a stylesheet edit could plausibly change.
//
// DELIBERATE EXCLUSIONS - do not "fix" these, they will produce spurious failures
// that have nothing to do with the change under test:
//
//   * `transform`, and every property the animation library writes as an inline
//     style. `useScroll`/`useSpring` drive the scroll-progress bar's scaleX and
//     `AnimatePresence` cross-fades the route wrapper, so those values differ on
//     every single frame. They are not layout, and they are not what a CSS move
//     should be judged on. `transform` also skews getBoundingClientRect, so
//     recording it would poison the geometry too.
//   * The bounding rect of any element whose box is not at rest. This is
//     measured, not guessed: the probe takes two samples a fixed interval apart
//     and drops the rect of anything that moved in between. The `.ticker`
//     marquee is `animation: marquee 25s linear infinite`, so its x offset is a
//     frame sample and two runs seconds apart differ by ~3px - the same would
//     happen after any unrelated edit. Testing the animation *metadata* instead
//     would be worse: `.hero-inner` carries scroll-linked Motion values that
//     report as running forever, which would silently drop the `h1` rect, the
//     single most important box on the page. Comparing two samples keeps the
//     scroll-linked elements, because they genuinely do not move while the
//     scroll position is still. `unstableRects` is reported so a dropped rect
//     can never be read as a matching one.
//   * The `<head>` subtree. Vite's dev server injects one <style> element per
//     imported stylesheet, so splitting one .css into five legitimately changes
//     the head's child count. That is a build-tool artefact, not a rendering
//     difference, and the element count would move with it.
//
// What IS recorded is the layout-affecting set below, plus a bounding rect
// rounded to 0.01px, sorted by identity key so the hash cannot depend on
// traversal order.
const SIGNATURE_PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant',
  'line-height', 'letter-spacing', 'word-spacing',
  'text-align', 'text-transform', 'text-indent', 'text-overflow-wrap',
  'color', 'background-color', 'background-image',
  'background-position', 'background-size', 'background-repeat',
  'box-shadow', 'opacity',
  'gap', 'row-gap', 'column-gap',
  'grid-template-areas', 'grid-template-columns', 'grid-template-rows',
  'grid-auto-flow', 'grid-auto-columns', 'grid-auto-rows',
  'flex', 'flex-basis', 'flex-direction', 'flex-flow', 'flex-grow', 'flex-shrink', 'flex-wrap',
  'order', 'z-index',
  'overflow', 'overflow-x', 'overflow-y', 'overflow-wrap',
  'visibility', 'vertical-align', 'white-space',
  'list-style', 'list-style-type', 'list-style-position', 'list-style-image',
  'object-fit', 'filter', 'mix-blend-mode', 'aspect-ratio', 'content-visibility',
]

// The geometry-only set. Everything that can move a box, and nothing that only
// changes how a box is painted or what is inside it.
//
// Deliberately ABSENT, and each absence is load-bearing:
//
//   * Every colour: `color`, `background-color`, `border-*-color`, `opacity`,
//     `mix-blend-mode`. A palette migration changes all of them on every element
//     by design, so recording them makes the check useless exactly when it is
//     most needed.
//   * `background-image`, which is where every gradient and every `color-mix()`
//     resolves. A gradient cannot change a box, and the alpha steps this file's
//     gradients use are a large part of what the migration rewrites.
//   * `box-shadow` and `filter` - paint-only.
//   * Every font metric: `font-family`, `font-size`, `font-weight`, `line-height`,
//     `letter-spacing`, `word-spacing`, `font-stretch`, `font-variant`. This is
//     the one that looks like a bug and is not. A task that retires a typeface
//     *must* move every heading's box, and the rect is still recorded below, so
//     the damage is reported with the element name attached instead of being
//     hidden. Excluding the metrics means a *style* regression that only changes
//     shaping is still caught through the rect.
//   * `white-space` and the text-align group: they change wrapping, which the
//     rect already shows, and keeping them would double-report every heading.
//
// `box-sizing` IS recorded: it is the one property that changes a box's outer
// size without appearing in the rect's arithmetic, and a token migration that
// dropped it would resize everything.
const GEOMETRY_PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'gap', 'row-gap', 'column-gap',
  'grid-template-areas', 'grid-template-columns', 'grid-template-rows',
  'grid-auto-flow', 'grid-auto-columns', 'grid-auto-rows',
  'flex', 'flex-basis', 'flex-direction', 'flex-flow', 'flex-grow', 'flex-shrink', 'flex-wrap',
  'order', 'z-index',
  'overflow', 'overflow-x', 'overflow-y',
  'box-sizing', 'aspect-ratio',
]

// The walk is shared; only PROPS differ. The exclusions documented above apply to
// both variants identically, because they are all enforced here rather than in
// the property list.
//
// \`withLines\` is off for the full signature ON PURPOSE: the full signature's
// hashes are recorded in docs/superpowers/baseline/, and adding a field to its
// entries would invalidate every one of them for no benefit - the full signature
// is a yes/no gate and does not need to say which heading moved. The geometry
// variant is the diff tool, and a diff needs the line counts.
const probeFor = (props, withLines) => `(async () => {
  const PROPS = ${JSON.stringify(props)}
  const WITH_LINES = ${withLines ? 'true' : 'false'}
  const REST_PROBE_MS = 700
  const round2 = (n) => Math.round(n * 100) / 100
  const sample = (el) => {
    const r = el.getBoundingClientRect()
    return [round2(r.x), round2(r.y), round2(r.width), round2(r.height)]
  }

  // Visual line count of an element's own text, clustered by vertical overlap.
  // Same method as page-probe.js, and for the same reason: "SUB" and "NAUTICA"
  // in the logo sit on one line at different tops, so counting distinct \`top\`
  // values would lie. Null when the element renders no text boxes.
  //
  // This is here so a font change is reportable rather than merely visible: the
  // rect says a heading got taller, \`lines\` says it gained a line, and the
  // element key says which heading.
  const lineCount = (el) => {
    if (!el.firstChild) return null
    const range = document.createRange()
    range.selectNodeContents(el)
    const rects = []
    for (const r of range.getClientRects()) if (r.height > 0.5) rects.push(r)
    if (!rects.length) return null
    rects.sort((a, b) => a.top - b.top)
    let lines = 1
    let bandTop = rects[0].top
    let bandBottom = rects[0].bottom
    for (const r of rects.slice(1)) {
      const overlap = Math.min(bandBottom, r.bottom) - Math.max(bandTop, r.top)
      if (overlap > Math.min(bandBottom - bandTop, r.height) * 0.5) {
        bandTop = Math.min(bandTop, r.top)
        bandBottom = Math.max(bandBottom, r.bottom)
      } else {
        lines++
        bandTop = r.top
        bandBottom = r.bottom
      }
    }
    return lines
  }

  const nodes = []
  const walk = (el, parentKey) => {
    // The head is skipped, not just its <style> children: Vite injects one
    // <style> per imported stylesheet, so this is a build-tool artefact.
    if (el.localName === 'head') return
    const cls = typeof el.className === 'string' ? el.className.trim() : ''
    const index = Array.prototype.indexOf.call(el.parentNode.children, el) + 1
    const key = parentKey + '>' + el.localName +
      (el.id ? '#' + el.id : '') +
      (cls ? '.' + cls.split(/\\s+/).join('.') : '') +
      ':nth-child(' + index + ')'
    const cs = getComputedStyle(el)
    const out = {}
    for (const prop of PROPS) out[prop] = cs[prop]
    nodes.push({
      el, key, props: out,
      ...(WITH_LINES ? { lines: lineCount(el) } : {}),
      first: sample(el),
    })
    for (const child of el.children) walk(child, key)
  }
  walk(document.documentElement, '')

  await new Promise((r) => setTimeout(r, REST_PROBE_MS))

  const entries = []
  let unstableRects = 0
  for (const n of nodes) {
    const second = sample(n.el)
    const stable = n.first.every((v, i) => v === second[i])
    if (!stable) unstableRects++
    const { el, first, ...rest } = n
    entries.push({ ...rest, rect: stable ? first : null })
  }
  return { entries, unstableRects }
})()`

const argv = process.argv.slice(2)
const cmd = argv.shift()
// `signature --geometry <url> ...` - the flag is parsed here, not as a URL, so a
// mistaken `signature <url> --geometry` fails loudly instead of navigating to
// the literal string "--geometry".
const geometry = cmd === 'signature' && argv[0] === '--geometry'
if (geometry) argv.shift()
const url = argv.shift()
if (!cmd || !url) {
  console.error('usage: node scripts/visual-check.mjs <measure|shots|signature> [--geometry] <url> [outDir] [width:height ...]')
  process.exit(2)
}
const rest = argv
const outDir = cmd === 'shots' ? resolve(rest.shift()) : null
const widths = rest.length ? rest : ['320:800', '375:812', '414:896', '768:1024', '1440:900']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Exit code carried by a deliberate failure, so the message and the code agree.
class Fail extends Error {
  constructor(message, code) { super(message); this.code = code }
}

const bin = CHROME_CANDIDATES.find((p) => { try { return readFileSync(p).length > 0 } catch { return false } })
if (!bin) {
  console.error('Chrome/Edge not found - cannot measure. Install one or skip this check.')
  process.exit(3)
}

let id = 0
let child = null
let ws = null
let cleanedUp = false
const pending = new Map()

// A failed close must not become a silent leak: the profile directory is the only
// place the browser keeps state, so it is removed on every exit path.
process.on('exit', () => { try { rmSync(PROFILE, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }) } catch { /* best effort */ } })

const dropProfile = () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      rmSync(PROFILE, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
      return
    } catch {
      // Chrome can hold profile files briefly after exit; retry, then give up.
      if (attempt === 4) console.error(`warning: could not remove ${PROFILE}`)
    }
  }
}

// Idempotent: every failure path funnels through here, including the success path.
const cleanup = async () => {
  if (cleanedUp) return
  cleanedUp = true

  // Ask the browser to close so it shuts its renderers down cleanly, and so a
  // successful run is not counted as a kill. Every step is best effort: the
  // browser may already be gone, and a failed Browser.close must never turn a
  // good measurement into a non-zero exit.
  try { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: ++id, method: 'Browser.close' })) } catch { /* gone */ }
  try { ws?.close() } catch { /* gone */ }

  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((r) => child.once('exit', r))
    try { child.kill() } catch { /* gone */ }
    await Promise.race([exited, sleep(2000)])
  }

  dropProfile()
}

const failPending = (err) => {
  for (const [, p] of pending) { clearTimeout(p.timer); p.rej(err) }
  pending.clear()
}

try {
  child = spawn(bin, [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu', '--no-sandbox',
    '--hide-scrollbars', '--user-data-dir=' + PROFILE,
    '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: 'ignore' })

  let wsUrl
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl
    } catch { /* not up yet */ }
    if (!wsUrl) await sleep(250)
  }
  if (!wsUrl) throw new Fail('DevTools did not come up', 3)

  ws = new WebSocket(wsUrl)
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })

  ws.addEventListener('message', (ev) => {
    let m
    try { m = JSON.parse(ev.data) } catch { return }
    const p = m.id && pending.get(m.id)
    if (!p) return
    // The response settled this request: drop the guard timer, or it would hold
    // the event loop open for its full duration after the work is done.
    clearTimeout(p.timer)
    pending.delete(m.id)
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result)
  })
  // An unexpected close must fail the in-flight requests at once rather than
  // leaving the process parked on a 60s timer.
  ws.addEventListener('close', () => failPending(new Error('DevTools connection closed unexpectedly')))
  ws.addEventListener('error', () => failPending(new Error('DevTools connection error')))

  const send = (method, params = {}) => {
    const i = ++id
    return new Promise((res, rej) => {
      // Backstop for a browser that is alive but wedged. unref so it can never
      // itself keep the process alive; the open socket holds the loop meanwhile.
      const timer = setTimeout(() => {
        if (!pending.has(i)) return
        pending.delete(i)
        rej(new Error(method + ' timed out'))
      }, SEND_TIMEOUT)
      timer.unref?.()
      pending.set(i, { res, rej, timer })
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  }

  await send('Page.enable')
  await send('Runtime.enable')
  if (outDir) mkdirSync(outDir, { recursive: true })

  const results = []
  for (const spec of widths) {
    const [w, h] = spec.split(':').map(Number)
    const metrics = { width: w, height: h }
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 })
    const nav = await send('Page.navigate', { url })
    if (nav.errorText) throw new Fail(`cannot load ${url}: ${nav.errorText}`, 1)
    await sleep(3800) // fonts, images and the WebGL scene

    const r = await send('Runtime.evaluate', {
      expression: cmd === 'signature'
        ? probeFor(geometry ? GEOMETRY_PROPS : SIGNATURE_PROPS, geometry)
        : readFileSync(PROBE, 'utf8'),
      returnByValue: true, awaitPromise: true,
    })
    if (r.exceptionDetails) throw new Fail(JSON.stringify(r.exceptionDetails), 4)

    if (cmd === 'signature') {
      const { entries, unstableRects } = r.result.value
      // Sorted by identity so the hash cannot depend on traversal order.
      entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      // The count is reported next to the hash on purpose: if the element count
      // moves, there is a rendering difference even in the impossible case that
      // a hash collision hid it.
      metrics.elements = entries.length
      metrics.unstableRects = unstableRects
      metrics.variant = geometry ? 'geometry' : 'full'
      metrics.signature = createHash('sha256').update(JSON.stringify(entries)).digest('hex')
      // Two env vars, not one, so a geometry dump can never be diffed against a
      // full one: the two have different property sets and the diff would be
      // meaningless rather than merely noisy.
      const dump = (geometry ? process.env.GEOMETRY_DUMP : process.env.SIGNATURE_DUMP)
      if (dump) {
        appendFileSync(dump, JSON.stringify({ width: w, height: h, entries }) + '\n')
      }
    } else {
      Object.assign(metrics, r.result.value)
    }

    if (outDir) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w, height: Math.min(metrics.scrollHeight + 40, 16000), deviceScaleFactor: 1, mobile: w < 768,
      })
      await sleep(1400)
      const full = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      writeFileSync(resolve(outDir, `w${w}-full.png`), Buffer.from(full.data, 'base64'))
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 })
      await sleep(700)
      const fold = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(resolve(outDir, `w${w}-fold.png`), Buffer.from(fold.data, 'base64'))
    }
    results.push(metrics)
  }

  console.log(JSON.stringify(results, null, 2))
} catch (err) {
  console.error('visual-check failed: ' + (err && err.message ? err.message : String(err)))
  process.exitCode = err instanceof Fail ? err.code : 1
} finally {
  await cleanup()
}
