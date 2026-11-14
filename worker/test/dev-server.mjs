// Servidor local para probar sin Cloudflare: API en :8787 (D1 en memoria) y la PWA en :8080.
// Ejecutar: node --experimental-sqlite worker/test/dev-server.mjs
// El correo del dueño es alexis@example.com y el código aparece en la pantalla (modo de desarrollo).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createD1 } from './d1-shim.mjs';
import worker from '../src/index.js';
import { runScheduled } from '../src/cron.js';

const WEB = fileURLToPath(new URL('../../web/', import.meta.url));
const env = {
  DB: createD1(new URL('../migrations/', import.meta.url)),
  ALLOWED_ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', TZ_OFFSET_MIN: '-360', DEV_MODE: '1',
  OWNER_EMAIL: 'alexis@example.com', OWNER_NAME: 'Alexis Gutiérrez', AUTH_PEPPER: 'dev',
};
// Fotos en memoria (en producción es R2)
const photos = new Map();
env.PHOTOS = {
  async put(key, stream, opts) { photos.set(key, { data: new Uint8Array(await new Response(stream).arrayBuffer()), httpMetadata: opts?.httpMetadata }); },
  async get(key) { const o = photos.get(key); return o ? { body: o.data, httpMetadata: o.httpMetadata } : null; },
};

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await worker.fetch(new Request('http://127.0.0.1:8787' + req.url, {
    method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  }), env, { waitUntil() {} });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(8787, () => console.log('API      http://127.0.0.1:8787'));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(WEB, path.endsWith('/') ? path + 'index.html' : path);
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('No encontrado'); }
}).listen(8080, () => console.log('PWA      http://localhost:8080'));

setInterval(() => runScheduled(env).catch(console.error), 60000);

// DEMO=1 carga 8 semanas de ventas de ejemplo para ver Finanzas con datos.
if (process.env.DEMO === '1') {
  const db = env.DB.raw;
  const pays = ['Efectivo', 'Efectivo', 'Transferencia', 'Tarjeta'];
  const now = Date.now();
  for (let d = 56; d >= 1; d--) {
    const ts = now - d * 86400000;
    const date = new Date(ts - 6 * 3600000).toISOString().slice(0, 10);
    for (const [hotel, n, rate] of [['prado', 4 + (d % 5), 650], ['prokinto', 2 + (d % 4), 800]]) {
      for (let i = 0; i < n; i++) {
        const nights = 1 + (i % 3);
        db.prepare(`INSERT INTO sales (hotel_id, local_date, ts, concept, kind, nights, amount, pay) VALUES (?,?,?,?,?,?,?,?)`)
          .run(hotel, date, ts + i * 1000, 'Hab. (ejemplo)', 'hospedaje', nights, nights * rate, pays[(d + i) % 4]);
      }
      if (hotel === 'prado' && d % 3 === 0) db.prepare(`INSERT INTO sales (hotel_id, local_date, ts, concept, kind, hours, amount, pay) VALUES (?,?,?,?,?,?,?,?)`).run(hotel, date, ts, 'Por hora (ejemplo)', 'hora', 3, 350, 'Efectivo');
    }
  }
  console.log('Datos de ejemplo cargados');
}
