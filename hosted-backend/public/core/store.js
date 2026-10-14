/* ---- core/store.js ---- */
/* =====================================================================
   store — tiny observable state with selective persistence.
   Persisted: order draft (never payment data), language, ui prefs.
   ===================================================================== */
LHF.store = (function () {
  const U = LHF.util;
  const PERSIST = { draft: 'lhf.draft.v1', ui: 'lhf.ui.v1' };
  const state = {
    draft: U.storage.get(PERSIST.draft, null),   // in-progress order (restored on refresh)
    ui: U.storage.get(PERSIST.ui, { seenLoader: false }),
    settings: null,                                 // booking settings from db (admin-editable)
    dbBackend: 'pending',                           // 'artifact' | 'local'
    lastOrder: null,                                // last confirmed order (for confirmation page)
  };
  const subs = new Map();

  function get(key) { return key ? state[key] : state; }
  function set(key, value) {
    state[key] = value;
    if (PERSIST[key]) { if (value == null) U.storage.del(PERSIST[key]); else U.storage.set(PERSIST[key], value); }
    (subs.get(key) || []).forEach((fn) => { try { fn(value); } catch (e) { console.error(e); } });
    (subs.get('*') || []).forEach((fn) => { try { fn(key, value); } catch (e) { console.error(e); } });
  }
  function update(key, patch) { set(key, Object.assign({}, state[key] || {}, patch)); }
  function subscribe(key, fn) {
    if (!subs.has(key)) subs.set(key, []);
    subs.get(key).push(fn);
    return () => { const a = subs.get(key); const i = a.indexOf(fn); if (i > -1) a.splice(i, 1); };
  }

  /* draft helpers — the order draft survives refresh and language change */
  function draft() { return state.draft || {}; }
  function setDraft(patch) { update('draft', Object.assign({ updatedAt: Date.now() }, patch)); }
  function clearDraft() { set('draft', null); }
  function draftIsFresh() { const d = state.draft; return d && d.updatedAt && Date.now() - d.updatedAt < 1000 * 60 * 60 * 36; }

  return { get, set, update, subscribe, draft, setDraft, clearDraft, draftIsFresh };
})();
