CREATE VIRTUAL TABLE fts_persona USING fts5(persona_id UNINDEXED, texto, tokenize = 'unicode61 remove_diacritics 2');
CREATE VIRTUAL TABLE fts_persona_tri USING fts5(persona_id UNINDEXED, texto, tokenize = 'trigram');
CREATE VIRTUAL TABLE fts_expediente USING fts5(expediente_id UNINDEXED, texto, tokenize = 'unicode61 remove_diacritics 2');
CREATE VIRTUAL TABLE fts_documento USING fts5(documento_id UNINDEXED, texto, tokenize = 'unicode61 remove_diacritics 2');

CREATE TRIGGER trg_persona_ai AFTER INSERT ON persona BEGIN
  INSERT INTO fts_persona (persona_id, texto) VALUES (new.id,
    trim(coalesce(new.nombres,'') || ' ' || coalesce(new.apellido_paterno,'') || ' ' || coalesce(new.apellido_materno,'') || ' ' || coalesce(new.apellido_casada,'') || ' ' || coalesce(new.razon_social,'') || ' ' || coalesce(new.ci_numero,'') || ' ' || coalesce(new.nit,'')));
  INSERT INTO fts_persona_tri (persona_id, texto) VALUES (new.id,
    trim(coalesce(new.nombres,'') || ' ' || coalesce(new.apellido_paterno,'') || ' ' || coalesce(new.apellido_materno,'') || ' ' || coalesce(new.apellido_casada,'') || ' ' || coalesce(new.razon_social,'') || ' ' || coalesce(new.ci_numero,'') || ' ' || coalesce(new.nit,'')));
END;

CREATE TRIGGER trg_persona_au AFTER UPDATE ON persona BEGIN
  DELETE FROM fts_persona WHERE persona_id = old.id;
  DELETE FROM fts_persona_tri WHERE persona_id = old.id;
  INSERT INTO fts_persona (persona_id, texto) SELECT new.id,
    trim(coalesce(new.nombres,'') || ' ' || coalesce(new.apellido_paterno,'') || ' ' || coalesce(new.apellido_materno,'') || ' ' || coalesce(new.apellido_casada,'') || ' ' || coalesce(new.razon_social,'') || ' ' || coalesce(new.ci_numero,'') || ' ' || coalesce(new.nit,''))
    WHERE new.deleted_at IS NULL;
  INSERT INTO fts_persona_tri (persona_id, texto) SELECT new.id,
    trim(coalesce(new.nombres,'') || ' ' || coalesce(new.apellido_paterno,'') || ' ' || coalesce(new.apellido_materno,'') || ' ' || coalesce(new.apellido_casada,'') || ' ' || coalesce(new.razon_social,'') || ' ' || coalesce(new.ci_numero,'') || ' ' || coalesce(new.nit,''))
    WHERE new.deleted_at IS NULL;
END;

CREATE TRIGGER trg_persona_ad AFTER DELETE ON persona BEGIN
  DELETE FROM fts_persona WHERE persona_id = old.id;
  DELETE FROM fts_persona_tri WHERE persona_id = old.id;
END;

CREATE TRIGGER trg_expediente_ai AFTER INSERT ON expediente BEGIN
  INSERT INTO fts_expediente (expediente_id, texto) VALUES (new.id,
    trim(coalesce(new.codigo,'') || ' ' || coalesce(new.materia,'') || ' ' || coalesce(new.referencia,'') || ' ' || coalesce(new.juzgado,'') || ' ' || coalesce(new.nro_causa,'')));
END;

CREATE TRIGGER trg_expediente_au AFTER UPDATE ON expediente BEGIN
  DELETE FROM fts_expediente WHERE expediente_id = old.id;
  INSERT INTO fts_expediente (expediente_id, texto) SELECT new.id,
    trim(coalesce(new.codigo,'') || ' ' || coalesce(new.materia,'') || ' ' || coalesce(new.referencia,'') || ' ' || coalesce(new.juzgado,'') || ' ' || coalesce(new.nro_causa,''))
    WHERE new.deleted_at IS NULL;
END;

CREATE TRIGGER trg_expediente_ad AFTER DELETE ON expediente BEGIN
  DELETE FROM fts_expediente WHERE expediente_id = old.id;
END;