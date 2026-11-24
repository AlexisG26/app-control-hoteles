// Base de datos de clientes: un registro por persona, enlazado a todas sus estadías en ambos hoteles.
// Gerencia ve y edita todo; recepción solo busca clientes conocidos al registrar una entrada.
import { bad, notFound, cleanStr, localDate } from './util.js';
import { requireOwner, requireRole } from './auth.js';
import { audit } from './ops.js';

export const nameKey = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
// Nombres de relleno que no son una persona
const GENERIC = /^(huesped|ocupada|cliente|clienta)( hab\.? ?\w+)?$|\(estadia\)/;
export const isGenericName = (name) => !nameKey(name) || GENERIC.test(nameKey(name)) || /^hu[eé]sped hab\.|^clienta? hab\./i.test(String(name));

const cleanPhone = (v) => { const s = cleanStr(v, 30); return s ? s.replace(/[^\d+ -]/g, '').trim() || null : null; };

/** Encuentra al cliente por id o por nombre; si no existe, lo crea. Completa teléfono/documento/empresa si faltaban. */
export async function resolveGuest(env, { guest_id, name, phone, document, company }) {
  const now = Date.now();
  phone = cleanPhone(phone); document = cleanStr(document, 40) || null; company = cleanStr(company, 80) || null;
  let g = null;
  if (guest_id) g = await env.DB.prepare('SELECT * FROM guests WHERE id = ?').bind(Number(guest_id)).first();
  if (!g) {
    if (isGenericName(name)) return null;
    g = await env.DB.prepare('SELECT * FROM guests WHERE name_key = ? ORDER BY updated_at DESC LIMIT 1').bind(nameKey(name)).first();
    if (!g) { const mi = await matchInitials(env, name); if (mi) g = await env.DB.prepare('SELECT * FROM guests WHERE id = ?').bind(mi).first(); }
  }
  if (!g) {
    const r = await env.DB.prepare('INSERT INTO guests (name, name_key, phone, document, company, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .bind(cleanStr(name, 120), nameKey(name), phone, document, company, now, now).run();
    return r.meta.last_row_id;
  }
  await env.DB.prepare('UPDATE guests SET phone = COALESCE(phone, ?), document = COALESCE(document, ?), company = COALESCE(company, ?), updated_at = ? WHERE id = ?')
    .bind(phone, document, company, now, g.id).run();
  return g.id;
}

/** "Orlin R." → el cliente "Orlin Regalado", si hay exactamente uno que coincida. */
async function matchInitials(env, name) {
  const k = nameKey(name);
  const m = k.match(/^([a-zñ]+(?: [a-zñ]+)*) ([a-zñ])$/);
  if (!m || !/\.\s*$/.test(String(name).replace(/\s*\(.*\)\s*$/, ''))) return null;
  const { results } = await env.DB.prepare("SELECT id, name_key FROM guests WHERE name_key LIKE ? AND name_key <> ? LIMIT 3").bind(`${m[1]} ${m[2]}%`, k).all();
  const full = results.filter((r) => r.name_key.length > k.length + 1);
  return full.length === 1 ? full[0].id : null;
}

/** Enlaza las estadías que aún no tienen cliente (las antiguas y las cargadas de reportes en papel). */
export async function linkOrphanStays(env) {
  const { results } = await env.DB.prepare('SELECT id, guest, company, check_in_at FROM stays WHERE guest_id IS NULL ORDER BY check_in_at LIMIT 2000').all();
  const cache = new Map();
  let n = 0;
  for (const s of results) {
    if (isGenericName(s.guest)) continue;
    const k = nameKey(s.guest);
    let id = cache.get(k);
    if (!id) {
      const g = await env.DB.prepare('SELECT id FROM guests WHERE name_key = ? ORDER BY updated_at DESC LIMIT 1').bind(k).first();
      id = g?.id || (await matchInitials(env, s.guest));
      if (!id) {
        const r = await env.DB.prepare('INSERT INTO guests (name, name_key, company, created_at, updated_at) VALUES (?,?,?,?,?)')
          .bind(s.guest, k, s.company || null, s.check_in_at, s.check_in_at).run();
        id = r.meta.last_row_id;
      }
      cache.set(k, id);
    }
    await env.DB.prepare('UPDATE stays SET guest_id = ? WHERE id = ?').bind(id, s.id).run();
    n++;
  }
  return n;
}

const STATS = `
  COUNT(CASE WHEN s.checkout_mode IS NOT 'cancelada' THEN 1 END) AS visits,
  COALESCE(SUM(CASE WHEN s.checkout_mode IS NOT 'cancelada' AND s.kind = 'noche' THEN s.nights END), 0) AS nights,
  MAX(s.check_in_at) AS last_visit, MIN(s.check_in_at) AS first_visit,
  GROUP_CONCAT(DISTINCT s.hotel_id) AS hotels,
  (SELECT COALESCE(SUM(x.amount), 0) FROM sales x JOIN stays y ON y.id = x.stay_id WHERE y.guest_id = g.id AND x.voided_at IS NULL AND x.kind <> 'abono') AS spent,
  (SELECT COALESCE(SUM(x.amount - x.paid_amount), 0) FROM sales x JOIN stays y ON y.id = x.stay_id WHERE y.guest_id = g.id AND x.pay = 'Pendiente' AND x.voided_at IS NULL AND x.settled_at IS NULL) AS pending,
  MAX(CASE WHEN s.checked_out_at IS NULL THEN 1 ELSE 0 END) AS staying`;

export async function listGuests(env, user, q) {
  requireOwner(user);
  await linkOrphanStays(env);
  const text = cleanStr(q.get('q'), 60);
  const hotel = q.get('hotel') && q.get('hotel') !== 'all' ? q.get('hotel') : null;
  const sort = { visits: 'visits DESC, last_visit DESC', spent: 'spent DESC', name: 'g.name COLLATE NOCASE' }[q.get('sort')] || 'last_visit DESC';
  const where = []; const args = [];
  if (text) { where.push('(g.name_key LIKE ? OR g.phone LIKE ? OR g.document LIKE ? OR g.company LIKE ? OR g.email LIKE ?)'); args.push(`%${nameKey(text)}%`, ...Array(4).fill(`%${text}%`)); }
  const { results } = await env.DB.prepare(
    `SELECT g.id, g.name, g.phone, g.email, g.document, g.company, g.notes, ${STATS}
       FROM guests g LEFT JOIN stays s ON s.guest_id = g.id ${hotel ? 'AND s.hotel_id = ?' : ''}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      GROUP BY g.id ${hotel ? 'HAVING COUNT(s.id) > 0' : ''} ORDER BY ${sort} LIMIT 1000`,
  ).bind(...(hotel ? [hotel] : []), ...args).all();
  const all = await env.DB.prepare(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN v >= 2 THEN 1 ELSE 0 END) AS repeat, SUM(CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END) AS with_phone
       FROM (SELECT g.id, g.phone, COUNT(s.id) v FROM guests g LEFT JOIN stays s ON s.guest_id = g.id AND s.checkout_mode IS NOT 'cancelada' ${hotel ? 'AND s.hotel_id = ?' : ''} GROUP BY g.id ${hotel ? 'HAVING COUNT(s.id) > 0' : ''})`,
  ).bind(...(hotel ? [hotel] : [])).first();
  return { items: results, totals: all };
}

export async function guestDetail(env, user, id) {
  requireOwner(user);
  const g = await env.DB.prepare('SELECT * FROM guests WHERE id = ?').bind(Number(id)).first();
  if (!g) throw notFound('Cliente no encontrado.');
  const { results: stays } = await env.DB.prepare(
    `SELECT s.id, s.hotel_id, h.name AS hotel_name, r.number AS room, s.guest, s.company, s.room_type, s.kind, s.nights, s.hours,
            s.check_in_at, s.due_out_at, s.checked_out_at, s.checkout_mode, u.name AS created_by_name,
            (SELECT COALESCE(SUM(x.amount), 0) FROM sales x WHERE x.stay_id = s.id AND x.voided_at IS NULL AND x.kind <> 'abono') AS total,
            (SELECT GROUP_CONCAT(DISTINCT x.pay) FROM sales x WHERE x.stay_id = s.id AND x.voided_at IS NULL AND x.kind <> 'abono') AS pays
       FROM stays s JOIN rooms r ON r.id = s.room_id JOIN hotels h ON h.id = s.hotel_id LEFT JOIN users u ON u.id = s.created_by
      WHERE s.guest_id = ? ORDER BY s.check_in_at DESC`,
  ).bind(g.id).all();
  return { guest: g, stays };
}

export async function updateGuest(env, user, id, b) {
  requireOwner(user);
  const g = await env.DB.prepare('SELECT * FROM guests WHERE id = ?').bind(Number(id)).first();
  if (!g) throw notFound('Cliente no encontrado.');
  const name = b.name !== undefined ? cleanStr(b.name, 120) : g.name;
  if (!name) throw bad('Escribe el nombre del cliente.');
  const v = (k, max) => (b[k] !== undefined ? cleanStr(b[k], max) || null : g[k]);
  const email = v('email', 120);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Ese correo no parece válido.');
  await env.DB.prepare('UPDATE guests SET name = ?, name_key = ?, phone = ?, email = ?, document = ?, company = ?, notes = ?, updated_at = ? WHERE id = ?')
    .bind(name, nameKey(name), b.phone !== undefined ? cleanPhone(b.phone) : g.phone, email, v('document', 40), v('company', 80), v('notes', 500), Date.now(), g.id).run();
  // Si cambia el nombre (p. ej. de iniciales al nombre completo), se actualiza en sus estadías
  if (name !== g.name) await env.DB.prepare('UPDATE stays SET guest = ? WHERE guest_id = ?').bind(name, g.id).run();
  await audit(env, user, 'cliente_editado', 'guest', g.id, { antes: g.name, ahora: name });
  return { ok: true };
}

/** Unir dos registros del mismo cliente: las estadías de `id` pasan a `into` y se completan los datos que falten. */
export async function mergeGuest(env, user, id, b) {
  requireOwner(user);
  const a = await env.DB.prepare('SELECT * FROM guests WHERE id = ?').bind(Number(id)).first();
  const t = await env.DB.prepare('SELECT * FROM guests WHERE id = ?').bind(Number(b.into)).first();
  if (!a || !t) throw notFound('Cliente no encontrado.');
  if (a.id === t.id) throw bad('Elige otro cliente.');
  await env.DB.prepare('UPDATE stays SET guest_id = ?, guest = ? WHERE guest_id = ?').bind(t.id, t.name, a.id).run();
  await env.DB.prepare(`UPDATE guests SET phone = COALESCE(phone, ?), email = COALESCE(email, ?), document = COALESCE(document, ?), company = COALESCE(company, ?),
      notes = CASE WHEN ? IS NULL THEN notes WHEN notes IS NULL THEN ? ELSE notes || ' · ' || ? END, updated_at = ? WHERE id = ?`)
    .bind(a.phone, a.email, a.document, a.company, a.notes, a.notes, a.notes, Date.now(), t.id).run();
  await env.DB.prepare('DELETE FROM guests WHERE id = ?').bind(a.id).run();
  await audit(env, user, 'clientes_unidos', 'guest', t.id, { de: a.name, a: t.name });
  return { ok: true, id: t.id };
}

/** Recepción: buscar un cliente conocido al registrar la entrada (sin montos). */
export async function searchGuests(env, user, hotelId, q) {
  requireRole(user, hotelId, 'recepcion');
  const text = cleanStr(q.get('q'), 60);
  if (!text || text.length < 2) return [];
  const { results } = await env.DB.prepare(
    `SELECT g.id, g.name, g.phone, g.document, g.company,
            COUNT(CASE WHEN s.checkout_mode IS NOT 'cancelada' THEN 1 END) AS visits, MAX(s.check_in_at) AS last_visit
       FROM guests g LEFT JOIN stays s ON s.guest_id = g.id
      WHERE g.name_key LIKE ? OR g.phone LIKE ? OR g.document LIKE ?
      GROUP BY g.id ORDER BY last_visit DESC LIMIT 6`,
  ).bind(`%${nameKey(text)}%`, `%${text}%`, `%${text}%`).all();
  for (const r of results) r.last_date = r.last_visit ? localDate(env, r.last_visit) : null;
  return results;
}
