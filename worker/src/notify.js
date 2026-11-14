// Avisos: se guardan en la base de datos y se envían por push (y Telegram si está configurado).
// El push va sin contenido cifrado: despierta al teléfono y la app pide el texto a la API.
// Así no hace falta cifrar el mensaje y no se exponen datos en servidores de terceros.
import { b64u, enc } from './util.js';

/** Usuarios activos de un hotel con alguno de los roles dados (el dueño se incluye si includeOwner). */
export async function usersWithRole(env, hotelId, roles, includeOwner = false) {
  const ph = roles.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT u.id, u.telegram_chat_id FROM users u
       LEFT JOIN memberships m ON m.user_id = u.id
      WHERE u.active = 1 AND ((m.hotel_id = ? AND (m.role IN (${ph}) OR m.role = 'admin'))${includeOwner ? ' OR u.is_owner = 1' : ''})`,
  ).bind(hotelId, ...roles).all();
  return results;
}

export async function notify(env, users, { title, body, url = '#/' }) {
  if (!users.length) return 0;
  const now = Date.now();
  for (const u of users) {
    await env.DB.prepare('INSERT INTO notifications (user_id, title, body, url, created_at) VALUES (?,?,?,?,?)')
      .bind(u.id, title, body, url, now).run();
  }
  const ids = users.map((u) => u.id);
  const { results: subs } = await env.DB.prepare(
    `SELECT endpoint FROM push_subs WHERE user_id IN (${ids.map(() => '?').join(',')})`,
  ).bind(...ids).all();
  await Promise.all(subs.map((s) => sendPush(env, s.endpoint)));
  await Promise.all(users.filter((u) => u.telegram_chat_id).map((u) => sendTelegram(env, u.telegram_chat_id, `*${title}*\n${body}`)));
  return users.length;
}

// ---------------- Web Push (VAPID, RFC 8292) ----------------

let vapidKey = null;
async function getVapidKey(env) {
  if (vapidKey) return vapidKey;
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  vapidKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return vapidKey;
}

async function vapidJwt(env, audience) {
  const header = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64u(enc(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'mailto:admin@example.com',
  })));
  const data = enc(`${header}.${payload}`);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await getVapidKey(env), data);
  return `${header}.${payload}.${b64u(sig)}`;
}

export async function sendPush(env, endpoint) {
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC_KEY) return false;
  try {
    const aud = new URL(endpoint).origin;
    const jwt = await vapidJwt(env, aud);
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
        ttl: '86400',
        urgency: 'high',
        'content-length': '0',
      },
    });
    if (r.status === 404 || r.status === 410) {
      await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(endpoint).run();
    }
    return r.ok;
  } catch (e) {
    console.error('push', e);
    return false;
  }
}

// ---------------- Telegram (opcional) ----------------

export async function sendTelegram(env, chatId, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    return r.ok;
  } catch { return false; }
}

