// Dinero real del mes, sueldo pendiente, carpeta elegida en el Atajo, gráfico de Métricas y metas (tamaño iPhone).
const { chromium } = require(process.env.PW || 'playwright');
const out = process.argv[2] || '.';
const ok = (c, m) => { if (!c) throw new Error('FALLÓ: ' + m); console.log('✓ ' + m); };
(async () => {
  const { code } = await (await fetch('http://127.0.0.1:8790/__code')).json();
  const { u: url, s: secret } = JSON.parse(Buffer.from(code.slice(4), 'base64').toString());
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const main = () => p.evaluate(() => document.querySelector('main')?.innerText || '');
  const shot = n => p.screenshot({ path: `${out}/${n}.png` });
  await p.goto('http://localhost:5173/?reset=1'); await p.waitForTimeout(300);
  await p.click('text=Crear mi plan'); await p.fill('input[autocomplete=given-name]', 'Leo'); await p.fill('input[inputmode=numeric]', '2600');
  await p.click('text=Siguiente'); await p.click('text=Sin tarjetas por ahora'); await p.waitForSelector('text=Crear mis carpetas'); await p.click('text=Crear mis carpetas');
  await p.fill('input[placeholder^="FP1"]', code); await p.click('button:has-text("Conectar")'); await p.waitForSelector('text=Conectado a tu Drive');
  await p.click('text=Ir a mis finanzas'); await p.waitForTimeout(400);

  // Sin dato real: no inventa
  ok((await main()).includes('¿Cuánto dinero tienes hoy?') && !(await main()).includes('Te queda para hoy'), 'sin dinero real no muestra cuánto gastar hoy');
  await shot('m1-sin-dato');
  await p.click('text=Escribir mi dinero de hoy');
  await p.fill('[aria-label="Dinero que tienes hoy"]', '850');
  await p.fill('[aria-label="Día de pago"]', '30');
  await p.click('.sheet [role=checkbox]:has-text("Alquiler")');
  await shot('m2-hoja');
  await p.click('.sheet button[type=submit]'); await p.waitForTimeout(400);
  const m = await main();
  ok(m.includes('Te queda para hoy') && m.includes('hasta tu sueldo del 30'), 'muestra gasto por día hasta el sueldo');
  ok(m.includes('Sueldo pendiente') && m.includes('tienes S/ 850'), 'sueldo pendiente y dinero real S/ 850');
  ok(m.includes('Ya separé S/ 650 para Alquiler') && m.includes('S/ 200 disponibles'), 'solo reserva el pago fijo que marcaste');
  await shot('m3-inicio');

  // Atajo con carpeta elegida
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret, action: 'addTx', amount: 'S/ 30.00', merchant: 'KIOSKO RARO', kind: 'wallet', folder: 'Comer fuera' }) }).then(x => x.json());
  ok(r.ok, 'Wallet con carpeta registra');
  // La app guarda en Drive 2 s después de cada cambio: esperar a que las carpetas estén guardadas.
  let list = '';
  for (let i = 0; i < 20 && !list.includes('Comer fuera'); i++) { list = await (await fetch(`${url}?s=${encodeURIComponent(secret)}&a=carpetas`)).text(); if (!list.includes('Comer fuera')) await p.waitForTimeout(500); }
  ok(list.split('\n').includes('Comer fuera') && list.split('\n').indexOf('Libre') < list.split('\n').indexOf('Fondo de emergencia'), 'el Atajo recibe tus carpetas en orden');
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(1500);
  ok((await main()).includes('tienes S/ 820'), 'el gasto baja el dinero real');
  await p.click('nav >> text=Carpetas'); await p.click('text=Comer fuera'); await p.waitForTimeout(300);
  ok((await main()).includes('Kiosko Raro'), 'el gasto quedó en la carpeta elegida');

  // Ya me pagaron
  await p.click('nav >> text=Inicio'); await p.click('button:has-text("Ya me pagaron")');
  await p.fill('[aria-label="Sueldo recibido"]', '2600'); await p.click('text=Registrar sueldo'); await p.waitForTimeout(300);
  const m2 = await main();
  ok(m2.includes('tienes S/ 3,420') && !m2.includes('Sueldo pendiente'), 'el sueldo suma recién al llegar');

  // Métricas: gráfico
  await p.click('nav >> text=Métricas'); await p.waitForTimeout(300);
  const mt = await main();
  ok(mt.includes('Lo que tienes y lo que gastaste') && mt.includes('Comer fuera') && mt.includes('Te queda'), 'gráfico de lo que tienes vs gastado');
  await shot('m4-metricas');

  // Metas: crear, editar, borrar
  await p.click('button:has-text("Nueva meta")');
  await p.fill('.sheet input[placeholder^="Ej. Laptop"]', 'Laptop'); await p.fill('[aria-label="Monto de la meta"]', '3000'); await p.fill('[aria-label="Aporte mensual"]', '50');
  await p.click('text=Crear meta'); await p.waitForTimeout(300);
  ok((await main()).includes('Laptop') && (await main()).includes('+S/ 50/mes'), 'meta nueva con aporte');
  await p.click('main >> text=Laptop'); await p.fill('.sheet input[placeholder^="Ej. Laptop"]', 'Laptop nueva'); await p.click('.sheet button:has-text("Guardar")'); await p.waitForTimeout(300);
  ok((await main()).includes('Laptop nueva'), 'meta editada');
  await p.click('nav >> text=Carpetas'); await p.waitForTimeout(200);
  ok((await main()).includes('Laptop nueva'), 'la meta tiene su carpeta de ahorro');
  await p.click('nav >> text=Métricas'); await p.click('main >> text=Laptop nueva'); await p.click('text=Borrar meta'); await p.waitForTimeout(300);
  ok(!(await main()).includes('Laptop nueva'), 'meta borrada');
  await p.click('main >> text=Fondo de emergencia'); await p.waitForTimeout(200);
  ok(!(await p.locator('text=Borrar meta').count()), 'el fondo de emergencia no se puede borrar');
  ok(errs.length === 0, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
