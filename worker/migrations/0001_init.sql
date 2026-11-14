-- Control de Hoteles · esquema inicial (Cloudflare D1 / SQLite)
-- Fechas: *_at = milisegundos UTC. local_date = 'YYYY-MM-DD' en hora de Honduras.

CREATE TABLE hotels (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  checkout_time TEXT NOT NULL DEFAULT '11:00',  -- hora local de salida
  allow_hourly  INTEGER NOT NULL DEFAULT 0,      -- habitaciones por hora
  allow_po      INTEGER NOT NULL DEFAULT 0,      -- orden de compra como forma de pago
  default_rate  REAL NOT NULL DEFAULT 600,
  created_at    INTEGER NOT NULL
);

CREATE TABLE rooms (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  hotel_id        TEXT NOT NULL REFERENCES hotels(id),
  number          TEXT NOT NULL,
  sort            INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'libre'
                  CHECK (status IN ('libre','ocupada','por_limpiar','limpiando','bloqueada')),
  current_stay_id INTEGER,
  updated_at      INTEGER,
  updated_by      INTEGER,
  UNIQUE (hotel_id, number)
);

CREATE TABLE users (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  email            TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  is_owner         INTEGER NOT NULL DEFAULT 0,
  active           INTEGER NOT NULL DEFAULT 1,
  telegram_chat_id TEXT,
  created_at       INTEGER NOT NULL
);

CREATE TABLE memberships (
  user_id  INTEGER NOT NULL REFERENCES users(id),
  hotel_id TEXT NOT NULL REFERENCES hotels(id),
  role     TEXT NOT NULL CHECK (role IN ('admin','contabilidad','recepcion','limpieza','mantenimiento')),
  PRIMARY KEY (user_id, hotel_id, role)
);

CREATE TABLE stays (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  hotel_id       TEXT NOT NULL,
  room_id        INTEGER NOT NULL,
  guest          TEXT NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('noche','hora')),
  check_in_at    INTEGER NOT NULL,
  due_out_at     INTEGER NOT NULL,
  nights         INTEGER NOT NULL DEFAULT 0,
  hours          INTEGER NOT NULL DEFAULT 0,
  rate           REAL,
  checked_out_at INTEGER,
  checkout_mode  TEXT,          -- 'manual' | 'automatica'
  notified_due   INTEGER NOT NULL DEFAULT 0,
  created_by     INTEGER
);
CREATE INDEX stays_open ON stays (checked_out_at, due_out_at);

CREATE TABLE sales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  hotel_id       TEXT NOT NULL,
  local_date     TEXT NOT NULL,
  ts             INTEGER NOT NULL,
  concept        TEXT NOT NULL,
  room           TEXT,
  stay_id        INTEGER,
  kind           TEXT NOT NULL,          -- hospedaje | hora | extra
  nights         INTEGER NOT NULL DEFAULT 0,
  hours          INTEGER NOT NULL DEFAULT 0,
  amount         REAL NOT NULL,
  pay            TEXT NOT NULL,          -- Efectivo | Tarjeta | Transferencia | Orden de compra
  po             TEXT,
  po_invoiced_at INTEGER,
  po_paid_at     INTEGER,
  po_remind15_at INTEGER,
  po_remind30_at INTEGER,
  created_by     INTEGER,
  voided_at      INTEGER,
  voided_by      INTEGER,
  void_reason    TEXT
);
CREATE INDEX sales_hotel_date ON sales (hotel_id, local_date);
CREATE INDEX sales_po ON sales (pay, po_paid_at);

CREATE TABLE cleanings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  hotel_id     TEXT NOT NULL,
  room_id      INTEGER NOT NULL,
  requested_at INTEGER NOT NULL,
  source       TEXT,                -- salida_automatica | salida_manual | manual
  started_at   INTEGER,
  started_by   INTEGER,
  finished_at  INTEGER,
  finished_by  INTEGER
);

CREATE TABLE issues (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  hotel_id    TEXT NOT NULL,
  room_id     INTEGER NOT NULL,
  description TEXT NOT NULL,
  photo_key   TEXT,                 -- objeto en R2
  blocks_room INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta','resuelta')),
  created_by  INTEGER,
  created_at  INTEGER NOT NULL,
  resolved_by INTEGER,
  resolved_at INTEGER,
  resolution  TEXT
);

-- Autenticación
CREATE TABLE email_codes (
  email        TEXT PRIMARY KEY,
  code_hash    TEXT NOT NULL,
  expires_at   INTEGER NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_sent_at INTEGER NOT NULL
);
CREATE TABLE sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER
);
CREATE TABLE passkeys (
  id           TEXT PRIMARY KEY,    -- credential id (base64url)
  user_id      INTEGER NOT NULL,
  public_key   TEXT NOT NULL,       -- SPKI base64url
  alg          INTEGER NOT NULL,
  sign_count   INTEGER NOT NULL DEFAULT 0,
  label        TEXT,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE TABLE challenges (
  id         TEXT PRIMARY KEY,
  challenge  TEXT NOT NULL,
  user_id    INTEGER,
  kind       TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE api_tokens (
  token_hash   TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  label        TEXT,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER
);

-- Avisos
CREATE TABLE push_subs (
  endpoint   TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE notifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  url          TEXT,
  created_at   INTEGER NOT NULL,
  delivered_at INTEGER,
  read_at      INTEGER
);
CREATE INDEX notif_user ON notifications (user_id, created_at);

CREATE TABLE audit (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER,
  action    TEXT NOT NULL,
  entity    TEXT,
  entity_id TEXT,
  detail    TEXT,
  ts        INTEGER NOT NULL
);

-- Hoteles y habitaciones
INSERT INTO hotels (id, name, checkout_time, allow_hourly, allow_po, default_rate, created_at) VALUES
  ('prado',    'Hostal Prado Alto', '11:00', 1, 1, 600, 0),
  ('prokinto', 'ProKinto',          '11:00', 0, 0, 600, 0);

INSERT INTO rooms (hotel_id, number, sort) VALUES
  ('prado','1',1),('prado','2',2),('prado','3',3),('prado','4',4),('prado','5',5),('prado','6',6),('prado','7',7),
  ('prado','8',8),('prado','9',9),('prado','10',10),('prado','11',11),('prado','12',12),('prado','13',13),('prado','14',14),
  ('prokinto','501',1),('prokinto','502',2),('prokinto','503',3),('prokinto','504',4),('prokinto','505',5),('prokinto','506',6),
  ('prokinto','507',7),('prokinto','508',8),('prokinto','509',9),('prokinto','510',10),('prokinto','511',11),('prokinto','2C',12);
