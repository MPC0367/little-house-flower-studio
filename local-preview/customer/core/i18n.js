/* ---- core/i18n.js ---- */
/* =====================================================================
   i18n — TH / EN. Strings live in data/strings.js as {key: {th, en}}.
   Language switching never touches order state (see store.js).
   ===================================================================== */
LHF.i18n = (function () {
  const U = LHF.util;
  const listeners = new Set();
  const state = { lang: 'th' };
  const SUPPORTED = ['th', 'en'];

  /* ?lang=th|en, before the hash (?lang=en#/flowers) or inside it (#/flowers?lang=en) */
  const LANG_RE = /[?&]lang=(th|en)(?=&|#|$)/;
  function urlLang() {
    const q = location.hash.indexOf('?');
    const m = LANG_RE.exec(location.search) || (q > -1 ? LANG_RE.exec(location.hash.slice(q)) : null);
    return m ? m[1] : null;
  }
  /* Thai is the shop's language and the default for every first visit, whatever the
     phone is set to (many Thai customers, and search engines, run English settings).
     A language in the URL wins and is remembered like a tap on the toggle. */
  function detect() {
    const fromUrl = urlLang();
    if (fromUrl) { U.storage.set('lhf.lang', fromUrl); return fromUrl; }
    const saved = U.storage.get('lhf.lang');
    return SUPPORTED.includes(saved) ? saved : 'th';
  }

  function t(key, params) {
    const dict = LHF.data && LHF.data.strings ? LHF.data.strings : {};
    const entry = dict[key];
    let s = entry ? (entry[state.lang] != null ? entry[state.lang] : entry.en != null ? entry.en : key) : key;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
    return s;
  }
  /* pick({th, en}) → localized value; strings pass through */
  function pick(obj) {
    if (obj == null) return '';
    if (typeof obj !== 'object') return obj;
    return obj[state.lang] != null ? obj[state.lang] : obj.en != null ? obj.en : obj.th != null ? obj.th : '';
  }

  const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const TH_DAYS_MIN = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const EN_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const EN_DAYS_MIN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  /* fmtDate('2026-09-05', 'long'|'short'|'weekday', lang?) — Thai shows Buddhist year */
  function fmtDate(isoStr, style, lang) {
    if (!isoStr) return '';
    const d = U.parseISO(isoStr);
    const th = (lang || state.lang) === 'th';
    const y = th ? d.getFullYear() + 543 : d.getFullYear();
    const M = th ? TH_MONTHS : EN_MONTHS, Ms = th ? TH_MONTHS_SHORT : EN_MONTHS_SHORT, D = th ? TH_DAYS : EN_DAYS;
    if (style === 'short') return th ? d.getDate() + ' ' + Ms[d.getMonth()] + ' ' + String(y).slice(-2) : Ms[d.getMonth()] + ' ' + d.getDate() + ', ' + y;
    if (style === 'weekday') return th ? 'วัน' + D[d.getDay()] + 'ที่ ' + d.getDate() + ' ' + M[d.getMonth()] + ' ' + y : D[d.getDay()] + ', ' + d.getDate() + ' ' + M[d.getMonth()] + ' ' + y;
    return th ? d.getDate() + ' ' + M[d.getMonth()] + ' ' + y : d.getDate() + ' ' + M[d.getMonth()] + ' ' + y;
  }
  const monthName = (m, short) => (state.lang === 'th' ? (short ? TH_MONTHS_SHORT : TH_MONTHS) : (short ? EN_MONTHS_SHORT : EN_MONTHS))[m];
  const dayMin = (i) => (state.lang === 'th' ? TH_DAYS_MIN : EN_DAYS_MIN)[i];
  const yearLabel = (y) => (state.lang === 'th' ? y + 543 : y);

  /* prices: the shop writes "1,090.-" in Thai posts; English gets ฿ */
  function fmtPrice(n, opts) {
    if (n == null || isNaN(n)) return '';
    const s = U.fmtNumber(Math.round(n));
    if (state.lang === 'th') return s + '.-';
    return '฿' + s;
  }
  const fmtFrom = (n) => t('price.from', { price: fmtPrice(n) });
  /* a price range written once: "590–1,290.-" in Thai, "฿590–1,290" in English */
  const fmtRange = (a, b) => (state.lang === 'th' ? U.fmtNumber(a) + '–' + fmtPrice(b) : fmtPrice(a) + '–' + U.fmtNumber(b));

  /* The shop's clock. Opening hours, "today" and price validity are read on Bangkok
     time whatever zone the visitor's device is in. Bangkok has no daylight saving, so
     the fallback for engines without Intl time zones is a fixed UTC+7. */
  let bkk = null;
  try { bkk = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch (e) { bkk = null; }
  function shopNow(date) {
    const d = date || new Date();
    if (!bkk) { const b = new Date(d.getTime() + 7 * 3600000); return { iso: b.toISOString().slice(0, 10), hour: b.getUTCHours() + b.getUTCMinutes() / 60 }; }
    const p = {};
    bkk.formatToParts(d).forEach((x) => { p[x.type] = x.value; });
    return { iso: p.year + '-' + p.month + '-' + p.day, hour: (Number(p.hour) % 24) + Number(p.minute) / 60 };
  }

  function setLang(lang, opts) {
    if (!SUPPORTED.includes(lang) || lang === state.lang) return;
    state.lang = lang;
    U.storage.set('lhf.lang', lang);
    document.documentElement.lang = lang;
    /* a ?lang= in the address would undo the toggle on reload, so it follows the toggle */
    if (LANG_RE.test(location.href)) { try { history.replaceState(history.state, '', location.href.replace(/([?&]lang=)(th|en)/g, '$1' + lang)); } catch (e) {} }
    listeners.forEach((fn) => { try { fn(lang, opts || {}); } catch (e) { console.error(e); } });
  }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function init() {
    state.lang = detect();
    document.documentElement.lang = state.lang;
  }

  return { t, pick, fmtDate, fmtPrice, fmtFrom, fmtRange, shopNow, monthName, dayMin, yearLabel, setLang, onChange, init, get lang() { return state.lang; }, SUPPORTED };
})();

