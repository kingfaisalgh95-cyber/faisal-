/* Engineering / company workspace views */
(function (root) {
  'use strict';
  var App = root.App, St = root.Store, C = root.Calc, V = App.views.engineer;
  var t = App.t, esc = App.esc, fmt = App.fmt, money = App.money, $ = App.$, $$ = App.$$, UI = App.UI;
  function S() { return App.S(); }
  function findProject(id) { return S().projects.filter(function (p) { return p.id === id; })[0]; }
  function empty(msg, btns) { return '<div class="card"><div class="empty">' + msg + (btns ? '<br><br>' + btns : '') + '</div></div>'; }

  // ---------- dashboard ----------
  V.dashboard = function () {
    var s = S(), kwp = 0, cost = 0, okN = 0;
    s.projects.forEach(function (p) { var R = App.design(p); if (R.ok) { kwp += R.kwp; cost += R.cost; okN++; } });
    var counts = St.STAGES.map(function () { return 0; });
    s.requests.forEach(function (r) { counts[St.currentStage(r)]++; });
    var max = Math.max(1, Math.max.apply(null, counts));
    var h = '<div class="stack"><div><h2>' + t('nav.engineer.dashboard') + '</h2><p class="note">' + t('eng.dashNote') + '</p></div>' +
      '<div class="stats four">' + App.stat(t('nav.engineer.projects'), s.projects.length) + App.stat(t('eng.totalKwp'), fmt(kwp, 1) + ' kWp', 'est') + App.stat(t('eng.totalCost'), money(cost), 'est') + App.stat(t('nav.engineer.requests'), s.requests.length) + '</div>' +
      '<div class="two"><div class="card"><h3>' + t('eng.pipeline') + '</h3>' + St.STAGES.map(function (k, i) { return '<div class="bar-row"><span>' + t('stage.' + k) + '</span><div class="bar"><i style="width:' + Math.round(counts[i] / max * 100) + '%"></i></div><b>' + counts[i] + '</b></div>'; }).join('') + '</div>' +
      '<div class="card"><h3>' + t('eng.recent') + '</h3>' + (s.requests.length ? '<div class="list">' + s.requests.slice(0, 5).map(function (r) { return '<div class="item"><div><b>' + esc(r.projectName || '-') + '</b><div class="note">' + esc(r.customerName) + ' · ' + t('stage.' + r.stages[St.currentStage(r)].key) + '</div></div><button class="btn small" data-rq="' + r.id + '">' + t('open') + '</button></div>'; }).join('') + '</div>' : '<div class="empty">' + t('req.none') + '</div>') + '</div></div>' +
      '<div class="note">' + t('eng.demoNote') + '</div></div>';
    return { html: h, bind: function () { $$('[data-rq]').forEach(function (b) { b.onclick = function () { UI.req = b.dataset.rq; App.go('requests'); }; }); } };
  };

  // ---------- projects ----------
  V.projects = function () {
    var s = S();
    var h = '<div class="card"><div class="head"><h3>' + t('nav.engineer.projects') + '</h3></div>' +
      '<div class="card inner"><h4>' + t('proj.new') + '</h4><div class="row">' + App.fld(t('f.pname'), '<input id="np-name" type="text" maxlength="60">') +
      App.fld(t('f.cname'), '<input id="np-cust" type="text" maxlength="80" list="custList"><datalist id="custList">' + s.customers.map(function (c) { return '<option value="' + esc(c.name) + '">'; }).join('') + '</datalist>') + '</div>' +
      '<div class="acts"><button class="btn" id="npBtn" type="button">' + t('proj.create') + '</button><button class="btn ghost" id="sampleBtn" type="button">' + t('proj.sample') + '</button></div></div>' +
      (s.projects.length ? '<div class="list">' + s.projects.map(function (p) { return App.projectRow(p, true); }).join('') + '</div>' : '<div class="empty">' + t('proj.none') + '</div>') + '</div>';
    return { html: h, bind: function () {
      App.bindProjectList(function () { App.go('studio'); });
      $('#npBtn').onclick = function () { var p = St.newProject({ name: $('#np-name').value.trim() || t('proj.untitled') + ' ' + (s.projects.length + 1), customerName: $('#np-cust').value.trim() }); s.projects.unshift(p); UI.sel = p.id; App.persist(); App.go('studio'); };
      $('#sampleBtn').onclick = function () { var p = St.sampleProject(); s.projects.unshift(p); App.persist(); App.route(); };
    } };
  };

  // ---------- customers ----------
  V.customers = function () {
    var s = S();
    var h = '<div class="card"><h3>' + t('nav.engineer.customers') + '</h3><div class="row">' + App.fld(t('f.cname'), '<input id="cu-name" type="text" maxlength="80">') + App.fld(t('f.phone'), '<input id="cu-phone" type="tel" maxlength="16" placeholder="05xxxxxxxx">') + '</div>' +
      '<div class="row">' + App.fld(t('f.city'), '<select id="cu-city">' + App.cityOpts().map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join('') + '</select>') + App.fld(t('f.notes'), '<input id="cu-notes" type="text" maxlength="200">') + '</div>' +
      '<div class="err" id="cu-err" role="alert"></div><button class="btn" id="cuBtn" type="button">' + t('cust.add') + '</button></div>' +
      '<div class="card" style="margin-top:14px">' + (s.customers.length ? '<div class="list">' + s.customers.map(function (c) {
        var np = s.projects.filter(function (p) { return p.customerName === c.name; }).length, nr = s.requests.filter(function (r) { return r.customerName === c.name; }).length;
        return '<div class="item"><div><b>' + esc(c.name) + '</b><div class="note">' + esc(c.phone) + ' · ' + App.cityName(c.city) + ' · ' + t('nav.engineer.projects') + ': ' + np + ' · ' + t('nav.engineer.requests') + ': ' + nr + (c.notes ? ' · ' + esc(c.notes) : '') + '</div></div><button class="btn small ghost" data-cdel="' + c.id + '">' + t('delete') + '</button></div>'; }).join('') + '</div>' : '<div class="empty">' + t('cust.none') + '</div>') + '</div>';
    return { html: h, bind: function () {
      $('#cuBtn').onclick = function () { var n = $('#cu-name').value.trim(), ph = $('#cu-phone').value.replace(/[\s-]/g, ''); if (!n) return ($('#cu-err').textContent = t('err.name')); if (ph && !/^(05\d{8}|\+9665\d{8}|9665\d{8})$/.test(ph)) return ($('#cu-err').textContent = t('err.phone'));
        s.customers.unshift({ id: St.uid('c'), name: n, phone: ph, city: $('#cu-city').value, notes: $('#cu-notes').value.trim() }); App.persist(); App.route(); };
      $$('[data-cdel]').forEach(function (b) { App.armDelete(b, function () { s.customers = s.customers.filter(function (c) { return c.id !== b.dataset.cdel; }); App.persist(); App.route(); }); });
    } };
  };

  // ---------- design studio ----------
  var TABS = ['layout', 'strings', 'electrical', 'bess', 'performance', 'financial'];
  function studioInputs(p, tab) {
    var panels = App.lib().filter(function (e) { return e.kind === 'panel'; }), invs = App.lib().filter(function (e) { return e.kind === 'inverter'; }), bats = App.lib().filter(function (e) { return e.kind === 'battery'; });
    if (tab === 'layout') return '<div class="row">' + App.fld(t('f.len'), App.inp('len', p, { min: 3, max: 300 })) + App.fld(t('f.wid'), App.inp('wid', p, { min: 3, max: 300 })) + '</div><div class="row">' + App.fld(t('f.obstacle'), App.inp('obstacle', p, { min: 0 })) + App.fld(t('f.tilt'), App.inp('tilt', p, { min: 0, max: 35 })) + '</div>' +
      '<div class="row">' + App.fld(t('f.panel'), App.sel('panelId', p, panels.map(function (e) { return [e.id, e.name]; }))) + App.fld(t('f.system'), App.sel('system', p, [['grid', t('sys.grid')], ['hybrid', t('sys.hybrid')], ['offgrid', t('sys.offgrid')]])) + '</div>' +
      '<div class="row">' + App.fld(t('f.city'), App.sel('city', p, App.cityOpts())) + App.fld(t('f.consKwh'), App.inp('cons', p, { min: 1 })) + '</div>' +
      '<div class="row">' + App.fld(t('f.mode'), App.sel('mode', p, [['kwh', t('f.modeKwh')], ['bill', t('f.modeBill')]])) + '<div></div></div>' + App.chk('manual', p, t('lay.manual')) + '<p class="note">' + t('lay.manualHint') + '</p><button class="btn ghost small" id="resetLay" type="button">' + t('lay.reset') + '</button>';
    if (tab === 'strings') return '<div class="row">' + App.fld(t('f.inverter'), App.sel('inverterId', p, [['', t('st.auto')]].concat(invs.map(function (e) { return [e.id, e.name]; })))) + App.fld(t('st.qty'), App.inp('inverterQty', p, { min: 0, max: 50 }), t('st.qtyHint')) + '</div>';
    if (tab === 'electrical') return '<div class="row">' + App.fld(t('el.dcLen'), App.inp('dcLen', p, { min: 1, max: 500 })) + App.fld(t('el.acLen'), App.inp('acLen', p, { min: 1, max: 500 })) + '</div>';
    if (tab === 'bess') { if (!p.battery) p.battery = {}; return '<div class="row">' + App.fld(t('f.system'), App.sel('system', p, [['grid', t('sys.grid')], ['hybrid', t('sys.hybrid')], ['offgrid', t('sys.offgrid')]])) + App.fld(t('bess.arch'), App.sel('battery.arch', p, [['dc', t('bess.dcc')], ['ac', t('bess.acc')]])) + '</div>' +
      (p.system === 'hybrid' ? App.chk('battery.need', p, t('bat.need')) : '') + '<div class="row">' + App.fld(t('bat.hours'), App.inp('battery.hours', p, { min: 1, max: 72 })) + App.fld(t('bat.kw'), App.inp('battery.criticalKw', p, { min: 0.5, max: 1000, step: 0.5 })) + '</div>' +
      '<div class="row">' + App.fld(t('bess.dod'), App.inp('battery.dod', p, { min: 10, max: 100, ph: t('st.fromLib') })) + App.fld(t('bess.rte'), App.inp('battery.rte', p, { min: 50, max: 100, ph: t('st.fromLib') })) + '</div>' + App.fld(t('bess.unit'), App.sel('battery.unitId', p, bats.map(function (e) { return [e.id, e.name]; }))); }
    return '';
  }
  function studioOut(R, p, tab) {
    if (!R.ok) return App.errBox(R);
    if (tab === 'layout') return App.warnList(R) + App.kv(t('lay.grid'), R.rows + ' × ' + R.cols) + App.kv(t('as.spacing'), R.pitchY.toFixed(2) + ' m') + App.kv(t('sum.panels'), R.n + ' / ' + R.avail) + App.kv(t('sum.kwp'), R.kwp.toFixed(1) + ' kWp', 'est') + App.compTable(R, false);
    if (tab === 'strings') { var s = R.strings; return App.kv(t('f.inverter'), esc(R.inv.name) + ' × ' + R.invQty, R.inv.verified ? 'ver' : 'usr') + App.kv(t('el.dcac'), R.dcac.toFixed(2), 'est') + (s.series ? App.kv(t('el.window'), s.minS + '–' + s.topS + ' ' + t('el.perString')) + App.kv(t('el.series'), s.series + ' × ' + s.strings + ' ' + t('el.strings1'), 'est') + App.kv(t('el.leftover'), s.leftover) + App.kv(t('el.cap'), s.strings + ' / ' + s.cap) + App.kv(t('el.vocCold', { t: App.A().tminC }), fmt(s.vocCold, 1) + ' V/' + t('el.panel1')) + App.kv(t('el.vmpHot', { t: App.A().tcellMax }), fmt(s.vmpHot, 1) + ' V/' + t('el.panel1')) : '') + App.warnList(R) + '<p class="note">' + t('st.note') + '</p>'; }
    if (tab === 'electrical') return App.electricalHTML(R);
    if (tab === 'bess') return R.bat ? App.bessHTML(R.bat, p.system !== 'offgrid') : '<div class="warnbox">' + t('bess.off') + '</div>';
    if (tab === 'performance') return '<div class="stats">' + App.stat(t('fin.prod'), fmt(R.prod) + ' kWh', 'est') + App.stat(t('perf.spec'), fmt(R.prod / R.kwp) + ' kWh/kWp', 'est') + App.stat(t('perf.cf'), (R.prod / (R.kwp * 8760) * 100).toFixed(1) + '%', 'est') + '</div>' +
      App.kv(t('perf.daily'), R.daily.toFixed(1) + ' kWh') + App.kv(t('el.dcac'), R.dcac.toFixed(2)) + App.kv(t('fin.cover'), Math.round(R.coverage * 100) + '%') + App.kv(t('perf.billNow'), money(R.billNow) + ' / ' + t('mo')) + App.kv(t('perf.billAfter'), money(R.billAfter) + ' / ' + t('mo')) + App.monthlyChart(R) + '<p class="note">' + t('perf.note') + '</p>' + App.warnList(R);
    return App.finTable(R) + '<h4>' + t('rep.components') + '</h4>' + App.compTable(R, true);
  }
  V.studio = function () {
    var s = S();
    if (!s.projects.length) return { html: empty(t('proj.none'), '<a class="btn" href="#projects">' + t('nav.engineer.projects') + '</a>') };
    var p = findProject(UI.sel) || s.projects[0]; UI.sel = p.id; if (TABS.indexOf(UI.tab) < 0) UI.tab = 'layout'; var tab = UI.tab;
    var h = '<div class="stack"><div class="head"><h2>' + t('nav.engineer.studio') + '</h2><select id="projSel" aria-label="' + t('nav.engineer.projects') + '">' + s.projects.map(function (x) { return '<option value="' + x.id + '"' + (x.id === p.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="tabs" role="tablist">' + TABS.map(function (k) { return '<button type="button" role="tab" data-tab="' + k + '" aria-selected="' + (tab === k) + '">' + t('tab.' + k) + '</button>'; }).join('') + '</div>' +
      '<div class="two ' + (tab === 'layout' ? 'wide' : '') + '"><div class="card" id="inputs">' + (tab === 'layout' || tab === 'strings' || tab === 'electrical' || tab === 'bess' ? studioInputs(p, tab) : '') + (tab === 'layout' ? '' : '') + '<div id="out">' + '</div></div>' + (tab === 'layout' ? '<div class="card" id="vcard"></div>' : '') + '</div></div>';
    var R0 = App.design(p);
    return { html: h, sum: R0.ok ? App.summaryHTML(R0) : true, bind: function () {
      $('#projSel').onchange = function (e) { UI.sel = e.target.value; App.route(); };
      $$('[data-tab]').forEach(function (b) { b.onclick = function () { UI.tab = b.dataset.tab; App.route(); }; });
      var opts = { edit: tab === 'layout', onEdit: refresh };
      function refresh() {
        var R = App.design(p); $('#out').innerHTML = studioOut(R, p, tab); $('#sum').innerHTML = App.summaryHTML(R);
        if (tab === 'layout') { if (R.ok) App.showViewer(R, p, opts); else $('#vnote').textContent = t('err.' + R.error); }
      }
      if (tab === 'layout') { $('#vcard').innerHTML = App.viewerHTML(); var R = App.design(p); if (R.ok) App.bindViewer(R, p, opts); var rl = $('#resetLay'); if (rl) rl.onclick = function () { p.disabled = []; p.manual = false; App.persist(); App.route(); }; }
      App.bindFields($('#inputs'), p, function (path) { if (path === 'mode' || path === 'system') { App.route(); return; } refresh(); });
      $('#out').innerHTML = studioOut(R0, p, tab);
    } };
  };

  // ---------- engineering tools (standalone calculators) ----------
  function toolState() {
    if (!UI.ts) UI.ts = { strings: { n: 30, panelId: 'pv550', invId: 'inv20g', qty: 1 }, cable: { kind: 'ac3', I: 30, L: 30, V: 400, drop: 2, pf: 1, factor: 1.25 }, bess: { criticalKw: 5, hours: 6, dod: 90, rte: 94, arch: 'dc', unitKwh: 10, unitKw: 5 } };
    return UI.ts;
  }
  function toolOut(k, st) {
    var a = App.A();
    if (k === 'strings') {
      var panel = C.equip(App.lib(), st.panelId, 'panel'), inv = C.equip(App.lib(), st.invId, 'inverter'), r = C.stringConfig(Number(st.n), panel, inv, Math.max(1, Number(st.qty) || 1), a);
      return r.series ? App.kv(t('el.window'), r.minS + '–' + r.topS) + App.kv(t('el.series'), r.series + ' × ' + r.strings, 'est') + App.kv(t('el.leftover'), r.leftover) + App.kv(t('el.voc'), fmt(r.vStringOc) + ' V (' + t('el.limit') + ' ' + inv.vmax + ')') + App.kv(t('el.mppt'), fmt(r.vStringMp) + ' V (' + inv.mpptMin + '–' + inv.mpptMax + ')') + App.kv(t('el.cap'), r.strings + ' / ' + r.cap) + (r.warn.length ? '<div class="warnbox">' + r.warn.map(function (w) { return t('warn.' + w); }).join('<br>') + '</div>' : '') : '<div class="warnbox">' + t('warn.noWindow') + '</div>';
    }
    if (k === 'cable') {
      var I = Number(st.I) || 0, V = Number(st.V) || 1, kind = st.kind, Idesign = I * (Number(st.factor) || 1.25);
      if (I <= 0 || !(Number(st.L) > 0)) return '<div class="warnbox">' + t('err.cons') + '</div>';
      var c = C.cableSize({ kind: kind, Ivd: I, Idesign: Idesign, L: Number(st.L), V: V, drop: Number(st.drop) || 2, pf: Number(st.pf) || 1 }, a);
      return App.kv(t('tool.minArea'), c.minArea.toFixed(2) + ' mm²') + App.kv(t('tool.chosen'), c.mm2 + ' mm² Cu', 'est') + App.kv(t('tool.ampacity'), c.ampacity + ' A') + App.kv(t('el.drop'), c.dropPct.toFixed(2) + ' %') + App.kv(t('tool.breaker'), C.nextStd(C.STD_BREAKER, Idesign) + ' A', 'est') + '<p class="note">' + t('el.note') + '</p>';
    }
    return App.bessHTML(C.bess(st), true);
  }
  V.tools = function () {
    var ts = toolState(), k = UI.tool; if (['strings', 'cable', 'bess'].indexOf(k) < 0) k = UI.tool = 'strings';
    var st = ts[k], panels = App.lib().filter(function (e) { return e.kind === 'panel'; }), invs = App.lib().filter(function (e) { return e.kind === 'inverter'; }), f;
    if (k === 'strings') f = '<div class="row">' + App.fld(t('f.panel'), App.sel('panelId', st, panels.map(function (e) { return [e.id, e.name]; }))) + App.fld(t('f.inverter'), App.sel('invId', st, invs.map(function (e) { return [e.id, e.name]; }))) + '</div><div class="row">' + App.fld(t('sum.panels'), App.inp('n', st, { min: 1 })) + App.fld(t('st.qty'), App.inp('qty', st, { min: 1 })) + '</div>';
    else if (k === 'cable') f = '<div class="row">' + App.fld(t('tool.kind'), App.sel('kind', st, [['ac3', t('tool.ac3')], ['ac1', t('tool.ac1')], ['dc', t('tool.dc')]])) + App.fld(t('tool.current'), App.inp('I', st, { min: 0 })) + '</div><div class="row">' + App.fld(t('tool.length'), App.inp('L', st, { min: 1 })) + App.fld(t('tool.volt'), App.inp('V', st, { min: 1 })) + '</div><div class="row">' + App.fld(t('tool.drop'), App.inp('drop', st, { min: 0.1, max: 10, step: 0.1 })) + App.fld(t('tool.factor'), App.inp('factor', st, { min: 1, max: 2, step: 0.05 })) + '</div>';
    else f = '<div class="row">' + App.fld(t('bat.kw'), App.inp('criticalKw', st, { min: 0.5, step: 0.5 })) + App.fld(t('bat.hours'), App.inp('hours', st, { min: 1 })) + '</div><div class="row">' + App.fld(t('bess.dod'), App.inp('dod', st, { min: 10, max: 100 })) + App.fld(t('bess.rte'), App.inp('rte', st, { min: 50, max: 100 })) + '</div><div class="row">' + App.fld(t('bess.arch'), App.sel('arch', st, [['dc', t('bess.dcc')], ['ac', t('bess.acc')]])) + App.fld(t('bess.unitKwh'), App.inp('unitKwh', st, { min: 1 })) + '</div>';
    var h = '<div class="stack"><div><h2>' + t('nav.engineer.tools') + '</h2><p class="note">' + t('tool.note') + '</p></div><div class="tabs" role="tablist">' + ['strings', 'cable', 'bess'].map(function (x) { return '<button type="button" role="tab" data-tool="' + x + '" aria-selected="' + (k === x) + '">' + t('tool.' + x) + '</button>'; }).join('') + '</div>' +
      '<div class="two"><div class="card" id="tin">' + f + '</div><div class="card"><div id="tout"></div></div></div></div>';
    return { html: h, bind: function () {
      $$('[data-tool]').forEach(function (b) { b.onclick = function () { UI.tool = b.dataset.tool; App.route(); }; });
      var upd = function () { $('#tout').innerHTML = toolOut(k, st); };
      App.bindFields($('#tin'), st, upd); upd();
    } };
  };

  // ---------- equipment library ----------
  var SPECS = {
    panel: [['name', 'text'], ['maker', 'text'], ['watt', 1], ['voc', 1], ['vmp', 1], ['isc', 1], ['imp', 1], ['tcVoc', 1], ['tcPmax', 1], ['len', 1], ['wid', 1]],
    inverter: [['name', 'text'], ['maker', 'text'], ['kw', 1], ['phase', 1], ['vmax', 1], ['mpptMin', 1], ['mpptMax', 1], ['mppts', 1], ['iscMax', 1]],
    battery: [['name', 'text'], ['maker', 'text'], ['kwh', 1], ['kw', 1], ['dod', 1], ['rte', 1]]
  };
  V.equipment = function () {
    var s = S(); if (!s.equipment) { s.equipment = JSON.parse(JSON.stringify(C.DEF_EQUIP)); App.persist(); }
    UI.eqKind = UI.eqKind || 'panel'; var k = UI.eqKind;
    var items = s.equipment.filter(function (e) { return e.kind === k; });
    var cols = { panel: ['name', 'watt', 'voc', 'vmp', 'isc'], inverter: ['name', 'kw', 'phase', 'vmax', 'mppts'], battery: ['name', 'kwh', 'kw', 'dod', 'rte'] }[k];
    var h = '<div class="stack"><div><h2>' + t('nav.engineer.equipment') + '</h2><p class="note">' + t('eq.note') + '</p></div><div class="tabs" role="tablist">' + ['panel', 'inverter', 'battery'].map(function (x) { return '<button type="button" role="tab" data-ek="' + x + '" aria-selected="' + (k === x) + '">' + t('eq.' + x) + '</button>'; }).join('') + '</div>' +
      '<div class="card"><div class="tblwrap"><table><thead><tr>' + cols.map(function (c) { return '<th>' + t('spec.' + c) + '</th>'; }).join('') + '<th>' + t('eq.status') + '</th><th>' + t('eq.source') + '</th><th></th></tr></thead><tbody>' +
      items.map(function (e) { return '<tr>' + cols.map(function (c) { return '<td>' + esc(e[c]) + '</td>'; }).join('') + '<td><label class="check"><input type="checkbox" data-ver="' + e.id + '"' + (e.verified ? ' checked' : '') + '> ' + (e.verified ? t('tag.ver') : t('eq.typical')) + '</label></td><td><input type="text" data-src="' + e.id + '" value="' + esc(e.source || '') + '" placeholder="' + t('eq.srcPh') + '" maxlength="120"></td><td><button class="btn small ghost" data-edel="' + e.id + '" type="button">' + t('delete') + '</button></td></tr>'; }).join('') + '</tbody></table></div><div class="err" id="eq-err" role="alert"></div></div>' +
      '<div class="card"><h3>' + t('eq.add') + '</h3><div class="row3">' + SPECS[k].map(function (sp) { return App.fld(t('spec.' + sp[0]), '<input id="ne-' + sp[0] + '" type="' + (sp[1] === 'text' ? 'text' : 'number') + '" ' + (sp[1] === 'text' ? 'maxlength="80"' : 'step="any"') + '>'); }).join('') + '</div>' +
      (k === 'inverter' ? '<label class="check"><input type="checkbox" id="ne-hyb"> ' + t('spec.hybrid') + '</label>' : '') + '<div class="err" id="ne-err" role="alert"></div><button class="btn" id="neBtn" type="button">' + t('eq.addBtn') + '</button></div></div>';
    return { html: h, bind: function () {
      $$('[data-ek]').forEach(function (b) { b.onclick = function () { UI.eqKind = b.dataset.ek; App.route(); }; });
      var byId = function (id) { return s.equipment.filter(function (e) { return e.id === id; })[0]; };
      $$('[data-src]').forEach(function (i) { i.oninput = function () { byId(i.dataset.src).source = i.value; App.persist(); }; });
      $$('[data-ver]').forEach(function (c) { c.onchange = function () { var e = byId(c.dataset.ver); if (c.checked && !String(e.source || '').trim()) { c.checked = false; $('#eq-err').textContent = t('eq.needSource'); return; } e.verified = c.checked; App.persist(); App.route(); }; });
      $$('[data-edel]').forEach(function (b) { App.armDelete(b, function () { if (s.equipment.filter(function (e) { return e.kind === k; }).length <= 1) { $('#eq-err').textContent = t('eq.keepOne'); return; } s.equipment = s.equipment.filter(function (e) { return e.id !== b.dataset.edel; }); App.persist(); App.route(); }); });
      $('#neBtn').onclick = function () {
        var o = { id: St.uid('e'), kind: k, verified: false, source: '' };
        for (var i = 0; i < SPECS[k].length; i++) { var sp = SPECS[k][i], v = $('#ne-' + sp[0]).value.trim(); if (sp[1] === 'text') { o[sp[0]] = v; if (sp[0] === 'name' && !v) return ($('#ne-err').textContent = t('err.name')); } else { if (v === '' || !isFinite(Number(v))) return ($('#ne-err').textContent = t('eq.needNums')); o[sp[0]] = Number(v); } }
        if (k === 'inverter') o.hybrid = $('#ne-hyb').checked;
        s.equipment.push(o); App.persist(); App.route();
      };
    } };
  };

  // ---------- technical reports ----------
  V.report = App.reportView(true);
  V.reports = function () {
    var s = S();
    return { html: '<div class="card"><h3>' + t('nav.engineer.reports') + '</h3><p class="note">' + t('rep.techNote') + '</p>' + (s.projects.length ? '<div class="list">' + s.projects.map(function (p) { return '<div class="item"><div><b>' + esc(p.name) + '</b> ' + (p.simulated ? App.tag('sim') : '') + '</div><div class="acts"><button class="btn small" data-rep="' + p.id + '">' + t('rep.open') + '</button></div></div>'; }).join('') + '</div>' : '<div class="empty">' + t('proj.none') + '</div>') + '</div>',
      bind: function () { $$('[data-rep]').forEach(function (b) { b.onclick = function () { UI.sel = b.dataset.rep; App.go('report'); }; }); } };
  };

  // ---------- requests workflow ----------
  V.requests = function () {
    var s = S(), rq = s.requests.filter(function (r) { return r.id === UI.req; })[0];
    var list = s.requests.length ? '<div class="list">' + s.requests.map(function (r) { return '<div class="item' + (rq && r.id === rq.id ? ' sel' : '') + '"><div><b>' + esc(r.projectName || '-') + '</b><div class="note">' + esc(r.customerName) + ' · ' + esc(r.phone) + ' · ' + t('stage.' + r.stages[St.currentStage(r)].key) + '</div></div><button class="btn small" data-rq="' + r.id + '">' + t('open') + '</button></div>'; }).join('') + '</div>' : '<div class="empty">' + t('req.none') + '</div>';
    var h = '<div class="stack"><div><h2>' + t('nav.engineer.requests') + '</h2><p class="note">' + t('req.noAuto') + '</p></div><div class="card">' + list + '</div>';
    if (rq) {
      var cur = UI.stage != null && rq.stages[UI.stage] ? UI.stage : St.currentStage(rq), st = rq.stages[cur];
      h += '<div class="card"><div class="head"><h3>' + esc(rq.projectName) + '</h3><span class="note">' + esc(rq.customerName) + ' · ' + esc(rq.phone) + '</span></div>' + App.fld(t('req.company'), '<input id="rq-company" type="text" maxlength="80" value="' + esc(rq.company) + '">', t('req.companyNote')) +
        '<ol class="track big" aria-label="' + t('req.progress') + '">' + rq.stages.map(function (x, i) { return '<li class="' + (x.status === 'done' ? 'done' : (i === St.currentStage(rq) ? 'cur' : '')) + (i === cur ? ' pick' : '') + '"><button type="button" data-st="' + i + '"><i></i><span>' + t('stage.' + x.key) + '</span></button></li>'; }).join('') + '</ol>' +
        '<div class="card inner"><h4>' + t('stage.' + st.key) + ' — ' + t('status.' + st.status) + '</h4><div class="row">' + App.fld(t('req.owner'), '<input id="st-owner" type="text" list="teamList" maxlength="80" value="' + esc(st.owner) + '"><datalist id="teamList">' + s.team.map(function (m) { return '<option value="' + esc(m.name) + '">'; }).join('') + '</datalist>') + App.fld(t('req.due'), '<input id="st-due" type="date" value="' + esc(st.due) + '">') + '</div>' +
        '<label for="st-note">' + t('req.addNote') + '</label><div class="inline"><input id="st-note" type="text" maxlength="300"><button class="btn small" id="noteBtn" type="button">' + t('add') + '</button></div>' + (st.notes.length ? '<ul class="plain">' + st.notes.map(function (n) { return '<li>' + esc(n.text) + ' <span class="note">' + esc(new Date(n.at).toLocaleString(s.lang === 'ar' ? 'ar-SA' : 'en-GB')) + '</span></li>'; }).join('') + '</ul>' : '') +
        '<label for="st-doc">' + t('req.addDoc') + '</label><div class="inline"><input id="st-doc" type="text" maxlength="160" placeholder="' + t('req.docPh') + '"><button class="btn small" id="docBtn" type="button">' + t('add') + '</button></div>' + (st.docs.length ? '<ul class="plain">' + st.docs.map(function (d) { return '<li>' + esc(d.name) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="acts" style="margin-top:12px">' + (st.status !== 'done' ? '<button class="btn" id="doneBtn" type="button">' + t('req.complete') + '</button>' : '<button class="btn ghost" id="reopenBtn" type="button">' + t('req.reopen') + '</button>') + '</div></div>' +
        '<h4>' + t('req.history') + '</h4>' + (function () { var hs = []; rq.stages.forEach(function (x) { x.history.forEach(function (e) { hs.push([e, x.key]); }); }); hs.sort(function (a, b) { return a[0].at < b[0].at ? 1 : -1; }); return hs.length ? '<ul class="plain">' + hs.slice(0, 12).map(function (e) { return '<li>' + esc(new Date(e[0].at).toLocaleString(s.lang === 'ar' ? 'ar-SA' : 'en-GB')) + ' · ' + t('stage.' + e[1]) + ' · ' + esc(e[0].by) + ' · ' + esc(e[0].text === 'created' ? t('req.created') : e[0].text) + '</li>'; }).join('') + '</ul>' : '<p class="note">-</p>'; })() + '</div>';
    }
    h += '</div>';
    return { html: h, bind: function () {
      $$('[data-rq]').forEach(function (b) { b.onclick = function () { UI.req = b.dataset.rq; UI.stage = null; App.route(); }; });
      if (!rq) return;
      var cur = UI.stage != null && rq.stages[UI.stage] ? UI.stage : St.currentStage(rq), st = rq.stages[cur], by = s.profile.name || t('role.engineer');
      var log = function (text) { st.history.push({ at: St.now(), by: by, text: text }); };
      $$('[data-st]').forEach(function (b) { b.onclick = function () { UI.stage = +b.dataset.st; App.route(); }; });
      $('#rq-company').oninput = function (e) { rq.company = e.target.value; App.persist(); };
      $('#st-owner').onchange = function (e) { st.owner = e.target.value; log(t('req.ownerSet', { n: st.owner || '-' })); App.persist(); };
      $('#st-due').onchange = function (e) { st.due = e.target.value; log(t('req.dueSet', { d: st.due || '-' })); App.persist(); };
      $('#noteBtn').onclick = function () { var v = $('#st-note').value.trim(); if (!v) return; st.notes.push({ at: St.now(), text: v }); log(v); App.persist(); App.route(); };
      $('#docBtn').onclick = function () { var v = $('#st-doc').value.trim(); if (!v) return; st.docs.push({ at: St.now(), name: v }); log(t('req.docAdded', { n: v })); App.persist(); App.route(); };
      var d = $('#doneBtn'); if (d) d.onclick = function () { st.status = 'done'; log(t('req.completed')); var nx = rq.stages[cur + 1]; if (nx && nx.status === 'pending') { nx.status = 'active'; nx.history.push({ at: St.now(), by: by, text: t('req.started') }); } UI.stage = null; App.persist(); App.route(); };
      var r = $('#reopenBtn'); if (r) r.onclick = function () { st.status = 'active'; log(t('req.reopened')); for (var i = cur + 1; i < rq.stages.length; i++) if (rq.stages[i].status === 'active') rq.stages[i].status = 'pending'; App.persist(); App.route(); };
    } };
  };

  // ---------- team ----------
  V.team = function () {
    var s = S();
    return { html: '<div class="card"><h3>' + t('nav.engineer.team') + '</h3><div class="row">' + App.fld(t('f.cname'), '<input id="tm-name" type="text" maxlength="80">') + App.fld(t('team.email'), '<input id="tm-email" type="text" maxlength="120">') + '</div>' +
      App.fld(t('team.role'), '<select id="tm-role">' + ['admin', 'engineer', 'technician'].map(function (r) { return '<option value="' + r + '">' + t('team.' + r) + '</option>'; }).join('') + '</select>') + '<div class="err" id="tm-err" role="alert"></div><button class="btn" id="tmBtn" type="button">' + t('cust.add') + '</button><p class="note">' + t('team.note') + '</p></div>' +
      '<div class="card" style="margin-top:14px">' + (s.team.length ? '<div class="list">' + s.team.map(function (m) { return '<div class="item"><div><b>' + esc(m.name) + '</b> <span class="status">' + t('team.' + m.role) + '</span><div class="note">' + esc(m.email) + '</div></div><button class="btn small ghost" data-mdel="' + m.id + '">' + t('delete') + '</button></div>'; }).join('') + '</div>' : '<div class="empty">' + t('team.none') + '</div>') + '</div>',
      bind: function () {
        $('#tmBtn').onclick = function () { var n = $('#tm-name').value.trim(); if (!n) return ($('#tm-err').textContent = t('err.name')); s.team.push({ id: St.uid('m'), name: n, email: $('#tm-email').value.trim(), role: $('#tm-role').value }); App.persist(); App.route(); };
        $$('[data-mdel]').forEach(function (b) { App.armDelete(b, function () { s.team = s.team.filter(function (m) { return m.id !== b.dataset.mdel; }); App.persist(); App.route(); }); });
      } };
  };

  // ---------- settings (route name: config) ----------
  var SCALARS = [['degr', 0, 5, 0.1], ['esc', 0, 15, 0.1], ['om', 0, 10, 0.1], ['disc', 0, 25, 0.5], ['replYear', 1, 25, 1], ['replPct', 0, 100, 1], ['life', 5, 40, 1], ['battPerKwh', 100, 10000, 50], ['sunElev', 10, 60, 1], ['tminC', -20, 25, 1], ['tcellMax', 40, 90, 1], ['dropDC', 0.1, 5, 0.1], ['dropAC', 0.1, 10, 0.1], ['margin', 0, 5, 0.1]];
  V.config = function () {
    var s = S(), a = s.assumptions; if (!a.tariffs) a.tariffs = JSON.parse(JSON.stringify(C.DEFAULTS.tariffs)); if (!a.costBands) a.costBands = JSON.parse(JSON.stringify(C.DEFAULTS.costBands));
    SCALARS.forEach(function (x) { if (a[x[0]] == null) a[x[0]] = C.DEFAULTS[x[0]]; });
    var h = '<div class="stack"><div><h2>' + t('nav.engineer.config') + '</h2><p class="note">' + t('cfg.note') + '</p></div><div class="card"><h3>' + t('cfg.assump') + '</h3><div class="row3">' + SCALARS.map(function (x) { return App.fld(t('cfg.' + x[0]), App.inp(x[0], a, { min: x[1], max: x[2], step: x[3] })); }).join('') + '</div></div>' +
      '<div class="card"><h3>' + t('cfg.cost') + '</h3><div class="row3">' + a.costBands.map(function (b, i) { return App.fld(t('cfg.band', { n: i + 1, k: b[0] >= 1e9 ? '∞' : b[0] }), App.inp('costBands.' + i + '.1', a, { min: 500, max: 20000, step: 50 })); }).join('') + '</div></div>' +
      '<div class="card"><h3>' + t('cfg.tariff') + '</h3>' + Object.keys(a.tariffs).map(function (k) { return '<h4>' + t('type.' + k) + '</h4><div class="row3">' + App.fld(t('cfg.rate1'), App.inp('tariffs.' + k + '.0', a, { min: 0, step: 0.01 })) + App.fld(t('cfg.limit'), App.inp('tariffs.' + k + '.1', a, { min: 0 })) + App.fld(t('cfg.rate2'), App.inp('tariffs.' + k + '.2', a, { min: 0, step: 0.01 })) + '</div>'; }).join('') + '<button class="btn ghost small" id="defBtn" type="button">' + t('cfg.defaults') + '</button></div>' +
      '<div class="card"><h3>' + t('cfg.data') + '</h3><p class="note">' + t('cfg.dataNote') + '</p><textarea id="dataTxt" rows="5" aria-label="JSON" spellcheck="false"></textarea><div class="acts" style="margin-top:8px"><button class="btn small" id="expBtn" type="button">' + t('cfg.export') + '</button><button class="btn small ghost" id="impBtn" type="button">' + t('cfg.import') + '</button><button class="btn small ghost" id="rstBtn" type="button">' + t('cfg.reset') + '</button></div><div id="cfgMsg" class="note" role="status"></div></div></div>';
    return { html: h, bind: function () {
      App.bindFields($('#view'), a, function () {});
      $('#defBtn').onclick = function () { s.assumptions = {}; App.persist(); App.route(); };
      $('#expBtn').onclick = function () { $('#dataTxt').value = St.exportJSON(); App.copyText(St.exportJSON(), function () { $('#cfgMsg').textContent = t('copied'); }); };
      $('#impBtn').onclick = function () { try { St.importJSON($('#dataTxt').value); App.refresh(); App.route(); } catch (e) { $('#cfgMsg').textContent = t('cfg.badJson'); } };
      App.armDelete($('#rstBtn'), function () { St.reset(); App.refresh(); location.hash = '#dashboard'; App.route(); });
    } };
  };
})(window);
