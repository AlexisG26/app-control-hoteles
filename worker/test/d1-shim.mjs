// Imitación mínima de Cloudflare D1 sobre node:sqlite, solo para pruebas locales.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

export function createD1(migrationsDir) {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(migrationsDir).filter((x) => x.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(f, migrationsDir), 'utf8'));
  }
  const norm = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a.map(norm)),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => {
      const r = db.prepare(sql).run(...args);
      return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } };
    },
  });
  return { prepare: (sql) => stmt(sql), raw: db };
}
