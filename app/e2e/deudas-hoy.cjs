// Día de pago de deudas vs sueldo, "te queda hoy" que baja con cada gasto, Wallet que registra primero y Yape real (tamaño iPhone).
const { chromium } = require(process.env.PW || 'playwright');
const out = process.argv[2] || '.';
const ok = (c, m) => { if (!c) throw new Error('FALLÓ: ' + m); console.log('✓ ' + m); };
(async () => {
  const { code } = await (await fetch('http://127.0.0.1:8790/__code')).json();
  const { u: url, s: secret } = JSON.parse(Buffer.from(code.slice(4), 'base64').toString());
  const post = body => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret, ...body }) });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const main = () => p.evaluate(() => document.querySelector('main')?.innerText || '');
  const sheet = () => p.evaluate(() => document.querySelector('.sheet')?.innerText || '');
  const shot = n => p.screenshot({ path: `${out}/${n}.png` });
  const fill = (label, v) => p.fill(`label:has-text("${label}") input`, v);
  await p.goto('http://localhost:5173/?reset=1'); await p.waitForTimeout(300);
  await p.click('text=Crear mi plan'); await p.fill('input[autocomplete=given-name]', 'Leo'); await p.fill('input[inputmode=numeric]', '2600');
  await p.click('text=Siguiente');
  await p.click('text=Agregar tarjeta'); await p.fill('input[placeholder^="BBVA Visa"]', 'BBVA Visa');
  await fill('Deuda actual', '900'); await fill('TCEA', '60'); await fill('Pago mínimo', '100');
  await p.click('.sheet >> text=Guardar');
  ok((await sheet()).includes('día del mes en que vence'), 'el día de pago de la deuda es obligatorio (sin 5 por defecto)');
  await fill('Día de pago', '20'); await p.click('.sheet >> text=Guardar');
  await p.click('text=Calcular plan óptimo'); await p.waitForSelector('text=Crear mis carpetas'); await p.click('text=Crear mis carpetas');
  await p.fill('input[placeholder^="FP1"]', code); await p.click('button:has-text("Conectar")'); await p.waitForSelector('text=Conectado a tu Drive');
  await p.click('text=Ir a mis finanzas'); await p.waitForTimeout(400);

  // Sueldo el 15; la tarjeta vence el 20 → no se separa
  await p.click('text=Escribir mi dinero de hoy');
  await p.fill('[aria-label="Dinero que tienes hoy"]', '850'); await p.fill('[aria-label="Día de pago"]', '15');
  ok((await sheet()).includes('Vence después de tu sueldo'), 'la deuda que vence después del sueldo se paga con él');
  await shot('d1-hoja-deudas');
  await p.click('.sheet button[type=submit]'); await p.waitForTimeout(400);
  let m = await main();
  ok(!m.includes('Cuota BBVA') && m.includes('S/ 850 disponibles hasta tu sueldo del 15'), 'no separa la cuota que vence después del sueldo');
  // Cambia el vencimiento al 10 → ahora sí se separa
  await p.click('text=Corregir dinero y día de pago').catch(() => {});
  if (!(await sheet())) { await p.click('[aria-label="Ajustes"]'); await p.click('text=Corregir dinero y día de pago'); }
  await p.fill('[aria-label="Día de pago de BBVA Visa"]', '10'); await p.press('[aria-label="Día de pago de BBVA Visa"]', 'Tab');
  ok((await sheet()).includes('Vence antes de tu sueldo') && (await p.getAttribute('[aria-label="Separar cuota de BBVA Visa"]', 'aria-checked')) === 'true', 'al vencer antes del sueldo se marca para separar');
  await p.click('.sheet button[type=submit]'); await p.waitForTimeout(400);
  m = await main();
  ok(m.includes('Ya separé S/ 100 para Cuota BBVA Visa (vence el 10)'), 'separa la cuota con su día');
  const before = await p.evaluate(() => document.querySelector('main .tnum')?.textContent || '');

  // Wallet: registra primero (solo id), carpeta después
  const id = await (await post({ action: 'addTx', amount: 'S/ 12.00', merchant: 'KIOSKO RARO', kind: 'wallet', resp: 'id' })).text();
  ok(/^[\w-]{8,}$/.test(id), 'Wallet registra y responde el id');
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(1500);
  m = await main();
  ok(m.includes('Elige la carpeta') && m.includes('Kiosko Raro'), 'pago sin carpeta aparece en "Elige la carpeta"');
  ok(/gastaste S\/ 12\b/.test(m), '"te queda hoy" cuenta el gasto de hoy: ' + m.slice(0, 400));
  const after = await p.evaluate(() => document.querySelector('main .tnum')?.textContent || '');
  const n = x => Number(x.replace(/[^0-9.]/g, ''));
  ok(Math.abs((n(before) - n(after)) - 12) < 0.02, `te queda hoy bajó exactamente S/ 12 (${before} → ${after})`);
  await shot('d2-hoy');
  ok((await (await post({ action: 'setFolder', id, folder: 'Comer fuera' })).json()).ok, 'setFolder');
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(1500);
  ok(!(await main()).includes('Elige la carpeta'), 'la carpeta elegida después se aplica');
  await p.click('nav >> text=Carpetas'); await p.click('text=Comer fuera'); await p.waitForTimeout(300);
  ok((await main()).includes('Kiosko Raro'), 'el pago quedó en Comer fuera');

  // Yape con el texto de una constancia real
  await post({ action: 'addTx', kind: 'yape', folder: 'Libre', text: '¡Yapeaste!\nCompartir\nS/\n2.50\nMadeleyne Cas*\n02 nov. 2026 | 8:19 a.m.\nCÓDIGO DE SEGURIDAD\n2\n8\n8\nDATOS DE LA TRANSACCIÓN\nNro. de celular\n*** *** 881\nDestino\nYape\nNro. de operación\n05858288' });
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(1500);
  m = await main();
  ok(/Madeleyne Cas[\s\S]{0,80}S\/ 2\.50/.test(m) && !m.includes('Completa el monto'), 'Yape real llega con S/ 2.50');
  ok(errs.length === 0, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
