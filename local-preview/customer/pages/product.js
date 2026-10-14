/* ---- pages/product.js ---- */
/* =====================================================================
   PRODUCT — a dictionary entry with a photo: meaning, flowers, wrap, size
   ===================================================================== */
LHF.pages.product = function (params) {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, pick = (o) => LHF.i18n.pick(o), C = LHF.catalog;
  const p = C.bySlug(params.slug);
  if (!p) return LHF.pages.notfound();
  const page = h('div.page.page-enter', h('div.wrap.section-tight'));
  const wrap = page.firstChild;
  wrap.appendChild(h('div', { style: { marginBottom: '18px' } }, h('a.tlink', { href: R.href('/flowers') }, ui.icon('back', 16), t('product.back'))));

  /* media */
  let current = p.image;
  const mediaBox = h('div.product-media');
  const picWrap = h('div', { style: { '--ar': p.image ? LHF.img.ratio(p.image) : 0.8 } });
  function showImg(key) { current = key; U.empty(picWrap); picWrap.appendChild(p.image ? LHF.img.pic(key, { eager: true }) : h('div.pcard-noimg', { style: { aspectRatio: '4/5' } }, p.thumb ? LHF.img.el(p.thumb) : ui.heartTag('lg'), h('span', t('product.noPhoto')), ui.btn('Instagram', { href: LHF.data.shop.instagram, target: '_blank', icon: 'ig', className: 'btn-sm' }))); mediaBox.querySelectorAll('.product-thumbs button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.key === key)); }
  mediaBox.appendChild(ui.heartTag());
  mediaBox.appendChild(picWrap); picWrap.classList.add('product-pic');
  if ((p.images || []).length > 1) mediaBox.appendChild(h('div.product-thumbs', p.images.map((k, i) => h('button', { type: 'button', 'data-key': k, 'aria-pressed': k === current, 'aria-label': t('product.photo', { i: i + 1, n: p.images.length }), onClick: () => showImg(k) }, LHF.img.el(k, { alt: '' })))));
  showImg(current);
  const igPosts = LHF.posts.forProduct(p.id);

  /* info */
  let qty = 1;
  const qtyOut = h('output', { 'aria-label': t('product.qty') }, qty);
  /* the total changes with the quantity: announce it */
  const priceEl = h('span.price.price-lg', { 'aria-live': p.pricing === 'tiers' ? 'polite' : null }, ui.priceLabel(p));
  const unitLine = h('div.tiny');
  function refreshPrice() { if (p.pricing === 'tiers') { const unit = LHF.engine.tierPrice(p, qty); priceEl.textContent = LHF.i18n.fmtPrice(unit * qty); unitLine.textContent = qty + ' × ' + LHF.i18n.fmtPrice(unit); } }
  const counter = p.pricing === 'tiers' ? h('div.center', { style: { gap: '12px' } }, h('span.label', t('product.qty')), h('div.counter', h('button', { type: 'button', 'aria-label': t('product.qtyDown'), onClick: () => { qty = Math.max(1, qty - 1); qtyOut.value = qty; refreshPrice(); } }, ui.icon('minus')), qtyOut, h('button', { type: 'button', 'aria-label': t('product.qtyUp'), onClick: () => { qty = Math.min(p.maxQty || 20, qty + 1); qtyOut.value = qty; refreshPrice(); } }, ui.icon('plus'))), unitLine) : null;

  const primaryBtn = p.availability === 'available'
    ? ui.btn(t('product.reserve'), { className: 'btn-primary btn-lg', onClick: (e) => { LHF.heart.add(p.id, qty, { from: e.currentTarget }); setTimeout(() => R.navigate('/order'), 560); } })
    : ui.btn(p.availability === 'seasonal' ? t('product.similar') : t('product.request'), { className: 'btn-primary btn-lg', href: R.href('/custom', { product: p.id }) });

  const info = h('div.product-info',
    h('div.eyebrow', pick(C.category(p.category) || {}) + (p.availability === 'seasonal' ? ' · ' + t('avail.seasonal') : '')),
    h('h1.h1.product-title', ui.thaiWrap(pick(p.name))),
    h('div.product-price-row', h('div', priceEl, p.pricing === 'tiers' ? h('div.tiny', t('product.tiers')) : (p.priceValidUntil ? h('div.tiny', t('product.validTo', { date: LHF.i18n.fmtDate(p.priceValidUntil) })) : null)), p.size ? h('div', h('div.pcard-size', ui.sizeLabel(p)), h('div.ruler-h', { style: { width: Math.round(p.size.w * 2.2) + 'px', maxWidth: '100%' } }, h('span', 'W' + p.size.w))) : null),
    p.pricing === 'tiers' ? h('div.tiers', p.tiers.map((tr, i) => h('div', h('b', (i < p.tiers.length - 1 ? tr.min + '–' + (p.tiers[i + 1].min - 1) : tr.min + '+')), t('price.perBouquet', { price: LHF.i18n.fmtPrice(tr.price) })))) : null,
    counter,
    p.meaning ? h('div.product-meaning', h('div.lbl', t('product.meaning') + ' · ' + t('product.meaningNote')), h('div.txt', pick(p.meaning))) : null,
    h('dl.spec',
      h('div.spec-row', h('dt', t('product.flowers')), h('dd', (p.flowers || []).map((f, i) => [i ? ' · ' : null, h('span.nowrap', pick(C.flower(f) || {}))]))),
      p.wrap ? h('div.spec-row', h('dt', t('product.wrap')), h('dd', pick(p.wrap))) : null,
      p.variants ? h('div.spec-row', h('dt', t('product.variants')), h('dd', pick(p.variants))) : null,
      h('div.spec-row', h('dt', t('product.colors')), h('dd', h('div.center', { style: { gap: '8px', flexWrap: 'wrap' } }, (p.colors || []).map((c) => { const col = C.color(c); return h('span.center', { style: { gap: '6px', fontSize: '14px' } }, h('i.swatch', { style: { background: col.hex, width: '16px', height: '16px' } }), pick(col)); })))),
      h('div.spec-row', h('dt', t('product.occasions')), h('dd', h('div.spec-links', (p.occasions || []).map((o) => h('a.link', { href: R.href('/occasions/' + o) }, pick(C.occasion(o) || {})))))),
      h('div.spec-row', h('dt', t('lead.label')), h('dd', p.availability === 'quote' ? t('lead.ask') : (p.leadNote ? t('lead.handmade') : t('lead.days1')))),
      p.notes ? h('div.spec-row', h('dt', t('product.notes')), h('dd', pick(p.notes))) : null),
    C.customisable(p) ? h('div.notice', ui.heartTag('sm flat'), h('span', t('product.customise'))) : null,
    h('div.product-actions', h('div.row', primaryBtn, ui.btn(LHF.i18n.lang === 'th' ? 'ปรับแบบนี้เป็นของคุณ' : 'Customize this design', {href:R.href('/custom',{product:p.id})}), ui.btn('LINE', { href: LHF.data.shop.lineUrl, target: '_blank', icon: 'line' })), h('div.product-source', p.source && p.source.date ? h('a.link', { href: p.source.url, target: '_blank', rel: 'noopener' }, t('product.source', { date: LHF.i18n.fmtDate(p.source.date, 'short') })) : null)),
    igPosts.length ? h('div', h('div.eyebrow', { style: { marginBottom: '8px' } }, t('product.onInstagram')), h('div.ig-strip', igPosts.map((post) => h('a', { href: post.url, target: '_blank', rel: 'noopener', 'aria-label': pick(post.label) }, LHF.img.el(post.images[0], { alt: '' }))))) : null);
  refreshPrice();

  wrap.appendChild(h('div.product', mediaBox, info));

  /* related */
  const rel = C.related(p, 4);
  if (rel.length) wrap.appendChild(h('section.section', ui.head({ eyebrow: t('product.related'), title: t('home.today.title') }), h('div.pgrid', { 'data-reveal-group': true }, rel.map((q) => LHF.cards.card(q)))));
  return page;
};

