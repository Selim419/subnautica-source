import * as THREE from 'three'
import water from './shaders/water.js'
import rays from './shaders/rays.js'
import kelp from './shaders/kelp.js'
import particulate from './shaders/particulate.js'
import { REGIMES } from '../dive/regimes.js'

const LERP_MS = 600
const COLOR_UNIFORMS = new Set(['uWater', 'uLightColor', 'uAccent'])
const materialOf = (def) => {
  const uniforms = THREE.UniformsUtils.clone(def.uniforms)
  // Shader modules declare color defaults as hex strings (so they stay
  // dependency-free per Task 5's constraint). UniformsUtils.clone() only
  // deep-clones recognized three.js objects (Color, Vector, etc.) and copies
  // everything else by reference, so a string default is still a string
  // here. buildScene's lerp path calls .lerpColors()/.clone() on these
  // uniforms every regime change, which requires real THREE.Color instances.
  for (const key of COLOR_UNIFORMS) {
    const u = uniforms[key]
    if (u && typeof u.value === 'string') u.value = new THREE.Color(u.value)
  }
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: def.vertexShader,
    fragmentShader: def.fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

function hexToV3(hex) { return new THREE.Color(hex) }

export function buildScene({ container, forceNoWebGL = false, preserve = false } = {}) {
  if (!container || forceNoWebGL) {
    return {
      setTarget() {}, setAccent() {}, setProgress() {},
      render() {}, resize() {}, dispose() {},
      supported: false,
    }
  }

  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: preserve })
  } catch (err) {
    console.warn('[ocean] WebGL unavailable, using the CSS gradient', err)
    return {
      setTarget() {}, setAccent() {}, setProgress() {},
      render() {}, resize() {}, dispose() {},
      supported: false,
    }
  }

  const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.5)
  renderer.setPixelRatio(dpr)
  renderer.domElement.dataset.ocean = ''
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60)
  camera.position.set(0, 0, 6)

  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(60, 34), materialOf(water))
  backdrop.position.z = -8
  scene.add(backdrop)

  const godRays = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), materialOf(rays))
  godRays.position.z = -5
  scene.add(godRays)

  const kelpMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.28, 7, 1, 12),
    materialOf(kelp),
    46,
  )
  const phases = new Float32Array(46)
  for (let i = 0; i < 46; i++) {
    const m = new THREE.Matrix4()
    m.setPosition((Math.random() - 0.5) * 22, -4.5, -2.5 - Math.random() * 4)
    kelpMesh.setMatrixAt(i, m)
    phases[i] = Math.random() * Math.PI * 2
  }
  kelpMesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1))
  scene.add(kelpMesh)

  const count = window.innerWidth < 700 ? 140 : 380
  const pos = new Float32Array(count * 3)
  const size = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 14
    pos[i * 3 + 1] = (Math.random() - 0.5) * 12
    pos[i * 3 + 2] = (Math.random() - 0.5) * 12
    size[i] = 1.5 + Math.random() * 3.5
  }
  const pGeo = new THREE.BufferGeometry()
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  const points = new THREE.Points(pGeo, materialOf(particulate))
  scene.add(points)

  const materials = [backdrop.material, godRays.material, kelpMesh.material, points.material]
  const current = {}
  const target = {}
  let from = null
  let startedAt = 0

  function applyMix(mix) {
    for (const mat of materials) {
      const u = mat.uniforms
      if (u.uWater) u.uWater.value.lerpColors(from.water, target.water, mix)
      if (u.uLightColor) u.uLightColor.value.lerpColors(from.lightColor, target.lightColor, mix)
      if (u.uFog) u.uFog.value = THREE.MathUtils.lerp(from.fog, target.fog, mix)
      if (u.uLight) u.uLight.value = THREE.MathUtils.lerp(from.light, target.light, mix)
      if (u.uRays) u.uRays.value = THREE.MathUtils.lerp(from.rays, target.rays, mix)
      if (u.uParticles) u.uParticles.value = THREE.MathUtils.lerp(from.particles, target.particles, mix)
      if (u.uBiolum) u.uBiolum.value = THREE.MathUtils.lerp(from.biolum, target.biolum, mix)
      if (u.uAccent) u.uAccent.value.lerpColors(from.accent, target.accent, mix)
    }
  }

  function readCurrent() {
    const u = backdrop.material.uniforms
    return {
      water: u.uWater.value.clone(),
      lightColor: u.uLightColor.value.clone(),
      fog: u.uFog.value,
      light: u.uLight.value,
      rays: u.uRays.value,
      particles: u.uParticles.value,
      biolum: u.uBiolum.value,
      accent: u.uAccent.value.clone(),
    }
  }

  function setTarget(atmo) {
    from = readCurrent()
    target.water = hexToV3(atmo.water)
    target.lightColor = hexToV3(atmo.lightColor)
    target.fog = atmo.fog
    target.light = atmo.light
    target.rays = atmo.rays
    target.particles = atmo.particles
    target.biolum = atmo.biolum
    target.accent = hexToV3(atmo.accent)
    startedAt = performance.now()
    current.atmo = atmo
  }

  function setAccent(hex) {
    const c = hexToV3(hex)
    for (const mat of materials) if (mat.uniforms.uAccent) mat.uniforms.uAccent.value.copy(c)
  }

  function setProgress() { /* depth is read by setTarget only; kept for the interface */ }

  function render(timeMs) {
    const t = timeMs * 0.001
    if (from && target.water) {
      const k = Math.min(1, (performance.now() - startedAt) / LERP_MS)
      applyMix(k)
      if (k === 1) { from = null; current.atmo = null }
    }
    for (const mat of materials) if (mat.uniforms.uTime) mat.uniforms.uTime.value = t
    renderer.render(scene, camera)
  }

  function resize(w, h) {
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(1, h)
    camera.updateProjectionMatrix()
  }

  function dispose() {
    for (const mat of materials) mat.dispose()
    backdrop.geometry.dispose()
    godRays.geometry.dispose()
    kelpMesh.geometry.dispose()
    pGeo.dispose()
    renderer.dispose()
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
  }

  setTarget(REGIMES[0])
  applyMix(1)
  from = null

  return { setTarget, setAccent, setProgress, render, resize, dispose, supported: true }
}
