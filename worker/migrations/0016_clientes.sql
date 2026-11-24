-- Base de datos de clientes (ambos hoteles). Cada estadía queda enlazada a su cliente.
-- Las estadías que ya existen se enlazan solas la primera vez que se abre la lista de clientes.
CREATE TABLE guests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  name_key   TEXT NOT NULL,          -- nombre normalizado (sin tildes ni mayúsculas) para encontrar al mismo cliente
  phone      TEXT,
  email      TEXT,
  document   TEXT,                   -- identidad o pasaporte
  company    TEXT,
  notes      TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX guests_key ON guests (name_key);
CREATE INDEX guests_phone ON guests (phone);
ALTER TABLE stays ADD COLUMN guest_id INTEGER REFERENCES guests(id);
CREATE INDEX stays_guest ON stays (guest_id);
