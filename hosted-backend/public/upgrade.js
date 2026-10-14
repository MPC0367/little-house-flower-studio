/* Enhancements to the existing live-site composition. */
(function(){
const {h}=LHF.util;const tr=(th,en)=>LHF.i18n.lang==='th'?th:en;
Object.assign(LHF.data.strings,{
 'book.who.privacy':{ th: "ข้อมูลที่กรอกใช้บันทึกคำจองและรายละเอียดออเดอร์ กรุณาติดต่อทางร้านเพื่อยืนยันวันรับหรือจัดส่งและราคาสุดท้ายค่ะ", en: "The details you enter are used to save your reservation and order details. Please contact the shop to confirm the handover date and final price." },
 'done.title':{ th: "บันทึกคำจองแล้ว", en: "Reservation saved" },
 'done.sub':{ th: "บันทึกรายละเอียดคำจองแล้ว กรุณาติดต่อทางร้านเพื่อยืนยันคิว ราคา และการรับหรือจัดส่งค่ะ", en: "Your reservation details are saved. Please contact the shop to confirm availability, the final price and delivery or collection." },
 'done.elsewhere.title':{ th: "เปิดคำจองนี้ในเบราว์เซอร์นี้ไม่ได้", en: "This reservation is not available in this browser" },
 'done.elsewhere.sub':{ th: "กรุณาเปิดจากเบราว์เซอร์ที่ใช้สร้างคำจอง หรือกลับไปสร้างคำจองใหม่ค่ะ", en: "Open it in the browser session that created it, or return to create a new reservation." },
 'done.next.title':{ th: "ขั้นตอนถัดไป", en: "Next steps" },
 'done.photo':{ th: "บันทึกรูปอ้างอิงไว้กับคำจองแล้ว", en: "Your reference image is saved with the reservation." },
 'done.photo.line':{ th: "แนบรูปอ้างอิงไว้กับคำจองแล้ว", en: "Reference image included in the reservation" },
 'privacy.what.photo':{ th: "รูปอ้างอิงจะอัปโหลดเมื่อคุณยินยอม และเปิดดูได้จากรายละเอียดออเดอร์ในระบบจัดการร้าน รูปจะไม่ถูกส่งให้ผู้ให้บริการ AI", en: "Reference photos are uploaded with your acknowledgment and can be viewed in the Studio order details. They are not sent to an AI provider." },
 'privacy.where.p':{ th: "คำจองและรูปอ้างอิงเก็บไว้ในระบบออนไลน์ ยังไม่ได้เชื่อมต่อ Google Sheets การแจ้งเตือนอัตโนมัติ หรือบริการจัดส่ง", en: "Reservations and reference images are stored online. Google Sheets, automatic notifications and courier services are not connected." },
 'privacy.keep.p':{ th: "ฉบับร่างและใบสรุปแบบย่อเก็บในเบราว์เซอร์ ส่วนคำจองและรูปอ้างอิงเก็บในระบบออนไลน์ หากต้องการสอบถามเรื่องข้อมูล กรุณาติดต่อทางร้านค่ะ", en: "Drafts and minimal receipts are stored in your browser. Reservations and reference images are stored online. Please contact the shop with questions about your information." }
});
const originalHome=LHF.pages.home;
LHF.pages.home=function(){const page=originalHome();const media=page.querySelector('.hero-media'),layer=media.querySelector('.hero-scale'),caption=media.querySelector('.hero-caption');
 const slides=LHF.heroSlides.map(s=>[s.key,s.product,s.desktop,s.mobile]);let idx=0,playing=!LHF.util.reducedMotion(),hover=false,focused=false,busy=false,closed=false;
 const controls=h('div.hero-controls',{'aria-label':tr('ภาพดอกไม้','Flower photographs')});const pos=h('span.hero-position','01 / 04');const prev=h('button',{type:'button','aria-label':tr('ภาพก่อนหน้า','Previous photograph'),onClick:()=>{playing=false;paint();change(-1);}},'←'),next=h('button',{type:'button','aria-label':tr('ภาพถัดไป','Next photograph'),onClick:()=>{playing=false;paint();change(1);}},'→'),pause=h('button',{type:'button',onClick:()=>{playing=!playing;paint();}},'');controls.append(prev,pos,next,pause);media.append(controls);
 function paint(){pause.textContent=playing?tr('หยุด','Pause'):tr('เล่น','Play');pause.setAttribute('aria-label',playing?tr('หยุดภาพอัตโนมัติ','Pause slideshow'):tr('เล่นภาพอัตโนมัติ','Play slideshow'));pause.setAttribute('aria-pressed',String(!playing));}
 function describe(){const [key,pid]=slides[idx];const p=LHF.catalog.byId(pid)||LHF.catalog.products.find(p=>p.image===key);caption.textContent=p?LHF.i18n.pick(p.name)+' · '+LHF.ui.priceLabel(p):LHF.img.alt(key);pos.textContent=String(idx+1).padStart(2,'0')+' / 04';}
 async function change(dir){if(busy||closed)return;busy=true;try{for(let attempt=0;attempt<4;attempt++){const n=(idx+dir*(attempt+1)+4)%4;const im=new Image();im.src=LHF.img.src(slides[n][0]);try{await im.decode();if(closed)return;const pic=LHF.img.pic(slides[n][0],{eager:true});position(pic,n);const previous=layer.firstElementChild;layer.append(pic);pic.classList.add('hero-frame-enter');idx=n;describe();setTimeout(()=>previous?.remove(),800);break;}catch{}}}finally{busy=false;}}
 function position(pic,n){pic.style.setProperty('--hero-desktop-pos',slides[n][2]);pic.style.setProperty('--hero-mobile-pos',slides[n][3]);} position(layer.firstElementChild,0);
 const prefetched=new Map();function preload(n){if(prefetched.has(n))return prefetched.get(n);const im=new Image(),m=LHF.img.meta(slides[n][0]);im.decoding='async';im.fetchPriority='low';im.sizes=Math.ceil(media.getBoundingClientRect().width||innerWidth)+'px';if(m.srcset)im.srcset=m.srcset;im.src=m.src;const task=im.decode().catch(()=>null);prefetched.set(n,task);return task;}
 const first=layer.querySelector('img.hi');const stageNext=()=>{if(closed)return;preload(1).then(()=>{if(closed)return;setTimeout(()=>{if(!closed){preload(2);preload(3);}},1500);});};if(first?.complete&&first.naturalWidth)setTimeout(stageNext,1000);else first?.addEventListener('load',()=>setTimeout(stageNext,1000),{once:true});
 const timer=setInterval(()=>{if(playing&&!hover&&!focused&&!document.hidden&&!LHF.logoIntro?.state)change(1);},6000);media.addEventListener('mouseenter',()=>hover=true);media.addEventListener('mouseleave',()=>hover=false);controls.addEventListener('focusin',()=>focused=true);controls.addEventListener('focusout',()=>focused=false);LHF.router.onLeave(()=>{closed=true;clearInterval(timer);});paint();describe();return page;};
LHF.router.after(()=>{document.querySelectorAll('.nav-main a').forEach(a=>{if(a.classList.contains('is-active'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});});
})();
LHF.designRows=function(c){
 if(!c?.config)return [];const th=LHF.i18n.lang==='th',t=(a,b)=>th?a:b,I=LHF.i18n;
 const rows=LHF.designConfig.configSummary(c.config,I.lang,LHF.catalog.flowers);
 const tier=LHF.data.bookingDefaults.budgetTiers.find(x=>x.id===c.budgetTier);
 const budget=Number(c.budgetCustom)>0?I.fmtPrice(Number(c.budgetCustom)):tier?I.fmtPrice(tier.min)+(tier.max?'–'+I.fmtPrice(tier.max):'+'):t('ยังไม่ระบุ','Not chosen');
 rows.push([t('งบที่แจ้ง','Requested budget'),budget]);
 if(c.occasion)rows.push([t('โอกาส','Occasion'),I.pick(LHF.catalog.occasion(c.occasion)||{})||c.occasion]);
 if(c.feel)rows.push([t('ความรู้สึกที่ต้องการ','Desired feeling'),c.feel]);
 if(c.notes)rows.push([t('หมายเหตุ','Florist notes'),c.notes]);
 if(c.config.style==='money')rows.push([t('มูลค่าธนบัตร (แยกต่างหาก)','Banknote face value (separate)'),Number(c.banknoteValue)>0?I.fmtPrice(Number(c.banknoteValue)):t('ให้ร้านยืนยัน','Confirm with florist')]);
 const estimate=c.estimate,current=estimate?.kind==='published'&&(!estimate.expires||LHF.time.today()<=estimate.expires);
 rows.push([t('สถานะราคา','Price status'),current&&estimate.low!=null?I.fmtPrice(estimate.low/100)+(estimate.high!==estimate.low?'–'+I.fmtPrice(estimate.high/100):'')+' · '+t('ราคาประกาศ ณ วันที่บันทึก','Published price at save time'):t('รอยืนยันราคา — งบไม่ใช่ราคาเสนอ','Price confirmation needed — budget is not a quote')]);
 rows.push([t('รูปแบบภาพ','Image role'),c.previewAssetId&&c.preview?.asset?(c.preview.asset.kind==='actual'?t('ภาพสินค้าจริงจากร้าน','Actual shop product'):c.preview.asset.kind==='composition'?t('ภาพจัดองค์ประกอบ — ให้ร้านยืนยันแบบจริง','Live composition — final design needs florist confirmation'):t('ภาพแนวคิด AI — ให้ร้านยืนยันแบบจริง','AI concept — final design needs florist confirmation')):t('ไม่มีภาพตรงแบบ — ขอคำแนะนำจากร้าน','No matching preview — consultation requested')]);
 return rows;
};
LHF.designSnapshot=function(c){
 if(!c?.config)return null;const h=LHF.util.h,th=LHF.i18n.lang==='th';
 const box=h('section.book-snapshot',h('h3.h4',th?'แบบที่บันทึกไว้':'Saved design'));
 if(c.previewAssetId&&c.preview?.asset)box.append(h('img',{src:c.preview.asset.url,alt:th?(c.preview.asset.kind==='actual'?'ภาพสินค้าจริงจากร้าน':c.preview.asset.kind==='composition'?'ภาพจัดองค์ประกอบตามตัวเลือก':'ภาพแนวคิดจาก AI'):c.preview.asset.label,width:120,height:120}));
 box.append(h('dl.custom-review',LHF.designRows(c).map(([k,v])=>h('div',h('dt',k),h('dd',v||'—')))),h('p.tiny',th?'ค่าจัดส่งคิดแยกตามระยะทาง ร้านยืนยันดอกไม้และราคาสุดท้ายทาง LINE':'Delivery is separate by distance. The shop confirms final flowers and price on LINE.'));
 // An acknowledged receipt is immutable. Editing creates the next draft.
 box.append(h('a.tlink',{href:LHF.router.href('/custom')},th?'ออกแบบใหม่หรือแก้ไขฉบับร่าง':'Open design draft'));
 return box;
};
const originalSummary=LHF.sink.summary;
LHF.sink.summary=function(b){const text=originalSummary(b);return b.custom?.config?text+'\n\n'+LHF.designRows(b.custom).map(([k,v])=>k+': '+v).join('\n'):text;};
