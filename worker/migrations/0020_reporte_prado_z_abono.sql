-- Hostal Prado Alto, hab. 8 (Z.): abono de L 2,080 por transferencia (reporte del 26/11/2026).
-- Se aplica a la noche más antigua primero: 22/11 queda pagada (L 1,250) y al 24/11 se le abonan L 830.
-- Queda debiendo L 1,670 (L 420 del 24/11 y L 1,250 del 26/11).
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, parent_id, paid_nights)
  SELECT x.hotel_id, '2026-11-26', 1795744800000, 'Pago de Hab. 8 · Z. · noche del 22/11', x.room, x.stay_id, 'abono', 0, 0, 1250, 'Transferencia', NULL, x.id, 1
    FROM sales x JOIN stays s ON s.id = x.stay_id
   WHERE s.hotel_id = 'prado' AND s.guest = 'Z.' AND x.local_date = '2026-11-22' AND x.pay = 'Pendiente' AND x.voided_at IS NULL AND x.paid_amount = 0
     AND NOT EXISTS (SELECT 1 FROM sales a WHERE a.parent_id = x.id AND a.kind = 'abono');
UPDATE sales SET paid_amount = 1250, paid_nights = 1, settled_at = 1795744800000
  WHERE id = (SELECT x.id FROM sales x JOIN stays s ON s.id = x.stay_id WHERE s.hotel_id = 'prado' AND s.guest = 'Z.' AND x.local_date = '2026-11-22' AND x.pay = 'Pendiente' AND x.voided_at IS NULL)
    AND paid_amount = 0 AND EXISTS (SELECT 1 FROM sales a WHERE a.parent_id = sales.id AND a.kind = 'abono' AND a.amount = 1250);

INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, parent_id, paid_nights)
  SELECT x.hotel_id, '2026-11-26', 1795744800000 + 1000, 'Pago de Hab. 8 · Z. · abono a la noche del 24/11', x.room, x.stay_id, 'abono', 0, 0, 830, 'Transferencia', NULL, x.id, 0
    FROM sales x JOIN stays s ON s.id = x.stay_id
   WHERE s.hotel_id = 'prado' AND s.guest = 'Z.' AND x.local_date = '2026-11-24' AND x.pay = 'Pendiente' AND x.voided_at IS NULL AND x.paid_amount = 0
     AND NOT EXISTS (SELECT 1 FROM sales a WHERE a.parent_id = x.id AND a.kind = 'abono');
UPDATE sales SET paid_amount = 830
  WHERE id = (SELECT x.id FROM sales x JOIN stays s ON s.id = x.stay_id WHERE s.hotel_id = 'prado' AND s.guest = 'Z.' AND x.local_date = '2026-11-24' AND x.pay = 'Pendiente' AND x.voided_at IS NULL)
    AND paid_amount = 0 AND EXISTS (SELECT 1 FROM sales a WHERE a.parent_id = sales.id AND a.kind = 'abono' AND a.amount = 830);

INSERT INTO audit (action, entity, entity_id, detail, ts) VALUES ('pago_pendiente', 'reporte', 'Z-abono', '{"hotel":"prado","monto":2080,"forma":"Transferencia","nota":"abono del reporte del 26/11, sin foto del comprobante"}', 1795744800000);
