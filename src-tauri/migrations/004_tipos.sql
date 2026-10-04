ALTER TABLE expediente ADD COLUMN tipo TEXT NOT NULL DEFAULT 'civil';
ALTER TABLE expediente ADD COLUMN datos_json TEXT NOT NULL DEFAULT '{}';
CREATE INDEX idx_expediente_tipo ON expediente(tipo);