CREATE TABLE procedimiento (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  materia TEXT,
  descripcion TEXT,
  base_legal TEXT,
  requisitos_json TEXT NOT NULL DEFAULT '[]',
  flujo_json TEXT NOT NULL DEFAULT '{"carriles":[],"pasos":[]}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX idx_procedimiento_materia ON procedimiento(materia);