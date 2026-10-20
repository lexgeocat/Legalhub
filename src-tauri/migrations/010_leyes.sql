CREATE TABLE ley (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT,
  norma TEXT,
  ruta_pdf TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  num_paginas INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

-- La jerarquía se deduce de `nivel` + `orden` (no hay padre_id): así reordenar o borrar un marcador nunca deja huérfanos.
CREATE TABLE ley_nodo (
  id TEXT PRIMARY KEY,
  ley_id TEXT NOT NULL REFERENCES ley(id),
  nivel TEXT NOT NULL CHECK (nivel IN ('parte','libro','titulo','capitulo','seccion','subseccion','articulo')),
  numero TEXT NOT NULL DEFAULT '',
  titulo TEXT NOT NULL DEFAULT '',
  pagina INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL,
  texto TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_ley_nodo_ley ON ley_nodo(ley_id, orden);
CREATE INDEX idx_ley_nodo_numero ON ley_nodo(ley_id, nivel, numero);

-- FTS enlazado por rowid (borrar/actualizar es O(1), a diferencia de una columna UNINDEXED).
CREATE VIRTUAL TABLE fts_ley_nodo USING fts5(texto, tokenize = 'unicode61 remove_diacritics 2');

CREATE TRIGGER trg_ley_nodo_ai AFTER INSERT ON ley_nodo BEGIN
  INSERT INTO fts_ley_nodo (rowid, texto)
  VALUES (new.rowid, new.nivel || ' ' || new.numero || ' ' || new.titulo || ' ' || new.texto);
END;

CREATE TRIGGER trg_ley_nodo_au AFTER UPDATE ON ley_nodo BEGIN
  DELETE FROM fts_ley_nodo WHERE rowid = old.rowid;
  INSERT INTO fts_ley_nodo (rowid, texto)
  VALUES (new.rowid, new.nivel || ' ' || new.numero || ' ' || new.titulo || ' ' || new.texto);
END;

CREATE TRIGGER trg_ley_nodo_ad AFTER DELETE ON ley_nodo BEGIN
  DELETE FROM fts_ley_nodo WHERE rowid = old.rowid;
END;