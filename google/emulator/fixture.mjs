/* A synthetic copy of the shop's Google Sheet for local tests: the real "Bookings" header (the 27
   labels the website's order script writes), invented bookings dated relative to today, then the
   Studio script's own set-up, keys for three people, and a few recorded payments. No real customer
   appears here. Run: node google/emulator/fixture.mjs [folder]   (default: .emulator) */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadScript} from './apps-script.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
export const SCRIPT=path.join(here,'..','studio.gs');
const LABELS=['เวลาที่รับคำจอง / Received','รหัสจอง / Ref','สถานะ / Status','วันที่ใช้ / Date needed','ช่วงเวลา / Time window','รับเอง–ส่ง / Pickup or delivery','รายการ / Items','โจทย์พิเศษ / Custom brief','งบประมาณ / Budget','ยอดรวม / Subtotal','ต้องยืนยันราคา / Quote needed','ชื่อผู้สั่ง / Customer','เบอร์ผู้สั่ง / Customer phone','ชื่อผู้รับ / Recipient','เบอร์ผู้รับ / Recipient phone','ที่อยู่จัดส่ง / Delivery address','เขต–อำเภอ / District','จังหวัด / Province','ข้อความการ์ด / Card message','ไม่ระบุชื่อผู้ส่ง / Anonymous','ภาษา / Language','หมายเหตุร้าน / Shop notes','รหัสภายใน / Booking id','LINE ผู้สั่ง / Customer LINE','ชำระเงิน / Payment','ที่มา / Source','บันทึกเมื่อ (ISO) / Written at (ISO)'];
export const todayBangkok=(at=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(at);
export const shift=(iso,n)=>new Date(Date.parse(iso+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);

export function makeFixture(dir){
  fs.mkdirSync(dir,{recursive:true});
  const today=todayBangkok(),bookFile=path.join(dir,'workbook.json');
  const ymd=d=>d.replaceAll('-','').slice(2);
  const row=(o)=>{const r=Array(LABELS.length).fill('');const set=(label,value)=>{r[LABELS.findIndex(l=>l.endsWith(' / '+label)||l===label)]=value;};
    set('Received',o.received||shift(today,-2)+' 10:15');set('Ref',o.ref);set('Status',o.status);set('Date needed',o.date);set('Time window',o.window||'10:00–12:00');
    set('Pickup or delivery',o.delivery?'ให้ร้านส่ง':'มารับเองที่ร้าน');set('Items',o.items||'');set('Custom brief',o.brief||'');set('Budget',o.budget||'');set('Subtotal',o.subtotal??'');set('Quote needed',o.quote||'');
    set('Customer',o.name);set('Customer phone',o.phone||'0800000000');set('Recipient',o.recipient||'');set('Recipient phone',o.recipientPhone||'');
    set('Delivery address',o.address||'');set('District',o.district||'');set('Province',o.province||'');set('Card message',o.card||'');set('Anonymous',o.anonymous?'ใช่':'');set('Language',o.lang||'th');
    set('Shop notes',o.notes||'');set('Booking id',o.id??('t'+o.ref.replace(/\W/g,'').toLowerCase()));set('Customer LINE',o.line||'');set('Payment',o.payment||'ยังไม่ชำระ');set('Source','web');
    set('Written at (ISO)',o.written||shift(today,-2)+'T03:15:00.000Z');return r;};
  const bookings=[
    {ref:`LH${ymd(shift(today,1))}-NEW1`,status:'รอยืนยัน',date:shift(today,1),items:'ช่อกุหลาบขาว Rose LayerFoam × 1 — 1,090',subtotal:1090,name:'ทดสอบ ลูกค้าหนึ่ง',card:'สุขสันต์วันเกิดนะ'},
    {ref:`LH${ymd(shift(today,3))}-CUS1`,status:'ยืนยันแล้ว',date:shift(today,3),delivery:true,brief:'ช่อกุหลาบแดงกับยูคาลิปตัส ห่อกระดาษครีม',budget:'1,500–2,500',quote:'ต้องยืนยันราคา',name:'Test Customer Two',lang:'en',recipient:'Test Recipient',recipientPhone:'0811111111',address:'1 Test Road',district:'เมืองนนทบุรี',province:'นนทบุรี',card:'With love',anonymous:true},
    {ref:`LH${ymd(today)}-MAK1`,status:'กำลังจัด',date:today,items:'กุหลาบเดี่ยว × 4 — 880',subtotal:880,name:'ทดสอบ ลูกค้าสาม'},
    {ref:`LH${ymd(today)}-RDY1`,status:'พร้อมรับ',date:today,window:'14:00–16:00',delivery:true,items:'Box Congratulations × 1 — 1,490',subtotal:1490,name:'ทดสอบ ลูกค้าสี่',address:'2 Test Road',province:'กรุงเทพมหานคร',recipient:'ผู้รับทดสอบ',recipientPhone:'0822222222'},
    {ref:`LH${ymd(shift(today,-1))}-LATE`,status:'ยืนยันแล้ว',date:shift(today,-1),items:'Lily & Lisianthus × 1 — 1,790',subtotal:1790,name:'ทดสอบ ลูกค้าห้า'},
    {ref:`LH${ymd(shift(today,-5))}-OLD1`,status:'ถึงมือแล้ว',date:shift(today,-5),items:'ช่อกุหลาบขาว Rose LayerFoam × 1 — 1,090',subtotal:1090,name:'ทดสอบ ลูกค้าหก',payment:'ชำระแล้ว'},
    {ref:`LH${ymd(shift(today,2))}-CXL1`,status:'ยกเลิก',date:shift(today,2),items:'กระเช้าดอกไม้ × 1',quote:'ต้องยืนยันราคา',name:'ทดสอบ ลูกค้าเจ็ด'},
    {ref:`LH${ymd(shift(today,2))}-ODD1`,status:'รอเช็คสต็อก',date:shift(today,2),items:'ช่อทานตะวัน × 1',name:'ทดสอบ ลูกค้าแปด'},
    {ref:`LH${ymd(today)}-OUT1`,status:'ออกจากบ้านแล้ว',date:today,window:'12:00–14:00',delivery:true,items:'Red roses, black wrap × 1 — 990',subtotal:990,name:'ทดสอบ ลูกค้าเก้า',address:'3 Test Road',province:'นนทบุรี'},
    {ref:`LH${ymd(shift(today,4))}-HAND`,status:'รอยืนยัน',date:shift(today,4),items:'(typed by hand in the Sheet)',name:'ลูกค้าโทรสั่ง',id:''},
    {ref:`LH${ymd(shift(today,6))}-FORM`,status:'รอยืนยัน',date:shift(today,6),items:'ช่อคาร์เนชั่น × 1',name:'Formula Tester',notes:'=HYPERLINK("http://example.invalid","click")'},
    {ref:`LH${ymd(shift(today,-3))}-LEDG`,status:'ยืนยันแล้ว',date:shift(today,-3),items:'Box Congratulations × 1 — 1,490',subtotal:1490,name:'ทดสอบ ลูกค้าบัญชี',payment:'ยังไม่ชำระ'},
  ];
  fs.writeFileSync(bookFile,JSON.stringify({id:'test-sheet',name:'Little House Flower — คำจอง / Reservations (TEST COPY)',props:{SHEET_ID:'test-sheet'},sheets:[{name:'Bookings',rows:[LABELS,...bookings.map(row)]},{name:'Log',rows:[['at','outcome']]}]},null,1));
  const app=loadScript(SCRIPT,bookFile);
  app.run('setupStudio');
  app.book.props.STUDIO_SINCE=shift(today,-30);app.book.save();
  const keys={owner:app.run('issueKey','Owner (test)','owner'),staff:app.run('issueKey','Florist (test)','staff'),viewer:app.run('issueKey','Viewer (test)','read-only')};
  fs.writeFileSync(path.join(dir,'keys.json'),JSON.stringify(keys,null,1));
  // the brief's money fixture: confirmed ฿1,490, deposit ฿500 on an earlier day, then ฿990 and a ฿200 refund
  const ledger=bookings.find(b=>b.ref.endsWith('LEDG'));const id='t'+ledger.ref.replace(/\W/g,'').toLowerCase();
  app.post({studio:1,key:keys.owner,action:'orders'});
  let order=app.post({studio:1,key:keys.owner,action:'order',id}).order;
  order=app.post({studio:1,key:keys.owner,action:'update',id,expectedRevision:order.revision,fields:{confirmedTotal:149000},reason:'Price agreed (fixture)',operationId:'fixture-quote'}).order;
  const pay=(type,amount,day,requestId,reason='')=>app.post({studio:1,key:keys.owner,action:'addPayment',id,payment:{type,amount,occurredAt:day+'T03:00:00.000Z',method:'bank_transfer',requestId,reason}});
  pay('receipt',50000,shift(today,-10),'fixture-deposit-0001');
  pay('receipt',99000,shift(today,-3),'fixture-balance-0001');
  pay('refund',20000,shift(today,-3),'fixture-refund-0001','One stem damaged (fixture)');
  return {bookFile,keys,today};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const dir=path.resolve(process.argv[2]||path.join(here,'..','..','.emulator'));
  const {bookFile}=makeFixture(dir);
  console.log('Test workbook: '+bookFile+' (keys in keys.json beside it; never real keys)');
}
