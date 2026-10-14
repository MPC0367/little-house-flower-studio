/* ---- pages/home.js ---- */
/* =====================================================================
   HOME — hero · ribbon · today's bouquets · meanings · occasions ·
   queue receipt · brief · held · distance · final CTA
   ===================================================================== */
LHF.pages = LHF.pages || {};
LHF.pages.home = function () {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, pick = (o) => LHF.i18n.pick(o), S = LHF.data.shop;
  const page = h('div.page.page-enter');

  /* ---- hero ---- */
  const hero = h('section.hero', { 'aria-labelledby': 'hero-title' },
    h('div.hero-in',
      h('div.hero-copy',
        h('div.eyebrow', { 'data-reveal': true }, t('hero.eyebrow')),
        h('h1.display#hero-title', { 'data-reveal': true }, ui.phrases(t('hero.title'))),
        h('p.lede', { 'data-reveal': true }, t('hero.sub')),
        h('div.hero-ctas', { 'data-reveal': true },
          ui.btn(t('hero.cta'), { className: 'btn-primary btn-lg', href: R.href('/order') }),
          ui.btn(t('hero.cta2'), { href: S.lineUrl, target: '_blank', icon: 'line' })),
        h('a.tlink.hero-skip', { href: R.href('/flowers'), 'data-reveal': true }, t('hero.skip'), ui.icon('arrow', 16))),
      h('div.hero-media',
        h('div.hero-scale', { style: { position: 'absolute', inset: 0 } }, LHF.img.pic('box_congrats', { eager: true })),
        h('div.hero-tag', ui.heartTag('lg')),
        h('div.hero-caption', t('hero.caption', { price: ui.priceLabel(LHF.catalog.byId('box-congratulations')) })))));
  page.appendChild(hero);

  /* ---- ribbon with the order facts ---- */
  page.appendChild(ribbon());

  /* ---- today's bouquets ---- */
  const featured = LHF.catalog.featured().filter((p) => p.image);
  page.appendChild(h('section.section', { 'aria-labelledby': 'today-title' }, h('div.wrap',
    h('div.sec-head-row', ui.head({ eyebrow: t('home.today.eyebrow'), title: t('home.today.title'), sub: t('home.today.note'), id: 'today-title' }), h('div.only-desktop', ui.link(R.href('/flowers'), t('home.today.all')))),
    h('div.rail.rail-bleed', { 'data-reveal-group': true }, featured.map((p, i) => LHF.cards.card(p, { eager: i < 2 }))),
    h('div.only-mobile', { style: { marginTop: '12px' } }, ui.link(R.href('/flowers'), t('home.today.all'))))));

  /* ---- meanings ---- */
  const entries = LHF.heart.allEntries().slice(0, 4);
  page.appendChild(h('section.section.meaning-band', { 'aria-labelledby': 'mean-title' }, h('div.wrap',
    ui.head({ eyebrow: t('home.meaning.eyebrow'), title: t('home.meaning.title'), sub: t('home.meaning.sub'), id: 'mean-title' }),
    h('div.entries', { 'data-reveal-group': true }, entries.map(entryCard)),
    h('div', { style: { marginTop: '22px', display: 'flex', gap: '16px', flexWrap: 'wrap' } }, ui.link(R.href('/meanings'), t('home.meaning.all')), h('button.tlink', { type: 'button', onClick: () => LHF.heart.cardSheet() }, t('nav.writeCard'), ui.icon('mail', 16))))));

  /* ---- occasions ---- */
  page.appendChild(h('section.section', { 'aria-labelledby': 'occ-title' }, h('div.wrap',
    ui.head({ eyebrow: t('home.occ.eyebrow'), title: t('home.occ.title'), id: 'occ-title' }),
    h('div.occ-list', { 'data-reveal-group': true }, LHF.catalog.occasions.slice(0, 6).map(occCard)),
    h('div', { style: { marginTop: '18px' } }, ui.link(R.href('/occasions'), t('occ.title'))))));

  page.appendChild(h('div.pleat'));

  /* ---- queue receipt + brief ---- */
  page.appendChild(h('section.section', h('div.wrap.queue-wrap',
    h('div', ui.head({ eyebrow: t('home.queue.eyebrow'), title: t('home.queue.title') }), h('div.receipt', { 'data-reveal': true }, h('div.receipt-head', S.name + ' · ' + t('home.queue.eyebrow')), h('ol.dotlist', [1, 2, 3, 4, 5, 6].filter((n) => n !== 6 || LHF.data.policies.reviewDiscountPct).map((n) => h('li', { class: n === 2 ? 'rose' : '' }, h('span.n', String(n).padStart(2, '0')), h('span', t('queue.' + n, { pct: LHF.data.policies.reviewDiscountPct }))))))),
    h('div.brief-col',
      ui.head({ eyebrow: t('home.custom.eyebrow'), title: t('custom.title') }),
      h('blockquote.quote', { 'data-reveal': true }, t('home.custom.quote'), h('cite', '@littlehouseflower · ' + LHF.i18n.fmtDate('2025-08-19', 'short'))),
      h('div.card-paper.spec-card', { 'data-reveal': true }, h('div.line', h('span', t('brief.budget')), h('span.hand', LHF.i18n.fmtPrice(1500))), h('div.line', h('span', t('brief.brief')), h('span.hand', t('brief.sample'))), h('div.line', h('span', t('brief.ref')), h('span.hand', t('brief.refVal'))), h('div.line', h('span', t('brief.date')), h('span.hand', LHF.i18n.fmtDate(U.addDays(LHF.i18n.shopNow().iso, 2), 'short')))),
      h('div', ui.btn(t('home.custom.cta'), { className: 'btn-primary', href: R.href('/custom') }))))));

  /* ---- held (Instagram preview) ---- */
  const heldPosts = LHF.posts.posts.filter((p) => p.type !== 'reel').slice(0, 6);
  const quotes = LHF.posts.posts.filter((p) => p.type === 'reel' && /[ก-๙]/.test(p.caption.split('\n')[0]) && !p.caption.startsWith('#')).slice(0, 2);
  const tiles = [];
  heldPosts.forEach((p, i) => { tiles.push(heldTile(p, i)); if (i === 2 && quotes[0]) tiles.push(quoteTile(quotes[0])); if (i === 5 && quotes[1]) tiles.push(quoteTile(quotes[1])); });
  page.appendChild(h('section.section', { 'aria-labelledby': 'held-title' }, h('div.wrap',
    h('div.sec-head-row', ui.head({ eyebrow: t('home.held.eyebrow'), title: t('home.held.title'), sub: t('home.held.sub'), id: 'held-title' }), h('div.only-desktop', ui.link(R.href('/instagram'), t('home.held.all')))),
    h('div.held-grid', { 'data-reveal-group': true }, tiles.slice(0, 8)),
    h('div.only-mobile', { style: { marginTop: '12px' } }, ui.link(R.href('/instagram'), t('home.held.all'))))));

  /* ---- distance ---- */
  const districts = [
    { th: 'รัตนาธิเบศร์', en: 'Rattanathibet' }, { th: 'ราชพฤกษ์', en: 'Ratchaphruek' }, { th: 'งามวงศ์วาน', en: 'Ngamwongwan' },
    { th: 'เมืองทองธานี', en: 'Muang Thong Thani', tag: 'เมืองทอง' }, { th: 'สนามบินน้ำ', en: 'Sanambin Nam' }, { th: 'ปากเกร็ด', en: 'Pak Kret' },
  ];
  page.appendChild(h('section.section.wrap-dark', { style: { background: 'var(--wrap)', color: 'var(--paper)' } }, h('div.wrap.dist',
    h('div', ui.head({ eyebrow: '@littlehouseflower · reel', title: t('home.dist.title'), sub: t('home.dist.sub'), titleClass: 'h1' }), h('p.small', { style: { color: '#D9D3C8', maxWidth: '44ch' } }, t('home.dist.fee')), h('p.small', { style: { color: '#D9D3C8' } }, t('home.dist.pickup')), h('div.center', { style: { flexWrap: 'wrap', gap: '10px' } }, ui.btn(t('home.dist.map'), { href: S.mapsUrl, target: '_blank', icon: 'map' }), ui.btn(t('nav.reserve'), { className: 'btn-primary', href: R.href('/order') }))),
    h('ol.route', { 'data-reveal': true }, h('li.home', S.name, h('span.sub', t('strip.zone'))), districts.map((d) => h('li', pick(d), h('span.sub', { lang: 'th' }, '#ร้านดอกไม้' + (d.tag || d.th)))), h('li.end', t('home.dist.bangkok'), h('span.sub', 'Lalamove'))))));

  /* ---- final CTA ---- */
  page.appendChild(h('section.final', h('div.wrap', h('div.stack', h('h2.h1', { 'data-reveal': true }, ui.thaiWrap(t('home.final.title'))), h('p.lede', { style: { margin: '0 auto' }, 'data-reveal': true }, t('home.final.sub')), h('div.hero-ctas', { style: { justifyContent: 'center' }, 'data-reveal': true }, ui.btn(t('nav.reserve'), { className: 'btn-primary btn-lg', href: R.href('/order') }), ui.btn('LINE ' + S.lineId, { href: S.lineUrl, target: '_blank', icon: 'line' }))))));

  return page;

  function ribbon() {
    const items = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => h('span.ribbon-item', i === 0 ? h('span.serif', t('ribbon.0')) : t('ribbon.' + i), h('i.dot')));
    const copy = items.map((n) => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); return c; });
    const track = h('div.ribbon-track', items, copy);
    /* moving text has to be stoppable by touch and keyboard, not only by hover */
    const box = h('div.ribbon', { role: 'region', 'aria-label': t('ribbon.label') }, track);
    const toggle = h('button.ribbon-toggle', { type: 'button', 'aria-label': t('ribbon.pause'), 'aria-pressed': 'false', onClick: () => {
      const paused = !box.classList.contains('is-paused');
      box.classList.toggle('is-paused', paused);
      toggle.setAttribute('aria-pressed', String(paused));
      U.empty(toggle).appendChild(ui.icon(paused ? 'play' : 'pause', 16));
    } }, ui.icon('pause', 16));
    box.appendChild(toggle);
    return box;
  }
  function entryCard(e) {
    const p = e.products[0];
    return h('article.entry', { class: e.id === 'black_wrap' ? 'dark' : '' },
      h('div.entry-head', h('span.headword', e.flower.en, h('span.n', 'n.')), h('span.entry-th', e.flower.th)),
      h('p.entry-def', pick(e.flower.meaning)),
      h('div.entry-foot', h('div.thumbs', e.products.slice(0, 3).map((q) => h('a', { href: R.href('/flowers/' + q.slug), 'aria-label': pick(q.name) }, LHF.img.el(q.image, { alt: '' })))), p ? h('a.tlink', { href: R.href('/flowers/' + p.slug) }, ui.priceLabel(p), ui.icon('arrow', 14)) : null));
  }
  function occCard(o) {
    const n = LHF.catalog.filter({ occasion: o.id, includeSeasonal: true }).length;
    return h('article.occ-card', LHF.img.pic(o.image, { decorative: true }), h('div', h('h3.t', pick(o)), h('div.tag-line', o.tag), h('div.d', pick(o.blurb)), h('div.tiny', { style: { marginTop: '6px' } }, n ? t(n === 1 ? 'occ.count1' : 'occ.count', { n }) : t('occ.noneYet'))), h('a.cover', { href: R.href('/occasions/' + o.id), 'aria-label': pick(o) }));
  }
  function heldTile(p, i) {
    return h('a.tile', { href: R.href('/instagram', { post: p.id }), 'aria-label': pick(p.label) }, LHF.img.el(p.images[0], { alt: '' }), h('span.lab', pick(p.label)));
  }
  function quoteTile(p) {
    return h('a.tile.quote-tile', { href: p.url, target: '_blank', rel: 'noopener' }, h('span', p.caption.split('\n')[0]), h('small', '@littlehouseflower · ' + t('ig.reel') + (p.views ? ' · ' + t('ig.views', { n: U.fmtNumber(p.views) }) : '')));
  }
};
