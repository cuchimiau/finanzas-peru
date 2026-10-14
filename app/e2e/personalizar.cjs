// Carpetas propias, editar plan, ingresos, gasto de ayer, préstamo, optimizar y cierre de mes (tamaño iPhone).
const { chromium } = require(process.env.PW || 'playwright');
const out = process.argv[2] || '.';
const ok = (c, m) => { if (!c) throw new Error('FALLÓ: ' + m); console.log('✓ ' + m); };
(async () => {
  const { code } = await (await fetch('http://127.0.0.1:8790/__code')).json();
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const main = () => p.evaluate(() => document.querySelector('main')?.innerText || '');
  const sheet = () => p.evaluate(() => document.querySelector('.sheet')?.innerText || '');
  const shot = n => p.screenshot({ path: `${out}/${n}.png` });
  await p.goto('http://localhost:5173/?reset=1'); await p.waitForTimeout(300);
  await p.click('text=Crear mi plan'); await p.fill('input[autocomplete=given-name]', 'Leo'); await p.fill('input[inputmode=numeric]', '2600');
  await p.click('text=Siguiente'); await p.click('text=Sin tarjetas por ahora'); await p.waitForSelector('text=Crear mis carpetas'); await p.click('text=Crear mis carpetas');
  await p.fill('input[placeholder^="FP1"]', code); await p.click('button:has-text("Conectar")'); await p.waitForSelector('text=Conectado a tu Drive');
  await p.click('text=Ir a mis finanzas'); await p.waitForTimeout(400);

  // Carpeta propia
  await p.click('nav >> text=Carpetas'); await p.click('text=Nueva carpeta');
  await p.fill('.sheet input', 'Gimnasio'); await p.click('.sheet >> text=Necesidad'); await p.click('[aria-label="barbell"]');
  await shot('p1-nueva-carpeta');
  await p.click('text=Crear carpeta'); await p.waitForTimeout(300);
  ok((await main()).includes('Gimnasio'), 'carpeta propia creada y abierta');
  await p.fill('label:has-text("Presupuesto de Gimnasio") input', '120'); await p.click('text=Cubrir automáticamente'); await p.click('button:has-text("Aplicar · S/ 120")'); await p.waitForTimeout(300);
  ok((await main()).includes('S/ 120'), 'presupuesto de la carpeta propia asignado');

  // Editar plan completo
  await p.click('text=Carpetas'); await p.click('text=Editar plan'); await p.waitForTimeout(200);
  await p.fill('[aria-label="Presupuesto de Alquiler"]', '700');
  ok((await sheet()).includes('Te pasas por S/ 50'), 'editor muestra cuánto te pasas');
  const cf = Number(await p.inputValue('[aria-label="Presupuesto de Comer fuera"]'));
  await p.fill('[aria-label="Presupuesto de Comer fuera"]', String(cf - 50));
  ok((await sheet()).includes('Todo asignado'), 'editor cuadra en base cero');
  await shot('p2-editar-plan');
  await p.click('text=Guardar plan'); await p.waitForTimeout(300);

  // Ingreso extra + gasto de ayer
  await p.click('nav >> text=Inicio'); await p.click('[aria-label="Registrar gasto"]');
  await p.click('.sheet >> button[role=radio]:has-text("Ingreso")'); await p.fill('.sheet input[inputmode=decimal]', '300'); await p.fill('[aria-label="Lugar"]', 'Bono');
  await shot('p3-ingreso');
  await p.click('text=Guardar ingreso'); await p.waitForTimeout(300);
  ok((await main()).includes('extra S/ 300'), 'ingreso extra suma al mes');
  await p.click('[aria-label="Registrar gasto"]'); await p.fill('.sheet input[inputmode=decimal]', '45'); await p.fill('[aria-label="Lugar"]', 'Pardos');
  await p.click('.sheet >> button[role=radio]:has-text("Ayer")'); await p.click('text=Guardar gasto'); await p.waitForTimeout(300);
  ok(/Pardos[\s\S]*Ayer/.test(await main()), 'gasto registrado con fecha de ayer');

  // Préstamo no bancario
  await p.click('nav >> text=Deudas'); await p.click('text=Deuda o tarjeta'); await p.click('.sheet >> text=Préstamo');
  await p.fill('.sheet input[placeholder^="Préstamo de mi tío"]', 'Tío Juan');
  await p.fill('label:has-text("Cuánto debes hoy") input', '500'); await p.fill('label:has-text("Cuota mensual") input', '100'); await p.fill('label:has-text("Día de pago") input', '1');
  await shot('p4-prestamo');
  await p.click('.sheet >> text=Guardar'); await p.waitForTimeout(300);
  ok((await main()).includes('Préstamo sin intereses'), 'préstamo familiar en Deudas');

  // Optimizar
  await p.click('nav >> text=Inicio'); await p.click('text=Optimiza tu mes'); await p.waitForTimeout(300);
  await shot('p5-optimizar-resto');
  const t1 = await sheet();
  ok(/plan de ahorro para fin de mes/i.test(t1), 'optimizar: resto del mes');
  if (t1.includes('Aplicar · ahorrar')) { await p.click('text=Aplicar · ahorrar'); await p.waitForTimeout(300); ok(true, 'propuesta de ahorro aplicada'); }
  await p.click('text=Optimiza tu mes'); await p.click('.sheet >> text=Próximo mes'); await p.waitForTimeout(200);
  await shot('p6-optimizar-proximo');
  await p.click('text=Usar como mi plan base'); await p.waitForTimeout(300);

  // Cierre de mes simulado
  await p.evaluate(() => { const k = 'finanzas-peru:v2'; const d = JSON.parse(localStorage.getItem(k)); d.monthKey = '2026-09'; localStorage.setItem(k, JSON.stringify(d)); localStorage.removeItem('finanzas-peru:conexion'); });
  await p.reload(); await p.waitForSelector('text=Cierre de mes', { timeout: 5000 }); await p.waitForTimeout(300);
  await shot('p7-cierre');
  await p.click('text=Empezar el mes con este plan'); await p.waitForTimeout(300);
  ok(!(await p.isVisible('text=Cierre de mes')), 'mes nuevo iniciado');

  // Borrar carpeta propia
  await p.click('nav >> text=Carpetas'); await p.click('text=Gimnasio'); await p.click('[aria-label="Editar carpeta"]'); await p.click('.sheet >> text=Borrar'); await p.waitForTimeout(300);
  ok(!(await main()).includes('Gimnasio'), 'carpeta propia borrada (su dinero a Libre)');
  ok((await main()).includes('S/ 2,600 asignados'), 'mes nuevo cuadra con el sueldo (el bono era del mes anterior)');
  ok(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
