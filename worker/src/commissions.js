// Comisiones por reserva (solo gerencia): quien registra la reserva gana la comisión de su regla.
import { bad, notFound, money, localDate, localToUtc } from './util.js';
import { requireOwner, requireRole, can } from './auth.js';

/** Al registrar una estadía: si quien la registra tiene comisión en ese hotel, queda guardada en la estadía. */
export async function applyCommission(env, stayId, hotelId, userId) {
  const r = await env.DB.prepare('SELECT amount FROM commission_rules WHERE hotel_id = ? AND user_id = ?').bind(hotelId, userId).first();
  if (!r || !(r.amount > 0)) return;
  await env.DB.prepare('UPDATE stays SET commission_user_id = ?, commission_amount = ? WHERE id = ? AND commission_user_id IS NULL').bind(userId, r.amount, stayId).run();
}

const monthOk = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m || '');
const nextMonth = (m) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; };

// Gerencia ve todos los hoteles; contabilidad solo el hotel que lleva. Recepción nunca.
function scopeHotels(user, hotelParam) {
  if (user.is_owner) return hotelParam || null;
  if (!hotelParam) throw bad('Elige el hotel.');
  requireRole(user, hotelParam, 'contabilidad');
  return hotelParam;
}

export async function commissionReport(env, user, q) {
  const onlyHotel = scopeHotels(user, q.get('hotel'));
  const month = monthOk(q.get('month')) ? q.get('month') : localDate(env).slice(0, 7);
  const from = localToUtc(env, month + '-01', '00:00');
  const to = localToUtc(env, nextMonth(month) + '-01', '00:00');
  const { results: rules } = await env.DB.prepare(
    `SELECT c.hotel_id, h.name AS hotel_name, c.user_id, u.name, c.amount FROM commission_rules c
       JOIN users u ON u.id = c.user_id JOIN hotels h ON h.id = c.hotel_id WHERE u.deleted_at IS NULL ${onlyHotel ? 'AND c.hotel_id = ?' : ''} ORDER BY h.name, u.name`,
  ).bind(...(onlyHotel ? [onlyHotel] : [])).all();
  const { results: items } = await env.DB.prepare(
    `SELECT s.id AS stay_id, s.hotel_id, h.name AS hotel_name, s.commission_user_id AS user_id, u.name, s.commission_amount AS amount,
            r.number AS room, s.guest, s.check_in_at, s.nights, s.kind, s.checked_out_at,
            (SELECT COALESCE(SUM(x.amount), 0) FROM sales x WHERE x.stay_id = s.id AND x.voided_at IS NULL AND x.kind <> 'abono') AS sale_total
       FROM stays s JOIN rooms r ON r.id = s.room_id JOIN hotels h ON h.id = s.hotel_id LEFT JOIN users u ON u.id = s.commission_user_id
      WHERE s.commission_user_id IS NOT NULL AND s.commission_amount > 0 AND s.checkout_mode IS NOT 'cancelada'
        AND s.check_in_at >= ? AND s.check_in_at < ? ${onlyHotel ? 'AND s.hotel_id = ?' : ''} ORDER BY s.check_in_at`,
  ).bind(from, to, ...(onlyHotel ? [onlyHotel] : [])).all();
  const { results: payouts } = await env.DB.prepare('SELECT * FROM commission_payouts WHERE month = ?').bind(month).all();
  const people = new Map();
  const key = (h, u) => `${h}|${u}`;
  for (const r of rules) people.set(key(r.hotel_id, r.user_id), { hotel_id: r.hotel_id, hotel_name: r.hotel_name, user_id: r.user_id, name: r.name, rate: r.amount, count: 0, total: 0, sales: 0, items: [] });
  for (const it of items) {
    const k = key(it.hotel_id, it.user_id);
    if (!people.has(k)) people.set(k, { hotel_id: it.hotel_id, hotel_name: it.hotel_name, user_id: it.user_id, name: it.name || 'Usuario eliminado', rate: null, count: 0, total: 0, sales: 0, items: [] });
    const p = people.get(k);
    p.count++; p.total += it.amount; p.sales += it.sale_total;
    p.items.push({ stay_id: it.stay_id, date: localDate(env, it.check_in_at), room: it.room, guest: it.guest, nights: it.nights, kind: it.kind, amount: it.amount, sale_total: it.sale_total, open: !it.checked_out_at });
  }
  for (const p of people.values()) {
    const po = payouts.find((x) => x.hotel_id === p.hotel_id && x.user_id === p.user_id);
    p.paid = po ? { amount: po.amount, paid_at: po.paid_at } : null;
    p.total = Math.round(p.total * 100) / 100;
  }
  const list = [...people.values()].sort((a, b) => b.total - a.total);
  return {
    month, rules, people: list,
    total: Math.round(list.reduce((a, p) => a + p.total, 0) * 100) / 100,
    to_pay: Math.round(list.reduce((a, p) => a + Math.max(0, p.total - (p.paid?.amount || 0)), 0) * 100) / 100,
  };
}

export async function setCommissionRule(env, user, b) {
  requireOwner(user);
  const hotel = await env.DB.prepare('SELECT id FROM hotels WHERE id = ?').bind(String(b.hotel_id || '')).first();
  if (!hotel) throw notFound('Hotel no encontrado.');
  const u = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').bind(Number(b.user_id)).first();
  if (!u) throw notFound('Persona no encontrada.');
  const amount = money(b.amount);
  if (!(amount >= 0) || amount > 100000) throw bad('Escribe la comisión en lempiras.');
  if (!amount) await env.DB.prepare('DELETE FROM commission_rules WHERE hotel_id = ? AND user_id = ?').bind(hotel.id, u.id).run();
  else await env.DB.prepare('INSERT INTO commission_rules (hotel_id, user_id, amount) VALUES (?,?,?) ON CONFLICT(hotel_id, user_id) DO UPDATE SET amount = excluded.amount').bind(hotel.id, u.id, amount).run();
  return { ok: true };
}

export async function setCommissionPaid(env, user, b) {
  if (!user.is_owner) requireRole(user, String(b.hotel_id || ''), 'contabilidad');
  const month = String(b.month || '');
  if (!monthOk(month)) throw bad('Mes no válido.');
  if (b.paid === false) {
    await env.DB.prepare('DELETE FROM commission_payouts WHERE hotel_id = ? AND user_id = ? AND month = ?').bind(String(b.hotel_id), Number(b.user_id), month).run();
    return { ok: true };
  }
  const amount = money(b.amount);
  if (!(amount > 0)) throw bad('No hay comisión para pagar.');
  await env.DB.prepare(
    `INSERT INTO commission_payouts (hotel_id, user_id, month, amount, paid_at, paid_by) VALUES (?,?,?,?,?,?)
     ON CONFLICT(hotel_id, user_id, month) DO UPDATE SET amount = excluded.amount, paid_at = excluded.paid_at, paid_by = excluded.paid_by`,
  ).bind(String(b.hotel_id), Number(b.user_id), month, amount, Date.now(), user.id).run();
  return { ok: true };
}
