// Control de Hoteles · PWA (sin dependencias)
const API = (self.APP_CONFIG?.API_URL || '').replace(/\/$/, '');
const TZ = 'America/Tegucigalpa';
const $ = (id) => document.getElementById(id);
const app = $('app');

// ---------------- Utilidades ----------------
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => 'L ' + (Math.round((+n || 0) * 100) / 100).toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
const roleLabel = { admin: 'Administración', contabilidad: 'Contabilidad', recepcion: 'Recepción', limpieza: 'Limpieza', mantenimiento: 'Mantenimiento' };
const statusLabel = { libre: 'Libre', ocupada: 'Ocupada', por_limpiar: 'Por limpiar', limpiando: 'Limpiando', bloqueada: 'Bloqueada' };
const hotelById = (id) => me.hotels.find((h) => h.id === id);
const has = (hotelId, ...roles) => { const h = hotelById(hotelId); return !!h && roles.some((r) => h.roles.includes(r)); };
const isGlobal = () => me.user.is_owner || me.hotels.some((h) => h.roles.includes('contabilidad'));

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
  if (h.roles.includes('recepcion')) t.push(['recepcion', 'Recepción']);
  if (h.roles.includes('limpieza')) t.push(['limpieza', 'Limpieza']);
  if (h.roles.some((r) => ['recepcion', 'limpieza', 'mantenimiento'].includes(r))) t.push(['problemas', 'Problemas']);
  if (h.roles.includes('contabilidad')) t.push(['contabilidad', 'Contabilidad']);
  return t;
}

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
    if (r.name === 'global') return await viewGlobal();
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

// ---------------- Encabezado ----------------
function header(current = {}) {
  const hotelSel = current.hotel;
  const gl = isGlobal();
  const hotelNav = me.hotels.length > 1 || gl
    ? `<div class="seg" role="group" aria-label="Hotel">
        ${gl ? `<button aria-pressed="${current.global ? 'true' : 'false'}" data-go="#/global">Global</button>` : ''}
        ${me.hotels.map((h) => `<button aria-pressed="${hotelSel?.id === h.id}" data-go="#/hotel/${h.id}/${hotelTabs(h)[0]?.[0] || ''}">${esc(h.name)}</button>`).join('')}
      </div>` : '';
  const tabs = hotelSel ? `<nav class="tabs">${hotelTabs(hotelSel).map(([k, l]) => `<a href="#/hotel/${hotelSel.id}/${k}" aria-current="${current.view === k ? 'page' : 'false'}">${l}</a>`).join('')}</nav>` : '';
  return `
    <header class="top">
      <div class="brand"><img src="icons/icon-192.png" alt=""><div><b>Control de Hoteles</b><small>${esc(me.user.name)} · <span class="clock" id="clock">${hnTime()}</span></small></div></div>
      <div class="top-actions">
        <button class="icon-btn" data-go="#/avisos" aria-label="Avisos">Avisos${unread ? `<span class="dot">${unread}</span>` : ''}</button>
        ${me.user.is_owner ? '<button class="icon-btn" data-go="#/usuarios">Usuarios</button>' : ''}
        <button class="icon-btn" data-go="#/ajustes">Ajustes</button>
      </div>
    </header>
    ${hotelNav}${tabs}`;
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
    <label id="poL" hidden>Número de orden de compra<input id="f-po" autocomplete="off" placeholder="Ej. OC-2026-0153"></label>`;
}
function bindPay() {
  const s = $('f-pay');
  s?.addEventListener('change', () => { $('poL').hidden = s.value !== 'Orden de compra'; if (!$('poL').hidden) $('f-po').focus(); });
}
const payBody = () => ({ pay: $('f-pay').value, po: $('f-po')?.value.trim() || undefined });

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
        <button class="btn ${hasPasskey ? 'ghost' : 'big'}" id="send">Enviar código</button>
      </form>
      <form id="f2" class="stack" hidden>
        <p>Te enviamos un código de 6 números a <b id="sentTo"></b>.</p>
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
    } catch (x) { err(x.message); }
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
  app.innerHTML = header({ global: true }) + `
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
        ${t.open_issues || t.po_alerts ? `<div class="alerts">
          ${t.open_issues ? `<span class="tag t-bloqueada">${t.open_issues} problema${t.open_issues > 1 ? 's' : ''} abierto${t.open_issues > 1 ? 's' : ''}</span>` : ''}
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

// ================= RECEPCIÓN =================
async function viewRecepcion(h) {
  const today = hnDate();
  const [rooms, sales] = await Promise.all([
    api('GET', `/api/hotels/${h.id}/rooms`),
    api('GET', `/api/hotels/${h.id}/sales?from=${today}&to=${today}`),
  ]);
  const cnt = { libre: 0, ocupada: 0, por_limpiar: 0, limpiando: 0, bloqueada: 0 };
  rooms.forEach((r) => cnt[r.status]++);
  const live = sales.filter((s) => !s.voided_at);
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
        </button>`;
      }).join('')}</div>
    </section>
    <section class="panel">
      <div class="sec-head"><h2>Caja de hoy</h2><b style="font-family:var(--display);font-size:24px">${fmt(total)}</b></div>
      <div class="alerts">${Object.entries(byPay).map(([k, v]) => `<span class="tag t-info">${esc(k)} ${fmt(v)}</span>`).join('')}</div>
      <ul class="list">${sales.length ? sales.map((s) => saleRow(s, true)).join('') : '<li class="empty" style="display:block">Sin cobros hoy. Cada entrada o ingreso que registres aparece aquí.</li>'}</ul>
      <button class="btn ghost" id="extra">+ Registrar otro ingreso</button>
    </section>`;

  app.querySelectorAll('[data-room]').forEach((b) => { b.onclick = () => roomSheet(h, rooms.find((r) => r.id === +b.dataset.room)); });
  $('extra').onclick = () => extraSheet(h);
  bindVoid();
  autoRefresh();
}

function saleRow(s, canVoid) {
  const v = !!s.voided_at;
  return `<li class="${v ? 'void' : ''}"><div class="d">${esc(s.concept)}<small>${hnTime(s.ts)} · ${esc(s.pay)}${s.po ? ' #' + esc(s.po) : ''} · ${esc(s.by_name || '—')}${v ? ` · anulado por ${esc(s.voided_by_name || '')}: ${esc(s.void_reason || '')}` : ''}</small></div>
    <span class="m">${fmt(s.amount)}</span>${canVoid && !v ? `<button class="mini" data-void="${s.id}">Anular</button>` : '<span></span>'}</li>`;
}
function bindVoid() {
  app.querySelectorAll('[data-void]').forEach((b) => {
    b.onclick = () => sheet(`<h3>Anular movimiento</h3><p class="hint">Queda tachado en el registro con tu nombre y el motivo. No se borra.</p>
      <label>Motivo<input id="f-r" placeholder="Ej. cobro duplicado"></label><div class="err" id="err"></div>
      <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn warn" id="ok">Anular</button></div>`, () => {
      $('c').onclick = closeSheet;
      $('ok').onclick = (e) => act(e.target, () => api('POST', `/api/sales/${b.dataset.void}/void`, { reason: $('f-r').value }), 'Movimiento anulado');
    });
  });
}

function roomSheet(h, r) {
  const issueBtn = '<button class="btn ghost" id="issue">Reportar un problema</button>';
  if (r.status === 'libre') {
    const hourOK = !!h.allow_hourly;
    sheet(`<h3>Entrada · Hab. ${esc(r.number)}</h3>
      <label>Nombre del huésped<input id="f-g" autocomplete="off"></label>
      ${hourOK ? `<div class="seg" role="group" aria-label="Tipo"><button type="button" id="ty-n" aria-pressed="true">Por noche</button><button type="button" id="ty-h" aria-pressed="false">Por hora</button></div>` : ''}
      <div class="row" id="g-n"><label>Noches<input id="f-n" type="number" min="1" value="1" inputmode="numeric"></label>
        <label>Precio por noche (L)<input id="f-p" type="number" min="0" step="any" inputmode="decimal" value="${LS.get('ch-rate-' + h.id, h.default_rate)}"></label></div>
      <div class="row" id="g-h" hidden><label>Horas<input id="f-h" type="number" min="1" value="${LS.get('ch-hours', 3)}" inputmode="numeric"></label>
        <label>Monto a cobrar (L)<input id="f-hm" type="number" min="0" step="any" inputmode="decimal" value="${LS.get('ch-hamt', '')}"></label></div>
      ${payFields(h)}
      <div class="calc" id="calc"></div><div class="err" id="err"></div>
      <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn" id="ok">Registrar entrada</button></div>
      ${issueBtn}`, () => {
      let hourly = false;
      const upd = () => {
        if (hourly) {
          const hrs = Math.max(1, +$('f-h').value || 1);
          $('calc').textContent = `Total: ${fmt(+$('f-hm').value || 0)} · Hasta las ${hnTime(Date.now() + hrs * 3600000)} · la salida se registra a mano`;
        } else {
          const n = Math.max(1, +$('f-n').value || 1);
          $('calc').textContent = `Total: ${fmt(n * (+$('f-p').value || 0))} · Salida automática: ${hnDay(parseD(addDays(hnDate(), n)))}, ${h.checkout_time}`;
        }
      };
      const setType = (x) => { hourly = x; $('g-n').hidden = x; $('g-h').hidden = !x; $('ty-n').setAttribute('aria-pressed', !x); $('ty-h').setAttribute('aria-pressed', x); upd(); };
      if (hourOK) { $('ty-n').onclick = () => setType(false); $('ty-h').onclick = () => setType(true); }
      ['f-n', 'f-p', 'f-h', 'f-hm'].forEach((id) => { $(id).oninput = upd; });
      upd(); bindPay();
      $('c').onclick = closeSheet;
      $('issue').onclick = () => issueSheet(h, r);
      $('ok').onclick = (e) => act(e.target, async () => {
        const b = { room_id: r.id, guest: $('f-g').value, ...payBody() };
        if (hourly) { Object.assign(b, { kind: 'hora', hours: +$('f-h').value, amount: +$('f-hm').value }); LS.set('ch-hours', +$('f-h').value); LS.set('ch-hamt', +$('f-hm').value); }
        else { Object.assign(b, { kind: 'noche', nights: +$('f-n').value, rate: +$('f-p').value }); LS.set('ch-rate-' + h.id, +$('f-p').value); }
        await api('POST', `/api/hotels/${h.id}/checkin`, b);
      }, `Entrada registrada en la ${r.number}`);
    });
  } else if (r.status === 'ocupada') {
    const isH = r.kind === 'hora';
    sheet(`<h3>Hab. ${esc(r.number)}${isH ? ' · por hora' : ''}</h3>
      <p><b>${esc(r.guest)}</b></p>
      <p class="hint">Entró ${hnShort(r.check_in_at)} ${hnTime(r.check_in_at)} · ${isH ? 'Hasta las ' + hnTime(r.due_out_at) + ' (salida manual)' : 'Salida automática ' + hnDay(r.due_out_at) + ', ' + hnTime(r.due_out_at)}</p>
      <button class="btn warn" id="out">Registrar salida ahora</button>
      <h3 style="font-size:17px;margin-top:6px">${isH ? 'Agregar tiempo' : 'Extender estadía'}</h3>
      <div class="row">${isH
        ? '<label>Horas extra<input id="f-x" type="number" min="1" value="1" inputmode="numeric"></label><label>Monto (L)<input id="f-xm" type="number" min="0" step="any" inputmode="decimal"></label>'
        : `<label>Noches extra<input id="f-x" type="number" min="1" value="1" inputmode="numeric"></label><label>Precio por noche (L)<input id="f-xm" type="number" min="0" step="any" inputmode="decimal" value="${r.rate ?? h.default_rate}"></label>`}</div>
      ${payFields(h)}<div class="err" id="err"></div>
      <div class="row"><button class="btn ghost" id="c">Cerrar</button><button class="btn" id="ext">${isH ? 'Cobrar y agregar' : 'Cobrar y extender'}</button></div>
      ${issueBtn}`, () => {
      bindPay();
      $('c').onclick = closeSheet;
      $('issue').onclick = () => issueSheet(h, r);
      $('out').onclick = (e) => act(e.target, () => api('POST', `/api/stays/${r.stay_id}/checkout`), `Hab. ${r.number} enviada a limpieza`);
      $('ext').onclick = (e) => act(e.target, () => api('POST', `/api/stays/${r.stay_id}/extend`,
        isH ? { hours: +$('f-x').value, amount: +$('f-xm').value, ...payBody() } : { nights: +$('f-x').value, rate: +$('f-xm').value, ...payBody() }),
      isH ? 'Tiempo agregado' : 'Estadía extendida');
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
      <div class="err" id="err"></div>
      <div class="row"><button class="btn ghost" id="c">Cerrar</button></div>${issueBtn}`, () => {
      $('c').onclick = closeSheet;
      $('issue').onclick = () => issueSheet(h, r);
      if ($('cl')) $('cl').onclick = (e) => act(e.target, () => api('POST', `/api/rooms/${r.id}/clean/${r.status === 'limpiando' ? 'finish' : 'start'}`), 'Listo');
    });
  }
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
  const [fin, sales, pos] = await Promise.all([
    api('GET', `/api/hotels/${h.id}/finance?from=${wk}&to=${end}`),
    api('GET', `/api/hotels/${h.id}/sales?from=${wk}&to=${end}`),
    h.allow_po ? api('GET', `/api/hotels/${h.id}/po`) : Promise.resolve([]),
  ]);
  const days = [...Array(7)].map((_, i) => addDays(wk, i));
  const live = sales.filter((s) => !s.voided_at);
  const pays = me.pay.filter((p) => p !== 'Orden de compra' || h.allow_po);
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
    <div class="tiles">
      <div class="tile"><span>Total semana</span><b>${fmt(fin.total)}</b></div>
      <div class="tile"><span>Promedio diario</span><b>${fmt(isCur ? fin.total / (days.filter((d) => d <= today).length || 1) : fin.avg_day)}</b></div>
      <div class="tile"><span>Noches vendidas</span><b>${fin.nights}</b></div>
      ${h.allow_hourly ? `<div class="tile"><span>Por hora</span><b>${kind('hora').n}</b></div>` : ''}
      <div class="tile"><span>Extras</span><b>${fmt(kind('extra').t)}</b></div>
    </div>
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
  bindVoid();
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
  app.innerHTML = header() + `
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
  app.innerHTML = header() + `
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
      ${me.hotels.map((h) => `<div class="row" style="align-items:flex-end"><label>${esc(h.name)} · hora de salida<input type="time" id="co-${h.id}" value="${esc(h.checkout_time)}"></label><label>Precio por noche (L)<input type="number" id="rt-${h.id}" value="${h.default_rate}" inputmode="decimal"></label><button class="btn ghost" data-savehotel="${h.id}" style="flex:0 0 auto">Guardar</button></div>`).join('')}
    </section>
    <section class="panel">
      <h2>Conexión con Claude (MCP)</h2>
      <p class="hint">Crea un token para consultar ocupación, finanzas, órdenes de compra y problemas desde Claude. Es de solo lectura. Trátalo como una contraseña.</p>
      <ul class="list">${tokens.map((t) => `<li><div class="d">${esc(t.label)}<small>Creado ${hnShort(t.created_at)}${t.last_used_at ? ' · usado ' + hnShort(t.last_used_at) : ''}</small></div><span></span><button class="mini" data-deltok="${esc(t.id)}">Revocar</button></li>`).join('') || '<li class="empty" style="display:block">Sin tokens.</li>'}</ul>
      <button class="btn ghost" id="newTok">Crear token para Claude</button>
    </section>` : ''}
    <section class="panel">
      ${installBanner() || '<p class="hint">La app ya está instalada en este dispositivo.</p>'}
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
      try { await api('PATCH', `/api/hotels/${id}`, { checkout_time: $('co-' + id).value, default_rate: +$('rt-' + id).value }); me = null; toast('Hotel actualizado'); render(); }
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
}

// ================= USUARIOS (dueño) =================
async function viewUsuarios() {
  const users = await api('GET', '/api/users');
  const H = me.hotels;
  const desc = (u) => (u.is_owner ? 'Dueño · todos los hoteles' : H.map((h) => {
    const r = u.memberships.filter((m) => m.hotel_id === h.id).map((m) => roleLabel[m.role]);
    return r.length ? `${h.name}: ${r.join(', ')}` : '';
  }).filter(Boolean).join(' · ') || 'Sin roles');
  app.innerHTML = header() + `
    <div class="sec-head"><h1>Usuarios</h1><button class="btn" id="add">+ Agregar usuario</button></div>
    <p class="hint">Cada persona entra con su correo. Dale solo los roles que necesita en cada hotel.</p>
    <section class="panel"><ul class="list">${users.map((u) => `
      <li><div class="d"><b>${esc(u.name)}</b> ${u.active ? '' : '<span class="tag t-bad">Desactivado</span>'}<small>${esc(u.email)}<br>${esc(desc(u))}</small></div><span></span>
      ${u.is_owner ? '<span></span>' : `<button class="mini" data-edit="${u.id}">Editar</button>`}</li>`).join('')}</ul></section>`;
  $('add').onclick = () => userSheet(null);
  app.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => userSheet(users.find((u) => u.id === +b.dataset.edit)); });

  function userSheet(u) {
    const has = (h, r) => !!u?.memberships.some((m) => m.hotel_id === h && m.role === r);
    sheet(`<h3>${u ? 'Editar usuario' : 'Nuevo usuario'}</h3>
      <label>Nombre<input id="u-n" value="${esc(u?.name || '')}" autocomplete="off"></label>
      <label>Correo<input id="u-e" type="email" value="${esc(u?.email || '')}" ${u ? 'disabled' : ''}></label>
      ${H.map((h) => `<fieldset class="panel" style="padding:10px 12px;gap:6px"><legend class="eyebrow">${esc(h.name)}</legend>
        ${Object.entries(roleLabel).map(([r, l]) => `<label class="check"><input type="checkbox" data-h="${h.id}" data-r="${r}" ${has(h.id, r) ? 'checked' : ''}> ${l}</label>`).join('')}</fieldset>`).join('')}
      <p class="hint">Administración incluye todos los roles de ese hotel.</p>
      ${u ? `<label>Chat de Telegram (opcional)<input id="u-t" value="${esc(u.telegram_chat_id || '')}" inputmode="numeric" placeholder="Para avisos por Telegram"></label>` : ''}
      <div class="err" id="err"></div>
      <div class="row"><button class="btn ghost" id="c">Cancelar</button><button class="btn" id="ok">${u ? 'Guardar' : 'Crear usuario'}</button></div>
      ${u ? `<button class="btn ${u.active ? 'warn' : 'ghost'}" id="tog">${u.active ? 'Desactivar usuario' : 'Reactivar usuario'}</button>` : ''}`, () => {
      $('c').onclick = closeSheet;
      const ms = () => [...document.querySelectorAll('[data-h]:checked')].map((x) => ({ hotel_id: x.dataset.h, role: x.dataset.r }));
      $('ok').onclick = (e) => act(e.target, () => (u
        ? api('PATCH', `/api/users/${u.id}`, { name: $('u-n').value, memberships: ms(), telegram_chat_id: $('u-t').value })
        : api('POST', '/api/users', { name: $('u-n').value, email: $('u-e').value, memberships: ms() })), u ? 'Usuario actualizado' : 'Usuario creado. Ya puede entrar con su correo.');
      if ($('tog')) $('tog').onclick = (e) => act(e.target, () => api('PATCH', `/api/users/${u.id}`, { active: !u.active }), u.active ? 'Usuario desactivado' : 'Usuario reactivado');
    });
  }
}

// ---------------- Arranque ----------------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
render();
