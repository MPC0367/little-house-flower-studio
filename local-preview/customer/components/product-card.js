/* ---- components/product-card.js ---- */
/* =====================================================================
   product card + ledger row. Card aspect ratio follows the posted W×H.
   ===================================================================== */
LHF.cards = (function () {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, pick = (o) => LHF.i18n.pick(o);

  function ratioFor(p) {
    if (p.size && p.size.w && p.size.h) { const r = p.size.w / p.size.h; return U.clamp(r, 0.68, 1.05); }
    if (p.image) return U.clamp(LHF.img.ratio(p.image), 0.62, 1);
    return 0.8;
  }
  function availabilityTag(p) {
    if (p.availability === 'seasonal') return h('span.pcard-badge', t('price.seasonal'));
    if (p.availability === 'quote') return h('span.pcard-badge', t('avail.quote'));
    if (p.leadNote) return h('span.pcard-badge', t('lead.handmade'));
    return null;
  }
  function meaningLine(p) {
    if (p.meaning) return pick(p.meaning);
    const fl = (p.flowers || []).map((f) => LHF.catalog.flower(f)).filter(Boolean);
    return fl.map((f) => pick(f)).join(' · ');
  }

  function card(p, opts) {
    opts = opts || {};
    const href = R.href('/flowers/' + p.slug);
    const media = p.image
      ? h('div.pcard-media', { style: { '--ar': ratioFor(p), '--pos': p.portrait ? '50% 30%' : '50% 35%' } }, ui.heartTag('sm'), availabilityTag(p), ui.mediaStatus(LHF.img.pic(p.image, { eager: opts.eager }),{nestedControl:true}),
          p.size && !opts.noRuler ? h('div.pcard-ruler', { 'aria-hidden': 'true' }, h('span', 'H' + p.size.h)) : null)
      : h('div.pcard-media.pcard-noimg', { style: { '--ar': 0.9 } }, p.thumb ? LHF.img.el(p.thumb, { alt: '' }) : ui.heartTag('lg'), h('span.small', t('product.noPhoto')));
    const el = h('article.pcard', { 'data-id': p.id },
      media,
      h('div.pcard-body',
        h('h3.pcard-name', pick(p.name)),
        h('p.pcard-meaning', meaningLine(p)),
        h('div.pcard-foot', h('span.pcard-size', p.size ? ui.sizeLabel(p) : ''), h('span.pcard-price.price.price-md', ui.priceLabel(p))),
        opts.micro !== false && LHF.catalog.customisable(p) ? h('div.pcard-micro', p.pricing === 'tiers' ? pick(p.notes) : t('product.customise')) : null),
      h('a.cover', { href, 'aria-label': pick(p.name) }));
    return el;
  }

  function ledgerRow(p) {
    const href = R.href('/flowers/' + p.slug);
    return h('a.ledger-row', { href },
      p.image ? LHF.img.el(p.image, { alt: '' }) : h('span.thumb-empty', ui.heartTag('sm')),
      h('div', h('div.ledger-name', pick(p.name)), h('div.ledger-meta', (p.flowers || []).slice(0, 4).map((f) => pick(LHF.catalog.flower(f) || {})).join(' · '))),
      h('div.ledger-meta.only-desktop', p.size ? ui.sizeLabel(p) : (p.availability === 'seasonal' ? t('avail.seasonal') : ''), p.leadNote ? h('span', ' · ', t('lead.handmade')) : null),
      h('div.ledger-price', h('span.price.price-md', ui.priceLabel(p)), p.pricing === 'tiers' && LHF.engine.priceKind(p)!=='quote' ? h('span.sub', tierLine(p)) : (p.pricing === 'range' ? h('span.sub', t('avail.seasonal')) : null)));
  }
  /* the quantity breaks after the first tier, read from the catalogue so the
     price list and the product page can never disagree */
  function tierLine(p) {
    const tiers = p.tiers || [];
    return tiers.slice(1).map((tr, i) => { const next = tiers[i + 2]; return (next ? tr.min + '–' + (next.min - 1) : tr.min + '+') + ': ' + LHF.i18n.fmtPrice(tr.price); }).join(' · ');
  }

  function grid(products, opts) {
    const g = h('div.pgrid', { 'data-reveal-group': true }, products.map((p, i) => card(p, Object.assign({ eager: i < 2 }, opts))));
    return g;
  }
  return { card, ledgerRow, grid, ratioFor, meaningLine };
})();

