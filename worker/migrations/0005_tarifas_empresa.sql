-- Las tarifas por tipo de Prado Alto (1400 / 1700 / 2000) son solo para empresas de crédito.
-- company_rates: tarifas de empresas. rates: tarifas para clientes (vacías hasta que el dueño las defina).
ALTER TABLE hotels ADD COLUMN company_rates TEXT;

UPDATE hotels SET company_rates = rates, rates = '{"Sencilla":null,"Doble":null,"Triple":null}' WHERE id = 'prado';
