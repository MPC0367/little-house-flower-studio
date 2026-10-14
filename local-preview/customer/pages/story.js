/* ---- pages/story.js ---- */
/* =====================================================================
   STORY — only what is verified: the little studio, the ritual, the voice
   ===================================================================== */
LHF.pages.story = function () {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, S = LHF.data.shop;
  const quotes = LHF.posts.posts.filter((p) => p.type === 'reel' && !p.caption.startsWith('#') && /[ก-๙]/.test(p.caption.split('\n')[0])).slice(0, 3);
  const page = h('div.page.page-enter',
    h('div.wrap.section-tight', h('div.story-hero',
      h('div.stack', ui.head({ eyebrow: t('story.eyebrow'), title: t('story.title'), level: 'h1', titleClass: 'display' }), h('div.prose.measure', h('p.lede', t('story.p1')), h('p', t('story.p2'))), h('div.hero-ctas', ui.btn(t('nav.reserve'), { className: 'btn-primary', href: R.href('/order') }), ui.btn(t('nav.instagram'), { href: R.href('/instagram') }))),
      LHF.img.pic('lily_lisianthus', { eager: true }))),
    h('div.pleat'),
    h('section.section', h('div.wrap.queue-wrap',
      h('div', ui.head({ eyebrow: t('home.queue.eyebrow'), title: t('story.how') }), h('div.receipt', h('div.receipt-head', S.name + ' · ' + t('story.howShort')), h('ol.dotlist', [1, 2, 3].map((n) => h('li', h('span.n', '0' + n), h('span', t('story.how' + n))))), h('p.tiny', { style: { marginTop: '14px' } }, h('a.link', { href: S.facebook, target: '_blank', rel: 'noopener' }, 'facebook.com/Littlehouseflower')))),
      h('div', ui.head({ eyebrow: t('story.materialsEyebrow'), title: t('story.materials') }), h('div.materials', { 'data-reveal-group': true },
        h('div.material', h('div.sym', ui.heartTag()), h('div', t('story.m1'))),
        h('div.material', h('div.sym', h('div.ribbon-mini', 'LOVE IS ETERNAL')), h('div', t('story.m2'))),
        h('div.material', h('div.sym', h('div.card-mini')), h('div', t('story.m3'))),
        h('div.material', h('div.sym', h('div.swatches', h('i', { style: { background: '#F4F1EA' } }), h('i', { style: { background: '#1B1A1A' } }), h('i', { style: { background: '#F4A9B1' } }), h('i', { style: { background: '#A9C4DD' } }))), h('div', t('story.m4'))))))),
    h('section.section-tight', h('div.wrap', h('div.story-grid', { 'data-reveal-group': true }, ['white_rose', 'red_black', 'single_rose', 'box_congrats'].map((k) => LHF.img.pic(k))))),
    h('section.section', h('div.wrap', ui.head({ eyebrow: '@littlehouseflower · reels', title: t('story.voice') }), h('div.voice-list', { 'data-reveal-group': true }, quotes.map((q) => h('a.voice', { href: q.url, target: '_blank', rel: 'noopener' }, h('span', q.caption.split('\n')[0]), h('small', LHF.i18n.fmtDate(q.date, 'short') + (q.views ? ' · ' + t('ig.views', { n: U.fmtNumber(q.views) }) : ''))))))),
    h('section.section-tight', h('div.wrap', h('div.center', { style: { flexWrap: 'wrap', gap: '14px' } }, h('span.small.muted', t('story.social')), h('div.socials', LHF.nav.social('ig'), LHF.nav.social('fb'), LHF.nav.social('line'))))));
  return page;
};

