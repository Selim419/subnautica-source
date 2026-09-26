import { describe, expect, it } from 'vitest'
import { BIOMES } from './biomes.js'
import { REGIMES } from './regimes.js'
import { wikiEntries } from '../wikiData.js'

const wikiIds = wikiEntries.map((e) => e.id)

describe('biomes', () => {
  it('has exactly six rows', () => {
    expect(BIOMES).toHaveLength(6)
  })

  it('runs contiguously from 0 to 1600', () => {
    expect(BIOMES[0].from).toBe(0)
    expect(BIOMES[5].to).toBe(1600)
    for (let i = 1; i < BIOMES.length; i++) {
      expect(BIOMES[i].from).toBe(BIOMES[i - 1].to)
      expect(BIOMES[i].from).toBeGreaterThan(BIOMES[i - 1].from)
    }
  })

  it('names a regime that exists, in order', () => {
    const ids = REGIMES.map((r) => r.id)
    let last = -1
    for (const b of BIOMES) {
      const i = ids.indexOf(b.regime)
      expect(i).toBeGreaterThan(-1)
      expect(i).toBeGreaterThanOrEqual(last)
      last = i
    }
    expect(BIOMES[4].regime).toBe('biolum')
    expect(BIOMES[5].regime).toBe('biolum')
  })

  it('only links to wiki records that exist', () => {
    for (const b of BIOMES) {
      if (b.wiki === null) continue
      expect(wikiIds).toContain(b.wiki)
    }
    expect(BIOMES.filter((b) => b.wiki === null)).toHaveLength(3)
  })

  it('carries the section chrome fields', () => {
    for (const b of BIOMES) {
      expect(b).toMatchObject({
        n: expect.stringMatching(/^\d{2}$/),
        id: expect.stringMatching(/^[a-z][a-z0-9-]*$/),
        depth: expect.stringMatching(/^\d{3,4}—\d{3,4} M$/),
        index: expect.any(String),
        name: expect.any(String),
        original: expect.any(String),
        line: expect.any(String),
        text: expect.any(String),
        accent: expect.stringMatching(/^var\(--[a-z-]+\)$/),
        glow: expect.stringMatching(/^#[0-9a-f]{6}$/),
      })
      expect(b.text.length).toBeGreaterThan(40)
    }
  })

  it('numbers sections 01 to 06', () => {
    expect(BIOMES.map((b) => b.n)).toEqual(['01', '02', '03', '04', '05', '06'])
  })
})
