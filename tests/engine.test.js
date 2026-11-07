/* Unit tests for the pure calculation engine against HAND-CALCULATED references.
   Run: node tests/engine.test.js   (no dependencies) */
'use strict';
const assert = require('assert');
const C = require('../calc.js');
const D = require('../data.js');
let n = 0, failed = 0;
function t(name, fn) { n++; try { fn(); console.log('  ok  ' + name); } catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + e.message); } }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' expected ' + b + ' got ' + a + ' (tol ' + tol + ')');
const jinko = D.EQUIP.find(e => e.id === 'jkm580'), hw10 = D.EQUIP.find(e => e.id === 'hw10'), hw15 = D.EQUIP.find(e => e.id === 'hw15');

console.log('Tariff');
t('residential 2027, 1000 kWh = 1000*0.21*1.15 = 241.50 SAR', () => near(C.billFromKwh(1000, 'villa', { tariffSet: 'y2027' }), 241.5, 1e-9));
t('residential 2027, 7000 kWh = (6000*0.21+1000*0.33)*1.15 = 1828.50', () => near(C.billFromKwh(7000, 'villa', { tariffSet: 'y2027' }), 1828.5, 1e-9));
t('residential current, 7000 kWh = (6000*0.18+1000*0.30)*1.15 = 1587.00', () => near(C.billFromKwh(7000, 'villa', { tariffSet: 'current' }), 1587, 1e-9));
t('commercial 2027, 8000 kWh = (6000*0.25+2000*0.35)*1.15 = 2530', () => near(C.billFromKwh(8000, 'company', { tariffSet: 'y2027' }), 2530, 1e-9));
t('industrial current is flat 0.20 (not 0.18)', () => near(C.billEx(1000, 'factory', { tariffSet: 'current' }), 200, 1e-9));
t('bill -> kWh -> bill round trip (both tiers)', () => [50, 400, 1500, 2300, 9000].forEach(b => near(C.billFromKwh(C.kwhFromBill(b, 'villa', { tariffSet: 'y2027' }), 'villa', { tariffSet: 'y2027' }), b, 1e-6)));

console.log('Irradiance / production');
t('Riyadh annual POA at optimal tilt = 90*4.92+92*7.67+92*8.30+91*6.42 = 2496.26 kWh/kW', () => {
  const p = C.production({ city: 'riyadh', tilt: 22, kwp: 1, panel: jinko, inv: hw10 }); near(p.poaAnnual, 2496.26, 0.01);
});
t('performance ratio Jinko+Huawei10 = .913*.94*.98*.99*.99*.981 = 0.8087', () => {
  const pf = C.performance(jinko, hw10); near(pf.parts.temperature, 0.087, 1e-9); near(pf.pr, 0.913 * 0.94 * 0.98 * 0.99 * 0.99 * 0.981, 1e-9); near(pf.pr, 0.8087, 0.0001);
});
t('10 kWp Riyadh @22deg = 10*2496.26*0.80866 = 20 187 kWh', () => {
  const p = C.production({ city: 'riyadh', tilt: 22, kwp: 10, panel: jinko, inv: hw10 }); near(p.annual, 10 * 2496.26 * C.performance(jinko, hw10).pr, 0.5); near(p.annual, 20187, 3);
});
t('tilt 10deg loses 1-0.00007*12^2 = 1.008%', () => near(C.production({ city: 'riyadh', tilt: 10, kwp: 1, panel: jinko, inv: hw10 }).tiltFactor, 1 - 0.00007 * 144, 1e-12));
t('monthly values sum to the annual value; summer month > winter month', () => {
  const p = C.production({ city: 'riyadh', tilt: 22, kwp: 5, panel: jinko, inv: hw10 }); near(p.months.reduce((a, b) => a + b, 0), p.annual, 1e-6); assert.ok(p.months[6] > p.months[0]);
});
t('Jan (winter, 31 d) = kWp*4.92*31*PR', () => near(C.production({ city: 'riyadh', tilt: 22, kwp: 2, panel: jinko, inv: hw10 }).months[0], 2 * 4.92 * 31 * C.performance(jinko, hw10).pr, 1e-9));
t('POA / measured GHI (Riyadh 6.41) is a plausible tilt gain 1.0-1.15', () => { const r = (C.production({ city: 'riyadh', tilt: 22, kwp: 1, panel: jinko, inv: hw10 }).poaAnnual / 365) / 6.4139; assert.ok(r > 1 && r < 1.15, r); });
t('specific yield of every city is below its POA and above the literature floor (1430)', () => Object.keys(D.CITY).forEach(k => { const p = C.production({ city: k, tilt: D.CITY[k].tiltOpt, kwp: 1, panel: jinko, inv: hw10 }); assert.ok(p.specific < p.poaAnnual && p.specific > 1430, k + ' ' + p.specific); }));

console.log('Savings');
t('net mode, production 500/month vs 1000 consumption: saves 500*0.21*1.15*12 = 1449', () => {
  const s = C.savings({ type: 'villa', monthly: 1000, prodMonths: Array(12).fill(500) }, { tariffSet: 'y2027', exportMode: 'net' }); near(s.save, 1449, 1e-6);
});
t('net mode carry-over: Jan 2000 kWh surplus covers Feb; saving = 2 bills = 483', () => {
  const pm = Array(12).fill(0); pm[0] = 2000; const s = C.savings({ type: 'villa', monthly: 1000, prodMonths: pm }, { tariffSet: 'y2027', exportMode: 'net' }); near(s.save, 483, 1e-6);
});
t('self mode: 1000 kWh/month produced, 50% used on site, no credit => saves 500*0.21*1.15*12 = 1449', () => {
  const s = C.savings({ type: 'villa', monthly: 1000, prodMonths: Array(12).fill(1000) }, { tariffSet: 'y2027', exportMode: 'self', selfUse: { villa: 0.5 }, surplusCredit: 0 }); near(s.save, 1449, 1e-6); near(s.exported, 6000, 1e-9);
});
t('commercial VAT is recoverable => saving excludes VAT', () => {
  const s = C.savings({ type: 'company', monthly: 1000, prodMonths: Array(12).fill(1000) }, { tariffSet: 'y2027', exportMode: 'net' }); near(s.save, 12 * 1000 * 0.25, 1e-6);
});

console.log('Strings and equipment');
t('Jinko 580 + Huawei 10: Voc cold(5C)=51.47*1.05=54.04, maxS=20, minS=4', () => {
  const r = C.stringConfig(20, jinko, hw10, 1, {}); near(r.vocCold, 54.0435, 1e-3); assert.strictEqual(r.maxS, 20); assert.strictEqual(r.minS, 4);
});
t('Imp 13.62 A > Huawei M1 13.5 A MPPT limit => warning; M2 22 A => none', () => {
  assert.ok(C.stringConfig(20, jinko, hw10, 1, {}).warn.includes('mpptCurrent')); assert.ok(!C.stringConfig(20, jinko, hw15, 1, {}).warn.includes('mpptCurrent'));
});
t('21 panels cannot be one string on Huawei 10 kW (max 20 in series)', () => { const r = C.stringConfig(21, jinko, hw10, 1, {}); assert.ok(r.series <= 20); });

console.log('Financial');
t('flat 2000/yr on 10000, no degradation/O&M/discount: payback 5.0, NPV 10000', () => {
  const f = C.financial(10000, 2000, 1000, { degr: 0, degrYear1: 0, om: 0, replPct: 0, disc: 0, esc: 0, life: 10 }); near(f.payback, 5, 1e-9); near(f.npv, 10000, 1e-6); near(f.lifetimeNet, 10000, 1e-6);
});
t('Jinko degradation: year1 0.99, year25 0.894, year30 0.874 (87.4% = datasheet)', () => {
  const f = C.financial(1, 100, 1, { degr: 0.4, degrYear1: 1, om: 0, replPct: 0, disc: 0, esc: 0, life: 30 }); near(f.years[0].factor, 0.99, 1e-12); near(f.years[24].factor, 0.894, 1e-12); near(f.years[29].factor, 0.874, 1e-12);
});
t('LCOE with zero costs beyond capex, no discount: capex / lifetime kWh', () => {
  const f = C.financial(1000, 0, 100, { degr: 0, degrYear1: 0, om: 0, replPct: 0, disc: 0, esc: 0, life: 10 }); near(f.lcoe, 1000 / 1000, 1e-9);
});

console.log('Energy flows');
t('flows balance: direct + exported = production; direct <= consumption', () => { const r = C.design(Object.assign({ type: 'villa', city: 'riyadh', len: 20, wid: 12, cons: 2500, mode: 'kwh', tilt: 10, system: 'grid' })); near(r.flows.direct + r.flows.exported, r.flows.production, 1e-6); assert.ok(r.flows.direct <= r.flows.consumption + 1e-9); near(r.flows.gridAfter, r.flows.consumption - r.flows.direct, 1e-6); });
t('small system (prod << consumption): almost nothing is exported', () => { const s = C.savings({ type: 'villa', monthly: 10000, prodMonths: Array(12).fill(1000) }, { tariffSet: 'y2027', exportMode: 'self', selfUse: { villa: 0.45 } }); near(s.exported, 0, 1e-9); near(s.used, 12000, 1e-9); });
t('default mode counts NO value for exported energy; net scenario saves more', () => { const r = C.design({ type: 'villa', city: 'riyadh', len: 20, wid: 12, cons: 2500, mode: 'kwh', tilt: 10, system: 'grid' }); assert.strictEqual(r.exportMode, 'self'); assert.ok(r.alt.mode === 'net' && r.alt.save > r.save && r.warnings.includes('exportUnvalued')); });
t('self mode: direct use = min(prod, consumption*daylight share) per month (hand: 1000 prod, 1000 cons, 0.55 -> 550)', () => { const s = C.savings({ type: 'villa', monthly: 1000, prodMonths: Array(12).fill(1000) }, { tariffSet: 'y2027', exportMode: 'self', selfUse: { villa: 0.55 } }); near(s.used, 6600, 1e-9); near(s.exported, 5400, 1e-9); });
t('with a surplus credit of 0.07 SAR/kWh the exported energy is paid', () => { const a = C.savings({ type: 'villa', monthly: 1000, prodMonths: Array(12).fill(1000) }, { tariffSet: 'y2027', exportMode: 'self', selfUse: { villa: 0.5 }, surplusCredit: 0 }), b = C.savings({ type: 'villa', monthly: 1000, prodMonths: Array(12).fill(1000) }, { tariffSet: 'y2027', exportMode: 'self', selfUse: { villa: 0.5 }, surplusCredit: 0.07 }); near(b.save - a.save, 6000 * 0.07, 1e-9); });
console.log('Whole design');
const base = { type: 'villa', city: 'riyadh', len: 20, wid: 12, cons: 2500, mode: 'kwh', tilt: 10, system: 'grid' };
t('design runs and its PRODUCTION is ~100% of annual consumption on a big roof', () => { const r = C.design(base); assert.ok(r.ok); assert.ok(r.prod >= r.annual * 0.98 && r.prod <= r.annual * 1.06, r.prod + ' vs ' + r.annual); });
t('panel count = ceil(annual/(specific yield*0.58)) within 1 panel', () => { const r = C.design(base); const spec = C.production({ city: 'riyadh', tilt: 10, kwp: 1, panel: jinko, inv: null }).specific; assert.ok(Math.abs(r.n - Math.ceil(r.annual / spec / 0.58)) <= 1); });
t('bigger consumption => more panels; savings positive; conservative payback not shorter', () => { const a = C.design(base), b = C.design(Object.assign({}, base, { cons: 4000, len: 40, wid: 20 })); const inf = x => x == null ? Infinity : x; assert.ok(b.n > a.n && a.save > 0 && inf(a.finLow.payback) >= inf(a.fin.payback)); });
t('obstacle rectangle removes panels from the layout', () => { const a = C.design(base), b = C.design(Object.assign({}, base, { obs: [{ x: 0, y: 0, w: 12, h: 10 }] })); assert.ok(b.blocked > a.blocked); });
t('roof too small => roofLimited warning and production below need', () => { const r = C.design(Object.assign({}, base, { len: 6, wid: 5, cons: 6000 })); assert.ok(!r.ok || r.warnings.includes('roofLimited')); });
t('2027 tariff gives higher savings than current for the same design', () => { const a = C.design(base, { tariffSet: 'current' }), b = C.design(base, { tariffSet: 'y2027' }); assert.ok(b.save > a.save); });

console.log('Customer inputs: AC load, orientation, occupancy, confidence, size options');
t('AC load: 3 units x 2 t, 10 h/day, villa => 10389.96 kWh/yr AC (+450/month base) = 1315.83 kWh/month', () => {
  const a = C.acLoad({ units: 3, tons: 2, hours: 10, type: 'villa' }); near(a.unitKw, 2.4, 1e-9); near(a.acAnnual, 50.4 * 206.15, 0.01); near(a.monthlyAvg, 50.4 * 206.15 / 12 + 450, 0.01);
});
t('azimuth factor: 0 deg = 1, 45 = 0.98, 90 = 0.92, 180 = 0.80', () => { near(C.azFactor(0), 1, 1e-12); near(C.azFactor(45), 0.98, 1e-12); near(C.azFactor(90), 0.92, 1e-12); near(C.azFactor(180), 0.8, 1e-12); near(C.azFactor(-90), 0.92, 1e-12); });
t('confidence: all known = 10% high; azimuth+shade unknown = 17% medium; plus AC-estimated load = 27% low', () => {
  const a = C.confidence({ azUnknown: false, shade: 'none' }), b = C.confidence({ azUnknown: true, shade: 'unknown' }), c = C.confidence({ azUnknown: true, shade: 'unknown', consFromAc: true });
  assert.deepStrictEqual([a.rangePct, a.level, b.rangePct, b.level, c.rangePct, c.level], [10, 'high', 17, 'medium', 27, 'low']);
});
t('design: panels facing 90 deg from south yield 0.92x the specific yield', () => { const a = C.design(Object.assign({}, base, { azDev: 0 })), b = C.design(Object.assign({}, base, { azDev: 90 })); near(b.yieldKwh / a.yieldKwh, 0.92, 1e-9); });
t('design: production range widens when inputs are missing (range uses the confidence %)', () => {
  const a = C.design(Object.assign({}, base, { azDev: 0, shade: 'none' })), b = C.design(base); near(a.prodLow / a.prod, 0.9, 1e-9); near(b.prodLow / b.prod, 0.83, 1e-9); assert.strictEqual(b.conf.level, 'medium');
});
t('design from AC units (no bill): consumption = AC estimate, confidence low, flagged', () => {
  const r = C.design(Object.assign({}, base, { mode: 'ac', cons: 0, ac: { units: 3, tons: 2, hours: 10 } })); assert.ok(r.ok); near(r.monthly, 1315.83, 0.01); assert.strictEqual(r.conf.level, 'low');
});
t('design: AC mode with zero units is rejected', () => assert.strictEqual(C.design(Object.assign({}, base, { mode: 'ac', ac: { units: 0 } })).error, 'ac'));
t('daytime occupancy: high > normal > low direct use, and savings follow (no export credit)', () => {
  const big = Object.assign({}, base, { len: 40, wid: 30, cons: 1500, azDev: 0, shade: 'none' }), lo = C.design(Object.assign({}, big, { daytime: 'low' })), no = C.design(big), hi = C.design(Object.assign({}, big, { daytime: 'high' }));
  assert.ok(lo.flows.direct < no.flows.direct && no.flows.direct < hi.flows.direct && lo.save < no.save && no.save < hi.save);
});
t('size options: 8 rows, exported share never falls as the array grows, flows balance, 100% row = chosen design', () => {
  const r = C.design(Object.assign({}, base, { cons: 2500, len: 40, wid: 30 })); assert.strictEqual(r.sizing.rows.length, 8);
  for (let i = 1; i < 8; i++) assert.ok(r.sizing.rows[i].exportShare >= r.sizing.rows[i - 1].exportShare - 1e-9);
  const last = r.sizing.rows[7]; near(last.kwp, r.kwp, 1e-9); near(last.cost, r.cost, 1e-6); assert.ok(r.sizing.best && r.sizing.best.npv >= last.npv);
});
t('sizePct=50 builds about half the array', () => { const f = C.design(Object.assign({}, base, { cons: 2500, len: 40, wid: 30 })), h = C.design(Object.assign({}, base, { cons: 2500, len: 40, wid: 30, sizePct: 50 })); assert.ok(Math.abs(h.n - Math.ceil(f.n * 0.5)) <= 1); });

console.log('Data provenance');
t('every tariff class cites a source that exists', () => Object.values(D.TARIFF.sets).forEach(s => Object.values(s.classes).forEach(c => { assert.strictEqual(c.status, 'sourced'); c.src.forEach(k => assert.ok(D.SOURCES[k], k)); })));
t('every verified equipment record cites a source that exists', () => D.EQUIP.filter(e => e.verified).forEach(e => assert.ok(D.SOURCES[e.source], e.id)));
t('every unverified equipment record is labelled unverified', () => D.EQUIP.filter(e => !e.verified).forEach(e => assert.ok(/unverified/.test(e.name), e.id)));
t('every loss/finance/price item declares a status', () => { Object.keys(D.LOSSES).forEach(k => assert.ok(D.LOSSES[k].status, k)); Object.keys(D.FIN).forEach(k => assert.ok(D.FIN[k].status, k)); assert.strictEqual(D.PRICES.status, 'assumption'); });
t('customer-input models declare status',()=>Object.keys(D.USE).forEach(k=>assert.ok(D.USE[k].status,k)));
t('SERA surplus credit is flagged as NOT in force and default credit is 0', () => { assert.strictEqual(D.EXPORT.surplusCredit.inForce, false); assert.strictEqual(C.DEFAULTS.surplusCredit, 0); });

console.log('\n' + (n - failed) + '/' + n + ' passed');
process.exit(failed ? 1 : 0);
