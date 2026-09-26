import { useEffect, useRef } from 'react'
import { buildScene } from './buildScene.js'
import { REGIMES } from '../dive/regimes.js'

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function OceanCanvas({ frameRef, regimeIndex, visible }) {
  const holderRef = useRef(null)
  const apiRef = useRef(null)
  const regimeRef = useRef(regimeIndex)
  const visibleRef = useRef(visible)
  const lastRef = useRef({ metres: -1 })

  useEffect(() => { visibleRef.current = visible }, [visible])

  useEffect(() => {
    if (reduced() || !holderRef.current) return
    const preserve = new URLSearchParams(window.location.search).has('preserve')
    const api = buildScene({ container: holderRef.current, preserve })
    if (!api.supported) return
    apiRef.current = api

    const box = () => {
      const r = holderRef.current.getBoundingClientRect()
      api.resize(r.width, r.height)
    }
    const ro = new ResizeObserver(box)
    ro.observe(holderRef.current)
    box()

    let raf = 0
    const loop = (t) => {
      raf = requestAnimationFrame(loop)
      if (!visibleRef.current || document.hidden) return
      const f = frameRef.current
      if (f.regimeIndex !== regimeRef.current) {
        regimeRef.current = f.regimeIndex
        api.setTarget(REGIMES[f.regimeIndex])
      }
      if (f.metres !== lastRef.current.metres) {
        lastRef.current.metres = f.metres
        api.setProgress(f.metres)
      }
      api.render(t)
    }
    raf = requestAnimationFrame(loop)

    const onVis = () => { /* visibility is polled in the loop */ }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      api.dispose()
      apiRef.current = null
    }
  }, [frameRef])

  useEffect(() => {
    if (apiRef.current && regimeIndex !== regimeRef.current) {
      regimeRef.current = regimeIndex
      apiRef.current.setTarget(REGIMES[regimeIndex])
    }
  }, [regimeIndex])

  return <div ref={holderRef} className="ocean-canvas" aria-hidden="true" />
}
