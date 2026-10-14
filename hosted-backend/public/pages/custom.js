/* ---- pages/custom.js ---- */
/* =====================================================================
   CUSTOM — "write the brief": budget-first worksheet → booking
   ===================================================================== */
LHF.pages.custom = function (params, query) {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, pick = (o) => LHF.i18n.pick(o), C = LHF.catalog;
  const settings = LHF.store.get('settings') || LHF.data.bookingDefaults;
  const draft = LHF.store.draft();
  /* The brief lives in the draft while it is written, and stays there when a
     bouquet is added afterwards, so coming back always restores it. A link from
     a product or a post names what the brief is about, and wins over whatever an
     older brief pointed at; the style follows the product's own category. */
  const b = Object.assign({ occasion: '', style: 'bouquet', budgetTier: '', budgetCustom: '', feel: '', flowers: [], reference: null, referenceName: '', notes: '', fromProduct: '', fromPost: '' }, draft.custom || {});
  if (query.occasion) b.occasion = query.occasion;
  const asked = query.product ? C.byId(query.product) : null;
  if (asked) { b.fromProduct = asked.id; b.fromPost = ''; b.style = ['basket', 'box', 'money', 'wreath', 'wedding', 'garland'].includes(asked.category) ? asked.category : 'bouquet'; }
  else if (query.ref && LHF.posts && LHF.posts.byId(query.ref)) { b.fromPost = query.ref; b.fromProduct = ''; }
  if (asked || query.ref || query.occasion) persist();
  let secSeq = 0;
  const page = h('div.page.page-enter', h('div.wrap.section-tight'));
  const wrap = page.firstChild;
  wrap.appendChild(ui.head({ eyebrow: t('home.custom.eyebrow'), title: t('custom.title'), sub: t('custom.sub'), level: 'h1', titleClass: 'h1' }));

  /* what the brief is about, when it started from a product or a post */
  const about = h('div.book-item.brief-about', { hidden: true });
  function renderAbout() {
    U.empty(about);
    const p = b.fromProduct ? C.byId(b.fromProduct) : null;
    const post = !p && b.fromPost && LHF.posts ? LHF.posts.byId(b.fromPost) : null;
    about.hidden = !(p || post);
    if (!p && !post) return;
    const img = p ? p.image || p.thumb : (post.images || [])[0];
    about.append(img ? LHF.img.el(img, { alt: '' }) : h('span.thumb-empty', ui.heartTag('sm flat')), h('div', h('div.m', t('custom.about')), h('div.n', p ? pick(p.name) : pick(post.label) || 'Instagram')), h('button.remove', { type: 'button', onClick: () => { b.fromProduct = ''; b.fromPost = ''; persist(); renderAbout(); } }, t('custom.about.remove')));
  }
  renderAbout();

  const form = h('form.book-sheet', { novalidate: true, onSubmit: (e) => { e.preventDefault(); submit(); } });
  const errBox = h('div.notice.rose', { hidden: true, role: 'alert' });

  /* occasion */
  const occChips = h('div.chips', C.occasions.map((o) => h('button.chip', { type: 'button', 'aria-pressed': b.occasion === o.id, onClick: (e) => { b.occasion = b.occasion === o.id ? '' : o.id; occChips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget && b.occasion === o.id)); persist(); } }, pick(o))));

  /* style */
  const STYLES = ['bouquet', 'basket', 'box', 'money', 'wreath', 'wedding', 'garland'];
  const styleNote = h('p.small.muted');
  function refreshStyleNote() { styleNote.textContent = b.style === 'money' ? t('custom.money.note') : b.style === 'wreath' ? t('custom.wreath.note') : b.style === 'wedding' ? t('custom.wedding.note') : ''; }
  const styleCards = h('div.radio-cards.cols-3', STYLES.map((s) => { const lab = h('label.radio-card', { class: b.style === s ? 'is-on' : '' }, h('input', { type: 'radio', name: 'style', value: s, checked: b.style === s, onChange: () => { b.style = s; styleCards.querySelectorAll('.radio-card').forEach((c) => c.classList.toggle('is-on', c === lab)); refreshStyleNote(); persist(); } }), h('span.t', h('i.mark'), t('custom.style.' + s))); return lab; }));
  refreshStyleNote();

  /* budget */
  const tiers = settings.budgetTiers || LHF.data.bookingDefaults.budgetTiers;
  const budgetInput = h('input.input', { type: 'number', min: 250, step: 50, inputmode: 'numeric', placeholder: t('custom.budget.ph'), value: b.budgetCustom || '', onInput: (e) => { b.budgetCustom = e.target.value; b.budgetTier = ''; budgetChips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false')); persist(); } });
  const budgetChips = h('div.chips', tiers.map((tr) => h('button.chip', { type: 'button', 'aria-pressed': b.budgetTier === tr.id, onClick: (e) => { b.budgetTier = tr.id; b.budgetCustom = ''; budgetInput.value = ''; budgetChips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget)); persist(); } }, tr.max ? LHF.i18n.fmtPrice(tr.min) + ' – ' + LHF.i18n.fmtPrice(tr.max) : LHF.i18n.fmtPrice(tr.min) + '+')));

  /* feel */
  const feel = h('textarea.textarea', { rows: 2, maxlength: 300, 'aria-label': t('custom.step.feel'), placeholder: t('custom.feel.ph'), onInput: (e) => { b.feel = e.target.value; persist(); } });
  feel.value = b.feel || '';

  /* flowers */
  const flowerIds = Object.keys(C.flowers).filter((k) => k !== 'banknotes');
  const flChips = h('div.chips', flowerIds.map((f) => h('button.chip', { type: 'button', 'aria-pressed': b.flowers.includes(f), onClick: (e) => { const i = b.flowers.indexOf(f); if (i > -1) b.flowers.splice(i, 1); else if (b.flowers.length < 3) b.flowers.push(f); else return; e.currentTarget.setAttribute('aria-pressed', b.flowers.includes(f)); persist(); } }, pick(C.flowers[f]))));

  /* Reference photo: it stays on this phone (compressed to ≤ ~150 KB) and is never
     uploaded. It reminds the customer, and the shop's row notes that one exists;
     the customer sends it on LINE with the reservation number. The file input is
     reached through the drop zone only, so it is not a second, invisible tab stop. */
  const fileInput = h('input', { type: 'file', accept: 'image/*,.heic,.heif', class: 'sr-only', tabindex: -1, 'aria-hidden': 'true', onChange: (e) => handleFile(e.target.files[0]) });
  const preview = h('div.upload-preview', { hidden: true });
  const drop = h('div.upload-drop', { tabindex: 0, role: 'button', 'aria-label': t('custom.ref.add'), onClick: () => fileInput.click(), onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } }, onDragover: (e) => { e.preventDefault(); drop.classList.add('is-over'); }, onDragleave: () => drop.classList.remove('is-over'), onDrop: (e) => { e.preventDefault(); drop.classList.remove('is-over'); handleFile(e.dataTransfer.files[0]); } }, ui.icon('plus'), h('div', t('custom.ref.add')), h('div.tiny', t('custom.ref.hint')));
  function renderPreview() { U.empty(preview); preview.hidden = !b.reference; if (!b.reference) return; preview.appendChild(h('img', { src: b.reference, alt: b.referenceName || 'reference' })); preview.appendChild(h('div.stack', { style: { display: 'grid', gap: '6px' } }, h('div.small', b.referenceName), h('div.center', ui.btn(t('custom.ref.replace'), { className: 'btn-sm', onClick: () => fileInput.click() }), ui.btn(t('custom.ref.remove'), { className: 'btn-sm btn-ghost', onClick: () => { b.reference = null; b.referenceName = ''; renderPreview(); persist(); } })))); }
  async function handleFile(file) {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, 900, 150 * 1024);
      b.reference = dataUrl; b.referenceName = file.name; renderPreview(); persist();
      if (file.size > 900 * 1024) ui.toast(t('custom.ref.big'));
    } catch (e) { ui.toast(t('custom.ref.error')); }
  }
  function compressImage(file, maxSide, maxBytes) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxSide / Math.max(im.width, im.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(im.width * scale); cv.height = Math.round(im.height * scale);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        let q = 0.82, out = cv.toDataURL('image/jpeg', q);
        while (out.length * 0.75 > maxBytes && q > 0.4) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
        resolve(out);
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      im.src = url;
    });
  }
  renderPreview();

  const notes = h('textarea.textarea', { rows: 3, maxlength: 1000, 'aria-label': t('custom.step.notes'), placeholder: t('custom.notes.ph'), onInput: (e) => { b.notes = e.target.value; persist(); } });
  notes.value = b.notes || '';

  form.append(
    about,
    errBox,
    section(t('custom.step.style'), styleCards, styleNote),
    section(t('custom.step.occasion'), occChips),
    section(t('custom.step.budget'), h('div.stack', budgetChips, h('div.field-row', h('label.field', h('span.label', t('custom.budget.custom')), budgetInput), h('div.field', h('div.hint', { style: { paddingTop: '30px' } }, t('custom.budget.hint')))), h('div.notice', ui.heartTag('sm flat'), h('span', t('custom.priceNote'))))),
    section(t('custom.step.feel'), feel),
    section(t('custom.step.flowers') + ' · ' + t('custom.max3'), h('div.stack', flChips, h('p.tiny', t('custom.seasonal')))),
    section(t('custom.step.ref'), h('div.upload', fileInput, drop, preview)),
    section(t('custom.step.notes'), notes),
    h('div.book-nav', h('span.tiny', t('custom.priceNote')), ui.btn(t('custom.continue'), { className: 'btn-primary btn-lg', type: 'submit', iconRight: 'arrow' })));
  wrap.appendChild(h('div.book', form));
  return page;

  /* each question is a named group, so its chips and radios are announced with it */
  function section(title, ...kids) { const id = 'brief-q' + (++secSeq); return h('div.stack', { role: 'group', 'aria-labelledby': id, style: { display: 'grid', gap: '10px' } }, h('h2.h4', { id }, title), kids); }
  /* keep the brief without discarding bouquets already in the queue; the type
     only flips to 'custom' when the brief is actually submitted */
  function persist() { LHF.store.setDraft({ custom: Object.assign({}, b) }); }
  function submit() {
    const errs = [];
    if (!b.budgetTier && !(Number(b.budgetCustom) >= 250)) errs.push(t('book.err.items'));
    if (errs.length) { errBox.hidden = false; errBox.textContent = errs.join(' '); errBox.scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'center' }); return; }
    /* ready: the brief is part of the order from now on, bouquets or not */
    LHF.store.setDraft({ type: 'custom', custom: Object.assign({}, b, { ready: true }) });
    R.navigate('/order', { step: 'when' });
  }
};
