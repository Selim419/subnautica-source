import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyBase } from './verify-base.mjs'

const asset = (base) =>
  `<script type="module" crossorigin src="${base}assets/index-abc.js"></script>` +
  `<link rel="stylesheet" crossorigin href="${base}assets/index-abc.css">`

test('accepts a matching root base', () => {
  assert.doesNotThrow(() => verifyBase(asset('/'), '/'))
})

test('accepts a matching subpath base', () => {
  assert.doesNotThrow(() =>
    verifyBase(asset('/subnautica-derinlik-gunlugu/'), '/subnautica-derinlik-gunlugu/')
  )
})

test('rejects a subpath build when root was expected', () => {
  assert.throws(
    () => verifyBase(asset('/subnautica-derinlik-gunlugu/'), '/'),
    /base mismatch/
  )
})

test('rejects a root build when subpath was expected', () => {
  assert.throws(() => verifyBase(asset('/'), '/subnautica-derinlik-gunlugu/'), /base mismatch/)
})

test('rejects a base without a trailing slash', () => {
  assert.throws(() => verifyBase(asset('/subnautica-derinlik-gunlugu'), '/subnautica-derinlik-gunlugu/'), /trailing/)
})

test('rejects html with no asset references at all', () => {
  assert.throws(() => verifyBase('<html><body>nothing here</body></html>', '/'), /no asset/)
})

test('rejects a relative asset reference', () => {
  // A Vite build with base './' is the most common wrong "fix" for the original
  // bug. Normalizing it against a root URL would erase the difference and let
  // it pass the '/' check, so it must be rejected before normalization.
  // '//host/' is the same bypass by another route: it satisfies `startsWith('/')`
  // and normalization discards the host, so it must be rejected too.
  for (const ref of ['./', '../', '//cdn.example.com/']) {
    assert.throws(
      () => verifyBase(asset(ref), '/'),
      /root-absolute/,
      `expected ${ref} to be rejected as not root-absolute`
    )
  }
})

test('rejects a protocol-relative reference that appears after the first', () => {
  // The first reference is well-formed; the bypass is in the second one. If only
  // the first reference were inspected, this would pass.
  const html =
    `<script type="module" crossorigin src="/assets/index-abc.js"></script>` +
    `<link rel="stylesheet" crossorigin href="//cdn.example.com/assets/index-abc.css">`

  assert.throws(() => verifyBase(html, '/'), /root-absolute/)
})

test('rejects a document whose references disagree on the base', () => {
  // Root-correct script, subpath-correct stylesheet. Inspecting only the first
  // reference reported this as a pass for '/', which is exactly the half-blind
  // case this assertion must not have.
  const html =
    `<script type="module" crossorigin src="/assets/index-abc.js"></script>` +
    `<link rel="stylesheet" crossorigin href="/subnautica-derinlik-gunlugu/assets/index-abc.css">`

  assert.throws(() => verifyBase(html, '/'), /base mismatch/)
  assert.throws(
    () => verifyBase(html, '/subnautica-derinlik-gunlugu/'),
    /base mismatch/
  )
})

test('is stable across repeated calls on the same html', () => {
  // Guards the module-level regex against gaining a `g` flag, which would make
  // `exec` stateful via `lastIndex` and make the second call diverge.
  const outcome = (html, expected) => {
    try {
      return `ok:${verifyBase(html, expected)}`
    } catch (error) {
      return `err:${error.message}`
    }
  }

  for (const [html, expected] of [
    [asset('/'), '/'],
    [asset('/subnautica-derinlik-gunlugu/'), '/'],
  ]) {
    const first = outcome(html, expected)
    assert.equal(outcome(html, expected), first)
  }
})
