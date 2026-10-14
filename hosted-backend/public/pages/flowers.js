/* ---- pages/flowers.js ---- */
/* =====================================================================
   FLOWERS — photos or ledger, filters by type / occasion / colour
   ===================================================================== */
LHF.pages.flowers = function (params, query) {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, pick = (o) => LHF.i18n.pick(o), C = LHF.catalog;
  /* the URL is the filter state; a value that is not in the catalogue falls
     back to "all", never to an empty grid */
  const known = (list, v) => (v && list.some((o) => o.id === v) ? v : '');
  const VIEWS = ['cards', 'ledger'];
  const state = { search: query.search || '', sort: ['featured','price-asc','price-desc'].includes(query.sort) ? query.sort : 'featured', view: VIEWS.includes(query.view) ? query.view : (VIEWS.includes(LHF.store.get('ui').flowersView) ? LHF.store.get('ui').flowersView : 'cards'), category: known(C.categories, query.category), occasion: known(C.occasions, query.occasion), color: known(C.colors, query.color) };
  const page = h('div.page.page-enter', h('div.wrap'));
  const wrap = page.firstChild;
  wrap.appendChild(h('div.section-tight', ui.head({ eyebrow: t('home.today.eyebrow'), title: t('flowers.title'), sub: t('flowers.sub'), level: 'h1', titleClass: 'h1' })));

  const sel = (name, list, label) => {
    const s = h('select.select', { 'aria-label': label, onChange: (e) => { state[name] = e.target.value; sync(); } }, h('option', { value: '' }, label + ': ' + t('filter.all')), list.map((o) => h('option', { value: o.id, selected: state[name] === o.id }, pick(o))));
    return s;
  };
  const seg = h('div.seg', { role: 'group', 'aria-label': t('flowers.viewLabel') },
    h('button', { type: 'button', 'aria-pressed': state.view === 'cards', onClick: () => { state.view = 'cards'; sync(); } }, t('flowers.view.cards')),
    h('button', { type: 'button', 'aria-pressed': state.view === 'ledger', onClick: () => { state.view = 'ledger'; sync(); } }, t('flowers.view.ledger')));
  const resetFilters = () => { state.category = state.occasion = state.color = state.search = ''; state.sort = 'featured'; searchInput.value = ''; sortInput.value = 'featured'; sync(); };
  const toolbar = h('div.toolbar', h('div.filters', sel('category', C.categories, t('filter.category')), sel('occasion', C.occasions, t('filter.occasion')), sel('color', C.colors, t('filter.color')), h('button.btn.btn-ghost.btn-sm', { type: 'button', onClick: resetFilters }, t('filter.clear'))), seg);
  const searchInput=h('input.input',{type:'search',value:state.search,placeholder:LHF.i18n.lang==='th'?'ชื่อช่อหรือดอกไม้':'Name or flower',onInput:e=>{state.search=e.target.value;sync();}});
  const sortInput=h('select.select',{onChange:e=>{state.sort=e.target.value;sync();}},[['featured','แนะนำ','Featured'],['price-asc','ราคาน้อยไปมาก','Price: low to high'],['price-desc','ราคามากไปน้อย','Price: high to low']].map(([id,th,en])=>h('option',{value:id,selected:state.sort===id},LHF.i18n.lang==='th'?th:en)));
  wrap.appendChild(h('div.filter-search',h('label',LHF.i18n.lang==='th'?'ค้นหาดอกไม้':'Search flowers',searchInput),h('label',LHF.i18n.lang==='th'?'เรียงตาม':'Sort by',sortInput)));
  wrap.appendChild(toolbar);
  const activeFilters = h('div.active-filters', { 'aria-label': LHF.i18n.lang === 'th' ? 'ตัวกรองที่เลือก' : 'Selected filters' });
  wrap.appendChild(activeFilters);
  const countLine = h('div.count-line', { 'aria-live': 'polite' });
  const body = h('div');
  /* the card names are h3: give them the h2 the outline expects */
  wrap.appendChild(h('h2.sr-only', t('flowers.listTitle')));
  wrap.appendChild(countLine); wrap.appendChild(body);

  function list() {
    const list=C.filter({ category: state.category, occasion: state.occasion, color: state.color, includeSeasonal: true }).filter(p=>!state.search||[p.name.th,p.name.en,...(p.flowers||[]).map(f=>[C.flowers[f]?.th || '', C.flowers[f]?.en || ''].join(' '))].join(' ').toLowerCase().includes(state.search.trim().toLocaleLowerCase()));
    if(state.sort!=='featured')list.sort((a,b)=>{const aq=LHF.engine.priceKind(a)==='quote',bq=LHF.engine.priceKind(b)==='quote';if(aq!==bq)return aq?1:-1;return aq?0:(state.sort==='price-desc'?-1:1)*(a.price-b.price);});return list;
  }
  function sync() {
    LHF.store.update('ui', { flowersView: state.view });
    seg.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', (i === 0) === (state.view === 'cards')));
    toolbar.querySelectorAll('select').forEach((s) => { const n = ['category', 'occasion', 'color'][Array.from(toolbar.querySelectorAll('select')).indexOf(s)]; s.value = state[n]; });
    U.empty(activeFilters);
    const labels = {category:t('filter.category'),occasion:t('filter.occasion'),color:t('filter.color'),search:LHF.i18n.lang==='th'?'ค้นหา':'Search'};
    const optionLists = {category:C.categories,occasion:C.occasions,color:C.colors};
    ['category','occasion','color','search'].forEach(key => {
      if (!state[key]) return;
      const label = labels[key]+': '+(key==='search' ? state[key] : pick(optionLists[key].find(o=>o.id===state[key])));
      activeFilters.appendChild(h('button.chip.filter-chip', {type:'button', 'aria-label':(LHF.i18n.lang==='th'?'ลบ ':'Remove ')+label, onClick:()=>{state[key]='';if(key==='search')searchInput.value='';sync();searchInput.focus({preventScroll:true});}},label,h('span',{'aria-hidden':'true'},' ×')));
    });
    activeFilters.hidden = !activeFilters.childElementCount;
    const items = list();
    countLine.textContent = items.length + ' · ' + (state.view === 'cards' ? t('flowers.view.cards') : t('flowers.view.ledger'));
    /* every filter change reaches the URL, an empty result included; the
       router's entry id in history.state is kept so Back restores the scroll */
    try { history.replaceState(history.state, '', R.href('/flowers', { view: state.view, category: state.category, occasion: state.occasion, color: state.color, search:state.search, sort:state.sort })); } catch (e) {}
    U.empty(body);
    if (!items.length) { body.appendChild(h('div.empty', t('flowers.empty'), h('div.empty-actions', ui.btn(LHF.i18n.lang==='th'?'ล้างทั้งหมด':'Clear all filters', { onClick:()=>{resetFilters();searchInput.focus({preventScroll:true});} })), h('div', { style: { marginTop: '12px' } }, ui.btn(t('nav.custom'), { className: 'btn-primary', href: R.href('/custom') })))); return; }
    if (state.view === 'cards') body.appendChild(LHF.cards.grid(items));
    else body.appendChild(h('div.ledger', items.map(LHF.cards.ledgerRow)));
    ui.reveal(body);
  }
  sync();
  wrap.appendChild(h('div.section-tight', h('div.notice', ui.heartTag('sm flat'), h('span', t('queue.3'), ' ', h('a.tlink', { href: R.href('/custom') }, t('nav.custom'), ui.icon('arrow', 14))))));
  return page;
};
