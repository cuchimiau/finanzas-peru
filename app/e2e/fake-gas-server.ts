// Apps Script local para pruebas: corre el Code.gs real (con Drive y Gemini simulados) detrás de HTTP.
import http from 'node:http';
import { loadGas, type FakeResponse } from '../apps-script/gas-mock.ts';

const PORT = Number(process.env.PORT || 8790);
const URL = `http://127.0.0.1:${PORT}/macros/s/LOCAL/exec`;

/** Gemini simulado: a "optimiza" responde con una propuesta; al resultado de la función, con texto. */
function fakeGemini(_url: string, body: { contents: { role: string; parts: { text?: string; functionResponse?: unknown }[] }[] }): FakeResponse {
  const last = body.contents[body.contents.length - 1];
  if (last.parts[0].functionResponse) return { code: 200, body: { candidates: [{ content: { role: 'model', parts: [{ text: 'Muevo S/ 20 de Libre a Comer fuera. Tu ahorro y tus tarjetas no cambian.' }] } }] } };
  const q = (last.parts[0].text || '').toLowerCase();
  if (q.includes('optimiza')) {
    return { code: 200, body: { candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'proponer_ajuste', args: { resumen: 'Más margen para Comer fuera sin tocar tu ahorro', movimientos: [{ de: 'libre', a: 'restaurantes', monto: 20 }] } } }] } }] } };
  }
  return { code: 200, body: { candidates: [{ content: { role: 'model', parts: [{ text: 'Vas bien este mes.' }] } }] } };
}

const g = loadGas({ folderIds: ['FOLDER'], webAppUrl: URL, onFetch: fakeGemini });
g.props.set('GEMINI_API_KEY', 'test');
g.gas.configurar();
const code = g.logs.find(l => l.includes('FP1.'))!.split('\n')[1];

http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (req.url === '/__code') { res.writeHead(200, cors); res.end(JSON.stringify({ code, secret: g.props.get('APP_SECRET'), url: URL })); return; }
  if (req.url === '/__state') { res.writeHead(200, cors); res.end(JSON.stringify({ data: JSON.parse(g.fileText('datos.json') || 'null'), inbox: JSON.parse(g.fileText('bandeja.json') || '[]'), sheets: Array.from(g.sheets.values()) })); return; }
  if (req.method === 'GET' && req.url?.includes('/exec?')) {
    const q = Object.fromEntries(new globalThis.URL(req.url, 'http://x').searchParams);
    res.writeHead(200, cors); res.end((g.gas.doGet({ parameter: q }) as { text: string }).text); return;
  }
  let raw = '';
  req.on('data', c => (raw += c));
  req.on('end', () => {
    res.writeHead(200, cors);
    try { res.end(JSON.stringify(g.post(JSON.parse(raw || '{}')))); } catch (e) { res.end(JSON.stringify({ ok: false, error: String(e) })); }
  });
}).listen(PORT, () => console.log(`[gas] ${URL}`));
