// Comisiones por reserva (solo gerencia): quien registra la reserva gana la comisión de su regla.
import { bad, notFound, money, localDate } from './util.js';
import { requireOwner, requireRole, can } from './auth.js';

/** Al registrar un cobro de hospedaje (entrada o extensión): si quien lo registra tiene comisión en ese hotel, queda guardada en el cobro. */
export async function applyCommission(env, saleId, hotelId, userId) {
  const r = await env.DB.prepare('SELECT amount FROM commission_rules WHERE hotel_id = ? AND user_id = ?').bind(hotelId, userId).first();
  if (!r || !(r.amount > 0)) return;
  await env.DB.prepare('UPDATE sales SET commission_user_id = ?, commission_amount = ? WHERE id = ? AND commission_user_id IS NULL').bind(userId, r.amount, saleId).run();
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
  const { results: rules } = await env.DB.prepare(
    `SELECT c.hotel_id, h.name AS hotel_name, c.user_id, u.name, c.amount FROM commission_rules c
       JOIN users u ON u.id = c.user_id JOIN hotels h ON h.id = c.hotel_id WHERE u.deleted_at IS NULL ${onlyHotel ? 'AND c.hotel_id = ?' : ''} ORDER BY h.name, u.name`,
  ).bind(...(onlyHotel ? [onlyHotel] : [])).all();
  const { results: items } = await env.DB.prepare(
    `SELECT x.id AS sale_id, x.stay_id, x.hotel_id, h.name AS hotel_name, x.commission_user_id AS user_id, u.name, x.commission_amount AS amount,
            r.number AS room, COALESCE(st.guest, x.concept) AS guest, x.local_date, x.nights, x.kind, x.amount AS sale_total,
            st.checked_out_at, (x.id <> (SELECT MIN(y.id) FROM sales y WHERE y.stay_id = x.stay_id AND y.kind IN ('hospedaje','hora'))) AS is_ext
       FROM sales x JOIN hotels h ON h.id = x.hotel_id LEFT JOIN users u ON u.id = x.commission_user_id
       LEFT JOIN stays st ON st.id = x.stay_id LEFT JOIN rooms r ON r.id = st.room_id
      WHERE x.commission_user_id IS NOT NULL AND x.commission_amount > 0 AND x.voided_at IS NULL
        AND x.local_date >= ? AND x.local_date < ? ${onlyHotel ? 'AND x.hotel_id = ?' : ''} ORDER BY x.local_date, x.id`,
  ).bind(month + '-01', nextMonth(month) + '-01', ...(onlyHotel ? [onlyHotel] : [])).all();
  const { results: payouts } = await env.DB.prepare('SELECT * FROM commission_payouts WHERE month = ?').bind(month).all();
  const people = new Map();
  const key = (h, u) => `${h}|${u}`;
  for (const r of rules) people.set(key(r.hotel_id, r.user_id), { hotel_id: r.hotel_id, hotel_name: r.hotel_name, user_id: r.user_id, name: r.name, rate: r.amount, count: 0, total: 0, sales: 0, items: [] });
  for (const it of items) {
    const k = key(it.hotel_id, it.user_id);
    if (!people.has(k)) people.set(k, { hotel_id: it.hotel_id, hotel_name: it.hotel_name, user_id: it.user_id, name: it.name || 'Usuario eliminado', rate: null, count: 0, total: 0, sales: 0, items: [] });
    const p = people.get(k);
    p.count++; p.total += it.amount; p.sales += it.sale_total;
    p.items.push({ sale_id: it.sale_id, stay_id: it.stay_id, date: it.local_date, room: it.room, guest: it.guest, nights: it.nights, kind: it.kind, amount: it.amount, sale_total: it.sale_total, open: it.stay_id && !it.checked_out_at, extension: !!it.is_ext });
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
