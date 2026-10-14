/* ---- data/posts.js ---- */
/* =====================================================================
   INSTAGRAM DATASET — a hand-kept copy of the shop's public posts.
   Captions are verbatim (the shared ordering footer is stored once).
   No like, view or follower counts: they were snapshots that went stale
   the day they were copied. A promo post carries promoUntil; after that
   date it stays in the gallery but leaves the "promotions" filter.
   ===================================================================== */
LHF.posts = (function () {
  const FOOTER = '✅เปลี่ยนสีดอกไม้ สีกระดาษได้\n✅การ์ดข้อความฟรี ฝากข้อความได้\n\n🚖 ค่าจัดส่งคิดตามระยะทางLalamove\n💒 ร้านอยู่โซนนนทบุรี รัตนาธิเบศร์ (มารับเองได้)\n\nยินดีให้บริการ 08.00-20.00\nร้านเปิดทุกวัน สนใจออเดอร์ด่วนสอบถามได้เลยนะคะ\n\n💙สนใจสั่งสินค้า Line : @littlehouseflower\nหรือด่วนโทร. 0627495533\n🙏รบกวนสำรองคิวล่วงหน้า1-2วัน\n‼️ออเดอร์ด่วนภายใน3-4ชม สอบถามคิววันต่อวันน้า‼️';
  const TAGS_LOCAL = '#ร้านดอกไม้รัตนาธิเบศร์ #ร้านดอกไม้ราชพฤกษ์ #ร้านดอกไม้งามวงศ์วาน #ร้านดอกไม้เมืองทอง #ร้านดอกไม้นนทบุรี';
  const IG = 'https://www.instagram.com/littlehouseflower/';

  /* tags: bouquet | basket | box | meaning | promo | reel | graduation | love | mothers | sympathy | studio */
  const posts = [
    { id: 'DcyEtTyTQek', type: 'reel', date: '2026-09-02', url: IG + 'reel/DcyEtTyTQek/', images: ['reel_wreath'],
      caption: '#พวงหรีด #พวงหรีดดอกไม้สด #ร้านดอกไม้ราชพฤกษ์ #ร้านดอกไม้รัตนาธิเบศร์ #ร้านดอกไม้นนทบุรี', tags: ['reel', 'sympathy'], productId: 'wreath',
      label: { th: 'พวงหรีดดอกไม้สด', en: 'Fresh-flower wreath' } },
    { id: 'Dcxqw7NTB74', type: 'image', date: '2026-09-02', url: IG + 'p/Dcxqw7NTB74/', images: ['white_rose'],
      caption: 'กุหลาบขาว สื่อถึง ความซื่อสัตย์ ความเคารพ\nการให้เกียรติ และการเริ่มต้นใหม่ที่สง่างาม\n\n📍ราคาวันนี้ - 31 ธันวาคม 1090.- (W60xH60CM)\nมีโปรรีวิวรับส่วนลด5% สนใจสั่งได้เลยค่า\n\n' + FOOTER + '\n\n' + TAGS_LOCAL, tags: ['bouquet', 'meaning'], productId: 'white-rose',
      label: { th: 'กุหลาบขาว · ความหมาย', en: 'White rose · meaning' } },
    { id: 'DcxShKUTchd', type: 'image', date: '2026-09-01', url: IG + 'p/DcxShKUTchd/', images: ['red_crown'],
      caption: 'ความหมายของกุหลาบสีแดง❤️\n\n❤️ความรักที่มั่นคง : แสดงถึงความรักแท้ ความหลงใหล\nและความผูกพันที่จริงจัง\n\n❤️ความเคารพ : ในบางบริบทสื่อถึงความกล้าหาญ\nและความเคารพรักอย่างสูง\n\n✨️โอกาสที่เหมาะสมในการมอบให้\n\nวันวาเลนไทน์ / วันครบรอบ/การขอแต่งงาน\nขอเป็นแฟน / วันเกิดคนรัก\n\nการแสดงความยินดี : มอบให้ผู้ใหญ่หรือคนสำคัญ\nในโอกาสพิเศษเพื่อสื่อถึงความเคารพ\n\n📍ราคาวันนี้ - 31 ธันวาคม  2290.-\nมีโปรรีวิวรับส่วนลด5% สนใจสั่งได้เลยค่า\n\n' + FOOTER + '\n\n' + TAGS_LOCAL, tags: ['bouquet', 'meaning', 'love'], productId: 'red-crown',
      label: { th: 'ความหมายของกุหลาบแดง', en: 'The meaning of red roses' } },
    { id: 'DcxJbNNT79F', type: 'image', date: '2026-09-01', url: IG + 'p/DcxJbNNT79F/', images: ['lily_lisianthus'],
      caption: '📍ราคาวันนี้ - 31 ธันวาคม 1790.- (W70xH80CM)\nมีโปรรีวิวรับส่วนลด5% สนใจสั่งได้เลยค่า\n\n' + FOOTER + '\n\n' + TAGS_LOCAL, tags: ['bouquet', 'meaning'], productId: 'lily-lisianthus',
      label: { th: 'Lily & Lisianthus', en: 'Lily & Lisianthus' } },
    { id: 'Dcw9R3Wz9s5', type: 'image', date: '2026-09-01', url: IG + 'p/Dcw9R3Wz9s5/', images: ['single_rose'],
      caption: '❤️ช่อกุหลาบ 1 ดอก (สีขาว/แดง/ชมพู)\n1-3ช่อ ราคาช่อละ 250.-\n4-7ช่อ ราคาช่อละ 220.-\n8-11ช่อ ราคาช่อละ 200.-\n12ช่อขึ้นไป ช่อละ 180.-\n\n📍ราคาวันนี้ - 31 ธันวาคม 250.- (W30xH40CM)\nมีโปรรีวิวรับส่วนลด5% สนใจสั่งได้เลยค่า\n\n' + FOOTER + '\n\n' + TAGS_LOCAL, tags: ['bouquet', 'graduation'], productId: 'single-rose',
      label: { th: 'ช่อกุหลาบ 1 ดอก', en: 'Single rose' } },
    { id: 'Dcvqpe8zf3g', type: 'image', date: '2026-09-01', url: IG + 'p/Dcvqpe8zf3g/', images: ['kitty'],
      caption: 'ช่อคิตตี้ handmade💖\nตัวพื้นสีขาวทำมาจากดอกไม้สด\n"ดอกคาเนชัน"\n\nตัวโบว์กุหลาบ\nทำจาก "ดอกไม้สบู่ มีกลิ่นหอมอ่อนๆ"\n\nตัวอุปกรณ์ตกแต่งหน้าตา\nทำจากวัสดุประดิษฐ์\n\nเนื่องจากเป็นงานแฮนด์เมด\nหน้าตาและดอกไม้จะเป็นไปตามฤดูกาล\nแนะนำสั่งล่วงหน้า3-7วัน เพื่อเตรียมของ\nที่สมบรูณ์ที่สุดค่ะ🙏✨️\n\n📍ราคาวันนี้ - 31 ธันวาคม 2690.- (W70xH60CM)\nมีโปรรีวิวรับส่วนลด5% สนใจสั่งได้เลยค่า\n\n' + FOOTER + '\n\n' + TAGS_LOCAL, tags: ['bouquet', 'studio'], productId: 'kitty',
      label: { th: 'ช่อคิตตี้ handmade', en: 'Kitty bouquet' } },
    { id: 'DcvETrAzfAM', type: 'image', date: '2026-08-31', url: IG + 'p/DcvETrAzfAM/', images: ['red_black'],
      caption: 'ความหมายสีแดงดำ❤️🖤\n\n❤️กุหลาบแดง : สื่อถึง ความรักที่เร่าร้อน ความปรารถนา\nและการมอบหัวใจให้ทั้งหมด\n\n🖤กระดาษห่อสีดำ : เพิ่มความรู้สึกน่าค้นหา\nความลึกลับ ลักชูรี และแสดงถึงความรักที่มั่นคง\nลึกซึ้ง ไม่เสื่อมคลาย\n\n📍ราคาวันนี้ - 31 ธันวาคม 990.- (W55xH60CM)\nมีโปรรีวิวรับส่วนลด5% สนใจสั่งได้เลยค่า\n\n' + FOOTER + '\n\n' + TAGS_LOCAL, tags: ['bouquet', 'meaning', 'love'], productId: 'red-black',
      label: { th: 'ความหมายสีแดงดำ', en: 'Red and black, explained' } },
    { id: 'DcuoFqrT_ow', type: 'image', date: '2026-08-31', url: IG + 'p/DcuoFqrT_ow/', images: ['box_congrats'],
      caption: 'Box Congratulations💐✨️\n\nดอกลิลลี่ (Lily): สื่อถึงความสำเร็จที่สง่างาม\n ความเจริญรุ่งเรือง และการเริ่มต้นใหม่ที่สดใส\n\nดอกคาร์เนชั่น (Carnation): สื่อถึง\nความยินดีอย่างจริงใจ ความชื่นชมยินดี\nและความปรารถนาดี\n\nดอกสต็อก (Stock): สื่อถึงความสุขที่ยั่งยืน\nความอุดมสมบูรณ์ และชีวิตที่เต็มไปด้วยความงาม\n\nดอกเยอบีร่า (Gerbera) สื่อถึงความสุข ความจริงใจ\n และการประสบความสำเร็จ\n เหมาะอย่างยิ่งสำหรับการมอบเพื่ออวยพร\nให้เริ่มต้นใหม่ด้วยความรุ่งโรจน์\n\n📍ราคาวันนี้ - 31 ธันวาคม 1490.- (W40xH50CM)\nมีโปรรีวิวรับส่วนลด5% สนใจสั่งได้เลยค่า\n\n' + FOOTER, tags: ['box', 'meaning', 'graduation'], productId: 'box-congratulations',
      label: { th: 'Box Congratulations', en: 'Box Congratulations' } },
    { id: 'DcuWiZ_zFiV', type: 'reel', date: '2026-08-31', url: IG + 'reel/DcuWiZ_zFiV/', images: ['reel_distance'],
      caption: 'อย่าให้ระยะทางต้องมีผล\n\n#ดอกไม้เซอร์ไพส์แฟน #ร้านดอกไม้นนทบุรี #ช่อดอกไม้รับปริญญา #ร้านดอกไม้รัตนาธิเบศร์ #littlehouseflower', tags: ['reel', 'love'],
      label: { th: 'อย่าให้ระยะทางต้องมีผล', en: "Don't let distance decide" } },
    { id: 'DcqRhU5TT4h', type: 'reel', date: '2026-08-30', url: IG + 'reel/DcqRhU5TT4h/', images: ['reel_51k'],
      caption: '#ร้านดอกไม้นนทบุรี #ร้านดอกไม้รัตนาธิเบศร์ #ร้านดอกไม้เมืองทอง #ร้านดอกไม้ราชพฤกษ์ #ร้านดอกไม้', tags: ['reel', 'love'],
      label: { th: 'รีล', en: 'Reel' } },
    { id: 'DcsGtHXTHIl', type: 'reel', date: '2026-08-30', url: IG + 'reel/DcsGtHXTHIl/', images: ['reel_3k'],
      caption: 'สนับสนุนให้ทุกคนลองซื้อดอกไม้ให้แฟนดูนะคะ\n\n#ร้านดอกไม้รัตนาธิเบศร์ #ร้านดอกไม้นนทบุรี #ร้านดอกไม้ราชพฤกษ์ #ดอกไม้ #สตอรี่ความรู้สึก', tags: ['reel', 'love'],
      label: { th: 'ลองซื้อดอกไม้ให้แฟนดูนะคะ', en: 'Try buying your partner flowers' } },
    { id: 'DcnY8owzYaa', type: 'reel', date: '2026-08-29', url: IG + 'reel/DcnY8owzYaa/', images: ['reel_19k'],
      caption: 'ขอให้ทุกคนมีความรักไม่ซับซ้อนนะคะ\n\n#ความรัก #ดอกไม้ #ของขวัญวันเกิด #ร้านดอกไม้ #ร้านดอกไม้นนทบุรี', tags: ['reel', 'love'],
      label: { th: 'ขอให้ทุกคนมีความรักไม่ซับซ้อน', en: 'May your love be uncomplicated' } },
    { id: 'DckdCAFT44J', type: 'reel', date: '2026-08-27', url: IG + 'reel/DckdCAFT44J/', images: ['reel_safe'],
      caption: 'พื้นที่ปลอดภัย🫶🏻🩷\n\n#ดอกไม้ #ความรัก #ร้านดอกไม้นนทบุรี #ร้านดอกไม้รัตนาธิเบศร์ #ร้านดอกไม้ราชพฤกษ์', tags: ['reel', 'love'],
      label: { th: 'พื้นที่ปลอดภัย', en: 'A safe place' } },
    { id: 'Dch0UGrTIbN', type: 'reel', date: '2026-08-26', url: IG + 'reel/Dch0UGrTIbN/', images: ['reel_10k'],
      caption: 'โตๆกันแล้วว ชอบก็รัก ทักต้องบอกนะคะ😗🫶🏻\n\n#คำคม #ความรัก #ดอกไม้ #ร้านดอกไม้นนทบุรี #ร้านดอกไม้', tags: ['reel', 'love'],
      label: { th: 'ชอบก็รัก ทักต้องบอก', en: 'If you like them, say so' } },
    { id: 'DcdzhZETI9S', type: 'reel', date: '2026-08-25', url: IG + 'reel/DcdzhZETI9S/', images: ['reel_grad'],
      caption: '#ช่อดอกไม้ #ความรัก #ของขวัญให้แฟน #ดอกไม้รับปริญญา #ร้านดอกไม้นนทบุรี', tags: ['reel', 'graduation', 'love'],
      label: { th: 'ช่อรับปริญญา', en: 'Graduation bouquet' } },
    { id: 'DcNK6PDTe9G', type: 'reel', date: '2026-08-18', url: IG + 'reel/DcNK6PDTe9G/', images: ['reel_couple'],
      caption: '#แคปชั่น #ดอกไม้ #ร้านดอกไม้นนทบุรี #คู่รัก #littlehouseflower', tags: ['reel', 'love'],
      label: { th: 'คู่รัก', en: 'Couples' } },
    { id: 'DbdQxwyk9dj', type: 'carousel', date: '2026-07-31', url: IG + 'p/DbdQxwyk9dj/', images: ['mothers_garlands', 'mothers_blue'], promoUntil: '2026-08-09',
      caption: 'เปิดพรีออเดอร์วันแม่ 2569 💙✨️\nพวงมาลัย ช่อดอกไม้ กระเช้า ทุกแบบเป็นดอกไม้สด\n\nจองวันนี้ - 5สค. 69\n🫶🏻ลค.ใหม่ รับส่วนลดทันที 120 บาท (20ท่านแรก)\n🫶🏻ลค.เก่า รับส่วนลดทันที 12%\n\nจอง 6สค.- 9สค. 69\n🫶🏻ลค.ใหม่ รับส่วนลดทันที 10%\n🫶🏻ลค.เก่า รับส่วนลดทันที 5%\n\n' + FOOTER + '\n\n#พวงมาลัย #มาลัยวันแม่ #ดอกไม้วันแม่ #วันแม่ #มาลัย', tags: ['promo', 'mothers', 'basket'], productId: 'mothers-garland',
      label: { th: 'พรีออเดอร์วันแม่ 2569', en: "Mother's Day 2026 pre-order" } },
    { id: 'DaMqifIE86D', type: 'carousel', date: '2026-06-29', url: IG + 'p/DaMqifIE86D/', images: ['promo_bouquets', 'bouquet_890'], promoUntil: '2026-08-31',
      caption: '📍ราคาวันนี้ - 31 สิงหาคม 69\n\n✨️สั่งครบ1000บาทขึ้นไปลดทันที 50.-\nหรือ มีโปรรีวิว รับส่วนลด5% สนใจสั่งได้เลยค่า\n\n' + FOOTER + '\n\n' + TAGS_LOCAL, tags: ['promo', 'bouquet'], productId: 'bouquet-890',
      label: { th: 'ช่อดอกไม้ 50 × 50 ซม.', en: 'Bouquets, 50 × 50 cm' } },
    { id: 'DSbPkOPkxA3', type: 'reel', date: '2025-12-18', url: IG + 'reel/DSbPkOPkxA3/', images: ['reel_200roses'],
      caption: '#ช่อกุหลาบ200ดอก #ของขวัญวันครบรอบแต่งงาน\n#ของขวัญให้แฟน #ดอกไม้ช่อใหญ่ #ร้านดอกไม้รัตนาธิเบศร์', tags: ['reel', 'love', 'bouquet'], productId: 'roses-200',
      label: { th: 'ช่อกุหลาบ 200 ดอก', en: '200 roses' } },
    { id: 'DOsFPMCE7up', type: 'reel', date: '2025-09-16', url: IG + 'reel/DOsFPMCE7up/', images: ['reel_love'],
      caption: 'สนับสนุนให้ทุกคนแสดงออกความรักให้กันและกันค่ะ\n#ของขวัญให้แฟน #ของขวัญวันเกิด #สตอรี่ความรู้สึก #ร้านดอกไม้นนทบุรี #littlehouseflower', tags: ['reel', 'love'],
      label: { th: 'แสดงออกความรักให้กันและกัน', en: 'Show each other love' } },
    { id: 'DNiqvhJPWCX', type: 'carousel', date: '2025-08-19', url: IG + 'p/DNiqvhJPWCX/', images: ['basket_boxset', 'flowers_basket'],
      caption: 'ลูกค้าถามกันมาเยอะมาก\nว่าทางร้านมีแบบแจกัน/กระเช้าบ้างไหม?\n\nวันนี้ทางร้านรวมแบบคร่าวๆเบื้องต้นมาให้แล้วน้าาา\nยังมีแบบอีกเพียบให้ได้เลือกกัน\n\nอยากได้โจทย์แบบไหน ตั้งงบและรีเควสมาได้เลย\nทางร้านยินดีช่วยออกแบบให้\nหรือสามารถส่งเรฟมาให้ทางร้านจัดให้ได้เลยค่ะ\n\n📍มีโปรรีวิวรับส่วนลด5% สนใจสั่งได้เลยค่า\n\n' + FOOTER + '\n\n#littlehouseflower #ร้านดอกไม้สนามบินน้ำ\n#ร้านดอกไม้นนทบุรี #ร้านดอกไม้รัตนาธิเบศร์\n#รับปริญญา #ดอกไม้สด #ดอกไม้ช่อใหญ่\n#ของขวัญวาเลนไทน์ #วาเลนไทน์\n#ของขวัญให้แฟน #ของขวัญวันเกิด #ของขวัญวันครบรอบแต่งงาน #ของขวัญปีใหม่  #ช่อดอกไม้เกาหลี  #แจกันดอกไม้ #ร้านดอกไม้ปากเกร็ด #ร้านดอกไม้เมืองทอง #ร้านดอกไม้งามวงศ์วาน #ร้านดอกไม้ราชพฤกษ์ #ของขวัญให้แฟน #ดอกไม้แสดงความยินดี #กระเช้าดอกไม้ #กระเช้าเยี่ยมไข้ #กระเช้าดอกไม้สด #แจกันดอกไม้', tags: ['basket', 'box'], productId: 'basket-boxset',
      label: { th: 'แจกัน / กระเช้า', en: 'Vases & baskets' } },
  ];

  const highlights = [
    { id: 'baskets', image: 'hl_basket_vase', label: 'กระเช้า/แจกัน', url: IG },
    { id: 'money', image: 'hl_money', label: 'ช่อธนบัตร', url: IG },
    { id: 'wedding', image: 'hl_wedding', label: 'Wedding Bouquet', url: IG },
    { id: 'meaning', image: 'hl_meaning', label: 'Meaning', url: IG },
    { id: 'moneybouquet', image: 'hl_moneybouquet', label: 'Money Bouquet', url: IG },
    { id: 'october', image: 'hl_pro_october', label: 'pro✨october', url: IG },
    { id: 'august', image: 'hl_pro_august', label: 'Pro✨August', url: IG },
    { id: 'mothers', image: 'hl_mothersday', label: 'โปรวันแม่', url: IG },
  ];

  /* a promotion whose end date has passed (Bangkok calendar) is history, not an offer */
  const today = LHF.i18n.shopNow().iso;
  posts.forEach((p) => { if (p.promoUntil && p.promoUntil < today) p.tags = p.tags.filter((tag) => tag !== 'promo'); });
  /* The captions write "ราคาวันนี้ - 31 ธันวาคม" with no year. Once the price date in
     data/settings.js has passed, that line and the per-bouquet tiers would read as this
     year's prices beside a "price on request" product, so they leave the copy. */
  if (!LHF.data.pricesCurrent) posts.forEach((p) => { p.caption = p.caption.split('\n').filter((l) => !/^📍ราคาวันนี้ - 31 ธันวาคม|ช่อละ \d/.test(l)).join('\n'); });

  const FILTERS = [
    { id: 'all', th: 'ทั้งหมด', en: 'All' },
    { id: 'bouquet', th: 'ช่อดอกไม้', en: 'Bouquets' },
    { id: 'meaning', th: 'ความหมายดอกไม้', en: 'Meanings' },
    { id: 'reel', th: 'รีล', en: 'Reels' },
    { id: 'love', th: 'ให้แฟน', en: 'Love' },
    { id: 'graduation', th: 'รับปริญญา', en: 'Graduation' },
    { id: 'basket', th: 'กระเช้า/กล่อง', en: 'Baskets & boxes' },
    { id: 'promo', th: 'โปรโมชัน', en: 'Promotions' },
  ];

  const byId = (id) => posts.find((p) => p.id === id);
  const byTag = (tag) => (tag && tag !== 'all' ? posts.filter((p) => p.tags.includes(tag) || (tag === 'basket' && p.tags.includes('box'))) : posts.slice());
  const filters = FILTERS.filter((f) => f.id === 'all' || byTag(f.id).length);   // no chip that opens an empty gallery
  const forProduct = (productId) => posts.filter((p) => p.productId === productId);
  return { posts, highlights, filters, byId, byTag, forProduct, FOOTER };
})();

