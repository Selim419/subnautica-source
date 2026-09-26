// Runs inside the page. Returns layout facts a design review can act on.
(() => {
  const de = document.documentElement
  const overflow = de.scrollWidth > de.clientWidth

  // Elements whose own box reaches outside the viewport.
  const offenders = []
  if (overflow) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      if (r.right > de.clientWidth + 1 || r.left < -1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: typeof el.className === 'string' ? el.className : '',
          left: Math.round(r.left),
          right: Math.round(r.right),
        })
        if (offenders.length >= 8) break
      }
    }
  }

  // Clickable labels whose text occupies more than one visual line.
  // Rect client rects are clustered by vertical overlap: "SUB" and "NAUTICA"
  // sit on one line at different tops, so distinct `top` values would lie.
  const wrappedClicks = []
  for (const el of document.querySelectorAll('a, button')) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    if (cs.display === 'inline') continue
    const label = (el.textContent || '').trim()
    if (!label) continue
    const range = document.createRange()
    range.selectNodeContents(el)
    const rects = []
    for (const r of range.getClientRects()) if (r.height > 0.5) rects.push(r)
    if (!rects.length) continue
    rects.sort((a, b) => a.top - b.top)
    let lines = 1
    let bandTop = rects[0].top
    let bandBottom = rects[0].bottom
    for (const r of rects.slice(1)) {
      const overlap = Math.min(bandBottom, r.bottom) - Math.max(bandTop, r.top)
      if (overlap > Math.min(bandBottom - bandTop, r.height) * 0.5) {
        bandTop = Math.min(bandTop, r.top)
        bandBottom = Math.max(bandBottom, r.bottom)
      } else {
        lines++
        bandTop = r.top
        bandBottom = r.bottom
      }
    }
    if (lines > 1) {
      wrappedClicks.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === 'string' ? el.className : '',
        lines,
        text: label.slice(0, 40),
      })
      if (wrappedClicks.length >= 8) break
    }
  }

  return {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    scrollHeight: de.scrollHeight,
    clientHeight: de.clientHeight,
    overflow,
    offenders,
    wrappedClicks,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    htmlOverflowX: getComputedStyle(de).overflowX,
    bodyMinWidth: getComputedStyle(document.body).minWidth,
    h1FontFamily: (document.querySelector('h1') && getComputedStyle(document.querySelector('h1')).fontFamily) || null,
  }
})()
