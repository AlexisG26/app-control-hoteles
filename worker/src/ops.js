// Operación de los hoteles: habitaciones, estadías, limpieza, incidencias, ventas y reportes.
import {
  bad, notFound, forbidden, cleanStr, money, posInt, isDate, localDate, localTime, localToUtc, addDays, mondayOf, daysBetween,
} from './util.js';
import { can, requireRole, rolesIn } from './auth.js';
import { notify, usersWithRole } from './notify.js';

export const PAY = ['Efectivo', 'Tarjeta', 'Transferencia', 'Orden de compra'];

export async function getHotel(env, id) {
  const h = await env.DB.prepare('SELECT * FROM hotels WHERE id = ?').bind(String(id)).first();
  if (!h) throw notFound('Hotel no encontrado.');
  return h;
}
async function getRoom(env, roomId) {
  const r = await env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(Number(roomId)).first();
  if (!r) throw notFound('Habitación no encontrada.');
  return r;
}
export async function audit(env, user, action, entity, entityId, detail) {
  await env.DB.prepare('INSERT INTO audit (user_id, action, entity, entity_id, detail, ts) VALUES (?,?,?,?,?,?)')
    .bind(user?.id ?? null, action, entity, String(entityId ?? ''), detail ? JSON.stringify(detail) : null, Date.now()).run();
}
async function setRoom(env, roomId, status, stayId, userId) {
  await env.DB.prepare('UPDATE rooms SET status = ?, current_stay_id = ?, updated_at = ?, updated_by = ? WHERE id = ?')
    .bind(status, stayId, Date.now(), userId, roomId).run();
}

function payInfo(hotel, b) {
  const pay = String(b.pay || '');
  if (!PAY.includes(pay)) throw bad('Elige una forma de pago.');
  if (pay === 'Orden de compra') {
    if (!hotel.allow_po) throw bad('Este hotel no acepta órdenes de compra.');
    const po = cleanStr(b.po, 60);
    if (!po) throw bad('Escribe el número de orden de compra.');
    return { pay, po };
  }
  return { pay, po: null };
}

async function addSale(env, user, hotel, s) {
  const now = Date.now();
  const r = await env.DB.prepare(
    `INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, po, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(hotel.id, localDate(env, now), now, s.concept, s.room ?? null, s.stay_id ?? null, s.kind,
    s.nights || 0, s.hours || 0, s.amount, s.pay, s.po, user.id).run();
  return r.meta.last_row_id;
}

// ---------------- Habitaciones ----------------

export async function listRooms(env, user, hotelId) {
  requireRole(user, hotelId, 'recepcion', 'limpieza', 'mantenimiento', 'contabilidad');
  const showGuest = can(user, hotelId, 'recepcion', 'contabilidad');
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.number, r.status, r.updated_at,
            s.id AS stay_id, s.guest, s.kind, s.check_in_at, s.due_out_at, s.nights, s.hours, s.rate,
            (SELECT COUNT(*) FROM issues i WHERE i.room_id = r.id AND i.status = 'abierta') AS open_issues,
            (SELECT c.started_at FROM cleanings c WHERE c.room_id = r.id AND c.finished_at IS NULL ORDER BY c.id DESC LIMIT 1) AS cleaning_started_at,
            (SELECT u.name FROM cleanings c JOIN users u ON u.id = c.started_by WHERE c.room_id = r.id AND c.finished_at IS NULL ORDER BY c.id DESC LIMIT 1) AS cleaning_by
       FROM rooms r LEFT JOIN stays s ON s.id = r.current_stay_id
      WHERE r.hotel_id = ? ORDER BY r.sort, r.number`,
  ).bind(hotelId).all();
  return results.map((r) => {
    if (!showGuest) { r.guest = r.guest ? 'Ocupada' : null; r.rate = null; }
    return r;
  });
}

// ---------------- Entrada, extensión y salida ----------------

export async function checkIn(env, user, hotelId, b) {
  requireRole(user, hotelId, 'recepcion');
  const hotel = await getHotel(env, hotelId);
  const room = await getRoom(env, b.room_id);
  if (room.hotel_id !== hotel.id) throw bad('La habitación no es de este hotel.');
  if (room.status !== 'libre') throw bad(`La habitación ${room.number} no está libre.`);
  const guest = cleanStr(b.guest, 120) || 'Huésped';
  const kind = b.kind === 'hora' ? 'hora' : 'noche';
  const p = payInfo(hotel, b);
  const now = Date.now();
  let due, nights = 0, hours = 0, amount, rate = null, concept;

  if (kind === 'hora') {
    if (!hotel.allow_hourly) throw bad('Este hotel no tiene habitaciones por hora.');
    hours = posInt(b.hours, 48);
    amount = money(b.amount);
    if (!amount) throw bad('Escribe el monto a cobrar.');
    due = now + hours * 3600000;
    concept = `Hab. ${room.number} · ${guest} (por hora, ${hours} h)`;
  } else {
    nights = posInt(b.nights, 120);
    rate = money(b.rate ?? hotel.default_rate);
    amount = Math.round(nights * rate * 100) / 100;
    due = localToUtc(env, addDays(localDate(env, now), nights), hotel.checkout_time);
    concept = `Hab. ${room.number} · ${guest}`;
  }

  const st = await env.DB.prepare(
    `INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).bind(hotel.id, room.id, guest, kind, now, due, nights, hours, rate, user.id).run();
  const stayId = st.meta.last_row_id;
  // Ocupar la habitación solo si sigue libre (evita dos entradas simultáneas).
  const upd = await env.DB.prepare(`UPDATE rooms SET status='ocupada', current_stay_id=?, updated_at=?, updated_by=? WHERE id=? AND status='libre'`)
    .bind(stayId, now, user.id, room.id).run();
  if (!upd.meta.changes) {
    await env.DB.prepare('DELETE FROM stays WHERE id = ?').bind(stayId).run();
    throw bad(`La habitación ${room.number} acaba de ser ocupada por otra persona.`);
  }
  await addSale(env, user, hotel, { concept, room: room.number, stay_id: stayId, kind: kind === 'hora' ? 'hora' : 'hospedaje', nights, hours, amount, ...p });
  await audit(env, user, 'entrada', 'stay', stayId, { room: room.number, kind, nights, hours, amount });
  return { ok: true, stay_id: stayId, due_out_at: due };
}

async function openStay(env, stayId) {
  const s = await env.DB.prepare('SELECT * FROM stays WHERE id = ?').bind(Number(stayId)).first();
  if (!s) throw notFound('Estadía no encontrada.');
  if (s.checked_out_at) throw bad('Esta estadía ya terminó.');
  return s;
}

export async function extendStay(env, user, stayId, b) {
  const s = await openStay(env, stayId);
  requireRole(user, s.hotel_id, 'recepcion');
  const hotel = await getHotel(env, s.hotel_id);
  const room = await getRoom(env, s.room_id);
  const p = payInfo(hotel, b);
  let due, amount, nights = 0, hours = 0, concept;
  if (s.kind === 'hora') {
    hours = posInt(b.hours, 48);
    amount = money(b.amount);
    if (!amount) throw bad('Escribe el monto a cobrar.');
    due = Math.max(s.due_out_at, Date.now()) + hours * 3600000;
    concept = `Hab. ${room.number} · ${s.guest} (por hora, +${hours} h)`;
  } else {
    nights = posInt(b.nights, 120);
    const rate = money(b.rate ?? s.rate ?? hotel.default_rate);
    amount = Math.round(nights * rate * 100) / 100;
    const base = Math.max(s.due_out_at, localToUtc(env, localDate(env), hotel.checkout_time));
    due = localToUtc(env, addDays(localDate(env, base), nights), hotel.checkout_time);
    concept = `Hab. ${room.number} · ${s.guest} (extensión)`;
  }
  await env.DB.prepare('UPDATE stays SET due_out_at = ?, nights = nights + ?, hours = hours + ?, notified_due = 0 WHERE id = ?')
    .bind(due, nights, hours, s.id).run();
  await addSale(env, user, hotel, { concept, room: room.number, stay_id: s.id, kind: s.kind === 'hora' ? 'hora' : 'hospedaje', nights, hours, amount, ...p });
  await audit(env, user, 'extension', 'stay', s.id, { nights, hours, amount });
  return { ok: true, due_out_at: due };
}

/** Salida (manual o automática). Pasa la habitación a "por limpiar" y avisa a limpieza. */
export async function checkOut(env, user, stayId, mode = 'manual') {
  const s = await openStay(env, stayId);
  if (user) requireRole(user, s.hotel_id, 'recepcion');
  const room = await getRoom(env, s.room_id);
  const now = Date.now();
  await env.DB.prepare('UPDATE stays SET checked_out_at = ?, checkout_mode = ? WHERE id = ?').bind(now, mode, s.id).run();
  await setRoom(env, room.id, 'por_limpiar', null, user?.id ?? null);
  await env.DB.prepare('INSERT INTO cleanings (hotel_id, room_id, requested_at, source) VALUES (?,?,?,?)')
    .bind(s.hotel_id, room.id, now, mode === 'automatica' ? 'salida_automatica' : 'salida_manual').run();
  await audit(env, user, 'salida', 'stay', s.id, { room: room.number, mode });
  const hotel = await getHotel(env, s.hotel_id);
  await notify(env, await usersWithRole(env, s.hotel_id, ['limpieza']), {
    title: `Habitación ${room.number} por limpiar`,
    body: `${hotel.name}: el huésped salió${mode === 'automatica' ? ' (salida automática)' : ''}. Ya puedes limpiarla.`,
    url: `#/hotel/${s.hotel_id}/limpieza`,
  });
  return { ok: true, room: room.number };
}

// ---------------- Limpieza ----------------

export async function cleanStart(env, user, roomId) {
  const room = await getRoom(env, roomId);
  requireRole(user, room.hotel_id, 'limpieza');
  if (!['por_limpiar', 'libre'].includes(room.status)) throw bad('Esta habitación no está para limpiar.');
  let c = await env.DB.prepare('SELECT id FROM cleanings WHERE room_id = ? AND finished_at IS NULL ORDER BY id DESC LIMIT 1').bind(room.id).first();
  if (!c) {
    const r = await env.DB.prepare('INSERT INTO cleanings (hotel_id, room_id, requested_at, source) VALUES (?,?,?,?)')
      .bind(room.hotel_id, room.id, Date.now(), 'manual').run();
    c = { id: r.meta.last_row_id };
  }
  await env.DB.prepare('UPDATE cleanings SET started_at = ?, started_by = ? WHERE id = ?').bind(Date.now(), user.id, c.id).run();
  await setRoom(env, room.id, 'limpiando', null, user.id);
  return { ok: true };
}

export async function cleanFinish(env, user, roomId) {
  const room = await getRoom(env, roomId);
  requireRole(user, room.hotel_id, 'limpieza');
  if (room.status !== 'limpiando' && room.status !== 'por_limpiar') throw bad('Esta habitación no se está limpiando.');
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE cleanings SET finished_at = ?, finished_by = ?, started_at = COALESCE(started_at, ?), started_by = COALESCE(started_by, ?)
      WHERE room_id = ? AND finished_at IS NULL`,
  ).bind(now, user.id, now, user.id, room.id).run();
  const blocked = await env.DB.prepare(`SELECT COUNT(*) AS n FROM issues WHERE room_id = ? AND status = 'abierta' AND blocks_room = 1`).bind(room.id).first();
  await setRoom(env, room.id, blocked.n ? 'bloqueada' : 'libre', null, user.id);
  await notify(env, await usersWithRole(env, room.hotel_id, ['recepcion']), {
    title: `Habitación ${room.number} lista`,
    body: blocked.n ? 'Limpia, pero sigue bloqueada por un problema reportado.' : 'Limpia y disponible para el siguiente huésped.',
    url: `#/hotel/${room.hotel_id}/recepcion`,
  });
  return { ok: true };
}

// ---------------- Incidencias (problemas en habitaciones) ----------------

export async function reportIssue(env, user, roomId, { description, blocks, photo }) {
  const room = await getRoom(env, roomId);
  requireRole(user, room.hotel_id, 'recepcion', 'limpieza', 'mantenimiento');
  const desc = cleanStr(description, 500);
  if (!desc) throw bad('Describe el problema.');
  let photoKey = null;
  if (photo && photo.size) {
    if (!env.PHOTOS) throw bad('El almacenamiento de fotos no está configurado.');
    if (photo.size > 8 * 1024 * 1024) throw bad('La foto pesa más de 8 MB.');
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(photo.type)) throw bad('La foto debe ser JPG, PNG, WEBP o HEIC.');
    photoKey = `${room.hotel_id}/${room.id}/${Date.now()}-${crypto.randomUUID()}`;
    await env.PHOTOS.put(photoKey, photo.stream(), { httpMetadata: { contentType: photo.type } });
  }
  const r = await env.DB.prepare(
    'INSERT INTO issues (hotel_id, room_id, description, photo_key, blocks_room, created_by, created_at) VALUES (?,?,?,?,?,?,?)',
  ).bind(room.hotel_id, room.id, desc, photoKey, blocks ? 1 : 0, user.id, Date.now()).run();
  if (blocks && room.status === 'libre') await setRoom(env, room.id, 'bloqueada', null, user.id);
  await audit(env, user, 'incidencia', 'issue', r.meta.last_row_id, { room: room.number, blocks: !!blocks });
  const hotel = await getHotel(env, room.hotel_id);
  await notify(env, await usersWithRole(env, room.hotel_id, ['mantenimiento', 'recepcion'], true), {
    title: `Problema en habitación ${room.number}`,
    body: `${hotel.name}: ${desc.slice(0, 120)}`,
    url: `#/hotel/${room.hotel_id}/incidencias`,
  });
  return { ok: true, id: r.meta.last_row_id };
}

export async function listIssues(env, user, hotelId, status = 'abierta') {
  requireRole(user, hotelId, 'recepcion', 'limpieza', 'mantenimiento');
  const { results } = await env.DB.prepare(
    `SELECT i.*, r.number AS room, u.name AS created_by_name, v.name AS resolved_by_name
       FROM issues i JOIN rooms r ON r.id = i.room_id
       LEFT JOIN users u ON u.id = i.created_by LEFT JOIN users v ON v.id = i.resolved_by
      WHERE i.hotel_id = ? AND (? = 'todas' OR i.status = ?)
      ORDER BY i.created_at DESC LIMIT 200`,
  ).bind(hotelId, status, status).all();
  return results;
}

export async function resolveIssue(env, user, issueId, b) {
  const i = await env.DB.prepare('SELECT * FROM issues WHERE id = ?').bind(Number(issueId)).first();
  if (!i) throw notFound();
  requireRole(user, i.hotel_id, 'mantenimiento', 'recepcion');
  if (i.status === 'resuelta') return { ok: true };
  await env.DB.prepare(`UPDATE issues SET status='resuelta', resolved_by=?, resolved_at=?, resolution=? WHERE id=?`)
    .bind(user.id, Date.now(), cleanStr(b.resolution, 300) || null, i.id).run();
  const room = await getRoom(env, i.room_id);
  const still = await env.DB.prepare(`SELECT COUNT(*) AS n FROM issues WHERE room_id=? AND status='abierta' AND blocks_room=1`).bind(room.id).first();
  if (room.status === 'bloqueada' && !still.n) await setRoom(env, room.id, 'libre', null, user.id);
  await audit(env, user, 'incidencia_resuelta', 'issue', i.id);
  return { ok: true };
}

export async function issuePhoto(env, user, issueId) {
  const i = await env.DB.prepare('SELECT hotel_id, photo_key FROM issues WHERE id = ?').bind(Number(issueId)).first();
  if (!i || !i.photo_key) throw notFound('Foto no encontrada.');
  requireRole(user, i.hotel_id, 'recepcion', 'limpieza', 'mantenimiento');
  const obj = await env.PHOTOS.get(i.photo_key);
  if (!obj) throw notFound('Foto no encontrada.');
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'image/jpeg', 'cache-control': 'private, max-age=3600' } });
}

// ---------------- Ventas ----------------

export async function addExtraSale(env, user, hotelId, b) {
  requireRole(user, hotelId, 'recepcion', 'contabilidad');
  const hotel = await getHotel(env, hotelId);
  const amount = money(b.amount);
  if (!amount) throw bad('Escribe un monto mayor que cero.');
  const p = payInfo(hotel, b);
  const id = await addSale(env, user, hotel, { concept: cleanStr(b.concept, 120) || 'Ingreso', kind: 'extra', amount, ...p });
  await audit(env, user, 'ingreso', 'sale', id, { amount });
  return { ok: true, id };
}

export async function listSales(env, user, hotelId, from, to) {
  const today = localDate(env);
  if (!isDate(from) || !isDate(to)) throw bad('Fechas inválidas.');
  // Recepción solo ve la caja del día; contabilidad ve todo.
  if (!can(user, hotelId, 'contabilidad')) {
    requireRole(user, hotelId, 'recepcion');
    if (from !== today || to !== today) throw forbidden('Recepción solo puede ver la caja de hoy.');
  }
  const { results } = await env.DB.prepare(
    `SELECT s.*, u.name AS by_name, v.name AS voided_by_name FROM sales s
       LEFT JOIN users u ON u.id = s.created_by LEFT JOIN users v ON v.id = s.voided_by
      WHERE s.hotel_id = ? AND s.local_date BETWEEN ? AND ? ORDER BY s.ts DESC LIMIT 2000`,
  ).bind(hotelId, from, to).all();
  return results;
}

export async function voidSale(env, user, saleId, b) {
  const s = await env.DB.prepare('SELECT * FROM sales WHERE id = ?').bind(Number(saleId)).first();
  if (!s) throw notFound();
  if (s.voided_at) return { ok: true };
  const isAcc = can(user, s.hotel_id, 'contabilidad');
  if (!isAcc) {
    requireRole(user, s.hotel_id, 'recepcion');
    if (s.local_date !== localDate(env)) throw forbidden('Recepción solo puede anular movimientos de hoy.');
  }
  const reason = cleanStr(b.reason, 200);
  if (!reason) throw bad('Escribe el motivo de la anulación.');
  await env.DB.prepare('UPDATE sales SET voided_at = ?, voided_by = ?, void_reason = ? WHERE id = ?').bind(Date.now(), user.id, reason, s.id).run();
  await audit(env, user, 'anulacion', 'sale', s.id, { reason, amount: s.amount });
  return { ok: true };
}

export async function poUpdate(env, user, saleId, b) {
  const s = await env.DB.prepare('SELECT * FROM sales WHERE id = ?').bind(Number(saleId)).first();
  if (!s || s.pay !== 'Orden de compra') throw notFound('Orden de compra no encontrada.');
  requireRole(user, s.hotel_id, 'contabilidad');
  if (b.action === 'facturada') await env.DB.prepare('UPDATE sales SET po_invoiced_at = COALESCE(po_invoiced_at, ?) WHERE id = ?').bind(Date.now(), s.id).run();
  else if (b.action === 'cobrada') await env.DB.prepare('UPDATE sales SET po_paid_at = COALESCE(po_paid_at, ?), po_invoiced_at = COALESCE(po_invoiced_at, ?) WHERE id = ?').bind(Date.now(), Date.now(), s.id).run();
  else throw bad('Acción no válida.');
  await audit(env, user, 'oc_' + b.action, 'sale', s.id);
  return { ok: true };
}

export async function pendingPOs(env, hotelId = null) {
  const today = localDate(env);
  const { results } = await env.DB.prepare(
    `SELECT s.*, h.name AS hotel_name FROM sales s JOIN hotels h ON h.id = s.hotel_id
      WHERE s.pay = 'Orden de compra' AND s.voided_at IS NULL AND s.po_paid_at IS NULL AND (? IS NULL OR s.hotel_id = ?)
      ORDER BY s.ts ASC`,
  ).bind(hotelId, hotelId).all();
  return results.map((s) => {
    const days = daysBetween(s.local_date, today);
    const estado = days >= 30 ? 'vencida_30' : (!s.po_invoiced_at && days >= 15 ? 'facturar' : (s.po_invoiced_at ? 'facturada' : 'en_curso'));
    return { ...s, days, estado };
  });
}

// ---------------- Resumen y reportes ----------------

export async function hotelSnapshot(env, hotel) {
  const today = localDate(env);
  const week = mondayOf(today);
  const { results: st } = await env.DB.prepare('SELECT status, COUNT(*) AS n FROM rooms WHERE hotel_id = ? GROUP BY status').bind(hotel.id).all();
  const counts = { libre: 0, ocupada: 0, por_limpiar: 0, limpiando: 0, bloqueada: 0 };
  st.forEach((r) => { counts[r.status] = r.n; });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const rev = async (from, to) => (await env.DB.prepare(
    'SELECT COALESCE(SUM(amount),0) AS t, COUNT(*) AS n FROM sales WHERE hotel_id = ? AND voided_at IS NULL AND local_date BETWEEN ? AND ?',
  ).bind(hotel.id, from, to).first());
  const day = await rev(today, today);
  const wk = await rev(week, today);
  const month = await rev(today.slice(0, 8) + '01', today);
  const issues = await env.DB.prepare(`SELECT COUNT(*) AS n FROM issues WHERE hotel_id = ? AND status = 'abierta'`).bind(hotel.id).first();
  const dueToday = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM stays WHERE hotel_id = ? AND checked_out_at IS NULL AND kind = 'noche' AND due_out_at <= ?`,
  ).bind(hotel.id, localToUtc(env, addDays(today, 1), '00:00')).first();
  const pos = hotel.allow_po ? await pendingPOs(env, hotel.id) : [];
  return {
    id: hotel.id, name: hotel.name, total, counts,
    occupancy: total ? Math.round((counts.ocupada / total) * 100) : 0,
    revenue: { today: day.t, today_count: day.n, week: wk.t, month: month.t },
    open_issues: issues.n,
    checkouts_today: dueToday.n,
    po_pending: pos.length,
    po_pending_amount: pos.reduce((a, s) => a + s.amount, 0),
    po_alerts: pos.filter((p) => p.estado === 'facturar' || p.estado === 'vencida_30').length,
  };
}

/** Panel global: solo gerencia (dueños). */
export async function overview(env, user, hotels) {
  if (!user.is_owner) throw forbidden('El panel global es solo para gerencia.');
  const list = [];
  for (const h of hotels) list.push(await hotelSnapshot(env, h));
  const sum = (f) => list.reduce((a, x) => a + f(x), 0);
  return {
    date: localDate(env), time: localTime(env),
    hotels: list,
    totals: {
      rooms: sum((x) => x.total), ocupada: sum((x) => x.counts.ocupada), libre: sum((x) => x.counts.libre),
      por_limpiar: sum((x) => x.counts.por_limpiar + x.counts.limpiando), bloqueada: sum((x) => x.counts.bloqueada),
      today: sum((x) => x.revenue.today), week: sum((x) => x.revenue.week), month: sum((x) => x.revenue.month),
      open_issues: sum((x) => x.open_issues), po_alerts: sum((x) => x.po_alerts),
    },
  };
}

/** Estado financiero por rango: totales por día, forma de pago, tipo y usuario. */
export async function financeReport(env, user, hotelId, from, to) {
  requireRole(user, hotelId, 'contabilidad');
  if (!isDate(from) || !isDate(to) || from > to) throw bad('Rango de fechas inválido.');
  if (daysBetween(from, to) > 400) throw bad('El rango máximo es de un año.');
  const q = (sql) => env.DB.prepare(sql).bind(hotelId, from, to).all().then((r) => r.results);
  const base = `FROM sales s LEFT JOIN users u ON u.id = s.created_by WHERE s.hotel_id = ? AND s.voided_at IS NULL AND s.local_date BETWEEN ? AND ?`;
  const [byDay, byPay, byKind, byUser, tot] = await Promise.all([
    q(`SELECT s.local_date AS d, SUM(s.amount) AS t, COUNT(*) AS n ${base} GROUP BY s.local_date ORDER BY s.local_date`),
    q(`SELECT s.pay AS k, SUM(s.amount) AS t, COUNT(*) AS n ${base} GROUP BY s.pay`),
    q(`SELECT s.kind AS k, SUM(s.amount) AS t, COUNT(*) AS n, SUM(s.nights) AS nights, SUM(s.hours) AS hours ${base} GROUP BY s.kind`),
    q(`SELECT COALESCE(u.name,'—') AS k, SUM(s.amount) AS t, COUNT(*) AS n ${base} GROUP BY u.name ORDER BY t DESC`),
    q(`SELECT COALESCE(SUM(s.amount),0) AS t, COUNT(*) AS n, COALESCE(SUM(s.nights),0) AS nights ${base}`),
  ]);
  const days = daysBetween(from, to) + 1;
  const rooms = await env.DB.prepare('SELECT COUNT(*) AS n FROM rooms WHERE hotel_id = ?').bind(hotelId).first();
  return {
    hotel_id: hotelId, from, to, total: tot[0].t, count: tot[0].n, nights: tot[0].nights,
    avg_day: tot[0].t / days,
    occupancy_nights_pct: rooms.n ? Math.round((tot[0].nights / (rooms.n * days)) * 100) : 0,
    by_day: byDay, by_pay: byPay, by_kind: byKind, by_user: byUser,
  };
}

/**
 * Análisis financiero comparado (solo gerencia): cuánto generó cada hotel en el período,
 * su parte del total y la variación contra el período anterior de la misma duración.
 */
export async function compareFinance(env, user, hotels, from, to) {
  if (!user.is_owner) throw forbidden('El análisis global es solo para gerencia.');
  if (!isDate(from) || !isDate(to) || from > to) throw bad('Rango de fechas inválido.');
  const len = daysBetween(from, to) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(from, -len);
  const out = [];
  for (const h of hotels) {
    const cur = await financeReport(env, user, h.id, from, to);
    const prev = await env.DB.prepare(
      'SELECT COALESCE(SUM(amount),0) AS t FROM sales WHERE hotel_id = ? AND voided_at IS NULL AND local_date BETWEEN ? AND ?',
    ).bind(h.id, prevFrom, prevTo).first();
    const lodging = cur.by_kind.find((k) => k.k === 'hospedaje') || { t: 0, nights: 0 };
    out.push({
      id: h.id, name: h.name,
      total: cur.total, count: cur.count, nights: cur.nights,
      prev_total: prev.t,
      delta_pct: prev.t ? Math.round(((cur.total - prev.t) / prev.t) * 100) : null,
      avg_night: lodging.nights ? lodging.t / lodging.nights : 0,
      avg_day: cur.avg_day,
      occupancy_pct: cur.occupancy_nights_pct,
      by_pay: cur.by_pay, by_kind: cur.by_kind, by_day: cur.by_day, by_user: cur.by_user,
    });
  }
  const total = out.reduce((a, x) => a + x.total, 0);
  const prevTotal = out.reduce((a, x) => a + x.prev_total, 0);
  out.forEach((x) => { x.share_pct = total ? Math.round((x.total / total) * 100) : 0; });
  return {
    from, to, prev_from: prevFrom, prev_to: prevTo, days: len,
    total, prev_total: prevTotal,
    delta_pct: prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null,
    hotels: out,
  };
}

