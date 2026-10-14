/* ---- pages/occasions.js ---- */
/* =====================================================================
   OCCASIONS — editorial list, and one page per occasion
   ===================================================================== */
LHF.pages.occasions = function () {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, pick = (o) => LHF.i18n.pick(o), C = LHF.catalog;
  const page = h('div.page.page-enter', h('div.wrap.section-tight',
    ui.head({ eyebrow: t('home.occ.eyebrow'), title: t('occ.title'), sub: t('occ.sub'), level: 'h1', titleClass: 'h1' }),
    h('div.occ-list', { 'data-reveal-group': true }, C.occasions.map((o) => {
      const n = C.filter({ occasion: o.id, includeSeasonal: true }).length;
      return h('article.occ-card', ui.mediaStatus(LHF.img.pic(o.image, { decorative: true }),{nestedControl:true}), h('div', h('h2.t', pick(o)), h('div.tag-line', o.tag), h('div.d', pick(o.blurb)), h('div.tiny', { style: { marginTop: '6px' } }, n ? t(n === 1 ? 'occ.count1' : 'occ.count', { n }) : t('occ.noneYet'))), h('a.cover', { href: R.href('/occasions/' + o.id), 'aria-label': pick(o) }));
    }))));
  return page;
};

LHF.pages.occasion = function (params) {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, pick = (o) => LHF.i18n.pick(o), C = LHF.catalog;
  const o = C.occasion(params.id);
  if (!o) return LHF.pages.notfound();
  const items = C.filter({ occasion: o.id, includeSeasonal: true });
  const page = h('div.page.page-enter', h('div.wrap.section-tight'));
  const wrap = page.firstChild;
  wrap.appendChild(h('div', { style: { marginBottom: '18px' } }, h('a.tlink', { href: R.href('/occasions') }, ui.icon('back', 16), t('occ.title'))));
  wrap.appendChild(h('div.occ-hero', h('div', ui.head({ eyebrow: o.tag, title: pick(o), sub: pick(o.blurb), level: 'h1', titleClass: 'h1' }), o.seasonal ? h('div.notice', ui.heartTag('sm flat'), h('span', t('occ.seasonalNote') + ' · ' + o.seasonal.split('-').reverse().join('/'))) : null, h('div.hero-ctas', { style: { marginTop: '16px' } }, ui.btn(t('nav.reserve'), { className: 'btn-primary', href: R.href('/order') }), ui.btn(t('nav.custom'), { href: R.href('/custom', { occasion: o.id }) }))), LHF.img.pic(o.image, { eager: true })));
  wrap.appendChild(h('section.section', ui.head({ eyebrow: t('occ.see'), title: o.listTitle ? pick(o.listTitle) : t('occ.listTitle') }), items.length ? LHF.cards.grid(items) : h('div.empty', t('occ.noneYet'), h('div', { style: { marginTop: '12px' } }, ui.btn(t('nav.custom'), { className: 'btn-primary', href: R.href('/custom', { occasion: o.id }) })))));
  return page;
};
