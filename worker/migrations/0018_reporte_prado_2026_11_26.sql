-- Reporte en papel de Hostal Prado Alto del 26/11/2026 (Brenda). Nombres con iniciales porque el repositorio es público.
-- Huéspedes en la habitación ahora: quedan ocupando y salen el 27/11 a las 11:00.
-- No se carga una habitación ocupada o que ya tenga otra estadía en esas fechas (si recepción ya la registró en la app).

-- Hab. 1
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Fabiola O.', 'noche', 1795723200000, 1795798800000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '1' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795798800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795723200000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-26', 1795723200000, 'Hab. 1 · Fabiola O. · Grupo Comidas', '1', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '1' AND s.guest = 'Fabiola O.' AND s.check_in_at = 1795723200000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795723200000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Fabiola O.' AND s.check_in_at = 1795723200000)
  WHERE hotel_id = 'prado' AND number = '1' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Fabiola O.' AND s.check_in_at = 1795723200000 AND s.checked_out_at IS NULL);

-- Hab. 2
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Edwin, Deyby y Luis', 'noche', 1795723260000, 1795798800000, 1, 0, 2000, NULL, 'Triple', 'Grupo Comidas'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '2' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795798800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795723260000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-26', 1795723260000, 'Hab. 2 · Edwin, Deyby y Luis · Grupo Comidas', '2', s.id, 'hospedaje', 1, 0, 2000, 'Pendiente', NULL, 'Triple', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '2' AND s.guest = 'Edwin, Deyby y Luis' AND s.check_in_at = 1795723260000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795723260000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Edwin, Deyby y Luis' AND s.check_in_at = 1795723260000)
  WHERE hotel_id = 'prado' AND number = '2' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Edwin, Deyby y Luis' AND s.check_in_at = 1795723260000 AND s.checked_out_at IS NULL);

-- Hab. 3
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Bessy, Jeyson y César', 'noche', 1795723320000, 1795798800000, 1, 0, 2000, NULL, 'Triple', 'Grupo Comidas'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '3' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795798800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795723320000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-26', 1795723320000, 'Hab. 3 · Bessy, Jeyson y César · Grupo Comidas', '3', s.id, 'hospedaje', 1, 0, 2000, 'Pendiente', NULL, 'Triple', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '3' AND s.guest = 'Bessy, Jeyson y César' AND s.check_in_at = 1795723320000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795723320000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Bessy, Jeyson y César' AND s.check_in_at = 1795723320000)
  WHERE hotel_id = 'prado' AND number = '3' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Bessy, Jeyson y César' AND s.check_in_at = 1795723320000 AND s.checked_out_at IS NULL);

-- Hab. 5
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Jeyson, Luis y Williams', 'noche', 1795723380000, 1795798800000, 1, 0, 2000, NULL, 'Triple', 'Grupo Comidas'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '5' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795798800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795723380000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-26', 1795723380000, 'Hab. 5 · Jeyson, Luis y Williams · Grupo Comidas', '5', s.id, 'hospedaje', 1, 0, 2000, 'Pendiente', NULL, 'Triple', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '5' AND s.guest = 'Jeyson, Luis y Williams' AND s.check_in_at = 1795723380000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795723380000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Jeyson, Luis y Williams' AND s.check_in_at = 1795723380000)
  WHERE hotel_id = 'prado' AND number = '5' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Jeyson, Luis y Williams' AND s.check_in_at = 1795723380000 AND s.checked_out_at IS NULL);

-- Hab. 6
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Nolberto C.', 'noche', 1795723440000, 1795798800000, 1, 0, 1250, NULL, 'Sencilla', NULL
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '6' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795798800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795723440000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-26', 1795723440000, 'Hab. 6 · Nolberto C.', '6', s.id, 'hospedaje', 1, 0, 1250, 'Tarjeta', NULL, 'Sencilla', NULL
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '6' AND s.guest = 'Nolberto C.' AND s.check_in_at = 1795723440000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795723440000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Nolberto C.' AND s.check_in_at = 1795723440000)
  WHERE hotel_id = 'prado' AND number = '6' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Nolberto C.' AND s.check_in_at = 1795723440000 AND s.checked_out_at IS NULL);

-- Hab. 7
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Henry A.', 'noche', 1795723500000, 1795798800000, 1, 0, 2000, NULL, 'Triple', 'Grupo Comidas'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '7' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795798800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795723500000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-26', 1795723500000, 'Hab. 7 · Henry A. · Grupo Comidas', '7', s.id, 'hospedaje', 1, 0, 2000, 'Pendiente', NULL, 'Triple', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '7' AND s.guest = 'Henry A.' AND s.check_in_at = 1795723500000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795723500000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Henry A.' AND s.check_in_at = 1795723500000)
  WHERE hotel_id = 'prado' AND number = '7' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Henry A.' AND s.check_in_at = 1795723500000 AND s.checked_out_at IS NULL);

-- Hab. 8
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Z.', 'noche', 1795723560000, 1795798800000, 1, 0, 0, NULL, 'Sencilla', NULL
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '8' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795798800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795723560000);
UPDATE rooms SET status = 'ocupada', updated_at = 1795723560000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Z.' AND s.check_in_at = 1795723560000)
  WHERE hotel_id = 'prado' AND number = '8' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Z.' AND s.check_in_at = 1795723560000 AND s.checked_out_at IS NULL);

-- Hab. 9
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Rubén R.', 'noche', 1795723620000, 1795798800000, 1, 0, 1400, NULL, 'Sencilla', 'Emsula'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '9' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795798800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795723620000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-26', 1795723620000, 'Hab. 9 · Rubén R. · Emsula', '9', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Emsula'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '9' AND s.guest = 'Rubén R.' AND s.check_in_at = 1795723620000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795723620000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Rubén R.' AND s.check_in_at = 1795723620000)
  WHERE hotel_id = 'prado' AND number = '9' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Rubén R.' AND s.check_in_at = 1795723620000 AND s.checked_out_at IS NULL);

-- Hab. 11
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Edwin R.', 'noche', 1795723680000, 1795798800000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '11' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795798800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795723680000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-26', 1795723680000, 'Hab. 11 · Edwin R. · Grupo Comidas', '11', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '11' AND s.guest = 'Edwin R.' AND s.check_in_at = 1795723680000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795723680000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Edwin R.' AND s.check_in_at = 1795723680000)
  WHERE hotel_id = 'prado' AND number = '11' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Edwin R.' AND s.check_in_at = 1795723680000 AND s.checked_out_at IS NULL);

-- Hab. 12
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Nelson L.', 'noche', 1795723740000, 1795798800000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '12' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795798800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795723740000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-26', 1795723740000, 'Hab. 12 · Nelson L. · Grupo Comidas', '12', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '12' AND s.guest = 'Nelson L.' AND s.check_in_at = 1795723740000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795723740000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Nelson L.' AND s.check_in_at = 1795723740000)
  WHERE hotel_id = 'prado' AND number = '12' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Nelson L.' AND s.check_in_at = 1795723740000 AND s.checked_out_at IS NULL);

-- Hab. 13
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'José S.', 'noche', 1795723800000, 1795798800000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '13' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795798800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795723800000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-26', 1795723800000, 'Hab. 13 · José S. · Grupo Comidas', '13', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '13' AND s.guest = 'José S.' AND s.check_in_at = 1795723800000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795723800000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'José S.' AND s.check_in_at = 1795723800000)
  WHERE hotel_id = 'prado' AND number = '13' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'José S.' AND s.check_in_at = 1795723800000 AND s.checked_out_at IS NULL);

-- Hab. 14
INSERT INTO stays (hotel_id, room_id, guest, kind, check_in_at, due_out_at, nights, hours, rate, created_by, room_type, company)
  SELECT 'prado', r.id, 'Greydi C.', 'noche', 1795723860000, 1795798800000, 1, 0, 1400, NULL, 'Sencilla', 'Grupo Comidas'
  FROM rooms r WHERE r.hotel_id = 'prado' AND r.number = '14' AND r.status = 'libre' AND r.current_stay_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM stays s WHERE s.room_id = r.id AND s.checkout_mode IS NOT 'cancelada' AND s.check_in_at < 1795798800000 AND COALESCE(s.checked_out_at, s.due_out_at) > 1795723860000);
INSERT INTO sales (hotel_id, local_date, ts, concept, room, stay_id, kind, nights, hours, amount, pay, created_by, room_type, company)
  SELECT 'prado', '2026-11-26', 1795723860000, 'Hab. 14 · Greydi C. · Grupo Comidas', '14', s.id, 'hospedaje', 1, 0, 1400, 'Pendiente', NULL, 'Sencilla', 'Grupo Comidas'
  FROM stays s JOIN rooms r ON r.id = s.room_id WHERE r.hotel_id = 'prado' AND r.number = '14' AND s.guest = 'Greydi C.' AND s.check_in_at = 1795723860000
    AND NOT EXISTS (SELECT 1 FROM sales x WHERE x.stay_id = s.id);
UPDATE rooms SET status = 'ocupada', updated_at = 1795723860000,
  current_stay_id = (SELECT s.id FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Greydi C.' AND s.check_in_at = 1795723860000)
  WHERE hotel_id = 'prado' AND number = '14' AND status = 'libre' AND current_stay_id IS NULL
    AND EXISTS (SELECT 1 FROM stays s WHERE s.room_id = rooms.id AND s.guest = 'Greydi C.' AND s.check_in_at = 1795723860000 AND s.checked_out_at IS NULL);

INSERT INTO audit (action, entity, entity_id, detail, ts) SELECT 'carga_reporte', 'reporte', '2026-11-26', '{"hotel":"prado","por":"Brenda"}', 1795723200000
  WHERE NOT EXISTS (SELECT 1 FROM audit WHERE action = 'carga_reporte' AND entity_id = '2026-11-26' AND detail LIKE '%prado%');
