// Ajustes › Registrar gastos con Siri: copiar el prompt para Apple Intelligence (tamaño iPhone).
const { chromium } = require(process.env.PW || 'playwright');
const out = process.argv[2] || '.';
const ok = (c, m) => { if (!c) throw new Error('FALLÓ: ' + m); console.log('✓ ' + m); };
(async () => {
  const { code } = await (await fetch('http://127.0.0.1:8790/__code')).json();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:5173/?reset=1'); await p.waitForTimeout(300);
  await p.click('text=Crear mi plan'); await p.fill('input[autocomplete=given-name]', 'Leo'); await p.fill('input[inputmode=numeric]', '2600');
  await p.click('text=Siguiente'); await p.click('text=Sin tarjetas por ahora'); await p.waitForSelector('text=Crear mis carpetas'); await p.click('text=Crear mis carpetas');
  await p.fill('input[placeholder^="FP1"]', code); await p.click('button:has-text("Conectar")'); await p.waitForSelector('text=Conectado a tu Drive');
  await p.click('text=Ir a mis finanzas'); await p.waitForTimeout(400);

  await p.click('[aria-label="Ajustes"]'); await p.waitForTimeout(300);
  const row = p.locator('div', { hasText: /^Prompt para Siri/ }).last().locator('xpath=../..');
  await row.locator('button:has-text("Copiar")').click(); await p.waitForTimeout(200);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  ok(clip.startsWith('Crea un atajo llamado "Gasto"'), 'el prompt se copia');
  ok(/\/exec\?s=[^&\s]+&a=voz&t= y justo al final/.test(clip), 'el prompt trae la URL con secreto y &a=voz&t=');
  ok(!(await p.locator('text=Busca "Codificar URL"').isVisible()), 'pasos a mano ocultos por defecto');
  await p.click('text=Prefiero armarlo a mano');
  ok(await p.locator('text=Busca "Codificar URL"').isVisible(), 'pasos a mano al desplegar');
  await p.locator('text=Opción rápida').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${out}/siri-prompt.png` });
  await p.click("button:has-text(\"Probar la URL\")"); await p.waitForTimeout(3000); const st = await p.evaluate(() => [...document.querySelectorAll("[role=status],[role=alert]")].map(e => e.textContent).join(" / ")); console.log("estado:", st); ok(/La URL funciona/.test(st), "Probar la URL responde");
  ok(errs.length === 0, 'sin errores en la página ' + errs.join(' | '));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
