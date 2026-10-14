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

