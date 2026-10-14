// Pagos de Wallet (POST JSON) y constancias de Yape llegan solos; duplicado con Siri se marca y se borra (tamaño iPhone).
const { chromium } = require(process.env.PW || 'playwright');
const out = process.argv[2] || '.';
const ok = (c, m) => { if (!c) throw new Error('FALLÓ: ' + m); console.log('✓ ' + m); };
(async () => {
  const { code } = await (await fetch('http://127.0.0.1:8790/__code')).json();
  const { u: url, s: secret } = JSON.parse(Buffer.from(code.slice(4), 'base64').toString());
  const post = body => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret, action: 'addTx', ...body }) }).then(r => r.json());
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const main = () => p.evaluate(() => document.querySelector('main')?.innerText || '');
  await p.goto('http://localhost:5173/?reset=1'); await p.waitForTimeout(300);
  await p.click('text=Crear mi plan'); await p.fill('input[autocomplete=given-name]', 'Leo'); await p.fill('input[inputmode=numeric]', '2600');
  await p.click('text=Siguiente'); await p.click('text=Sin tarjetas por ahora'); await p.waitForSelector('text=Crear mis carpetas'); await p.click('text=Crear mis carpetas');
  await p.fill('input[placeholder^="FP1"]', code); await p.click('button:has-text("Conectar")'); await p.waitForSelector('text=Conectado a tu Drive');
  await p.click('text=Ir a mis finanzas'); await p.waitForTimeout(400);

  // Guías en Ajustes
  await p.click('[aria-label="Ajustes"]'); await p.waitForTimeout(300);
  await p.click('text=Registrar solo cada pago con Wallet'); await p.click('text=Registrar Yape o Plin con 2 toques');
  await p.locator('text=Registrar solo cada pago con Wallet').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${out}/wallet-guia.png` });
  await p.locator('div', { hasText: /^Prompt para Siri · Pago Wallet/ }).last().locator('xpath=../..').locator('button:has-text("Copiar")').click();
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  ok(clip.includes(`secret = ${secret}`) && clip.includes(url) && clip.includes('POST'), 'prompt de Wallet con URL, secreto y POST');
  await p.keyboard.press('Escape'); await p.goto('http://localhost:5173/'); await p.waitForTimeout(300);

  // Siri primero, luego Wallet (mismo monto, comercio con espacios) y una constancia de Yape
  ok((await (await fetch(`${url}?s=${encodeURIComponent(secret)}&a=voz&t=${encodeURIComponent('25 soles en Tambo')}`)).json()).ok, 'Siri registra');
  ok((await post({ amount: 'S/. 25.00', merchant: 'TAMBO MIRAFLORES', card: 'Interbank Visa', kind: 'wallet' })).ok, 'Wallet (POST JSON con espacios) registra');
  ok((await post({ text: '¡Yapeaste!\nS/ 18\nPollería El Rey\n14 oct. 2026 - 06:30 pm\nNro. de operación 4455667', kind: 'yape' })).ok, 'Yape registra');
  await post({ text: '¡Yapeaste!\nS/ 18\nPollería El Rey\nNro. de operación 4455667', kind: 'yape' }); // compartida dos veces
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(1500);
  const m = await main();
  ok(/Pollería El Rey/.test(m) && (m.match(/Pollería El Rey/g) || []).length === 1, 'Yape llega una sola vez');
  ok(m.includes('¿Duplicado?') && m.includes('≈ Tambo'), 'Wallet + Siri marcado como posible duplicado');
  await p.locator('text=¿Duplicado?').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${out}/duplicado.png` });
  await p.click('.accent-card >> button:has-text("Borrar")'); await p.waitForTimeout(300);
  const m2 = await main();
  ok(!m2.includes('¿Duplicado?') && !m2.includes('Tambo Miraflores'), 'duplicado borrado, queda el de Siri');
  ok(errs.length === 0, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
