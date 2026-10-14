/* ---- pages/misc.js ---- */
/* =====================================================================
   MEANINGS page · PRIVACY notice · 404 · error
   ===================================================================== */
LHF.pages.meanings = function () {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, pick = (o) => LHF.i18n.pick(o);
  const entries = LHF.heart.allEntries();
  const results = h('ul.lookup-results', { 'aria-label': t('mean.match') });
  const noMatch = h('div.meaning-empty', { hidden: true }, h('p.small.euca', t('mean.noMatch'), ' ', h('a.tlink', { href: R.href('/custom') }, t('nav.custom'))));
  const status=h('p.sr-only',{role:'status'});
  const counter=h('p.tiny.meaning-counter');
  const ta = h('textarea.textarea.hand', { placeholder: t('mean.lookupPh'), id:'meaning-message',rows: 3, maxlength: 200, value:LHF.store.draft().card?.message || '', 'aria-label': t('mean.lookupTitle'), 'aria-describedby':'meaning-help meaning-count' });
  counter.id='meaning-count';
  const help=h('p.small.muted#meaning-help',LHF.i18n.lang==='th'?'พิมพ์ความรู้สึกหรือชื่อดอกไม้ ข้อความจะเก็บไว้ในฉบับร่างการ์ดของคุณ':'Try a feeling or a flower name. Your words stay in your card draft.');
  noMatch.appendChild(ui.btn(LHF.i18n.lang==='th'?'ล้างข้อความ':'Clear text',{onClick:()=>{ta.value='';LHF.store.setDraft({card:{...(LHF.store.draft().card||{}),message:''}});renderLookup();ta.focus({preventScroll:true});}}));
  let timer;
  function renderLookup(){counter.textContent=ta.value.length+' / 200';
    const found = LHF.heart.lookup(ta.value); U.empty(results); noMatch.hidden = !(ta.value.trim().length > 0 && !found.length);
    status.textContent=ta.value.trim()?(found.length ? (LHF.i18n.lang==='th'?'พบคำแนะนำ ':'Suggestions: ')+found.length : (LHF.i18n.lang==='th'?'ยังไม่พบคำแนะนำ ลองคำอื่นหรือปรึกษาร้าน':'No suggestions yet. Try another word or ask the florist.')):'';
    found.forEach((e, i) => { const p = e.products[0]; results.appendChild(h('li', h('a.lookup-row', { href: p ? R.href('/flowers/' + p.slug) : R.href('/custom'), style: { '--d': i * 60 + 'ms' }, onClick: () => LHF.store.setDraft({ card: { ...(LHF.store.draft().card||{}),message: ta.value } }) }, p ? LHF.img.el(p.image, { className: 'lookup-thumb', alt: '' }) : h('span.lookup-thumb'), h('div', h('div.entry-head', h('span.headword', e.flower.en, h('span.n', 'n.')), h('span.entry-th', e.flower.th)), h('div.entry-def', pick(e.flower.meaning)), p ? h('div.tiny', pick(p.name) + ' · ' + ui.priceLabel(p)) : null)))); });
  }
  ta.addEventListener('input',()=>{LHF.store.setDraft({card:{...(LHF.store.draft().card||{}),message:ta.value}});clearTimeout(timer);counter.textContent=ta.value.length+' / 200';timer=setTimeout(renderLookup,220);});
  R.onLeave(()=>clearTimeout(timer));
  renderLookup();
  const page = h('div.page.page-enter',
    h('div.wrap.section-tight', ui.head({ eyebrow: t('home.meaning.eyebrow'), title: t('mean.title'), sub: t('mean.sub'), level: 'h1', titleClass: 'h1' }),
      h('div.lookup', { style: { maxWidth: '640px' } }, h('label.label',{for:'meaning-message'}, t('mean.lookupTitle')), h('div.card-paper.card-input', ui.heartTag('sm'), ta), help, counter, status, results, noMatch)),
    h('section.section.meaning-band', h('div.wrap', h('div.entries', { 'data-reveal-group': true }, entries.map((e) => h('article.entry', { class: e.id === 'black_wrap' ? 'dark' : '' },
      h('div.entry-head', h('span.headword', e.flower.en, h('span.n', 'n.')), h('span.entry-th', e.flower.th)),
      h('p.entry-def', pick(e.flower.meaning)),
      LHF.i18n.lang === 'en' && e.flower.meaning.th ? h('p.entry-def-en', { lang: 'th' }, e.flower.meaning.th) : null,
      e.products.length ? h('div', h('div.tiny', { style: { marginBottom: '6px' } }, t('mean.inBouquets')), h('div.entry-foot', h('div.thumbs', e.products.slice(0, 4).map((q) => h('a', { href: R.href('/flowers/' + q.slug), 'aria-label': pick(q.name) }, LHF.img.el(q.image, { alt: '' })))))) : null))))));
  return page;
};

/* PRIVACY — the PDPA notice. The shop is the controller; every contact fact and the
   date come from data/settings.js, so the notice cannot drift from the footer. */
LHF.pages.privacy = function () {
  const h = LHF.util.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, S = LHF.data.shop, P = LHF.data.privacy;
  const en = LHF.i18n.lang === 'en';
  const fill = { name: S.name, line: S.lineId, phone: en ? S.phoneIntl : S.phoneDisplay, email: S.email, months: P.retentionMonths };
  const sec = (key, ...body) => h('section.policy-sec', { 'aria-labelledby': 'pv-' + key }, h('h2.h3#pv-' + key, t('privacy.' + key + '.h')), body);
  const para = (key) => h('p', t(key, fill));
  /* The word breaker splits the compound ความเป็นส่วนตัว (the eyebrow's text) after ความ;
     the title breaks only before it. */
  const title = () => { const full = t('privacy.title'), keep = t('privacy.eyebrow'); return !en && full.endsWith(keep) ? h('span', full.slice(0, -keep.length), h('wbr'), h('span.nowrap', keep)) : full; };
  return h('div.page.page-enter', h('div.wrap.section-tight',
    ui.head({ eyebrow: t('privacy.eyebrow'), title: title(), sub: t('privacy.intro'), level: 'h1', titleClass: 'h1' }),
    h('div.policy.measure',
      h('p.tiny', t('privacy.updated', { date: LHF.i18n.fmtDate(P.updated) })),
      sec('who', para('privacy.who.p')),
      sec('what', h('ol.dotlist', [1, 2, 3, 4].map((n) => h('li', h('span.n', '0' + n), h('span', t('privacy.what.' + n))))), para('privacy.what.photo')),
      sec('why', para('privacy.why.p')),
      sec('where', para('privacy.where.p'), para('privacy.where.fonts'), para('privacy.where.map')),
      sec('device', para('privacy.device.p')),
      sec('keep', para('privacy.keep.p')),
      sec('rights', para('privacy.rights.p'), h('div.hero-ctas', ui.btn('LINE ' + S.lineId, { className: 'btn-primary', href: S.lineUrl, target: '_blank', icon: 'line' }), ui.btn(fill.phone, { href: 'tel:' + S.phoneTel, icon: 'phone' }))))));
};

LHF.pages.notfound = function () {
  const h = LHF.util.h, t = (k) => LHF.i18n.t(k), ui = LHF.ui, R = LHF.router;
  return h('div.page.page-enter', h('div.wrap.section', h('div.final', ui.heartTag('lg'), h('h1.h1', t('notfound.title')), h('p.lede', t('notfound.sub')), ui.btn(t('notfound.home'), { className: 'btn-primary', href: R.href('/') }))));
};
LHF.pages.error = function (e) {
  const h = LHF.util.h, t = (k) => LHF.i18n.t(k), ui = LHF.ui, R = LHF.router;
  if (e) console.error(e);   // for whoever debugs; a customer only needs a way on
  return h('div.page.page-enter', h('div.wrap.section', h('div.final', h('h1.h1', t('error.title')), h('p.lede', t('error.sub')), ui.btn(t('notfound.home'), { className: 'btn-primary', href: R.href('/') }))));
};
