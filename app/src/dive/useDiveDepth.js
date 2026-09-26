import { useCallback, useEffect, useRef, useState } from 'react'
import { BIOMES } from './biomes.js'
import { REGIMES, regimeAt } from './regimes.js'

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v }

export function biomeIndexAt(y, boxes) {
  if (!boxes.length) return 0
  if (y < boxes[0].top) return 0
  for (let i = boxes.length - 1; i >= 0; i--) {
    if (y >= boxes[i].top) return i
  }
  return 0
}

export function metresAt(y, boxes) {
  if (!boxes.length) return 0
  if (y < boxes[0].top) return 0
  const i = biomeIndexAt(y, boxes)
  const box = boxes[i]
  const local = clamp01((y - box.top) / Math.max(1, box.bottom - box.top))
  const b = BIOMES[i]
  return b.from + (b.to - b.from) * local
}

export function sampleAt(y, boxes) {
  const metres = metresAt(y, boxes)
  return { metres, biomeIndex: biomeIndexAt(y, boxes), regimeIndex: regimeAt(metres) }
}

const READING_LINE = 0.5

function readBoxes(elements) {
  return elements.filter(Boolean).map((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom }
  })
}

export function useDiveDepth(sectionRefs) {
  const frameRef = useRef({ y: 0, metres: 0, biomeIndex: 0, regimeIndex: 0 })
  const listeners = useRef(new Set())
  const [regimeIndex, setRegimeIndex] = useState(0)

  const sample = useCallback(() => {
    const boxes = readBoxes(sectionRefs.current)
    if (!boxes.length) return
    const y = window.innerHeight * READING_LINE
    const next = sampleAt(y, boxes)
    const f = frameRef.current
    f.y = y
    f.metres = next.metres
    f.biomeIndex = next.biomeIndex
    if (next.regimeIndex !== f.regimeIndex) {
      f.regimeIndex = next.regimeIndex
      setRegimeIndex(next.regimeIndex)
    }
    listeners.current.forEach((fn) => fn(f))
  }, [sectionRefs])

  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; sample() })
    }
    sample()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [sample])

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn)
    fn(frameRef.current)
    return () => listeners.current.delete(fn)
  }, [])

  return { frameRef, regimeIndex, subscribe }
}
