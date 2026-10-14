import {seedHosted} from './hosted-seed.mjs';
import {passwordRecord,authError} from './hosted-crypto.mjs';

const INITIALIZING=new WeakMap();
const clone=value=>value===undefined?undefined:structuredClone(value);
export class HostedJournal {
  constructor(binding,version,payload){this.binding=binding;this.version=version;this.payload=payload;this.dirty=false;}
  all(collection){return Object.values(this.payload.collections[collection]||{}).map(clone);}
  get(collection,id){const rows=this.payload.collections[collection];return rows&&Object.hasOwn(rows,id)?clone(rows[id]):null;}
  put(collection,id,value){
    if(!Object.hasOwn(this.payload.collections,collection))Object.defineProperty(this.payload.collections,collection,{value:{},enumerable:true,writable:true,configurable:true});
    Object.defineProperty(this.payload.collections[collection],id,{value:clone(value),enumerable:true,writable:true,configurable:true});this.dirty=true;return value;
  }
  remove(collection,id){const rows=this.payload.collections[collection];if(rows&&Object.hasOwn(rows,id)){delete rows[id];this.dirty=true;}}
  transaction(fn){const before=clone(this.payload),dirty=this.dirty;try{return fn();}catch(error){this.payload=before;this.dirty=dirty;throw error;}}
  event(orderId,actor,change,reason=''){const event={id:crypto.randomUUID(),orderId,actor,change,reason,at:new Date().toISOString()};this.put('events',event.id,event);return event;}
  async commit(){
    if(!this.dirty)return;
    const payload=JSON.stringify(this.payload);
    if(new TextEncoder().encode(payload).length>1800000)throw authError('The demo has reached its storage limit. Please contact the demo administrator.',429);
    const result=await this.binding.prepare('UPDATE demo_state SET version = version + 1, payload = ? WHERE id = ? AND version = ?').bind(payload,'app',this.version).run();
    if(result.meta?.changes!==1)throw authError('Another update was saved first. Please refresh and try again. Your entries have not been saved.',409);
    this.version++;this.dirty=false;
  }
}

async function bootstrap(env){
  if(typeof env.DEMO_PASSWORD!=='string')throw authError('The demo password has not been configured.',503);
  const record=await passwordRecord(env.DEMO_PASSWORD),db=new HostedJournal(env.DB,0,{collections:{}});
  seedHosted(db);db.put('meta','staff-password',record);
  await env.DB.prepare('INSERT OR IGNORE INTO demo_state (id, version, payload) VALUES (?, ?, ?)').bind('app',1,JSON.stringify(db.payload)).run();
}
export async function loadHostedJournal(env){
  if(!env?.DB?.prepare)throw authError('Demo storage is unavailable.',503);
  let row=await env.DB.prepare('SELECT version, payload FROM demo_state WHERE id = ?').bind('app').first();
  if(!row){
    if(!INITIALIZING.has(env.DB))INITIALIZING.set(env.DB,bootstrap(env).finally(()=>INITIALIZING.delete(env.DB)));
    await INITIALIZING.get(env.DB);
    row=await env.DB.prepare('SELECT version, payload FROM demo_state WHERE id = ?').bind('app').first();
  }
  if(!row)throw authError('Demo storage is unavailable.',503);
  const payload=JSON.parse(row.payload);
  if(payload?.collections?.meta?.['hosted-demo']?.synthetic!==true)throw authError('This database is not marked for demonstration use.',503);
  return new HostedJournal(env.DB,row.version,payload);
}
