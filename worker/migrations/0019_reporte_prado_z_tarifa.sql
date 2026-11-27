-- Hostal Prado Alto, hab. 8 (Z.): las noches del 24/11 y 26/11 venían sin precio en el reporte en papel.
-- Se cobran a L 1,250 por noche como pago pendiente, para que gerencia lo confirme con el abono de L 2,080.
UPDATE stays SET rate = 1250, room_type = COALESCE(room_type, 'Sencilla')
  WHERE hotel_id = 'prado' AND guest = 'Z.' AND (rate IS NULL OR rate = 0);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type)
  SELECT s.hotel_id, date(s.check_in_at / 1000 - 6 * 3600, 'unixepoch'), s.check_in_at, 'Hab. ' || r.number || ' · Z.', r.number, s.id, 'hospedaje', s.nights, 0,
         1250 * s.nights, 'Pendiente', NULL, 'Sencilla'
    FROM stays s JOIN rooms r ON r.id = s.room_id
   WHERE s.hotel_id = 'prado' AND s.guest = 'Z.' AND s.checkout_mode IS NOT 'cancelada'
     AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO audit (action, entity, entity_id, detail, ts) VALUES ('carga_reporte', 'reporte', 'Z-1250', '{"hotel":"prado","nota":"noches sin precio a 1250 pendiente"}', CAST(strftime('%s','now') AS INTEGER) * 1000);
