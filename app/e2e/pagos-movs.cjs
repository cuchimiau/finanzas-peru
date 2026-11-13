// Registrar el pago de una o más deudas, y Inicio con dos sectores de movimientos + todos los movimientos (tamaño iPhone).
const { chromium } = require(process.env.PW || 'playwright');
const out = process.argv[2] || '.';
const ok = (c, m) => { if (!c) throw new Error('FALLÓ: ' + m); console.log('✓ ' + m); };
(async () => {
  const { code } = await (await fetch('http://127.0.0.1:8790/__code')).json();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const main = () => p.evaluate(() => document.querySelector('main')?.innerText || '');
  const sheet = () => p.evaluate(() => document.querySelector('.sheet')?.innerText || '');
  const fill = (label, v) => p.fill(`label:has-text("${label}") input`, v);
  await p.goto('http://localhost:5173/?reset=1'); await p.waitForTimeout(300);
  await p.click('text=Crear mi plan'); await p.fill('input[autocomplete=given-name]', 'Leo'); await p.fill('input[inputmode=numeric]', '2600');
  await p.click('text=Siguiente');
  await p.click('text=Agregar tarjeta'); await p.fill('input[placeholder^="BBVA Visa"]', 'BBVA Visa');
  await fill('Deuda actual', '900'); await fill('TCEA', '60'); await fill('Pago mínimo', '100'); await fill('Día de pago', '20');
  await p.click('.sheet >> text=Guardar');
  await p.click('text=Agregar tarjeta'); await p.fill('input[placeholder^="BBVA Visa"]', 'Interbank Débito'); await p.click('.sheet >> text=Débito'); await p.click('.sheet >> text=Guardar');
  await p.click('text=Calcular plan óptimo'); await p.waitForSelector('text=Crear mis carpetas'); await p.click('text=Crear mis carpetas');
  await p.fill('input[placeholder^="FP1"]', code); await p.click('button:has-text("Conectar")'); await p.waitForSelector('text=Conectado a tu Drive');
  await p.click('text=Ir a mis finanzas'); await p.waitForTimeout(400);
  // Un préstamo además de la tarjeta
  await p.click('nav >> text=Ajustes'); await p.click('[aria-label="Abrir Deudas"]'); await p.click('text=Deuda o tarjeta'); await p.click('.sheet >> text=Préstamo');
  await p.fill('.sheet input[placeholder^="Préstamo de mi tío"]', 'Tío Juan');
  await fill('Cuánto debes hoy', '500'); await fill('Cuota mensual', '100'); await fill('Día de pago', '25');
  await p.click('.sheet >> text=Guardar'); await p.waitForTimeout(300);
  ok((await main()).includes('S/ 1,400'), 'debes S/ 1,400 entre tarjeta y préstamo');

  // Pagar las dos a la vez desde la débito
  await p.click('text=Registrar pago de deudas');
  await p.click('[aria-label="Pagar BBVA Visa"]'); await p.click('[aria-label="Pagar Tío Juan"]');
  await p.fill('[aria-label="Monto pagado a BBVA Visa"]', '300');
  await p.click('.sheet button:has-text("Todo S/ 500")');
  ok((await sheet()).includes('Registrar 2 pagos · S/ 800'), 'resumen de 2 pagos por S/ 800');
  ok(!(await sheet()).match(/Pagado desde[\s\S]*BBVA Visa/) && (await p.locator('.sheet [role=radio]:has-text("BBVA Visa")').count()) === 0, 'no se puede pagar desde la tarjeta de crédito');
  await p.click('.sheet [role=radio]:has-text("Interbank Débito")');
  await p.screenshot({ path: `${out}/pd1-pagar.png` });
  await p.click('.sheet button[type=submit]'); await p.waitForTimeout(400);
  let m = await main();
  ok(/Debes en total\nS\/ 600/.test(m) && m.includes('Tío Juan · sin deuda'), 'BBVA baja a S/ 600 y el préstamo queda sin deuda');

  // Inicio: dos sectores y todos los movimientos
  await p.evaluate(() => { // un gasto de días anteriores para el segundo sector
    const k = 'finanzas-peru:v2', d = JSON.parse(localStorage.getItem(k));
    d.txs.push({ id: 'old1', name: 'Pardos Chicken', amt: 45, f: 'restaurantes', pay: 'cash', date: new Date(Date.now() - 3 * 864e5).toISOString(), why: 'x', source: 'manual' });
    localStorage.setItem(k, JSON.stringify(d));
  });
  await p.reload(); await p.waitForTimeout(800);
  m = await main();
  ok(!m.includes('Carpetas de gasto'), 'Inicio ya no muestra la vista previa de carpetas');
  ok(/Hoy[\s\S]*Pago BBVA Visa[\s\S]*Pago Tío Juan[\s\S]*Días anteriores[\s\S]*Pardos Chicken[\s\S]*Ver todos los movimientos \(3\)/.test(m), 'Hoy y Días anteriores, luego el botón con el total');
  await p.locator('text=Ver todos los movimientos').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${out}/pd2-inicio.png` });
  await p.click('text=Ver todos los movimientos');
  const all = await main();
  ok(/Hoy[\s\S]*Pago BBVA Visa[\s\S]*Pago Tío Juan[\s\S]*Pardos Chicken/.test(all) && all.includes('3 registrados'), 'todos los movimientos por fecha y agrupados por día');
  await p.fill('[aria-label="Buscar movimientos"]', 'pardos'); await p.waitForTimeout(150);
  ok((await main()).includes('Pardos Chicken') && !(await main()).includes('Pago BBVA'), 'la búsqueda filtra');
  await p.screenshot({ path: `${out}/pd3-todos.png` });
  await p.click('main >> text=Pardos Chicken'); await p.waitForTimeout(200);
  ok((await sheet()).includes('Carpeta') && (await sheet()).includes('Pardos Chicken'), 'tocar un movimiento abre su detalle');
  ok(errs.length === 0, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
