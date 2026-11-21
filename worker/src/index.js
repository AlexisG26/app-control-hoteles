// Control de Hoteles · API (Cloudflare Worker)
import { HttpError, json, body, bad, notFound, randomToken, hashToken, localDate, cleanStr } from './util.js';
import {
  requireUser, createSession, sendLoginCode, verifyLoginCode, createAccessCode, requireOwner, hotelsOf, rolesIn, ROLES,
  passkeyRegisterOptions, passkeyRegister, passkeyLoginOptions, passkeyLogin,
} from './auth.js';
import {
  hotelConfig, pastStay, listRooms, checkIn, extendStay, editStay, cancelStay, changeSalePay, setSaleUsd, setFxRate, latestFx, checkOut, cleanStart, cleanFinish, markDirty, reportIssue, listIssues, resolveIssue, issuePhoto,
  addExtraSale, listSales, voidSale, poUpdate, pendingPOs, listPending, payPending, saleProof, PAY_NOW, overview, financeReport, compareFinance, getHotel, audit, PAY,
} from './ops.js';
import { runScheduled } from './cron.js';
import { listHistory, historyDetail } from './history.js';
import { handleMcp } from './mcp.js';
import { notify } from './notify.js';

function cors(req, env) {
  const origin = req.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim());
  const h = {
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (allowed.includes(origin)) h['access-control-allow-origin'] = origin;
  return h;
}

async function allHotels(env) {
  return (await env.DB.prepare('SELECT * FROM hotels ORDER BY name').all()).results;
}

// Pequeño enrutador: [método, patrón, manejador]
const routes = [];
const on = (method, pattern, fn) => routes.push([method, new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn]);

// ---------- Autenticación ----------
on('POST', '/api/auth/code', async ({ req, env }) => json(await sendLoginCode(env, (await body(req)).email)));
on('POST', '/api/auth/verify', async ({ req, env }) => {
  const b = await body(req);
  const uid = await verifyLoginCode(env, b.email, b.code);
  return json({ token: await createSession(env, uid) });
});
on('POST', '/api/auth/passkey/login-options', async ({ env }) => json(await passkeyLoginOptions(env)));
on('POST', '/api/auth/passkey/login', async ({ req, env }) => {
  const uid = await passkeyLogin(env, await body(req));
  return json({ token: await createSession(env, uid) });
});
on('POST', '/api/auth/passkey/register-options', async ({ env, user }) => json(await passkeyRegisterOptions(env, user)));
on('POST', '/api/auth/passkey/register', async ({ req, env, user }) => json(await passkeyRegister(env, user, await body(req))));
on('GET', '/api/auth/passkeys', async ({ env, user }) => json((await env.DB.prepare('SELECT id, label, created_at, last_used_at FROM passkeys WHERE user_id = ?').bind(user.id).all()).results));
on('DELETE', '/api/auth/passkeys/:id', async ({ env, user, p }) => {
  await env.DB.prepare('DELETE FROM passkeys WHERE id = ? AND user_id = ?').bind(decodeURIComponent(p.id), user.id).run();
  return json({ ok: true });
});
on('POST', '/api/auth/logout', async ({ env, user }) => {
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(user.sessionHash).run();
  return json({ ok: true });
});

// ---------- Usuario y hoteles ----------
on('GET', '/api/me', async ({ env, user }) => {
  const hotels = hotelsOf(user, await allHotels(env)).map((h) => {
    const roles = rolesIn(user, h.id);
    const cfg = hotelConfig(h);
    // Las tarifas de empresas de crédito solo las ve contabilidad
    if (!roles.includes('contabilidad')) cfg.company_rates = Object.fromEntries(Object.keys(cfg.company_rates).map((k) => [k, null]));
    const { company_rates: _raw, ...rest } = h;
    return { ...rest, ...cfg, roles };
  });
  return json({
    user: { id: user.id, email: user.email, name: user.name, is_owner: !!user.is_owner },
    hotels, pay: PAY, pay_now: PAY_NOW, today: localDate(env),
    vapidPublicKey: env.VAPID_PUBLIC_KEY || null,
  });
});
on('GET', '/api/overview', async ({ env, user }) => json(await overview(env, user, hotelsOf(user, await allHotels(env)))));
on('GET', '/api/finance/compare', async ({ env, user, url }) => json(await compareFinance(env, user, hotelsOf(user, await allHotels(env)), url.searchParams.get('from'), url.searchParams.get('to'))));

// ---------- Habitaciones y estadías ----------
on('GET', '/api/hotels/:hotel/rooms', async ({ env, user, p }) => json(await listRooms(env, user, p.hotel)));
on('POST', '/api/hotels/:hotel/checkin', async ({ req, env, user, p }) => json(await checkIn(env, user, p.hotel, await body(req))));
on('POST', '/api/hotels/:hotel/past-stay', async ({ req, env, user, p }) => json(await pastStay(env, user, p.hotel, await body(req))));
on('POST', '/api/stays/:id/cancel', async ({ req, env, user, p }) => json(await cancelStay(env, user, p.id, await body(req))));
on('PATCH', '/api/stays/:id', async ({ req, env, user, p }) => json(await editStay(env, user, p.id, await body(req))));
on('POST', '/api/sales/:id/usd', async ({ req, env, user, p }) => json(await setSaleUsd(env, user, p.id, await body(req))));
on('POST', '/api/fx', async ({ req, env, user }) => json(await setFxRate(env, user, await body(req))));
on('GET', '/api/fx', async ({ env }) => json(await latestFx(env)));
on('PATCH', '/api/sales/:id', async ({ req, env, user, p }) => json(await changeSalePay(env, user, p.id, await body(req))));
on('POST', '/api/stays/:id/extend', async ({ req, env, user, p }) => json(await extendStay(env, user, p.id, await body(req))));
on('POST', '/api/stays/:id/checkout', async ({ env, user, p }) => json(await checkOut(env, user, p.id, 'manual')));
on('POST', '/api/rooms/:id/clean/start', async ({ env, user, p }) => json(await cleanStart(env, user, p.id)));
on('POST', '/api/rooms/:id/dirty', async ({ env, user, p }) => json(await markDirty(env, user, p.id)));
on('POST', '/api/rooms/:id/clean/finish', async ({ env, user, p }) => json(await cleanFinish(env, user, p.id)));

// ---------- Incidencias ----------
on('POST', '/api/rooms/:id/issues', async ({ req, env, user, p }) => {
  const ct = req.headers.get('content-type') || '';
  let data;
  if (ct.includes('multipart/form-data')) {
    const f = await req.formData();
    data = { description: f.get('description'), blocks: f.get('blocks') === '1', photo: f.get('photo') };
  } else {
    const b = await body(req);
    data = { description: b.description, blocks: !!b.blocks };
  }
  return json(await reportIssue(env, user, p.id, data));
});
on('GET', '/api/hotels/:hotel/issues', async ({ env, user, p, url }) => json(await listIssues(env, user, p.hotel, url.searchParams.get('estado') || 'abierta')));
on('POST', '/api/issues/:id/resolve', async ({ req, env, user, p }) => json(await resolveIssue(env, user, p.id, await body(req))));
on('GET', '/api/issues/:id/photo', async ({ env, user, p }) => issuePhoto(env, user, p.id));

// ---------- Ventas y contabilidad ----------
on('POST', '/api/hotels/:hotel/sales', async ({ req, env, user, p }) => json(await addExtraSale(env, user, p.hotel, await body(req))));
on('GET', '/api/hotels/:hotel/sales', async ({ env, user, p, url }) => json(await listSales(env, user, p.hotel, url.searchParams.get('from'), url.searchParams.get('to'))));
on('POST', '/api/sales/:id/void', async ({ req, env, user, p }) => json(await voidSale(env, user, p.id, await body(req))));
on('GET', '/api/hotels/:hotel/pending', async ({ env, user, p }) => json(await listPending(env, user, p.hotel)));
on('POST', '/api/sales/:id/payments', async ({ req, env, user, p }) => {
  const ct = req.headers.get('content-type') || '';
  let d;
  if (ct.includes('multipart/form-data')) {
    const f = await req.formData();
    d = { pay: f.get('pay'), nights: f.get('nights'), amount: f.get('amount'), photo: f.get('photo') };
  } else d = await body(req);
  return json(await payPending(env, user, p.id, d));
});
on('GET', '/api/sales/:id/proof', async ({ env, user, p }) => saleProof(env, user, p.id));
on('POST', '/api/sales/:id/po', async ({ req, env, user, p }) => json(await poUpdate(env, user, p.id, await body(req))));
on('GET', '/api/hotels/:hotel/po', async ({ env, user, p }) => {
  if (!rolesIn(user, p.hotel).includes('contabilidad')) throw new HttpError(403, 'No tienes permiso para esta acción.');
  return json(await pendingPOs(env, p.hotel));
});
on('GET', '/api/hotels/:hotel/finance', async ({ env, user, p, url }) => json(await financeReport(env, user, p.hotel, url.searchParams.get('from'), url.searchParams.get('to'))));

// ---------- Avisos ----------
on('POST', '/api/push/subscribe', async ({ req, env, user }) => {
  const b = await body(req);
  const endpoint = String(b.endpoint || '');
  if (!/^https:\/\//.test(endpoint)) throw bad('Suscripción inválida.');
  await env.DB.prepare(`INSERT INTO push_subs (endpoint, user_id, created_at) VALUES (?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id`).bind(endpoint, user.id, Date.now()).run();
  return json({ ok: true });
});
on('POST', '/api/push/unsubscribe', async ({ req, env, user }) => {
  await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?').bind(String((await body(req)).endpoint || ''), user.id).run();
  return json({ ok: true });
});
// El service worker pregunta por el texto del aviso usando su propia suscripción como llave.
on('POST', '/api/push/pending', async ({ req, env }) => {
  const sub = await env.DB.prepare('SELECT user_id FROM push_subs WHERE endpoint = ?').bind(String((await body(req)).endpoint || '')).first();
  if (!sub) return json([]);
  const { results } = await env.DB.prepare(
    'SELECT id, title, body, url FROM notifications WHERE user_id = ? AND delivered_at IS NULL AND created_at > ? ORDER BY id DESC LIMIT 5',
  ).bind(sub.user_id, Date.now() - 2 * 86400000).all();
  if (results.length) await env.DB.prepare(`UPDATE notifications SET delivered_at = ? WHERE id IN (${results.map(() => '?').join(',')})`).bind(Date.now(), ...results.map((r) => r.id)).run();
  return json(results);
});
on('GET', '/api/notifications', async ({ env, user }) => json((await env.DB.prepare(
  'SELECT id, title, body, url, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50',
).bind(user.id).all()).results));
on('POST', '/api/notifications/read', async ({ env, user }) => {
  await env.DB.prepare('UPDATE notifications SET read_at = ?, delivered_at = COALESCE(delivered_at, ?) WHERE user_id = ? AND read_at IS NULL').bind(Date.now(), Date.now(), user.id).run();
  return json({ ok: true });
});
on('POST', '/api/notifications/test', async ({ env, user }) => {
  await notify(env, [user], { title: 'Prueba de avisos', body: 'Si ves esto, los avisos funcionan en este dispositivo.', url: '#/ajustes' });
  return json({ ok: true });
});

// ---------- Historial de reservas (solo gerencia) ----------
on('GET', '/api/history', async ({ env, user, url }) => json(await listHistory(env, user, url.searchParams)));
on('GET', '/api/history/:id', async ({ env, user, p }) => json(await historyDetail(env, user, p.id)));

// ---------- Usuarios (solo el dueño) ----------
on('GET', '/api/users', async ({ env, user }) => {
  requireOwner(user);
  const { results: users } = await env.DB.prepare('SELECT id, email, name, is_owner, active, telegram_chat_id, created_at FROM users WHERE deleted_at IS NULL ORDER BY active DESC, name').all();
  const { results: ms } = await env.DB.prepare('SELECT * FROM memberships').all();
  return json(users.map((u) => ({ ...u, memberships: ms.filter((m) => m.user_id === u.id) })));
});
on('POST', '/api/users', async ({ req, env, user }) => {
  requireOwner(user);
  const b = await body(req);
  const email = String(b.email || '').trim().toLowerCase();
  const name = cleanStr(b.name, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Escribe un correo válido.');
  if (!name) throw bad('Escribe el nombre.');
  if (await env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) throw bad('Ya existe un usuario con ese correo.');
  const r = await env.DB.prepare('INSERT INTO users (email, name, is_owner, active, created_at) VALUES (?,?,0,1,?)').bind(email, name, Date.now()).run();
  await setMemberships(env, r.meta.last_row_id, b.memberships);
  await audit(env, user, 'usuario_creado', 'user', r.meta.last_row_id, { email });
  return json({ ok: true, id: r.meta.last_row_id });
});
on('PATCH', '/api/users/:id', async ({ req, env, user, p }) => {
  requireOwner(user);
  const b = await body(req);
  const id = Number(p.id);
  const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!target) throw notFound();
  if (b.name !== undefined) await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(cleanStr(b.name, 80) || target.name, id).run();
  if (b.telegram_chat_id !== undefined) await env.DB.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').bind(cleanStr(b.telegram_chat_id, 40) || null, id).run();
  if (b.active !== undefined) {
    if (target.is_owner) throw bad('No puedes desactivar al dueño.');
    await env.DB.prepare('UPDATE users SET active = ? WHERE id = ?').bind(b.active ? 1 : 0, id).run();
    if (!b.active) await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  }
  if (b.memberships !== undefined) await setMemberships(env, id, b.memberships);
  await audit(env, user, 'usuario_editado', 'user', id, b);
  return json({ ok: true });
});

async function setMemberships(env, userId, list) {
  const hotels = new Set((await allHotels(env)).map((h) => h.id));
  await env.DB.prepare('DELETE FROM memberships WHERE user_id = ?').bind(userId).run();
  for (const m of Array.isArray(list) ? list : []) {
    if (!hotels.has(m.hotel_id) || !ROLES.includes(m.role)) continue;
    await env.DB.prepare('INSERT OR IGNORE INTO memberships (user_id, hotel_id, role) VALUES (?,?,?)').bind(userId, m.hotel_id, m.role).run();
  }
}

on('DELETE', '/api/users/:id', async ({ env, user, p }) => {
  requireOwner(user);
  const id = Number(p.id);
  const target = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!target) throw notFound('Usuario no encontrado.');
  if (target.id === user.id) throw bad('No puedes eliminar tu propio usuario.');
  if (target.is_owner) throw bad('Este usuario es de gerencia. Para quitarlo, sácalo de OWNER_EMAIL en GitHub y luego elimínalo aquí.');
  // Se conserva el nombre para el historial; se libera el correo y se cierran todos sus accesos.
  const now = Date.now();
  await env.DB.prepare('UPDATE users SET deleted_at = ?, active = 0, email = ? WHERE id = ?').bind(now, `eliminado-${id}-${now}@borrado.local`, id).run();
  for (const sql of ['DELETE FROM memberships WHERE user_id = ?', 'DELETE FROM sessions WHERE user_id = ?', 'DELETE FROM passkeys WHERE user_id = ?', 'DELETE FROM push_subs WHERE user_id = ?', 'DELETE FROM api_tokens WHERE user_id = ?']) {
    await env.DB.prepare(sql).bind(id).run();
  }
  await env.DB.prepare('DELETE FROM email_codes WHERE email = ?').bind(target.email).run();
  await audit(env, user, 'usuario_eliminado', 'user', id, { email: target.email, name: target.name });
  return json({ ok: true });
});

on('POST', '/api/users/:id/access-code', async ({ env, user, p }) => {
  requireOwner(user);
  const r = await createAccessCode(env, p.id);
  await audit(env, user, 'codigo_acceso', 'user', p.id);
  return json(r);
});

// ---------- Hoteles (ajustes, solo el dueño) ----------
on('PATCH', '/api/hotels/:hotel', async ({ req, env, user, p }) => {
  requireOwner(user);
  const h = await getHotel(env, p.hotel);
  const b = await body(req);
  const time = /^\d{2}:\d{2}$/.test(b.checkout_time || '') ? b.checkout_time : h.checkout_time;
  const rate = Number.isFinite(Number(b.default_rate)) && Number(b.default_rate) >= 0 ? Number(b.default_rate) : h.default_rate;
  let rates = h.rates;
  if (b.rates && typeof b.rates === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(b.rates)) { const name = cleanStr(k, 30); const n = v === null || v === '' ? null : Number(v); if (name && (n === null || (Number.isFinite(n) && n >= 0))) clean[name] = n === null ? null : Math.round(n * 100) / 100; }
    rates = JSON.stringify(clean);
  }
  let companyRates = h.company_rates;
  if (b.company_rates && typeof b.company_rates === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(b.company_rates)) { const n = Number(v); const name = cleanStr(k, 30); if (name && Number.isFinite(n) && n >= 0) clean[name] = Math.round(n * 100) / 100; }
    companyRates = JSON.stringify(clean);
  }
  let companies = h.companies;
  if (Array.isArray(b.companies)) companies = JSON.stringify(b.companies.map((c) => cleanStr(c, 80)).filter(Boolean).slice(0, 50));
  const pct = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 50 ? Number(v) : d);
  const cleaning = typeof b.cleaning === 'boolean' ? (b.cleaning ? 1 : 0) : h.cleaning;
  await env.DB.prepare('UPDATE hotels SET checkout_time = ?, default_rate = ?, rates = ?, company_rates = ?, companies = ?, tax_isv = ?, tax_tourism = ?, cleaning = ? WHERE id = ?')
    .bind(time, rate, rates, companyRates, companies, pct(b.tax_isv, h.tax_isv), pct(b.tax_tourism, h.tax_tourism), cleaning, h.id).run();
  if (!cleaning && h.cleaning) {
    await env.DB.prepare("UPDATE rooms SET status = 'libre' WHERE hotel_id = ? AND status IN ('por_limpiar','limpiando')").bind(h.id).run();
    await env.DB.prepare('UPDATE cleanings SET finished_at = ? WHERE hotel_id = ? AND finished_at IS NULL').bind(Date.now(), h.id).run();
  }
  await audit(env, user, 'hotel_editado', 'hotel', h.id, { checkout_time: time, default_rate: rate, rates, companies });
  return json({ ok: true });
});

// ---------- Tokens para el servidor MCP (solo el dueño) ----------
on('GET', '/api/tokens', async ({ env, user }) => {
  requireOwner(user);
  return json((await env.DB.prepare('SELECT substr(token_hash,1,8) AS id, label, created_at, last_used_at FROM api_tokens WHERE user_id = ?').bind(user.id).all()).results);
});
on('POST', '/api/tokens', async ({ req, env, user }) => {
  requireOwner(user);
  const token = 'ch_' + randomToken(24);
  await env.DB.prepare('INSERT INTO api_tokens (token_hash, user_id, label, created_at) VALUES (?,?,?,?)')
    .bind(await hashToken(token, env.AUTH_PEPPER), user.id, cleanStr((await body(req)).label, 60) || 'Claude', Date.now()).run();
  return json({ token });
});
on('DELETE', '/api/tokens/:id', async ({ env, user, p }) => {
  requireOwner(user);
  await env.DB.prepare('DELETE FROM api_tokens WHERE user_id = ? AND substr(token_hash,1,8) = ?').bind(user.id, p.id).run();
  return json({ ok: true });
});

on('GET', '/api/health', async ({ env }) => json({ ok: true, date: localDate(env) }));


export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const ch = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });

    // MCP: /mcp (token en Authorization) o /mcp/<token>
    const mcp = url.pathname.match(/^\/mcp(?:\/([\w-]+))?\/?$/);
    if (mcp) return handleMcp(req, env, mcp[1], await allHotels(env));

    let res;
    try {
      res = await route(req, env, url);
    } catch (e) {
      if (e instanceof HttpError) res = json({ error: e.message }, e.status);
      else { console.error(e); res = json({ error: 'Ocurrió un error inesperado. Inténtalo de nuevo.' }, 500); }
    }
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(ch)) h.set(k, v);
    h.set('x-content-type-options', 'nosniff');
    return new Response(res.body, { status: res.status, headers: h });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(env).then((r) => console.log('cron', JSON.stringify(r))));
  },
};

const PUBLIC = new Set(['/api/auth/code', '/api/auth/verify', '/api/auth/passkey/login-options', '/api/auth/passkey/login', '/api/push/pending', '/api/health']);

async function route(req, env, url) {
  for (const [method, re, fn] of routes) {
    if (method !== req.method) continue;
    const m = url.pathname.match(re);
    if (!m) continue;
    const user = PUBLIC.has(url.pathname) ? null : await requireUser(req, env);
    return fn({ req, env, url, user, p: m.groups || {} });
  }
  throw notFound('Ruta no encontrada.');
}
