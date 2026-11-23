-- Reportes en papel de Hostal Prado Alto: 20/11 y 22/11 (Brenda), 21/11 (Yahaira Morales).
-- Nombres con iniciales porque el repositorio es público.
-- No se carga una habitación que ya tenga otra estadía en esas fechas (por ejemplo, si recepción ya la registró en la app).

-- ===== 2026-11-20 =====
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'G. (estadía)', 'noche', 1795204800000, 1795280400000, 1, 0, 0, NULL, 'Sencilla', NULL, 1795280400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '2'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795280400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795204800000);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Franklin G.', 'noche', 1795204860000, 1795280400000, 1, 0, 1850, NULL, 'Triple', NULL, 1795280400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '3'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795280400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795204860000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-20', 1795204860000, 'Hab. 3 · Franklin G.', '3', s.id, 'hospedaje', 1, 0, 1850, 'Tarjeta', NULL, 'Triple', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '3' AND s.guest = 'Franklin G.' AND s.check_in_at = 1795204860000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Claudia G.', 'noche', 1795204920000, 1795280400000, 1, 0, 1250, NULL, 'Sencilla', NULL, 1795280400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '4'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795280400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795204920000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-20', 1795204920000, 'Hab. 4 · Claudia G.', '4', s.id, 'hospedaje', 1, 0, 1250, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '4' AND s.guest = 'Claudia G.' AND s.check_in_at = 1795204920000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Maynor S.', 'noche', 1795204980000, 1795280400000, 1, 0, 1550, NULL, 'Doble', NULL, 1795280400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '6'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795280400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795204980000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-20', 1795204980000, 'Hab. 6 · Maynor S.', '6', s.id, 'hospedaje', 1, 0, 1550, 'Efectivo', NULL, 'Doble', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '6' AND s.guest = 'Maynor S.' AND s.check_in_at = 1795204980000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Mario D.', 'noche', 1795205040000, 1795280400000, 1, 0, 1400, NULL, 'Sencilla', 'Emsula', 1795280400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '9'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795280400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795205040000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-20', 1795205040000, 'Hab. 9 · Mario D. · Emsula', '9', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Emsula'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '9' AND s.guest = 'Mario D.' AND s.check_in_at = 1795205040000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Edwin R.', 'noche', 1795205100000, 1795280400000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795280400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '11'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795280400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795205100000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-20', 1795205100000, 'Hab. 11 · Edwin R. · Grupo Comidas', '11', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '11' AND s.guest = 'Edwin R.' AND s.check_in_at = 1795205100000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Astrid Á.', 'noche', 1795205160000, 1795280400000, 1, 0, 1250, NULL, 'Sencilla', NULL, 1795280400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '13'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795280400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795205160000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-20', 1795205160000, 'Hab. 13 · Astrid Á.', '13', s.id, 'hospedaje', 1, 0, 1250, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '13' AND s.guest = 'Astrid Á.' AND s.check_in_at = 1795205160000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Orlin R.', 'noche', 1795205220000, 1795280400000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795280400000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '14'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795280400000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795205220000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-20', 1795205220000, 'Hab. 14 · Orlin R. · Grupo Comidas', '14', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '14' AND s.guest = 'Orlin R.' AND s.check_in_at = 1795205220000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO audit (action, entity, entity_id, detail, ts) SELECT 'carga_reporte', 'reporte', '2026-11-20', '{"hotel":"prado","por":"Brenda"}', 1795204800000
  WHERE NOT EXISTS (SELECT 1 FROM audit WHERE action = 'carga_reporte' AND entity_id = '2026-11-20' AND detail LIKE '%prado%');

-- ===== 2026-11-21 =====
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Edgar A.', 'noche', 1795291200000, 1795366800000, 1, 0, 1300, NULL, 'Sencilla', NULL, 1795366800000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '1'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795366800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795291200000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-21', 1795291200000, 'Hab. 1 · Edgar A.', '1', s.id, 'hospedaje', 1, 0, 1300, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '1' AND s.guest = 'Edgar A.' AND s.check_in_at = 1795291200000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'José N.', 'noche', 1795291260000, 1795366800000, 1, 0, 1850, NULL, 'Triple', NULL, 1795366800000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '3'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795366800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795291260000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-21', 1795291260000, 'Hab. 3 · José N.', '3', s.id, 'hospedaje', 1, 0, 1850, 'Tarjeta', NULL, 'Triple', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '3' AND s.guest = 'José N.' AND s.check_in_at = 1795291260000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'André D.', 'noche', 1795291320000, 1795366800000, 1, 0, 1250, NULL, 'Sencilla', NULL, 1795366800000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '8'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795366800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795291320000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-21', 1795291320000, 'Hab. 8 · André D.', '8', s.id, 'hospedaje', 1, 0, 1250, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '8' AND s.guest = 'André D.' AND s.check_in_at = 1795291320000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Mario D.', 'noche', 1795291380000, 1795366800000, 1, 0, 1400, NULL, 'Sencilla', 'Emsula', 1795366800000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '9'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795366800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795291380000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-21', 1795291380000, 'Hab. 9 · Mario D. · Emsula', '9', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Emsula'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '9' AND s.guest = 'Mario D.' AND s.check_in_at = 1795291380000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Aníbal S.', 'noche', 1795291440000, 1795366800000, 1, 0, 1250, NULL, 'Sencilla', NULL, 1795366800000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '10'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795366800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795291440000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-21', 1795291440000, 'Hab. 10 · Aníbal S.', '10', s.id, 'hospedaje', 1, 0, 1250, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '10' AND s.guest = 'Aníbal S.' AND s.check_in_at = 1795291440000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Edwin R.', 'noche', 1795291500000, 1795366800000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795366800000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '11'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795366800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795291500000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-21', 1795291500000, 'Hab. 11 · Edwin R. · Grupo Comidas', '11', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '11' AND s.guest = 'Edwin R.' AND s.check_in_at = 1795291500000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Marlon M.', 'noche', 1795291560000, 1795366800000, 1, 0, 1250, NULL, 'Sencilla', NULL, 1795366800000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '13'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795366800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795291560000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-21', 1795291560000, 'Hab. 13 · Marlon M.', '13', s.id, 'hospedaje', 1, 0, 1250, 'Efectivo', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '13' AND s.guest = 'Marlon M.' AND s.check_in_at = 1795291560000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Orlin R.', 'noche', 1795291620000, 1795366800000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', 1795366800000, 'historico'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '14'
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795366800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795291620000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-21', 1795291620000, 'Hab. 14 · Orlin R. · Grupo Comidas', '14', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '14' AND s.guest = 'Orlin R.' AND s.check_in_at = 1795291620000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
INSERT INTO audit (action, entity, entity_id, detail, ts) SELECT 'carga_reporte', 'reporte', '2026-11-21', '{"hotel":"prado","por":"Yahaira Morales"}', 1795291200000
  WHERE NOT EXISTS (SELECT 1 FROM audit WHERE action = 'carga_reporte' AND entity_id = '2026-11-21' AND detail LIKE '%prado%');

-- ===== 2026-11-22 =====
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Franklin G.', 'noche', 1795377600000, 1795453200000, 1, 0, 1550, NULL, 'Doble', NULL, NULL, NULL
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '6' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795453200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795377600000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-22', 1795377600000, 'Hab. 6 · Franklin G.', '6', s.id, 'hospedaje', 1, 0, 1550, 'Tarjeta', NULL, 'Doble', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '6' AND s.guest = 'Franklin G.' AND s.check_in_at = 1795377600000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795377600000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Franklin G.' AND s.check_in_at = 1795377600000)
  WHERE hotel_id = 'prado' AND number = '6' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Franklin G.' AND s.check_in_at = 1795377600000 AND s.checked_out_at IS NULL);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Z.', 'noche', 1795377660000, 1795453200000, 1, 0, 1250, NULL, 'Sencilla', NULL, NULL, NULL
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '8' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795453200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795377660000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-22', 1795377660000, 'Hab. 8 · Z.', '8', s.id, 'hospedaje', 1, 0, 1250, 'Pendiente', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '8' AND s.guest = 'Z.' AND s.check_in_at = 1795377660000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795377660000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Z.' AND s.check_in_at = 1795377660000)
  WHERE hotel_id = 'prado' AND number = '8' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Z.' AND s.check_in_at = 1795377660000 AND s.checked_out_at IS NULL);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Franklin G.', 'noche', 1795377720000, 1795453200000, 1, 0, 1250, NULL, 'Sencilla', NULL, NULL, NULL
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '9' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795453200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795377720000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-22', 1795377720000, 'Hab. 9 · Franklin G.', '9', s.id, 'hospedaje', 1, 0, 1250, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '9' AND s.guest = 'Franklin G.' AND s.check_in_at = 1795377720000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795377720000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Franklin G.' AND s.check_in_at = 1795377720000)
  WHERE hotel_id = 'prado' AND number = '9' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Franklin G.' AND s.check_in_at = 1795377720000 AND s.checked_out_at IS NULL);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Edwin R.', 'noche', 1795377780000, 1795453200000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', NULL, NULL
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '11' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795453200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795377780000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-22', 1795377780000, 'Hab. 11 · Edwin R. · Grupo Comidas', '11', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '11' AND s.guest = 'Edwin R.' AND s.check_in_at = 1795377780000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795377780000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Edwin R.' AND s.check_in_at = 1795377780000)
  WHERE hotel_id = 'prado' AND number = '11' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Edwin R.' AND s.check_in_at = 1795377780000 AND s.checked_out_at IS NULL);
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company, checked_out_at, checkout_mode)
  SELECT 'prado', r.id, 'Orlin R.', 'noche', 1795377840000, 1795453200000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas', NULL, NULL
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '14' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795453200000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795377840000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-22', 1795377840000, 'Hab. 14 · Orlin R. · Grupo Comidas', '14', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '14' AND s.guest = 'Orlin R.' AND s.check_in_at = 1795377840000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795377840000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Orlin R.' AND s.check_in_at = 1795377840000)
  WHERE hotel_id = 'prado' AND number = '14' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Orlin R.' AND s.check_in_at = 1795377840000 AND s.checked_out_at IS NULL);
INSERT INTO audit (action, entity, entity_id, detail, ts) SELECT 'carga_reporte', 'reporte', '2026-11-22', '{"hotel":"prado","por":"Brenda"}', 1795377600000
  WHERE NOT EXISTS (SELECT 1 FROM audit WHERE action = 'carga_reporte' AND entity_id = '2026-11-22' AND detail LIKE '%prado%');
