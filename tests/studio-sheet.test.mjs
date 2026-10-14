/* The Studio script (google/studio.gs) on a synthetic copy of the shop's Sheet, run by the local
   Apps Script stand-in. Run: node --test tests/studio-sheet.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadScript} from '../google/emulator/apps-script.mjs';
import {makeFixture,SCRIPT,shift} from '../google/emulator/fixture.mjs';

function fresh(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lhf-sheet-'));
  const {bookFile,keys,today}=makeFixture(dir);
  const app=loadScript(SCRIPT,bookFile);
  const call=(key,action,extra={})=>app.post({studio:1,key:keys[key]||key,action,...extra});
  const list=()=>call('owner','orders').orders;
  const byRef=end=>list().find(o=>o.ref.endsWith(end));
  const order=id=>call('owner','order',{id}).order;
  const sheet=name=>app.book.getSheetByName(name);
  const cell=(ref,label)=>{const sh=sheet('Bookings'),head=sh.data[0].map(String),col=head.findIndex(h=>h.endsWith(' / '+label)),row=sh.data.findIndex(r=>String(r[1])===ref);return sh.data[row][col];};
  const setCell=(ref,label,value)=>{const sh=sheet('Bookings'),head=sh.data[0].map(String),col=head.findIndex(h=>h.endsWith(' / '+label)),row=sh.data.findIndex(r=>String(r[1])===ref);sh.data[row][col]=value;app.book.save();};
  const activity=()=>sheet('_Activity').data.slice(1);
  return {dir,app,keys,today,call,list,byRef,order,sheet,cell,setCell,activity};
}
const noFormulas=t=>assert.equal(JSON.stringify(t.app.book.sheets).includes('"formula"'),false,'no cell may become a formula');

test('keys: a known key is a person with a role; an unknown one is refused and logged',()=>{
  const t=fresh();
  assert.deepEqual(['name','role'].map(k=>t.call('staff','whoami')[k]),['Florist (test)','staff']);
  const before=t.activity().length,r=t.call('x'.repeat(40),'whoami');
  assert.equal(r.ok,false);assert.equal(r.status,401);
  assert.equal(t.activity().length,before+1);assert.equal(t.activity().at(-1)[2],'refused');
  assert.equal(JSON.stringify(t.app.book.props).includes(t.keys.staff),false,'keys are stored only as fingerprints');
});

test('the Sheet\'s own words become the Studio\'s states; unknown words need review; hand-typed rows keep a stable id',()=>{
  const t=fresh(),o=Object.fromEntries(t.list().map(x=>[x.ref.slice(-4),x]));
  assert.deepEqual(['NEW1','CUS1','MAK1','RDY1','OUT1','OLD1','CXL1','ODD1'].map(k=>o[k].status),['new','confirmed','preparing','ready','out','done','cancelled','review']);
  assert.equal(o.CUS1.fulfil,'delivery');assert.equal(o.NEW1.fulfil,'pickup');assert.equal(o.CUS1.type,'custom');
  assert.equal(o.OLD1.historyIncomplete,true,'"paid" in the Sheet without a dated payment is marked incomplete');
  assert.match(o.HAND.id,/^ref:LH/);
  assert.equal(t.order(o.ODD1.id).statusText,'รอเช็คสต็อก','the original word is kept for review');
});

test('updates: revision checked, status written in the shop\'s word, rules enforced, every write logged',()=>{
  const t=fresh(),o=t.byRef('NEW1');
  const stale=t.call('staff','update',{id:o.id,expectedRevision:o.revision+5,fields:{notes:'x'},operationId:'op-stale'});
  assert.equal(stale.status,409);assert.equal(stale.current.id,o.id);
  const r=t.call('staff','update',{id:o.id,expectedRevision:o.revision,fields:{status:'confirmed'},operationId:'op-1'});
  assert.equal(r.ok,true);assert.equal(r.order.status,'confirmed');assert.equal(r.order.revision,o.revision+1);
  assert.equal(t.cell(o.ref,'Status'),'ยืนยันแล้ว');
  assert.equal(t.activity().at(-1)[1],'Florist (test)');assert.equal(t.activity().at(-1)[5],'status');
  // pickup orders never go "out"; a cancel needs a reason; only the owner corrects
  const ready=t.byRef('MAK1');
  assert.equal(t.call('staff','update',{id:ready.id,expectedRevision:ready.revision,fields:{status:'out'},operationId:'op-2'}).status,422);
  assert.equal(t.call('staff','update',{id:o.id,expectedRevision:r.order.revision,fields:{status:'cancelled'},operationId:'op-3'}).status,422);
  assert.equal(t.call('staff','update',{id:o.id,expectedRevision:r.order.revision,fields:{status:'ready'},reason:'skip',correction:true,operationId:'op-4'}).status,422);
  assert.equal(t.call('owner','update',{id:o.id,expectedRevision:r.order.revision,fields:{status:'ready'},reason:'Made yesterday',correction:true,operationId:'op-5'}).order.status,'ready');
  const done=t.byRef('OLD1');
  assert.equal(t.call('staff','update',{id:done.id,expectedRevision:done.revision,fields:{notes:'late note'},operationId:'op-6'}).status,422,'completed orders need an owner correction');
});

test('the same operation sent twice is applied once',()=>{
  const t=fresh(),o=t.byRef('LATE');
  const first=t.call('staff','update',{id:o.id,expectedRevision:o.revision,fields:{notes:'Call before delivery'},operationId:'op-twice'});
  const lines=t.activity().length;
  const again=t.call('staff','update',{id:o.id,expectedRevision:o.revision,fields:{notes:'Call before delivery'},operationId:'op-twice'});
  assert.equal(again.ok,true);assert.equal(again.order.revision,first.order.revision);assert.equal(t.activity().length,lines);
});

test('typed text never becomes a formula in the Sheet',()=>{
  const t=fresh(),o=t.byRef('FORM');
  const r=t.call('staff','update',{id:o.id,expectedRevision:o.revision,fields:{notes:'=IMPORTXML("http://example.invalid","//a")'},operationId:'op-f'});
  assert.equal(r.order.notes,'=IMPORTXML("http://example.invalid","//a")');
  noFormulas(t);
});

test('view-only keys cannot write; refunds are the owner\'s',()=>{
  const t=fresh(),o=t.byRef('LATE');
  assert.equal(t.call('viewer','update',{id:o.id,expectedRevision:o.revision,fields:{notes:'x'},operationId:'op-v'}).status,403);
  const ledger=t.byRef('LEDG');
  assert.equal(t.call('staff','addPayment',{id:ledger.id,payment:{type:'refund',amount:1000,occurredAt:new Date().toISOString(),requestId:'staff-refund-1',reason:'x'}}).status,403);
});

test('payments: append-only, idempotent, checked; the Sheet\'s payment cell follows the ledger',()=>{
  const t=fresh();let o=t.byRef('RDY1');
  assert.equal(t.call('staff','addPayment',{id:o.id,payment:{type:'receipt',amount:100000,occurredAt:new Date().toISOString(),requestId:'pay-before-price'}}).status,422,'no payment before a price');
  o=t.call('owner','update',{id:o.id,expectedRevision:o.revision,fields:{confirmedTotal:149000,deliveryFee:15000},reason:'Agreed on LINE',operationId:'op-q'}).order;
  assert.equal(t.call('staff','update',{id:o.id,expectedRevision:o.revision,fields:{confirmedTotal:100},operationId:'op-q2'}).status,422,'a price change needs a reason');
  const p={type:'receipt',amount:164000,occurredAt:new Date().toISOString(),requestId:'pay-full-0001'};
  assert.equal(t.call('staff','addPayment',{id:o.id,payment:p}).ok,true);
  assert.equal(t.call('staff','addPayment',{id:o.id,payment:p}).ok,true,'the same payment again is accepted once');
  assert.equal(t.sheet('Payments').data.filter(r=>r[0]==='pay-full-0001').length,1);
  assert.equal(t.call('staff','addPayment',{id:o.id,payment:{...p,amount:100}}).status,409,'one key, one payment');
  assert.equal(t.cell(o.ref,'Payment'),'ชำระแล้ว');
  assert.equal(t.call('owner','addPayment',{id:o.id,payment:{type:'refund',amount:5000,occurredAt:new Date().toISOString(),requestId:'refund-no-reason'}}).status,422,'a refund needs a reason');
  assert.equal(t.call('owner','update',{id:o.id,expectedRevision:t.order(o.id).revision,fields:{confirmedTotal:100000},reason:'mistake',operationId:'op-q3'}).status,422,'the price cannot fall below money received');
  const row=t.sheet('Payments').data.find(r=>r[0]==='pay-full-0001');
  assert.equal(row.some(v=>String(v).includes('ทดสอบ')),false,'the ledger holds no customer names');
});

test('a change typed straight into the Sheet is noticed, logged, and makes older edits conflict',()=>{
  const t=fresh(),o=t.byRef('LATE');
  t.setCell(o.ref,'Status','กำลังจัด');
  const after=t.byRef('LATE');
  assert.equal(after.status,'preparing');assert.equal(after.revision,o.revision+1);
  assert.ok(t.activity().some(r=>r[2]==='sheet edit'&&r[3]===o.id&&r[7]==='กำลังจัด'));
  assert.equal(t.call('staff','update',{id:o.id,expectedRevision:o.revision,fields:{notes:'x'},operationId:'op-late'}).status,409);
  const events=t.order(o.id).events;assert.equal(events[0].change.origin,'sheet-edit');assert.equal(events[0].change.new.status,'preparing');
});

test('rows are found by booking id, not row number (a row inserted above changes nothing else)',()=>{
  const t=fresh(),o=t.byRef('LATE'),neighbour=t.byRef('OLD1');
  const sh=t.sheet('Bookings'),at=sh.data.findIndex(r=>String(r[1])===o.ref);
  sh.insertRowBefore(at+1);t.app.book.save();
  const r=t.call('staff','update',{id:o.id,expectedRevision:o.revision,fields:{status:'preparing'},operationId:'op-row'});
  assert.equal(r.ok,true);assert.equal(t.cell(o.ref,'Status'),'กำลังจัด');assert.equal(t.cell(neighbour.ref,'Status'),'ถึงมือแล้ว');
});

test('earnings: the brief\'s money fixture, a deposit-only day, honest coverage',()=>{
  const t=fresh(),r=(from,to)=>t.call('owner','revenue',{from,to,group:'day'}).report;
  const all=r(shift(t.today,-12),t.today);
  assert.deepEqual([all.gross,all.refunds,all.net],[149000,20000,129000]);
  const deposit=r(shift(t.today,-10),shift(t.today,-10));assert.deepEqual([deposit.gross,deposit.net],[50000,50000]);
  const before=r(shift(t.today,-60),shift(t.today,-45));assert.equal(before.coverageStatus,'unknown');assert.equal(before.net,null,'no records is not zero');
  assert.equal(all.historyIncompleteOrders,1);
});

test('retention: Studio rows of deleted bookings go; old activity goes; payments stay',()=>{
  const t=fresh(),o=t.byRef('CXL1');
  const sh=t.sheet('Bookings');sh.data.splice(sh.data.findIndex(r=>String(r[1])===o.ref),1);
  t.sheet('_Activity').data.push([new Date(Date.now()-400*864e5).toISOString(),'old','update','x','','notes','','','','']);t.app.book.save();
  const payments=t.sheet('Payments').data.length;
  const result=t.app.run('purgeStudio');
  assert.equal(result.studioRows,1);assert.ok(result.activityLines>=1);
  assert.equal(t.sheet('_Studio').data.some(r=>r[0]===o.id),false);
  assert.equal(t.sheet('Payments').data.length,payments);
  noFormulas(t);
});
