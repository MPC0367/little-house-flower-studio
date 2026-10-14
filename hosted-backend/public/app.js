/* ---- app.js ---- */
/* =====================================================================
   APP — boot: i18n, loader, routes, transitions, language switching
   ===================================================================== */
(function () {
  const U = LHF.util, R = LHF.router, t = (k) => LHF.i18n.t(k);

  /* routes */
  R.add('/', () => LHF.pages.home(), { name: 'home', title: () => t('seo.home') });
  R.add('/flowers', (p, q) => LHF.pages.flowers(p, q), { name: 'flowers', title: () => t('seo.flowers') });
  /* an unknown slug renders the not-found page, so it gets the not-found title too */
  R.add('/flowers/:slug', (p) => LHF.pages.product(p), { name: 'product', title: (p) => { const x = LHF.catalog.bySlug(p.slug); return x ? LHF.i18n.pick(x.name) : t('seo.notfound'); } });
  R.add('/occasions', () => LHF.pages.occasions(), { name: 'occasions', title: () => t('seo.occasions') });
  R.add('/occasions/:id', (p) => LHF.pages.occasion(p), { name: 'occasion', title: (p) => { const o = LHF.catalog.occasion(p.id); return o ? LHF.i18n.pick(o) : t('seo.notfound'); } });
  R.add('/meanings', () => LHF.pages.meanings(), { name: 'meanings', title: () => t('seo.meanings') });
  R.add('/custom', (p, q) => LHF.pages.custom(p, q), { name: 'custom', title: () => t('seo.custom') });
  R.add('/instagram', (p, q) => LHF.pages.instagram(p, q), { name: 'instagram', title: () => t('seo.instagram') });
  R.add('/story', () => LHF.pages.story(), { name: 'story', title: () => t('seo.story') });
  R.add('/contact', () => LHF.pages.visit(), { name: 'contact', title: () => t('seo.contact') });
  R.add('/order', (p, q) => LHF.pages.order(p, q), { name: 'order', title: () => t('seo.order'), keepScroll: false });
  /* "sent" only for the booking this browser just sent; any other link gets a neutral title,
     since the page may have to say it cannot find the booking */
  R.add('/order/done/:id', (p) => LHF.pages.confirm(p), { name: 'done', title: (p) => { const b = LHF.store.get('lastOrder'); return b && b.id === p.id ? t('seo.done') : t('seo.booking'); } });
  R.add('/admin', (p, q) => LHF.util.h('div.wrap.section', LHF.util.h('h1.h1', 'Staff workspace'), LHF.util.h('a.btn.btn-primary', {href:window.LHF_SHARE_CONTEXT?.studioURL||'/studio/'}, LHF.i18n.lang==='th'?'เปิดระบบจัดการร้าน':'Open staff workspace')), { name: 'admin', title: () => t('seo.admin'), noTransition: true });
  R.add('/privacy', () => LHF.pages.privacy(), { name: 'privacy', title: () => t('seo.privacy') });
  R.add('/404', () => LHF.pages.notfound(), { name: 'notfound', title: () => t('seo.notfound') });

  /* page transition: a brief opacity dip (the paper ribbon is reserved for language switches) */
  LHF.transition = {
    async run(fn) {
      const main = U.qs('#main');
      main.style.transition = 'opacity 160ms var(--ease)'; main.style.opacity = '0';
      await U.wait(150);
      await fn();
      main.style.opacity = '1';
      setTimeout(() => { main.style.transition = ''; }, 300);
    },
  };

  /* ?lang=th|en inside the hash picks the language on a same-page link too, not only on a full load */
  R.before((cur) => { const q = cur.query.lang; if ((q === 'th' || q === 'en') && q !== LHF.i18n.lang) LHF.i18n.setLang(q); });

  R.after((cur) => {
    LHF.ui.reveal(U.qs('#main'));
    document.body.classList.toggle('no-doorstep', /^\/order/.test(cur.path));
    U.qsa('.nav-main a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') !== '#/' && (a.getAttribute('href') || '').replace('#', '') === cur.path.split('/').slice(0, 2).join('/')));
  });

  /* language switch: keep route + draft, re-render with a ribbon pass */
  LHF.i18n.onChange(() => {
    if (!U.reducedMotion()) { const pass = U.h('div.ribbon-pass', U.h('div.band')); document.body.appendChild(pass); setTimeout(() => pass.remove(), 700); }
    setTimeout(() => { LHF.nav.mountAll(); LHF.footer.mount(); R.render(); const m = U.qs('#main'); m.classList.remove('lang-fade'); void m.offsetWidth; m.classList.add('lang-fade'); }, U.reducedMotion() ? 0 : 260);
  });

  /* the skip link must move focus, not navigate the hash router */
  function wireSkip() {
    const link = U.qs('#skiplink');
    if (!link) return;
    const paint = () => { link.textContent = t('a11y.skip'); };
    paint(); LHF.i18n.onChange(paint);
    link.addEventListener('click', (e) => { e.preventDefault(); const m = U.qs('#main'); m.setAttribute('tabindex', '-1'); m.focus({ preventScroll: false }); });
  }

  /* boot */
  function boot() {
    LHF.i18n.init();
    wireSkip();
    LHF.nav.mountAll();
    LHF.footer.mount();
    LHF.store.set('settings', LHF.data.bookingDefaults);
    LHF.db.getSettings().then((s) => { LHF.store.set('settings', s); LHF.sink.start(); }).catch(() => LHF.sink.start());
    R.start(U.qs('#main'));
    if (LHF.localIntro) LHF.localIntro();
    /* keep every open-now badge honest (top strip, menu, /contact), minute by minute */
    setInterval(() => { U.qsa('span.open.is-open, span.open.is-soon, span.open.is-closed').forEach((el) => el.replaceWith(LHF.ui.openBadge())); }, 60000);
  }
  /* never leave the loader covering the page if boot throws */
  function safeBoot() {
    try { boot(); } catch (e) {
      console.error(e);
      const l = U.qs('#loader'); if (l) { l.style.transition = 'none'; l.classList.add('is-done'); }
      const m = U.qs('#main');
      if (m && !m.children.length) m.appendChild(U.h('div.wrap.section', U.h('p.lede', LHF.data.shop.name + ' · ร้านดอกไม้ โซนรัตนาธิเบศร์ นนทบุรี · เปิดทุกวัน 08.00–20.00 น.'), U.h('p', U.h('a.tlink', { href: LHF.data.shop.lineUrl }, 'LINE ' + LHF.data.shop.lineId), ' · ', U.h('a.tlink', { href: 'tel:' + LHF.data.shop.phoneTel }, LHF.data.shop.phoneDisplay))));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeBoot); else safeBoot();
})();
