import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Journal} from '../server/store.mjs';
import {StaffAuth} from '../server/staff-auth.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const password = 'Synthetic review password 123';
const replacement = 'Changed synthetic password 456';
async function fixture(t) {
  const sockets = await Promise.all(Array.from({length: 3}, () => new Promise(resolve => {
    const server = net.createServer(); server.listen(0, '127.0.0.1', () => resolve(server));
  })));
  const ports = sockets.map(server => server.address().port);
  await Promise.all(sockets.map(server => new Promise(resolve => server.close(resolve))));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lhf-auth-api-'));
  const child = spawn(process.execPath, ['server/main.mjs'], {cwd: root, env: {...process.env,
    LHF_DATA_DIR: dir, CUSTOMER_PORT: String(ports[0]), ADMIN_PORT: String(ports[1]), API_PORT: String(ports[2])}, stdio: ['ignore', 'pipe', 'pipe']});
  let logs = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { logs = (logs + chunk).slice(-4000); });
  t.after(async () => {
    if (child.exitCode === null) { child.kill('SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); }
    fs.rmSync(dir, {recursive: true, force: true});
  });
  const admin = 'http://127.0.0.1:' + ports[1], customer = 'http://127.0.0.1:' + ports[0];
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error('Isolated auth server exited: ' + logs);
    try { const response = await fetch(admin + '/api/health'); if (response.ok) break; } catch {}
    if (i === 149) throw new Error('Isolated auth server did not start: ' + logs);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  async function request(route, {method = 'GET', body, cookie, origin = admin, base = admin} = {}) {
    const response = await fetch(base + route, {method, headers: {Origin: origin, 'X-CSRF': 'local-preview',
      ...(body !== undefined ? {'Content-Type': 'application/json'} : {}), ...(cookie ? {Cookie: cookie} : {})},
      ...(body !== undefined ? {body: JSON.stringify(body)} : {})});
    return {status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers};
  }
  return {request, admin, customer, dir};
}

test('HTTP password setup, role-bypass prevention, rotation, logout and brute-force limits', {timeout: 30000}, async t => {
  const {request, customer, dir} = await fixture(t);
  assert.deepEqual((await request('/api/admin/auth-config')).data, {passwordProtected: false});
  assert.equal((await request('/api/admin/auth-config', {base: customer, origin: customer})).status, 403);
  const owner = await request('/api/admin/login', {method: 'POST', body: {role: 'owner'}});
  const staff = await request('/api/admin/login', {method: 'POST', body: {role: 'staff'}});
  const readOnly = await request('/api/admin/login', {method: 'POST', body: {role: 'read-only'}});
  assert.equal(owner.status, 200); assert.equal(staff.data.role, 'staff'); assert.equal(readOnly.data.role, 'read-only');
  assert.equal((await request('/api/admin/password', {method: 'POST', body: {newPassword: password}})).status, 401);
  assert.equal((await request('/api/admin/password', {method: 'POST', cookie: staff.cookie, body: {newPassword: password}})).status, 403);
  assert.equal((await request('/api/admin/password', {method: 'POST', cookie: owner.cookie, body: {newPassword: 'short'}})).status, 422);
  const setup = await request('/api/admin/password', {method: 'POST', cookie: owner.cookie, body: {newPassword: password}});
  assert.equal(setup.status, 200); assert.deepEqual(setup.data, {ok: true, passwordProtected: true});
  assert.notEqual(setup.cookie, owner.cookie);
  assert.deepEqual((await request('/api/admin/auth-config')).data, {passwordProtected: true});
  for (const cookie of [owner.cookie, staff.cookie, readOnly.cookie]) assert.equal((await request('/api/admin/me', {cookie})).status, 401);
  assert.equal((await request('/api/admin/me', {cookie: setup.cookie})).data.role, 'owner');
  assert.equal((await request('/api/admin/login', {method: 'POST', body: {role: 'owner'}})).status, 401);
  assert.equal((await request('/api/admin/login', {method: 'POST', body: {role: 'owner', password: 'Wrong password 123'}})).status, 401);
  const login = await request('/api/admin/login', {method: 'POST', body: {role: 'read-only', password}});
  assert.equal(login.status, 200); assert.equal(login.data.role, 'owner');
  const loggedOut = await request('/api/admin/logout', {method: 'POST', cookie: login.cookie, body: {}});
  assert.equal(loggedOut.status, 200); assert.match(loggedOut.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await request('/api/admin/me', {cookie: login.cookie})).status, 401);
  assert.equal((await request('/api/admin/logout', {method: 'POST', body: {}})).status, 401);
  assert.equal((await request('/api/admin/password', {method: 'POST', cookie: setup.cookie,
    body: {newPassword: replacement, currentPassword: 'Wrong password 123'}})).status, 401);
  const changed = await request('/api/admin/password', {method: 'POST', cookie: setup.cookie,
    body: {newPassword: replacement, currentPassword: password}});
  assert.equal(changed.status, 200);
  assert.equal((await request('/api/admin/me', {cookie: setup.cookie})).status, 401);
  assert.equal((await request('/api/admin/login', {method: 'POST', body: {password}})).status, 401);
  const current = await request('/api/admin/login', {method: 'POST', body: {password: replacement}});
  assert.equal(current.status, 200);
  // A separate process (the sharing proxy/lifecycle) uses this same private configuration.
  const db = new Journal(dir), auth = new StaffAuth({db});
  const oldSession = db.all('sessions').find(session => session.kind === 'admin');
  await auth.setPassword(password);
  // Restore a stale record to verify authVersion protects even if session deletion is bypassed.
  db.put('sessions', oldSession.id, oldSession);
  db.db.close();
  assert.equal((await request('/api/admin/me', {cookie: changed.cookie})).status, 401);
  assert.equal((await request('/api/admin/me', {cookie: current.cookie})).status, 401);
  const sharedLogin = await request('/api/admin/login', {method: 'POST', body: {password}});
  assert.equal(sharedLogin.status, 200);
  let changeLimited;
  for (let i = 0; i < 6; i++) {
    changeLimited = await request('/api/admin/password', {method: 'POST', cookie: sharedLogin.cookie,
      body: {newPassword: replacement, currentPassword: 'Wrong password 123'}});
    if (changeLimited.status === 429) break;
    assert.equal(changeLimited.status, 401);
  }
  assert.equal(changeLimited.status, 429); assert.ok(Number(changeLimited.headers.get('retry-after')) > 0);
  let limited;
  for (let i = 0; i < 10; i++) {
    limited = await request('/api/admin/login', {method: 'POST', body: {password: 'Wrong password 123'}});
    if (limited.status === 429) break;
    assert.equal(limited.status, 401);
  }
  assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal((await request('/api/admin/login', {method: 'POST', body: {password}})).status, 429);
});
