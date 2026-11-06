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
    var s = S(), ps = s.projects.slice(0, 3), rqs = s.requests.slice(0, 2), name = s.profile.name;
    var h = '<div class="stack"><div class="hero"><div class="txt"><h1>' + (name ? t('dash.hello', { n: esc(name) }) : t('dash.hello0')) + '</h1><p>' + t('dash.sub') + '</p><a class="btn" href="#design" id="startBtn">' + t('dash.start') + '</a></div>' + App.heroArt() + '</div>';
    h += '<div class="two"><div class="card"><h3>' + t('nav.customer.projects') + '</h3>' + (ps.length ? '<div class="list">' + ps.map(function (p) { return App.projectRow(p); }).join('') + '</div>' : '<div class="empty">' + t('proj.none') + '<br><br><a class="btn" href="#design">' + t('dash.start') + '</a></div>') + '</div>' +
      '<div class="card"><h3>' + t('nav.customer.requests') + '</h3>' + (rqs.length ? rqs.map(function (r) { return '<div class="rq"><b>' + esc(r.projectName || '-') + '</b>' + App.tracker(r, false) + '</div>'; }).join('') : '<div class="empty">' + t('req.none') + '</div>') + '</div></div>';
    h += '<div class="benef"><div><b>' + t('ben.save') + '</b>' + t('ben.saveT') + '</div><div><b>' + t('ben.clean') + '</b>' + t('ben.cleanT') + '</div><div><b>' + t('ben.value') + '</b>' + t('ben.valueT') + '</div><div><b>' + t('ben.indep') + '</b>' + t('ben.indepT') + '</div></div></div>';
    return { html: h, bind: function () { App.bindProjectList(function (id) { UI.step = 5; s.draft = JSON.parse(JSON.stringify(findProject(id))); App.persist(); App.go('design'); }); $('#startBtn').onclick = function () { s.draft = null; UI.step = 1; }; } };
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

  // ----- design wizard (5 steps) -----
  function draft() {
    var s = S();
    if (!s.draft) { s.draft = St.newProject({ customerName: s.profile.name, phone: s.profile.phone, city: s.profile.city }); App.persist(); }
    return s.draft;
  }
  var STEPS = ['info', 'cons', 'roof', 'sys', 'res'];
  function stepper() {
    return '<div class="steps">' + STEPS.map(function (k, i) { var n = i + 1, c = n === UI.step ? 'on' : (n < UI.step ? 'done' : ''); return '<button type="button" class="' + c + '" data-step="' + n + '"' + (n === UI.step ? ' aria-current="step"' : '') + '><i>' + (n < UI.step ? '✓' : n) + '</i><span>' + t('wiz.' + k) + '</span></button>'; }).join('') + '</div>';
  }
  function typeButtons(p) {
    var list = Object.keys(C.TYPES).filter(function (k) { return C.TYPES[k].kind === p.kind; });
    return '<div class="types" role="group">' + list.map(function (k) { return '<button type="button" data-type="' + k + '" aria-pressed="' + (p.type === k) + '">' + App.icon(k) + t('type.' + k) + '</button>'; }).join('') + '</div>';
  }
  function stepBody(p) {
    var n = UI.step;
    if (n === 1) return '<h3>' + t('wiz.info') + '</h3><p class="note">' + t('wiz.infoHint') + '</p>' +
      App.fld(t('f.pname'), App.inp('name', p, { type: 'text', maxlength: 60, ph: t('f.pnameEx') })) +
      '<div class="row">' + App.fld(t('f.cname'), App.inp('customerName', p, { type: 'text', maxlength: 80 })) + App.fld(t('f.phone'), App.inp('phone', p, { type: 'tel', maxlength: 16, ph: '05xxxxxxxx' })) + '</div>' +
      '<label>' + t('f.kind') + '</label><div class="types two-c" id="kindBtns">' + ['residential', 'commercial'].map(function (k) { return '<button type="button" data-kind="' + k + '" aria-pressed="' + (p.kind === k) + '">' + App.icon(k === 'residential' ? 'villa' : 'company') + t('kind.' + k) + '</button>'; }).join('') + '</div>' +
      '<label>' + t('f.type') + '</label><div id="typeBtns">' + typeButtons(p) + '</div>';
    if (n === 2) return '<h3>' + t('wiz.cons') + '</h3>' +
      '<div class="row">' + App.fld(t('f.mode'), App.sel('mode', p, [['kwh', t('f.modeKwh')], ['bill', t('f.modeBill')]])) + App.fld(p.mode === 'bill' ? t('f.consBill') : t('f.consKwh'), App.inp('cons', p, { min: 1 }), t('f.consHint')) + '</div>' +
      '<div class="tip">' + t('wiz.consTip') + '</div>';
    if (n === 3) return '<h3>' + t('wiz.roof') + '</h3>' +
      '<div class="row">' + App.fld(t('f.city'), App.sel('city', p, App.cityOpts())) + App.fld(t('f.address'), App.inp('address', p, { type: 'text', maxlength: 120 })) + '</div>' +
      '<div class="row">' + App.fld(t('f.len'), App.inp('len', p, { min: 3, max: 300 }), t('f.lenHint')) + App.fld(t('f.wid'), App.inp('wid', p, { min: 3, max: 300 })) + '</div>' +
      '<p class="note">' + t('f.area') + ': <b id="areaT">' + fmt((p.len || 0) * (p.wid || 0)) + '</b> m²</p>' +
      App.fld(t('f.obstacle'), App.inp('obstacle', p, { min: 0 }), t('f.obstacleHint'));
    if (n === 4) {
      var sys = ['grid', 'hybrid', 'offgrid'], panels = App.lib().filter(function (e) { return e.kind === 'panel'; });
      return '<h3>' + t('wiz.sys') + '</h3><div class="types three-c" id="sysBtns">' + sys.map(function (k) { return '<button type="button" data-sys="' + k + '" aria-pressed="' + (p.system === k) + '">' + App.icon(k) + t('sys.' + k) + '<small>' + t('sys.' + k + 'T') + '</small></button>'; }).join('') + '</div>' +
        '<div id="batBox">' + batBox(p) + '</div>' +
        App.fld(t('f.panel'), App.sel('panelId', p, panels.map(function (e) { return [e.id, e.name]; })), t('f.equipHint'));
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
    return '<div class="err" id="err" role="alert"></div><div class="row wnav">' + (n > 1 ? '<button class="btn ghost" type="button" data-go="' + (n - 1) + '">' + t('prev') + '</button>' : '<span></span>') + (n < 5 ? '<button class="btn" type="button" data-go="' + (n + 1) + '">' + (n === 4 ? t('wiz.calc') : t('next')) + '</button>' : '') + '</div>';
  }
  function resultStep(p) {
    var R = App.design(p);
    if (!R.ok) return '<div class="warnbox">' + t('err.' + R.error) + '</div>';
    var h = '<div class="two wide"><div>' + App.viewerHTML(R, p) + '</div><div><div class="stats two-s">' + App.stat(t('sum.kwp'), R.kwp.toFixed(1) + ' kWp', 'est') + App.stat(t('sum.panels'), R.n, 'est') + App.stat(t('fin.cover'), Math.round(R.coverage * 100) + '%', 'est') + App.stat(t('fin.payback'), R.payback == null ? '>' + App.A().life : R.payback.toFixed(1) + ' ' + t('yr'), 'est') + '</div>' + App.warnList(R) +
      (R.bat ? '<h4>' + t('rep.bess') + '</h4>' + App.kv(t('bess.nominal'), R.bat.nominal + ' kWh', 'est') + App.kv(t('bess.backup'), R.bat.backupH.toFixed(1) + ' h', 'est') : '') + '</div></div>';
    h += '<h3>' + t('rep.components') + '</h3>' + App.compTable(R, true) + '<h3>' + t('rep.financial') + '</h3>' + App.finTable(R);
    h += '<div class="card inner" id="saveBox"><div class="row"><button class="btn" id="saveBtn" type="button">' + t('proj.save') + '</button><button class="btn ghost" id="reportBtn" type="button">' + t('rep.open') + '</button></div><div id="saveMsg" class="note" role="status"></div></div>';
    h += '<div class="card inner" id="reqBox"><h4>' + t('req.submit') + '</h4><p class="note">' + t('req.submitNote') + '</p><div class="row">' + App.fld(t('f.cname'), '<input id="rq-name" type="text" maxlength="80" value="' + esc(p.customerName) + '">') + App.fld(t('f.phone'), '<input id="rq-phone" type="tel" inputmode="tel" maxlength="16" placeholder="05xxxxxxxx" value="' + esc(p.phone) + '">') + '</div>' +
      '<div class="err" id="rq-err" role="alert"></div><button class="btn" id="rqBtn" type="button">' + t('req.send') + '</button><div id="rq-ok"></div></div>';
    return h;
  }
  function saveDraft(p) {
    var s = S(), i = -1; s.projects.forEach(function (x, k) { if (x.id === p.id) i = k; });
    if (!p.name) p.name = t('proj.untitled') + ' ' + (s.projects.length + 1);
    if (i >= 0) s.projects[i] = JSON.parse(JSON.stringify(p)); else s.projects.unshift(JSON.parse(JSON.stringify(p)));
    App.persist();
  }
  function validPhone(v) { return /^(05\d{8}|\+9665\d{8}|9665\d{8})$/.test(String(v).replace(/[\s-]/g, '')); }

  V.design = function () {
    var p = draft(), n = UI.step;
    var R = n === 5 ? App.design(p) : null;
    var h = '<div class="stack"><div class="card">' + stepper() + '<div id="stepBody">' + stepBody(p) + (n === 5 ? resultStep(p) : '') + '</div>' + nav(n) + '</div></div>';
    return { html: h, sum: n === 5 && R && R.ok ? App.summaryHTML(R) : (n >= 4 ? App.summaryHTML(App.design(p)) : false), bind: function () {
      var showErr = function (m) { var e = $('#err'); if (e) e.textContent = m; };
      $$('.steps button').forEach(function (b) { b.onclick = function () { jump(+b.dataset.step); }; });
      $$('[data-go]').forEach(function (b) { b.onclick = function () { jump(+b.dataset.go); }; });
      function jump(to) {
        if (to > UI.step) {
          var chk = App.design(p);
          if (UI.step >= 2 && to >= 3 && !(Number(p.cons) > 0)) { UI.step = 2; App.persist(); App.route(); return setTimeout(function () { showErr(t('err.cons')); }, 0); }
          if (to >= 4 && chk.error === 'dims') { UI.step = 3; App.route(); return setTimeout(function () { showErr(t('err.dims')); }, 0); }
          if (to >= 5 && !chk.ok) { UI.step = chk.error === 'cons' ? 2 : 3; App.route(); return setTimeout(function () { showErr(t('err.' + chk.error)); }, 0); }
        }
        UI.step = to; App.route();
      }
      App.bindFields($('#stepBody'), p, function (path) {
        if (path === 'len' || path === 'wid') { var a = $('#areaT'); if (a) a.textContent = fmt((p.len || 0) * (p.wid || 0)); }
        if (path === 'mode') App.route();
        if (path === 'battery.need') { $('#batBox').innerHTML = batBox(p); App.bindFields($('#batBox'), p); }
      });
      $$('[data-kind]').forEach(function (b) { b.onclick = function () { p.kind = b.dataset.kind; p.type = p.kind === 'residential' ? 'villa' : 'company'; App.persist(); App.route(); }; });
      $$('[data-type]').forEach(function (b) { b.onclick = function () { p.type = b.dataset.type; App.persist(); App.route(); }; });
      $$('[data-sys]').forEach(function (b) { b.onclick = function () { p.system = b.dataset.sys; if (!p.battery) p.battery = {}; if (p.system === 'offgrid') { p.battery.need = true; p.battery.hours = Math.max(p.battery.hours || 0, 12); } App.persist(); App.route(); }; });
      if (n === 5 && R && R.ok) {
        App.bindViewer(R, p, {});
        $('#saveBtn').onclick = function () { saveDraft(p); $('#saveMsg').textContent = t('proj.saved'); };
        $('#reportBtn').onclick = function () { saveDraft(p); UI.sel = p.id; App.go('report'); };
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
