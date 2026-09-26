# Design System After-Baseline — 2026-09-25

The measured "after": the state published to both live sites by source commit `2931a4c`, which is
the last commit of `docs/superpowers/plans/2026-09-25-design-system.md`. Read against
`design-system-2026-09-25.md`, which is the "before" and holds the method. Where a number here
differs from that file, the difference is the result and the reason is named.

Live at the time of writing:

- <https://selim419.github.io/>
- <https://selim419.github.io/subnautica-derinlik-gunlugu/>

## How it was measured

```
cd app
node scripts/visual-check.mjs measure https://selim419.github.io/ 320:800 375:812 414:896 768:1024 1440:900
node scripts/visual-check.mjs measure https://selim419.github.io/subnautica-derinlik-gunlugu/ 320:800 375:812 414:896 768:1024 1440:900
node scripts/visual-check.mjs measure "https://selim419.github.io/#/wiki" 320:800 1440:900
node scripts/visual-check.mjs measure "https://selim419.github.io/subnautica-derinlik-gunlugu/#/wiki" 320:800 375:812 414:896 768:1024 1440:900
```

The harness is unchanged in method: a dependency-free CDP client, `Emulation.setDeviceMetricsOverride`
with `mobile: width < 768`, then `app/scripts/page-probe.js` into `Runtime.evaluate`. The probe
**gained** a key in this plan's last task — `clippedText` — and gained nothing else. Every
pre-existing key keeps its name, its type and its meaning, so the "before" numbers and the "after"
numbers are produced by the same code path.

The four runs above are the complete live surface: two sites × two routes. Routing is
`window.location.hash.startsWith('#/wiki')`, so `/#/wiki` is a second real page and not a fragment
of the first. The subpath site was measured at all five widths on both routes, not only the two
widthes the plan's Step 3 names, because "on both sites" is a claim about the whole site and the
wiki route is where `wiki.css` governs.

## Baseline table — `/`, live, 2026-09-25 after release `2931a4c`

| Width | Horizontal overflow | Clickable labels occupying >1 visual line (count) | Rendered `h1` family | `bodyOverflowX` | `htmlOverflowX` | `clippedText` groups |
|---|---|---|---|---|---|---|
| 320 | no | 0 | `"Selim Sans Condensed", "Arial Narrow", system-ui, sans-serif` | `clip` | `clip` | 1 — `div.ticker` |
| 375 | no | 0 | same | `clip` | `clip` | 1 — `div.ticker` |
| 414 | no | 0 | same | `clip` | `clip` | 1 — `div.ticker` |
| 768 | no | 3 (`button.dive-tab` — multi-line by design) | same | `clip` | `clip` | 1 — `div.ticker` |
| 1440 | no | 5 (the three `button.dive-tab`, plus `button.nav-active` and one unclassed nav button — both from the `TextRoll` animation duplicating the label) | same | `clip` | `clip` | 3 — `div.ticker` and the two `TextRoll` wrappers |

`body` `min-width` is `320px` at every width. Every width reports `scrollWidth === clientWidth`,
`offenders: []`, `overflow: false`, `wrappedClicksTruncated: false`.

The wrapped-click column is **unchanged from the before file, value for value** — 0/0/0/3/5 — and
that is the point of recording it. The plan retired `Impact` and `Arial` for a typeface with
different metrics, at every width, on both routes, and no clickable label changed its line count.

The `h1` family column is the acceptance criterion and it moved: `Impact, "Arial Narrow", Arial,
sans-serif` became `"Selim Sans Condensed", "Arial Narrow", system-ui, sans-serif`, at all five
widths, on both sites and on both routes. The rendered family is measured with `getComputedStyle`,
so it is the family the cascade resolved, not the family a stylesheet asked for. `'Arial Narrow'`
survives only as the second entry of the `--font-display` fallback stack.

`bodyOverflowX` moved from `hidden` to `clip`, and `htmlOverflowX` from `visible` to `clip`. That
pair is load-bearing rather than cosmetic: `hidden` makes `body` a scroll container, which would
break the `position: sticky` the Phase 2 dive spine depends on. `clip` is a legal pairing with
`visible` on the other axis, so the vertical axis is untouched and nothing became scrollable that
was not already.

### The same table, side by side

| | Before (2026-09-25, `style.css`) | After (2026-09-25, commit `2931a4c`) |
|---|---|---|
| Hardcoded hex literals outside the token layer | **77** | **0** |
| `Rendered h1` family | `Impact, "Arial Narrow", Arial, sans-serif` | `"Selim Sans Condensed", "Arial Narrow", system-ui, sans-serif` |
| `bodyOverflowX` | `hidden` | `clip` |
| `htmlOverflowX` | `visible` | `clip` |
| Overflow at 320 / 375 / 414 / 768 / 1440 | no / no / no / no / no | no / no / no / no / no |
| `offenders` | `[]` everywhere | `[]` everywhere |
| Wrapped clickable labels at 320 / 375 / 414 / 768 / 1440 | 0 / 0 / 0 / 3 / 5 | **0 / 0 / 0 / 3 / 5** |
| Text clipped by a container | **not measurable** | 1 group at 320–768, 3 at 1440, all intentional |
| Token count | 4 hex-valued custom properties, 6 declared | **50** custom properties across three layers |
| `var(--…)` references | 71 | **252** |
| Stylesheets in `app/src` | 1 (`style.css`, 21 776 B) | **7** in `app/src/design/`, loaded in cascade order |
| woff2 payload | 12 files, 221 836 B | **10 files, 193 112 B** |

## `/#/wiki`, live

| Width | Horizontal overflow | Clickable labels >1 line | `scrollHeight` (before → after) | `bodyOverflowX` | `clippedText` groups |
|---|---|---|---|---|---|
| 320 | no | 8, **truncated** | 5296 → 5277 | `clip` | 0 |
| 375 | no | 8, **truncated** | 5120 → 5105 | `clip` | 0 |
| 414 | no | 8, **truncated** | 5071 → 5060 | `clip` | 0 |
| 768 | no | 8, **truncated** | 3334 → 3284 | `clip` | 0 |
| 1440 | no | 8, **truncated** | 2864 → 2868 | `clip` | 2 — the two `TextRoll` wrappers |

`wrappedClicksTruncated: true` at every width, so the real count is higher. That is unchanged from
the before file and is expected, not a defect: the wiki grid's cards are tall and their
kicker/title/summary stack, so most of them wrap. `overflow` is `false` and `offenders` is `[]` at
all five widths.

**The `scrollHeight` values do not reproduce, and the before file said they must.** It wrote that
"any later task touching the wiki must reproduce these `scrollHeight` values exactly, since they
are the cheapest single number that catches a dropped or reordered rule". That expectation was
written before the typeface changed, and it cannot hold across a typeface swap: a display face
with different metrics sets different line boxes, and two of the mono cuts were deleted, so
heights move. The deltas are −19, −15, −11, −50 and +4 px. Nothing was dropped or reordered — that
is the claim the number was standing in for, and it is checked directly instead, by the zero
differing box-model properties in the geometry signature and by `overflow: false` with
`offenders: []` at all five widths on both routes. Recording the movement rather than the rule
keeps the number useful: the next task that changes the wiki can still diff against **this** table.

## Codebase counts (measured 2026-09-26, at `2931a4c`)

The "before" file counted hex literals in the single `app/src/style.css`. There is no single
stylesheet now, so the count is split by layer, and the split is the interesting part: the gate is
not "fewer hex values" but "no hex value outside the one file that is allowed to name them".

| Metric | Before | After |
|---|---:|---:|
| Hex literal occurrences, all of `app/src/design/*.css` | 81 | 30 |
| Hex literal distinct values | 70 | 28 |
| Hex occurrences **outside `tokens.css`** | **77** | **0** |
| Hex occurrences that are a `--*` custom-property value | 4 | 30 |
| `var(--…)` references | 71 | 252 |
| Custom properties declared, distinct | 6 | **50** |
| …in `tokens.css` (layer 1) | — | 32 |
| …in `type.css` (layer 2) | — | 18 |
| …with at least one consumer | 4 of 6 | **43 of 50** |
| …declared with no consumer | 2 of 6 | **7 of 50** — classified below |
| `position: sticky` declarations | 0 | 0 |

`position: sticky` is still **0 declarations**. The string appears once in `layout.css`, in the
comment that explains why `overflow-x: clip` and not `hidden` — which is the whole reason the pair
was changed. Nothing on the site is sticky yet; the Phase 2 dive spine is what the change is for.

**Definition used for "hardcoded hex outside the token layer":** a hex literal that is not the value
of a custom property, in any stylesheet other than `tokens.css`, with comments stripped. Every
other kind of declaration counts, including a bare declaration inside `:root`. The gate is
`tokens.css` and nothing else, because that is the file the plan made the system of record.

**The corrected before-figure.** The before file's own arithmetic is right and has been
re-derived from `67784a1:app/src/style.css`: 81 hex occurrences, 70 distinct, exactly **4** of them
inside a `--*` custom-property declaration — `--bg: #06141c`, `--surface: #0b2730`,
`--cyan: #7defe4`, `--muted: #a8c6c8` — leaving **77 hardcoded non-token literals**. A stale
"66 distinct values" figure appears in the plan's verification list; 66 is not a count of anything
in that file. Use 81 / 70 / 4 / 77. The before file also already explains why an earlier "75" was
wrong, and that explanation still stands: 75 counts hex literals *outside* `:root`, which is a
different quantity wearing the wrong label.

`tokens.css` still names 28 hex values and that is correct: it is the layer whose job is to name
them, in two places — 15 in the base `:root` and 15 across the five `[data-regime='…']` blocks, so
30 occurrences and 28 distinct values. Every one of the 30 is the value of a custom property; that
is the whole test. The 32 layer-1 tokens are 15 hex, 5 `rgba()` (`--ink-muted`, `--ink-faint`,
`--hairline`, `--hairline-firm`, `--scrim`), 8 spacing and 4 breakpoints, so **the hex count is
not the token count** in either direction.

### The seven tokens with no consumer

Measured by counting `var(--…)` and `readTokens.js` name references across all seven stylesheets
and the five JSX/JS sources, not by reading. An earlier task's report put this at 3; that count
predates the four breakpoint tokens, and 7 is what the source says.

| Token | Layer | Why it has no consumer |
|---|---|---|
| `--bp-compact`, `--bp-tablet`, `--bp-landscape`, `--bp-narrow` | 1 | **CSS cannot consume them.** A custom property is not allowed in an `@media` condition, so a breakpoint token can never be referenced by the media query it exists to name. They are the ladder written down so the `@media` values in the component files can be checked against it by eye — a documentation surface, and declaring them is the honest way to make the ladder checkable. |
| `--coral` | 1 | Held for the Phase 2 dive spine, named as such in `tokens.css`. |
| `--ink-faint` | 1 | Held for the scene shaders, read through `readTokens.js`. |
| `--text-display` | 2 | **The one that is not justified by a constraint, and it is recorded here rather than tidied away.** `type.css` declares it as the top step of the size scale — `clamp(2.75rem, 8.5vw, 10.5rem)` — and its own comment says "display on the token's own range", which is an admission that no element reaches for it: the four display settings on the site are each written as their own `clamp()`, because each has a different curve (`.hero h1` 10.1vw, `.final-content h2` 10vw, `.wiki-hero h1` and `.manifesto h2` 9vw, `.section-heading h2` 7.2vw). So the token documents the range and nothing spends it, which is in tension with the rule the same file states two paragraphs earlier, that "a step earns its place by naming a role something fills". It is not a rendering defect and it is not fixed here — this is the release task, and deleting a token the plan deliberately introduced is a scope change. It is a fair target for the next task that touches the display scale. |

The other 43 declared tokens each have at least one reference, counted rather than assumed.

## Fonts in `app/public/fonts/`

**10 woff2 files, not the 12 the before file lists.** The two `selim-mono-*-latin-ext.woff2` cuts
were deleted in Task 6b: a cold load of both routes with the cache disabled, recording every woff2
request and its initiator, shows they are never fetched by anything, and the one that was being
fetched was only being fetched because `index.html` preloaded it. Their `@font-face` rules went
with them.

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
| `selim-mono-500-latin.woff2` | 18 812 | Selim Mono | 500 | latin |
| **woff2 total** | **193 112 (188.6 KiB)** | | | |

Plus `OFL.txt` (4 360 B) and `README.md` (provenance). **Down 28 724 bytes and two files from the
before figure of 221 836 B across 12**, and the bytes that went are bytes that were downloaded and
never drawn.

**No `600-italic` face exists, and none is fetched**, deliberately: it was never downloaded, so a
`font-style: italic` rule that needed it would be a rule that could only ever fall back. Nothing in
`type.css` declares one and nothing asks for one.

`type.css` declares ten `@font-face` rules — three families × the weights actually used, × the
subsets actually selected. Every declared `unicode-range` was verified against the file's **own
cmap** with fontTools 4.57.0, not against a sibling rule and not against the site's copy, and the
check is exact in both directions: every codepoint in every cmap is inside its declared range, and
every declared codepoint is in the cmap. The one exception is `U+205F` in the two mono latin cuts,
which the site's copy never uses. The condensed 500 and 600 ranges are verified **equal** for both
subsets; a comment in `type.css` that claimed otherwise was wrong about the code and wrong about
the download cost, and is corrected in the release commit.

## Detector caveats — do not "fix" a non-bug

Carried forward from the before file, all four still true:

1. `button.dive-tab` legitimately occupies two lines, and `button.nav-active` renders its label
   twice because `TextRoll` keeps both copies in the DOM.
2. The wrapped-text detector clusters a `Range`'s client rects by vertical overlap. Do not replace
   it with a count of distinct `top` values — `SUB` and `NAUTICA` sit on one line at different
   `top`s. Equally, do not compare box height to `line-height`.
3. The wrapped-text detector skips inline `<a>`. Deliberate under-report: an inline link wraps
   mid-sentence by design and would flood the list with non-defects.
4. `wrappedClicks` and `offenders` are capped at 8 entries; only the first carries a truncation
   flag, and it does carry one.

New in this plan, and the most important caveat in the file:

5. **`clippedText` reports three groups on `/` at 1440 and one at every other width, and every one
   of them is intentional.** Do not "fix" them.

   | Group | Where | Why it is not a defect |
   |---|---|---|
   | `div.ticker`, axis x, `destroys: true` | `/`, all five widths | A marquee. `hero.css` gives it `overflow: hidden` and `white-space: nowrap`, and `HomeView.jsx` gives its inner div the copy twice so the loop is seamless. The clip is the mechanism: without it the strip would run off the side of the page. The element is `aria-hidden`. |
   | `span.relative.block.overflow-hidden`, axis y, `destroys: true` ×2 | `/` and `/#/wiki` at 1440 | `TextRoll` in `skiper58.jsx` renders the label twice: once in flow at `y: 0`, once in an `absolute inset-0` layer at `y: 100%` that rolls up on hover. The second copy's per-character spans sit exactly one line-height **below** the wrapper's clip, so the measurement is `elementHeight 9.11` against `clipperHeight 9.11` and `overhang 9.11` — the whole of it outside, zero pixels visible. Moving it inside would break the hover effect. |
   | `div.record-panel`, axis y, **`destroys: false`** | a record route, e.g. `/#/wiki/safe-shallows`, at 320 | Not a canonical route, and the finding is the scrollable case: `overflow-y: auto` is declared on the panel precisely because a record is taller than the viewport at 320. `destroys: false` is the probe saying so. |

   The `destroys` field is the reason to keep this key. A list that conflated "the content is
   gone" with "the content is one scroll away" could not be acted on, and the third row above is
   the case that proves the distinction earns its place.

## What the signature deliberately does not record

Unchanged from the before file and unchanged by this plan: `transform` and every inline style the
animation library writes; the `<head>` subtree, because Vite's dev server injects one `<style>` per
imported stylesheet and the split from one file to seven would move the element count on its own;
and the bounding rect of any element not at rest, dropped after two samples 700 ms apart, with
`unstableRects` reported so a dropped rect cannot be read as a matching one.

The `clippedText` key is **not** part of the signature and is not hashed. It is a live judgement
about intent, and a judgement belongs in a report a person reads, not in a hash that is supposed
to answer only "did the rendering change".

This is a **dev tool**. It must never be wired into CI: the runner is Linux without a browser, and
the script exits 3 with a clear message when it cannot find one.

## Release record

| | |
|---|---|
| Source commit | `2931a4c` |
| Source `CI` | run 36247199494, `success` |
| Root deploy | `Selim419/Selim419.github.io` run 36247247391, `success` |
| Subpath deploy | `Selim419/subnautica-derinlik-gunlugu` run 36247250523, `success` |
| Credentials used | none — the release script needs no token, and the Pages workflows authorise with their own `GITHUB_TOKEN` |

The live `index.html` serves `assets/index-DD0rXXDc.css`, the same content hash
`npm run build:root` produces locally, and `fonts/selim-mono-500-latin.woff2` returns 200 while
the deleted `fonts/selim-mono-500-latin-ext.woff2` returns 404. The deployed artifact is the
commit, not a stale one.
