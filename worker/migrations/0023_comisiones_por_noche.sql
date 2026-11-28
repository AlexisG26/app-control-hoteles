-- La comisión es por noche: tarifa de la persona × noches de cada cobro (entrada o extensión).
-- Se guarda la tarifa usada (commission_rate) y se recalcula lo ya registrado.
ALTER TABLE sales ADD COLUMN commission_rate REAL;
UPDATE sales SET commission_rate = commission_amount WHERE commission_user_id IS NOT NULL AND commission_rate IS NULL;
UPDATE sales SET commission_amount = commission_rate * MAX(COALESCE(nights, 0), 1) WHERE commission_user_id IS NOT NULL AND commission_rate IS NOT NULL;
