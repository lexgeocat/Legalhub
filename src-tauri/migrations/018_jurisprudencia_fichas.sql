-- Migración 018: Soporte para Ficha de Análisis Jurisprudencial completa (Máxima, Ratio, Descriptores, etc.)
ALTER TABLE jurisprudencia_guardada ADD COLUMN proceso TEXT;
ALTER TABLE jurisprudencia_guardada ADD COLUMN forma_resolucion TEXT;
ALTER TABLE jurisprudencia_guardada ADD COLUMN tipo_jurisprudencia TEXT;
ALTER TABLE jurisprudencia_guardada ADD COLUMN maxima TEXT;
ALTER TABLE jurisprudencia_guardada ADD COLUMN sintesis TEXT;
ALTER TABLE jurisprudencia_guardada ADD COLUMN ratio_decidendi TEXT;
ALTER TABLE jurisprudencia_guardada ADD COLUMN descriptor TEXT;
ALTER TABLE jurisprudencia_guardada ADD COLUMN restrictor TEXT;
ALTER TABLE jurisprudencia_guardada ADD COLUMN precedente TEXT;
ALTER TABLE jurisprudencia_guardada ADD COLUMN fichas_json TEXT;

-- Actualizar triggers FTS5 para indexar también máxima, descriptor, restrictor, precedente y síntesis
DROP TRIGGER IF EXISTS trg_jurisprudencia_ai;
DROP TRIGGER IF EXISTS trg_jurisprudencia_au;

CREATE TRIGGER trg_jurisprudencia_ai AFTER INSERT ON jurisprudencia_guardada BEGIN
  INSERT INTO fts_jurisprudencia (rowid, texto)
  VALUES (new.rowid, new.numero_resolucion || ' ' || coalesce(new.numero_expediente, '') || ' ' || coalesce(new.tipo_resolucion, '') || ' ' || coalesce(new.subtipo_resolucion, '') || ' ' || coalesce(new.proceso, '') || ' ' || coalesce(new.forma_resolucion, '') || ' ' || coalesce(new.tipo_jurisprudencia, '') || ' ' || coalesce(new.maxima, '') || ' ' || coalesce(new.descriptor, '') || ' ' || coalesce(new.restrictor, '') || ' ' || coalesce(new.precedente, '') || ' ' || coalesce(new.sintesis, '') || ' ' || coalesce(new.ratio_decidendi, '') || ' ' || coalesce(new.demandante, '') || ' ' || coalesce(new.demandado, '') || ' ' || coalesce(new.magistrado, '') || ' ' || coalesce(new.sala, '') || ' ' || coalesce(new.materia, '') || ' ' || coalesce(new.resumen, '') || ' ' || coalesce(new.contenido_html, ''));
END;

CREATE TRIGGER trg_jurisprudencia_au AFTER UPDATE ON jurisprudencia_guardada BEGIN
  DELETE FROM fts_jurisprudencia WHERE rowid = old.rowid;
  INSERT INTO fts_jurisprudencia (rowid, texto)
  VALUES (new.rowid, new.numero_resolucion || ' ' || coalesce(new.numero_expediente, '') || ' ' || coalesce(new.tipo_resolucion, '') || ' ' || coalesce(new.subtipo_resolucion, '') || ' ' || coalesce(new.proceso, '') || ' ' || coalesce(new.forma_resolucion, '') || ' ' || coalesce(new.tipo_jurisprudencia, '') || ' ' || coalesce(new.maxima, '') || ' ' || coalesce(new.descriptor, '') || ' ' || coalesce(new.restrictor, '') || ' ' || coalesce(new.precedente, '') || ' ' || coalesce(new.sintesis, '') || ' ' || coalesce(new.ratio_decidendi, '') || ' ' || coalesce(new.demandante, '') || ' ' || coalesce(new.demandado, '') || ' ' || coalesce(new.magistrado, '') || ' ' || coalesce(new.sala, '') || ' ' || coalesce(new.materia, '') || ' ' || coalesce(new.resumen, '') || ' ' || coalesce(new.contenido_html, ''));
END;
