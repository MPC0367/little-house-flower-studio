import {randomBytes, randomUUID, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const derive = promisify(scrypt);
const parameters = {N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024};
const keyLength = 64;
let activeDerivations = 0;

function error(message, status, retryAfter) {
  return Object.assign(new Error(message), {status, ...(retryAfter ? {retryAfter} : {})});
}

export function validateStaffPassword(password) {
  if (typeof password !== 'string' || [...password].length < 12 || [...password].length > 128) {
    throw error('Use a password with 12 to 128 characters.', 422);
  }
}

async function passwordKey(password, salt) {
  // Reject excess work rather than queueing an unbounded number of expensive hashes.
  if (activeDerivations >= 2) throw error('Sign-in is busy. Please try again shortly.', 429, 3);
  activeDerivations++;
  try { return await derive(password, salt, keyLength, parameters); }
  finally { activeDerivations--; }
}

/** A small bounded limiter; callers choose their trusted client/operation key. */
export class AuthAttemptLimiter {
  constructor({limit = 8, windowMs = 60000, now = Date.now} = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.entries = new Map();
  }
  take(key) {
    const now = this.now();
    for (const [id, entry] of this.entries) if (entry.until <= now) this.entries.delete(id);
    let entry = this.entries.get(key);
    if (!entry) {
      // Limit bookkeeping too. Excess identities share one overflow bucket.
      if (this.entries.size >= 1024) key = '__overflow__';
      entry = this.entries.get(key) || {attempts: 0, until: now + this.windowMs};
      this.entries.set(key, entry);
    }
    if (entry.attempts >= this.limit) {
      throw error('Too many attempts. Please wait a minute and try again.', 429, Math.max(1, Math.ceil((entry.until - now) / 1000)));
    }
    entry.attempts++;
  }
}

/** Local demo password gate. It is not a replacement for production staff identity. */
export class StaffAuth {
  constructor({db}) { this.db = db; }
  record() { return this.db.get('meta', 'staff-password'); }
  getConfig() { const record = this.record(); return {passwordProtected: record !== null && record !== undefined}; }
  getVersion() {
    const record = this.record();
    return record === null || record === undefined ? 'demo' : (record.authVersion || 'invalid-password-record');
  }
  async verify(password) {
    const record = this.record();
    if (!record || typeof password !== 'string' || [...password].length < 12 || [...password].length > 128) return false;
    // A malformed stored record must fail closed, never fall back to demo roles.
    if (record.algorithm !== 'scrypt' || record.N !== parameters.N || record.r !== parameters.r || record.p !== parameters.p ||
        !/^[a-f0-9]{64}$/.test(record.salt || '') || !/^[a-f0-9]{128}$/.test(record.hash || '') || typeof record.authVersion !== 'string') return false;
    const actual = await passwordKey(password, Buffer.from(record.salt, 'hex'));
    return timingSafeEqual(actual, Buffer.from(record.hash, 'hex')) && this.getVersion() === record.authVersion;
  }
  async setPassword(password, {expectedVersion = this.getVersion()} = {}) {
    validateStaffPassword(password);
    const salt = randomBytes(32);
    const derived = await passwordKey(password, salt);
    const record = {algorithm: 'scrypt', N: parameters.N, r: parameters.r, p: parameters.p,
      salt: salt.toString('hex'), hash: derived.toString('hex'), authVersion: randomUUID(), updatedAt: new Date().toISOString()};
    this.db.transaction(() => {
      if (this.getVersion() !== expectedVersion) throw error('The password changed. Sign in again before trying again.', 409);
      this.db.put('meta', 'staff-password', record);
      for (const session of this.db.all('sessions')) if (session.kind === 'admin') this.db.remove('sessions', session.id);
    });
    return {authVersion: record.authVersion};
  }
}
