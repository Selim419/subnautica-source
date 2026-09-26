import { useEffect, useRef } from 'react'
import { animate, stagger } from 'animejs'
import { motion, useScroll, useTransform } from 'motion/react'
import DiveScroll from './dive/DiveScroll.jsx'

const asset = (name) => `${import.meta.env.BASE_URL}${name}`
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Hero({ onWiki }) {
  const ref = useRef(null)
  const titleRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const textY = useTransform(scrollYProgress, [0, 1], [0, 150])
  const textOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  useEffect(() => {
    if (reduced() || !titleRef.current) return
    const words = titleRef.current.querySelectorAll('.hero-word')
    const a = animate(words, { opacity: [0, 1], translateY: [64, 0], delay: stagger(170, { start: 150 }), duration: 1150, ease: 'out(4)' })
    const b = animate('.hero-meta > *', { opacity: [0, 1], translateY: [20, 0], delay: stagger(90, { start: 800 }), duration: 760, ease: 'out(3)' })
    return () => { a.pause(); b.pause() }
  }, [])

  return (
    <section className="hero" ref={ref} aria-labelledby="hero-title">
      <div className="hero-vignette" aria-hidden="true" />
      <motion.div className="hero-inner" style={{ y: textY, opacity: textOpacity }}>
        <div className="hero-meta">
          <span className="micro-label"><b className="live-dot" /> GEZEGEN 4546B / GELEN SİNYAL</span>
          <span className="hero-coord">KOORDİNATLAR 000.01° N / 4546B</span>
        </div>
        <h1 id="hero-title" ref={titleRef}>
          <span className="hero-word">DÜNYANIN</span>
          <span className="hero-word outline">BİTTİĞİ</span>
          <span className="hero-word aqua">YERİN ALTINDA.</span>
        </h1>
        <div className="hero-bottom">
          <p>Bir yabancı gezegende, hayatta kalmanın tek yolu daha derine inmek. Okyanusu keşfet. İzleri takip et. Bilinmeyeni kayda geçir.</p>
          <div className="hero-actions">
            <a className="button-primary" href="#dalis">DALIŞA BAŞLA <span aria-hidden="true">↘</span></a>
            <button className="button-ghost" onClick={onWiki}>VERİ BANKASINI AÇ <span aria-hidden="true">↗</span></button>
          </div>
        </div>
      </motion.div>
      <div className="scroll-cue" aria-hidden="true"><span>KAYDIR</span><div /></div>
    </section>
  )
}

export default function HomeView({ onWiki }) {
  return (
    <>
      <DiveScroll hero={<Hero onWiki={onWiki} />} />
      <section className="manifesto"><div className="manifesto-top"><span className="section-kicker">BİR GEZEGEN / SONSUZ BİLİNMEYEN</span><span>4546B — SAHA NOTU 001</span></div><div className="manifesto-grid"><h2>HER<br />DERİNLİK<br /><em>BAŞKA BİR DÜNYA.</em></h2><div><p>Subnautica, Unknown Worlds tarafından geliştirilen su altı açık dünya macerası. Buradaki keşif günlüğü, oyunun biyomlarını, canlılarını ve araçlarını spoiler kontrolüyle incelemek için hazırlanmış hayran yapımı bir alan.</p><button className="underlined" onClick={onWiki}>WIKI’Yİ KEŞFET <span>↗</span></button></div></div></section>
      <section className="final-cta"><div className="final-image" style={{ backgroundImage: `url(${asset('lost-river.webp')})` }} /><div className="final-shade" /><div className="final-content"><span className="section-kicker">KAYITLAR HAZIR</span><h2>BİLİNMEYENE<br /><em>BAK.</em></h2><p>Biyomlar, canlılar ve araçlar. Sonraki dalışın için veri bankasını aç.</p><button className="button-primary" onClick={onWiki}>VERİ BANKASINI AÇ <span>↗</span></button></div></section>
    </>
  )
}
