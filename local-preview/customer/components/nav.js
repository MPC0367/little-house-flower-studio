/* ---- components/nav.js ---- */
/* =====================================================================
   nav — top strip, header, mobile menu sheet, doorstep bar
   ===================================================================== */
LHF.nav = (function () {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, S = LHF.data.shop;

  const LINKS = [
    { key: 'nav.flowers', path: '/flowers', en: 'Flowers' },
    { key: 'nav.occasions', path: '/occasions', en: 'Occasions' },
    { key: 'nav.meanings', path: '/meanings', en: 'Meanings' },
    { key: 'nav.custom', path: '/custom', en: 'Design yours' },
    { key: 'nav.instagram', path: '/instagram', en: 'Held' },
    { key: 'nav.story', path: '/story', en: 'Our little house' },
    { key: 'nav.visit', path: '/contact', en: 'Contact' },
  ];

  function topstrip() {
    const el = h('div.wrap',
      h('div.items', h('span', t('strip.hours')), h('span', h('i.sep'), t('strip.zone')), h('span', h('i.sep'), h('a', { href: S.lineUrl, target: '_blank', rel: 'noopener' }, t('strip.line')))),
      ui.openBadge());
    return el;
  }

  function langSwitch() {
    const mk = (lang) => h('button', { type: 'button', 'aria-pressed': LHF.i18n.lang === lang, lang, onClick: () => LHF.i18n.setLang(lang) }, t('lang.' + lang));
    return h('div.lang-switch', { role: 'group', 'aria-label': t('lang.switch') }, mk('th'), mk('en'));
  }

  function header() {
    const cur = (R.current && R.current.path) || '/';
    const nav = h('nav.nav-main', { 'aria-label': t('nav.main') }, LINKS.map((l) => h('a', { href: R.href(l.path), class: cur.startsWith(l.path) ? 'is-active' : '', 'aria-current': cur.startsWith(l.path) ? 'page' : null }, t(l.key))));
    const el = h('div.wrap', h('div.header-in',
      h('a.logo', { href: R.href('/'), 'aria-label': t('nav.home') }, LHF.img.el('logo_sm', { alt: '', eager: true }), h('span.word', 'Little House', h('small', 'Flower', h('span.where', ' · Nonthaburi')))),
      nav,
      h('div.header-right',
        h('button.icon-btn.only-desktop', { type: 'button', 'aria-label': t('nav.writeCard'), title: t('nav.writeCard'), onClick: () => LHF.heart.cardSheet() }, ui.icon('mail')),
        langSwitch(),
        LHF.heart.badge(),
        ui.btn(t('nav.reserve'), { href: R.href('/order'), className: 'btn-primary header-cta' }),
        h('button.menu-word', { type: 'button', 'aria-label': t('nav.menu'), 'aria-expanded': 'false', onClick: openMenu }, t('nav.menu')))));
    return el;
  }

  /* the other language's label, so the menu reads bilingually */
  const other = (key) => { const e = LHF.data.strings[key] || {}; return LHF.i18n.lang === 'th' ? e.en : e.th; };
  let menu = null;
  function menuContent() {
    return [
      h('div.top', h('a.logo', { href: R.href('/'), 'aria-label': t('nav.home'), onClick: closeMenu }, LHF.img.el('logo_sm', { alt: '' }), h('span.word', 'Little House', h('small', 'Flower'))), h('div.center', langSwitch(), h('button.close-x', { type: 'button', 'aria-label': t('nav.close'), onClick: closeMenu }, ui.icon('close')))),
      h('nav', { 'aria-label': t('nav.main') }, LINKS.map((l) => h('a', { href: R.href(l.path), 'aria-current': R.current?.path.startsWith(l.path) ? 'page' : null, onClick: closeMenu }, t(l.key), h('small', { lang: LHF.i18n.lang === 'th' ? 'en' : 'th' }, other(l.key)))), h('a', { href: R.href('/order'), onClick: closeMenu }, t('nav.reserve'), h('small', { lang: LHF.i18n.lang === 'th' ? 'en' : 'th' }, other('nav.reserve')))),
      h('div.facts', h('div', ui.openBadge(), ' · ', t('strip.hours')), h('div', t('strip.zone')), h('div', 'LINE ', S.lineId, ' · ', S.phoneDisplay)),
      h('div.socials', social('ig'), social('fb'), social('line'))];
  }
  function openMenu(event) {
    if (menu) return closeMenu();
    const prev = event?.currentTarget || document.activeElement;
    const background=[...document.body.children].map(node=>[node,node.inert]);
    const previousOverflow=document.body.style.overflow;
    background.forEach(([node])=>node.inert=true);
    menu = h('div.menu-sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('nav.menu') }, menuContent());
    document.body.appendChild(menu);
    document.body.style.overflow = 'hidden';
    const mw = U.qs('.menu-word'); if (mw) mw.setAttribute('aria-expanded', 'true');
    const onKey = (e) => { if (e.key === 'Escape') closeMenu(); };
    document.addEventListener('keydown', onKey);
    menu._background=background;menu._previousOverflow=previousOverflow;
    menu._untrap = U.trapFocus(menu); menu._onKey = onKey; menu._prev = prev;
    requestAnimationFrame(() => { const x = menu && menu.querySelector('.close-x'); if (x) x.focus(); });
  }
  /* switching language inside the open menu redraws the menu in place, in the
     new language, with focus back on the language switch */
  LHF.i18n.onChange(() => {
    if (!menu) return;
    U.append(U.empty(menu), menuContent());
    menu.setAttribute('aria-label', t('nav.menu'));
    const on = menu.querySelector('.lang-switch [aria-pressed="true"]'); if (on) on.focus();
  });
  function closeMenu() {
    if (!menu) return;
    document.removeEventListener('keydown', menu._onKey); menu._untrap(); menu.remove(); document.body.style.overflow = menu._previousOverflow;menu._background.forEach(([node,inert])=>node.inert=inert);
    const mw = U.qs('.menu-word'); if (mw) mw.setAttribute('aria-expanded', 'false');
    if (menu._prev && menu._prev.focus) menu._prev.focus({preventScroll:true});
    menu = null;
  }

  function social(kind) {
    const map = { ig: [S.instagram, 'Instagram', 'ig'], fb: [S.facebook, 'Facebook', 'fb'], line: [S.lineUrl, 'LINE ' + S.lineId, 'line'] };
    const [href, label, ic] = map[kind];
    return h('a', { href, target: '_blank', rel: 'noopener', 'aria-label': label, title: label }, ui.icon(ic));
  }

  function doorstep() {
    return h('div.wrap-x', { style: { display: 'contents' } },
      h('a', { href: S.lineUrl, target: '_blank', rel: 'noopener' }, ui.icon('line', 18), t('door.line')),
      h('a', { href: 'tel:' + S.phoneTel }, ui.icon('phone', 18), h('span.num', S.phoneDisplay)),
      h('a', { href: R.href('/order') }, ui.icon('heart', 18), t('nav.reserve')));
  }

  function mountAll() {
    const top = U.qs('#topstrip'), head = U.qs('#header'), door = U.qs('#doorstep');
    /* a language switch rebuilds the header: keep focus on the switch that was used */
    const a = document.activeElement, keepLang = a && a.closest && a.closest('#header .lang-switch') ? a.getAttribute('lang') : null;
    U.empty(top).appendChild(topstrip());
    U.empty(head).appendChild(header());
    U.empty(door).appendChild(doorstep());
    LHF.heart.refresh();
    /* landmark names follow the language; the strip sits outside <header>, so
       it is a landmark of its own */
    door.setAttribute('aria-label', t('door.label'));
    top.setAttribute('role', 'complementary'); top.setAttribute('aria-label', t('strip.label'));
    /* the skip link points at the content, not at the home route */
    const skip = U.qs('#skiplink'); if (skip) skip.setAttribute('href', '#main');
    if (menu) { const mw = U.qs('.menu-word'); if (mw) mw.setAttribute('aria-expanded', 'true'); }
    if (keepLang) { const b = U.qs('#header .lang-switch [lang="' + keepLang + '"]'); if (b) b.focus(); }
  }
  return { mountAll, LINKS, social, closeMenu };
})();

