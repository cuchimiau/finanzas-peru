// Yape con la fecha de la constancia (nuevos y ya registrados), y fecha editable a mano (tamaño iPhone).
const { chromium } = require(process.env.PW || 'playwright');
const out = process.argv[2] || '.';
const ok = (c, m) => { if (!c) throw new Error('FALLÓ: ' + m); console.log('✓ ' + m); };
const BCP = '›BCP»\nYapear a celular\nMonto enviado\nS/ 5.00\nViernes, 06 de noviembre de 2026 – 03:01 p.m.\nEnviado a\nRAMIREZ HAUJAPUMA LAZARO';
(async () => {
  const { code } = await (await fetch('http://127.0.0.1:8790/__code')).json();
  const { u: url, s: secret } = JSON.parse(Buffer.from(code.slice(4), 'base64').toString());
  const post = body => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret, ...body }) }).then(r => r.json());
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const main = () => p.evaluate(() => document.querySelector('main')?.innerText || '');
  await p.goto('http://localhost:5173/?reset=1'); await p.waitForTimeout(300);
  await p.click('text=Crear mi plan'); await p.fill('input[autocomplete=given-name]', 'Leo'); await p.fill('input[inputmode=numeric]', '2600');
  await p.click('text=Siguiente'); await p.click('text=Sin tarjetas por ahora'); await p.waitForSelector('text=Crear mis carpetas'); await p.click('text=Crear mis carpetas');
  await p.fill('input[placeholder^="FP1"]', code); await p.click('button:has-text("Conectar")'); await p.waitForSelector('text=Conectado a tu Drive');
  await p.click('text=Ir a mis finanzas'); await p.waitForTimeout(400);

  // 1. Yape nuevo: fecha de la constancia (vie 6), no la de hoy
  await post({ action: 'addTx', kind: 'yape', folder: 'Libre', text: BCP });
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(1500);
  let m = await main();
  ok(/Ramirez Haujapuma Lazaro\nYape · (Vie 6|6 nov)\n−S\/ 5/.test(m), 'Yape nuevo con la fecha y hora de la constancia: ' + m.slice(-600));

  // 2. Yape ya registrado con fecha equivocada (versión anterior): se corrige al abrir y se guarda en Drive
  await p.evaluate(text => {
    const k = 'finanzas-peru:v2', d = JSON.parse(localStorage.getItem(k));
    d.txs.unshift({ id: 'yp-viejo', name: 'Madeleyne Cas', amt: 2.5, f: 'libre', pay: 'yape', date: new Date().toISOString(), why: 'Constancia de Yape.', source: 'yape', ocr: text });
    localStorage.setItem(k, JSON.stringify(d));
    localStorage.setItem(k + ':sync', JSON.stringify({ ...JSON.parse(localStorage.getItem(k + ':sync') || '{}'), dirty: true }));
  }, '¡Yapeaste!\nS/ 2.50\nMadeleyne Cas*\n02 nov. 2026 | 8:19 a.m.\nNro. de operación\n05858288');
  await p.reload(); await p.waitForTimeout(2500);
  m = await main();
  ok(/Madeleyne Cas\nYape · (Lun 2|2 nov)\n/.test(m), 'Yape ya registrado corregido con la fecha de su constancia');
  await p.waitForTimeout(2500);
  const st = await (await fetch('http://127.0.0.1:8790/__state')).json();
  const saved = st.data.state.txs.find(t => t.id === 'yp-viejo');
  ok(saved && new Date(saved.date).getDate() === 2 && new Date(saved.date).getHours() === 8 && new Date(saved.date).getMinutes() === 19 && saved.amt === 2.5 && saved.name === 'Madeleyne Cas' && saved.f === 'libre', 'la corrección se guardó en Drive sin cambiar monto, nombre ni carpeta');

  // 3. Fecha editable a mano
  await p.click('main >> text=Ramirez Haujapuma Lazaro');
  await p.fill('[aria-label="Fecha del movimiento"]', '2026-11-05'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/f1-fecha.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(/Ramirez Haujapuma Lazaro\nYape · (Jue 5|5 nov)\n/.test(await main()), 'la fecha se puede corregir a mano');
  ok(errs.length === 0, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
