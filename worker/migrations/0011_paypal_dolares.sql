-- PayPal en dólares: se guarda el monto en US$ y se convierte a lempiras con la tasa
-- del día siguiente a la reserva (cuando cae el dinero de PayPal).
ALTER TABLE sales ADD COLUMN usd_amount REAL;
ALTER TABLE sales ADD COLUMN fx_rate REAL;
ALTER TABLE sales ADD COLUMN fx_date TEXT;
ALTER TABLE sales ADD COLUMN fx_status INTEGER NOT NULL DEFAULT 0; -- 0 estimada · 1 tasa del día siguiente · 2 lo que cayó (contabilidad)

CREATE TABLE fx_rates (
  date       TEXT PRIMARY KEY,   -- fecha local AAAA-MM-DD
  rate       REAL NOT NULL,      -- lempiras por 1 US$
  source     TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX sales_fx ON sales (fx_status, fx_date);
