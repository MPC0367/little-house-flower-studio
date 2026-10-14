/* ---- components/heart.js ---- */
/* =====================================================================
   heart — the queue badge, "write the card" lookup sheet, and the
   signature motion: the card folds and travels to the heart tag.
   Lookup is built ONLY from the shop's verified meaning entries.
   ===================================================================== */
LHF.heart = (function () {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), pick = (o) => LHF.i18n.pick(o);
  const badges = new Set();

  /* keyword → flower ids. Thai keywords are matched as whole substrings of
     the message but we avoid short roots that collide (e.g. รัก inside รักษา). */
  const KEYMAP = [
    { keys: ['ขอบคุณ', 'ซาบซึ้ง', 'ดูแล', 'thank', 'grateful', 'appreciate'], flowers: ['lisianthus', 'carnation'] },
    { keys: ['เคารพ', 'ผู้ใหญ่', 'ให้เกียรติ', 'นับถือ', 'respect', 'honour', 'honor', 'teacher', 'boss', 'คุณครู', 'อาจารย์', 'หัวหน้า'], flowers: ['rose_white', 'lily'] },
    { keys: ['รักนะ', 'รักเธอ', 'รักคุณ', 'รักมาก', 'ที่รัก', 'แฟน', 'ครบรอบ', 'แต่งงาน', 'คู่ชีวิต', 'love you', 'anniversary', 'marry', 'valentine', 'darling', 'babe'], flowers: ['rose_red'] },
    { keys: ['ยินดี', 'สำเร็จ', 'จบ', 'รับปริญญา', 'เก่ง', 'ภูมิใจ', 'congrat', 'proud', 'graduat', 'success', 'well done'], flowers: ['lily', 'carnation', 'gerbera', 'rose_white'] },
    { keys: ['มีความสุข', 'สุขสันต์', 'สุขภาพ', 'หายไว', 'แข็งแรง', 'happy', 'birthday', 'get well', 'health', 'joy', 'smile', 'ยิ้ม'], flowers: ['stock', 'gerbera', 'carnation'] },
    { keys: ['ลึกซึ้ง', 'ลึกลับ', 'ตลอดไป', 'มั่นคง', 'forever', 'always', 'deep', 'eternal'], flowers: ['rose_red', 'black_wrap'] },
    { keys: ['เริ่มต้นใหม่', 'บ้านใหม่', 'งานใหม่', 'new beginning', 'new job', 'new home', 'fresh start'], flowers: ['rose_white', 'lily'] },
    { keys: ['เพื่อน', 'มิตรภาพ', 'friend'], flowers: ['lisianthus'] },
    { keys: ['คิดถึง', 'miss you'], flowers: ['rose_red', 'stock'] },
  ];
  const BLACK = { th: 'กระดาษห่อสีดำ', en: 'Black wrap', meaning: { th: 'เพิ่มความรู้สึกน่าค้นหา ความลึกลับ ลักชูรี และแสดงถึงความรักที่มั่นคง ลึกซึ้ง ไม่เสื่อมคลาย', en: 'Intrigue, mystery, luxury, and a love that is steady, deep and undimmed' } };

  function lookup(text) {
    const s = String(text || '').toLowerCase();
    if (!s.trim()) return [];
    const hits = new Map();
    KEYMAP.forEach((k) => { if (k.keys.some((w) => s.includes(w.toLowerCase()))) k.flowers.forEach((f, i) => hits.set(f, (hits.get(f) || 0) + (3 - Math.min(i, 2)))); });
    return Array.from(hits.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => entryFor(id)).filter(Boolean);
  }
  function entryFor(id) {
    const fl = id === 'black_wrap' ? BLACK : LHF.catalog.flower(id);
    if (!fl || !fl.meaning) return null;
    const products = LHF.catalog.products.filter((p) => p.image && p.availability !== 'seasonal' && (id === 'black_wrap' ? (p.colors || []).includes('black') : (p.flowers || []).includes(id)));
    return { id, flower: fl, products };
  }
  const allEntries = () => ['rose_white', 'rose_red', 'lily', 'lisianthus', 'carnation', 'stock', 'gerbera', 'black_wrap'].map(entryFor).filter(Boolean);

  /* ---- header badge ---- */
  function count() { const d = LHF.store.draft(); const items = (d.items || []).reduce((a, i) => a + (i.qty || 1), 0); return items + (d.type === 'custom' ? 1 : 0); }
  function badge() {
    const el = h('a.heart-badge.icon-btn', { href: LHF.router.href('/order'), 'aria-label': t('heart.reserved') }, LHF.ui.heartTag('sm'), h('span.count', { hidden: true }));
    /* drop badges from an earlier header; the new one is not in the page yet,
       so it is kept and filled by nav.mountAll's refresh once it is */
    badges.forEach((b) => { if (!b.isConnected) badges.delete(b); });
    badges.add(el);
    return el;
  }
  function refresh(popIt) {
    const n = count();
    badges.forEach((b) => { if (!b.isConnected) return; const c = b.querySelector('.count'); c.textContent = n; c.hidden = n === 0; b.setAttribute('aria-label', t('heart.reserved') + (n ? ' (' + n + ')' : '')); if (popIt) { const tag = b.querySelector('.heart-tag'); tag.classList.remove('pop'); void tag.offsetWidth; tag.classList.add('pop'); } });
  }
  LHF.store.subscribe('draft', () => refresh());

  /* ---- add product to the queue ---- */
  function add(productId, qty, opts) {
    const d = LHF.store.draft();
    const items = (d.items || []).slice();
    const i = items.findIndex((x) => x.productId === productId);
    if (i > -1) items[i] = Object.assign({}, items[i], { qty: (items[i].qty || 1) + (qty || 1) }, opts && opts.options ? { options: opts.options } : {});
    else items.push({ productId, qty: qty || 1, options: (opts && opts.options) || {} });
    LHF.store.setDraft({ type: 'product', items, customId: null });
    if (opts && opts.from) fly(opts.from);
    refresh(true);
    LHF.ui.toast(t('heart.added'), { href: LHF.router.href('/order'), label: t('heart.go'), heart: true });
  }
  function remove(productId) {
    const d = LHF.store.draft();
    LHF.store.setDraft({ items: (d.items || []).filter((x) => x.productId !== productId) });
  }

  /* ---- signature motion: a small card flies from `from` to the header badge ---- */
  function fly(from) {
    if (U.reducedMotion() || !from || !from.getBoundingClientRect) return;
    const target = Array.from(badges).find((b) => b.isConnected && b.offsetParent !== null) || U.qs('#doorstep a:last-child');
    if (!target) return;
    const a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
    const ghost = h('div.fly-card', { 'aria-hidden': 'true' });
    Object.assign(ghost.style, { left: a.left + a.width / 2 - 24 + 'px', top: a.top + a.height / 2 - 30 + 'px' });
    document.body.appendChild(ghost);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const anim = ghost.animate([
      { transform: 'translate(0,0) rotate(-2deg) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 60) + 'px) rotate(6deg) scale(.7)', opacity: 1, offset: .55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(0deg) scale(.15)', opacity: .6 },
    ], { duration: 560, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
    anim.onfinish = () => ghost.remove();
  }

  /* ---- "write the card" lookup sheet (secondary entry to booking) ---- */
  function cardSheet(prefill) {
    const initial=typeof prefill==='string'?prefill:(LHF.store.draft().card?.message||'');
    const saveCard=()=>LHF.store.setDraft({card:{...(LHF.store.draft().card||{}),message:ta.value}});
    const counter=h('p.tiny',{style:{textAlign:'right'},id:'card-sheet-count'},t('book.card.count',{n:initial.length}));
    const results = h('ul.lookup-results', { 'aria-label': t('mean.match') });
    const ta = h('textarea.textarea.hand', { placeholder: t('mean.lookupPh'), 'aria-label': t('mean.lookupTitle'), rows: 3, maxlength: 200, 'data-autofocus': true, value: initial,'aria-describedby':'card-sheet-count' });
    const note = h('p.tiny', t('book.card.sub'));
    const noMatch = h('p.small.euca', { hidden: true }, t('mean.noMatch'), ' ', h('a.tlink', { href: LHF.router.href('/custom'), onClick: () => LHF.ui.closeSheet() }, t('nav.custom')));
    /* results appear as the customer types: a screen reader hears the outcome */
    const status = h('p.sr-only', { role: 'status' });
    let timer;
    const run = () => {
      const text = ta.value;
      const found = lookup(text);
      U.empty(results);
      noMatch.hidden = !(text.trim().length > 3 && !found.length);
      status.textContent = found.length ? t('mean.found', { n: found.length }) : (noMatch.hidden ? '' : t('mean.noMatch'));
      found.forEach((e, i) => {
        const p = e.products[0];
        const row = h('li', h('a.lookup-row', { href: p ? LHF.router.href('/flowers/' + p.slug) : LHF.router.href('/meanings'), style: { '--d': i * 60 + 'ms' }, onClick: () => { saveCard(); LHF.ui.closeSheet(); } },
          p ? LHF.img.el(p.image, { className: 'lookup-thumb', alt: '' }) : h('span.lookup-thumb.thumb-empty'),
          h('div', h('div.entry-head', h('span.headword', e.flower.en, h('span.n', '(N).')), h('span.entry-th', e.flower.th)), h('div.entry-def', pick(e.flower.meaning)), p ? h('div.tiny', pick(p.name) + ' · ' + LHF.ui.priceLabel(p)) : null)));
        results.appendChild(row);
      });
    };
    ta.addEventListener('input', () => { saveCard();counter.textContent=t('book.card.count',{n:ta.value.length});clearTimeout(timer); timer = setTimeout(run, 220); });
    const use = LHF.ui.btn(t('card.sheet.use'), { className: 'btn-primary', onClick: () => { saveCard(); fly(ta); LHF.ui.closeSheet(); LHF.router.navigate('/order', { step: 'card' }); } });
    const content = h('div.stack', h('div.card-paper.card-input', LHF.ui.heartTag('sm'), ta), counter,note, results, noMatch, status, h('div.center', use));
    const s = LHF.ui.sheet({ title: t('card.sheet.title'), sub: t('card.sheet.sub'), content,onClose:()=>clearTimeout(timer) });
    if (initial) run();
    return s;
  }

  return { lookup, allEntries, entryFor, badge, refresh, add, remove, fly, cardSheet, count };
})();
