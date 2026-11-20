-- Carga del reporte de ventas diarias de Hostal Prado Alto del 19/11/2026.
-- Hab. 1 pagó US$ 40 en efectivo (equivalen a L 937 según el reporte). Hab. 2 doble usada como sencilla.
-- 9 Emsula y 11 a 14 Grupo Comidas a crédito (tarifa Sencilla 1400, Pendiente).
-- 1 noche: salieron el 20/11 a las 11:00 (historial). No se carga si la habitación ya tiene otra estadía en esas fechas.

-- Hab. 1
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Dualca', 'noche', 1795118400000, 1795194000000, 1, 0, 937, NULL, 'Sencilla', NULL, 1795194000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '1'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795194000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795118400000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-19', 1795118400000, 'Hab. 1 · Dualca', '1', s.id, 'hospedaje', 1, 0, 937, 'Efectivo', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '1' AND s.guest = 'Dualca' AND s.check_in_at = 1795118400000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 2
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Kevin González', 'noche', 1795118460000, 1795194000000, 1, 0, 1250, NULL, 'Sencilla', NULL, 1795194000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '2'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795194000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795118460000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-19', 1795118460000, 'Hab. 2 · Kevin González', '2', s.id, 'hospedaje', 1, 0, 1250, 'Efectivo', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '2' AND s.guest = 'Kevin González' AND s.check_in_at = 1795118460000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 6
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Jorge Villanueva', 'noche', 1795118520000, 1795194000000, 1, 0, 1550, NULL, 'Doble', NULL, 1795194000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '6'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795194000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795118520000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-19', 1795118520000, 'Hab. 6 · Jorge Villanueva', '6', s.id, 'hospedaje', 1, 0, 1550, 'Tarjeta', NULL, 'Doble', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '6' AND s.guest = 'Jorge Villanueva' AND s.check_in_at = 1795118520000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 8
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Carlos Aguilar', 'noche', 1795118580000, 1795194000000, 1, 0, 1300, NULL, 'Sencilla', NULL, 1795194000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '8'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795194000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795118580000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-19', 1795118580000, 'Hab. 8 · Carlos Aguilar', '8', s.id, 'hospedaje', 1, 0, 1300, 'Efectivo', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '8' AND s.guest = 'Carlos Aguilar' AND s.check_in_at = 1795118580000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 9
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Mario Domínguez', 'noche', 1795118640000, 1795194000000, 1, 0, 1400, NULL, 'Sencilla', 'Emsula', 1795194000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '9'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795194000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795118640000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-19', 1795118640000, 'Hab. 9 · Mario Domínguez · Emsula', '9', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Emsula'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '9' AND s.guest = 'Mario Domínguez' AND s.check_in_at = 1795118640000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 10
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Josefina', 'noche', 1795118700000, 1795194000000, 1, 0, 2000, NULL, 'Sencilla', NULL, 1795194000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '10'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795194000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795118700000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-19', 1795118700000, 'Hab. 10 · Josefina', '10', s.id, 'hospedaje', 1, 0, 2000, 'Efectivo', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '10' AND s.guest = 'Josefina' AND s.check_in_at = 1795118700000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 11
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Edwin Rodríguez', 'noche', 1795118760000, 1795194000000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795194000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '11'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795194000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795118760000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-19', 1795118760000, 'Hab. 11 · Edwin Rodríguez · Grupo Comidas', '11', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '11' AND s.guest = 'Edwin Rodríguez' AND s.check_in_at = 1795118760000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 12
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Coreiby', 'noche', 1795118820000, 1795194000000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795194000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '12'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795194000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795118820000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-19', 1795118820000, 'Hab. 12 · Coreiby · Grupo Comidas', '12', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '12' AND s.guest = 'Coreiby' AND s.check_in_at = 1795118820000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 13
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'José Sales', 'noche', 1795118880000, 1795194000000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795194000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '13'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795194000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795118880000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-19', 1795118880000, 'Hab. 13 · José Sales · Grupo Comidas', '13', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '13' AND s.guest = 'José Sales' AND s.check_in_at = 1795118880000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 14
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Orlin Regalado', 'noche', 1795118940000, 1795194000000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795194000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '14'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.check_in_at < 1795194000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795118940000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-19', 1795118940000, 'Hab. 14 · Orlin Regalado · Grupo Comidas', '14', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '14' AND s.guest = 'Orlin Regalado' AND s.check_in_at = 1795118940000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);

-- Hab. 1: dólares en efectivo
UPDATE sales SET usd_amount = 40, fx_rate = 23.425, fx_date = '2026-11-19', fx_status = 2, concept = concept || ' (pagó US$ 40)'
  WHERE hotel_id = 'prado' AND local_date = '2026-11-19' AND room = '1' AND concept = 'Hab. 1 · Dualca' AND usd_amount IS NULL;

INSERT INTO audit (action, entity, entity_id, detail, ts) VALUES ('carga_reporte', 'reporte', '2026-11-19', '{"hotel":"prado"}', 1795118400000);
