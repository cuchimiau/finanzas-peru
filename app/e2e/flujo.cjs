// Prueba de punta a punta en tamaño iPhone contra el Apps Script local (e2e/fake-gas-server.ts).
// Uso: node e2e/fake-gas-server.ts & npx vite --port 5173 & node e2e/flujo.cjs <carpeta-capturas>
const { chromium } = require(process.env.PW || 'playwright');
const APP = process.env.APP || 'http://localhost:5173/';
const GAS = 'http://127.0.0.1:8790';
const out = process.argv[2] || '.';
const assert = (c, m) => { if (!c) throw new Error('FALLÓ: ' + m); console.log('✓ ' + m); };
const gasState = () => fetch(GAS + '/__state').then(r => r.json());
const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise(r => setTimeout(r, 200)); } return false; };

(async () => {
  const { code } = await (await fetch(GAS + '/__code')).json();
  const b = await chromium.launch();
  const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const ctx = await b.newContext(iphone);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  const shot = n => p.screenshot({ path: `${out}/${n}.png` });

  // 1. Creación del plan con datos reales
  await p.goto(APP + '?reset=1'); await p.waitForTimeout(500);
  await shot('e01-bienvenida');
  await p.click('text=Crear mi plan');
  await p.fill('input[autocomplete=given-name]', 'Leo');
  await p.fill('input[inputmode=numeric]', '3000');
  await p.click('text=Viajar');
  await shot('e02-perfil');
  await p.click('text=Siguiente');
  await p.click('text=Agregar tarjeta');
  await p.fill('input[placeholder^="BBVA Visa"]', 'BBVA Visa');
  const fill = async (label, v) => p.fill(`label:has-text("${label}") input`, v);
  await fill('Deuda actual', '3260'); await fill('Línea de crédito', '8000'); await fill('TCEA', '58'); await fill('Pago mínimo', '165'); await fill('Día de pago', '8');
  await shot('e03-tarjeta');
  await p.click('.sheet >> text=Guardar');
  await p.click('text=Agregar tarjeta');
  await p.fill('input[placeholder^="BBVA Visa"]', 'Interbank Débito');
  await p.click('.sheet >> text=Débito');
  await p.click('.sheet >> text=Guardar');
  await shot('e04-tarjetas');
  await p.click('text=Calcular plan óptimo');
  await p.waitForSelector('text=Crear mis carpetas', { timeout: 5000 }); await p.waitForTimeout(300);
  await shot('e05-plan');
  const plan = await p.textContent('main, body');
  assert(plan.includes('S/ 3,000 repartidos'), 'plan con el sueldo real');
  await p.click('text=Crear mis carpetas');
  await p.fill('input[placeholder^="FP1"]', code);
  await p.click('button:has-text("Conectar")');
  await p.waitForSelector('text=Conectado a tu Drive', { timeout: 8000 });
  await shot('e06-conectado');
  await p.click('text=Ir a mis finanzas'); await p.waitForTimeout(600);
  await shot('e07-inicio');
  assert(await p.isVisible('text=Hola, Leo'), 'inicio con el nombre real');
  assert(await until(async () => (await gasState()).data?.state?.phase === 'app'), 'plan guardado en Drive (datos.json)');

  // 2. Registrar gasto → se guarda en Drive y en la hoja
  await p.click('[aria-label="Registrar gasto"]');
  await p.fill('input[inputmode=decimal]', '45.50');
  await p.fill('[aria-label="Lugar"]', 'Pardos Chicken');
  await p.click('.sheet >> button[role=radio]:has-text("BBVA Visa")');
  await shot('e08-registrar');
  await p.click('.sheet >> text=Guardar');
  assert(await until(async () => (await gasState()).data?.state?.txs?.length === 1), 'gasto guardado en Drive');
  const st1 = await gasState();
  assert(st1.sheets[0]?.values?.[1]?.[1] === 'Pardos Chicken' && st1.sheets[0].values[1][3] === 'Comer fuera', 'hoja Movimientos con el gasto y su carpeta');

  // 3. El Atajo de Apple Pay manda un pago → llega al abrir la app
  const secret = (await (await fetch(GAS + '/__code')).json()).secret;
  const add = await (await fetch(GAS + '/macros/s/LOCAL/exec', { method: 'POST', body: JSON.stringify({ secret, action: 'addTx', amount: 'S/ 16,90', merchant: 'Starbucks Miraflores', card: 'BBVA Visa' }) })).json();
  assert(add.ok, 'el Atajo deja el pago en la bandeja');
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForSelector('text=Starbucks Miraflores', { timeout: 8000 }); await p.waitForTimeout(200);
  await shot('e09-applepay');
  assert(await until(async () => { const s = await gasState(); return s.inbox.length === 0 && s.data.state.txs.length === 2; }), 'pago de Apple Pay guardado y bandeja vaciada');

  // 4. Sin señal: queda pendiente y se guarda al reconectar
  await ctx.setOffline(true);
  await p.click('[aria-label="Registrar gasto"]');
  await p.fill('input[inputmode=decimal]', '12');
  await p.fill('[aria-label="Lugar"]', 'Tambo');
  await p.click('.sheet >> text=Guardar');
  assert(await until(() => p.isVisible('text=Sin señal: se guardará al reconectar'), 6000), 'sin señal: aviso de pendiente');
  await shot('e10-sin-senal');
  await ctx.setOffline(false);
  await p.evaluate(() => window.dispatchEvent(new Event('online')));
  assert(await until(async () => (await gasState()).data.state.txs.length === 3), 'al reconectar se guarda en Drive');

  // 5. Asesor (Gemini simulado): propuesta → aplicar
  await p.click('nav >> text=Asesor');
  await p.click('text=Optimiza mi plan este mes');
  await p.waitForSelector('text=Propuesta de ajuste', { timeout: 8000 }); await p.waitForTimeout(300);
  await p.click('text=Aplicar a mis carpetas');
  await shot('e11-asesor');
  assert(await until(async () => { const b2 = (await gasState()).data.state.budgets; return b2.restaurantes === 205 || b2.restaurantes > 180; }), 'ajuste del asesor aplicado y guardado');

  // 6. Pantallas
  await p.click('nav >> text=Deudas'); await p.waitForTimeout(300); await shot('e12-deudas');
  assert(await p.isVisible('text=S/ 3,322'), 'deuda = saldo + cargos posteriores (3,260 + 45.50 + 16.90)');
  await p.click('nav >> text=Métricas'); await p.waitForTimeout(300); await shot('e13-metricas');
  await p.click('nav >> text=Inicio'); await p.click('[aria-label="Ajustes"]'); await p.waitForTimeout(300); await shot('e14-ajustes');

  // 7. Otro teléfono (o reinstalar): conectar recupera todo desde Drive
  const ctx2 = await b.newContext(iphone);
  const p2 = await ctx2.newPage();
  await p2.goto(APP); await p2.waitForTimeout(400);
  await p2.click('text=Crear mi plan');
  await p2.fill('input[autocomplete=given-name]', 'X'); await p2.fill('input[inputmode=numeric]', '1000');
  await p2.click('text=Siguiente'); await p2.click('text=Sin tarjetas por ahora');
  await p2.waitForSelector('text=Crear mis carpetas'); await p2.click('text=Crear mis carpetas');
  await p2.fill('input[placeholder^="FP1"]', code);
  await p2.click('button:has-text("Conectar")');
  assert(await until(() => p2.isVisible('text=Hola, Leo')), 'nuevo teléfono: datos recuperados de Drive');
  await p2.screenshot({ path: `${out}/e15-recuperado.png` });

  assert(errs.length === 0, 'sin errores de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
