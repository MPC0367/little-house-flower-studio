// Generated from the existing pure booking/catalogue scripts; no dynamic evaluation or I/O.
import {randomHex} from './hosted-crypto.mjs';
const iso=d=>d.toISOString().slice(0,10);
const LHF={util:{iso,parseISO:s=>new Date(s+'T00:00:00Z'),addDays:(s,n)=>iso(new Date(new Date(s+'T00:00:00Z').getTime()+n*864e5)),clamp:(n,a,b)=>Math.min(b,Math.max(a,n)),rnd:()=>randomHex(3),uid:()=>crypto.randomUUID()},i18n:{shopNow:()=>({iso:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date())})}};
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


/* ---- data/settings.js ---- */
/* =====================================================================
   SHOP SETTINGS — the shop's public facts and operating rules, in one place.
   This file is the only source: there is no back office on the site (the
   shop works from its Google Sheet), so a change here is a change for
   every visitor.
   ===================================================================== */
LHF.data = LHF.data || {};

LHF.data.shop = {
  name: 'Little House Flower',                 // the official name; "Little House Flowers" is only an alternateName in the head
  legalMark: 'LITTLE HOUSE FLOWER',
  tagline: 'LET PRESENT YOUR LOVE',          // verbatim from the logo lockup
  phoneDisplay: '062 749 5533',
  phoneTel: '+66627495533',
  phoneIntl: '+66 62 749 5533',               // how the English pages write it
  lineId: '@littlehouseflower',
  lineUrl: 'https://lin.ee/2RYsFwz',          // link published in the Instagram bio
  email: 'littlechildice2@gmail.com',         // listed on the Facebook About tab
  instagram: 'https://www.instagram.com/littlehouseflower/',
  instagramHandle: 'littlehouseflower',
  facebook: 'https://www.facebook.com/Littlehouseflower/',
  mapsUrl: 'https://maps.app.goo.gl/weL5cQv1m1YyfPFt8',
  geo: [13.8709357, 100.461574],               // the shop's own pin on its Google Business Profile (read 2026-09-29)
  address: {                                  // shown on the site: the shop publishes it on its Google Business Profile
    th: '17 ซอยบ้านไทรม้า ตำบลบางรักน้อย อำเภอเมืองนนทบุรี นนทบุรี 11000',
    en: '17 Soi Ban Sai Ma, Bang Rak Noi, Mueang Nonthaburi, Nonthaburi 11000',
  },
  zone: { th: 'โซนนนทบุรี รัตนาธิเบศร์', en: 'Rattanathibet, Nonthaburi' },
  serviceArea: { th: 'นนทบุรีและกรุงเทพฯ', en: 'Nonthaburi and Bangkok' },
  hours: { open: '08:00', close: '20:00', everyDay: true },   // Asia/Bangkok
};

/* Operating rules quoted from the shop's own posts */
LHF.data.policies = {
  leadTimeDays: 1,              // "รบกวนสำรองคิวล่วงหน้า1-2วัน": one day is the minimum
  recommendedLeadDays: 2,       // ...two is what the shop recommends, not a rule
  handmadeLeadDays: 3,          // Kitty bouquet: "แนะนำสั่งล่วงหน้า3-7วัน"
  urgentHours: 4,               // "ออเดอร์ด่วนภายใน3-4ชม สอบถามคิววันต่อวัน"
  colourChange: true,           // "เปลี่ยนสีดอกไม้ สีกระดาษได้"
  freeCard: true,               // "การ์ดข้อความฟรี ฝากข้อความได้"
  deliveryBy: 'Lalamove',       // "ค่าจัดส่งคิดตามระยะทางLalamove"
  deliveryFeeModel: 'distance', // fee quoted after address is known
  pickup: true,                 // "(มารับเองได้)"
  reviewDiscountPct: 5,         // "มีโปรรีวิวรับส่วนลด5%": the shop's own promo, conditions from the shop; null hides it
  priceValidUntil: '2026-12-31',// "ราคาวันนี้ - 31 ธันวาคม": the one date every "valid until" line reads
};

/* Prices hold until policies.priceValidUntil on the Bangkok calendar. After it every
   priced design shows "price on request" and the "prices valid until" lines go
   quiet (data/catalog.js, data/strings.js), so an expired figure is never quoted or
   summed. Put the shop's new prices and date above to bring them back. */
LHF.data.pricesCurrent = LHF.i18n.shopNow().iso <= LHF.data.policies.priceValidUntil;

/* The privacy notice at /privacy (PDPA). The controller is the shop; the date is
   shown on the page, so change it whenever the notice changes. */
LHF.data.privacy = { updated: '2026-09-29', retentionMonths: 12 };

/* Booking defaults. These are operating defaults, NOT published facts; the site
   has no per-device overrides for them. */
LHF.data.bookingDefaults = {
  maxOrdersPerDay: 12,
  maxCustomPerDay: 4,
  maxDeliveryPerWindow: 4,
  maxPickupPerWindow: 6,
  cutoffHour: 18,               // orders for tomorrow close at 18:00 today
  leadTimeDays: 1,
  blackoutDates: [],            // 'YYYY-MM-DD'
  highDemand: { active: false, label: { th: '', en: '' }, deadline: '', note: { th: '', en: '' } },
  windows: {
    delivery: [
      { id: 'd1', start: '09:00', end: '12:00' },
      { id: 'd2', start: '12:00', end: '15:00' },
      { id: 'd3', start: '15:00', end: '18:00' },
      { id: 'd4', start: '18:00', end: '20:00' },
    ],
    pickup: [
      { id: 'p1', start: '08:00', end: '10:00' },
      { id: 'p2', start: '10:00', end: '12:00' },
      { id: 'p3', start: '12:00', end: '14:00' },
      { id: 'p4', start: '14:00', end: '16:00' },
      { id: 'p5', start: '16:00', end: '18:00' },
      { id: 'p6', start: '18:00', end: '20:00' },
    ],
  },
  budgetTiers: [
    { id: 'b1', min: 500, max: 1000 },
    { id: 'b2', min: 1000, max: 1500 },
    { id: 'b3', min: 1500, max: 2500 },
    { id: 'b4', min: 2500, max: 4000 },
    { id: 'b5', min: 4000, max: null },
  ],
};

/* Thai calendar — public seasonal peaks used by the campaign engine */
LHF.data.season = [
  { id: 'valentine', date: '02-14', th: 'วาเลนไทน์', en: "Valentine's Day" },
  { id: 'mothers', date: '08-12', th: 'วันแม่', en: "Mother's Day" },
  { id: 'fathers', date: '12-05', th: 'วันพ่อ', en: "Father's Day" },
  { id: 'newyear', date: '01-01', th: 'ปีใหม่', en: 'New Year' },
];

/* Delivery: the shop quotes the fee by distance via Lalamove. We only capture
   what is needed to quote; no fee table is invented. Provinces/districts
   listed are the service area stated on Facebook. */
LHF.data.delivery = {
  provinces: [
    { id: 'nonthaburi', th: 'นนทบุรี', en: 'Nonthaburi', districts: ['เมืองนนทบุรี', 'บางกรวย', 'บางใหญ่', 'บางบัวทอง', 'ปากเกร็ด', 'ไทรน้อย'] },
    { id: 'bangkok', th: 'กรุงเทพมหานคร', en: 'Bangkok', districts: [] },
  ],
};


/* ---- data/catalog.js ---- */
/* =====================================================================
   CATALOG — every product below is taken from an official post.
   `source` is the post it came from; prices are the shop's own and hold
   until policies.priceValidUntil ("ราคาวันนี้ - 31 ธันวาคม"); after that
   they turn into "price on request" (see the end of this file).
   pricing: fixed | tiers | from | range | quote
   availability: available | seasonal | quote
   Thai meaning text is verbatim from the shop; English meanings are
   translations (meaningTranslated: true) and should be approved by the shop.
   ===================================================================== */
LHF.catalog = (function () {
  const flowers = {
    rose_white:     { th: 'กุหลาบขาว', en: 'White Rose', meaning: { th: 'ความซื่อสัตย์ ความเคารพ การให้เกียรติ และการเริ่มต้นใหม่ที่สง่างาม', en: 'Honesty, respect, honour and a graceful new beginning' } },
    rose_red:       { th: 'กุหลาบแดง', en: 'Red Rose', meaning: { th: 'ความรักที่มั่นคง : แสดงถึงความรักแท้ ความหลงใหล และความผูกพันที่จริงจัง', en: 'Steadfast love: true love, passion and a serious bond' } },
    rose_pink:      { th: 'กุหลาบชมพู', en: 'Pink Rose' },
    lily:           { th: 'ลิลลี่', en: 'Lily', meaning: { th: 'ความเคารพ ให้เกียรติ ความบริสุทธิ์ ไร้เดียงสา ความรักที่อ่อนโยน', en: 'Respect, honour, purity, innocence and gentle love' } },
    lisianthus:     { th: 'ลิเซียนทัส', en: 'Lisianthus', meaning: { th: 'มิตรภาพที่ยั่งยืน ความซาบซึ้งใจ การให้เกียรติ และการถนุถนอม ดูแลเอาใจใส่', en: 'Lasting friendship, gratitude, honour and tender care' } },
    carnation:      { th: 'คาร์เนชั่น', en: 'Carnation', meaning: { th: 'ความยินดีอย่างจริงใจ ความชื่นชมยินดี และความปรารถนาดี', en: 'Sincere joy, admiration and good wishes' } },
    stock:          { th: 'ดอกสต็อก', en: 'Stock', meaning: { th: 'ความสุขที่ยั่งยืน ความอุดมสมบูรณ์ และชีวิตที่เต็มไปด้วยความงาม', en: 'Lasting happiness, abundance and a life full of beauty' } },
    gerbera:        { th: 'เยอบีร่า', en: 'Gerbera', meaning: { th: 'ความสุข ความจริงใจ และการประสบความสำเร็จ', en: 'Happiness, sincerity and success' } },
    babys_breath:   { th: 'ยิปโซ', en: "Baby's Breath" },
    eucalyptus:     { th: 'ยูคาลิปตัส', en: 'Eucalyptus' },
    sunflower:      { th: 'ทานตะวัน', en: 'Sunflower' },
    chamomile:      { th: 'คาโมมายล์', en: 'Chamomile' },
    wax_flower:     { th: 'ดอกแว็กซ์', en: 'Wax Flower' },
    jasmine:        { th: 'มะลิ', en: 'Jasmine' },
    hydrangea:      { th: 'ไฮเดรนเยีย', en: 'Hydrangea' },
    pompon:         { th: 'ปอมปอม', en: 'Pompon' },
    soap_rose:      { th: 'ดอกไม้สบู่', en: 'Soap Flower' },
    forget_me_not:  { th: 'ฟอร์เก็ตมีน็อต', en: 'Forget-me-not' },
    banknotes:      { th: 'ธนบัตร', en: 'Banknotes' },
  };

  const colors = [
    { id: 'white', th: 'ขาว', en: 'White', hex: '#f4f1ea' },
    { id: 'red', th: 'แดง', en: 'Red', hex: '#b3141f' },
    { id: 'pink', th: 'ชมพู', en: 'Pink', hex: '#f2a7b6' },
    { id: 'blue', th: 'ฟ้า', en: 'Blue', hex: '#8fb5e0' },
    { id: 'yellow', th: 'เหลือง', en: 'Yellow', hex: '#f2c230' },
    { id: 'pastel', th: 'พาสเทล', en: 'Pastel', hex: '#e8d9ea' },
    { id: 'green', th: 'เขียว', en: 'Green', hex: '#7f9a7a' },
    { id: 'black', th: 'ห่อดำ', en: 'Black wrap', hex: '#1c1a19' },
    { id: 'mixed', th: 'หลากสี', en: 'Mixed', hex: '#d9a066' },
  ];

  const categories = [
    { id: 'bouquet', th: 'ช่อดอกไม้', en: 'Bouquets' },
    { id: 'basket', th: 'กระเช้า / แจกัน', en: 'Baskets & vases' },
    { id: 'box', th: 'กล่องดอกไม้', en: 'Flower boxes' },
    { id: 'garland', th: 'พวงมาลัย', en: 'Garlands' },
    { id: 'money', th: 'ช่อธนบัตร', en: 'Money bouquets' },
    { id: 'wedding', th: 'ช่อเจ้าสาว', en: 'Wedding' },
    { id: 'wreath', th: 'พวงหรีด', en: 'Wreaths' },
  ];

  /* Occasions evidenced by the shop's own hashtags / highlights */
  const occasions = [
    { id: 'graduation', th: 'รับปริญญา', en: 'Graduation', tag: '#รับปริญญา', image: 'single_rose', blurb: { th: 'ช่อรับปริญญา ตั้งแต่กุหลาบดอกเดียวไปจนถึงช่อใหญ่ ถ่ายรูปสวย', en: 'From a single congratulations rose to an oversized bouquet that photographs well.' } },
    { id: 'love', th: 'ให้แฟน', en: 'For your partner', tag: '#ของขวัญให้แฟน', image: 'red_crown', blurb: { th: 'กุหลาบแดงห่อดำ ช่อใหญ่ เซอร์ไพรส์ให้ถึงหน้าประตู', en: 'Red roses in black wrap, oversized, delivered to the door as a surprise.' } },
    { id: 'birthday', th: 'วันเกิด', en: 'Birthday', tag: '#ของขวัญวันเกิด', image: 'bouquet_890', blurb: { th: 'ช่อสีสดใสหรือพาสเทล เปลี่ยนสีกระดาษและโบว์ได้', en: 'Bright or pastel bouquets. Paper and ribbon colours can be changed.' } },
    { id: 'anniversary', th: 'ครบรอบ', en: 'Anniversary', tag: '#ของขวัญวันครบรอบแต่งงาน', image: 'red_black', blurb: { th: 'กุหลาบแดงคือคำตอบที่ไม่เคยผิด', en: 'Red roses are never the wrong answer.' } },
    { id: 'congratulations', th: 'แสดงความยินดี', en: 'Congratulations', tag: '#ดอกไม้แสดงความยินดี', image: 'box_congrats', blurb: { th: 'กล่องดอกไม้และช่อโทนขาว สำหรับความสำเร็จและการเริ่มต้นใหม่', en: 'White-toned boxes and bouquets for success and new beginnings.' } },
    { id: 'getwell', th: 'เยี่ยมไข้', en: 'Get well', tag: '#กระเช้าเยี่ยมไข้', image: 'flowers_basket', blurb: { th: 'กระเช้าดอกไม้สด ปรับสีได้ตามชอบ ส่งในนนทบุรีและกรุงเทพฯ', en: 'Fresh-flower baskets, colours to your liking, delivered across Nonthaburi and Bangkok.' } },
    { id: 'valentine', th: 'วาเลนไทน์', en: "Valentine's", tag: '#ของขวัญวาเลนไทน์', image: 'red_crown', blurb: { th: 'สำรองคิวล่วงหน้าให้ทันวันที่ 14 นะคะ', en: 'Book early so it arrives on the 14th.' } },
    { id: 'mothers', th: 'วันแม่', en: "Mother's Day", tag: '#ดอกไม้วันแม่', image: 'mothers_garlands', seasonal: '08-12', blurb: { th: 'พวงมาลัยมะลิ ช่อ และกระเช้า ทุกแบบเป็นดอกไม้สด', en: 'Jasmine garlands, bouquets and baskets, all fresh flowers.' } },
    { id: 'wedding', th: 'ขอแต่งงาน / งานแต่ง', en: 'Proposal & wedding', tag: 'Wedding Bouquet', image: 'cover_collage', blurb: { th: 'ช่อเจ้าสาวและดอกไม้สำหรับวันขอแต่งงาน ปรึกษาทาง LINE ได้เลยค่ะ', en: 'Bridal bouquets and proposal flowers. Consult us on LINE.' } },
    { id: 'sympathy', th: 'แสดงความเสียใจ', en: 'Sympathy', tag: '#พวงหรีดดอกไม้สด', image: 'wreath', listTitle: { th: 'พวงหรีดดอกไม้สด', en: 'Fresh-flower wreaths' }, blurb: { th: 'พวงหรีดดอกไม้สด พร้อมป้ายข้อความ', en: 'Fresh-flower wreaths with a ribbon banner.' } },
  ];

  const P = LHF.data.policies;
  const products = [
    {
      id: 'white-rose', slug: 'white-rose', category: 'bouquet', featured: true, order: 1,
      name: { th: 'ช่อกุหลาบขาว Rose LayerFoam', en: 'White Rose, layered wrap' },
      price: 1090, pricing: 'fixed', size: { w: 60, h: 60 }, image: 'white_rose', images: ['white_rose'],
      flowers: ['rose_white', 'eucalyptus'], colors: ['white', 'green'], occasions: ['congratulations', 'graduation', 'anniversary'],
      wrap: { th: 'ห่อโฟมชั้นสีขาว (Rose LayerFoam) ริบบิ้นครีม', en: 'White layered foam wrap with cream ribbon' },
      meaning: { th: 'กุหลาบขาว สื่อถึง ความซื่อสัตย์ ความเคารพ การให้เกียรติ และการเริ่มต้นใหม่ที่สง่างาม', en: 'White roses stand for honesty, respect, honour and a graceful new beginning.' }, meaningTranslated: true,
      priceValidUntil: P.priceValidUntil, availability: 'available', leadDays: P.leadTimeDays,
      source: { url: 'https://www.instagram.com/littlehouseflower/p/Dcxqw7NTB74/', date: '2026-09-02' },
    },
    {
      id: 'red-crown', slug: 'red-roses-black-wrap-crown', category: 'bouquet', featured: true, order: 2,
      name: { th: 'ช่อกุหลาบแดงห่อดำ พร้อมมงกุฎ', en: 'Red roses in black wrap, with crown' },
      price: 2290, pricing: 'fixed', image: 'red_crown', images: ['red_crown'],
      flowers: ['rose_red'], colors: ['red', 'black'], occasions: ['love', 'anniversary', 'valentine', 'wedding', 'birthday'],
      wrap: { th: 'กระดาษดำเงา ริบบิ้น LOVE IS ETERNAL มงกุฎคริสตัล', en: 'Glossy black paper, LOVE IS ETERNAL ribbon, crystal crown' },
      meaning: { th: 'กุหลาบแดง : ความรักที่มั่นคง แสดงถึงความรักแท้ ความหลงใหล และความผูกพันที่จริงจัง — โอกาสที่เหมาะสม: วันวาเลนไทน์ / วันครบรอบ / การขอแต่งงาน / ขอเป็นแฟน / วันเกิดคนรัก', en: 'Red roses: steadfast love, true love, passion and a serious bond. For Valentine’s, anniversaries, proposals, asking someone out, a partner’s birthday.' }, meaningTranslated: true,
      priceValidUntil: P.priceValidUntil, availability: 'available', leadDays: P.leadTimeDays,
      source: { url: 'https://www.instagram.com/littlehouseflower/p/DcxShKUTchd/', date: '2026-09-01' },
    },
    {
      id: 'single-rose', slug: 'single-rose', category: 'bouquet', featured: true, order: 3,
      name: { th: 'ช่อกุหลาบ 1 ดอก', en: 'Single rose' },
      price: 250, pricing: 'tiers', tiers: [{ min: 1, price: 250 }, { min: 4, price: 220 }, { min: 8, price: 200 }, { min: 12, price: 180 }],
      size: { w: 30, h: 40 }, image: 'single_rose', images: ['single_rose'],
      flowers: ['rose_red'], colors: ['red', 'white', 'pink'], occasions: ['graduation', 'congratulations'],
      variants: { th: 'สีขาว / แดง / ชมพู', en: 'White / red / pink' },
      wrap: { th: 'ห่อใส เขียนคำว่า Congrats ริบบิ้นแดงเข้ม', en: 'Clear wrap, hand-written Congrats, burgundy ribbon' },
      notes: { th: '1–3 ช่อ ช่อละ 250.- · 4–7 ช่อ 220.- · 8–11 ช่อ 200.- · 12 ช่อขึ้นไป 180.-', en: '1–3: ฿250 each · 4–7: ฿220 · 8–11: ฿200 · 12+: ฿180' },
      priceValidUntil: P.priceValidUntil, availability: 'available', leadDays: P.leadTimeDays, maxQty: 60, notesArePrices: true,
      source: { url: 'https://www.instagram.com/littlehouseflower/p/Dcw9R3Wz9s5/', date: '2026-09-01' },
    },
    {
      id: 'kitty', slug: 'kitty-handmade', category: 'bouquet', featured: true, order: 4,
      name: { th: 'ช่อคิตตี้ handmade', en: 'Kitty bouquet, handmade' },
      price: 2690, pricing: 'fixed', size: { w: 70, h: 60 }, image: 'kitty', images: ['kitty'],
      flowers: ['carnation', 'soap_rose'], colors: ['pink', 'white'], occasions: ['birthday', 'love', 'graduation'],
      wrap: { th: 'กระดาษชมพู-ขาวจับจีบ โบว์ชมพูเข้ม', en: 'Pleated pink and white paper, hot-pink bow' },
      leadNote: true,
      notes: { th: 'ตัวพื้นสีขาวทำจากดอกคาร์เนชั่นสด ตัวโบว์กุหลาบทำจากดอกไม้สบู่ มีกลิ่นหอมอ่อนๆ อุปกรณ์ตกแต่งหน้าตาทำจากวัสดุประดิษฐ์ เนื่องจากเป็นงานแฮนด์เมด หน้าตาและดอกไม้จะเป็นไปตามฤดูกาล แนะนำสั่งล่วงหน้า 3–7 วัน', en: 'The white face is fresh carnations; the rose bow is lightly scented soap flowers; the features are craft materials. Handmade, so the look follows the season. Order 3–7 days ahead.' },
      priceValidUntil: P.priceValidUntil, availability: 'available', leadDays: P.handmadeLeadDays,
      source: { url: 'https://www.instagram.com/littlehouseflower/p/Dcvqpe8zf3g/', date: '2026-09-01' },
    },
    {
      id: 'red-black', slug: 'red-roses-black-wrap', category: 'bouquet', featured: true, order: 5,
      name: { th: 'ช่อกุหลาบแดงห่อดำ', en: 'Red roses, black wrap' },
      price: 990, pricing: 'fixed', size: { w: 55, h: 60 }, image: 'red_black', images: ['red_black'],
      flowers: ['rose_red', 'wax_flower', 'eucalyptus'], colors: ['red', 'black'], occasions: ['love', 'anniversary', 'valentine'],
      wrap: { th: 'กระดาษดำด้าน ริบบิ้นแดงเข้ม', en: 'Matte black paper, burgundy ribbon' },
      meaning: { th: 'กุหลาบแดง : สื่อถึง ความรักที่เร่าร้อน ความปรารถนา และการมอบหัวใจให้ทั้งหมด — กระดาษห่อสีดำ : เพิ่มความรู้สึกน่าค้นหา ความลึกลับ ลักชูรี และแสดงถึงความรักที่มั่นคง ลึกซึ้ง ไม่เสื่อมคลาย', en: 'Red roses: passion, desire and giving your whole heart. Black wrap: intrigue, mystery, luxury, and a love that is steady, deep and undimmed.' }, meaningTranslated: true,
      priceValidUntil: P.priceValidUntil, availability: 'available', leadDays: P.leadTimeDays,
      source: { url: 'https://www.instagram.com/littlehouseflower/p/DcvETrAzfAM/', date: '2026-08-31' },
    },
    {
      id: 'box-congratulations', slug: 'box-congratulations', category: 'box', featured: true, order: 6,
      name: { th: 'Box Congratulations', en: 'Box Congratulations' },
      price: 1490, pricing: 'fixed', size: { w: 40, h: 50 }, image: 'box_congrats', images: ['box_congrats'],
      flowers: ['lily', 'carnation', 'stock', 'gerbera', 'babys_breath'], colors: ['white', 'blue'], occasions: ['congratulations', 'graduation'],
      wrap: { th: 'กล่องกลมสีครีม ริบบิ้นน้ำเงิน ป้าย Congratulations', en: 'Cream hat box, navy ribbon, Congratulations pick' },
      meaning: { th: 'ดอกลิลลี่: ความสำเร็จที่สง่างาม ความเจริญรุ่งเรือง และการเริ่มต้นใหม่ที่สดใส · ดอกคาร์เนชั่น: ความยินดีอย่างจริงใจ · ดอกสต็อก: ความสุขที่ยั่งยืน · ดอกเยอบีร่า: ความสุข ความจริงใจ และการประสบความสำเร็จ', en: 'Lily: graceful success, prosperity and a bright new start · Carnation: sincere joy · Stock: lasting happiness · Gerbera: happiness, sincerity and success.' }, meaningTranslated: true,
      priceValidUntil: P.priceValidUntil, availability: 'available', leadDays: P.leadTimeDays,
      source: { url: 'https://www.instagram.com/littlehouseflower/p/DcuoFqrT_ow/', date: '2026-08-31' },
    },
    {
      id: 'lily-lisianthus', slug: 'lily-lisianthus', category: 'bouquet', featured: true, order: 7,
      name: { th: 'ช่อ Lily & Lisianthus', en: 'Lily & Lisianthus' },
      price: 1790, pricing: 'fixed', size: { w: 70, h: 80 }, image: 'lily_lisianthus', images: ['lily_lisianthus'],
      flowers: ['lily', 'lisianthus', 'eucalyptus'], colors: ['white', 'green'], occasions: ['congratulations', 'graduation', 'anniversary'],
      wrap: { th: 'กระดาษขาวซ้อนชั้น ริบบิ้นครีม การ์ดเขียนมือ', en: 'Layered white paper, cream ribbon, handwritten card' },
      meaning: { th: 'Lily: ความเคารพ ให้เกียรติ ความบริสุทธิ์ ไร้เดียงสา ความรักที่อ่อนโยน · Lisianthus: มิตรภาพที่ยั่งยืน ความซาบซึ้งใจ การให้เกียรติ และการถนุถนอม ดูแลเอาใจใส่', en: 'Lily: respect, honour, purity, innocence and gentle love · Lisianthus: lasting friendship, gratitude, honour and tender care.' }, meaningTranslated: true,
      priceValidUntil: P.priceValidUntil, availability: 'available', leadDays: P.leadTimeDays,
      source: { url: 'https://www.instagram.com/littlehouseflower/p/DcxJbNNT79F/', date: '2026-09-01' },
    },
    {
      id: 'bouquet-890', slug: 'flower-bouquet-50', category: 'bouquet', featured: true, order: 8,
      name: { th: 'ช่อดอกไม้ 50 × 50 ซม.', en: 'Flower bouquet, 50 × 50 cm' },
      /* the 890.- price ran only to 31 Aug 2026 — ask, never quote a stale figure */
      price: null, pricing: 'quote', size: { w: 50, h: 50 }, image: 'bouquet_890', images: ['bouquet_890', 'promo_bouquets'],
      flowers: ['gerbera', 'carnation', 'chamomile', 'rose_pink'], colors: ['pastel', 'mixed'], occasions: ['birthday', 'graduation', 'congratulations'],
      wrap: { th: 'เปลี่ยนสีกระดาษ/โบว์ได้ทุกช่อ', en: 'Paper and ribbon colour changeable on every bouquet' },
      notes: { th: 'ราคาในโพสต์เดือน มิ.ย.–ส.ค. 69 หมดช่วงแล้ว รบกวนสอบถามราคาปัจจุบันทาง LINE และเช็กสีกับแบบอีกครั้งตามวันที่ต้องการใช้นะคะ', en: 'The June–August 2026 price has ended. Ask us on LINE for today’s price, and check colours and design again for your date.' },
      availability: 'quote', leadDays: P.leadTimeDays,
      source: { url: 'https://www.instagram.com/littlehouseflower/p/DaMqifIE86D/', date: '2026-06-29' },
    },
    {
      id: 'basket-boxset', slug: 'basket-boxset', category: 'box', featured: true, order: 9,
      name: { th: 'Basket & Boxset ทานตะวัน', en: 'Basket & Boxset, sunflower' },
      /* the "start 1090" on this photo is from Aug 2025: never quote it as today's price */
      price: null, pricing: 'quote', image: 'basket_boxset', images: ['basket_boxset'],
      flowers: ['sunflower', 'chamomile', 'babys_breath', 'eucalyptus'], colors: ['yellow', 'white'], occasions: ['congratulations', 'getwell', 'birthday'],
      notes: { th: 'คิดราคาตามแบบและชนิดดอกไม้ สอบถามราคาปัจจุบันทาง LINE ได้เลยค่ะ · แนะนำสั่งล่วงหน้า 1–2 วัน', en: 'Priced by design and flowers: ask us on LINE for today’s price. Best ordered 1–2 days ahead.' },
      availability: 'available', leadDays: P.leadTimeDays,
      source: { url: 'https://www.instagram.com/littlehouseflower/p/DNiqvhJPWCX/', date: '2025-08-19' },
    },
    {
      id: 'flowers-basket', slug: 'flowers-basket', category: 'basket', featured: false, order: 10,
      name: { th: 'กระเช้าดอกไม้ Flowers', en: 'Wicker flower basket' },
      price: null, pricing: 'quote', image: 'flowers_basket', images: ['flowers_basket'],   // Aug 2025 price, on request now
      flowers: ['rose_white', 'carnation', 'lisianthus', 'babys_breath', 'pompon'], colors: ['white', 'green'], occasions: ['getwell', 'congratulations', 'birthday'],
      notes: { th: 'ทุกแบบสามารถปรับสีได้ คิดราคาตามชนิดดอกไม้ ลูกค้าถามกันมาเยอะว่ามีแบบแจกัน/กระเช้าไหม — มีแบบอีกเพียบ ตั้งงบและรีเควสมาได้เลย', en: 'Every design can be re-coloured; priced by flower type. Many more basket and vase designs available — set a budget and request.' },
      availability: 'available', leadDays: P.leadTimeDays,
      source: { url: 'https://www.instagram.com/littlehouseflower/p/DNiqvhJPWCX/', date: '2025-08-19' },
    },
    {
      id: 'mothers-garland', slug: 'mothers-day-garland', category: 'garland', featured: false, order: 11,
      name: { th: 'พวงมาลัยมะลิวันแม่', en: "Mother's Day jasmine garland" },
      price: null, pricing: 'quote', image: 'mothers_garlands', images: ['mothers_garlands', 'mothers_blue'],   // 2026 season was 590–1,290.- (pre-order closed 9 Aug 2026)
      flowers: ['jasmine'], colors: ['white', 'blue'], occasions: ['mothers'],
      notes: { th: 'พวงมาลัย ช่อดอกไม้ กระเช้า ทุกแบบเป็นดอกไม้สด · เปิดพรีออเดอร์ทุกปีก่อนวันแม่', en: 'Garlands, bouquets and baskets, all fresh flowers. Pre-orders open each year ahead of 12 August.' },
      availability: 'seasonal', season: 'mothers', leadDays: P.leadTimeDays,
      source: { url: 'https://www.instagram.com/littlehouseflower/p/DbdQxwyk9dj/', date: '2026-07-31' },
    },
    {
      id: 'mothers-blue', slug: 'mothers-day-blue-white', category: 'bouquet', featured: false, order: 12,
      name: { th: 'คอลเลกชันวันแม่ โทนฟ้าขาว', en: "Mother's Day, blue & white" },
      price: null, pricing: 'quote', image: 'mothers_blue', images: ['mothers_blue'],   // 2026 season was 690–1,490.-
      flowers: ['hydrangea', 'lily', 'chamomile', 'jasmine', 'gerbera'], colors: ['blue', 'white'], occasions: ['mothers'],
      notes: { th: 'ช่อไฮเดรนเยีย · ช่อลิลลี่ · กระเป๋าดอกไม้ JUST FOR YOU พร้อมมาลัย · มาลัยในกล่อง · เปิดพรีออเดอร์ทุกปีก่อนวันแม่', en: 'Hydrangea bouquet · Lily bouquet · JUST FOR YOU flower bag with garland · Boxed garland. Pre-orders open each year ahead of 12 August.' },
      availability: 'seasonal', season: 'mothers', leadDays: P.leadTimeDays,
      source: { url: 'https://www.instagram.com/littlehouseflower/p/DbdQxwyk9dj/', date: '2026-07-31' },
    },
    {
      id: 'roses-200', slug: '200-roses', category: 'bouquet', featured: false, order: 13,
      name: { th: 'ช่อกุหลาบ 200 ดอก', en: '200-rose bouquet' },
      price: null, pricing: 'quote', image: 'reel_200roses', images: ['reel_200roses'], portrait: true,
      flowers: ['rose_red'], colors: ['red', 'white'], occasions: ['anniversary', 'wedding', 'love'],
      notes: { th: 'ช่อใหญ่พิเศษ สั่งทำล่วงหน้า สอบถามราคาและคิวได้เลยค่ะ', en: 'An extra-large statement piece, made to order. Ask us for a price and a date.' },
      availability: 'quote', leadDays: 3,   // operating default, not a published rule: the shop confirms timing on LINE
      source: { url: 'https://www.instagram.com/littlehouseflower/reel/DSbPkOPkxA3/', date: '2025-12-18' },
    },
    {
      id: 'wreath', slug: 'fresh-flower-wreath', category: 'wreath', featured: false, order: 14,
      name: { th: 'พวงหรีดดอกไม้สด', en: 'Fresh-flower wreath' },
      price: null, pricing: 'quote', image: 'wreath', images: ['wreath'], portrait: true,
      flowers: ['rose_pink', 'carnation', 'chamomile', 'pompon'], colors: ['pastel', 'pink'], occasions: ['sympathy'],
      notes: { th: 'ในภาพเป็นพวงหรีดพร้อมป้ายข้อความ แจ้งชื่อผู้วายชนม์ วัด ศาลา และเวลาสวด พร้อมข้อความบนป้าย (เช่น ชื่อผู้มอบหรือบริษัท) ได้ในหมายเหตุ แล้วทางร้านจะยืนยันรายละเอียดทาง LINE ค่ะ', en: 'Shown with a ribbon banner. In your notes, add the name of the deceased, the temple, the sala and the prayer time, and the wording for the banner (for example the sender’s or company’s name). We confirm the details on LINE.' },
      availability: 'quote', leadDays: 1,
      source: { url: 'https://www.instagram.com/littlehouseflower/reel/DcyEtTyTQek/', date: '2026-09-02' },
    },
    {
      id: 'money-bouquet', slug: 'money-bouquet', category: 'money', featured: false, order: 15,
      name: { th: 'ช่อธนบัตร', en: 'Money bouquet' },
      price: null, pricing: 'quote', image: null, thumb: 'hl_moneybouquet',
      flowers: ['banknotes', 'rose_red'], colors: ['mixed'], occasions: ['graduation', 'birthday'],
      notes: { th: 'ดูตัวอย่างในไฮไลต์ “ช่อธนบัตร” บนอินสตาแกรม แจ้งจำนวนเงินและโทนสีที่ต้องการ', en: 'See the “ช่อธนบัตร” highlight on Instagram. Tell us the amount and colour you want.' },
      availability: 'quote', leadDays: 2,   // operating default (see 200 roses)
      source: { url: 'https://www.instagram.com/littlehouseflower/', date: '' },
    },
    {
      id: 'wedding-bouquet', slug: 'wedding-bouquet', category: 'wedding', featured: false, order: 16,
      name: { th: 'ช่อเจ้าสาว', en: 'Bridal bouquet' },
      price: null, pricing: 'quote', image: null, thumb: 'hl_wedding',
      flowers: ['rose_white', 'lisianthus'], colors: ['white'], occasions: ['wedding'],
      notes: { th: 'ดูตัวอย่างในไฮไลต์ “Wedding Bouquet” ส่งเรฟและวันงานมาปรึกษาได้เลยค่ะ', en: 'See the “Wedding Bouquet” highlight. Send a reference and your date to consult.' },
      availability: 'quote', leadDays: 7,   // operating default (see 200 roses)
      source: { url: 'https://www.instagram.com/littlehouseflower/', date: '' },
    },
  ];

  /* After the price-validity date (Bangkok calendar) every priced design becomes
     "price on request": these are the shop's prices for this period only, and an
     expired figure must never be shown, quoted or summed into a total. */
  if (!LHF.data.pricesCurrent) {
    products.forEach((p) => {
      if (p.pricing === 'quote') return;
      Object.assign(p, { pricing: 'quote', price: null, priceMax: null, tiers: null });
      delete p.priceValidUntil;
      if (p.notesArePrices) p.notes = null;
    });
  }

  const byId = (id) => products.find((p) => p.id === id);
  const bySlug = (slug) => products.find((p) => p.slug === slug || p.id === slug);
  const occasion = (id) => occasions.find((o) => o.id === id);
  const color = (id) => colors.find((c) => c.id === id);
  const category = (id) => categories.find((c) => c.id === id);
  const flower = (id) => flowers[id];

  function filter(opts) {
    opts = opts || {};
    return products.filter((p) =>
      (!opts.category || p.category === opts.category) &&
      (!opts.occasion || (p.occasions || []).includes(opts.occasion)) &&
      (!opts.color || (p.colors || []).includes(opts.color)) &&
      (!opts.availability || p.availability === opts.availability) &&
      (opts.includeSeasonal || p.availability !== 'seasonal' || opts.occasion === p.season)
    ).sort((a, b) => a.order - b.order);
  }
  /* "change the colours · free card" is bouquet talk; on a funeral wreath or a jasmine garland it reads wrong */
  const customisable = (p) => !['wreath', 'garland'].includes(p.category);
  const featured = () => products.filter((p) => p.featured).sort((a, b) => a.order - b.order);
  const related = (p, n) => products.filter((q) => q.id !== p.id && q.image && q.availability !== 'seasonal' && (q.category === p.category || q.occasions.some((o) => p.occasions.includes(o)))).slice(0, n || 3);

  return { flowers, colors, categories, occasions, products, byId, bySlug, occasion, color, category, flower, filter, featured, related, customisable };
})();


export const legacy=LHF;
export const catalog=structuredClone(LHF.catalog.products);
export const data=structuredClone(LHF.data);
export const images={"logo_sm":{"file":"fb_profile_logo_720__160.jpg","w":160,"h":160,"alt_en":"Little House Flower monogram","alt_th":"โลโก้ Little House Flower","src":"img/fb_profile_logo_720__160.webp"},"cover_collage":{"file":"fb_cover_collage_960__960.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAQABgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDpLrVDDckCPO08jfgYH4VmRahcXMv2jEkUQYsGIO3aO5rSn0iGeZpHkky3JGRUNzZwx2aWI8x8LgNvwfxqehS30Kqa3cPIXhCywK5V3C5KkL29cnmiqt19p07bCTBb2xz8y43SdO3UnGBRS1NeRH//2Q==","w":960,"h":647,"alt_en":"Customers holding Little House Flower bouquets: sunflowers, white roses, red roses, a proposal set-up","alt_th":"ลูกค้าถือช่อดอกไม้จาก Little House Flower ทานตะวัน กุหลาบขาว กุหลาบแดง และเซ็ตขอแต่งงาน","src":"img/fb_cover_collage_960__960.webp","srcset":"img/fb_cover_collage_960__960-640w.webp 640w, img/fb_cover_collage_960__960.webp 960w"},"white_rose":{"file":"hr_p05_whiterose_1090__1200.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYABIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCGKaP7WtsT+9YbgMcY+tav2B9vO386raNHatK0skW6RSd2Cc7Rz0HufxrXjcSB18nYwxgqeCPb8QfyqVqJ6HPPbEO3A6+tFWJM+Y3Pc0VN0BDpJzNLtVXDuq89uDzXTyyLFabU4IQAsTycUUVq1pcm+tjnMM3zY680UUVlYo//2Q==","w":900,"h":1200,"alt_en":"Florist holding a large white rose bouquet with eucalyptus in a white layered foam wrap","alt_th":"ช่อกุหลาบขาวช่อใหญ่แซมยูคาลิปตัส ห่อโฟมชั้นสีขาว ถือโดยช่างจัดดอกไม้","src":"img/hr_p05_whiterose_1090__1200.webp","srcset":"img/hr_p05_whiterose_1090__1200-640w.webp 640w, img/hr_p05_whiterose_1090__1200.webp 900w"},"red_crown":{"file":"hr_p06_redrose_basket_2290__1200.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYABgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCd9YhiTc4ZQMD7uahXxGgl2tayBQeTwTj6Vz+pIzOJWyQOgyR9Kha8GPMclmY4OTyPrUxbaudFOnTbam7HfRTpcWqzxg7HGRuGDRXK6A11LBcypLKiM3y+h4/pRUuok7Gapt7GheaQLqAovDHlecc1ljw7cicq0O5WTG5W6GiiueFRx0OjlTdzqrGxS0tUgUDCjnByM96KKKe+pJ//2Q==","w":1200,"h":1200,"alt_en":"Dozens of red roses in a glossy black wrap with a LOVE IS ETERNAL ribbon and a small crystal crown","alt_th":"กุหลาบแดงหลายสิบดอกห่อกระดาษดำเงา ริบบิ้น LOVE IS ETERNAL และมงกุฎเล็ก","src":"img/hr_p06_redrose_basket_2290__1200.webp","srcset":"img/hr_p06_redrose_basket_2290__1200-640w.webp 640w, img/hr_p06_redrose_basket_2290__1200.webp 1200w"},"lily_lisianthus":{"file":"hr_p07_lily_lisianthus_1790__1200.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYABIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwB8dgwiB4AxyTVS8iFtjziE3Yxnvmt5Ldbm3hkUDKJ8wY9eO1YOsRP5LI7MVTao45ZiwOOe3J/KoElcgMPPSip8iiiwG/Yzb7ZScAjjrWPrsg+aQMGw6kkc9jRRWkdiXuUBeLj/AFb/AJCiiisudm3Ij//Z","w":900,"h":1200,"alt_en":"Florist holding an oversized white lily and lisianthus bouquet with a handwritten card","alt_th":"ช่อลิลลี่และลิเซียนทัสสีขาวช่อใหญ่ พร้อมการ์ดเขียนมือ","src":"img/hr_p07_lily_lisianthus_1790__1200.webp","srcset":"img/hr_p07_lily_lisianthus_1790__1200-640w.webp 640w, img/hr_p07_lily_lisianthus_1790__1200.webp 900w"},"single_rose":{"file":"hr_p08_single_rose_250__1200.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYABUDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDTuxtniiIGGYA1y2vJ5LLvAVjn5Q2cDtXW6hbvJMAA4WEjdtPJyOOnb1NZevOltojyT/NceWsZXqA2fvfzoaBbHElQWO7NFaFp9mt7ZGuYWlklG7/dHailcqx6BfXJE0FzajzC6EPGepUdDj1ByPxrOu7YzWFzNK3mBlaQDHUkcD8OlFFU9SVpG5ysVwuwCe33MABlTjNFFFIZ/9k=","w":1041,"h":1200,"alt_en":"Three single red rose bouquets in clear wrap with Congrats handwritten and burgundy ribbon","alt_th":"ช่อกุหลาบดอกเดียวสามช่อ ห่อใสเขียนคำว่า Congrats ผูกริบบิ้นแดงเข้ม","src":"img/hr_p08_single_rose_250__1200.webp","srcset":"img/hr_p08_single_rose_250__1200-640w.webp 640w, img/hr_p08_single_rose_250__1200.webp 1041w"},"kitty":{"file":"hr_p09_kitty_2690__1200.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYABMDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDRQ77xFxn5Wx+lN8xLa9WAKwWQZKnp+H9frVVp7f7YYp5Wj8yMhSrEZ5GQSOgwKfO8LX9jbxBl2yYBA+XaR0B70FWXLc38jAwOMUU02s+fluAB2G2ikKxy1rYtq88gjl2bEU59QSe1XZ7U2bWas5d4p41JwenI69KKKOgkzpj1ooopgf/Z","w":960,"h":1200,"alt_en":"Mirror selfie holding a handmade Kitty-shaped bouquet of white carnations with a pink rose bow","alt_th":"ช่อคิตตี้แฮนด์เมด คาร์เนชั่นขาว โบว์กุหลาบชมพู ถ่ายหน้ากระจก","src":"img/hr_p09_kitty_2690__1200.webp","srcset":"img/hr_p09_kitty_2690__1200-640w.webp 640w, img/hr_p09_kitty_2690__1200.webp 960w"},"red_black":{"file":"hr_p10_redblack_990__1200.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYABgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwB0mpNDfsXdkUNnBBxt71o/8JNp2FDPIpZsHKfd9zWNqemXQdvLYthDKSTkkjtWMJJCu8FgQNwGMFv/AK/NFy4RT3dj0eCeOeIPDIkiHoyEEUVmeHrSSw0qKKXaGYlyoXBXPY+pFFBBXmuFstWgtC7yM6gk4ztye5qkRP8A8JeJ0t3MIIXcF4xjBNFFSi1oa/29WlcA8gmiiinF3Jasf//Z","w":1200,"h":1200,"alt_en":"Nine red roses with wax flower in a matte black wrap and burgundy ribbon, in the studio","alt_th":"กุหลาบแดงเก้าดอกแซมดอกแว็กซ์ ห่อดำด้าน ริบบิ้นแดงเข้ม ถ่ายในสตูดิโอ","src":"img/hr_p10_redblack_990__1200.webp","srcset":"img/hr_p10_redblack_990__1200-640w.webp 640w, img/hr_p10_redblack_990__1200.webp 1200w"},"box_congrats":{"file":"hr_p11_box_congrats_1490__1200.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYABIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCo7x2+0yZAZgowM8mtOK0Zh0rNuUIvbVsfLHJufntiuj05BMo4TBBI28gj61InoiidN5PFFa7QLuPyjrRTEc5emFpYyrq2cjGfauj0W0jtrPMf/LT5j9aKKpaxuKWkrEzt87fWiiikB//Z","w":900,"h":1200,"alt_en":"Florist holding a hat-box arrangement of white lily, gerbera, blue carnation and baby's breath with a Congratulations pick","alt_th":"กล่องดอกไม้ ลิลลี่ขาว เยอบีร่า คาร์เนชั่นฟ้า ยิปโซ พร้อมป้าย Congratulations","src":"img/hr_p11_box_congrats_1490__1200.webp","srcset":"img/hr_p11_box_congrats_1490__1200-640w.webp 640w, img/hr_p11_box_congrats_1490__1200.webp 900w"},"mothers_garlands":{"file":"hr_p01a_mothersday_2026__1200.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYABMDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDZ0rURNK8YRY2YlsH1rU3s3933rlbLzbTV5EC5VXWN37jcv8q2NQjuCUjg84qASxjOD0OBx70IRp/lRVXTHf8As63+0ZMuwbi3XNFMDNi8mW3mu5IFEpkHKsTnGApI9cVpCXZOYzgMyl/wHFFFZp3VynuUorpfKXDDp60UUVQj/9k=","w":960,"h":1200,"alt_en":"Mother's Day jasmine garlands on pleated paper pedestals, some in presentation boxes","alt_th":"พวงมาลัยมะลิวันแม่บนแท่นกระดาษพลีท บางแบบอยู่ในกล่อง","src":"img/hr_p01a_mothersday_2026__1200.webp","srcset":"img/hr_p01a_mothersday_2026__1200-640w.webp 640w, img/hr_p01a_mothersday_2026__1200.webp 960w"},"mothers_blue":{"file":"hr_p01b_mothersday_2026_b__1200.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYABMDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDbj1CMat9nJ5xtw33frWkJA3K+WR9Kwb3TpJb+K4ifPzAkN2+mPpU+p3U9uGW2blVYnam75uMA/nQI0yNxzgDPpRTYyfLTcRnAzRQMz5o5VsRLHLvuA4ALcA898VYWRoZZCAQpj3g5785GP89aKKm4ykNQAUAcjAooorJzdzRRVj//2Q==","w":960,"h":1200,"alt_en":"Mother's Day collection in blue and white: hydrangea bouquet, lily bouquet, flower bag with garland, boxed garland","alt_th":"คอลเลกชันวันแม่โทนฟ้าขาว ช่อไฮเดรนเยีย ช่อลิลลี่ กระเป๋าดอกไม้พร้อมมาลัย และมาลัยในกล่อง","src":"img/hr_p01b_mothersday_2026_b__1200.webp","srcset":"img/hr_p01b_mothersday_2026_b__1200-640w.webp 640w, img/hr_p01b_mothersday_2026_b__1200.webp 960w"},"promo_bouquets":{"file":"hr_p02a_june_promo__1200.jpg","lqip":"data:image/jpeg;base64,/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAYABYDASIAAhEBAxEB/8QAGQABAAMBAQAAAAAAAAAAAAAAAAIFBgED/8QAJhAAAgEDAwIHAQAAAAAAAAAAAQIDAAQRBRIxIUEGExRRYYGR0f/EABcBAAMBAAAAAAAAAAAAAAAAAAADBAL/xAAbEQADAQADAQAAAAAAAAAAAAABAhEAAxJBIv/aAAwDAQACEQMRAD8Au9O1LzvDsCOjROzFRtXORu6ff8qYmkRJkeRY7kDcqkhmPyv5+1mbK7e1kWGZmFsWyCOYz7j4Perr0byoFjfdIWDNK43HHbae3TpS17NThyqGHR16T1VvbmEhhk5ckDsKV73WmS3MYR0XkElTjgYHSlJZCxp1fHyqqzVEtg86pnci5BLDn6rT7o/LVYlYFefalKoX5WD3RNHenzdWVlGGLClKVi5k3//Z","w":430,"h":460,"alt_en":"A pastel bouquet of gerbera, carnation and chamomile in white and mint wrap with a Congratulations pick","alt_th":"ช่อเยอบีร่า คาร์เนชั่น และคาโมมายล์โทนพาสเทล ห่อขาวกับเขียวมิ้นต์ พร้อมป้าย Congratulations","src":"img/hr_p02a_june_promo__1200-crop.jpg"},"bouquet_890":{"file":"hr_p02b_june_promo_b__1200.jpg","lqip":"data:image/jpeg;base64,/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAYABUDASIAAhEBAxEB/8QAGQABAQADAQAAAAAAAAAAAAAAAAUCAwQG/8QAJxAAAgEEAgAEBwAAAAAAAAAAAQIDAAQRIQVRBhIxQRQiMkJhgaH/xAAWAQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAaEQADAQADAAAAAAAAAAAAAAAAAREhAjFR/9oADAMBAAIRAxEAPwDv47kBLApVGGgDn7T+eqszvFHYq830nOSBmovH8Yyo8sSyMh+RvQBt/wBxitsl58PYCK3tnmyxGFOtmp7WRrMPOX8aCUBZGkGzltN6+9K5ryWRrgh45LdlGGVlBJPdKQ0V+H8RTR8NKbpkMkAYRMx2dZGvfBNZeHr0Dh4BcucGVi2M5I82z+uqUpE8YsJl9JecpfStbr5IozhQrHBHe+8UpStcVhH2f//Z","w":768,"h":880,"alt_en":"Four 50 × 50 cm bouquets of gerbera and carnation in pastel and iridescent wraps","alt_th":"ช่อดอกไม้ขนาด 50 × 50 ซม. สี่แบบ เยอบีร่าและคาร์เนชั่น ห่อพาสเทลและกระดาษรุ้ง","src":"img/hr_p02b_june_promo_b__1200-crop.webp"},"basket_boxset":{"file":"hr_p03a_vase_basket_2025__1200.jpg","lqip":"data:image/jpeg;base64,/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAVABgDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAIEBf/EACUQAAIBBAEDBAMAAAAAAAAAAAECAwAEESEFEiJxEzFRYTKB8P/EABgBAAMBAQAAAAAAAAAAAAAAAAEDBAAC/8QAHREAAgICAwEAAAAAAAAAAAAAAAECEQMxUXGB8P/aAAwDAQACEQMRAD8A4ltxYfJHag92P9s/VdKDhrVpjCJrjrVeoyCPEfgE1SyCLj4njPyGbH4tnR81Upka8lglgSK2ZC0UqP3yHGdL+zrVQZ5zTS11X3g6CTsynhCk8ZnJETbLBt+Po0rXacjDcsIA07J6RVutcZONEjGsYpWePJOTu1XAYzSWrNsjgr0FFK/FSoijQqsK4YDIyaUq+hDJugsarFEoRAvsKUpQOkf/2Q==","w":712,"h":630,"alt_en":"A white hat box of sunflowers, chamomile, baby's breath and eucalyptus, with a second box behind","alt_th":"กล่องดอกไม้สีขาว ทานตะวัน คาโมมายล์ ยิปโซ และยูคาลิปตัส มีอีกกล่องวางอยู่ด้านหลัง","src":"img/hr_p03a_vase_basket_2025__1200-crop.webp"},"flowers_basket":{"file":"hr_p03b_vase_basket_2025_b__1200.jpg","lqip":"data:image/jpeg;base64,/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAYABQDASIAAhEBAxEB/8QAGAABAQEBAQAAAAAAAAAAAAAAAAQCBQP/xAAjEAACAQMDBAMAAAAAAAAAAAABAgMABBESEyEiMUFhFFFx/8QAFgEBAQEAAAAAAAAAAAAAAAAAAQAC/8QAGREBAQADAQAAAAAAAAAAAAAAAAECEiEx/9oADAMBAAIRAxEAPwDsX98LZEYnCmVVc/Sk4NTjdnmvUlZdMbaUyM5B45JqaVYb9GimZ1UnOoxkqAO591TGqIZUcRySyqCsiAjV+A9zxmsZZyJzLm023VY5JFGnkBvNKpv0gEykXKHUgPRgilM70tS2twbXZVNxFHSrH3nvW5bq/wDixQCKOCRF4YnJTxkAeqUo1nqlecNrDHEFKKx8llyTSlKi/9k=","w":580,"h":680,"alt_en":"A wicker basket of white roses, lisianthus, green carnations and baby's breath with a burlap Flowers tag","alt_th":"กระเช้าสานกุหลาบขาว ลิเซียนทัส คาร์เนชั่นเขียว และยิปโซ ป้ายผ้า Flowers","src":"img/hr_p03b_vase_basket_2025_b__1200-crop.webp"},"wreath":{"file":"fb_post_wreath_541__640.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYAA4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCWCPBHHA64HQVcSMlCVkGM8YA6UWMEclqJXkbafmHPFN+xfMSl9wf4Wi6flU8si04dSn4fvdlr5MwZFB/dufuken51tEMeQImHuKKKUZMJRSP/2Q==","w":361,"h":640,"alt_en":"Fresh-flower funeral wreath in pink, peach and lilac with a white ribbon banner","alt_th":"พวงหรีดดอกไม้สดโทนชมพู พีช ม่วงอ่อน พร้อมป้ายผ้าขาว","src":"img/fb_post_wreath_541__640.webp"},"reel_wreath":{"file":"p04_reel_DcyEtTyTQek_20260902__640.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYAA4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCaFUCBmfYD0bGamZhEuZXTbxh+mTU9jeJPbIsbosqjBRmK/wBOaZfanHA5jSJJmXbvJbgE54z+FL5j07HK29zdwrtikygJwrgMB9M9KtRSSuDLJHHKXwfmXp7AUUVlexra+h//2Q==","w":361,"h":640,"alt_en":"Reel cover: fresh-flower wreath","alt_th":"ปกรีล พวงหรีดดอกไม้สด","src":"img/p04_reel_DcyEtTyTQek_20260902__640.webp"},"reel_distance":{"file":"p12_reel_DcuWiZ_zFiV_20260831__640.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYAA4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCVYL6WIJMJY0z8pccfrTzp92FwtwpUHGVUf402WSW2jCNcySjBLSPkkk/nUlpchBvY7FIwCeMn8amy6CUSCIxRZTzndickffJqhLN/pEzylx8+wBucAf8A66KKe+hV7H//2Q==","w":360,"h":640,"alt_en":"Reel cover: a surprise bouquet delivery at the door","alt_th":"ปกรีล เซอร์ไพรส์ช่อดอกไม้หน้าประตู","src":"img/p12_reel_DcuWiZ_zFiV_20260831__640.webp"},"reel_love":{"file":"reel_DOsFPMCE7up_208k_love__640.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYAA4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDh0TIp+FUkEc1Z0tY3lCSHIY/dGM+3Wo7lVMp+YZ74FFylFy2J7WWxaL97CY5UIZZUyT+Iz0qpeRCGYqGySc4x0ooqeodD/9k=","w":360,"h":640,"alt_en":"Reel cover: red roses in a car at night with a love note","alt_th":"ปกรีล กุหลาบแดงในรถยามค่ำพร้อมข้อความความรัก","src":"img/reel_DOsFPMCE7up_208k_love__640.webp"},"reel_grad":{"file":"reel_DcdzhZETI9S_61k_grad__640.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYAA4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDJ0jwebmD7VqM5tos8oPvAY6k9qll8M6PkSRam7QtwDxwfTOK1bm5MV1EftbKBEVEQx1PfmsPV7i38tUaBQgbOVP3mxycf1rNSbNHFIrajrNnqEkMsqTiSMYyMcj86pPfwOAMSADp0ooq7Ihts/9k=","w":361,"h":640,"alt_en":"Reel cover: red roses and baby's breath close-up","alt_th":"ปกรีล กุหลาบแดงและยิปโซระยะใกล้","src":"img/reel_DcdzhZETI9S_61k_grad__640.webp"},"reel_51k":{"file":"reel_DcqRhU5TT4h_51k__640.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYAA4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDI+yzOzFYyQSGGO/BHFaFtYBbcLJgvnJx2pZp/sygIUQBx80bgsxPTjp1qwY5Rjz9pkxyV4BqI6Du2c1DqQM250j24xgr1rVXXl2/MeaKKdhn/2Q==","w":361,"h":640,"alt_en":"Reel cover: white lilies in a vase by the door","alt_th":"ปกรีล ลิลลี่ขาวในแจกัน วางริมประตู","src":"img/reel_DcqRhU5TT4h_51k__640.webp"},"reel_200roses":{"file":"reel_DSbPkOPkxA3_200roses__640.jpg","lqip":"data:image/jpeg;base64,/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAXABgDASIAAhEBAxEB/8QAGAABAAMBAAAAAAAAAAAAAAAAAAMEBQb/xAAmEAACAQMDBAEFAAAAAAAAAAABAgMABBEFEjEGEyFBFCNRcYGR/8QAFwEAAwEAAAAAAAAAAAAAAAAAAAEDAv/EABgRAQEBAQEAAAAAAAAAAAAAAAEAEQIh/9oADAMBAAIRAxEAPwDE0/p35mnwyx3SLK7FjtG7aAOPHBzjNSW/RmpPIjvJCmT5cSEkU0Q3NtqUMdtKEWRjuVuCcfb2cV20TyLcxKSOyw8qB5/OaWVeOk8LjuttMNjZ2lzHIw3HszgcSEDIY48euKVZ6itbm+a4guZpZO3L9JRJtVcE+sef3StDSXXatbKY5UkQ4dDlSPRrXS+uzbxRh1zHy5GS3PP9pSlA40bgsdzEkn2aUpRF/9k=","w":320,"h":300,"alt_en":"A 200-rose bouquet in white wrap with red ribbons, delivered to the door","alt_th":"ช่อกุหลาบแดง 200 ดอก ห่อกระดาษขาว ผูกริบบิ้นแดง ส่งถึงหน้าประตู","src":"img/reel_DSbPkOPkxA3_200roses__640-crop.webp"},"reel_19k":{"file":"reel_DcnY8owzYaa_19k__640.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYAA4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCSayC28c6FfnXcUzkr+PeqZXircGp3C2yRMgBHHykE4x2yMdajXUMoCFiZwSrenX/9dS1F9S1zx3RjC5kVn2rHtzndIdxH0PakW7hiAB3HIyQOcE/WiinyoOZs/9k=","w":361,"h":640,"alt_en":"Reel cover: a couple on a riverside terrace, one holding a bouquet","alt_th":"ปกรีล คู่รักบนระเบียงริมแม่น้ำ ถือช่อดอกไม้","src":"img/reel_DcnY8owzYaa_19k__640.webp"},"reel_10k":{"file":"reel_Dch0UGrTIbN_10k__640.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYAA4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwBmt6lrkNu8sNtGsK/edHEhUepA6VV0OW/1C0Lpqil1OGjfgr6duRWpLczSRxxxsMEBWXucj3471ial4day8qRbecJIPvW2Tg+hB/nUxd0VJJbF+0eZbwQX0qjzf9TKowrD+hHpW5ie1CiOUz4G3JOMUUU2kTds/9k=","w":361,"h":640,"alt_en":"Reel cover: a pink rose and chamomile bouquet on a car seat, with a handwritten card","alt_th":"ปกรีล ช่อกุหลาบชมพูแซมคาโมมายล์ วางบนเบาะรถ พร้อมการ์ดเขียนมือ","src":"img/reel_Dch0UGrTIbN_10k__640.webp"},"reel_3k":{"file":"reel_DcsGtHXTHIl_3k__640.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYAA4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwC9ZW/72B5PMQSBsbWK9vY1qCGJY1UZwoAFcskiyLEdznywRtDcnPXr+FS6fAk9gGvd0j7253kY56cGlGS6DnBrc528mkV4miYg8hsdxitWycfZtyyspzgkHr1oorKTsjeCuf/Z","w":361,"h":640,"alt_en":"Reel cover: a graduate and a friend by the river with a sunflower bouquet","alt_th":"ปกรีล บัณฑิตกับเพื่อนริมแม่น้ำ พร้อมช่อทานตะวัน","src":"img/reel_DcsGtHXTHIl_3k__640.webp"},"reel_safe":{"file":"reel_DckdCAFT44J_safe__640.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYAA4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDnbHRLaa7aK4eVVBx8pGR9a04/DOlSyyRxSXjmLG4grgEjOMkda6mZcW5MEcIwwyFVcDP1HWiaytWRGnRFcgbscc4oQWsc9/wm9oJNwtW69Sgzj8+vWqd14os7lRujuSQc4JGB+tFFJq407H//2Q==","w":361,"h":640,"alt_en":"Reel cover: a bouquet shaped like a white dog's face, made of baby's breath with white roses","alt_th":"ปกรีล ช่อดอกไม้รูปหน้าน้องหมาสีขาว ทำจากยิปโซ แซมกุหลาบขาว","src":"img/reel_DckdCAFT44J_safe__640.webp"},"reel_couple":{"file":"reel_DcNK6PDTe9G_couple__640.jpg","lqip":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAYAA4DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDJsbSJLp4CZBIVyu1RyO+QRwauHSYVwTHcdODu61Jo8ayafHcIweaVmDsDkqAfujP4VsRu8BCjAUqCTnofSs20mWqbaOV0y8awieKCNJUY7iJG2hTjg1YS/uL6ISMIkGcbQCQffNFFWkTzO1j/2Q==","w":361,"h":640,"alt_en":"Reel cover: a pink and white rose bouquet with pearl strands, in a car","alt_th":"ปกรีล ช่อกุหลาบชมพูและขาว ประดับสายมุก วางในรถ","src":"img/reel_DcNK6PDTe9G_couple__640.webp"},"hl_basket_vase":{"file":"hl01_basket_vase__150.jpg","w":150,"h":150,"alt_en":"Highlight cover: baskets and vases","alt_th":"ปกไฮไลต์ กระเช้าและแจกัน","src":"img/hl01_basket_vase__150.webp"},"hl_money":{"file":"hl02_money__150.jpg","w":150,"h":150,"alt_en":"Highlight cover: banknotes fanned behind a bouquet of peach roses","alt_th":"ปกไฮไลต์ ธนบัตรคลี่เป็นพัดหลังช่อกุหลาบสีพีช","src":"img/hl02_money__150.webp"},"hl_wedding":{"file":"hl03_wedding__150.jpg","w":150,"h":150,"alt_en":"Highlight cover: wedding bouquets","alt_th":"ปกไฮไลต์ ช่อดอกไม้งานแต่ง","src":"img/hl03_wedding__150.webp"},"hl_meaning":{"file":"hl04_meaning__150.jpg","w":150,"h":150,"alt_en":"Highlight cover: flower meanings","alt_th":"ปกไฮไลต์ ความหมายดอกไม้","src":"img/hl04_meaning__150.webp"},"hl_moneybouquet":{"file":"hl05_moneybouquet__150.jpg","w":150,"h":150,"alt_en":"Highlight cover: a large banknote bouquet with red roses","alt_th":"ปกไฮไลต์ ช่อธนบัตรช่อใหญ่กับกุหลาบแดง","src":"img/hl05_moneybouquet__150.webp"},"hl_pro_october":{"file":"hl06_pro_october__150.jpg","w":150,"h":150,"alt_en":"Highlight cover: October promotion","alt_th":"ปกไฮไลต์ โปรตุลาคม","src":"img/hl06_pro_october__150.webp"},"hl_pro_august":{"file":"hl09_pro_august__150.jpg","w":150,"h":150,"alt_en":"Highlight cover: August promotion","alt_th":"ปกไฮไลต์ โปรสิงหาคม","src":"img/hl09_pro_august__150.webp"},"hl_mothersday":{"file":"hl10_mothersday__150.jpg","w":150,"h":150,"alt_en":"Highlight cover: Mother's Day promotion","alt_th":"ปกไฮไลต์ โปรวันแม่","src":"img/hl10_mothersday__150.webp"}};

for(const image of Object.values(images))if(image.src&&!image.src.startsWith('/'))image.src='/'+image.src;
