-- Carga del reporte de ventas diarias de Hostal Prado Alto del 18/11/2026 (hecho por Brenda).
-- Hab. 4 cliente Doble L 1,550 en efectivo; 11 a 14 Grupo Comidas a crédito (tarifa Sencilla 1400, Pendiente).
-- 1 noche: salieron el 19/11 a las 11:00 (historial). No se carga si la habitación ya tiene otra estadía en esas fechas.

-- Corrección del nombre de la Hab. 13 del 17/11: es José Sales (no José Soto).
UPDATE stays SET guest = 'José Sales' WHERE hotel_id = 'prado' AND guest = 'José Soto';
UPDATE sales SET concept = REPLACE(concept, 'José Soto', 'José Sales') WHERE hotel_id = 'prado' AND concept LIKE '%José Soto%';

-- Hab. 4
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Leslie', 'noche', 1795032000000, 1795107600000, 1, 0, 1550, NULL, 'Doble', NULL, 1795107600000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '4'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795107600000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795032000000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-18', 1795032000000, 'Hab. 4 · Leslie', '4', s.id, 'hospedaje', 1, 0, 1550, 'Efectivo', NULL, 'Doble', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '4' AND s.guest = 'Leslie' AND s.check_in_at = 1795032000000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 11
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Edwin Rodríguez', 'noche', 1795032060000, 1795107600000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795107600000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '11'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795107600000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795032060000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-18', 1795032060000, 'Hab. 11 · Edwin Rodríguez · Grupo Comidas', '11', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '11' AND s.guest = 'Edwin Rodríguez' AND s.check_in_at = 1795032060000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 12
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Coreiby', 'noche', 1795032120000, 1795107600000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795107600000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '12'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795107600000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795032120000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-18', 1795032120000, 'Hab. 12 · Coreiby · Grupo Comidas', '12', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '12' AND s.guest = 'Coreiby' AND s.check_in_at = 1795032120000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 13
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'José Sales', 'noche', 1795032180000, 1795107600000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795107600000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '13'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795107600000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795032180000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-18', 1795032180000, 'Hab. 13 · José Sales · Grupo Comidas', '13', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '13' AND s.guest = 'José Sales' AND s.check_in_at = 1795032180000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 14
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Orlin Regalado', 'noche', 1795032240000, 1795107600000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795107600000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '14'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795107600000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795032240000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-18', 1795032240000, 'Hab. 14 · Orlin Regalado · Grupo Comidas', '14', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '14' AND s.guest = 'Orlin Regalado' AND s.check_in_at = 1795032240000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

INSERT INTO audit (action, entity, entity_id, detail, ts) VALUES ('carga_reporte', 'reporte', '2026-11-18', '{"hotel":"prado","por":"Brenda"}', 1795032000000);
