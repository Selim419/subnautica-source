import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const ASSET_REF = /(?:\bsrc|\bhref)="([^"]*assets\/[^"]*)"/

// Every asset reference in the document, not just the first. Checking only the
// `<script src>` left a build where one asset was correct and another pointed
// somewhere else reported as a pass, and this assertion is the pipeline's
// primary gate - it cannot afford to be half-blind.
//
// The global regex is built per call on purpose. `g` makes `matchAll` walk
// `lastIndex`, so a shared instance would make a second call on the same html
// return different references than the first.
function assetRefs(html) {
  return [...html.matchAll(new RegExp(ASSET_REF.source, 'g'))].map((found) => found[1])
}

export function verifyBase(html, expectedBase) {
  const refs = assetRefs(html)

  if (refs.length === 0) {
    throw new Error('no asset reference found in index.html - build did not produce output')
  }

  const expectedDir = expectedBase.endsWith('/') ? expectedBase : `${expectedBase}/`

  for (const raw of refs) {
    // `//cdn.example.com/assets/x.js` passes a bare `startsWith('/')` test, and
    // resolving it against a root URL throws the host away, leaving
    // `/assets/x.js` - so every asset would ship to a third-party origin while
    // this gate reported `base OK: /`. Reject it here, before normalization.
    if (!raw.startsWith('/') || raw.startsWith('//')) {
      throw new Error(`base is not root-absolute: got ${raw}`)
    }

    const referenced = new URL(raw, 'https://example.invalid/').pathname

    const marker = referenced.indexOf('assets/')
    const actualBase = marker === -1 ? referenced : referenced.slice(0, marker)

    if (!actualBase.endsWith('/')) {
      throw new Error(`base is missing its trailing slash: got ${actualBase}`)
    }

    if (actualBase !== expectedDir) {
      throw new Error(
        `base mismatch: index.html references ${referenced} but ${expectedDir} was expected`
      )
    }
  }

  return true
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]).toLowerCase() ===
    resolve(fileURLToPath(import.meta.url)).toLowerCase()

if (isMain) {
  const expected = process.argv[2]
  if (!expected) {
    console.error('usage: node scripts/verify-base.mjs <expected-base>')
    process.exit(1)
  }

  const distIndex = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/index.html')

  try {
    const html = readFileSync(distIndex, 'utf8')
    verifyBase(html, expected)
    console.log(`base OK: ${expected}`)
  } catch (error) {
    console.error(`base FAILED: ${error.message}`)
    process.exit(1)
  }
}
