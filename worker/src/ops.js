// Operación de los hoteles: habitaciones, estadías, limpieza, incidencias, ventas y reportes.
import {
  bad, notFound, forbidden, cleanStr, money, posInt, isDate, localDate, localTime, localToUtc, addDays, mondayOf, daysBetween,
} from './util.js';
import { can, requireRole, rolesIn } from './auth.js';
import { notify, usersWithRole } from './notify.js';

export const PAY = ['Efectivo', 'Tarjeta', 'Transferencia', 'Orden de compra', 'Pendiente'];
/** Formas con las que se liquida una cuenta pendiente. */
export const PAY_NOW = ['Efectivo', 'Tarjeta', 'Transferencia'];
/** Condición SQL: filas que sí son dinero recibido (lo pendiente no cuenta hasta que se paga). */
const CASH = `pay <> 'Pendiente'`;

export async function getHotel(env, id) {
  const h = await env.DB.prepare('SELECT * FROM hotels WHERE id = ?').bind(String(id)).first();
  if (!h) throw notFound('Hotel no encontrado.');
  return h;
}
/** Tarifas por tipo y empresas de crédito del hotel (guardadas como JSON). */
export function hotelConfig(h) {
  const parse = (v, d) => { try { return v ? JSON.parse(v) : d; } catch { return d; } };
  return { rates: parse(h.rates, {}), company_rates: parse(h.company_rates, {}), companies: parse(h.companies, []) };
}
/** Tarifa por noche de un tipo: la de empresa si es una empresa de crédito; si no, la de clientes. */
export function rateFor(h, roomType, company) {
  const c = hotelConfig(h);
  const isCredit = company && c.companies.some((x) => x.toLowerCase() === String(company).toLowerCase());
  if (roomType && isCredit && Number.isFinite(c.company_rates[roomType])) return c.company_rates[roomType];
  if (roomType && Number.isFinite(c.rates[roomType])) return c.rates[roomType];
  return null;
}
/** ¿La empresa es de crédito en este hotel? */
export function isCreditCompany(h, company) {
  return !!company && hotelConfig(h).companies.some((x) => x.toLowerCase() === String(company).trim().toLowerCase());
}
/** Los precios de empresas de crédito solo los ve contabilidad (y gerencia/administración). */
const seesCompanyPrices = (user, hotelId) => can(user, hotelId, 'contabilidad');

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
  const now = s.ts ?? Date.now();
  const r = await env.DB.prepare(
    `INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, po, created_by, parent_id, proof_key, paid_nights, room_type, company)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(hotel.id, s.local_date ?? localDate(env, now), now, s.concept, s.room ?? null, s.stay_id ?? null, s.kind,
    s.nights || 0, s.hours || 0, s.amount, s.pay, s.po ?? null, user.id, s.parent_id ?? null, s.proof_key ?? null, s.paid_nights || 0, s.room_type ?? null, s.company ?? null).run();
  return r.meta.last_row_id;
}

// ---------------- Habitaciones ----------------

export async function listRooms(env, user, hotelId) {
  requireRole(user, hotelId, 'recepcion', 'limpieza', 'mantenimiento', 'contabilidad');
  const showGuest = can(user, hotelId, 'recepcion', 'contabilidad');
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.number, r.status, r.updated_at,
            s.id AS stay_id, s.guest, s.kind, s.check_in_at, s.due_out_at, s.nights, s.hours, s.rate, s.room_type, s.company,
            (SELECT COUNT(*) FROM issues i WHERE i.room_id = r.id AND i.status = 'abierta') AS open_issues,
            (SELECT c.started_at FROM cleanings c WHERE c.room_id = r.id AND c.finished_at IS NULL ORDER BY c.id DESC LIMIT 1) AS cleaning_started_at,
            (SELECT u.name FROM cleanings c JOIN users u ON u.id = c.started_by WHERE c.room_id = r.id AND c.finished_at IS NULL ORDER BY c.id DESC LIMIT 1) AS cleaning_by,
            (SELECT COALESCE(SUM(x.amount - x.paid_amount), 0) FROM sales x WHERE x.stay_id = s.id AND x.pay = 'Pendiente' AND x.voided_at IS NULL AND x.settled_at IS NULL) AS pending_balance
       FROM rooms r LEFT JOIN stays s ON s.id = r.current_stay_id
      WHERE r.hotel_id = ? ORDER BY r.sort, r.number`,
  ).bind(hotelId).all();
  const hotel = await getHotel(env, hotelId);
  const showCompany = seesCompanyPrices(user, hotelId);
  return results.map((r) => {
    if (!showGuest) { r.guest = r.guest ? 'Ocupada' : null; r.rate = null; r.pending_balance = 0; r.company = null; }
    else if (!showCompany && isCreditCompany(hotel, r.company)) { r.rate = null; r.pending_balance = 0; r.credit = true; }
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
  const roomType = cleanStr(b.room_type, 30) || null;
  const company = cleanStr(b.company, 80) || null;
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
    // Precio: el escrito; si no, la tarifa del tipo de habitación; si no, la tarifa general del hotel.
    const credit = isCreditCompany(hotel, company);
    // Empresa de crédito: si quien registra no es contabilidad, se aplica siempre la tarifa de empresa.
    const typed = credit && !seesCompanyPrices(user, hotel.id) ? undefined : b.rate;
    rate = money(typed ?? rateFor(hotel, roomType, company) ?? hotel.default_rate);
    amount = Math.round(nights * rate * 100) / 100;
    due = localToUtc(env, addDays(localDate(env, now), nights), hotel.checkout_time);
    concept = `Hab. ${room.number} · ${guest}${company ? ` · ${company}` : ''}`;
  }

  const st = await env.DB.prepare(
    `INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(hotel.id, room.id, guest, kind, now, due, nights, hours, rate, user.id, roomType, company).run();
  const stayId = st.meta.last_row_id;
  // Ocupar la habitación solo si sigue libre (evita dos entradas simultáneas).
  const upd = await env.DB.prepare(`UPDATE rooms SET status='ocupada', current_stay_id=?, updated_at=?, updated_by=? WHERE id=? AND status='libre'`)
    .bind(stayId, now, user.id, room.id).run();
  if (!upd.meta.changes) {
    await env.DB.prepare('DELETE FROM stays WHERE id = ?').bind(stayId).run();
    throw bad(`La habitación ${room.number} acaba de ser ocupada por otra persona.`);
  }
  await addSale(env, user, hotel, { concept, room: room.number, stay_id: stayId, kind: kind === 'hora' ? 'hora' : 'hospedaje', nights, hours, amount, room_type: roomType, company, ...p });
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
    const typed = isCreditCompany(hotel, s.company) && !seesCompanyPrices(user, hotel.id) ? undefined : b.rate;
    const rate = money(typed ?? s.rate ?? rateFor(hotel, s.room_type, s.company) ?? hotel.default_rate);
    amount = Math.round(nights * rate * 100) / 100;
    const base = Math.max(s.due_out_at, localToUtc(env, localDate(env), hotel.checkout_time));
    due = localToUtc(env, addDays(localDate(env, base), nights), hotel.checkout_time);
    concept = `Hab. ${room.number} · ${s.guest}${s.company ? ` · ${s.company}` : ''} (extensión)`;
  }
  await env.DB.prepare('UPDATE stays SET due_out_at = ?, nights = nights + ?, hours = hours + ?, notified_due = 0 WHERE id = ?')
    .bind(due, nights, hours, s.id).run();
  await addSale(env, user, hotel, { concept, room: room.number, stay_id: s.id, kind: s.kind === 'hora' ? 'hora' : 'hospedaje', nights, hours, amount, room_type: s.room_type, company: s.company, ...p });
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

// ---------------- Reservas de días anteriores ----------------

/**
 * Registrar una estadía que empezó en una fecha pasada (para pasar al sistema reservas que se llevaban en papel).
 * Si ya terminó, queda como historial; si sigue, ocupa la habitación hasta su salida.
 * La venta se registra en la fecha de entrada. Solo gerencia y contabilidad.
 */
export async function pastStay(env, user, hotelId, b) {
  requireRole(user, hotelId, 'contabilidad');
  const hotel = await getHotel(env, hotelId);
  const room = await getRoom(env, b.room_id);
  if (room.hotel_id !== hotel.id) throw bad('La habitación no es de este hotel.');
  const today = localDate(env);
  const date = String(b.date || '');
  if (!isDate(date)) throw bad('Elige la fecha de entrada.');
  if (date > today) throw bad('La fecha de entrada no puede ser futura.');
  if (daysBetween(date, today) > 366) throw bad('Solo se pueden registrar reservas del último año.');
  const guest = cleanStr(b.guest, 120) || 'Huésped';
  const company = cleanStr(b.company, 80) || null;
  const roomType = cleanStr(b.room_type, 30) || null;
  const nights = posInt(b.nights, 120);
  const rate = money(b.rate ?? rateFor(hotel, roomType, company) ?? hotel.default_rate);
  if (!rate) throw bad('Escribe el precio por noche.');
  const p = payInfo(hotel, b);
  const checkIn = localToUtc(env, date, '14:00');
  const due = localToUtc(env, addDays(date, nights), hotel.checkout_time);
  const now = Date.now();
  // No encimar con otra estadía de la misma habitación
  const clash = await env.DB.prepare(
    `SELECT guest, check_in_at, COALESCE(checked_out_at, due_out_at) AS out_at FROM stays
      WHERE room_id = ? AND check_in_at < ? AND COALESCE(checked_out_at, due_out_at) > ? LIMIT 1`,
  ).bind(room.id, due, checkIn).first();
  if (clash) throw bad(`La habitación ${room.number} ya tiene a ${clash.guest} en esas fechas.`);
  const ongoing = due > now;
  if (ongoing && room.status !== 'libre') throw bad(`La habitación ${room.number} está ${room.status.replace('_', ' ')} ahora. Si la estadía sigue, primero libérala.`);
  const st = await env.DB.prepare(
    `INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
     VALUES (?,?,?,'noche',?,?,?,0,?,?,?,?,?,?)`,
  ).bind(hotel.id, room.id, guest, checkIn, due, nights, rate, user.id, roomType, company, ongoing ? null : due, ongoing ? null : 'historico').run();
  const stayId = st.meta.last_row_id;
  if (ongoing) {
    await env.DB.prepare(`UPDATE rooms SET status='ocupada', current_stay_id=?, updated_at=?, updated_by=? WHERE id=? AND status='libre'`)
      .bind(stayId, now, user.id, room.id).run();
  }
  const amount = Math.round(nights * rate * 100) / 100;
  const concept = `Hab. ${room.number} · ${guest}${company ? ` · ${company}` : ''}`;
  await addSale(env, user, hotel, { concept, room: room.number, stay_id: stayId, kind: 'hospedaje', nights, amount, room_type: roomType, company, local_date: date, ts: checkIn, ...p });
  await audit(env, user, 'reserva_anterior', 'stay', stayId, { room: room.number, date, nights, amount });
  return { ok: true, stay_id: stayId, ongoing, check_out: addDays(date, nights), amount };
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
  if (seesCompanyPrices(user, hotelId)) return results;
  const hotel = await getHotel(env, hotelId);
  return results.filter((x) => !isCreditCompany(hotel, x.company));
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
  if (s.pay === 'Pendiente') {
    const paid = await env.DB.prepare('SELECT COUNT(*) AS n FROM sales WHERE parent_id = ? AND voided_at IS NULL').bind(s.id).first();
    if (paid.n) throw bad('Esta cuenta ya tiene pagos. Anula primero los pagos registrados.');
  }
  await env.DB.prepare('UPDATE sales SET voided_at = ?, voided_by = ?, void_reason = ? WHERE id = ?').bind(Date.now(), user.id, reason, s.id).run();
  if (s.kind === 'abono' && s.parent_id) {
    // Devolver el saldo a la cuenta pendiente
    await env.DB.prepare('UPDATE sales SET paid_amount = MAX(0, paid_amount - ?), paid_nights = MAX(0, paid_nights - ?), settled_at = NULL WHERE id = ?')
      .bind(s.amount, s.paid_nights || 0, s.parent_id).run();
  }
  await audit(env, user, 'anulacion', 'sale', s.id, { reason, amount: s.amount });
  return { ok: true };
}

// ---------------- Pagos pendientes ----------------

/** Cuentas por cobrar de un hotel, con su saldo, noches pagadas y el historial de pagos con comprobante. */
export async function listPending(env, user, hotelId) {
  requireRole(user, hotelId, 'recepcion', 'contabilidad');
  const today = localDate(env);
  const { results } = await env.DB.prepare(
    `SELECT s.*, u.name AS by_name FROM sales s LEFT JOIN users u ON u.id = s.created_by
      WHERE s.hotel_id = ? AND s.pay = 'Pendiente' AND s.voided_at IS NULL AND s.settled_at IS NULL ORDER BY s.ts ASC`,
  ).bind(hotelId).all();
  if (!seesCompanyPrices(user, hotelId)) {
    const hotel = await getHotel(env, hotelId);
    for (let i = results.length - 1; i >= 0; i--) if (isCreditCompany(hotel, results[i].company)) results.splice(i, 1);
  }
  if (!results.length) return [];
  const ids = results.map((r) => r.id);
  const { results: pays } = await env.DB.prepare(
    `SELECT a.id, a.parent_id, a.ts, a.local_date, a.amount, a.pay, a.paid_nights, (a.proof_key IS NOT NULL) AS has_proof, u.name AS by_name
       FROM sales a LEFT JOIN users u ON u.id = a.created_by
      WHERE a.parent_id IN (${ids.map(() => '?').join(',')}) AND a.voided_at IS NULL ORDER BY a.ts`,
  ).bind(...ids).all();
  return results.map((s) => ({
    ...s,
    balance: Math.round((s.amount - s.paid_amount) * 100) / 100,
    nights_left: Math.max(0, (s.nights || 0) - (s.paid_nights || 0)),
    rate: s.nights ? s.amount / s.nights : null,
    days: daysBetween(s.local_date, today),
    payments: pays.filter((p) => p.parent_id === s.id),
  }));
}

/**
 * Registrar un pago de una cuenta pendiente: cuántas noches cubre, cuánto, con qué y su comprobante.
 * La transferencia exige la foto del comprobante.
 */
export async function payPending(env, user, saleId, { pay, nights, amount, photo }) {
  const s = await env.DB.prepare('SELECT * FROM sales WHERE id = ?').bind(Number(saleId)).first();
  if (!s || s.pay !== 'Pendiente' || s.voided_at) throw notFound('Cuenta pendiente no encontrada.');
  requireRole(user, s.hotel_id, 'recepcion', 'contabilidad');
  if (s.settled_at) throw bad('Esta cuenta ya está pagada.');
  if (!PAY_NOW.includes(pay)) throw bad('Elige cómo pagó: efectivo, tarjeta o transferencia.');
  const balance = Math.round((s.amount - s.paid_amount) * 100) / 100;
  const left = Math.max(0, (s.nights || 0) - (s.paid_nights || 0));
  let n = 0;
  if (s.nights) {
    n = posInt(nights, left || 1);
    if (n > left) throw bad(`Solo quedan ${left} noche${left === 1 ? '' : 's'} por pagar.`);
  }
  // Monto: el que escriban; si no, el proporcional a las noches (y el saldo exacto si paga todo lo que falta).
  let amt = amount !== undefined && amount !== null && amount !== '' ? money(amount)
    : (s.nights ? (n === left ? balance : Math.round((s.amount / s.nights) * n * 100) / 100) : balance);
  if (!amt) throw bad('Escribe el monto que pagó.');
  if (amt > balance + 0.009) throw bad(`El pago es mayor que el saldo pendiente (L ${balance}).`);
  if (pay === 'Transferencia' && !(photo && photo.size)) throw bad('Sube la foto del comprobante de la transferencia.');
  let proofKey = null;
  if (photo && photo.size) {
    if (!env.PHOTOS) throw bad('El almacenamiento de fotos no está configurado.');
    if (photo.size > 8 * 1024 * 1024) throw bad('La foto pesa más de 8 MB.');
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(photo.type)) throw bad('El comprobante debe ser una foto JPG, PNG, WEBP o HEIC.');
    proofKey = `${s.hotel_id}/pagos/${s.id}/${Date.now()}-${crypto.randomUUID()}`;
    await env.PHOTOS.put(proofKey, photo.stream(), { httpMetadata: { contentType: photo.type } });
  }
  const hotel = await getHotel(env, s.hotel_id);
  const base = s.concept.replace(/\s*\(pendiente\)$/, '');
  const paidN = (s.paid_nights || 0) + n;
  const concept = s.nights ? `Pago de ${base} · noches ${(s.paid_nights || 0) + 1}–${paidN} de ${s.nights}` : `Pago de ${base}`;
  const id = await addSale(env, user, hotel, { concept, room: s.room, stay_id: s.stay_id, kind: 'abono', amount: amt, pay, parent_id: s.id, proof_key: proofKey, paid_nights: n });
  const newBalance = Math.round((balance - amt) * 100) / 100;
  await env.DB.prepare('UPDATE sales SET paid_amount = paid_amount + ?, paid_nights = paid_nights + ?, settled_at = ? WHERE id = ?')
    .bind(amt, n, newBalance <= 0.009 ? Date.now() : null, s.id).run();
  await audit(env, user, 'pago_pendiente', 'sale', s.id, { pago: id, amount: amt, nights: n, pay });
  return { ok: true, id, balance: Math.max(0, newBalance), nights_left: Math.max(0, left - n), settled: newBalance <= 0.009 };
}

export async function saleProof(env, user, saleId) {
  const s = await env.DB.prepare('SELECT hotel_id, proof_key FROM sales WHERE id = ?').bind(Number(saleId)).first();
  if (!s || !s.proof_key) throw notFound('Comprobante no encontrado.');
  requireRole(user, s.hotel_id, 'recepcion', 'contabilidad');
  const obj = await env.PHOTOS.get(s.proof_key);
  if (!obj) throw notFound('Comprobante no encontrado.');
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'image/jpeg', 'cache-control': 'private, max-age=3600' } });
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
    `SELECT COALESCE(SUM(amount),0) AS t, COUNT(*) AS n FROM sales WHERE hotel_id = ? AND voided_at IS NULL AND ${CASH} AND local_date BETWEEN ? AND ?`,
  ).bind(hotel.id, from, to).first());
  const pend = await env.DB.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(amount - paid_amount),0) AS t FROM sales WHERE hotel_id = ? AND pay = 'Pendiente' AND voided_at IS NULL AND settled_at IS NULL`,
  ).bind(hotel.id).first();
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
    pending_count: pend.n,
    pending_amount: pend.t,
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
      pending_count: sum((x) => x.pending_count), pending_amount: sum((x) => x.pending_amount),
    },
  };
}

/** Estado financiero por rango: totales por día, forma de pago, tipo y usuario. */
export async function financeReport(env, user, hotelId, from, to) {
  requireRole(user, hotelId, 'contabilidad');
  if (!isDate(from) || !isDate(to) || from > to) throw bad('Rango de fechas inválido.');
  if (daysBetween(from, to) > 400) throw bad('El rango máximo es de un año.');
  const q = (sql) => env.DB.prepare(sql).bind(hotelId, from, to).all().then((r) => r.results);
  const base = `FROM sales s LEFT JOIN users u ON u.id = s.created_by WHERE s.hotel_id = ? AND s.voided_at IS NULL AND s.${CASH} AND s.local_date BETWEEN ? AND ?`;
  const sold = `FROM sales s WHERE s.hotel_id = ? AND s.voided_at IS NULL AND s.kind <> 'abono' AND s.local_date BETWEEN ? AND ?`;
  const [byDay, byPay, byKind, byUser, tot, nightsSold, lodgingSold, pendingNew] = await Promise.all([
    q(`SELECT s.local_date AS d, SUM(s.amount) AS t, COUNT(*) AS n ${base} GROUP BY s.local_date ORDER BY s.local_date`),
    q(`SELECT s.pay AS k, SUM(s.amount) AS t, COUNT(*) AS n ${base} GROUP BY s.pay`),
    q(`SELECT s.kind AS k, SUM(s.amount) AS t, COUNT(*) AS n, SUM(s.nights) AS nights, SUM(s.hours) AS hours ${base} GROUP BY s.kind`),
    q(`SELECT COALESCE(u.name,'—') AS k, SUM(s.amount) AS t, COUNT(*) AS n ${base} GROUP BY u.name ORDER BY t DESC`),
    q(`SELECT COALESCE(SUM(s.amount),0) AS t, COUNT(*) AS n ${base}`),
    q(`SELECT COALESCE(SUM(s.nights),0) AS nights ${sold}`),
    q(`SELECT COALESCE(SUM(s.amount),0) AS t, COALESCE(SUM(s.nights),0) AS nights ${sold} AND s.kind = 'hospedaje'`),
    q(`SELECT COUNT(*) AS n, COALESCE(SUM(s.amount),0) AS t ${sold} AND s.pay = 'Pendiente'`),
  ]);
  tot[0].nights = nightsSold[0].nights;
  const pendingNow = await env.DB.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(amount - paid_amount),0) AS t FROM sales WHERE hotel_id = ? AND pay = 'Pendiente' AND voided_at IS NULL AND settled_at IS NULL`,
  ).bind(hotelId).first();
  const days = daysBetween(from, to) + 1;
  const rooms = await env.DB.prepare('SELECT COUNT(*) AS n FROM rooms WHERE hotel_id = ?').bind(hotelId).first();
  const h = await getHotel(env, hotelId);
  // Impuestos incluidos en el precio: base = total / (1 + ISV + Turismo)
  const rate = (h.tax_isv + h.tax_tourism) / 100;
  const baseAmt = rate ? tot[0].t / (1 + rate) : tot[0].t;
  const taxes = rate ? {
    isv_pct: h.tax_isv, tourism_pct: h.tax_tourism,
    base: Math.round(baseAmt * 100) / 100,
    isv: Math.round(baseAmt * (h.tax_isv / 100) * 100) / 100,
    tourism: Math.round(baseAmt * (h.tax_tourism / 100) * 100) / 100,
  } : null;
  const byCompany = (await env.DB.prepare(
    `SELECT s.company AS k, COUNT(*) AS n, COALESCE(SUM(s.amount),0) AS t, COALESCE(SUM(s.nights),0) AS nights
       FROM sales s WHERE s.hotel_id = ? AND s.voided_at IS NULL AND s.kind <> 'abono' AND s.company IS NOT NULL AND s.local_date BETWEEN ? AND ?
      GROUP BY s.company ORDER BY t DESC`,
  ).bind(hotelId, from, to).all()).results;
  return {
    hotel_id: hotelId, from, to, total: tot[0].t, count: tot[0].n, nights: tot[0].nights,
    avg_day: tot[0].t / days,
    occupancy_nights_pct: rooms.n ? Math.round((tot[0].nights / (rooms.n * days)) * 100) : 0,
    by_day: byDay, by_pay: byPay, by_kind: byKind, by_user: byUser,
    avg_night_sold: lodgingSold[0].nights ? lodgingSold[0].t / lodgingSold[0].nights : 0,
    pending_created: pendingNew[0], pending_balance: pendingNow.t, pending_count: pendingNow.n,
    taxes, by_company: byCompany,
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
      `SELECT COALESCE(SUM(amount),0) AS t FROM sales WHERE hotel_id = ? AND voided_at IS NULL AND ${CASH} AND local_date BETWEEN ? AND ?`,
    ).bind(h.id, prevFrom, prevTo).first();
    out.push({
      id: h.id, name: h.name,
      total: cur.total, count: cur.count, nights: cur.nights,
      prev_total: prev.t,
      delta_pct: prev.t ? Math.round(((cur.total - prev.t) / prev.t) * 100) : null,
      avg_night: cur.avg_night_sold,
      pending_balance: cur.pending_balance, pending_count: cur.pending_count, taxes: cur.taxes, by_company: cur.by_company,
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

