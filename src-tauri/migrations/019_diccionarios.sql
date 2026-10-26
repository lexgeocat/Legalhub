CREATE TABLE IF NOT EXISTS diccionario (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  autor TEXT,
  descripcion TEXT,
  ruta_pdf TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  num_paginas INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS diccionario_termino (
  id TEXT PRIMARY KEY,
  diccionario_id TEXT NOT NULL REFERENCES diccionario(id),
  termino TEXT NOT NULL,
  definicion TEXT NOT NULL DEFAULT '',
  pagina INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_diccionario_termino_dicc ON diccionario_termino(diccionario_id, orden);
CREATE INDEX IF NOT EXISTS idx_diccionario_termino_nombre ON diccionario_termino(diccionario_id, termino COLLATE NOCASE);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_diccionario_termino USING fts5(termino, definicion, tokenize = 'unicode61 remove_diacritics 2');

CREATE TRIGGER IF NOT EXISTS trg_diccionario_termino_ai AFTER INSERT ON diccionario_termino BEGIN
  INSERT INTO fts_diccionario_termino (rowid, termino, definicion)
  VALUES (new.rowid, new.termino, new.definicion);
END;

CREATE TRIGGER IF NOT EXISTS trg_diccionario_termino_au AFTER UPDATE ON diccionario_termino BEGIN
  DELETE FROM fts_diccionario_termino WHERE rowid = old.rowid;
  INSERT INTO fts_diccionario_termino (rowid, termino, definicion)
  VALUES (new.rowid, new.termino, new.definicion);
END;

CREATE TRIGGER IF NOT EXISTS trg_diccionario_termino_ad AFTER DELETE ON diccionario_termino BEGIN
  DELETE FROM fts_diccionario_termino WHERE rowid = old.rowid;
END;
