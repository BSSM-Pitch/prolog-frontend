import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PAPER_RATIO, paperRatio, ratioAtPointer } from '../src/features/manuscripts/editorLayoutModel.ts'
test('editor split bounds invalid preferences and pointer drags outside the paper', () => {
  assert.equal(paperRatio(NaN), DEFAULT_PAPER_RATIO)
  assert.equal(paperRatio(-100), 40)
  assert.equal(paperRatio(300), 75)
  assert.equal(ratioAtPointer(500, 100, 800), 50)
  assert.equal(ratioAtPointer(-50, 100, 1200), 40)
  assert.equal(ratioAtPointer(2000, 100, 1200), 75)
  assert.equal(ratioAtPointer(500, 100, 0), DEFAULT_PAPER_RATIO)
})

test('narrow desktop layouts preserve usable widths on both sides', () => {
  const available = 800 - 40
  assert.ok(available * paperRatio(0, 800) / 100 >= 319.99)
  assert.ok(available * (1 - paperRatio(100, 800) / 100) >= 259.99)
})
