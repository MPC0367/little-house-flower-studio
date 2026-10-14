/* ---- pages/order.js ---- */
/* =====================================================================
   ORDER — native booking flow: bouquet · date · pick-up/delivery ·
   recipient · card · review. Draft survives refresh and language change.
   ===================================================================== */
LHF.pages.order = function (params, query) {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, pick = (o) => LHF.i18n.pick(o), C = LHF.catalog, E = LHF.engine;
  const STEPS = ['what', 'when', 'how', 'who', 'card', 'review'];
  let settings = LHF.store.get('settings') || LHF.data.bookingDefaults;
  /* merge, never replace: a card written first ("write the card" → use it) must
     survive arriving here with nothing in the queue yet */
  let d = Object.assign({}, LHF.store.draft());
  let tidy = false;
  if (!d.type) { d.type = 'product'; tidy = true; }
  if (!Array.isArray(d.items)) { d.items = []; tidy = true; }
  /* a brief sent on from /custom stays in the order when a bouquet is added
     afterwards (the product page marks the draft as a product order) */
  if (E.hasBrief(d) && d.type !== 'custom') { d.type = 'custom'; tidy = true; }
  if (d.type === 'custom' && !d.custom) { d.type = 'product'; tidy = true; }
  /* drop items whose product left the catalogue; keep each quantity inside the product's range */
  const items0 = d.items.filter((it) => C.byId(it.productId)).map((it) => { const p = C.byId(it.productId); return Object.assign({}, it, { qty: U.clamp(Math.floor(Number(it.qty)) || 1, 1, p.maxQty || 20) }); });
  if (JSON.stringify(items0) !== JSON.stringify(d.items)) { d.items = items0; tidy = true; }
  /* consent is asked fresh on every order and never kept */
  if (d.consent != null) { d.consent = undefined; tidy = true; }
  /* a draft kept in the browser can name a date that has since passed, been
     closed, or fallen inside the lead time — drop it and ask again */
  if (d.date && !E.dateStatus(d.date, E.ctx(settings), null, { type: d.type, leadDays: E.leadFor(d, settings) }).ok) { d = Object.assign({}, d, { date: null, windowId: null, windowLabel: null }); tidy = true; }
  if (tidy) LHF.store.setDraft(d);
  /* a step named in the address is honoured only when every step before it is
     done: Back from the confirmation, or an old link, must never open a
     half-empty review. The card can be written first. */
  let step = STEPS.includes(query.step) && canEnter(query.step) ? query.step : firstIncomplete();
  if (query.step && query.step !== step) { try { history.replaceState(null, '', R.href('/order', { step })); } catch (e) { /* the address just stays */ } }
  let loadMap = {};
  let sending = false;
  let flash = '';   // a message for the top of the next step shown
  let errSeq = 0;
  const page = h('div.page.page-enter', h('div.wrap.section-tight'));
  const wrap = page.firstChild;
  const sheet = h('div.book');
  wrap.appendChild(ui.head({ eyebrow: t('nav.reserve'), title: t('book.title'), level: 'h1', titleClass: 'h1' }));
  wrap.appendChild(sheet);

  /* restore banner when a fresh draft exists and we arrived cold */
  if (LHF.store.draftIsFresh() && !query.step && (d.items || []).length + (d.type === 'custom' ? 1 : 0) > 0 && d.date) {
    const bar = h('div.notice.book-restore', h('span', t('book.restore')), h('div.center', ui.btn(t('book.restore.yes'), { className: 'btn-sm btn-primary', onClick: () => { bar.remove(); } }), ui.btn(t('book.restore.no'), { className: 'btn-sm', onClick: () => { LHF.store.clearDraft(); d = { type: 'product', items: [] }; step = 'what'; bar.remove(); render(); } })));
    sheet.appendChild(bar);
  }

  const body = h('div');
  sheet.appendChild(body);
  LHF.db.getSettings().then((s) => { settings = s; LHF.store.set('settings', s); if (step === 'when') render(); });
  /* a tab left open past the 18:00 cut-off, or overnight: when it comes back,
     check the chosen day on the shop's clock before the customer carries on */
  const recheck = () => {
    if (document.visibilityState === 'hidden' || sending || !d.date) return;
    if (E.dateStatus(d.date, E.ctx(settings), null, { type: d.type, leadDays: E.leadFor(d, settings) }).ok) return;
    save({ date: null, windowId: null, windowLabel: null });
    flash = t('book.err.stale');
    if (STEPS.indexOf(step) >= STEPS.indexOf('when')) go('when'); else render();
  };
  document.addEventListener('visibilitychange', recheck);
  window.addEventListener('pageshow', recheck);
  R.onLeave(() => { document.removeEventListener('visibilitychange', recheck); window.removeEventListener('pageshow', recheck); });
  render();
  return page;

  /* ------------------------------------------------------------ */
  function firstIncomplete() {
    if (!((d.items || []).length || E.hasBrief(d))) return 'what';
    if (!d.date) return 'when';
    if (!d.fulfil || !d.windowId) return 'how';
    if (!(d.customer && d.customer.name)) return 'who';
    if (d.card == null) return 'card';
    return 'review';
  }
  function canEnter(s) { return s === 'card' || STEPS.indexOf(s) <= STEPS.indexOf(firstIncomplete()); }
  function save(patch) { d = Object.assign({}, d, patch); LHF.store.setDraft(d); }
  function go(next) {
    if (!canEnter(next)) { next = firstIncomplete(); flash = flash || t('book.err.first'); }
    step = next; try { history.replaceState(null, '', R.href('/order', { step })); } catch (e) {} render(); window.scrollTo({ top: Math.max(0, sheet.getBoundingClientRect().top + window.scrollY - 90), behavior: U.reducedMotion() ? 'auto' : 'smooth' });
  }
  /* the steps as a list a screen reader can read: where you are, and what is done */
  function progress() {
    const i = STEPS.indexOf(step);
    return h('div.book-progress',
      h('div.steps', { 'aria-hidden': 'true' }, STEPS.map((s, k) => h('div.step', { class: k < i ? 'done' : k === i ? 'cur' : '' }))),
      h('ol.step-labels', { 'aria-label': t('book.progress') }, STEPS.map((s, k) => h('li', { class: k === i ? 'cur' : '', 'aria-current': k === i ? 'step' : null }, k < i ? h('span.sr-only', t('book.progress.done') + ' ') : null, t('book.step.' + s)))));
  }
  function nav(opts) {
    const i = STEPS.indexOf(step);
    return h('div.book-nav', i > 0 ? ui.btn(t('book.back'), { onClick: () => go(STEPS[i - 1]), icon: 'back' }) : h('span'), h('span.spacer'), opts.next !== false ? ui.btn(opts.label || t('book.next'), { className: 'btn-primary btn-lg', iconRight: 'arrow', onClick: opts.onNext, type: opts.submit ? 'submit' : 'button' }) : null);
  }
  function render() {
    U.empty(body);
    body.appendChild(progress());
    const s = { what: stepWhat, when: stepWhen, how: stepHow, who: stepWho, card: stepCard, review: stepReview }[step]();
    if (flash) { s.insertBefore(h('div.notice.rose', { role: 'alert' }, flash), s.children[1] || null); flash = ''; }
    body.appendChild(s);
    ui.reveal(body);
    /* the control that was focused has just been removed — move focus to the new step */
    const head = body.querySelector('.book-sheet > h2');
    if (head) { head.setAttribute('tabindex', '-1'); head.focus({ preventScroll: true }); }
  }
  /* an error sits in the field it is about, is tied to the control, and marks it invalid */
  function fieldErr(el, msg) {
    const f = el.closest('.field'); if (!f) return;
    f.classList.toggle('is-error', !!msg);
    let e = f.querySelector('.error');
    if (msg) {
      if (!e) { e = h('div.error', { id: 'order-err-' + (++errSeq) }); f.appendChild(e); }
      e.textContent = msg;
      el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', e.id);
    } else {
      if (e) e.remove();
      el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby');
    }
  }
  function errMsg(code) { return code === 'phone' ? t('book.err.phone') : code === 'mobile' ? t('book.err.mobile') : code === 'long' ? t('book.err.long') : t('book.err.required'); }
  function focusFirstInvalid() {
    const f = body.querySelector('[aria-invalid="true"]');
    if (!f) return;
    const target = f.matches('input, select, textarea') ? f : f.querySelector('input:not([disabled])');
    if (target) target.focus();
  }
  /* prices as the order may state them: exact, "from", or on request */
  function unitLabel(i) { return i.kind === 'quote' ? t('price.quote') : i.kind === 'from' ? t('price.from', { price: LHF.i18n.fmtPrice(i.unit) }) : LHF.i18n.fmtPrice(i.unit); }
  function briefLine(cu, noBudget) {
    const p = cu.fromProduct ? C.byId(cu.fromProduct) : null;
    const fmt = LHF.i18n.fmtPrice, tr = (settings.budgetTiers || LHF.data.bookingDefaults.budgetTiers).find((x) => x.id === cu.budgetTier);
    const budget = Number(cu.budgetCustom) > 0 ? fmt(cu.budgetCustom) : tr ? (tr.max ? fmt(tr.min) + ' – ' + fmt(tr.max) : fmt(tr.min) + '+') : '';
    return [p ? pick(p.name) : '', t('custom.style.' + (cu.style || 'bouquet')), pick(C.occasion(cu.occasion) || {}), noBudget ? '' : budget].filter(Boolean).join(' · ');
  }

  /* ---------------- 1. what ---------------- */
  function stepWhat() {
    const list = h('div.book-items');
    const leadNote = h('div.notice.rose', { hidden: true, role: 'status' });
    /* a longer-lead bouquet can make the chosen day impossible: say so now and ask
       for the day again, instead of carrying a forbidden date to the last step */
    function afterChange() {
      if (!d.date) return;
      const lead = E.leadFor(d, settings);
      if (E.dateStatus(d.date, E.ctx(settings), null, { type: d.type, leadDays: lead }).ok) return;
      save({ date: null, windowId: null, windowLabel: null });
      leadNote.hidden = false; leadNote.textContent = t('book.what.dateDropped', { n: lead });
    }
    function renderItems() {
      U.empty(list);
      if (E.hasBrief(d)) list.appendChild(h('div.book-item', h('span.thumb-empty', ui.heartTag('sm flat')), h('div', h('div.n', t('custom.summary')), h('div.m', briefLine(d.custom))), h('div.item-acts', h('a.remove', { href: R.href('/custom') }, t('book.edit')), h('button.remove', { type: 'button', 'aria-label': t('book.remove') + ' ' + t('custom.summary'), onClick: () => { save({ type: 'product', custom: null }); renderItems(); afterChange(); } }, t('book.remove')))));
      E.priceSummary(d).items.forEach((it) => { const p = it.product; list.appendChild(h('div.book-item', p.image ? LHF.img.el(p.image, { alt: '' }) : h('span.thumb-empty'), h('div', h('div.n', pick(p.name)), h('div.m', (it.qty > 1 ? it.qty + ' × ' : '') + unitLabel(it) + (p.size ? ' · ' + ui.sizeLabel(p) : ''))), h('button.remove', { type: 'button', 'aria-label': t('book.remove') + ' ' + pick(p.name), onClick: () => { save({ items: d.items.filter((x) => x.productId !== p.id) }); renderItems(); refreshGrid(); afterChange(); LHF.heart.refresh(); } }, t('book.remove')))); });
      if (!list.children.length) list.appendChild(h('div.empty', t('heart.empty')));
    }
    const grid = h('div.mini-grid');
    function refreshGrid() { grid.querySelectorAll('.mini-card').forEach((c) => { const on = (d.items || []).some((x) => x.productId === c.dataset.id); c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
    C.products.filter((p) => p.availability === 'available' && p.image).forEach((p) => {
      /* adding a bouquet keeps a written brief: the order then carries both */
      grid.appendChild(h('button.mini-card', { type: 'button', 'data-id': p.id, 'aria-pressed': (d.items || []).some((x) => x.productId === p.id), onClick: () => { const has = (d.items || []).some((x) => x.productId === p.id); if (has) save({ items: d.items.filter((x) => x.productId !== p.id) }); else save({ type: E.hasBrief(d) ? 'custom' : 'product', items: (d.items || []).concat([{ productId: p.id, qty: 1, options: {} }]) }); renderItems(); refreshGrid(); afterChange(); LHF.heart.refresh(true); } }, LHF.img.pic(p.image), ui.heartTag('sm'), h('span.n', pick(p.name)), h('span.p', ui.priceLabel(p) + (p.size ? ' · ' + ui.sizeLabel(p) : ''))));
    });
    renderItems(); refreshGrid();
    const colour = h('textarea.textarea', { rows: 2, maxlength: 300, placeholder: t('book.what.colourPh'), onInput: (e) => save({ colourNote: e.target.value }) });
    colour.value = d.colourNote || '';
    const err = h('div.notice.rose', { hidden: true, role: 'alert' }, t('book.err.items'));
    return h('div.book-sheet', h('h2.h2', t('book.what.title')), h('p.lede', t('book.what.sub')), err, leadNote, list, h('div.book-choose', h('h3.h4', t('home.today.title')), grid, h('div', ui.btn(t('book.what.custom'), { href: R.href('/custom'), icon: 'plus' }))), h('label.field', h('span.label', t('book.what.colour')), colour), nav({ onNext: () => { if (!((d.items || []).length || E.hasBrief(d))) { err.hidden = false; return; } go('when'); } }));
  }

  /* ---------------- 2. when ---------------- */
  function stepWhen() {
    const lead = E.leadFor(d, settings);
    const c = E.ctx(settings);
    const note = h('div.date-note', { 'aria-live': 'polite' }, t('book.when.sub'));
    const box = h('div.when-grid');
    const holder = h('div');
    box.appendChild(holder);
    box.appendChild(h('div.stack', note, lead > 1 ? h('div.date-note', t('book.when.lead', { n: lead })) : null, settings.highDemand && settings.highDemand.active ? h('div.date-note.rose', h('b', pick(settings.highDemand.label) || t('book.when.highDemand')), ' ', pick(settings.highDemand.note)) : null));
    const shared = () => LHF.db.sharedCapacity;
    const onSelect = (iso, st) => { save({ date: iso, windowId: null, windowLabel: null }); err.hidden = true; note.className = 'date-note'; note.textContent = LHF.i18n.fmtDate(iso, 'weekday') + (shared() && st.low ? ' · ' + t('book.when.low', { n: st.remaining }) : ''); };
    const onBlocked = (iso, st) => {
      note.className = 'date-note rose'; U.empty(note);
      if (st.reason === 'today') { note.append(t('book.when.today'), h('div', ui.btn('LINE', { href: LHF.data.shop.lineUrl, target: '_blank', icon: 'line', className: 'btn-sm' }))); }
      else if (st.reason === 'full') note.textContent = t('book.when.full');
      else if (st.reason === 'closed') note.textContent = t('book.when.closed');
      else if (st.reason === 'cutoff') note.textContent = t('book.when.cutoff', { h: String(settings.cutoffHour || 18) + ':00' });
      else if (st.reason === 'past') note.textContent = t('cal.past');
      else if (st.reason === 'horizon') note.textContent = t('cal.horizon');
      else note.textContent = t('book.when.lead', { n: lead });
    };
    const calOpts = (v) => ({ settings, loadMap, value: v, type: d.type, leadDays: lead, onSelect, onBlocked, showLoad: shared() });
    let cal = LHF.calendar.create(calOpts(d.date));
    holder.appendChild(cal.el);
    /* day counts exist only where orders are shared (inside the artifact) */
    LHF.db.ready.then((b) => { if (b !== 'artifact') return; LHF.db.loadMap(c.today, c.horizon).then((m) => { loadMap = m; cal = LHF.calendar.create(calOpts(cal.value || d.date)); U.empty(holder).appendChild(cal.el); }).catch(() => {}); });
    const err = h('div.notice.rose', { hidden: true, role: 'alert' }, t('book.err.day'));
    return h('div.book-sheet', h('h2.h2', t('book.when.title')), err, box, nav({ onNext: () => {
      if (!d.date) { err.hidden = false; return; }
      /* the order may have changed since the day was picked (a longer-lead bouquet) */
      if (!E.dateStatus(d.date, E.ctx(settings), loadMap[d.date], { type: d.type, leadDays: E.leadFor(d, settings) }).ok) { save({ date: null, windowId: null, windowLabel: null }); flash = t('book.err.stale'); render(); return; }
      go('how');
    } }));
  }

  /* ---------------- 3. how ---------------- */
  function stepHow() {
    const c = E.ctx(settings);
    const winLabelId = 'how-window-label', titleId = 'how-title';
    const winBox = h('div.windows', { role: 'radiogroup', 'aria-labelledby': winLabelId });
    /* this step can be entered without passing through the calendar (restored
       draft, deep link, language switch), so make sure the day's load is known */
    if (LHF.db.sharedCapacity && !loadMap[d.date]) LHF.db.loadMap(d.date, d.date).then((m) => { loadMap = Object.assign({}, loadMap, m); if (step === 'how') renderWindows(); }).catch(() => {});
    const fulfilCards = h('div.radio-cards.cols-2', { role: 'radiogroup', 'aria-labelledby': titleId });
    function renderWindows() {
      U.empty(winBox);
      if (!d.fulfil) return;
      E.windowsFor(d.date, d.fulfil, c, loadMap[d.date]).forEach((w) => {
        const lab = h('label.window', { class: (w.ok ? '' : 'is-off') + (d.windowId === w.id ? ' is-on' : '') }, h('input', { type: 'radio', name: 'window', value: w.id, disabled: !w.ok, checked: d.windowId === w.id, onChange: () => { save({ windowId: w.id, windowLabel: w.start + '–' + w.end }); winBox.querySelectorAll('.window').forEach((x) => x.classList.toggle('is-on', x === lab)); fieldErr(winBox, ''); } }), h('span', w.start + ' – ' + w.end), h('span.sub', w.gone ? t('book.when.windowGone') : w.full ? t('book.when.windowFull') : (LHF.db.sharedCapacity && w.remaining != null && w.remaining <= 2 ? t('book.when.low', { n: w.remaining }) : '')));
        winBox.appendChild(lab);
      });
    }
    ['pickup', 'delivery'].forEach((f) => {
      const lab = h('label.radio-card', { class: d.fulfil === f ? 'is-on' : '' }, h('input', { type: 'radio', name: 'fulfil', value: f, checked: d.fulfil === f, onChange: () => { save({ fulfil: f, windowId: null, windowLabel: null }); fulfilCards.querySelectorAll('.radio-card').forEach((x) => x.classList.toggle('is-on', x === lab)); addr.hidden = f !== 'delivery'; renderWindows(); } }), h('span.t', h('i.mark'), t('book.how.' + f)), h('span.d', t('book.how.' + f + 'Sub')));
      fulfilCards.appendChild(lab);
    });
    const a = d.address || {};
    const provSel = h('select.select', { 'aria-required': 'true', onChange: (e) => { save({ address: Object.assign({}, d.address, { province: e.target.value, district: '' }) }); renderDistricts(); fieldErr(provSel, ''); } }, h('option', { value: '' }, t('book.how.province')), LHF.data.delivery.provinces.map((p) => h('option', { value: p.id, selected: a.province === p.id }, pick(p))));
    const distWrap = h('label.field', h('span.label', t('book.how.district')));
    const distCtl = () => distWrap.querySelector('.input, .select');
    function renderDistricts() {
      const prov = LHF.data.delivery.provinces.find((p) => p.id === (d.address || {}).province);
      const old = distCtl(); if (old) old.remove();
      fieldErr(distWrap, '');
      if (prov && prov.districts.length) distWrap.appendChild(h('select.select', { 'aria-required': 'true', onChange: (e) => save({ address: Object.assign({}, d.address, { district: e.target.value }) }) }, h('option', { value: '' }, t('book.how.district')), prov.districts.map((x) => h('option', { value: x, selected: (d.address || {}).district === x }, x))));
      else distWrap.appendChild(h('input.input', { maxlength: 80, 'aria-required': 'true', placeholder: t('book.how.district'), value: (d.address || {}).district || '', onInput: (e) => save({ address: Object.assign({}, d.address, { district: e.target.value }) }) }));
    }
    renderDistricts();
    const addrIn = h('textarea.textarea', { rows: 2, maxlength: 500, 'aria-required': 'true', placeholder: t('book.how.addressPh'), onInput: (e) => save({ address: Object.assign({}, d.address, { line: e.target.value }) }) });
    addrIn.value = a.line || '';
    const addr = h('div.stack', { hidden: d.fulfil !== 'delivery' },
      h('label.field', h('span.label', t('book.how.address')), addrIn),
      h('div.field-row', h('label.field', h('span.label', t('book.how.province')), provSel), distWrap),
      h('label.field', h('span.label', t('book.how.landmark')), h('input.input', { maxlength: 200, value: a.note || '', onInput: (e) => save({ address: Object.assign({}, d.address, { note: e.target.value }) }) })),
      h('div.notice', ui.icon('map', 18), h('span', t('home.dist.fee'))));
    renderWindows();
    const err = h('div.notice.rose', { hidden: true, role: 'alert' });
    return h('div.book-sheet', h('h2.h2', { id: titleId }, t('book.how.title')), h('p.small.muted', LHF.i18n.fmtDate(d.date, 'weekday')), err, fulfilCards, h('div.field', h('span.label', { id: winLabelId }, t('book.when.window')), winBox), addr, nav({ onNext: () => {
      const names = [];
      fieldErr(winBox, ''); [addrIn, provSel, distCtl()].forEach((el) => el && fieldErr(el, ''));
      if (!d.fulfil) names.push(t('book.step.how'));
      else if (!d.windowId) { names.push(t('book.when.window')); fieldErr(winBox, t('book.err.window')); }
      if (d.fulfil === 'delivery') {
        const v = E.validate(Object.assign({}, d, { customer: { name: 'xx', phone: '0812345678' }, recipient: { name: 'x', phone: '0812345678' } }), 'who');
        if (v.addressLine) { fieldErr(addrIn, t('book.err.address')); names.push(t('book.how.address')); }
        if (v.province) { fieldErr(provSel, t('book.err.province')); names.push(t('book.how.province')); }
        if (v.district && distCtl()) { fieldErr(distCtl(), t('book.err.district')); names.push(t('book.how.district')); }
      }
      if (names.length) { err.hidden = false; err.textContent = t('book.err.check') + ' ' + names.join(', '); if (!d.fulfil) { const r = fulfilCards.querySelector('input'); if (r) r.focus(); } else focusFirstInvalid(); return; }
      go('who');
    } }));
  }

  /* ---------------- 4. who ---------------- */
  function stepWho() {
    const cu = d.customer || {}, re = d.recipient || {};
    const same = d.sameAsMe !== false && !(re.name && re.name !== cu.name);
    const nameIn = h('input.input', { value: cu.name || '', maxlength: 120, autocomplete: 'name', 'aria-required': 'true', onInput: (e) => save({ customer: Object.assign({}, d.customer, { name: e.target.value }) }) });
    const phoneIn = h('input.input', { value: cu.phone || '', maxlength: 24, type: 'tel', inputmode: 'tel', autocomplete: 'tel', 'aria-required': 'true', placeholder: '08x xxx xxxx', onInput: (e) => save({ customer: Object.assign({}, d.customer, { phone: e.target.value }) }) });
    const lineIn = h('input.input', { value: cu.line || '', maxlength: 40, placeholder: '@', onInput: (e) => save({ customer: Object.assign({}, d.customer, { line: e.target.value }) }) });
    const rName = h('input.input', { value: re.name || '', maxlength: 120, autocomplete: 'off', 'aria-required': 'true', onInput: (e) => save({ recipient: Object.assign({}, d.recipient, { name: e.target.value }) }) });
    const rPhone = h('input.input', { value: re.phone || '', maxlength: 24, type: 'tel', inputmode: 'tel', autocomplete: 'off', 'aria-required': 'true', placeholder: '08x xxx xxxx', onInput: (e) => save({ recipient: Object.assign({}, d.recipient, { phone: e.target.value }) }) });
    const recBox = h('div.stack', { hidden: same }, h('div.field-row', h('label.field', h('span.label', t('book.who.rName')), rName), h('label.field', h('span.label', t('book.who.rPhone')), rPhone)));
    const sameChk = h('label.check', h('input', { type: 'checkbox', checked: same, onChange: (e) => { save({ sameAsMe: e.target.checked }); recBox.hidden = e.target.checked; } }), h('span.box', ui.icon('check')), h('span', t('book.who.sameAsMe')));
    const anon = h('label.check', h('input', { type: 'checkbox', checked: !!d.anonymous, onChange: (e) => save({ anonymous: e.target.checked }) }), h('span.box', ui.icon('check')), h('span', t('book.who.anon')));
    return h('div.book-sheet', h('h2.h2', t('book.who.title')),
      /* the privacy notice sits where the details are asked for */
      h('p.small.muted', t('book.who.privacy'), ' ', h('a.link', { href: R.href('/privacy') }, t('book.privacyLink'))),
      h('h3.h4', t('book.who.you')), h('div.field-row', h('label.field', h('span.label', t('book.who.name')), nameIn), h('label.field', h('span.label', t('book.who.phone')), phoneIn, h('span.hint', t('book.who.phoneHint')))), h('label.field', h('span.label', t('book.who.line')), lineIn),
      h('h3.h4', { style: { marginTop: '8px' } }, t('book.who.recipient')), sameChk, recBox, d.fulfil === 'delivery' ? anon : null,
      nav({ onNext: () => {
        /* read the checkbox live — its state changes after this step was rendered */
        const isSame = sameChk.querySelector('input').checked;
        const cust = { name: nameIn.value.trim(), phone: phoneIn.value.trim(), line: lineIn.value.trim() };
        const rec = isSame ? { name: cust.name, phone: cust.phone } : { name: rName.value.trim(), phone: rPhone.value.trim() };
        save({ customer: cust, recipient: rec, sameAsMe: isSame });
        const v = E.validate(Object.assign({}, d, { customer: cust, recipient: rec }), 'who');
        /* the rider calls the recipient: when that is the orderer, their number must be a Thai mobile too */
        if (isSame && v.recipientPhone && !v.customerPhone) v.customerPhone = 'mobile';
        fieldErr(nameIn, v.customerName && errMsg(v.customerName)); fieldErr(phoneIn, v.customerPhone && errMsg(v.customerPhone));
        fieldErr(rName, !isSame && v.recipientName && errMsg(v.recipientName)); fieldErr(rPhone, !isSame && v.recipientPhone && errMsg(v.recipientPhone));
        const bad = ['customerName', 'customerPhone'].some((k) => v[k]) || (!isSame && ['recipientName', 'recipientPhone'].some((k) => v[k]));
        if (bad) { focusFirstInvalid(); return; }
        go('card');
      } }));
  }

  /* ---------------- 5. card ---------------- */
  function stepCard() {
    const msg = (d.card && d.card.message) || '';
    const count = h('div.count', t('book.card.count', { n: msg.length }));
    const suggest = h('div.card-suggest');
    const ta = h('textarea.textarea.hand', { rows: 5, maxlength: 200, placeholder: t('book.card.ph'), 'aria-label': t('book.card.title'), onInput: (e) => { save({ card: { message: e.target.value } }); count.textContent = t('book.card.count', { n: e.target.value.length }); runSuggest(e.target.value); } });
    /* a textarea's text is its value, not an attribute */
    ta.value = msg;
    let timer;
    function runSuggest(text) { clearTimeout(timer); timer = setTimeout(() => { U.empty(suggest); const found = LHF.heart.lookup(text).slice(0, 2); if (!found.length) return; suggest.appendChild(h('div.tiny', t('mean.match'))); found.forEach((e, i) => { const p = e.products[0]; suggest.appendChild(h('a.lookup-row', { href: p ? R.href('/flowers/' + p.slug) : R.href('/meanings'), style: { '--d': i * 60 + 'ms' } }, p ? LHF.img.el(p.image, { className: 'lookup-thumb', alt: '' }) : h('span.lookup-thumb'), h('div', h('div.entry-head', h('span.headword', e.flower.en, h('span.n', '(N).')), h('span.entry-th', e.flower.th)), h('div.entry-def', pick(e.flower.meaning))))); }); }, 220); }
    if (msg) runSuggest(msg);
    const starters = h('div.starters', [1, 2, 3, 4].map((n) => h('button', { type: 'button', onClick: () => { ta.value = t('book.card.starter' + n); ta.dispatchEvent(new Event('input')); ta.focus(); } }, t('book.card.starter' + n))));
    return h('div.book-sheet', h('h2.h2', t('book.card.title')), h('p.lede', t('book.card.sub')),
      h('div.card-write', h('div.card-paper', ui.heartTag('sm'), ta, count), h('div.tiny', t('book.card.preview')), h('div', h('div.label', { style: { marginBottom: '8px' } }, t('book.card.help')), starters), suggest),
      nav({ onNext: () => { save({ card: { message: ta.value } }); if (ta.value.length > 200) { ui.toast(t('book.err.long')); return; } go('review'); } }));
  }

  /* ---------------- 6. review ---------------- */
  function stepReview() {
    const sum = E.priceSummary(d);
    const brief = E.hasBrief(d);
    let acknowledgedPrice = null;
    /* consent is asked for every order: never ticked in advance, never stored */
    const consentIn = h('input', { type: 'checkbox' });
    const consent = h('div.stack', { style: { display: 'grid', gap: '6px' } }, h('label.check', consentIn, h('span.box', ui.icon('check')), h('span', t('book.review.consent'))), h('p.tiny', h('a.link', { href: R.href('/privacy') }, t('book.privacyLink'))));
    /* honeypot: hidden from people and from assistive technology; a form-filling
       bot fills it in, and its value travels as the top-level `hp` for the script */
    const hp = h('input', { type: 'text', name: 'website', tabindex: -1, autocomplete: 'off' });
    const trap = h('div.sr-only', { 'aria-hidden': 'true' }, hp);
    const err = h('div.notice.rose', { hidden: true, role: 'alert' });
    const fail = h('div.send-fail', { hidden: true, role: 'alert', tabindex: -1 });
    const submitLabel = h('span', t('book.review.submit'));
    const submitBtn = h('button.btn.btn-primary.btn-lg', { type: 'button', onClick: submit }, submitLabel, ui.icon('arrow', 18));
    const editLink = (s) => h('a.edit', { href: R.href('/order', { step: s }), onClick: (e) => { e.preventDefault(); go(s); } }, t('book.edit'));
    const fmt = LHF.i18n.fmtPrice;
    const addr = d.address || {};
    const cust = d.customer || {}, rec = d.recipient || {};
    const whatText = [brief ? t('custom.summary') + ': ' + briefLine(d.custom, true) : ''].concat(sum.items.map((i) => (i.qty > 1 ? i.qty + ' × ' : '') + pick(i.product.name) + (i.kind === 'quote' ? ' (' + t('price.quote') + ')' : ''))).filter(Boolean).join(', ') || '—';
    const delivery = d.fulfil === 'delivery' ? ' + ' + t('book.review.delivery').toLowerCase() : '';
    const rows = h('div.book-summary',
      h('div.row', h('span.k', t('book.step.what'), editLink('what')), h('span', whatText)),
      d.colourNote ? h('div.row', h('span.k', t('book.sum.colour')), h('span', d.colourNote)) : null,
      h('div.row', h('span.k', t('book.step.when'), editLink('when')), h('span', d.date ? LHF.i18n.fmtDate(d.date, 'weekday') + ' · ' + (d.windowLabel || '') : '—')),
      h('div.row', h('span.k', t('book.step.how'), editLink('how')), h('span', (d.fulfil ? t('book.how.' + d.fulfil) : '—') + (d.fulfil === 'delivery' && d.address ? ' · ' + [addr.line, addr.district, pick((LHF.data.delivery.provinces.find((p) => p.id === addr.province) || {}))].filter(Boolean).join(' ') : ''))),
      h('div.row', h('span.k', t('book.step.who'), editLink('who')), h('span', cust.name ? cust.name + ' · ' + E.fmtPhone(cust.phone) + (rec.name && rec.name !== cust.name ? ' → ' + rec.name : '') : '—')),
      brief ? h('div.row', h('span.k', t('custom.step.budget')), h('span', d.custom.budgetCustom ? fmt(d.custom.budgetCustom) : (function () { const tr = (settings.budgetTiers || []).find((x) => x.id === d.custom.budgetTier); return tr ? (tr.max ? fmt(tr.min) + ' – ' + fmt(tr.max) : fmt(tr.min) + '+') : ''; })())) : null,
      sum.subtotal > 0 ? h('div.row', h('span.k', t('book.review.subtotal')), h('span.price.price-sm', sum.items.every((i) => i.kind === 'firm') ? fmt(sum.subtotal) : t('book.review.fromTotal', { price: fmt(sum.subtotal) }))) : null,
      h('div.row', h('span.k', t('book.review.delivery')), h('span.small', d.fulfil === 'delivery' ? t('book.review.deliveryNote') : t('book.review.pickupNote'))),
      sum.hasQuote ? h('div.row', h('span.k', t('book.review.total')), h('span.small', t('book.review.quoteNote'))) : h('div.row.total', h('span.k', t('book.review.total')), h('span.price.price-md', (sum.priceFrom ? t('book.review.fromTotal', { price: fmt(sum.subtotal) }) : fmt(sum.subtotal)) + delivery)),
      sum.priceFrom ? h('div.row', h('span.k', ''), h('span.small', t('book.review.fromNote'))) : null);
    const cardPrev = h('div.card-paper.review-receipt', ui.heartTag('sm'), h('div.tiny', t('done.card')), h('div.hand', (d.card && d.card.message) || '—'), h('div.tiny', t('book.card.sub')));
    const notes = h('div.stack', { style: { display: 'grid', gap: '10px' } },
      brief && d.custom.reference ? h('div.notice', ui.icon('line', 18), h('span', t('book.review.photo'))) : null,
      h('p.small.muted', t('book.review.policy')),
      /* the shop's review promo, mentioned, not a line that changes this order's total */
      h('p.tiny', t('book.review.review5')));
    return h('div.book-sheet', { 'aria-busy': 'false' }, h('h2.h2', t('book.review.title')), h('p.lede', t('book.review.sub')), err, fail, h('div.review-grid', rows, cardPrev), LHF.designSnapshot && E.hasBrief(d) ? LHF.designSnapshot(d.custom) : null, notes, consent, trap, h('div.book-nav', ui.btn(t('book.back'), { onClick: () => go('card'), icon: 'back' }), h('span.spacer'), submitBtn));

    function setBusy(on) {
      submitBtn.disabled = on;
      if (on) submitBtn.setAttribute('aria-disabled', 'true'); else submitBtn.removeAttribute('aria-disabled');
      submitLabel.textContent = t(on ? 'book.review.sending' : 'book.review.submit');
      const s = submitBtn.closest('.book-sheet'); if (s) s.setAttribute('aria-busy', on ? 'true' : 'false');
    }
    /* Honest failure: the order has not reached the shop. Everything typed stays;
       the customer can send again (same reference), send the whole order on LINE
       as a written message, or call. */
    function showFailure(booking) {
      U.empty(fail);
      fail.append(
        h('h3.h4', t('book.fail.title')),
        h('p.small', t('book.fail.body')),
        h('div.send-fail-acts',
          ui.btn(t('book.fail.retry'), { className: 'btn-primary', onClick: submit }),
          ui.btn(t('book.fail.line'), { href: LHF.sink.lineUrl(LHF.sink.summary(booking)), target: '_blank', icon: 'line' }),
          ui.btn(t('book.fail.call', { phone: LHF.data.shop.phoneDisplay }), { href: 'tel:' + LHF.data.shop.phoneTel, icon: 'phone' })));
      fail.hidden = false;
      fail.focus({ preventScroll: true });
      fail.scrollIntoView({ block: 'center', behavior: U.reducedMotion() ? 'auto' : 'smooth' });
    }

    async function submit() {
      if (sending) return;
      err.hidden = true;
      if (!consentIn.checked) { fail.hidden = true; err.hidden = false; err.textContent = t('book.err.consent'); consentIn.focus(); return; }
      const v = E.validate(Object.assign({}, d, { consent: true }));
      if (Object.keys(v).length) {
        fail.hidden = true;
        err.hidden = false;
        const LABELS = { type: t('book.step.what'), items: t('book.step.what'), budget: t('custom.step.budget'), date: t('book.step.when'), fulfil: t('book.step.how'), windowId: t('book.when.window'), customerName: t('book.who.name'), customerPhone: t('book.who.phone'), recipientName: t('book.who.rName'), recipientPhone: t('book.who.rPhone'), addressLine: t('book.how.address'), district: t('book.how.district'), province: t('book.how.province'), cardMessage: t('book.step.card') };
        const names = Array.from(new Set(Object.keys(v).map((k) => LABELS[k]).filter(Boolean)));
        err.textContent = t('book.err.check') + (names.length ? ' ' + names.join(', ') : '');
        return;
      }
      /* the day is checked again on the shop's clock at the moment of sending: a
         tab left open past 18:00, or overnight, must not book what the calendar
         would now refuse */
      const c = E.ctx(settings);
      const st = E.dateStatus(d.date, c, null, { type: d.type, leadDays: E.leadFor(d, settings) });
      const w = st.ok ? E.windowsFor(d.date, d.fulfil, c, null).find((x) => x.id === d.windowId) : null;
      if (!st.ok || !w || !w.ok) {
        save(st.ok ? { windowId: null, windowLabel: null } : { date: null, windowId: null, windowLabel: null });
        flash = t('book.err.stale');
        go(st.ok ? 'how' : 'when');
        return;
      }
      sending = true; setBusy(true);
      const booking = buildBooking();
      let saved = null;
      try {
        // Verify current prices immediately before any durable submission. Image
        // availability does not affect this independent price check.
        await LHF.localSession;
        const checked=await LHF.localAPI('/api/price-check',booking,{signal:AbortSignal.timeout(12000)});
        const cost=e=>e?{kind:e.kind,low:e.low,high:e.high,currency:e.currency||'THB',rulesVersion:e.rulesVersion||null}:null;
        const previous={subtotal:booking.subtotal,hasQuote:booking.hasQuote,priceFrom:booking.priceFrom,quoteOnly:booking.quoteOnly,items:booking.items.map(({productId,qty,unit,line,kind})=>({productId,qty,unit,line,kind})),estimate:cost(booking.custom?.estimate)};
        const current={subtotal:checked.subtotal,hasQuote:checked.hasQuote,priceFrom:checked.priceFrom,quoteOnly:checked.quoteOnly,items:checked.items,estimate:cost(checked.estimate)};
        if(JSON.stringify(previous)!==JSON.stringify(current)&&acknowledgedPrice!==checked.signature){
          acknowledgedPrice=checked.signature;sending=false;setBusy(false);fail.hidden=true;err.hidden=false;
          const th=LHF.i18n.lang==='th',designPrice=checked.estimate?.low!=null?fmt(checked.estimate.low/100)+(checked.estimate.high!==checked.estimate.low?'–'+fmt(checked.estimate.high/100):''):null,amount=designPrice?(th?'ราคาแบบที่เลือก ':'Design estimate ')+designPrice+(checked.subtotal>0?(th?' + สินค้าอื่น ':' + additional products ')+fmt(checked.subtotal):''):checked.hasQuote?(th?'ร้านต้องยืนยันราคา':'Florist price confirmation required'):fmt(checked.subtotal);
          err.textContent=(th?'ข้อมูลราคามีการอัปเดต: ':'Price information has changed: ')+amount+(th?' ไม่รวมค่าจัดส่ง โปรดตรวจสอบแล้วกดยืนยันอีกครั้ง':' · delivery separate. Review this update, then confirm again.');
          submitLabel.textContent=th?'ยอมรับข้อมูลใหม่และส่งคำขอ':'Accept update and send request';err.tabIndex=-1;err.focus({preventScroll:true});return;
        }
        booking.priceCheck=checked.signature;
        if(booking.custom)booking.custom.estimate=checked.estimate;
        await LHF.db.ready;
        if (LHF.db.backend === 'artifact') {
          /* inside the artifact its shared database is the record, and capacity is real there */
          saved = await LHF.db.createBooking(booking, (load) => {
            const c2 = E.ctx(settings);
            const st2 = E.dateStatus(d.date, c2, load, { type: booking.type, leadDays: E.leadFor(d, settings) });
            if (!st2.ok) return st2.reason;
            const w2 = E.windowsFor(d.date, d.fulfil, c2, load).find((x) => x.id === d.windowId);
            if (!w2 || !w2.ok) return w2 && w2.full ? 'full' : 'stale';
            return null;
          });
          try { LHF.sink.send(saved); } catch (e) { console.error(e); }
        } else {
          /* sent first; confirmed only when the shop's script answers ok */
          const res = await LHF.sink.deliver(booking, { hp: hp.value });
          if (!res.ok) { sending = false; setBusy(false); showFailure(booking); return; }
          /* the receipt copy on this phone is a convenience: the order has reached
             the shop, so a browser that refuses storage changes nothing */
          try { saved = await LHF.db.createBooking(booking, null); } catch (e) { saved = booking; }
        }
      } catch (e) {
        sending = false; setBusy(false);
        const code = e && e.code;
        if (code === 'full') { err.hidden = false; err.textContent = t('book.err.slot'); }
        else if (code === 'slot_busy') { err.hidden = false; err.textContent = t('book.err.busy'); }
        else if (['past', 'today', 'leadtime', 'cutoff', 'horizon', 'closed', 'stale'].includes(code)) { save({ windowId: null, windowLabel: null }); flash = t('book.err.stale'); go('how'); return; }
        else showFailure(booking);
        if (!err.hidden) err.scrollIntoView({ block: 'center', behavior: U.reducedMotion() ? 'auto' : 'smooth' });
        console.error(e);
        return;
      }
      /* the confirmation renders from memory, whatever the browser let us store */
      LHF.store.set('lastOrder', Object.assign({}, booking, { id: saved.id || booking.id }));
      LHF.store.clearDraft();
      LHF.heart.refresh();
      /* replace, not push: Back from the confirmation leaves the finished flow */
      R.navigate('/order/done/' + (saved.id || booking.id), { ref: booking.ref }, { replace: true });
    }
  }

  /* One id and reference per order: a retry sends the same ones, so the shop can
     recognise a row that arrived twice. A changed date makes it a new order. */
  function buildBooking() {
    const sum = E.priceSummary(d);
    const brief = E.hasBrief(d);
    let at = d.attempt;
    if (!at || at.date !== d.date || !at.id || !at.ref) { at = { id: U.uid(), ref: E.orderRef(d.date), date: d.date }; save({ attempt: at }); }
    const cust = d.customer || {}, rec = d.recipient || {};
    return {
      id: at.id, ref: at.ref, createdAt: new Date().toISOString(),
      type: brief ? 'custom' : 'product', date: d.date, windowId: d.windowId, windowLabel: d.windowLabel, fulfil: d.fulfil,
      items: sum.items.map((i) => ({ productId: i.product.id, name: pick(i.product.name), nameTh: (i.product.name && i.product.name.th) || pick(i.product.name), qty: i.qty, unit: i.unit, line: i.line, kind: i.kind })),
      /* the photo itself never leaves this phone: only the fact that there is one */
      custom: brief ? Object.assign({}, d.custom, { reference: null, referenceName: '', hasReference: !!(d.custom.reference || d.custom.referenceAssetId) }) : null,
      colourNote: String(d.colourNote || '').trim(),
      customer: { name: String(cust.name || '').trim(), phone: E.normPhone(cust.phone), line: String(cust.line || '').trim() },
      recipient: { name: String(rec.name || cust.name || '').trim(), phone: E.normPhone(rec.phone || cust.phone) },
      address: d.fulfil === 'delivery' ? d.address : null, anonymous: d.fulfil === 'delivery' && !!d.anonymous,
      card: { message: (d.card && d.card.message) || '' }, subtotal: sum.subtotal, quoteOnly: sum.quoteOnly, hasQuote: sum.hasQuote, priceFrom: sum.priceFrom,
      payment: { status: 'unpaid' }, lang: LHF.i18n.lang, status: 'new', notes: '',
    };
  }
};
