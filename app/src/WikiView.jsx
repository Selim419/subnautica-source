import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
const OceanScene = React.lazy(() => import('./OceanScene.jsx'))
import { categories, wikiEntries } from './wikiData.js'

const asset = (name) => `${import.meta.env.BASE_URL}${name}`

export default function WikiView() {
  const [category, setCategory] = useState('Tümü')
  const [query, setQuery] = useState('')
  const [showSpoilers, setShowSpoilers] = useState(false)
  const [active, setActive] = useState(() => {
    const id = window.location.hash.match(/^#\/wiki\/(.+)$/)?.[1]
    return wikiEntries.find((item) => item.id === id) || null
  })
  const closeRef = useRef(null)
  const sourceRef = useRef(null)
  const previousFocus = useRef(null)

  const closeRecord = () => {
    setActive(null)
    if (window.location.hash.startsWith('#/wiki/')) window.history.replaceState(null, '', '#/wiki')
  }

  const filtered = useMemo(() => wikiEntries.filter((item) => {
    const matchesCategory = category === 'Tümü' || item.category === category
    const q = query.trim().toLocaleLowerCase('tr')
    const matchesQuery = !q || `${item.name} ${item.original} ${item.lead} ${item.category}`.toLocaleLowerCase('tr').includes(q)
    return matchesCategory && matchesQuery
  }), [category, query])

  useEffect(() => {
    if (!active) return
    previousFocus.current = document.activeElement
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') closeRecord()
      if (event.key === 'Tab') {
        const first = closeRef.current
        const last = sourceRef.current || first
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); previousFocus.current?.focus?.() }
  }, [active])

  return <main className="wiki-page">
    <section className="wiki-hero"><Suspense fallback={null}><OceanScene /></Suspense><div className="wiki-hero-image" style={{ backgroundImage: `url(${asset('kelp-forest.webp')})` }} /><div className="wiki-hero-shade" /><div className="wiki-hero-inner"><span className="section-kicker">4546B / PDA VERİ BANKASI</span><h1>OKYANUSUN<br /><em>ARŞİVİ.</em></h1><p>Orijinal Subnautica’nın biyomları, canlıları ve araçları için kısa bir saha rehberi. Aradığın kaydı seç; ayrıntıları ve kaynağını aç.</p><div className="wiki-hero-count"><b>{String(wikiEntries.length).padStart(2, '0')}</b><span>KATALOG<br />KAYDI</span></div></div></section>
    <section className="database" aria-labelledby="database-title"><div className="database-heading"><div><span className="section-kicker">PDA / KAYIT ARAMA</span><h2 id="database-title">VERİ BANKASI</h2></div><span className="database-count">{filtered.length} / {wikiEntries.length} KAYIT GÖSTERİLİYOR</span></div>
      <div className="database-tools"><label className="searchbox"><span aria-hidden="true">⌕</span><span className="sr-only">Kayıtlarda ara</span><input type="search" placeholder="Biyom, canlı veya araç ara..." value={query} onChange={(e) => setQuery(e.target.value)} /></label><div className="filters" role="group" aria-label="Kayıt kategorisi">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}</div></div>
      <div className="database-subbar"><label className="spoiler-control"><input type="checkbox" checked={showSpoilers} onChange={(e) => setShowSpoilers(e.target.checked)} /><span className="switch-track" /><span>İleri bölge spoilerlarını göster</span></label><span>SAHA NOTLARI / OYUN İÇİ KAYITLARIN ÖZETİ</span></div>
      {filtered.length ? <motion.div className="wiki-grid" layout>{filtered.map((item, i) => <motion.button type="button" layout key={item.id} className={`wiki-card ${item.spoiler && !showSpoilers ? 'spoiler-card' : ''}`} onClick={() => setActive(item)} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ delay: Math.min(i * .035, .28), duration: .45 }} whileHover={{ y: -6 }} aria-label={item.spoiler && !showSpoilers ? 'Gizli kaydı aç' : `${item.name} kaydını aç`}><div className={`wiki-card-art ${item.image && !(item.spoiler && !showSpoilers) ? '' : 'no-image'}`} style={item.image && !(item.spoiler && !showSpoilers) ? { backgroundImage: `linear-gradient(0deg,rgba(4,20,27,.35),rgba(4,20,27,.05)),url(${asset(item.image)})` } : undefined}>{( !item.image || (item.spoiler && !showSpoilers) ) && <span className="art-symbol">{item.category === 'Canlı' ? '◈' : '⌁'}</span>}<span className="art-crosshair">＋</span></div><div className="wiki-card-info"><span className="wiki-card-type">{item.category.toUpperCase()} <i /> {item.spoiler && !showSpoilers ? 'GİZLİ' : item.depth}</span><h3>{item.spoiler && !showSpoilers ? 'GİZLİ KAYIT' : item.name}</h3><p>{item.spoiler && !showSpoilers ? 'İleri bölge. Ayrıntıları açmak için kaydı seç.' : item.lead}</p><div className="wiki-card-foot"><span>KAYDI AÇ</span><span>↗</span></div></div></motion.button>)}</motion.div> : <div className="empty-state"><strong>Kayıt bulunamadı.</strong><p>Başka bir arama veya kategori dene.</p><button onClick={() => { setQuery(''); setCategory('Tümü') }}>FİLTRELERİ TEMİZLE ↗</button></div>}
    </section>
    <AnimatePresence>{active && <motion.div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeRecord() }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div role="dialog" aria-modal="true" aria-labelledby="record-title" className="record-panel" initial={{ x: 80, opacity: .7 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 28 }}><div className="record-top"><span>PDA / {active.category.toUpperCase()} KAYDI</span><button ref={closeRef} onClick={closeRecord} aria-label="Kaydı kapat">×</button></div>{active.image && <div className="record-image" style={{ backgroundImage: `url(${asset(active.image)})` }} />}<div className="record-body"><span className="section-kicker">{active.original.toUpperCase()}</span><h2 id="record-title">{active.name}</h2><p className="record-lead">{active.lead}</p><p className="record-description">{active.body}</p><div className="record-facts">{active.facts.map((fact) => <span key={fact}>{fact}</span>)}</div><div className="record-data"><div><span>DERİNLİK / ORTAM</span><b>{active.depth}</b></div><div><span>DEĞERLENDİRME</span><b>{active.danger}</b></div></div><a ref={sourceRef} href={active.source} target="_blank" rel="noreferrer" className="source-link">KAYNAĞI AÇ — SUBNAUTICA WIKI <span>↗</span></a></div></motion.div></motion.div>}</AnimatePresence>
  </main>
}
