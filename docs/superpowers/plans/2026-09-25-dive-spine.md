# Dive Spine (Plan 2B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the home page into a scroll-driven dive: one fixed procedural ocean canvas, six biome sections, and a depth gauge that reads the same number as the scene every frame.

**Architecture:** `regimes.js` (5 atmosphere rows) and `biomes.js` (6 content rows) are dependency-free data. `useDiveDepth` converts the reading line into `{ metres, biomeIndex, regimeIndex }` and writes it to a stable `frameRef`; a `subscribe` list notifies the gauge without React state. `OceanCanvas` owns the single WebGL context and lerps uniforms over 600 ms on regime change. `DiveScroll` wraps the hero plus six sections so the fixed canvas and the CSS gradient fallback both end exactly where the spine ends.

**Tech Stack:** React 19, three ^0.186.1, motion ^12, animejs ^4, Vite 6, vitest (new), existing CDP harness `app/scripts/visual-check.mjs`.

## Global Constraints

- Source repo: `C:\Users\selim\subnautica-github-pages`, branch `main`. No commits unless a step says so.
- Test command: `npm test` in `app/` → `vitest run`. Existing gates: `npm run build:root`, `npm run build:subpath`, `npm run test:base`.
- Design gates (spec §6.4): **zero** hex/`oklch()`/`rgb()` literals outside `app/src/design/tokens.css`; every `font-family` goes through a token; **no italic headings**; four mandatory widths 320/375/414/768 plus 1440 must report `overflow:false` and `bodyOverflowX:"clip"` on `/` and `/#/wiki`.
- Text contrast (spec §6.4/7): body text over the scene ≥ 4.5:1 at every mandatory width and every regime boundary. Measured, never eyeballed.
- Depth is read from `frameRef`, **never** React state, on every frame. The only state updates in the dive path are `regimeIndex` changes (5 per page).
- `three` stays in a `React.lazy` chunk; JS bundle gzip ≤ 180 KB; first load ≤ 700 KB.
- `prefers-reduced-motion: reduce` → the scene is never constructed, scroll-driven transitions become instant state changes, the dive returns to normal flow.
- Turkish copy: use the strings given verbatim. No invented numbers anywhere (spec §6.4/2).
- `wikiData.js`, `.manifesto`, `.final-cta`, `ocean-hero.webp`, `lost-river.webp` are untouchable (spec §1.3).

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/dive/regimes.js` | **Created.** Pure data + `regimeAt(metres)`. 5 rows. No imports. |
| `app/src/dive/biomes.js` | **Created.** Pure data. 6 rows. No imports. |
| `app/src/dive/useDiveDepth.js` | **Created.** Pure `sampleAt`/`metresAt`/`biomeIndexAt` + the hook with `frameRef` and `subscribe`. Imports only the two data modules. |
| `app/src/dive/DiveScroll.jsx` | **Created.** Owns one `useDiveDepth` call, mounts canvas + gauge, IntersectionObserver for visibility. |
| `app/src/dive/DepthGauge.jsx` | **Created.** Subscribes, writes DOM directly. `aria-hidden`. |
| `app/src/scene/shaders/{water,rays,kelp,particulate}.js` | **Created.** Each `{ uniforms, vertexShader, fragmentShader }`. No imports. |
| `app/src/scene/buildScene.js` | **Created.** Builds the scene graph, exposes `setTarget` (600 ms lerp), `setProgress`, `render`, `resize`, `dispose`. |
| `app/src/scene/OceanCanvas.jsx` | **Created.** Single renderer owner; rAF loop; WebGL failure → renders nothing. |
| `app/src/components/WordCycle.jsx` | **Created.** The `TextRoll` logic from `skiper58.jsx`, attribution removed. |
| `app/src/design/dive.css` | **Rewritten.** Spine layout, six sections, scrim, gauge. Tab/card blocks removed. |
| `app/src/design/hero.css` | **Modified.** `.hero-image` and `.hero-rail` rules removed. |
| `app/src/design/layout.css` | **Modified.** `--dive-length` and the fallback gradient. |
| `app/src/HomeView.jsx` | **Modified.** `DiveScroll` wraps hero + six sections; `diveZones` removed. |
| `app/src/main.jsx` | **Modified.** `WordCycle` import; Skiper attribution removed from footer. |
| `app/scripts/visual-check.mjs` | **Modified.** New `contrast` command. |
| `app/package.json`, `app/vitest.config.js` | **Modified/Created.** vitest + `test` script. |
| `app/public/kelp-forest.webp` | **Deleted.** |
| `app/src/OceanScene.jsx`, `app/src/skiper58.jsx` | **Deleted.** |

---

### Task 1: Test harness + `regimes.js`

**Files:**
- Create: `app/vitest.config.js`
- Create: `app/src/dive/regimes.js`
- Create: `app/src/dive/regimes.test.js`
- Modify: `app/package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `REGIMES: Regime[]`, `regimeAt(metres: number): number`. `Regime = { id: string, from: number, to: number, water: string, fog: number, light: number, lightColor: string, rays: number, particles: number, biolum: number, accent: string }`. Later tasks import exactly these names.

- [ ] **Step 1: Add vitest**

In `app/package.json` `devDependencies` add `"vitest": "^3.0.0"`, and in `scripts` add `"test": "vitest run"`.

Create `app/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
```

- [ ] **Step 2: Write the failing test**

Create `app/src/dive/regimes.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { REGIMES, regimeAt } from './regimes.js'

describe('regimes', () => {
  it('has exactly five rows', () => {
    expect(REGIMES).toHaveLength(5)
  })

  it('covers 0 to infinity with no gaps and no overlaps', () => {
    expect(REGIMES[0].from).toBe(0)
    for (let i = 1; i < REGIMES.length; i++) {
      expect(REGIMES[i].from).toBe(REGIMES[i - 1].to)
    }
    expect(REGIMES[4].to).toBe(Infinity)
  })

  it.each([[0, 0], [79, 0], [80, 1], [199, 1], [200, 2], [524, 2],
    [525, 3], [1064, 3], [1065, 4], [1400, 4], [1e9, 4]])(
    'regimeAt(%i) === %i', (metres, expected) => {
      expect(regimeAt(metres)).toBe(expected)
    })

  it('clamps below zero to the first regime', () => {
    expect(regimeAt(-50)).toBe(0)
  })

  it('carries every atmosphere field the scene consumes', () => {
    for (const r of REGIMES) {
      expect(r).toMatchObject({
        id: expect.any(String),
        water: expect.stringMatching(/^#[0-9a-f]{6}$/),
        fog: expect.any(Number),
        light: expect.any(Number),
        lightColor: expect.stringMatching(/^#[0-9a-f]{6}$/),
        rays: expect.any(Number),
        particles: expect.any(Number),
        biolum: expect.any(Number),
        accent: expect.stringMatching(/^#[0-9a-f]{6}$/),
      })
    }
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm install && npm test`
Expected: FAIL — `Failed to load ./regimes.js` / `Cannot find module`.

- [ ] **Step 4: Write the implementation**

Create `app/src/dive/regimes.js`:

```js
export const REGIMES = [
  { id: 'daylight', from: 0,    to: 80,
    water: '#4fc3d9', fog: 0.014, light: 1.40, lightColor: '#ffffff',
    rays: 0.90, particles: 1.00, biolum: 0.00, accent: '#7fe7ff' },
  { id: 'twilight', from: 80,   to: 200,
    water: '#1f7fa8', fog: 0.030, light: 0.85, lightColor: '#bfe6ff',
    rays: 0.45, particles: 0.90, biolum: 0.06, accent: '#59d7c0' },
  { id: 'midnight', from: 200,  to: 525,
    water: '#0b3350', fog: 0.055, light: 0.45, lightColor: '#7fb4d8',
    rays: 0.18, particles: 0.70, biolum: 0.45, accent: '#57b8ff' },
  { id: 'deep',     from: 525,  to: 1065,
    water: '#05182c', fog: 0.085, light: 0.22, lightColor: '#4a7fa8',
    rays: 0.06, particles: 0.50, biolum: 0.60, accent: '#3f7ad9' },
  { id: 'biolum',   from: 1065, to: Infinity,
    water: '#030a18', fog: 0.120, light: 0.10, lightColor: '#6a4fb0',
    rays: 0.00, particles: 0.35, biolum: 1.00, accent: '#b06cff' },
]

export function regimeAt(metres) {
  if (metres < REGIMES[0].from) return 0
  for (let i = REGIMES.length - 1; i >= 0; i--) {
    if (metres >= REGIMES[i].from) return i
  }
  return 0
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm test`
Expected: PASS — 5 tests.

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/package-lock.json app/vitest.config.js app/src/dive/regimes.js app/src/dive/regimes.test.js
git commit -m "Add vitest and the five depth regimes as pure data"
```

---

### Task 2: `biomes.js`

**Files:**
- Create: `app/src/dive/biomes.js`
- Create: `app/src/dive/biomes.test.js`

**Interfaces:**
- Consumes: `REGIMES` (for the `regime` key validation).
- Produces: `BIOMES: Biome[]`. `Biome = { n: string, id: string, regime: string, from: number, to: number, depth: string, index: string, name: string, original: string, line: string, text: string, accent: string, glow: string, wiki: string | null }`. Rows 1, 2, 4 keep the exact prose already in `HomeView.jsx`; rows 3, 5, 6 are new.

- [ ] **Step 1: Write the failing test**

Create `app/src/dive/biomes.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { BIOMES } from './biomes.js'
import { REGIMES } from './regimes.js'

const wikiIds = ['safe-shallows', 'kelp-forest', 'grand-reef', 'lost-river',
  'peeper', 'stalker', 'reaper', 'seamoth', 'prawn', 'cyclops']

describe('biomes', () => {
  it('has exactly six rows', () => {
    expect(BIOMES).toHaveLength(6)
  })

  it('runs contiguously from 0 to 1600', () => {
    expect(BIOMES[0].from).toBe(0)
    expect(BIOMES[5].to).toBe(1600)
    for (let i = 1; i < BIOMES.length; i++) {
      expect(BIOMES[i].from).toBe(BIOMES[i - 1].to)
      expect(BIOMES[i].from).toBeGreaterThan(BIOMES[i - 1].from)
    }
  })

  it('names a regime that exists, in order', () => {
    const ids = REGIMES.map((r) => r.id)
    let last = -1
    for (const b of BIOMES) {
      const i = ids.indexOf(b.regime)
      expect(i).toBeGreaterThan(-1)
      expect(i).toBeGreaterThanOrEqual(last)
      last = i
    }
    expect(BIOMES[4].regime).toBe('biolum')
    expect(BIOMES[5].regime).toBe('biolum')
  })

  it('only links to wiki records that exist', () => {
    for (const b of BIOMES) {
      if (b.wiki === null) continue
      expect(wikiIds).toContain(b.wiki)
    }
    expect(BIOMES.filter((b) => b.wiki === null)).toHaveLength(3)
  })

  it('carries the section chrome fields', () => {
    for (const b of BIOMES) {
      expect(b).toMatchObject({
        n: expect.stringMatching(/^\d{2}$/),
        depth: expect.stringMatching(/^\d{3}—\d{4} M$|^\d{4}—\d{4} M$/),
        index: expect.any(String),
        name: expect.any(String),
        original: expect.any(String),
        line: expect.any(String),
        text: expect.any(String),
        accent: expect.stringMatching(/^var\(--[a-z-]+\)$/),
        glow: expect.stringMatching(/^#[0-9a-f]{6}$/),
      })
      expect(b.text.length).toBeGreaterThan(40)
    }
  })

  it('numbers sections 01 to 06', () => {
    expect(BIOMES.map((b) => b.n)).toEqual(['01', '02', '03', '04', '05', '06'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm test`
Expected: FAIL — `Failed to load ./biomes.js`.

- [ ] **Step 3: Write the implementation**

Create `app/src/dive/biomes.js`:

```js
export const BIOMES = [
  {
    n: '01', id: 'safe-shallows', regime: 'daylight', from: 0, to: 80,
    depth: '000—080 M', index: 'YÜZEY',
    name: 'Sığ Resifler', original: 'SAFE SHALLOWS',
    line: 'Işığın her şeyi gösterdiği yer.',
    text: 'Kurtarma kapsülünden ilk kez ayrıl. Mercanların arasında yönünü bul ve okyanusun sesine alış.',
    accent: 'var(--glow)', glow: '#7fe7ff', wiki: 'safe-shallows',
  },
  {
    n: '02', id: 'kelp-forest', regime: 'twilight', from: 80, to: 200,
    depth: '080—200 M', index: 'ALACAKARANLIK',
    name: 'Yosun Ormanı', original: 'KELP FOREST',
    line: 'Görüş azalır. Merak artar.',
    text: 'Creepvine gövdeleri akıntıyla birlikte hareket eder. Her gölge, yeni bir yaşam izi olabilir.',
    accent: 'var(--kelp)', glow: '#59d7c0', wiki: 'kelp-forest',
  },
  {
    n: '03', id: 'mushroom-forest', regime: 'midnight', from: 200, to: 525,
    depth: '200—525 M', index: 'ORTA DERİNLİK',
    name: 'Mantar Ormanı', original: 'MUSHROOM FOREST',
    line: 'Ağaçlar burada mantar.',
    text: 'Dev gövdeler karanlıkta dimdik durur, tepelerindeki tabakalar sıradan bir gelgit ritmi izler. Işıksız bu dipte yönü, ancak bu gövdelerin eğimi verir.',
    accent: 'var(--kelp)', glow: '#57b8ff', wiki: null,
  },
  {
    n: '04', id: 'lost-river', regime: 'deep', from: 525, to: 1065,
    depth: '525—1065 M', index: 'DERİNLİK',
    name: 'Kayıp Nehir', original: 'LOST RIVER',
    line: 'Bazı yollar geri dönülmez.',
    text: 'Mineral kaya yüzeyleri ve fosil yatakları arasında ilerle. Buradaki her iz, senden önce buraya inen birinin bıraktığı izdir.',
    accent: 'var(--bathyal)', glow: '#3f7ad9', wiki: 'lost-river',
  },
  {
    n: '05', id: 'bulb-zone', regime: 'biolum', from: 1065, to: 1400,
    depth: '1065—1400 M', index: 'BİYOLÜMİNESAN',
    name: 'Ampul Zonu', original: 'BULB ZONE',
    line: 'Karanlık, kendi ışığını üretir.',
    text: 'Duvarlara yayılan ampuller suyun hareketini yavaşça takip eder. Işık bir uyarı ya da bir davet gibi parlar; hangisi olduğunu ancak yaklaştığında anlarsın.',
    accent: 'var(--glow)', glow: '#b06cff', wiki: null,
  },
  {
    n: '06', id: 'sulfur-pits', regime: 'biolum', from: 1400, to: 1600,
    depth: '1400—1600 M', index: 'LAV AĞIZLARI',
    name: 'Kükürt Deposu', original: 'SULFUR PITS',
    line: 'Isı, derinliğin son kanıtı.',
    text: 'Bacalardan yükselen sıcak akıntılar çevreyi sarı bir buhara boğar. Burada nefes payı kısadır; ölçümü düşürmeden geç.',
    accent: 'var(--bathyal)', glow: '#f0b45a', wiki: null,
  },
]
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm test`
Expected: PASS — 6 tests in `biomes`, 5 in `regimes`.

- [ ] **Step 5: Commit**

```bash
git add app/src/dive/biomes.js app/src/dive/biomes.test.js
git commit -m "Add the six biome records, three of them new"
```

---

### Task 3: `useDiveDepth`

**Files:**
- Create: `app/src/dive/useDiveDepth.js`
- Create: `app/src/dive/useDiveDepth.test.js`

**Interfaces:**
- Consumes: `BIOMES`, `regimeAt`.
- Produces: `sampleAt(y, boxes) => { metres, biomeIndex, regimeIndex }`, `metresAt(y, boxes)`, `biomeIndexAt(y, boxes)`, and `useDiveDepth() => { frameRef, regimeIndex, subscribe }`.
  - `boxes: { top: number, bottom: number }[]` — six viewport-space boxes for the six sections, in document order.
  - `frameRef: RefObject<{ y, metres, biomeIndex, regimeIndex }>` — same object identity every render.
  - `subscribe(fn): () => void` — `fn(frameRef.current)` is called after every scroll sample; returns an unsubscribe.

- [ ] **Step 1: Write the failing test**

Create `app/src/dive/useDiveDepth.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { biomeIndexAt, metresAt, sampleAt } from './useDiveDepth.js'

// Six 133vh-tall sections stacked from 100vh to 900vh.
const makeBoxes = (vh = 800) => {
  const s = vh * 1.3333
  const hero = vh
  return Array.from({ length: 6 }, (_, i) => ({
    top: hero + i * s,
    bottom: hero + (i + 1) * s,
  }))
}

describe('sampleAt', () => {
  it('reports 0 m while still in the hero', () => {
    const boxes = makeBoxes()
    expect(sampleAt(0, boxes)).toEqual({ metres: 0, biomeIndex: 0, regimeIndex: 0 })
    expect(sampleAt(boxes[0].top - 1, boxes).metres).toBe(0)
  })

  it('reads the section whose box contains the reading line', () => {
    const boxes = makeBoxes()
    expect(biomeIndexAt(boxes[3].top + 10, boxes)).toBe(3)
    expect(biomeIndexAt(boxes[5].bottom - 10, boxes)).toBe(5)
  })

  it('clamps past the last section instead of running off', () => {
    const boxes = makeBoxes()
    expect(biomeIndexAt(boxes[5].bottom + 5000, boxes)).toBe(5)
    expect(metresAt(boxes[5].bottom + 5000, boxes)).toBe(1600)
  })

  it('starts each section at its own from-depth and ends at its to-depth', () => {
    const boxes = makeBoxes()
    expect(metresAt(boxes[2].top, boxes)).toBe(200)
    expect(metresAt(boxes[2].bottom, boxes)).toBe(525)
    expect(metresAt(boxes[0].top, boxes)).toBe(0)
  })

  it('is monotonic along a straight scroll down', () => {
    const boxes = makeBoxes()
    let prev = -1
    for (let y = 0; y <= boxes[5].bottom + 100; y += 37) {
      const m = metresAt(y, boxes)
      expect(m).toBeGreaterThanOrEqual(prev)
      prev = m
    }
  })

  it('returns the same value for the same y regardless of direction', () => {
    const boxes = makeBoxes()
    const down = []
    for (let y = 0; y <= boxes[5].bottom; y += 61) down.push(metresAt(y, boxes))
    const up = []
    for (let y = boxes[5].bottom; y >= 0; y -= 61) up.push(metresAt(y, boxes))
    expect(up.reverse()).toEqual(down)
  })

  it('maps depth to the regime row that owns that depth', () => {
    const boxes = makeBoxes()
    expect(sampleAt(boxes[1].top, boxes).regimeIndex).toBe(1)
    expect(sampleAt(boxes[4].top, boxes).regimeIndex).toBe(4)
    expect(sampleAt(boxes[5].top, boxes).regimeIndex).toBe(4)
  })

  it('is a pure function of y and boxes', () => {
    const boxes = makeBoxes()
    expect(sampleAt(4000, boxes)).toEqual(sampleAt(4000, boxes))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm test`
Expected: FAIL — `Failed to load ./useDiveDepth.js`.

- [ ] **Step 3: Write the pure part of the implementation**

Create `app/src/dive/useDiveDepth.js` with the pure functions first:

```js
import { useCallback, useEffect, useRef, useState } from 'react'
import { BIOMES } from './biomes.js'
import { REGIMES, regimeAt } from './regimes.js'

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v }

export function biomeIndexAt(y, boxes) {
  if (!boxes.length) return 0
  if (y < boxes[0].top) return 0
  for (let i = boxes.length - 1; i >= 0; i--) {
    if (y >= boxes[i].top) return i
  }
  return 0
}

export function metresAt(y, boxes) {
  if (!boxes.length) return 0
  if (y < boxes[0].top) return 0
  const i = biomeIndexAt(y, boxes)
  const box = boxes[i]
  const local = clamp01((y - box.top) / Math.max(1, box.bottom - box.top))
  const b = BIOMES[i]
  return b.from + (b.to - b.from) * local
}

export function sampleAt(y, boxes) {
  const metres = metresAt(y, boxes)
  return { metres, biomeIndex: biomeIndexAt(y, boxes), regimeIndex: regimeAt(metres) }
}
```

- [ ] **Step 4: Run to verify the pure part passes**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm test`
Expected: PASS — all `useDiveDepth` pure-function tests green.

- [ ] **Step 5: Add the hook**

Append to `app/src/dive/useDiveDepth.js`:

```js
const READING_LINE = 0.5

function readBoxes(elements) {
  return elements.filter(Boolean).map((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom }
  })
}

export function useDiveDepth(sectionRefs) {
  const frameRef = useRef({ y: 0, metres: 0, biomeIndex: 0, regimeIndex: 0 })
  const listeners = useRef(new Set())
  const [regimeIndex, setRegimeIndex] = useState(0)

  const sample = useCallback(() => {
    const boxes = readBoxes(sectionRefs.current)
    if (!boxes.length) return
    const y = window.innerHeight * READING_LINE
    const next = sampleAt(y, boxes)
    const f = frameRef.current
    f.y = y
    f.metres = next.metres
    f.biomeIndex = next.biomeIndex
    if (next.regimeIndex !== f.regimeIndex) {
      f.regimeIndex = next.regimeIndex
      setRegimeIndex(next.regimeIndex)
    }
    listeners.current.forEach((fn) => fn(f))
  }, [sectionRefs])

  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; sample() })
    }
    sample()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [sample])

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn)
    fn(frameRef.current)
    return () => listeners.current.delete(fn)
  }, [])

  return { frameRef, regimeIndex, subscribe }
}
```

- [ ] **Step 6: Run the full suite**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm test`
Expected: PASS — every test file green.

- [ ] **Step 7: Commit**

```bash
git add app/src/dive/useDiveDepth.js app/src/dive/useDiveDepth.test.js
git commit -m "Read depth from the reading line into a stable frame ref"
```

---

### Task 4: `visual-check.mjs contrast` gate

**Files:**
- Modify: `app/scripts/visual-check.mjs`
- Modify: `app/src/scene/OceanCanvas.jsx` — *not yet created; this step only adds the URL flag to the harness so Task 6 can honour it. Until Task 6 lands, the command reports `no-canvas` and exits 0.*

**Interfaces:**
- Consumes: the harness's existing CDP connection helpers.
- Produces: `node scripts/visual-check.mjs contrast <url> <widths...>` → JSON with `[{ width, regimeIndex, textColour, backgroundLuminance, ratio, pass }]`, non-zero exit if any `pass` is false.

- [ ] **Step 1: Read the existing harness**

Run: `cd C:\Users\selim\subnautica-github-pages\app && node -e "const s=require('fs').readFileSync('scripts/visual-check.mjs','utf8');console.log(s.slice(0,1600))"`

Note the exported helpers (`connect`, `navigate`, `evaluate`, `close`) and reuse them; do not open a second WebSocket.

- [ ] **Step 2: Add the failing behaviour**

Append a `contrast` command to `app/scripts/visual-check.mjs`'s dispatch:

```js
async function contrast(url, widths) {
  const results = []
  for (const width of widths) {
    const w = Number(width.split(':')[0])
    const h = Number(width.split(':')[1] || 900)
    const session = await connect()
    await navigate(session, url + (url.includes('?') ? '&' : '?') + 'preserve=1')
    await setViewport(session, w, h)

    const regimes = await evaluate(session, `window.__diveProbe ? window.__diveProbe() : null`)
    if (!regimes) {
      results.push({ width: w, status: 'no-canvas' })
      await close(session)
      continue
    }

    for (const sample of regimes) {
      const { regimeIndex, blocks } = sample
      const ratio = await evaluate(session, `window.__diveContrast(${regimeIndex})`)
      results.push({ width: w, regimeIndex, ...ratio, pass: ratio.ratio >= 4.5 })
    }
    await close(session)
  }
  return results
}
```

Where `__diveProbe` and `__diveContrast` are installed by a probe script inlined into the page (define them in this file as a string constant `CONTRAST_PROBE`), performing: copy the WebGL canvas into a 2D canvas, walk `[data-contrast]` elements, read `getComputedStyle` colour, take the **lightest** pixel under each element's box, and return the WCAG ratio:

```js
const CONTRAST_PROBE = `
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
  window.__diveContrast = (regimeIndex) => {
    const gl = document.querySelector('canvas[data-ocean]')
    if (!gl) return { status: 'no-canvas', ratio: 0 }
    const c = document.createElement('canvas')
    c.width = gl.width; c.height = gl.height
    c.getContext('2d').drawImage(gl, 0, 0)
    const ctx = c.getContext('2d')
    let worst = Infinity
    for (const el of document.querySelectorAll('[data-contrast]')) {
      const r = el.getBoundingClientRect()
      if (r.bottom < 0 || r.top > innerHeight) continue
      const px = Math.max(1, Math.floor(r.width)), py = Math.max(1, Math.floor(r.height))
      const sx = Math.max(0, Math.floor(r.left * gl.width / innerWidth))
      const sy = Math.max(0, Math.floor(r.top * gl.height / innerHeight))
      const sw = Math.min(gl.width - sx, Math.floor(px * gl.width / innerWidth))
      const sh = Math.min(gl.height - sy, Math.floor(py * gl.height / innerHeight))
      if (sw <= 0 || sh <= 0) continue
      const data = ctx.getImageData(sx, sy, sw, sh).data
      let lightest = 0
      for (let i = 0; i < data.length; i += 4) {
        const l = lum([data[i], data[i + 1], data[i + 2]])
        if (l > lightest) lightest = l
      }
      const m = getComputedStyle(el).color.match(/\\d+/g).map(Number)
      const text = lum(m)
      const ratio = (Math.max(text, lightest) + 0.05) / (Math.min(text, lightest) + 0.05)
      if (ratio < worst) worst = ratio
    }
    return { regimeIndex, ratio: Number(worst.toFixed(2)), status: worst === Infinity ? 'no-text' : 'ok' }
  }
`
```

Also expose `window.__diveProbe` from `DiveScroll` in Task 7 (returning the six regime indices to sample); until then return `null`.

- [ ] **Step 3: Run it to confirm the harness behaves**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm run dev` in one shell, then in another:
`node scripts/visual-check.mjs contrast http://127.0.0.1:5173 375:812 1440:900`
Expected: JSON containing `status: "no-canvas"` entries, exit code 0. (The scene does not exist yet.)

- [ ] **Step 4: Verify existing gates are unaffected**

Run: `node scripts/visual-check.mjs measure http://127.0.0.1:5173 320:800 375:812 414:896 768:1024 1440:900`
Expected: unchanged — `overflow:false` at all five, `bodyOverflowX:"clip"`.

- [ ] **Step 5: Commit**

```bash
git add app/scripts/visual-check.mjs
git commit -m "Add a measured contrast gate to the visual harness"
```

---

### Task 5: Shaders and `buildScene`

**Files:**
- Create: `app/src/scene/shaders/particulate.js`
- Create: `app/src/scene/shaders/rays.js`
- Create: `app/src/scene/shaders/water.js`
- Create: `app/src/scene/shaders/kelp.js`
- Create: `app/src/scene/buildScene.js`
- Create: `app/src/scene/buildScene.test.js`

**Interfaces:**
- Consumes: `REGIMES[0]` shape (atmosphere fields), `BIOMES[].glow`.
- Produces: each shader module default-exports `{ uniforms, vertexShader, fragmentShader }`. `buildScene({ container })` returns `{ setTarget(atmo), setAccent(hex), setProgress(metres), render(timeMs), resize(w, h), dispose() }`. Uniform names are exactly: `uTime, uWater, uFog, uLight, uLightColor, uRays, uParticles, uBiolum, uAccent`.

- [ ] **Step 1: Write the failing test**

Create `app/src/scene/buildScene.test.js`:

```js
import { describe, expect, it } from 'vitest'
import water from './shaders/water.js'
import rays from './shaders/rays.js'
import kelp from './shaders/kelp.js'
import particulate from './shaders/particulate.js'
import { buildScene } from './buildScene.js'

const modules = { water, rays, kelp, particulate }

describe('shader modules', () => {
  it.each(Object.keys(modules))('%s exposes a complete material', (name) => {
    const m = modules[name]
    expect(m.uniforms).toBeTypeOf('object')
    expect(m.vertexShader).toMatch(/void\s+main\s*\(/)
    expect(m.fragmentShader).toMatch(/void\s+main\s*\(/)
    expect(Object.keys(m.uniforms)).toContain('uTime')
  })

  it('declares every uniform buildScene drives', () => {
    const required = ['uWater', 'uFog', 'uLight', 'uRays', 'uParticles', 'uBiolum', 'uAccent']
    const all = new Set(Object.values(modules).flatMap((m) => Object.keys(m.uniforms)))
    for (const key of required) expect([...all]).toContain(key)
  })

  it('does not import anything from the outside world', () => {
    expect(Object.values(modules).every((m) => typeof m.uniforms.uTime.value === 'number')).toBe(true)
  })
})

describe('buildScene', () => {
  it('returns the lifecycle surface DiveScroll relies on', () => {
    const api = buildScene({ container: null, forceNoWebGL: true })
    for (const fn of ['setTarget', 'setAccent', 'setProgress', 'render', 'resize', 'dispose']) {
      expect(api[fn]).toBeTypeOf('function')
    }
    api.dispose()
  })

  it('tolerates a null container so the fallback path is testable', () => {
    const api = buildScene({ container: null, forceNoWebGL: true })
    expect(() => { api.resize(100, 100); api.render(0); api.dispose() }).not.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm test`
Expected: FAIL — four modules and `buildScene.js` missing.

- [ ] **Step 3: Write `particulate.js`**

```js
const PARTICULATE = {
  uniforms: {
    uTime: { value: 0 },
    uParticles: { value: 1 },
    uBiolum: { value: 0 },
    uAccent: { value: '#7fe7ff' },
    uWater: { value: '#4fc3d9' },
  },
  vertexShader: `
    attribute float aSize;
    uniform float uTime;
    varying float vFade;
    void main() {
      vec3 p = position;
      p.y += sin(uTime * 0.34 + p.x * 0.7) * 0.12;
      p.x += cos(uTime * 0.20 + p.y) * 0.08;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * (18.0 / -mv.z);
      vFade = clamp((p.z + 6.0) / 12.0, 0.35, 1.0);
    }`,
  fragmentShader: `
    uniform float uBiolum;
    uniform vec3 uAccent;
    varying float vFade;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      float a = smoothstep(0.5, 0.05, d) * 0.52 * vFade;
      vec3 col = mix(vec3(0.35, 0.93, 0.92), uAccent, uBiolum);
      gl_FragColor = vec4(col, a * (0.55 + 0.45 * uBiolum));
    }`,
}
export default PARTICULATE
```

- [ ] **Step 4: Write `rays.js`**

```js
const RAYS = {
  uniforms: {
    uTime: { value: 0 },
    uRays: { value: 0.9 },
    uLightColor: { value: '#ffffff' },
    uWater: { value: '#4fc3d9' },
    uFog: { value: 0.014 },
    uLight: { value: 1.4 },
    uParticles: { value: 1 },
    uBiolum: { value: 0 },
    uAccent: { value: '#7fe7ff' },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform float uTime, uRays;
    uniform vec3 uLightColor, uWater;
    varying vec2 vUv;
    void main() {
      float tilt = (vUv.x - 0.5) * 0.9;
      float band = sin((vUv.x + tilt) * 26.0 + uTime * 0.25) * 0.5 + 0.5;
      band = pow(band, 3.0);
      float falloff = 1.0 - smoothstep(0.0, 1.0, vUv.y);
      float a = band * falloff * uRays * 0.5;
      vec3 col = mix(uLightColor, uWater, vUv.y * 0.6);
      gl_FragColor = vec4(col, a);
    }`,
}
export default RAYS
```

- [ ] **Step 5: Write `water.js`**

```js
const WATER = {
  uniforms: {
    uTime: { value: 0 },
    uWater: { value: '#4fc3d9' },
    uFog: { value: 0.014 },
    uLight: { value: 1.4 },
    uLightColor: { value: '#ffffff' },
    uRays: { value: 0.9 },
    uParticles: { value: 1 },
    uBiolum: { value: 0 },
    uAccent: { value: '#7fe7ff' },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform float uTime, uFog, uLight, uBiolum;
    uniform vec3 uWater, uLightColor, uAccent;
    varying vec2 vUv;
    void main() {
      float depth = 1.0 - vUv.y;
      vec3 col = uWater * mix(1.25, 0.35, depth);
      float c1 = sin(vUv.x * 34.0 + uTime * 0.5) * sin(vUv.y * 27.0 - uTime * 0.42);
      float c2 = sin(vUv.x * 61.0 - uTime * 0.31) * sin(vUv.y * 47.0 + uTime * 0.27);
      float caustic = pow(max(c1 * c2, 0.0), 3.0) * uLight * (1.0 - depth) * 0.55;
      col += uLightColor * caustic;
      col += uAccent * uBiolum * pow(max(sin(vUv.x * 18.0 + uTime * 0.6)
             * sin(vUv.y * 14.0 - uTime * 0.5), 0.0), 6.0) * 0.5;
      col = mix(col, uWater * 0.4, clamp(uFog * 12.0 * depth, 0.0, 0.85));
      gl_FragColor = vec4(col, 1.0);
    }`,
}
export default WATER
```

- [ ] **Step 6: Write `kelp.js`**

```js
const KELP = {
  uniforms: {
    uTime: { value: 0 },
    uLight: { value: 1.4 },
    uLightColor: { value: '#ffffff' },
    uWater: { value: '#4fc3d9' },
    uFog: { value: 0.014 },
    uRays: { value: 0.9 },
    uParticles: { value: 1 },
    uBiolum: { value: 0 },
    uAccent: { value: '#7fe7ff' },
  },
  vertexShader: `
    uniform float uTime;
    attribute float aPhase;
    varying float vT;
    void main() {
      vec3 p = position;
      vT = uv.y;
      float sway = sin(uTime * 0.55 + aPhase + uv.y * 2.2) * 0.42 * uv.y;
      p.x += sway;
      p.z += cos(uTime * 0.41 + aPhase) * 0.16 * uv.y;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: `
    uniform float uLight, uBiolum, uFog;
    uniform vec3 uWater, uAccent, uLightColor;
    varying float vT;
    void main() {
      vec3 base = mix(uWater * 0.25, uWater * 0.7, vT);
      vec3 col = base * (0.35 + 0.65 * uLight * (0.3 + vT));
      col = mix(col, col * 0.4, uFog * 8.0);
      col += uAccent * uBiolum * pow(vT, 5.0) * 0.55;
      gl_FragColor = vec4(col, 1.0);
    }`,
}
export default KELP
```

- [ ] **Step 7: Write `buildScene.js`**

```js
import * as THREE from 'three'
import water from './shaders/water.js'
import rays from './shaders/rays.js'
import kelp from './shaders/kelp.js'
import particulate from './shaders/particulate.js'
import { REGIMES } from '../dive/regimes.js'

const LERP_MS = 600
const materialOf = (def) => new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.clone(def.uniforms),
  vertexShader: def.vertexShader,
  fragmentShader: def.fragmentShader,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})

function hexToV3(hex) { return new THREE.Color(hex) }

export function buildScene({ container, forceNoWebGL = false } = {}) {
  if (!container || forceNoWebGL) {
    return {
      setTarget() {}, setAccent() {}, setProgress() {},
      render() {}, resize() {}, dispose() {},
      supported: false,
    }
  }

  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false })
  } catch (err) {
    console.warn('[ocean] WebGL unavailable, using the CSS gradient', err)
    return {
      setTarget() {}, setAccent() {}, setProgress() {},
      render() {}, resize() {}, dispose() {},
      supported: false,
    }
  }

  const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.5)
  renderer.setPixelRatio(dpr)
  renderer.domElement.dataset.ocean = ''
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60)
  camera.position.set(0, 0, 6)

  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(60, 34), materialOf(water))
  backdrop.position.z = -8
  scene.add(backdrop)

  const godRays = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), materialOf(rays))
  godRays.position.z = -5
  scene.add(godRays)

  const kelpMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.28, 7, 1, 12),
    materialOf(kelp),
    46,
  )
  const phases = new Float32Array(46)
  for (let i = 0; i < 46; i++) {
    const m = new THREE.Matrix4()
    m.setPosition((Math.random() - 0.5) * 22, -4.5, -2.5 - Math.random() * 4)
    kelpMesh.setMatrixAt(i, m)
    phases[i] = Math.random() * Math.PI * 2
  }
  kelpMesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1))
  scene.add(kelpMesh)

  const count = window.innerWidth < 700 ? 140 : 380
  const pos = new Float32Array(count * 3)
  const size = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 14
    pos[i * 3 + 1] = (Math.random() - 0.5) * 12
    pos[i * 3 + 2] = (Math.random() - 0.5) * 12
    size[i] = 1.5 + Math.random() * 3.5
  }
  const pGeo = new THREE.BufferGeometry()
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  const points = new THREE.Points(pGeo, materialOf(particulate))
  scene.add(points)

  const materials = [backdrop.material, godRays.material, kelpMesh.material, points.material]
  const current = {}
  const target = {}
  let from = null
  let startedAt = 0

  function applyMix(mix) {
    for (const mat of materials) {
      const u = mat.uniforms
      if (u.uWater) u.uWater.value.lerpColors(from.water, target.water, mix)
      if (u.uLightColor) u.uLightColor.value.lerpColors(from.lightColor, target.lightColor, mix)
      if (u.uFog) u.uFog.value = THREE.MathUtils.lerp(from.fog, target.fog, mix)
      if (u.uLight) u.uLight.value = THREE.MathUtils.lerp(from.light, target.light, mix)
      if (u.uRays) u.uRays.value = THREE.MathUtils.lerp(from.rays, target.rays, mix)
      if (u.uParticles) u.uParticles.value = THREE.MathUtils.lerp(from.particles, target.particles, mix)
      if (u.uBiolum) u.uBiolum.value = THREE.MathUtils.lerp(from.biolum, target.biolum, mix)
      if (u.uAccent) u.uAccent.value.lerpColors(from.accent, target.accent, mix)
    }
  }

  function readCurrent() {
    const u = backdrop.material.uniforms
    return {
      water: u.uWater.value.clone(),
      lightColor: u.uLightColor.value.clone(),
      fog: u.uFog.value,
      light: u.uLight.value,
      rays: u.uRays.value,
      particles: u.uParticles.value,
      biolum: u.uBiolum.value,
      accent: u.uAccent.value.clone(),
    }
  }

  function setTarget(atmo) {
    from = readCurrent()
    target.water = hexToV3(atmo.water)
    target.lightColor = hexToV3(atmo.lightColor)
    target.fog = atmo.fog
    target.light = atmo.light
    target.rays = atmo.rays
    target.particles = atmo.particles
    target.biolum = atmo.biolum
    target.accent = hexToV3(atmo.accent)
    startedAt = performance.now()
    current.atmo = atmo
  }

  function setAccent(hex) {
    const c = hexToV3(hex)
    for (const mat of materials) if (mat.uniforms.uAccent) mat.uniforms.uAccent.value.copy(c)
  }

  function setProgress() { /* depth is read by setTarget only; kept for the interface */ }

  function render(timeMs) {
    const t = timeMs * 0.001
    if (from && target.water) {
      const k = Math.min(1, (performance.now() - startedAt) / LERP_MS)
      applyMix(k)
      if (k === 1) { from = null; current.atmo = null }
    }
    for (const mat of materials) if (mat.uniforms.uTime) mat.uniforms.uTime.value = t
    renderer.render(scene, camera)
  }

  function resize(w, h) {
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(1, h)
    camera.updateProjectionMatrix()
  }

  function dispose() {
    for (const mat of materials) mat.dispose()
    backdrop.geometry.dispose()
    godRays.geometry.dispose()
    kelpMesh.geometry.dispose()
    pGeo.dispose()
    renderer.dispose()
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
  }

  setTarget(REGIMES[0])
  applyMix(1)
  from = null

  return { setTarget, setAccent, setProgress, render, resize, dispose, supported: true }
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm test`
Expected: PASS. Note: `THREE.InstancedMesh` does not consume a per-instance `aPhase` attribute through the standard path — if the kelp sway is flat in the browser, replace `InstancedMesh` with a merged `BufferGeometry` of 46 planes carrying a per-vertex `aPhase`. The test does not cover this; Task 6's visual check does.

- [ ] **Step 9: Commit**

```bash
git add app/src/scene/shaders app/src/scene/buildScene.js app/src/scene/buildScene.test.js
git commit -m "Build the procedural scene: water, rays, kelp, particulate"
```

---

### Task 6: `OceanCanvas`

**Files:**
- Create: `app/src/scene/OceanCanvas.jsx`

**Interfaces:**
- Consumes: `buildScene`, `REGIMES`, `usePrefersReducedMotion` (inline helper below).
- Produces: `<OceanCanvas frameRef regimeIndex visible />` — renders nothing when reduced motion or when `buildScene` reports `supported: false`.

- [ ] **Step 1: Write the implementation**

Create `app/src/scene/OceanCanvas.jsx`:

```jsx
import { useEffect, useRef } from 'react'
import { buildScene } from './buildScene.js'
import { REGIMES } from '../dive/regimes.js'

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function OceanCanvas({ frameRef, regimeIndex, visible }) {
  const holderRef = useRef(null)
  const apiRef = useRef(null)
  const regimeRef = useRef(regimeIndex)
  const visibleRef = useRef(visible)
  const lastRef = useRef({ metres: -1 })

  useEffect(() => { visibleRef.current = visible }, [visible])

  useEffect(() => {
    if (reduced() || !holderRef.current) return
    const preserve = new URLSearchParams(window.location.search).has('preserve')
    const api = buildScene({ container: holderRef.current, preserve })
    if (!api.supported) return
    apiRef.current = api

    const box = () => {
      const r = holderRef.current.getBoundingClientRect()
      api.resize(r.width, r.height)
    }
    const ro = new ResizeObserver(box)
    ro.observe(holderRef.current)
    box()

    let raf = 0
    const loop = (t) => {
      raf = requestAnimationFrame(loop)
      if (!visibleRef.current || document.hidden) return
      const f = frameRef.current
      if (f.regimeIndex !== regimeRef.current) {
        regimeRef.current = f.regimeIndex
        api.setTarget(REGIMES[f.regimeIndex])
      }
      if (f.metres !== lastRef.current.metres) {
        lastRef.current.metres = f.metres
        api.setProgress(f.metres)
      }
      api.render(t)
    }
    raf = requestAnimationFrame(loop)

    const onVis = () => { /* visibility is polled in the loop */ }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      api.dispose()
      apiRef.current = null
    }
  }, [frameRef])

  useEffect(() => {
    if (apiRef.current && regimeIndex !== regimeRef.current) {
      regimeRef.current = regimeIndex
      apiRef.current.setTarget(REGIMES[regimeIndex])
    }
  }, [regimeIndex])

  return <div ref={holderRef} className="ocean-canvas" aria-hidden="true" />
}
```

**Note:** Task 5's `buildScene` signature takes `{ container, forceNoWebGL }`. Pass the `preserve` flag through by extending the option to `{ container, forceNoWebGL, preserve }` and setting `renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: preserve })`. Do this in the same commit.

- [ ] **Step 2: Add the CSS entry point**

Append to `app/src/design/dive.css` (final styling lands in Task 7):

```css
.ocean-canvas { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
.ocean-canvas canvas { display: block; width: 100%; height: 100%; }
```

- [ ] **Step 3: Build and verify nothing is broken**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm run build:root`
Expected: succeeds; `three` in a separate chunk.

Run: `node scripts/visual-check.mjs measure http://127.0.0.1:5173 320:800 375:812 414:896 768:1024 1440:900`
Expected: unchanged — `overflow:false` × 5, `clip`.

- [ ] **Step 4: Commit**

```bash
git add app/src/scene/OceanCanvas.jsx app/src/scene/buildScene.js app/src/design/dive.css
git commit -m "Own one WebGL context for the whole spine"
```

---

### Task 7: `DiveScroll`, `DepthGauge`, and `dive.css`

**Files:**
- Create: `app/src/dive/DiveScroll.jsx`
- Create: `app/src/dive/DepthGauge.jsx`
- Rewrite: `app/src/design/dive.css`
- Modify: `app/src/design/layout.css`

**Interfaces:**
- Consumes: `useDiveDepth`, `OceanCanvas`.
- Produces: `<DiveScroll>{children}</DiveScroll>` where children are the hero and six sections; it registers six section refs itself by cloning — **no.** It receives `sectionsRef` (a `RefObject<Element[]>`) from the parent so `HomeView` controls the DOM. Simplify: `DiveScroll` owns the refs and exposes them by rendering `<div className="dive-section" ref={...}>` itself, and takes `biomes` as a prop.

  Final interface: `<DiveScroll biomes={BIOMES} />` renders the six sections itself and slots the hero through a `hero` prop. `DepthGauge` takes `{ frameRef, subscribe }`.

- [ ] **Step 1: Write `DepthGauge.jsx`**

```jsx
import { useEffect, useRef } from 'react'

const pad = (n) => String(Math.round(n)).padStart(4, '0')

export default function DepthGauge({ frameRef, subscribe }) {
  const numRef = useRef(null)
  const idxRef = useRef(null)
  const barRef = useRef(null)
  const last = useRef({ metres: -1, biomeIndex: -1 })

  useEffect(() => subscribe((f) => {
    if (f.metres !== last.current.metres) {
      last.current.metres = f.metres
      if (numRef.current) numRef.current.textContent = pad(f.metres)
      if (barRef.current) {
        const pct = Math.min(100, (f.metres / 1600) * 100)
        barRef.current.style.transform = `scaleY(${pct / 100})`
      }
    }
    if (f.biomeIndex !== last.current.biomeIndex) {
      last.current.biomeIndex = f.biomeIndex
      if (idxRef.current) idxRef.current.textContent = `0${f.biomeIndex + 1} / 06`
    }
  }), [subscribe])

  return (
    <div className="depth-gauge" aria-hidden="true">
      <span className="gauge-depth"><b ref={numRef}>0000</b> M</span>
      <div className="gauge-rail"><i ref={barRef} /></div>
      <span className="gauge-index" ref={idxRef}>01 / 06</span>
    </div>
  )
}
```

- [ ] **Step 2: Write `DiveScroll.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react'
import { useDiveDepth } from './useDiveDepth.js'
import { BIOMES } from './biomes.js'
import OceanCanvas from '../scene/OceanCanvas.jsx'
import DepthGauge from './DepthGauge.jsx'

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function DiveScroll({ hero }) {
  const sectionsRef = useRef([])
  const rootRef = useRef(null)
  const [visible, setVisible] = useState(true)
  const [isReduced] = useState(reduced)
  const { frameRef, regimeIndex, subscribe } = useDiveDepth(sectionsRef)

  useEffect(() => {
    if (!rootRef.current) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '10% 0px' })
    io.observe(rootRef.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    window.__diveProbe = () => [...new Set(BIOMES.map((b, i) => i))]
    return () => { delete window.__diveProbe }
  }, [])

  return (
    <div className="dive-scroll" ref={rootRef}>
      {!isReduced && (
        <OceanCanvas frameRef={frameRef} regimeIndex={regimeIndex} visible={visible} />
      )}
      {!isReduced && <DepthGauge frameRef={frameRef} subscribe={subscribe} />}
      {hero}
      {BIOMES.map((b, i) => (
        <section
          key={b.id}
          id={i === 0 ? 'dalis' : undefined}
          className="dive-section"
          ref={(el) => { sectionsRef.current[i] = el }}
          style={{ '--zone-accent': b.accent }}
          aria-labelledby={`dive-${b.id}`}
        >
          <div className="dive-scrim" aria-hidden="true" />
          <div className="dive-section-inner" data-contrast>
            <span className="section-kicker">{b.original}</span>
            <p className="dive-num" aria-hidden="true">{b.n}</p>
            <h2 id={`dive-${b.id}`} className="dive-title">{b.name}</h2>
            <p className="dive-line">{b.line}</p>
            <p className="dive-body">{b.text}</p>
            <div className="dive-meta">
              <span>DERİNLİK {b.depth}</span>
              <span>{b.index}</span>
            </div>
            {b.wiki && (
              <button
                type="button"
                className="card-link"
                onClick={() => { window.location.hash = `/wiki/${b.wiki}` }}
              >
                KAYDI İNCELE <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Rewrite `dive.css`**

Replace the whole file:

```css
.dive-scroll { position: relative; z-index: 1;
  background: linear-gradient(180deg,
    #4fc3d9 0%, #1f7fa8 14%, #0b3350 34%, #05182c 58%, #030a18 82%, #02060f 100%); }

.dive-scroll > .hero { position: relative; z-index: 1; }

.dive-section { position: relative; z-index: 1; min-height: 133.333vh;
  display: flex; align-items: center; padding: var(--space-8) var(--space-6); }

.dive-scrim { position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(100deg, rgba(2, 8, 18, .88) 0%, rgba(2, 8, 18, .62) 34%, rgba(2, 8, 18, 0) 72%); }

.dive-section-inner { position: relative; z-index: 1;
  max-width: min(58ch, 62%); min-width: 0; }

.dive-num { font-family: var(--font-mono); font-size: var(--text-small);
  letter-spacing: var(--tracking-wide); color: var(--zone-accent); margin: 0 0 var(--space-2); }

.dive-title { font-family: var(--font-display); font-weight: 700;
  font-size: var(--text-display-safe); line-height: var(--leading-tight);
  letter-spacing: var(--tracking-display); margin: 0 0 var(--space-3);
  color: var(--paper); overflow-wrap: anywhere; }

.dive-line { font-family: var(--font-display); font-size: var(--text-lead);
  color: var(--zone-accent); margin: 0 0 var(--space-4); }

.dive-body { font-family: var(--font-body); font-size: var(--text-body);
  line-height: var(--leading-body); color: var(--paper-2);
  margin: 0 0 var(--space-5); max-width: 52ch; }

.dive-meta { display: flex; gap: var(--space-5); flex-wrap: wrap;
  font-family: var(--font-mono); font-size: var(--text-micro);
  letter-spacing: var(--tracking-wide); color: var(--paper-3);
  margin-bottom: var(--space-5); }

.depth-gauge { position: fixed; left: var(--space-4); top: 50%; transform: translateY(-50%);
  z-index: 2; display: flex; flex-direction: column; align-items: center;
  gap: var(--space-3); pointer-events: none; }

.gauge-depth { font-family: var(--font-mono); font-size: var(--text-micro);
  letter-spacing: var(--tracking-wide); color: var(--paper-2); writing-mode: vertical-rl; }
.gauge-depth b { color: var(--zone-accent); font-weight: 500; }

.gauge-rail { width: 1px; height: 34vh; background: var(--line); position: relative; overflow: hidden; }
.gauge-rail i { position: absolute; inset: 0; background: var(--zone-accent);
  transform-origin: top; transform: scaleY(0); }

.gauge-index { font-family: var(--font-mono); font-size: var(--text-micro);
  letter-spacing: var(--tracking-wide); color: var(--paper-3); writing-mode: vertical-rl; }

@media (min-width: 769px) and (max-width: 850px) { .depth-gauge { display: none; } }
@media (max-width: 768px) {
  .dive-section { min-height: 120vh; padding: var(--space-7) var(--space-4); }
  .dive-section-inner { max-width: 100%; }
  .dive-scrim { background: linear-gradient(180deg, rgba(2, 8, 18, .9) 0%, rgba(2, 8, 18, .55) 60%, rgba(2, 8, 18, .15) 100%); }
  .depth-gauge { display: none; }
}
@media (max-width: 600px) {
  .dive-section { min-height: 108vh; }
}
```

Delete every rule for `.dive`, `.dive-layout`, `.dive-list`, `.dive-tab`, `.dive-card`, `.dive-image`, `.dive-overlay`, `.scan-ring`, `.dive-card-head`, `.dive-card-body`, `.dive-card-foot`, `.tab-depth`, `.dive-tab-arrow`.

- [ ] **Step 4: Add `--dive-length` and the display-size token**

In `app/src/design/layout.css` inside the `:root` block add:

```css
  --dive-length: 900vh;
```

In `app/src/design/type.css` add a defensive display step used by `.dive-title` (it must exist, because `--text-display` was removed in a27e6d1 and this is now its first real consumer):

```css
  --text-display-safe: clamp(2.75rem, 7.4vw, 6.5rem);
```

- [ ] **Step 5: Run every gate**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm test`
Expected: PASS.

Run: `node scripts/visual-check.mjs measure http://127.0.0.1:5173 320:800 375:812 414:896 768:1024 1440:900`
Expected: `overflow:false` × 5, `bodyOverflowX:"clip"`.

Run: `node -e "const fs=require('fs');let n=0;for(const f of fs.readdirSync('./src/design').filter(x=>x.endsWith('.css')&&x!=='tokens.css')){n+=(fs.readFileSync('./src/design/'+f,'utf8').match(/#[0-9a-fA-F]{3,8}/g)||[]).length}console.log('hex outside tokens.css:',n)"`
Expected: `0`. If not, replace any literal with the matching token from `tokens.css`.

- [ ] **Step 6: Commit**

```bash
git add app/src/dive/DiveScroll.jsx app/src/dive/DepthGauge.jsx app/src/design/dive.css app/src/design/layout.css app/src/design/type.css
git commit -m "Scroll the spine: six sections, one gauge, one fixed scene"
```

---

### Task 8: `WordCycle`, `HomeView`, and hero retirement

**Files:**
- Create: `app/src/components/WordCycle.jsx`
- Modify: `app/src/HomeView.jsx`
- Modify: `app/src/main.jsx`
- Modify: `app/src/design/hero.css`
- Delete: `app/src/skiper58.jsx`, `app/src/OceanScene.jsx`, `app/public/kelp-forest.webp`

**Interfaces:**
- Consumes: `DiveScroll`, `BIOMES`.
- Produces: `<WordCycle>{text}</WordCycle>` with the same hover-roll behaviour `TextRoll` had.

- [ ] **Step 1: Create `WordCycle.jsx`**

Port `TextRoll` from `app/src/skiper58.jsx` verbatim, drop `"use client"`, `navigationItems`, `Skiper58`, and the `cn` helper's other callers:

```jsx
import { motion } from 'motion/react'

const cn = (...parts) => parts.filter(Boolean).join(' ')
const STAGGER = 0.035

export function WordCycle({ children, className, center = false }) {
  const text = String(children)
  return (
    <motion.span
      initial="initial"
      whileHover="hovered"
      className={cn('relative block overflow-hidden', className)}
      style={{ lineHeight: 0.75 }}
    >
      <div>
        {text.split('').map((l, i) => (
          <motion.span
            key={`a${i}`}
            variants={{ initial: { y: 0 }, hovered: { y: '-100%' } }}
            transition={{ ease: 'easeInOut', delay: center ? STAGGER * Math.abs(i - (text.length - 1) / 2) : STAGGER * i }}
            className="inline-block"
          >{l}</motion.span>
        ))}
      </div>
      <div className="absolute inset-0" aria-hidden="true">
        {text.split('').map((l, i) => (
          <motion.span
            key={`b${i}`}
            variants={{ initial: { y: '100%' }, hovered: { y: 0 } }}
            transition={{ ease: 'easeInOut', delay: center ? STAGGER * Math.abs(i - (text.length - 1) / 2) : STAGGER * i }}
            className="inline-block"
          >{l}</motion.span>
        ))}
      </div>
    </motion.span>
  )
}

export default WordCycle
```

- [ ] **Step 2: Point `main.jsx` at it**

Replace `import { TextRoll } from './skiper58.jsx'` with `import { WordCycle } from './components/WordCycle.jsx'` and replace the three `<TextRoll>` usages with `<WordCycle>`.

In the footer, replace `ARAYÜZ: <a href="https://skiper-ui.com/v1/skiper58">SKIPER UI</a> · ` with nothing (D8: the attribution goes because the code is ours now).

- [ ] **Step 3: Rewrite `HomeView.jsx`**

```jsx
import { useEffect, useRef } from 'react'
import { animate, stagger } from 'animejs'
import { motion, useScroll, useTransform } from 'motion/react'
import DiveScroll from './dive/DiveScroll.jsx'
import { asset } from ...   /* keep whatever asset helper the file already uses */

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Hero({ onWiki }) {
  const ref = useRef(null)
  const titleRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const textY = useTransform(scrollYProgress, [0, 1], [0, 150])
  const textOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  useEffect(() => {
    if (reduced() || !titleRef.current) return
    const words = titleRef.current.querySelectorAll('.hero-word')
    const a = animate(words, { opacity: [0, 1], translateY: [64, 0], delay: stagger(170, { start: 150 }), duration: 1150, ease: 'out(4)' })
    const b = animate('.hero-meta > *', { opacity: [0, 1], translateY: [20, 0], delay: stagger(90, { start: 800 }), duration: 760, ease: 'out(3)' })
    return () => { a.pause(); b.pause() }
  }, [])

  return (
    <section className="hero" ref={ref} aria-labelledby="hero-title">
      <div className="hero-vignette" aria-hidden="true" />
      <motion.div className="hero-inner" style={{ y: textY, opacity: textOpacity }}>
        <div className="hero-meta">
          <span className="micro-label"><b className="live-dot" /> GEZEGEN 4546B / GELEN SİNYAL</span>
          <span className="hero-coord">KOORDİNATLAR 000.01° N / 4546B</span>
        </div>
        <h1 id="hero-title" ref={titleRef}>
          <span className="hero-word">DÜNYANIN</span>
          <span className="hero-word outline">BİTTİĞİ</span>
          <span className="hero-word aqua">YERİN ALTINDA.</span>
        </h1>
        <div className="hero-bottom">
          <p>Bir yabancı gezegende, hayatta kalmanın tek yolu daha derine inmek. Okyanusu keşfet. İzleri takip et. Bilinmeyeni kayda geçir.</p>
          <div className="hero-actions">
            <a className="button-primary" href="#dalis">DALIŞA BAŞLA <span aria-hidden="true">↘</span></a>
            <button className="button-ghost" onClick={onWiki}>VERİ BANKASINI AÇ <span aria-hidden="true">↗</span></button>
          </div>
        </div>
      </motion.div>
      <div className="scroll-cue" aria-hidden="true"><span>KAYDIR</span><div /></div>
    </section>
  )
}

export default function HomeView({ onWiki }) {
  return (
    <>
      <DiveScroll hero={<Hero onWiki={onWiki} />} />
      <section className="manifesto">{/* unchanged */}</section>
      <section className="final-cta">{/* unchanged */}</section>
    </>
  )
}
```

Carry the existing `.manifesto` and `.final-cta` JSX across **byte for byte**; only the wrapper changes. Delete the `diveZones` array and the whole `DiveSection` component.

- [ ] **Step 4: Trim `hero.css`**

Delete the `.hero-image` and `.hero-rail` (and `.rail-line`) rules. Keep `.hero-vignette`, but give it an opaque-enough base so the hero reads before WebGL arrives:

```css
.hero-vignette { position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: radial-gradient(120% 90% at 50% 0%, rgba(2, 8, 18, 0) 30%, rgba(2, 8, 18, .78) 100%); }
```

Ensure `.hero-inner` and `.hero-vignette` sit at `z-index: 1` or above so they clear `.ocean-canvas` at `z-index: 0`.

- [ ] **Step 5: Make `.manifesto` and `.final-cta` opaque**

Verify each has an explicit background colour. If either is transparent, the fixed canvas would bleed under it. Add `background: var(--abyss)` (or the token its current background resolves to) so the handoff at the spine's end is clean.

- [ ] **Step 6: Delete the retired files**

```bash
git rm app/src/skiper58.jsx app/src/OceanScene.jsx app/public/kelp-forest.webp
```

- [ ] **Step 7: Build, measure, and check every gate**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm run build:root && npm run build:subpath && npm run test:base && npm test`
Expected: all green.

Run: `node scripts/visual-check.mjs measure http://127.0.0.1:5173 320:800 375:812 414:896 768:1024 1440:900`
Expected: `overflow:false` × 5, `clip`, wrapped clicks `[]`/`[]`/`[]`/`[3]`/`[5]`.

Run: `node scripts/visual-check.mjs contrast http://127.0.0.1:5173 375:812 768:1024 1440:900`
Expected: every sampled regime has `pass: true`. If any fails, increase the `.dive-scrim` alpha in the relevant breakpoint — one notch at a time — and re-measure. **Do not change the text colour to pass this gate**; that would break the token lock (spec §6.4/1).

Run: `node -e "const fs=require('fs');let n=0;for(const f of fs.readdirSync('./src/design').filter(x=>x.endsWith('.css')&&x!=='tokens.css')){n+=(fs.readFileSync('./src/design/'+f,'utf8').match(/#[0-9a-fA-F]{3,8}/g)||[]).length}console.log(n)"`
Expected: `0`.

- [ ] **Step 8: Commit**

```bash
git add -A app/src app/public
git commit -m "Retire the tab card and the hero photo; the spine owns the page"
```

---

### Task 9: Budgets, gates, docs

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/baseline/design-system-after-2026-09-25.md`
- Verify only: `app/package.json` budgets

**Interfaces:**
- Consumes: everything above.
- Produces: recorded numbers and a green release.

- [ ] **Step 1: Measure the bundle**

Run: `cd C:\Users\selim\subnautica-github-pages\app && npm run build:root`
Then gzip the entry chunks:

```bash
node -e "const fs=require('fs'),z=require('zlib');let js=0,all=0;const walk=d=>fs.readdirSync(d,{withFileTypes:true}).forEach(e=>{const p=d+'/'+e.name;if(e.isDirectory())return walk(p);const b=fs.readFileSync(p);all+=b.length;if(e.name.endsWith('.js'))js+=z.gzipSync(b).length});walk('./dist');console.log('JS gzip:',(js/1024).toFixed(1),'KB   total:',(all/1024).toFixed(1),'KB')"
```

Expected: JS gzip ≤ 180 KB, total ≤ 700 KB. If over: check `three` is in its own lazy chunk (`grep -o 'three[^"]*' dist/assets/*.js | head`), and that no shader source was accidentally imported into the entry chunk.

- [ ] **Step 2: Run the full gate battery**

```bash
cd C:\Users\selim\subnautica-github-pages\app
npm test
npm run build:root && npm run build:subpath && npm run test:base
node scripts/visual-check.mjs measure http://127.0.0.1:5173 320:800 375:812 414:896 768:1024 1440:900
node scripts/visual-check.mjs measure http://127.0.0.1:5173/#/wiki 320:800 1440:900
node scripts/visual-check.mjs contrast http://127.0.0.1:5173 375:812 1440:900
```

Expected: every command exits 0.

- [ ] **Step 3: Verify reduced motion and the no-WebGL path by hand**

In DevTools: enable `Emulate CSS media feature prefers-reduced-motion: reduce`, reload → `.ocean-canvas` must be absent and all six sections readable on the CSS gradient.
Then launch Chrome with `--disable-webgl` → reload → same result, console shows the `[ocean] WebGL unavailable` warning.

- [ ] **Step 4: Record the numbers**

Append a dated section to `docs/superpowers/baseline/design-system-after-2026-09-25.md` with: bundle gzip, first-load bytes, contrast ratios per width, and the measure output. Update `README.md`'s commands section with `npm test` and the `contrast` harness command.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/baseline/design-system-after-2026-09-25.md
git commit -m "Record the dive spine measurements"
```

- [ ] **Step 6: Release**

Run: `cd C:\Users\selim\subnautica-github-pages && node scripts/release.mjs`
Expected: both sites pinned to the new SHA and CI green.

---

## Self-Review

**Spec coverage:** §4.2 file structure → Tasks 1,2,3,5,6,7,8. §4.3 module boundaries → each task's Interfaces block states its imports; `regimes.js`/`biomes.js`/shaders import nothing. §4.4 data flow → Task 3 (`frameRef`, `subscribe`) and Task 7 (gauge subscribes, canvas reads). §4.5 layer stack and gradient → Tasks 6,7,8. §5 six rows → Task 2. §6.4/7 contrast → Task 4 + Task 8 step 7. §8.1 budgets → Task 9 step 1. §8.2 reduced motion → Task 6 (no scene) and Task 7 step 2 (gauge not rendered). §8.3 WebGL failure → Task 5 `forceNoWebGL` + CSS gradient in Task 7 step 3. §9.1 tests → Tasks 1,2,3,5. §10 inventory → matches.

**Gaps found and closed:** the spec's `biomes.test.js` line originally required every `id` in `wikiData.js`, which is impossible for the three new biomes — fixed in the spec before this plan was written. `--text-display` was deleted in a27e6d1, so Task 7 step 4 introduces `--text-display-safe` as its first real consumer rather than referencing a token that no longer exists.

**Type consistency:** `regimeAt(metres)` in Tasks 1/3/6; `sampleAt(y, boxes)` in Task 3; `{ setTarget, setAccent, setProgress, render, resize, dispose }` in Tasks 5/6; `frameRef.current = { y, metres, biomeIndex, regimeIndex }` in Tasks 3/6/7. Uniform names match across Tasks 5 and 6.
