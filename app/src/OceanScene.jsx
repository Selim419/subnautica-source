import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function OceanScene() {
  const containerRef = useRef(null)

  useEffect(() => {
    const holder = containerRef.current
    if (!holder || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' })
    } catch {
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setClearColor(0x000000, 0)
    holder.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, .1, 40)
    camera.position.z = 9
    const mobile = window.innerWidth < 700
    const count = mobile ? 180 : 440
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    let seed = 4546
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() - .5) * 21
      positions[i * 3 + 1] = (rand() - .5) * 12
      positions[i * 3 + 2] = (rand() - .5) * 12
      sizes[i] = 1.5 + rand() * 3.5
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `attribute float aSize; uniform float uTime; varying float vFade;
        void main(){ vec3 p=position; p.y += sin(uTime*.34+p.x*.7)*.12; p.x += cos(uTime*.2+p.y)*.08;
          vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv;
          gl_PointSize=aSize*(18.0/-mv.z); vFade=clamp((p.z+6.0)/12.0,.35,1.0); }`,
      fragmentShader: `varying float vFade; void main(){ float d=length(gl_PointCoord-vec2(.5));
        float a=smoothstep(.5,.05,d)*.52*vFade; gl_FragColor=vec4(.35,.93,.92,a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const particles = new THREE.Points(geometry, material)
    scene.add(particles)

    let raf = 0
    let visible = true
    let mouseX = 0
    let mouseY = 0
    const onPointer = (event) => {
      mouseX = (event.clientX / window.innerWidth - .5) * .45
      mouseY = (event.clientY / window.innerHeight - .5) * .28
    }
    const resize = () => {
      const { width, height } = holder.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const render = (time) => {
      if (!visible || document.hidden) { raf = 0; return }
      material.uniforms.uTime.value = time * .001
      camera.position.x += (mouseX - camera.position.x) * .025
      camera.position.y += (-mouseY - camera.position.y) * .025
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(render)
    }
    const resume = () => { if (visible && !document.hidden && !raf) raf = requestAnimationFrame(render) }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) resume() })
    observer.observe(holder)
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(holder)
    window.addEventListener('pointermove', onPointer, { passive: true })
    document.addEventListener('visibilitychange', resume)
    resize()
    resume()

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', resume)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div className="ocean-canvas" ref={containerRef} aria-hidden="true" />
}
