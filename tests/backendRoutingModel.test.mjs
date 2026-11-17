import test from 'node:test'
import assert from 'node:assert/strict'
import { isBackendRoute } from '../src/api/config.ts'

test('durable manuscript reviews and polling reach the real backend rather than mock fallback', () => {
  const p = '/projects/80388efe-ffed-4551-8647-9b6a02ef0781'
  const id = '70156502-b208-4f96-88e5-939c45e378c2'
  assert.equal(isBackendRoute('POST', `${p}/manuscripts/${id}/narrative-reviews`), true)
  assert.equal(isBackendRoute('GET', `${p}/manuscripts/${id}/narrative-reviews/latest`), true)
  assert.equal(isBackendRoute('GET', `${p}/conflict-checks/${id}`), true)
  assert.equal(isBackendRoute('DELETE', `${p}/manuscripts/${id}/narrative-reviews`), false)
  assert.equal(isBackendRoute('GET', `${p}/unimplemented-route`), false)
})
