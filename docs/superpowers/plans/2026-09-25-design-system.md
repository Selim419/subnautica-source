# Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad-hoc visual layer with a token system and real typefaces — the 66 distinct hardcoded hex values in `style.css` become named tokens, `Impact` and `Arial` are gone, and the result is verified at four mobile widths by measurement rather than by eye.

**Architecture:** `style.css` (one file, 290 classes, 21 KB, 81 hex literals of which only 4 are token declarations) splits into `src/design/` — `tokens.css` (three layers: raw palette, per-regime semantics, measure), `type.css` (`@font-face` plus the type scale), `layout.css` (grid, section rhythm, breakpoints) — plus per-component files. The split and the token migration are separate tasks so the split is verifiable as a pixel-identical move before any colour changes. `readTokens.js` reads layer one into JS so the Phase 2 scene shaders can consume the same palette.

**Tech Stack:** Vite 6, React 19, IBM Plex subsets self-hosted as `Selim Sans` / `Selim Sans Condensed` / `Selim Mono` (OFL 1.1, renamed off the Reserved Font Name), Chrome DevTools Protocol for verification (no dependencies — Node 22+ ships a global `WebSocket`).

**Plan:** 1 of 2 in Phase 2. Plan 2B (`dive-spine`) adds `regimes.js`, `useDiveDepth`, the procedural Three.js scene, `DiveScroll` and `DepthGauge` on top of this token system.

## Global Constraints

- Copy these verbatim from the spec; do not re-derive them.
- `PAGES_BASE` values are exactly `/` and `/subnautica-derinlik-gunlugu/`, always root-absolute. Do not add a `PAGES_BASE` value.
- Build output directory is `app/dist/`, gitignored. No repository may track build output.
- Turkish UI copy, the 10 wiki records, `src/wikiData.js` and the 3 `.webp` files in `app/public/` are **not touched** by this plan. This is a visual-layer plan only.
- **Locked tokens:** every colour and every `font-family` in the emitted CSS references a named token. Inline hex, `oklch()`, `rgb()`, or a `font-family: "Some Font"` that bypasses the token block are not allowed. If a needed value has no token, lift it into the token block under a new name first, then reference it.
- **No italic in headings.** Emphasis is carried by weight and accent colour. The `600-italic` face is not downloaded. Italic survives only as body-copy emphasis inside a running paragraph.
- **Honest content:** no invented numbers. A dive counter shown only if it is actually persisted; otherwise nothing.
- **Four mandatory widths:** 320, 375, 414, 768 px. No horizontal scroll at any of them.
- `html` and `body` use `overflow-x: clip`, **never `hidden`** — `hidden` creates a scroll container that breaks the `position: sticky` the Phase 2 dive depends on. This is a real latent bug today (`body{overflow-x:hidden}` at `style.css:1`, `position:sticky` currently used 0 times).
- Commit to `main`; push with `node scripts/release.mjs`. The agent performs all pushes.
- `node --test` is the test runner. No Vitest in this plan.

## Verified Baseline

Measured on 2026-09-25 against the live site with the CDP harness. This is the "before" every task is checked against.

| Width | Horizontal overflow | Clickable text wrapping to 2 lines | Rendered `h1` family |
|---|---|---|---|
| 320 | no | 0 | `Impact, "Arial Narrow", Arial, sans-serif` |
| 375 | no | 0 | same |
| 414 | no | 0 | same |
| 768 | no | 3 (`button.dive-tab` — multi-line by design) | same |
| 1440 | no | 5 (the three `dive-tab`, plus `button.nav-active` and one unclassed nav button, both from the `TextRoll` animation duplicating the label) | same |

`body` `overflow-x` is `hidden` at every width. `html` `overflow-x` is `visible`. Measured in `app/src/style.css`: 81 hex literal occurrences, 70 distinct values, 4 of them token declarations (`--bg`, `--surface`, `--cyan`, `--muted` — `--line` is an `rgba()`), leaving **66 distinct values hardcoded into rules**. There are 71 `var(--…)` references and 0 `position: sticky`.

**Two detector caveats, so a later task does not "fix" a non-bug:** `button.dive-tab` legitimately occupies two lines (four children lay out as two rows), and the nav buttons render their label twice because the `TextRoll` effect keeps both copies in the DOM — that is why 1440 reports five wrapped entries rather than three.

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `app/scripts/visual-check.mjs` | CDP harness. Measures overflow, wrapping and resolved font families at given widths; optionally writes full-page and fold screenshots |
| `app/scripts/page-probe.js` | The in-page measurement script, read and sent to `Runtime.evaluate` so no escaping bugs live in a template literal |
| `app/public/fonts/*.woff2` | **12 files**: three families × two weights each × two subsets (`latin`, `latin-ext`) — see Task 2 |
| `app/public/fonts/OFL.txt` | SIL Open Font License 1.1. Required: OFL obliges shipping the licence with the fonts |
| `app/public/fonts/README.md` | Provenance for the font directory: upstream source and tag, the OFL, and why the internal names are **not** "IBM Plex" |
| `app/src/design/tokens.css` | Layer 1 raw palette, layer 2 per-regime semantics, layer 3 measure |
| `app/src/design/type.css` | `@font-face`, type scale, measure |
| `app/src/design/layout.css` | Grid, section rhythm, the four breakpoints |
| `app/src/design/readTokens.js` | Reads layer 1 into a JS object for the Phase 2 shaders |
| `app/src/design/hero.css` | Hero, depth rail, scroll cue, ticker |
| `app/src/design/dive.css` | Dive section, biome tabs, cards |
| `app/src/design/wiki.css` | Wiki hero, filters, card grid, record modal |
| `app/src/design/chrome.css` | Header, nav, footer, progress bar |
| `docs/superpowers/baseline/design-system-2026-09-25.md` | The measured "before" record |

**Deleted:** `app/src/style.css` (replaced by the files above).

**Modified:** `app/src/main.jsx` (imports), `app/index.html` (font preload), `README.md`.

---

## Task 1: Commit the visual verification harness

**Files:**
- Create: `app/scripts/visual-check.mjs`
- Create: `app/scripts/page-probe.js`
- Create: `docs/superpowers/baseline/design-system-2026-09-25.md`

**Interfaces:**
- Consumes: nothing
- Produces: `node scripts/visual-check.mjs measure <url> [w:h ...]` and `node scripts/visual-check.mjs shots <url> <outDir> [w:h ...]`. Every later task runs this. It is a dev tool and must not be wired into CI — the CI runner is Linux without a browser, and the script already exits 3 with a clear message when no browser is found.

- [ ] **Step 1: Create `app/scripts/page-probe.js`**

This runs inside the page. It returns layout facts a design review can act on. Two measurement subtleties are already handled here and must not be "simplified":

- Elements whose own box reaches outside the viewport are only collected when the document actually overflows.
- Clickable labels that wrap to a second line are found by clustering the rects from a `Range` **by vertical overlap**, not by counting distinct `top` values. `SUB` and `NAUTICA` in the logo sit on one line at different `top` positions, so distinct `top` counts them as two lines. Conversely, comparing box height to `line-height` flags every padded 48 px button as two lines.

```js
// Runs inside the page. Returns layout facts a design review can act on.
(() => {
  const de = document.documentElement
  const overflow = de.scrollWidth > de.clientWidth

  const offenders = []
  if (overflow) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      if (r.right > de.clientWidth + 1 || r.left < -1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: typeof el.className === 'string' ? el.className : '',
          left: Math.round(r.left),
          right: Math.round(r.right),
        })
        if (offenders.length >= 8) break
      }
    }
  }

  const wrappedClicks = []
  for (const el of document.querySelectorAll('a, button')) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    if (cs.display === 'inline') continue
    const label = (el.textContent || '').trim()
    if (!label) continue
    const range = document.createRange()
    range.selectNodeContents(el)
    const rects = []
    for (const r of range.getClientRects()) if (r.height > 0.5) rects.push(r)
    if (!rects.length) continue
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
    if (lines > 1) {
      wrappedClicks.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === 'string' ? el.className : '',
        lines,
        text: label.slice(0, 40),
      })
      if (wrappedClicks.length >= 8) break
    }
  }

  return {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    scrollHeight: de.scrollHeight,
    clientHeight: de.clientHeight,
    overflow,
    offenders,
    wrappedClicks,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    htmlOverflowX: getComputedStyle(de).overflowX,
    bodyMinWidth: getComputedStyle(document.body).minWidth,
    h1FontFamily: (document.querySelector('h1') && getComputedStyle(document.querySelector('h1')).fontFamily) || null,
  }
})()
```

- [ ] **Step 2: Create `app/scripts/visual-check.mjs`**

Port the working harness. It must: try four Chrome/Edge paths, exit 3 with a clear message if none is found, connect over CDP on a fixed port, emulate each width with `mobile: w < 768` (this is the detail the first CLI attempt got wrong — `--window-size` alone does **not** apply the viewport meta, which produced a false "text is clipped" reading), wait for the page to settle, read `page-probe.js` from disk and send it to `Runtime.evaluate` (never inline it in a template literal — that is where the escaping bugs came from), and in `shots` mode write `w<width>-full.png` and `w<width>-fold.png`.

- [ ] **Step 3: Run it against the live site and record the baseline**

Run:
```powershell
cd C:\Users\selim\subnautica-github-pages\app
node scripts/visual-check.mjs measure https://selim419.github.io/ 320:800 375:812 414:896 768:1024 1440:900
```
Expected: five objects, every one with `"overflow": false`, `bodyOverflowX: "hidden"`, and
`h1FontFamily: "Impact, \"Arial Narrow\", Arial, sans-serif"`. If `overflow` is true anywhere,
stop and report it — that contradicts the recorded baseline.

- [ ] **Step 4: Write the baseline record**

Create `docs/superpowers/baseline/design-system-2026-09-25.md` containing the table from this
plan's **Verified Baseline** section, plus the measured colour counts — 81 hex literals, 70 distinct, 4 token declarations, 66 distinct hardcoded into rules — and the statement that `position:sticky` appears 0 times today,
and the two detector caveats. Later tasks compare against this file.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\selim\subnautica-github-pages
git add app/scripts docs/superpowers/baseline
git commit -m "Add a dependency-free CDP harness and record the design baseline"
```

---

## Task 2: Vendor the fonts, self-hosted

**Files:**
- Create: `app/public/fonts/*.woff2` — **12 files: six weights × two subsets** (not six; see below)
- Create: `app/public/fonts/OFL.txt`
- Create: `app/public/fonts/README.md` (provenance, and why the internal names are renamed)

**Interfaces:**
- Consumes: nothing
- Produces: the woff2 files and the licence text that `type.css` references. `600-italic` is deliberately **not** downloaded.

- [ ] **Step 1: Get the font files and the licence**

Take IBM's official `v6.4.2` full-family **TTF** statics and subset them locally with
fontTools (`pyftsubset --flavor=woff2`). Do not take the CDN's woff2: Google serves one
*variable* file per family for Sans but *per-weight* files for Condensed and Mono, so the CDN
cannot give a uniform per-weight × per-subset set, and IBM's own `fonts/split/woff2/` uses
`Latin1 / Latin2 / Latin3 / Pi` rather than `latin` / `latin-ext` and has no single pair
covering the whole site. The six weights, each in **both** subsets:

| family | weights | files |
|---|---|---|
| IBM Plex Sans | 400 Regular, 600 SemiBold | `selim-sans-{400,600}-{latin,latin-ext}.woff2` |
| IBM Plex Sans Condensed | 500 Medium, 600 SemiBold | `selim-sans-condensed-{500,600}-{latin,latin-ext}.woff2` |
| IBM Plex Mono | 400 Regular, 500 Medium | `selim-mono-{400,500}-{latin,latin-ext}.woff2` |

**That is 12 files, not 6.** A weight-less filename such as
`selim-sans-condensed-latin-ext.woff2` does not exist and will 404 — no such artifact is a
single variable font covering all weights, and neither Condensed nor Mono is published that
way. Every `@font-face` `src` and every preload `href` must name the **weight and the subset**.

**The shipped families are named `Selim Sans`, `Selim Sans Condensed` and `Selim Mono`, not
`IBM Plex …`.** IBM Plex is OFL 1.1 **with a Reserved Font Name** (`"Plex"`, declared in
`OFL.txt`), and clause 3 forbids a Modified Version — a subset is one — from using it. The
subsets therefore carry rewritten `name` IDs 1/2/3/4/5/6/16/17. Copyright (ID 0) and trademark
(ID 7) notices stay verbatim, because OFL requires them in every copy. Task 4 must declare the
`Selim …` names; nothing installed on a user's machine is called `Selim Sans`, so declaring the
IBM names would silently fall back to a system font. `app/public/fonts/README.md` records all
of this so nobody "fixes" the names back.

Save as `app/public/fonts/`. Also save the licence text as `app/public/fonts/OFL.txt`.

**The `latin-ext` subset is not optional.** Without it, `ı` and `İ` resolve to the wrong
glyphs in Turkish text and the site silently breaks. If a family ships a single file covering
both subsets, use it, but verify the Turkish characters render — the verification step below
catches this.

- [ ] **Step 2: Verify the Turkish glyphs are present**

Check `ğ ğ ş Ş ı İ i I ç Ç ö Ö ü Ü` per **family and weight**, against the *pair* of subsets,
not against `latin-ext` alone: the six codepoints above U+00FF (`ğ ğ ş Ş ı İ`) can only come
from `latin-ext`, the other eight from `latin`. Both files together must cover all fourteen.

The licence obliges shipping `OFL.txt`; skip it and the publication is a licence violation.

- [ ] **Step 3: Record the file list and sizes**

Report every filename with its byte size. The real total is **~221 KB** (221 836 B), not the
spec's old `~90 KB` estimate — that estimate assumed ~15 KB × 6 files, whereas the arithmetic
is 6 weights × 2 subsets = 12 files at 14–24 KB. The documents have been corrected to state
the real figure. State the overage rather than silently shipping a bigger payload.

**Because the site's text is Turkish, a browser will typically fetch *both* the `latin` and
the `latin-ext` file for any face it uses**, so transferred weight is close to the on-disk
total rather than a fraction of it: Turkish needs `ı İ ğ ğ` (U+0130-0131, U+011E-011F) and
`ş Ş` (U+015E-015F), which sit above U+0100 and are therefore only in `latin-ext`, while
`ç ö ü` sit in `latin`. `unicode-range` buys much less on a Turkish site than on an English one.
This is accepted: the reason is the language, not carelessness. Levers, if the budget ever has
to be met, in order of least harm: drop `latin-ext` (redundant for today's copy, but it is the
insurance for future extended copy), or subset `latin` down to the site's actual inventory.

- [ ] **Step 4: Confirm the source is the official one**

Record where each file came from in the commit message. A font pulled from a random CDN is
not redistributable under OFL without checking its provenance.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\selim\subnautica-github-pages
git commit -m "Vendor the fonts, renamed off the OFL Reserved Font Name, with OFL licence"
```

---

## Task 3: Write `tokens.css` and `readTokens.js`

**Files:**
- Create: `app/src/design/tokens.css`
- Create: `app/src/design/readTokens.js`

**Interfaces:**
- Consumes: nothing
- Produces: the named tokens every later task references, and `readTokens(root?)` returning `{ raw }` for the Phase 2 shaders.

- [ ] **Step 1: Write `tokens.css` layer 1 — the raw palette**

The seven values the spec fixes, plus the ink and surface values the current stylesheet
actually needs. Layer 1 is the only layer JavaScript reads.

```css
/* Layer 1 — raw palette. The only layer read by readTokens.js, because the scene
   shaders need numeric colours and cannot read CSS cascade layers. */
:root {
  --abyss:  #01080c;
  --deep:   #04202a;
  --water:  #0d5f74;
  --kelp:   #a9d96b;
  --glow:   #5fe0c8;
  --amber:  #ffb454;
  --coral:  #ff7a59;

  --ink:          #f7fffd;
  --ink-muted:    rgba(247, 255, 253, 0.62);
  --ink-faint:    rgba(247, 255, 253, 0.38);
  --surface:      #0b2730;
  --surface-2:    #123d45;
  --hairline:     rgba(247, 255, 253, 0.14);
  --hairline-firm:rgba(247, 255, 253, 0.24);
  --scrim:        rgba(1, 11, 17, 0.77);
}
```

- [ ] **Step 2: Write `tokens.css` layer 2 — per-regime semantics**

The spec fixes five depth regimes, and the last two biome moments share `biolum`. This
block is what the Phase 2 scroll dive reads to recolour the scene and the page together.

```css
/* Layer 2 — per-regime semantics. Applied via [data-regime] on a wrapper, so the
   scene uniforms and the page colours are driven by one attribute. */
[data-regime='daylight'] { --water: #2ec4b6; --ink: #f7fffd; --glow: #bff3ea; }
[data-regime='twilight'] { --water: #12707e; --ink: #d7f2f5; --glow: #8fd4e8; }
[data-regime='midnight'] { --water: #0a3550; --ink: #c6dcea; --glow: #7fe8d8; }
[data-regime='deep']     { --water: #07303f; --ink: #a9c6d2; --glow: #5fb6cc; }
[data-regime='biolum']   { --water: #04101c; --ink: #e2c3ff; --glow: #ffb454; }
```

- [ ] **Step 3: Write `tokens.css` layer 3 — measure**

The spec's 4 px base scale, six type steps, and four motion durations. The spacing scale is
new: the current stylesheet has none, so every `padding` is a literal (finding F13).

```css
/* Layer 3 — measure. 4px base scale; six type steps; four durations. */
:root {
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;
  --space-9: 96px; --space-10: 128px;

  --text-micro: 0.6875rem;
  --text-small: 0.8125rem;
  --text-body:  1rem;
  --text-lead:  1.1875rem;
  --text-h3:    clamp(1.5rem, 2.4vw, 2rem);
  --text-display: clamp(2.75rem, 8.5vw, 7rem);

  --dur-1: 120ms; --dur-2: 240ms; --dur-3: 420ms; --dur-4: 800ms;
  --ease-out: cubic-bezier(0.2, 0.75, 0.2, 1);
}
```

- [ ] **Step 4: Write `readTokens.js`**

```js
// Reads layer 1 of tokens.css into JS.
//
// Only layer 1. The per-regime overrides in layer 2 are applied by the CSS cascade
// from a [data-regime] attribute, and a canvas cannot read the cascade — the scene
// reads these raw values and interpolates between them itself.
const NAMES = [
  'abyss', 'deep', 'water', 'kelp', 'glow', 'amber', 'coral',
  'ink', 'ink-muted', 'ink-faint', 'surface', 'surface-2',
  'hairline', 'hairline-firm', 'scrim',
]

export function readTokens(root = document.documentElement) {
  const cs = getComputedStyle(root)
  const raw = {}
  for (const name of NAMES) {
    const value = cs.getPropertyValue(`--${name}`).trim()
    if (!value) throw new Error(`token --${name} is missing from :root`)
    raw[name] = value
  }
  return { raw }
}
```

- [ ] **Step 5: Verify no raw hex remains in the token files**

```powershell
cd C:\Users\selim\subnautica-github-pages
Select-String -Path app\src\design\tokens.css -Pattern '#[0-9a-fA-F]{3,8}' | Measure-Object | Select-Object -ExpandProperty Count
```
Expected: exactly the values declared in layer 1 and layer 2, and no others. Hex inside
`tokens.css` is the definition site and is correct; hex anywhere else is not.

- [ ] **Step 6: Commit**

```powershell
git add app/src/design/tokens.css app/src/design/readTokens.js
git commit -m "Add the three-layer token system and the reader for the scene shaders"
```

---

## Task 4: Write `type.css` and replace `Impact`

**Files:**
- Create: `app/src/design/type.css`
- Modify: `app/index.html` (font preload)

**Interfaces:**
- Consumes: the 12 woff2 files from Task 2
- Produces: `--font-display`, `--font-mono`, `--font-body`, and the type scale. Every heading in the site then resolves to `Selim Sans Condensed`.

- [ ] **Step 1: Write the `@font-face` block**

**Twelve `@font-face` rules — one per file.** Three families, `font-display: swap`, `latin-ext`
declared **before** `latin` so the more specific subset wins for the overlapping ranges. Weights
match the spec's table: headings 500/600, mono 400/500, body 400/600. **No `600-italic` face** —
it is not downloaded.

Declare the **`Selim …` family names**, not the IBM ones: the subsets' internal names were
rewritten off the OFL Reserved Font Name, and nothing installed on a user's machine is called
`Selim Sans`, so a `font-family: 'IBM Plex Sans'` declaration would match nothing and fall
through to the system fallback. (Do not use `local()` sources either — there is no local
`Selim …` font.)

Each `src` names the **weight and the subset**; there are no weight-less files. The
`unicode-range` values below are copied verbatim from the Task 2 report and were computed from
each file's real `cmap`, so the preload and the `@font-face` agree exactly.

`latin-ext`, identical in all six `latin-ext` files:

```css
unicode-range: U+0100-017F, U+018F, U+0192, U+01A0, U+01A1, U+01AF, U+01B0, U+01CD-01DC,
  U+01FA-01FF, U+0218-021B, U+0237, U+0259, U+02C7, U+02DD, U+0304, U+0308, U+1E80-1E85,
  U+1E9E, U+1EF2-1EF9, U+2020, U+20A1, U+20A4, U+20A6, U+20A8-20AB, U+20AD, U+20AE, U+20B1,
  U+20B2, U+20B4, U+20B5, U+20B8-20BA, U+20BD, U+20BF, U+2113;
```

`latin`, for Sans 400/600 and Mono 400/500:

```css
unicode-range: U+0000, U+000D, U+0020-007E, U+00A0-00FF, U+011E, U+011F, U+0130, U+0131,
  U+0152, U+0153, U+015E, U+015F, U+02BB, U+02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308,
  U+2000-200D, U+2010-2015, U+2018-201A, U+201C-201E, U+2020-2022, U+2026, U+2028, U+2029,
  U+202F, U+2030, U+2032, U+2033, U+2039, U+203A, U+2044, U+2082, U+20AC, U+2122, U+2191,
  U+2193, U+2197, U+2198, U+2212, U+2215, U+FEFF, U+FFFD;
```

`latin`, for Condensed 500/600 — the same minus `U+2000-200D`, `U+2010`, `U+2011`, `U+2012`,
`U+2015`, `U+2028`, `U+2029`, `U+202F`, `U+205F`, `U+FEFF`, `U+FFFD` (the condensed cuts simply
contain fewer punctuation codepoints):

```css
unicode-range: U+0000, U+000D, U+0020-007E, U+00A0-00FF, U+011E, U+011F, U+0130, U+0131,
  U+0152, U+0153, U+015E, U+015F, U+02BB, U+02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308,
  U+2013, U+2014, U+2018-201A, U+201C-201E, U+2020-2022, U+2026, U+2030, U+2032, U+2033,
  U+2039, U+203A, U+2044, U+2082, U+20AC, U+2122, U+2191, U+2193, U+2197, U+2198, U+2212,
  U+2215;
```

`U+2082 ₂`, `U+2197 ↗` and `U+2198 ↘` are in the `latin` files but in no stock Google range —
they live in IBM's `Pi` subset. They are kept because the site uses them, and the ranges above
already account for them. A browser will still fetch both subsets per face, because the text is
Turkish; see Task 2's note on payload.

- [ ] **Step 2: Add the font tokens and the type scale**

```css
:root {
  --font-display: 'Selim Sans Condensed', 'Arial Narrow', system-ui, sans-serif;
  --font-mono: 'Selim Mono', ui-monospace, 'Consolas', monospace;
  --font-body: 'Selim Sans', system-ui, sans-serif;
}
```

Then the scale, using the `--text-*` steps from `tokens.css` and a measure cap of
`68ch` for body copy and `34ch` for lead paragraphs.

- [ ] **Step 3: Preload only the two critical faces in `app/index.html`**

```html
<link rel="preload" href="${import.meta.env.BASE_URL}fonts/selim-sans-condensed-600-latin-ext.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${import.meta.env.BASE_URL}fonts/selim-mono-500-latin-ext.woff2" as="font" type="font/woff2" crossorigin>
```

Preload the **600 condensed** and the **500 mono** `latin-ext` faces — those are the dominant
weights in the two families that carry the design, and they are what appears above the fold.
Both paths carry the weight **and** the subset; the earlier draft's weight-less paths
(`ibm-plex-sans-condensed-latin-ext.woff2`, `ibm-plex-mono-latin-ext.woff2`) matched no file
and would have 404'd.

`crossorigin` is required — a font preload without it is fetched twice, because fonts are
always fetched in CORS mode.

Use `${import.meta.env.BASE_URL}` for the path — the base is `/` for the root site and
`/subnautica-derinlik-gunlugu/` for the subpath one, and a hardcoded `/fonts/` would 404 on
one of them. Verify this after the edit rather than assuming.

- [ ] **Step 4: Do NOT remove `--display: Impact` yet**

`style.css:1` still declares `--display: Impact, 'Arial Narrow', Arial, sans-serif`, and
roughly a dozen rules consume it. Removing the declaration now would silently change every
heading before the token migration runs. Task 6 repoints those rules at `--font-display`; this
task only adds the fonts and the type scale. Leaving `Impact` declared but unused is
acceptable for one commit and is removed in Task 6.

- [ ] **Step 5: Commit**

```powershell
git add app/src/design/type.css app/index.html
git commit -m "Add the @font-face block and the type scale"
```

---

## Task 5: Split `style.css` without changing a single value

**Files:**
- Create: `app/src/design/layout.css`, `hero.css`, `dive.css`, `wiki.css`, `chrome.css`
- Modify: `app/src/main.jsx` (import them in cascade order)
- Delete: `app/src/style.css`

**Interfaces:**
- Consumes: nothing new
- Produces: six files whose combined content is byte-equivalent in effect to the old `style.css`. **No value changes in this task** — it is a move, and the proof is that the rendered pages do not change.

- [ ] **Step 1: Record a pre-split screenshot set**

```powershell
cd C:\Users\selim\subnautica-github-pages\app
node scripts/visual-check.mjs shots http://127.0.0.1:5173 ..\.superpowers\split-before 1440:900 375:812
```
Run `npm run dev` first in a separate shell. The two Pages routes matter too —
capture `/#/wiki` as well, since `wiki.css` is the largest block.

- [ ] **Step 2: Split by concern, preserving cascade order**

`layout.css` (base, reset, utilities, breakpoints) → `chrome.css` (header, nav, footer,
progress) → `hero.css` (hero, rail, scroll cue, ticker) → `dive.css` (dive section, tabs,
cards) → `wiki.css` (wiki hero, filters, grid, modal). Order matters: later files may
override earlier ones, so keep the original relative order of every rule.

- [ ] **Step 3: Update the imports in `main.jsx`**

Replace `import './style.css'` with the five imports, in the order above. Layer 2 and 3 of
`tokens.css` and `type.css` come **first** — they define the variables the component files
consume.

- [ ] **Step 4: Verify the pages did not change**

```powershell
node scripts/visual-check.mjs shots http://127.0.0.1:5173 ..\.superpowers\split-after 1440:900 375:812
```
Then compare the before and after PNGs. They must be visually identical. A difference means
you dropped or reordered a rule — find it before continuing. `measure` must also return the
same `h1FontFamily` and the same `wrappedClicks` counts as the baseline.

- [ ] **Step 5: Confirm the old file is gone and nothing else moved**

```powershell
cd C:\Users\selim\subnautica-github-pages
git status --short
Test-Path app\src\style.css
```
Expected: `style.css` deleted, the five new files added, `main.jsx` modified, and **no other
file changed**. Any diff in `HomeView.jsx`, `WikiView.jsx` or `wikiData.js` is out of scope
for this plan.

- [ ] **Step 6: Commit**

```powershell
git add -A app/src
git commit -m "Split style.css into design/ by concern, no value changes"
```

---

## Task 6: Migrate the hardcoded hex to tokens and repoint the type

**Files:**
- Modify: `app/src/design/*.css` (all five)
- Delete: the `--display` declaration and every `--cyan` / `--bg` / `--muted` / `--line` / `--surface` use

**Interfaces:**
- Consumes: the tokens from Task 3
- Produces: **zero hardcoded hex outside `tokens.css`**, and `h1` resolving to `Selim Sans Condensed`.

- [ ] **Step 1: Map every hardcoded value to a token before editing anything**

```powershell
cd C:\Users\selim\subnautica-github-pages\app\src\design
Select-String -Path *.css -Pattern '#[0-9a-fA-F]{3,8}|rgba?\(' | Measure-Object | Select-Object -ExpandProperty Count
```
There are 66 distinct values to place, across 81 literal occurrences. Write down the mapping. Values that are genuinely one-off — a single highlight inside one
component — get **their own named token** in layer 1 rather than being left inline. The
locked-token gate is not satisfied by replacing 60 of 71 values.

- [ ] **Step 2: Replace each value with its token**

Work file by file. After each file, re-run the count; it must fall by the number you
replaced.

- [ ] **Step 3: Repoint every type consumer at `--font-display`**

Every `var(--display)` becomes `var(--font-display)`, and the `--display: Impact, ...`
declaration in the base block is deleted. `var(--cyan)` becomes `var(--glow)`, and so on.
`Impact` and `Arial` must not survive anywhere — the acceptance check in Step 5 greps for
them.

- [ ] **Step 4: Verify nothing overflows and the page still renders**

```powershell
cd C:\Users\selim\subnautica-github-pages\app
node scripts/visual-check.mjs measure http://127.0.0.1:5173 320:800 375:812 414:896 768:1024 1440:900
```
Expected: `overflow: false` at all five, and the same `wrappedClicks` as the baseline —
`button.dive-tab` at 768 and 1440, `button.nav-active` at 1440, nothing at 320/375/414.

Then look at the screenshots. The **layout must be identical**; only colour and typeface
change. A layout shift here means a token carries a different length than the literal it
replaced, which is the failure mode to catch.

- [ ] **Step 5: Prove the gates are met**

```powershell
cd C:\Users\selim\subnautica-github-pages
'--- hex outside tokens.css ---'
Select-String -Path app\src\design\*.css -Pattern '#[0-9a-fA-F]{3,8}' |
  Where-Object { $_.Path -notlike '*tokens.css' } | Measure-Object | Select-Object -ExpandProperty Count
'--- Impact / Arial anywhere in src ---'
Select-String -Path app\src\*.css,app\src\design\*.css,app\index.html -Pattern 'Impact|Arial' |
  ForEach-Object { "$($_.Filename):$($_.LineNumber) $($_.Line.Trim())" }
'--- inline font-family bypassing a token ---'
Select-String -Path app\src\design\*.css -Pattern 'font-family:\s*["'']' |
  Where-Object { $_.Line -notmatch 'var\(--font' }
```
Expected: `0`, no `Impact`/`Arial` hits, and no un-tokenised `font-family`.

Note: `Arial` will legitimately appear inside the `--font-display` and `--font-body` fallback
stacks in `tokens.css`/`type.css` — a fallback chain is not a bypass. The grep above covers
`app/src/*.css` and `app/index.html`; check the hit list rather than assuming a count of zero.

- [ ] **Step 6: Confirm the live-render font family**

```powershell
node scripts/visual-check.mjs measure https://selim419.github.io/ 1440:900
```
This still reports `Impact` because the change is not published yet. After Task 8 it must
report a `font-family` starting with `Selim Sans Condensed`.

- [ ] **Step 7: Commit**

```powershell
git add app/src/design
git commit -m "Route every colour and font through a named token; retire Impact and Arial"
```

---

## Task 7: Mobile hardening at the four mandatory widths

**Files:**
- Modify: `app/src/design/layout.css`, `hero.css`, `dive.css`, `wiki.css`
- Modify: `app/src/design/tokens.css` (add the four breakpoints as named custom properties if the layout uses them)

**Interfaces:**
- Consumes: the token system
- Produces: no horizontal overflow at 320/375/414/768, and `overflow-x: clip` in place of `hidden`.

- [ ] **Step 1: Replace `overflow-x: hidden` with `clip`**

`body{overflow-x:hidden}` is a real latent bug. `hidden` makes the element a scroll
container, which means `position: sticky` on any descendant positions against that container
instead of the viewport — and the Phase 2 dive pins its canvas with exactly that. `clip`
does not create a scroll container. Apply to both `html` and `body`.

- [ ] **Step 2: Confirm the four widths are all covered by real breakpoints**

The current breakpoints stop at 600 px and do not distinguish 320 from 375 from 414.
Establish a rule per width and make sure each has at least one deliberate rule — not just
"inherits the smaller one". 768 px is where the depth rail must hide; it currently has no
rule of its own.

- [ ] **Step 3: Grid tracks that carry imagery use `minmax(0, 1fr)`**

A bare `1fr` track sizes to its content, so a long word or a wide image inside a grid cell
pushes the track wider than the viewport. The wiki card grid and the dive card grid are the
two places this bites.

- [ ] **Step 4: Long words in display type wrap**

Add `overflow-wrap: anywhere; min-width: 0` to the display heading. The hero headline
`YERİN ALTINDA.` already overflows its container at 320 px today — it is clipped by
`.hero{overflow:hidden}` rather than wrapping, so nobody notices until the type changes and
it clips differently.

- [ ] **Step 5: Verify all four widths by measurement, not by eye**

```powershell
cd C:\Users\selim\subnautica-github-pages\app
node scripts/visual-check.mjs measure http://127.0.0.1:5173 320:800 375:812 414:896 768:1024
```
Expected for all four: `overflow: false`, `bodyOverflowX: "clip"`, `htmlOverflowX: "clip"`,
and no `offenders` array entries. Then **look at the fold screenshots** for each width — the
measurement catches overflow, not ugliness.

- [ ] **Step 6: Check the two known-by-design cases did not become real ones**

`button.dive-tab` at 768 and 1440 and `button.nav-active` at 1440 are expected in
`wrappedClicks`. If a width that previously reported **zero** now reports any entry, that is
a regression you introduced — fix it rather than adding it to the baseline.

- [ ] **Step 7: Commit**

```powershell
git add app/src/design
git commit -m "Harden the four mandatory widths; overflow-x clip so sticky still works"
```

---

## Task 8: Publish and verify

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/baseline/design-system-after-2026-09-25.md`

**Interfaces:**
- Consumes: Tasks 1-7
- Produces: the live sites serving the token-based design, and an "after" baseline to compare with.

- [ ] **Step 1: Run the full test suite and a build**

```powershell
cd C:\Users\selim\subnautica-github-pages\app
npm run test:base
npm run build:root
node scripts/verify-base.mjs /
```
Expected: the existing tests pass and `base OK: /`. This plan changed no build wiring, so any
failure here means something was touched that should not have been.

- [ ] **Step 2: Push and let the pipeline publish**

```powershell
cd C:\Users\selim\subnautica-github-pages
node scripts/release.mjs
```
This pushes, waits for the source `CI` to conclude `success`, then pins both Pages repos,
which triggers both deploys.

- [ ] **Step 3: Verify the live sites**

```powershell
cd C:\Users\selim\subnautica-github-pages\app
node scripts/visual-check.mjs measure https://selim419.github.io/ 320:800 375:812 414:896 768:1024
node scripts/visual-check.mjs measure https://selim419.github.io/subnautica-derinlik-gunlugu/ 320:800 1440:900
```
Expected on both: `overflow: false` at every width, `h1FontFamily` beginning with
`Selim Sans Condensed`, and `bodyOverflowX: "clip"`. If `h1FontFamily` still says
`Impact`, the deploy served a stale artifact — check the deploy run before re-running anything.

- [ ] **Step 4: Write the after-baseline and diff the two**

`docs/superpowers/baseline/design-system-after-2026-09-25.md` records the same table shape as
the before file, plus: the hardcoded-hex count outside `tokens.css` (target **0**), the
token count, the resolved `h1` family, and `bodyOverflowX`. Put the before and after tables
side by side in the commit message so the change is legible in history.

- [ ] **Step 5: Update the README's structure section**

The "Yapı" list must name the real files now that they exist, and must not list
`app/src/dive/`, `app/src/scene/` or `app/src/design/`-as-not-yet-created paths. This
section currently names two directories that do not exist.

- [ ] **Step 6: Final gate check and commit**

```powershell
cd C:\Users\selim\subnautica-github-pages
git add -A
git commit -m "Record the design-system after-baseline"
```

## Verification

This plan is done when all of these hold:

1. `npm run test:base` passes; `npm run build:root` then `verify-base.mjs /` reports `base OK: /`.
2. `grep` finds **zero** hardcoded hex values in `app/src/design/*.css` outside `tokens.css` (the 66 distinct values measured in the baseline are all migrated).
3. `grep` finds no `Impact` in any stylesheet or in `app/index.html`, and no `Arial` outside a
   fallback stack in `tokens.css` / `type.css`.
4. No `font-family` declaration bypasses a `--font-*` token.
5. The live `h1` resolves to a family starting `Selim Sans Condensed` at all five widths,
   on both sites.
6. `overflow: false` at 320, 375, 414 and 768 px, on both sites.
7. `bodyOverflowX` and `htmlOverflowX` are `clip`, not `hidden`.
8. The 600-italic face is not present in `app/public/fonts/`.
9. `app/public/fonts/OFL.txt` exists.
10. `app/src/style.css` no longer exists; the six `app/src/design/*.css` files do.
11. Neither `HomeView.jsx`, `WikiView.jsx`, `wikiData.js`, nor any Turkish copy changed —
    checkable with `git diff --stat` against the plan's first commit.

## Out of Scope

- No scroll-driven dive, no Three.js scene, no `regimes.js`, no `DepthGauge`. That is Plan 2B.
- No content changes: no new wiki records, no new copy, no invented statistics.
- No `design.md`. The token system in `app/src/design/tokens.css` is the system of record for
  this project; Hallmark's `design.md` is a separate artifact and is not produced here.
- No restyling of section rhythm, macrostructure or layout. This plan changes the palette,
  the typeface and the responsive correctness. Section structure is deliberately untouched —
  direction C was settled over three mockup rounds and this plan applies it rather than
  reopening it.
- No `prefers-reduced-motion` work beyond what already exists; the spec's reduced-motion
  requirements apply to the Phase 2 scene, not to a static stylesheet.
