-- Carga del reporte de ventas diarias de Hostal Prado Alto del 14/11/2026 (hecho por Brenda).
-- Hab. 14 · Edgar Hernández · cliente · Sencilla · L 750 · Tarjeta. 1 noche: salió el 15/11 a las 11:00 (queda como historial).
-- No se carga si la habitación 14 ya tiene otra estadía registrada en esas fechas.

INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Edgar Hernández', 'noche', 1794686400000, 1794762000000, 1, 0, 750, NULL, 'Sencilla', NULL, 1794762000000, 'historico'
  FROM rooms r
  WHERE r.hotel_id = 'prado' AND r.number = '14'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1794762000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794686400000);

INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type)
  SELECT 'prado', '2026-11-14', 1794686400000, 'Hab. 14 · Edgar Hernández', '14', s.id, 'hospedaje', 1, 0, 750, 'Tarjeta', NULL, 'Sencilla'
  FROM stays s JOIN rooms r ON r.id = s.room_id
  WHERE r.hotel_id = 'prado' AND r.number = '14' AND s.guest = 'Edgar Hernández' AND s.check_in_at = 1794686400000;

INSERT INTO audit (action, entity, entity_id, detail, ts) VALUES ('carga_reporte', 'reporte', '2026-11-14', '{"hotel":"prado","por":"Brenda"}', 1794686400000);
