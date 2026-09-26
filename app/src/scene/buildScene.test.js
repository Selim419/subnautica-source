import { describe, expect, it } from 'vitest'
import water from './shaders/water.js'
import rays from './shaders/rays.js'
import kelp from './shaders/kelp.js'
import particulate from './shaders/particulate.js'
import { buildScene } from './buildScene.js'

const modules = { water, rays, kelp, particulate }

describe('shader modules', () => {
  it.each(Object.keys(modules))('%s exposes a complete material', (name) => {
    const m = modules[name]
    expect(m.uniforms).toBeTypeOf('object')
    expect(m.vertexShader).toMatch(/void\s+main\s*\(/)
    expect(m.fragmentShader).toMatch(/void\s+main\s*\(/)
    expect(Object.keys(m.uniforms)).toContain('uTime')
  })

  it('declares every uniform buildScene drives', () => {
    const required = ['uWater', 'uFog', 'uLight', 'uRays', 'uParticles', 'uBiolum', 'uAccent']
    const all = new Set(Object.values(modules).flatMap((m) => Object.keys(m.uniforms)))
    for (const key of required) expect([...all]).toContain(key)
  })

  it('does not import anything from the outside world', () => {
    expect(Object.values(modules).every((m) => typeof m.uniforms.uTime.value === 'number')).toBe(true)
  })
})

describe('buildScene', () => {
  it('returns the lifecycle surface DiveScroll relies on', () => {
    const api = buildScene({ container: null, forceNoWebGL: true })
    for (const fn of ['setTarget', 'setAccent', 'setProgress', 'render', 'resize', 'dispose']) {
      expect(api[fn]).toBeTypeOf('function')
    }
    api.dispose()
  })

  it('tolerates a null container so the fallback path is testable', () => {
    const api = buildScene({ container: null, forceNoWebGL: true })
    expect(() => { api.resize(100, 100); api.render(0); api.dispose() }).not.toThrow()
  })
})
