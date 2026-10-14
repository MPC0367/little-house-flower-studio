/* ---- pages/confirm.js ---- */
/* =====================================================================
   CONFIRMATION — the receipt, the heart stamp, next steps on LINE.
   Reached only after the shop's script answered ok. The shop is not
   notified by the Sheet, so the first thing asked of the customer is to
   send the reservation number on LINE; nothing here claims the shop has
   seen the order.
   ===================================================================== */
LHF.pages.confirm = function (params) {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, pick = (o) => LHF.i18n.pick(o), S = LHF.data.shop, E = LHF.engine, I = LHF.i18n;
  const page = h('div.page.page-enter', h('div.wrap.section-tight'));
  const wrap = page.firstChild;
  const holder = h('div.done', h('p.muted', '…'));
  wrap.appendChild(holder);
  const q = (R.current && R.current.query) || {};
  // the shop's references (LH…) and the demo server's (DEMO-…)
  const refHint = /^(?:LH\d{6}-[A-Z0-9]{4}|DEMO-\d{6}-[A-F0-9]{6})$/.test(q.ref || '') ? q.ref : '';
  const cached = LHF.store.get('lastOrder');
  (cached && cached.id === params.id ? Promise.resolve(cached) : LHF.db.getBooking(params.id)).then(render).catch(() => render(null));
  return page;

  function render(b) {
    U.empty(holder);
    if (!b) { elsewhere(); return; }
    const text = LHF.sink.summary(b);
    const photo = !!(b.custom && (b.custom.hasReference || b.custom.reference));
    const when = I.fmtDate(b.date, 'weekday') + (b.windowLabel ? ' · ' + b.windowLabel : '');
    holder.append(
      h('div.stamp', ui.heartTag('lg')),
      h('h1.h1', t('done.title')),
      h('p.lede', { style: { margin: '0 auto' } }, t('done.sub')),
      h('div', h('div.tiny', t('done.ref')), h('div.ref', b.ref)),
      h('section.done-next', { 'aria-labelledby': 'done-next-title' },
        h('h2.h3', { id: 'done-next-title' }, t('done.next.title')),
        photo ? h('div.notice', ui.icon('line', 18), h('span', t('done.photo'))) : null,
        ui.btn(t('done.line'), { className: 'btn-primary btn-lg', icon: 'line', href: LHF.sink.lineUrl(text), target: '_blank' }),
        /* what happens next, in order: a list that never pretends to move */
        h('ol.dotlist.done-steps', [t('done.step1'), t('done.step2'), t(b.fulfil === 'delivery' ? 'done.step3.delivery' : 'done.step3.pickup', { when })].map((s, i) => h('li', h('span.n', '0' + (i + 1)), h('span', s))))),
      receipt(b, when),
      /* a catalogue booking has no design: add nothing (an empty value was printed as the word "null") */
      ...[LHF.designSnapshot ? LHF.designSnapshot(b.custom) : null].filter(Boolean),
      h('div.done-actions',
        ui.btn(t('done.calendar'), { icon: 'calendar', onClick: () => ics(b) }),
        ui.btn(t('done.copy'), { icon: 'copy', onClick: () => copy(text) }),
        ui.btn(S.phoneDisplay, { icon: 'phone', href: 'tel:' + S.phoneTel, attrs: { 'aria-label': t('done.call', { phone: S.phoneDisplay }) } }),
        ui.btn(t('done.again'), { href: R.href('/flowers') })));
  }

  function receipt(b, when) {
    const fmt = I.fmtPrice;
    const cu = b.customer || null, a = b.address || null, c = b.custom || null;
    const items = (b.items || []).map((i) => (i.qty > 1 ? i.qty + ' × ' : '') + (pick((LHF.catalog.byId(i.productId) || {}).name) || i.name) + (i.kind === 'quote' ? ' (' + t('price.quote') + ')' : ''));
    const briefText = c ? t('custom.summary') + ': ' + [c.fromProduct && LHF.catalog.byId(c.fromProduct) ? pick(LHF.catalog.byId(c.fromProduct).name) : '', t('custom.style.' + (c.style || 'bouquet')), pick(LHF.catalog.occasion(c.occasion) || {})].filter(Boolean).join(' · ') : '';
    const firm = !b.hasQuote && !b.priceFrom && !(b.quoteOnly && !b.priceFrom);
    return h('div.receipt',
      h('div.receipt-head', 'Little House Flower ', h('span.nowrap', '· ' + b.ref)),
      h('div.book-summary',
        h('div.row', h('span.k', t('book.step.what')), h('span', [briefText].concat(items).filter(Boolean).join(', ') || '—')),
        b.colourNote ? h('div.row', h('span.k', t('book.sum.colour')), h('span', b.colourNote)) : null,
        h('div.row', h('span.k', t('book.step.when')), h('span', when)),
        h('div.row', h('span.k', t('book.step.how')), h('span', b.fulfil ? t('book.how.' + b.fulfil) : '—')),
        b.fulfil === 'delivery' && a ? h('div.row', h('span.k', t('book.review.address')), h('span', [a.line, a.district].filter(Boolean).join(' '))) : null,
        cu && cu.name ? h('div.row', h('span.k', t('book.who.you')), h('span', cu.name + ' · ' + E.fmtPhone(cu.phone))) : null,
        h('div.row.total', h('span.k', t('book.review.total')), h(firm || b.priceFrom ? 'span.price.price-md' : 'span.small', LHF.sink.totalLabel(b))),
        h('div.row', h('span.k', t('book.review.delivery')), h('span.small', b.fulfil === 'delivery' ? t('book.review.deliveryNote') : t('book.review.pickupNote')))),
      b.card && b.card.message ? h('div', { style: { marginTop: '14px' } }, h('div.tiny', t('done.card')), h('div.hand', { style: { fontSize: '22px' } }, b.card.message)) : null,
      /* on paper the footer is gone: the receipt carries the way back to the shop */
      h('p.tiny.receipt-contact', 'LINE ' + S.lineId + ' · ' + S.phoneDisplay));
  }

  /* A confirmation link opened on another phone (or after 30 days): the details
     live only on the phone that ordered, so say that, and give the way in. */
  function elsewhere() {
    holder.append(
      h('div.stamp', ui.heartTag('lg')),
      h('h1.h1', t('done.elsewhere.title')),
      h('p.lede', { style: { margin: '0 auto' } }, t('done.elsewhere.sub')),
      refHint ? h('div', h('div.tiny', t('done.ref')), h('div.ref', refHint)) : null,
      h('div.done-actions',
        ui.btn(t('done.elsewhere.line'), { className: 'btn-primary', icon: 'line', href: refHint ? LHF.sink.lineUrl(t('done.ref') + ' ' + refHint) : S.lineUrl, target: '_blank' }),
        ui.btn(S.phoneDisplay, { icon: 'phone', href: 'tel:' + S.phoneTel, attrs: { 'aria-label': t('done.call', { phone: S.phoneDisplay }) } }),
        ui.btn(t('nav.reserve'), { href: R.href('/order') })));
  }

  /* Copy for real: the clipboard API, else a selected textarea — and the toast
     only when something was copied. Otherwise the text opens to copy by hand. */
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); ui.toast(t('done.copied')); return; } catch (e) { /* fall through */ }
    const ta = h('textarea', { readonly: true, 'aria-hidden': 'true', style: { position: 'fixed', top: '0', left: '0', width: '1px', height: '1px', opacity: '0' } });
    ta.value = text;
    holder.appendChild(ta);
    ta.focus({ preventScroll: true }); ta.select();
    try { ta.setSelectionRange(0, text.length); } catch (e) { /* not every engine */ }
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    if (ok) { ui.toast(t('done.copied')); return; }
    const box = h('textarea.textarea', { readonly: true, rows: 9, 'aria-label': t('done.copy'), 'data-autofocus': true });
    box.value = text;
    ui.sheet({ title: t('done.copy'), sub: t('done.copyByHand'), content: h('div.stack', box) });
    requestAnimationFrame(() => { try { box.select(); } catch (e) { /* fine */ } });
  }

  /* A real calendar file, with times as UTC instants (Bangkok 12:00 is 05:00Z),
     so the reminder lands at the right hour on a phone in any time zone. */
  async function ics(b) {
    const [sh, eh] = String(b.windowLabel || '09:00–12:00').split('–').map((s) => s.trim());
    const start = LHF.time.toUTC(b.date, sh || '09:00'), end = LHF.time.toUTC(b.date, eh || '12:00');
    const stamp = (dt) => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const title = 'Little House Flower · ' + b.ref;
    const text = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Little House Flower//Reservation//TH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', 'UID:' + b.id + '@littlehouseflower', 'DTSTAMP:' + stamp(new Date()), 'DTSTART:' + stamp(start), 'DTEND:' + stamp(end), 'SUMMARY:' + esc(title), 'DESCRIPTION:' + esc(LHF.sink.summary(b)), b.fulfil === 'pickup' ? 'LOCATION:' + esc(pick(S.address)) : null, 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).map(fold).join('\r\n') + '\r\n';
    const filename = 'little-house-flower-' + b.ref + '.ics';
    try {
      const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      if (dl) { await dl.save({ filename, data: text }); return; }
    } catch (e) { if (e && e.code === 'declined') return; }
    /* LINE's in-app browser drops downloads: hand it to Google Calendar instead,
       with the reference and the time only — no names or numbers in a link */
    if (/\bLine\//i.test(navigator.userAgent || '')) {
      window.open('https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + stamp(start) + '/' + stamp(end) + '&ctz=Asia%2FBangkok&details=' + encodeURIComponent(t('done.ref') + ' ' + b.ref + ' · LINE ' + S.lineId), '_blank', 'noopener');
      return;
    }
    if (typeof Blob === 'function' && window.URL && typeof URL.createObjectURL === 'function' && 'download' in HTMLAnchorElement.prototype) {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
      const a = h('a', { href: url, download: filename, hidden: true });
      holder.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      ui.toast(t('done.calendarSaved'));
      return;
    }
    await copy(text);
  }
  /* RFC 5545: lines longer than 75 octets continue on the next line after a space */
  function fold(line) {
    if (typeof TextEncoder !== 'function') return line;
    const enc = new TextEncoder();
    if (enc.encode(line).length <= 75) return line;
    const out = [];
    let cur = '', bytes = 0;
    for (const ch of line) {
      const n = enc.encode(ch).length;
      if (bytes + n > 75) { out.push(cur); cur = ' '; bytes = 1; }
      cur += ch; bytes += n;
    }
    out.push(cur);
    return out.join('\r\n');
  }
};
