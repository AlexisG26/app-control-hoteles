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
