-- Reportes en papel de Hostal Prado Alto del 23, 24 y 25/11/2026 (nombres con iniciales porque el repositorio es público).
-- 1 noche cada uno, salida al día siguiente a las 11:00 (historial). No se carga una habitación que ya tenga otra estadía en esas fechas.

-- ===== 2026-11-23 =====
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Reina C.', 'noche', 1795464000000, 1795539600000, 1, 0, 1550, NULL, 'Doble', NULL, 1795539600000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '6'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795539600000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795464000000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-23', 1795464000000, 'Hab. 6 · Reina C.', '6', s.id, 'hospedaje', 1, 0, 1550, 'Efectivo', NULL, 'Doble', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '6' AND s.guest = 'Reina C.' AND s.check_in_at = 1795464000000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Rubén R.', 'noche', 1795464060000, 1795539600000, 1, 0, 1400, NULL, 'Sencilla', 'Emsula', 1795539600000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '9'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795539600000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795464060000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-23', 1795464060000, 'Hab. 9 · Rubén R. · Emsula', '9', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Emsula'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '9' AND s.guest = 'Rubén R.' AND s.check_in_at = 1795464060000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Edwin R.', 'noche', 1795464120000, 1795539600000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795539600000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '11'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795539600000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795464120000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-23', 1795464120000, 'Hab. 11 · Edwin R. · Grupo Comidas', '11', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '11' AND s.guest = 'Edwin R.' AND s.check_in_at = 1795464120000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Antonio F.', 'noche', 1795464180000, 1795539600000, 1, 0, 1250, NULL, 'Sencilla', NULL, 1795539600000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '12'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795539600000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795464180000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-23', 1795464180000, 'Hab. 12 · Antonio F.', '12', s.id, 'hospedaje', 1, 0, 1250, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '12' AND s.guest = 'Antonio F.' AND s.check_in_at = 1795464180000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Alejandro C.', 'noche', 1795464240000, 1795539600000, 1, 0, 1250, NULL, 'Sencilla', NULL, 1795539600000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '13'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795539600000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795464240000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-23', 1795464240000, 'Hab. 13 · Alejandro C.', '13', s.id, 'hospedaje', 1, 0, 1250, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '13' AND s.guest = 'Alejandro C.' AND s.check_in_at = 1795464240000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Alcide P.', 'noche', 1795464300000, 1795539600000, 1, 0, 1250, NULL, 'Sencilla', 'Emsula', 1795539600000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '14'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795539600000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795464300000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-23', 1795464300000, 'Hab. 14 · Alcide P. · Emsula', '14', s.id, 'hospedaje', 1, 0, 1250, 'Tarjeta', NULL, 'Sencilla', 'Emsula'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '14' AND s.guest = 'Alcide P.' AND s.check_in_at = 1795464300000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO audit (action, entity, entity_id, detail, ts) SELECT 'carga_reporte', 'reporte', '2026-11-23', '{"hotel":"prado"}', 1795464000000
  WHERE NOT EXISTS (SELECT 1 FROM audit WHERE action = 'carga_reporte' AND entity_id = '2026-11-23' AND detail LIKE '%prado%');

-- ===== 2026-11-24 =====
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Z.', 'noche', 1795550400000, 1795626000000, 1, 0, 0, NULL, 'Sencilla', NULL, 1795626000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '8'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795626000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795550400000);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Rubén R.', 'noche', 1795550460000, 1795626000000, 1, 0, 1400, NULL, 'Sencilla', 'Emsula', 1795626000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '9'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795626000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795550460000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-24', 1795550460000, 'Hab. 9 · Rubén R. · Emsula', '9', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Emsula'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '9' AND s.guest = 'Rubén R.' AND s.check_in_at = 1795550460000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Edwin R.', 'noche', 1795550520000, 1795626000000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795626000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '11'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795626000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795550520000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-24', 1795550520000, 'Hab. 11 · Edwin R. · Grupo Comidas', '11', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '11' AND s.guest = 'Edwin R.' AND s.check_in_at = 1795550520000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Juan F.', 'noche', 1795550580000, 1795626000000, 1, 0, 1250, NULL, 'Sencilla', NULL, 1795626000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '12'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795626000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795550580000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-24', 1795550580000, 'Hab. 12 · Juan F.', '12', s.id, 'hospedaje', 1, 0, 1250, 'Efectivo', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '12' AND s.guest = 'Juan F.' AND s.check_in_at = 1795550580000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Sergio V.', 'noche', 1795550640000, 1795626000000, 1, 0, 937, NULL, 'Sencilla', NULL, 1795626000000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '13'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795626000000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795550640000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-24', 1795550640000, 'Hab. 13 · Sergio V.', '13', s.id, 'hospedaje', 1, 0, 937, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '13' AND s.guest = 'Sergio V.' AND s.check_in_at = 1795550640000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO audit (action, entity, entity_id, detail, ts) SELECT 'carga_reporte', 'reporte', '2026-11-24', '{"hotel":"prado","por":"Brenda"}', 1795550400000
  WHERE NOT EXISTS (SELECT 1 FROM audit WHERE action = 'carga_reporte' AND entity_id = '2026-11-24' AND detail LIKE '%prado%');

-- ===== 2026-11-25 =====
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Estefany L.', 'noche', 1795636800000, 1795712400000, 1, 0, 1550, NULL, 'Doble', NULL, 1795712400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '6'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795712400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795636800000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-25', 1795636800000, 'Hab. 6 · Estefany L.', '6', s.id, 'hospedaje', 1, 0, 1550, 'Tarjeta', NULL, 'Doble', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '6' AND s.guest = 'Estefany L.' AND s.check_in_at = 1795636800000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Rubén R.', 'noche', 1795636860000, 1795712400000, 1, 0, 1400, NULL, 'Sencilla', 'Emsula', 1795712400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '9'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795712400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795636860000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-25', 1795636860000, 'Hab. 9 · Rubén R. · Emsula', '9', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Emsula'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '9' AND s.guest = 'Rubén R.' AND s.check_in_at = 1795636860000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Edwin R.', 'noche', 1795636920000, 1795712400000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795712400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '11'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795712400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795636920000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-25', 1795636920000, 'Hab. 11 · Edwin R. · Grupo Comidas', '11', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '11' AND s.guest = 'Edwin R.' AND s.check_in_at = 1795636920000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Nelson L.', 'noche', 1795636980000, 1795712400000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795712400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '12'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795712400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795636980000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-25', 1795636980000, 'Hab. 12 · Nelson L. · Grupo Comidas', '12', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '12' AND s.guest = 'Nelson L.' AND s.check_in_at = 1795636980000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'José S.', 'noche', 1795637040000, 1795712400000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795712400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '13'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795712400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795637040000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-25', 1795637040000, 'Hab. 13 · José S. · Grupo Comidas', '13', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '13' AND s.guest = 'José S.' AND s.check_in_at = 1795637040000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Juan C.', 'noche', 1795637100000, 1795712400000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795712400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '14'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795712400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795637100000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-25', 1795637100000, 'Hab. 14 · Juan C. · Grupo Comidas', '14', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '14' AND s.guest = 'Juan C.' AND s.check_in_at = 1795637100000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO audit (action, entity, entity_id, detail, ts) SELECT 'carga_reporte', 'reporte', '2026-11-25', '{"hotel":"prado"}', 1795636800000
  WHERE NOT EXISTS (SELECT 1 FROM audit WHERE action = 'carga_reporte' AND entity_id = '2026-11-25' AND detail LIKE '%prado%');
