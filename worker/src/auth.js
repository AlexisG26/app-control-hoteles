// Sesiones, roles, códigos por correo y llaves de acceso (huella / Face ID).
import {
  HttpError, bad, forbidden, b64u, unb64u, enc, sha256, hashToken, randomToken, randomCode, timingSafeEqual,
} from './util.js';

const SESSION_DAYS = 30;
const CODE_MINUTES = 10;

export const ROLES = ['admin', 'contabilidad', 'recepcion', 'limpieza', 'mantenimiento'];
export const ROLE_LABEL = {
  admin: 'Administración', contabilidad: 'Contabilidad', recepcion: 'Recepción',
  limpieza: 'Limpieza', mantenimiento: 'Mantenimiento',
};

// ---------------- Usuario actual ----------------

export async function loadUser(env, userId) {
  const user = await env.DB.prepare('SELECT id, email, name, is_owner, active, telegram_chat_id FROM users WHERE id = ?')
    .bind(userId).first();
  if (!user || !user.active) return null;
  const { results } = await env.DB.prepare('SELECT hotel_id, role FROM memberships WHERE user_id = ?').bind(userId).all();
  user.memberships = results;
  return user;
}

/** Devuelve el usuario de la sesión (Authorization: Bearer <token>) o lanza 401. */
export async function requireUser(req, env) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Inicia sesión para continuar.');
  const th = await hashToken(token, env.AUTH_PEPPER);
  const s = await env.DB.prepare('SELECT user_id, expires_at, last_seen_at FROM sessions WHERE token_hash = ?').bind(th).first();
  if (!s || s.expires_at < Date.now()) throw new HttpError(401, 'Tu sesión venció. Vuelve a entrar.');
  const user = await loadUser(env, s.user_id);
  if (!user) throw new HttpError(401, 'Tu usuario está desactivado.');
  // Renovar la sesión como máximo una vez por hora.
  if (!s.last_seen_at || Date.now() - s.last_seen_at > 3600000) {
    await env.DB.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?')
      .bind(Date.now(), Date.now() + SESSION_DAYS * 86400000, th).run();
  }
  user.sessionHash = th;
  return user;
}

export async function createSession(env, userId) {
  const token = randomToken();
  const now = Date.now();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?,?,?,?,?)')
    .bind(await hashToken(token, env.AUTH_PEPPER), userId, now, now + SESSION_DAYS * 86400000, now).run();
  return token;
}

// ---------------- Permisos ----------------

export function rolesIn(user, hotelId) {
  if (user.is_owner) return [...ROLES];
  const r = user.memberships.filter((m) => m.hotel_id === hotelId).map((m) => m.role);
  if (r.includes('admin')) return [...new Set([...ROLES])];
  return r;
}
export function can(user, hotelId, ...anyOf) {
  const r = rolesIn(user, hotelId);
  return anyOf.some((x) => r.includes(x));
}
export function requireRole(user, hotelId, ...anyOf) {
  if (!can(user, hotelId, ...anyOf)) throw forbidden();
}
export function requireOwner(user) {
  if (!user.is_owner) throw forbidden('Solo el dueño puede hacer esto.');
}
export function hotelsOf(user, allHotels) {
  if (user.is_owner) return allHotels;
  const ids = new Set(user.memberships.map((m) => m.hotel_id));
  return allHotels.filter((h) => ids.has(h.id));
}

// ---------------- Código por correo ----------------

const normEmail = (e) => String(e || '').trim().toLowerCase();
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
export const ownerEmails = (env) => String(env.OWNER_EMAIL || '').split(',').map(normEmail).filter(Boolean);
// OWNER_NAME puede llevar un nombre por correo, en el mismo orden y separados por coma.
function ownerName(env, email) {
  const names = String(env.OWNER_NAME || '').split(',').map((s) => s.trim());
  return names[ownerEmails(env).indexOf(email)] || 'Gerencia';
}

export async function sendLoginCode(env, emailRaw) {
  const email = normEmail(emailRaw);
  if (!isEmail(email)) throw bad('Escribe un correo válido.');

  let user = await env.DB.prepare('SELECT id, active, is_owner FROM users WHERE email = ?').bind(email).first();
  // Gerencia: cada correo de OWNER_EMAIL (separados por coma) tiene acceso total.
  // Se crean solos la primera vez y siempre quedan como dueños activos.
  if (ownerEmails(env).includes(email)) {
    if (!user) {
      await env.DB.prepare('INSERT INTO users (email, name, is_owner, active, created_at) VALUES (?,?,1,1,?)')
        .bind(email, ownerName(env, email), Date.now()).run();
    } else if (!user.is_owner || !user.active) {
      await env.DB.prepare('UPDATE users SET is_owner = 1, active = 1 WHERE email = ?').bind(email).run();
    }
    user = { active: 1 };
  }
  // Respuesta igual exista o no, para no revelar qué correos están registrados.
  const generic = { ok: true, message: 'Si el correo está registrado, te llegará un código en un momento.' };
  if (!user || !user.active) return generic;

  const prev = await env.DB.prepare('SELECT last_sent_at FROM email_codes WHERE email = ?').bind(email).first();
  if (prev && Date.now() - prev.last_sent_at < 45000) throw new HttpError(429, 'Espera unos segundos antes de pedir otro código.');

  const code = randomCode();
  // Primero se envía y solo si salió se guarda: así un correo fallido no borra un código de acceso entregado por gerencia.
  await deliverCode(env, email, code);
  await storeCode(env, email, code, CODE_MINUTES * 60000);
  if (env.DEV_MODE === '1') generic.devCode = code; // solo en desarrollo local
  return generic;
}

async function storeCode(env, email, code, ttlMs) {
  await env.DB.prepare(`INSERT INTO email_codes (email, code_hash, expires_at, attempts, last_sent_at) VALUES (?,?,?,0,?)
     ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=0, last_sent_at=excluded.last_sent_at`)
    .bind(email, await hashToken(code, env.AUTH_PEPPER), Date.now() + ttlMs, Date.now()).run();
}

/**
 * Código de acceso generado por gerencia (sin correo): de un solo uso, vence en 24 horas.
 * Gerencia se lo entrega a la persona por WhatsApp; ella entra con su correo y ese código.
 */
export const ACCESS_CODE_HOURS = 24;
export async function createAccessCode(env, userId) {
  const u = await env.DB.prepare('SELECT email, active FROM users WHERE id = ?').bind(Number(userId)).first();
  if (!u) throw new HttpError(404, 'Usuario no encontrado.');
  if (!u.active) throw bad('El usuario está desactivado. Reactívalo primero.');
  const code = randomCode();
  await storeCode(env, u.email, code, ACCESS_CODE_HOURS * 3600000);
  return { email: u.email, code, expires_in_hours: ACCESS_CODE_HOURS };
}

async function deliverCode(env, email, code) {
  if (!env.RESEND_API_KEY) {
    if (env.DEV_MODE === '1') { console.log(`[dev] código para ${email}: ${code}`); return; }
    throw new HttpError(500, 'El envío de correos no está configurado (falta RESEND_API_KEY).');
  }
  const appName = env.APP_NAME || 'Control de Hoteles';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || `${appName} <onboarding@resend.dev>`,
      to: [email],
      subject: `${code} es tu código de acceso`,
      text: `Tu código para entrar a ${appName} es: ${code}\n\nVence en ${CODE_MINUTES} minutos. Si no lo pediste, ignora este correo.`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5">
        <p>Tu código para entrar a <b>${appName}</b> es:</p>
        <p style="font-size:32px;letter-spacing:6px;font-weight:700;margin:16px 0">${code}</p>
        <p style="color:#666">Vence en ${CODE_MINUTES} minutos. Si no lo pediste, ignora este correo.</p></div>`,
    }),
  });
  if (!r.ok) {
    console.error('Resend', r.status, await r.text());
    throw new HttpError(502, 'No se pudo enviar el correo. Inténtalo de nuevo en un momento.');
  }
}

export async function verifyLoginCode(env, emailRaw, codeRaw) {
  const email = normEmail(emailRaw);
  const code = String(codeRaw || '').replace(/\D/g, '');
  const row = await env.DB.prepare('SELECT code_hash, expires_at, attempts FROM email_codes WHERE email = ?').bind(email).first();
  const fail = new HttpError(400, 'El código no es correcto o ya venció. Pide uno nuevo.');
  if (!row || row.expires_at < Date.now() || row.attempts >= 5) throw fail;
  await env.DB.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE email = ?').bind(email).run();
  if (!timingSafeEqual(row.code_hash, await hashToken(code, env.AUTH_PEPPER))) throw fail;
  await env.DB.prepare('DELETE FROM email_codes WHERE email = ?').bind(email).run();
  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND active = 1').bind(email).first();
  if (!user) throw fail;
  return user.id;
}

// ---------------- Llaves de acceso (WebAuthn) ----------------
// Sin librerías: el navegador entrega la llave pública en formato SPKI
// (response.getPublicKey()) y aquí verificamos firmas con WebCrypto.

function rpId(env) { return env.RP_ID; }
function allowedOrigins(env) { return String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean); }

async function newChallenge(env, kind, userId = null) {
  const id = randomToken(12);
  const challenge = randomToken(32);
  await env.DB.prepare('INSERT INTO challenges (id, challenge, user_id, kind, expires_at) VALUES (?,?,?,?,?)')
    .bind(id, challenge, userId, kind, Date.now() + 5 * 60000).run();
  await env.DB.prepare('DELETE FROM challenges WHERE expires_at < ?').bind(Date.now()).run();
  return { id, challenge };
}
async function takeChallenge(env, id, kind) {
  const c = await env.DB.prepare('SELECT * FROM challenges WHERE id = ? AND kind = ?').bind(String(id || ''), kind).first();
  if (!c || c.expires_at < Date.now()) throw bad('La solicitud venció. Inténtalo de nuevo.');
  await env.DB.prepare('DELETE FROM challenges WHERE id = ?').bind(c.id).run();
  return c;
}

function checkClientData(env, clientDataB64, type, challenge) {
  let cd;
  try { cd = JSON.parse(new TextDecoder().decode(unb64u(clientDataB64))); } catch { throw bad('Datos de la llave inválidos.'); }
  if (cd.type !== type) throw bad('Tipo de operación incorrecto.');
  if (cd.challenge !== challenge) throw bad('La verificación no coincide.');
  if (!allowedOrigins(env).includes(cd.origin)) throw bad('Origen no permitido.');
}

async function checkAuthData(env, authData) {
  if (authData.length < 37) throw bad('Datos del autenticador inválidos.');
  const rpHash = await sha256(rpId(env));
  for (let i = 0; i < 32; i++) if (authData[i] !== rpHash[i]) throw bad('Dominio de la llave incorrecto.');
  const flags = authData[32];
  if (!(flags & 0x01)) throw bad('Falta la confirmación del usuario.');
  const count = (authData[33] << 24 >>> 0) + (authData[34] << 16) + (authData[35] << 8) + authData[36];
  return { flags, count };
}

export async function passkeyRegisterOptions(env, user) {
  const { id, challenge } = await newChallenge(env, 'reg', user.id);
  const { results } = await env.DB.prepare('SELECT id FROM passkeys WHERE user_id = ?').bind(user.id).all();
  return {
    challengeId: id,
    publicKey: {
      challenge,
      rp: { id: rpId(env), name: env.APP_NAME || 'Control de Hoteles' },
      user: { id: b64u(enc(String(user.id))), name: user.email, displayName: user.name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -8 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      excludeCredentials: results.map((r) => ({ type: 'public-key', id: r.id })),
      timeout: 120000,
      attestation: 'none',
    },
  };
}

export async function passkeyRegister(env, user, b) {
  const c = await takeChallenge(env, b.challengeId, 'reg');
  if (c.user_id !== user.id) throw forbidden();
  checkClientData(env, b.clientDataJSON, 'webauthn.create', c.challenge);
  const authData = unb64u(b.authenticatorData);
  const { flags, count } = await checkAuthData(env, authData);
  if (!(flags & 0x04)) throw bad('Esta llave no verificó tu huella o rostro.');
  const alg = Number(b.alg);
  if (![-7, -8, -257].includes(alg)) throw bad('Tipo de llave no compatible.');
  await importKey(b.publicKey, alg); // valida que la llave sea utilizable
  await env.DB.prepare('INSERT INTO passkeys (id, user_id, public_key, alg, sign_count, label, created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(String(b.id), user.id, String(b.publicKey), alg, count, String(b.label || 'Este dispositivo').slice(0, 60), Date.now()).run();
  return { ok: true };
}

export async function passkeyLoginOptions(env) {
  const { id, challenge } = await newChallenge(env, 'auth');
  return { challengeId: id, publicKey: { challenge, rpId: rpId(env), userVerification: 'required', timeout: 120000 } };
}

export async function passkeyLogin(env, b) {
  const c = await takeChallenge(env, b.challengeId, 'auth');
  const pk = await env.DB.prepare('SELECT * FROM passkeys WHERE id = ?').bind(String(b.id || '')).first();
  if (!pk) throw bad('Esta llave no está registrada. Entra con tu correo y vuelve a activarla.');
  checkClientData(env, b.clientDataJSON, 'webauthn.get', c.challenge);
  const authData = unb64u(b.authenticatorData);
  const { flags, count } = await checkAuthData(env, authData);
  if (!(flags & 0x04)) throw bad('No se verificó tu huella o rostro.');

  const clientHash = await sha256(unb64u(b.clientDataJSON));
  const signed = new Uint8Array(authData.length + clientHash.length);
  signed.set(authData); signed.set(clientHash, authData.length);
  const key = await importKey(pk.public_key, pk.alg);
  let sig = unb64u(b.signature);
  let algo;
  if (pk.alg === -7) { algo = { name: 'ECDSA', hash: 'SHA-256' }; sig = derToRaw(sig); }
  else if (pk.alg === -257) algo = { name: 'RSASSA-PKCS1-v1_5' };
  else algo = { name: 'Ed25519' };
  const ok = await crypto.subtle.verify(algo, key, sig, signed);
  if (!ok) throw bad('No se pudo verificar la llave.');
  if (count !== 0 && pk.sign_count !== 0 && count <= pk.sign_count) throw bad('Llave rechazada por seguridad. Vuelve a registrarla.');

  await env.DB.prepare('UPDATE passkeys SET sign_count = ?, last_used_at = ? WHERE id = ?').bind(count, Date.now(), pk.id).run();
  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND active = 1').bind(pk.user_id).first();
  if (!user) throw bad('Tu usuario está desactivado.');
  return user.id;
}

async function importKey(spkiB64, alg) {
  const spki = unb64u(spkiB64);
  try {
    if (alg === -7) return await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    if (alg === -257) return await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.importKey('spki', spki, { name: 'Ed25519' }, false, ['verify']);
  } catch { throw bad('No se pudo leer la llave pública.'); }
}

/** Firma ECDSA en DER → formato r||s de 64 bytes que espera WebCrypto. */
export function derToRaw(der) {
  if (der.length === 64) return der;
  let i = 2;
  if (der[1] & 0x80) i += der[1] & 0x7f;
  const read = () => {
    if (der[i++] !== 0x02) throw bad('Firma inválida.');
    const len = der[i++];
    let v = der.slice(i, i + len); i += len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(32); out.set(v, 32 - v.length);
    return out;
  };
  const r = read(); const s = read();
  const raw = new Uint8Array(64); raw.set(r); raw.set(s, 32);
  return raw;
}
