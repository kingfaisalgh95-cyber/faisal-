/* Shaqaf Energy — calculation engine v3 (pure: no DOM, no storage).
   All numbers come from data.js (each tagged sourced / derived / assumption with source + retrieval date)
   or from the user's input. Every figure is an ESTIMATE until a site survey and an engineering study confirm it. */
(function (root) {
  'use strict';
  var D = root.SolarData || (typeof require !== 'undefined' ? require('./data.js') : null);
  if (!D) throw new Error('data.js must be loaded before calc.js');
  var DATA_VERSION = 'data-2026-11-07';

  var DD = D, L_ = D.LOSSES, F_ = D.FIN, P_ = D.PRICES;
  var DEFAULTS = {
    dataVersion: DATA_VERSION,
    life: F_.lifeYears.value,
    degr: 0.5,         // fallback annual degradation (%/yr) for panels with no datasheet value
    degrYear1: 1.0,    // fallback first-year degradation (%) for panels with no datasheet value
    esc: F_.escPct.value, om: F_.omPct.value, disc: F_.discPct.value,
    replYear: F_.replYear.value, replPct: F_.replPct.value,
    battPerKwh: P_.battPerKwh,
    co2: F_.co2tPerKwh.value,
    sunElev: 30,       // sun elevation (deg) used for row spacing (geometry)
    tminC: 5, tcellMax: 70, // design temperatures for string sizing (C)
    margin: 1, gap: 0.02,   // roof edge setback / gap between panels (m)
    dropDC: 1, dropAC: 2,
    cuK: 48,
    offgridOversize: 1.3,
    costBands: P_.costBands.map(function (b) { return b.slice(); }),
    split: Object.assign({}, P_.split),
    // losses (assumptions, see data.js)
    cellTempAvgC: L_.cellTempAvgC.value, soilingPct: L_.soilingPct.value, mismatchDcPct: L_.mismatchDcPct.value,
    wiringAcPct: L_.wiringAcPct.value, availabilityPct: L_.availabilityPct.value, tiltLossK: L_.tiltLossK.value,
    uncertaintyPct: L_.uncertaintyPct.value, invEffPenaltyPt: L_.inverterEffFallbackPenaltyPt.value,
    // tariff regime + export
    tariffSet: 'y2027',
    exportMode: 'self',       // 'self' (direct use + surplus credit, default: conservative) | 'net' (kWh netting, only if the utility applies it)
    selfUse: { villa: 0.45, house: 0.45, company: 0.8, admin: 0.8, warehouse: 0.75, factory: 0.9, other: 0.6 }, // ASSUMPTION: share of consumption falling in daylight hours (no load profile given)
    surplusCredit: 0,         // SAR/kWh; the SERA proposal (0.07 / 0.05) is not in force
    vatRecoverable: { residential: false, commercial: true, industrial: true }
  };

  var CLASS_OF = { villa: 'residential', house: 'residential', company: 'commercial', admin: 'commercial', warehouse: 'commercial', factory: 'industrial', other: 'commercial' };
  var TYPES = {
    villa: { kind: 'residential', height: 7 }, house: { kind: 'residential', height: 6 }, company: { kind: 'commercial', height: 12 }, admin: { kind: 'commercial', height: 14 }, other: { kind: 'commercial', height: 8 },
    warehouse: { kind: 'commercial', height: 8 }, factory: { kind: 'industrial', height: 10 }
  };
  function tariffTable(setKey) {
    var set = D.TARIFF.sets[setKey] || D.TARIFF.sets.y2027, o = {};
    Object.keys(CLASS_OF).forEach(function (k) { var c = set.classes[CLASS_OF[k]]; o[k] = [c.rate1, c.limit, c.rate2]; });
    return o;
  }
  DEFAULTS.tariffs = tariffTable(DEFAULTS.tariffSet);

  var DEF_EQUIP = JSON.parse(JSON.stringify(D.EQUIP));

  // City table kept for the UI (names). 'yield' = reference specific yield (kWh/kWp/yr) at optimal tilt with the default panel and a 98% inverter.
  var CITIES = {};
  Object.keys(D.CITY).forEach(function (k) { var c = D.CITY[k]; CITIES[k] = { ar: c.ar, en: c.en, lat: c.lat, lon: c.lon, tiltOpt: c.tiltOpt, yield: 0 }; });

  var STD_BREAKER = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630];
  var STD_FUSE = [10, 12, 15, 20, 25, 30];
  var DC_CABLES = [[4, 55], [6, 70], [10, 98], [16, 132], [25, 176], [35, 218], [50, 276], [70, 347], [95, 416]];
  var AC_CABLES = [[4, 32], [6, 41], [10, 57], [16, 76], [25, 101], [35, 125], [50, 151], [70, 192], [95, 232], [120, 269], [150, 309], [185, 353], [240, 415]];

  function A_(A) {
    var o = Object.assign({}, DEFAULTS, A || {});
    if (!A || !A.tariffs) o.tariffs = tariffTable(o.tariffSet);
    return o;
  }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function nextStd(list, v) { for (var i = 0; i < list.length; i++) if (list[i] >= v) return list[i]; return list[list.length - 1]; }
  function equip(lib, id, kind) { var l = (lib && lib.length ? lib : DEF_EQUIP).filter(function (e) { return e.kind === kind; }); return l.filter(function (e) { return e.id === id; })[0] || l[0]; }

  // ---------- tariff ----------
  // billEx: energy charge excl. VAT. billFromKwh: what the customer pays incl. VAT (compares with the bill they type in).
  var VAT = D.TARIFF.vat.value;
  function tier(type, A) { return A_(A).tariffs[type] || A_(A).tariffs.villa; }
  function billEx(kwh, type, A) { var t = tier(type, A); kwh = Math.max(0, kwh); return kwh <= t[1] ? kwh * t[0] : t[1] * t[0] + (kwh - t[1]) * t[2]; }
  function billFromKwh(kwh, type, A) { return billEx(kwh, type, A) * (1 + VAT); }
  function kwhFromBill(bill, type, A) { var t = tier(type, A), b = bill / (1 + VAT), f = t[1] * t[0]; return b <= f ? b / t[0] : t[1] + (b - f) / t[2]; }
  function costRate(kwp, A) { var b = A_(A).costBands; for (var i = 0; i < b.length; i++) if (kwp < b[i][0]) return b[i][1]; return b[b.length - 1][1]; }
  function vatFactor(type, A) { A = A_(A); return A.vatRecoverable[CLASS_OF[type] || 'residential'] ? 1 : 1 + VAT; }

  // ---------- production ----------
  // Monthly energy = kWp x (seasonal kWh/kW/day at optimal tilt) x days x tiltFactor x PR.
  // PR = (1 - temperature) x (1 - soiling) x (1 - mismatch/DC) x (1 - AC wiring) x (1 - availability) x inverter efficiency.
  function invEff(inv, A) {
    if (!inv) return 0.98;
    var e = inv.effEuro != null ? inv.effEuro : (inv.effMax != null ? inv.effMax - A.invEffPenaltyPt : 98 - A.invEffPenaltyPt);
    return e / 100;
  }
  function performance(panel, inv, A) {
    A = A_(A);
    var temp = Math.abs(panel.tcPmax) / 100 * Math.max(0, A.cellTempAvgC - 25);
    var parts = { temperature: temp, soiling: A.soilingPct / 100, mismatchDc: A.mismatchDcPct / 100, wiringAc: A.wiringAcPct / 100, availability: A.availabilityPct / 100 };
    var pr = (1 - parts.temperature) * (1 - parts.soiling) * (1 - parts.mismatchDc) * (1 - parts.wiringAc) * (1 - parts.availability) * invEff(inv, A);
    return { pr: pr, parts: parts, invEff: invEff(inv, A) };
  }
  function tiltFactor(cityKey, tilt, A) { var c = D.CITY[cityKey] || D.CITY.riyadh, d = tilt - c.tiltOpt; return 1 - A_(A).tiltLossK * d * d; }
  function production(o, A) {
    A = A_(A);
    var cityKey = D.CITY[o.city] ? o.city : 'riyadh', c = D.CITY[cityKey], pf = performance(o.panel, o.inv, A), tf = tiltFactor(cityKey, num(o.tilt, c.tiltOpt), A);
    var months = [], poa = 0;
    for (var m = 0; m < 12; m++) {
      var psh = c[D.IRR.monthSeason[m]] * D.DAYS[m] * tf;      // kWh/kW in the month, before losses
      poa += psh; months.push(o.kwp * psh * pf.pr * (o.orient == null ? 1 : o.orient));
    }
    var annual = months.reduce(function (a, v) { return a + v; }, 0);
    return { months: months, annual: annual, pr: pf.pr, perf: pf, tiltFactor: tf, poaAnnual: poa, specific: o.kwp > 0 ? annual / o.kwp : poa * pf.pr * (o.orient == null ? 1 : o.orient) };
  }

  // ---------- bill savings ----------
  // flat monthly consumption (the customer gives one figure). scale: production multiplier (degradation / conservative case).
  function savings(o, A) {
    A = A_(A);
    var type = o.type, cons = o.monthly, scale = o.scale == null ? 1 : o.scale, vf = vatFactor(type, A), mode = A.exportMode;
    var rows = [], bal = 0, save = 0, credit = 0, wasted = 0, now = 0, after = 0, exported = 0, usedTotal = 0;
    for (var m = 0; m < 12; m++) {
      var pr = o.prodMonths[m] * scale, netKwh, used, exp = 0;
      if (mode === 'self') {
        /* direct use is limited by the share of the load that falls in daylight hours */ used = Math.min(pr, cons * (A.selfUse[type] != null ? A.selfUse[type] : 0.6)); exp = pr - used; netKwh = cons - used; credit += exp * A.surplusCredit;
      } else {
        if (pr >= cons) { bal += pr - cons; netKwh = 0; used = cons; }
        else { var need = cons - pr, take = Math.min(bal, need); bal -= take; netKwh = need - take; used = cons - netKwh; }
      }
      var bn = billEx(cons, type, A) * vf, ba = billEx(netKwh, type, A) * vf;
      rows.push({ prod: pr, billNow: bn, billAfter: ba, netKwh: netKwh, saving: bn - ba });
      now += bn; after += ba; save += bn - ba; exported += exp; usedTotal += used;
    }
    if (mode !== 'self') wasted = bal;
    return { rows: rows, save: save + credit, billNowYear: now, billAfterYear: after, credit: credit, exported: exported, used: usedTotal, unusedCarry: wasted };
  }

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
    var perMppt = inv.stringsPerMppt || Math.max(1, Math.floor(inv.iscMax / panel.isc)), cap = inv.mppts * perMppt * qty;
    var r = { vocCold: vocCold, vmpHot: vmpHot, minS: minS, maxS: maxS, topS: topS, cap: cap, warn: [] };
    if (inv.imMax && panel.imp > inv.imMax) r.warn.push('mpptCurrent');
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
  // save: number (year-1 saving, scaled by degradation) or function(scale) -> annual saving at that production scale.
  // Degradation: linear on rated power: year y factor = 1 - d1 - (y-1) x d (JinkoSolar warranty: 99% after year 1, 0.40%/yr).
  function financial(cost, save, prod, A) {
    A = A_(A);
    var d1 = A.degrYear1 / 100, d = A.degr / 100, flow = [], cum = -cost, npv = -cost, pay = null, gross = 0, pvCost = cost, pvEnergy = 0, years = [];
    for (var y = 1; y <= A.life; y++) {
      var f = Math.max(0, 1 - d1 - (y - 1) * d), s = (typeof save === 'function' ? save(f) : save * f) * Math.pow(1 + A.esc / 100, y - 1);
      var om = cost * A.om / 100, rep = y === A.replYear ? cost * A.replPct / 100 : 0, net = s - om - rep, dd = Math.pow(1 + A.disc / 100, y);
      gross += s; cum += net; npv += net / dd; pvCost += (om + rep) / dd; pvEnergy += prod * f / dd;
      if (pay === null && cum >= 0) pay = (y - 1) + (-(cum - net) / net);
      flow.push(Math.round(cum)); years.push({ y: y, factor: f, saving: s, om: om, repl: rep, net: net, cum: cum });
    }
    return { flow: flow, years: years, payback: pay, lifetimeGross: gross, lifetimeNet: cum, npv: npv, lcoe: pvEnergy > 0 ? pvCost / pvEnergy : 0 };
  }


  // ---------- customer-input models ----------
  function acLoad(o, A) {
    A = A_(A); var U = D.USE, hrs = Math.min(24, Math.max(0, num(o.hours, 10)));
    /* rows: [{units, tons | btu}] (several AC kinds); a single {units, tons} also works. Unknown capacity = 1.5 t (assumption). */
    var rows = o.rows && o.rows.length ? o.rows : [{ units: o.units, tons: o.tons }], units = 0, kwSum = 0;
    rows.forEach(function (r) { var u = Math.max(0, num(r.units, 0)), tn = r.btu > 0 ? r.btu / U.acBtuPerTon.value : (r.tons > 0 ? Number(r.tons) : 1.5); units += u; kwSum += u * tn * U.acBtuPerTon.value / U.acEer.value / 1000; });
    var kw = units > 0 ? kwSum / units : 0, months = [];
    for (var m = 0; m < 12; m++) months.push(kwSum * hrs * D.DAYS[m] * U.acSeason[D.IRR.monthSeason[m]] * U.acLoadFactor.value);
    var base = U.baseLoadKwh[o.type] != null ? U.baseLoadKwh[o.type] : 500, annualAc = months.reduce(function (a, v) { return a + v; }, 0);
    return { acMonths: months, acAnnual: annualAc, base: base, monthlyAvg: annualAc / 12 + base, annual: annualAc + base * 12, unitKw: kw, units: units, kwTotal: kwSum, hours: hrs };
  }
  function azFactor(dev) {
    var U = D.USE.azimuth, d = Math.min(180, Math.abs(num(dev, 0)));
    var loss = d <= 90 ? U.lossAt90 * Math.pow(d / 90, 2) : U.lossAt90 + (U.lossAt180 - U.lossAt90) * (d - 90) / 90;
    return 1 - loss;
  }
  function confidence(flags) {
    var U = D.USE.confidence, pct = U.base, miss = [];
    if (flags.azUnknown) { pct += U.azUnknown; miss.push('azimuth'); }
    if (flags.shade === 'unknown') { pct += U.shadeUnknown; miss.push('shade'); } else if (flags.shade === 'some') { pct += U.shadeSome; miss.push('shadeSome'); }
    if (flags.consFromAc) { pct += U.consFromAc; miss.push('consFromAc'); }
    if (flags.consUnknown) { pct += U.consUnknown; miss.push('consUnknown'); }
    if (flags.dimsApprox) { pct += U.dimsApprox; miss.push('dimsApprox'); }
    return { rangePct: pct, level: pct <= U.highMax ? 'high' : pct <= U.mediumMax ? 'medium' : 'low', missing: miss };
  }

  // ---------- main design ----------
  function design(p, A, lib) {
    A = A_(A); p = p || {};
    var type = TYPES[p.type] ? p.type : 'villa', city = CITIES[p.city] || CITIES.riyadh, system = ['grid', 'hybrid', 'offgrid'].indexOf(p.system) >= 0 ? p.system : 'grid';
    var L = num(p.len, 0), W = num(p.wid, 0), cons = num(p.cons, 0);
    if (!(L >= 3 && L <= 300 && W >= 3 && W <= 300)) return { ok: false, error: 'dims' };
    var unknown = p.mode === 'none', acMode = p.mode === 'ac', acl = acMode ? acLoad(Object.assign({ type: type }, p.ac || {}), A) : null;
    if (!unknown && (acMode ? !(acl.acAnnual > 0) : !(cons > 0))) return { ok: false, error: acMode ? 'ac' : 'cons' };
    var panel = equip(lib, p.panelId, 'panel');
    var monthly = unknown ? DD.USE.scenarioKwh.values[1] : Math.max(100, acMode ? acl.monthlyAvg : p.mode === 'bill' ? kwhFromBill(cons, type, A) : cons), annual = monthly * 12;
    var occ = DD.USE.occupancy, occK = occ[p.daytime] != null ? occ[p.daytime] : 1, azKnown = p.azDev != null && p.azDev !== '', orient = azKnown ? azFactor(p.azDev) : 1;
    A = Object.assign({}, A, { selfUse: Object.keys(A.selfUse).reduce(function (o, k) { o[k] = Math.min(occ.cap, A.selfUse[k] * (k === type ? occK : 1)); return o; }, {}) });
    var conf = confidence({ azUnknown: !azKnown, shade: p.shade || 'unknown', consFromAc: acMode, consUnknown: unknown, dimsApprox: !!p.dimsApprox });
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
    var kwPanel = panel.watt / 1000, cityKey = p.city in CITIES ? p.city : 'riyadh';
    var degA = Object.assign({}, A, { degr: panel.degrAnnual != null ? panel.degrAnnual : A.degr, degrYear1: panel.degrYear1 != null ? panel.degrYear1 : A.degrYear1 });
    var yieldKwh = production({ city: cityKey, tilt: tilt, kwp: 1, panel: panel, inv: null, orient: orient }, A).specific; // sizing estimate with a nominal inverter; refined below
    var offgrid = system === 'offgrid', target = (offgrid ? annual * A.offgridOversize : annual);
    var need = unknown ? avail.length : Math.ceil(target / yieldKwh / kwPanel);
    var sizePct = Math.min(100, Math.max(10, num(p.sizePct, 100))), nFull = Math.min(need, avail.length), n = p.manual ? avail.length : Math.max(1, Math.ceil(nFull * sizePct / 100));
    avail.forEach(function (idx, k) { slots[idx].st = k < n ? 'on' : 'free'; });
    var kwp = n * kwPanel;

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
    var pro = production({ city: cityKey, tilt: tilt, kwp: kwp, panel: panel, inv: inv, orient: orient }, A), prod = pro.annual; yieldKwh = pro.specific;

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

    // electricity bill effect (month by month, tiered tariff, export mode per assumptions)
    var sv = savings({ type: type, monthly: monthly, prodMonths: pro.months }, A), save = sv.save, billNow = billFromKwh(monthly, type, A);
    var billAfter = sv.billAfterYear / 12 * (A_(A).vatRecoverable[CLASS_OF[type]] ? 1 + VAT : 1); // shown on the same incl.-VAT basis as billNow
    var mkSave = function (AA, k) { return function (f) { return savings({ type: type, monthly: monthly, prodMonths: pro.months, scale: f * k }, AA).save; }; };
    var fin = financial(cost, mkSave(A, 1), prod, degA);
    var lowScale = 1 - conf.rangePct / 100;
    var finLow = financial(cost, mkSave(A, lowScale), prod * lowScale, degA);
    // The four quantities are kept apart: production, direct use, export, bill saving. Flows come from the self-consumption model.
    var AS = Object.assign({}, A, { exportMode: 'self' }), AN = Object.assign({}, A, { exportMode: 'net' });
    var svSelf = savings({ type: type, monthly: monthly, prodMonths: pro.months }, AS);
    var flows = { production: prod, direct: svSelf.used, exported: svSelf.exported, gridAfter: Math.max(0, annual - svSelf.used), consumption: annual };
    var altMode = A.exportMode === 'net' ? 'self' : 'net', altA = altMode === 'net' ? AN : AS;
    var finAlt = financial(cost, mkSave(altA, 1), prod, degA), svAlt = savings({ type: type, monthly: monthly, prodMonths: pro.months }, altA);
    var alt = { mode: altMode, save: svAlt.save, payback: finAlt.payback };
    /* consumption unknown: savings are shown only as labelled what-if scenarios, never as the customer's own figure */
    var scen = unknown ? DD.USE.scenarioKwh.values.map(function (kwh) {
      var sv0 = savings({ type: type, monthly: kwh, prodMonths: pro.months }, AS), f0 = financial(cost, function (f) { return savings({ type: type, monthly: kwh, prodMonths: pro.months, scale: f }, AS).save; }, prod, degA);
      return { kwh: kwh, save: sv0.save, payback: f0.payback, exportShare: sv0.exported / Math.max(1e-9, prod), coverage: Math.min(1, prod / (kwh * 12)) };
    }) : null;


    // size options: same site, different array sizes. Production scales with kWp; the cost curve and the tariff model are re-applied for each size.
    var sizing = { rows: [], best: null };
    if (!p.manual && !unknown && nFull > 0) {
      [30, 40, 50, 60, 70, 80, 90, 100].forEach(function (pct) {
        var nf = Math.max(1, Math.ceil(nFull * pct / 100)), kf = nf * kwPanel, f = kf / kwp, cf = kf * costRate(kf, A) + parts.battery;
        var fn = financial(cf, mkSave(A, f), prod * f, degA), sx = savings({ type: type, monthly: monthly, prodMonths: pro.months, scale: f }, AS);
        sizing.rows.push({ pct: pct, n: nf, kwp: kf, cost: cf, save: fn.lifetimeGross / A.life, payback: fn.payback, npv: fn.npv, exportShare: sx.exported / Math.max(1e-9, prod * f), coverage: Math.min(1, prod * f / annual) });
      });
      sizing.best = sizing.rows.reduce(function (b, r) { return !b || r.npv > b.npv ? r : b; }, null);
    }

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
    if (A.exportMode === 'net') warnings.push('netAssumed'); else if (flows.exported > 0 && !(A.surplusCredit > 0)) warnings.push('exportUnvalued');

    return {
      ok: true, noCons: unknown, scen: scen, conf: conf, tariff: tier(type, A), vf: vatFactor(type, A), lowScale: lowScale, A: A, sizing: sizing, sizePct: sizePct, orient: orient, azKnown: azKnown, acl: acl, occK: occK, type: type, system: system, cityKey: cityKey, city: city, yieldKwh: yieldKwh, pro: pro, sv: sv, finLow: finLow, flows: flows, alt: alt, prodLow: prod * lowScale, perf: pro.perf, L: L, W: W, tilt: tilt,
      panel: panel, inv: inv, invQty: qty, invKw: invKwTotal, dcac: dcac, monthly: monthly, annual: annual, billNow: billNow, billAfter: billAfter,
      cols: cols, rows: rows, total: total, slots: slots, blocked: slots.filter(function (q) { return q.st === 'obs'; }).length, x0: x0, y0: y0, obsRects: obsRects, avail: avail.length, need: need, n: n, limited: n < need && !p.manual,
      pitchX: pitchX, pitchY: pitchY, fp: fp, kwp: kwp, prod: prod, daily: prod / 365, strings: strings, bat: bat, elec: elec, parts: parts, cost: cost,
      save: save, fin: fin, payback: fin.payback, coverage: Math.min(1, prod / annual), costStatus: P_.status, dataVersion: DATA_VERSION, dataDate: D.RETRIEVED, tariffSet: A.tariffSet, exportMode: A.exportMode, co2: prod * A.co2, warnings: warnings,
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


  // ---------- audit trail: every displayed result re-derived step by step from the inputs, for review in the report ----------
  function audit(R) {
    if (!R || !R.ok) return null;
    var A = R.A, c = D.CITY[R.cityKey], pf = R.pro.perf, rows = [], m;
    for (m = 0; m < 12; m++) { var season = D.IRR.monthSeason[m], irr = c[season], days = D.DAYS[m]; rows.push({ m: m, days: days, season: season, irr: irr, psh: irr * days * R.pro.tiltFactor, prod: R.pro.months[m] }); }
    var sumP = rows.reduce(function (a, r) { return a + r.prod; }, 0);
    var srows = R.sv.rows.map(function (r, i) { return { m: i, prod: r.prod, cons: R.monthly, netKwh: r.netKwh, billNow: r.billNow, billAfter: r.billAfter, saving: r.saving }; });
    return {
      production: { rows: rows, sum: sumP, kwp: R.kwp, tilt: R.tilt, tiltFactor: R.pro.tiltFactor, orient: R.orient, pr: R.pro.pr, perf: pf, specific: R.yieldKwh },
      flows: R.flows,
      savings: { rows: srows, tariff: R.tariff, vf: R.vf, mode: R.exportMode, selfUse: A.selfUse[R.type], credit: R.sv.credit, sum: srows.reduce(function (a, r) { return a + r.saving; }, 0), total: R.save },
      cost: { parts: R.parts, rate: costRate(R.kwp, A), kwp: R.kwp, total: R.cost, status: R.costStatus },
      payback: { years: R.fin.years, payback: R.fin.payback, om: A.om, disc: A.disc, life: A.life, replYear: A.replYear, replPct: A.replPct, degrYear1: R.panel.degrYear1 != null ? R.panel.degrYear1 : A.degrYear1, degr: R.panel.degrAnnual != null ? R.panel.degrAnnual : A.degr }
    };
  }

  // reference yield per city (optimal tilt, default panel, nominal inverter) — informational for the UI
  (function () {
    var pn = DEF_EQUIP.filter(function (e) { return e.kind === 'panel'; })[0];
    Object.keys(CITIES).forEach(function (k) { CITIES[k].yield = Math.round(production({ city: k, tilt: CITIES[k].tiltOpt, kwp: 1, panel: pn, inv: null }, DEFAULTS).specific); });
  })();

  var api = { DATA: D, DATA_VERSION: DATA_VERSION, CLASS_OF: CLASS_OF, production: production, performance: performance, savings: savings, billEx: billEx, tariffTable: tariffTable, assumptionList: null, DEFAULTS: DEFAULTS, CITIES: CITIES, TYPES: TYPES, DEF_EQUIP: DEF_EQUIP, STD_BREAKER: STD_BREAKER, design: design, bess: bess, financial: financial,
    audit: audit, acLoad: acLoad, azFactor: azFactor, confidence: confidence, stringConfig: stringConfig, cableSize: cableSize, billFromKwh: billFromKwh, kwhFromBill: kwhFromBill, nextStd: nextStd, equip: equip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
