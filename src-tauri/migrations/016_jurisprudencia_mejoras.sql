-- Migración 016: Mejoras en jurisprudencia, id remoto, unicidad de expedientes y FTS
ALTER TABLE jurisprudencia_guardada ADD COLUMN id_remoto TEXT;

CREATE INDEX IF NOT EXISTS idx_jurisprudencia_id_remoto ON jurisprudencia_guardada(origen, id_remoto);

-- Eliminar posibles duplicados antes de crear índice único
DELETE FROM jurisprudencia_expediente
WHERE id NOT IN (
  SELECT min(id)
  FROM jurisprudencia_expediente
  GROUP BY jurisprudencia_id, expediente_id
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_juris_exp ON jurisprudencia_expediente(jurisprudencia_id, expediente_id);

-- Actualizar triggers de FTS5 para indexar también partes procesales y tipo de resolución
DROP TRIGGER IF EXISTS trg_jurisprudencia_ai;
DROP TRIGGER IF EXISTS trg_jurisprudencia_au;

CREATE TRIGGER trg_jurisprudencia_ai AFTER INSERT ON jurisprudencia_guardada BEGIN
  INSERT INTO fts_jurisprudencia (rowid, texto)
  VALUES (new.rowid, new.numero_resolucion || ' ' || coalesce(new.numero_expediente, '') || ' ' || coalesce(new.tipo_resolucion, '') || ' ' || coalesce(new.demandante, '') || ' ' || coalesce(new.demandado, '') || ' ' || coalesce(new.magistrado, '') || ' ' || coalesce(new.sala, '') || ' ' || coalesce(new.materia, '') || ' ' || coalesce(new.resumen, '') || ' ' || coalesce(new.contenido_html, ''));
END;

CREATE TRIGGER trg_jurisprudencia_au AFTER UPDATE ON jurisprudencia_guardada BEGIN
  DELETE FROM fts_jurisprudencia WHERE rowid = old.rowid;
  INSERT INTO fts_jurisprudencia (rowid, texto)
  VALUES (new.rowid, new.numero_resolucion || ' ' || coalesce(new.numero_expediente, '') || ' ' || coalesce(new.tipo_resolucion, '') || ' ' || coalesce(new.demandante, '') || ' ' || coalesce(new.demandado, '') || ' ' || coalesce(new.magistrado, '') || ' ' || coalesce(new.sala, '') || ' ' || coalesce(new.materia, '') || ' ' || coalesce(new.resumen, '') || ' ' || coalesce(new.contenido_html, ''));
END;
