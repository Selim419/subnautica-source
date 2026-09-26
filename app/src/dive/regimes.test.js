import { describe, expect, it } from 'vitest'
import { REGIMES, regimeAt } from './regimes.js'

describe('regimes', () => {
  it('has exactly five rows', () => {
    expect(REGIMES).toHaveLength(5)
  })

  it('covers 0 to infinity with no gaps and no overlaps', () => {
    expect(REGIMES[0].from).toBe(0)
    for (let i = 1; i < REGIMES.length; i++) {
      expect(REGIMES[i].from).toBe(REGIMES[i - 1].to)
    }
    expect(REGIMES[4].to).toBe(Infinity)
  })

  it.each([[0, 0], [79, 0], [80, 1], [199, 1], [200, 2], [524, 2],
    [525, 3], [1064, 3], [1065, 4], [1400, 4], [1e9, 4]])(
    'regimeAt(%i) === %i', (metres, expected) => {
      expect(regimeAt(metres)).toBe(expected)
    })

  it('clamps below zero to the first regime', () => {
    expect(regimeAt(-50)).toBe(0)
  })

  it('carries every atmosphere field the scene consumes', () => {
    for (const r of REGIMES) {
      expect(r).toMatchObject({
        id: expect.any(String),
        water: expect.stringMatching(/^#[0-9a-f]{6}$/),
        fog: expect.any(Number),
        light: expect.any(Number),
        lightColor: expect.stringMatching(/^#[0-9a-f]{6}$/),
        rays: expect.any(Number),
        particles: expect.any(Number),
        biolum: expect.any(Number),
        accent: expect.stringMatching(/^#[0-9a-f]{6}$/),
      })
    }
  })
})
