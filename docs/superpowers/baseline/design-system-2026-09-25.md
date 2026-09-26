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

This is a **dev tool**. It must never be wired into CI: the CI runner is Linux without a
browser, and the script exits 3 with a clear message when it cannot find one.

## Baseline table

| Width | Horizontal overflow | Clickable text wrapping to 2 lines | Rendered `h1` family |
|---|---|---|---|
| 320 | no | 0 | `Impact, "Arial Narrow", Arial, sans-serif` |
| 375 | no | 0 | same |
| 414 | no | 0 | same |
| 768 | no | 3 (`button.dive-tab` — multi-line by design) | same |
| 1440 | no | 4 (+ `button.nav-active`, duplicated label from the `TextRoll` animation) | same |

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
| Hardcoded (non-token) hex literals | **75** |
| `var(--…)` references | **71** |
| `position: sticky` occurrences | **0** |

The plan's "71 hardcoded hex values" is **not** what the file contains. The number 81 is the
real count of hex literals; 71 is the count of `var(--…)` references, which is the figure the
plan appears to have mis-attributed. Likewise "5 tokens" is really 4 hex-valued custom
properties — the `:root` block defines six custom properties, but `--line` is
`rgba(140,224,221,.22)` and `--display` is a font stack, so only four carry a hex value.
(The other two hex literals in `:root` are the bare `color:` and `background:` declarations,
which reference the same literals as `--bg` and an un-tokenised body colour.)

Task 3 migrates all of them. Verify against these numbers, not the plan's.

`position: sticky` is used **0 times** today, so switching `overflow-x: hidden` to `clip` has
no sticky positioning to break — but the Phase 2 dive spine will add it, which is why `clip`
matters.

## Two detector caveats — do not "fix" a non-bug

1. `button.dive-tab` legitimately occupies two lines (four children lay out as two rows), and
   `button.nav-active` renders its label twice because the `TextRoll` effect keeps both copies
   in the DOM. Neither is a defect.
2. The wrapped-text detector clusters a `Range`'s client rects **by vertical overlap**. Do not
   replace it with a count of distinct `top` values — `SUB` and `NAUTICA` in the logo sit on
   one visual line at different `top` positions, so distinct `top` counts them as two lines.
   Equally, do not compare box height to `line-height`; that flags every padded 48 px button
   as two lines.
