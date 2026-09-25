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
    /base/
  )
})

test('rejects a root build when subpath was expected', () => {
  assert.throws(() => verifyBase(asset('/'), '/subnautica-derinlik-gunlugu/'), /base/)
})

test('rejects a base without a trailing slash', () => {
  assert.throws(() => verifyBase(asset('/subnautica-derinlik-gunlugu'), '/subnautica-derinlik-gunlugu/'), /trailing/)
})

test('rejects html with no asset references at all', () => {
  assert.throws(() => verifyBase('<html><body>nothing here</body></html>', '/'), /no asset/)
})
