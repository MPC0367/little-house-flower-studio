/* ---- components/ui.js ---- */
/* =====================================================================
   ui — icons, sheets, toasts, section heads, reveals, Thai line-breaking
   ===================================================================== */
LHF.ui = (function () {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p);

  const ICONS = {
    line: '<path d="M12 3C6.9 3 3 6.4 3 10.6c0 3.7 3.2 6.8 7.6 7.4.3.1.7.2.8.5.1.3 0 .8 0 1.1l-.1.8c0 .2-.2.9.8.5s5.2-3.1 7.1-5.3c1.3-1.4 1.8-2.9 1.8-4.9C21 6.4 17.1 3 12 3z" fill="currentColor"/>',
    phone: '<path d="M6.6 3h3l1.6 4-2 1.3a12 12 0 0 0 6.5 6.5l1.3-2 4 1.6v3c0 1.1-.9 2-2 2A16 16 0 0 1 4.6 5c0-1.1.9-2 2-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    ig: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor"/>',
    fb: '<path d="M14 8h2.5V4.5H14c-2.5 0-4 1.6-4 4V10H7.5v3.5H10V21h3.5v-7.5H16l.5-3.5h-3V8.7c0-.5.2-.7.5-.7z" fill="currentColor"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    back: '<path d="M20 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    chevL: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    chevR: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    map: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 6.5 12 13l8.5-6.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
    heart: '<path d="M12 20.5C7 16.4 3 12.8 3 8.7A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 9 2.7c0 4.1-4 7.7-9 11.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    minus: '<path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    pause: '<path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor"/>',
  };
  function icon(name, size) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size || 20); s.setAttribute('height', size || 20); s.setAttribute('aria-hidden', 'true'); s.classList.add('ico');
    s.innerHTML = ICONS[name] || '';
    return s;
  }

  /* ---- heart tag: the pink sticker ---- */
  function heartTag(cls) {
    const el = h('span.heart-tag', { class: cls, 'aria-hidden': 'true' });
    el.innerHTML = '<svg viewBox="0 0 64 60"><path d="M32 56 C18 45 4 34 4 20 A14 14 0 0 1 32 14 A14 14 0 0 1 60 20 C60 34 46 45 32 56Z"/></svg><span class="txt">LITTLE<br>HOUSE<br>FLOWER</span>';
    return el;
  }

  /* ---- section head ---- */
  function head(opts) {
    const el = h('div.sec-head', { class: opts.className });
    if (opts.eyebrow) el.appendChild(h('div.eyebrow', opts.eyebrow));
    if (opts.title) el.appendChild(h(opts.level || 'h2', { class: opts.titleClass || 'h2', id: opts.id }, thaiWrap(opts.title)));
    if (opts.sub) el.appendChild(h('p.lede', opts.sub));
    if (opts.action) el.appendChild(h('div.sec-action', opts.action));
    return el;
  }
  const link = (href, label, opts) => h('a.tlink', { href, class: opts && opts.className }, label, icon('arrow', 16));
  const btn = (label, opts) => {
    opts = opts || {};
    const tag = opts.href ? 'a' : 'button';
    return h(tag + '.btn', Object.assign({ class: opts.className || '', href: opts.href, type: opts.href ? null : (opts.type || 'button'), onClick: opts.onClick, target: opts.target, rel: opts.target ? 'noopener' : null, disabled: opts.disabled }, opts.attrs || {}), opts.icon ? icon(opts.icon, 18) : null, label, opts.iconRight ? icon(opts.iconRight, 18) : null);
  };

  /* ---- Thai line-breaking: insert <wbr> at word boundaries for long headings ---- */
  let segmenter = null;
  try { if (window.Intl && Intl.Segmenter) segmenter = new Intl.Segmenter('th', { granularity: 'word' }); } catch (e) { segmenter = null; }
  /* compounds the word segmenter splits (ความ|หมาย, การ์ด|ข้อความ) but a Thai
     reader never would: each is kept on one line */
  const THAI_KEEP = ['ความหมาย', 'การ์ดข้อความ', 'ล่วงหน้า', 'ครบรอบ', 'เยี่ยมไข้', 'เยอบีร่า', 'รับปริญญา', 'ดอกไม้'];
  const KEEP_RE = new RegExp('(' + THAI_KEEP.slice().sort((a, b) => b.length - a.length).join('|') + ')');
  function thaiWrap(text) {
    if (typeof text !== 'string') return text;
    if (LHF.i18n.lang !== 'th' || !segmenter || !/[฀-๿]/.test(text)) return text;
    const frag = document.createDocumentFragment();
    let buf = '';
    const flush = () => { if (buf) { frag.appendChild(document.createTextNode(buf)); buf = ''; } };
    text.split(KEEP_RE).forEach((part, i) => {
      if (!part) return;
      if (i % 2) { if (buf) { flush(); frag.appendChild(document.createElement('wbr')); } frag.appendChild(h('span.nowrap', part)); return; }
      for (const seg of segmenter.segment(part)) {
        if (seg.isWordLike) { if (buf) { flush(); frag.appendChild(document.createElement('wbr')); } frag.appendChild(document.createTextNode(seg.segment)); }
        else buf += seg.segment;
      }
    });
    flush();
    return frag;
  }
  /* A two-sentence headline sets each sentence (Thai: each spaced phrase) as its
     own unit, so a new sentence never starts at the end of a line ("… The /
     card is free."). A unit still wraps inside itself when it has to. */
  function phrases(text) {
    if (typeof text !== 'string') return text;
    const parts = LHF.i18n.lang === 'th' ? text.split(/\s+/) : text.replace(/([.!?])\s+/g, '$1\n').split('\n');
    if (parts.length < 2) return thaiWrap(text);
    const frag = document.createDocumentFragment();
    parts.forEach((p, i) => { if (i) frag.appendChild(document.createTextNode(' ')); frag.appendChild(h('span.phrase', thaiWrap(p))); });
    return frag;
  }

  /* ---- sheet (modal) ---- */
  let openSheet = null;
  let pointerTrigger = null, pointerAt = 0;
  document.addEventListener('pointerdown', event => { pointerTrigger=event.target.closest?.('button,a[href],input,select,textarea') || null;pointerAt=performance.now(); }, {capture:true,passive:true});
  function sheet(opts) {
    closeSheet();
    const focused=document.activeElement;
    const prevFocus=opts.trigger || (focused===document.body && pointerTrigger?.isConnected && performance.now()-pointerAt<1500 ? pointerTrigger : focused);
    const previousOverflow = document.body.style.overflow;
    const background = [...document.body.children].filter(node=>node.id!=='sheets').map(node=>[node,node.inert]);
    background.forEach(([node])=>node.inert=true);
    const panel = h('div.sheet-panel', { class: opts.wide ? 'wide' : '', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label || (typeof opts.title === 'string' ? opts.title : 'dialog') });
    const closeBtn = h('button.close-x', { type: 'button', 'aria-label': t('nav.close'), onClick: () => closeSheet() }, icon('close'));
    panel.appendChild(h('div.sheet-head', h('div', opts.title ? h('h2.h3', opts.title) : null, opts.sub ? h('p.muted.small', { style: { marginTop: '4px' } }, opts.sub) : null), closeBtn));
    panel.appendChild(opts.content);
    const overlay = h('div.sheet-overlay', { onClick: (e) => { if (e.target === overlay) closeSheet(); } }, panel);
    const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', onKey);
    const untrap = U.trapFocus(panel);
    document.body.style.overflow = 'hidden';
    U.qs('#sheets').appendChild(overlay);
    requestAnimationFrame(() => { const f = panel.querySelector('[data-autofocus]') || closeBtn; f.focus({ preventScroll: true }); });
    openSheet = { overlay, close: () => { document.removeEventListener('keydown', onKey); untrap(); overlay.remove(); document.body.style.overflow = previousOverflow; background.forEach(([node,inert])=>node.inert=inert); openSheet = null; if (opts.onClose) opts.onClose(); if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } };
    return openSheet;
  }
  function closeSheet() { if (openSheet) openSheet.close(); }

  /* ---- toast ---- */
  function toast(msg, opts) {
    opts = opts || {};
    const el = h('div.toast', { role: 'status' }, opts.heart ? heartTag('sm flat') : null, h('span', msg), opts.href ? h('a', { href: opts.href, onClick: () => el.remove() }, opts.label || t('more')) : null);
    U.qs('#toasts').appendChild(el);
    /* a toast with a link stays long enough to reach it by keyboard, and never
       leaves while the pointer or focus is on it */
    const life = opts.ms || (opts.href ? 8000 : 3200);
    let timer;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 220); }, life); };
    const hold = () => clearTimeout(timer);
    el.addEventListener('mouseenter', hold); el.addEventListener('mouseleave', arm);
    el.addEventListener('focusin', hold); el.addEventListener('focusout', arm);
    arm();
    return el;
  }

  /* ---- reveal on scroll ---- */
  /* Content is never left invisible: above-the-fold items reveal at once,
     the rest on intersection, and a safety timer reveals everything. */
  /* The page is visible at rest. Only elements BELOW the fold are parked
     (class rv-wait) and rise in when they scroll into view; a safety timer
     releases anything still waiting. */
  function reveal(root) {
    const singles = U.qsa('[data-reveal]:not(.is-in)', root);
    const groups = U.qsa('[data-reveal-group]:not(.is-in)', root);
    const observers = [];
    const release = () => { U.qsa('.rv-wait', root).forEach(el => el.classList.add('is-in')); };
    if (U.reducedMotion() || typeof IntersectionObserver !== 'function') { release(); return; }
    // Arm the fallback first: an observer exception must never strand hidden content.
    const timer = setTimeout(release, 2500);
    const below = el => el.getBoundingClientRect().top > window.innerHeight * .98;
    const options = {threshold:.01,rootMargin:'0px 0px -4% 0px'};
    try {
      singles.forEach(el => { if (!below(el)) return; el.classList.add('rv-wait'); observers.push(U.onVisible(el,node=>node.classList.add('is-in'),options)); });
      groups.forEach(group => {
        if (!below(group)) return;
        const children = Array.from(group.children).slice(0,12);
        children.forEach((node,i)=>{node.classList.add('rv-wait');node.style.setProperty('--d',Math.min(i,5)*40+'ms');});
        observers.push(U.onVisible(group,()=>{group.classList.add('is-in');children.forEach(node=>node.classList.add('is-in'));},options));
      });
    } catch { release(); }
    LHF.router.onLeave(()=>{clearTimeout(timer);observers.forEach(disconnect=>disconnect());release();});
  }

  // Existing pictures retain their source and fallback. Expose loading/error state
  // without adding an external link inside an already interactive gallery tile.
  function mediaStatus(picture, options = {}) {
    const image = picture.querySelector('img.hi');
    picture.dataset.mediaState = image ? 'loading' : 'unavailable';
    const settle = failed => {
      picture.dataset.mediaState = failed ? 'unavailable' : 'ready';
      if (failed && options.nestedControl) picture.querySelectorAll('.pic-fallback a').forEach(link=>link.replaceWith(h('span.small',link.textContent)));
    };
    if(image){image.addEventListener('load',()=>settle(false),{once:true});image.addEventListener('error',()=>settle(true),{once:true});if(image.complete&&image.naturalWidth)settle(false);}
    else settle(true);
    return picture;
  }

  /* ---- open-now state on the shop's clock (Bangkok), whatever zone the device is in ---- */
  function openState(now) {
    now = now || new Date();
    const hrs = LHF.data.shop.hours;
    const o = parseInt(hrs.open, 10), c = parseInt(hrs.close, 10);
    const hh = LHF.i18n.shopNow(now).hour;
    if (hh < o || hh >= c) return 'closed';
    if (c - hh <= 1) return 'soon';
    return 'open';
  }
  function openBadge() {
    const s = openState();
    const el = h('span.open', { class: 'is-' + s }, h('i'), t('open.' + (s === 'open' ? 'now' : s)));
    return el;
  }

  /* ---- price helpers ---- */
  function priceLabel(p, opts) {
    const f = LHF.i18n.fmtPrice;
    if (!p || (LHF.engine && LHF.engine.priceKind(p) === 'quote') || p.pricing === 'quote') return t('price.quote');
    if (p.pricing === 'from') return t('price.from', { price: f(p.price) });
    if (p.pricing === 'range') return LHF.i18n.fmtRange(p.price, p.priceMax);
    if (p.pricing === 'tiers') return f(p.price);
    return f(p.price);
  }
  function sizeLabel(p) {
    if (!p.size) return '';
    return 'W' + p.size.w + ' × H' + p.size.h + ' ' + t('size.cm');
  }
  function leadLabel(p) {
    if (p.leadDays >= 3) return t('lead.handmade');
    return t('lead.days1');
  }

  /* ---- LINE deep link with prefilled text (LINE OA links cannot prefill; we copy text + open) ---- */
  function lineHref() { return LHF.data.shop.lineUrl; }

  /* ---- mixed-language text ----
     Flower headwords, hashtags, district names, reel quotes and the like stay
     in one language whatever the site language is. Where such an element is
     wholly in the other script it gets its own lang, so a screen reader reads
     it with the right voice. Runs after every change to the page. */
  const LANG_SEL = '.headword, .entry-th, .tag-line, .route li, .zone, .voice > span, .quote-tile > span, .mtile.quote > span, .avatar-row a > span, .eyebrow, .pcard-name, .product-title, .ledger-name, .ribbon-item';
  const TH_CHARS = /[฀-๿]/, LATIN_CHARS = /[A-Za-z]/;
  function markLang(root) {
    const lang = LHF.i18n.lang;
    U.qsa(LANG_SEL, root).forEach((el) => {
      const auto = el.hasAttribute('data-lang-auto');
      if (el.hasAttribute('lang') && !auto) return;
      const s = el.textContent, th = TH_CHARS.test(s), la = LATIN_CHARS.test(s);
      const want = lang === 'en' && th && !la ? 'th' : lang === 'th' && la && !th ? 'en' : '';
      if (want) { el.setAttribute('lang', want); el.setAttribute('data-lang-auto', ''); }
      else if (auto) { el.removeAttribute('lang'); el.removeAttribute('data-lang-auto'); }
    });
  }
  /* the 5px ribbon sample on /story is a picture of the ribbon, not text to read */
  function markDecor(root) { U.qsa('.ribbon-mini:not([aria-hidden])', root).forEach((el) => el.setAttribute('aria-hidden', 'true')); }
  /* the observer's callback is a microtask, so the marks land before paint */
  if (window.MutationObserver) new MutationObserver(() => { markLang(document); markDecor(document); }).observe(document.body, { childList: true, subtree: true });

  return { icon, heartTag, head, link, btn, thaiWrap, phrases, sheet, closeSheet, toast, reveal, openState, openBadge, priceLabel, sizeLabel, leadLabel, lineHref, markLang, mediaStatus };
})();
