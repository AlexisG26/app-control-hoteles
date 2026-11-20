// Control de Hoteles · PWA (sin dependencias)
const API = (self.APP_CONFIG?.API_URL || '').replace(/\/$/, '');
const TZ = 'America/Tegucigalpa';
const $ = (id) => document.getElementById(id);
const app = $('app');

// ---------------- Utilidades ----------------
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => 'L ' + (Math.round((+n || 0) * 100) / 100).toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmt2 = (n) => 'L ' + (+n || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => Math.round(+n || 0).toLocaleString('es-HN');
const hnDate = (ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
const hnTime = (ms = Date.now()) => new Intl.DateTimeFormat('es-HN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true }).format(ms);
const hnDay = (ms) => new Intl.DateTimeFormat('es-HN', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'short' }).format(ms);
const hnShort = (ms) => new Intl.DateTimeFormat('es-HN', { timeZone: TZ, day: 'numeric', month: 'short' }).format(ms);
const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const addDays = (s, n) => { const d = parseD(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monday = (s) => addDays(s, -((parseD(s).getUTCDay() + 6) % 7));
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
};
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

function toast(t) {
  const el = $('toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2600);
}

// ---------------- API ----------------
let token = LS.get('ch-token', null);
async function api(method, path, body, { raw = false } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try { res = await fetch(API + path, { method, headers, body: payload }); }
  catch { throw new Error('Sin conexión con el servidor. Revisa tu internet.'); }
  if (raw && res.ok) return res;
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401 && token) { logout(false); throw new Error(data?.error || 'Tu sesión terminó.'); }
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}

// ---------------- Estado ----------------
let me = null; // { user, hotels, pay, vapidPublicKey }
let unread = 0;
let refreshTimer = null;
const roleLabel = { admin: 'Administración', contabilidad: 'Contabilidad', recepcion: 'Recepción y reservas', limpieza: 'Limpieza', mantenimiento: 'Mantenimiento' };
const statusLabel = { libre: 'Libre', ocupada: 'Ocupada', por_limpiar: 'Por limpiar', limpiando: 'Limpiando', bloqueada: 'Bloqueada' };
const hotelById = (id) => me.hotels.find((h) => h.id === id);
const has = (hotelId, ...roles) => { const h = hotelById(hotelId); return !!h && roles.some((r) => h.roles.includes(r)); };
const isGlobal = () => !!me.user.is_owner; // el panel global es solo para gerencia

function logout(callApi = true) {
  if (callApi && token) api('POST', '/api/auth/logout').catch(() => {});
  token = null; me = null; LS.del('ch-token');
  location.hash = '#/entrar';
  render();
}

// ---------------- Rutas ----------------
function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { parts, name: parts[0] || 'inicio' };
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

function homeRoute() {
  if (isGlobal()) return '#/global';
  const h = me.hotels[0];
  if (!h) return '#/ajustes';
  const order = [['recepcion', 'recepcion'], ['limpieza', 'limpieza'], ['mantenimiento', 'problemas'], ['contabilidad', 'contabilidad']];
  for (const [role, view] of order) if (h.roles.includes(role)) return `#/hotel/${h.id}/${view}`;
  return '#/ajustes';
}
function hotelTabs(h) {
  const t = [];
  if (h.roles.includes('recepcion')) t.push(['recepcion', 'Habitaciones', 'key']);
  if (h.roles.includes('limpieza')) t.push(['limpieza', 'Limpieza', 'broom']);
  if (h.roles.some((r) => ['recepcion', 'limpieza', 'mantenimiento'].includes(r))) t.push(['problemas', 'Problemas', 'wrench']);
  if (h.roles.includes('contabilidad')) t.push(['contabilidad', 'Contabilidad', 'cash']);
  return t;
}
const globalTabs = () => [['#/global', 'Resumen', 'grid'], ['#/finanzas', 'Finanzas', 'chart'], ['#/usuarios', 'Equipo', 'users']];

window.addEventListener('hashchange', render);
document.addEventListener('visibilitychange', () => { if (!document.hidden && me) softRefresh(); });

async function render() {
  closeSheet();
  clearInterval(refreshTimer);
  const r = parseRoute();
  if (!token) return viewLogin();
  if (!me) {
    try { me = await api('GET', '/api/me'); } catch (e) { if (!token) return; app.innerHTML = errorBox(e.message); return; }
    loadUnread();
  }
  try {
    if (r.name === 'inicio' || r.name === 'entrar') return go(homeRoute());
    if (r.name === 'global' && isGlobal()) return await viewGlobal();
    if (r.name === 'finanzas' && isGlobal()) return await viewFinanzas();
    if (r.name === 'hotel') {
      const h = hotelById(r.parts[1]);
      if (!h) return go(homeRoute());
      LS.set('ch-hotel', h.id);
      const view = r.parts[2] || hotelTabs(h)[0]?.[0];
      const fn = { recepcion: viewRecepcion, limpieza: viewLimpieza, problemas: viewProblemas, contabilidad: viewContabilidad }[view];
      if (!fn || !hotelTabs(h).some((t) => t[0] === view)) return go(homeRoute());
      return await fn(h);
    }
    if (r.name === 'avisos') return await viewAvisos();
    if (r.name === 'ajustes') return await viewAjustes();
    if (r.name === 'usuarios' && me.user.is_owner) return await viewUsuarios();
    go(homeRoute());
  } catch (e) {
    app.innerHTML = header() + errorBox(e.message);
  }
}
const errorBox = (m) => `<div class="panel"><h2>No se pudo cargar</h2><p>${esc(m)}</p><button class="btn ghost" onclick="location.reload()">Reintentar</button></div>`;

// Recarga silenciosa de la vista actual (cada 20 s en pantallas de operación).
async function softRefresh() {
  if (document.querySelector('.scrim')) return;
  const y = scrollY;
  await render();
  scrollTo(0, y);
}
function autoRefresh() { refreshTimer = setInterval(() => { if (!document.hidden) softRefresh(); }, 20000); }

// ---------------- Íconos (trazos simples, heredan el color del texto) ----------------
const ICON = {
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  broom: '<path d="M14 4l-4 8M7 13h8l1 7H6z"/><path d="M9 20v-3M12 20v-3"/>',
  wrench: '<path d="M14.5 5.5a4 4 0 0 0 4.9 5L12 18a2.1 2.1 0 0 1-3-3l7.5-7.4a4 4 0 0 0-2-2.1z"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  chart: '<path d="M4 20h16M7 16v-4M12 16V8M17 16v-7"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.5M17.5 19a5 5 0 0 0-2.5-4.3"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;

// ---------------- Encabezado y barra inferior ----------------
function header(current = {}) {
  const hotelSel = current.hotel;
  const gl = isGlobal();
  const title = hotelSel ? hotelSel.name : (current.title || 'Control de Hoteles');
  const switcher = me.hotels.length > 1 || gl
    ? `<div class="seg ctx" role="group" aria-label="Hotel">
        ${gl ? `<button aria-pressed="${current.global ? 'true' : 'false'}" data-go="#/global">Global</button>` : ''}
        ${me.hotels.map((h) => `<button aria-pressed="${hotelSel?.id === h.id}" data-go="#/hotel/${h.id}/${hotelTabs(h)[0]?.[0] || ''}">${esc(h.name.replace('Hostal ', ''))}</button>`).join('')}
      </div>` : '';
  const items = hotelSel
    ? hotelTabs(hotelSel).map(([k, l, ic]) => [`#/hotel/${hotelSel.id}/${k}`, l, ic, current.view === k])
    : current.global ? globalTabs().map(([href, l, ic]) => [href, l, ic, current.view === href]) : [];
  const nav = items.length > 1
    ? `<nav class="tabbar" aria-label="Secciones">${items.map(([href, l, ic, on]) => `<a href="${href}" ${on ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span></a>`).join('')}</nav>` : '';
  const initials = me.user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return `
    <header class="appbar">
      <div class="appbar-row">
        <div class="brand"><img src="icons/icon-192.png" alt=""><div><b>${esc(title)}</b><small>${esc(me.user.name)} · <span class="clock" id="clock">${hnTime()}</span></small></div></div>
        <div class="top-actions">
          <button class="round" data-go="#/avisos" aria-label="Avisos${unread ? `, ${unread} sin leer` : ''}">${icon('bell')}${unread ? `<span class="dot">${unread > 9 ? '9+' : unread}</span>` : ''}</button>
          <button class="round avatar" data-go="#/ajustes" aria-label="Ajustes">${esc(initials)}</button>
        </div>
      </div>
      ${switcher}
    </header>
    ${nav}`;
}
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); }
});
setInterval(() => { const c = $('clock'); if (c) c.textContent = hnTime(); }, 15000);
async function loadUnread() {
  try {
    const l = await api('GET', '/api/notifications');
    unread = l.filter((n) => !n.read_at).length;
  } catch { /* */ }
}

// ---------------- Hoja de acciones ----------------
function sheet(html, bind) {
  $('sheetHost').innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  $('scrim').addEventListener('click', (e) => { if (e.target.id === 'scrim') closeSheet(); });
  bind?.();
  const f = $('sheetHost').querySelector('input:not([type=checkbox]):not([type=file]), textarea');
  if (f && matchMedia('(pointer:fine)').matches) f.focus();
}
function closeSheet() { $('sheetHost').innerHTML = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

async function act(btn, fn, okMsg) {
  const err = $('err');
  if (err) err.textContent = '';
  btn.disabled = true;
  try { await fn(); closeSheet(); if (okMsg) toast(okMsg); await softRefresh(); }
  catch (e) { if (err) err.textContent = e.message; else toast(e.message); btn.disabled = false; }
}

function payFields(h) {
  const pays = me.pay.filter((p) => p !== 'Orden de compra' || h.allow_po);
  return `<label>Forma de pago<select id="f-pay">${pays.map((p) => `<option>${p}</option>`).join('')}</select></label>
    <label id="poL" hidden>Número de orden de compra<input id="f-po" autocomplete="off" placeholder="Ej. OC-2026-0153"></label>
    <p class="note" id="pendL" hidden>Queda como <b>pago pendiente</b>. No suma a la caja hasta que se cobre en <b>Pagos pendientes</b>, con su comprobante.</p>
    <label id="usdL" hidden>Total cobrado en dólares (US$)<input id="f-usd" type="number" min="0" step="any" inputmode="decimal" placeholder="Ej. 120"></label>
    <p class="note" id="usdN" hidden>Se pasa a lempiras con la <b>tasa del día siguiente</b>, que es cuando cae el dinero de PayPal. Contabilidad puede ajustar lo que realmente cayó.</p>`;
}
function bindPay() {
  const s = $('f-pay');
  s?.addEventListener('change', () => {
    $('poL').hidden = s.value !== 'Orden de compra'; if (!$('poL').hidden) $('f-po').focus();
    if ($('pendL')) $('pendL').hidden = s.value !== 'Pendiente';
    if ($('usdL')) { $('usdL').hidden = $('usdN').hidden = s.value !== 'PayPal'; if (s.value === 'PayPal') $('f-usd').focus(); }
  });
}
const payBody = () => {
  const pay = $('f-pay').value;
  const b = { pay, po: $('f-po')?.value.trim() || undefined };
  if (pay === 'PayPal' && $('f-usd')) {
    if (!(+$('f-usd').value > 0)) throw new Error('Escribe cuántos dólares pagó por PayPal.');
    b.usd = +$('f-usd').value;
  }
  return b;
};

// ================= INICIO DE SESIÓN =================
function viewLogin() {
  const canPasskey = !!window.PublicKeyCredential;
  const hasPasskey = LS.get('ch-passkey', false);
  app.innerHTML = `
    <div class="login">
      <img class="logo" src="icons/icon-192.png" alt="">
      <div class="stack" style="gap:6px"><h1>Control de Hoteles</h1><p class="hint">Hostal Prado Alto · ProKinto</p></div>
      ${canPasskey && hasPasskey ? `<button class="btn big" id="pk">Entrar con huella o Face ID</button><div class="divider">o con tu correo</div>` : ''}
      <form id="f1" class="stack">
        <label>Correo<input id="email" type="email" autocomplete="email" inputmode="email" required value="${esc(LS.get('ch-email', ''))}"></label>
        <button class="btn ${hasPasskey ? 'ghost' : 'big'}" id="send">Enviar código a mi correo</button>
        <button class="btn ghost" type="button" id="haveCode">Ya tengo un código de acceso</button>
      </form>
      <form id="f2" class="stack" hidden>
        <p id="sentMsg">Te enviamos un código de 6 números a <b id="sentTo"></b>.</p>
        <label>Código<input id="code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" required></label>
        <button class="btn big" id="verify">Entrar</button>
        <button class="btn ghost" type="button" id="back">Usar otro correo</button>
      </form>
      <div class="err" id="err"></div>
      ${!API || API.includes('127.0.0.1') ? '<p class="hint">Modo de prueba: la app apunta a una API local.</p>' : ''}
    </div>`;
  const err = (m) => { $('err').textContent = m; };
  $('f1').onsubmit = async (e) => {
    e.preventDefault(); err('');
    const email = $('email').value.trim();
    $('send').disabled = true;
    try {
      const r = await api('POST', '/api/auth/code', { email });
      LS.set('ch-email', email);
      $('sentTo').textContent = email; $('f1').hidden = true; $('f2').hidden = false;
      if (r.devCode) $('code').value = r.devCode;
      $('code').focus();
    } catch (x) { err(x.message + ' Si gerencia te dio un código de acceso, toca "Ya tengo un código de acceso".'); }
    $('send').disabled = false;
  };
  $('f2').onsubmit = async (e) => {
    e.preventDefault(); err('');
    $('verify').disabled = true;
    try {
      const r = await api('POST', '/api/auth/verify', { email: $('email').value.trim(), code: $('code').value });
      await startSession(r.token);
    } catch (x) { err(x.message); $('verify').disabled = false; }
  };
  $('code').addEventListener('input', (e) => { if (e.target.value.replace(/\D/g, '').length === 6) $('f2').requestSubmit(); });
  $('back').onclick = () => { $('f2').hidden = true; $('f1').hidden = false; };
  $('haveCode').onclick = () => {
    const email = $('email').value.trim();
    if (!$('email').checkValidity() || !email) { err('Escribe primero tu correo.'); $('email').focus(); return; }
    err(''); LS.set('ch-email', email);
    $('sentMsg').innerHTML = `Escribe el código de acceso que te dio gerencia para <b>${esc(email)}</b>.`;
    $('f1').hidden = true; $('f2').hidden = false; $('code').focus();
  };
  if ($('pk')) $('pk').onclick = () => passkeyLogin().catch((x) => err(x.message));
}

async function startSession(t) {
  token = t; LS.set('ch-token', t); me = null;
  location.hash = '#/inicio';
  await render();
  // Después del primer ingreso, ofrecer huella y avisos.
  if (window.PublicKeyCredential && !LS.get('ch-passkey', false) && !LS.get('ch-passkey-skip', false)) offerSetup();
}

async function passkeyLogin() {
  const o = await api('POST', '/api/auth/passkey/login-options', {});
  let cred;
  try {
    cred = await navigator.credentials.get({ publicKey: { ...o.publicKey, challenge: unb64u(o.publicKey.challenge) } });
  } catch { throw new Error('No se completó la verificación. Puedes entrar con tu correo.'); }
  const r = await api('POST', '/api/auth/passkey/login', {
    challengeId: o.challengeId, id: cred.id,
    clientDataJSON: b64u(cred.response.clientDataJSON), authenticatorData: b64u(cred.response.authenticatorData),
    signature: b64u(cred.response.signature),
  });
  await startSession(r.token);
}

async function passkeyRegister() {
  const o = await api('POST', '/api/auth/passkey/register-options', {});
  const pk = o.publicKey;
  let cred;
  try {
    cred = await navigator.credentials.create({ publicKey: {
      ...pk, challenge: unb64u(pk.challenge), user: { ...pk.user, id: unb64u(pk.user.id) },
      excludeCredentials: pk.excludeCredentials.map((c) => ({ ...c, id: unb64u(c.id) })),
    } });
  } catch (e) {
    if (e.name === 'InvalidStateError') throw new Error('Este dispositivo ya tiene la huella o Face ID activada.');
    throw new Error('No se completó la activación.');
  }
  const res = cred.response;
  if (!res.getPublicKey || !res.getPublicKey()) throw new Error('Este navegador no permite activar la huella. Actualízalo o usa Chrome o Safari.');
  await api('POST', '/api/auth/passkey/register', {
    challengeId: o.challengeId, id: cred.id,
    clientDataJSON: b64u(res.clientDataJSON), authenticatorData: b64u(res.getAuthenticatorData()),
    publicKey: b64u(res.getPublicKey()), alg: res.getPublicKeyAlgorithm(), label: deviceName(),
  });
  LS.set('ch-passkey', true);
}
function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone'; if (/iPad/.test(ua)) return 'iPad'; if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac'; if (/Windows/.test(ua)) return 'Windows'; return 'Este dispositivo';
}

function offerSetup() {
  sheet(`<h3>Entra más rápido</h3>
    <p>Activa la huella o Face ID en este teléfono para no tener que escribir el código cada vez.</p>
    <div class="err" id="err"></div>
    <div class="row"><button class="btn ghost" id="skip">Ahora no</button><button class="btn" id="ok">Activar huella o Face ID</button></div>`, () => {
    $('skip').onclick = () => { LS.set('ch-passkey-skip', true); closeSheet(); };
    $('ok').onclick = async () => {
      try { await passkeyRegister(); closeSheet(); toast('Listo. La próxima vez entra con tu huella o rostro.'); }
      catch (e) { $('err').textContent = e.message; }
    };
  });
}

// ================= PANEL GLOBAL (dueño) =================
async function viewGlobal() {
  const ov = await api('GET', '/api/overview');
  const t = ov.totals;
  const statusKeys = ['libre', 'ocupada', 'por_limpiar', 'limpiando', 'bloqueada'];
  const colors = { libre: 'var(--free)', ocupada: 'var(--occ)', por_limpiar: 'var(--dirty)', limpiando: 'var(--cleaning)', bloqueada: 'var(--block)' };
  app.innerHTML = header({ global: true, view: '#/global', title: 'Gerencia' }) + `
    <section>
      <div class="sec-head"><h1>Todos los hoteles</h1><span class="hint">${esc(hnDay(Date.now()))}</span></div>
      <div class="tiles">
        <div class="tile s-libre"><b>${t.libre}</b><span>Libres</span></div>
        <div class="tile s-ocupada"><b>${t.ocupada}</b><span>Ocupadas</span></div>
        <div class="tile s-por_limpiar"><b>${t.por_limpiar}</b><span>Por limpiar</span></div>
        <div class="tile s-bloqueada"><b>${t.bloqueada}</b><span>Con problema</span></div>
      </div>
      <div class="panel">
        <div class="money">
          <div><span>Hoy</span><b>${fmt(t.today)}</b></div>
          <div><span>Esta semana</span><b>${fmt(t.week)}</b></div>
          <div><span>Este mes</span><b>${fmt(t.month)}</b></div>
        </div>
        <a class="btn ghost" href="#/finanzas">Ver análisis por hotel</a>
        ${t.open_issues || t.po_alerts || t.pending_count ? `<div class="alerts">
          ${t.open_issues ? `<span class="tag t-bloqueada">${t.open_issues} problema${t.open_issues > 1 ? 's' : ''} abierto${t.open_issues > 1 ? 's' : ''}</span>` : ''}
          ${t.pending_count ? `<span class="tag t-warn">${fmt(t.pending_amount)} por cobrar (${t.pending_count})</span>` : ''}
          ${t.po_alerts ? `<span class="tag t-warn">${t.po_alerts} orden${t.po_alerts > 1 ? 'es' : ''} de compra con aviso</span>` : ''}
        </div>` : ''}
      </div>
    </section>
    <section class="hotels">
      ${ov.hotels.map((h) => `
        <button class="panel hotel-card" data-go="#/hotel/${h.id}/${hotelTabs(hotelById(h.id))[0]?.[0] || 'contabilidad'}">
          <div class="sec-head"><h2>${esc(h.name)}</h2><span class="tag t-info">Ocupación ${h.occupancy}%</span></div>
          <div class="occbar" aria-hidden="true">${statusKeys.map((k) => `<i class="${k}" style="width:${h.total ? (h.counts[k] / h.total) * 100 : 0}%"></i>`).join('')}</div>
          <div class="legend">${statusKeys.map((k) => `<span style="--c:${colors[k]}">${statusLabel[k]} ${h.counts[k]}</span>`).join('')}</div>
          <div class="money">
            <div><span>Hoy</span><b>${fmt(h.revenue.today)}</b></div>
            <div><span>Semana</span><b>${fmt(h.revenue.week)}</b></div>
            <div><span>Mes</span><b>${fmt(h.revenue.month)}</b></div>
          </div>
          <div class="alerts">
            ${h.checkouts_today ? `<span class="tag t-warn">${h.checkouts_today} salida${h.checkouts_today > 1 ? 's' : ''} hoy</span>` : ''}
            ${h.open_issues ? `<span class="tag t-bloqueada">${h.open_issues} problema${h.open_issues > 1 ? 's' : ''}</span>` : ''}
            ${h.po_pending ? `<span class="tag ${h.po_alerts ? 't-bad' : 't-info'}">${h.po_pending} OC pendiente${h.po_pending > 1 ? 's' : ''} · ${fmt(h.po_pending_amount)}</span>` : ''}
          </div>
        </button>`).join('')}
    </section>
    ${installBanner()}`;
  bindInstall();
  autoRefresh();
}


// ================= FINANZAS (gerencia) =================
// Cuánto generó cada hotel en el período, su parte del total y cómo va contra el período anterior.
const PERIODS = [['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['mes_ant', 'Mes pasado'], ['anio', 'Año']];
function periodRange(k) {
  const t = hnDate();
  if (k === 'hoy') return [t, t];
  if (k === 'semana') return [monday(t), t];
  if (k === 'mes') return [t.slice(0, 8) + '01', t];
  if (k === 'anio') return [t.slice(0, 5) + '01-01', t];
  const first = t.slice(0, 8) + '01';
  const lastPrev = addDays(first, -1);
  return [lastPrev.slice(0, 8) + '01', lastPrev];
}
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const HOTEL_COLOR = ['var(--h1)', 'var(--h2)', 'var(--h3)'];
const delta = (d, prev) => (d === null
  ? `<span class="chg flat">${prev ? '' : 'Sin datos del período anterior'}</span>`
  : `<span class="chg ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}">${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${Math.abs(d)}%</span>`);

async function viewFinanzas() {
  const pk = LS.get('ch-period', 'mes');
  const [from, to] = periodRange(pk);
  const f = await api('GET', `/api/finance/compare?from=${from}&to=${to}`);
  const max = Math.max(1, ...f.hotels.map((h) => h.total));
  const color = (i) => HOTEL_COLOR[i % HOTEL_COLOR.length];
  const rangeTxt = from === to ? hnDay(parseD(from)) : `${parseD(from).getUTCDate()} ${MONTHS[parseD(from).getUTCMonth()]} – ${parseD(to).getUTCDate()} ${MONTHS[parseD(to).getUTCMonth()]} ${parseD(to).getUTCFullYear()}`;

  // Tendencia: por día (hasta 31 días) o por mes
  const daily = f.days <= 31;
  const keys = [];
  if (daily) for (let d = from; d <= to; d = addDays(d, 1)) keys.push(d);
  else { for (let m = from.slice(0, 7); m <= to.slice(0, 7);) { keys.push(m); const [y, mo] = m.split('-').map(Number); m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; } }
  const val = (h, k) => h.by_day.filter((r) => (daily ? r.d === k : r.d.slice(0, 7) === k)).reduce((a, r) => a + r.t, 0);
  const tmax = Math.max(1, ...keys.map((k) => Math.max(...f.hotels.map((h) => val(h, k)))));
  const showTrend = keys.length > 1;
  const label = (k, i) => (daily ? (keys.length > 10 && i % Math.ceil(keys.length / 8) !== 0 ? '' : String(parseD(k).getUTCDate())) : MONTHS[Number(k.slice(5)) - 1]);
  const payColors = { Efectivo: 'var(--free)', Tarjeta: 'var(--cleaning)', Transferencia: 'var(--brass)', PayPal: 'var(--paypal)', 'Orden de compra': 'var(--block)' };
  const kindLabel = { hospedaje: 'Por noche', hora: 'Por hora', extra: 'Extras', abono: 'Pagos de pendientes' };

  app.innerHTML = header({ global: true, view: '#/finanzas', title: 'Gerencia' }) + `
    <div class="seg period" role="group" aria-label="Período">${PERIODS.map(([k, l]) => `<button aria-pressed="${pk === k}" data-period="${k}">${l}</button>`).join('')}</div>
    <section class="panel hero">
      <span class="eyebrow">Total de los hoteles · ${esc(rangeTxt)}</span>
      <b class="big">${fmt(f.total)}</b>
      <p class="hint">${delta(f.delta_pct, f.prev_total)} ${f.delta_pct !== null ? `vs. ${fmt(f.prev_total)} en los ${f.days} día${f.days > 1 ? 's' : ''} anteriores` : ''}</p>
      <div class="compare">${f.hotels.map((h, i) => `
        <div class="cmp-row"><span class="cmp-name"><i style="background:${color(i)}"></i>${esc(h.name.replace('Hostal ', ''))}</span>
          <div class="cmp-bar"><span style="width:${(h.total / max) * 100}%;background:${color(i)}"></span></div>
          <span class="cmp-val">${fmt(h.total)} <small>${h.share_pct}%</small></span></div>`).join('')}
      </div>
    </section>
    ${showTrend ? `<section class="panel">
      <div class="sec-head"><h2>${daily ? 'Ingresos por día' : 'Ingresos por mes'}</h2>
        <div class="legend">${f.hotels.map((h, i) => `<span style="--c:${color(i)}">${esc(h.name.replace('Hostal ', ''))}</span>`).join('')}</div></div>
      <div class="trend" style="--n:${keys.length}">${keys.map((k, i) => `<div class="tcol" title="${k}">
        <div class="tbars">${f.hotels.map((h, j) => `<span style="height:${(val(h, k) / tmax) * 100}%;background:${color(j)}"></span>`).join('')}</div>
        <span class="tl ${daily && k === hnDate() ? 'now' : ''}">${label(k, i)}</span></div>`).join('')}</div>
    </section>` : ''}
    <section class="hotels">${f.hotels.map((h, i) => {
      const payTotal = h.by_pay.reduce((a, p) => a + p.t, 0) || 1;
      return `<article class="panel">
        <div class="sec-head"><h2><i class="hdot" style="background:${color(i)}"></i>${esc(h.name)}</h2>${delta(h.delta_pct, h.prev_total)}</div>
        <b class="big">${fmt(h.total)}</b>
        <div class="kpis">
          <div><span>Noches vendidas</span><b>${h.nights}</b></div>
          <div><span>Precio prom. noche</span><b>${h.avg_night ? fmt(Math.round(h.avg_night)) : '–'}</b></div>
          <div><span>Ocupación</span><b>${h.occupancy_pct}%</b></div>
          <div><span>Promedio diario</span><b>${fmt(Math.round(h.avg_day))}</b></div>
          <div><span>Por cobrar (hoy)</span><b>${fmt(h.pending_balance)}</b></div>
        </div>
        ${h.by_pay.length ? `<div class="stack">
          <span class="eyebrow">Por forma de pago</span>
          <div class="stackbar">${h.by_pay.map((p) => `<span style="width:${(p.t / payTotal) * 100}%;background:${payColors[p.k] || 'var(--muted)'}"></span>`).join('')}</div>
          <div class="legend">${h.by_pay.sort((a, b) => b.t - a.t).map((p) => `<span style="--c:${payColors[p.k] || 'var(--muted)'}">${esc(p.k)} ${fmt(p.t)}</span>`).join('')}</div>
        </div>` : '<p class="empty">Sin ingresos en este período.</p>'}
        ${h.taxes ? `<p class="hint">Incluye ISV ${fmt(h.taxes.isv)} y Turismo ${fmt(h.taxes.tourism)} · venta sin impuestos ${fmt(h.taxes.base)}</p>` : ''}
        ${h.by_company?.length ? `<div class="legend plain">${h.by_company.map((c) => `<span>${esc(c.k)}: <b>${fmt(c.t)}</b></span>`).join('')}</div>` : ''}
        ${h.by_kind.length ? `<div class="legend plain">${h.by_kind.map((k) => `<span>${kindLabel[k.k] || k.k}: <b>${fmt(k.t)}</b></span>`).join('')}</div>` : ''}
        ${h.by_user.length ? `<details><summary>Por quién registró</summary><ul class="list">${h.by_user.map((u) => `<li><div class="d">${esc(u.k)}<small>${u.n} cobro${u.n > 1 ? 's' : ''}</small></div><span class="m">${fmt(u.t)}</span><span></span></li>`).join('')}</ul></details>` : ''}
        <a class="btn ghost" href="#/hotel/${h.id}/contabilidad">Ver movimientos de ${esc(h.name.replace('Hostal ', ''))}</a>
      </article>`;
    }).join('')}</section>
    <p class="hint">Los ingresos son dinero recibido: lo que quedó pendiente se suma el día en que se paga. La ocupación usa las noches vendidas (pagadas o pendientes) sobre las disponibles. Los montos anulados no cuentan.</p>`;
  app.querySelectorAll('[data-period]').forEach((b) => { b.onclick = () => { LS.set('ch-period', b.dataset.period); render(); }; });
}

// ================= RECEPCIÓN =================
async function viewRecepcion(h) {
  const today = hnDate();
  const [rooms, sales, pending] = await Promise.all([
    api('GET', `/api/hotels/${h.id}/rooms`),
    api('GET', `/api/hotels/${h.id}/sales?from=${today}&to=${today}`),
    api('GET', `/api/hotels/${h.id}/pending`),
  ]);
  const cnt = { libre: 0, ocupada: 0, por_limpiar: 0, limpiando: 0, bloqueada: 0 };
  rooms.forEach((r) => cnt[r.status]++);
  const live = sales.filter((s) => !s.voided_at && s.pay !== 'Pendiente');
  const total = live.reduce((a, s) => a + s.amount, 0);
  const byPay = {}; live.forEach((s) => { byPay[s.pay] = (byPay[s.pay] || 0) + s.amount; });
  const now = Date.now();

  app.innerHTML = header({ hotel: h, view: 'recepcion' }) + `
    <div class="tiles status">
      ${['libre', 'ocupada', 'por_limpiar', 'limpiando', 'bloqueada'].map((k) => `<div class="tile s-${k}"><b>${cnt[k]}</b><span>${statusLabel[k]}</span></div>`).join('')}
    </div>
    <section>
      <div class="sec-head"><h2>Habitaciones</h2><span class="hint">Salida automática a las ${esc(h.checkout_time)}</span></div>
      <div class="board">${rooms.map((r) => {
        let due = '';
        if (r.status === 'ocupada') {
          const late = r.due_out_at <= now;
          if (r.kind === 'hora') due = `<span class="due ${late ? 'late' : ''}">${late ? 'Tiempo vencido' : 'Hasta ' + hnTime(r.due_out_at)}</span>`;
          else if (hnDate(r.due_out_at) === today) due = `<span class="due">Sale hoy ${hnTime(r.due_out_at)}</span>`;
          else due = `<span class="due" style="color:var(--muted)">Sale ${hnShort(r.due_out_at)}</span>`;
        }
        if (r.status === 'limpiando' && r.cleaning_by) due = `<span class="who">${esc(r.cleaning_by)}</span>`;
        return `<button class="key k-${r.status}" data-room="${r.id}" aria-label="Habitación ${esc(r.number)}, ${statusLabel[r.status]}">
          ${r.open_issues ? '<span class="issue" title="Problema reportado"></span>' : ''}
          <span class="num">${esc(r.number)}</span><span class="tag t-${r.status}">${statusLabel[r.status]}</span>
          ${r.status === 'ocupada' ? `<span class="who">${esc(r.guest)}</span>` : ''}${due}
          ${r.pending_balance > 0 ? `<span class="owe">Debe ${fmt(r.pending_balance)}</span>` : ''}
        </button>`;
      }).join('')}</div>
    </section>
    ${pendingPanel(pending)}
    <section class="panel">
      <div class="sec-head"><h2>Caja de hoy</h2><b style="font-family:var(--display);font-size:24px">${fmt(total)}</b></div>
      <p class="hint" style="margin-top:-6px">Dinero recibido hoy. Lo que quedó pendiente no suma hasta que se pague.</p>
      <div class="alerts">${Object.entries(byPay).map(([k, v]) => `<span class="tag t-info">${esc(k)} ${fmt(v)}</span>`).join('')}</div>
      <ul class="list">${sales.length ? sales.map((s) => saleRow(s, true)).join('') : '<li class="empty" style="display:block">Sin cobros hoy. Cada entrada o ingreso que registres aparece aquí.</li>'}</ul>
      <button class="btn ghost" id="extra">+ Registrar otro ingreso</button>
    </section>`;

  app.querySelectorAll('[data-room]').forEach((b) => { b.onclick = () => roomSheet(h, rooms.find((r) => r.id === +b.dataset.room)); });
  $('extra').onclick = () => extraSheet(h);
  bindVoid(h);
  bindPending(h, pending);
  bindProofs();
  autoRefresh();
}

// ---------------- Pagos pendientes ----------------
function pendingPanel(list) {
  if (!list.length) return '';
  const total = list.reduce((a, p) => a + p.balance, 0);
  return `<section class="panel pend-panel">
    <div class="sec-head"><h2>Pagos pendientes</h2><b class="owe-total">${fmt(total)}</b></div>
    <ul class="list">${list.map((p) => {
      const pct = p.nights ? (p.paid_nights / p.nights) * 100 : (p.paid_amount / p.amount) * 100;
      return `<li class="pend-item"><div class="d"><b>${esc(p.concept.replace(/^Hab\. /, 'Hab. '))}</b>
        <small>${p.nights ? `${p.paid_nights} de ${p.nights} noches pagadas · ` : ''}desde ${hnShort(p.ts)}${p.days ? ` · hace ${p.days} día${p.days > 1 ? 's' : ''}` : ''}</small>
        <div class="progress"><span style="width:${pct}%"></span></div></div>
        <span class="m">${fmt(p.balance)}</span>
        <button class="mini primary" data-pay="${p.id}">Registrar pago</button></li>`;
    }).join('')}</ul>
  </section>`;
}
function bindPending(h, list) {
  app.querySelectorAll('[data-pay]').forEach((b) => { b.onclick = () => paySheet(h, list.find((p) => p.id === +b.dataset.pay)); });
}
function bindProofs(root = app) {
  root.querySelectorAll('[data-proof]').forEach((b) => {
    b.onclick = async () => {
      try {
        const res = await api('GET', `/api/sales/${b.dataset.proof}/proof`, undefined, { raw: true });
        const url = URL.createObjectURL(await res.blob());
        sheet(`<h3>Comprobante</h3><img class="photo" style="max-height:70vh" src="${url}" alt="Comprobante de pago"><button class="btn ghost" id="c">Cerrar</button>`, () => { $('c').onclick = closeSheet; });
      } catch (e) { toast(e.message); }
    };
  });
}
function paySheet(h, p) {
  const byNight = p.nights > 0;
  const per = byNight ? p.amount / p.nights : 0;
  const methods = me.pay_now || ['Efectivo', 'Tarjeta', 'Transferencia'];
  sheet(`<h3>Registrar pago</h3>
    <p><b>${esc(p.concept)}</b></p>
    <div class="kpis">
      <div><span>Total</span><b>${fmt(p.amount)}</b></div>
      <div><span>Saldo</span><b>${fmt(p.balance)}</b></div>
      ${byNight ? `<div><span>Noches pagadas</span><b>${p.paid_nights} de ${p.nights}</b></div><div><span>Precio por noche</span><b>${fmt(Math.round(per))}</b></div>` : ''}
    </div>
    ${p.payments.length ? `<details><summary>Pagos anteriores (${p.payments.length})</summary><ul class="list">${p.payments.map((x) => `<li><div class="d">${hnShort(x.ts)} · ${esc(x.pay)}${x.paid_nights ? ` · ${x.paid_nights} noche${x.paid_nights > 1 ? 's' : ''}` : ''}<small>${esc(x.by_name || '')}</small></div><span class="m">${fmt(x.amount)}</span>${x.has_proof ? `<button class="mini" data-proof="${x.id}">Comprobante</button>` : '<span></span>'}</li>`).join('')}</ul></details>` : ''}
    ${byNight ? `<label>¿Cuántas noches está pagando?
      <div class="stepper"><button type="button" id="nm" aria-label="Menos">−</button><input id="f-n" type="number" inputmode="numeric" min="1" max="${p.nights_left}" value="${p.nights_left}"><button type="button" id="np" aria-label="Más">+</button></div></label>` : ''}
    <label>Monto recibido (L)<input id="f-a" type="number" inputmode="decimal" step="any" min="0" value="${p.balance}"></label>
    <label>¿Cómo pagó?<select id="f-m">${methods.map((m) => `<option ${m === 'Transferencia' ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
    <label id="phL">Foto del comprobante <span id="phReq">(obligatoria para transferencia)</span>
      <input id="f-ph" type="file" accept="image/*"></label>
    <img id="prev" class="photo" alt="" hidden>
    <div class="calc" id="calc"></div><div class="err" id="err"></div>
    <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn" id="ok">Registrar pago</button></div>`, () => {
    bindProofs($('sheetHost'));
    const upd = () => {
      if (byNight) {
        const n = Math.min(p.nights_left, Math.max(1, Math.floor(+$('f-n').value || 1)));
        $('f-a').value = n === p.nights_left ? p.balance : Math.round(per * n * 100) / 100;
      }
      const a = +$('f-a').value || 0;
      const rest = Math.max(0, p.balance - a);
      const nLeft = byNight ? p.nights_left - Math.min(p.nights_left, +$('f-n').value || 0) : 0;
      $('calc').innerHTML = rest <= 0.009 ? '<b>Queda saldado.</b>' : `Quedará un saldo de <b>${fmt(rest)}</b>${byNight ? ` (${nLeft} noche${nLeft === 1 ? '' : 's'} por pagar)` : ''}.`;
      $('phReq').textContent = $('f-m').value === 'Transferencia' ? '(obligatoria para transferencia)' : $('f-m').value === 'PayPal' ? '(recomendada: captura del pago de PayPal)' : '(opcional)';
    };
    if (byNight) {
      $('f-n').oninput = upd;
      $('nm').onclick = () => { $('f-n').value = Math.max(1, (+$('f-n').value || 1) - 1); upd(); };
      $('np').onclick = () => { $('f-n').value = Math.min(p.nights_left, (+$('f-n').value || 0) + 1); upd(); };
    }
    $('f-a').oninput = () => { const a = +$('f-a').value || 0; const rest = Math.max(0, p.balance - a); $('calc').innerHTML = rest <= 0.009 ? '<b>Queda saldado.</b>' : `Quedará un saldo de <b>${fmt(rest)}</b>.`; };
    $('f-m').onchange = upd;
    $('f-ph').onchange = () => { const f = $('f-ph').files[0]; if (f) { $('prev').src = URL.createObjectURL(f); $('prev').hidden = false; } };
    upd();
    $('c').onclick = closeSheet;
    $('ok').onclick = (e) => act(e.target, async () => {
      if ($('f-m').value === 'Transferencia' && !$('f-ph').files[0]) throw new Error('Sube la foto del comprobante de la transferencia.');
      const fd = new FormData();
      fd.append('pay', $('f-m').value);
      fd.append('amount', $('f-a').value);
      if (byNight) fd.append('nights', $('f-n').value);
      const f = $('f-ph').files[0];
      if (f) fd.append('photo', await shrink(f, 2000));
      await api('POST', `/api/sales/${p.id}/payments`, fd);
    }, 'Pago registrado');
  });
}

const usdFmt = (v) => Number(v || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function saleRow(s, canVoid) {
  const v = !!s.voided_at;
  const pend = s.pay === 'Pendiente';
  const tag = pend ? (s.settled_at ? ' <span class="tag t-ok">Pagado</span>' : ' <span class="tag t-warn">Pendiente</span>') : '';
  const acts = [s.proof_key ? `<button class="mini" data-proof="${s.id}">Comprobante</button>` : '', canVoid && !v && ['Efectivo', 'Tarjeta', 'Transferencia', 'PayPal', 'Orden de compra'].includes(s.pay) ? `<button class="mini" data-repay="${s.id}" data-cur="${esc(s.pay)}">Cambiar pago</button>` : '', canVoid && !v ? `<button class="mini" data-void="${s.id}">Anular</button>` : ''].join('');
  return `<li class="${v ? 'void' : ''} ${pend ? 'is-pend' : ''}"><div class="d">${esc(s.concept)}${tag}<small>${hnTime(s.ts)} · ${esc(s.pay)}${s.usd_amount != null ? ` US$ ${usdFmt(s.usd_amount)} × ${s.fx_rate}${s.fx_status === 0 ? ' (estimada)' : ''}` : ''}${s.po ? ' #' + esc(s.po) : ''}${s.kind === 'abono' && s.paid_nights ? ` · ${s.paid_nights} noche${s.paid_nights > 1 ? 's' : ''}` : ''} · ${esc(s.by_name || '—')}${v ? ` · anulado por ${esc(s.voided_by_name || '')}: ${esc(s.void_reason || '')}` : ''}</small></div>
    <span class="m">${fmt(s.amount)}</span><span class="acts">${acts}</span></li>`;
}
function bindVoid(h) {
  app.querySelectorAll('[data-repay]').forEach((b) => { b.onclick = () => repaySheet(h, b.dataset.repay, b.dataset.cur); });
  app.querySelectorAll('[data-void]').forEach((b) => {
    b.onclick = () => sheet(`<h3>Anular movimiento</h3><p class="hint">Queda tachado en el registro con tu nombre y el motivo. No se borra.</p>
      <label>Motivo<input id="f-r" placeholder="Ej. cobro duplicado"></label><div class="err" id="err"></div>
      <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn warn" id="ok">Anular</button></div>`, () => {
      $('c').onclick = closeSheet;
      $('ok').onclick = (e) => act(e.target, () => api('POST', `/api/sales/${b.dataset.void}/void`, { reason: $('f-r').value }), 'Movimiento anulado');
    });
  });
}

// Tipos de habitación y tarifas (clientes vs. empresas de crédito)
const roomTypes = (h) => [...new Set([...Object.keys(h.rates || {}), ...Object.keys(h.company_rates || {})])];
const isCredit = (h, co) => !!co && (h.companies || []).some((x) => x.toLowerCase() === String(co).trim().toLowerCase());
const typeRate = (h, t, credit) => {
  const v = credit ? h.company_rates?.[t] : h.rates?.[t];
  return Number.isFinite(v) ? v : null;
};

// ---------------- Calendario de estadía ----------------
// Marca los días que se queda el huésped. mode 'end': la entrada es fija y se toca el día de salida.
// mode 'range': se toca el día de entrada y luego el de salida (para reservas de días anteriores).
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function stayCalendar(el, { start, end, mode = 'end', maxStart = null, maxNights = 120, onChange }) {
  let s = start; let e = end; let picking = 'end';
  let view = s.slice(0, 7);
  const today = hnDate();
  const shiftMonth = (ym, k) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + k, 1)); return d.toISOString().slice(0, 7); };
  const nightsOf = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
  const draw = () => {
    const first = `${view}-01`;
    const offset = (parseD(first).getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(+view.slice(0, 4), +view.slice(5, 7), 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push('<span class="cd blank"></span>');
    for (let d = 1; d <= days; d++) {
      const iso = `${view}-${String(d).padStart(2, '0')}`;
      let off = false;
      if (mode === 'end') off = iso <= s || nightsOf(s, iso) > maxNights;
      else off = (iso > s && nightsOf(s, iso) > maxNights) || (iso <= s && maxStart && iso > maxStart);
      const cls = ['cd', iso === s ? 'st' : '', iso === e ? 'en' : '', iso > s && iso < e ? 'in' : '', iso === today ? 'td' : '', off && iso !== s && iso !== e ? 'off' : ''].join(' ');
      const tag = iso === s ? '<i>Entra</i>' : iso === e ? '<i>Sale</i>' : '';
      cells.push(`<button type="button" class="${cls}" data-day="${iso}" ${off && iso !== s && iso !== e ? 'disabled' : ''} aria-label="${hnDay(parseD(iso))}${tag ? ', ' + tag.replace(/<\/?i>/g, '') : ''}">${d}${tag}</button>`);
    }
    const n = nightsOf(s, e);
    el.innerHTML = `<div class="cal">
      <div class="cal-head"><button type="button" class="mini" data-mv="-1" aria-label="Mes anterior">‹</button><b>${MONTH_NAMES[+view.slice(5, 7) - 1]} ${view.slice(0, 4)}</b><button type="button" class="mini" data-mv="1" aria-label="Mes siguiente">›</button></div>
      <div class="cal-grid">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((w) => `<span class="cw">${w}</span>`).join('')}${cells.join('')}</div>
      <p class="hint cal-foot">${mode === 'range' && picking === 'end' ? 'Ahora toca el día de salida.' : mode === 'range' ? 'Toca el día de entrada y luego el de salida.' : 'Toca el día en que se va.'} <b>${n} noche${n === 1 ? '' : 's'}</b> · del ${hnShort(parseD(s))} al ${hnShort(parseD(e))}</p>
    </div>`;
  };
  el.addEventListener('click', (ev) => {
    const mv = ev.target.closest('[data-mv]');
    if (mv) { view = shiftMonth(view, +mv.dataset.mv); draw(); return; }
    const b = ev.target.closest('[data-day]');
    if (!b || b.disabled) return;
    const d = b.dataset.day;
    if (mode === 'end') { if (d > s) e = d; }
    else if (picking === 'start' && d > s && maxStart && d > maxStart) { e = d; } // solo cambia la salida
    else if (picking === 'start' || d <= s) {
      if (maxStart && d > maxStart) return;
      s = d; e = addDays(d, 1); picking = 'end';
    } else { e = d; picking = 'start'; }
    draw(); onChange?.(s, e);
  });
  draw();
  return {
    set(ns, ne) { s = ns; e = ne; if (e.slice(0, 7) !== view && s.slice(0, 7) !== view) view = s.slice(0, 7); draw(); },
  };
}

function roomSheet(h, r) {
  const issueBtn = '<button class="btn ghost" id="issue">Reportar un problema</button>';
  if (r.status === 'libre') {
    const hourOK = !!h.allow_hourly;
    sheet(`<h3>Entrada · Hab. ${esc(r.number)}</h3>
      ${stayAgainBtn(h, r)}
      <label>Nombre del huésped<input id="f-g" autocomplete="off"></label>
      <label>Empresa (si es a crédito o por convenio)<input id="f-co" list="companies" autocomplete="off" placeholder="Opcional">
        <datalist id="companies">${(h.companies || []).map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
      ${hourOK ? `<div class="seg" role="group" aria-label="Tipo"><button type="button" id="ty-n" aria-pressed="true">Por noche</button><button type="button" id="ty-h" aria-pressed="false">Por hora</button></div>` : ''}
      <div id="g-n" class="stack">
        ${roomTypes(h).length ? `<div class="seg types" role="group" aria-label="Tipo de habitación">${roomTypes(h).map((t, i) => `<button type="button" data-type="${esc(t)}" aria-pressed="${i === 0}">${esc(t)}<small data-tprice="${esc(t)}"></small></button>`).join('')}</div>` : ''}
        <div class="seg stay" role="group" aria-label="Duración">${[[1, '1 noche'], [2, '2'], [3, '3'], [7, '1 semana'], [30, '1 mes']].map(([n, l]) => `<button type="button" data-nights="${n}" aria-pressed="${n === 1}">${l}</button>`).join('')}</div>
        <label>Noches<input id="f-n" type="number" min="1" max="120" value="1" inputmode="numeric"></label>
        <input id="f-out" type="hidden" value="${addDays(hnDate(), 1)}">
        <div id="cal"></div>
        <label>Precio por noche (L)<input id="f-p" type="number" min="0" step="any" inputmode="decimal" value="${LS.get('ch-rate-' + h.id, '')}"></label>
        <p class="hint" id="rateHint"></p>
        ${h.tax_isv || h.tax_tourism ? `<p class="hint">Precio con ISV ${h.tax_isv}% y Turismo ${h.tax_tourism}% incluidos.</p>` : ''}
      </div>
      <div class="row" id="g-h" hidden><label>Horas<input id="f-h" type="number" min="1" value="${LS.get('ch-hours', 3)}" inputmode="numeric"></label>
        <label>Monto a cobrar (L)<input id="f-hm" type="number" min="0" step="any" inputmode="decimal" value="${LS.get('ch-hamt', '')}"></label></div>
      ${payFields(h)}
      <div class="calc" id="calc"></div><div class="err" id="err"></div>
      <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn" id="ok">Registrar entrada</button></div>
      ${issueBtn}`, () => {
      let hourly = false;
      let roomType = roomTypes(h)[0] || null;
      // Varios días: noches, fecha de salida y atajos se mantienen sincronizados
      const today = hnDate();
      const syncChips = () => $('sheetHost').querySelectorAll('[data-nights]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.nights === +$('f-n').value)));
      const cal = stayCalendar($('cal'), {
        start: today, end: addDays(today, 1),
        onChange: (st, en) => { const n = Math.round((parseD(en) - parseD(st)) / 86400000); $('f-n').value = n; $('f-out').value = en; syncChips(); upd(); },
      });
      const setNights = (n) => {
        n = Math.min(120, Math.max(1, Math.floor(+n || 1)));
        $('f-n').value = n; $('f-out').value = addDays(today, n); cal.set(today, addDays(today, n)); syncChips(); upd();
      };
      $('sheetHost').querySelectorAll('[data-nights]').forEach((b) => { b.onclick = () => setNights(b.dataset.nights); });
      // Precio según tipo: tarifa de empresa si es empresa de crédito; si no, tarifa de clientes; si no hay, el último usado para ese tipo.
      const applyRate = (fromTypeClick) => {
        const credit = isCredit(h, $('f-co').value);
        const hidePrice = credit && !has(h.id, 'contabilidad'); // recepción no ve precios de empresas
        $('f-p').closest('label').hidden = hidePrice;
        $('sheetHost').querySelectorAll('[data-tprice]').forEach((el) => {
          const v = typeRate(h, el.dataset.tprice, credit);
          el.textContent = v !== null ? fmt(v) : '';
        });
        const v = roomType ? typeRate(h, roomType, credit) : null;
        if (v !== null) $('f-p').value = v;
        else if (fromTypeClick) $('f-p').value = LS.get(`ch-rate-${h.id}-${roomType}`, $('f-p').value);
        const tax = h.tax_isv || h.tax_tourism ? ` Impuestos incluidos (ISV ${h.tax_isv}% y Turismo ${h.tax_tourism}%).` : '';
        $('rateHint').textContent = (hidePrice ? 'Empresa de crédito: el sistema aplica su tarifa.' : credit ? `Tarifa de empresa de crédito.` : (v !== null ? 'Tarifa de clientes.' : 'Cliente: escribe el precio acordado.')) + tax;
        upd();
      };
      $('sheetHost').querySelectorAll('[data-type]').forEach((t) => {
        t.onclick = () => {
          roomType = t.dataset.type;
          $('sheetHost').querySelectorAll('[data-type]').forEach((x) => x.setAttribute('aria-pressed', x === t));
          applyRate(true);
        };
      });
      // Si es empresa de crédito: tarifa de empresa y pago pendiente
      $('f-co').oninput = () => applyRate(false);
      $('f-co').onchange = () => {
        if (isCredit(h, $('f-co').value) && $('f-pay').value === 'Efectivo') { $('f-pay').value = 'Pendiente'; $('f-pay').dispatchEvent(new Event('change')); }
        applyRate(false);
      };
      setTimeout(() => applyRate(true), 0);
      const upd = () => {
        if (hourly) {
          const hrs = Math.max(1, +$('f-h').value || 1);
          $('calc').textContent = `Total: ${fmt(+$('f-hm').value || 0)} · Hasta las ${hnTime(Date.now() + hrs * 3600000)} · la salida se registra a mano`;
        } else {
          const n = Math.max(1, +$('f-n').value || 1);
          const hidden = $('f-p').closest('label').hidden;
          $('calc').innerHTML = `${n} noche${n > 1 ? 's' : ''} · sale ${hnDay(parseD(addDays(hnDate(), n)))}, ${h.checkout_time}${hidden ? ' · tarifa de empresa' : ` · <b>Total ${fmt(n * (+$('f-p').value || 0))}</b>`}`;
        }
      };
      const setType = (x) => { hourly = x; $('g-n').hidden = x; $('g-h').hidden = !x; $('ty-n').setAttribute('aria-pressed', !x); $('ty-h').setAttribute('aria-pressed', x); upd(); };
      if (hourOK) { $('ty-n').onclick = () => setType(false); $('ty-h').onclick = () => setType(true); }
      ['f-p', 'f-h', 'f-hm'].forEach((id) => { $(id).oninput = upd; });
      $('f-n').oninput = () => { const n = Math.floor(+$('f-n').value || 0); if (n >= 1) { const m = Math.min(120, n); $('f-out').value = addDays(today, m); cal.set(today, addDays(today, m)); syncChips(); } upd(); };
      upd(); bindPay();
      if ($('again')) $('again').onclick = () => extendAgainSheet(h, r);
      $('c').onclick = closeSheet;
      $('issue').onclick = () => issueSheet(h, r);
      $('ok').onclick = (e) => act(e.target, async () => {
        const b = { room_id: r.id, guest: $('f-g').value, company: $('f-co').value.trim() || undefined, ...payBody() };
        if (hourly) { Object.assign(b, { kind: 'hora', hours: +$('f-h').value, amount: +$('f-hm').value }); LS.set('ch-hours', +$('f-h').value); LS.set('ch-hamt', +$('f-hm').value); }
        else {
          const hidePrice = $('f-p').closest('label').hidden;
          if (!hidePrice && !(+$('f-p').value > 0)) throw new Error('Escribe el precio por noche.');
          Object.assign(b, { kind: 'noche', nights: +$('f-n').value, rate: hidePrice ? undefined : +$('f-p').value, room_type: roomType || undefined });
          LS.set('ch-rate-' + h.id, +$('f-p').value);
          if (roomType && !isCredit(h, $('f-co').value)) LS.set(`ch-rate-${h.id}-${roomType}`, +$('f-p').value);
        }
        await api('POST', `/api/hotels/${h.id}/checkin`, b);
      }, `Entrada registrada en la ${r.number}`);
    });
  } else if (r.status === 'ocupada') {
    const isH = r.kind === 'hora';
    sheet(`<h3>Hab. ${esc(r.number)}${isH ? ' · por hora' : ''}</h3>
      <p><b>${esc(r.guest)}</b></p>
      <p class="hint">Entró ${hnShort(r.check_in_at)} ${hnTime(r.check_in_at)} · ${isH ? 'Hasta las ' + hnTime(r.due_out_at) + ' (salida manual)' : 'Salida automática ' + hnDay(r.due_out_at) + ', ' + hnTime(r.due_out_at)}${r.pay ? ' · Pagó con ' + esc(r.pay) : ''}</p>
      ${r.pending_balance > 0 ? `<button class="btn" id="payNow">Debe ${fmt(r.pending_balance)} · Registrar pago</button>` : ''}
      ${extendForm(h, r, isH)}
      <div class="err" id="err"></div>
      <button class="btn" id="ext">${isH ? 'Cobrar y agregar' : 'Cobrar y extender'}</button>
      <button class="btn ghost" id="edit">Editar fechas o forma de pago</button>
      <button class="btn warn" id="out">Registrar salida ahora</button>
      <div class="row"><button class="btn ghost" id="c">Cerrar</button></div>
      ${issueBtn}`, () => {
      bindExtend(h, r, isH, r.due_out_at, r.stay_id, isH ? 'Tiempo agregado' : 'Estadía extendida');
      $('edit').onclick = () => editStaySheet(h, r);
      $('c').onclick = closeSheet;
      $('issue').onclick = () => issueSheet(h, r);
      if ($('payNow')) $('payNow').onclick = async () => {
        const list = await api('GET', `/api/hotels/${h.id}/pending`);
        const p = list.find((x) => x.stay_id === r.stay_id);
        if (p) paySheet(h, p); else toast('No encontré la cuenta pendiente.');
      };
      $('out').onclick = (e) => act(e.target, () => api('POST', `/api/stays/${r.stay_id}/checkout`), `Hab. ${r.number} enviada a limpieza`);
    });
  } else {
    const msg = {
      por_limpiar: 'Esperando a limpieza. El personal de limpieza ya recibió el aviso.',
      limpiando: `Se está limpiando${r.cleaning_by ? ' (' + esc(r.cleaning_by) + ')' : ''}.`,
      bloqueada: 'Bloqueada por un problema reportado. Se libera cuando el problema se marque como resuelto.',
    }[r.status];
    sheet(`<h3>Hab. ${esc(r.number)} · ${statusLabel[r.status]}</h3><p class="hint">${msg}</p>
      ${r.open_issues ? `<a class="btn ghost" href="#/hotel/${h.id}/problemas">Ver problemas (${r.open_issues})</a>` : ''}
      ${has(h.id, 'limpieza') && r.status !== 'bloqueada' ? `<button class="btn" id="cl">${r.status === 'limpiando' ? 'Marcar limpia' : 'Empezar limpieza'}</button>` : ''}
      ${stayAgainBtn(h, r)}
      <div class="err" id="err"></div>
      <div class="row"><button class="btn ghost" id="c">Cerrar</button></div>${issueBtn}`, () => {
      $('c').onclick = closeSheet;
      if ($('again')) $('again').onclick = () => extendAgainSheet(h, r);
      $('issue').onclick = () => issueSheet(h, r);
      if ($('cl')) $('cl').onclick = (e) => act(e.target, () => api('POST', `/api/rooms/${r.id}/clean/${r.status === 'limpiando' ? 'finish' : 'start'}`), 'Listo');
    });
  }
}

// ---- Extender estadía (también cuando el huésped decide quedarse después de la salida de hoy) ----
function extendForm(h, r, isH, credit = r.credit, rate = r.rate) {
  if (isH) return `<h3 style="font-size:17px;margin-top:6px">Agregar tiempo</h3>
    <div class="row"><label>Horas extra<input id="f-x" type="number" min="1" value="1" inputmode="numeric"></label><label>Monto (L)<input id="f-xm" type="number" min="0" step="any" inputmode="decimal"></label></div>
    ${payFields(h)}`;
  const price = rate ?? h.default_rate;
  return `<h3 style="font-size:17px;margin-top:6px">Extender estadía</h3>
    <div class="seg stay" role="group" aria-label="Noches extra">${[[1, '+1 noche'], [2, '+2'], [3, '+3'], [7, '+1 semana']].map(([n, l]) => `<button type="button" data-xn="${n}" aria-pressed="${n === 1}">${l}</button>`).join('')}</div>
    <div class="row"><label>Noches extra<input id="f-x" type="number" min="1" max="120" value="1" inputmode="numeric"></label>${credit ? '' : `<label>Precio por noche (L)<input id="f-xm" type="number" min="0" step="any" inputmode="decimal" value="${price ?? ''}"></label>`}</div>
    <div id="calx"></div>
    <p class="hint" id="xcalc"></p>
    ${credit ? '<p class="hint">Empresa de crédito: el sistema aplica su tarifa.</p>' : ''}
    ${payFields(h)}`;
}

function bindExtend(h, r, isH, dueAt, stayId, okMsg) {
  bindPay();
  if (!isH) {
    // Desde la salida actual (o desde hoy si ya pasó), se marcan las noches extra
    const from = hnDate(dueAt) < hnDate() ? hnDate() : hnDate(dueAt);
    const calc = () => {
      const n = Math.max(1, Math.floor(+$('f-x').value || 1));
      const pr = $('f-xm') ? +$('f-xm').value || 0 : 0;
      $('xcalc').innerHTML = `Nueva salida: <b>${hnDay(parseD(addDays(from, n)))}, ${h.checkout_time}</b>${$('f-xm') ? ` · Total ${fmt(n * pr)}` : ''}`;
      $('sheetHost').querySelectorAll('[data-xn]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.xn === n)));
    };
    const calx = stayCalendar($('calx'), {
      start: from, end: addDays(from, 1),
      onChange: (st, en) => { $('f-x').value = Math.round((parseD(en) - parseD(st)) / 86400000); calc(); },
    });
    const setN = (n) => { $('f-x').value = n; calx.set(from, addDays(from, n)); calc(); };
    $('sheetHost').querySelectorAll('[data-xn]').forEach((b) => { b.onclick = () => setN(+b.dataset.xn); });
    $('f-x').oninput = () => { const n = Math.floor(+$('f-x').value || 0); if (n >= 1) { calx.set(from, addDays(from, Math.min(120, n))); calc(); } };
    if ($('f-xm')) $('f-xm').oninput = calc;
    calc();
  }
  $('ext').onclick = (e) => act(e.target, () => {
    if (!isH && $('f-xm') && !(+$('f-xm').value > 0)) throw new Error('Escribe el precio por noche.');
    return api('POST', `/api/stays/${stayId}/extend`,
      isH ? { hours: +$('f-x').value, amount: +$('f-xm').value, ...payBody() } : { nights: +$('f-x').value, rate: $('f-xm') ? +$('f-xm').value : undefined, ...payBody() });
  }, okMsg);
}

function stayAgainBtn(h, r) {
  if (!r.last_stay || !has(h.id, 'recepcion')) return '';
  return `<button class="btn" id="again">${esc(r.last_stay.guest)} se queda más noches</button>
    <p class="hint">Salió hoy (${hnTime(r.last_stay.checked_out_at)}). Si sigue en la habitación, extiende su estadía aquí.</p>`;
}

function extendAgainSheet(h, r) {
  const ls = r.last_stay;
  sheet(`<h3>Hab. ${esc(r.number)} · extender</h3>
    <p><b>${esc(ls.guest)}</b></p>
    <p class="hint">La habitación vuelve a quedar ocupada y se cancela la limpieza pendiente.</p>
    ${extendForm(h, r, false, ls.credit, ls.rate)}
    <div class="err" id="err"></div>
    <button class="btn" id="ext">Cobrar y extender</button>
    <div class="row"><button class="btn ghost" id="c">Cerrar</button></div>`, () => {
    $('c').onclick = closeSheet;
    bindExtend(h, r, false, ls.checked_out_at, ls.id, `${ls.guest} sigue en la ${r.number}`);
  });
}

// ---- Editar una estadía en curso: fechas (calendario) y forma de pago ----
const EDIT_PAY = (h) => [...(me.pay_now || ['Efectivo', 'Tarjeta', 'Transferencia', 'PayPal']), ...(h.allow_po ? ['Orden de compra'] : [])];
function payPicker(h, current) {
  const opts = EDIT_PAY(h);
  return `<label>Forma de pago<select id="f-ep">${opts.map((m) => `<option ${m === current ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
    <label id="g-epo" ${current === 'Orden de compra' ? '' : 'hidden'}>Número de orden de compra<input id="f-epo" autocomplete="off"></label>
    <label id="g-eusd" ${current === 'PayPal' ? '' : 'hidden'}>Total cobrado en dólares (US$)<input id="f-eusd" type="number" min="0" step="any" inputmode="decimal" placeholder="Ej. 120"></label>
    <p class="note" id="n-eusd" ${current === 'PayPal' ? '' : 'hidden'}>Los lempiras salen de la tasa del día siguiente a la reserva.</p>`;
}
function bindPayPicker() {
  $('f-ep').onchange = () => {
    $('g-epo').hidden = $('f-ep').value !== 'Orden de compra';
    $('g-eusd').hidden = $('n-eusd').hidden = $('f-ep').value !== 'PayPal';
  };
}
function pickerBody(current) {
  const pay = $('f-ep').value;
  const b = { pay, po: $('f-epo').value };
  if (pay === 'PayPal') {
    if (+$('f-eusd').value > 0) b.usd = +$('f-eusd').value;
    else if (current !== 'PayPal') throw new Error('Escribe cuántos dólares pagó por PayPal.');
  }
  return b;
}
function editStaySheet(h, r) {
  const isH = r.kind === 'hora';
  const canPay = r.pay && EDIT_PAY(h).includes(r.pay);
  const s0 = hnDate(r.check_in_at), e0 = hnDate(r.due_out_at);
  const today = hnDate();
  sheet(`<h3>Editar · Hab. ${esc(r.number)}</h3>
    <p><b>${esc(r.guest)}</b></p>
    ${isH ? '' : `<p class="hint">Toca el día de entrada y luego el de salida. Si cambian las noches, el cobro se ajusta solo.</p><div id="cale"></div><p class="hint" id="ecalc"></p>`}
    ${canPay ? payPicker(h, r.pay) : r.pay === 'Pendiente' ? '<p class="hint">Pago pendiente: cuando pague, usa "Registrar pago" en la habitación.</p>' : ''}
    <div class="err" id="err"></div>
    <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn" id="ok">Guardar cambios</button></div>`, () => {
    $('c').onclick = () => roomSheet(h, r);
    if (canPay) bindPayPicker();
    let st = s0, en = e0;
    if (!isH) {
      const old = Math.round((parseD(e0) - parseD(s0)) / 86400000);
      const calc = () => {
        const n = Math.round((parseD(en) - parseD(st)) / 86400000);
        const d = n - old;
        const money = r.rate && !r.credit ? ` · ${d > 0 ? 'se cobra' : 'se descuenta'} ${fmt(Math.abs(d) * r.rate)}` : '';
        $('ecalc').innerHTML = `Entra <b>${hnShort(parseD(st))}</b> · sale <b>${hnDay(parseD(en))}, ${h.checkout_time}</b> · ${n} noche${n === 1 ? '' : 's'}${d ? ` (${d > 0 ? '+' : ''}${d}${money})` : ''}`;
        if (en < today) $('ecalc').innerHTML += '<br><b>La salida no puede ser antes de hoy.</b>';
      };
      stayCalendar($('cale'), { start: s0, end: e0, mode: 'range', maxStart: today, maxNights: 366, onChange: (a, b) => { st = a; en = b; calc(); } });
      calc();
    }
    $('ok').onclick = (e) => act(e.target, async () => {
      const b = {};
      if (!isH && (st !== s0 || en !== e0)) {
        if (en < today) throw new Error('La salida no puede ser antes de hoy. Si ya se fue, registra la salida.');
        Object.assign(b, { start: st, end: en });
      }
      if (canPay && ($('f-ep').value !== r.pay || +$('f-eusd').value > 0)) Object.assign(b, pickerBody(r.pay));
      if (!Object.keys(b).length) throw new Error('No cambiaste nada.');
      await api('PATCH', `/api/stays/${r.stay_id}`, b);
    }, 'Cambios guardados');
  });
}
function repaySheet(h, saleId, current) {
  sheet(`<h3>Cambiar forma de pago</h3><p class="hint">Queda registrado quién lo cambió.</p>
    ${payPicker(h, current)}<div class="err" id="err"></div>
    <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn" id="ok">Guardar</button></div>`, () => {
    bindPayPicker();
    $('c').onclick = closeSheet;
    $('ok').onclick = (e) => act(e.target, () => api('PATCH', `/api/sales/${saleId}`, pickerBody(current)), 'Forma de pago cambiada');
  });
}

// ---- PayPal en dólares (Contabilidad) ----
const FX_STATUS = { 0: ['t-warn', 'Estimada'], 1: ['t-info', 'Tasa día siguiente'], 2: ['t-ok', 'Lo que cayó'] };
function paypalPanel(pp) {
  if (!pp || !pp.items.length) return '';
  return `<section class="panel"><div class="sec-head"><h2>PayPal</h2><b style="font-family:var(--display);font-size:20px">US$ ${usdFmt(pp.usd)}</b></div>
    <p class="hint" style="margin-top:-6px">En lempiras: <b>${fmt(pp.lempiras)}</b>${pp.rate_now ? ` · Tasa más reciente: L ${pp.rate_now.rate} (${hnShort(parseD(pp.rate_now.date))})` : ''}.
    Cada reserva se pasa a lempiras con la tasa del día siguiente. Si cayó otro monto, toca <b>Ajustar</b>.</p>
    ${pp.estimated ? `<div class="alerts"><span class="tag t-warn">${pp.estimated} con tasa estimada: se actualiza sola mañana</span></div>` : ''}
    ${pp.without_usd ? `<div class="alerts"><span class="tag t-bad">${pp.without_usd} sin monto en dólares</span></div>` : ''}
    <ul class="list">${pp.items.map((x) => {
      const st = x.usd_amount == null ? ['t-bad', 'Falta US$'] : FX_STATUS[x.fx_status];
      return `<li><div class="d">${esc(x.concept)} <span class="tag ${st[0]}">${st[1]}</span><small>${hnShort(parseD(x.local_date))}${x.usd_amount != null ? ` · US$ ${usdFmt(x.usd_amount)} × ${x.fx_rate} (tasa del ${hnShort(parseD(x.fx_date))})` : ''}</small></div>
        <span class="m">${fmt(x.amount)}</span><span class="acts"><button class="mini" data-pp="${x.id}">Ajustar</button></span></li>`;
    }).join('')}</ul></section>`;
}
function bindPaypal(pp) {
  app.querySelectorAll('[data-pp]').forEach((b) => {
    b.onclick = () => {
      const x = pp.items.find((i) => i.id === +b.dataset.pp);
      sheet(`<h3>PayPal · ${esc(x.concept)}</h3>
        <p class="hint">Reserva del ${hnShort(parseD(x.local_date))}. El dinero cae con la tasa del ${hnShort(parseD(addDays(x.local_date, 1)))}.</p>
        <label>Monto en dólares (US$)<input id="f-u" type="number" min="0" step="any" inputmode="decimal" value="${x.usd_amount ?? ''}"></label>
        <label>Lempiras que cayeron (opcional)<input id="f-l" type="number" min="0" step="any" inputmode="decimal" placeholder="Déjalo vacío para usar la tasa del día siguiente"></label>
        <p class="hint" id="f-calc"></p>
        <div class="err" id="err"></div>
        <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn" id="ok">Guardar</button></div>`, () => {
        const calc = () => {
          const u = +$('f-u').value || 0, l = +$('f-l').value || 0;
          $('f-calc').textContent = u && l ? `Tasa real: L ${(l / u).toFixed(4)} por dólar` : u && x.fx_rate ? `Con la tasa ${x.fx_rate}: ${fmt(u * x.fx_rate)}` : '';
        };
        $('f-u').oninput = $('f-l').oninput = calc; calc();
        $('c').onclick = closeSheet;
        $('ok').onclick = (e) => act(e.target, () => {
          if (!(+$('f-u').value > 0)) throw new Error('Escribe el monto en dólares.');
          return api('POST', `/api/sales/${x.id}/usd`, { usd: +$('f-u').value, lempiras: $('f-l').value || undefined });
        }, 'PayPal actualizado');
      });
    };
  });
}

function extraSheet(h) {
  sheet(`<h3>Otro ingreso</h3>
    <label>Concepto<input id="f-c" placeholder="Desayuno, lavandería, bebidas…" autocomplete="off"></label>
    <label>Monto (L)<input id="f-m" type="number" min="0" step="any" inputmode="decimal"></label>
    ${payFields(h)}<div class="err" id="err"></div>
    <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn" id="ok">Registrar ingreso</button></div>`, () => {
    bindPay(); $('c').onclick = closeSheet;
    $('ok').onclick = (e) => act(e.target, () => api('POST', `/api/hotels/${h.id}/sales`, { concept: $('f-c').value, amount: +$('f-m').value, ...payBody() }), 'Ingreso registrado');
  });
}

function issueSheet(h, r) {
  sheet(`<h3>Problema en hab. ${esc(r.number)}</h3>
    <label>¿Qué pasa?<textarea id="f-d" placeholder="Ej. no sale agua caliente, foco quemado, mancha en el colchón"></textarea></label>
    <label>Foto (opcional)<input id="f-ph" type="file" accept="image/*" capture="environment"></label>
    <img id="prev" class="photo" alt="" hidden>
    <label class="check"><input id="f-b" type="checkbox"> No se puede usar la habitación hasta resolverlo</label>
    <div class="err" id="err"></div>
    <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn" id="ok">Reportar</button></div>`, () => {
    $('c').onclick = closeSheet;
    $('f-ph').onchange = () => { const f = $('f-ph').files[0]; if (f) { $('prev').src = URL.createObjectURL(f); $('prev').hidden = false; } };
    $('ok').onclick = (e) => act(e.target, async () => {
      const fd = new FormData();
      fd.append('description', $('f-d').value);
      fd.append('blocks', $('f-b').checked ? '1' : '0');
      const f = $('f-ph').files[0];
      if (f) fd.append('photo', await shrink(f));
      await api('POST', `/api/rooms/${r.id}/issues`, fd);
    }, 'Problema reportado');
  });
}
// Reduce la foto antes de subirla (ahorra datos y espacio).
async function shrink(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
    return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

// ================= LIMPIEZA =================
async function viewLimpieza(h) {
  const rooms = await api('GET', `/api/hotels/${h.id}/rooms`);
  const dirty = rooms.filter((r) => r.status === 'por_limpiar');
  const doing = rooms.filter((r) => r.status === 'limpiando');
  const today = hnDate();
  const soon = rooms.filter((r) => r.status === 'ocupada' && r.kind === 'noche' && hnDate(r.due_out_at) === today);
  const pushOn = await pushEnabled();
  app.innerHTML = header({ hotel: h, view: 'limpieza' }) + `
    ${!pushOn ? `<div class="banner"><span>Activa los avisos para saber cuándo una habitación queda por limpiar.</span><button class="mini primary" id="push">Activar avisos</button></div>` : ''}
    <section>
      <div class="sec-head"><h1>Por limpiar</h1><span class="tag t-por_limpiar">${dirty.length}</span></div>
      ${dirty.length ? dirty.map((r) => `<div class="task urgent"><span class="num">${esc(r.number)}</span><div><b>Lista para limpiar</b><p class="hint">Desde ${hnTime(r.updated_at)}</p></div><button class="btn" data-start="${r.id}">Empezar</button></div>`).join('')
        : '<p class="empty">No hay habitaciones esperando limpieza.</p>'}
    </section>
    ${doing.length ? `<section><h2>Limpiando</h2>${doing.map((r) => `<div class="task"><span class="num">${esc(r.number)}</span><div><b>${esc(r.cleaning_by || 'En limpieza')}</b><p class="hint">Desde ${r.cleaning_started_at ? hnTime(r.cleaning_started_at) : '—'}</p></div><button class="btn" data-finish="${r.id}">Terminé</button></div>`).join('')}</section>` : ''}
    ${soon.length ? `<section><h2>Salen hoy a las ${esc(h.checkout_time)}</h2><p class="hint">${soon.map((r) => 'Hab. ' + esc(r.number)).join(' · ')}</p></section>` : ''}
    <section>
      <h2>Todas las habitaciones</h2>
      <p class="hint">Toca una para reportar un problema.</p>
      <div class="board">${rooms.map((r) => `<button class="key k-${r.status}" data-issue="${r.id}">${r.open_issues ? '<span class="issue"></span>' : ''}<span class="num">${esc(r.number)}</span><span class="tag t-${r.status}">${statusLabel[r.status]}</span></button>`).join('')}</div>
    </section>`;
  if ($('push')) $('push').onclick = () => enablePush().then(() => softRefresh()).catch((e) => toast(e.message));
  app.querySelectorAll('[data-start]').forEach((b) => { b.onclick = () => act(b, () => api('POST', `/api/rooms/${b.dataset.start}/clean/start`), 'Limpieza iniciada'); });
  app.querySelectorAll('[data-finish]').forEach((b) => { b.onclick = () => act(b, () => api('POST', `/api/rooms/${b.dataset.finish}/clean/finish`), 'Habitación lista'); });
  app.querySelectorAll('[data-issue]').forEach((b) => { b.onclick = () => issueSheet(h, rooms.find((r) => r.id === +b.dataset.issue)); });
  autoRefresh();
}

// ================= PROBLEMAS =================
async function viewProblemas(h) {
  const estado = LS.get('ch-issue-filter', 'abierta');
  const list = await api('GET', `/api/hotels/${h.id}/issues?estado=${estado}`);
  const canResolve = has(h.id, 'mantenimiento', 'recepcion');
  app.innerHTML = header({ hotel: h, view: 'problemas' }) + `
    <div class="sec-head"><h1>Problemas</h1>
      <div class="seg" role="group"><button aria-pressed="${estado === 'abierta'}" data-f="abierta">Abiertos</button><button aria-pressed="${estado === 'resuelta'}" data-f="resuelta">Resueltos</button></div></div>
    <section class="panel"><ul class="list">${list.length ? list.map((i) => `
      <li><div class="d"><b>Hab. ${esc(i.room)}</b> ${i.blocks_room && i.status === 'abierta' ? '<span class="tag t-bloqueada">Bloquea</span>' : ''}<br>${esc(i.description)}
        <small>${hnShort(i.created_at)} ${hnTime(i.created_at)} · ${esc(i.created_by_name || '')}${i.status === 'resuelta' ? ` · resuelto por ${esc(i.resolved_by_name || '')}${i.resolution ? ': ' + esc(i.resolution) : ''}` : ''}</small></div>
        ${i.photo_key ? `<img class="thumb" data-photo="${i.id}" alt="Foto del problema">` : '<span></span>'}
        ${canResolve && i.status === 'abierta' ? `<button class="mini primary" data-resolve="${i.id}">Resuelto</button>` : '<span></span>'}</li>`).join('')
      : `<li class="empty" style="display:block">${estado === 'abierta' ? 'No hay problemas abiertos.' : 'Sin problemas resueltos todavía.'}</li>`}</ul></section>`;
  app.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => { LS.set('ch-issue-filter', b.dataset.f); render(); }; });
  app.querySelectorAll('[data-photo]').forEach(async (img) => {
    try {
      const res = await api('GET', `/api/issues/${img.dataset.photo}/photo`, undefined, { raw: true });
      img.src = URL.createObjectURL(await res.blob());
      img.onclick = () => sheet(`<img class="photo" style="max-height:70vh" src="${img.src}" alt=""><button class="btn ghost" id="c">Cerrar</button>`, () => { $('c').onclick = closeSheet; });
    } catch { img.alt = 'Foto no disponible'; }
  });
  app.querySelectorAll('[data-resolve]').forEach((b) => {
    b.onclick = () => sheet(`<h3>Marcar como resuelto</h3><label>¿Qué se hizo? (opcional)<input id="f-r"></label><div class="err" id="err"></div>
      <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn" id="ok">Resuelto</button></div>`, () => {
      $('c').onclick = closeSheet;
      $('ok').onclick = (e) => act(e.target, () => api('POST', `/api/issues/${b.dataset.resolve}/resolve`, { resolution: $('f-r').value }), 'Problema resuelto');
    });
  });
}

// ================= CONTABILIDAD =================
async function viewContabilidad(h) {
  const today = hnDate();
  const week = LS.get('ch-week-' + h.id, monday(today));
  const wk = week > monday(today) ? monday(today) : week;
  const end = addDays(wk, 6);
  const [fin, sales, pos, pending] = await Promise.all([
    api('GET', `/api/hotels/${h.id}/finance?from=${wk}&to=${end}`),
    api('GET', `/api/hotels/${h.id}/sales?from=${wk}&to=${end}`),
    h.allow_po ? api('GET', `/api/hotels/${h.id}/po`) : Promise.resolve([]),
    api('GET', `/api/hotels/${h.id}/pending`),
  ]);
  const days = [...Array(7)].map((_, i) => addDays(wk, i));
  const live = sales.filter((s) => !s.voided_at && s.pay !== 'Pendiente'); // dinero recibido
  const pays = me.pay.filter((p) => p !== 'Pendiente' && (p !== 'Orden de compra' || h.allow_po));
  const cell = (d, p) => live.filter((s) => s.local_date === d && s.pay === p).reduce((a, s) => a + s.amount, 0);
  const dayTot = (d) => live.filter((s) => s.local_date === d).reduce((a, s) => a + s.amount, 0);
  const max = Math.max(1, ...days.map(dayTot));
  const isCur = wk === monday(today);
  const kind = (k) => fin.by_kind.find((x) => x.k === k) || { t: 0, n: 0 };
  const poState = { en_curso: ['t-ok', 'En curso'], facturar: ['t-warn', 'Hacer factura'], facturada: ['t-info', 'Facturada'], vencida_30: ['t-bad', '30 días sin cobrar'] };

  app.innerHTML = header({ hotel: h, view: 'contabilidad' }) + `
    <div class="weeknav">
      <button class="btn ghost" id="wp" aria-label="Semana anterior">‹</button>
      <strong>${parseD(wk).getUTCDate()} – ${hnShort(parseD(end))} ${parseD(end).getUTCFullYear()}</strong>
      <button class="btn ghost" id="wn" aria-label="Semana siguiente" ${isCur ? 'disabled' : ''}>›</button>
    </div>
    <button class="btn ghost" id="past">+ Registrar reserva de días anteriores</button>
    <div class="tiles">
      <div class="tile"><span>Total semana</span><b>${fmt(fin.total)}</b></div>
      <div class="tile"><span>Promedio diario</span><b>${fmt(isCur ? fin.total / (days.filter((d) => d <= today).length || 1) : fin.avg_day)}</b></div>
      <div class="tile"><span>Noches vendidas</span><b>${fin.nights}</b></div>
      <div class="tile ${fin.pending_balance ? 's-por_limpiar' : ''}"><span>Por cobrar</span><b>${fmt(fin.pending_balance)}</b></div>
      ${h.allow_hourly ? `<div class="tile"><span>Por hora</span><b>${kind('hora').n}</b></div>` : ''}
      <div class="tile"><span>Extras</span><b>${fmt(kind('extra').t)}</b></div>
    </div>
    ${fin.taxes ? `<section class="panel">
      <div class="sec-head"><h2>Impuestos incluidos</h2><span class="hint">Sobre ${fmt(fin.total)} recibidos</span></div>
      <div class="kpis"><div><span>Venta sin impuestos</span><b>${fmt2(fin.taxes.base)}</b></div>
        <div><span>ISV ${fin.taxes.isv_pct}%</span><b>${fmt2(fin.taxes.isv)}</b></div>
        <div><span>Turismo ${fin.taxes.tourism_pct}%</span><b>${fmt2(fin.taxes.tourism)}</b></div></div>
    </section>` : ''}
    ${paypalPanel(fin.paypal)}
    ${fin.by_company.length ? `<section class="panel"><h2>Por empresa</h2><ul class="list">${fin.by_company.map((c) => `<li><div class="d">${esc(c.k)}<small>${c.nights} noche${c.nights === 1 ? '' : 's'} · ${c.n} registro${c.n > 1 ? 's' : ''}</small></div><span class="m">${fmt(c.t)}</span><span></span></li>`).join('')}</ul></section>` : ''}
    ${pendingPanel(pending)}
    ${h.allow_po ? `<section class="panel">
      <div class="sec-head"><h2>Órdenes de compra pendientes</h2><span class="hint">${pos.length} · ${fmt(pos.reduce((a, p) => a + p.amount, 0))}</span></div>
      <p class="hint">Aviso para facturar a los 15 días de la reserva y alerta a los 30 días si sigue sin cobrar.</p>
      <ul class="list po">${pos.length ? pos.map((p) => `<li><div class="d">#${esc(p.po)} · ${esc(p.concept)}<small>${hnShort(parseD(p.local_date))} · hace ${p.days} día${p.days === 1 ? '' : 's'} · <span class="tag ${poState[p.estado][0]}">${poState[p.estado][1]}</span></small></div>
        <span class="m">${fmt(p.amount)}</span><span class="acts">${p.po_invoiced_at ? '' : `<button class="mini" data-po="${p.id}" data-a="facturada">Facturada</button>`}<button class="mini primary" data-po="${p.id}" data-a="cobrada">Cobrada</button></span></li>`).join('')
        : '<li class="empty" style="display:block">No hay órdenes de compra pendientes.</li>'}</ul>
    </section>` : ''}
    <section class="panel">
      <h2>Ingresos por día</h2>
      <div class="bars">${days.map((d, i) => { const t = dayTot(d); return `<div class="bar ${d === today ? 'today' : ''} ${d > today ? 'future' : ''}"><span class="v">${t ? fmtShort(t) : ''}</span><div class="col" style="height:${Math.max(1.5, (t / max) * 100)}%"></div><span class="lb">${DOW[i]}</span></div>`; }).join('')}</div>
    </section>
    <section class="panel">
      <div class="sec-head"><h2>Control semanal</h2><button class="mini" id="csv" ${sales.length ? '' : 'disabled'}>Descargar CSV</button></div>
      <div class="tablewrap"><table>
        <thead><tr><th>Día</th>${pays.map((p) => `<th>${p === 'Orden de compra' ? 'O. compra' : p}</th>`).join('')}<th>Total</th></tr></thead>
        <tbody>${days.map((d, i) => `<tr class="${d === today ? 'is-today' : ''}"><td>${DOW[i]} ${parseD(d).getUTCDate()}</td>${pays.map((p) => { const v = cell(d, p); return `<td>${v ? fmt(v) : '–'}</td>`; }).join('')}<td><b>${dayTot(d) ? fmt(dayTot(d)) : '–'}</b></td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Semana</td>${pays.map((p) => `<td>${fmt(days.reduce((a, d) => a + cell(d, p), 0))}</td>`).join('')}<td>${fmt(fin.total)}</td></tr></tfoot>
      </table></div>
    </section>
    <section class="panel">
      <h2>Por recepcionista</h2>
      <ul class="list">${fin.by_user.length ? fin.by_user.map((u) => `<li><div class="d">${esc(u.k)}<small>${u.n} movimiento${u.n > 1 ? 's' : ''}</small></div><span class="m">${fmt(u.t)}</span><span></span></li>`).join('') : '<li class="empty" style="display:block">Sin registros esta semana.</li>'}</ul>
    </section>
    <section class="panel">
      <div class="sec-head"><h2>Movimientos</h2><span class="hint">Anular deja el registro tachado</span></div>
      <ul class="list">${days.slice().reverse().filter((d) => sales.some((s) => s.local_date === d)).map((d) => `<li class="dayh">${DOW[(parseD(d).getUTCDay() + 6) % 7]} ${parseD(d).getUTCDate()} · ${fmt(dayTot(d))}</li>` + sales.filter((s) => s.local_date === d).map((s) => saleRow(s, true)).join('')).join('') || '<li class="empty" style="display:block">No hay movimientos en esta semana.</li>'}</ul>
    </section>`;

  $('wp').onclick = () => { LS.set('ch-week-' + h.id, addDays(wk, -7)); render(); };
  $('wn').onclick = () => { LS.set('ch-week-' + h.id, addDays(wk, 7)); render(); };
  app.querySelectorAll('[data-po]').forEach((b) => { b.onclick = () => act(b, () => api('POST', `/api/sales/${b.dataset.po}/po`, { action: b.dataset.a }), b.dataset.a === 'cobrada' ? 'Orden cobrada' : 'Orden facturada'); });
  bindPending(h, pending);
  bindProofs();
  $('past').onclick = () => pastStaySheet(h);
  bindVoid(h);
  bindPaypal(fin.paypal);
  $('csv').onclick = () => {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Hotel', 'Fecha', 'Hora', 'Concepto', 'Habitación', 'Noches', 'Horas', 'Forma de pago', 'Orden de compra', 'Monto', 'Registrado por', 'Estado', 'Motivo anulación']]
      .concat(sales.slice().sort((a, b) => a.ts - b.ts).map((s) => [h.name, s.local_date, hnTime(s.ts), s.concept, s.room || '', s.nights || '', s.hours || '', s.pay, s.po || '', s.amount, s.by_name || '', s.voided_at ? 'Anulado' : 'Válido', s.void_reason || '']));
    const blob = new Blob(['﻿' + rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `ventas-${h.id}-semana-${wk}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
}

// ================= AVISOS =================
async function viewAvisos() {
  const list = await api('GET', '/api/notifications');
  app.innerHTML = header({ title: 'Avisos' }) + `
    <div class="sec-head"><h1>Avisos</h1>${list.some((n) => !n.read_at) ? '<button class="mini" id="read">Marcar todo como leído</button>' : ''}</div>
    <section class="panel"><ul class="list">${list.length ? list.map((n) => `<li><div class="d">${n.read_at ? '' : '<span class="tag t-warn">Nuevo</span> '}<b>${esc(n.title)}</b><small>${esc(n.body)} · ${hnShort(n.created_at)} ${hnTime(n.created_at)}</small></div><a class="mini" href="${esc(n.url || '#/')}">Ver</a><span></span></li>`).join('')
      : '<li class="empty" style="display:block">Aún no tienes avisos.</li>'}</ul></section>`;
  if ($('read')) $('read').onclick = async () => { await api('POST', '/api/notifications/read'); unread = 0; render(); };
  if (unread) { api('POST', '/api/notifications/read').then(() => { unread = 0; }).catch(() => {}); }
}

// ================= AVISOS PUSH =================
async function pushEnabled() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return true; // no aplica: no molestar
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription()) && Notification.permission === 'granted';
  } catch { return true; }
}
async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error(isIOS() ? 'En iPhone primero agrega la app a la pantalla de inicio y ábrela desde ahí.' : 'Este navegador no permite avisos.');
  }
  if (!me.vapidPublicKey) throw new Error('Los avisos aún no están configurados en el servidor.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('No diste permiso para avisos. Puedes activarlo en los ajustes del navegador.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(me.vapidPublicKey) });
  await api('POST', '/api/push/subscribe', { endpoint: sub.endpoint });
  toast('Avisos activados en este dispositivo');
}
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;

// ---------------- Instalar la app ----------------
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });
function installBanner() {
  if (isStandalone() || LS.get('ch-install-hide', false)) return '';
  const msg = isIOS() ? 'Instala la app: toca Compartir y luego "Agregar a pantalla de inicio".' : 'Instala la app en este dispositivo para abrirla como cualquier otra.';
  return `<div class="banner info" id="inst"><span>${msg}</span><span class="row" style="flex:0 0 auto">${!isIOS() ? '<button class="mini primary" id="instBtn">Instalar</button>' : ''}<button class="mini" id="instHide">Ocultar</button></span></div>`;
}
function bindInstall() {
  if ($('instHide')) $('instHide').onclick = () => { LS.set('ch-install-hide', true); $('inst').remove(); };
  if ($('instBtn')) $('instBtn').onclick = async () => {
    if (installEvt) { installEvt.prompt(); await installEvt.userChoice; installEvt = null; }
    else toast('Usa el menú del navegador: "Instalar app" o "Agregar a pantalla de inicio".');
  };
}

// ================= AJUSTES =================
async function viewAjustes() {
  const [keys, pushOn, tokens] = await Promise.all([
    api('GET', '/api/auth/passkeys'),
    pushEnabled(),
    me.user.is_owner ? api('GET', '/api/tokens') : Promise.resolve([]),
  ]);
  const roles = me.hotels.map((h) => `${esc(h.name)}: ${h.roles.map((r) => roleLabel[r]).join(', ')}`).join('<br>');
  app.innerHTML = header({ title: 'Ajustes' }) + `
    <h1>Ajustes</h1>
    <section class="panel">
      <h2>${esc(me.user.name)}</h2>
      <p class="hint">${esc(me.user.email)}${me.user.is_owner ? ' · Dueño' : ''}</p>
      <p class="hint">${me.user.is_owner ? 'Acceso a todos los hoteles.' : roles}</p>
    </section>
    <section class="panel">
      <h2>Huella o Face ID</h2>
      <p class="hint">Entra sin escribir códigos. Cada dispositivo se activa por separado.</p>
      <ul class="list">${keys.map((k) => `<li><div class="d">${esc(k.label || 'Dispositivo')}<small>Activada ${hnShort(k.created_at)}${k.last_used_at ? ' · último uso ' + hnShort(k.last_used_at) : ''}</small></div><span></span><button class="mini" data-delkey="${esc(k.id)}">Quitar</button></li>`).join('') || '<li class="empty" style="display:block">Ningún dispositivo activado.</li>'}</ul>
      ${window.PublicKeyCredential ? '<button class="btn" id="addKey">Activar en este dispositivo</button>' : '<p class="hint">Este navegador no permite huella o Face ID.</p>'}
    </section>
    <section class="panel">
      <h2>Avisos</h2>
      <p class="hint">${pushOn ? 'Los avisos están activados en este dispositivo.' : 'Recibe avisos de habitaciones por limpiar, problemas y órdenes de compra.'}${isIOS() && !isStandalone() ? ' En iPhone, primero instala la app en la pantalla de inicio.' : ''}</p>
      <div class="row">${pushOn ? '<button class="btn ghost" id="testPush">Enviar aviso de prueba</button>' : '<button class="btn" id="push">Activar avisos</button>'}</div>
    </section>
    ${me.user.is_owner ? `
    <section class="panel">
      <h2>Hoteles</h2>
      ${me.hotels.map((h) => `<fieldset class="panel" style="gap:10px"><legend class="eyebrow">${esc(h.name)}</legend>
        <div class="row"><label>Hora de salida<input type="time" id="co-${h.id}" value="${esc(h.checkout_time)}"></label>
          <label>Precio general por noche (L)<input type="number" id="rt-${h.id}" value="${h.default_rate}" inputmode="decimal"></label></div>
        <label>Tarifas para clientes (una por línea: Tipo = precio; deja el precio vacío si se acuerda en el momento)<textarea id="rates-${h.id}" rows="3" placeholder="Doble = 1550">${esc(Object.entries(h.rates || {}).map(([k, v]) => `${k} = ${v ?? ''}`).join('\n'))}</textarea></label>
        <label>Tarifas para empresas de crédito<textarea id="crates-${h.id}" rows="3" placeholder="Sencilla = 1400">${esc(Object.entries(h.company_rates || {}).map(([k, v]) => `${k} = ${v}`).join('\n'))}</textarea></label>
        <label>Empresas con crédito (separadas por coma)<input id="comp-${h.id}" value="${esc((h.companies || []).join(', '))}"></label>
        <div class="row"><label>ISV incluido (%)<input type="number" id="isv-${h.id}" value="${h.tax_isv}" inputmode="decimal"></label>
          <label>Turismo incluido (%)<input type="number" id="tur-${h.id}" value="${h.tax_tourism}" inputmode="decimal"></label></div>
        <button class="btn ghost" data-savehotel="${h.id}">Guardar ${esc(h.name.replace('Hostal ', ''))}</button></fieldset>`).join('')}
    </section>
    <section class="panel">
      <h2>Conexión con Claude (MCP)</h2>
      <p class="hint">Crea un token para consultar ocupación, finanzas, órdenes de compra y problemas desde Claude. Es de solo lectura. Trátalo como una contraseña.</p>
      <ul class="list">${tokens.map((t) => `<li><div class="d">${esc(t.label)}<small>Creado ${hnShort(t.created_at)}${t.last_used_at ? ' · usado ' + hnShort(t.last_used_at) : ''}</small></div><span></span><button class="mini" data-deltok="${esc(t.id)}">Revocar</button></li>`).join('') || '<li class="empty" style="display:block">Sin tokens.</li>'}</ul>
      <button class="btn ghost" id="newTok">Crear token para Claude</button>
    </section>` : ''}
    <section class="panel">
      ${installBanner() || '<p class="hint">La app ya está instalada en este dispositivo.</p>'}
      <div class="row" style="align-items:center"><p class="hint" style="flex:1 1 auto">Versión ${esc(self.APP_CONFIG?.VERSION || 'local')}</p><button class="btn ghost" id="upd" style="flex:0 0 auto">Buscar actualización</button></div>
      <button class="btn warn" id="logout">Cerrar sesión</button>
    </section>`;
  bindInstall();
  if ($('addKey')) $('addKey').onclick = async () => { try { await passkeyRegister(); toast('Huella o Face ID activada'); render(); } catch (e) { toast(e.message); } };
  app.querySelectorAll('[data-delkey]').forEach((b) => { b.onclick = async () => { await api('DELETE', `/api/auth/passkeys/${encodeURIComponent(b.dataset.delkey)}`); LS.del('ch-passkey'); render(); }; });
  if ($('push')) $('push').onclick = () => enablePush().then(render).catch((e) => toast(e.message));
  if ($('testPush')) $('testPush').onclick = () => api('POST', '/api/notifications/test').then(() => toast('Aviso de prueba enviado')).catch((e) => toast(e.message));
  app.querySelectorAll('[data-savehotel]').forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.savehotel;
      const parseRates = (txt) => {
        const o = {};
        txt.split('\n').forEach((l) => { const m = l.match(/^\s*(.+?)\s*[=:]\s*([\d.,]*)\s*$/); if (m) o[m[1]] = m[2] ? Number(m[2].replace(/,/g, '')) : null; });
        return o;
      };
      const rates = parseRates($('rates-' + id).value);
      const company_rates = parseRates($('crates-' + id).value);
      const companies = $('comp-' + id).value.split(',').map((x) => x.trim()).filter(Boolean);
      try {
        await api('PATCH', `/api/hotels/${id}`, { checkout_time: $('co-' + id).value, default_rate: +$('rt-' + id).value, rates, company_rates, companies, tax_isv: +$('isv-' + id).value, tax_tourism: +$('tur-' + id).value });
        me = null; toast('Hotel actualizado'); render();
      }
      catch (e) { toast(e.message); }
    };
  });
  if ($('newTok')) $('newTok').onclick = async () => {
    const t = await api('POST', '/api/tokens', { label: 'Claude' });
    const url = `${API}/mcp/${t.token}`;
    sheet(`<h3>Token creado</h3><p>Cópialo ahora; no se vuelve a mostrar.</p>
      <p class="hint">Dirección para agregar como conector personalizado en Claude:</p><div class="code-box" id="tk">${esc(url)}</div>
      <div class="row"><button class="btn" id="copy">Copiar</button><button class="btn ghost" id="c">Cerrar</button></div>`, () => {
      $('c').onclick = () => { closeSheet(); render(); };
      $('copy').onclick = () => navigator.clipboard.writeText(url).then(() => toast('Copiado')).catch(() => toast('Mantén presionado el texto para copiarlo'));
    });
  };
  app.querySelectorAll('[data-deltok]').forEach((b) => { b.onclick = async () => { await api('DELETE', `/api/tokens/${b.dataset.deltok}`); render(); }; });
  $('logout').onclick = () => logout(true);
  $('upd').onclick = () => { toast('Buscando actualización…'); checkForUpdate(); };
}

// ================= USUARIOS (dueño) =================
async function viewUsuarios() {
  const users = await api('GET', '/api/users');
  const H = me.hotels;
  const desc = (u) => (u.is_owner ? 'Dueño · todos los hoteles' : H.map((h) => {
    const r = u.memberships.filter((m) => m.hotel_id === h.id).map((m) => roleLabel[m.role]);
    return r.length ? `${h.name}: ${r.join(', ')}` : '';
  }).filter(Boolean).join(' · ') || 'Sin roles');
  app.innerHTML = header({ global: true, view: '#/usuarios', title: 'Gerencia' }) + `
    <div class="sec-head"><h1>Equipo</h1><button class="btn" id="add">+ Agregar usuario</button></div>
    <p class="hint">Cada persona entra con su correo y solo ve lo que su rol necesita: <b>Recepción y reservas</b> registra entradas y cobros; <b>Limpieza</b> ve qué limpiar y reporta problemas con foto; <b>Contabilidad</b> ve la caja y las finanzas de su hotel. El panel Global es solo para gerencia.</p>
    <section class="panel"><ul class="list">${users.map((u) => `
      <li><div class="d"><b>${esc(u.name)}</b> ${u.active ? '' : '<span class="tag t-bad">Desactivado</span>'}<small>${esc(u.email)}<br>${esc(desc(u))}</small></div><span></span>
      <button class="mini" data-edit="${u.id}">Editar</button></li>`).join('')}</ul></section>`;
  $('add').onclick = () => userSheet(null);
  app.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => userSheet(users.find((u) => u.id === +b.dataset.edit)); });

  function userSheet(u) {
    const has = (h, r) => !!u?.memberships.some((m) => m.hotel_id === h && m.role === r);
    sheet(`<h3>${u ? 'Editar usuario' : 'Nuevo usuario'}</h3>
      <label>Nombre<input id="u-n" value="${esc(u?.name || '')}" autocomplete="off"></label>
      <label>Correo<input id="u-e" type="email" value="${esc(u?.email || '')}" ${u ? 'disabled' : ''}></label>
      ${u?.is_owner ? '<p class="hint">Gerencia: acceso total a todos los hoteles.</p>' : ''}
      ${u?.is_owner ? '' : H.map((h) => `<fieldset class="panel" style="padding:10px 12px;gap:6px"><legend class="eyebrow">${esc(h.name)}</legend>
        ${Object.entries(roleLabel).map(([r, l]) => `<label class="check"><input type="checkbox" data-h="${h.id}" data-r="${r}" ${has(h.id, r) ? 'checked' : ''}> ${l}</label>`).join('')}</fieldset>`).join('')}
      ${u?.is_owner ? '' : '<p class="hint">Administración incluye todos los roles de ese hotel.</p>'}
      ${u ? `<label>Chat de Telegram (opcional)<input id="u-t" value="${esc(u.telegram_chat_id || '')}" inputmode="numeric" placeholder="Para avisos por Telegram"></label>` : ''}
      <div class="err" id="err"></div>
      <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn" id="ok">${u ? 'Guardar' : 'Crear usuario'}</button></div>
      ${u && u.active ? '<button class="btn ghost" id="acc">Generar código de acceso</button>' : ''}
      ${u && !u.is_owner ? `<button class="btn ${u.active ? 'warn' : 'ghost'}" id="tog">${u.active ? 'Desactivar usuario' : 'Reactivar usuario'}</button>
        <button class="btn danger-ghost" id="del">Eliminar usuario</button>
        <p class="hint">Desactivar le quita el acceso, pero lo puedes reactivar. Eliminar lo quita del equipo para siempre; su nombre se conserva en el historial de cobros.</p>` : ''}
      ${u?.is_owner ? '<p class="hint">Es de gerencia. Para quitarle el acceso, primero hay que sacar su correo de OWNER_EMAIL en GitHub.</p>' : ''}`, () => {
      $('c').onclick = closeSheet;
      const ms = () => [...document.querySelectorAll('[data-h]:checked')].map((x) => ({ hotel_id: x.dataset.h, role: x.dataset.r }));
      if ($('acc')) $('acc').onclick = () => accessCodeSheet(u);
      if ($('del')) $('del').onclick = (e) => {
        const b = e.target;
        if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = `Toca otra vez para eliminar a ${u.name}`; setTimeout(() => { b.classList.remove('armed'); b.textContent = 'Eliminar usuario'; }, 4000); return; }
        act(b, () => api('DELETE', `/api/users/${u.id}`), `${u.name} eliminado`);
      };
      $('ok').onclick = async (e) => {
        if (u) return act(e.target, () => api('PATCH', `/api/users/${u.id}`, { name: $('u-n').value, telegram_chat_id: $('u-t').value, ...(u.is_owner ? {} : { memberships: ms() }) }), 'Usuario actualizado');
        // Usuario nuevo: crearlo y mostrar su código de acceso de una vez
        e.target.disabled = true; $('err').textContent = '';
        try {
          const name = $('u-n').value;
          const r = await api('POST', '/api/users', { name, email: $('u-e').value, memberships: ms() });
          await accessCodeSheet({ id: r.id, name, email: $('u-e').value.trim().toLowerCase() }, true);
        } catch (x) { $('err').textContent = x.message; e.target.disabled = false; }
      };
      if ($('tog')) $('tog').onclick = (e) => act(e.target, () => api('PATCH', `/api/users/${u.id}`, { active: !u.active }), u.active ? 'Usuario desactivado' : 'Usuario reactivado');
    });
  }
}

// Reserva de días anteriores (pasar al sistema lo que estaba en papel). Solo contabilidad y gerencia.
async function pastStaySheet(h, last = {}) {
  const rooms = await api('GET', `/api/hotels/${h.id}/rooms`);
  const today = hnDate();
  const types = roomTypes(h);
  sheet(`<h3>Reserva de días anteriores</h3>
    <p class="hint">Si la estadía ya terminó, queda en el historial y en las ventas de ese día. Si todavía sigue, la habitación queda ocupada hasta su salida.</p>
    <div class="row">
      <input id="p-d" type="hidden" value="${last.date || addDays(today, -1)}">
      <label>Habitación<select id="p-r">${rooms.map((r) => `<option value="${r.id}" ${String(last.room_id) === String(r.id) ? 'selected' : ''}>${esc(r.number)}${r.status !== 'libre' ? ` (${statusLabel[r.status].toLowerCase()} ahora)` : ''}</option>`).join('')}</select></label>
    </div>
    <label>Nombre del huésped<input id="p-g" autocomplete="off"></label>
    <label>Empresa (si es a crédito o por convenio)<input id="p-co" list="p-companies" autocomplete="off" placeholder="Opcional">
      <datalist id="p-companies">${(h.companies || []).map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
    ${types.length ? `<div class="seg types" role="group" aria-label="Tipo de habitación">${types.map((t, i) => `<button type="button" data-ptype="${esc(t)}" aria-pressed="${i === 0}">${esc(t)}<small data-pprice="${esc(t)}"></small></button>`).join('')}</div>` : ''}
    <div id="calp"></div>
    <div class="row"><label>Noches<input id="p-n" type="number" min="1" value="1" inputmode="numeric"></label>
      <label>Precio por noche (L)<input id="p-p" type="number" min="0" step="any" inputmode="decimal"></label></div>
    ${payFields(h)}
    <div class="calc" id="calc"></div><div class="err" id="err"></div>
    <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn" id="ok">Guardar</button></div>
    <button class="btn ghost" id="okMore">Guardar y registrar otra</button>`, () => {
    let roomType = types[0] || null;
    const upd = () => {
      const credit = isCredit(h, $('p-co').value);
      $('sheetHost').querySelectorAll('[data-pprice]').forEach((el) => { const v = typeRate(h, el.dataset.pprice, credit); el.textContent = v !== null ? fmt(v) : ''; });
      const d = $('p-d').value; const n = Math.max(1, Math.floor(+$('p-n').value || 1)); const out = d ? addDays(d, n) : '';
      const total = n * (+$('p-p').value || 0);
      const ends = out ? `${hnDay(parseD(out))}, ${h.checkout_time}` : '';
      const still = out && out > today;
      $('calc').innerHTML = d ? `${n} noche${n > 1 ? 's' : ''} · salida ${ends} · <b>${fmt(total)}</b><br>${still ? 'Todavía sigue: la habitación quedará ocupada.' : 'Ya terminó: queda como historial.'}` : '';
    };
    const setRate = () => { const v = roomType ? typeRate(h, roomType, isCredit(h, $('p-co').value)) : null; if (v !== null) $('p-p').value = v; upd(); };
    $('sheetHost').querySelectorAll('[data-ptype]').forEach((t) => { t.onclick = () => { roomType = t.dataset.ptype; $('sheetHost').querySelectorAll('[data-ptype]').forEach((x) => x.setAttribute('aria-pressed', x === t)); setRate(); }; });
    $('p-co').onchange = () => { if (isCredit(h, $('p-co').value) && $('f-pay').value === 'Efectivo') { $('f-pay').value = 'Pendiente'; $('f-pay').dispatchEvent(new Event('change')); } setRate(); };
    const calp = stayCalendar($('calp'), {
      start: $('p-d').value, end: addDays($('p-d').value, 1), mode: 'range', maxStart: today,
      onChange: (st, en) => { $('p-d').value = st; $('p-n').value = Math.round((parseD(en) - parseD(st)) / 86400000); upd(); },
    });
    $('p-n').oninput = () => { const n = Math.floor(+$('p-n').value || 0); if (n >= 1) calp.set($('p-d').value, addDays($('p-d').value, Math.min(120, n))); upd(); };
    $('p-p').oninput = upd;
    bindPay(); setRate();
    $('c').onclick = closeSheet;
    const save = async (btn, more) => {
      $('err').textContent = ''; btn.disabled = true;
      const body = { date: $('p-d').value, room_id: +$('p-r').value, guest: $('p-g').value, company: $('p-co').value.trim() || undefined, room_type: roomType || undefined, nights: +$('p-n').value, rate: +$('p-p').value };
      try {
        Object.assign(body, payBody());
        if (!body.date) throw new Error('Elige la fecha de entrada.');
        if (!(body.rate > 0)) throw new Error('Escribe el precio por noche.');
        const r = await api('POST', `/api/hotels/${h.id}/past-stay`, body);
        LS.set('ch-week-' + h.id, monday(body.date));
        toast(r.ongoing ? 'Reserva guardada · la habitación quedó ocupada' : 'Reserva guardada en el historial');
        if (more) { await render(); pastStaySheet(h, { date: body.date, room_id: body.room_id }); }
        else { closeSheet(); render(); }
      } catch (e) { $('err').textContent = e.message; btn.disabled = false; }
    };
    $('ok').onclick = (e) => save(e.target, false);
    $('okMore').onclick = (e) => save(e.target, true);
  });
}

// Código de acceso de un solo uso para entrar sin correo (lo entrega gerencia por WhatsApp)
async function accessCodeSheet(u, isNew = false) {
  let r;
  try { r = await api('POST', `/api/users/${u.id}/access-code`); } catch (e) { toast(e.message); return; }
  const appUrl = location.origin + location.pathname;
  const first = (u.name || '').split(' ')[0];
  const msg = `Hola ${first}, ya tienes acceso a Control de Hoteles.\n\n1. Abre ${appUrl}\n2. Escribe tu correo: ${r.email}\n3. Toca "Ya tengo un código de acceso" y escribe: ${r.code}\n\nEl código vence en ${r.expires_in_hours} horas y sirve una sola vez. Al entrar, activa tu huella o Face ID.`;
  sheet(`<h3>${isNew ? 'Usuario creado' : 'Código de acceso'}</h3>
    <p>Dale este código a <b>${esc(u.name)}</b>. Entra con su correo <b>${esc(r.email)}</b> tocando <i>"Ya tengo un código de acceso"</i>.</p>
    <div class="code-big" aria-label="Código">${r.code.replace(/(\d{3})(\d{3})/, '$1 $2')}</div>
    <p class="hint">Sirve una sola vez y vence en ${r.expires_in_hours} horas. Si pides otro, el anterior deja de servir.</p>
    <a class="btn" id="wa" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>
    <div class="row"><button class="btn ghost" id="cp">Copiar mensaje</button><button class="btn ghost" id="c">Listo</button></div>`, () => {
    $('c').onclick = () => { closeSheet(); render(); };
    $('cp').onclick = () => navigator.clipboard.writeText(msg).then(() => toast('Mensaje copiado')).catch(() => toast('No se pudo copiar. Escribe el código a mano.'));
  });
}

// ---------------- Arranque ----------------
// Actualizaciones: al publicar una versión nueva, el teléfono la toma solo y recarga una vez.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded || document.querySelector('.scrim')) return; // no interrumpir un formulario abierto
    reloaded = true; location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}
async function checkForUpdate() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    if (self.caches) for (const k of await caches.keys()) await caches.delete(k);
  } catch { /* */ }
  location.reload();
}
render();
