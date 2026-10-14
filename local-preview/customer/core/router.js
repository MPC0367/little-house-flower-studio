/* ---- core/router.js ---- */
/* =====================================================================
   router — hash routes (#/flowers/white-rose). Works inside sandboxed
   iframes (no pushState). Handles title, scroll, focus, transitions.
   ===================================================================== */
LHF.router = (function () {
  const U = LHF.util;
  const routes = [];
  let current = null;         // {path, params, query, route}
  let outlet = null;
  let beforeHooks = [];
  let afterHooks = [];
  const scrollMemory = new Map();

  function add(pattern, handler, opts) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, (m, k) => { keys.push(k); return '([^\\/]+)'; }) + '\\/?$');
    routes.push({ pattern, re, keys, handler, opts: opts || {} });
  }

  /* a hand-typed link with broken %-encoding must not throw: that left the old page on screen */
  const dec = (s) => { try { return decodeURIComponent(s); } catch (e) { return null; } };

  function parse(hash) {
    let raw = (hash || '').replace(/^#/, '');
    if (!raw.startsWith('/')) raw = '/' + raw;
    const [path, qs] = raw.split('?');
    const query = {};
    if (qs) qs.split('&').forEach((p) => { const [k, v] = p.split('='); const dk = dec(k), dv = dec(v || ''); if (dk && dv != null) query[dk] = dv; });
    return { path: path.replace(/\/+$/, '') || '/', query };
  }

  function match(path) {
    for (const r of routes) {
      const m = r.re.exec(path);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => (params[k] = dec(m[i + 1])));
        if (r.keys.some((k) => params[k] == null)) return null;   // unreadable segment: the not-found page
        return { route: r, params };
      }
    }
    return null;
  }

  function href(path, query) {
    let h = '#' + (path.startsWith('/') ? path : '/' + path);
    if (query) { const q = Object.keys(query).filter((k) => query[k] != null && query[k] !== '').map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(query[k])); if (q.length) h += '?' + q.join('&'); }
    return h;
  }

  function navigate(path, query, opts) {
    const target = href(path, query);
    if (location.hash === target) { render(); return; }
    if (opts && opts.replace) { try { location.replace(target); } catch (e) { location.hash = target; } }
    else location.hash = target;
  }

  /* pages register teardown work (subscriptions, timers) for the next navigation */
  let leaving = [];
  function onLeave(fn) { leaving.push(fn); }
  function runLeave() { const fns = leaving; leaving = []; fns.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

  /* Every history entry gets an id the first time it renders. An entry that
     already has one is being revisited with Back or Forward, so its scroll
     position comes back; a fresh entry (a link, a typed URL) starts at the top.
     (popstate cannot tell the two apart: fragment links fire it too.) */
  const entryId = () => { try { return (history.state && history.state.lhf) || ''; } catch (e) { return ''; } };
  function stamp() {
    const id = U.uid();
    try { history.replaceState(Object.assign({}, history.state || {}, { lhf: id }), ''); } catch (e) { return ''; }
    return entryId() === id ? id : '';
  }
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}

  /* An instant jump: html has scroll-behavior: smooth, which would otherwise
     slide the new page up past the reader. */
  function jumpTo(y) {
    const html = document.documentElement, was = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    void getComputedStyle(html).scrollBehavior; /* apply it before the scroll reads it */
    try { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); }
    html.style.scrollBehavior = was;
  }
  /* A full-screen overlay belongs to the page that opened it: leaving the page
     (Back included) closes it, and with it the scroll lock. */
  function closeOverlays() {
    [LHF.viewer && LHF.viewer.close, LHF.ui && LHF.ui.closeSheet, LHF.nav && LHF.nav.closeMenu].forEach((fn) => { try { if (fn) fn(); } catch (e) { console.error(e); } });
  }

  async function render() {
    const { path, query } = parse(location.hash);
    const m = match(path) || match('/404');
    if (!m) return;
    const prev = current;
    /* the same entry drawn again (a language switch): no scroll, no focus move */
    const rerender = !!prev && (prev.entry ? prev.entry === entryId() : prev.hash === location.hash);
    if (!rerender) closeOverlays();
    runLeave();
    if (prev && prev.entry) scrollMemory.set(prev.entry, window.scrollY);
    let entry = entryId();
    const revisit = !!entry && !rerender;
    if (!entry) entry = stamp();
    current = { path, params: m.params, query, route: m.route, hash: location.hash, entry };
    for (const fn of beforeHooks) { try { await fn(current, prev); } catch (e) { console.error(e); } }

    const run = async () => {
      let node;
      try { node = await m.route.handler(m.params, query, current); }
      catch (e) { console.error('route error', e); node = LHF.pages && LHF.pages.error ? LHF.pages.error(e) : U.h('p', 'Something went wrong.'); }
      U.empty(outlet);
      if (node) outlet.appendChild(node);
      outlet.dataset.route = m.route.pattern;
      document.body.dataset.route = (m.route.opts.name || m.route.pattern.replace(/[^a-z]/gi, '') || 'home');
      if (!rerender && !opts_skipScroll(current)) jumpTo(revisit && scrollMemory.has(entry) ? scrollMemory.get(entry) : 0);
      /* focus moves to the new page's heading on navigation only: the first load
         leaves it at the top of the document, so the skip link is the first Tab */
      const focusTarget = outlet.querySelector('[data-autofocus]') || outlet.querySelector('h1');
      if (focusTarget && prev && !rerender) { focusTarget.setAttribute('tabindex', '-1'); focusTarget.focus({ preventScroll: true }); }
      if (m.route.opts.title) document.title = (typeof m.route.opts.title === 'function' ? m.route.opts.title(m.params) : m.route.opts.title) + ' — ' + LHF.data.shop.name;
      for (const fn of afterHooks) { try { fn(current, prev); } catch (e) { console.error(e); } }
    };
    if (LHF.transition && prev && !U.reducedMotion() && !(m.route.opts.noTransition)) await LHF.transition.run(run, current, prev);
    else await run();
  }
  const opts_skipScroll = (cur) => cur.route.opts.keepScroll === true;

  function start(outletEl) {
    outlet = outletEl;
    window.addEventListener('hashchange', render);
    render();
  }

  return { add, navigate, href, render, start, parse, onLeave, get current() { return current; }, before: (fn) => beforeHooks.push(fn), after: (fn) => afterHooks.push(fn) };
})();

