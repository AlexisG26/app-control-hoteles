-- Las extensiones también cuentan como reserva: la comisión pasa a cada cobro de hospedaje
-- (la entrada y cada extensión), para quien lo registró.
ALTER TABLE sales ADD COLUMN commission_user_id INTEGER REFERENCES users(id);
ALTER TABLE sales ADD COLUMN commission_amount REAL;
CREATE INDEX sales_commission ON sales (commission_user_id, local_date);

-- Noviembre 2026 en adelante: entradas y extensiones ya registradas por quien tiene comisión
UPDATE sales SET commission_user_id = created_by,
  commission_amount = (SELECT c.amount FROM commission_rules c WHERE c.hotel_id = sales.hotel_id AND c.user_id = sales.created_by)
 WHERE commission_user_id IS NULL AND kind IN ('hospedaje', 'hora') AND parent_id IS NULL AND local_date >= '2026-11-01'
   AND EXISTS (SELECT 1 FROM commission_rules c WHERE c.hotel_id = sales.hotel_id AND c.user_id = sales.created_by);
