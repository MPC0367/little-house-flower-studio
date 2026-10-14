/* ---- pages/instagram.js ---- */
/* =====================================================================
   INSTAGRAM — "Held": masonry of real posts, quote tiles, story viewer
   ===================================================================== */
LHF.pages.instagram = function (params, query) {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, pick = (o) => LHF.i18n.pick(o), P = LHF.posts, S = LHF.data.shop;
  /* the chosen chip lives in the URL (?tag=), so a reload, a shared link or a
     language switch keeps it; an unknown tag falls back to all posts */
  let filter = P.filters.some((f) => f.id === query.tag) ? query.tag : 'all';
  let shown = Math.max(14,Math.min(500,Number.parseInt(query.count,10)||14));
  const syncQuery=()=>{try{history.replaceState(history.state,'',R.href('/instagram',{tag:filter==='all'?'':filter,count:shown>14?shown:''}));}catch{}};
  const page = h('div.page.page-enter', h('div.wrap.section-tight'));
  const wrap = page.firstChild;
  wrap.appendChild(h('div.ig-head', ui.head({ eyebrow: t('home.held.eyebrow'), title: t('ig.title'), sub: t('ig.sub'), level: 'h1', titleClass: 'h1' }),
    h('div.ig-profile', LHF.img.el('logo_sm', { alt: '' }), h('div.meta', h('b', S.name), ' · @littlehouseflower', h('br'), h('a.link', { href: S.instagram, target: '_blank', rel: 'noopener' }, 'Instagram'), ' · ', h('a.link', { href: S.facebook, target: '_blank', rel: 'noopener' }, 'Facebook')), ui.btn('@littlehouseflower', { href: S.instagram, target: '_blank', icon: 'ig', className: 'btn-sm' })),
    h('div', h('div.tiny', { style: { marginBottom: '8px' } }, t('ig.highlights')), h('div.avatar-row', P.highlights.map((hl) => h('a', { href: hl.url, target: '_blank', rel: 'noopener' }, LHF.img.el(hl.image, { alt: hl.label }), h('span', hl.label)))))));

  const status = h('p.sr-only', { role: 'status' });
  const chips = h('div.chips', P.filters.map((f) => h('button.chip', { type: 'button', 'aria-pressed': filter === f.id, 'data-filter':f.id, onClick: () => {
    filter = f.id; shown = 14;
    chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.filter === f.id));
    syncQuery();
    render();
    status.textContent = t('ig.count', { n: items().length });
  } }, pick(f))));
  wrap.appendChild(h('div.ig-filters', chips));
  const count=h('p.count-line');wrap.appendChild(count);
  wrap.appendChild(status);
  const grid = h('div.masonry');
  const more = h('div.ig-foot');
  wrap.appendChild(grid); wrap.appendChild(more);

  function items() { return P.byTag(filter); }
  function render() {
    const list = items();
    U.empty(grid); U.empty(more);
    const visible = list.slice(0, shown);
    count.textContent=t('ig.count',{n:list.length});
    if(!list.length)grid.appendChild(h('div.empty',LHF.i18n.lang==='th'?'ยังไม่มีภาพในหมวดนี้':'No photographs in this selection yet.',ui.btn(LHF.i18n.lang==='th'?'ดูภาพทั้งหมด':'Show all photographs',{onClick:()=>{filter='all';shown=14;chips.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c.dataset.filter==='all'));syncQuery();render();}})));
    visible.forEach((p, i) => {
      const isQuote = p.type === 'reel' && !p.caption.startsWith('#') && /[ก-๙]/.test(p.caption.split('\n')[0]);
      if (isQuote && filter !== 'reel') {
        grid.appendChild(h('button.mtile.quote', { type: 'button', onClick: e => LHF.viewer.open(list, i, e.currentTarget) }, ui.heartTag('sm'), h('span', p.caption.split('\n')[0]), h('small', '@littlehouseflower · ' + t('ig.reel') + (p.views ? ' · ' + U.fmtNumber(p.views) : ''))));
        return;
      }
      const key = p.images[0];
      const tile = h('button.mtile', { type: 'button', style: { '--ar': LHF.img.ratio(key) }, 'aria-label': pick(p.label), onClick: e => LHF.viewer.open(list, i, e.currentTarget) },
        ui.mediaStatus(LHF.img.pic(key, { eager: i < 4 }),{nestedControl:true}), h('span.ov'), p.type === 'reel' ? h('span.kind', ui.icon('play')) : (p.images.length > 1 ? h('span.kind', ui.icon('copy')) : null),
        h('span.lab', pick(p.label), p.productId ? ' · ' + ui.priceLabel(LHF.catalog.byId(p.productId)) : ''));
      grid.appendChild(tile);
    });
    /* keyboard focus moves to the first new post instead of falling to the page */
    if (list.length > shown) more.appendChild(ui.btn(t('ig.loadMore'), { onClick: () => { const before = grid.children.length; shown += 12; syncQuery(); render(); const first = grid.children[before]; if (first) first.focus(); } }));
    more.appendChild(h('p.small.muted', t('ig.follow')));
    more.appendChild(h('div.socials', LHF.nav.social('ig'), LHF.nav.social('fb'), LHF.nav.social('line')));
  }
  render();
  if (query.post) { const list = items(); const idx = list.findIndex((p) => p.id === query.post); if (idx > -1) setTimeout(() => {if(page.isConnected)LHF.viewer.open(list, idx);}, 80); }
  return page;
};

