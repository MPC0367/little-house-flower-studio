/* ---- pages/visit.js ---- */
/* =====================================================================
   CONTACT / VISIT — every verified channel; zone + official map link
   ===================================================================== */
LHF.pages.visit = function () {
  const U = LHF.util, h = U.h, t = (k, p) => LHF.i18n.t(k, p), ui = LHF.ui, R = LHF.router, S = LHF.data.shop;
  const phone = LHF.i18n.lang === 'en' ? S.phoneIntl : S.phoneDisplay;
  const row = (k, v) => h('div.contact-row', h('dt', k), h('dd', v));
  const page = h('div.page.page-enter', h('div.wrap.section-tight',
    ui.head({ eyebrow: t('nav.visit'), title: t('visit.title'), sub: t('visit.sub'), level: 'h1', titleClass: 'h1' }),
    h('div.contact-grid',
      h('div.stack-lg',
        h('dl.contact-list',
          row(t('visit.hours'), h('div', t('visit.hoursVal'), ' ', h('span', { style: { marginLeft: '6px' } }, ui.openBadge()))),
          row(t('visit.line'), h('a', { href: S.lineUrl, target: '_blank', rel: 'noopener' }, S.lineId)),
          row(t('visit.phone'), h('a.num', { href: 'tel:' + S.phoneTel }, phone)),
          row(t('visit.email'), h('a', { href: 'mailto:' + S.email }, S.email)),
          row(t('visit.zone'), h('div', h('address', LHF.i18n.pick(S.address)), h('div', h('a', { href: S.mapsUrl, target: '_blank', rel: 'noopener' }, t('visit.map'))))),
          row(t('visit.pickup'), t('visit.pickupVal')),
          row(t('visit.delivery'), t('visit.deliveryVal')),
          row(t('visit.social'), h('div.socials', LHF.nav.social('ig'), LHF.nav.social('fb'), LHF.nav.social('line')))),
        h('div.notice.rose', ui.icon('phone', 18), h('span', t('visit.urgent'))),
        h('div.contact-actions', ui.btn('LINE ' + S.lineId, { className: 'btn-primary', href: S.lineUrl, target: '_blank', icon: 'line' }), ui.btn(phone, { href: 'tel:' + S.phoneTel, icon: 'phone' }), ui.btn(t('nav.reserve'), { href: R.href('/order'), icon: 'heart' }), ui.btn(t('visit.map'), { href: S.mapsUrl, target: '_blank', icon: 'map' })),
        h('section', ui.head({ title: t('terms.title'), sub: t('terms.sub'), titleClass: 'h3' }),
          h('dl.contact-list', row(t('terms.pay'), t('terms.payVal')), row(t('terms.fee'), t('terms.feeVal')), row(t('terms.change'), t('terms.changeVal')), row(t('terms.season'), t('terms.seasonVal'))))),
      mapFigure())));
  return page;

  /* The shop's own pin (its Google Business Profile) on OpenStreetMap. Leaflet and the
     tiles load only when the card comes into view; until the first tiles arrive — and for
     good if either is blocked — the drawn card stays on top, linking to Google Maps. On
     touch screens one finger keeps scrolling the page: a first tap unlocks dragging. */
  function mapFigure() {
    const fallback = h('a.map-card', { href: S.mapsUrl, target: '_blank', rel: 'noopener', 'aria-label': t('visit.map') }, h('div.rings'), h('div.stack', { style: { position: 'relative' } }, ui.icon('map', 44), h('div.zone', t('visit.mapZone')), h('div.small', t('strip.zone')), h('div.tlink', t('home.dist.map'), ui.icon('arrow', 16))));
    const box = h('div.osm-box', fallback);
    const fig = h('figure.osm-card', box, h('figcaption.osm-cap', h('span', t('strip.zone')), h('a.tlink', { href: S.mapsUrl, target: '_blank', rel: 'noopener' }, t('home.dist.map'), ui.icon('arrow', 16))));
    let map = null, io = null;
    const begin = () => {
      if (io) { io.disconnect(); io = null; }
      LHF.osm.load().then((L) => { if (fig.isConnected && !map) map = draw(L); }).catch(() => {});
    };
    if ('IntersectionObserver' in window) { io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) begin(); }, { rootMargin: '300px' }); io.observe(fig); }
    else begin();
    R.onLeave(() => { if (io) io.disconnect(); if (map) { map.remove(); map = null; } });
    return fig;

    function draw(L) {
      const touch = window.matchMedia('(pointer: coarse)').matches;
      const still = U.reducedMotion();
      const el = h('div.osm-map', { role: 'region', 'aria-label': t('visit.mapLabel') });
      box.appendChild(el);
      const m = L.map(el, { center: S.geo, zoom: 16, minZoom: 11, maxZoom: 19, scrollWheelZoom: false, dragging: !touch, zoomAnimation: !still, fadeAnimation: !still, markerZoomAnimation: !still, attributionControl: false });
      L.control.attribution({ prefix: false }).addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>').addTo(m);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m).once('load', () => { fallback.remove(); fig.classList.add('is-live'); });
      const pin = L.divIcon({ className: 'osm-pin', html: '<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><path d="M12 22s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="10" r="2.6"/></svg>', iconSize: [40, 40], iconAnchor: [20, 38], tooltipAnchor: [0, -34] });
      L.marker(S.geo, { icon: pin, title: S.name, alt: S.name, keyboard: true }).addTo(m)
        .bindTooltip(S.name, { permanent: true, direction: 'top', className: 'osm-label' })
        .on('click', () => window.open(S.mapsUrl, '_blank', 'noopener'));
      /* the page scrolls past the map until someone means to use it */
      m.once('click focus', () => m.scrollWheelZoom.enable());
      if (touch) {
        const hint = h('div.osm-hint', t('visit.mapHint'));
        box.appendChild(hint);
        m.once('click', () => { m.dragging.enable(); hint.remove(); });
      }
      return m;
    }
  }
};

/* Leaflet from cdnjs, pinned and integrity-checked, loaded once and only by a page that
   draws a map. Resolves with window.L; rejects if the CDN is blocked (the caller keeps
   its drawn fallback). */
LHF.osm = (function () {
  const BASE = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  let loading = null;
  function add(tag, attrs) {
    return new Promise((resolve, reject) => {
      const el = Object.assign(document.createElement(tag), attrs, { crossOrigin: 'anonymous' });
      el.onload = resolve; el.onerror = reject;
      document.head.appendChild(el);
    });
  }
  function load() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (!loading) {
      loading = Promise.all([
        add('link', { rel: 'stylesheet', href: BASE + 'leaflet.min.css', integrity: 'sha384-c6Rcwz4e4CITMbu/NBmnNS8yN2sC3cUElMEMfP3vqqKFp7GOYaaBBCqmaWBjmkjb' }),
        add('script', { src: BASE + 'leaflet.min.js', integrity: 'sha384-NElt3Op+9NBMCYaef5HxeJmU4Xeard/Lku8ek6hoPTvYkQPh3zLIrJP7KiRocsxO', async: true }),
      ]).then(() => { if (!window.L) throw new Error('leaflet'); return window.L; })
        .catch((e) => { loading = null; throw e; });
    }
    return loading;
  }
  return { load };
})();
