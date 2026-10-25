CREATE TABLE IF NOT EXISTS jurisprudencia_guardada (
  id TEXT PRIMARY KEY,
  origen TEXT NOT NULL CHECK (origen IN ('TSJ', 'TCP')),
  tipo_resolucion TEXT NOT NULL,
  numero_resolucion TEXT NOT NULL,
  numero_expediente TEXT,
  fecha_emision TEXT,
  sala TEXT,
  departamento TEXT,
  magistrado TEXT,
  demandante TEXT,
  demandado TEXT,
  materia TEXT,
  resumen TEXT,
  contenido_html TEXT,
  ruta_pdf TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jurisprudencia_origen ON jurisprudencia_guardada(origen);
CREATE INDEX IF NOT EXISTS idx_jurisprudencia_numero ON jurisprudencia_guardada(numero_resolucion);
CREATE INDEX IF NOT EXISTS idx_jurisprudencia_fecha ON jurisprudencia_guardada(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_jurisprudencia_materia ON jurisprudencia_guardada(materia);

CREATE TABLE IF NOT EXISTS jurisprudencia_expediente (
  id TEXT PRIMARY KEY,
  jurisprudencia_id TEXT NOT NULL REFERENCES jurisprudencia_guardada(id) ON DELETE CASCADE,
  expediente_id TEXT NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
  notas TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_juris_exp_juris ON jurisprudencia_expediente(jurisprudencia_id);
CREATE INDEX IF NOT EXISTS idx_juris_exp_exp ON jurisprudencia_expediente(expediente_id);

-- Búsqueda de texto completo FTS5 para jurisprudencia local
CREATE VIRTUAL TABLE IF NOT EXISTS fts_jurisprudencia USING fts5(texto, tokenize = 'unicode61 remove_diacritics 2');

CREATE TRIGGER IF NOT EXISTS trg_jurisprudencia_ai AFTER INSERT ON jurisprudencia_guardada BEGIN
  INSERT INTO fts_jurisprudencia (rowid, texto)
  VALUES (new.rowid, new.numero_resolucion || ' ' || coalesce(new.numero_expediente, '') || ' ' || coalesce(new.magistrado, '') || ' ' || coalesce(new.sala, '') || ' ' || coalesce(new.materia, '') || ' ' || coalesce(new.resumen, '') || ' ' || coalesce(new.contenido_html, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_jurisprudencia_au AFTER UPDATE ON jurisprudencia_guardada BEGIN
  DELETE FROM fts_jurisprudencia WHERE rowid = old.rowid;
  INSERT INTO fts_jurisprudencia (rowid, texto)
  VALUES (new.rowid, new.numero_resolucion || ' ' || coalesce(new.numero_expediente, '') || ' ' || coalesce(new.magistrado, '') || ' ' || coalesce(new.sala, '') || ' ' || coalesce(new.materia, '') || ' ' || coalesce(new.resumen, '') || ' ' || coalesce(new.contenido_html, ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_jurisprudencia_ad AFTER DELETE ON jurisprudencia_guardada BEGIN
  DELETE FROM fts_jurisprudencia WHERE rowid = old.rowid;
END;
