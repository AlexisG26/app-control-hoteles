// Utilidades comunes: respuestas, base64url, hash, tiempo local de Honduras.

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const bad = (msg) => new HttpError(400, msg);
export const forbidden = (msg = 'No tienes permiso para esta acción.') => new HttpError(403, msg);
export const notFound = (msg = 'No encontrado.') => new HttpError(404, msg);

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export async function body(req) {
  try { return await req.json(); } catch { throw bad('El cuerpo de la petición no es JSON válido.'); }
}

// ---- base64url ----
export function b64u(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export const enc = (s) => new TextEncoder().encode(s);

export async function sha256(data) {
  const d = typeof data === 'string' ? enc(data) : data;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', d));
}
export async function hashToken(token, pepper = '') {
  return b64u(await sha256(pepper + '|' + token));
}
export function randomToken(bytes = 32) {
  return b64u(crypto.getRandomValues(new Uint8Array(bytes)));
}
export function randomCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, '0');
}
export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---- Tiempo local (Honduras no usa horario de verano: UTC-6 fijo) ----
export function tzOffsetMin(env) { return Number(env.TZ_OFFSET_MIN ?? -360); }
const pad = (n) => String(n).padStart(2, '0');

/** Fecha local 'YYYY-MM-DD' para un instante UTC (ms). */
export function localDate(env, ms = Date.now()) {
  const d = new Date(ms + tzOffsetMin(env) * 60000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
/** Hora local 'HH:MM'. */
export function localTime(env, ms = Date.now()) {
  const d = new Date(ms + tzOffsetMin(env) * 60000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
/** Instante UTC (ms) de una fecha y hora locales. */
export function localToUtc(env, dateStr, timeStr = '00:00') {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - tzOffsetMin(env) * 60000;
}
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
export function mondayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(dateStr, -dow);
}
export function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

export function cleanStr(v, max = 200) {
  return String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}
export function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) throw bad('El monto no es válido.');
  return Math.round(n * 100) / 100;
}
export function posInt(v, max = 365) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > max) throw bad('La cantidad debe ser un número entero mayor que cero.');
  return n;
}
