import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react'
import { TextRoll } from './skiper58.jsx'
import HomeView from './HomeView.jsx'
import WikiView from './WikiView.jsx'
// Cascade order matters: the token and type layers define the custom properties
// the component layers consume, and the component layers are concatenated in
// the order they were written in the old single stylesheet, so no rule changed
// its position relative to another.
import './design/tokens.css'
import './design/type.css'
import './design/layout.css'
import './design/chrome.css'
import './design/hero.css'
import './design/dive.css'
import './design/wiki.css'

function App() {
  const readRoute = () => window.location.hash.startsWith('#/wiki') ? 'wiki' : 'home'
  const [route, setRoute] = useState(readRoute)
  const [menuOpen, setMenuOpen] = useState(false)
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28 })

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute())
      if (readRoute() === 'wiki' || window.location.hash === '#/') window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const goWiki = () => { setMenuOpen(false); window.location.hash = '/wiki'; setRoute('wiki') }
  const goHome = () => { setMenuOpen(false); window.location.hash = '/'; setRoute('home'); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return <>
    <motion.div className="page-progress" style={{ scaleX: progress }} aria-hidden="true" />
    <header className="site-header">
      <button className="logo" onClick={goHome} aria-label="Ana sayfa">SUB<span>NAUTICA</span><i /></button>
      <nav className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Ana menü">
        <button className={route === 'home' ? 'nav-active' : ''} onClick={goHome}><TextRoll>KEŞİF</TextRoll></button>
        <button className={route === 'wiki' ? 'nav-active' : ''} onClick={goWiki}><TextRoll>WIKI / VERİ BANKASI</TextRoll></button>

      </nav>
      <div className="header-right"><span className="signal-dot" /><span>4546B SİNYALİ</span><button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? '×' : '☰'}</button></div>
    </header>
    <AnimatePresence mode="wait">
      {route === 'wiki' ? <motion.div key="wiki" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .28 }}><WikiView /></motion.div>
        : <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .28 }}><HomeView onWiki={goWiki} /></motion.div>}
    </AnimatePresence>
    <footer className="footer"><div className="footer-main"><span className="footer-brand">SUB<span>NAUTICA</span></span><p>Derinlikleri keşfet. Kaydı açık tut.</p><a href="https://unknownworlds.com/en/games" target="_blank" rel="noreferrer">UNKNOWN WORLDS ↗</a></div><div className="footer-bottom"><span>HAYRAN YAPIMI ÖRNEK · RESMÎ SUBNAUTICA SİTESİ DEĞİLDİR.</span><span>OYUN BİLGİLERİ: <a href="https://subnautica.fandom.com/wiki/Subnautica_Wiki" target="_blank" rel="noreferrer">SUBNAUTICA WIKI</a> · GÖRSELLER: ÖZGÜN KONSEPT ÇALIŞMALARI</span><span>ARAYÜZ: <a href="https://skiper-ui.com/v1/skiper58" target="_blank" rel="noreferrer">SKIPER UI</a> · MOTION.DEV · ANIME.JS · THREE.JS</span></div></footer>
  </>
}

createRoot(document.getElementById('root')).render(<App />)


