import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useDiveDepth } from './useDiveDepth.js'
import { BIOMES } from './biomes.js'
import DepthGauge from './DepthGauge.jsx'

// three is a heavy dependency; keep it out of the main chunk. OceanCanvas
// (and everything it imports: buildScene, the shader modules, three itself)
// only loads once this component actually mounts it.
const OceanCanvas = lazy(() => import('../scene/OceanCanvas.jsx'))

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function DiveScroll({ hero }) {
  const sectionsRef = useRef([])
  const rootRef = useRef(null)
  const [visible, setVisible] = useState(true)
  const [isReduced] = useState(reduced)
  const { frameRef, regimeIndex, subscribe } = useDiveDepth(sectionsRef)

  useEffect(() => {
    if (!rootRef.current) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '10% 0px' })
    io.observe(rootRef.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    window.__diveProbe = () => [...new Set(BIOMES.map((b, i) => i))]
    return () => { delete window.__diveProbe }
  }, [])

  return (
    <div className="dive-scroll" ref={rootRef}>
      {!isReduced && (
        <Suspense fallback={null}>
          <OceanCanvas frameRef={frameRef} regimeIndex={regimeIndex} visible={visible} />
        </Suspense>
      )}
      {!isReduced && <DepthGauge frameRef={frameRef} subscribe={subscribe} />}
      {hero}
      {BIOMES.map((b, i) => (
        <section
          key={b.id}
          id={i === 0 ? 'dalis' : undefined}
          className="dive-section"
          ref={(el) => { sectionsRef.current[i] = el }}
          style={{ '--zone-accent': b.accent }}
          aria-labelledby={`dive-${b.id}`}
        >
          <div className="dive-scrim" aria-hidden="true" />
          <div className="dive-section-inner" data-contrast>
            <span className="section-kicker">{b.original}</span>
            <p className="dive-num" aria-hidden="true">{b.n}</p>
            <h2 id={`dive-${b.id}`} className="dive-title">{b.name}</h2>
            <p className="dive-line">{b.line}</p>
            <p className="dive-body">{b.text}</p>
            <div className="dive-meta">
              <span>DERİNLİK {b.depth}</span>
              <span>{b.index}</span>
            </div>
            {b.wiki && (
              <button
                type="button"
                className="card-link"
                onClick={() => { window.location.hash = `/wiki/${b.wiki}` }}
              >
                KAYDI İNCELE <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
