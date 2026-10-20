DROP TRIGGER IF EXISTS trg_ley_nodo_au;

CREATE TRIGGER trg_ley_nodo_au AFTER UPDATE OF nivel, numero, titulo, texto ON ley_nodo BEGIN
  DELETE FROM fts_ley_nodo WHERE rowid = old.rowid;
  INSERT INTO fts_ley_nodo (rowid, texto)
  VALUES (new.rowid, new.nivel || ' ' || new.numero || ' ' || new.titulo || ' ' || new.texto);
END;