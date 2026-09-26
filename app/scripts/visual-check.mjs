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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]
const PORT = 9335
const PROBE = resolve(import.meta.dirname, 'page-probe.js')

const [cmd, url, ...rest] = process.argv.slice(2)
if (!cmd || !url) {
  console.error('usage: node scripts/visual-check.mjs <measure|shots> <url> [outDir] [width:height ...]')
  process.exit(2)
}
const outDir = cmd === 'shots' ? resolve(rest.shift()) : null
const widths = rest.length ? rest : ['320:800', '375:812', '414:896', '768:1024', '1440:900']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const bin = CHROME_CANDIDATES.find((p) => { try { return readFileSync(p).length > 0 } catch { return false } })
if (!bin) {
  console.error('Chrome/Edge not found - cannot measure. Install one or skip this check.')
  process.exit(3)
}

const child = spawn(bin, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu', '--no-sandbox',
  '--hide-scrollbars', '--user-data-dir=' + resolve(process.env.TEMP, 'opencode', 'cdp-profile3'),
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
if (!wsUrl) { console.error('DevTools did not come up'); child.kill(); process.exit(3) }

const ws = new WebSocket(wsUrl)
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })

let id = 0
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id)
    pending.delete(m.id)
    m.error ? rej(new Error(m.error.message)) : res(m.result)
  }
})
const send = (method, params = {}) => {
  const i = ++id
  ws.send(JSON.stringify({ id: i, method, params }))
  return new Promise((res, rej) => {
    pending.set(i, { res, rej })
    setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error(method + ' timed out')) } }, 60000)
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
  await send('Page.navigate', { url })
  await sleep(3800) // fonts, images and the WebGL scene

  const r = await send('Runtime.evaluate', { expression: readFileSync(PROBE, 'utf8'), returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) { console.error(JSON.stringify(r.exceptionDetails)); child.kill(); process.exit(4) }
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
ws.close()
child.kill()
