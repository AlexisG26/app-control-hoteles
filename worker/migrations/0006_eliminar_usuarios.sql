-- Usuarios eliminados: se conservan solo para que el historial (quién registró cada cobro) siga mostrando su nombre.
ALTER TABLE users ADD COLUMN deleted_at INTEGER;
