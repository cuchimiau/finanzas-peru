// Wallet sin datos no se pierde, registro de envíos en Ajustes, carpeta aprendida por comercio y Yape "SI 2" (tamaño iPhone).
const { chromium } = require(process.env.PW || 'playwright');
const out = process.argv[2] || '.';
const ok = (c, m) => { if (!c) throw new Error('FALLÓ: ' + m); console.log('✓ ' + m); };
(async () => {
  const { code } = await (await fetch('http://127.0.0.1:8790/__code')).json();
  const { u: url, s: secret } = JSON.parse(Buffer.from(code.slice(4), 'base64').toString());
  const post = body => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret, ...body }) }).then(r => r.json());
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const main = () => p.evaluate(() => document.querySelector('main')?.innerText || '');
  const sheet = () => p.evaluate(() => document.querySelector('.sheet')?.innerText || '');
  await p.goto('http://localhost:5173/?reset=1'); await p.waitForTimeout(300);
  await p.click('text=Crear mi plan'); await p.fill('input[autocomplete=given-name]', 'Leo'); await p.fill('input[inputmode=numeric]', '2600');
  await p.click('text=Siguiente'); await p.click('text=Sin tarjetas por ahora'); await p.waitForSelector('text=Crear mis carpetas'); await p.click('text=Crear mis carpetas');
  await p.fill('input[placeholder^="FP1"]', code); await p.click('button:has-text("Conectar")'); await p.waitForSelector('text=Conectado a tu Drive');
  await p.click('text=Ir a mis finanzas'); await p.waitForTimeout(400);

  // Prueba manual del atajo (sin datos), secreto mal y una compra real
  ok((await post({ action: 'addTx', kind: 'wallet' })).empty === true, 'Wallet sin datos se acepta');
  await fetch(url, { method: 'POST', body: JSON.stringify({ secret: 'mal', action: 'addTx', kind: 'wallet', amount: '3' }) });
  await post({ action: 'addTx', kind: 'wallet', amount: 'S/ 18.00', merchant: 'BEMBOS LARCO', card: 'BBVA' });
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(1500);
  let m = await main();
  ok(m.includes('Elige la carpeta') && m.includes('Pago con Apple Pay (sin datos)'), 'el Wallet sin datos aparece para completarlo');
  // Registro en Ajustes
  await p.click('[aria-label="Ajustes"]'); await p.click('text=Registrar solo cada pago con Wallet'); await p.waitForTimeout(200);
  const st = await main();
  ok(st.includes('Últimos envíos de tus atajos') && /Wallet · sin datos/.test(st) && /código secreto incorrecto/.test(st) && /Wallet · S\/ 18\.00 · BEMBOS LARCO/.test(st), 'el registro muestra prueba manual, secreto mal y compra');
  await p.locator('text=Últimos envíos de tus atajos').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${out}/w1-registro.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('nav >> text=Analítica'); await p.waitForTimeout(200);

  // Elegir carpeta una vez por comercio → la próxima llega sola
  await p.click('main >> text=Bembos Larco'); await p.click('.sheet >> button:has-text("Comer fuera")'); await p.waitForTimeout(300);
  await post({ action: 'addTx', kind: 'wallet', amount: 'S/ 22.00', merchant: 'BEMBOS LARCO', card: 'BBVA' });
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(1500);
  m = await main();
  ok(!/Elige la carpeta[\s\S]*Bembos Larco S\/ 22/.test(m), 'la segunda compra en el mismo comercio no pide carpeta');
  await p.click('nav >> text=Presupuestos'); await p.click('text=Comer fuera'); await p.waitForTimeout(300);
  ok(((await main()).match(/Bembos Larco/g) || []).length === 2, 'las dos compras quedan en Comer fuera');

  // Yape leído como "SI 2"
  await post({ action: 'addTx', kind: 'yape', folder: 'Transporte', text: '¡Yapeaste!\nCompartir\nSI 2\nMadeleyne Cas*\n09 nov. 2026 | 4:16 p.m.\nCÓDIGO DE SEGURIDAD\n2\n8\n8\nNro. de operación\n05900001' });
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(1500);
  m = await main();
  ok(/Madeleyne Cas[\s\S]{0,80}S\/ 2/.test(m) && !m.includes('Si 2') && !m.includes('SI 2') && /Madeleyne Cas\n.*\n−S\/ 2\n/.test(m), 'Yape "SI 2" llega como S/ 2 de Madeleyne Cas: ' + m.slice(0, 900));
  await p.click('main >> text=Madeleyne Cas'); await p.click('text=Texto leído de la constancia');
  ok((await sheet()).includes('CÓDIGO DE SEGURIDAD'), 'se puede ver el texto leído de la constancia');
  await p.screenshot({ path: `${out}/w2-yape.png` });
  ok(errs.length === 0, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
