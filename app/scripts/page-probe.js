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
  //
  // Inline anchors are excluded on purpose. An inline <a> flows with body copy
  // at the viewport width and is the most likely thing to wrap, but a link
  // inside running text wraps mid-sentence by design and would flood this list
  // with non-defects. Block-level and inline-block links (nav, buttons, cards)
  // are still measured.
  const wrappedClicks = []
  let wrappedClicksTruncated = false
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
      if (wrappedClicks.length >= 8) { wrappedClicksTruncated = true; break }
    }
  }

  // Text clipped inside a clipping container.
  //
  // This is the check the rest of this file cannot make. `overflow` compares
  // the DOCUMENT's scrollWidth to its clientWidth, and `offenders` only runs
  // when that says yes, so both are silent about the whole class of defect
  // where a container with `overflow: hidden` swallows content that overhangs
  // it: the document never overflows, so the page is reported clean while a
  // heading is cut in half. .final-content h2 was exactly that - BİLİNMEYENE is
  // one unbreakable Turkish word, 414.22px wide in a 282px measure at 320px,
  // overhanging by 113px and clipped by .final-cta - and `overflow` read false
  // and `offenders` was empty at every width.
  //
  // For every text-bearing element, find the nearest ancestor that clips
  // (overflow-x or overflow-y of hidden/clip/scroll/auto) and compare the
  // element's own border box against that ancestor's PADDING box, which is the
  // region the clip is applied to. The padding box is derived from the border
  // box minus the computed border widths rather than read from clientWidth,
  // because clientWidth silently subtracts a classic scrollbar gutter and this
  // runs with --hide-scrollbars anyway.
  //
  // Two axes, because `overflow: hidden` clips both and the vertical one is
  // where a card that is too short for its own copy hides. Each finding says
  // whether the ancestor DESTROYS the overflow (hidden/clip - the content is
  // gone) or merely SCROLLS it (auto/scroll - the content is reachable by
  // scrolling), because those are very different findings and a list that
  // conflated them could not be acted on.
  //
  // ONE FINDING PER (CLIPPING CONTAINER, AXIS), not one per element, and the
  // finding carries `groupSize` plus up to three of the elements involved. The
  // first cut of this check reported every element and was unusable: the
  // ticker marquee is a nowrap strip inside `overflow: hidden`, so at 320px
  // its inner div and all eight of its asterisk spans overhung .ticker and
  // filled the cap on their own, at every width, on both routes. Nine rows of
  // one known-intentional clip is not a measurement, it is a wall. Collapsing
  // to the worst offender per container and axis keeps every finding
  // actionable and loses nothing - the count is reported, so a collapsed
  // report can never be read as a single-element one - and it means one
  // clipped heading reports as one row instead of one row per ancestor from
  // the heading up to the clip.
  const CLIPS = new Set(['hidden', 'clip', 'scroll', 'auto'])
  const DESTROYS = new Set(['hidden', 'clip'])
  const clippedGroups = new Map()
  // The clipper elements are identified by a sequence number rather than by
  // their class name, because two cards on the wiki route are both
  // div.wiki-card and one clipped card is not two.
  const clipperIds = new Map()
  let clipperSeq = 0

  // The element that OWNS its text, rather than every element that contains
  // some. An element qualifies when it has non-whitespace text and no
  // block-level child: the text may be its own text nodes or live in inline
  // children (.hero h1's .hero-word spans, .final-content h2's <br> and
  // <em>), but the moment a block child is present the text belongs to the
  // descendants and reporting the wrapper too would multiply one clipped word
  // into a finding per ancestor up to the clip.
  const INLINE_DISPLAY = /^(inline|inline-block|inline-flex|inline-grid|inline-table|ruby)$/
  const ownsItsText = (el) => {
    let text = ''
    for (const node of el.childNodes) {
      if (node.nodeType === 3) { text += node.nodeValue; continue }
      if (node.nodeType !== 1) continue
      if (!INLINE_DISPLAY.test(getComputedStyle(node).display)) return false
      text += node.textContent
    }
    return /\S/.test(text)
  }

  // The nearest ancestor that clips on either axis, with the axes it clips on
  // and the box the clip is applied to. Visually-hidden patterns are not
  // defects - .sr-only is a 1px box with `clip: rect(0,0,0,0)` whose nowrap
  // label is SUPPOSED to be thousands of pixels wider than it - so a computed
  // `clip` other than auto, or a padding box collapsed to nothing, ends the
  // walk. That is the one exclusion in this check and it is deliberate: every
  // other clipped-text finding on the site is content a reader cannot see.
  const clipperOf = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p)
      const x = CLIPS.has(cs.overflowX)
      const y = CLIPS.has(cs.overflowY)
      if (!x && !y) continue
      if (cs.clip && cs.clip !== 'auto') return null
      const r = p.getBoundingClientRect()
      const bl = parseFloat(cs.borderLeftWidth) || 0
      const br = parseFloat(cs.borderRightWidth) || 0
      const bt = parseFloat(cs.borderTopWidth) || 0
      const bb = parseFloat(cs.borderBottomWidth) || 0
      const box = {
        el: p,
        cls: typeof p.className === 'string' ? p.className.trim() : '',
        x, y,
        left: r.left + bl, right: r.right - br, top: r.top + bt, bottom: r.bottom - bb,
        width: r.width - bl - br, height: r.height - bt - bb,
      }
      // A 1px clipping box is the visually-hidden idiom whatever it is called.
      if (box.width <= 1 && box.height <= 1) return null
      return box
    }
    return null
  }

  // 1px of slack, for the same reason `offenders` uses it: subpixel layout
  // rounding puts a box a fraction of a pixel outside its parent legitimately.
  const CLIP_SLACK = 1
  const round2 = (n) => Math.round(n * 100) / 100
  const nameOf = (el) => el.tagName.toLowerCase() +
    (typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).join('.') : '')

  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    if (!ownsItsText(el)) continue
    const clip = clipperOf(el)
    if (!clip) continue

    const overX = clip.x
      ? Math.max(0, rect.right - clip.right, clip.left - rect.left)
      : 0
    const overY = clip.y
      ? Math.max(0, rect.bottom - clip.bottom, clip.top - rect.top)
      : 0
    if (overX <= CLIP_SLACK && overY <= CLIP_SLACK) continue

    // The axis reported is the one that actually overflowed, because an element
    // can exceed its clipper's width without exceeding a height that happens to
    // be the smaller number, and "overflows" with no axis is not actionable.
    const axis = overX > overY ? 'x' : 'y'
    const value = axis === 'x' ? overX : overY
    const entry = {
      tag: el.tagName.toLowerCase(),
      cls: typeof el.className === 'string' ? el.className : '',
      text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      // `destroys` false means the content is still reachable by scrolling the
      // ancestor, which is a design decision and not a defect.
      destroys: DESTROYS.has(axis === 'x' ? getComputedStyle(clip.el).overflowX : getComputedStyle(clip.el).overflowY),
      clipper: nameOf(clip.el),
      elementWidth: round2(rect.width),
      elementHeight: round2(rect.height),
      clipperWidth: round2(clip.width),
      clipperHeight: round2(clip.height),
      overhang: round2(value),
    }
    // The key has to be the clipper ELEMENT, not its class name. `clip` is a
    // fresh object on every call, so the element -> sequence mapping lives in
    // its own Map.
    let clipperId = clipperIds.get(clip.el)
    if (clipperId === undefined) clipperIds.set(clip.el, clipperId = ++clipperSeq)
    const key = clipperId + axis
    const group = clippedGroups.get(key)
    if (!group) {
      clippedGroups.set(key, {
        clipper: nameOf(clip.el),
        axis,
        groupSize: 0,
        elements: [],
        // A group keeps the WORST element it contains; the rest are counted,
        // not dropped silently.
        tag: entry.tag, cls: entry.cls, text: entry.text,
        destroys: entry.destroys,
        elementWidth: entry.elementWidth, elementHeight: entry.elementHeight,
        clipperWidth: entry.clipperWidth, clipperHeight: entry.clipperHeight,
        overhang: entry.overhang,
      })
    } else if (value > group.overhang) {
      group.tag = entry.tag
      group.cls = entry.cls
      group.text = entry.text
      group.destroys = entry.destroys
      group.elementWidth = entry.elementWidth
      group.elementHeight = entry.elementHeight
      group.clipperWidth = entry.clipperWidth
      group.clipperHeight = entry.clipperHeight
      group.overhang = entry.overhang
    }
    clippedGroups.get(key).groupSize++
    if (clippedGroups.get(key).elements.length < 3) clippedGroups.get(key).elements.push(nameOf(el))
  }

  // Worst first, so the cap cannot drop the finding a reader most needs, and
  // the total is reported so a capped run is never read as a clean one.
  const clippedTextTotal = [...clippedGroups.values()].reduce((n, g) => n + g.groupSize, 0)
  const clippedText = [...clippedGroups.values()]
    .sort((a, b) => b.overhang - a.overhang)
    .slice(0, 8)
  const clippedTextTruncated = clippedGroups.size > clippedText.length

  return {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    scrollHeight: de.scrollHeight,
    clientHeight: de.clientHeight,
    overflow,
    offenders,
    wrappedClicks,
    // True when the list above hit its cap, so a capped report is never read
    // as a clean one.
    wrappedClicksTruncated,
    // New in this task, and ADDITIVE: every key above keeps its name, its type
    // and its meaning, so anything reading the existing keys is unaffected.
    clippedText,
    clippedTextTruncated,
    // How many text elements are behind `clippedText`, which is one row per
    // (clipping container, axis) and not one row per element.
    clippedTextTotal,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    htmlOverflowX: getComputedStyle(de).overflowX,
    bodyMinWidth: getComputedStyle(document.body).minWidth,
    h1FontFamily: (document.querySelector('h1') && getComputedStyle(document.querySelector('h1')).fontFamily) || null,
  }
})()
