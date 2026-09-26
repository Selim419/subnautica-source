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
//   node scripts/visual-check.mjs contrast  <url> [width:height ...]
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
// `contrast` is spec §6.4/7 made mechanical: text measured over the *live* scene
// rather than a swatch. Per regime it copies the WebGL canvas into a 2D one,
// takes the lightest pixel under every `[data-contrast]` box (the worst case for
// pale ink over a moving sea), and reads each element's computed colour,
// font-size and font-weight to decide the tier that element is actually held to:
//
//   4.5:1  body copy                      (spec §6.4/7, §8.2)
//   3:1    large text - >= 24px, or >= 18.66px at weight >= 700 (WCAG AA)
//   7:1    either endpoint of the pair is the `--amber` token
//
// The reported `threshold` says which number applied and why. The exit code is
// non-zero if any sampled pair falls short, if a computed colour cannot be
// parsed, if a regime could not be reached, or if a regime had nothing to
// measure: "0 elements checked" must never be readable as "0 failures".
//
// Sampling is per regime, not per page load: before each row the harness scrolls
// that regime's section to useDiveDepth's reading line and settles, so the row
// labels the state that was actually measured (spec §6.4/7 - "at each regime
// boundary, while the text is in that regime"). A canvas buffer that copies as
// fully transparent is `unreadable`, never a black scene: an unmeasured pair
// must fail, not pass.
//
// Until the dive spine installs `window.__diveProbe` there is nothing to sample,
// so a width reports `no-canvas` and the run still exits 0 - the scene does not
// exist yet, and pretending to have measured it would be worse. The URL gets a
// `preserve=1` flag for the scene to honour so its drawing buffer stays readable.
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
// One settle delay for everything: fonts, images, the WebGL scene, and the scene
// catching up after `contrast` scrolls a regime into view. Shared so a change to
// it changes every command at once.
const SETTLE_MS = 3800

// `--amber` from app/src/design/tokens.css (#ffb454) as a comparable triple.
// spec §6.4/7 folds the §8.2 `--amber >= 7:1` check into the text-contrast rule,
// and any value styled with `var(--amber)` computes to rgb(255, 180, 84), so the
// endpoints of a sampled pair are compared against this literal. Pinned here on
// purpose: retinting the token must surface as a deliberate edit to the gate
// rather than as a silent drift in what "amber" means.
const AMBER_RGB = [255, 180, 84]

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

// Installed into the page by `contrast` before anything is asked of it: defines
// `window.__diveContrast(regimeIndex)`. `window.__diveProbe` is deliberately NOT
// defined here - the dive spine owns it, and until it exists the command reports
// `no-canvas` instead of inventing regimes to sample.
//
// What is measured, and what is refused rather than guessed:
//
//   * Background is the lightest pixel of the ocean canvas under the element's
//     box, mapped viewport -> canvas the way the scene itself is drawn. Light is
//     the conservative direction: any paler pixel inside the box would only pull
//     the ratio down, so the sample cannot flatter the pair.
//   * Text is the computed `color`, composited over that pixel when the ink is
//     translucent (--ink-muted is rgba). Contrasting raw rgba against the scene
//     would credit contrast the reader never sees.
//   * The tier comes from each element's computed font-size and font-weight:
//     4.5:1 for body copy, 3:1 for large text (>=24px, or >=18.66px at >=700),
//     7:1 whenever either endpoint of the pair is the amber token - amber wins
//     over both because it carries the smallest text (spec §6.4/7 + §8.2).
//   * A colour that cannot be parsed - an unresolved color-mix(), display-p3, a
//     keyword the engine did not serialise - is reported as `unparseable`. A
//     gate that cannot read a colour must not claim the pair passed.
//
// The record returned is the pair with the smallest margin over its own
// threshold, so a pass reports the tightest pair and a failure reports the worst
// one: an amber pair at 5:1 cannot hide behind a body pair at 4.6:1.
const CONTRAST_PROBE = `
  (() => {
    const AMBER = ${JSON.stringify(AMBER_RGB)}
    const LARGE_PX = 24
    const LARGE_BOLD_PX = 18.66
    const MIN_BODY = 4.5
    const MIN_LARGE = 3
    const MIN_AMBER = 7

    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
    const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
    const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]

    const alpha = (v) => {
      const n = v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v)
      return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null
    }
    const chan = (v, scale) => {
      const n = v.endsWith('%') ? (parseFloat(v) / 100) * 255 : parseFloat(v) * scale
      return Number.isFinite(n) ? Math.round(n) : null
    }

    // Computed colours arrive as rgb()/rgba(), #hex, or color(srgb ...). Anything
    // else returns null and is reported as unparseable rather than approximated.
    const parseColour = (value) => {
      if (typeof value !== 'string') return null
      const s = value.trim().toLowerCase()
      let m = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s)
      if (m) {
        const hex = m[1].length <= 4 ? [...m[1]].map((c) => c + c).join('') : m[1]
        return {
          rgb: [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)),
          alpha: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
        }
      }
      m = /^rgba?\\(([^)]*)\\)$/.exec(s)
      if (m) {
        const parts = m[1].split(/[\\s,\\/]+/).filter(Boolean)
        if (parts.length < 3) return null
        const rgb = parts.slice(0, 3).map((v) => chan(v, 1))
        if (rgb.some((c) => c === null)) return null
        const a = parts[3] === undefined ? 1 : alpha(parts[3])
        if (a === null) return null
        return { rgb, alpha: a }
      }
      m = /^color\\(\\s*srgb\\s+([^)]*)\\)$/.exec(s)
      if (m) {
        const parts = m[1].split(/[\\s\\/]+/).filter(Boolean)
        if (parts.length < 3) return null
        const rgb = parts.slice(0, 3).map((v) => chan(v, 255))
        if (rgb.some((c) => c === null)) return null
        const a = parts[3] === undefined ? 1 : alpha(parts[3])
        if (a === null) return null
        return { rgb, alpha: a }
      }
      return null
    }

    window.__diveContrast = (regimeIndex) => {
      const head = { regimeIndex }
      const bail = (status, detail) => ({ ...head, status, ratio: null, threshold: null, checked: 0, detail })

      const gl = document.querySelector('canvas[data-ocean]')
      if (!gl) return bail('no-canvas', 'no canvas[data-ocean] in the document')

      const copy = document.createElement('canvas')
      copy.width = gl.width
      copy.height = gl.height
      const ctx = copy.getContext('2d')
      try {
        ctx.drawImage(gl, 0, 0)
      } catch (err) {
        return bail('unreadable', 'the ocean canvas could not be copied: ' + (err && err.message ? err.message : String(err)))
      }

      const els = document.querySelectorAll('[data-contrast]')
      if (!els.length) {
        return bail('no-text', '0 [data-contrast] elements in the document - nothing was measured, so this is not a pass')
      }

      let visible = 0
      let checked = 0
      let badColour = null
      let worst = null

      try {
        for (const el of els) {
          const r = el.getBoundingClientRect()
          if (r.bottom < 0 || r.top > innerHeight) continue
          visible++

          const cs = getComputedStyle(el)
          const rawColour = cs.color
          const text = parseColour(rawColour)
          if (!text) {
            if (!badColour) badColour = { raw: rawColour, key: el.id || el.className || el.localName }
            continue
          }

          const px = Math.max(1, Math.floor(r.width))
          const py = Math.max(1, Math.floor(r.height))
          const sx = Math.max(0, Math.floor(r.left * gl.width / innerWidth))
          const sy = Math.max(0, Math.floor(r.top * gl.height / innerHeight))
          const sw = Math.min(gl.width - sx, Math.floor(px * gl.width / innerWidth))
          const sh = Math.min(gl.height - sy, Math.floor(py * gl.height / innerHeight))
          if (sw <= 0 || sh <= 0) continue

          const data = ctx.getImageData(sx, sy, sw, sh).data
          let lightest = 0
          let lightestRgb = [0, 0, 0]
          let painted = false
          for (let i = 0; i < data.length; i += 4) {
            // A cleared or never-rendered WebGL buffer copies as transparent
            // black, which would otherwise measure as a perfect dark scene and
            // pass pale ink at ~19:1. Fail closed instead: alpha 0 means nothing
            // was rendered here, and a genuinely black scene keeps alpha 255.
            if (data[i + 3] === 0) continue
            painted = true
            const rgb = [data[i], data[i + 1], data[i + 2]]
            const l = lum(rgb)
            if (l > lightest) { lightest = l; lightestRgb = rgb }
          }
          if (!painted) {
            return bail('unreadable', 'canvas buffer is empty - every sampled pixel under this element is transparent (is preserveDrawingBuffer set on the renderer, or has the scene not rendered yet?)')
          }

          const fg = text.alpha < 1
            ? text.rgb.map((c, i) => c * text.alpha + lightestRgb[i] * (1 - text.alpha))
            : text.rgb
          const fgLum = lum(fg)
          const ratio = (Math.max(fgLum, lightest) + 0.05) / (Math.min(fgLum, lightest) + 0.05)

          const fontSize = parseFloat(cs.fontSize)
          const weight = parseInt(cs.fontWeight, 10)
          const bold = Number.isFinite(weight) ? weight >= 700 : false
          const large = Number.isFinite(fontSize) && (fontSize >= LARGE_PX || (fontSize >= LARGE_BOLD_PX && bold))
          const amber = same(text.rgb, AMBER) || same(lightestRgb, AMBER)
          const threshold = amber ? MIN_AMBER : (large ? MIN_LARGE : MIN_BODY)

          checked++
          const margin = ratio - threshold
          if (!worst || margin < worst.margin) {
            worst = {
              margin,
              textColour: rawColour,
              backgroundColour: 'rgb(' + lightestRgb.join(', ') + ')',
              backgroundLuminance: Number(lightest.toFixed(4)),
              ratio: Number(ratio.toFixed(4)),
              threshold,
              fontSize: Number.isFinite(fontSize) ? fontSize : null,
              fontWeight: Number.isFinite(weight) ? weight : null,
              large,
              amber,
            }
          }
        }
      } catch (err) {
        return bail('unreadable', 'the scene pixels could not be read: ' + (err && err.message ? err.message : String(err)))
      }

      // Order matters: a measured pair below its own tier is the most actionable
      // finding, an unmeasurable colour is next, a measured pass is last, and
      // "nothing was here" is never allowed to read as success.
      if (worst && worst.margin < 0) {
        const { margin, ...record } = worst
        return { ...head, status: 'ok', checked, ...record }
      }
      if (badColour) {
        return {
          ...head, status: 'unparseable', ratio: null, threshold: null, checked,
          textColour: badColour.raw,
          detail: 'cannot parse the computed colour ' + JSON.stringify(badColour.raw) + ' of ' + badColour.key + ' - that pair was not measured, so it cannot pass',
        }
      }
      if (worst) {
        const { margin, ...record } = worst
        return { ...head, status: 'ok', checked, ...record }
      }
      return bail('no-text', visible === 0
        ? 'none of the ' + els.length + ' [data-contrast] elements intersect the viewport - nothing was measured, so this is not a pass'
        : visible + ' of ' + els.length + ' [data-contrast] elements are in the viewport but none had a sampleable box - nothing was measured, so this is not a pass')
    }
  })()
`

const argv = process.argv.slice(2)
const cmd = argv.shift()
// `signature --geometry <url> ...` - the flag is parsed here, not as a URL, so a
// mistaken `signature <url> --geometry` fails loudly instead of navigating to
// the literal string "--geometry".
const geometry = cmd === 'signature' && argv[0] === '--geometry'
if (geometry) argv.shift()
const url = argv.shift()
if (!cmd || !url) {
  console.error('usage: node scripts/visual-check.mjs <measure|shots|signature|contrast> [--geometry] <url> [outDir] [width:height ...]')
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

// The `preserve=1` flag has to land in the query, not after the fragment: a run
// against `/#/wiki` would otherwise hand the scene a flag that URLSearchParams
// can never see.
const withPreserve = (u) => {
  const at = u.indexOf('#')
  const head = at === -1 ? u : u.slice(0, at)
  const tail = at === -1 ? '' : u.slice(at)
  return head + (head.includes('?') ? '&' : '?') + 'preserve=1' + tail
}

// The single place any command loads a page: viewport override, navigate, the
// error check, and the settle delay. `measure`, `signature`, `shots` and
// `contrast` all route through it, so the delay or the error handling can never
// drift between them.
const goto = async (send, target, w, h) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 })
  const nav = await send('Page.navigate', { url: target })
  if (nav.errorText) throw new Fail(`cannot load ${target}: ${nav.errorText}`, 1)
  await sleep(SETTLE_MS) // fonts, images and the WebGL scene
}

// The contract `contrast` sampling rests on, and the work only the harness can
// do because only the harness knows the index:
//
//   * `window.__diveProbe()` is installed by DiveScroll and returns one index
//     per `.dive-section` in DOM order; `window.__diveContrast(i)` is installed
//     by CONTRAST_PROBE in this file. Neither exists until the scene does, which
//     is why a page without them reports `no-canvas` instead of a measurement.
//   * useDiveDepth reads the scene at READING_LINE = innerHeight * 0.5 and takes
//     the last section box whose top is at or above that line as the active
//     biome - so index i means "section i at the reading line", not "whatever
//     position the page happened to load at". The harness therefore scrolls
//     section i's box onto the line itself, waits the settle delay, and only
//     then measures: spec §6.4/7 samples at each regime boundary *while the text
//     is in that regime*.
//   * Two conditions are checked and reported back per row - the reading line
//     must end up inside section i (otherwise the scene shows another regime and
//     the label would be a lie), and section i's `[data-contrast]` inner must be
//     on screen (otherwise the probe has nothing to measure). Either failing is
//     a fail-closed `unscrolled` row, not a skipped one.
const putInRegime = async (send, regimeIndex) => {
  const r = await send('Runtime.evaluate', {
    expression: `(() => {
  const sections = document.querySelectorAll('.dive-section')
  const el = sections[${regimeIndex}]
  if (!el) return { ok: false, detail: 'section ${regimeIndex} not found (' + sections.length + ' .dive-section elements) - the page cannot be put in that regime, so nothing was measured' }
  const line = Math.round(innerHeight * 0.5)
  const box = el.getBoundingClientRect()
  window.scrollTo({ top: Math.round(scrollY + box.top + box.height / 2 - line), behavior: 'instant' })
  const after = el.getBoundingClientRect()
  if (after.top > line || after.bottom < line) return { ok: false, detail: 'the reading line cannot be moved inside section ${regimeIndex} (clamped at scrollY ' + Math.round(scrollY) + ') - the scene would show another regime, so nothing was measured' }
  const inner = el.querySelector('[data-contrast]')
  const ir = inner && inner.getBoundingClientRect()
  return { ok: true, scrolledTo: Math.round(scrollY), textOnScreen: !!ir && ir.bottom > 0 && ir.top < innerHeight }
})()`,
    returnByValue: true, awaitPromise: true,
  })
  if (r.exceptionDetails) throw new Fail(JSON.stringify(r.exceptionDetails), 4)
  const state = r.result.value
  if (state && state.ok) await sleep(SETTLE_MS) // let the scene catch up with the new position
  return state
}

// One width of the `contrast` gate, riding the same CDP connection `measure`
// uses - PORT is pinned, so a second client would fight this one for the single
// browser instance. Launch, error handling and teardown stay where they are.
const contrastAt = async (send, w, h) => {
  await goto(send, withPreserve(url), w, h)

  const install = await send('Runtime.evaluate', { expression: CONTRAST_PROBE, returnByValue: true })
  if (install.exceptionDetails) throw new Fail(JSON.stringify(install.exceptionDetails), 4)

  const probe = await send('Runtime.evaluate', {
    expression: 'window.__diveProbe ? window.__diveProbe() : null',
    returnByValue: true, awaitPromise: true,
  })
  if (probe.exceptionDetails) throw new Fail(JSON.stringify(probe.exceptionDetails), 4)
  const regimes = probe.result.value

  // The one tolerated empty result: the spine that installs __diveProbe does not
  // exist yet, so there is genuinely nothing to sample. It is still printed as
  // its own status rather than dropped, so "no numbers" cannot be read as
  // "all clear".
  if (regimes == null) {
    return [{ width: w, status: 'no-canvas', detail: 'window.__diveProbe is not installed - nothing was sampled at this width' }]
  }
  if (!Array.isArray(regimes) || regimes.length === 0) {
    return [{
      width: w, status: 'no-regimes', pass: false,
      detail: 'window.__diveProbe() returned ' + String(regimes).slice(0, 120) + ' - no regimes to sample, so this is not a pass',
    }]
  }

  const entries = []
  for (const sample of regimes) {
    // The spine hands back bare indices; an object carrying regimeIndex reads the
    // same way. Anything else is reported, not silently skipped.
    const regimeIndex = typeof sample === 'number'
      ? sample
      : sample != null && typeof sample === 'object' ? Number(sample.regimeIndex) : NaN
    if (!Number.isFinite(regimeIndex)) {
      entries.push({
        width: w, regimeIndex: null, status: 'bad-regime', pass: false,
        detail: '__diveProbe returned a sample with no numeric regimeIndex: ' + String(sample).slice(0, 120),
      })
      continue
    }
    // Put the page in this regime's state first - see putInRegime for the full
    // contract. A row that cannot be positioned reports why and fails; it is
    // never dropped, and never measured in whatever state the page was in.
    const state = await putInRegime(send, regimeIndex)
    if (!state || state.ok !== true) {
      entries.push({
        width: w, regimeIndex, status: 'unscrolled', pass: false,
        detail: (state && state.detail) || 'the page could not be positioned for this regime, so nothing was measured',
      })
      continue
    }
    const r = await send('Runtime.evaluate', {
      expression: `window.__diveContrast(${JSON.stringify(regimeIndex)})`,
      returnByValue: true, awaitPromise: true,
    })
    if (r.exceptionDetails) throw new Fail(JSON.stringify(r.exceptionDetails), 4)
    const finding = r.result.value
    // `status` says what was measured, `pass` is the verdict; only a measured
    // pair with a finite ratio can ever pass.
    const pass = finding.status === 'ok' && Number.isFinite(finding.ratio) && finding.ratio >= finding.threshold
    // scrolledTo/textOnScreen are the row's receipt: they show which position
    // produced the numbers, so two rows with the same numbers can be told apart
    // from two rows that measured the same state twice.
    entries.push({
      width: w, ...finding,
      scrolledTo: state.scrolledTo, textOnScreen: state.textOnScreen,
      pass,
    })
  }
  return entries
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
    if (cmd === 'contrast') {
      results.push(...(await contrastAt(send, w, h)))
      continue
    }
    const metrics = { width: w, height: h }
    await goto(send, url, w, h)

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
  // `contrast` is a gate: any sampled pair below its own tier, any colour that
  // could not be read, and any width or regime with nothing to measure all fail.
  // `no-canvas` is the sole tolerated state - the scene does not exist yet.
  if (cmd === 'contrast' && results.some((r) => r.pass === false)) process.exitCode = 1
} catch (err) {
  console.error('visual-check failed: ' + (err && err.message ? err.message : String(err)))
  process.exitCode = err instanceof Fail ? err.code : 1
} finally {
  await cleanup()
}
