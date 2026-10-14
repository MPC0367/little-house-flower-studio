import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
export class Journal {
 constructor(dir){fs.mkdirSync(dir,{recursive:true});this.db=new DatabaseSync(path.join(dir,'journal.sqlite'));this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents (collection TEXT, id TEXT, value TEXT, PRIMARY KEY(collection,id));');}
 all(c){return this.db.prepare('SELECT value FROM documents WHERE collection=?').all(c).map(r=>JSON.parse(r.value));}
 get(c,id){const r=this.db.prepare('SELECT value FROM documents WHERE collection=? AND id=?').get(c,id);return r?JSON.parse(r.value):null;}
 put(c,id,v){this.db.prepare('INSERT INTO documents VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET value=excluded.value').run(c,id,JSON.stringify(v));return v;}
 remove(c,id){this.db.prepare('DELETE FROM documents WHERE collection=? AND id=?').run(c,id);}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 event(id,actor,change,reason=''){const event={id:crypto.randomUUID(),orderId:id,actor,change,reason,at:new Date().toISOString()};this.put('events',event.id,event);return event;}
}
