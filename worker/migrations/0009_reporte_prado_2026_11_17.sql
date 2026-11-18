-- Carga del reporte de ventas diarias de Hostal Prado Alto del 17/11/2026.
-- Todas las habitaciones a crédito (Grupo Comidas y Emsula): tarifa de empresa, pago Pendiente.
-- 1 noche: salieron el 18/11 a las 11:00 (quedan como historial; no cambia el estado actual de las habitaciones).
-- No se carga una habitación que ya tenga otra estadía registrada en esas fechas.

-- Hab. 13: el huésped que entró a la 1:20 del 17/11 salió ese día a las 11:00 (el 17/11 en la noche la ocupó José Soto).
UPDATE stays SET due_out_at = 1794934800000, checked_out_at = 1794934800000, checkout_mode = COALESCE(checkout_mode, 'manual')
  WHERE hotel_id = 'prado' AND guest = 'Huésped hab. 13' AND check_in_at BETWEEN 1794900000000 AND 1794934800000 AND due_out_at > 1794934800000;
UPDATE rooms SET status = 'por_limpiar', current_stay_id = NULL
  WHERE hotel_id = 'prado' AND number = '13' AND status = 'ocupada'
    AND current_stay_id = (SELECT id FROM stays WHERE hotel_id = 'prado' AND guest = 'Huésped hab. 13' AND check_in_at BETWEEN 1794900000000 AND 1794934800000);

-- Hab. 1
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Fabiola Cuevas', 'noche', 1794945600000, 1795021200000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795021200000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '1'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795021200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794945600000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-17', 1794945600000, 'Hab. 1 · Fabiola Cuevas · Grupo Comidas', '1', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '1' AND s.room_id = r.id AND s.guest = 'Fabiola Cuevas' AND s.check_in_at = 1794945600000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 4
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Lismary y Lesly', 'noche', 1794945660000, 1795021200000, 1, 0, 1700, NULL, 'Doble', 'Grupo Comidas', 1795021200000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '4'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795021200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794945660000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-17', 1794945660000, 'Hab. 4 · Lismary y Lesly · Grupo Comidas', '4', s.id, 'hospedaje', 1, 0, 1700, 'Pendiente', NULL, 'Doble', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '4' AND s.room_id = r.id AND s.guest = 'Lismary y Lesly' AND s.check_in_at = 1794945660000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 5
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Rolando y Edwin', 'noche', 1794945720000, 1795021200000, 1, 0, 1700, NULL, 'Doble', 'Grupo Comidas', 1795021200000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '5'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795021200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794945720000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-17', 1794945720000, 'Hab. 5 · Rolando y Edwin · Grupo Comidas', '5', s.id, 'hospedaje', 1, 0, 1700, 'Pendiente', NULL, 'Doble', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '5' AND s.room_id = r.id AND s.guest = 'Rolando y Edwin' AND s.check_in_at = 1794945720000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 6
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Brayan y Luis', 'noche', 1794945780000, 1795021200000, 1, 0, 1700, NULL, 'Doble', 'Grupo Comidas', 1795021200000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '6'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795021200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794945780000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-17', 1794945780000, 'Hab. 6 · Brayan y Luis · Grupo Comidas', '6', s.id, 'hospedaje', 1, 0, 1700, 'Pendiente', NULL, 'Doble', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '6' AND s.room_id = r.id AND s.guest = 'Brayan y Luis' AND s.check_in_at = 1794945780000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 8
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Henrry Cruz', 'noche', 1794945840000, 1795021200000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795021200000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '8'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795021200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794945840000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-17', 1794945840000, 'Hab. 8 · Henrry Cruz · Grupo Comidas', '8', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '8' AND s.room_id = r.id AND s.guest = 'Henrry Cruz' AND s.check_in_at = 1794945840000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 9
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Mario Domínguez', 'noche', 1794945900000, 1795021200000, 1, 0, 1400, NULL, 'Sencilla', 'Emsula', 1795021200000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '9'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795021200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794945900000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-17', 1794945900000, 'Hab. 9 · Mario Domínguez · Emsula', '9', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Emsula'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '9' AND s.room_id = r.id AND s.guest = 'Mario Domínguez' AND s.check_in_at = 1794945900000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 11
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Edwin Rodríguez', 'noche', 1794945960000, 1795021200000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795021200000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '11'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795021200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794945960000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-17', 1794945960000, 'Hab. 11 · Edwin Rodríguez · Grupo Comidas', '11', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '11' AND s.room_id = r.id AND s.guest = 'Edwin Rodríguez' AND s.check_in_at = 1794945960000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 12
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Coreiby', 'noche', 1794946020000, 1795021200000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795021200000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '12'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795021200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794946020000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-17', 1794946020000, 'Hab. 12 · Coreiby · Grupo Comidas', '12', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '12' AND s.room_id = r.id AND s.guest = 'Coreiby' AND s.check_in_at = 1794946020000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 13
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'José Soto', 'noche', 1794946080000, 1795021200000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795021200000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '13'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795021200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794946080000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-17', 1794946080000, 'Hab. 13 · José Soto · Grupo Comidas', '13', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '13' AND s.room_id = r.id AND s.guest = 'José Soto' AND s.check_in_at = 1794946080000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 14
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Orlin Regalado', 'noche', 1794946140000, 1795021200000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795021200000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '14'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795021200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1794946140000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-17', 1794946140000, 'Hab. 14 · Orlin Regalado · Grupo Comidas', '14', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '14' AND s.room_id = r.id AND s.guest = 'Orlin Regalado' AND s.check_in_at = 1794946140000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

INSERT INTO audit (action, entity, entity_id, detail, ts) VALUES ('carga_reporte', 'reporte', '2026-11-17', '{"hotel":"prado"}', 1794945600000);
