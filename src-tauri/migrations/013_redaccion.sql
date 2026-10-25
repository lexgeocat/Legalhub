CREATE TABLE IF NOT EXISTS escrito_propio (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('carta','memorial','demanda','libre')),
  texto TEXT NOT NULL DEFAULT '',
  config_json TEXT NOT NULL,
  palabras INTEGER NOT NULL DEFAULT 0,
  expediente_id TEXT REFERENCES expediente(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  ideas_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS redaccion_historial (
  id TEXT PRIMARY KEY,
  escrito_id TEXT NOT NULL REFERENCES escrito_propio(id),
  palabras INTEGER NOT NULL,
  avisos INTEGER NOT NULL,
  reglas_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
