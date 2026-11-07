/* Shaqaf Energy — documented data layer.
   Every datum carries a status and a source id:
     status 'sourced'     : value read from the cited page/datasheet on the retrieval date.
     status 'derived'     : computed from sourced values (method stated).
     status 'assumption'  : NOT from a source. A modelling choice that must be validated; shown as such in the UI.
   Nothing in the engine may use a number that is not in this file or in the user's own input.
   Retrieval date of all sources below: 2026-11-07. */
(function (root) {
  'use strict';

  var RETRIEVED = '2026-11-07';

  var SOURCES = {
    meed: { title: 'MEED — Saudi Arabia raises electricity tariffs (Saudi Energy announcement, effective 1 Jan 2027)', url: 'https://guest.meed.com/saudi-arabia-raises-electricity-tariffs/', kind: 'press (secondary)' },
    slg: { title: 'Saudi Life Guide — Saudi Electricity Tariff 2027 (cites Saudi Energy announcement of 25 Oct 2026, ECRA/SERA meter fees)', url: 'https://saudilifeguide.com/?p=2477', kind: 'press (secondary)' },
    gazette: { title: 'Saudi Gazette — Revised residential and commercial electricity tariffs to remain same (ECRA Electricity Service Provision Guide, 21 Jun 2025)', url: 'https://saudigazette.com.sa/article/652853/SAUDI-ARABIA/Revised-residential-and-commercial-electricity-tariffs-to-remain-same', kind: 'press (secondary)' },
    profilesolar: { title: 'profileSOLAR — Solar PV potential in Saudi Arabia by location (seasonal kWh/day per kW, from NASA POWER hourly data; updated 21 Jul 2025)', url: 'https://profilesolar.com/countries/SA/', kind: 'derived from NASA POWER (secondary)' },
    kacare: { title: 'Sustainability 2018, 10(4), 1129 — Solar Energy Resource Analysis and Evaluation of PV System Performance in Various Regions of Saudi Arabia (K.A.CARE measured GHI, Dec 2015–Nov 2016)', url: 'https://mdpi.com/2071-1050/10/4/1129/html', kind: 'peer-reviewed' },
    jinko: { title: 'JinkoSolar datasheet JKM560-580N-72HL4-BDV (Tiger Neo)', url: 'https://jinkosolar.com/uploads/JKM560-580N-72HL4-BDV-F6-EN.pdf', kind: 'manufacturer datasheet' },
    enf: { title: 'ENF Solar — Jinko Tiger Neo 72HL4 565–585W (cross-check of dimensions/coefficients)', url: 'https://www.enfsolar.com/pv/panel-datasheet/crystalline/57571', kind: 'directory (cross-check)' },
    huaweiM1: { title: 'Huawei SUN2000-3/4/5/6/8/10KTL-M1 specifications (high-current version)', url: 'https://solar.huawei.com/pk/products/SUN2000-3-4-5-6-8-10KTL-M1/specs', kind: 'manufacturer specs' },
    huaweiDs: { title: 'Huawei FusionSolar Residential & Commercial datasheet (M1 v03 2020-09-12; M2 v02 2019-05-12)', url: 'https://solar.huawei.com/-/media/Solar/attachment/pdf/la/datasheet/FusionSolar_Residential_Commercial_Datasheet.pdf', kind: 'manufacturer datasheet' },
    sera: { title: 'SMM — Saudi Arabia proposes self-consumption solar framework with net billing (SERA draft, 20 Oct 2026)', url: 'https://news.metal.com/newscontent/104166881-smm-pv-flash-saudi-arabia-proposes-self-consumption-solar-framework-with-net-billing-mechanism', kind: 'press (secondary), PROPOSAL not in force' },
    pvtech: { title: 'PV Tech — Saudi Arabia approves net metering framework for systems up to 2MW (ECRA, 21 Aug 2017, effective Jul 2018)', url: 'https://www.pv-tech.org/saudi-arabia-approves-net-metering-framework-for-systems-up-to-2mw', kind: 'press (secondary); current applicability unconfirmed' }
  };

  // ---------- tariffs (SAR/kWh, excl. VAT; tier boundary kWh/month) ----------
  // class -> { rate1, limit, rate2 }. Fixed monthly charges are not modelled: solar does not change them.
  var TARIFF = {
    vat: { value: 0.15, status: 'sourced', src: 'slg', note: 'Prices exclude 15% VAT.' },
    sets: {
      current: {
        label: { ar: 'التعرفة الحالية (سارية حتى 31-12-2026)', en: 'Current tariff (in force until 31 Dec 2026)' },
        inForceFrom: null, inForceUntil: '2026-12-31',
        classes: {
          residential: { rate1: 0.18, limit: 6000, rate2: 0.30, status: 'sourced', src: ['gazette', 'meed'] },
          commercial: { rate1: 0.22, limit: 6000, rate2: 0.32, status: 'sourced', src: ['gazette', 'meed'] },
          industrial: { rate1: 0.20, limit: 1e12, rate2: 0.20, status: 'sourced', src: ['meed'], note: 'Flat; "previous rate" in the MEED table.' }
        }
      },
      y2027: {
        label: { ar: 'التعرفة المعلنة من 1-1-2027', en: 'Announced tariff from 1 Jan 2027' },
        inForceFrom: '2027-01-01', inForceUntil: null,
        classes: {
          residential: { rate1: 0.21, limit: 6000, rate2: 0.33, status: 'sourced', src: ['meed', 'slg'] },
          commercial: { rate1: 0.25, limit: 6000, rate2: 0.35, status: 'sourced', src: ['meed', 'slg'] },
          industrial: { rate1: 0.23, limit: 1e12, rate2: 0.23, status: 'sourced', src: ['meed', 'slg'] }
        }
      }
    },
    // The three tariff statements above come from press reports of the Saudi Energy announcement, not the official document.
    caveat: { ar: 'مصدر التعرفة تقارير صحفية عن إعلان "الطاقة السعودية" (25 أكتوبر 2026)؛ يجب التحقق من الموقع الرسمي قبل الاعتماد التعاقدي.', en: 'Tariffs come from press reports of the Saudi Energy announcement (25 Oct 2026); verify against the official document before contractual use.' }
  };

  // ---------- export / net metering ----------
  var EXPORT = {
    modes: {
      net: { status: 'assumption', src: ['pvtech'], note: { ar: 'مقاصّة kWh بكWh مع ترحيل الفائض داخل السنة (نظام صافي القياس 2017/2018؛ يجب تأكيد سريانه مع شركة الكهرباء).', en: 'kWh-for-kWh netting, surplus carried within the year (2017/2018 net-metering scheme; applicability to be confirmed with the utility).' } },
      self: { status: 'assumption', note: { ar: 'استهلاك ذاتي فقط؛ الفائض يُصدَّر بسعر الاعتماد المحدد.', en: 'Self-consumption only; surplus exported at the stated credit rate.' } }
    },
    surplusCredit: { residential: 0.07, other: 0.05, status: 'sourced', src: ['sera'], inForce: false, note: 'SERA PROPOSAL (Oct 2026), credits valid 12 months. Not in force; default engine value is therefore 0.' }
  };

  // ---------- irradiance: average daily kWh per kW installed by season, at the optimal fixed tilt (NASA POWER via profileSOLAR) ----------
  // Interpreted as plane-of-array irradiation in peak-sun-hours (i.e. before system losses). Consistency check:
  // Riyadh annual mean 6.83 vs measured GHI 6.41 kWh/m2/day (K.A.CARE, 2015-16) => ratio 1.065, a plausible tilt gain.
  var CITY = {
    riyadh: { ar: 'الرياض', en: 'Riyadh', lat: 24.7136, lon: 46.6753, tiltOpt: 22, summer: 8.30, autumn: 6.42, winter: 4.92, spring: 7.67 },
    jeddah: { ar: 'جدة', en: 'Jeddah', lat: 21.4849, lon: 39.1920, tiltOpt: 19, summer: 7.69, autumn: 6.24, winter: 5.23, spring: 7.78 },
    dammam: { ar: 'الدمام', en: 'Dammam', lat: 26.4336, lon: 50.1116, tiltOpt: 23, summer: 7.35, autumn: 5.45, winter: 4.15, spring: 6.69 },
    tabuk: { ar: 'تبوك', en: 'Tabuk', lat: 28.4021, lon: 36.5690, tiltOpt: 25, summer: 8.79, autumn: 6.08, winter: 4.78, spring: 8.16 },
    abha: { ar: 'أبها', en: 'Abha', lat: 18.2181, lon: 42.5055, tiltOpt: 17, summer: 7.10, autumn: 6.67, winter: 5.88, spring: 7.54 },
    buraidah: { ar: 'بريدة', en: 'Buraidah', lat: 26.3264, lon: 43.9769, tiltOpt: 23, summer: 8.55, autumn: 6.20, winter: 4.63, spring: 7.58 },
    madinah: { ar: 'المدينة المنورة', en: 'Madinah', lat: 24.4662, lon: 39.6168, tiltOpt: 22, summer: 8.10, autumn: 6.15, winter: 5.03, spring: 7.76 },
    makkah: { ar: 'مكة المكرمة', en: 'Makkah', lat: 21.4230, lon: 39.8210, tiltOpt: 19, summer: 7.69, autumn: 6.24, winter: 5.23, spring: 7.78,
      note: 'Source gives values identical to Jeddah (same NASA POWER grid cell).' }
  };
  var IRR = { status: 'sourced', src: ['profilesolar', 'kacare'], resolution: 'seasonal (4 values); monthly output is a step function by season',
    seasonOfMonth: [3, 3, 1, 1, 1, 2, 2, 2, 0, 0, 0, 3] /* index into [autumn? see below] */ };
  // month -> season key (Jan..Dec): winter Dec-Feb, spring Mar-May, summer Jun-Aug, autumn Sep-Nov
  IRR.monthSeason = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
  delete IRR.seasonOfMonth;
  var DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // ---------- performance-ratio chain (everything here except the panel/inverter datasheet links is an ASSUMPTION) ----------
  var LOSSES = {
    cellTempAvgC: { value: 55, status: 'assumption', note: 'Production-weighted average cell temperature in a hot climate. Temperature loss = |tcPmax| x (value - 25), using the selected panel\'s datasheet coefficient.' },
    soilingPct: { value: 6, status: 'assumption', note: 'Dust soiling with periodic cleaning. No Saudi measurement was retrieved.' },
    mismatchDcPct: { value: 2, status: 'assumption', note: 'Module mismatch + DC wiring.' },
    wiringAcPct: { value: 1, status: 'assumption', note: 'AC wiring and transformer-less connection.' },
    availabilityPct: { value: 1, status: 'assumption', note: 'Downtime/outages.' },
    inverterEffFallbackPenaltyPt: { value: 0.8, status: 'assumption', note: 'Where only max efficiency is published, weighted efficiency is taken as max minus this many points.' },
    tiltLossK: { value: 0.00007, status: 'assumption', note: 'Annual plane-of-array loss = k x (tilt - optimal tilt)^2 (typical flat-plate behaviour); not from a source.' },
    uncertaintyPct: { value: 10, status: 'assumption', note: 'Half-width of the production range shown to the customer (conservative case = -this %).' },
    crossCheck: { status: 'sourced', src: ['kacare'], note: 'Peer-reviewed HOMER simulation with temperature effect gave yield factors of 1430-1720 kWh/kWp (44 stations, 2015-16). Engine results should sit in the same order of magnitude; the paper does not state its derating, so it is a plausibility bound, not a calibration.' }
  };

  // ---------- equipment (datasheet values) ----------
  var EQUIP = [
    { id: 'jkm580', kind: 'panel', name: 'JinkoSolar Tiger Neo JKM580N-72HL4-BDV 580W', maker: 'JinkoSolar', watt: 580, eff: 22.45, voc: 51.47, vmp: 42.59, isc: 14.37, imp: 13.62,
      tcPmax: -0.29, tcVoc: -0.25, tcIsc: 0.045, noct: 45, len: 2.278, wid: 1.134, thick: 0.030, kg: 32, vsysMax: 1500, degrYear1: 1.0, degrAnnual: 0.40, warrantyProduct: 12, warrantyPower: 30,
      verified: true, source: 'jinko', crossCheck: 'enf (dimensions/coefficients agree; ENF lists 35 mm/27 kg for the non-BDV variant)' },
    { id: 'hw5', kind: 'inverter', name: 'Huawei SUN2000-5KTL-M1 (high current)', maker: 'Huawei', kw: 5, phase: 3, vmax: 1100, mpptMin: 140, mpptMax: 980, start: 200, mppts: 2, stringsPerMppt: 1, imMax: 13.5, effMax: 98.4, effEuro: 97.5, hybrid: false, verified: true, source: 'huaweiM1' },
    { id: 'hw8', kind: 'inverter', name: 'Huawei SUN2000-8KTL-M1 (high current)', maker: 'Huawei', kw: 8, phase: 3, vmax: 1100, mpptMin: 140, mpptMax: 980, start: 200, mppts: 2, stringsPerMppt: 1, imMax: 13.5, effMax: 98.6, effEuro: 98.0, hybrid: false, verified: true, source: 'huaweiM1' },
    { id: 'hw10', kind: 'inverter', name: 'Huawei SUN2000-10KTL-M1 (high current)', maker: 'Huawei', kw: 10, phase: 3, vmax: 1100, mpptMin: 140, mpptMax: 980, start: 200, mppts: 2, stringsPerMppt: 1, imMax: 13.5, effMax: 98.6, effEuro: 98.1, hybrid: false, verified: true, source: 'huaweiM1' },
    { id: 'hw12', kind: 'inverter', name: 'Huawei SUN2000-12KTL-M2', maker: 'Huawei', kw: 12, phase: 3, vmax: 1080, mpptMin: 160, mpptMax: 950, start: 200, mppts: 2, stringsPerMppt: 2, imMax: 22, effMax: 98.5, effEuro: null, hybrid: false, verified: true, source: 'huaweiDs' },
    { id: 'hw15', kind: 'inverter', name: 'Huawei SUN2000-15KTL-M2', maker: 'Huawei', kw: 15, phase: 3, vmax: 1080, mpptMin: 160, mpptMax: 950, start: 200, mppts: 2, stringsPerMppt: 2, imMax: 22, effMax: 98.65, effEuro: null, hybrid: false, verified: true, source: 'huaweiDs' },
    { id: 'hw17', kind: 'inverter', name: 'Huawei SUN2000-17KTL-M2', maker: 'Huawei', kw: 17, phase: 3, vmax: 1080, mpptMin: 160, mpptMax: 950, start: 200, mppts: 2, stringsPerMppt: 2, imMax: 22, effMax: 98.65, effEuro: null, hybrid: false, verified: true, source: 'huaweiDs' },
    { id: 'hw20', kind: 'inverter', name: 'Huawei SUN2000-20KTL-M2', maker: 'Huawei', kw: 20, phase: 3, vmax: 1080, mpptMin: 160, mpptMax: 950, start: 200, mppts: 2, stringsPerMppt: 2, imMax: 22, effMax: 98.65, effEuro: null, hybrid: false, verified: true, source: 'huaweiDs' },
    // Not backed by a datasheet in this build: kept so hybrid/off-grid and >20 kW designs still work, always flagged as unverified.
    { id: 'inv5h', kind: 'inverter', name: 'Hybrid 5kW 1-ph (typical, unverified)', maker: 'Generic', kw: 5, phase: 1, vmax: 600, mpptMin: 90, mpptMax: 520, mppts: 2, iscMax: 32, imMax: 16, effMax: 97.5, effEuro: null, hybrid: true, verified: false, source: '' },
    { id: 'inv10h', kind: 'inverter', name: 'Hybrid 10kW 3-ph (typical, unverified)', maker: 'Generic', kw: 10, phase: 3, vmax: 1000, mpptMin: 160, mpptMax: 850, mppts: 2, iscMax: 32, imMax: 16, effMax: 97.8, effEuro: null, hybrid: true, verified: false, source: '' },
    { id: 'inv50g', kind: 'inverter', name: 'Grid 50kW 3-ph (typical, unverified)', maker: 'Generic', kw: 50, phase: 3, vmax: 1100, mpptMin: 200, mpptMax: 1000, mppts: 5, iscMax: 40, imMax: 26, effMax: 98.5, effEuro: null, hybrid: false, verified: false, source: '' },
    { id: 'inv100g', kind: 'inverter', name: 'Grid 100kW 3-ph (typical, unverified)', maker: 'Generic', kw: 100, phase: 3, vmax: 1100, mpptMin: 200, mpptMax: 1000, mppts: 10, iscMax: 40, imMax: 26, effMax: 98.6, effEuro: null, hybrid: false, verified: false, source: '' },
    { id: 'bat10', kind: 'battery', name: 'LFP rack 10kWh (typical, unverified)', maker: 'Generic', kwh: 10, kw: 5, dod: 90, rte: 94, verified: false, source: '' }
  ];

  // ---------- prices (NO market source retrieved) ----------
  var PRICES = {
    status: 'assumption', retrieved: RETRIEVED,
    note: { ar: 'لم يتم العثور على قائمة أسعار سعودية منشورة قابلة للتوثيق. هذه الأرقام تقدير سوقي يجب استبداله بعروض شركات التركيب (يُدخلها طرف الشركات لاحقاً).', en: 'No citable published Saudi price list was found. These are market estimates to be replaced by installer quotations (entered via the company portal).' },
    costBands: [[10, 3800], [50, 3300], [1e9, 2800]], // SAR per kWp installed, by system size (kWp upper bound)
    split: { panels: 0.38, inverter: 0.17, mounting: 0.12, cables: 0.08, install: 0.20, other: 0.05 },
    battPerKwh: 1800
  };

  var FIN = {
    omPct: { value: 1, status: 'assumption' }, discPct: { value: 6, status: 'assumption' },
    replYear: { value: 12, status: 'assumption' }, replPct: { value: 10, status: 'assumption' },
    escPct: { value: 0, status: 'assumption', note: 'Tariff escalation set to 0 as a conservative default.' },
    lifeYears: { value: 25, status: 'assumption' },
    co2tPerKwh: { value: 0.0006, status: 'assumption', note: 'Grid emission factor; not verified against an official source.' }
  };

  var api = { RETRIEVED: RETRIEVED, SOURCES: SOURCES, TARIFF: TARIFF, EXPORT: EXPORT, CITY: CITY, IRR: IRR, DAYS: DAYS, LOSSES: LOSSES, EQUIP: EQUIP, PRICES: PRICES, FIN: FIN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SolarData = api;
})(typeof window !== 'undefined' ? window : globalThis);
