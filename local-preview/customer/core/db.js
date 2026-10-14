/* ---- core/db.js ---- */
/* =====================================================================
   db — persistence adapter.
   Backend A: the Artifact realtime document store (claude.use('db')).
   Backend B: localStorage (the public site). Here the shop's Google Sheet is
   the record, so this browser keeps only a receipt copy of its own orders —
   no names, numbers, address, card or private photo, and nothing past 30 days — and
   it never counts capacity or reads rules saved on one device.
   Both expose the same async API so pages never branch on the backend.

   Collections:  bookings/{id}      one document per order or request
                 settings/booking   admin-editable capacity & rules
                 locks/{date}       short lease used while claiming a slot
   ===================================================================== */
LHF.db = (function () {
  const U = LHF.util;
  let ns = null;                 // artifact db namespace or null
  let backend = 'pending';
  const LS = { bookings: 'lhf.db.bookings', settings: 'lhf.db.settings' };
  const listeners = new Set();

  const ready = (async () => {
    // Local preview: external artifact stores are deliberately disabled.
    backend = ns ? 'artifact' : 'local';
    LHF.store.set('dbBackend', backend);
    return backend;
  })();

  /* ---------- local backend helpers ---------- */
  const lsAll = () => { const a = U.storage.get(LS.bookings, []); return Array.isArray(a) ? a : []; };
  const lsSave = (arr) => U.storage.set(LS.bookings, arr);
  function lsNotify() { const all = lsAll(); listeners.forEach((fn) => fn(all)); }

  /* What this phone keeps of an order it sent: enough to show the receipt again. */
  const KEEP_MS = 30 * 864e5;
  const receiptId = value => typeof value==='string' && /^[a-z0-9][a-z0-9_.-]{0,120}$/i.test(value) ? value : null;
  const receiptVersion = value => Number.isSafeInteger(value)&&value>=0 ? value : receiptId(value);
  function designReceipt(c) {
    if(!c)return null;
    const config = c.config && typeof c.config==='object' ? Object.fromEntries(
      ['style','container','finish','palette','ribbon','size','sourceProduct','recipe','version','promptVersion','modelVersion'].flatMap(key=>{const value=c.config[key],safe=/Version$|^version$/.test(key)?receiptVersion(value):receiptId(value);return safe!==null?[[key,safe]]:[]})
    ) : null;
    if(config){config.flowers=(Array.isArray(c.config.flowers)?c.config.flowers:[]).map(receiptId).filter(Boolean).slice(0,3);config.unchanged=c.config.unchanged===true;}
    const source = c.preview?.asset;
    const safePublicAsset = source && ['actual','concept','composition','representative'].includes(source.kind) && typeof source.url==='string' && /^\/img\/[a-z0-9_./-]+$/i.test(source.url) && !source.url.includes('..');
    const asset = safePublicAsset ? {id:receiptId(source.id),version:receiptVersion(source.version),url:source.url,kind:source.kind,label:source.kind==='actual'?'Actual shop product':source.kind==='concept'?'AI concept based on your selections':source.kind==='composition'?'Live composition preview — illustrative':'Representative shop reference'} : null;
    const sourceEstimate=c.estimate;
    const estimate = sourceEstimate && typeof sourceEstimate==='object' ? {
      kind:receiptId(sourceEstimate.kind),currency:'THB',confidence:receiptId(sourceEstimate.confidence),
      low:Number.isSafeInteger(sourceEstimate.low)&&sourceEstimate.low>=0?sourceEstimate.low:null,
      high:Number.isSafeInteger(sourceEstimate.high)&&sourceEstimate.high>=0?sourceEstimate.high:null,
      catalogVersion:receiptId(sourceEstimate.catalogVersion),rulesVersion:receiptId(sourceEstimate.rulesVersion),
      expires:/^\d{4}-\d{2}-\d{2}$/.test(sourceEstimate.expires||'')?sourceEstimate.expires:null,
      comparatorIds:(Array.isArray(sourceEstimate.comparatorIds)?sourceEstimate.comparatorIds:[]).map(receiptId).filter(Boolean),deliveryFeeSatang:null
    } : null;
    return {style:receiptId(c.style),occasion:receiptId(c.occasion),budgetTier:receiptId(c.budgetTier),budgetCustom:Number.isFinite(Number(c.budgetCustom))&&Number(c.budgetCustom)>0?Number(c.budgetCustom):'',banknoteValue:Number.isFinite(Number(c.banknoteValue))&&Number(c.banknoteValue)>0?Number(c.banknoteValue):null,fromProduct:receiptId(c.fromProduct),hasReference:!!(c.hasReference||c.reference||c.referenceAssetId),config,estimate,
      previewAssetId:asset?.id||null,previewVersion:asset?.version||null,preview:asset?{status:'ready',key:receiptId(c.preview?.key),asset}:null,
      configHash:receiptId(c.configHash),catalogVersion:receiptId(c.catalogVersion),rulesVersion:receiptId(c.rulesVersion),priceRuleVersion:receiptId(c.priceRuleVersion),snapshotAt:Number.isFinite(Date.parse(c.snapshotAt))?c.snapshotAt:null};
  }
  function receipt(b) {
    return {
      id:b.id,ref:b.ref,type:b.type,date:b.date,windowId:b.windowId,windowLabel:b.windowLabel,fulfil:b.fulfil,
      items:(b.items||[]).map(i=>({productId:i.productId,name:i.name,nameTh:i.nameTh,qty:i.qty,unit:i.unit,line:i.line,kind:i.kind})),
      custom:designReceipt(b.custom),subtotal:b.subtotal,quoteOnly:b.quoteOnly,hasQuote:b.hasQuote,priceFrom:b.priceFrom,
      lang:b.lang,status:b.status,createdAt:b.createdAt
    };
  }

  /* On every visit: drop receipts older than 30 days, strip anything personal an
     older version of the site stored, forget rules an old admin form saved here,
     and take the personal part out of a draft abandoned for more than 36 hours so
     a shared phone never hands the next person someone else's details. */
  function tidyLocal() {
    const now = Date.now();
    const all = lsAll();
    const kept = all.filter((b) => b && b.id && now - (Date.parse(b.createdAt) || 0) < KEEP_MS).map(receipt);
    if (JSON.stringify(kept) !== JSON.stringify(all)) { if (kept.length) lsSave(kept); else U.storage.del(LS.bookings); }
    U.storage.del(LS.settings);
    const d = LHF.store.get('draft');
    if (!d) return;
    const stale = !LHF.store.draftIsFresh();
    const drop = stale ? ['consent', 'customer', 'recipient', 'address', 'card', 'sameAsMe', 'anonymous', 'attempt'] : ['consent'];
    const photo = stale && d.custom;
    if (!drop.some((k) => d[k] != null) && !photo) return;
    const clean = Object.assign({}, d);
    drop.forEach((k) => { delete clean[k]; });
    if (photo) clean.custom = Object.assign({}, d.custom, { reference: null, referenceName: '', referenceAssetId: null, referenceUrl: null, uploadConsent: false, hasReference: false, notes: '', feel: '' });
    LHF.store.set('draft', clean);
  }
  ready.then((b) => { if (b === 'local') { try { tidyLocal(); } catch (e) { console.warn('tidy failed', e); } } });

  /* ---------- settings ---------- */
  async function getSettings() {
    await ready;
    const defaults = LHF.data.bookingDefaults;
    try {
      if (ns) {
        const snap = await ns.doc('settings/booking').get();
        if (snap.exists) return deepMerge(defaults, snap.data());
        return JSON.parse(JSON.stringify(defaults));
      }
    } catch (e) { console.warn('settings read failed', e); }
    /* Off the artifact the rules are the ones in data/settings.js. A form on one
       phone used to save capacity, closed dates and the Sheet address that only
       that phone obeyed, so nothing saved in a browser is read any more. */
    return JSON.parse(JSON.stringify(defaults));
  }
  async function saveSettings(s) {
    await ready;
    const clean = JSON.parse(JSON.stringify(s));
    clean.updatedAt = new Date().toISOString();
    if (ns) { await ns.doc('settings/booking').set(clean); }
    LHF.store.set('settings', clean);
    return clean;
  }
  function deepMerge(a, b) {
    const out = JSON.parse(JSON.stringify(a));
    for (const k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = deepMerge(out[k], b[k]);
      else out[k] = b[k];
    }
    return out;
  }

  /* ---------- bookings ---------- */
  async function bookingsOn(dateISO) {
    await ready;
    if (ns) {
      const q = await ns.collection('bookings').where('date', '==', dateISO).limit(500).get();
      return q.docs.map((d) => d.data()).filter((b) => b.status !== 'cancelled');
    }
    return lsAll().filter((b) => b.date === dateISO && b.status !== 'cancelled');
  }
  async function bookingsBetween(fromISO, toISO) {
    await ready;
    if (ns) {
      const q = await ns.collection('bookings').where('date', '>=', fromISO).where('date', '<=', toISO).limit(1000).get();
      return q.docs.map((d) => d.data()).filter((b) => b.status !== 'cancelled');
    }
    return lsAll().filter((b) => b.date >= fromISO && b.date <= toISO && b.status !== 'cancelled');
  }
  /* day load map for a date range → {date: {orders, custom, windows:{id:n}}} */
  async function loadMap(fromISO, toISO) {
    await ready;
    /* one browser's own orders say nothing about the shop's day: without a shared
       store there is no count to show, and the date rules alone decide */
    if (!ns) return {};
    const rows = await bookingsBetween(fromISO, toISO);
    const map = {};
    rows.forEach((b) => {
      const m = map[b.date] || (map[b.date] = { orders: 0, custom: 0, windows: {} });
      m.orders += 1;
      if (b.type === 'custom') m.custom += 1;
      if (b.windowId) m.windows[b.windowId] = (m.windows[b.windowId] || 0) + 1;
    });
    return map;
  }

  /* Claim-then-write: lease the day's lock, re-check capacity, then create. */
  async function createBooking(booking, checkFn) {
    await ready;
    const id = booking.id || U.uid();
    const doc = Object.assign({}, booking, { id, createdAt: booking.createdAt || new Date().toISOString(), status: booking.status || 'new' });
    if (ns) {
      /* Short lease: the work under it takes milliseconds, and the lease cannot be
         released explicitly, so keep it near the 1 s floor and retry politely. */
      const lock = ns.doc('locks/' + doc.date);
      let lease = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        try { lease = await lock.acquire({ holder: id, ttlMs: 1500 }); } catch (e) { lease = null; break; }
        if (!lease || lease.acquired !== false) break;
        const until = lease.expiresAt ? Date.parse(lease.expiresAt) - Date.now() : 400;
        await U.wait(U.clamp(isNaN(until) ? 400 : until + 120, 200, 900));
        lease = null;
      }
      if (lease && lease.acquired === false) throw Object.assign(new Error('busy'), { code: 'slot_busy' });
      const load = await loadMap(doc.date, doc.date);
      if (checkFn) { const err = checkFn(load[doc.date] || { orders: 0, custom: 0, windows: {} }); if (err) throw Object.assign(new Error(err), { code: err }); }
      await ns.doc('bookings/' + id).set(doc);
      return doc;
    }
    /* local: the order has already reached the Sheet; this is the receipt copy,
       checked against the date rules only (this browser cannot see capacity) */
    if (checkFn) { const err = checkFn({ orders: 0, custom: 0, windows: {} }); if (err) throw Object.assign(new Error(err), { code: err }); }
    const all = lsAll().filter((b) => b.id !== id);
    all.push(receipt(doc));
    if (!lsSave(all)) throw Object.assign(new Error('storage'), { code: 'quota_exceeded', doc });
    lsNotify();
    return doc;
  }
  async function updateBooking(id, patch) {
    await ready;
    patch = Object.assign({}, patch, { updatedAt: new Date().toISOString() });
    if (ns) { await ns.doc('bookings/' + id).update(patch); return; }
    const all = lsAll(); const i = all.findIndex((b) => b.id === id);
    if (i > -1) { all[i] = Object.assign({}, all[i], patch); lsSave(all); lsNotify(); }
  }
  async function getBooking(id) {
    await ready;
    if (ns) { const s = await ns.doc('bookings/' + id).get(); return s.exists ? s.data() : null; }
    return lsAll().find((b) => b.id === id) || null;
  }
  async function listBookings(limit) {
    await ready;
    if (ns) { const q = await ns.collection('bookings').orderBy('createdAt', 'desc').limit(limit || 300).get(); return q.docs.map((d) => d.data()); }
    return lsAll().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit || 300);
  }
  /* live subscription for the admin dashboard */
  function subscribeBookings(cb, onError) {
    let unsub = () => {};
    ready.then(() => {
      if (ns) {
        unsub = ns.collection('bookings').orderBy('createdAt', 'desc').limit(300).onSnapshot((q) => cb(q.docs.map((d) => d.data())), (e) => onError && onError(e));
      } else { listeners.add(cb); cb(lsAll()); unsub = () => listeners.delete(cb); }
    });
    return () => unsub();
  }
  async function deleteBooking(id) {
    await ready;
    if (ns) { await ns.doc('bookings/' + id).delete(); return; }
    lsSave(lsAll().filter((b) => b.id !== id)); lsNotify();
  }

  return { ready, get backend() { return backend; }, get sharedCapacity() { return backend === 'artifact'; }, getSettings, saveSettings, bookingsOn, bookingsBetween, loadMap, createBooking, updateBooking, getBooking, listBookings, subscribeBookings, deleteBooking };
})();
