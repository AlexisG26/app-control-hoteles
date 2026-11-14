-- Tarifas por tipo de habitación, empresas de crédito e impuestos incluidos en el precio.

-- rates: precio por noche según tipo, en JSON. companies: empresas con crédito, en JSON.
-- tax_isv y tax_tourism: porcentajes ya incluidos dentro del precio (se desglosan en contabilidad).
ALTER TABLE hotels ADD COLUMN rates TEXT;
ALTER TABLE hotels ADD COLUMN companies TEXT;
ALTER TABLE hotels ADD COLUMN tax_isv REAL NOT NULL DEFAULT 0;
ALTER TABLE hotels ADD COLUMN tax_tourism REAL NOT NULL DEFAULT 0;

ALTER TABLE stays ADD COLUMN room_type TEXT;
ALTER TABLE stays ADD COLUMN company TEXT;
ALTER TABLE sales ADD COLUMN room_type TEXT;
ALTER TABLE sales ADD COLUMN company TEXT;

-- Hostal Prado Alto (precios con ISV 15% y Turismo 4% incluidos)
UPDATE hotels SET
  rates = '{"Sencilla":1400,"Doble":1700,"Triple":2000}',
  companies = '["Emsula","Grupo Comidas","Pepsi"]',
  tax_isv = 15, tax_tourism = 4,
  default_rate = 1400
WHERE id = 'prado';
