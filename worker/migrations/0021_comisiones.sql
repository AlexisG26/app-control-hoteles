-- Comisiones por reserva: quien registra la reserva gana su comisión (según la regla de su hotel).
-- La comisión se guarda en cada estadía al registrarla, así un cambio de regla no altera lo ya ganado.
CREATE TABLE commission_rules (
  hotel_id TEXT NOT NULL REFERENCES hotels(id),
  user_id  INTEGER NOT NULL REFERENCES users(id),
  amount   REAL NOT NULL,
  PRIMARY KEY (hotel_id, user_id)
);
ALTER TABLE stays ADD COLUMN commission_user_id INTEGER REFERENCES users(id);
ALTER TABLE stays ADD COLUMN commission_amount REAL;
CREATE INDEX stays_commission ON stays (commission_user_id, check_in_at);
CREATE TABLE commission_payouts (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  hotel_id TEXT NOT NULL,
  user_id  INTEGER NOT NULL,
  month    TEXT NOT NULL,            -- AAAA-MM
  amount   REAL NOT NULL,
  paid_at  INTEGER NOT NULL,
  paid_by  INTEGER,
  UNIQUE (hotel_id, user_id, month)
);

-- ProKinto: Kevin Serrano L 100 y Andrea Inocente L 200 por cada reserva que registran
INSERT OR IGNORE INTO commission_rules (hotel_id, user_id, amount)
  SELECT 'prokinto', u.id, 100 FROM users u
   WHERE u.deleted_at IS NULL AND lower(u.name) LIKE 'kevin%'
     AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.hotel_id = 'prokinto');
INSERT OR IGNORE INTO commission_rules (hotel_id, user_id, amount)
  SELECT 'prokinto', u.id, 200 FROM users u
   WHERE u.deleted_at IS NULL AND lower(u.name) LIKE 'andrea%'
     AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.hotel_id = 'prokinto');

-- Noviembre 2026 en adelante: reservas ya registradas por ellos
UPDATE stays SET commission_user_id = created_by,
  commission_amount = (SELECT c.amount FROM commission_rules c WHERE c.hotel_id = stays.hotel_id AND c.user_id = stays.created_by)
 WHERE commission_user_id IS NULL AND check_in_at >= 1793512800000
   AND EXISTS (SELECT 1 FROM commission_rules c WHERE c.hotel_id = stays.hotel_id AND c.user_id = stays.created_by);
