/**
 * Little House Flower — the Studio script (Google Apps Script web app).
 *
 * How the Studio works with the shop's Google Sheet, the way O2's own dashboard app works with its
 * Sheet: the Sheet stays the record people can open and edit; this script is the only thing that
 * writes to it for the Studio; each person signs in with a personal key the owner issued; every
 * write is logged in the hidden _Activity tab (when, who, what, why).
 *
 * It is a SEPARATE project from the website's order script (site/google/Code.gs). It never changes
 * that script and never adds or removes booking rows: it reads the "Bookings" tab, writes the
 * status cell (in the shop's own Thai words) and the payment cell, and keeps everything else in
 * its own tabs:
 *   _Studio    (hidden)  one row per booking: revision, staff notes, confirmed price, delivery fee,
 *                        follow-up flags, the status and payment last seen, updated at/by
 *   Payments             append-only money received and refunded (no names, phones or addresses,
 *                        so it survives the monthly purge of booking rows and keeps earnings whole)
 *   _Activity  (hidden)  every write and every refused key
 * Rows are found by booking id (or reference), never by row number.
 *
 * SET UP (the owner, once, signed in as the account that owns the Sheet)
 *  1. script.new → name the project "Little House Flower — Studio". Paste this whole file.
 *     Project Settings (gear): time zone (GMT+07:00) Bangkok.
 *  2. Project Settings → Script properties → add SHEET_ID = the id in the Sheet's address
 *     (docs.google.com/spreadsheets/d/<SHEET_ID>/edit).
 *  3. Run setupStudio. Allow access to the spreadsheet when Google asks.
 *  4. For each person: change the name and role in issueKeyForSomeone, run it, and copy the key
 *     from the execution log. Give it to that person privately. Roles: owner, staff, read-only.
 *     A key is shown once; only its fingerprint is stored. revokeKey('Name') withdraws one.
 *  5. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
 *     Copy the address ending in /exec. Each person pastes it with their key in
 *     Studio → Settings → Connect the shop's Google Sheet.
 *  6. Changing this file later: Deploy → Manage deployments → edit → Version: New version → Deploy.
 *     The /exec address stays the same.
 */

const STUDIO_VERSION = 'studio-sheet-2026-10-15';
const TZ = 'Asia/Bangkok';
const SHEET = 'Bookings';
const STATE = '_Studio';
const PAYMENTS = 'Payments';
const ACTIVITY = '_Activity';
const MAX_BODY = 20000;

/* The website's booking columns, found by their header label (site/google/Code.gs FIELDS + HEAD). */
const LEGACY = {
  received: 'เวลาที่รับคำจอง / Received', ref: 'รหัสจอง / Ref', status: 'สถานะ / Status', dateNeeded: 'วันที่ใช้ / Date needed',
  window: 'ช่วงเวลา / Time window', fulfil: 'รับเอง–ส่ง / Pickup or delivery', items: 'รายการ / Items', brief: 'โจทย์พิเศษ / Custom brief',
  budget: 'งบประมาณ / Budget', subtotal: 'ยอดรวม / Subtotal', quoteNeeded: 'ต้องยืนยันราคา / Quote needed', customerName: 'ชื่อผู้สั่ง / Customer',
  customerPhone: 'เบอร์ผู้สั่ง / Customer phone', recipientName: 'ชื่อผู้รับ / Recipient', recipientPhone: 'เบอร์ผู้รับ / Recipient phone',
  address: 'ที่อยู่จัดส่ง / Delivery address', district: 'เขต–อำเภอ / District', province: 'จังหวัด / Province', card: 'ข้อความการ์ด / Card message',
  anonymous: 'ไม่ระบุชื่อผู้ส่ง / Anonymous', lang: 'ภาษา / Language', notes: 'หมายเหตุร้าน / Shop notes', id: 'รหัสภายใน / Booking id',
  customerLine: 'LINE ผู้สั่ง / Customer LINE', payment: 'ชำระเงิน / Payment', source: 'ที่มา / Source', writtenIso: 'บันทึกเมื่อ (ISO) / Written at (ISO)',
};
/* The shop's own status words, as in the Sheet's dropdown, and the Studio's states. */
const STATUS_WORDS = { new: 'รอยืนยัน', confirmed: 'ยืนยันแล้ว', preparing: 'กำลังจัด', ready: 'พร้อมรับ', out: 'ออกจากบ้านแล้ว', done: 'ถึงมือแล้ว', cancelled: 'ยกเลิก' };
const PAID = 'ชำระแล้ว', UNPAID = 'ยังไม่ชำระ';
const FULFIL_WORDS = { 'มารับเองที่ร้าน': 'pickup', 'ให้ร้านส่ง': 'delivery' };
const NEXT = { new: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], readyPickup: ['done', 'cancelled'], readyDelivery: ['out', 'cancelled'], out: ['done'], done: [], cancelled: [], review: ['new', 'cancelled'] };
const STATE_HEAD = ['booking_id', 'ref', 'revision', 'staff_notes', 'confirmed_total_thb', 'delivery_fee_thb', 'needs_details', 'delivery_issue', 'seen_status', 'seen_payment', 'updated_at', 'updated_by'];
const PAY_HEAD = ['payment_id', 'booking_id', 'ref', 'type', 'amount_thb', 'occurred_at', 'occurred_bangkok', 'method', 'reference', 'reason', 'reversal_of', 'recorded_by', 'recorded_at'];
const LOG_HEAD = ['at', 'who', 'action', 'booking_id', 'ref', 'field', 'old', 'new', 'reason', 'operation_id'];

/* ======================= web app ======================= */

function doGet() { return out_({ ok: true, studio: STUDIO_VERSION }); }

function doPost(e) {
  let body;
  try {
    const raw = e && e.postData && e.postData.contents || '';
    if (raw.length > MAX_BODY) return out_(fail_('Request too large', 413));
    body = JSON.parse(raw);
  } catch (err) { return out_(fail_('Invalid request', 400)); }
  if (!body || body.studio !== 1) return out_(fail_('Not a Studio request', 400));
  try { return out_(handle_(body)); }
  catch (err) { return out_(err && err.status ? fail_(err.message, err.status, err.current) : fail_('The Studio script could not finish. Please try again.', 500)); }
}

function handle_(body) {
  const who = person_(body.key);
  const action = String(body.action || '');
  const book = workbook_();
  if (action === 'whoami') return { ok: true, name: who.name, role: who.role, sheetName: book.getName(), version: STUDIO_VERSION };
  if (action === 'orders') { const data = readAll_(book, { detect: true }); return { ok: true, orders: data.orders.filter(match_(String(body.q || ''))).map(compact_), lastSave: data.lastSave, conflicts: 0, readAt: new Date().toISOString() }; }
  if (action === 'order') { const data = readAll_(book, { detect: true }); const o = data.byId[String(body.id || '')]; if (!o) throw err_('Order not found', 404); return { ok: true, order: full_(o, data, book) }; }
  if (action === 'update') { requireWriter_(who); return { ok: true, order: update_(book, who, body) }; }
  if (action === 'addPayment') { requireWriter_(who); return { ok: true, payment: addPayment_(book, who, body) }; }
  if (action === 'revenue') { const data = readAll_(book, { detect: false }); return { ok: true, report: revenue_(data, String(body.from || ''), String(body.to || ''), body.group === 'month' ? 'month' : 'day') }; }
  if (action === 'settings') return { ok: true, settings: { version: STUDIO_VERSION, googleConnected: true, previewProvider: 'Pictures stay on the website; the Sheet holds the order record.', conflicts: [], since: props_().getProperty('STUDIO_SINCE') || null } };
  throw err_('Unknown action', 400);
}

/* ======================= people and keys ======================= */

function person_(key) {
  const keys = keys_();
  const record = typeof key === 'string' && key.length >= 24 && key.length <= 200 ? keys[fingerprint_(key)] : null;
  if (!record || record.revoked) {
    const cache = CacheService.getScriptCache(), n = Number(cache.get('refused') || 0) + 1;
    cache.put('refused', String(n), 60);
    if (n <= 30) log_(workbook_(), 'unknown key', 'refused', '', '', '', '', '', 'A request with an unknown or withdrawn key was refused', '');
    throw err_(n > 30 ? 'Too many attempts. Please wait a minute.' : 'This key is not recognised. Ask the owner for your personal key.', n > 30 ? 429 : 401);
  }
  return record;
}
function requireWriter_(who) { if (who.role === 'read-only') throw err_('Your key can view orders but not change them.', 403); }
function keys_() { try { return JSON.parse(props_().getProperty('STUDIO_KEYS') || '{}'); } catch (e) { return {}; } }
function fingerprint_(key) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'lhf-studio:' + key, Utilities.Charset.UTF_8)); }
function hex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }

/** Run from the editor: makes a key for one person and shows it once in the execution log. */
function issueKey(name, role) {
  name = String(name || '').trim(); role = String(role || '');
  if (!name || name.length > 60) throw new Error('Give the person a name of at most 60 characters.');
  if (['owner', 'staff', 'read-only'].indexOf(role) < 0) throw new Error('Role must be owner, staff or read-only.');
  const key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const keys = keys_();
  Object.keys(keys).forEach(function (f) { if (keys[f].name === name && !keys[f].revoked) keys[f].revoked = new Date().toISOString(); });
  keys[fingerprint_(key)] = { name: name, role: role, issuedAt: new Date().toISOString() };
  props_().setProperty('STUDIO_KEYS', JSON.stringify(keys));
  log_(workbook_(), 'owner (script editor)', 'key issued', '', '', 'person', '', name + ' · ' + role, '', '');
  Logger.log('Personal key for ' + name + ' (' + role + '): ' + key + '\nCopy it now and give it to them privately. It is not shown again.');
  return key;
}
function issueKeyForSomeone() { issueKey('Name of the person', 'staff'); }
function revokeKey(name) {
  const keys = keys_(); let n = 0;
  Object.keys(keys).forEach(function (f) { if (keys[f].name === name && !keys[f].revoked) { keys[f].revoked = new Date().toISOString(); n++; } });
  props_().setProperty('STUDIO_KEYS', JSON.stringify(keys));
  log_(workbook_(), 'owner (script editor)', 'key withdrawn', '', '', 'person', name, '', '', '');
  Logger.log(n ? 'Withdrew the key of ' + name + '.' : 'No active key for ' + name + '.');
}
function listKeys() { const keys = keys_(); Object.keys(keys).forEach(function (f) { const k = keys[f]; Logger.log(k.name + ' · ' + k.role + ' · issued ' + k.issuedAt + (k.revoked ? ' · withdrawn ' + k.revoked : '')); }); }

/* ======================= set-up ======================= */

function setupStudio() {
  const book = workbook_();
  const bookings = book.getSheetByName(SHEET);
  if (!bookings) throw new Error('This Sheet has no "' + SHEET + '" tab. Run the website order script\'s setupSheet first.');
  const head = header_(bookings);
  ['ref', 'status', 'dateNeeded', 'customerName', 'payment'].forEach(function (k) { if (!head[k]) throw new Error('The Bookings header has no "' + LEGACY[k] + '" column.'); });
  tab_(book, STATE, STATE_HEAD, true);
  tab_(book, PAYMENTS, PAY_HEAD, false);
  tab_(book, ACTIVITY, LOG_HEAD, true);
  if (!props_().getProperty('STUDIO_SINCE')) props_().setProperty('STUDIO_SINCE', today_());
  Logger.log('Studio tabs ready. Money is recorded from ' + props_().getProperty('STUDIO_SINCE') + '; earlier periods show as "no records".');
}
function tab_(book, name, head, hidden) {
  let sh = book.getSheetByName(name);
  if (!sh) { sh = book.insertSheet(name); }
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, head.length).setValues([head]);
  sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
  sh.setFrozenRows(1);
  if (hidden) sh.hideSheet();
  return sh;
}

/* ======================= reading ======================= */

function workbook_() {
  const id = props_().getProperty('SHEET_ID');
  const book = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw err_('The Studio script has no Sheet. Set SHEET_ID in Script properties.', 500);
  return book;
}
function props_() { return PropertiesService.getScriptProperties(); }
function header_(sh) {
  const width = Math.max(sh.getLastColumn(), 1), top = sh.getRange(1, 1, 1, width).getValues()[0].map(function (x) { return String(x).trim(); });
  const map = {}; Object.keys(LEGACY).forEach(function (k) { const at = top.indexOf(LEGACY[k]); if (at >= 0) map[k] = at + 1; });
  return map;
}
function rows_(sh, width) { const n = sh ? sh.getLastRow() - 1 : 0; return n > 0 ? sh.getRange(2, 1, n, width || sh.getLastColumn()).getValues() : []; }
function text_(v) { return v == null ? '' : v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm') : String(v).trim(); }
function dateText_(v) { if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd'); const s = text_(v); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''; }
function money_(v) { if (v === '' || v == null) return null; const n = typeof v === 'number' ? v : Number(String(v).replace(/[฿,\s]/g, '')); return isFinite(n) && n >= 0 ? Math.round(n * 100) : null; }
function flag_(v) { const s = text_(v).toLowerCase(); return v === true || ['true', 'yes', 'ใช่', '1', 'y'].indexOf(s) >= 0; }
function statusOf_(word) { const w = text_(word); for (const id in STATUS_WORDS) if (STATUS_WORDS[id] === w) return id; return 'review'; }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

/** Everything the Studio needs, read in one pass: bookings joined with the Studio's own rows and the ledger. */
function readAll_(book, options) {
  const bookings = book.getSheetByName(SHEET), state = book.getSheetByName(STATE), payTab = book.getSheetByName(PAYMENTS), activity = book.getSheetByName(ACTIVITY);
  if (!bookings || !state || !payTab || !activity) throw err_('Run setupStudio in the Studio script first.', 503);
  const head = header_(bookings), width = bookings.getLastColumn();
  const cell = function (row, k) { return head[k] ? row[head[k] - 1] : ''; };
  const stateRows = rows_(state, STATE_HEAD.length), stateBy = {};
  stateRows.forEach(function (r, i) { if (r[0]) stateBy[String(r[0])] = { row: i + 2, values: r }; });
  const payments = rows_(payTab, PAY_HEAD.length).filter(function (r) { return r[0]; }).map(function (r) {
    return { id: text_(r[0]), orderId: text_(r[1]), ref: text_(r[2]), type: text_(r[3]), amount: money_(r[4]), occurredAt: r[5] instanceof Date ? r[5].toISOString() : text_(r[5]), method: text_(r[7]), externalReference: text_(r[8]), reason: text_(r[9]), reversalOf: text_(r[10]) || null, actor: text_(r[11]), recordedAt: text_(r[12]) };
  });
  const orders = [], byId = {}, detected = [];
  rows_(bookings, width).forEach(function (r, i) {
    const ref = text_(cell(r, 'ref')), rawId = text_(cell(r, 'id'));
    if (!ref && !rawId) return;
    const id = rawId || 'ref:' + ref;
    if (byId[id]) return;   // a duplicated booking id: the first row is the record
    const s = stateBy[id], v = s ? s.values : null;
    const statusWord = text_(cell(r, 'status')), paymentWord = text_(cell(r, 'payment'));
    const own = payments.filter(function (p) { return p.orderId === id; });
    const o = {
      id: id, ref: ref || id, row: i + 2, statusWord: statusWord, paymentWord: paymentWord,
      status: statusOf_(statusWord), fulfil: FULFIL_WORDS[text_(cell(r, 'fulfil'))] || (/ส่ง|deliver/i.test(text_(cell(r, 'fulfil'))) ? 'delivery' : 'pickup'),
      date: dateText_(cell(r, 'dateNeeded')), windowLabel: text_(cell(r, 'window')),
      createdAt: iso_(cell(r, 'writtenIso'), cell(r, 'received')),
      customer: { name: text_(cell(r, 'customerName')), phone: text_(cell(r, 'customerPhone')), line: text_(cell(r, 'customerLine')) },
      recipient: { name: text_(cell(r, 'recipientName')), phone: text_(cell(r, 'recipientPhone')) },
      address: { line: text_(cell(r, 'address')), district: text_(cell(r, 'district')), province: text_(cell(r, 'province')) },
      card: { message: text_(cell(r, 'card')) }, anonymous: flag_(cell(r, 'anonymous')), lang: text_(cell(r, 'lang')) === 'en' ? 'en' : 'th',
      items: text_(cell(r, 'items')).split('\n').map(function (x) { return x.trim(); }).filter(String).map(function (x) { return { name: x, qty: null, line: null, kind: 'text' }; }),
      brief: text_(cell(r, 'brief')), budget: text_(cell(r, 'budget')), subtotal: money_(cell(r, 'subtotal')), quoteNeeded: text_(cell(r, 'quoteNeeded')),
      customerNotes: text_(cell(r, 'notes')),
      revision: v ? Number(v[2]) || 1 : 1, notes: v ? text_(v[3]) : '', confirmedTotal: v ? money_(v[4]) : null, deliveryFee: v ? money_(v[5]) : null,
      needsDetails: v ? flag_(v[6]) : false, deliveryIssue: v ? flag_(v[7]) : false, updatedAt: v ? text_(v[10]) : '', updatedBy: v ? text_(v[11]) : '',
      payments: own, syncState: 'saved', source: 'sheet',
    };
    o.type = o.brief ? 'custom' : 'product';
    o.payment = paymentState_(o, own);
    o.historyIncomplete = paymentWord === PAID && !own.length;
    if (o.status === 'review') o.statusText = statusWord;
    // somebody changed the status or payment cell in the Sheet since the Studio last saw it
    if (v && (text_(v[8]) !== statusWord || text_(v[9]) !== paymentWord)) detected.push({ o: o, state: s, before: { status: text_(v[8]), payment: text_(v[9]) } });
    if (!v) detected.push({ o: o, state: null, before: null });
    orders.push(o); byId[id] = o;
  });
  if (options.detect && detected.length) record_(book, detected);
  const lastSave = stateRows.reduce(function (m, r) { const t = text_(r[10]); return t > m ? t : m; }, '');
  return { orders: orders, byId: byId, payments: payments, lastSave: lastSave || null, since: props_().getProperty('STUDIO_SINCE') || '' };
}
function iso_(written, received) {
  const w = text_(written); if (/^\d{4}-\d{2}-\d{2}T/.test(w)) return w;
  if (received instanceof Date) return received.toISOString();
  const r = text_(received); return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(r) ? r.replace(' ', 'T') + ':00+07:00' : '';
}
/** first sight of a booking: give it a Studio row; a change made in the Sheet: note it and move the revision on */
function record_(book, detected) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return;
  try {
    const state = book.getSheetByName(STATE), now = new Date().toISOString();
    // bookings seen for the first time: one write for all of them (Sheets calls are slow one by one)
    const known = {}; rows_(state, 1).forEach(function (r) { known[text_(r[0])] = true; });
    const fresh = detected.filter(function (d) { return !d.state && !known[d.o.id]; }).map(function (d) { return [d.o.id, safe_(d.o.ref), 1, '', '', '', false, false, d.o.statusWord, d.o.paymentWord, '', '']; });
    if (fresh.length) state.getRange(state.getLastRow() + 1, 1, fresh.length, STATE_HEAD.length).setValues(fresh);
    detected.forEach(function (d) {
      const o = d.o;
      if (!d.state) return;
      const row = d.state.row;
      if (text_(state.getRange(row, 1).getValue()) !== o.id) return;   // moved since it was read: next read will do it
      const revision = (Number(state.getRange(row, 3).getValue()) || 1) + 1;
      state.getRange(row, 3).setValue(revision);
      state.getRange(row, 9, 1, 2).setValues([[o.statusWord, o.paymentWord]]);
      state.getRange(row, 11, 1, 2).setValues([[now, 'Google Sheet']]);
      o.revision = revision;
      if (d.before.status !== o.statusWord) log_(book, 'Google Sheet', 'sheet edit', o.id, o.ref, 'status', d.before.status, o.statusWord, '', '');
      if (d.before.payment !== o.paymentWord) log_(book, 'Google Sheet', 'sheet edit', o.id, o.ref, 'payment', d.before.payment, o.paymentWord, '', '');
    });
  } finally { lock.releaseLock(); }
}
function match_(q) {
  q = q.toLowerCase().trim(); const digits = q.replace(/\D/g, '');
  return function (o) { if (!q) return true; return [o.ref, o.customer.name].join(' ').toLowerCase().indexOf(q) >= 0 || (digits.length >= 3 && (o.customer.phone.replace(/\D/g, '').indexOf(digits) >= 0 || o.recipient.phone.replace(/\D/g, '').indexOf(digits) >= 0)); };
}
function compact_(o) {
  return { id: o.id, ref: o.ref, date: o.date, windowLabel: o.windowLabel, fulfil: o.fulfil, status: o.status, customer: { name: o.customer.name }, items: o.items.slice(0, 3).map(function (i) { return { name: i.name, qty: null, image: null }; }),
    type: o.type, preview: null, style: null, confirmedTotal: o.confirmedTotal, subtotal: o.subtotal, revision: o.revision, payment: o.payment, createdAt: o.createdAt, historyIncomplete: o.historyIncomplete, needsDetails: o.needsDetails, deliveryIssue: o.deliveryIssue };
}
function full_(o, data, book) {
  const copy = JSON.parse(JSON.stringify(o)); delete copy.row; delete copy.statusWord; delete copy.paymentWord;
  copy.events = events_(book, o.id);
  return copy;
}
function events_(book, id) {
  const sh = book.getSheetByName(ACTIVITY), out = [];
  const rows = rows_(sh, LOG_HEAD.length);
  for (let i = rows.length - 1; i >= 0 && out.length < 200; i--) {
    const r = rows[i]; if (text_(r[3]) !== id) continue;
    const action = text_(r[2]), field = text_(r[5]), change = {};
    if (action === 'payment') { const p = JSON.parse(text_(r[7]) || '{}'); change.paymentId = p.id; change.type = p.type; change.amount = p.amount; }
    else if (action === 'created') change.created = true;
    else if (field) { change.old = {}; change.new = {}; change.old[field] = decode_(field, text_(r[6])); change.new[field] = decode_(field, text_(r[7])); if (action === 'sheet edit') change.origin = 'sheet-edit'; if (action === 'correction') change.correction = true; }
    out.push({ id: String(i), orderId: id, actor: text_(r[1]), change: change, reason: text_(r[8]), at: r[0] instanceof Date ? r[0].toISOString() : text_(r[0]) });
  }
  return out;
}
/** activity lines keep values as text; give the Studio back the values it understands */
function decode_(field, value) {
  if (field === 'status') return Object.prototype.hasOwnProperty.call(STATUS_WORDS, value) || value === 'review' ? value : statusOf_(value);
  if (field === 'confirmedTotal' || field === 'deliveryFee') return value === '' ? null : Number(value);
  if (field === 'needsDetails' || field === 'deliveryIssue') return value === 'true';
  return value;
}
function paymentState_(o, own) {
  let net = 0; own.forEach(function (p) { net += p.type === 'refund' ? -p.amount : p.amount; });
  const payable = o.confirmedTotal == null ? null : o.confirmedTotal + (o.deliveryFee || 0);
  const refunded = own.some(function (p) { return p.type === 'refund'; });
  return { net: net, confirmedPayable: payable, status: refunded ? (net <= 0 ? 'refunded' : 'part-refunded') : net === 0 ? 'unpaid' : payable != null && net >= payable ? 'paid' : 'part-paid', outstanding: payable == null || o.status === 'cancelled' ? null : Math.max(0, payable - net) };
}

/* ======================= writing ======================= */

function update_(book, who, body) {
  const fields = body.fields && typeof body.fields === 'object' ? body.fields : {};
  const reason = String(body.reason || '').trim().slice(0, 1000), correction = !!body.correction, op = String(body.operationId || '').slice(0, 100);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    if (op && opSeen_(book, op)) { const again = readAll_(book, { detect: false }).byId[String(body.id)]; if (again) return full_(again, null, book); }
    const data = readAll_(book, { detect: false }), o = data.byId[String(body.id || '')];
    if (!o) throw err_('Order not found', 404);
    if (Number(body.expectedRevision) !== o.revision) throw err_('This order changed in another view. Review the current values before saving.', 409, full_(o, data, book));
    const allowed = ['status', 'notes', 'confirmedTotal', 'deliveryFee', 'needsDetails', 'deliveryIssue'], patch = {};
    allowed.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(fields, k) && JSON.stringify(fields[k]) !== JSON.stringify(o[k])) patch[k] = fields[k]; });
    if (!Object.keys(patch).length) return full_(o, data, book);
    if ((o.status === 'done' || o.status === 'cancelled') && !(who.role === 'owner' && correction && reason)) throw err_('Completed or cancelled orders need an owner correction with a reason.', 422);
    if (patch.status) checkTransition_(o, patch.status, reason, correction, who.role);
    if ('notes' in patch && (typeof patch.notes !== 'string' || patch.notes.length > 4000)) throw err_('Notes must be at most 4000 characters.', 422);
    ['needsDetails', 'deliveryIssue'].forEach(function (k) { if (k in patch && typeof patch[k] !== 'boolean') throw err_('Follow-up flags must be true or false.', 422); });
    ['confirmedTotal', 'deliveryFee'].forEach(function (k) { if (k in patch && patch[k] != null && !(Number.isSafeInteger(patch[k]) && patch[k] >= 0 && patch[k] <= 100000000)) throw err_('Use an amount between 0 and THB 1,000,000.', 422); });
    if (('confirmedTotal' in patch || 'deliveryFee' in patch) && !reason) throw err_('A price or delivery-fee change needs a reason.', 422);
    const quote = 'confirmedTotal' in patch ? patch.confirmedTotal : o.confirmedTotal, fee = 'deliveryFee' in patch ? patch.deliveryFee : o.deliveryFee;
    if (('confirmedTotal' in patch || 'deliveryFee' in patch) && (quote == null ? o.payment.net > 0 : quote + (fee || 0) < o.payment.net)) throw err_('The confirmed price cannot be below money already received; record a refund first.', 422);
    // find the booking row again by its id inside the lock, then write
    const bookings = book.getSheetByName(SHEET), head = header_(bookings), row = findRow_(bookings, head, o);
    const state = book.getSheetByName(STATE), sRow = stateRow_(state, o);
    const now = new Date().toISOString(), revision = o.revision + 1;
    if (patch.status) {
      const word = STATUS_WORDS[patch.status];
      if (!word) throw err_('That status cannot be written to the Sheet.', 422);
      bookings.getRange(row, head.status).setValue(word);
      o.statusWord = word;
    }
    const values = state.getRange(sRow, 1, 1, STATE_HEAD.length).getValues()[0];
    values[2] = revision;
    if ('notes' in patch) values[3] = safe_(patch.notes);
    if ('confirmedTotal' in patch) values[4] = patch.confirmedTotal == null ? '' : patch.confirmedTotal / 100;
    if ('deliveryFee' in patch) values[5] = patch.deliveryFee == null ? '' : patch.deliveryFee / 100;
    if ('needsDetails' in patch) values[6] = patch.needsDetails;
    if ('deliveryIssue' in patch) values[7] = patch.deliveryIssue;
    values[8] = o.statusWord; values[9] = o.paymentWord; values[10] = now; values[11] = safe_(who.name);
    state.getRange(sRow, 1, 1, STATE_HEAD.length).setValues([values]);
    Object.keys(patch).forEach(function (k) {
      const before = k === 'notes' ? '(notes)' : o[k] == null ? '' : String(o[k]), after = k === 'notes' ? '(notes)' : patch[k] == null ? '' : String(patch[k]);
      log_(book, who.name, correction ? 'correction' : 'update', o.id, o.ref, k, before, after, reason, op);
    });
    // the payment cell follows the ledger when the price changes
    syncPaymentCell_(book, o.id);
    return full_(readAll_(book, { detect: false }).byId[o.id], null, book);
  } finally { lock.releaseLock(); }
}
function checkTransition_(o, status, reason, correction, role) {
  if (status === o.status) return;
  const key = o.status === 'ready' ? (o.fulfil === 'pickup' ? 'readyPickup' : 'readyDelivery') : o.status;
  const normal = (NEXT[key] || []).indexOf(status) >= 0;
  const valid = Object.prototype.hasOwnProperty.call(STATUS_WORDS, status) && !(o.fulfil === 'pickup' && status === 'out');
  if (!normal && !(valid && correction && role === 'owner')) throw err_('That status change is not allowed; an owner correction is needed.', 422);
  if ((status === 'cancelled' || !normal || o.status === 'review') && !reason) throw err_('Cancelling, resolving a review or correcting needs a reason.', 422);
}
function addPayment_(book, who, body) {
  const p = body.payment || {};
  const type = p.type, amount = p.amount, requestId = String(p.requestId || '');
  if (['receipt', 'refund'].indexOf(type) < 0 || !Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000 || !/^[-a-zA-Z0-9]{8,100}$/.test(requestId)) throw err_('Invalid payment', 422);
  if (type === 'refund' && who.role !== 'owner') throw err_('Only the owner records refunds.', 403);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const data = readAll_(book, { detect: false }), o = data.byId[String(body.id || '')];
    if (!o) throw err_('Order not found', 404);
    const old = data.payments.filter(function (x) { return x.id === requestId; })[0];
    if (old) { if (old.orderId !== o.id || old.type !== type || old.amount !== amount) throw err_('This payment key belongs to a different payment.', 409); return old; }
    const occurred = new Date(p.occurredAt);
    if (!isFinite(occurred.getTime()) || occurred.getTime() > Date.now() + 60000) throw err_('Use a payment date no later than now.', 422);
    const reason = String(p.reason || '').trim().slice(0, 1000);
    if (type === 'refund' && amount > o.payment.net) throw err_('A refund cannot be more than the money received.', 422);
    if (type === 'refund' && !reason) throw err_('A refund needs a reason.', 422);
    if (type === 'receipt' && (o.confirmedTotal == null || o.status === 'cancelled' || amount > o.payment.outstanding)) throw err_('Confirm a price first; a payment cannot be more than what is still to collect.', 422);
    if (p.reversalOf) { const target = o.payments.filter(function (x) { return x.id === p.reversalOf; })[0]; if (type !== 'refund' || !target || target.type !== 'receipt') throw err_('A reversal must name a payment received on this order.', 422); }
    const method = ['bank_transfer', 'cash', 'card', 'other'].indexOf(p.method) >= 0 ? p.method : 'bank_transfer', now = new Date().toISOString();
    book.getSheetByName(PAYMENTS).appendRow([requestId, o.id, safe_(o.ref), type, amount / 100, occurred.toISOString(), Utilities.formatDate(occurred, TZ, 'yyyy-MM-dd HH:mm'), method, safe_(String(p.externalReference || '').slice(0, 200)), safe_(reason), p.reversalOf || '', safe_(who.name), now]);
    const payment = { id: requestId, orderId: o.id, type: type, amount: amount, occurredAt: occurred.toISOString(), method: method, externalReference: String(p.externalReference || '').slice(0, 200), reason: reason, reversalOf: p.reversalOf || null, actor: who.name };
    log_(book, who.name, 'payment', o.id, o.ref, 'payment', '', JSON.stringify({ id: requestId, type: type, amount: amount }), reason, requestId);
    syncPaymentCell_(book, o.id);
    return payment;
  } finally { lock.releaseLock(); }
}
/** The shop's payment column says "paid" only when the ledger covers the confirmed price and fee. */
function syncPaymentCell_(book, id) {
  const data = readAll_(book, { detect: false }), o = data.byId[id]; if (!o || !o.payments.length) return;
  const word = o.payment.status === 'paid' ? PAID : UNPAID;
  if (o.paymentWord === word) return;
  const bookings = book.getSheetByName(SHEET), head = header_(bookings);
  bookings.getRange(findRow_(bookings, head, o), head.payment).setValue(word);
  const state = book.getSheetByName(STATE), sRow = stateRow_(state, o);
  state.getRange(sRow, 10).setValue(word);
}
function findRow_(sh, head, o) {
  const col = head.id || head.ref, want = head.id && o.id.indexOf('ref:') !== 0 ? o.id : o.ref;
  const n = sh.getLastRow() - 1, values = n > 0 ? sh.getRange(2, col, n, 1).getValues() : [];
  for (let i = 0; i < values.length; i++) if (text_(values[i][0]) === want) return i + 2;
  throw err_('This booking is no longer in the Sheet.', 409);
}
function stateRow_(state, o) {
  const n = state.getLastRow() - 1, values = n > 0 ? state.getRange(2, 1, n, 1).getValues() : [];
  for (let i = 0; i < values.length; i++) if (text_(values[i][0]) === o.id) return i + 2;
  state.appendRow([o.id, safe_(o.ref), 1, '', '', '', false, false, o.statusWord, o.paymentWord, '', '']);
  return state.getLastRow();
}
function opSeen_(book, op) {
  const sh = book.getSheetByName(ACTIVITY), n = sh.getLastRow() - 1; if (n <= 0) return false;
  const from = Math.max(2, sh.getLastRow() - 2000), values = sh.getRange(from, 10, sh.getLastRow() - from + 1, 1).getValues();
  return values.some(function (r) { return text_(r[0]) === op; });
}
function log_(book, who, action, id, ref, field, before, after, reason, op) {
  const sh = book.getSheetByName(ACTIVITY); if (!sh) return;
  sh.appendRow([new Date().toISOString(), safe_(who), action, id, safe_(ref), field, safe_(before), safe_(after), safe_(reason), op]);
}
/** Text a person typed never runs as a formula in the Sheet. */
function safe_(v) { const s = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }

/* ======================= retention ======================= */

const KEEP_MONTHS = 11;   // the same as the website script: nothing personal outlives 12 months after its date

/** Removes Studio rows of bookings the website script has already deleted, and activity lines older
    than KEEP_MONTHS. Payments rows hold no names, phones or addresses and are kept for earnings;
    how long to keep them is the owner's accounting decision. Safe to run again. */
function purgeStudio() {
  const book = workbook_(), lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const bookings = book.getSheetByName(SHEET), head = header_(bookings), live = {};
    rows_(bookings).forEach(function (r) { const ref = head.ref ? text_(r[head.ref - 1]) : '', id = head.id ? text_(r[head.id - 1]) : ''; if (id) live[id] = true; if (ref) live['ref:' + ref] = true; });
    const state = book.getSheetByName(STATE), keep = rows_(state, STATE_HEAD.length).filter(function (r) { return live[text_(r[0])]; });
    const removed = state.getLastRow() - 1 - keep.length;
    if (state.getLastRow() > 1) state.getRange(2, 1, state.getLastRow() - 1, STATE_HEAD.length).clearContent();
    if (keep.length) state.getRange(2, 1, keep.length, STATE_HEAD.length).setValues(keep);
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - KEEP_MONTHS);
    const activity = book.getSheetByName(ACTIVITY), recent = rows_(activity, LOG_HEAD.length).filter(function (r) { return text_(r[0]) >= cutoff.toISOString(); });
    const dropped = activity.getLastRow() - 1 - recent.length;
    if (activity.getLastRow() > 1) activity.getRange(2, 1, activity.getLastRow() - 1, LOG_HEAD.length).clearContent();
    if (recent.length) activity.getRange(2, 1, recent.length, LOG_HEAD.length).setValues(recent);
    log_(book, 'Studio script', 'purge', '', '', '', '', removed + ' Studio rows, ' + dropped + ' activity lines', '', '');
    return { studioRows: removed, activityLines: dropped };
  } finally { lock.releaseLock(); }
}
/** Run once: purges on the 2nd of every month, after the website script's own purge on the 1st. */
function installStudioPurge() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'purgeStudio') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('purgeStudio').timeBased().onMonthDay(2).atHour(3).inTimezone(TZ).create();
}

/* ======================= earnings ======================= */

function revenue_(data, from, to, group) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw err_('Use a valid report range.', 422);
  const day = function (iso) { return Utilities.formatDate(new Date(iso), TZ, 'yyyy-MM-dd'); };
  const shift = function (d, n) { return new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); };
  const today = today_(), since = data.since || today, rows = {}, order = [];
  let gross = 0, refunds = 0;
  for (let d = from; d <= to; d = shift(d, 1)) {
    const k = group === 'month' ? d.slice(0, 7) : d;
    if (!rows[k]) { rows[k] = { period: k, gross: 0, refunds: 0, net: 0, days: 0, completeDays: 0, eventCount: 0, orderIds: [] }; order.push(k); }
    rows[k].days++;
    // the ledger is complete from the day the Studio's Payments tab was set up, up to today
    if (d >= since && d <= today) rows[k].completeDays++;
  }
  data.payments.forEach(function (p) {
    if (!p.occurredAt || ['receipt', 'refund'].indexOf(p.type) < 0 || p.amount == null) return;
    const d = day(p.occurredAt); if (d < from || d > to) return;
    const row = rows[group === 'month' ? d.slice(0, 7) : d], g = p.type === 'receipt' ? p.amount : 0, r = p.type === 'refund' ? p.amount : 0;
    row.gross += g; row.refunds += r; row.net += g - r; row.eventCount++; if (row.orderIds.indexOf(p.orderId) < 0) row.orderIds.push(p.orderId);
    gross += g; refunds += r;
  });
  const out = order.map(function (k) { const r = rows[k]; const coverage = r.completeDays === r.days ? 'complete' : r.eventCount ? 'partial' : 'unknown'; if (coverage === 'unknown') { r.gross = null; r.refunds = null; r.net = null; } r.coverage = coverage; return r; });
  const complete = out.every(function (r) { return r.coverage === 'complete'; }), anyData = out.some(function (r) { return r.coverage !== 'unknown'; });
  const inRange = data.orders.filter(function (o) { return o.date >= from && o.date <= to; });
  const confirmed = inRange.filter(function (o) { return ['new', 'cancelled', 'review'].indexOf(o.status) < 0; });
  const priced = confirmed.filter(function (o) { return o.confirmedTotal != null; });
  const names = { confirmed: 'Not started', preparing: 'In progress', ready: 'Ready', out: 'Shipped', done: 'Completed' };
  return {
    gross: anyData ? gross : null, refunds: anyData ? refunds : null, net: anyData ? gross - refunds : null, recordedGross: gross, recordedRefunds: refunds, recordedNet: gross - refunds, rows: out,
    outstanding: priced.reduce(function (n, o) { return n + (o.payment.outstanding || 0); }, 0),
    unknownQuotes: inRange.filter(function (o) { return o.confirmedTotal == null && ['cancelled', 'done'].indexOf(o.status) < 0; }).length,
    confirmedValue: priced.reduce(function (n, o) { return n + o.confirmedTotal; }, 0),
    completed: inRange.filter(function (o) { return o.status === 'done'; }).length, confirmedCount: priced.length,
    averageConfirmedValue: priced.length ? priced.reduce(function (n, o) { return n + o.confirmedTotal; }, 0) / priced.length : null,
    deliveryFees: confirmed.reduce(function (n, o) { return n + (o.deliveryFee || 0); }, 0), banknoteValue: 0,
    statusGroups: Object.keys(names).map(function (s) { const list = inRange.filter(function (o) { return o.status === s; }); return { status: s, label: names[s], count: list.length, orders: list.map(function (o) { return { id: o.id, ref: o.ref }; }) }; }),
    historyIncompleteOrders: data.orders.filter(function (o) { return o.historyIncomplete; }).length,
    coverage: complete ? 'Complete ledger coverage' : anyData ? 'Partial history · recorded events only' : 'No recorded data', coverageStatus: complete ? 'complete' : anyData ? 'partial' : 'unknown',
    range: { from: from, to: to }, timezone: TZ, currency: 'THB', metricVersion: STUDIO_VERSION,
  };
}

/* ======================= plumbing ======================= */

function err_(message, status, current) { const e = new Error(message); e.status = status; if (current) e.current = current; return e; }
function fail_(message, status, current) { const r = { ok: false, error: message, status: status }; if (current) r.current = current; return r; }
function out_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
