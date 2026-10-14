/* ---- components/image.js ---- */
/* =====================================================================
   image — LQIP → full image, graceful fallback (never a broken icon)
   Photos are files in img/. The map keeps each one's size, alt text,
   a tiny inline LQIP that shows while the file loads and, for photos
   wider than 800 px, a 640 px copy (srcset).
   ===================================================================== */
LHF.img = (function () {
  const U = LHF.util, h = U.h;
  const I = () => window.__LHF_IMAGES || {};
  const meta = (key) => I()[key] || null;
  const src = (key) => (meta(key) || {}).src || '';
  const alt = (key) => { const m = meta(key); if (!m) return ''; return LHF.i18n.lang === 'th' ? m.alt_th || m.alt_en : m.alt_en || m.alt_th; };

  /* Give an <img> its file once its box has a width. With a srcset, `sizes` is that width, so a
     two-column card on a phone fetches the 640 px copy and the product page the full photo, with
     no caller having to know the layout. An eager photo in view, or in the first screen of its
     page (a new page renders before the scroll resets), is fetched first: on home that is the
     hero, not the rail cards below it. */
  function source(im, box, m, eager, then) {
    const go = (w) => {
      const r = box.getBoundingClientRect(), vh = window.innerHeight || 800;
      if (eager && ((r.top < vh && r.bottom >= 0) || r.top + (window.scrollY || 0) < vh)) im.setAttribute('fetchpriority', 'high');
      if (w && m.srcset) { im.sizes = Math.ceil(w) + 'px'; im.srcset = m.srcset; }
      im.src = m.src;
      if (then) then();
    };
    if (typeof ResizeObserver !== 'function') return go(0);
    const ro = new ResizeObserver((entries) => { const w = entries[0].contentRect.width; if (!w) return; ro.disconnect(); go(w); });
    ro.observe(box);
  }

  /* pic(key, {className, pos, eager, ratio, sizes, decorative}) */
  function pic(key, opts) {
    opts = opts || {};
    const m = meta(key);
    /* a small source (the 360 px reel stills, the cropped photos) is never blown up past 1.5× its width */
    const cap = m && m.w < 700 ? { maxWidth: Math.round(m.w * 1.5) + 'px' } : {};
    const wrap = h('div.pic', { class: opts.className, style: Object.assign(cap, opts.ratio ? { aspectRatio: opts.ratio } : {}, opts.style || {}) });
    if (!m) {
      wrap.classList.add('is-loaded');
      wrap.appendChild(h('div.pic-fallback', h('span', LHF.i18n.t('img.fallback')), h('a.tlink', { href: LHF.data.shop.instagram, target: '_blank', rel: 'noopener' }, 'Instagram')));
      return wrap;
    }
    const a = opts.decorative ? '' : (opts.alt || alt(key));
    if (m.lqip) {
      const lq = h('img.lq', { src: m.lqip, alt: '', 'aria-hidden': 'true', width: m.w, height: m.h });
      wrap.appendChild(lq);
    }
    /* an eager photo (hero, product, viewer) paints as it arrives over its LQIP instead of fading
       in after it has loaded; lazy ones keep the fade from the blur */
    const im = h('img.hi', { alt: a, width: m.w, height: m.h, loading: opts.eager ? 'eager' : 'lazy', decoding: 'async', style: Object.assign(opts.pos ? { objectPosition: opts.pos } : {}, opts.eager ? { opacity: 1, transition: 'none' } : {}), draggable: 'false' });
    const done = () => wrap.classList.add('is-loaded');
    im.addEventListener('load', done, { once: true });
    im.addEventListener('error', () => {
      im.remove();
      wrap.classList.add('is-loaded');
      wrap.appendChild(h('div.pic-fallback', h('span', LHF.i18n.t('img.fallback')), h('a.tlink', { href: LHF.data.shop.instagram, target: '_blank', rel: 'noopener' }, 'Instagram')));
    }, { once: true });
    wrap.appendChild(im);
    source(im, wrap, m, opts.eager, () => {
      if (im.decode) im.decode().then(done).catch(() => {});
      if (im.complete && im.naturalWidth) done();
    });
    /* never leave a loaded photo behind its blur; one still on its way keeps the LQIP */
    setTimeout(() => { if (im.complete && im.naturalWidth) done(); }, 1800);
    return wrap;
  }

  /* plain <img> (small thumbs, logo) */
  function el(key, opts) {
    opts = opts || {};
    const m = meta(key);
    if (!m) return h('span.thumb-empty', { class: opts.className });
    const im = h('img', { alt: opts.alt != null ? opts.alt : alt(key), width: m.w, height: m.h, class: opts.className, loading: opts.eager ? 'eager' : 'lazy', decoding: 'async', draggable: 'false', style: opts.style || null });
    /* a thumbnail of a big photo takes the 640 px copy; small files (logo, highlights) load as they are */
    if (m.srcset) source(im, im, m, false); else im.src = m.src;
    return im;
  }

  const ratio = (key) => { const m = meta(key); return m ? m.w / m.h : 0.8; };
  return { pic, el, meta, src, alt, ratio };
})();
