-- Carga del reporte de ventas diarias de Hostal Prado Alto del 13/11/2026 (hecho por Yahaira Morales).
-- Solo ocupa habitaciones que estén libres; si una ya está ocupada en la app, esa fila no se carga.
-- Las empresas a crédito quedan como pago Pendiente con la tarifa por tipo (Sencilla 1400, Doble 1700, Triple 2000).

-- Hab. 1
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Nelson Alemán', 'noche', 1794600000000, 1794675600000, 1, 0, 1400, NULL, 'Sencilla', 'Emsula' FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '1' AND r.status = 'libre';
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-13', 1794600000000, 'Hab. 1 · Nelson Alemán · Emsula', '1', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Emsula'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '1' AND r.status = 'libre' AND s.guest = 'Nelson Alemán' AND s.check_in_at = 1794600000000;
UPDATE rooms SET status = 'ocupada', updated_at = 1794600000000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Nelson Alemán' AND s.check_in_at = 1794600000000)
  WHERE hotel_id = 'prado' AND number = '1' AND status = 'libre'
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Nelson Alemán' AND s.check_in_at = 1794600000000);

-- Hab. 2
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Javier, Jorge y Luis', 'noche', 1794600060000, 1794675600000, 1, 0, 2000, NULL, 'Triple', 'Pepsi' FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '2' AND r.status = 'libre';
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-13', 1794600060000, 'Hab. 2 · Javier, Jorge y Luis · Pepsi', '2', s.id, 'hospedaje', 1, 0, 2000, 'Pendiente', NULL, 'Triple', 'Pepsi'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '2' AND r.status = 'libre' AND s.guest = 'Javier, Jorge y Luis' AND s.check_in_at = 1794600060000;
UPDATE rooms SET status = 'ocupada', updated_at = 1794600060000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Javier, Jorge y Luis' AND s.check_in_at = 1794600060000)
  WHERE hotel_id = 'prado' AND number = '2' AND status = 'libre'
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Javier, Jorge y Luis' AND s.check_in_at = 1794600060000);

-- Hab. 3
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Wilmer, Henry y Jorge', 'noche', 1794600120000, 1794675600000, 1, 0, 2000, NULL, 'Triple', 'Pepsi' FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '3' AND r.status = 'libre';
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-13', 1794600120000, 'Hab. 3 · Wilmer, Henry y Jorge · Pepsi', '3', s.id, 'hospedaje', 1, 0, 2000, 'Pendiente', NULL, 'Triple', 'Pepsi'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '3' AND r.status = 'libre' AND s.guest = 'Wilmer, Henry y Jorge' AND s.check_in_at = 1794600120000;
UPDATE rooms SET status = 'ocupada', updated_at = 1794600120000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Wilmer, Henry y Jorge' AND s.check_in_at = 1794600120000)
  WHERE hotel_id = 'prado' AND number = '3' AND status = 'libre'
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Wilmer, Henry y Jorge' AND s.check_in_at = 1794600120000);

-- Hab. 4
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Elvia Paz', 'noche', 1794600180000, 1794675600000, 1, 0, 1550, NULL, 'Doble', NULL FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '4' AND r.status = 'libre';
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-13', 1794600180000, 'Hab. 4 · Elvia Paz', '4', s.id, 'hospedaje', 1, 0, 1550, 'Efectivo', NULL, 'Doble', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '4' AND r.status = 'libre' AND s.guest = 'Elvia Paz' AND s.check_in_at = 1794600180000;
UPDATE rooms SET status = 'ocupada', updated_at = 1794600180000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Elvia Paz' AND s.check_in_at = 1794600180000)
  WHERE hotel_id = 'prado' AND number = '4' AND status = 'libre'
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Elvia Paz' AND s.check_in_at = 1794600180000);

-- Hab. 6
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Belki Alvarado', 'noche', 1794600240000, 1794848400000, 3, 0, 1550, NULL, 'Doble', NULL FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '6' AND r.status = 'libre';
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-13', 1794600240000, 'Hab. 6 · Belki Alvarado', '6', s.id, 'hospedaje', 3, 0, 4650, 'Tarjeta', NULL, 'Doble', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '6' AND r.status = 'libre' AND s.guest = 'Belki Alvarado' AND s.check_in_at = 1794600240000;
UPDATE rooms SET status = 'ocupada', updated_at = 1794600240000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Belki Alvarado' AND s.check_in_at = 1794600240000)
  WHERE hotel_id = 'prado' AND number = '6' AND status = 'libre'
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Belki Alvarado' AND s.check_in_at = 1794600240000);

-- Hab. 8
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Felipe Gutiérrez', 'noche', 1794600300000, 1794675600000, 1, 0, 1400, NULL, 'Sencilla', 'Pepsi' FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '8' AND r.status = 'libre';
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-13', 1794600300000, 'Hab. 8 · Felipe Gutiérrez · Pepsi', '8', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Pepsi'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '8' AND r.status = 'libre' AND s.guest = 'Felipe Gutiérrez' AND s.check_in_at = 1794600300000;
UPDATE rooms SET status = 'ocupada', updated_at = 1794600300000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Felipe Gutiérrez' AND s.check_in_at = 1794600300000)
  WHERE hotel_id = 'prado' AND number = '8' AND status = 'libre'
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Felipe Gutiérrez' AND s.check_in_at = 1794600300000);

-- Hab. 9
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Beinci Josefina', 'noche', 1794600360000, 1794675600000, 1, 0, 4000, NULL, 'Sencilla', NULL FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '9' AND r.status = 'libre';
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-13', 1794600360000, 'Hab. 9 · Beinci Josefina', '9', s.id, 'hospedaje', 1, 0, 4000, 'Efectivo', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '9' AND r.status = 'libre' AND s.guest = 'Beinci Josefina' AND s.check_in_at = 1794600360000;
UPDATE rooms SET status = 'ocupada', updated_at = 1794600360000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Beinci Josefina' AND s.check_in_at = 1794600360000)
  WHERE hotel_id = 'prado' AND number = '9' AND status = 'libre'
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Beinci Josefina' AND s.check_in_at = 1794600360000);

-- Otros ingresos del día
INSERT INTO sales (hotel_id, local_date, ts, concept, kind, amount, pay, company) VALUES ('prado', '2026-11-13', 1794600600000, 'Boost Digital · pago de noches pendientes', 'extra', 4950, 'Transferencia', 'Boost Digital');
INSERT INTO sales (hotel_id, local_date, ts, concept, kind, amount, pay) VALUES ('prado', '2026-11-13', 1794600660000, 'Ventas varias', 'extra', 380, 'Efectivo');
INSERT INTO audit (action, entity, entity_id, detail, ts) VALUES ('carga_reporte', 'reporte', '2026-11-13', '{"hotel":"prado","por":"Yahaira Morales"}', 1794600000000);
