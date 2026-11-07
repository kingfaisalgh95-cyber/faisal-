/* Shaqaf Energy — application core: shell, routing, shared UI helpers.
   Views live in customer.js and engineer.js and register themselves in App.views. */
(function (root) {
  'use strict';
  var C = root.Calc, St = root.Store, S;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n, d) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }); };
  var CAN_PRINT = true;

  var UI = { step: 1, sel: null, tab: 'layout', req: null, v2d: false, msg: '', tool: 'strings' };
  var viewer = null;

  // ---------- i18n ----------
  function t(k, v) {
    var d = root.I18N[S.lang] || root.I18N.ar, s = d[k];
    if (s == null) s = root.I18N.ar[k]; if (s == null) s = k;
    if (v) s = s.replace(/\{(\w+)\}/g, function (m, x) { return v[x] != null ? v[x] : m; });
    return s;
  }
  function cityName(k) { var c = C.CITIES[k] || C.CITIES.riyadh; return c[S.lang] || c.ar; }
  function A() { var a = Object.assign({}, C.DEFAULTS, S.assumptions || {}); return a; }
  function lib() { return S.equipment && S.equipment.length ? S.equipment : C.DEF_EQUIP; }
  function design(p) { return C.design(p, A(), lib()); }
  function persist() { St.save(); }

  // ---------- icons ----------
  var IC = {
    home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>', cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
    folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>', doc: '<path d="M7 3h7l5 5v13H7V3zM14 3v5h5M10 13h6M10 17h6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17.5v.01"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4.5a3.5 3.5 0 010 7M18 15c2.5.5 4 2 4 5"/>',
    tool: '<path d="M14.5 6.5a4 4 0 00-5 5L3 18l3 3 6.5-6.5a4 4 0 005-5l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5z"/>', box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    villa: '<path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-5h4v5"/>', company: '<path d="M4 21V5l8-2v18M12 8h8v13M7 9h2M7 13h2M7 17h2M15 12h2M15 16h2"/>',
    warehouse: '<path d="M3 9l9-5 9 5v11H3V9zM7 20v-6h10v6M7 17h10"/>', factory: '<path d="M3 21V10l6 3V10l6 3V6h3v15H3zM7 17h2M12 17h2"/>',
    grid: '<path d="M12 2v20M5 6h14M7 11h10M9 16h6M12 2L6 22M12 2l6 20"/>', hybrid: '<rect x="3" y="7" width="14" height="10" rx="2"/><path d="M21 10v4M7 12h6M10 9v6"/>', offgrid: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || IC.doc) + '</svg>'; }

  // ---------- small UI helpers ----------
  function tag(k) { return '<span class="tag ' + k + '">' + t('tag.' + k) + '</span>'; }
  function kv(a, b, tg) { return '<div class="kv"><span>' + a + '</span><b>' + b + (tg ? ' ' + tag(tg) : '') + '</b></div>'; }
  function stat(a, b, tg) { return '<div class="stat"><span>' + a + '</span><b>' + b + '</b>' + (tg ? tag(tg) : '') + '</div>'; }
  function money(n) { return fmt(n) + ' ' + t('sar'); }
  function getp(o, path) { return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setp(o, path, v) { var ks = path.split('.'), l = ks.pop(); var c = ks.reduce(function (a, k) { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; return a[k]; }, o); c[l] = v; }
  function inp(path, obj, o) {
    o = o || {}; var v = getp(obj, path);
    return '<input id="f-' + path.replace(/\./g, '-') + '" data-f="' + path + '" type="' + (o.type || 'number') + '"' + (o.type === 'text' || o.type === 'tel' ? '' : ' data-num="1" inputmode="decimal"') +
      (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '') + (o.step ? ' step="' + o.step + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + ' value="' + esc(v == null ? '' : v) + '"' + (o.maxlength ? ' maxlength="' + o.maxlength + '"' : '') + '>';
  }
  function sel(path, obj, opts, o) {
    var v = getp(obj, path); o = o || {};
    return '<select id="f-' + path.replace(/\./g, '-') + '" data-f="' + path + '"' + (o.num ? ' data-num="1"' : '') + '>' + opts.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(x[0]) === String(v) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select>';
  }
  function chk(path, obj, label) { return '<label class="check"><input type="checkbox" id="f-' + path.replace(/\./g, '-') + '" data-f="' + path + '"' + (getp(obj, path) ? ' checked' : '') + '> ' + label + '</label>'; }
  function fld(label, html, hint) { return '<div class="fld"><label>' + label + '</label>' + html + (hint ? '<p class="note">' + hint + '</p>' : '') + '</div>'; }
  function cityOpts() { return Object.keys(C.CITIES).map(function (k) { return [k, cityName(k)]; }); }
  // bind every [data-f] inside root to obj; calls onChange(path) after each edit
  function bindFields(rootEl, obj, onChange) {
    $$('[data-f]', rootEl).forEach(function (el) {
      var h = function () {
        var v = el.type === 'checkbox' ? el.checked : el.value;
        if (el.dataset.num) v = v === '' ? '' : Number(v);
        setp(obj, el.dataset.f, v); persist(); if (onChange) onChange(el.dataset.f, el);
      };
      el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', h);
    });
  }
  function warnList(R) {
    return R.warnings.length ? '<div class="warnbox"><ul>' + R.warnings.map(function (w) { return '<li>' + t('warn.' + w, { fit: R.avail, need: R.need, ratio: R.dcac.toFixed(2) }) + '</li>'; }).join('') + '</ul></div>' : '';
  }
  function errBox(R) { return '<div class="warnbox">' + t('err.' + R.error) + '</div>'; }

  // ---------- 2D roof drawing ----------
  function roofSVG(R, p, o) {
    o = o || {}; var k = 20, w = R.W * k, l = R.L * k, a = A(), pw = R.panel.wid * k, ph = R.fp * k;
    var gridW = R.cols * R.pitchX - a.gap, x0 = (R.W - gridW) / 2, gridH = (R.rows - 1) * R.pitchY + R.fp, y0 = a.margin + ((R.L - 2 * a.margin) - gridH) / 2;
    var s = '<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--mute)" stroke-width="2"/></pattern></defs>';
    s += '<rect x="0" y="0" width="' + w + '" height="' + l + '" rx="4" fill="var(--roof)" stroke="var(--mute)"/>';
    R.slots.forEach(function (sl) {
      var x = (x0 + sl.c * R.pitchX) * k, y = (y0 + sl.r * R.pitchY) * k, cls = sl.st;
      var fill = cls === 'on' ? 'var(--pan)' : cls === 'obs' ? 'url(#hatch)' : 'none', stroke = cls === 'on' ? 'var(--pan)' : 'var(--mute)';
      s += '<rect data-i="' + sl.i + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + pw.toFixed(1) + '" height="' + ph.toFixed(1) + '" fill="' + fill + '" stroke="' + stroke + '"' + (cls === 'on' ? '' : ' stroke-dasharray="3 3"') + (o.edit ? ' style="cursor:pointer"' : '') + '/>';
      if (cls === 'x') s += '<path d="M' + x + ',' + y + 'L' + (x + pw) + ',' + (y + ph) + 'M' + (x + pw) + ',' + y + 'L' + x + ',' + (y + ph) + '" stroke="var(--err)" stroke-width="1.2" pointer-events="none"/>';
    });
    (R.obsRects || []).forEach(function (ob, oi) {
      s += '<g data-obs="' + oi + '"' + (o.edit ? ' style="cursor:pointer"' : '') + '><rect x="' + (ob.x * k) + '" y="' + (ob.y * k) + '" width="' + (ob.w * k) + '" height="' + (ob.h * k) + '" fill="url(#hatch)" stroke="var(--err)" stroke-width="1.5" rx="2"/><text x="' + ((ob.x + ob.w / 2) * k) + '" y="' + ((ob.y + ob.h / 2) * k + 4) + '" text-anchor="middle" font-size="11" fill="var(--err)" pointer-events="none">' + ob.w.toFixed(1) + '×' + ob.h.toFixed(1) + '</text></g>';
    });
    var dim = function (x1, y1, x2, y2, lab, vert) {
      var m = '<path d="M' + x1 + ',' + y1 + 'L' + x2 + ',' + y2 + '" stroke="var(--ink)" stroke-width="1.2" marker-start="url(#da)" marker-end="url(#da)"/>';
      var cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, tw = lab.length * 6.5 + 12;
      return m + '<rect x="' + (cx - tw / 2) + '" y="' + (cy - 9) + '" width="' + tw + '" height="18" rx="9" fill="var(--panel)" stroke="var(--line)"' + (vert ? ' transform="rotate(-90 ' + cx + ' ' + cy + ')"' : '') + '/><text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)"' + (vert ? ' transform="rotate(-90 ' + cx + ' ' + cy + ')"' : '') + '>' + lab + '</text>';
    };
    s += '<defs><marker id="da" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse"><path d="M0,0L6,3L0,6z" fill="var(--ink)"/></marker></defs>';
    s += dim(0, -10, w, -10, R.W.toFixed(1) + ' m', false) + dim(-14, 0, -14, l, R.L.toFixed(1) + ' m', true);
    s += '<g id="ov" pointer-events="none"></g>';
    s += '<g transform="translate(' + (w - 14) + ',22)"><path d="M0,-12 L6,6 L0,2 L-6,6Z" fill="var(--g)"/><text y="20" text-anchor="middle" font-size="11" fill="var(--mute)">N</text></g>';
    // equipment strip: inverter, battery, main DB and the main electrical connections
    var ey = l + 44, bx = function (x, wd, lab, cls) { return '<rect x="' + x + '" y="' + ey + '" width="' + wd + '" height="30" rx="5" class="eq ' + cls + '"/><text x="' + (x + wd / 2) + '" y="' + (ey + 19) + '" text-anchor="middle" font-size="11" fill="#fff">' + lab + '</text>'; };
    var ix = w * 0.08, bxp = w * 0.42, dx = w * 0.76;
    s += '<path d="M' + (w / 2) + ',' + l + 'V' + (l + 22) + 'H' + (ix + 40) + 'V' + ey + '" fill="none" stroke="var(--gold)" stroke-width="2" stroke-dasharray="5 4"/><text x="' + (w / 2 + 6) + '" y="' + (l + 16) + '" font-size="11" fill="var(--mute)">DC</text>';
    s += bx(ix, 80, t('viz.inv') + ' ' + R.invKw + 'kW', 'inv');
    s += '<path d="M' + (ix + 80) + ',' + (ey + 15) + 'H' + dx + '" stroke="var(--g)" stroke-width="2" fill="none"/><text x="' + ((ix + 80 + dx) / 2) + '" y="' + (ey + 11) + '" font-size="11" text-anchor="middle" fill="var(--mute)">AC</text>';
    if (R.bat) s += '<path d="M' + (ix + 80) + ',' + (ey + 25) + 'H' + bxp + '" stroke="var(--blue)" stroke-width="2" fill="none"/>' + bx(bxp, 80, t('viz.bat') + ' ' + R.bat.nominal + 'kWh', 'bat');
    s += bx(dx, 72, t('viz.db'), 'db');
    return '<svg class="roof" viewBox="-30 -26 ' + (w + 52) + ' ' + (l + 108) + '" role="img" aria-label="' + esc(t('viz.alt', { n: R.n, w: R.W, l: R.L })) + '">' + s + '</svg>' +
      '<div class="legend"><span><i class="lg on"></i>' + t('viz.on') + '</span><span><i class="lg free"></i>' + t('viz.free') + '</span><span><i class="lg obs"></i>' + t('viz.obs') + '</span>' + (o.edit ? '<span><i class="lg x"></i>' + t('viz.off') + '</span>' : '') + '</div>';
  }

  // ---------- energy flow diagram ----------
  function flowSVG(arch, grid) {
    var box = function (x, y, w, h, lab, cls) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6" class="fb ' + cls + '"/><text x="' + (x + w / 2) + '" y="' + (y + h / 2 + 4) + '" text-anchor="middle" font-size="12" fill="#fff">' + lab + '</text>'; };
    var ar = function (x1, y1, x2, y2, c) { return '<path d="M' + x1 + ',' + y1 + 'L' + x2 + ',' + y2 + '" stroke="' + (c || 'var(--mute)') + '" stroke-width="2" fill="none" marker-end="url(#ah)"/>'; };
    var s = '<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0L8,4L0,8z" fill="var(--mute)"/></marker></defs>';
    if (arch === 'ac') {
      s += box(10, 20, 90, 34, 'PV', 'pv') + ar(100, 37, 140, 37) + box(140, 20, 110, 34, t('flow.pvinv'), 'inv') + ar(250, 37, 310, 90, 'var(--g)');
      s += box(10, 130, 90, 34, t('flow.batt'), 'bat') + ar(100, 147, 120, 147) + box(120, 130, 60, 34, 'BMS', 'bms') + ar(180, 147, 200, 147) + box(200, 130, 70, 34, 'PCS', 'pcs') + ar(270, 147, 310, 110, 'var(--g)');
    } else {
      s += box(10, 20, 90, 34, 'PV', 'pv') + ar(100, 37, 140, 70) + box(140, 52, 100, 34, t('flow.dcbus'), 'dc');
      s += box(10, 130, 90, 34, t('flow.batt'), 'bat') + ar(100, 147, 120, 147) + box(120, 130, 60, 34, 'BMS', 'bms') + ar(180, 140, 190, 86) + ar(240, 69, 280, 69, 'var(--gold)') + box(280, 52, 100, 34, t('flow.hyb'), 'inv') + ar(380, 69, 430, 69, 'var(--g)');
    }
    var bx = arch === 'ac' ? 310 : 430;
    s += '<rect x="' + bx + '" y="40" width="8" height="90" rx="3" fill="var(--g)"/><text x="' + (bx + 4) + '" y="36" text-anchor="middle" font-size="11" fill="var(--mute)">AC</text>';
    s += ar(bx + 8, 62, bx + 56, 62) + box(bx + 56, 46, 80, 32, t('flow.loads'), 'load');
    if (grid) s += ar(bx + 8, 108, bx + 56, 108) + box(bx + 56, 92, 80, 32, t('flow.grid'), 'gridn');
    var W = bx + 150;
    return '<svg class="flow" viewBox="0 0 ' + W + ' 180" role="img" aria-label="' + esc(t(arch === 'ac' ? 'flow.ac' : 'flow.dc')) + '">' + s + '</svg>';
  }

  // ---------- charts ----------
  function cashChart(R) {
    var d = R.fin.flow, W = 560, H = 200, Lm = 50, B = 24, T = 10, pw = W - Lm - 10, ph = H - T - B, min = Math.min(-R.cost, Math.min.apply(null, d)), max = Math.max(0, Math.max.apply(null, d));
    var x = function (i) { return Lm + i / (d.length - 1) * pw; }, y = function (v) { return T + ph - (v - min) / (max - min || 1) * ph; };
    var path = d.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' '), z = y(0), s = '';
    s += '<line x1="' + Lm + '" x2="' + (W - 10) + '" y1="' + z + '" y2="' + z + '" stroke="var(--mute)" stroke-dasharray="4 4"/><path d="' + path + '" fill="none" stroke="var(--g)" stroke-width="3" stroke-linejoin="round"/>';
    [[max, T + 8], [0, z + 4], [min, H - B]].forEach(function (q) { s += '<text x="' + (Lm - 6) + '" y="' + q[1] + '" text-anchor="end" font-size="11" fill="var(--mute)">' + fmt(q[0] / 1000) + 'k</text>'; });
    [1, 5, 10, 15, 20, 25].forEach(function (yr) { if (yr <= d.length) s += '<text x="' + x(yr - 1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11" fill="var(--mute)">' + yr + '</text>'; });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('fin.chartAlt')) + '">' + s + '</svg>';
  }
  function monthlyChart(R) {
    var W = 560, H = 210, Lm = 46, B = 24, T = 12, pw = W - Lm - 10, ph = H - T - B, vals = R.pro.months, cons = R.monthly, max = Math.max(cons, Math.max.apply(null, vals)) * 1.1;
    var y = function (v) { return T + ph - v / max * ph; }, bw = pw / 12 * 0.6, s = '';
    vals.forEach(function (v, i) { var x = Lm + (i + 0.2) * pw / 12; s += '<rect x="' + x.toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (T + ph - y(v)).toFixed(1) + '" fill="var(--g)" rx="2"/><text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="var(--mute)">' + (i + 1) + '</text>'; });
    s += '<line x1="' + Lm + '" x2="' + (W - 10) + '" y1="' + y(cons) + '" y2="' + y(cons) + '" stroke="var(--gold)" stroke-width="2" stroke-dasharray="6 4"/>';
    s += '<text x="' + (Lm - 6) + '" y="' + (T + 8) + '" text-anchor="end" font-size="11" fill="var(--mute)">' + fmt(max / 1000, 1) + 'k</text><text x="' + (Lm - 6) + '" y="' + (T + ph + 4) + '" text-anchor="end" font-size="11" fill="var(--mute)">0</text>';
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('perf.chartAlt')) + '">' + s + '</svg><div class="legend"><span><i class="lg on" style="background:var(--g)"></i>' + t('perf.prod') + '</span><span><i class="lg" style="border-top:2px dashed var(--gold);height:0"></i>' + t('perf.cons') + '</span></div>';
  }

  // ---------- 2D / 3D viewer (interactive) ----------
  function destroyViewer() { if (viewer) { viewer.destroy(); viewer = null; } }
  function viewerHTML(R, p, o) {
    return '<div class="seg" role="group" aria-label="' + t('viz.mode') + '"><button type="button" data-v="3d" aria-pressed="' + !UI.v2d + '">' + t('viz.3d') + '</button><button type="button" data-v="2d" aria-pressed="' + UI.v2d + '">' + t('viz.2d') + '</button></div>' +
      '<div class="viewer" id="viewer"></div><p class="note" id="vnote"></p>';
  }
  function overlayCard(R) {
    return '<div class="vcard" id="vcardOv"><span>' + t('sum.panels') + '<b>' + R.n + '</b></span><span>' + t('sum.kwp') + '<b>' + R.kwp.toFixed(1) + ' kWp</b></span></div>';
  }
  function compass() { return '<div class="compass" aria-hidden="true"><i>N</i></div>'; }
  function tool2d(o) {
    var T = UI.tool2 || (UI.tool2 = 'toggle');
    var defs = [['toggle', 'cursor', t('tool.toggle')], ['obs', 'obs', t('tool.obs')], ['erase', 'erase', t('tool.erase')], ['measure', 'ruler', t('tool.measure')], ['reset', 'reset', t('tool.reset')]];
    var ic = {
      cursor: '<path d="M5 3l14 8-6 2-3 6z"/>', obs: '<rect x="4" y="6" width="16" height="12" rx="1"/><path d="M4 18L20 6M4 12l8-6M12 18l8-6"/>', erase: '<path d="M4 16l9-9 7 7-5 5H8zM9 21h11"/>',
      ruler: '<path d="M3 15L15 3l6 6L9 21zM8 10l2 2M11 7l2 2M5 13l2 2"/>', reset: '<path d="M4 12a8 8 0 112.5 5.8M4 19v-5h5"/>'
    };
    return '<div class="vtools" role="toolbar" aria-label="' + t('tool.title') + '">' + defs.map(function (d) {
      return '<button type="button" data-tool="' + d[0] + '" aria-pressed="' + (T === d[0]) + '" title="' + d[2] + '" aria-label="' + d[2] + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ic[d[1]] + '</svg></button>';
    }).join('') + '</div>';
  }
  function svgPoint(svg, e) {
    var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    var m = svg.getScreenCTM(); if (!m) return null; var q = pt.matrixTransform(m.inverse()); return { x: q.x / 20, y: q.y / 20 };
  }
  function bind2D(R, p, o, box) {
    var svg = box.querySelector('svg.roof'); if (!svg || !o.edit) return;
    var T = function () { return UI.tool2 || 'toggle'; }, ov = svg.querySelector('#ov'), drag = null, meas = [];
    var snap = function (v) { return Math.round(v * 2) / 2; };
    $$('.vtools button', box).forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.tool;
        if (k === 'reset') { p.disabled = []; p.obs = []; p.manual = false; persist(); o.onEdit && o.onEdit(); return; }
        UI.tool2 = k; meas = []; $$('.vtools button', box).forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.tool === k)); });
        $('#vnote').textContent = t('tool.hint.' + k); svg.style.cursor = k === 'toggle' ? 'pointer' : 'crosshair';
      };
    });
    $('#vnote').textContent = t('tool.hint.' + T());
    svg.addEventListener('pointerdown', function (e) {
      var q = svgPoint(svg, e); if (!q) return;
      var tool = T();
      if (tool === 'toggle') {
        var r = e.target.closest && e.target.closest('rect[data-i]'); if (!r) return;
        var i = +r.dataset.i, d = p.disabled || (p.disabled = []), k = d.indexOf(i); if (k >= 0) d.splice(k, 1); else d.push(i);
        p.manual = true; persist(); o.onEdit && o.onEdit();
      } else if (tool === 'erase') {
        var g = e.target.closest && e.target.closest('g[data-obs]'); if (!g) return;
        (p.obs || []).splice(+g.dataset.obs, 1); persist(); o.onEdit && o.onEdit();
      } else if (tool === 'obs') {
        if (q.x < 0 || q.y < 0 || q.x > R.W || q.y > R.L) return;
        drag = { x: snap(q.x), y: snap(q.y) }; try { svg.setPointerCapture(e.pointerId); } catch (x) {}
      } else if (tool === 'measure') {
        if (meas.length >= 2) meas = [];
        meas.push(q);
        var h = '<circle cx="' + q.x * 20 + '" cy="' + q.y * 20 + '" r="4" fill="var(--gold)"/>';
        if (meas.length === 2) {
          var dm = Math.hypot(meas[1].x - meas[0].x, meas[1].y - meas[0].y);
          h = '<path d="M' + meas[0].x * 20 + ',' + meas[0].y * 20 + 'L' + meas[1].x * 20 + ',' + meas[1].y * 20 + '" stroke="var(--gold)" stroke-width="2.5"/><circle cx="' + meas[0].x * 20 + '" cy="' + meas[0].y * 20 + '" r="4" fill="var(--gold)"/><circle cx="' + meas[1].x * 20 + '" cy="' + meas[1].y * 20 + '" r="4" fill="var(--gold)"/>';
          $('#vnote').textContent = t('tool.dist', { d: dm.toFixed(2) });
        }
        ov.innerHTML = h;
      }
    });
    svg.addEventListener('pointermove', function (e) {
      if (!drag) return; var q = svgPoint(svg, e); if (!q) return;
      var x2 = Math.max(0, Math.min(R.W, snap(q.x))), y2 = Math.max(0, Math.min(R.L, snap(q.y)));
      ov.innerHTML = '<rect x="' + Math.min(drag.x, x2) * 20 + '" y="' + Math.min(drag.y, y2) * 20 + '" width="' + Math.abs(x2 - drag.x) * 20 + '" height="' + Math.abs(y2 - drag.y) * 20 + '" fill="var(--err)" fill-opacity=".25" stroke="var(--err)" stroke-dasharray="4 3"/>';
    });
    svg.addEventListener('pointerup', function (e) {
      if (!drag) return; var q = svgPoint(svg, e), d0 = drag; drag = null; ov.innerHTML = '';
      if (!q) return;
      var x2 = Math.max(0, Math.min(R.W, snap(q.x))), y2 = Math.max(0, Math.min(R.L, snap(q.y)));
      var rc = { x: Math.min(d0.x, x2), y: Math.min(d0.y, y2), w: Math.abs(x2 - d0.x), h: Math.abs(y2 - d0.y) };
      if (rc.w < 0.5 || rc.h < 0.5) return;
      (p.obs || (p.obs = [])).push(rc); persist(); o.onEdit && o.onEdit();
    });
  }
  function showViewer(R, p, o) {
    o = o || {};
    var box = $('#viewer'); if (!box) return;
    $$('.seg button[data-v]').forEach(function (b) { b.setAttribute('aria-pressed', String((b.dataset.v === '2d') === UI.v2d)); });
    if (!UI.v2d && viewer && o.keep) { viewer.update(R); var ovc = $('#vcardOv'); if (ovc) ovc.outerHTML = overlayCard(R); return; }
    destroyViewer(); box.innerHTML = ''; $('#vnote').textContent = '';
    if (UI.v2d) {
      box.innerHTML = (o.edit ? tool2d(o) : '') + roofSVG(R, p, o) + overlayCard(R) + compass();
      bind2D(R, p, o, box);
      if (!o.edit) $('#vnote').textContent = R.limited ? t('viz.limited', { fit: R.avail, need: R.need }) : t('viz.fits', { fit: R.avail, n: R.n });
      else if (R.limited) $('#vnote').textContent = t('viz.limited', { fit: R.avail, need: R.need });
      return;
    }
    var gl = document.createElement('div'); gl.className = 'gl'; gl.setAttribute('aria-label', t('viz.glAlt')); box.appendChild(gl);
    viewer = root.Viewer3D && root.Viewer3D.mount(gl, R);
    if (!viewer) { UI.v2d = true; showViewer(R, p, o); $('#vnote').textContent = t('viz.no3d'); return; }
    var ctl = document.createElement('div'); ctl.className = 'vctl';
    ctl.innerHTML = '<button type="button" data-z="in" aria-label="' + t('viz.zin') + '">+</button><button type="button" data-z="out" aria-label="' + t('viz.zout') + '">−</button><button type="button" data-z="reset" aria-label="' + t('viz.reset') + '">⟲</button>';
    box.appendChild(ctl);
    var pre = document.createElement('div'); pre.className = 'vpre'; pre.setAttribute('role', 'group'); pre.setAttribute('aria-label', t('viz.angle'));
    pre.innerHTML = '<b>' + t('viz.angle') + '</b>' + [['top', t('viz.top')], ['side', t('viz.side')], ['angle', t('viz.persp')]].map(function (a) { return '<button type="button" data-view="' + a[0] + '">' + a[1] + '</button>'; }).join('');
    box.appendChild(pre);
    box.insertAdjacentHTML('beforeend', overlayCard(R) + compass());
    ctl.onclick = function (e) { var z = e.target.dataset.z; if (z === 'in') viewer.zoom(0.85); else if (z === 'out') viewer.zoom(1.18); else if (z === 'reset') viewer.reset(); };
    pre.onclick = function (e) { var v = e.target.dataset.view; if (v) viewer.view(v); };
    var cp = box.querySelector('.compass i'); var tick = function () { if (!viewer) return; var s2 = viewer.state(); cp.style.transform = 'rotate(' + (s2.az * 180 / Math.PI) + 'deg)'; requestAnimationFrame(tick); }; tick();
    $('#vnote').textContent = t('viz.3dnote');
  }
  function bindViewer(R, p, o) { $$('.seg button[data-v]').forEach(function (b) { b.onclick = function () { UI.v2d = b.dataset.v === '2d'; var R2 = design(p); $$('.seg button[data-v]').forEach(function (x) { x.setAttribute('aria-pressed', String((x.dataset.v === '2d') === UI.v2d)); }); if (R2.ok) showViewer(R2, p, o); }; }); if (R && R.ok) showViewer(R, p, o); }

  // ---------- summary column & report ----------
  function summaryHTML(R) {
    if (!R || !R.ok) return '<div class="card"><h3>' + t('sum.title') + '</h3><p class="note">' + t('sum.empty') + '</p></div>';
    return '<div class="card"><h3>' + t('sum.title') + '</h3>' + kv(t('sum.kwp'), R.kwp.toFixed(1) + ' kWp', 'est') + kv(t('sum.panels'), R.n) + kv(t('sum.panel'), esc(R.panel.name)) + kv(t('sum.inv'), esc(R.inv.name) + ' × ' + R.invQty) +
      kv(t('sum.bat'), R.bat ? R.bat.nominal + ' kWh' : t('sum.none')) + '</div>' +
      '<div class="card"><h3>' + t('sum.cost') + '</h3><div class="big">' + money(R.cost) + '</div>' + tag('est') + '<p class="note">' + t('sum.costNote') + '</p></div>' +
      '<div class="card"><h3>' + t('sum.save') + '</h3><div class="sumrow"><div><div class="big green">' + money(R.save) + '</div>' + tag('est') + '</div><div class="ring" style="--p:' + Math.min(100, Math.round(R.coverage * 100)) + '" role="img" aria-label="' + Math.round(R.coverage * 100) + '%"><b>' + Math.round(R.coverage * 100) + '%</b></div></div><p class="note">' + t('sum.ring') + '</p></div>' +
      '<div class="card"><h3>' + t('sum.prod') + '</h3><div class="big">' + fmt(R.prod) + ' kWh <small>/ ' + t('yr') + '</small></div>' + tag('est') + '<div class="bar" aria-hidden="true"><i style="width:' + Math.min(100, Math.round(R.coverage * 100)) + '%"></i></div><p class="note">' + t('sum.cover', { c: Math.round(R.coverage * 100) }) + '</p>' +
      '<p class="note">' + t('sum.range', { lo: fmt(R.prodLow), hi: fmt(R.prod) }) + '</p>' +
      flowsHTML(R) +
      kv(t('fin.payback'), paybackText(R)) + kv(t('sum.co2'), R.co2.toFixed(1) + ' ' + t('sum.t')) + '<p class="note">' + t('disclaimer') + '</p></div>';
  }
  // Production, direct use, export and bill saving are four different quantities (never "every kWh saves the tariff").
  function flowsHTML(R) {
    var f = R.flows, alt = R.alt, altTxt = alt.payback == null ? '>' + A().life : alt.payback.toFixed(1);
    return '<div class="flows"><h4>' + t('flow.title') + '</h4>' + kv(t('flow.prod'), fmt(f.production) + ' kWh') + kv(t('flow.direct'), fmt(f.direct) + ' kWh') + kv(t('flow.export'), fmt(f.exported) + ' kWh') + kv(t('flow.grid'), fmt(f.gridAfter) + ' kWh') +
      '<p class="note">' + t('flow.note') + '</p><div class="altbox"><b>' + t('alt.' + alt.mode) + '</b><br>' + t('alt.line', { save: fmt(alt.save), pay: altTxt }) + '</div></div>';
  }
  function paybackText(R) {
    var life = A().life, hi = R.finLow && R.finLow.payback;
    if (R.payback == null) return '>' + life + ' ' + t('yr');
    var a = R.payback.toFixed(1), b = hi != null ? hi.toFixed(1) : null;
    return (b === a ? a : a + (b != null ? ' – ' + b : ' – >' + life)) + ' ' + t('yr');
  }
  function stTag(k) { return '<span class="tag st-' + k + '">' + t('st.' + k) + '</span>'; }
  function srcLinks(ids) {
    var D = C.DATA; return (ids || []).map(function (id) { var s = D.SOURCES[id]; return s ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a> <small>(' + esc(s.kind) + ')</small>' : ''; }).join('<br>');
  }
  // Every number the customer sees is traceable here: value, status (sourced / derived / assumption), source and date.
  function assumptionTable(R) {
    var a = A(), D = C.DATA, city = D.CITY[R.cityKey] || D.CITY.riyadh, pf = R.perf, pp = pf.parts, pct = function (v) { return (v * 100).toFixed(1) + ' %'; };
    var set = D.TARIFF.sets[R.tariffSet] || D.TARIFF.sets.y2027, tc = set.classes[C.CLASS_OF[R.type]], lang = S.lang;
    var eq = function (e) { return e.verified ? ['sourced', [e.source]] : ['assumption', []]; };
    var pe = eq(R.panel), ie = eq(R.inv);
    var rows = [
      [t('as2.irr'), t('season.summer') + ' ' + city.summer + ' · ' + t('season.autumn') + ' ' + city.autumn + ' · ' + t('season.winter') + ' ' + city.winter + ' · ' + t('season.spring') + ' ' + city.spring + ' (' + t('as2.irrUnit', { tilt: city.tiltOpt }) + ')', 'sourced', ['profilesolar', 'kacare'], t('as2.irrNote')],
      [t('as2.temp'), pct(pp.temperature), 'derived', [], t('as2.tempNote', { tc: R.panel.tcPmax, t: a.cellTempAvgC })],
      [t('as2.soil'), pct(pp.soiling), 'assumption', [], ''],
      [t('as2.mis'), pct(pp.mismatchDc) + ' + ' + pct(pp.wiringAc) + ' + ' + pct(pp.availability), 'assumption', [], ''],
      [t('as2.invEff'), pct(pf.invEff), R.inv.effEuro != null ? 'sourced' : 'assumption', R.inv.verified ? [R.inv.source] : [], ''],
      [t('as2.pr'), pct(pf.pr), 'derived', [], t('as2.prNote')],
      [t('as2.yield'), fmt(R.yieldKwh) + ' kWh/kWp · ' + t('as2.range', { lo: fmt(R.prodLow / R.kwp), hi: fmt(R.prod / R.kwp) }), 'derived', [], t('as2.yieldNote', { u: a.uncertaintyPct })],
      [t('as2.tariff'), fmt(tc.rate1 * 100) + ' / ' + (tc.limit >= 1e9 ? '—' : fmt(tc.rate2 * 100)) + ' ' + t('as2.halala') + (tc.limit >= 1e9 ? '' : ' (' + t('as2.tierAt', { k: fmt(tc.limit) }) + ')') + ' — ' + esc(set.label[lang] || set.label.ar), 'sourced', tc.src, D.TARIFF.caveat[lang] || D.TARIFF.caveat.ar],
      [t('as2.vat'), '15 % (' + (a.vatRecoverable[C.CLASS_OF[R.type]] ? t('as2.vatRec') : t('as2.vatNotRec')) + ')', 'sourced', ['slg'], ''],
      [t('as2.export'), a.exportMode === 'net' ? t('as2.exportNet') : t('as2.exportSelf', { c: a.surplusCredit }), 'assumption', ['pvtech', 'sera'], t('as2.exportNote')],
      [t('as2.panel'), esc(R.panel.name) + ' — ' + R.panel.watt + ' W' + (R.panel.eff ? ', ' + R.panel.eff + ' %' : ''), pe[0], pe[1], R.panel.verified ? '' : t('rep.unverified')],
      [t('as2.inv'), esc(R.inv.name) + ' × ' + R.invQty, ie[0], ie[1], R.inv.verified ? '' : t('rep.unverified')],
      [t('as2.degr'), (R.panel.degrYear1 != null ? R.panel.degrYear1 : a.degrYear1) + ' % ' + t('as2.then') + ' ' + (R.panel.degrAnnual != null ? R.panel.degrAnnual : a.degr) + ' % / ' + t('yr'), R.panel.verified ? 'sourced' : 'assumption', R.panel.verified ? [R.panel.source] : [], ''],
      [t('as2.price'), fmt(R.cost / R.kwp) + ' ' + t('sar') + '/kWp', 'assumption', [], D.PRICES.note[lang] || D.PRICES.note.ar],
      [t('as2.fin'), t('as2.finVals', { om: a.om, d: a.disc, e: a.esc, l: a.life, ry: a.replYear, rp: a.replPct }), 'assumption', [], ''],
      [t('as2.load'), t('as2.loadVal'), 'assumption', [], '']
    ];
    return '<div class="aslist">' + rows.map(function (r) {
      return '<div class="asrow"><div class="ashead"><span>' + r[0] + '</span>' + stTag(r[2]) + '</div><div class="asval">' + r[1] + '</div>' +
        (r[4] ? '<div class="asnote">' + r[4] + '</div>' : '') + (r[3] && r[3].length ? '<div class="assrc">' + srcLinks(r[3]) + '</div>' : '') + '</div>';
    }).join('') + '</div><p class="note">' + t('as2.date', { d: D.RETRIEVED }) + ' · ' + t('as2.version', { v: R.dataVersion }) + '</p>';
  }
  function finTable(R) {
    var a = A(), f = R.fin;
    return '<div class="stats">' + stat(t('fin.price'), money(R.cost), 'est') + stat(t('fin.prod'), fmt(R.prod) + ' kWh', 'est') + stat(t('fin.save1'), money(R.save), 'est') + stat(t('fin.payback'), paybackText(R), 'est') + stat(t('fin.lifeGross'), money(f.lifetimeGross), 'est') + stat(t('fin.lifeNet'), money(f.lifetimeNet), 'est') + '</div>' +
      kv(t('fin.npv', { r: a.disc }), money(f.npv), 'est') + kv(t('fin.lcoe'), f.lcoe.toFixed(3) + ' ' + t('sar') + '/kWh', 'est') + cashChart(R) + '<p class="note">' + t('fin.chartNote') + '</p>' +
      '<details class="faq" open><summary>' + t('as2.title') + '</summary>' + assumptionTable(R) + '<p class="note">' + t('fin.formulas') + '</p></details>';
  }
  function compTable(R, withCost) {
    return '<div class="tblwrap"><table><thead><tr><th>' + t('c.item') + '</th><th>' + t('c.spec') + '</th><th>' + t('c.qty') + '</th><th>' + t('c.power') + '</th>' + (withCost ? '<th>' + t('c.cost') + '</th>' : '') + '</tr></thead><tbody>' +
      R.components.map(function (c) { return '<tr><td><b>' + t('comp.' + c.key) + '</b></td><td>' + esc(c.item) + '</td><td>' + c.qty + '</td><td>' + c.power + '</td>' + (withCost ? '<td>' + fmt(c.cost) + '</td>' : '') + '</tr>'; }).join('') +
      (withCost ? '<tr><td colspan="4"><b>' + t('c.total') + '</b></td><td><b>' + fmt(R.cost) + '</b></td></tr>' : '') + '</tbody></table></div>';
  }
  function electricalHTML(R) {
    var e = R.elec, s = R.strings; if (!e) return '<div class="warnbox">' + t('warn.noWindow') + '</div>';
    return '<h4>' + t('el.strings') + ' ' + tag('est') + '</h4>' + kv(t('el.series'), s.series + ' × ' + s.strings + ' ' + t('el.strings1')) + kv(t('el.voc'), fmt(s.vStringOc) + ' V (' + t('el.limit') + ' ' + R.inv.vmax + ' V)') + kv(t('el.mppt'), fmt(s.vStringMp) + ' V (' + R.inv.mpptMin + '–' + R.inv.mpptMax + ' V)') + kv(t('el.cap'), s.strings + ' / ' + s.cap) + kv(t('el.dcac'), R.dcac.toFixed(2)) +
      '<h4>' + t('el.dc') + ' ' + tag('est') + '</h4>' + kv(t('el.cable'), e.dcCable.mm2 + ' mm² (' + t('el.drop') + ' ' + e.dcCable.dropPct.toFixed(2) + '%)') + kv(t('el.fuse'), e.stringFuse + ' A / ' + e.dcVoltRating + ' V DC') +
      '<h4>' + t('el.ac') + ' ' + tag('est') + '</h4>' + kv(t('el.current'), e.Itot.toFixed(1) + ' A (' + (e.acPhase === 3 ? '3-ph 400V' : '1-ph 230V') + ')') + kv(t('el.invBrk'), e.invBreaker + ' A') + kv(t('el.mainBrk'), e.mainBreaker + ' A') + kv(t('el.cable'), e.acCable.mm2 + ' mm² Cu (' + t('el.drop') + ' ' + e.acCable.dropPct.toFixed(2) + '%)') +
      '<p class="note">' + t('el.note') + '</p>';
  }
  function bessHTML(b, grid) {
    return '<div class="stats">' + stat(t('bess.nominal'), fmt(b.nominal, 1) + ' kWh', 'est') + stat(t('bess.usable'), fmt(b.usable, 1) + ' kWh', 'est') + stat(t('bess.backup'), b.backupH.toFixed(1) + ' h', 'est') + '</div>' +
      kv(t('bess.need'), fmt(b.needKwh, 1) + ' kWh') + kv(t('bess.dod'), fmt(b.dod, 0) + ' %') + kv(t('bess.rte'), fmt(b.rte, 0) + ' %') + kv(t('bess.pcs'), b.pcsKw + ' kW') + kv(t('bess.charge'), fmt(b.chargeKw, 1) + ' kW · ' + b.chargeTimeH.toFixed(1) + ' h') + kv(t('bess.crate'), b.cRate.toFixed(2) + ' C') + kv(t('bess.chain'), fmt(b.chain * 100, 0) + ' %') +
      kv(t('bess.bms'), b.units + ' × ' + t('bess.module') + ' + 1 × ' + t('bess.master')) + (b.powerLimited ? '<div class="warnbox">' + t('warn.batPower') + '</div>' : '') +
      '<div class="flowbox">' + flowSVG(b.arch, grid !== false) + '</div><p class="note">' + t(b.arch === 'ac' ? 'bess.acNote' : 'bess.dcNote') + '</p><p class="note">' + t('bess.disc') + '</p>';
  }
  function reportHTML(R, p, tech) {
    var d = new Date().toLocaleDateString(S.lang === 'ar' ? 'ar-SA' : 'en-GB');
    var h = '<div class="rhead"><div><h1>' + t(tech ? 'rep.techTitle' : 'rep.title') + '</h1><div>' + esc(p.name || '-') + ' · ' + t('type.' + R.type) + ' · ' + cityName(R.cityKey) + ' · ' + t('sys.' + R.system) + '</div></div><div class="rbrand"><b>' + t('brand') + '</b><div>' + d + '</div></div></div>';
    h += '<div class="rstatus">' + tag('est') + (p.simulated ? ' ' + tag('sim') : '') + ' ' + (R.equipVerified ? tag('ver') : '<span class="tag usr">' + t('rep.unverified') + '</span>') + '</div>';
    h += '<h2>' + t('rep.summary') + '</h2><div class="rgrid"><div><span>' + t('sum.kwp') + '</span><b>' + R.kwp.toFixed(1) + ' kWp</b></div><div><span>' + t('sum.panels') + '</span><b>' + R.n + '</b></div><div><span>' + t('sum.cost') + '</span><b>' + money(R.cost) + '</b></div><div><span>' + t('fin.prod') + '</span><b>' + fmt(R.prod) + ' kWh</b></div><div><span>' + t('fin.save1') + '</span><b>' + money(R.save) + '</b></div><div><span>' + t('fin.payback') + '</span><b>' + paybackText(R) + '</b></div></div>';
    h += '<h2 id="rep-plan">' + t('rep.layout') + '</h2><div class="rroof">' + roofSVG(R, p, {}) + '</div><h2 id="rep-3d">' + t('rep.3d') + '</h2><div class="r3d" id="r3d"></div>';
    h += '<h2 id="rep-specs">' + t('rep.components') + '</h2>' + compTable(R, true);
    h += '<h2 id="rep-save">' + t('rep.financial') + '</h2>' + finTable(R);
    if (tech) { h += '<h2>' + t('rep.electrical') + '</h2>' + electricalHTML(R); if (R.bat) h += '<h2>' + t('rep.bess') + '</h2>' + bessHTML(R.bat, R.system !== 'offgrid'); }
    h += '<div class="disc">' + t('disclaimer') + '</div>';
    return h;
  }

  // ---------- shell ----------
  var NAV = {
    customer: [['dashboard', 'home'], ['design', 'cube'], ['projects', 'folder'], ['requests', 'list'], ['support', 'help']],
    engineer: [['dashboard', 'home'], ['projects', 'folder'], ['customers', 'users'], ['studio', 'cube'], ['tools', 'tool'], ['equipment', 'box'], ['reports', 'doc'], ['requests', 'list'], ['team', 'users'], ['config', 'cog']]
  };
  var views = { customer: {}, engineer: {} };

  function applyLang() {
    var r = $('#root'); r.dir = S.lang === 'ar' ? 'rtl' : 'ltr'; r.lang = S.lang; r.classList.toggle('role-engineer', S.role === 'engineer');
  }
  function renderShell() {
    applyLang();
    $('#brandName').textContent = t('brand'); $('#slogan').textContent = t('slogan'); $('#tagline').textContent = t('tagline');
    $('#roleSel').innerHTML = [['customer', t('role.customer')], ['engineer', t('role.engineer')]].map(function (r) { return '<option value="' + r[0] + '"' + (S.role === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('');
    $('#roleLab').textContent = t('role.label'); $('#langBtn').textContent = S.lang === 'ar' ? 'EN' : 'عربي'; $('#langBtn').setAttribute('aria-label', t('lang.switch'));
    $('#who').textContent = S.profile.name ? S.profile.name : t('welcome');
    var cust = S.role === 'customer', rs = $('#roleSel'), rl = $('#roleLab'); rs.hidden = cust; rl.hidden = cust;
    var lk = $('#roleLink'); lk.textContent = t(cust ? 'nav.eng' : 'nav.cust'); lk.onclick = function () { S.role = cust ? 'engineer' : 'customer'; persist(); UI.sel = null; UI.step = 1; location.hash = '#dashboard'; route(); };
  }
  function renderNav(cur) {
    $('#links').innerHTML = NAV[S.role].map(function (n) { return '<a href="#' + n[0] + '"' + (n[0] === cur ? ' aria-current="page"' : '') + '>' + icon(n[1]) + t('nav.' + S.role + '.' + n[0]) + '</a>'; }).join('');
  }
  function route() {
    destroyViewer();
    var cur = location.hash.replace('#', '') || 'dashboard', ok = NAV[S.role].some(function (n) { return n[0] === cur; });
    if (!ok && cur !== 'report') cur = 'dashboard';
    renderShell(); renderNav(cur);
    var fn = views[S.role][cur] || views[S.role].dashboard, v = fn();
    $('#view').innerHTML = v.html; $('#body').classList.toggle('nosum', !v.sum);
    $('#sum').innerHTML = v.sum ? (typeof v.sum === 'string' ? v.sum : '') : '';
    document.title = t('brand');
    if (v.bind) v.bind(); window.scrollTo(0, 0);
    var h = $('#view h1, #view h2'); if (h) { /* keep focus order natural */ }
  }
  function go(name) { if (location.hash === '#' + name) route(); else location.hash = '#' + name; }
  function setSummary(R) { $('#sum').innerHTML = summaryHTML(R); }

  // two-step delete button helper
  function armDelete(btn, fn) { btn.onclick = function () { if (!btn.dataset.sure) { btn.dataset.sure = '1'; btn.textContent = t('confirmDelete'); return; } fn(); }; }
  function copyText(txt, done) { try { navigator.clipboard.writeText(txt).then(done, done); } catch (e) { done(); } }

  var App = {
    t: t, esc: esc, fmt: fmt, money: money, A: A, lib: lib, design: design, persist: persist, UI: UI, views: views, icon: icon, tag: tag, kv: kv, stat: stat, paybackText: paybackText, assumptionTable: assumptionTable,
    inp: inp, sel: sel, chk: chk, fld: fld, cityOpts: cityOpts, cityName: cityName, bindFields: bindFields, warnList: warnList, errBox: errBox, roofSVG: roofSVG, flowSVG: flowSVG,
    cashChart: cashChart, monthlyChart: monthlyChart, viewerHTML: viewerHTML, bindViewer: bindViewer, showViewer: showViewer, summaryHTML: summaryHTML, setSummary: setSummary,
    finTable: finTable, compTable: compTable, electricalHTML: electricalHTML, bessHTML: bessHTML, reportHTML: reportHTML, go: go, route: route, armDelete: armDelete, copyText: copyText,
    refresh: function () { S = St.get(); }, getp: getp, setp: setp, $: $, $$: $$, canPrint: function () { return CAN_PRINT; }, S: function () { return S; }
  };
  root.App = App;

  root.addEventListener('DOMContentLoaded', function () {
    S = St.load();
    $('#roleSel').addEventListener('change', function (e) { S.role = e.target.value; persist(); UI.sel = null; UI.step = 1; location.hash = '#dashboard'; route(); });
    $('#langBtn').addEventListener('click', function () { S.lang = S.lang === 'ar' ? 'en' : 'ar'; persist(); route(); });
    root.addEventListener('hashchange', route);
    route();
  });
})(window);
