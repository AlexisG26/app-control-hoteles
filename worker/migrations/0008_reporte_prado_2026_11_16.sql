-- Carga del reporte de ventas diarias de Hostal Prado Alto del 16/11/2026 (hecho por Brenda)
-- y de la entrada a la Hab. 13 del 17/11/2026 a la 1:20 (Sencilla · L 1,250 · Tarjeta; sin nombre en el aviso).
-- Huéspedes del 16/11: 1 noche, salen el 17/11 a las 11:00 (la salida automática avisa a limpieza).
-- Empresas a crédito (Emsula, Grupo Comidas): tarifa Sencilla 1400, pago Pendiente.
-- Solo se carga si la habitación no está ocupada en la app ni tiene otra estadía en esas fechas.

-- Hab. 3
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Olga Barrios', 'noche', 1794859200000, 1794934800000, 1, 0, 1387, NULL, 'Triple', NULL
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '3' AND r.status IN ('libre','por_limpiar')
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1794934800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794859200000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-16', 1794859200000, 'Hab. 3 · Olga Barrios', '3', s.id, 'hospedaje', 1, 0, 1387, 'Efectivo', NULL, 'Triple', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '3' AND s.room_id = r.id AND s.guest = 'Olga Barrios' AND s.check_in_at = 1794859200000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1794859200000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Olga Barrios' AND s.check_in_at = 1794859200000)
  WHERE hotel_id = 'prado' AND number = '3' AND status IN ('libre','por_limpiar')
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Olga Barrios' AND s.check_in_at = 1794859200000);

-- Hab. 8
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Mario Domínguez', 'noche', 1794859260000, 1794934800000, 1, 0, 1400, NULL, 'Sencilla', 'Emsula'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '8' AND r.status IN ('libre','por_limpiar')
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1794934800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794859260000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-16', 1794859260000, 'Hab. 8 · Mario Domínguez · Emsula', '8', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Emsula'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '8' AND s.room_id = r.id AND s.guest = 'Mario Domínguez' AND s.check_in_at = 1794859260000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1794859260000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Mario Domínguez' AND s.check_in_at = 1794859260000)
  WHERE hotel_id = 'prado' AND number = '8' AND status IN ('libre','por_limpiar')
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Mario Domínguez' AND s.check_in_at = 1794859260000);

-- Hab. 9
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Carolina Padilla', 'noche', 1794859320000, 1794934800000, 1, 0, 1000, NULL, 'Sencilla', NULL
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '9' AND r.status IN ('libre','por_limpiar')
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1794934800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794859320000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-16', 1794859320000, 'Hab. 9 · Carolina Padilla', '9', s.id, 'hospedaje', 1, 0, 1000, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '9' AND s.room_id = r.id AND s.guest = 'Carolina Padilla' AND s.check_in_at = 1794859320000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1794859320000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Carolina Padilla' AND s.check_in_at = 1794859320000)
  WHERE hotel_id = 'prado' AND number = '9' AND status IN ('libre','por_limpiar')
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Carolina Padilla' AND s.check_in_at = 1794859320000);

-- Hab. 10
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Belki Alvarado', 'noche', 1794859380000, 1794934800000, 1, 0, 1500, NULL, 'Sencilla', NULL
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '10' AND r.status IN ('libre','por_limpiar')
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1794934800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794859380000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-16', 1794859380000, 'Hab. 10 · Belki Alvarado', '10', s.id, 'hospedaje', 1, 0, 1500, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '10' AND s.room_id = r.id AND s.guest = 'Belki Alvarado' AND s.check_in_at = 1794859380000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1794859380000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Belki Alvarado' AND s.check_in_at = 1794859380000)
  WHERE hotel_id = 'prado' AND number = '10' AND status IN ('libre','por_limpiar')
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Belki Alvarado' AND s.check_in_at = 1794859380000);

-- Hab. 11
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Edwin Rodríguez', 'noche', 1794859440000, 1794934800000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '11' AND r.status IN ('libre','por_limpiar')
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1794934800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794859440000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-16', 1794859440000, 'Hab. 11 · Edwin Rodríguez · Grupo Comidas', '11', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '11' AND s.room_id = r.id AND s.guest = 'Edwin Rodríguez' AND s.check_in_at = 1794859440000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1794859440000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Edwin Rodríguez' AND s.check_in_at = 1794859440000)
  WHERE hotel_id = 'prado' AND number = '11' AND status IN ('libre','por_limpiar')
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Edwin Rodríguez' AND s.check_in_at = 1794859440000);

-- Hab. 12
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Olvin Herrera', 'noche', 1794859500000, 1794934800000, 1, 0, 1250, NULL, 'Sencilla', NULL
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '12' AND r.status IN ('libre','por_limpiar')
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1794934800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794859500000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-16', 1794859500000, 'Hab. 12 · Olvin Herrera', '12', s.id, 'hospedaje', 1, 0, 1250, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '12' AND s.room_id = r.id AND s.guest = 'Olvin Herrera' AND s.check_in_at = 1794859500000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1794859500000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Olvin Herrera' AND s.check_in_at = 1794859500000)
  WHERE hotel_id = 'prado' AND number = '12' AND status IN ('libre','por_limpiar')
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Olvin Herrera' AND s.check_in_at = 1794859500000);

-- Hab. 14
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Orlin Regalado', 'noche', 1794859560000, 1794934800000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '14' AND r.status IN ('libre','por_limpiar')
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1794934800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794859560000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-16', 1794859560000, 'Hab. 14 · Orlin Regalado · Grupo Comidas', '14', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '14' AND s.room_id = r.id AND s.guest = 'Orlin Regalado' AND s.check_in_at = 1794859560000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1794859560000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Orlin Regalado' AND s.check_in_at = 1794859560000)
  WHERE hotel_id = 'prado' AND number = '14' AND status IN ('libre','por_limpiar')
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Orlin Regalado' AND s.check_in_at = 1794859560000);

-- Hab. 13
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Huésped hab. 13', 'noche', 1794900420000, 1795021200000, 1, 0, 1250, NULL, 'Sencilla', NULL
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '13' AND r.status IN ('libre','por_limpiar')
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795021200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794900420000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-17', 1794900420000, 'Hab. 13 · Huésped hab. 13', '13', s.id, 'hospedaje', 1, 0, 1250, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '13' AND s.room_id = r.id AND s.guest = 'Huésped hab. 13' AND s.check_in_at = 1794900420000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1794900420000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Huésped hab. 13' AND s.check_in_at = 1794900420000)
  WHERE hotel_id = 'prado' AND number = '13' AND status IN ('libre','por_limpiar')
  AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Huésped hab. 13' AND s.check_in_at = 1794900420000);

INSERT INTO audit (action, entity, entity_id, detail, ts) VALUES ('carga_reporte', 'reporte', '2026-11-16', '{"hotel":"prado","por":"Brenda"}', 1794859200000);
