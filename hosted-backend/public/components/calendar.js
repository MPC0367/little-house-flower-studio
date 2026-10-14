/* ---- components/calendar.js ---- */
/* =====================================================================
   calendar — accessible month grid driven by the booking engine
   ===================================================================== */
LHF.calendar = (function () {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, E = LHF.engine;
  let seq = 0;

  /* opts: {settings, loadMap, value, type, leadDays, onSelect, onBlocked, monthsAhead, showLoad}
     showLoad: only when the day counts cover everyone's orders (a shared store);
     one browser's own orders say nothing about how full the shop's day is. */
  function create(opts) {
    const c = E.ctx(opts.settings);
    const today = U.parseISO(c.today);
    const monthsAhead = opts.monthsAhead || 3;
    const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const maxMonth = new Date(today.getFullYear(), today.getMonth() + monthsAhead, 1);
    /* open on the chosen day, else on the month of the first day that can be
       booked (late on the 31st that is already next month) */
    let open = U.parseISO(opts.value || E.earliestDate(c, { leadDays: opts.leadDays }));
    if (open < minMonth) open = minMonth;
    if (open > new Date(maxMonth.getFullYear(), maxMonth.getMonth() + 1, 0)) open = maxMonth;
    let year = open.getFullYear(), month = open.getMonth();
    let selected = opts.value || null;
    const titleId = 'cal-title-' + (++seq);
    const root = h('div.cal', { role: 'group', 'aria-label': t('book.when.title') });
    /* built once: the live region then announces each month change, and focus
       on a month button survives paging */
    const title = h('div.cal-title', { id: titleId, 'aria-live': 'polite' });
    const prev = h('button', { type: 'button', 'aria-label': t('cal.prevMonth'), onClick: () => page(-1, prev) }, ui.icon('chevL'));
    const next = h('button', { type: 'button', 'aria-label': t('cal.nextMonth'), onClick: () => page(1, next) }, ui.icon('chevR'));
    root.appendChild(h('div.cal-head', title, h('div.cal-nav', prev, next)));
    let grid = h('div'), legend = h('div');
    root.append(grid, legend);

    function page(delta, btn) {
      const d = new Date(year, month + delta, 1);
      if (d < minMonth || d > maxMonth) return;
      year = d.getFullYear(); month = d.getMonth();
      render();
      /* a month button that just became disabled cannot hold focus: hand it on */
      const to = !btn.disabled ? btn : !(btn === prev ? next : prev).disabled ? (btn === prev ? next : prev) : grid.querySelector('[tabindex="0"]');
      if (to) to.focus({ preventScroll: true });
    }
    function moveTo(iso) {
      const d = U.parseISO(iso);
      const m0 = new Date(d.getFullYear(), d.getMonth(), 1);
      if (m0 < minMonth || m0 > maxMonth) return;
      if (d.getFullYear() !== year || d.getMonth() !== month) { year = d.getFullYear(); month = d.getMonth(); render(); }
      focusDay(iso);
    }
    function focusDay(iso) {
      const b = grid.querySelector('[data-iso="' + iso + '"]');
      if (!b) return;
      U.qsa('[data-iso]', grid).forEach((x) => { x.tabIndex = -1; });
      b.tabIndex = 0; b.focus({ preventScroll: true });
    }

    function render() {
      const first = new Date(year, month, 1);
      title.textContent = LHF.i18n.monthName(month) + ' ' + LHF.i18n.yearLabel(year);
      prev.disabled = first <= minMonth;
      next.disabled = first >= maxMonth;
      const g = h('div.cal-grid', { role: 'grid', 'aria-labelledby': titleId });
      const headRow = h('div.cal-row', { role: 'row' });
      for (let i = 0; i < 7; i++) headRow.appendChild(h('div.cal-dow', { role: 'columnheader' }, LHF.i18n.dayMin(i)));
      g.appendChild(headRow);
      const weeks = E.monthMatrix(year, month);
      const cells = [];
      /* exactly one tab stop per render: the selection, else today, else the first open day */
      let tabStop = null;
      weeks.forEach((w) => { const row = h('div.cal-row', { role: 'row' }); g.appendChild(row); w.forEach((cell) => {
        if (!cell.inMonth) { row.appendChild(h('div.cal-day.out', { role: 'gridcell', 'aria-hidden': 'true' }, cell.day)); return; }
        const st = E.dateStatus(cell.iso, c, opts.loadMap ? opts.loadMap[cell.iso] : null, { type: opts.type, leadDays: opts.leadDays });
        const isToday = cell.iso === c.today;
        const low = !!(opts.showLoad && st.ok && st.low);
        const cls = ['cal-day', st.ok ? 'ok' : 'no', isToday ? 'today' : '', low ? 'low' : '', selected === cell.iso ? 'sel' : '', (!st.ok && st.reason === 'today') ? 'urgent' : ''].filter(Boolean).join(' ');
        const why = st.ok ? (low ? t('book.when.low', { n: st.remaining }) : '') : reasonLabel(st);
        const label = LHF.i18n.fmtDate(cell.iso, 'weekday') + (why ? ' — ' + why : '');
        const btn = h('button.' + cls.split(' ').join('.'), { type: 'button', role: 'gridcell', 'aria-label': label, 'aria-selected': selected === cell.iso, 'aria-disabled': !st.ok, 'aria-current': isToday ? 'date' : null, tabindex: -1, 'data-iso': cell.iso, onClick: () => {
          if (!st.ok) { if (opts.onBlocked) opts.onBlocked(cell.iso, st); return; }
          selected = cell.iso; render(); focusDay(cell.iso);
          if (opts.onSelect) opts.onSelect(cell.iso, st);
        } }, cell.day);
        cells.push(btn);
        if (selected === cell.iso) tabStop = btn;
        else if (!tabStop && !selected && isToday && st.ok) tabStop = btn;
        row.appendChild(btn);
      }); });
      /* always six weeks tall, so paging never makes the page jump; the spare
         week is blank and hidden from assistive technology */
      for (let i = weeks.length * 7; i < 42; i++) g.appendChild(h('div.cal-day.out', { 'aria-hidden': 'true' }));
      const stop = tabStop || cells.find((b) => b.classList.contains('ok')) || cells[0];
      if (stop) stop.tabIndex = 0;
      /* arrows and PageUp/PageDown cross into the neighbouring month */
      g.addEventListener('keydown', (e) => {
        const cur = document.activeElement; if (!cur || !cur.dataset.iso) return;
        const iso = cur.dataset.iso;
        const d = U.parseISO(iso);
        let to = null;
        const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
        if (step) to = U.addDays(iso, step);
        else if (e.key === 'PageDown' || e.key === 'PageUp') { const m = new Date(d.getFullYear(), d.getMonth() + (e.key === 'PageDown' ? 1 : -1), 1); to = U.iso(new Date(m.getFullYear(), m.getMonth(), Math.min(d.getDate(), new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()))); }
        else if (e.key === 'Home') to = U.iso(new Date(year, month, 1));
        else if (e.key === 'End') to = U.iso(new Date(year, month + 1, 0));
        if (!to) return;
        e.preventDefault();
        moveTo(to);
      });
      const s = opts.settings || {};
      const lg = h('div.cal-legend',
        h('span', h('i', { style: { background: 'var(--paper)', border: '1px solid var(--line)' } }), t('avail.available')),
        opts.showLoad ? h('span', h('i', { style: { background: 'var(--rose)' } }), t('book.when.low', { n: '≤' + E.lowAt(Number(s.maxOrdersPerDay)) })) : null,
        h('span', h('i', { style: { background: 'var(--heart)' } }), t('cal.selected')));
      grid.replaceWith(g); grid = g;
      legend.replaceWith(lg); legend = lg;
    }
    function reasonLabel(st) {
      if (st.reason === 'full') return t('book.when.full');
      if (st.reason === 'closed') return t('book.when.closed');
      if (st.reason === 'today') return t('ribbon.3');
      if (st.reason === 'cutoff') return t('cal.cutoff', { h: String(((opts.settings || {}).cutoffHour) || 18) + ':00' });
      if (st.reason === 'leadtime') return t('lead.days', { n: opts.leadDays || 1 });
      if (st.reason === 'past') return t('cal.past');
      if (st.reason === 'horizon') return t('cal.horizon');
      return '';
    }
    render();
    return { el: root, get value() { return selected; }, set value(v) { selected = v; render(); }, rerender: render };
  }
  return { create };
})();
