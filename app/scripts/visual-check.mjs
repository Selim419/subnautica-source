// Chrome DevTools Protocol harness - zero dependencies (Node 22+ has a global WebSocket).
//
// Verifies design work by measuring the real layout instead of eyeballing it:
// horizontal overflow, clickable text that wraps, and which base path the fonts
// actually resolved to. Screenshots go to disk so the change can be looked at too.
//
//   node scripts/visual-check.mjs measure <url> [width:height ...]
//   node scripts/visual-check.mjs shots   <url> <outDir> [width:height ...]
//
// Dev tool only. Never wire this into CI: the runner is Linux without a browser
// and the script exits 3 with a clear message when it cannot find one.

import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

const [cmd, url, ...rest] = process.argv.slice(2)
if (!cmd || !url) {
  console.error('usage: node scripts/visual-check.mjs <measure|shots> <url> [outDir] [width:height ...]')
  process.exit(2)
}
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

    const r = await send('Runtime.evaluate', { expression: readFileSync(PROBE, 'utf8'), returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Fail(JSON.stringify(r.exceptionDetails), 4)
    Object.assign(metrics, r.result.value)

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
