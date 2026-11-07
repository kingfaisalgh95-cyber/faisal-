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

  // ----- dashboard -----
  V.dashboard = function () {
    var s = S(), ps = s.projects.slice(0, 3), rqs = s.requests.slice(0, 2), name = s.profile.name, p = (function () { if (!s.draft) { s.draft = St.newProject({ customerName: s.profile.name, phone: s.profile.phone, city: s.profile.city }); App.persist(); } return s.draft; })(), R = App.design(p);
    var h = '<div class="stack"><div class="hero"><div class="txt"><h1>' + (name ? t('dash.hello', { n: esc(name) }) : t('dash.hello0')) + '</h1><p>' + t('dash.sub') + '</p></div>' + App.heroArt() + '</div>';
    h += '<div class="card"><div class="steps" aria-hidden="true">' + STEPS.map(function (k, i) { return '<button type="button" tabindex="-1" class="' + (i === 0 ? 'on' : '') + '"><i>' + (i + 1) + '</i><span>' + t('wiz.' + k) + '</span></button>'; }).join('') + '</div></div>';
    h += '<div class="studio"><div class="card fcol"><h3>' + t('home.formT') + '</h3><p class="note">' + t('wiz.infoHint') + '</p><div id="quick">' + siteFields(p, true) + '</div><div class="err" id="err" role="alert"></div><button class="btn wide" id="startBtn" type="button">' + t('next') + ' ←</button></div>' + viewerBlock(R, p) + '</div>';
    h += '<div class="card"><h3>' + t('home.how') + '</h3><div class="benef"><div><b>' + t('ben.indep') + '</b>' + t('ben.indepT') + '</div><div><b>' + t('ben.value') + '</b>' + t('ben.valueT') + '</div><div><b>' + t('ben.clean') + '</b>' + t('ben.cleanT') + '</div><div><b>' + t('ben.save') + '</b>' + t('ben.saveT') + '</div></div></div>';
    h += '<div class="card cta"><div><h3>' + t('home.next') + '</h3><p class="note">' + t('home.nextT') + '</p></div><a class="btn" href="#design" id="ctaBtn">' + t('home.nextBtn') + '</a></div>';
    h += '<div class="two"><div class="card"><h3>' + t('nav.customer.projects') + '</h3>' + (ps.length ? '<div class="list">' + ps.map(function (q) { return App.projectRow(q); }).join('') + '</div>' : '<div class="empty">' + t('proj.none') + '</div>') + '</div>' +
      '<div class="card"><h3>' + t('nav.customer.requests') + '</h3>' + (rqs.length ? rqs.map(function (r) { return '<div class="rq"><b>' + esc(r.projectName || '-') + '</b>' + App.tracker(r, false) + '</div>'; }).join('') : '<div class="empty">' + t('req.none') + '</div>') + '</div></div></div>';
    return { html: h, sum: App.summaryHTML(R), bind: function () {
      App.bindProjectList(function (id) { UI.step = 4; s.draft = JSON.parse(JSON.stringify(findProject(id))); App.persist(); App.go('design'); });
      App.bindFields($('#quick'), p, function (path) { if (path === 'len' || path === 'wid') { var a = $('#areaT'); if (a) a.textContent = fmt((p.len || 0) * (p.wid || 0)); } live(p); });
      $$('[data-type]').forEach(function (b) { b.onclick = function () { p.type = b.dataset.type; p.kind = C.TYPES[p.type].kind; App.persist(); $$('[data-type]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); live(p); }; });
      $('#startBtn').onclick = function () { var c = App.design(p); if (c.error === 'dims' || c.error === 'cons') return ($('#err').textContent = t('err.' + c.error)); UI.step = 2; App.go('design'); };
      $('#ctaBtn').onclick = function () { UI.step = 3; };
      App.bindViewer(R, p, {});
    } };
  };
  // ----- projects -----
  V.projects = function () {
    var s = S();
    var h = '<div class="card"><div class="head"><h3>' + t('nav.customer.projects') + '</h3><div class="acts"><a class="btn small" href="#design" id="newBtn">' + t('proj.new') + '</a><button class="btn small ghost" id="sampleBtn">' + t('proj.sample') + '</button></div></div>' +
      '<p class="note">' + t('proj.local') + '</p>' + (s.projects.length ? '<div class="list">' + s.projects.map(function (p) { return App.projectRow(p); }).join('') + '</div>' : '<div class="empty">' + t('proj.none') + '</div>') + '</div>';
    return { html: h, bind: function () {
      App.bindProjectList(function (id) { s.draft = JSON.parse(JSON.stringify(findProject(id))); UI.step = 5; App.persist(); App.go('design'); });
      $('#newBtn').onclick = function () { s.draft = null; UI.step = 1; };
      $('#sampleBtn').onclick = function () { s.projects.unshift(St.sampleProject()); App.persist(); App.route(); };
    } };
  };

  // ----- design studio (4 steps, live 2D/3D preview) -----
  function draft() {
    var s = S();
    if (!s.draft) { s.draft = St.newProject({ customerName: s.profile.name, phone: s.profile.phone, city: s.profile.city }); App.persist(); }
    return s.draft;
  }
  var STEPS = ['site', 'energy', 'design', 'review'];
  function stepper() {
    return '<div class="steps">' + STEPS.map(function (k, i) { var n = i + 1, c = n === UI.step ? 'on' : (n < UI.step ? 'done' : ''); return '<button type="button" class="' + c + '" data-step="' + n + '"' + (n === UI.step ? ' aria-current="step"' : '') + '><i>' + (n < UI.step ? '✓' : n) + '</i><span>' + t('wiz.' + k) + '</span></button>'; }).join('') + '</div>';
  }
  function typeChips(p) {
    return '<div class="types four-c" role="group" aria-label="' + t('f.type') + '">' + Object.keys(C.TYPES).map(function (k) {
      return '<button type="button" data-type="' + k + '" aria-pressed="' + (p.type === k) + '">' + App.icon(k) + t('type.' + k) + '</button>';
    }).join('') + '</div>';
  }
  function siteFields(p, quick) {
    return '<label>' + t('f.type') + '</label>' + typeChips(p) +
      '<div class="row">' + App.fld(t('f.len'), App.inp('len', p, { min: 3, max: 300 }), quick ? '' : t('f.lenHint')) + App.fld(t('f.wid'), App.inp('wid', p, { min: 3, max: 300 })) + '</div>' +
      '<p class="note">' + t('f.area') + ': <b id="areaT">' + fmt((p.len || 0) * (p.wid || 0)) + '</b> m²</p>' +
      App.fld(t('f.city'), App.sel('city', p, App.cityOpts())) +
      App.fld(p.mode === 'bill' ? t('f.consBill') : t('f.consKwh'), App.inp('cons', p, { min: 1 }), t('f.consHint'));
  }
  function stepBody(p) {
    var n = UI.step;
    if (n === 1) return '<h3>' + t('wiz.siteT') + '</h3><p class="note">' + t('wiz.infoHint') + '</p>' +
      App.fld(t('f.pname'), App.inp('name', p, { type: 'text', maxlength: 60, ph: t('f.pnameEx') })) + siteFields(p) + App.fld(t('f.address'), App.inp('address', p, { type: 'text', maxlength: 120 }));
    if (n === 2) {
      var sys = ['grid', 'hybrid', 'offgrid'], panels = App.lib().filter(function (e) { return e.kind === 'panel'; });
      return '<h3>' + t('wiz.energyT') + '</h3>' +
        '<div class="row">' + App.fld(t('f.mode'), App.sel('mode', p, [['kwh', t('f.modeKwh')], ['bill', t('f.modeBill')]])) + App.fld(p.mode === 'bill' ? t('f.consBill') : t('f.consKwh'), App.inp('cons', p, { min: 1 }), t('f.consHint')) + '</div>' +
        '<div class="tip">' + t('wiz.consTip') + '</div>' +
        '<h4>' + t('wiz.sys') + '</h4><div class="types three-c" id="sysBtns">' + sys.map(function (k) { return '<button type="button" data-sys="' + k + '" aria-pressed="' + (p.system === k) + '">' + App.icon(k) + t('sys.' + k) + '<small>' + t('sys.' + k + 'T') + '</small></button>'; }).join('') + '</div>' +
        '<div id="batBox">' + batBox(p) + '</div>' + App.fld(t('f.panel'), App.sel('panelId', p, panels.map(function (e) { return [e.id, e.name]; })), t('f.equipHint'));
    }
    return '';
  }
  function batBox(p) {
    if (p.system === 'grid') return '<p class="note">' + t('sys.gridNote') + '</p>';
    var must = p.system === 'offgrid';
    return '<div class="card inner"><h4>' + t('bat.title') + '</h4>' + (must ? '<p class="note">' + t('bat.must') + '</p>' : App.chk('battery.need', p, t('bat.need'))) +
      ((must || (p.battery && p.battery.need)) ? '<div class="row">' + App.fld(t('bat.hours'), App.inp('battery.hours', p, { min: 1, max: 48 }), t('bat.hoursHint')) + App.fld(t('bat.kw'), App.inp('battery.criticalKw', p, { min: 0.5, max: 500, step: 0.5 }), t('bat.kwHint')) + '</div>' : '') + '</div>';
  }
  function nav(n) {
    return '<div class="err" id="err" role="alert"></div><div class="row wnav">' + (n > 1 ? '<button class="btn ghost" type="button" data-go="' + (n - 1) + '">' + t('prev') + '</button>' : '<span></span>') + (n < 4 ? '<button class="btn" type="button" data-go="' + (n + 1) + '">' + t('next') + ' ←</button>' : '') + '</div>';
  }
  function saveDraft(p) {
    var s = S(), i = -1; s.projects.forEach(function (x, k) { if (x.id === p.id) i = k; });
    if (!p.name) p.name = t('proj.untitled') + ' ' + (s.projects.length + 1);
    if (i >= 0) s.projects[i] = JSON.parse(JSON.stringify(p)); else s.projects.unshift(JSON.parse(JSON.stringify(p)));
    App.persist();
  }
  function validPhone(v) { return /^(05\d{8}|\+9665\d{8}|9665\d{8})$/.test(String(v).replace(/[\s-]/g, '')); }

  // live preview: re-computes the design and refreshes viewer + summary without re-rendering the form (keeps typing focus)
  var liveTimer = null;
  function live(p, edit) {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      var R = App.design(p), ph = $('#vphold');
      if (!R.ok) { App.setSummary(R); if (ph) ph.hidden = false; var v = $('#viewer'); if (v) v.hidden = true; var nt = $('#vnote'); if (nt) nt.textContent = t('err.' + R.error); return; }
      if (ph) ph.hidden = true; var vv = $('#viewer'); if (vv) vv.hidden = false;
      App.showViewer(R, p, { keep: true, edit: edit });
      App.setSummary(R);
    }, 140);
  }
  function viewerBlock(R, p, edit) {
    return '<div class="card vcol">' + App.viewerHTML() + '<div class="warnbox" id="vphold"' + (R.ok ? ' hidden' : '') + '>' + (R.ok ? '' : t('err.' + R.error)) + '</div></div>';
  }
  function specsTable(R) {
    var rows = [[t('sum.panel'), R.panel.name], [t('c.power'), R.panel.watt + ' W × ' + R.n + ' = ' + R.kwp.toFixed(2) + ' kWp'], [t('sum.inv'), R.inv.name + ' × ' + R.invQty], [t('el.dcac'), R.dcac.toFixed(2)], [t('as.tilt'), R.tilt + '°'], [t('as.spacing'), R.pitchY.toFixed(2) + ' m'], [t('f.area'), fmt(R.W * R.L) + ' m²'], [t('fin.prod'), fmt(R.prod) + ' kWh/' + t('yr')]];
    return '<div class="tblwrap"><table><tbody>' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td><b>' + esc(String(r[1])) + '</b></td></tr>'; }).join('') + '</tbody></table></div><p class="note">' + t('rep.unverified') + '</p>';
  }
  function designStep(p, R) {
    if (!R.ok) return '<div class="warnbox">' + t('err.' + R.error) + '</div>';
    var tab = UI.dtab || 'comp';
    var tabs = [['comp', t('tab.comp')], ['spec', t('tab.spec')], ['cost', t('tab.cost')]];
    var body = tab === 'comp' ? App.compTable(R, false) : tab === 'spec' ? specsTable(R) : App.compTable(R, true) + App.finTable(R);
    return '<div class="dgrid"><div class="card vcol">' + App.viewerHTML() + '</div>' +
      '<div class="dside"><div class="card"><h3>' + t('tab.title') + '</h3><div class="tabs" role="tablist">' + tabs.map(function (x) { return '<button type="button" role="tab" data-dtab="' + x[0] + '" aria-selected="' + (tab === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div><div class="tabbody">' + body + '</div></div></div></div>' +
      App.warnList(R) + (R.bat ? '<div class="card"><h4>' + t('rep.bess') + '</h4>' + App.kv(t('bess.nominal'), R.bat.nominal + ' kWh', 'est') + App.kv(t('bess.backup'), R.bat.backupH.toFixed(1) + ' h', 'est') + '</div>' : '');
  }
  function reviewStep(p, R) {
    if (!R.ok) return '<div class="warnbox">' + t('err.' + R.error) + '</div>';
    var h = '<div class="dgrid"><div class="card"><h3>' + t('rev.title') + '</h3><div class="stats two-s">' + App.stat(t('sum.kwp'), R.kwp.toFixed(1) + ' kWp', 'est') + App.stat(t('sum.panels'), R.n, 'est') + App.stat(t('fin.cover'), Math.round(R.coverage * 100) + '%', 'est') + App.stat(t('fin.payback'), App.paybackText(R), 'est') + '</div>' +
      '<div class="row wnav"><button class="btn" id="saveBtn" type="button">' + t('proj.save') + '</button><button class="btn ghost" id="reportBtn" type="button">' + t('rep.open') + '</button></div><div id="saveMsg" class="note" role="status"></div>' +
      '<h4>' + t('rep.list') + '</h4><div class="replist">' + [['plan', t('rep.l.plan')], ['specs', t('rep.l.specs')], ['save', t('rep.l.save')]].map(function (x) { return '<button type="button" class="repbtn" data-rep="' + x[0] + '">' + App.icon('doc') + '<span>' + x[1] + '</span></button>'; }).join('') + '</div></div>' +
      '<div class="dside"><div class="card" id="reqBox"><h3>' + t('req.submit') + '</h3><p class="note">' + t('req.submitNote') + '</p><div class="row">' + App.fld(t('f.cname'), '<input id="rq-name" type="text" maxlength="80" value="' + esc(p.customerName) + '">') + App.fld(t('f.phone'), '<input id="rq-phone" type="tel" inputmode="tel" maxlength="16" placeholder="05xxxxxxxx" value="' + esc(p.phone) + '">') + '</div>' +
      '<div class="err" id="rq-err" role="alert"></div><button class="btn" id="rqBtn" type="button">' + t('req.send') + '</button><div id="rq-ok"></div></div>' +
      '<div class="card help"><h4>' + t('help.title') + '</h4><p class="note">' + t('help.t') + '</p><a class="btn ghost" href="#support">' + t('help.cta') + '</a></div></div></div>';
    return h;
  }

  V.design = function () {
    var p = draft(), n = UI.step, R = App.design(p), h;
    if (n <= 2) h = '<div class="stack"><div class="card">' + stepper() + '</div><div class="studio"><div class="card fcol"><div id="stepBody">' + stepBody(p) + '</div>' + nav(n) + '</div>' + viewerBlock(R, p) + '</div></div>';
    else h = '<div class="stack"><div class="card">' + stepper() + '</div>' + (n === 3 ? designStep(p, R) : reviewStep(p, R)) + (n === 3 ? '<div class="card">' + nav(n) + '</div>' : '<div class="card">' + nav(n) + '</div>') + '</div>';
    return { html: h, sum: R.ok ? App.summaryHTML(R) : App.summaryHTML(R), bind: function () {
      var showErr = function (m) { var e = $('#err'); if (e) e.textContent = m; };
      $$('.steps button').forEach(function (b) { b.onclick = function () { jump(+b.dataset.step); }; });
      $$('[data-go]').forEach(function (b) { b.onclick = function () { jump(+b.dataset.go); }; });
      function jump(to) {
        if (to > UI.step) {
          var chk = App.design(p);
          if (chk.error === 'dims') { UI.step = 1; App.persist(); App.route(); return setTimeout(function () { showErr(t('err.dims')); }, 0); }
          if (chk.error === 'cons') { UI.step = to > 2 ? 2 : UI.step; App.persist(); App.route(); return setTimeout(function () { showErr(t('err.cons')); }, 0); }
          if (to >= 3 && !chk.ok) { UI.step = 1; App.route(); return setTimeout(function () { showErr(t('err.' + chk.error)); }, 0); }
        }
        UI.step = to; App.route();
      }
      if (n <= 2) {
        App.bindFields($('#stepBody'), p, function (path) {
          if (path === 'len' || path === 'wid') { var a = $('#areaT'); if (a) a.textContent = fmt((p.len || 0) * (p.wid || 0)); }
          if (path === 'mode') return App.route();
          if (path === 'battery.need') { $('#batBox').innerHTML = batBox(p); App.bindFields($('#batBox'), p, function () { live(p); }); }
          live(p);
        });
        $$('[data-type]').forEach(function (b) { b.onclick = function () { p.type = b.dataset.type; p.kind = C.TYPES[p.type].kind; App.persist(); $$('[data-type]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); live(p); }; });
        $$('[data-sys]').forEach(function (b) { b.onclick = function () { p.system = b.dataset.sys; if (!p.battery) p.battery = {}; if (p.system === 'offgrid') { p.battery.need = true; p.battery.hours = Math.max(p.battery.hours || 0, 12); } App.persist(); App.route(); }; });
        App.bindViewer(R, p, {});
      }
      if (n === 3 && R.ok) {
        var opts = { edit: true, onEdit: function () { App.route(); } };
        App.bindViewer(R, p, opts);
        $$('[data-dtab]').forEach(function (b) { b.onclick = function () { UI.dtab = b.dataset.dtab; App.route(); }; });
      }
      if (n === 4 && R.ok) {
        $('#saveBtn').onclick = function () { saveDraft(p); $('#saveMsg').textContent = t('proj.saved'); };
        $('#reportBtn').onclick = function () { saveDraft(p); UI.sel = p.id; App.go('report'); };
        $$('[data-rep]').forEach(function (b) { b.onclick = function () { saveDraft(p); UI.sel = p.id; UI.repFocus = b.dataset.rep; App.go('report'); }; });
        $('#rqBtn').onclick = function () {
          var nm = $('#rq-name').value.trim(), ph = $('#rq-phone').value.replace(/[\s-]/g, '');
          if (!nm) return ($('#rq-err').textContent = t('err.name'));
          if (!validPhone(ph)) return ($('#rq-err').textContent = t('err.phone'));
          $('#rq-err').textContent = ''; p.customerName = nm; p.phone = ph; saveDraft(p);
          var sp = findProject(p.id); App.requestForProject(sp, { name: nm, phone: ph, kind: 'quote' });
          $('#rq-ok').innerHTML = '<div class="ok">' + t('req.ok') + ' <a href="#requests">' + t('req.track') + '</a></div>'; $('#rqBtn').disabled = true;
        };
      }
    } };
  };

  // ----- report view (shared by both roles) -----
  function reportView(tech) {
    return function () {
      var p = findProject(UI.sel);
      if (!p) return { html: '<div class="card"><div class="empty">' + t('rep.pick') + '<br><br><a class="btn" href="#reports">' + t('nav.' + (tech ? 'engineer' : 'customer') + '.reports') + '</a></div></div>' };
      var R = App.design(p); if (!R.ok) return { html: '<div class="card">' + App.errBox(R) + '</div>' };
      var back = tech ? 'reports' : 'reports';
      return { html: '<div class="card rview"><div class="rbar"><a class="btn ghost small" href="#' + back + '">' + t('back') + '</a>' + (App.canPrint() ? '<button class="btn small" id="printBtn" type="button">' + t('rep.print') + '</button>' : '<span class="note">' + t('rep.noPrint') + '</span>') + '<button class="btn ghost small" id="copyBtn" type="button">' + t('rep.copy') + '</button><span id="copyMsg" class="note" role="status"></span></div><div id="reportBody">' + App.reportHTML(R, p, tech) + '</div></div>',
        bind: function () {
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
