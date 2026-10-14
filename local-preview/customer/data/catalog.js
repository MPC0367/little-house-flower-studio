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

