// Suscripciones dentro de su carpeta, Registrar con la suscripción, y Analítica con ‹ mes ›, año y filtro (tamaño iPhone).
const { chromium } = require(process.env.PW || 'playwright');
const out = process.argv[2] || '.';
const ok = (c, m) => { if (!c) throw new Error('FALLÓ: ' + m); console.log('✓ ' + m); };
(async () => {
  const { code } = await (await fetch('http://127.0.0.1:8790/__code')).json();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const main = () => p.evaluate(() => document.querySelector('main')?.innerText || '');
  const sheet = () => p.evaluate(() => document.querySelector('.sheet')?.innerText || '');
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:5173/?reset=1'); await p.waitForTimeout(300);
  await p.click('text=Crear mi plan'); await p.fill('input[autocomplete=given-name]', 'Leo'); await p.fill('input[inputmode=numeric]', '2600');
  await p.click('text=Siguiente'); await p.click('text=Sin tarjetas por ahora'); await p.waitForSelector('text=Crear mis carpetas'); await p.click('text=Crear mis carpetas');
  await p.fill('input[placeholder^="FP1"]', code); await p.click('button:has-text("Conectar")'); await p.waitForSelector('text=Conectado a tu Drive');
  await p.click('text=Ir a mis finanzas'); await p.waitForTimeout(400);
  await p.click('text=Escribir mi dinero de hoy'); await p.fill('[aria-label="Dinero que tienes hoy"]', '900'); await p.fill('[aria-label="Día de pago"]', String(Math.min(28, new Date().getDate() + 5)));
  const fixed = await p.locator('.sheet [role=checkbox]:not([aria-label])').evaluateAll(els => els.map(e => e.textContent));
  ok(fixed.some(x => x.includes('Suscripciones')) && !fixed.some(x => x.includes('Salud')), 'Suscripciones es gasto fijo y Salud es variable: ' + fixed.join(', '));
  await p.click('.sheet button[type=submit]'); await p.waitForTimeout(400);

  // Suscripciones dentro de su carpeta
  await p.click('nav >> text=Presupuestos'); await p.click('main >> text=Suscripciones'); await p.waitForTimeout(200);
  for (const [n, a, dd] of [['Netflix', '44.90', '12'], ['Spotify', '22.90', ''], ['iCloud', '3.90', '']]) {
    await p.click('text=Agregar suscripción');
    await p.fill('[aria-label="Nombre de la suscripción"]', n); await p.fill('[aria-label="Monto mensual"]', a); if (dd) await p.fill('[aria-label="Día de cobro"]', dd);
    await p.click('.sheet button[type=submit]'); await p.waitForTimeout(200);
  }
  let m = await main();
  ok(m.includes('Tus suscripciones') && m.includes('S/ 72 al mes') && m.includes('faltan S/ 72') && m.includes('se cobra el 12'), 'tres suscripciones con su monto y lo que falta');
  ok(m.includes('Tus suscripciones suman S/ 72'), 'avisa si no coincide con el presupuesto');
  await p.click('main >> button:has-text("Usar S/ 72")'); await p.waitForTimeout(200);
  ok(await p.locator('main input[value="72"]').count() > 0, 'el editor del presupuesto toma la suma de las suscripciones');
  await p.click('nav >> text=Analítica'); await p.waitForTimeout(200);
  const hoy0 = await p.evaluate(() => document.querySelector('main .tnum')?.textContent || '');
  await p.click('nav >> text=Presupuestos'); await p.click('main >> text=Suscripciones'); await p.waitForTimeout(200);
  await p.click('[aria-label="Pagar Netflix"]'); await p.waitForTimeout(300);
  m = await main();
  ok(/Netflix[\s\S]{0,60}pagada/.test(m) && m.includes('faltan S/ 27'), 'Netflix pagada desde la carpeta');
  await p.screenshot({ path: `${out}/sub1-carpeta.png` });
  // Registrar con la suscripción elegida
  await p.click('[aria-label="Registrar gasto"]');
  await p.click('.sheet [role=radio]:has-text("Suscripciones")');
  await p.click('.sheet [role=radio]:has-text("Spotify")');
  ok((await p.inputValue('[aria-label="Monto"]')) === '22.9' && (await p.inputValue('[aria-label="Lugar"]')) === 'Spotify', 'elegir la suscripción llena lugar y monto');
  await p.screenshot({ path: `${out}/sub2-registrar.png` });
  await p.click('text=Guardar gasto'); await p.waitForTimeout(300);
  await p.click('main >> text=Suscripciones').catch(() => {}); await p.waitForTimeout(200);
  m = await main();
  ok(/Spotify[\s\S]{0,60}pagada/.test(m) && m.includes('faltan S/ 4'), 'Spotify pagada al registrarla');
  await p.click('nav >> text=Analítica'); await p.waitForTimeout(200);
  const hoy1 = await p.evaluate(() => document.querySelector('main .tnum')?.textContent || '');
  ok(hoy0 === hoy1, `pagar suscripciones no baja "te queda para hoy" (${hoy0} → ${hoy1})`);

  // Analítica: ‹ mes ›, año y filtro
  m = await main();
  const cur = m.match(/^(\w+ de \d{4})/m)?.[1];
  ok(/Gastos en \w+\nS\/ 68/.test(m), 'gastos del mes: 44.90 + 22.90');
  await p.click('[aria-label="Mes anterior"]'); await p.waitForTimeout(150);
  m = await main();
  ok(m.includes('Volver a hoy') && /Gastos en \w+\nS\/ 0/.test(m) && m.includes('Te queda para hoy'), 'mes anterior: métricas de ese mes, los cuadros siguen siendo de hoy');
  await p.click('text=Volver a hoy'); await p.waitForTimeout(150);
  ok(!(await main()).includes('Volver a hoy') && (await p.isDisabled('[aria-label="Mes siguiente"]')), 'volver al mes actual; no se puede ir al futuro');
  await p.click('[aria-label="Filtrar"]');
  await p.click('.sheet >> text=Quitar todas'); await p.click('.sheet [role=checkbox]:has-text("Suscripciones")');
  await p.click('.sheet >> button:has-text("Año")'); await p.click('.sheet >> text=Aplicar'); await p.waitForTimeout(200);
  m = await main();
  ok(m.includes('Suscripciones · Quitar filtro') && /Gastos en \d{4}\nS\/ 68/.test(m) && m.includes('Promedio mensual'), 'filtro por carpeta y vista por año');
  await p.screenshot({ path: `${out}/sub3-analitica-filtro.png` });
  await p.click('text=Suscripciones · Quitar filtro'); await p.waitForTimeout(150);
  ok(!(await main()).includes('Quitar filtro'), 'quitar filtro');
  // Presupuestos con tarjetas y barra
  await p.click('nav >> text=Presupuestos'); await p.waitForTimeout(200);
  const subsCard = await p.getAttribute('main .bud-card[aria-label^="Suscripciones"]', 'aria-label');
  ok(/Suscripciones: gastaste S\/ 67\.80 de S\/ 45\. Te pasaste por S\/ 22\.80/.test(subsCard), 'tarjeta de presupuesto con gastado y exceso: ' + subsCard);
  ok(await p.locator('main .bud-card[aria-label^="Suscripciones"] .bud-tick').count() === 1, 'marca del límite cuando te pasas');
  await p.screenshot({ path: `${out}/sub4-presupuestos.png` });
  // Exportar a Excel (.csv)
  await p.click('nav >> text=Ajustes'); await p.click('[aria-label="Abrir Exportar a Excel (.csv)"]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.sheet >> button:has-text("Exportar 2 movimientos")')]);
  const csv = require('fs').readFileSync(await dl.path(), 'utf8');
  ok(/^finanzas-peru-\d{4}-\d{2}-\d{8}\.csv$/.test(dl.suggestedFilename()), 'archivo .csv: ' + dl.suggestedFilename());
  ok(csv.startsWith('\uFEFFFecha,Hora,Tipo,Descripción,Carpeta,Monto (S/),Origen,Suscripción') && /,Gasto,Spotify,Suscripciones,-22\.90,A mano,Spotify\r\n/.test(csv) && /,Gasto,Netflix,Suscripciones,-44\.90,A mano,Netflix/.test(csv), 'CSV con los movimientos del mes');
  ok(errs.length === 0, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
