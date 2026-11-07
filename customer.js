/* Customer workspace views */
(function (root) {
  'use strict';
  var App = root.App, St = root.Store, C = root.Calc, V = App.views.customer;
  var t = App.t, esc = App.esc, fmt = App.fmt, money = App.money, $ = App.$, $$ = App.$$, UI = App.UI;

  function S() { return App.S(); }
  function findProject(id) { return S().projects.filter(function (p) { return p.id === id; })[0]; }
  function projectStats(p) { var R = App.design(p); return R.ok ? R : null; }

  // ----- shared pieces (also used by the engineer workspace) -----
  App.heroArt = function () {
    return '<svg viewBox="0 0 320 170" preserveAspectRatio="xMinYMax meet" aria-hidden="true"><circle cx="262" cy="40" r="20" fill="var(--gold)"/><rect y="138" width="320" height="32" fill="#cdbf9f"/>' +
      '<path d="M40 138V82l62-26 98 26v56z" fill="#ebe6da"/><path d="M40 82l62-26 98 26z" fill="#d9d2c0"/><path d="M62 76l42-18 72 18-6 12-72-18-34 16z" fill="#27406b"/>' +
      '<rect x="62" y="98" width="28" height="22" fill="#4a6178"/><rect x="108" y="98" width="28" height="22" fill="#4a6178"/><rect x="154" y="98" width="28" height="22" fill="#4a6178"/>' +
      '<g fill="#6b4b2c"><rect x="226" y="82" width="5" height="56"/><rect x="278" y="96" width="5" height="42"/></g><g fill="#3f7d4a"><ellipse cx="228" cy="80" rx="26" ry="9"/><ellipse cx="280" cy="94" rx="22" ry="8"/></g></svg>';
  };
  App.stageName = function (k) { return t('stage.' + k); };
  App.tracker = function (rq, detailed) {
    var cur = St.currentStage(rq), done = rq.stages.every(function (s) { return s.status === 'done'; });
    var dots = rq.stages.map(function (s, i) { return '<li class="' + (s.status === 'done' ? 'done' : (i === cur ? 'cur' : '')) + '"><i></i><span>' + App.stageName(s.key) + '</span></li>'; }).join('');
    var st = rq.stages[cur], last = [].concat.apply([], rq.stages.map(function (s) { return s.history; })).slice(-1)[0];
    var h = '<ol class="track" aria-label="' + t('req.progress') + '">' + dots + '</ol><div class="kv"><span>' + t('req.current') + '</span><b>' + (done ? t('req.done') : App.stageName(st.key)) + '</b></div>';
    if (st.owner) h += App.kv(t('req.owner'), esc(st.owner)); if (st.due) h += App.kv(t('req.due'), esc(st.due));
    if (detailed) {
      var notes = st.notes.slice(-3); if (notes.length) h += '<p class="note">' + notes.map(function (n) { return esc(n.text); }).join(' · ') + '</p>';
      var docs = [].concat.apply([], rq.stages.map(function (s) { return s.docs; })); if (docs.length) h += '<p class="note">' + t('req.docs') + ': ' + docs.map(function (d) { return esc(d.name); }).join('، ') + '</p>';
    }
    return h;
  };
  App.projectRow = function (p, eng) {
    var R = projectStats(p);
    return '<div class="item"><div><b>' + esc(p.name || t('proj.untitled')) + '</b> ' + (p.simulated ? App.tag('sim') : '') + '<div class="note">' + t('type.' + p.type) + ' · ' + App.cityName(p.city) + (R ? ' · ' + R.kwp.toFixed(1) + ' kWp · ' + money(R.cost) : '') + (eng && p.customerName ? ' · ' + esc(p.customerName) : '') + '</div></div>' +
      '<div class="acts"><button class="btn small" data-open="' + p.id + '">' + t('open') + '</button><button class="btn small ghost" data-del="' + p.id + '">' + t('delete') + '</button></div></div>';
  };
  App.bindProjectList = function (after) {
    $$('[data-open]').forEach(function (b) { b.onclick = function () { UI.sel = b.dataset.open; after(b.dataset.open); }; });
    $$('[data-del]').forEach(function (b) { App.armDelete(b, function () { var s = S(); s.projects = s.projects.filter(function (p) { return p.id !== b.dataset.del; }); if (UI.sel === b.dataset.del) UI.sel = null; App.persist(); App.route(); }); });
  };
  App.requestForProject = function (p, contact) {
    var s = S(); var rq = St.newRequest(p, contact); s.requests.unshift(rq); p.status = 'requested'; App.persist(); return rq;
  };

  // ----- page 1: marketing landing -----
  V.dashboard = function () {
    var s = S(), h = '<div class="landing">';
    h += '<section class="lhero"><div class="lh-txt"><h1>' + t('hero.h1') + '</h1><p>' + t('hero.sub') + '</p><div class="lh-btns"><a class="btn" href="#design" id="startCta">' + t('site.start') + '</a><a class="btn ghost light" href="#dashboard" data-scroll="how">' + t('hero.how') + '</a></div></div>' +
      '<figure class="lh-img"><img src="assets/hero-building.jpg" width="450" height="280" alt="' + esc(t('hero.cap')) + '"><figcaption>' + t('hero.cap') + '</figcaption></figure></section>';
    h += '<section class="lsec" id="how"><h2>' + t('how.t') + '</h2><ol class="lhow">' + [1, 2, 3].map(function (i) { return '<li><i>' + i + '</i><div><b>' + t('how.' + i) + '</b><p>' + t('how.' + i + 'd') + '</p></div></li>'; }).join('') + '</ol></section>';
    h += '<section class="lsec lfeat" id="features"><div><h2>' + t('feat.t') + '</h2><ul class="lfl">' + [1, 2, 3, 4, 5, 6].map(function (i) { return '<li>' + App.icon(['cube', 'box', 'bolt', 'list', 'doc', 'tool'][i - 1]) + '<span>' + t('feat.' + i) + '</span></li>'; }).join('') + '</ul></div><figure class="lh-img"><img src="assets/roof-aerial.jpg" width="600" height="300" alt="' + esc(t('hero.cap')) + '" loading="lazy"><figcaption>' + t('hero.cap') + '</figcaption></figure></section>';
    h += '<section class="lcta"><h2>' + t('cta.t') + '</h2><a class="btn" href="#design" id="startCta2">' + t('site.start') + '</a></section>';
    h += '<section class="lsec" id="contact"><h2>' + t('contact.t') + '</h2><p>' + t('contact.d') + '</p></section></div>';
    return { html: h, bind: function () {
      $$('#startCta, #startCta2').forEach(function (b) { b.onclick = function () { s.draft = null; App.persist(); }; });
      $$('[data-scroll]').forEach(function (b) { b.onclick = function (e) { e.preventDefault(); var el = $('#' + b.dataset.scroll); if (el) el.scrollIntoView({ behavior: 'smooth' }); }; });
    } };
  };

  // ----- projects -----
  V.projects = function () {
    var s = S();
    var h = '<div class="card"><div class="head"><h3>' + t('nav.customer.projects') + '</h3><div class="acts"><a class="btn small" href="#design" id="newBtn">' + t('proj.new') + '</a><button class="btn small ghost" id="sampleBtn">' + t('proj.sample') + '</button></div></div>' +
      '<p class="note">' + t('proj.local') + '</p>' + (s.projects.length ? '<div class="list">' + s.projects.map(function (p) { return App.projectRow(p); }).join('') + '</div>' : '<div class="empty">' + t('proj.none') + '</div>') + '</div>';
    return { html: h, bind: function () {
      App.bindProjectList(function (id) {  UI.sel = id; App.persist(); App.go('result'); });
      $('#newBtn').onclick = function () { s.draft = null; UI.step = 1; };
      $('#sampleBtn').onclick = function () { s.projects.unshift(St.sampleProject()); App.persist(); App.route(); };
    } };
  };

  // ----- page 2: project information (one page, three groups) -----
  var TYPES7 = ['house', 'villa', 'building', 'company', 'factory', 'warehouse', 'admin', 'other'];
  function round1(x) { return Math.round(x * 10) / 10; }
  function newDraft() {
    var s = S();
    return St.newProject({ customerName: s.profile.name, phone: s.profile.phone, city: '', type: 'villa', kind: 'residential', len: '', wid: '', area: '', cons: '', mode: 'none', kwh: '', bill: '', acRows: [{ type: 'split', units: '', cap: 1.5, capUnit: 'ton' }], acHours: 10, extra: {}, dimsKnown: true, obsAns: 'unsure', shadeAns: 'unsure', obsArea: '', azDev: '', tiltIn: '', sysChoice: 'suggest', batChoice: 'suggest', roofType: 'concrete', tilt: 10 });
  }
  function draft() { var s = S(); if (!s.draft) { s.draft = newDraft(); App.persist(); } return s.draft; }
  // translate the form answers into the fields the engine reads (the engine never sees "unknown" as a number)
  function sync(p) {
    var kwh = Number(p.kwh) || 0, bill = Number(p.bill) || 0, rows = (p.acRows || []).filter(function (r) { return Number(r.units) > 0; });
    if (kwh > 0) { p.mode = 'kwh'; p.cons = kwh; }
    else if (bill > 0) { p.mode = 'bill'; p.cons = bill; }
    else if (rows.length) { p.mode = 'ac'; p.cons = ''; p.ac = { hours: Number(p.acHours) || 10, rows: rows.map(function (r) { var cap = Number(r.cap) || 0; return { units: Number(r.units), tons: r.capUnit === 'btu' ? undefined : (cap || undefined), btu: r.capUnit === 'btu' ? (cap || undefined) : undefined }; }) }; }
    else { p.mode = 'none'; p.cons = ''; }
    if (p.dimsKnown === false) { var ar = Number(p.area) || 0; if (ar >= 9) { var l = Math.sqrt(ar / 1.5); p.len = round1(l); p.wid = round1(1.5 * l); } else { p.len = ''; p.wid = ''; } p.dimsApprox = true; }
    else { p.dimsApprox = false; p.area = (Number(p.len) > 0 && Number(p.wid) > 0) ? Math.round(p.len * p.wid) : ''; }
    p.shade = (p.obsAns === 'yes' || p.shadeAns === 'yes') ? 'some' : (p.obsAns === 'no' && p.shadeAns === 'no') ? 'none' : 'unknown';
    p.obs = p.obsAns === 'yes' ? (p.obsRows || []).map(function (r) { return { x: Number(r.x) || 0, y: Number(r.y) || 0, w: Number(r.w) || 0, h: Number(r.h) || 0 }; }).filter(function (o) { return o.w > 0 && o.h > 0; }) : [];
    p.obstacle = (p.obsAns === 'yes' && !p.obs.length) ? (Number(p.obsArea) || 0) : 0;
    p.tilt = (p.tiltIn === '' || p.tiltIn == null) ? 10 : Number(p.tiltIn);
    p.system = p.sysChoice === 'suggest' ? 'grid' : p.sysChoice; if (!p.battery) p.battery = { hours: 4, criticalKw: 3, arch: 'dc' };
    if (p.system === 'offgrid') p.battery.need = true; else if (p.batChoice === 'yes') { p.battery.need = true; if (p.system === 'grid') p.system = 'hybrid'; } else p.battery.need = false;
    if (C.TYPES[p.type]) p.kind = C.TYPES[p.type].kind;
    return p;
  }
  function completeness(p) {
    var items = [['city', p.city ? 10 : 0], ['geo', p.geo ? 5 : 0], ['type', 5], ['dims', p.dimsApprox ? (Number(p.area) >= 9 ? 10 : 0) : (Number(p.len) >= 3 && Number(p.wid) >= 3 ? 20 : 0)],
      ['cons', (Number(p.kwh) > 0 || Number(p.bill) > 0) ? 25 : (p.mode === 'ac' ? 12 : 0)], ['billfile', p.billName ? 5 : 0], ['ac', (p.acRows || []).some(function (r) { return Number(r.units) > 0; }) ? 5 : 0],
      ['obs', p.obsAns !== 'unsure' ? 7 : 0], ['shade', p.shadeAns !== 'unsure' ? 7 : 0], ['az', p.azDev !== '' && p.azDev != null ? 5 : 0], ['tilt', p.tiltIn !== '' && p.tiltIn != null ? 3 : 0], ['photo', p.photo ? 3 : 0]];
    return items.reduce(function (a, x) { return a + x[1]; }, 0);
  }
  function validate(p) {
    var e = {}, kwh = p.kwh, bill = p.bill;
    if (!p.city) e.city = t('err.city');
    if (p.dimsKnown === false) { if (!(Number(p.area) >= 9 && Number(p.area) <= 20000)) e.area = t('err.dims2'); }
    else { var okL = Number(p.len) >= 3 && Number(p.len) <= 300, okW = Number(p.wid) >= 3 && Number(p.wid) <= 300; if (!okL) e.len = t('err.dims2'); if (!okW) e.wid = t('err.dims2'); }
    if (kwh !== '' && kwh != null && !(Number(kwh) >= 1 && Number(kwh) <= 500000)) e.kwh = t('err.kwh');
    if (bill !== '' && bill != null && !(Number(bill) >= 1 && Number(bill) <= 5000000)) e.bill = t('err.kwh');
    if (p.obsAns === 'yes' && p.dimsKnown !== false) (p.obsRows || []).forEach(function (r) { var w = Number(r.w) || 0, h = Number(r.h) || 0; if (w > 0 && h > 0 && ((Number(r.x) || 0) + w > Number(p.wid) + 0.01 || (Number(r.y) || 0) + h > Number(p.len) + 0.01)) e.obs = t('ob.err'); });
    return e;
  }
  function fe(errs, k) { return errs[k] ? '<p class="fe" role="alert">' + errs[k] + '</p>' : ''; }
  function seg3(path, p, opts) {
    return '<div class="seg3" role="group">' + opts.map(function (o) { return '<button type="button" data-seg="' + path + '" data-val="' + o[0] + '" aria-pressed="' + (String(p[path]) === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  }
  function acRowsHTML(p) {
    return (p.acRows || []).map(function (r, i) {
      return '<div class="acrow card inner"><div class="row">' + App.fld(t('ac.kind'), App.sel('acRows.' + i + '.type', p, [['split', t('ac.split')], ['window', t('ac.window')], ['central', t('ac.central')]])) + App.fld(t('ac.count'), App.inp('acRows.' + i + '.units', p, { min: 1, max: 500 })) + '</div>' +
        '<div class="row">' + App.fld(t('ac.cap'), App.inp('acRows.' + i + '.cap', p, { min: 0.5, max: 600000, step: 0.5 })) + App.fld('&nbsp;', App.sel('acRows.' + i + '.capUnit', p, [['ton', t('ac.ton')], ['btu', t('ac.btu')]])) + '</div>' + ((p.acRows || []).length > 1 ? '<button type="button" class="btn ghost small" data-acdel="' + i + '">' + t('ac.del') + '</button>' : '') + '</div>';
    }).join('');
  }
  function obsRowsHTML(p) {
    return (p.obsRows || []).map(function (r, i) {
      return '<div class="acrow card inner"><b>' + t('ob.n', { n: i + 1 }) + '</b><div class="row">' + App.fld(t('ob.w'), App.inp('obsRows.' + i + '.w', p, { min: 0.1, max: 100, step: 0.1 })) + App.fld(t('ob.h'), App.inp('obsRows.' + i + '.h', p, { min: 0.1, max: 100, step: 0.1 })) + '</div>' +
        '<div class="row">' + App.fld(t('ob.x'), App.inp('obsRows.' + i + '.x', p, { min: 0, max: 300, step: 0.1 })) + App.fld(t('ob.y'), App.inp('obsRows.' + i + '.y', p, { min: 0, max: 300, step: 0.1 })) + '</div>' +
        '<button type="button" class="btn ghost small" data-obdel="' + i + '">' + t('ob.del') + '</button></div>';
    }).join('');
  }
  function formHTML(p, errs) {
    var pct = completeness(p);
    var h = '<div class="formpage"><div class="fhead"><h1>' + t('form.t') + '</h1><p class="note">' + t('form.sub') + '</p></div>';
    // group 1
    h += '<section class="card fgrp"><h3><i>1</i>' + t('g1.t') + '</h3><label>' + t('f.type') + '</label><div class="types seven" role="group" aria-label="' + t('f.type') + '">' + TYPES7.map(function (k) { return '<button type="button" data-type="' + k + '" aria-pressed="' + (p.type === k) + '">' + App.icon(k === 'house' || k === 'villa' || k === 'building' ? 'home' : (k === 'factory' || k === 'warehouse') ? 'box' : 'list') + '<span>' + t('type.' + k) + '</span></button>'; }).join('') + '</div>' +
      App.fld(t('f.pname'), App.inp('name', p, { type: 'text', ph: '' })) +
      '<div class="row">' + App.fld(t('f.city'), App.sel('city', p, [['', t('f.cityPick')]].concat(App.cityOpts())) + fe(errs, 'city')) + App.fld(t('f.roofType'), App.sel('roofType', p, ['concrete', 'metal', 'ground', 'other'].map(function (k) { return [k, t('roof.' + k)]; })), t('roof.note')) + '</div>' +
      '<button class="btn ghost small" type="button" id="geoBtn">' + t('geo.btn') + '</button><p class="note" id="geoMsg" role="status">' + (p.geoMsg || t('geo.note')) + '</p></section>';
    // group 2
    h += '<section class="card fgrp"><h3><i>2</i>' + t('g2.t') + '</h3>' +
      App.fld(t('e.billUp'), '<input type="file" id="billIn" accept="image/*,application/pdf">' + (p.billName ? '<div class="photo">' + (p.billImg ? '<img alt="" src="' + p.billImg + '">' : '') + '<span>' + esc(p.billName) + '</span><button class="btn ghost small" type="button" id="billDel">' + t('photo.remove') + '</button></div>' : ''), t('e.billNote')) +
      '<div class="row">' + App.fld(t('e.kwh'), App.inp('kwh', p, { min: 1 }) + fe(errs, 'kwh')) + App.fld(t('e.bill'), App.inp('bill', p, { min: 1 }) + fe(errs, 'bill')) + '</div><p class="note">' + t('e.both') + '</p>' +
      '<details class="more"' + ((p.acRows || []).some(function (r) { return Number(r.units) > 0; }) || p.extraOpen ? ' open' : '') + '><summary>' + t('e.ac') + ' · ' + t('e.extra') + '</summary><p class="note">' + t('e.acNote') + '</p><div id="acBox">' + acRowsHTML(p) + '</div><button type="button" class="btn ghost small" id="acAdd">' + t('ac.add') + '</button>' +
      App.fld(t('ac.hours2'), App.inp('acHours', p, { min: 1, max: 24 }), t('ac.kindNote')) + '<label>' + t('e.extra') + '</label><div class="checks">' + ['heater', 'pump', 'big', 'other'].map(function (k) { return App.chk('extra.' + k, p, t('extra.' + k)); }).join('') + '</div><p class="note">' + t('extra.note') + '</p></details>' +
      (p.mode === 'none' ? '<p class="note warnline">' + t('e.none') + '</p>' : '') + '</section>';
    // group 3
    h += '<section class="card fgrp"><h3><i>3</i>' + t('g3.t') + '</h3><div class="seg2" role="group"><button type="button" data-dk="1" aria-pressed="' + (p.dimsKnown !== false) + '">' + t('d.known') + '</button><button type="button" data-dk="0" aria-pressed="' + (p.dimsKnown === false) + '">' + t('d.unknown') + '</button></div>';
    if (p.dimsKnown === false) h += App.fld(t('d.areaIn'), App.inp('area', p, { min: 9, max: 20000 }) + fe(errs, 'area'), t('d.approx'));
    else h += '<div class="row">' + App.fld(t('d.len'), App.inp('len', p, { min: 3, max: 300 }) + fe(errs, 'len')) + App.fld(t('d.wid'), App.inp('wid', p, { min: 3, max: 300 }) + fe(errs, 'wid')) + '</div><p class="note">' + t('d.area') + ': <b id="areaT">' + fmt((Number(p.len) || 0) * (Number(p.wid) || 0)) + '</b> m²</p>';
    h += '<details class="more" id="moreD"' + (p.moreOpen || p.obsAns === 'yes' ? ' open' : '') + '><summary>' + t('d.more') + '</summary><label>' + t('d.obs') + '</label>' + seg3('obsAns', p, [['yes', t('yn.yes')], ['no', t('yn.no')], ['unsure', t('yn.unsure')]]) + (p.obsAns === 'yes' ? '<p class="note">' + t('ob.help') + '</p><div id="obBox">' + obsRowsHTML(p) + '</div><button type="button" class="btn ghost small" id="obAdd">' + t('ob.add') + '</button>' + fe(errs, 'obs') + App.fld(t('d.obsArea'), App.inp('obsArea', p, { min: 0, max: 5000 }), t('ob.areaAlt')) : '') +
      '<label>' + t('d.shade') + '</label>' + seg3('shadeAns', p, [['yes', t('yn.yes')], ['no', t('yn.no')], ['unsure', t('yn.unsure')]]) +
      '<div class="row">' + App.fld(t('d.az'), '<select data-f="azDev" data-num="1" id="f-azDev"><option value=""' + (p.azDev === '' || p.azDev == null ? ' selected' : '') + '>' + t('az.unk') + '</option>' + [0, 45, 90, 180].map(function (d) { return '<option value="' + d + '"' + (String(p.azDev) === String(d) ? ' selected' : '') + '>' + t('az.' + d) + '</option>'; }).join('') + '</select>') + App.fld(t('d.tilt'), App.inp('tiltIn', p, { min: 0, max: 35 }), t('f.tiltHint')) + '</div>' +
      App.fld(t('f.photo'), '<input type="file" id="photoIn" accept="image/*">' + (p.photo ? '<div class="photo"><img alt="" src="' + p.photo + '"><button class="btn ghost small" type="button" id="photoDel">' + t('photo.remove') + '</button></div>' : ''), t('f.photoHint')) + '</details></section>';
    // system options
    h += '<section class="card fgrp"><details class="more"><summary><b>' + t('sys.t') + '</b></summary><div class="syslist" role="group">' + [['grid', t('sys.grid2')], ['hybrid', t('sys.hyb2')], ['offgrid', t('sys.off2')], ['suggest', t('sys.sug')]].map(function (o) { return '<button type="button" data-seg="sysChoice" data-val="' + o[0] + '" aria-pressed="' + (p.sysChoice === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' + (p.sysChoice === 'suggest' ? '<p class="note">' + t('sys.sugNote') + '</p>' : '') +
      '<label>' + t('bat.q') + '</label>' + seg3('batChoice', p, [['yes', t('bat.yes')], ['no', t('bat.no')], ['suggest', t('bat.sug')]]) + '</details></section>';
    h += '<div class="genbar" role="region"><div class="gb-p"><b id="pctT">' + pct + '%</b><span>' + t('comp.t') + '</span><div class="bar" aria-hidden="true"><i id="pctBar" style="width:' + pct + '%"></i></div></div><button class="btn" type="button" id="genBtn">' + t('gen.btn') + '</button></div><div class="err" id="err" role="alert"></div></div>';
    return h;
  }
  function saveDraft(p) {
    var s = S(), i = -1; s.projects.forEach(function (x, k) { if (x.id === p.id) i = k; });
    if (!p.name) p.name = t(C.TYPES[p.type] ? 'type.' + p.type : 'proj.untitled') + ' · ' + (p.city ? App.cityName(p.city) : '') + ' · ' + (s.projects.length + 1);
    if (i >= 0) s.projects[i] = JSON.parse(JSON.stringify(p)); else s.projects.unshift(JSON.parse(JSON.stringify(p)));
    App.persist();
  }
  function validPhone(v) { return /^(05\d{8}|\+9665\d{8}|9665\d{8})$/.test(String(v).replace(/[\s-]/g, '')); }
  function geolocate(p, done) {
    if (!navigator.geolocation) return done(t('geo.err'));
    navigator.geolocation.getCurrentPosition(function (pos) {
      var la = pos.coords.latitude, lo = pos.coords.longitude, best = null;
      Object.keys(C.CITIES).forEach(function (k) {
        var c = C.CITIES[k], dLa = (c.lat - la) * Math.PI / 180, dLo = (c.lon - lo) * Math.PI / 180, x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(la * Math.PI / 180) * Math.cos(c.lat * Math.PI / 180) * Math.sin(dLo / 2) * Math.sin(dLo / 2), d = 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
        if (!best || d < best.d) best = { k: k, d: d };
      });
      p.city = best.k; p.geo = { lat: Math.round(la * 1000) / 1000, lon: Math.round(lo * 1000) / 1000 };
      p.geoMsg = t('geo.ok', { c: App.cityName(best.k), d: Math.round(best.d) }) + (best.d > 150 ? ' ' + t('geo.far') : ''); App.persist(); done(p.geoMsg);
    }, function () { done(t('geo.err')); }, { timeout: 10000, maximumAge: 600000 });
  }
  function shrinkPhoto(file, done) {
    var fr = new FileReader();
    fr.onerror = function () { done(null); };
    fr.onload = function () {
      var im = new Image(); im.onerror = function () { done(null); };
      im.onload = function () {
        var k = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); done(c.toDataURL('image/jpeg', 0.6));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  function keepScroll(fn) { var y = window.scrollY; fn(); setTimeout(function () { window.scrollTo(0, y); }, 0); }

  V.design = function () {
    var p = draft(); sync(p); var errs = UI.errs || {}; UI.errs = null;
    return { html: formHTML(p, errs), bind: function () {
      var upd = function () { sync(p); App.persist(); var pc = completeness(p), a = $('#pctT'), b = $('#pctBar'); if (a) a.textContent = pc + '%'; if (b) b.style.width = pc + '%'; var ar = $('#areaT'); if (ar) ar.textContent = fmt((Number(p.len) || 0) * (Number(p.wid) || 0)); };
      App.bindFields($('.formpage'), p, upd);
      $$('[data-type]').forEach(function (b) { b.onclick = function () { p.type = b.dataset.type; upd(); $$('[data-type]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }; });
      $$('[data-seg]').forEach(function (b) { b.onclick = function () { p[b.dataset.seg] = b.dataset.val; upd(); keepScroll(function () { App.route(); }); }; });
      $$('[data-dk]').forEach(function (b) { b.onclick = function () { p.dimsKnown = b.dataset.dk === '1'; upd(); keepScroll(function () { App.route(); }); }; });
      var md = $('#moreD'); if (md) md.addEventListener('toggle', function () { p.moreOpen = md.open; });
      var oa = $('#obAdd'); if (oa) oa.onclick = function () { (p.obsRows = p.obsRows || []).push({ x: '', y: '', w: '', h: '' }); upd(); keepScroll(function () { App.route(); }); };
      $$('[data-obdel]').forEach(function (b) { b.onclick = function () { p.obsRows.splice(+b.dataset.obdel, 1); upd(); keepScroll(function () { App.route(); }); }; });
      var add = $('#acAdd'); if (add) add.onclick = function () { p.acRows.push({ type: 'split', units: '', cap: 1.5, capUnit: 'ton' }); p.extraOpen = true; upd(); keepScroll(function () { App.route(); }); };
      $$('[data-acdel]').forEach(function (b) { b.onclick = function () { p.acRows.splice(+b.dataset.acdel, 1); upd(); keepScroll(function () { App.route(); }); }; });
      var gb = $('#geoBtn'); if (gb) gb.onclick = function () { geolocate(p, function (m) { var g = $('#geoMsg'); if (g) g.textContent = m; var cs = $('#f-city'); if (cs) cs.value = p.city; upd(); }); };
      var bi = $('#billIn'); if (bi) bi.onchange = function () {
        var f = bi.files && bi.files[0]; if (!f) return; if (f.size > 8 * 1024 * 1024) return ($('#err').textContent = t('photo.err'));
        if (/^image\//.test(f.type)) shrinkPhoto(f, function (d) { if (!d) return ($('#err').textContent = t('photo.err')); p.billImg = d; p.billName = f.name; upd(); keepScroll(function () { App.route(); }); }); else { delete p.billImg; p.billName = f.name; upd(); keepScroll(function () { App.route(); }); }
      };
      var bd = $('#billDel'); if (bd) bd.onclick = function () { delete p.billImg; delete p.billName; upd(); keepScroll(function () { App.route(); }); };
      var pin = $('#photoIn'); if (pin) pin.onchange = function () { var f = pin.files && pin.files[0]; if (!f) return; shrinkPhoto(f, function (d) { if (!d) return ($('#err').textContent = t('photo.err')); p.photo = d; upd(); keepScroll(function () { App.route(); }); }); };
      var pd = $('#photoDel'); if (pd) pd.onclick = function () { delete p.photo; upd(); keepScroll(function () { App.route(); }); };
      $('#genBtn').onclick = function () {
        sync(p); var e = validate(p);
        if (Object.keys(e).length) { UI.errs = e; App.route(); setTimeout(function () { var f = $('.fe'); if (f) { f.scrollIntoView({ block: 'center' }); } var er = $('#err'); if (er) er.textContent = t('err.fix'); }, 30); return; }
        var R = App.design(p); if (!R.ok) { $('#err').textContent = t('err.' + R.error); return; }
        saveDraft(p); UI.sel = p.id; UI.dtab = 'comp'; App.go('result');
      };
    } };
  };

  // ----- page 3: the report -----
  function specsTable(R) {
    var rows = [[t('sum.panel'), R.panel.name], [t('c.power'), R.panel.watt + ' W × ' + R.n + ' = ' + R.kwp.toFixed(2) + ' kWp'], [t('sum.inv'), R.inv.name + ' × ' + R.invQty], [t('el.dcac'), R.dcac.toFixed(2)], [t('as.tilt'), R.tilt + '°'], [t('as.spacing'), R.pitchY.toFixed(2) + ' m'], [t('f.area'), fmt(R.W * R.L) + ' m² (' + fmt(R.n * R.panel.wid * R.panel.len) + ' m² ' + t('rp.panelsArea') + ')']];
    return '<div class="tblwrap"><table><tbody>' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td><b>' + esc(String(r[1])) + '</b></td></tr>'; }).join('') + '</tbody></table></div><p class="note">' + t('rep.unverified') + '</p>';
  }
  function accBox(R) {
    var c = R.conf, miss = c.missing.map(function (m) { return t('acc.m.' + m); });
    return '<div class="acc acc-' + c.level + '"><div class="head"><b>' + t('acc.title') + ': ' + t('acc.' + c.level) + '</b><span>' + t('acc.range', { p: c.rangePct }) + '</span></div><div class="bar" aria-hidden="true"><i style="width:' + Math.max(8, 100 - c.rangePct * 2.5) + '%"></i></div>' + (miss.length ? '<p class="note">' + t('acc.improve') + ' ' + miss.join('، ') + '</p>' : '') + '</div>';
  }
  function A_life() { return App.A().life; }
  function sizeOptions(R, p) {
    if (!R.sizing || !R.sizing.rows.length) return '';
    var best = R.sizing.best;
    return '<div class="card"><h3>' + t('res.optT') + '</h3><p class="note">' + t('res.optN') + '</p>' + (best && Math.abs(best.pct - R.sizePct) >= 1 ? '<div class="warnbox">' + t('res.rec', { p: best.pct, k: best.kwp.toFixed(1) }) + ' <button class="btn small" type="button" data-size="' + best.pct + '">' + t('res.recBtn') + '</button></div>' : '') + '<div class="opts">' + R.sizing.rows.map(function (r) {
      var cur = Math.abs(r.pct - R.sizePct) < 1, pay = r.payback == null ? t('res.none') + A_life() : r.payback.toFixed(1) + ' ' + t('res.yrs');
      return '<div class="opt' + (cur ? ' cur' : '') + '"><div class="oh"><b>' + r.pct + '%</b><span>' + r.kwp.toFixed(1) + ' kWp · ' + r.n + '</span>' + (best && r.pct === best.pct ? '<em>' + t('res.best') + '</em>' : '') + '</div><div class="ob">' + App.kv(t('res.cost'), money(r.cost)) + App.kv(t('res.save'), money(r.save)) + App.kv(t('res.pay'), pay) + App.kv(t('res.exp'), Math.round(r.exportShare * 100) + '%') + App.kv(t('res.npv'), money(r.npv)) + '</div><button class="btn small' + (cur ? '' : ' ghost') + '" type="button" data-size="' + r.pct + '"' + (cur ? ' disabled' : '') + '>' + (cur ? t('res.cur') : t('res.pick')) + '</button></div>';
    }).join('') + '</div></div>';
  }
  function consText(R, p) {
    if (R.noCons) return t('cd.none');
    if (p.mode === 'kwh') return t('cd.kwh', { v: fmt(p.cons) });
    if (p.mode === 'bill') return t('cd.bill', { v: fmt(p.cons), k: fmt(R.monthly) });
    return t('cd.ac', { u: R.acl.units, k: fmt(R.monthly) });
  }
  V.result = function () {
    var s = S(), p = findProject(UI.sel) || s.projects[0];
    if (!p) return { html: '<div class="formpage"><div class="card"><div class="empty">' + t('rp.noProject') + '<br><br><a class="btn" href="#design">' + t('site.start') + '</a></div></div></div>' };
    var R = App.design(p); if (!R.ok) return { html: '<div class="formpage"><div class="card">' + App.errBox(R) + '<a class="btn" href="#design">' + t('rp.edit') + '</a></div></div>' };
    var date = new Date().toLocaleDateString(s.lang === 'ar' ? 'ar-SA' : 'en-GB');
    var h = '<div class="formpage rpt"><div class="fhead"><h1>' + t('rp.t') + '</h1><p class="note">' + esc(p.name || '') + '</p></div>';
    h += '<section class="card" id="rp1"><h3>' + t('rp.s1') + '</h3><div class="kvgrid">' + App.kv(t('f.type'), t('type.' + p.type)) + App.kv(t('rp.loc'), App.cityName(R.cityKey)) + App.kv(t('rp.area'), fmt(R.W * R.L) + ' m² (' + R.W.toFixed(1) + ' × ' + R.L.toFixed(1) + ')' + (p.dimsApprox ? ' ' + t('tag.est') : '')) + App.kv(t('rp.data'), consText(R, p)) + App.kv(t('rp.sys'), t('sys.' + R.system) + (R.bat ? ' + ' + t('rep.bess') : '')) + App.kv(t('rp.date'), date) + '</div>' + accBox(R) + '</section>';
    h += '<section class="card vcol" id="rp2"><h3>' + t('rp.s2') + '</h3>' + ((p.dimsApprox || R.conf.level === 'low') ? '<div class="warnbox">' + t('rp.concept') + '</div>' : '') + App.viewerHTML() + App.warnList(R) + '</section>';
    h += '<section class="card" id="rp3"><h3>' + t('rp.s3') + '</h3>' + specsTable(R) + App.compTable(R, false) + '</section>';
    h += '<section class="card" id="rp4"><h3>' + t('rp.s4') + '</h3><div class="kpis"><div><span>' + t('pr.annual') + '</span><b>' + fmt(R.prodLow) + ' – ' + fmt(R.prod) + ' kWh</b></div><div><span>' + t('pr.daily') + '</span><b>' + fmt(R.daily, 1) + ' kWh</b></div><div><span>' + t('pr.spec') + '</span><b>' + fmt(R.yieldKwh) + ' kWh/kWp</b></div>' + (R.noCons ? '' : '<div><span>' + t('pr.cover') + '</span><b>' + Math.round(R.coverage * 100) + '%</b></div>') + '</div><h4>' + t('pr.monthly') + '</h4>' + App.monthlyChart(R) + '<h4>' + t('ls.t') + '</h4>' + App.lossTable(R) + (R.noCons ? '' : '<h4>' + t('au.p2').replace(/^2\) /, '') + '</h4>' + App.flowsHTML(R)) + '</section>';
    h += '<section class="card" id="rp5"><h3>' + t('rp.s5') + '</h3><div class="kpis"><div><span>' + t('fn.cost') + '</span><b>' + money(R.cost) + '</b></div>' + (R.noCons ? '' : '<div><span>' + t('fn.save') + '</span><b>' + money(R.save) + '</b></div><div><span>' + t('fn.saveM') + '</span><b>' + money(R.save / 12) + '</b></div><div><span>' + t('fn.pay') + '</span><b>' + App.paybackText(R) + '</b></div>') + '</div><p class="note">' + t('fn.costN') + '</p>' + App.compTable(R, true) + (R.noCons ? App.scenarioHTML(R) : '<div class="tblwrap">' + App.cashChart(R) + '</div>') + '<p class="note">' + t('fn.om') + ': ' + money(R.cost * App.A().om / 100) + '</p></section>';
    h += sizeOptions(R, p);
    h += '<details class="card techd" id="rp6"><summary><b>' + t('rp.s6') + '</b></summary>' + App.auditHTML(R) + '</details>';
    h += '<details class="card techd" id="rp7" open><summary><b>' + t('rp.s7') + '</b></summary>' + App.assumptionTable(R) + '<div class="warnbox"><b>' + t('rp.disc') + '</b></div></details>';
    h += '<section class="card" id="rp8"><h3>' + t('rp.s8') + '</h3><div class="row wnav"><button class="btn" id="pdfBtn" type="button">' + t('rp.pdf') + '</button><button class="btn ghost" id="saveBtn" type="button">' + t('rp.save') + '</button><a class="btn ghost" id="editBtn" href="#design">' + t('rp.edit') + '</a></div><p class="note">' + t('rp.pdfNote') + '</p><div id="saveMsg" class="note" role="status"></div>' +
      '<div class="card inner" id="reqBox"><div class="row">' + App.fld(t('f.cname'), '<input id="rq-name" type="text" maxlength="80" value="' + esc(p.customerName) + '">') + App.fld(t('f.phone'), '<input id="rq-phone" type="tel" inputmode="tel" maxlength="16" placeholder="05xxxxxxxx" value="' + esc(p.phone) + '">') + '</div><div class="err" id="rq-err" role="alert"></div><div class="row wnav"><button class="btn" id="visitBtn" type="button">' + t('rp.visit') + '</button><button class="btn ghost" id="quoteBtn" type="button">' + t('rp.quote') + '</button></div><div id="rq-ok"></div></div></section></div>';
    return { html: h, bind: function () {
      App.bindViewer(R, p, { edit: true, onEdit: function () { App.route(); } });
      $$('[data-size]').forEach(function (b) { b.onclick = function () { p.sizePct = +b.dataset.size; p.manual = false; saveDraft(p); keepScroll(function () { App.route(); }); }; });
      $('#editBtn').onclick = function () { s.draft = JSON.parse(JSON.stringify(p)); App.persist(); };
      $('#saveBtn').onclick = function () { saveDraft(p); $('#saveMsg').textContent = t('proj.saved'); };
      $('#pdfBtn').onclick = function () {
        saveDraft(p); var r = $('#report'); r.innerHTML = '<div id="reportBody">' + App.reportHTML(R, p, false) + '</div>';
        var r3 = r.querySelector('#r3d'); if (r3 && root.Viewer3D) { var im = root.Viewer3D.snapshots(R, [[-0.75, 0.55], [0.9, 0.3]]); r3.innerHTML = im.map(function (u) { return '<img alt="3D" src="' + u + '">'; }).join(''); }
        try { window.print(); } catch (e) {}
      };
      function send(kind) {
        var nm = $('#rq-name').value.trim(), ph = $('#rq-phone').value.replace(/[\s-]/g, '');
        if (!nm) return ($('#rq-err').textContent = t('err.name')); if (!validPhone(ph)) return ($('#rq-err').textContent = t('err.phone'));
        $('#rq-err').textContent = ''; p.customerName = nm; p.phone = ph; saveDraft(p); App.requestForProject(findProject(p.id), { name: nm, phone: ph, kind: kind });
        $('#rq-ok').innerHTML = '<div class="ok">' + t('rp.sent') + ' <a href="#requests">' + t('req.track') + '</a></div>';
      }
      $('#visitBtn').onclick = function () { send('visit'); }; $('#quoteBtn').onclick = function () { send('quote'); };
    } };
  };

  // ----- report view (shared by both roles) -----
  function reportView(tech) {
    return function () {
      var p = findProject(UI.sel);
      if (!p) return { html: '<div class="card"><div class="empty">' + t('rep.pick') + '<br><br><a class="btn" href="#reports">' + t('nav.' + (tech ? 'engineer' : 'customer') + '.reports') + '</a></div></div>' };
      var R = App.design(p); if (!R.ok) return { html: '<div class="card">' + App.errBox(R) + '</div>' };
      var back = tech ? 'reports' : 'projects';
      return { html: '<div class="card rview"><div class="rbar"><a class="btn ghost small" href="#' + back + '">' + t('back') + '</a>' + (App.canPrint() ? '<button class="btn small" id="printBtn" type="button">' + t('rep.print') + '</button>' : '<span class="note">' + t('rep.noPrint') + '</span>') + '<button class="btn ghost small" id="copyBtn" type="button">' + t('rep.copy') + '</button><span id="copyMsg" class="note" role="status"></span></div><div id="reportBody">' + App.reportHTML(R, p, tech) + '</div></div>',
        bind: function () {
          var r3 = $('#r3d'); if (r3 && root.Viewer3D) setTimeout(function () { var im = root.Viewer3D.snapshots(R, [[-0.75, 0.55], [0.9, 0.3]]); r3.innerHTML = im.length ? im.map(function (u) { return '<img alt="3D" src="' + u + '">'; }).join('') : '<p class="note">' + t('viz.no3d') + '</p>'; }, 60);
          if (UI.repFocus) { var fe = $('#rep-' + UI.repFocus); UI.repFocus = null; if (fe && fe.scrollIntoView) fe.scrollIntoView(); }
          var pb = $('#printBtn'); if (pb) pb.onclick = function () { var r = $('#report'); r.innerHTML = $('#reportBody').innerHTML; try { window.print(); } catch (e) {} };
          $('#copyBtn').onclick = function () { App.copyText(t('rep.copyText', { name: p.name || '-', kwp: R.kwp.toFixed(1), n: R.n, cost: fmt(R.cost), save: fmt(R.save), pay: R.payback == null ? '-' : R.payback.toFixed(1) }), function () { $('#copyMsg').textContent = t('copied'); }); };
        } };
    };
  }
  V.report = reportView(false);
  App.reportView = reportView;

  V.reports = function () {
    var s = S();
    return { html: '<div class="card"><h3>' + t('nav.customer.reports') + '</h3><p class="note">' + t('rep.listNote') + '</p>' + (s.projects.length ? '<div class="list">' + s.projects.map(function (p) { return '<div class="item"><div><b>' + esc(p.name) + '</b> ' + (p.simulated ? App.tag('sim') : '') + '</div><div class="acts"><button class="btn small" data-rep="' + p.id + '">' + t('rep.open') + '</button></div></div>'; }).join('') + '</div>' : '<div class="empty">' + t('proj.none') + '</div>') + '</div>',
      bind: function () { $$('[data-rep]').forEach(function (b) { b.onclick = function () { UI.sel = b.dataset.rep; App.go('report'); }; }); } };
  };

  // ----- requests -----
  V.requests = function () {
    var s = S();
    var h = '<div class="card"><h3>' + t('nav.customer.requests') + '</h3><p class="note">' + t('req.localNote') + '</p>' + (s.requests.length ? s.requests.map(function (r) { return '<div class="rq card inner"><div class="head"><b>' + esc(r.projectName || '-') + '</b><span class="note">' + esc(new Date(r.createdAt).toLocaleDateString(s.lang === 'ar' ? 'ar-SA' : 'en-GB')) + '</span></div>' + App.tracker(r, true) + '</div>'; }).join('') : '<div class="empty">' + t('req.none') + '</div>') + '</div>';
    return { html: h };
  };

  // ----- profile & support -----
  V.profile = function () {
    var s = S();
    return { html: '<div class="card"><h3>' + t('nav.customer.profile') + '</h3><div class="row">' + App.fld(t('f.cname'), App.inp('name', s.profile, { type: 'text', maxlength: 80 })) + App.fld(t('f.phone'), App.inp('phone', s.profile, { type: 'tel', maxlength: 16 })) + '</div>' +
      '<div class="row">' + App.fld(t('f.city'), App.sel('city', s.profile, App.cityOpts())) + App.fld(t('lang.label'), '<select id="langSel"><option value="ar"' + (s.lang === 'ar' ? ' selected' : '') + '>العربية</option><option value="en"' + (s.lang === 'en' ? ' selected' : '') + '>English</option></select>') + '</div><p class="note">' + t('profile.note') + '</p></div>',
      bind: function () { App.bindFields($('#view'), s.profile, function () { $('#who').textContent = s.profile.name || t('welcome'); }); $('#langSel').onchange = function (e) { s.lang = e.target.value; App.persist(); App.route(); }; } };
  };
  V.support = function () {
    var q = ['acc', 'size', 'roof', 'bat', 'cost', 'next'];
    return { html: '<div class="card"><h3>' + t('nav.customer.support') + '</h3>' + q.map(function (k) { return '<details class="faq"><summary>' + t('faq.' + k + '.q') + '</summary><p>' + t('faq.' + k + '.a') + '</p></details>'; }).join('') + '<p class="note">' + t('support.note') + '</p></div>' };
  };
})(window);
