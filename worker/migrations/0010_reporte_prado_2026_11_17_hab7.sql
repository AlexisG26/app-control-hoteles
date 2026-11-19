-- Hostal Prado Alto, 17/11/2026: Hab. 7 · clienta sin nombre · Sencilla · L 1,250 · Tarjeta.
-- 1 noche: salió el 18/11 a las 11:00 (queda como historial). No se carga si la Hab. 7 ya tiene otra estadía en esas fechas.

INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Clienta hab. 7', 'noche', 1794946200000, 1795021200000, 1, 0, 1250, NULL, 'Sencilla', NULL, 1795021200000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '7'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795021200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794946200000);

INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type)
  SELECT 'prado', '2026-11-17', 1794946200000, 'Hab. 7 · Clienta hab. 7', '7', s.id, 'hospedaje', 1, 0, 1250, 'Tarjeta', NULL, 'Sencilla'
  FROM stays s JOIN rooms r ON r.id = s.room_id
  WHERE r.hotel_id = 'prado' AND r.number = '7' AND s.guest = 'Clienta hab. 7' AND s.check_in_at = 1794946200000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

INSERT INTO audit (action, entity, entity_id, detail, ts) VALUES ('carga_reporte', 'reporte', '2026-11-17', '{"hotel":"prado","habitacion":"7"}', 1794946200000);
