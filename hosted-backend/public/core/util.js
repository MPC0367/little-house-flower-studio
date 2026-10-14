/* ---- core/util.js ---- */
/* =====================================================================
   LHF core utilities — DOM builder, formatting, dates, small helpers
   ===================================================================== */
window.LHF = window.LHF || {};

LHF.util = (function () {
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

  /* h('div.card#main', {class:'x', onClick, style:{}, data:{}, aria:{}}, ...children) */
  function h(tag, attrs, ...children) {
    if (attrs && (attrs instanceof Node || typeof attrs !== 'object' || Array.isArray(attrs))) {
      children.unshift(attrs);
      attrs = null;
    }
    const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [];
    const el = document.createElement(m[1] || 'div');
    if (m[2]) {
      m[2].split(/(?=[.#])/).forEach((tok) => {
        if (tok[0] === '.') el.classList.add(tok.slice(1));
        else if (tok[0] === '#') el.id = tok.slice(1);
      });
    }
    /* a textarea shows its value property, never a value attribute, and a select
       can only take a value once its options exist: both are set after the children */
    let liveValue;
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        /* ARIA states are the strings "true"/"false", never an empty attribute */
        if (typeof v === 'boolean' && (k.indexOf('aria-') === 0 || k === 'aria-selected')) { el.setAttribute(k, v ? 'true' : 'false'); continue; }
        if (v == null || v === false) continue;
        if (k === 'class' || k === 'className') { String(v).split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c)); }
        else if (k === 'value' && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) { liveValue = String(v); }
        /* CSSStyleDeclaration ignores '--custom' keys on assignment; they need setProperty */
        else if (k === 'style' && typeof v === 'object') { for (const p in v) { if (p.startsWith('--')) { if (v[p] != null) el.style.setProperty(p, String(v[p])); } else el.style[p] = v[p]; } }
        else if (k === 'data' && typeof v === 'object') { for (const d in v) if (v[d] != null) el.dataset[d] = v[d]; }
        else if (k === 'aria' && typeof v === 'object') { for (const a in v) if (v[a] != null) el.setAttribute('aria-' + a, typeof v[a] === 'boolean' ? String(v[a]) : v[a]); }
        else if (k.startsWith('on') && typeof v === 'function') { el.addEventListener(k.slice(2).toLowerCase(), v); }
        else if (k === 'html') { el.innerHTML = v; }
        else if (k === 'ref' && typeof v === 'function') { v(el); }
        else if (v === true) { el.setAttribute(k, ''); }
        else { el.setAttribute(k, v); }
      }
    }
    append(el, children);
    if (liveValue !== undefined) el.value = liveValue;
    return el;
  }
  function append(el, children) {
    for (const c of children) {
      if (c == null || c === false) continue;
      if (Array.isArray(c)) append(el, c);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    }
    return el;
  }
  const frag = (...kids) => append(document.createDocumentFragment(), kids);
  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const empty = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* ---- ids / random ---- */
  const B32 = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  function rnd(n) {
    let s = '';
    const a = new Uint8Array(n);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.floor(Math.random() * 256)));
    for (let i = 0; i < n; i++) s += B32[a[i] % B32.length];
    return s;
  }
  const uid = () => Date.now().toString(36) + rnd(6).toLowerCase();

  /* ---- dates (local time, ISO yyyy-mm-dd) ---- */
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayISO = () => iso(new Date());
  const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
  const cmpISO = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const dow = (s) => parseISO(s).getDay();

  /* ---- numbers ---- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmtNumber = (n) => Number(n).toLocaleString('en-US');

  /* ---- timing ---- */
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const throttle = (fn, ms) => { let last = 0, t; return (...a) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...a); } else { clearTimeout(t); t = setTimeout(() => { last = Date.now(); fn(...a); }, ms - (now - last)); } }; };
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---- environment ---- */
  const mqReduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {} };
  const reducedMotion = () => mqReduced.matches;
  const isTouch = () => window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;

  /* ---- storage (always guarded) ---- */
  const storage = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  /* ---- phone helpers (Thai mobile) ---- */
  const normalizePhone = (s) => String(s || '').replace(/[^\d+]/g, '').replace(/^\+66/, '0');
  const isThaiMobile = (s) => /^0[689]\d{8}$/.test(normalizePhone(s));
  const fmtPhone = (s) => { const n = normalizePhone(s); return n.length === 10 ? n.slice(0, 3) + ' ' + n.slice(3, 6) + ' ' + n.slice(6) : s; };

  /* ---- intersection helper ---- */
  function onVisible(el, cb, opts) {
    if (!('IntersectionObserver' in window)) { cb(el); return () => {}; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { cb(e.target, e); if (!(opts && opts.repeat)) io.unobserve(e.target); } });
    }, Object.assign({ rootMargin: '0px 0px -8% 0px', threshold: 0.12 }, opts || {}));
    io.observe(el);
    return () => io.disconnect();
  }

  /* ---- focus trap ---- */
  function trapFocus(container) {
    const sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    function onKey(e) {
      if (e.key !== 'Tab') return;
      const f = qsa(sel, container).filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    container.addEventListener('keydown', onKey);
    return () => container.removeEventListener('keydown', onKey);
  }

  return { esc, h, frag, append, qs, qsa, empty, rnd, uid, iso, parseISO, todayISO, addDays, cmpISO, dow, pad, clamp, lerp, fmtNumber, debounce, throttle, nextFrame, wait, reducedMotion, mqReduced, isTouch, storage, normalizePhone, isThaiMobile, fmtPhone, onVisible, trapFocus };
})();
