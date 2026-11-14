-- Pagos pendientes y abonos con comprobante.
-- Un cobro con pay = 'Pendiente' es una cuenta por cobrar: no cuenta como ingreso hasta que se paga.
-- Cada pago es otra fila de sales con kind = 'abono', parent_id = la cuenta pendiente,
-- la forma de pago real, las noches que cubre (paid_nights) y la foto del comprobante (proof_key en R2).

ALTER TABLE sales ADD COLUMN parent_id INTEGER;
ALTER TABLE sales ADD COLUMN proof_key TEXT;
ALTER TABLE sales ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN paid_nights INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN settled_at INTEGER;
CREATE INDEX sales_parent ON sales (parent_id);
CREATE INDEX sales_pending ON sales (hotel_id, pay, settled_at);
