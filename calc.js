/* Shaqaf Energy — calculation engine v2
   Every figure is an ESTIMATE until a site survey and an engineering study confirm it.
   All assumptions live in DEFAULTS and can be overridden per organisation (Settings). */
(function (root) {
  'use strict';

  var DEFAULTS = {
    life: 25,          // system life (years)
    degr: 0.5,         // panel degradation (%/yr)
    esc: 0,            // electricity tariff escalation (%/yr). 0 = conservative
    om: 1,             // O&M (% of capex per year)
    disc: 6,           // discount rate (%)
    replYear: 12, replPct: 10, // inverter replacement: year, % of capex
    battPerKwh: 1800,  // SAR per kWh of battery
    co2: 0.0006,       // tCO2 per kWh
    sunElev: 30,       // sun elevation (deg) used for row spacing
    tminC: 5, tcellMax: 70, // design temperatures for string sizing (C)
    margin: 1,         // roof edge setback (m)
    gap: 0.02,         // gap between panels (m)
    dropDC: 1, dropAC: 2, // allowed voltage drop (%)
    cuK: 48,           // copper conductivity at operating temperature (m/ohm.mm2)
    offgridOversize: 1.3,
    costBands: [[10, 3800], [50, 3300], [1e9, 2800]], // SAR/kWp by system size (kWp upper bound)
    split: { panels: 0.38, inverter: 0.17, mounting: 0.12, cables: 0.08, install: 0.20, other: 0.05 },
    tariffs: { // [rate up to limit, limit kWh/month, rate above]
      villa: [0.18, 6000, 0.30], company: [0.20, 6000, 0.30], warehouse: [0.20, 6000, 0.30], factory: [0.18, 1e12, 0.18]
    }
  };

  var CITIES = {
    riyadh: { ar: 'الرياض', en: 'Riyadh', yield: 1700 }, jeddah: { ar: 'جدة', en: 'Jeddah', yield: 1650 },
    dammam: { ar: 'الدمام', en: 'Dammam', yield: 1600 }, tabuk: { ar: 'تبوك', en: 'Tabuk', yield: 1750 },
    abha: { ar: 'أبها', en: 'Abha', yield: 1620 }, buraidah: { ar: 'بريدة', en: 'Buraidah', yield: 1700 },
    madinah: { ar: 'المدينة المنورة', en: 'Madinah', yield: 1720 }, makkah: { ar: 'مكة المكرمة', en: 'Makkah', yield: 1660 }
  };
  var TYPES = {
    villa: { kind: 'residential', height: 7 }, company: { kind: 'commercial', height: 12 },
    warehouse: { kind: 'commercial', height: 8 }, factory: { kind: 'commercial', height: 10 }
  };

  // Generic typical equipment. verified:false means "typical values, not checked against a datasheet".
  var DEF_EQUIP = [
    { id: 'pv550', kind: 'panel', name: 'Mono PERC 550W (typical)', maker: 'Generic', watt: 550, voc: 49.6, vmp: 41.5, isc: 14.0, imp: 13.25, tcVoc: -0.27, tcPmax: -0.35, len: 2.278, wid: 1.134, verified: false },
    { id: 'inv5h', kind: 'inverter', name: 'Hybrid 5kW 1-ph (typical)', maker: 'Generic', kw: 5, phase: 1, vmax: 600, mpptMin: 90, mpptMax: 520, mppts: 2, iscMax: 32, hybrid: true, verified: false },
    { id: 'inv10h', kind: 'inverter', name: 'Hybrid 10kW 3-ph (typical)', maker: 'Generic', kw: 10, phase: 3, vmax: 1000, mpptMin: 160, mpptMax: 850, mppts: 2, iscMax: 32, hybrid: true, verified: false },
    { id: 'inv20g', kind: 'inverter', name: 'Grid 20kW 3-ph (typical)', maker: 'Generic', kw: 20, phase: 3, vmax: 1100, mpptMin: 200, mpptMax: 1000, mppts: 2, iscMax: 40, hybrid: false, verified: false },
    { id: 'inv50g', kind: 'inverter', name: 'Grid 50kW 3-ph (typical)', maker: 'Generic', kw: 50, phase: 3, vmax: 1100, mpptMin: 200, mpptMax: 1000, mppts: 5, iscMax: 40, hybrid: false, verified: false },
    { id: 'inv100g', kind: 'inverter', name: 'Grid 100kW 3-ph (typical)', maker: 'Generic', kw: 100, phase: 3, vmax: 1100, mpptMin: 200, mpptMax: 1000, mppts: 10, iscMax: 40, hybrid: false, verified: false },
    { id: 'bat10', kind: 'battery', name: 'LFP rack 10kWh (typical)', maker: 'Generic', kwh: 10, kw: 5, dod: 90, rte: 94, verified: false }
  ];

  var STD_BREAKER = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630];
  var STD_FUSE = [10, 12, 15, 20, 25, 30];
  var DC_CABLES = [[4, 55], [6, 70], [10, 98], [16, 132], [25, 176], [35, 218], [50, 276], [70, 347], [95, 416]];
  var AC_CABLES = [[4, 32], [6, 41], [10, 57], [16, 76], [25, 101], [35, 125], [50, 151], [70, 192], [95, 232], [120, 269], [150, 309], [185, 353], [240, 415]];

  function A_(A) { return Object.assign({}, DEFAULTS, A || {}); }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function nextStd(list, v) { for (var i = 0; i < list.length; i++) if (list[i] >= v) return list[i]; return list[list.length - 1]; }
  function equip(lib, id, kind) { var l = (lib && lib.length ? lib : DEF_EQUIP).filter(function (e) { return e.kind === kind; }); return l.filter(function (e) { return e.id === id; })[0] || l[0]; }

  // ---------- tariff ----------
  function billFromKwh(kwh, type, A) { var t = A_(A).tariffs[type] || A_(A).tariffs.villa; return kwh <= t[1] ? kwh * t[0] : t[1] * t[0] + (kwh - t[1]) * t[2]; }
  function kwhFromBill(bill, type, A) { var t = A_(A).tariffs[type] || A_(A).tariffs.villa, f = t[1] * t[0]; return bill <= f ? bill / t[0] : t[1] + (bill - f) / t[2]; }
  function costRate(kwp, A) { var b = A_(A).costBands; for (var i = 0; i < b.length; i++) if (kwp < b[i][0]) return b[i][1]; return b[b.length - 1][1]; }

  // ---------- cables ----------
  // kind: 'dc' (2 wires), 'ac1' (single phase), 'ac3' (three phase)
  function cableSize(o, A) {
    A = A_(A);
    var table = o.kind === 'dc' ? DC_CABLES : AC_CABLES, pf = o.pf || 1;
    var dV = o.drop / 100 * o.V;
    var need = o.kind === 'ac3' ? Math.sqrt(3) * o.L * o.Ivd * pf / (A.cuK * dV) : 2 * o.L * o.Ivd * (o.kind === 'dc' ? 1 : pf) / (A.cuK * dV);
    var pick = table[table.length - 1];
    for (var i = 0; i < table.length; i++) if (table[i][0] >= need && table[i][1] >= o.Idesign) { pick = table[i]; break; }
    var dropReal = (o.kind === 'ac3' ? Math.sqrt(3) * o.L * o.Ivd * pf : 2 * o.L * o.Ivd * (o.kind === 'dc' ? 1 : pf)) / (A.cuK * pick[0]) / o.V * 100;
    return { mm2: pick[0], ampacity: pick[1], dropPct: dropReal, minArea: need };
  }

  // ---------- strings ----------
  function stringConfig(n, panel, inv, qty, A) {
    A = A_(A);
    var vocCold = panel.voc * (1 + panel.tcVoc / 100 * (A.tminC - 25));
    var vmpHot = panel.vmp * (1 + panel.tcPmax / 100 * (A.tcellMax - 25));
    var maxS = Math.floor(inv.vmax / vocCold), minS = Math.ceil(inv.mpptMin / vmpHot), topS = Math.min(maxS, Math.floor(inv.mpptMax / panel.vmp));
    var perMppt = Math.max(1, Math.floor(inv.iscMax / panel.isc)), cap = inv.mppts * perMppt * qty;
    var r = { vocCold: vocCold, vmpHot: vmpHot, minS: minS, maxS: maxS, topS: topS, cap: cap, warn: [] };
    if (n < 1) { r.series = 0; r.strings = 0; r.leftover = 0; r.ok = false; return r; }
    if (minS > topS) { r.series = 0; r.strings = 0; r.leftover = n; r.ok = false; r.warn.push('noWindow'); return r; }
    var best = null;
    for (var s = minS; s <= topS; s++) {
      var st = Math.floor(n / s), left = n - s * st;
      if (st < 1) continue;
      var c = { s: s, st: st, left: left, fits: st <= cap };
      if (!best || (c.fits && !best.fits) || (c.fits === best.fits && (c.left < best.left || (c.left === best.left && c.s > best.s)))) best = c;
    }
    if (!best) { r.series = 0; r.strings = 0; r.leftover = n; r.ok = false; r.warn.push('tooFew'); return r; }
    r.series = best.s; r.strings = best.st; r.leftover = best.left; r.ok = best.fits;
    r.vStringOc = best.s * vocCold; r.vStringMp = best.s * panel.vmp;
    if (!best.fits) r.warn.push('capacity');
    if (best.left > 0) r.warn.push('unallocated');
    return r;
  }

  // ---------- BESS ----------
  function bess(o) {
    var dod = num(o.dod, 90) / 100, rte = num(o.rte, 94) / 100, eta = Math.sqrt(rte), kw = Math.max(0.1, num(o.criticalKw, 3)), h = Math.max(0.1, num(o.hours, 4));
    var unit = num(o.unitKwh, 10), unitKw = num(o.unitKw, 5);
    var needKwh = kw * h, nominalReq = needKwh / (dod * eta), units = Math.ceil(nominalReq / unit), nominal = units * unit;
    var usable = nominal * dod, deliverable = usable * eta, backupH = deliverable / kw;
    var pcsKw = Math.max(Math.ceil(kw), Math.ceil(num(o.chargeKw, 0)));
    var unitsForPower = Math.ceil(pcsKw / unitKw);
    var chargeKw = num(o.chargeKw, 0) || Math.min(pcsKw, nominal / 4);
    var arch = o.arch === 'dc' ? 'dc' : 'ac';
    var chain = arch === 'dc' ? 0.98 * rte * 0.97 : 0.97 * 0.97 * rte * 0.97; // PV->battery->load, typical converter efficiencies
    return { needKwh: needKwh, units: units, nominal: nominal, usable: usable, deliverable: deliverable, backupH: backupH, pcsKw: pcsKw,
      unitsForPower: unitsForPower, powerLimited: unitsForPower > units, chargeKw: chargeKw, chargeTimeH: usable / (chargeKw * eta),
      cRate: pcsKw / nominal, arch: arch, chain: chain, dod: dod * 100, rte: rte * 100, criticalKw: kw, hours: h };
  }

  // ---------- financial ----------
  function financial(cost, save1, prod, A) {
    A = A_(A);
    var flow = [], cum = -cost, npv = -cost, pay = null, gross = 0, energy = 0, pvCost = cost, pvEnergy = 0;
    for (var y = 1; y <= A.life; y++) {
      var f = Math.pow(1 - A.degr / 100, y - 1), s = save1 * f * Math.pow(1 + A.esc / 100, y - 1);
      var om = cost * A.om / 100, rep = y === A.replYear ? cost * A.replPct / 100 : 0, net = s - om - rep, d = Math.pow(1 + A.disc / 100, y);
      gross += s; cum += net; npv += net / d; pvCost += (om + rep) / d; pvEnergy += prod * f / d;
      if (pay === null && cum >= 0) pay = (y - 1) + (-(cum - net) / net);
      flow.push(Math.round(cum));
    }
    return { flow: flow, payback: pay, lifetimeGross: gross, lifetimeNet: cum, npv: npv, lcoe: pvEnergy > 0 ? pvCost / pvEnergy : 0 };
  }

  // ---------- main design ----------
  function design(p, A, lib) {
    A = A_(A); p = p || {};
    var type = TYPES[p.type] ? p.type : 'villa', city = CITIES[p.city] || CITIES.riyadh, system = ['grid', 'hybrid', 'offgrid'].indexOf(p.system) >= 0 ? p.system : 'grid';
    var L = num(p.len, 0), W = num(p.wid, 0), cons = num(p.cons, 0);
    if (!(L >= 3 && L <= 300 && W >= 3 && W <= 300)) return { ok: false, error: 'dims' };
    if (!(cons > 0)) return { ok: false, error: 'cons' };
    var panel = equip(lib, p.panelId, 'panel');
    var monthly = Math.max(100, p.mode === 'bill' ? kwhFromBill(cons, type, A) : cons), annual = monthly * 12;
    var tilt = Math.min(35, Math.max(0, num(p.tilt, 10))), t = tilt * Math.PI / 180;
    var fp = panel.len * Math.cos(t), pitchX = panel.wid + A.gap, pitchY = fp + panel.len * Math.sin(t) / Math.tan(A.sunElev * Math.PI / 180);
    var D = L - 2 * A.margin, cols = Math.max(0, Math.floor((W - 2 * A.margin) / pitchX)), rows = D >= fp ? Math.floor((D - fp) / pitchY) + 1 : 0;
    var total = cols * rows, obsArea = Math.max(0, num(p.obstacle, 0)), blocked = Math.min(total, Math.ceil(obsArea / (pitchX * pitchY)));
    var disabled = {}; (p.disabled || []).forEach(function (i) { disabled[i] = 1; });
    var slots = [], avail = [];
    // رسم الألواح من (x0,y0) بالمتر؛ المعوقات المستطيلة p.obs = [{x,y,w,h}] تحجب الألواح المتقاطعة معها
    var gridW = cols * pitchX - A.gap, x0 = (W - gridW) / 2, gridH = Math.max(0, (rows - 1) * pitchY + fp), y0 = A.margin + ((L - 2 * A.margin) - gridH) / 2;
    var obsRects = (p.obs || []).filter(function (o) { return o && o.w > 0 && o.h > 0; });
    function hitObs(r, c) {
      var px = x0 + c * pitchX, py = y0 + r * pitchY;
      return obsRects.some(function (o) { return px < o.x + o.w && px + panel.wid > o.x && py < o.y + o.h && py + fp > o.y; });
    }
    for (var i = 0; i < total; i++) {
      var rr = Math.floor(i / cols), cc = i % cols;
      var st = (i >= total - blocked || hitObs(rr, cc)) ? 'obs' : (disabled[i] ? 'x' : 'free');
      slots.push({ i: i, r: Math.floor(i / cols), c: i % cols, st: st }); if (st === 'free') avail.push(i);
    }
    if (!avail.length) return { ok: false, error: 'roof' };
    var kwPanel = panel.watt / 1000, yieldKwh = city.yield * (1 - Math.abs(tilt - 20) * 0.001); // mild tilt loss vs ~20deg optimum
    var offgrid = system === 'offgrid', target = (offgrid ? annual * A.offgridOversize : annual);
    var need = Math.ceil(target / yieldKwh / kwPanel);
    var n = p.manual ? avail.length : Math.min(need, avail.length);
    avail.forEach(function (idx, k) { slots[idx].st = k < n ? 'on' : 'free'; });
    var kwp = n * kwPanel, prod = kwp * yieldKwh;

    // inverter
    var invs = (lib && lib.length ? lib : DEF_EQUIP).filter(function (e) { return e.kind === 'inverter'; }).sort(function (a, b) { return a.kw - b.kw; });
    var needKw = kwp / 1.15, inv, qty;
    if (p.inverterId && invs.filter(function (e) { return e.id === p.inverterId; })[0]) {
      inv = invs.filter(function (e) { return e.id === p.inverterId; })[0]; qty = Math.max(1, num(p.inverterQty, 0) || Math.ceil(needKw / inv.kw));
    } else {
      var pool = system === 'grid' ? invs : invs.filter(function (e) { return e.hybrid; }); if (!pool.length) pool = invs;
      inv = pool.filter(function (e) { return e.kw >= needKw; })[0] || pool[pool.length - 1]; qty = Math.max(1, Math.ceil(needKw / inv.kw));
    }
    var strings = stringConfig(n, panel, inv, qty, A);
    var invKwTotal = inv.kw * qty, dcac = kwp / invKwTotal;

    // battery
    var bat = null, b = p.battery || {};
    if (system !== 'grid' && (offgrid || b.need)) {
      var avgKw = annual / 8760, defKw = offgrid ? Math.max(1, Math.round(avgKw * 2 * 10) / 10) : 3;
      var bu = equip(lib, b.unitId, 'battery');
      bat = bess({ criticalKw: num(b.criticalKw, 0) || defKw, hours: num(b.hours, 0) || (offgrid ? 12 : 4), dod: num(b.dod, 0) || bu.dod, rte: num(b.rte, 0) || bu.rte, arch: b.arch || 'dc', unitKwh: bu.kwh, unitKw: bu.kw });
      bat.unit = bu;
    }

    // costs
    var base = kwp * costRate(kwp, A), sp = A.split;
    var parts = { panels: base * sp.panels, inverter: base * sp.inverter, mounting: base * sp.mounting, cables: base * sp.cables, install: base * sp.install, other: base * sp.other, battery: bat ? bat.nominal * A.battPerKwh : 0 };
    var cost = base + parts.battery;

    // electricity bill effect
    var useful = Math.min(prod, annual), billNow = billFromKwh(monthly, type, A), billAfter = billFromKwh(Math.max(0, monthly - useful / 12), type, A), save = (billNow - billAfter) * 12;
    var fin = financial(cost, save, prod, A);

    // electrical
    var dcLen = num(p.dcLen, 30), acLen = num(p.acLen, 20), acPhase = inv.phase === 1 ? 1 : 3, V = acPhase === 3 ? 400 : 230;
    var elec = null;
    if (strings.series > 0) {
      var Idc = panel.isc * 1.25 * 1.25;
      var dcCable = cableSize({ kind: 'dc', I: panel.imp, Ivd: panel.imp, Idesign: Idc, L: dcLen, V: strings.series * panel.vmp, drop: A.dropDC }, A);
      var Iinv = acPhase === 3 ? inv.kw * 1000 / (Math.sqrt(3) * V) : inv.kw * 1000 / V, Itot = Iinv * qty;
      var acCable = cableSize({ kind: acPhase === 3 ? 'ac3' : 'ac1', Ivd: Itot, Idesign: Itot * 1.25, L: acLen, V: V, drop: A.dropAC }, A);
      elec = { dcCable: dcCable, dcIdesign: Idc, stringFuse: nextStd(STD_FUSE, panel.isc * 1.56), dcVoltRating: Math.ceil(strings.vStringOc / 100) * 100,
        acPhase: acPhase, V: V, Iinv: Iinv, Itot: Itot, invBreaker: nextStd(STD_BREAKER, Iinv * 1.25), mainBreaker: nextStd(STD_BREAKER, Itot * 1.25), acCable: acCable };
    }

    var warnings = []; strings.warn.forEach(function (w) { warnings.push(w); });
    if (n < need && !p.manual) warnings.push('roofLimited');
    if (dcac > 1.4) warnings.push('dcacHigh'); if (dcac < 0.9) warnings.push('dcacLow');
    if (bat && bat.powerLimited) warnings.push('batPower');

    return {
      ok: true, type: type, system: system, cityKey: p.city in CITIES ? p.city : 'riyadh', city: city, yieldKwh: yieldKwh, L: L, W: W, tilt: tilt,
      panel: panel, inv: inv, invQty: qty, invKw: invKwTotal, dcac: dcac, monthly: monthly, annual: annual, billNow: billNow, billAfter: billAfter,
      cols: cols, rows: rows, total: total, slots: slots, blocked: slots.filter(function (q) { return q.st === 'obs'; }).length, x0: x0, y0: y0, obsRects: obsRects, avail: avail.length, need: need, n: n, limited: n < need && !p.manual,
      pitchX: pitchX, pitchY: pitchY, fp: fp, kwp: kwp, prod: prod, daily: prod / 365, strings: strings, bat: bat, elec: elec, parts: parts, cost: cost,
      save: save, fin: fin, payback: fin.payback, coverage: Math.min(1, prod / annual), co2: prod * A.co2, warnings: warnings,
      equipVerified: !!(panel.verified && inv.verified && (!bat || bat.unit.verified)),
      components: [
        { key: 'panels', qty: n, power: kwp.toFixed(1) + ' kWp', cost: parts.panels, item: panel.name },
        { key: 'inverter', qty: qty, power: invKwTotal + ' kW', cost: parts.inverter, item: inv.name },
        bat ? { key: 'battery', qty: bat.units, power: bat.nominal + ' kWh', cost: parts.battery, item: bat.unit.name } : null,
        { key: 'mounting', qty: 1, power: '-', cost: parts.mounting, item: '' },
        { key: 'cables', qty: 1, power: '-', cost: parts.cables, item: '' },
        { key: 'install', qty: 1, power: '-', cost: parts.install + parts.other, item: '' }
      ].filter(Boolean)
    };
  }

  var api = { DEFAULTS: DEFAULTS, CITIES: CITIES, TYPES: TYPES, DEF_EQUIP: DEF_EQUIP, STD_BREAKER: STD_BREAKER, design: design, bess: bess, financial: financial,
    stringConfig: stringConfig, cableSize: cableSize, billFromKwh: billFromKwh, kwhFromBill: kwhFromBill, nextStd: nextStd, equip: equip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
