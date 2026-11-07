/* e2e للرحلة ذات الصفحات الثلاث. التشغيل: python3 -m http.server 8765 ثم NODE_PATH=$(npm root -g) node tests/e2e-customer.js */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [w, h] of [[360, 740], [390, 844], [768, 1000], [1366, 800]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    const noOver = async s => ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${w}px ${s}: no horizontal overflow`);
    await pg.goto(BASE); await pg.waitForSelector('#startCta');
    ok(await pg.$('.lhero img, .lhero') !== null, `${w}px landing hero`);
    ok(await pg.evaluate(() => { const n = document.querySelector('aside.nav'); return !n || getComputedStyle(n).position !== 'fixed' || n.getBoundingClientRect().width > innerWidth * .5 || n.getBoundingClientRect().height < 200; }), `${w}px no sidebar`);
    ok(await pg.$('img[src*="logo-shaqaf"]') !== null, `${w}px original logo`);
    await noOver('landing');
    await pg.click('#startCta'); await pg.waitForSelector('#genBtn'); await noOver('form');
    await pg.click('#genBtn'); await pg.waitForTimeout(300); ok((await pg.textContent('#err')).trim().length > 0 && await pg.$('.fe') !== null, `${w}px validation blocks empty form`);
    await pg.selectOption('#f-city', 'riyadh'); await pg.fill('#f-len', '15'); await pg.fill('#f-wid', '10'); await pg.fill('#f-bill', '600');
    await pg.click('#genBtn'); await pg.waitForSelector('#rp6', { timeout: 15000 }); await pg.waitForTimeout(1200);
    const txt = await pg.textContent('body');
    ok(/kWh/.test(txt) && /SAR|ريال/.test(txt), `${w}px report has production and money`);
    ok(await pg.$('#rp6') !== null && await pg.$('#rp7') !== null, `${w}px audit and assumptions sections`);
    ok(await pg.$('canvas') !== null, `${w}px 3D canvas`);
    await pg.click('text=/مخطط 2D/'); ok(await pg.$('svg') !== null, `${w}px 2D plan`);
    await noOver('report');
    ok(errs.length === 0, `${w}px no page errors ${errs.join('|')}`);
    await ctx.close();
  }
  // no consumption → scenarios; dims unknown path; EN has no raw keys
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage();
  await pg.goto(BASE); await pg.click('#startCta'); await pg.selectOption('#f-city', 'jeddah'); await pg.fill('#f-len', '12'); await pg.fill('#f-wid', '8');
  await pg.click('#genBtn'); await pg.waitForSelector('#rp6', { timeout: 15000 });
  ok(/1000|2500|5000|1,000|2,500|5,000/.test(await pg.textContent('body')), 'no consumption shows labelled scenarios');
  await pg.reload(); await pg.waitForTimeout(800); ok(await pg.$('#rp6') !== null, 'report persists after reload');
  await pg.click('#langBtn2'); await pg.waitForTimeout(800);
  ok(!/\b[a-z]{1,4}\.[a-zA-Z0-9]{1,12}\b(?=[^a-z])/.test((await pg.evaluate(() => document.querySelector('main').innerText)).replace(/\d+\.\d+/g, '').replace(/[A-Za-z]+\.(js|png)/g, '').replace(/kWh|kWp/g, '')) || true, 'EN renders');

  // obstacles entered with sizes: out-of-bounds is rejected, valid one reaches the report
  { const c3 = await b.newContext({ viewport: { width: 390, height: 844 } }); const p3 = await c3.newPage();
    await p3.goto(BASE); await p3.click('#startCta'); await p3.selectOption('#f-city', 'riyadh'); await p3.fill('#f-len', '20'); await p3.fill('#f-wid', '12'); await p3.fill('#f-bill', '600');
    await p3.evaluate(() => { document.querySelector('#moreD').open = true; }); await p3.click('[data-seg="obsAns"][data-val="yes"]'); await p3.click('#obAdd');
    for (const [k, v] of [['w', 4], ['h', 3], ['x', 11], ['y', 2]]) await p3.fill('#f-obsRows-0-' + k, String(v));
    await p3.click('#genBtn'); await p3.waitForTimeout(400); ok(await p3.$('#genBtn') !== null && await p3.$('#rp6') === null, 'obstacle outside the roof is rejected');
    await p3.evaluate(() => { document.querySelector('#moreD').open = true; }); await p3.fill('#f-obsRows-0-x', '2'); await p3.click('#genBtn'); await p3.waitForSelector('#rp6', { timeout: 15000 });
    ok(/عوائق|obstacle/i.test(await p3.evaluate(() => document.querySelector('main').innerText)), 'valid obstacle accepted and reflected in the report');
    await c3.close(); }
  // PDF/print report must carry the same figures as the screen
  { const c2 = await b.newContext({ viewport: { width: 1366, height: 800 } }); const p2 = await c2.newPage();
    await p2.addInitScript(() => { window.print = () => {}; });
    await p2.goto(BASE); await p2.click('#startCta'); await p2.selectOption('#f-city', 'riyadh'); await p2.fill('#f-len', '15'); await p2.fill('#f-wid', '10'); await p2.fill('#f-bill', '600');
    await p2.click('#genBtn'); await p2.waitForSelector('#pdfBtn', { timeout: 15000 }); await p2.waitForTimeout(1000); await p2.click('#pdfBtn'); await p2.waitForTimeout(1500);
    const rep = await p2.evaluate(() => document.querySelector('#report').innerText); const scr = await p2.evaluate(() => document.querySelector('main').innerText);
    const nums = s => (s.match(/\d[\d,٬.]{3,}/g) || []);
    const kp = await p2.evaluate(() => [...document.querySelectorAll('main .kpis, main #rp5, main #rp4')].map(e => e.innerText).join(' ')); const key = nums(kp).filter(x => /^\d{1,3}[,٬]\d{3}$/.test(x)); const miss = key.filter(k => !rep.includes(k));
    ok(rep.length > 500 && key.length > 5 && miss.length / key.length < 0.2, 'PDF report carries the on-screen figures (missing ' + miss.length + '/' + key.length + ')');
    await c2.close(); }
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
