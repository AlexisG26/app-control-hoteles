// Historial de reservas (solo gerencia): cada estadía con quién la registró, sus cobros y lo que pasó con ella.
import { bad, notFound, localDate, localToUtc, addDays, isDate, cleanStr } from './util.js';
import { requireOwner } from './auth.js';

const STATUS_SQL = `CASE
  WHEN s.checkout_mode = 'cancelada' THEN 'cancelada'
  WHEN s.checked_out_at IS NULL THEN 'en_curso'
  WHEN s.checkout_mode = 'historico' THEN 'reporte'
  ELSE 'salio' END`;

/** Quién pasó cada reporte en papel (por fecha), según la bitácora de cargas. */
async function paperReports(env) {
  const { results } = await env.DB.prepare("SELECT entity_id, detail FROM audit WHERE action = 'carga_reporte'").all();
  const m = new Map();
  for (const a of results) { try { const d = JSON.parse(a.detail || '{}'); m.set(`${d.hotel}|${a.entity_id}`, d.por || null); } catch { /* */ } }
  return m;
}

export async function listHistory(env, user, q) {
  requireOwner(user);
  const today = localDate(env);
  const to = isDate(q.get('to')) ? q.get('to') : today;
  const from = isDate(q.get('from')) ? q.get('from') : addDays(to, -30);
  if (from > to) throw bad('Rango de fechas no válido.');
  const hotel = q.get('hotel') && q.get('hotel') !== 'all' ? q.get('hotel') : null;
  const text = cleanStr(q.get('q'), 60);
  const status = q.get('status') || '';
  const where = ['s.check_in_at >= ?', 's.check_in_at < ?'];
  const args = [localToUtc(env, from, '00:00'), localToUtc(env, addDays(to, 1), '00:00')];
  if (hotel) { where.push('s.hotel_id = ?'); args.push(hotel); }
  if (text) { where.push('(s.guest LIKE ? OR r.number LIKE ? OR s.company LIKE ? OR u.name LIKE ?)'); args.push(...Array(4).fill(`%${text}%`)); }
  if (status) { where.push(`${STATUS_SQL} = ?`); args.push(status); }
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.hotel_id, h.name AS hotel_name, r.number AS room, s.guest, s.company, s.room_type, s.kind, s.nights, s.hours,
            s.check_in_at, s.due_out_at, s.checked_out_at, s.checkout_mode, ${STATUS_SQL} AS status,
            s.created_by, u.name AS created_by_name,
            (SELECT COALESCE(SUM(x.amount), 0) FROM sales x WHERE x.stay_id = s.id AND x.voided_at IS NULL AND x.kind <> 'abono') AS total,
            (SELECT COALESCE(SUM(x.usd_amount), 0) FROM sales x WHERE x.stay_id = s.id AND x.voided_at IS NULL AND x.kind <> 'abono') AS usd,
            (SELECT GROUP_CONCAT(DISTINCT x.pay) FROM sales x WHERE x.stay_id = s.id AND x.voided_at IS NULL AND x.kind <> 'abono') AS pays,
            (SELECT COUNT(*) FROM sales x WHERE x.stay_id = s.id AND x.kind IN ('hospedaje','hora') AND x.voided_at IS NULL) - 1 AS extensions,
            (SELECT COALESCE(SUM(x.amount - x.paid_amount), 0) FROM sales x WHERE x.stay_id = s.id AND x.pay = 'Pendiente' AND x.voided_at IS NULL AND x.settled_at IS NULL) AS pending
       FROM stays s JOIN rooms r ON r.id = s.room_id JOIN hotels h ON h.id = s.hotel_id LEFT JOIN users u ON u.id = s.created_by
      WHERE ${where.join(' AND ')} ORDER BY s.check_in_at DESC LIMIT 500`,
  ).bind(...args).all();
  const paper = await paperReports(env);
  for (const s of results) {
    if (!s.created_by) s.paper_by = paper.get(`${s.hotel_id}|${localDate(env, s.check_in_at)}`) ?? null;
    s.extensions = Math.max(0, s.extensions);
  }
  // Resumen por persona que registró
  const byUser = new Map();
  for (const s of results) {
    const k = s.created_by_name || (s.created_by ? 'Usuario eliminado' : 'Reporte en papel' + (s.paper_by ? ` (${s.paper_by})` : ''));
    const e = byUser.get(k) || { name: k, count: 0, total: 0 };
    if (s.status !== 'cancelada') { e.count++; e.total += s.total; }
    byUser.set(k, e);
  }
  return {
    from, to, items: results,
    by_user: [...byUser.values()].sort((a, b) => b.count - a.count),
    totals: {
      count: results.filter((s) => s.status !== 'cancelada').length,
      cancelled: results.filter((s) => s.status === 'cancelada').length,
      nights: results.filter((s) => s.status !== 'cancelada').reduce((a, s) => a + (s.kind === 'noche' ? s.nights : 0), 0),
      total: Math.round(results.reduce((a, s) => a + s.total, 0) * 100) / 100,
    },
  };
}

export async function historyDetail(env, user, stayId) {
  requireOwner(user);
  const s = await env.DB.prepare(
    `SELECT s.*, h.name AS hotel_name, r.number AS room, u.name AS created_by_name FROM stays s
       JOIN rooms r ON r.id = s.room_id JOIN hotels h ON h.id = s.hotel_id LEFT JOIN users u ON u.id = s.created_by WHERE s.id = ?`,
  ).bind(Number(stayId)).first();
  if (!s) throw notFound('Reserva no encontrada.');
  if (!s.created_by) s.paper_by = (await paperReports(env)).get(`${s.hotel_id}|${localDate(env, s.check_in_at)}`) ?? null;
  const { results: sales } = await env.DB.prepare(
    `SELECT x.id, x.local_date, x.ts, x.concept, x.kind, x.nights, x.hours, x.amount, x.pay, x.po, x.usd_amount, x.fx_rate, x.fx_status,
            x.paid_amount, x.settled_at, x.voided_at, x.void_reason, x.parent_id, x.proof_key,
            cu.name AS created_by_name, vu.name AS voided_by_name
       FROM sales x LEFT JOIN users cu ON cu.id = x.created_by LEFT JOIN users vu ON vu.id = x.voided_by
      WHERE x.stay_id = ? OR x.parent_id IN (SELECT id FROM sales WHERE stay_id = ?) ORDER BY x.ts, x.id`,
  ).bind(s.id, s.id).all();
  const { results: log } = await env.DB.prepare(
    `SELECT a.action, a.detail, a.ts, u.name AS user_name FROM audit a LEFT JOIN users u ON u.id = a.user_id
      WHERE (a.entity = 'stay' AND a.entity_id = ?) OR (a.entity = 'sale' AND a.entity_id IN (SELECT CAST(id AS TEXT) FROM sales WHERE stay_id = ?))
      ORDER BY a.ts`,
  ).bind(String(s.id), s.id).all();
  return { stay: s, sales, log };
}
