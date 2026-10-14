/* A stand-in for the parts of Google Apps Script that google/studio.gs uses, so the real script can
   run on this computer against a workbook kept in a JSON file: Sheets (values only), the script
   lock, script properties, the cache, digests, dates, web-app output. It is not Google: it proves the
   script's logic and the Studio's contract, not Google's quotas, permissions or timing. */
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const pad=n=>String(n).padStart(2,'0');
function bangkokParts(date){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));
  return p;
}

class Range{
  constructor(sheet,row,col,rows,cols){Object.assign(this,{sheet,row,col,rows,cols});}
  getValues(){const out=[];for(let r=0;r<this.rows;r++){const src=this.sheet.data[this.row-1+r]||[];const line=[];for(let c=0;c<this.cols;c++){const v=src[this.col-1+c];line.push(v===undefined||v===null?'':v);}out.push(line);}return out;}
  getValue(){return this.getValues()[0][0];}
  setValues(values){
    if(values.length!==this.rows||values.some(r=>r.length!==this.cols))throw new Error('The data has '+values.length+' rows but the range has '+this.rows);
    values.forEach((line,r)=>{const i=this.row-1+r;this.sheet.data[i]??=[];line.forEach((v,c)=>{this.sheet.data[i][this.col-1+c]=store(v);});});
    this.sheet.book.dirty();return this;
  }
  setValue(v){return this.setValues([[v]]);}
  clearContent(){const blank=Array.from({length:this.rows},()=>Array(this.cols).fill(''));return this.setValues(blank);}
  setFontWeight(){return this;}
  setNumberFormat(){return this;}
}
/* What Google Sheets does with a written value: a string starting with "=" becomes a formula
   (recorded here so a test can catch it); a leading apostrophe makes the rest plain text. */
function store(v){
  if(typeof v==='string'&&v.startsWith('='))return {formula:v};
  if(typeof v==='string'&&v.startsWith("'"))return v.slice(1);
  return v;
}
class Sheet{
  constructor(book,raw){this.book=book;this.name=raw.name;this.data=raw.rows||[];this.hidden=!!raw.hidden;}
  getName(){return this.name;}
  getLastRow(){for(let i=this.data.length-1;i>=0;i--)if((this.data[i]||[]).some(v=>v!==''&&v!=null))return i+1;return 0;}
  getLastColumn(){let w=0;for(const r of this.data)for(let c=(r||[]).length-1;c>=0;c--)if(r[c]!==''&&r[c]!=null){w=Math.max(w,c+1);break;}return w;}
  getRange(row,col,rows=1,cols=1){if(row<1||col<1||rows<1||cols<1)throw new Error('Range out of bounds');return new Range(this,row,col,rows,cols);}
  appendRow(values){const at=this.getLastRow()+1;return this.getRange(at,1,1,values.length).setValues([values]);}
  setFrozenRows(){return this;}
  hideSheet(){this.hidden=true;this.book.dirty();return this;}
  /** for tests: insert an empty row above `row`, as a person might in the Sheet */
  insertRowBefore(row){this.data.splice(row-1,0,[]);this.book.dirty();return this;}
  toJSON(){return {name:this.name,hidden:this.hidden,rows:this.data};}
}
class Book{
  constructor(file){this.file=file;const raw=JSON.parse(fs.readFileSync(file,'utf8'));this.id=raw.id;this.name=raw.name;this.props=raw.props||{};this.sheets=raw.sheets.map(s=>new Sheet(this,s));}
  dirty(){this.changed=true;}
  save(){fs.writeFileSync(this.file,JSON.stringify({id:this.id,name:this.name,props:this.props,sheets:this.sheets},null,1));this.changed=false;}
  getName(){return this.name;}
  getId(){return this.id;}
  getSheets(){return this.sheets;}
  getSheetByName(name){return this.sheets.find(s=>s.name===name)||null;}
  insertSheet(name){const s=new Sheet(this,{name,rows:[]});this.sheets.push(s);this.dirty();return s;}
}

/** Load studio.gs into a sandbox with these services; returns the script's functions and the book. */
export function loadScript(scriptFile,bookFile,{now}={}){
  const book=new Book(bookFile);
  const logs=[];
  const cache=new Map();
  const triggers=[];
  const RealDate=Date;
  const FakeDate=now?class extends RealDate{constructor(...a){super(...(a.length?a:[now()]));}static now(){return now();}}:RealDate;
  const services={
    SpreadsheetApp:{openById:id=>{if(id!==book.id)throw new Error('No spreadsheet with that id');return book;},getActiveSpreadsheet:()=>null},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>book.props[k]??null,setProperty:(k,v)=>{book.props[k]=String(v);book.dirty();},deleteProperty:k=>{delete book.props[k];book.dirty();},getProperties:()=>({...book.props})})},
    LockService:{getScriptLock:()=>({waitLock(){},tryLock(){return true;},releaseLock(){}})},
    CacheService:{getScriptCache:()=>({get:k=>{const e=cache.get(k);return e&&e.until>FakeDate.now()?e.value:null;},put:(k,v,ttl=600)=>{cache.set(k,{value:String(v),until:FakeDate.now()+ttl*1000});},remove:k=>cache.delete(k)})},
    Utilities:{
      DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
      computeDigest:(alg,text)=>[...crypto.createHash(alg).update(String(text),'utf8').digest()].map(b=>b>127?b-256:b),
      getUuid:()=>crypto.randomUUID(),
      formatDate:(date,tz,pattern)=>{
        if(tz!=='Asia/Bangkok')throw new Error('The emulator formats Bangkok time only');
        const p=bangkokParts(date);
        return pattern.replace('yyyy',p.year).replace('MM',p.month).replace('dd',p.day).replace('HH',p.hour).replace('mm',p.minute).replace('ss',p.second);
      },
    },
    ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({getContent:()=>text,setMimeType(){return this;}})},
    Logger:{log:m=>logs.push(String(m))},
    ScriptApp:{getProjectTriggers:()=>triggers,deleteTrigger:t=>triggers.splice(triggers.indexOf(t),1),newTrigger:fn=>{const t={getHandlerFunction:()=>fn};const chain={timeBased:()=>chain,onMonthDay:()=>chain,atHour:()=>chain,inTimezone:()=>chain,create:()=>{triggers.push(t);return t;}};return chain;}},
    Date:FakeDate,
  };
  const context=vm.createContext({...services,console,JSON,Math,Number,String,Object,Array,Error,isFinite,encodeURIComponent});
  vm.runInContext(fs.readFileSync(scriptFile,'utf8'),context,{filename:'studio.gs'});
  return {
    book,logs,context,
    /** one web-app request, as Google would deliver it; the workbook is saved afterwards */
    post(body){const output=context.doPost({postData:{contents:typeof body==='string'?body:JSON.stringify(body),type:'text/plain'}});const text=output.getContent();if(book.changed)book.save();return JSON.parse(text);},
    run(name,...args){const value=context[name](...args);if(book.changed)book.save();return value;},
  };
}
export {pad};
