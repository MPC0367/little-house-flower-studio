/* ---- core/booking-engine.js ---- */
/* =====================================================================
   booking engine — pure rules (no DOM, no IO). Fed by settings + load.
   ===================================================================== */

/* The shop's clock. Lead time, the 18:00 cut-off, same-day windows and the
   calendar's "today" all run on Bangkok time, whatever zone the visitor's phone
   is set to: someone ordering from London must not be offered a slot that
   closed hours ago in Nonthaburi. */
LHF.time = (function () {
  const TZ = 'Asia/Bangkok';
  let fmt = null;
  try { fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch (e) { fmt = null; }
  const pad = (n) => (n < 10 ? '0' : '') + n;
  /* now(at?) → {y, m, d, hh, mi, dow, minutes, iso} for the instant `at` (default: this moment) */
  function now(at) {
    const ms = at == null ? Date.now() : at instanceof Date ? at.getTime() : Number(at);
    let y = 0, m = 0, d = 0, hh = 0, mi = 0;
    if (fmt) {
      const p = {};
      fmt.formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
      y = +p.year; m = +p.month; d = +p.day; hh = (+p.hour) % 24; mi = +p.minute;
    }
    if (!(y > 0)) {
      /* Bangkok has kept UTC+7, with no daylight saving, since 1920 */
      const b = new Date(ms + 7 * 3600e3);
      y = b.getUTCFullYear(); m = b.getUTCMonth() + 1; d = b.getUTCDate(); hh = b.getUTCHours(); mi = b.getUTCMinutes();
    }
    return { y, m, d, hh, mi, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), minutes: hh * 60 + mi, iso: y + '-' + pad(m) + '-' + pad(d) };
  }
  const today = (at) => now(at).iso;
  /* a date and 'HH:MM' on the shop's clock → that instant (for calendar files) */
  function toUTC(dateISO, hhmm) {
    const [y, m, d] = String(dateISO).split('-').map(Number);
    const [hh, mi] = String(hhmm || '00:00').split(':').map(Number);
    return new Date(Date.UTC(y, m - 1, d, (hh || 0) - 7, mi || 0));
  }
  return { TZ, now, today, toUTC };
})();

LHF.engine = (function () {
  const U = LHF.util;

  /* 'now' is injectable for tests; today and hour are read on the shop's clock */
  function ctx(settings, now) {
    const n = LHF.time.now(now);
    const hours = LHF.data.shop.hours;
    return { settings, now: now || new Date(), today: n.iso, hour: n.hh + n.mi / 60, open: parseInt(hours.open, 10), close: parseInt(hours.close, 10), horizon: horizon(n.iso, (settings && settings.monthsAhead) || 3) };
  }
  /* the calendar offers this month and the next three; nothing past that is bookable */
  function horizon(todayISO, monthsAhead) {
    const [y, m] = todayISO.split('-').map(Number);
    return U.iso(new Date(y, m + monthsAhead, 0));
  }

  /* Earliest selectable date given lead time and cut-off. */
  const leadOf = (c, opts) => Math.max(0, Number(opts && opts.leadDays != null ? opts.leadDays : c.settings.leadTimeDays || 0));
  function earliestDate(c, opts) {
    const lead = leadOf(c, opts);
    let d = U.addDays(c.today, lead);
    // after the cut-off hour, tomorrow is no longer bookable online
    if (lead > 0 && c.hour >= (c.settings.cutoffHour || 24)) d = U.addDays(d, 1);
    return d;
  }

  /* A written brief rides with the order once it was sent on from /custom, even if
     a bouquet was added afterwards (drafts older than the `ready` flag only carry
     type 'custom'). */
  const hasBrief = (d) => !!(d && d.custom && (d.type === 'custom' || d.custom.ready));

  /* One lead time for the whole order: the longest of the shop's minimum, each
     bouquet in it, and the brief (two days, or the lead of the product the brief
     asks about). The calendar, the step checks and the final send all use it. */
  function leadFor(d, settings) {
    const C = LHF.catalog;
    const own = (id) => Number((C.byId(id) || {}).leadDays) || 1;
    const parts = [Number((settings || {}).leadTimeDays) || 1].concat((d.items || []).map((it) => own(it.productId)));
    if (hasBrief(d)) { const from = d.custom.fromProduct; parts.push(from && C.byId(from) ? own(from) : 2); }
    return Math.max.apply(null, parts);
  }

  /* Status of a single date. load = {orders, custom, windows} or undefined */
  function dateStatus(dateISO, c, load, opts) {
    opts = opts || {};
    const s = c.settings;
    if (dateISO < c.today) return { ok: false, reason: 'past' };
    if (c.horizon && dateISO > c.horizon) return { ok: false, reason: 'horizon' };
    if ((s.blackoutDates || []).includes(dateISO)) return { ok: false, reason: 'closed' };
    /* while a high-demand campaign is on, its deadline actually closes later dates */
    if (s.highDemand && s.highDemand.active && s.highDemand.deadline && dateISO > s.highDemand.deadline) return { ok: false, reason: 'closed' };
    const earliest = earliestDate(c, opts);
    /* 'cutoff': the lead time alone would allow it, but today's 18:00 has passed */
    if (dateISO < earliest) return { ok: false, reason: dateISO === c.today ? 'today' : dateISO >= U.addDays(c.today, leadOf(c, opts)) ? 'cutoff' : 'leadtime' };
    const orders = load ? load.orders : 0;
    const custom = load ? load.custom : 0;
    /* 0 means "closed today", not "unlimited" */
    const cap = Number(s.maxOrdersPerDay);
    if (Number.isFinite(cap) && orders >= cap) return { ok: false, reason: 'full' };
    const capCustom = Number(s.maxCustomPerDay);
    if (opts.type === 'custom' && Number.isFinite(capCustom) && custom >= capCustom) return { ok: false, reason: 'full' };
    const remaining = Number.isFinite(cap) ? cap - orders : null;
    /* "few left" only means something when the count covers everyone's orders */
    return { ok: true, remaining, low: !!load && remaining != null && remaining <= lowAt(cap) };
  }
  const lowAt = (cap) => Math.max(2, Math.ceil(cap * 0.2));

  /* Windows for a date + fulfilment ('delivery' | 'pickup') with capacity. */
  function windowsFor(dateISO, fulfil, c, load) {
    const s = c.settings;
    const list = (s.windows && s.windows[fulfil]) || [];
    const capPer = fulfil === 'delivery' ? s.maxDeliveryPerWindow : s.maxPickupPerWindow;
    const isToday = dateISO === c.today;
    return list.map((w) => {
      const used = load && load.windows ? load.windows[w.id] || 0 : 0;
      const cap = Number(capPer);
      const full = Number.isFinite(cap) ? used >= cap : false;
      const startH = parseInt(w.start, 10);
      const gone = isToday && c.hour + 3 > startH;   // same-day windows need ≥3h notice
      return Object.assign({}, w, { used, full, gone, ok: !full && !gone, remaining: Number.isFinite(cap) ? cap - used : null });
    });
  }

  /* Calendar matrix: array of weeks, each 7 cells {iso, inMonth} (Sunday first).
     Exactly the weeks that hold a day of the month, never a row of next month only. */
  function monthMatrix(year, month) {
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    const rows = Math.ceil((first.getDay() + new Date(year, month + 1, 0).getDate()) / 7);
    const weeks = [];
    for (let w = 0; w < rows; w++) {
      const row = [];
      for (let d = 0; d < 7; d++) {
        const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
        row.push({ iso: U.iso(cur), inMonth: cur.getMonth() === month, day: cur.getDate() });
      }
      weeks.push(row);
    }
    return weeks;
  }

  /* Order reference: LH + yymmdd + 4 chars, e.g. LH260905-K7MQ */
  function orderRef(dateISO) {
    const d = (dateISO || LHF.time.today()).replace(/-/g, '').slice(2);
    return 'LH' + d + '-' + U.rnd(4);
  }

  /* ---- price summary ---- */
  /* How a product's price may be stated on an order today:
     'firm'  the shop's own price, inside its validity date
     'from'  a starting price ('from' and 'range'); the shop confirms the total
     'quote' no price, or the date the shop's prices were good until has passed */
  function priceKind(p, today) {
    if (!p || p.pricing === 'quote' || !(Number(p.price) > 0)) return 'quote';
    const until = p.priceValidUntil || (LHF.data.policies || {}).priceValidUntil;
    if (until && (today || LHF.time.today()) > until) return 'quote';
    return p.pricing === 'from' || p.pricing === 'range' ? 'from' : 'firm';
  }
  function priceSummary(draft) {
    const today = LHF.time.today();
    /* a draft saved before a catalogue change can name a product that no longer exists */
    const items = (draft.items || []).map((it) => {
      const p = LHF.catalog.byId(it.productId);
      if (!p) return null;
      /* a quantity stacked by re-adding, or edited in storage, stays inside the product's range */
      const qty = U.clamp(Math.floor(Number(it.qty)) || 1, 1, p.maxQty || 20);
      const kind = priceKind(p, today);
      const unit = kind === 'quote' ? 0 : tierPrice(p, qty);
      return { product: p, qty, unit, line: unit * qty, kind, options: it.options || {} };
    }).filter(Boolean);
    const subtotal = items.reduce((a, b) => a + b.line, 0);
    const brief = hasBrief(draft);
    /* hasQuote: part of the order has no price yet. priceFrom: every price is known
       but at least one is a starting price, so the total is "from". Either way the
       shop confirms the total, and the Sheet row says so. */
    const hasQuote = brief || items.some((i) => i.kind === 'quote');
    const priceFrom = !hasQuote && items.some((i) => i.kind === 'from');
    const promo = LHF.data.policies.reviewDiscountPct;
    return { items, subtotal, brief, hasQuote, priceFrom, quoteOnly: hasQuote || priceFrom, deliveryNote: draft.fulfil === 'delivery' ? 'delivery.byDistance' : null, reviewDiscountPct: promo };
  }
  function tierPrice(p, qty) {
    if (!p.tiers) return p.price || 0;
    let unit = p.price;
    p.tiers.forEach((t) => { if (qty >= t.min) unit = t.price; });
    return unit;
  }

  /* ---- phones ----
     The orderer may be anywhere (children abroad order for their parents): a Thai
     mobile, a Thai landline, or + country code with 8–15 digits. The recipient is
     called by the rider, so the recipient needs a Thai mobile. Thai and full-width
     digits count; +66 and 66 fold into the leading 0. */
  function normPhone(s) {
    let v = String(s || '').replace(/[๐-๙]/g, (ch) => String(ch.charCodeAt(0) - 0x0E50)).replace(/[０-９]/g, (ch) => String(ch.charCodeAt(0) - 0xFF10)).trim();
    const intl = /^(\+|00)/.test(v);
    v = v.replace(/\D/g, '');
    if (!intl) return /^66[689]\d{8}$/.test(v) ? '0' + v.slice(2) : v;
    if (v.startsWith('00')) v = v.slice(2);
    if (v.startsWith('66')) return '0' + v.slice(2).replace(/^0/, '');
    return '+' + v;
  }
  const isMobileTH = (s) => /^0[689]\d{8}$/.test(normPhone(s));
  const isCustomerPhone = (s) => { const n = normPhone(s); return /^0[689]\d{8}$/.test(n) || /^0[2-7]\d{7}$/.test(n) || /^\+[1-9]\d{7,14}$/.test(n); };
  function fmtPhone(s) {
    const n = normPhone(s);
    if (/^0\d{9}$/.test(n)) return n.slice(0, 3) + ' ' + n.slice(3, 6) + ' ' + n.slice(6);
    if (/^0\d{8}$/.test(n)) return n.slice(0, 2) + ' ' + n.slice(2, 5) + ' ' + n.slice(5);
    return n || String(s || '');
  }

  /* ---- validation ---- */
  function validate(d, step) {
    const e = {};
    const need = (k, cond) => { if (!cond) e[k] = 'required'; };
    if (!step || step === 'what') {
      need('type', d.type);
      if (d.type === 'product') need('items', d.items && d.items.length);
      /* the brief lives at draft.custom — occasion is optional there, budget is not */
      if (d.type === 'custom') { const cu = d.custom || {}; need('budget', cu.budgetTier || Number(cu.budgetCustom) >= 250); }
    }
    if (!step || step === 'when') { need('date', d.date); need('fulfil', d.fulfil); need('windowId', d.windowId); }
    if (!step || step === 'who') {
      need('customerName', d.customer && d.customer.name && d.customer.name.trim().length >= 2);
      if (!(d.customer && isCustomerPhone(d.customer.phone))) e.customerPhone = d.customer && d.customer.phone ? 'phone' : 'required';
      if (d.fulfil === 'delivery') {
        need('recipientName', d.recipient && d.recipient.name);
        if (!(d.recipient && isMobileTH(d.recipient.phone))) e.recipientPhone = d.recipient && d.recipient.phone ? 'mobile' : 'required';
        need('addressLine', d.address && d.address.line && d.address.line.trim().length >= 6);
        need('district', d.address && d.address.district);
        need('province', d.address && d.address.province);
      }
      if (d.card && d.card.message && d.card.message.length > 200) e.cardMessage = 'long';
    }
    if (!step || step === 'review') need('consent', d.consent === true);
    return e;
  }

  return { ctx, horizon, earliestDate, dateStatus, lowAt, windowsFor, monthMatrix, orderRef, priceSummary, priceKind, tierPrice, validate, leadFor, hasBrief, normPhone, isMobileTH, isCustomerPhone, fmtPhone };
})();
