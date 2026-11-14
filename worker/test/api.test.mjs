// Prueba de punta a punta de la API con una base de datos en memoria.
// Ejecutar: node --experimental-sqlite --test test/api.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createD1 } from './d1-shim.mjs';
import worker from '../src/index.js';
import { runScheduled } from '../src/cron.js';
import { localDate, localToUtc, addDays, b64u, enc } from '../src/util.js';

const ORIGIN = 'https://dueno.github.io';
const pushCalls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://push.example')) { pushCalls.push({ url, init }); return new Response(null, { status: 201 }); }
  return realFetch(url, init);
};

// Llaves VAPID de prueba
const vapid = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const vapidPub = b64u(await webcrypto.subtle.exportKey('raw', vapid.publicKey));

const env = {
  DB: createD1(new URL('../migrations/', import.meta.url)),
  ALLOWED_ORIGIN: ORIGIN, RP_ID: 'dueno.github.io', TZ_OFFSET_MIN: '-360', DEV_MODE: '1',
  OWNER_EMAIL: 'alexis@example.com, Socio@Example.com', OWNER_NAME: 'Alexis Gutiérrez', AUTH_PEPPER: 'test',
  VAPID_PUBLIC_KEY: vapidPub, VAPID_PRIVATE_JWK: JSON.stringify(await webcrypto.subtle.exportKey('jwk', vapid.privateKey)),
  VAPID_SUBJECT: 'mailto:alexis@example.com',
};
const ctx = { waitUntil() {} };
// Imitación de R2 para las fotos
const r2 = new Map();
env.PHOTOS = {
  async put(key, stream, opts) { r2.set(key, { data: new Uint8Array(await new Response(stream).arrayBuffer()), httpMetadata: opts?.httpMetadata }); },
  async get(key) { const o = r2.get(key); return o ? { body: o.data, httpMetadata: o.httpMetadata } : null; },
};
async function form(path, token, fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const res = await worker.fetch(new Request('https://api.test' + path, { method: 'POST', headers: { origin: ORIGIN, authorization: `Bearer ${token}` }, body: fd }), env, ctx);
  return { status: res.status, data: await res.json() };
}

async function api(method, path, { token, body } = {}) {
  const headers = { origin: ORIGIN };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await worker.fetch(new Request('https://api.test' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }), env, ctx);
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null, headers: res.headers };
}
async function login(email) {
  const c = await api('POST', '/api/auth/code', { body: { email } });
  assert.equal(c.status, 200, JSON.stringify(c.data));
  const v = await api('POST', '/api/auth/verify', { body: { email, code: c.data.devCode } });
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return v.data.token;
}

let owner, recep, limpia, conta;
const roomId = async (hotel, number) => (await env.DB.prepare('SELECT id FROM rooms WHERE hotel_id=? AND number=?').bind(hotel, number).first()).id;

test('el dueño entra con código por correo', async () => {
  owner = await login('alexis@example.com');
  const me = await api('GET', '/api/me', { token: owner });
  assert.equal(me.data.user.is_owner, true);
  assert.equal(me.data.hotels.length, 2);
  assert.equal(me.headers.get('access-control-allow-origin'), ORIGIN);
});

test('gerencia: un segundo correo de OWNER_EMAIL también entra como dueño', async () => {
  const t = await login('socio@example.com');
  const me = await api('GET', '/api/me', { token: t });
  assert.equal(me.data.user.is_owner, true);
  assert.equal(me.data.user.name, 'Gerencia');
  assert.equal(me.data.hotels.length, 2);
});

test('un correo no registrado no recibe código ni revela nada', async () => {
  const r = await api('POST', '/api/auth/code', { body: { email: 'nadie@example.com' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.devCode, undefined);
  const bad = await api('POST', '/api/auth/verify', { body: { email: 'nadie@example.com', code: '123456' } });
  assert.equal(bad.status, 400);
});

test('el dueño crea usuarios con roles por hotel', async () => {
  for (const [email, name, ms] of [
    ['rec@example.com', 'María Recepción', [{ hotel_id: 'prado', role: 'recepcion' }]],
    ['limp@example.com', 'Rosa Limpieza', [{ hotel_id: 'prado', role: 'limpieza' }]],
    ['conta@example.com', 'Carlos Contador', [{ hotel_id: 'prado', role: 'contabilidad' }, { hotel_id: 'prokinto', role: 'contabilidad' }]],
  ]) {
    const r = await api('POST', '/api/users', { token: owner, body: { email, name, memberships: ms } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  recep = await login('rec@example.com');
  limpia = await login('limp@example.com');
  conta = await login('conta@example.com');
  const me = await api('GET', '/api/me', { token: limpia });
  assert.deepEqual(me.data.hotels.map((h) => h.id), ['prado']);
  const deny = await api('POST', '/api/users', { token: recep, body: { email: 'x@y.com', name: 'X' } });
  assert.equal(deny.status, 403);
});

test('recepción registra entrada por noche; limpieza no ve el nombre del huésped', async () => {
  const r = await api('POST', '/api/hotels/prado/checkin', { token: recep, body: { room_id: await roomId('prado', '3'), guest: 'Ana Pérez', kind: 'noche', nights: 2, rate: 700, pay: 'Efectivo' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const expected = localToUtc(env, addDays(localDate(env), 2), '11:00');
  assert.equal(r.data.due_out_at, expected);
  const again = await api('POST', '/api/hotels/prado/checkin', { token: recep, body: { room_id: await roomId('prado', '3'), guest: 'Otro', kind: 'noche', nights: 1, pay: 'Efectivo' } });
  assert.equal(again.status, 400);
  const rooms = await api('GET', '/api/hotels/prado/rooms', { token: limpia });
  const r3 = rooms.data.find((x) => x.number === '3');
  assert.equal(r3.status, 'ocupada');
  assert.equal(r3.guest, 'Ocupada');
  const recRooms = await api('GET', '/api/hotels/prado/rooms', { token: recep });
  assert.equal(recRooms.data.find((x) => x.number === '3').guest, 'Ana Pérez');
  // Recepción de Prado no puede tocar ProKinto
  const other = await api('GET', '/api/hotels/prokinto/rooms', { token: recep });
  assert.equal(other.status, 403);
});

test('orden de compra solo en Prado Alto y con número obligatorio', async () => {
  const noNum = await api('POST', '/api/hotels/prado/sales', { token: recep, body: { concept: 'Empresa', amount: 1500, pay: 'Orden de compra' } });
  assert.equal(noNum.status, 400);
  const ok = await api('POST', '/api/hotels/prado/checkin', { token: recep, body: { room_id: await roomId('prado', '5'), guest: 'Empresa ABC', kind: 'noche', nights: 1, rate: 900, pay: 'Orden de compra', po: 'OC-77' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const pk = await api('POST', '/api/hotels/prokinto/sales', { token: owner, body: { concept: 'x', amount: 10, pay: 'Orden de compra', po: '1' } });
  assert.equal(pk.status, 400);
});

test('habitación por hora en Prado y aviso cuando vence', async () => {
  const r = await api('POST', '/api/hotels/prado/checkin', { token: recep, body: { room_id: await roomId('prado', '7'), guest: 'Cliente', kind: 'hora', hours: 3, amount: 350, pay: 'Efectivo' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const pk = await api('POST', '/api/hotels/prokinto/checkin', { token: owner, body: { room_id: await roomId('prokinto', '2C'), guest: 'X', kind: 'hora', hours: 1, amount: 100, pay: 'Efectivo' } });
  assert.equal(pk.status, 400);
  const out = await runScheduled(env, Date.now() + 4 * 3600000);
  assert.equal(out.hourly_alerts, 1);
  const st = await api('GET', '/api/hotels/prado/rooms', { token: recep });
  assert.equal(st.data.find((x) => x.number === '7').status, 'ocupada'); // la salida por hora es manual
});

test('limpieza se suscribe a avisos', async () => {
  const r = await api('POST', '/api/push/subscribe', { token: limpia, body: { endpoint: 'https://push.example/abc' } });
  assert.equal(r.status, 200);
  await api('POST', '/api/notifications/test', { token: limpia });
  assert.equal(pushCalls.length, 1);
  assert.match(pushCalls[0].init.headers.authorization, /^vapid t=.+\..+\..+, k=/);
  const pending = await api('POST', '/api/push/pending', { body: { endpoint: 'https://push.example/abc' } });
  assert.equal(pending.data[0].title, 'Prueba de avisos');
});

test('salida automática a las 11:00 pasa a "por limpiar" y avisa a limpieza', async () => {
  pushCalls.length = 0;
  const at = localToUtc(env, addDays(localDate(env), 2), '11:00') + 60000;
  const out = await runScheduled(env, at);
  assert.equal(out.auto_checkouts, 2); // hab. 3 (2 noches) y hab. 5 (1 noche, ya vencida)
  const rooms = await api('GET', '/api/hotels/prado/rooms', { token: limpia });
  assert.equal(rooms.data.find((x) => x.number === '3').status, 'por_limpiar');
  assert.ok(pushCalls.length >= 1);
  const pending = await api('POST', '/api/push/pending', { body: { endpoint: 'https://push.example/abc' } });
  assert.ok(pending.data.some((n) => /Habitación 3 por limpiar/.test(n.title)));
});

test('limpieza empieza y termina; recepción puede volver a ocuparla', async () => {
  const id = await roomId('prado', '3');
  assert.equal((await api('POST', `/api/rooms/${id}/clean/start`, { token: limpia })).status, 200);
  let r = await api('GET', '/api/hotels/prado/rooms', { token: recep });
  assert.equal(r.data.find((x) => x.number === '3').status, 'limpiando');
  assert.equal(r.data.find((x) => x.number === '3').cleaning_by, 'Rosa Limpieza');
  assert.equal((await api('POST', `/api/rooms/${id}/clean/finish`, { token: limpia })).status, 200);
  r = await api('GET', '/api/hotels/prado/rooms', { token: recep });
  assert.equal(r.data.find((x) => x.number === '3').status, 'libre');
  // limpieza no puede registrar entradas
  const deny = await api('POST', '/api/hotels/prado/checkin', { token: limpia, body: { room_id: id, guest: 'x', kind: 'noche', nights: 1, pay: 'Efectivo' } });
  assert.equal(deny.status, 403);
});

test('reportar un problema que bloquea la habitación y resolverlo', async () => {
  const id = await roomId('prado', '9');
  const r = await api('POST', `/api/rooms/${id}/issues`, { token: limpia, body: { description: 'Fuga en el lavamanos', blocks: true } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  let rooms = await api('GET', '/api/hotels/prado/rooms', { token: recep });
  assert.equal(rooms.data.find((x) => x.number === '9').status, 'bloqueada');
  const list = await api('GET', '/api/hotels/prado/issues', { token: recep });
  assert.equal(list.data[0].room, '9');
  await api('POST', `/api/issues/${r.data.id}/resolve`, { token: recep, body: { resolution: 'Cambiado el empaque' } });
  rooms = await api('GET', '/api/hotels/prado/rooms', { token: recep });
  assert.equal(rooms.data.find((x) => x.number === '9').status, 'libre');
});

test('recepción solo ve la caja de hoy; contabilidad ve todo y el estado financiero', async () => {
  const today = localDate(env);
  const own = await api('GET', `/api/hotels/prado/sales?from=${today}&to=${today}`, { token: recep });
  assert.equal(own.status, 200);
  assert.equal(own.data.length, 3);
  const week = await api('GET', `/api/hotels/prado/sales?from=${addDays(today, -6)}&to=${today}`, { token: recep });
  assert.equal(week.status, 403);
  const fin = await api('GET', `/api/hotels/prado/finance?from=${addDays(today, -6)}&to=${today}`, { token: conta });
  assert.equal(fin.status, 200);
  assert.equal(fin.data.total, 1400 + 900 + 350);
  assert.equal(fin.data.by_pay.find((x) => x.k === 'Orden de compra').t, 900);
  const ov = await api('GET', '/api/overview', { token: owner });
  assert.equal(ov.data.hotels.length, 2);
  assert.equal(ov.data.totals.today, 2650);
  // El panel global y el análisis comparado son solo para gerencia
  assert.equal((await api('GET', '/api/overview', { token: conta })).status, 403);
  const cmp = await api('GET', `/api/finance/compare?from=${addDays(today, -6)}&to=${today}`, { token: owner });
  assert.equal(cmp.status, 200);
  assert.equal(cmp.data.total, 2650);
  const pr = cmp.data.hotels.find((h) => h.id === 'prado');
  assert.equal(pr.share_pct, 100);
  assert.equal(pr.prev_total, 0);
  assert.equal(pr.delta_pct, null);
  assert.equal(pr.avg_night, (1400 + 900) / 3);
  assert.equal((await api('GET', `/api/finance/compare?from=${today}&to=${today}`, { token: conta })).status, 403);
});

test('anular requiere motivo y queda registrado', async () => {
  const today = localDate(env);
  const sales = await api('GET', `/api/hotels/prado/sales?from=${today}&to=${today}`, { token: recep });
  const s = sales.data.find((x) => x.kind === 'hora');
  assert.equal((await api('POST', `/api/sales/${s.id}/void`, { token: recep, body: {} })).status, 400);
  assert.equal((await api('POST', `/api/sales/${s.id}/void`, { token: recep, body: { reason: 'Cobro duplicado' } })).status, 200);
  const fin = await api('GET', `/api/hotels/prado/finance?from=${today}&to=${today}`, { token: conta });
  assert.equal(fin.data.total, 2300);
});

test('recordatorios de órdenes de compra a los 15 y 30 días', async () => {
  const { poReminders } = await import('../src/cron.js');
  await env.DB.prepare(`UPDATE sales SET local_date = ? WHERE pay = 'Orden de compra'`).bind(addDays(localDate(env), -16)).run();
  assert.equal(await poReminders(env), 1);
  assert.equal(await poReminders(env), 0); // no se repite
  const po = await api('GET', '/api/hotels/prado/po', { token: conta });
  assert.equal(po.data[0].estado, 'facturar');
  await env.DB.prepare(`UPDATE sales SET local_date = ? WHERE pay = 'Orden de compra'`).bind(addDays(localDate(env), -31)).run();
  assert.equal(await poReminders(env), 1);
  await api('POST', `/api/sales/${po.data[0].id}/po`, { token: conta, body: { action: 'cobrada' } });
  assert.equal((await api('GET', '/api/hotels/prado/po', { token: conta })).data.length, 0);
});

test('huella / Face ID: registrar y entrar con una llave de acceso', async () => {
  const opt = await api('POST', '/api/auth/passkey/register-options', { token: owner });
  assert.equal(opt.status, 200);
  const key = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const spki = b64u(await webcrypto.subtle.exportKey('spki', key.publicKey));
  const rpHash = new Uint8Array(await webcrypto.subtle.digest('SHA-256', enc('dueno.github.io')));
  const authData = (count) => { const a = new Uint8Array(37); a.set(rpHash); a[32] = 0x05; a[36] = count; return a; };
  const cd = (type, challenge) => b64u(enc(JSON.stringify({ type, challenge, origin: ORIGIN })));
  const reg = await api('POST', '/api/auth/passkey/register', { token: owner, body: {
    challengeId: opt.data.challengeId, id: 'cred1', clientDataJSON: cd('webauthn.create', opt.data.publicKey.challenge),
    authenticatorData: b64u(authData(0)), publicKey: spki, alg: -7,
  } });
  assert.equal(reg.status, 200, JSON.stringify(reg.data));

  const lo = await api('POST', '/api/auth/passkey/login-options', {});
  const ad = authData(1);
  const cdj = cd('webauthn.get', lo.data.publicKey.challenge);
  const hash = new Uint8Array(await webcrypto.subtle.digest('SHA-256', Buffer.from(cdj, 'base64url')));
  const signed = new Uint8Array([...ad, ...hash]);
  const raw = new Uint8Array(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key.privateKey, signed));
  // El autenticador real entrega la firma en DER
  const der = (b) => { let v = [...b]; while (v.length > 1 && v[0] === 0 && v[1] < 0x80) v.shift(); if (v[0] >= 0x80) v.unshift(0); return [0x02, v.length, ...v]; };
  const r = der(raw.slice(0, 32)), s = der(raw.slice(32));
  const sig = new Uint8Array([0x30, r.length + s.length, ...r, ...s]);
  const ok = await api('POST', '/api/auth/passkey/login', { body: {
    challengeId: lo.data.challengeId, id: 'cred1', clientDataJSON: cdj, authenticatorData: b64u(ad), signature: b64u(sig),
  } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const me = await api('GET', '/api/me', { token: ok.data.token });
  assert.equal(me.data.user.email, 'alexis@example.com');
  // La misma firma no sirve dos veces (desafío consumido)
  const replay = await api('POST', '/api/auth/passkey/login', { body: { challengeId: lo.data.challengeId, id: 'cred1', clientDataJSON: cdj, authenticatorData: b64u(ad), signature: b64u(sig) } });
  assert.equal(replay.status, 400);
});

test('servidor MCP con token del dueño', async () => {
  const t = await api('POST', '/api/tokens', { token: owner, body: { label: 'Claude' } });
  const call = async (path, msg, auth) => {
    const res = await worker.fetch(new Request('https://api.test' + path, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(msg),
    }), env, ctx);
    return { status: res.status, data: res.status === 202 ? null : await res.json() };
  };
  assert.equal((await call('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' })).status, 401);
  const init = await call(`/mcp/${t.data.token}`, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.data.result.serverInfo.name, 'control-hoteles');
  assert.equal((await call(`/mcp/${t.data.token}`, { jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
  const list = await call('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/list' }, `Bearer ${t.data.token}`);
  assert.ok(list.data.result.tools.length >= 5);
  const res = await call('/mcp', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'resumen_hoteles', arguments: {} } }, `Bearer ${t.data.token}`);
  const data = JSON.parse(res.data.result.content[0].text);
  assert.equal(data.hotels.length, 2);
  const fin = await call('/mcp', { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'estado_financiero', arguments: { hotel: 'prado' } } }, `Bearer ${t.data.token}`);
  assert.equal(JSON.parse(fin.data.result.content[0].text).hotel_id, 'prado');
});

test('pago pendiente: se cobra por noches con comprobante y no cuenta como ingreso hasta pagarse', async () => {
  const today = localDate(env);
  const before = (await api('GET', `/api/hotels/prokinto/finance?from=${today}&to=${today}`, { token: owner })).data.total;
  const r = await api('POST', '/api/hotels/prokinto/checkin', { token: owner, body: { room_id: await roomId('prokinto', '503'), guest: 'Pepsi · Felipe', kind: 'noche', nights: 5, rate: 500, pay: 'Pendiente' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  let fin = await api('GET', `/api/hotels/prokinto/finance?from=${today}&to=${today}`, { token: owner });
  assert.equal(fin.data.total, before, 'lo pendiente no es ingreso');
  assert.equal(fin.data.pending_balance, 2500);
  let pend = (await api('GET', '/api/hotels/prokinto/pending', { token: owner })).data;
  assert.equal(pend.length, 1);
  assert.equal(pend[0].balance, 2500);
  assert.equal(pend[0].nights_left, 5);
  const rooms = await api('GET', '/api/hotels/prokinto/rooms', { token: owner });
  assert.equal(rooms.data.find((x) => x.number === '503').pending_balance, 2500);
  const id = pend[0].id;

  // Transferencia sin foto: rechazada
  const noPhoto = await form(`/api/sales/${id}/payments`, owner, { pay: 'Transferencia', nights: '2' });
  assert.equal(noPhoto.status, 400);
  assert.match(noPhoto.data.error, /comprobante/);
  // Con foto: paga 2 de 5 noches
  const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], 'comprobante.jpg', { type: 'image/jpeg' });
  const p1 = await form(`/api/sales/${id}/payments`, owner, { pay: 'Transferencia', nights: '2', photo });
  assert.equal(p1.status, 200, JSON.stringify(p1.data));
  assert.equal(p1.data.balance, 1500);
  assert.equal(p1.data.nights_left, 3);
  // No se pueden pagar más noches de las que faltan
  assert.equal((await api('POST', `/api/sales/${id}/payments`, { token: owner, body: { pay: 'Efectivo', nights: 4 } })).status, 400);
  fin = await api('GET', `/api/hotels/prokinto/finance?from=${today}&to=${today}`, { token: owner });
  assert.equal(fin.data.total, before + 1000);
  assert.equal(fin.data.by_pay.find((x) => x.k === 'Transferencia').t >= 1000, true);
  pend = (await api('GET', '/api/hotels/prokinto/pending', { token: owner })).data;
  assert.equal(pend[0].payments.length, 1);
  assert.equal(pend[0].payments[0].has_proof, 1);
  // El comprobante se puede ver
  const proof = await worker.fetch(new Request(`https://api.test/api/sales/${p1.data.id}/proof`, { headers: { origin: ORIGIN, authorization: `Bearer ${owner}` } }), env, ctx);
  assert.equal(proof.status, 200);
  assert.equal(proof.headers.get('content-type'), 'image/jpeg');
  // La cuenta con pagos no se puede anular; el pago sí, y devuelve el saldo
  assert.equal((await api('POST', `/api/sales/${id}/void`, { token: owner, body: { reason: 'x' } })).status, 400);
  assert.equal((await api('POST', `/api/sales/${p1.data.id}/void`, { token: owner, body: { reason: 'Comprobante equivocado' } })).status, 200);
  pend = (await api('GET', '/api/hotels/prokinto/pending', { token: owner })).data;
  assert.equal(pend[0].balance, 2500);
  assert.equal(pend[0].nights_left, 5);
  // Paga todo en efectivo: queda saldada y sale de la lista
  const p2 = await api('POST', `/api/sales/${id}/payments`, { token: owner, body: { pay: 'Efectivo', nights: 5 } });
  assert.equal(p2.data.settled, true);
  assert.equal((await api('GET', '/api/hotels/prokinto/pending', { token: owner })).data.length, 0);
  // Orden de compra sigue siendo solo de Prado Alto
  assert.equal((await api('POST', '/api/hotels/prokinto/sales', { token: owner, body: { concept: 'x', amount: 10, pay: 'Orden de compra', po: '1' } })).status, 400);
});

test('tarifas por tipo, empresa de crédito e impuestos incluidos', async () => {
  const me = await api('GET', '/api/me', { token: owner });
  const prado = me.data.hotels.find((h) => h.id === 'prado');
  assert.deepEqual(prado.company_rates, { Sencilla: 1400, Doble: 1700, Triple: 2000 });
  assert.deepEqual(prado.rates, { Sencilla: null, Doble: null, Triple: null });
  assert.ok(prado.companies.includes('Emsula'));
  // Sin precio escrito: toma la tarifa del tipo
  const r = await api('POST', '/api/hotels/prado/checkin', { token: owner, body: { room_id: await roomId('prado', '12'), guest: 'Nelson Alemán', company: 'Emsula', room_type: 'Triple', kind: 'noche', nights: 2, pay: 'Pendiente' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const pend = (await api('GET', '/api/hotels/prado/pending', { token: owner })).data.find((x) => x.room === '12');
  assert.equal(pend.amount, 4000);
  assert.equal(pend.company, 'Emsula');
  assert.match(pend.concept, /Emsula/);
  const rooms = (await api('GET', '/api/hotels/prado/rooms', { token: owner })).data;
  assert.equal(rooms.find((x) => x.number === '12').room_type, 'Triple');
  // Cliente normal (sin empresa): la tarifa de empresa NO aplica; sin tarifa de clientes usa el precio escrito
  const cli = await api('POST', '/api/hotels/prado/checkin', { token: owner, body: { room_id: await roomId('prado', '13'), guest: 'Elvia Paz', room_type: 'Doble', kind: 'noche', nights: 1, rate: 1550, pay: 'Efectivo' } });
  assert.equal(cli.status, 200);
  const sales13 = (await api('GET', `/api/hotels/prado/sales?from=${localDate(env)}&to=${localDate(env)}`, { token: owner })).data.find((x) => x.room === '13');
  assert.equal(sales13.amount, 1550);
  // Recepción no ve precios de empresas de crédito, ni puede cambiarlos
  const rmeAll = (await api('GET', '/api/me', { token: limpia })).data; // limpieza no tiene contabilidad
  assert.equal(rmeAll.hotels.find((h) => h.id === 'prado').company_rates.Triple, null);
  const recU = await api('POST', '/api/users', { token: owner, body: { email: 'rec2@example.com', name: 'Recep Dos', memberships: [{ hotel_id: 'prado', role: 'recepcion' }] } });
  assert.equal(recU.status, 200);
  const rec2 = await login('rec2@example.com');
  assert.equal((await api('GET', '/api/me', { token: rec2 })).data.hotels[0].company_rates.Sencilla, null);
  const chk = await api('POST', '/api/hotels/prado/checkin', { token: rec2, body: { room_id: await roomId('prado', '14'), guest: 'Felipe', company: 'Pepsi', room_type: 'Sencilla', kind: 'noche', nights: 1, rate: 1, pay: 'Pendiente' } });
  assert.equal(chk.status, 200);
  const p14 = (await api('GET', '/api/hotels/prado/pending', { token: owner })).data.find((x) => x.room === '14');
  assert.equal(p14.amount, 1400, 'se aplica la tarifa de empresa aunque recepción mande otro precio');
  assert.equal((await api('GET', '/api/hotels/prado/pending', { token: rec2 })).data.some((x) => x.company), false);
  const r14 = (await api('GET', '/api/hotels/prado/rooms', { token: rec2 })).data.find((x) => x.number === '14');
  assert.equal(r14.rate, null);
  assert.equal(r14.pending_balance, 0);
  const caja = (await api('GET', `/api/hotels/prado/sales?from=${localDate(env)}&to=${localDate(env)}`, { token: rec2 })).data;
  assert.equal(caja.some((x) => x.company === 'Pepsi' || x.company === 'Emsula'), false);
  // Impuestos: el total recibido ya incluye ISV 15% y Turismo 4%
  const today = localDate(env);
  await api('POST', `/api/sales/${pend.id}/payments`, { token: owner, body: { pay: 'Efectivo', nights: 2 } });
  const fin = (await api('GET', `/api/hotels/prado/finance?from=${today}&to=${today}`, { token: owner })).data;
  assert.equal(fin.taxes.isv_pct, 15);
  assert.equal(Math.round(fin.taxes.base + fin.taxes.isv + fin.taxes.tourism), Math.round(fin.total));
  assert.equal(fin.by_company.find((c) => c.k === 'Emsula').t, 4000);
  // El dueño puede cambiar las tarifas
  await api('PATCH', '/api/hotels/prado', { token: owner, body: { rates: { Sencilla: 1300, Doble: 1550, Triple: null }, company_rates: { Sencilla: 1450, Doble: 1700, Triple: 2000 } } });
  const ph = (await api('GET', '/api/me', { token: owner })).data.hotels.find((h) => h.id === 'prado');
  assert.equal(ph.company_rates.Sencilla, 1450);
  assert.equal(ph.rates.Doble, 1550);
  assert.equal(ph.rates.Triple, null);
});

test('desactivar un usuario cierra sus sesiones', async () => {
  const u = (await api('GET', '/api/users', { token: owner })).data.find((x) => x.email === 'rec@example.com');
  await api('PATCH', `/api/users/${u.id}`, { token: owner, body: { active: false } });
  assert.equal((await api('GET', '/api/me', { token: recep })).status, 401);
});
