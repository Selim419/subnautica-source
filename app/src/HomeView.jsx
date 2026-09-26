import React, { Suspense, useEffect, useRef, useState } from 'react'
import { animate, stagger } from 'animejs'
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react'
const OceanScene = React.lazy(() => import('./OceanScene.jsx'))

const asset = (name) => `${import.meta.env.BASE_URL}${name}`
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// The three depth zones. `accent` is a token reference, not a colour: it is set
// inline as --zone-accent on .dive-card, so it resolves against the cascade the
// same way any other var() in dive.css does. Zones 01 and 02 were re-deriving
// hues the palette already owns — the surface zone sat on top of --glow and the
// twilight zone on top of --kelp — so they point straight at them. Zone 03's
// pale blue was the one genuinely new hue, and it is --bathyal in layer 1 now.
// The three stay clearly distinct: a mint, a yellow-green and a cold blue,
// which is what makes the scan ring, the kicker, the link and the depth bar
// readable as a depth indicator rather than as three tints of one.
const diveZones = [
  { number: '01', name: 'Sığ Resifler', original: 'SAFE SHALLOWS', depth: '000—080 M', index: 'YÜZEY', line: 'Işığın her şeyi gösterdiği yer.', description: 'Kurtarma kapsülünden ilk kez ayrıl. Mercanların arasında yönünü bul ve okyanusun sesine alış.', image: 'ocean-hero.webp', accent: 'var(--glow)', wiki: 'safe-shallows' },
  { number: '02', name: 'Yosun Ormanı', original: 'KELP FOREST', depth: '080—200 M', index: 'ALACAKARANLIK', line: 'Görüş azalır. Merak artar.', description: 'Creepvine gövdeleri akıntıyla birlikte hareket eder. Her gölge, yeni bir yaşam izi olabilir.', image: 'kelp-forest.webp', accent: 'var(--kelp)', wiki: 'kelp-forest' },
  { number: '03', name: 'Kayıp Nehir', original: 'LOST RIVER', depth: '525—1065 M', index: 'DERİNLİK', line: 'Bazı yollar yalnızca aşağı iner.', description: 'Fosillerin ve tuzlu akıntıların içinden geç. Burada ışığın yerini bilinmeyen alır.', image: 'lost-river.webp', accent: 'var(--bathyal)', wiki: 'lost-river' },
]

function Hero({ onWiki }) {
  const ref = useRef(null)
  const titleRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '22%'])
  const textY = useTransform(scrollYProgress, [0, 1], [0, 150])
  const textOpacity = useTransform(scrollYProgress, [0, .8], [1, 0])

  useEffect(() => {
    if (reduced() || !titleRef.current) return
    const words = titleRef.current.querySelectorAll('.hero-word')
    const a = animate(words, { opacity: [0, 1], translateY: [64, 0], delay: stagger(170, { start: 150 }), duration: 1150, ease: 'out(4)' })
    const b = animate('.hero-meta > *', { opacity: [0, 1], translateY: [20, 0], delay: stagger(90, { start: 800 }), duration: 760, ease: 'out(3)' })
    return () => { a.pause(); b.pause() }
  }, [])

  return <section className="hero" ref={ref} aria-labelledby="hero-title">
    <motion.div className="hero-image" style={{ y: bgY, backgroundImage: `url(${asset('ocean-hero.webp')})` }} />
    <Suspense fallback={null}><OceanScene /></Suspense>
    <div className="hero-vignette" />
    <div className="hero-rail"><span>01 / 03</span><div className="rail-line"><i /></div><span>DERİNLİK 000 M</span></div>
    <motion.div className="hero-inner" style={{ y: textY, opacity: textOpacity }}>
      <div className="hero-meta"><span className="micro-label"><b className="live-dot" /> GEZEGEN 4546B / GELEN SİNYAL</span><span className="hero-coord">KOORDİNATLAR 000.01° N / 4546B</span></div>
      <h1 id="hero-title" ref={titleRef}><span className="hero-word">DÜNYANIN</span><span className="hero-word outline">BİTTİĞİ</span><span className="hero-word aqua">YERİN ALTINDA.</span></h1>
      <div className="hero-bottom"><p>Bir yabancı gezegende, hayatta kalmanın tek yolu daha derine inmek. Okyanusu keşfet. İzleri takip et. Bilinmeyeni kayda geçir.</p><div className="hero-actions"><a className="button-primary" href="#dalis">DALIŞA BAŞLA <span>↘</span></a><button className="button-ghost" onClick={onWiki}>VERİ BANKASINI AÇ <span>↗</span></button></div></div>
    </motion.div>
    <div className="scroll-cue"><span>KAYDIR</span><div /></div>
  </section>
}

function DiveSection() {
  const [selected, setSelected] = useState(0)
  const zone = diveZones[selected]
  const pulseRef = useRef(null)
  useEffect(() => {
    if (reduced() || !pulseRef.current) return
    const a = animate(pulseRef.current, { scale: [.7, 1.65], opacity: [.75, 0], duration: 1100, ease: 'out(3)' })
    return () => a.pause()
  }, [selected])

  return <section className="dive" id="dalis" aria-labelledby="dive-title">
    <div className="section-heading"><div><span className="section-kicker">İNİŞ PROTOKOLÜ / 03 DURAK</span><h2 id="dive-title">OKYANUSUN<br /><em>KATMANLARI</em></h2></div><p>Her katman, farklı bir ritim ve farklı bir tehlike. Bir bölge seçerek keşif kaydını aç.</p></div>
    <div className="dive-layout">
      <div className="dive-list" role="group" aria-label="Biyom seçimi">{diveZones.map((item, i) => <button type="button" key={item.number} className={`dive-tab ${selected === i ? 'active' : ''}`} onClick={() => setSelected(i)} aria-pressed={selected === i}><span className="dive-num">{item.number}</span><span><b>{item.name}</b><small>{item.original}</small></span><span className="tab-depth">{item.depth}</span><span className="dive-tab-arrow">↗</span></button>)}</div>
      <div className="dive-card" style={{ '--zone-accent': zone.accent }}>
        <AnimatePresence mode="wait"><motion.div key={zone.number} className="dive-image" style={{ backgroundImage: `url(${asset(zone.image)})` }} initial={{ opacity: 0, scale: 1.12 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: .7, ease: [.2, .75, .2, 1] }} /></AnimatePresence>
        <div className="dive-overlay" /><div className="scan-ring" ref={pulseRef} aria-hidden="true" />
        <div className="dive-card-head"><span>SEKTÖR {zone.number} / {zone.index}</span><span>DERİNLİK {zone.depth}</span></div>
        <AnimatePresence mode="wait"><motion.div key={zone.number} className="dive-card-body" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: .43 }}><span className="section-kicker">{zone.original}</span><h3>{zone.line}</h3><p>{zone.description}</p><button onClick={() => { window.location.hash = `/wiki/${zone.wiki}` }} className="card-link">KAYDI İNCELE <span>↗</span></button></motion.div></AnimatePresence>
        <div className="dive-card-foot"><span>O₂ / STABİL</span><div><i style={{ width: `${(selected + 1) * 33.33}%` }} /></div><span>0{selected + 1} / 03</span></div>
      </div>
    </div>
  </section>
}

export default function HomeView({ onWiki }) {
  return <main>
    <Hero onWiki={onWiki} />
    <div className="ticker" aria-hidden="true"><div>KEŞFET <span>✳</span> TARA <span>✳</span> HAYATTA KAL <span>✳</span> DAHA DERİNE İN <span>✳</span> KEŞFET <span>✳</span> TARA <span>✳</span> HAYATTA KAL <span>✳</span> DAHA DERİNE İN <span>✳</span></div></div>
    <DiveSection />
    <section className="manifesto"><div className="manifesto-top"><span className="section-kicker">BİR GEZEGEN / SONSUZ BİLİNMEYEN</span><span>4546B — SAHA NOTU 001</span></div><div className="manifesto-grid"><h2>HER<br />DERİNLİK<br /><em>BAŞKA BİR DÜNYA.</em></h2><div><p>Subnautica, Unknown Worlds tarafından geliştirilen su altı açık dünya macerası. Buradaki keşif günlüğü, oyunun biyomlarını, canlılarını ve araçlarını spoiler kontrolüyle incelemek için hazırlanmış hayran yapımı bir alan.</p><button className="underlined" onClick={onWiki}>WIKI’Yİ KEŞFET <span>↗</span></button></div></div></section>
    <section className="final-cta"><div className="final-image" style={{ backgroundImage: `url(${asset('lost-river.webp')})` }} /><div className="final-shade" /><div className="final-content"><span className="section-kicker">KAYITLAR HAZIR</span><h2>BİLİNMEYENE<br /><em>BAK.</em></h2><p>Biyomlar, canlılar ve araçlar. Sonraki dalışın için veri bankasını aç.</p><button className="button-primary" onClick={onWiki}>VERİ BANKASINI AÇ <span>↗</span></button></div></section>
  </main>
}
