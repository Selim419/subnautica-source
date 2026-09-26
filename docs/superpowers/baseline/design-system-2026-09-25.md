# Design System Baseline — 2026-09-25

The measured "before". Every task in `docs/superpowers/plans/2026-09-25-design-system.md` is
checked against this file. If a later task cannot reproduce these numbers, the discrepancy is
the finding — do not adjust the harness to make the numbers agree.

## How it was measured

```
cd app
node scripts/visual-check.mjs measure https://selim419.github.io/ 320:800 375:812 414:896 768:1024 1440:900
```

The harness is a dependency-free Chrome DevTools Protocol client (`app/scripts/visual-check.mjs`).
It launches a headless Chrome or Edge, applies `Emulation.setDeviceMetricsOverride` with
`mobile: width < 768`, waits for the page to settle, then sends `app/scripts/page-probe.js`
to `Runtime.evaluate`.

`node scripts/visual-check.mjs shots <url> <outDir> [w:h ...]` additionally writes
`w<width>-full.png` and `w<width>-fold.png`.

`node scripts/visual-check.mjs signature <url> [w:h ...]` prints an element count and a
SHA-256 per viewport. This is the check to use for "did this stylesheet change change the
rendering?", because a **screenshot cannot answer it here**: `app/src/OceanScene.jsx` drives a
continuous `requestAnimationFrame` loop, so the hero canvas never renders the same pixels twice,
and `AnimatePresence`/`useScroll`/`useSpring` animate the UI on top of that. Two runs of
`shots` always differ, and a human comparing them either chases canvas noise or waves through a
real difference. The signature hashes the resolved layout of every element instead.

## What the signature deliberately does not record

Added in Task 5. **Do not "fix" these exclusions** — each one reintroduces a failure mode that
has nothing to do with the change under test.

| Excluded | Why |
|---|---|
| `transform`, and everything the animation library writes as an inline style | `useScroll`/`useSpring` drive the scroll bar's `scaleX` and `AnimatePresence` cross-fades the route wrapper, so these differ every frame. `transform` also skews `getBoundingClientRect()`, so recording it would poison the geometry too. |
| The `<head>` subtree | Vite's dev server injects one `<style>` per imported stylesheet. Splitting one `.css` into five moves the element count by six on its own, with no rendering change whatsoever. |
| The rect of any element that is **not at rest** | The `.ticker` marquee is `animation: marquee 25s linear infinite`, so its x offset is a frame sample — two runs seconds apart differ by ~3 px. |

That last one is **measured, not inferred**: the probe takes two bounding-rect samples 700 ms
apart and drops the rect of anything that moved. Testing `getAnimations()` metadata instead is
tempting and wrong — `.hero-inner` carries scroll-linked Motion values that report as running
forever, which would silently drop the `h1` rect, the single most important box on the page.
Two samples keep those elements, because they genuinely do not move while the scroll is still.
The number dropped is reported as `unstableRects` (9 on `/`, 0 on `/#/wiki`) so a dropped rect
can never be read as a matching one. A dropped rect is **not** a free pass: the element's
computed properties are still hashed, and those are the untransformed used values.

`sorted by identity key` — a path built from tag name, id, class list and `:nth-child` — so the
hash cannot depend on traversal order, and the same node produces the same key before and after
an edit.

This is a **dev tool**. It must never be wired into CI: the CI runner is Linux without a
browser, and the script exits 3 with a clear message when it cannot find one.

## Baseline table

| Width | Horizontal overflow | Clickable labels occupying >1 visual line (count) | Rendered `h1` family |
|---|---|---|---|
| 320 | no | 0 | `Impact, "Arial Narrow", Arial, sans-serif` |
| 375 | no | 0 | same |
| 414 | no | 0 | same |
| 768 | no | 3 (`button.dive-tab` — multi-line by design) | same |
| 1440 | no | 5 (the three `button.dive-tab`, plus `button.nav-active` and one unclassed nav button — both from the `TextRoll` animation duplicating the label) | same |

`body` `overflow-x` is `hidden` at every width. `html` `overflow-x` is `visible`.
`body` `min-width` is `320px`.

Every width reports `scrollWidth === clientWidth`, `offenders: []`, `overflow: false`.

Re-measured on 2026-09-25 against the live site, all five widths matched the table above:
320/375/414 → `wrappedClicks: []`; 768 → three `button.dive-tab`; 1440 → `button.nav-active`,
one unclassed nav button (`WIKI / VERİ BANKASI` ×2), and the three `button.dive-tab`.

`body{overflow-x:hidden}` is a **latent bug this plan fixes in Task 7** (Task 1 does not).
`hidden` makes `body` a scroll container, which breaks the `position: sticky` the Phase 2
dive spine depends on. The target is `overflow-x: clip` on `html` and `body`.

## Codebase counts (measured 2026-09-25)

In `app/src/style.css` (21,776 bytes, the only stylesheet in `app/src`):

| Metric | Count |
|---|---|
| Hex literals, all occurrences | **81** |
| Hex literals, distinct values | **70** |
| Hex literals inside the `:root` block | **6** |
| …of those, custom-property token values | **4** — `--bg: #06141c`, `--surface: #0b2730`, `--cyan: #7defe4`, `--muted: #a8c6c8` |
| Hardcoded (non-token) hex literals = 81 − 4 | **77** |
| `var(--…)` references | **71** |
| `position: sticky` occurrences | **0** |

**Definition used for "hardcoded (non-token)":** a hex literal that is not the value of a
custom property. Every other kind of declaration counts, including the bare declarations
inside `:root`. On that one definition the arithmetic closes exactly: **81 − 4 = 77**.

The two hex literals in `:root` that are *not* token values are called out separately
because they are not the same kind of work, and Task 3 should not treat them alike:

- `color: #e8f7f5` on `:root` — a body colour with no token backing it. **In scope for
  Task 3**; it is the natural `--ink` candidate.
- `background: #06141c` on `:root` — already identical to `--bg`. Re-point it at
  `var(--bg)`; there is no new token to create.

An earlier version of this file said "75" and excluded both, on the reasoning that they
"reference the same literals as `--bg` and an un-tokenised body colour". That reasoning
describes them correctly and then excludes them anyway, which is what made the row not
add up: 75 is the count of hex literals **outside** `:root`, a different quantity wearing
the wrong label. Use 77.

The plan's "71 hardcoded hex values" is **not** what the file contains. The number 81 is the
real count of hex literals; 71 is the count of `var(--…)` references, which is the figure the
plan appears to have mis-attributed. Likewise "5 tokens" is really 4 hex-valued custom
properties — the `:root` block defines six custom properties, but `--line` is
`rgba(140,224,221,.22)` and `--display` is a font stack, so only four carry a hex value.

Task 3 migrates all 77. Verify against these numbers, not the plan's.

`position: sticky` is used **0 times** today, so switching `overflow-x: hidden` to `clip` has
no sticky positioning to break — but the Phase 2 dive spine will add it, which is why `clip`
matters.

## Fonts in `app/public/fonts/` (vendored 2026-09-26)

**12 woff2 files — six weights × two subsets — not six.** The names below are the ground truth;
Task 4's `@font-face` `src` and preload `href` must match them character for character,
including the weight and the subset. There is no weight-less file: no IBM Plex family ships as
one variable font covering all weights, so a path like `selim-mono-latin-ext.woff2` does not
exist and 404s.

| File | Bytes | Family | Weight | Subset |
|---|---:|---|---:|---|
| `selim-sans-400-latin.woff2` | 22 460 | Selim Sans | 400 | latin |
| `selim-sans-400-latin-ext.woff2` | 16 472 | Selim Sans | 400 | latin-ext |
| `selim-sans-600-latin.woff2` | 23 828 | Selim Sans | 600 | latin |
| `selim-sans-600-latin-ext.woff2` | 16 748 | Selim Sans | 600 | latin-ext |
| `selim-sans-condensed-500-latin.woff2` | 21 656 | Selim Sans Condensed | 500 | latin |
| `selim-sans-condensed-500-latin-ext.woff2` | 16 496 | Selim Sans Condensed | 500 | latin-ext |
| `selim-sans-condensed-600-latin.woff2` | 21 524 | Selim Sans Condensed | 600 | latin |
| `selim-sans-condensed-600-latin-ext.woff2` | 16 740 | Selim Sans Condensed | 600 | latin-ext |
| `selim-mono-400-latin.woff2` | 18 376 | Selim Mono | 400 | latin |
| `selim-mono-400-latin-ext.woff2` | 14 304 | Selim Mono | 400 | latin-ext |
| `selim-mono-500-latin.woff2` | 18 812 | Selim Mono | 500 | latin |
| `selim-mono-500-latin-ext.woff2` | 14 420 | Selim Mono | 500 | latin-ext |
| **woff2 total** | **221 836 (216.6 KiB)** | | | |

Plus `OFL.txt` (4 360 B) and `README.md` (provenance). **The payload is ~221 KB, not the ~90 KB
the spec originally estimated** — that estimate assumed ~15 KB × 6 files; the real arithmetic is
6 weights × 2 subsets = 12 files at 14–24 KB. Because the text is Turkish, a browser typically
fetches **both** subsets per face, so transfer is close to the on-disk total.

The letterforms are IBM Plex (self-hosted subsets of the `v6.4.2` statics), but the shipped
family names are **`Selim Sans`, `Selim Sans Condensed`, `Selim Mono`**: IBM Plex is OFL 1.1
**with a Reserved Font Name**, and a subset is a Modified Version, so clause 3 requires the
names to change. Task 4 must declare the `Selim …` names — declaring `IBM Plex …` would match
nothing, because no installed font is called `Selim Sans`. The reasoning, and the two records
that keep their IBM text on purpose, are in `app/public/fonts/README.md`.

The two faces Task 4 preloads are `selim-sans-condensed-600-latin-ext.woff2` and
`selim-mono-500-latin-ext.woff2`. No `600-italic` face exists, deliberately.

## Two detector caveats — do not "fix" a non-bug

1. `button.dive-tab` legitimately occupies two lines (four children lay out as two rows), and
   `button.nav-active` renders its label twice because the `TextRoll` effect keeps both copies
   in the DOM. Neither is a defect.
2. The wrapped-text detector clusters a `Range`'s client rects **by vertical overlap**. Do not
   replace it with a count of distinct `top` values — `SUB` and `NAUTICA` in the logo sit on
   one visual line at different `top` positions, so distinct `top` counts them as two lines.
   Equally, do not compare box height to `line-height`; that flags every padded 48 px button
   as two lines.
3. The wrapped-text detector **skips inline `<a>` elements**. This is a deliberate
   under-report, not an oversight: an inline link flows with body copy at the viewport width,
   so it is the most likely thing to wrap, but a link inside running text wraps mid-sentence
   by design and would flood the report with non-defects. Block-level and inline-block
   links (nav, buttons, cards) are still measured. Do not "fix" this without accepting a
   noisier list.
4. `wrappedClicks` is capped at 8 entries. When the cap is hit the probe reports
   `wrappedClicksTruncated: true`, so a truncated list is never mistaken for a clean one.
   `offenders` is also capped at 8 and carries no such flag (it only populates when there is
   overflow, which is a failing state anyway).

## The `/#/wiki` route has no baseline table

The table above measures `/`. The app has no router library — routing is
`window.location.hash.startsWith('#/wiki')` — so `/#/wiki` is a second real page, and it is the
one `wiki.css` mostly governs. Task 5 recorded its first numbers while verifying the CSS split,
and they are **not** the home numbers:

| Width | Horizontal overflow | Clickable labels >1 line | `scrollHeight` |
|---|---|---|---|
| 320 | no | 8, **truncated** | 5296 |
| 375 | no | 8, **truncated** | 5120 |
| 414 | no | 8, **truncated** | 5071 |
| 768 | no | 8, **truncated** | 3334 |
| 1440 | no | 8, **truncated** | 2864 |

`wrappedClicksTruncated: true` at every width, so the real count is higher. That is expected and
not a defect: the wiki grid's cards are tall and their kicker/title/summary stack, so most of
them wrap. `overflow` is `false` and `offenders` is `[]` at all five widths, which is the part
that matters. Any later task touching the wiki must reproduce these `scrollHeight` values
exactly, since they are the cheapest single number that catches a dropped or reordered rule.

