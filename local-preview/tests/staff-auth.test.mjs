import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Journal} from '../server/store.mjs';
import {StaffAuth, AuthAttemptLimiter} from '../server/staff-auth.mjs';

const firstPassword = 'Local demo password 123';
const nextPassword = 'Changed demo password 456';
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lhf-auth-'));
  const db = new Journal(dir), auth = new StaffAuth({db});
  t.after(() => { db.db.close(); fs.rmSync(dir, {recursive: true, force: true}); });
  return {db, auth, dir};
}

test('password setup stores only a salted hash, revokes staff sessions and preserves customer sessions', async t => {
  const {db, auth} = fixture(t);
  assert.deepEqual(auth.getConfig(), {passwordProtected: false});
  assert.equal(auth.getVersion(), 'demo');
  assert.equal(await auth.verify(firstPassword), false);
  db.put('sessions', 'staff', {id: 'staff', kind: 'admin'});
  db.put('sessions', 'guest', {id: 'guest', kind: 'customer'});
  const result = await auth.setPassword(firstPassword);
  const record = db.get('meta', 'staff-password');
  assert.equal(JSON.stringify(record).includes(firstPassword), false);
  assert.equal(record.hash.length, 128);
  assert.equal(record.salt.length, 64);
  assert.equal(result.authVersion, auth.getVersion());
  assert.deepEqual(auth.getConfig(), {passwordProtected: true});
  assert.equal(db.get('sessions', 'staff'), null);
  assert.ok(db.get('sessions', 'guest'));
  assert.equal(await auth.verify(firstPassword), true);
  assert.equal(await auth.verify('Wrong password 123'), false);
  assert.equal(await auth.verify({role: 'owner'}), false);
  await auth.setPassword(firstPassword);
  const changed = db.get('meta', 'staff-password');
  assert.notEqual(changed.salt, record.salt);
  assert.notEqual(changed.hash, record.hash);
  assert.notEqual(changed.authVersion, record.authVersion);
});

test('independent processes see password changes and stale password changes cannot overwrite a newer one', async t => {
  const {db, auth, dir} = fixture(t), second = new Journal(dir);
  t.after(() => second.db.close());
  const reader = new StaffAuth({db: second});
  await auth.setPassword(firstPassword);
  const oldVersion = reader.getVersion();
  assert.equal(await reader.verify(firstPassword), true);
  await auth.setPassword(nextPassword);
  assert.notEqual(reader.getVersion(), oldVersion);
  assert.equal(await reader.verify(firstPassword), false);
  assert.equal(await reader.verify(nextPassword), true);
  await assert.rejects(reader.setPassword(firstPassword, {expectedVersion: oldVersion}), e => e.status === 409);
  assert.equal(await auth.verify(nextPassword), true);
});

test('invalid and corrupted password configuration fails closed, without enabling demo access', async t => {
  const {db, auth} = fixture(t);
  for (const value of ['', 'short', 'x'.repeat(129), null, 123]) {
    await assert.rejects(auth.setPassword(value), e => e.status === 422);
  }
  db.put('meta', 'staff-password', {algorithm: 'scrypt', hash: 'broken'});
  assert.deepEqual(auth.getConfig(), {passwordProtected: true});
  assert.notEqual(auth.getVersion(), 'demo');
  assert.equal(await auth.verify(firstPassword), false);
});

test('scrypt work is bounded and simultaneous password changes cannot both succeed', async t => {
  const {auth} = fixture(t);
  await auth.setPassword(firstPassword);
  const checks = await Promise.allSettled(Array.from({length: 4}, () => auth.verify(firstPassword)));
  assert.equal(checks.filter(result => result.status === 'fulfilled' && result.value).length, 2);
  assert.equal(checks.filter(result => result.status === 'rejected' && result.reason.status === 429).length, 2);
  const changes = await Promise.allSettled([auth.setPassword(nextPassword), auth.setPassword('Other valid password 789')]);
  assert.equal(changes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(changes.filter(result => result.status === 'rejected' && result.reason.status === 409).length, 1);
});

test('attempt limits expire and attacker-controlled keys cannot grow bookkeeping indefinitely', () => {
  let time = 1000;
  const limiter = new AuthAttemptLimiter({limit: 2, windowMs: 60000, now: () => time});
  limiter.take('client'); limiter.take('client');
  assert.throws(() => limiter.take('client'), e => e.status === 429 && e.retryAfter === 60);
  time += 60000;
  limiter.take('client');
  for (let i = 0; i < 1100; i++) { try { limiter.take('client-' + i); } catch (error) { assert.equal(error.status, 429); } }
  assert.ok(limiter.entries.size <= 1025);
});
