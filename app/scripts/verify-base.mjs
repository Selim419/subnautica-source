import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const match = /(?:\bsrc|\bhref)="([^"]*assets\/[^"]*)"/

export function verifyBase(html, expectedBase) {
  const found = match.exec(html)

  if (!found) {
    throw new Error('no asset reference found in index.html - build did not produce output')
  }

  const referenced = new URL(found[1], 'https://example.invalid/').pathname
  const expectedDir = expectedBase.endsWith('/') ? expectedBase : `${expectedBase}/`

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

  return true
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (isMain) {
  const expected = process.argv[2]
  if (!expected) {
    console.error('usage: node scripts/verify-base.mjs <expected-base>')
    process.exit(1)
  }
  const html = readFileSync(resolve('dist/index.html'), 'utf8')
  try {
    verifyBase(html, expected)
    console.log(`base OK: ${expected}`)
  } catch (error) {
    console.error(`base FAILED: ${error.message}`)
    process.exit(1)
  }
}
