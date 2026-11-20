-- Avisos y control de limpieza por hotel. Hostal Prado Alto tiene recepción y limpieza diaria en persona:
-- al salir un huésped, la habitación queda disponible de inmediato (sin aviso ni pestaña de limpieza).
ALTER TABLE hotels ADD COLUMN cleaning INTEGER NOT NULL DEFAULT 1;
UPDATE hotels SET cleaning = 0 WHERE id = 'prado';
UPDATE rooms SET status = 'libre' WHERE hotel_id = 'prado' AND status IN ('por_limpiar', 'limpiando');
UPDATE cleanings SET finished_at = CAST(strftime('%s','now') AS INTEGER) * 1000, source = COALESCE(source, '') || ' (cerrada: limpieza diaria en persona)'
  WHERE hotel_id = 'prado' AND finished_at IS NULL;
