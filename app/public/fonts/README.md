# Fonts

Self-hosted webfonts for subnautica.com.tr. Twelve `.woff2` files: **six weights × two
subsets** (`latin`, `latin-ext`).

| Family | Weights | Files |
|---|---|---|
| Selim Sans | 400 Regular, 600 SemiBold | `selim-sans-{400,600}-{latin,latin-ext}.woff2` |
| Selim Sans Condensed | 500 Medium, 600 SemiBold | `selim-sans-condensed-{500,600}-{latin,latin-ext}.woff2` |
| Selim Mono | 400 Regular, 500 Medium | `selim-mono-{400,500}-{latin,latin-ext}.woff2` |

No italic face is vendored; emphasis is carried by weight and colour.

## Provenance

The letterforms are **IBM Plex** (Sans, Sans Condensed, Mono), taken from IBM's official
repository at the immutable git tag **`v6.4.2`** — <https://github.com/IBM/plex/tree/v6.4.2> —
not from a CDN and not from a moving branch. The six source files are the full-family
statics from `fonts/complete/ttf/`, e.g.

```
https://raw.githubusercontent.com/IBM/plex/v6.4.2/IBM-Plex-Sans/fonts/complete/ttf/IBMPlexSans-Regular.ttf
```

The files here are **subsets** of those statics, cut and compressed with **fontTools 4.57.0**
(`pyftsubset`, brotli) against the Google Fonts `latin` / `latin-ext` unicode ranges, plus
three characters the site uses that no stock subset covers (`U+2197 ↗`, `U+2198 ↘`,
`U+2082 ₂`). Outlines are bit-identical to the source; only the glyph selection differs.

## Licence

**SIL Open Font License 1.1.** `OFL.txt` is a byte-for-byte copy of the licence IBM ships
beside these fonts at the same tag; the Sans, Condensed and Mono licence files are
byte-identical, so the single file covers all three families.

## Why the internal names are NOT "IBM Plex …"

**Do not "fix" the name table back to `IBM Plex`.** The subsets are renamed on purpose, and
doing it again would put this repository back in breach of its own licence.

IBM Plex is licensed under OFL 1.1 **with a Reserved Font Name**, declared in the licence
header: `Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"`. Clause 3 says no
Modified Version of the Font Software may use the Reserved Font Name without written
permission from the Copyright Holder, and that the restriction

> only applies to the primary font name as presented to the users.

**A subset is a Modified Version.** So the subsets ship under names that do not contain
"Plex": `Selim Sans`, `Selim Sans Condensed`, `Selim Mono`, with the weight in the subfamily
and the PostScript name. Every naming record — name IDs 1, 2, 3, 4, 5, 6 and 16/17 — has
been rewritten. This has **no effect on rendering**: `@font-face` matches by CSS-declared
`font-family` and by URL, so the internal name is used only for identification and for
`local()` sources.

Two records are deliberately **not** touched, because OFL 1.1 requires them to be retained in
every copy and neither is a font name:

- name ID 0 (copyright) — `Copyright 2017/2018/2019 IBM Corp. All rights reserved.` It names
  IBM as the copyright holder and contains no "Plex".
- name ID 7 (trademark) — `IBM Plex® is a trademark of IBM Corp, registered in many
  jurisdictions worldwide.` This is IBM's factual trademark notice. OFL 1.1 requires
  "the above copyright and trademark notices … shall be included in all copies", and
  clause 3 restricts only the *primary font name*. Deleting the trademark string would
  falsify a real registered mark and breach the licence's inclusion requirement.

So a `grep` for "Plex" inside these binaries still hits name ID 7, and that is correct.
What must stay clean is the naming records — 1, 2, 3, 4, 5, 6, 16, 17 — and those are clean.

## Wiring them up

Nothing in this directory is referenced yet. The `@font-face` block, the `font-family`
declarations and the two `<link rel="preload">` tags are added by a later task; do not
assume the CSS already knows these filenames.
