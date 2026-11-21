// Diagnóstico: sirve la PWA (:8080) y la API (:8787) con una copia en memoria de la base exportada.
// Escribe en /tmp/diag-token un token de sesión del usuario #1 (dueño). Solo para pruebas en GitHub Actions.
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../worker/src/index.js';
import { createSession } from '../worker/src/auth.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(process.argv[2], 'utf8'));
const norm = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a.map(norm)),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { const r = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; },
});
const env = { DB: { prepare: (s) => stmt(s) }, TZ_OFFSET_MIN: '-360', AUTH_PEPPER: 'diag', ALLOWED_ORIGIN: 'http://localhost:8080', RP_ID: 'localhost' };
writeFileSync('/tmp/diag-token', await createSession(env, 1));
writeFileSync(fileURLToPath(new URL('../web/config.js', import.meta.url)), "self.APP_CONFIG = { API_URL: 'http://127.0.0.1:8787', VERSION: 'diag' };\n");

http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = await worker.fetch(new Request('http://127.0.0.1:8787' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env, { waitUntil() {} });
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(8787);
const WEB = fileURLToPath(new URL('../web/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(WEB, path.endsWith('/') ? path + 'index.html' : path);
  try { const data = await readFile(file); res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404); res.end(); }
}).listen(8080, () => console.log('listo'));
