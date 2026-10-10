CREATE TABLE plantilla (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  materia TEXT, categoria TEXT, descripcion TEXT,
  ruta_paquete TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  editable INTEGER NOT NULL DEFAULT 0,
  num_campos INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);