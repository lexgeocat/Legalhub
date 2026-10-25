-- Migración 017: Agregar columna subtipo_resolucion a jurisprudencia_guardada y actualizar FTS triggers
ALTER TABLE jurisprudencia_guardada ADD COLUMN subtipo_resolucion TEXT;

DROP TRIGGER IF EXISTS trg_jurisprudencia_ai;
DROP TRIGGER IF EXISTS trg_jurisprudencia_au;

CREATE TRIGGER trg_jurisprudencia_ai AFTER INSERT ON jurisprudencia_guardada BEGIN
  INSERT INTO fts_jurisprudencia (rowid, texto)
  VALUES (new.rowid, new.numero_resolucion || ' ' || coalesce(new.numero_expediente, '') || ' ' || coalesce(new.tipo_resolucion, '') || ' ' || coalesce(new.subtipo_resolucion, '') || ' ' || coalesce(new.demandante, '') || ' ' || coalesce(new.demandado, '') || ' ' || coalesce(new.magistrado, '') || ' ' || coalesce(new.sala, '') || ' ' || coalesce(new.materia, '') || ' ' || coalesce(new.resumen, '') || ' ' || coalesce(new.contenido_html, ''));
END;

CREATE TRIGGER trg_jurisprudencia_au AFTER UPDATE ON jurisprudencia_guardada BEGIN
  DELETE FROM fts_jurisprudencia WHERE rowid = old.rowid;
  INSERT INTO fts_jurisprudencia (rowid, texto)
  VALUES (new.rowid, new.numero_resolucion || ' ' || coalesce(new.numero_expediente, '') || ' ' || coalesce(new.tipo_resolucion, '') || ' ' || coalesce(new.subtipo_resolucion, '') || ' ' || coalesce(new.demandante, '') || ' ' || coalesce(new.demandado, '') || ' ' || coalesce(new.magistrado, '') || ' ' || coalesce(new.sala, '') || ' ' || coalesce(new.materia, '') || ' ' || coalesce(new.resumen, '') || ' ' || coalesce(new.contenido_html, ''));
END;
