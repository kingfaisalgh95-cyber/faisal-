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

  // ----- landing (marketing page, no invented figures: the example is computed live by the engine) -----
  var EXAMPLE = { type: 'villa', city: 'riyadh', len: 10, wid: 15, mode: 'bill', cons: 600, system: 'grid', tilt: 10, azDev: 0, shade: 'none', panelId: 'jkm580' };
  V.dashboard = function () {
    var s = S(), R = App.design(St.newProject(EXAMPLE)), h = '<div class="stack landing">';
    h += '<div class="hero"><div class="txt"><h1>' + t('lp.h1') + '</h1><p>' + t('lp.sub') + '</p><a class="btn" href="#design" id="startCta">' + t('lp.cta') + ' ←</a>' + (s.projects.length ? ' <a class="btn ghost" href="#projects">' + t('lp.cta2') + '</a>' : '') + '</div>' + App.heroArt() + '</div>';
    h += '<div class="card"><h3>' + t('lp.stepsT') + '</h3><ol class="lpsteps">' + [1, 2, 3].map(function (i) { return '<li><i>' + i + '</i><div><b>' + t('lp.s' + i + 't') + '</b><p class="note">' + t('lp.s' + i + 'd') + '</p></div></li>'; }).join('') + '</ol></div>';
    h += '<div class="two"><div class="card"><h3>' + t('lp.getT') + '</h3><ul class="lplist">' + [1, 2, 3, 4, 5].map(function (i) { return '<li>' + t('lp.g' + i) + '</li>'; }).join('') + '</ul></div>';
    if (R.ok) h += '<div class="card"><h3>' + t('lp.exT') + '</h3><p class="note">' + t('lp.exD') + '</p>' + App.kv(t('sum.kwp'), R.kwp.toFixed(1) + ' kWp (' + R.n + ' × ' + R.panel.watt + ' W)') + App.kv(t('sum.prod'), fmt(R.prodLow) + ' – ' + fmt(R.prod) + ' kWh/' + t('yr')) + App.kv(t('flow.direct'), fmt(R.flows.direct) + ' kWh') + App.kv(t('flow.export'), fmt(R.flows.exported) + ' kWh') + App.kv(t('fin.payback'), App.paybackText(R)) + '<p class="note">' + t('lp.exNote') + '</p></div>';
    h += '</div><div class="card"><h3>' + t('lp.howT') + '</h3><p>' + t('lp.howD') + '</p><p class="note">' + t('lp.honest') + '</p></div></div>';
    return { html: h, bind: function () { var b = $('#startCta'); if (b) b.onclick = function () { UI.step = 1; s.draft = null; }; } };
  };
  // ----- projects -----
  V.projects = function () {
    var s = S();
    var h = '<div class="card"><div class="head"><h3>' + t('nav.customer.projects') + '</h3><div class="acts"><a class="btn small" href="#design" id="newBtn">' + t('proj.new') + '</a><button class="btn small ghost" id="sampleBtn">' + t('proj.sample') + '</button></div></div>' +
      '<p class="note">' + t('proj.local') + '</p>' + (s.projects.length ? '<div class="list">' + s.projects.map(function (p) { return App.projectRow(p); }).join('') + '</div>' : '<div class="empty">' + t('proj.none') + '</div>') + '</div>';
    return { html: h, bind: function () {
      App.bindProjectList(function (id) { s.draft = JSON.parse(JSON.stringify(findProject(id))); UI.step = 3; App.persist(); App.go('design'); });
      $('#newBtn').onclick = function () { s.draft = null; UI.step = 1; };
      $('#sampleBtn').onclick = function () { s.projects.unshift(St.sampleProject()); App.persist(); App.route(); };
    } };
  };

  // ----- design studio: 3 steps (building, optional details, result) with a live 2D/3D preview -----
  function draft() {
    var s = S();
    if (!s.draft) { s.draft = St.newProject({ customerName: s.profile.name, phone: s.profile.phone, city: s.profile.city, len: '', wid: '', cons: '', mode: 'bill', ac: { units: 4, tons: 2, hours: 10 } }); App.persist(); }
    if (!s.draft.ac) s.draft.ac = { units: 4, tons: 2, hours: 10 };
    return s.draft;
  }
  var STEPS = ['s1', 's2', 's3'];
  function stepper() {
    return '<div class="steps">' + STEPS.map(function (k, i) { var n = i + 1, c = n === UI.step ? 'on' : (n < UI.step ? 'done' : ''); return '<button type="button" class="' + c + '" data-step="' + n + '"' + (n === UI.step ? ' aria-current="step"' : '') + '><i>' + (n < UI.step ? '✓' : n) + '</i><span>' + t('wiz.' + k) + '</span></button>'; }).join('') + '</div>';
  }
  function typeChips(p) {
    return '<div class="types four-c" role="group" aria-label="' + t('f.type') + '">' + Object.keys(C.TYPES).map(function (k) {
      return '<button type="button" data-type="' + k + '" aria-pressed="' + (p.type === k) + '">' + App.icon(k) + t('type.' + k) + '</button>';
    }).join('') + '</div>';
  }
  function consBlock(p) {
    var h = App.fld(t('f.mode'), App.sel('mode', p, [['bill', t('f.modeBill')], ['kwh', t('f.modeKwh')], ['ac', t('f.modeAc')]]));
    if (p.mode === 'ac') return h + '<div class="row">' + App.fld(t('ac.units'), App.inp('ac.units', p, { min: 1, max: 200 })) + App.fld(t('ac.tons'), App.inp('ac.tons', p, { min: 0.5, max: 10, step: 0.5 })) + '</div>' + App.fld(t('ac.hours'), App.inp('ac.hours', p, { min: 1, max: 24 }), t('ac.note'));
    return h + App.fld(p.mode === 'bill' ? t('f.consBill2') : t('f.consKwh2'), App.inp('cons', p, { min: 1 }), t('f.consHint2'));
  }
  function stepBody(p) {
    var n = UI.step;
    if (n === 1) {
      var sys = ['grid', 'hybrid', 'offgrid'];
      return '<h3>' + t('w.s1t') + '</h3><p class="note">' + t('w.s1h') + '</p>' +
        '<label>' + t('f.type') + '</label>' + typeChips(p) + App.fld(t('f.city'), App.sel('city', p, App.cityOpts())) +
        '<h4>' + t('w.loadT') + '</h4><div id="consBox">' + consBlock(p) + '</div>' +
        '<h4>' + t('w.roofT') + '</h4><div class="row">' + App.fld(t('f.len'), App.inp('len', p, { min: 3, max: 300 }), t('f.lenHint')) + App.fld(t('f.wid'), App.inp('wid', p, { min: 3, max: 300 })) + '</div><p class="note">' + t('f.area') + ': <b id="areaT">' + fmt((p.len || 0) * (p.wid || 0)) + '</b> m²</p>' +
        '<h4>' + t('w.sysT') + '</h4><div class="types three-c" id="sysBtns">' + sys.map(function (k) { return '<button type="button" data-sys="' + k + '" aria-pressed="' + (p.system === k) + '">' + App.icon(k) + t('sys.' + k) + '<small>' + t('sys.' + k + 'T') + '</small></button>'; }).join('') + '</div><div id="batBox">' + batBox(p) + '</div>';
    }
    if (n === 2) {
      var azv = (p.azDev === '' || p.azDev == null) ? '' : String(p.azDev);
      return '<h3>' + t('w.s2t') + '</h3><p class="note">' + t('w.s2h') + '</p>' +
        '<div class="row">' + App.fld(t('f.az'), '<select data-f="azDev" data-num="1" id="f-azDev"><option value=""' + (azv === '' ? ' selected' : '') + '>' + t('az.unk') + '</option>' + [0, 45, 90, 180].map(function (d) { return '<option value="' + d + '"' + (azv === String(d) ? ' selected' : '') + '>' + t('az.' + d) + '</option>'; }).join('') + '</select>') + App.fld(t('f.tilt'), App.inp('tilt', p, { min: 0, max: 35 }), t('f.tiltHint')) + '</div>' +
        App.fld(t('f.shade'), App.sel('shade', p, [['unknown', t('shade.unknown')], ['none', t('shade.none')], ['some', t('shade.some')]])) +
        (p.shade === 'some' ? App.fld(t('f.obsArea'), App.inp('obstacle', p, { min: 0, max: 5000 }), t('f.obsHint')) : '') +
        App.fld(t('f.daytime'), App.sel('daytime', p, [['normal', t('day.normal')], ['low', t('day.low')], ['high', t('day.high')]]), t('f.dayHint')) +
        App.fld(t('f.budget'), App.inp('budget', p, { min: 0, step: 1000 }), t('f.budgetHint')) +
        App.fld(t('f.photo'), '<input type="file" id="photoIn" accept="image/*">' + (p.photo ? '<div class="photo"><img alt="" src="' + p.photo + '"><button class="btn ghost small" type="button" id="photoDel">' + t('photo.remove') + '</button></div>' : ''), t('f.photoHint')) +
        accBox(App.design(p), true);
    }
    return '';
  }
  function batBox(p) {
    if (p.system === 'grid') return '<p class="note">' + t('sys.gridNote') + '</p>';
    var must = p.system === 'offgrid';
    return '<div class="card inner"><h4>' + t('bat.title') + '</h4>' + (must ? '<p class="note">' + t('bat.must') + '</p>' : App.chk('battery.need', p, t('bat.need'))) +
      ((must || (p.battery && p.battery.need)) ? '<div class="row">' + App.fld(t('bat.hours'), App.inp('battery.hours', p, { min: 1, max: 48 }), t('bat.hoursHint')) + App.fld(t('bat.kw'), App.inp('battery.criticalKw', p, { min: 0.5, max: 500, step: 0.5 }), t('bat.kwHint')) + '</div>' : '') + '</div>';
  }
  // accuracy: what the production range is and which missing inputs widen it
  function accBox(R, canEdit) {
    if (!R || !R.ok) return '';
    var c = R.conf, miss = c.missing.map(function (m) { return t('acc.m.' + m); });
    return '<div class="acc acc-' + c.level + '" id="accBox"><div class="head"><b>' + t('acc.title') + ': ' + t('acc.' + c.level) + '</b><span>' + t('acc.range', { p: c.rangePct }) + '</span></div><div class="bar" aria-hidden="true"><i style="width:' + Math.max(8, 100 - c.rangePct * 2.5) + '%"></i></div>' +
      (miss.length ? '<p class="note">' + t('acc.improve') + ' ' + miss.join('، ') + '</p>' : '') + (canEdit === 'edit' ? '<button class="btn ghost small" type="button" id="accEdit">' + t('acc.edit') + '</button>' : '') + '</div>';
  }
  function nav(n) {
    var last = n === 3, skip = n === 2;
    return '<div class="err" id="err" role="alert"></div><div class="row wnav">' + (n > 1 ? '<button class="btn ghost" type="button" data-go="' + (n - 1) + '">' + t('prev') + '</button>' : '<span></span>') +
      (n === 1 ? '<button class="btn" type="button" data-go="2">' + t('next') + ' ←</button>' : '') + (skip ? '<button class="btn ghost" type="button" data-go="3" id="skipBtn">' + t('w.skip') + '</button><button class="btn" type="button" data-go="3">' + t('w.toResult') + ' ←</button>' : '') + '</div>';
  }
  function saveDraft(p) {
    var s = S(), i = -1; s.projects.forEach(function (x, k) { if (x.id === p.id) i = k; });
    if (!p.name) p.name = t('proj.untitled') + ' ' + (s.projects.length + 1);
    if (i >= 0) s.projects[i] = JSON.parse(JSON.stringify(p)); else s.projects.unshift(JSON.parse(JSON.stringify(p)));
    App.persist();
  }
  function validPhone(v) { return /^(05\d{8}|\+9665\d{8}|9665\d{8})$/.test(String(v).replace(/[\s-]/g, '')); }

  var liveTimer = null;
  function live(p, edit) {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      var R = App.design(p), ph = $('#vphold');
      if (!R.ok) { App.setSummary(R); if (ph) { ph.hidden = false; ph.textContent = t('err.' + R.error); } var v = $('#viewer'); if (v) v.hidden = true; return; }
      if (ph) ph.hidden = true; var vv = $('#viewer'); if (vv) vv.hidden = false;
      App.showViewer(R, p, { keep: true, edit: edit });
      App.setSummary(R);
      var ab = $('#accBox'); if (ab) ab.outerHTML = accBox(R, false);
    }, 140);
  }
  function viewerBlock(R, p) {
    return '<div class="card vcol">' + App.viewerHTML() + '<div class="warnbox" id="vphold"' + (R.ok ? ' hidden' : '') + '>' + (R.ok ? '' : t('err.' + R.error)) + '</div></div>';
  }
  function specsTable(R) {
    var rows = [[t('sum.panel'), R.panel.name], [t('c.power'), R.panel.watt + ' W × ' + R.n + ' = ' + R.kwp.toFixed(2) + ' kWp'], [t('sum.inv'), R.inv.name + ' × ' + R.invQty], [t('el.dcac'), R.dcac.toFixed(2)], [t('as.tilt'), R.tilt + '°'], [t('as.spacing'), R.pitchY.toFixed(2) + ' m'], [t('f.area'), fmt(R.W * R.L) + ' m²'], [t('fin.prod'), fmt(R.prod) + ' kWh/' + t('yr')]];
    return '<div class="tblwrap"><table><tbody>' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td><b>' + esc(String(r[1])) + '</b></td></tr>'; }).join('') + '</tbody></table></div><p class="note">' + t('rep.unverified') + '</p>';
  }
  // size options: one card per size (readable on a phone), best by NPV highlighted, budget flag
  function sizeOptions(R, p) {
    if (!R.sizing || !R.sizing.rows.length) return '';
    var bud = Number(p.budget) || 0, best = R.sizing.best;
    return '<div class="card"><h3>' + t('res.optT') + '</h3><p class="note">' + t('res.optN') + '</p>' + (best && Math.abs(best.pct - R.sizePct) >= 1 ? '<div class="warnbox">' + t('res.rec', { p: best.pct, k: best.kwp.toFixed(1) }) + ' <button class="btn small" type="button" data-size="' + best.pct + '">' + t('res.recBtn') + '</button></div>' : '') + '<div class="opts">' + R.sizing.rows.map(function (r) {
      var cur = Math.abs(r.pct - R.sizePct) < 1, pay = r.payback == null ? t('res.none') + A_life() : r.payback.toFixed(1) + ' ' + t('res.yrs');
      return '<div class="opt' + (cur ? ' cur' : '') + '"><div class="oh"><b>' + r.pct + '%</b><span>' + r.kwp.toFixed(1) + ' kWp · ' + r.n + '</span>' + (best && r.pct === best.pct ? '<em>' + t('res.best') + '</em>' : '') + (bud ? '<em class="' + (r.cost > bud ? 'over' : 'in') + '">' + t(r.cost > bud ? 'res.over' : 'res.in') + '</em>' : '') + '</div>' +
        '<div class="ob">' + App.kv(t('res.cost'), money(r.cost)) + App.kv(t('res.save'), money(r.save)) + App.kv(t('res.pay'), pay) + App.kv(t('res.exp'), Math.round(r.exportShare * 100) + '%') + App.kv(t('res.npv'), money(r.npv)) + '</div>' +
        '<button class="btn small' + (cur ? '' : ' ghost') + '" type="button" data-size="' + r.pct + '"' + (cur ? ' disabled' : '') + '>' + (cur ? t('res.cur') : t('res.pick')) + '</button></div>';
    }).join('') + '</div></div>';
  }
  function A_life() { return App.A().life; }
  function resultStep(p, R) {
    if (!R.ok) return '<div class="warnbox">' + t('err.' + R.error) + '</div>';
    var tab = UI.dtab || 'comp', tabs = [['comp', t('tab.comp')], ['spec', t('tab.spec')], ['cost', t('tab.cost')]];
    var body = tab === 'comp' ? App.compTable(R, false) : tab === 'spec' ? specsTable(R) : App.compTable(R, true) + App.finTable(R);
    return accBox(R, 'edit') + '<div class="dgrid"><div class="card vcol">' + App.viewerHTML() + '</div>' +
      '<div class="dside"><div class="card"><h3>' + t('tab.title') + '</h3><div class="tabs" role="tablist">' + tabs.map(function (x) { return '<button type="button" role="tab" data-dtab="' + x[0] + '" aria-selected="' + (tab === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div><div class="tabbody">' + body + '</div></div></div></div>' +
      App.warnList(R) + sizeOptions(R, p) + (R.bat ? '<div class="card"><h4>' + t('rep.bess') + '</h4>' + App.kv(t('bess.nominal'), R.bat.nominal + ' kWh', 'est') + App.kv(t('bess.backup'), R.bat.backupH.toFixed(1) + ' h', 'est') + '</div>' : '') +
      '<div class="dgrid"><div class="card"><h3>' + t('res.actions') + '</h3><div class="row wnav"><button class="btn" id="saveBtn" type="button">' + t('proj.save') + '</button><button class="btn ghost" id="reportBtn" type="button">' + t('rep.open') + '</button></div><div id="saveMsg" class="note" role="status"></div>' +
      '<div class="replist">' + [['plan', t('rep.l.plan')], ['specs', t('rep.l.specs')], ['save', t('rep.l.save')]].map(function (x) { return '<button type="button" class="repbtn" data-rep="' + x[0] + '">' + App.icon('doc') + '<span>' + x[1] + '</span></button>'; }).join('') + '</div></div>' +
      '<div class="dside"><div class="card" id="reqBox"><h3>' + t('req.submit') + '</h3><p class="note">' + t('req.submitNote') + '</p><div class="row">' + App.fld(t('f.cname'), '<input id="rq-name" type="text" maxlength="80" value="' + esc(p.customerName) + '">') + App.fld(t('f.phone'), '<input id="rq-phone" type="tel" inputmode="tel" maxlength="16" placeholder="05xxxxxxxx" value="' + esc(p.phone) + '">') + '</div>' +
      '<div class="err" id="rq-err" role="alert"></div><button class="btn" id="rqBtn" type="button">' + t('req.send') + '</button><div id="rq-ok"></div></div></div></div>';
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

  V.design = function () {
    var p = draft(), n = UI.step > 3 ? 3 : UI.step, R = App.design(p), h; UI.step = n;
    if (n <= 2) h = '<div class="stack"><div class="card">' + stepper() + '</div><div class="studio"><div class="card fcol"><div id="stepBody">' + stepBody(p) + '</div>' + nav(n) + '</div>' + viewerBlock(R, p) + '</div></div>';
    else h = '<div class="stack"><div class="card">' + stepper() + '</div>' + resultStep(p, R) + '<div class="card">' + nav(n) + '</div></div>';
    return { html: h, sum: App.summaryHTML(R), bind: function () {
      var showErr = function (m) { var e = $('#err'); if (e) e.textContent = m; };
      $$('.steps button').forEach(function (b) { b.onclick = function () { jump(+b.dataset.step); }; });
      $$('[data-go]').forEach(function (b) { b.onclick = function () { jump(+b.dataset.go); }; });
      function jump(to) {
        if (to > UI.step) {
          var chk = App.design(p);
          if (chk.error === 'dims' || chk.error === 'cons' || chk.error === 'ac') { UI.step = 1; App.persist(); App.route(); return setTimeout(function () { showErr(t('err.' + chk.error)); }, 0); }
          if (to >= 3 && !chk.ok) { UI.step = 1; App.route(); return setTimeout(function () { showErr(t('err.' + chk.error)); }, 0); }
        }
        UI.step = to; App.route();
      }
      if (n <= 2) {
        App.bindFields($('#stepBody'), p, function (path) {
          if (path === 'len' || path === 'wid') { var a = $('#areaT'); if (a) a.textContent = fmt((p.len || 0) * (p.wid || 0)); }
          if (path === 'mode' || path === 'shade') return App.route();
          if (path === 'battery.need') { $('#batBox').innerHTML = batBox(p); App.bindFields($('#batBox'), p, function () { live(p); }); }
          if (path === 'azDev' && p.azDev === '') delete p.azDev;
          live(p);
        });
        $$('[data-type]').forEach(function (b) { b.onclick = function () { p.type = b.dataset.type; p.kind = C.TYPES[p.type].kind; App.persist(); $$('[data-type]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); live(p); }; });
        $$('[data-sys]').forEach(function (b) { b.onclick = function () { p.system = b.dataset.sys; if (!p.battery) p.battery = {}; if (p.system === 'offgrid') { p.battery.need = true; p.battery.hours = Math.max(p.battery.hours || 0, 12); } App.persist(); App.route(); }; });
        var pin = $('#photoIn'); if (pin) pin.onchange = function () { var f = pin.files && pin.files[0]; if (!f) return; shrinkPhoto(f, function (d) { if (!d) return showErr(t('photo.err')); p.photo = d; App.persist(); App.route(); }); };
        var pd = $('#photoDel'); if (pd) pd.onclick = function () { delete p.photo; App.persist(); App.route(); };
        App.bindViewer(R, p, {});
      }
      if (n === 3 && R.ok) {
        App.bindViewer(R, p, { edit: true, onEdit: function () { App.route(); } });
        $$('[data-dtab]').forEach(function (b) { b.onclick = function () { UI.dtab = b.dataset.dtab; App.route(); }; });
        $$('[data-size]').forEach(function (b) { b.onclick = function () { p.sizePct = +b.dataset.size; p.manual = false; App.persist(); App.route(); }; });
        var ae = $('#accEdit'); if (ae) ae.onclick = function () { UI.step = 2; App.route(); };
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
