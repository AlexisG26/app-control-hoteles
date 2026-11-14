// Servidor MCP (Model Context Protocol) de solo lectura para consultar los hoteles desde Claude.
// Transporte: HTTP "streamable" con respuestas JSON. Autenticación con un token de API
// creado por el dueño en la app (Ajustes → Conexión con Claude).
import { hashToken, localDate, mondayOf, isDate } from './util.js';
import { loadUser, hotelsOf, can } from './auth.js';
import { overview, listRooms, financeReport, compareFinance, pendingPOs, listIssues, listSales, listPending } from './ops.js';

const TOOLS = [
  {
    name: 'resumen_hoteles',
    description: 'Resumen global de todos los hoteles: habitaciones libres, ocupadas, por limpiar y bloqueadas, ingresos de hoy, semana y mes, incidencias abiertas y órdenes de compra con aviso.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'estado_habitaciones',
    description: 'Estado actual de cada habitación de un hotel, con huésped, fecha de salida e incidencias abiertas.',
    inputSchema: { type: 'object', properties: { hotel: { type: 'string', description: 'Id del hotel: prado o prokinto' } }, required: ['hotel'] },
  },
  {
    name: 'estado_financiero',
    description: 'Ingresos de un hotel en un rango de fechas: total, promedio diario, por día, por forma de pago, por tipo (noche, hora, extra) y por recepcionista. Fechas en formato AAAA-MM-DD; por defecto la semana actual.',
    inputSchema: {
      type: 'object',
      properties: { hotel: { type: 'string' }, desde: { type: 'string' }, hasta: { type: 'string' } },
      required: ['hotel'],
    },
  },
  {
    name: 'comparar_hoteles',
    description: 'Compara cuánto generó cada hotel en un rango de fechas: total, parte del total, variación contra el período anterior de igual duración, precio promedio por noche, ocupación y desglose. Fechas AAAA-MM-DD; por defecto el mes en curso.',
    inputSchema: { type: 'object', properties: { desde: { type: 'string' }, hasta: { type: 'string' } } },
  },
  {
    name: 'movimientos',
    description: 'Lista detallada de cobros y anulaciones de un hotel en un rango de fechas (máximo 2000).',
    inputSchema: {
      type: 'object',
      properties: { hotel: { type: 'string' }, desde: { type: 'string' }, hasta: { type: 'string' } },
      required: ['hotel', 'desde', 'hasta'],
    },
  },
  {
    name: 'pagos_pendientes',
    description: 'Cuentas por cobrar (cobros registrados como Pendiente): cliente, habitación, total, pagado, saldo, noches pagadas de cuántas, días transcurridos y pagos recibidos con o sin comprobante.',
    inputSchema: { type: 'object', properties: { hotel: { type: 'string' } }, required: ['hotel'] },
  },
  {
    name: 'ordenes_compra_pendientes',
    description: 'Órdenes de compra sin cobrar, con días transcurridos y estado (en_curso, facturar, facturada, vencida_30).',
    inputSchema: { type: 'object', properties: { hotel: { type: 'string' } } },
  },
  {
    name: 'incidencias',
    description: 'Problemas reportados en habitaciones de un hotel.',
    inputSchema: {
      type: 'object',
      properties: { hotel: { type: 'string' }, estado: { type: 'string', enum: ['abierta', 'resuelta', 'todas'] } },
      required: ['hotel'],
    },
  },
];

async function callTool(env, user, hotels, name, args = {}) {
  const today = localDate(env);
  const hotelArg = () => {
    const h = hotels.find((x) => x.id === String(args.hotel || '').toLowerCase() || x.name.toLowerCase() === String(args.hotel || '').toLowerCase());
    if (!h) throw new Error(`Hotel desconocido. Usa uno de: ${hotels.map((x) => x.id).join(', ')}`);
    return h.id;
  };
  switch (name) {
    case 'resumen_hoteles': return overview(env, user, hotels);
    case 'estado_habitaciones': return listRooms(env, user, hotelArg());
    case 'estado_financiero': {
      const from = isDate(args.desde) ? args.desde : mondayOf(today);
      const to = isDate(args.hasta) ? args.hasta : today;
      return financeReport(env, user, hotelArg(), from, to);
    }
    case 'comparar_hoteles': {
      const from = isDate(args.desde) ? args.desde : today.slice(0, 8) + '01';
      const to = isDate(args.hasta) ? args.hasta : today;
      return compareFinance(env, user, hotels, from, to);
    }
    case 'movimientos': return listSales(env, user, hotelArg(), args.desde, args.hasta);
    case 'ordenes_compra_pendientes': {
      const id = args.hotel ? hotelArg() : null;
      return (await pendingPOs(env, id)).filter((p) => can(user, p.hotel_id, 'contabilidad'));
    }
    case 'pagos_pendientes': return listPending(env, user, hotelArg());
    case 'incidencias': return listIssues(env, user, hotelArg(), args.estado || 'abierta');
    default: throw new Error(`Herramienta desconocida: ${name}`);
  }
}

export async function handleMcp(req, env, pathToken, allHotels) {
  if (req.method === 'GET') return new Response('Usa POST para hablar con el servidor MCP.', { status: 405, headers: { allow: 'POST' } });
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const h = req.headers.get('authorization') || '';
  const token = pathToken || (h.startsWith('Bearer ') ? h.slice(7).trim() : '');
  const row = token ? await env.DB.prepare('SELECT user_id FROM api_tokens WHERE token_hash = ?').bind(await hashToken(token, env.AUTH_PEPPER)).first() : null;
  const user = row ? await loadUser(env, row.user_id) : null;
  if (!user) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { 'content-type': 'application/json' } });
  await env.DB.prepare('UPDATE api_tokens SET last_used_at = ? WHERE token_hash = ?').bind(Date.now(), await hashToken(token, env.AUTH_PEPPER)).run();
  const hotels = hotelsOf(user, allHotels);

  let msg;
  try { msg = await req.json(); } catch { return rpcErr(null, -32700, 'JSON inválido'); }
  if (Array.isArray(msg)) {
    const out = [];
    for (const m of msg) { const r = await one(env, user, hotels, m); if (r) out.push(r); }
    return out.length ? jres(out) : new Response(null, { status: 202 });
  }
  const r = await one(env, user, hotels, msg);
  return r ? jres(r) : new Response(null, { status: 202 });
}

async function one(env, user, hotels, m) {
  const id = m.id ?? null;
  if (m.id === undefined) return null; // notificación (p. ej. notifications/initialized)
  try {
    switch (m.method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: m.params?.protocolVersion || '2025-03-26',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'control-hoteles', version: '1.0.0' },
          instructions: 'Datos de operación y finanzas de los hoteles. Montos en lempiras (L). Fechas locales de Honduras (UTC-6). Todo es de solo lectura.',
        });
      case 'ping': return ok(id, {});
      case 'tools/list': return ok(id, { tools: TOOLS });
      case 'tools/call': {
        try {
          const data = await callTool(env, user, hotels, m.params?.name, m.params?.arguments || {});
          return ok(id, { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
        } catch (e) {
          return ok(id, { content: [{ type: 'text', text: e.message || String(e) }], isError: true });
        }
      }
      default: return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Método no soportado' } };
    }
  } catch (e) {
    return { jsonrpc: '2.0', id, error: { code: -32603, message: e.message } };
  }
}
const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const jres = (d) => new Response(JSON.stringify(d), { headers: { 'content-type': 'application/json' } });
const rpcErr = (id, code, message) => jres({ jsonrpc: '2.0', id, error: { code, message } });
