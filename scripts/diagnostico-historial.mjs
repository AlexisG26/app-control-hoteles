// Diagnóstico (solo lectura de una copia): carga la base exportada de producción en memoria y prueba
// /api/me y /api/history como cada usuario dueño. Imprime solo conteos y errores, nunca nombres de huéspedes.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
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
const env = { DB: { prepare: (s) => stmt(s) }, TZ_OFFSET_MIN: '-360', AUTH_PEPPER: 'diag', ALLOWED_ORIGIN: '*', OWNER_EMAIL: process.env.OWNER_EMAIL || '' };
console.log('estadías:', db.prepare('SELECT COUNT(*) n FROM stays').get().n, '· ventas:', db.prepare('SELECT COUNT(*) n FROM sales').get().n);
console.log('usuarios dueños:', db.prepare('SELECT COUNT(*) n FROM users WHERE is_owner = 1 AND deleted_at IS NULL').get().n);
for (const u of db.prepare('SELECT id, is_owner, active FROM users WHERE deleted_at IS NULL').all()) {
  const token = await createSession(env, u.id);
  const call = async (path) => {
    const res = await worker.fetch(new Request('https://api.local' + path, { headers: { authorization: 'Bearer ' + token, origin: 'https://x' } }), env, { waitUntil() {} });
    const txt = await res.text();
    let j; try { j = JSON.parse(txt); } catch { j = null; }
    return { status: res.status, j, txt: txt.slice(0, 160) };
  };
  const me = await call('/api/me');
  const h = await call('/api/history?hotel=all&from=2026-10-22&to=2026-11-21&status=&q=');
  const line = [`usuario #${u.id} dueño=${u.is_owner} activo=${u.active}`, `me=${me.status} is_owner=${me.j?.user?.is_owner}`, `historial=${h.status}`];
  if (h.status === 200) {
    line.push(`reservas=${h.j.items.length} con_quien=${h.j.items.filter((x) => x.created_by_name).length} grupos=${h.j.by_user.length}`);
    if (h.j.items[0]) { const d = await call('/api/history/' + h.j.items[0].id); line.push(`detalle=${d.status}${d.status !== 200 ? ' ' + d.txt : ''}`); }
  } else line.push(h.txt.replace(/[^\x20-\x7EáéíóúñÁÉÍÓÚÑ]/g, ''));
  console.log(line.join(' · '));
}
