CREATE TABLE IF NOT EXISTS redaccion_banco (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
