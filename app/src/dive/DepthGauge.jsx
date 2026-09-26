import { useEffect, useRef } from 'react'

const pad = (n) => String(Math.round(n)).padStart(4, '0')

export default function DepthGauge({ frameRef, subscribe }) {
  const numRef = useRef(null)
  const idxRef = useRef(null)
  const barRef = useRef(null)
  const last = useRef({ metres: -1, biomeIndex: -1 })

  useEffect(() => subscribe((f) => {
    if (f.metres !== last.current.metres) {
      last.current.metres = f.metres
      if (numRef.current) numRef.current.textContent = pad(f.metres)
      if (barRef.current) {
        const pct = Math.min(100, (f.metres / 1600) * 100)
        barRef.current.style.transform = `scaleY(${pct / 100})`
      }
    }
    if (f.biomeIndex !== last.current.biomeIndex) {
      last.current.biomeIndex = f.biomeIndex
      if (idxRef.current) idxRef.current.textContent = `0${f.biomeIndex + 1} / 06`
    }
  }), [subscribe])

  return (
    <div className="depth-gauge" aria-hidden="true">
      <span className="gauge-depth"><b ref={numRef}>0000</b> M</span>
      <div className="gauge-rail"><i ref={barRef} /></div>
      <span className="gauge-index" ref={idxRef}>01 / 06</span>
    </div>
  )
}
