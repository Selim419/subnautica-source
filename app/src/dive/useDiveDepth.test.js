import { describe, expect, it } from 'vitest'
import { biomeIndexAt, metresAt, sampleAt } from './useDiveDepth.js'

// Six 133vh-tall sections stacked from 100vh to 900vh.
const makeBoxes = (vh = 800) => {
  const s = vh * 1.3333
  const hero = vh
  return Array.from({ length: 6 }, (_, i) => ({
    top: hero + i * s,
    bottom: hero + (i + 1) * s,
  }))
}

describe('sampleAt', () => {
  it('reports 0 m while still in the hero', () => {
    const boxes = makeBoxes()
    expect(sampleAt(0, boxes)).toEqual({ metres: 0, biomeIndex: 0, regimeIndex: 0 })
    expect(sampleAt(boxes[0].top - 1, boxes).metres).toBe(0)
  })

  it('reads the section whose box contains the reading line', () => {
    const boxes = makeBoxes()
    expect(biomeIndexAt(boxes[3].top + 10, boxes)).toBe(3)
    expect(biomeIndexAt(boxes[5].bottom - 10, boxes)).toBe(5)
  })

  it('clamps past the last section instead of running off', () => {
    const boxes = makeBoxes()
    expect(biomeIndexAt(boxes[5].bottom + 5000, boxes)).toBe(5)
    expect(metresAt(boxes[5].bottom + 5000, boxes)).toBe(1600)
  })

  it('starts each section at its own from-depth and ends at its to-depth', () => {
    const boxes = makeBoxes()
    expect(metresAt(boxes[2].top, boxes)).toBe(200)
    expect(metresAt(boxes[2].bottom, boxes)).toBe(525)
    expect(metresAt(boxes[0].top, boxes)).toBe(0)
  })

  it('is monotonic along a straight scroll down', () => {
    const boxes = makeBoxes()
    let prev = -1
    for (let y = 0; y <= boxes[5].bottom + 100; y += 37) {
      const m = metresAt(y, boxes)
      expect(m).toBeGreaterThanOrEqual(prev)
      prev = m
    }
  })

  it('returns the same value for the same y regardless of direction', () => {
    const boxes = makeBoxes()
    const step = 61
    const last = Math.floor(boxes[5].bottom / step) * step
    const down = []
    for (let y = 0; y <= boxes[5].bottom; y += step) down.push(metresAt(y, boxes))
    const up = []
    for (let y = last; y >= 0; y -= step) up.push(metresAt(y, boxes))
    expect(up.reverse()).toEqual(down)
  })

  it('maps depth to the regime row that owns that depth', () => {
    const boxes = makeBoxes()
    expect(sampleAt(boxes[1].top, boxes).regimeIndex).toBe(1)
    expect(sampleAt(boxes[4].top, boxes).regimeIndex).toBe(4)
    expect(sampleAt(boxes[5].top, boxes).regimeIndex).toBe(4)
  })

  it('is a pure function of y and boxes', () => {
    const boxes = makeBoxes()
    expect(sampleAt(4000, boxes)).toEqual(sampleAt(4000, boxes))
  })
})
