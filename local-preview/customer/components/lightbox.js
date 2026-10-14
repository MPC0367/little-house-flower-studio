/* ---- components/lightbox.js ---- */
/* =====================================================================
   lightbox / story viewer — keyboard, swipe, focus trap, verbatim captions
   ===================================================================== */
LHF.viewer = (function () {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, pick = (o) => LHF.i18n.pick(o);
  let state = null;

  function open(posts, index, trigger) {
    close();
    if(!Array.isArray(posts)||!posts.length)return;
    const prevFocus = trigger || document.activeElement;
    state = { posts, i: Math.max(0,Math.min(posts.length-1,index||0)), slide: 0, scrollY:window.scrollY, overflow:document.body.style.overflow, background:[...document.body.children].map(node=>[node,node.inert]) };
    state.background.forEach(([node])=>node.inert=true);
    const root = h('div.viewer', { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('ig.title'), tabindex: -1 });
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); };
    document.addEventListener('keydown', onKey);
    state.root = root; state.onKey = onKey; state.prevFocus = prevFocus; state.untrap = U.trapFocus(root);
    render();
    requestAnimationFrame(() => { const c = root.querySelector('.close-x'); if (c) c.focus(); });
  }
  function close() {
    if (!state) return;
    document.removeEventListener('keydown', state.onKey); state.untrap(); state.root.remove(); document.body.style.overflow = state.overflow;
    state.background.forEach(([node,inert])=>node.inert=inert);
    if(Math.abs(window.scrollY-state.scrollY)>1){const html=document.documentElement,behavior=html.style.scrollBehavior;html.style.scrollBehavior='auto';window.scrollTo({top:state.scrollY,behavior:'instant'});html.style.scrollBehavior=behavior;}
    if (state.prevFocus?.isConnected && state.prevFocus.focus) state.prevFocus.focus({ preventScroll: true });
    state = null;
  }
  /* below 900px the arrow buttons are hidden, so focus stays on the dialog itself
     rather than falling out to the page */
  function refocus(sel) { if (!state) return; const el = state.root.querySelector(sel); (el && el.offsetParent !== null ? el : state.root).focus({ preventScroll: true }); }
  function next() { if (!state) return; const p = state.posts[state.i]; if (p.images.length > 1 && state.slide < p.images.length - 1) { state.slide++; } else { state.i = (state.i + 1) % state.posts.length; state.slide = 0; } render(); refocus('.viewer-nav.next'); }
  function prev() { if (!state) return; const p = state.posts[state.i]; if (state.slide > 0) { state.slide--; } else { state.i = (state.i - 1 + state.posts.length) % state.posts.length; const q = state.posts[state.i]; state.slide = q.images.length - 1; } render(); refocus('.viewer-nav.prev'); }

  function render() {
    const { posts, i, slide, root } = state;
    const p = posts[i];
    root.setAttribute('aria-label',t('ig.title')+' · '+pick(p.label));
    U.empty(root);
    const bars = h('div.bars', posts.map((_, k) => h('i', { class: k < i ? 'done' : k === i ? 'cur' : '' })));
    root.appendChild(h('div.viewer-top', h('div.who', LHF.img.el('logo_sm', { alt: '' }), h('span', '@littlehouseflower · ', LHF.i18n.fmtDate(p.date, 'short'))), bars, h('button.close-x', { type: 'button', 'aria-label': t('ig.close'), onClick: close }, ui.icon('close'))));

    const media = h('div.viewer-media');
    const key = p.images[slide] || p.images[0];
    const photo=ui.mediaStatus(LHF.img.pic(key, { eager: true }));
    media.appendChild(photo);
    photo.querySelector('img.hi')?.addEventListener('error',()=>{
      media.appendChild(h('button.btn.viewer-retry',{type:'button',onClick:()=>{render();refocus('.close-x');}},LHF.i18n.lang==='th'?'ลองโหลดภาพอีกครั้ง':'Retry photograph'));
    },{once:true});
    if (p.type === 'reel') media.appendChild(h('a.play', { href: p.url, target: '_blank', rel: 'noopener', 'aria-label': t('ig.reelOpen') }, ui.icon('play')));
    media.appendChild(h('button.viewer-nav.prev', { type: 'button', 'aria-label': t('ig.prev'), onClick: prev }, ui.icon('chevL')));
    media.appendChild(h('button.viewer-nav.next', { type: 'button', 'aria-label': t('ig.next'), onClick: next }, ui.icon('chevR')));
    /* swipe */
    let sx = 0, sy = 0, moved = false;
    media.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; moved = false; });
    media.addEventListener('pointerup', (e) => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? next() : prev(); } });

    const product = p.productId ? LHF.catalog.byId(p.productId) : null;
    const cap = h('div.cap', p.caption);
    const toggle = h('button.cap-toggle', { type: 'button', hidden: true, 'aria-expanded':'false',onClick: () => { cap.classList.toggle('open');toggle.setAttribute('aria-expanded',String(cap.classList.contains('open'))); toggle.textContent = cap.classList.contains('open') ? t('ig.less') : t('ig.more'); } }, t('ig.more'));
    requestAnimationFrame(() => { toggle.hidden = cap.scrollHeight <= cap.clientHeight + 2; });
    const side = h('div.viewer-side',
      h('div', h('div.h4', pick(p.label)), h('div.stats', p.views ? h('span', t('ig.views', { n: U.fmtNumber(p.views) })) : null, p.likes ? h('span', t('ig.likes', { n: U.fmtNumber(p.likes) })) : null, h('span', t('ig.of', { i: i + 1, n: posts.length })))),
      p.images.length > 1 ? h('div.dots', p.images.map((_, k) => h('i', { class: k === slide ? 'cur' : '' }))) : null,
      h('div', h('div.tiny', { style: { color: '#A9A39A', marginBottom: '4px' } }, t('ig.caption')), cap, toggle),
      h('div.acts',
        product && product.availability === 'available' ? ui.btn(t('ig.order'), { className: 'btn-primary', href: R.href('/flowers/' + product.slug), onClick: close }) : null,
        product && product.availability !== 'available' ? ui.btn(t('product.request'), { className: 'btn-primary', href: R.href('/flowers/' + product.slug), onClick: close }) : null,
        !product ? ui.btn(t('ig.similar'), { className: 'btn-primary', href: R.href('/custom', { ref: p.id }), onClick: close }) : null,
        ui.btn(p.type === 'reel' ? t('ig.reelOpen') : t('ig.open'), { href: p.url, target: '_blank', icon: 'external' })));
    root.appendChild(h('div.viewer-body', media, side));
    root.appendChild(h('div.viewer-bottom',
      h('span.viewer-keyboard-hint','← → · Esc'),
      h('div.viewer-mobile-controls',h('button',{type:'button',onClick:prev,'aria-label':t('ig.prev')},ui.icon('chevL'),LHF.i18n.lang==='th'?'ก่อนหน้า':'Previous'),h('span.viewer-position',t('ig.of',{i:i+1,n:posts.length})),h('button',{type:'button',onClick:next,'aria-label':t('ig.next')},LHF.i18n.lang==='th'?'ถัดไป':'Next',ui.icon('chevR')))));
    const announcement=h('p.sr-only',{role:'status'},t('ig.of',{i:i+1,n:posts.length})+' · '+pick(p.label));root.appendChild(announcement);
  }
  return { open, close };
})();

