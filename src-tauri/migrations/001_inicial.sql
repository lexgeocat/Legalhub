CREATE TABLE persona (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('natural','juridica')),
  nombres TEXT, apellido_paterno TEXT, apellido_materno TEXT, apellido_casada TEXT,
  ci_numero TEXT, ci_complemento TEXT, ci_expedido TEXT,
  fecha_nacimiento TEXT,
  genero TEXT CHECK (genero IN ('M','F')),
  estado_civil TEXT, nacionalidad TEXT, profesion TEXT,
  razon_social TEXT, nit TEXT,
  genero_gramatical TEXT CHECK (genero_gramatical IN ('M','F')),
  representante_id TEXT REFERENCES persona(id), poder_ref TEXT,
  domicilio TEXT, telefono TEXT, correo TEXT,
  extra_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE contador (anio INTEGER PRIMARY KEY, ultimo INTEGER NOT NULL);

CREATE TABLE expediente (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  materia TEXT NOT NULL, referencia TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('abierto','en_tramite','suspendido','cerrado','archivado')),
  juzgado TEXT, nro_causa TEXT,
  cliente_id TEXT REFERENCES persona(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE expediente_parte (
  id TEXT PRIMARY KEY,
  expediente_id TEXT NOT NULL REFERENCES expediente(id),
  persona_id TEXT NOT NULL REFERENCES persona(id),
  rol TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  domicilio_procesal TEXT,
  representante_id TEXT REFERENCES persona(id),
  datos_override_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE inmueble (
  id TEXT PRIMARY KEY,
  tipo TEXT, departamento TEXT, provincia TEXT, municipio TEXT, localidad TEXT,
  superficie_m2 TEXT, matricula TEXT, codigo_catastral TEXT, ubicacion TEXT,
  colindancias_json TEXT NOT NULL DEFAULT '{}',
  gravamenes TEXT, observaciones TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE inmueble_titular (
  inmueble_id TEXT NOT NULL REFERENCES inmueble(id),
  persona_id TEXT NOT NULL REFERENCES persona(id),
  porcentaje TEXT,
  PRIMARY KEY (inmueble_id, persona_id)
);

CREATE TABLE expediente_inmueble (
  expediente_id TEXT NOT NULL REFERENCES expediente(id),
  inmueble_id TEXT NOT NULL REFERENCES inmueble(id),
  PRIMARY KEY (expediente_id, inmueble_id)
);

CREATE TABLE modelo (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, materia TEXT, categoria TEXT,
  activo INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);

CREATE TABLE modelo_version (
  id TEXT PRIMARY KEY,
  modelo_id TEXT NOT NULL REFERENCES modelo(id),
  version INTEGER NOT NULL,
  ruta_paquete TEXT NOT NULL, sha256 TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  notas TEXT, created_at TEXT NOT NULL,
  UNIQUE (modelo_id, version)
);

CREATE TABLE documento (
  id TEXT PRIMARY KEY,
  expediente_id TEXT NOT NULL REFERENCES expediente(id),
  titulo TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'borrador',
  created_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE documento_version (
  id TEXT PRIMARY KEY,
  documento_id TEXT NOT NULL REFERENCES documento(id),
  nro INTEGER NOT NULL,
  modelo_version_id TEXT REFERENCES modelo_version(id),
  datos_snapshot_json TEXT NOT NULL,
  ruta TEXT NOT NULL, sha256 TEXT NOT NULL,
  origen TEXT NOT NULL CHECK (origen IN ('generado','edicion_externa')),
  created_at TEXT NOT NULL,
  UNIQUE (documento_id, nro)
);

CREATE TABLE auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL, accion TEXT NOT NULL, entidad TEXT, entidad_id TEXT,
  detalle_json TEXT, prev_hash TEXT, hash TEXT NOT NULL
);

CREATE INDEX idx_persona_ci ON persona(ci_numero);
CREATE INDEX idx_expediente_cliente ON expediente(cliente_id);
CREATE INDEX idx_parte_expediente ON expediente_parte(expediente_id);
CREATE INDEX idx_documento_expediente ON documento(expediente_id);
CREATE INDEX idx_docver_documento ON documento_version(documento_id);