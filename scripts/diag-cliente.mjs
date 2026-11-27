// Diagnóstico temporal: estadías y cobros de un cliente (busca por patrón), sin imprimir nombres.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(process.argv[2], 'utf8'));
const off = -360 * 60000;
const d = (ms) => (ms ? new Date(ms + off).toISOString().slice(0, 16).replace('T', ' ') : '—');
const stays = db.prepare(`SELECT s.id, s.hotel_id, r.number, s.check_in_at, s.due_out_at, s.checked_out_at, s.checkout_mode, s.nights, s.rate, s.created_by IS NOT NULL AS en_app,
  CASE WHEN s.guest = 'Z.' THEN 'Z.' ELSE 'nombre completo' END AS forma
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE lower(s.guest) LIKE '%zabal%' OR lower(s.guest) LIKE '%zaval%' OR s.guest = 'Z.' ORDER BY s.check_in_at`).all();
for (const s of stays) {
  console.log(`estadía #${s.id} · ${s.hotel_id} hab ${s.number} · ${s.forma} · entra ${d(s.check_in_at)} · sale ${d(s.checked_out_at || s.due_out_at)} (${s.checkout_mode || 'en curso'}) · ${s.nights} noche(s) · tarifa ${s.rate} · ${s.en_app ? 'registrada en la app' : 'reporte en papel'}`);
  for (const x of db.prepare('SELECT id, local_date, kind, amount, pay, paid_amount, paid_nights, settled_at, voided_at, parent_id FROM sales WHERE stay_id = ? OR parent_id IN (SELECT id FROM sales WHERE stay_id = ?) ORDER BY id').all(s.id, s.id))
    console.log(`   cobro #${x.id} ${x.local_date} ${x.kind} L${x.amount} ${x.pay}${x.pay === 'Pendiente' ? ` pagado L${x.paid_amount}${x.settled_at ? ' (saldado)' : ''}` : ''}${x.voided_at ? ' ANULADO' : ''}${x.parent_id ? ' (abono a #' + x.parent_id + ')' : ''}`);
}
const g = db.prepare("SELECT COUNT(*) n FROM guests WHERE name_key LIKE '%zabal%' OR name_key LIKE '%zaval%' OR name_key = 'z'").get();
console.log('clientes con ese nombre:', g.n, '· estadías encontradas:', stays.length);
