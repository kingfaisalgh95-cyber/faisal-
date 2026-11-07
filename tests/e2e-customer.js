const { chromium } = require('playwright'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL ' + m); } };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const png = '/tmp/roof.png'; fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  for (const w of [360, 390, 768, 1366]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 } }); const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(w + ' ' + e.message));
    await pg.goto('http://localhost:8765/'); await pg.waitForTimeout(300);
    const txt = () => pg.evaluate(() => document.body.innerText);
    const noX = async (m) => ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), w + ' overflow ' + m);
    let T = await txt(); ok(!/98%|10[,،.]?000 مشروع/.test(T), w + ' no fake stats'); ok(/مثال محسوب بالمحرك/.test(T), w + ' example'); await noX('landing');
    await pg.click('#startCta'); await pg.waitForTimeout(300);
    await pg.click('[data-go="2"]'); await pg.waitForTimeout(300); ok(/مساحة السطح/.test(await pg.innerText('#err')), w + ' step1 validation');
    ok(await pg.locator('#roleSel').isHidden(), w + ' role select hidden for customer'); ok(await pg.locator('#links a').count() === 5, w + ' simple nav');
    await pg.fill('#f-area', '150'); await pg.fill('#f-cons', '600'); await pg.waitForTimeout(500);
    await pg.click('[data-go="2"]'); await pg.waitForTimeout(300); ok(/تفاصيل إضافية/.test(await txt()), w + ' step2'); ok(Number(await pg.inputValue('#f-len')) === 10 && Number(await pg.inputValue('#f-wid')) === 15, w + ' area -> dims 10x15');
    ok(/± 17%/.test(await pg.innerText('#accBox')), w + ' acc 17'); await noX('step2');
    await pg.setInputFiles('#photoIn', png); await pg.waitForTimeout(600); ok(await pg.locator('.photo img').count() === 1, w + ' photo');
    await pg.selectOption('#f-azDev', '0'); await pg.selectOption('#f-shade', 'none'); await pg.waitForTimeout(500);
    ok(/± 10%/.test(await pg.innerText('#accBox')), w + ' acc 10 after az+shade');
    await pg.fill('#f-budget', '30000'); await pg.click('#skipBtn'); await pg.waitForTimeout(800); await noX('result');
    ok(/ملخص نتيجتك/.test(await txt()), w + ' plain summary'); ok(await pg.locator('.briefl li').count() === 4, w + ' 4 plain lines');
    ok(await pg.locator('.opt').count() === 8, w + ' 8 options'); ok(await pg.locator('.opt .over, .opt .in').count() === 8, w + ' budget flags');
    const kw0 = await pg.innerText('.opt.cur .oh span'); await pg.click('.opt:not(.cur) [data-size]'); await pg.waitForTimeout(600);
    ok(kw0 !== await pg.innerText('.opt.cur .oh span'), w + ' choose size changes design');
    await pg.click('#saveBtn'); ok(/حُفظ|تم/.test(await pg.innerText('#saveMsg')), w + ' saved');
    await pg.click('#rqBtn'); ok((await pg.innerText('#rq-err')).length > 0, w + ' request needs name');
    await pg.fill('#rq-name', 'عميل تجريبي'); await pg.fill('#rq-phone', '0500000000'); await pg.click('#rqBtn'); await pg.waitForTimeout(300); ok(/#requests|requests/.test(await pg.innerHTML('#rq-ok')), w + ' request sent');
    await pg.reload(); await pg.waitForTimeout(300); await pg.evaluate(() => location.hash = '#projects'); await pg.waitForTimeout(300); ok(await pg.locator('[data-open]').count() === 1, w + ' persisted');
    await pg.evaluate(() => location.hash = '#projects'); await pg.click('[data-open]'); await pg.waitForTimeout(500); await pg.click('#reportBtn'); await pg.waitForTimeout(1500); ok(await pg.locator('#r3d img').count() === 2 || /تعذّر عرض المجسم/.test(await pg.innerText('#r3d')), w + ' report has 3D images (or fallback)'); ok(await pg.locator('.rroof svg').count() === 1, w + ' report has 2D plan'); await noX('report');
    await pg.evaluate(() => location.hash = '#requests'); await pg.waitForTimeout(300); ok(/عميل|تجريبي|-/.test(await txt()) && await pg.locator('.track').count() >= 1, w + ' tracker');
    if (w === 390) {
      await pg.evaluate(() => { location.hash = '#design'; }); await pg.waitForTimeout(300);
      await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('shaqaf.v2')); s.draft = null; localStorage.setItem('shaqaf.v2', JSON.stringify(s)); }); await pg.reload(); await pg.evaluate(() => { location.hash = '#design'; }); await pg.waitForTimeout(300);
      await pg.fill('#f-area', '150'); await pg.selectOption('#f-mode', 'ac'); await pg.waitForTimeout(300);
      await pg.fill('#f-ac-units', '5'); await pg.fill('#f-ac-hours', '12'); await pg.waitForTimeout(600);
      await pg.click('[data-go="2"]'); await pg.waitForTimeout(300); ok(/± 27%/.test(await pg.innerText('#accBox')) && /منخفضة/.test(await pg.innerText('#accBox')), 'AC mode low confidence');
      await pg.click('#langBtn'); await pg.waitForTimeout(300); T = await txt(); ok(!/\b(lp|w|acc|res|f|ac|wiz)\.[a-zA-Z0-9]+\b/.test(T), 'EN no raw keys'); ok(/Accuracy|accuracy/.test(T), 'EN accuracy');
      await pg.evaluate(() => location.hash = '#dashboard'); await pg.waitForTimeout(300); T = await txt(); ok(/Design your solar system/.test(T) && !/\b(lp)\.[a-z0-9]+/.test(T), 'EN landing');
    }
    await ctx.close();
  }
  console.log(pass + ' passed, ' + fail + ' failed'); console.log(errs.join('\n') || 'no page errors'); await b.close(); process.exit(fail ? 1 : 0);
})();
