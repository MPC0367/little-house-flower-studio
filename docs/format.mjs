/* Numbers and dates for the Studio. The shop works on Bangkok time and in baht.
   Money from the back end comes in two units: order amounts and payments are integer satang
   (confirmedTotal, deliveryFee, payments, revenue); catalogue line items are whole baht
   (items[].unit and items[].line). Each formatter says which one it takes. */
import {lang} from './text.mjs?v=studio-20261015-1';

const TZ='Asia/Bangkok';
const locale=()=>lang()==='th'?'th-TH-u-ca-gregory':'en-GB';

const moneyFormat=new Map();
function money(value,fractions){
  const key=locale()+fractions;
  if(!moneyFormat.has(key))moneyFormat.set(key,new Intl.NumberFormat(locale(),{style:'currency',currency:'THB',currencyDisplay:'narrowSymbol',minimumFractionDigits:fractions,maximumFractionDigits:fractions}));
  return moneyFormat.get(key).format(value);
}
/** satang (integer) → "฿1,490" (two decimals only when there are satang) */
export function satang(value){
  if(value==null||!Number.isFinite(Number(value)))return null;
  const baht=Number(value)/100;
  return money(baht,Number.isInteger(baht)?0:2);
}
/** whole baht → "฿1,490" */
export function baht(value){
  if(value==null||!Number.isFinite(Number(value)))return null;
  return money(Number(value),Number.isInteger(Number(value))?0:2);
}
/** "1,490.50" typed by a person → satang, or null when it is not a valid non-negative amount */
export function parseBaht(text){
  const clean=String(text??'').replace(/[฿,\s]/g,'');
  if(!/^\d+(\.\d{1,2})?$/.test(clean))return null;
  return Math.round(Number(clean)*100);
}
export const number=value=>new Intl.NumberFormat(locale()).format(value);

/** Today's date in Bangkok, YYYY-MM-DD */
export function today(at=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
/** a YYYY-MM-DD shifted by n days */
export function addDays(iso,n){
  const d=new Date(Date.parse(iso+'T00:00:00Z')+n*86400000);
  return d.toISOString().slice(0,10);
}
/** Monday of the week containing iso */
export function weekStart(iso){
  const day=new Date(Date.parse(iso+'T00:00:00Z')).getUTCDay();
  return addDays(iso,-((day+6)%7));
}
export function monthStart(iso){return iso.slice(0,7)+'-01';}
export function monthEnd(iso){
  const [y,m]=iso.split('-').map(Number);
  return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
}
const dayFormats=new Map();
function dateFormat(options){
  const key=locale()+JSON.stringify(options);
  if(!dayFormats.has(key))dayFormats.set(key,new Intl.DateTimeFormat(locale(),{timeZone:'UTC',...options}));
  return dayFormats.get(key);
}
/** a calendar date (YYYY-MM-DD) for people: "Thu 15 Oct" or with the year */
export function day(iso,{year=false,weekday=true,month='short'}={}){
  if(!iso||!/^\d{4}-\d{2}-\d{2}$/.test(iso))return null;
  return dateFormat({...(weekday?{weekday:'short'}:{}),day:'numeric',month,...(year?{year:'numeric'}:{})}).format(new Date(iso+'T00:00:00Z'));
}
export function longDay(iso){return dateFormat({weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(iso+'T00:00:00Z'));}
export function monthName(iso,{year=true}={}){return dateFormat({month:'long',...(year?{year:'numeric'}:{})}).format(new Date(iso.slice(0,7)+'-01T00:00:00Z'));}
export function shortMonth(iso){return dateFormat({month:'short'}).format(new Date(iso.slice(0,7)+'-01T00:00:00Z'));}
export function weekdayShort(iso){return dateFormat({weekday:'short'}).format(new Date(iso+'T00:00:00Z'));}
export function dayNumber(iso){return Number(iso.slice(8,10));}
/** a moment (ISO timestamp) in Bangkok: "15 Oct, 10:42" */
export function moment(value,{date=true}={}){
  const at=new Date(value);if(!Number.isFinite(+at))return null;
  return new Intl.DateTimeFormat(locale(),{timeZone:TZ,...(date?{day:'numeric',month:'short'}:{}),hour:'2-digit',minute:'2-digit'}).format(at);
}
export function time(value){return moment(value,{date:false});}
/** a datetime-local value in Bangkok for an input, and back to an ISO instant */
export function localInput(at=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function fromLocalInput(value){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value||''))return null;
  return new Date(value+':00+07:00').toISOString();
}
