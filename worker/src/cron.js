// Tareas automáticas (Cron Trigger cada 5 minutos):
// 1. Salida automática de estadías por noche a la hora de salida del hotel → aviso a limpieza.
// 2. Aviso a recepción cuando vence el tiempo de una habitación por hora (la salida sigue siendo manual).
// 3. Una vez al día (8:00 a. m.): recordatorios de órdenes de compra a los 15 y 30 días.
import { checkOut, pendingPOs, fetchFxRate, settleFx } from './ops.js';
import { notify, usersWithRole } from './notify.js';
import { localTime, localDate } from './util.js';

export async function runScheduled(env, now = Date.now()) {
  const out = { auto_checkouts: 0, hourly_alerts: 0, po_reminders: 0, fx_settled: 0 };

  // 1. Salidas automáticas
  const { results: due } = await env.DB.prepare(
    `SELECT id FROM stays WHERE checked_out_at IS NULL AND kind = 'noche' AND due_out_at <= ? ORDER BY due_out_at LIMIT 100`,
  ).bind(now).all();
  for (const s of due) {
    try { await checkOut(env, null, s.id, 'automatica'); out.auto_checkouts++; } catch (e) { console.error('auto checkout', s.id, e); }
  }

  // 2. Habitaciones por hora vencidas
  const { results: hourly } = await env.DB.prepare(
    `SELECT s.id, s.hotel_id, r.number FROM stays s JOIN rooms r ON r.id = s.room_id
      WHERE s.checked_out_at IS NULL AND s.kind = 'hora' AND s.due_out_at <= ? AND s.notified_due = 0`,
  ).bind(now).all();
  for (const s of hourly) {
    await env.DB.prepare('UPDATE stays SET notified_due = 1 WHERE id = ?').bind(s.id).run();
    await notify(env, await usersWithRole(env, s.hotel_id, ['recepcion']), {
      title: `Tiempo vencido · habitación ${s.number}`,
      body: 'Terminó el tiempo de la habitación por hora. Registra la salida o agrega más tiempo.',
      url: `#/hotel/${s.hotel_id}/recepcion`,
    });
    out.hourly_alerts++;
  }

  // 4. Tasa del dólar del día (desde las 6:00, una vez) y recálculo de ventas PayPal estimadas
  try {
    if (localTime(env, now) >= '06:00') {
      const has = await env.DB.prepare('SELECT 1 FROM fx_rates WHERE date = ?').bind(localDate(env, now)).first();
      if (!has && env.FX_AUTO !== '0') await fetchFxRate(env, localDate(env, now));
    }
    out.fx_settled = await settleFx(env);
  } catch (e) { console.error('fx', e); }

  // 3. Órdenes de compra (una vez al día, entre 8:00 y 8:04 hora local)
  const t = localTime(env, now);
  if (t >= (env.PO_REMINDER_TIME || '08:00') && t < addMin(env.PO_REMINDER_TIME || '08:00', 5)) {
    out.po_reminders = await poReminders(env, now);
  }
  return out;
}

function addMin(hhmm, m) {
  const [h, mi] = hhmm.split(':').map(Number);
  const t = h * 60 + mi + m;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export async function poReminders(env, now = Date.now()) {
  let n = 0;
  for (const po of await pendingPOs(env)) {
    const people = await usersWithRole(env, po.hotel_id, ['contabilidad'], true);
    if (po.days >= 30 && !po.po_remind30_at) {
      await notify(env, people, {
        title: `Orden de compra #${po.po} sin cobrar (30 días)`,
        body: `${po.hotel_name}: ${po.concept} · L ${po.amount}. Lleva ${po.days} días desde la reserva.`,
        url: `#/hotel/${po.hotel_id}/contabilidad`,
      });
      await env.DB.prepare('UPDATE sales SET po_remind30_at = ? WHERE id = ?').bind(now, po.id).run();
      n++;
    } else if (po.days >= 15 && !po.po_invoiced_at && !po.po_remind15_at) {
      await notify(env, people, {
        title: `Hacer factura · orden #${po.po}`,
        body: `${po.hotel_name}: ${po.concept} · L ${po.amount}. Pasaron ${po.days} días desde la reserva.`,
        url: `#/hotel/${po.hotel_id}/contabilidad`,
      });
      await env.DB.prepare('UPDATE sales SET po_remind15_at = ? WHERE id = ?').bind(now, po.id).run();
      n++;
    }
  }
  return n;
}

