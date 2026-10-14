/* ---- components/footer.js ---- */
/* =====================================================================
   footer — every verified contact fact, in the shop's own wording
   ===================================================================== */
LHF.footer = (function () {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, S = LHF.data.shop;
  /* The studio credit: O2 Design Studio's mark, last on the page. Every site O2
     builds carries it until the studio says otherwise. Markup, not h(): h()
     makes HTML elements and the mark is SVG. A name, so it is not translated. */
  const O2_CREDIT = '<a class="o2-credit" href="https://o2-designstudio.com/" target="_blank" rel="noopener" lang="en" aria-label="Website by O2 Design Studio (opens in a new tab)"><span class="o2-credit__lockup"><svg class="o2-credit__mark" viewBox="0 0 158.1 129.7" aria-hidden="true" focusable="false"><path fill="currentColor" d="M56.99 99.51A50 50 0 0 1 33.88 2.67L38 10.97A40.84 40.84 0 0 0 52.65 90.75ZM42.27 0.6A50 50 0 0 1 66.45 97.22L62.34 88.93A40.84 40.84 0 0 0 46.59 9.31ZM157.94 74.78L148.9 74.77C147.72 72.56 147.05 70.73 145.23 68.89C138.08 61.67 125.49 63.06 119.44 70.92L118.43 72.68C116.33 76.4 116.59 78.85 116.23 82.89C113.81 83.15 109.39 83.26 107.04 82.84C106.96 80.45 106.94 77.98 107.43 75.63C109.72 64.58 119.41 55.88 130.73 55.04C140.97 54.28 151.46 58.93 156.12 68.39C157.1 70.38 158.02 72.54 157.94 74.78ZM148.84 83.59C151.04 83.14 155.75 83.23 158.04 83.51C157.97 85.63 157.24 87.64 156.34 89.53C153.35 95.79 148.24 98.9 142.26 101.9C137.63 104.22 133.19 106.96 128.53 109.23C126.42 110.25 120.74 112.92 119.24 114.34C116.45 116.97 117.29 117.47 116.13 119.2L114.32 121.49C112.04 121.8 109.41 121.77 107.13 121.51C106.19 114 111.68 108.04 117.74 104.62C124.34 100.89 131.24 97.68 137.85 93.97C143.08 91.03 146.6 89.67 148.84 83.59ZM121.53 120.51C124.54 119.99 135.15 120.36 138.93 120.36C142.92 120.36 154.81 119.99 157.91 120.49L157.85 129.51C154.88 129.77 151.82 129.6 148.83 129.59L135.02 129.59C130.67 129.59 119.91 129.95 116.29 129.48C117.52 126.27 119.99 123.58 121.53 120.51Z"/></svg>Design Studio</span></a>';
  function credit() { const tp = document.createElement('template'); tp.innerHTML = O2_CREDIT; return tp.content.firstElementChild; }
  /* Column titles are h2s (styled as small labels) so the outline never skips a level,
     and none repeats the first link under it. The street address is the one the shop
     publishes on its Google Business Profile. */
  function render() {
    const phone = LHF.i18n.lang === 'en' ? S.phoneIntl : S.phoneDisplay;
    return h('div.wrap',
      h('div.footer-in',
        h('div.footer-brand', LHF.img.el('logo_sm', { alt: S.name }), h('div.tag-line', t('footer.tag')), h('p.small.muted', t('footer.hours'), h('br'), t('footer.area')), h('div.socials', LHF.nav.social('ig'), LHF.nav.social('fb'), LHF.nav.social('line'))),
        h('div', h('h2.footer-h', t('visit.title')), h('ul',
          h('li', h('a', { href: S.lineUrl, target: '_blank', rel: 'noopener' }, 'LINE ', S.lineId)),
          h('li', h('a', { href: 'tel:' + S.phoneTel }, t('visit.phone'), ' ', h('span.num', phone))),
          h('li', h('a', { href: 'mailto:' + S.email }, S.email)),
          h('li.small.muted', LHF.i18n.pick(S.address)),
          h('li', h('a', { href: S.mapsUrl, target: '_blank', rel: 'noopener' }, t('home.dist.map'))))),
        h('div', h('h2.footer-h', t('footer.shop')), h('ul', LHF.catalog.categories.slice(0, 6).map((c) => h('li', h('a', { href: R.href('/flowers', { category: c.id }) }, LHF.i18n.pick(c)))))),
        h('div', h('h2.footer-h', t('nav.occasions')), h('ul', LHF.catalog.occasions.slice(0, 7).map((o) => h('li', h('a', { href: R.href('/occasions/' + o.id) }, LHF.i18n.pick(o))))), h('h2.footer-h', { style: { marginTop: '18px' } }, t('nav.story')), h('ul', h('li', h('a', { href: R.href('/story') }, t('footer.story'))), h('li', h('a', { href: R.href('/instagram') }, t('nav.instagram'))), h('li', h('a', { href: R.href('/privacy') }, t('privacy.link')))))),
      h('div.footer-bottom', h('span', '© ' + LHF.i18n.shopNow().iso.slice(0, 4) + ' ' + S.name + ' · ' + t('footer.place')), credit()));
  }
  function mount() { const f = U.qs('#footer'); U.empty(f).appendChild(render()); }
  return { mount, render };
})();

