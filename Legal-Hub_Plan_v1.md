# Legal-Hub v1 — Plan de Implementación

**Fecha:** 02/10/2026
**Plataforma:** Windows 10 (22H2) y Windows 11 · 64 bits
**Salida:** archivos `.docx`, compatibles con Word 2016 o superior
**Integración con Word:** ninguna. Legal-Hub no necesita Word instalado.

---

## 1. Producto

Legal-Hub es un gestor de expedientes jurídicos de escritorio que genera documentos `.docx` a partir de datos estructurados y modelos reutilizables.

```text
EXPEDIENTE ──▶ DATOS ──▶ MODELO (.docx con marcadores) ──▶ MOTOR ──▶ DOCUMENTO .docx
```

> Los datos viven en el expediente. El formato vive en el modelo. El documento generado es un *snapshot* de ambos en un momento dado.

### Qué hace en v1

- Administra expedientes, personas (naturales y jurídicas), partes por rol e inmuebles.
- Guarda modelos `.docx` con marcadores y los versiona.
- Genera un formulario con solo los campos que cada modelo necesita, precargado desde el expediente.
- Genera el `.docx` final con concordancia de género y número, montos y fechas en literal.
- Guarda cada generación como versión inmutable, con los datos usados y su huella SHA-256.
- Muestra una hoja de verificación antes de entregar el documento.
- Busca por persona, C.I., expediente y documento.
- Crea y restaura backups cifrados y verificados.

### Qué no hace en v1

PDF, `.doc` (formato binario antiguo), integración con Word o complementos, IA, nube, multiusuario, OCR y vista previa de documentos. Si se necesita PDF, se exporta desde Word con *Guardar como*. Si hay modelos en `.doc`, se convierten una sola vez a `.docx` con *Guardar como*.

---

## 2. Plataforma y compatibilidad

| Aspecto | Definición |
|---|---|
| Sistema operativo | Windows 11 y Windows 10 22H2, x64 |
| Procesador | x64 únicamente |
| Word | No requerido. Los `.docx` generados abren en Word 2016 o superior, y también en LibreOffice y WPS |
| Entorno de interfaz | WebView2 del sistema. Windows 11 lo trae; Windows 10 (abril 2018 o posterior) lo distribuye como parte del sistema, según la documentación de Tauri |
| Instalación | Por usuario, sin permisos de administrador |
| Conexión a internet | No requerida para usar la aplicación |

Nota de plataforma: Windows 10 perdió el soporte general el 14-oct-2025 y su programa ESU para usuarios finales termina el 13-oct-2026. Se soporta en v1 por pedido, pero el objetivo de pruebas principal es Windows 11.

---

## 3. Stack

| Capa | Tecnología | Función |
|---|---|---|
| Contenedor de escritorio | **Tauri 2** | Ventana nativa con el WebView2 del sistema; instalador NSIS |
| Backend | **Rust mínimo** (`rusqlite`, `zip`, `sha2`, `age`) | SQLite, backup/restauración y hash de archivos. Unos pocos comandos |
| Interfaz | **React + TypeScript + Vite**, Tailwind, TanStack Table, React Hook Form + Zod | Pantallas, tablas y formularios |
| Dominio y casos de uso | **TypeScript puro** | Reglas, filtros jurídicos y contexto de documentos, sin depender de UI ni de Tauri |
| Motor DOCX | **easy-template-x** (MIT) + resolver propio de gramática cerrada | Reemplazo de marcadores, bucles y condiciones |
| Lectura de DOCX | `fflate` (ZIP) + `DOMParser` nativo del WebView | Escáner y linter de modelos |
| Números, fechas y dinero | `decimal.js`, `n2words` (es), `Intl` | Montos, literales y fechas largas |
| Base de datos | **SQLite** (WAL, FTS5) | Datos, versiones, auditoría y búsqueda |
| Pruebas | Vitest, `better-sqlite3` (solo en pruebas), `cargo test` | Dominio, motor, base de datos y backup |
| Calidad | TypeScript estricto, ESLint, Prettier, Clippy | Análisis estático |
| Gestor de paquetes y CI | pnpm · GitHub Actions `windows-latest` | Compilación y pruebas reproducibles |

### Decisiones clave

1. **Tauri y no un navegador empaquetado.** Reutiliza el WebView2 del sistema. El instalador esperado es de unas decenas de MB, no cientos. Se mide en M0.
2. **Rust solo donde importa:** integridad de datos (SQLite con transacciones reales) y backups en streaming. Todo lo demás es TypeScript.
3. **Puente SQLite propio, no el plugin oficial.** El plugin SQL oficial usa sqlx y no soporta cifrado, y su modelo de pool de conexiones complica las transacciones de varios pasos. El puente propio son tres comandos pequeños.
4. **Motor DOCX en TypeScript.** Corre igual en el WebView y en Node, así que se prueba en CI sin levantar la aplicación.
5. **Licencias permisivas** (MIT y Apache-2.0 en las dependencias principales). Se verifica con un escáner de licencias antes de distribuir.

---

## 4. Arquitectura

```text
┌─────────────────────────────────────────────────────────┐
│ UI (React)                                              │
├─────────────────────────────────────────────────────────┤
│ application/   casos de uso: CrearExpediente,           │
│                ImportarModelo, GenerarDocumento, …      │
├─────────────────────────────────────────────────────────┤
│ domain/        entidades, reglas, catálogo de campos,   │
│                filtros jurídicos (TypeScript puro)      │
├─────────────────────────────────────────────────────────┤
│ puertos: Db · MotorPlantillas · Archivos · Backup       │
├─────────────────────────────────────────────────────────┤
│ infrastructure/  adaptador Tauri (IPC) · adaptador Node │
│                  (pruebas) · easy-template-x · fflate   │
└───────────────────────┬─────────────────────────────────┘
                        │ invoke()
┌───────────────────────▼─────────────────────────────────┐
│ src-tauri (Rust)   db_query · db_exec · db_tx           │
│                    crear_backup · restaurar_backup      │
│                    sha256_archivo                       │
└─────────────────────────────────────────────────────────┘
```

```text
legal-hub/
├─ package.json · pnpm-lock.yaml
├─ src/
│  ├─ domain/                 # Persona, Expediente, Parte, Inmueble, Modelo, Documento, filtros, catálogo
│  ├─ application/            # casos de uso (sin React ni Tauri)
│  ├─ infrastructure/
│  │  ├─ db/                  # migraciones .sql, repositorios, adaptador Tauri y adaptador Node
│  │  ├─ docx/                # escáner, linter, resolver, motor
│  │  ├─ archivos/            # rutas, nombres seguros, hashing
│  │  └─ backup/              # cliente de los comandos Rust
│  ├─ ui/                     # páginas, componentes, formularios
│  └─ main.tsx
├─ src-tauri/
│  ├─ src/                    # main.rs, db.rs, backup.rs
│  ├─ capabilities/           # permisos mínimos
│  └─ tauri.conf.json
├─ tests/                     # unit/ integration/ golden/
├─ corpus/                    # modelos reales anonimizados (no versionado)
└─ docs/
```

### Reglas no negociables

1. `domain` y `application` no importan React, Tauri ni el motor de plantillas: solo interfaces.
2. La interfaz no contiene lógica documental; solo invoca casos de uso.
3. Las operaciones de varios pasos son **un lote atómico** (`db_tx`). No existen transacciones abiertas entre llamadas IPC.
4. Dinero y superficies siempre en `Decimal`, nunca `number`.
5. Un dato faltante o un filtro inválido **detiene** la generación. Nunca se genera con huecos silenciosos.

### Puente SQLite (Rust)

```rust
#[tauri::command] fn db_query(sql: String, params: Vec<Value>) -> Result<Vec<Row>, String>;
#[tauri::command] fn db_exec(sql: String, params: Vec<Value>) -> Result<ExecResult, String>;
#[tauri::command] fn db_tx(stmts: Vec<Stmt>) -> Result<Vec<ExecResult>, String>; // atómico
```

Una sola conexión protegida por `Mutex`, WAL, `foreign_keys=ON`, `busy_timeout`. Para una aplicación de un usuario por equipo es suficiente y evita problemas de concurrencia.

---

## 5. Motor de documentos

### 5.1 Sintaxis de los modelos

Los marcadores usan llaves dobles. Se escriben en Word como texto normal.

```text
Campo simple:       {{expediente.juzgado}}
Con filtro:         {{demandante.nombre | mayus}}
Bucle (partes):     {{#demandantes}} … {{/demandantes}}
Condicional:        {{#hay_conyuge}} … {{/hay_conyuge}}
Lista con "y":      {{demandantes | lista}}
Concordancia:       {{demandantes | concordar:"casado":"casada":"casados":"casadas"}}
```

Ejemplo de modelo:

```text
SEÑOR JUEZ…

{{#demandantes}}
{{nombre | mayus}}, con C.I. N° {{ci}}, {{estado_civil}}, con domicilio en {{domicilio}};
{{/demandantes}}
{{demandantes | concordar:"mayor de edad":"mayor de edad":"mayores de edad":"mayores de edad"}},
ante su autoridad exponemos…
```

Los atributos de cada persona llegan **ya concordados** con su género (`estado_civil` → "casada", `nacionalidad` → "boliviana"), de modo que la mayoría de los modelos no necesitan filtros.

### 5.2 Contexto que ve el modelo

```text
expediente    codigo, materia, referencia, juzgado, nro_causa, estado
partes        por rol: demandantes, demandados, terceros… (listas ordenadas)
cliente       persona
abogado       persona + matrícula profesional + domicilio procesal
inmuebles     lista (titulares, superficie, matrícula, colindancias)
caso          campos libres declarados por el modelo (hechos, cuantía, petitorio…)
hoy           fecha del sistema (inyectada, para poder probar)
```

### 5.3 Filtros (conjunto cerrado)

| Filtro | Entrada → Salida |
|---|---|
| `mayus` / `minus` | `"Juan Pérez"` → `"JUAN PÉREZ"` |
| `titulo` | `"JUAN PÉREZ"` → `"Juan Pérez"` (respeta *de, del, la, y*) |
| `lista` | `[A, B, C]` → `"A, B y C"` |
| `concordar:m:f[:pm:pf]` | `[Juan]` → m · `[Ana]` → f · `[Juan, Ana]` → pm · `[Ana, Eva]` → pf |
| `literal` | `1700` → `"mil setecientos"` |
| `moneda` | `10000.5` → `"Bs. 10.000,50 (Diez mil 50/100 bolivianos)"` (formato configurable) |
| `fecha` | `2026-10-02` → `"2 de octubre de 2026"` |
| `superficie` | `1700` → `"1.700 m² (mil setecientos metros cuadrados)"` |
| `ci` | `("1234567","1A","LP")` → `"1234567-1A LP"` |

Regla gramatical: **plural mixto → masculino**; femenino solo si *todas* las partes son femeninas. Si falta el género de alguna parte, el filtro falla y el formulario lo pide. No se adivina.

```ts
// domain/filtros/concordar.ts
type Genero = "M" | "F";

export function concordar(
  partes: { genero: Genero | null }[],
  singM: string, singF: string, plurM?: string, plurF?: string,
): string {
  if (partes.length === 0) return "";
  if (partes.some(p => p.genero === null)) {
    throw new ErrorDeDatos("Falta el género de una de las partes");
  }
  const pm = plurM ?? singM + "s";
  const pf = plurF ?? singF + "s";
  const todasF = partes.every(p => p.genero === "F");
  if (partes.length === 1) return todasF ? singF : singM;
  return todasF ? pf : pm;
}
```

### 5.4 Resolver de gramática cerrada

Los marcadores **no ejecutan código**. Un resolver propio acepta únicamente:

```text
marcador := ruta ( "|" filtro ( ":" "argumento entre comillas" )* )*
ruta     := identificador ( "." identificador )*      o      "."
```

Sin operadores, sin llamadas a funciones, sin `eval`. Un filtro o una ruta que no existan se rechazan en el linter, antes de renderizar. Esto elimina la clase de problemas de seguridad de los motores de expresiones y hace que los errores sean predecibles.

**Particularidades de Word que el resolver debe absorber:**

| Problema | Tratamiento |
|---|---|
| Word cambia las comillas rectas `"` por tipográficas `“ ”` | Se normalizan antes de analizar el marcador |
| Word pone en mayúscula la primera letra de un párrafo (`{{Demandante…}}`) | Las rutas se resuelven sin distinguir mayúsculas ni tildes |
| Espacios duros (`U+00A0`) dentro del marcador | Se normalizan a espacio |
| Un marcador partido en varios fragmentos (*runs*) por correcciones ortográficas | Lo resuelve el motor; el linter reporta qué tan fragmentado está |

### 5.5 Escáner y linter de modelos

Recorre `word/document.xml`, encabezados, pies y notas con `DOMParser`.

| Severidad | Condición |
|---|---|
| **Error** | Marcador con sintaxis inválida; bucle o condicional sin cierre; ruta o filtro desconocido; marcador partido entre párrafos o celdas |
| **Error** | Cambios controlados pendientes (`w:ins`, `w:del`) |
| **Advertencia** | Marcadores dentro de cuadros de texto; campos de Word (`w:fldSimple`, `w:instrText`); comentarios; llaves que no son marcadores |
| **Advertencia** | Marcador heredado de otro formato (comillas tipográficas, espacios duros): se normaliza y se informa |
| **Info** | Secciones, encabezados con marcadores, tablas, cantidad de bucles |

Del escaneo sale el **esquema del modelo**: la lista de campos que usa, que luego genera el formulario.

### 5.6 Render

```ts
// application/puertos.ts
export interface MotorPlantillas {
  escanear(plantilla: Uint8Array): ResultadoEscaneo;
  renderizar(plantilla: Uint8Array, contexto: Contexto): Promise<Uint8Array>;
}
```

```ts
// infrastructure/docx/motor.ts
const handler = new TemplateHandler({
  delimiters: { tagStart: "{{", tagEnd: "}}", containerTagOpen: "#", containerTagClose: "/" },
  scopeDataResolver: resolverCerrado(FILTROS),
  // Nombres exactos de las opciones: confirmar contra la versión instalada (M0).
});
const salida = await handler.process(plantilla, contexto);
```

Antes de renderizar se **resuelven todos los marcadores** contra el contexto. Si falta un dato requerido, se detiene y se muestra en la hoja de verificación. El motor queda detrás del puerto `MotorPlantillas`: si hiciera falta reemplazarlo, no se toca el dominio.

### 5.7 Versionado y snapshot

Cada generación crea una `documento_version` inmutable con: versión del modelo, **datos usados (JSON)**, ruta, SHA-256, origen y fecha. Nunca se sobrescribe un archivo existente: la segunda generación crea `…_v02.docx`.

Si el usuario edita el documento en Word, Legal-Hub no se entera. Para registrarlo existe **"Adjuntar versión editada"**: copia el archivo como nueva versión (`origen = 'edicion_externa'`) con su hash.

### 5.8 Hoja de verificación

Antes de entregar el documento se muestra **cada valor insertado y su origen**:

```text
demandante[0].nombre   → "JUAN PÉREZ"        ← persona P-0012
demandante[0].ci       → "1234567 LP"        ← persona P-0012
caso.cuantia           → "Bs. 10.000,50 (Diez mil 50/100 bolivianos)"  ← formulario
⚠ demandante[1].domicilio vacío (opcional en este modelo)
```

Es el control principal contra el riesgo real del producto: un escrito con un dato equivocado que nadie nota.

### 5.9 Compatibilidad con Word 2016

El motor solo modifica texto, bucles y condiciones dentro del paquete OOXML del modelo y conserva todo lo demás. No introduce partes modernas. Control:

- En CI: cada documento de prueba se abre con LibreOffice sin cabeza (*headless*); si falla, la compilación falla.
- Antes de cada versión: verificación manual en Word 365 y Word 2016 (sin aviso de reparación).

---

## 6. Modelos

### 6.1 Ciclo de vida

```text
Nuevo modelo ─▶ elegir .docx existente ─▶ copia de trabajo en Modelos\_trabajo\
     ▲                                          │
     │            "Abrir archivo" (app predeterminada del sistema)
     │                                          ▼
     └── "Importar versión" ◀── editar en Word y pegar marcadores copiados del panel
              │
              ▼
     escáner + linter ─▶ esquema ─▶ modelo_version vN
```

- Legal-Hub **no edita** `.docx`. El modelo se edita en Word (o LibreOffice/WPS) fuera de la aplicación.
- "Abrir archivo" usa la aplicación predeterminada del sistema. No hay integración con ninguna.
- **Panel de campos:** árbol de campos disponibles con botón *Copiar marcador* al portapapeles. Incluye bloques listos: lista de partes, condicional de cónyuge, tabla de partes.
- Cada importación crea una versión nueva; los documentos generados conservan la versión que usaron.

### 6.2 Paquete `.lhmodel`

ZIP con `template.docx`, `schema.json` y `manifest.json` (versión, SHA-256, fecha, versión mínima de Legal-Hub). Sirve para respaldar, mover y compartir modelos. La base de datos es un índice; el paquete es la fuente de verdad.

```json
{
  "modelo": "demanda-cumplimiento-contrato",
  "version": 3,
  "roles": { "demandante": { "min": 1 }, "demandado": { "min": 1 } },
  "campos": [
    { "path": "demandantes[].nombre", "tipo": "persona.nombre", "requerido": true },
    { "path": "caso.cuantia", "tipo": "moneda", "requerido": true, "etiqueta": "Cuantía (Bs.)" },
    { "path": "caso.hechos", "tipo": "texto_largo" }
  ],
  "visibilidad": [
    { "mostrar": "hay_conyuge", "si": "demandantes[0].estado_civil in ['casado','casada']" }
  ]
}
```

---

## 7. Datos

SQLite en `%LOCALAPPDATA%\LegalHub\legalhub.db`. IDs ULID (texto), fechas y horas en ISO 8601 UTC, dinero y superficies como `Decimal` guardado en TEXT, borrado lógico.

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

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
  codigo TEXT NOT NULL UNIQUE,                       -- LH-2026-0045
  materia TEXT NOT NULL, referencia TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('abierto','en_tramite','suspendido','cerrado','archivado')),
  juzgado TEXT, nro_causa TEXT,                      -- los asigna la autoridad; distinto del código interno
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
  datos_override_json TEXT NOT NULL DEFAULT '{}'     -- sobrescribe datos solo en este caso
);

CREATE TABLE inmueble (
  id TEXT PRIMARY KEY,
  tipo TEXT, departamento TEXT, provincia TEXT, municipio TEXT, localidad TEXT,
  superficie_m2 TEXT, matricula TEXT, codigo_catastral TEXT, ubicacion TEXT,
  colindancias_json TEXT NOT NULL DEFAULT '{}',      -- norte, sur, este, oeste
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
  schema_json TEXT NOT NULL,                         -- caché derivada del paquete
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

CREATE TABLE auditoria (                             -- encadenada con hash
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL, accion TEXT NOT NULL, entidad TEXT, entidad_id TEXT,
  detalle_json TEXT, prev_hash TEXT, hash TEXT NOT NULL
);

CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, aplicada_en TEXT NOT NULL);
```

Notas de diseño:

- **Persona no es rol.** El rol vive en `expediente_parte`, junto con lo que cambia por caso (domicilio procesal).
- **El snapshot congela los datos.** Si la persona cambia de domicilio, los documentos viejos no cambian.
- **Código de expediente atómico.** Se genera en un lote: primero el *upsert* del contador y luego el `INSERT` con subconsulta.

```sql
INSERT INTO contador (anio, ultimo) VALUES (?1, 1)
ON CONFLICT(anio) DO UPDATE SET ultimo = ultimo + 1;

INSERT INTO expediente (id, codigo, materia, estado, created_at, updated_at)
VALUES (?2, 'LH-' || ?1 || '-' || printf('%04d', (SELECT ultimo FROM contador WHERE anio = ?1)),
        ?3, 'abierto', ?4, ?4);
```

- **Migraciones:** archivos `.sql` numerados, aplicados al arrancar con un migrador de ~40 líneas. Antes de migrar se hace un backup automático.
- **Carpeta de documentos** (elegible por el usuario, por defecto en *Documentos*):

```text
Legal-Hub\
├─ Modelos\            # paquetes .lhmodel y _trabajo\
├─ Expedientes\
│   └─ LH-2026-0045\
│       ├─ Documentos\ # Demanda_v01.docx, Demanda_v02.docx …
│       └─ Anexos\
└─ Backups\
```

Nombres de archivo: se sanean caracteres inválidos y nombres reservados de Windows, y se limita la longitud para no superar el límite de ruta de Windows.

---

## 8. Interfaz y flujo

```text
┌───────────────┬────────────────────────────────────────────┐
│ LEGAL-HUB     │  Buscar (Ctrl+K)…                          │
│ Inicio        ├────────────────────────────────────────────┤
│ Expedientes   │  LH-2026-0045 · Cumplimiento de contrato   │
│ Personas      │  Partes │ Inmuebles │ Documentos │ Anexos  │
│ Inmuebles     │                                            │
│ Modelos       │  [ + Nuevo documento ]                     │
│ Configuración │                                            │
└───────────────┴────────────────────────────────────────────┘
```

**Flujo de documento:** abrir expediente → *Nuevo documento* → elegir modelo → formulario (solo lo que falta) → hoja de verificación → generar → *Abrir* o *Mostrar en carpeta*.

**Formulario dinámico.** Cada campo del esquema se resuelve primero contra el expediente. Lo resuelto queda en una sección plegable con su origen; lo faltante o dudoso se muestra arriba.

| Tipo de campo | Componente |
|---|---|
| texto / texto_largo | Entrada de texto / área de texto |
| fecha | Selector de fecha (guarda ISO) |
| moneda / número / superficie | Entrada con validación `Decimal` |
| persona | Selector con búsqueda + "crear nueva" |
| lista repetible | Tabla con agregar, quitar y reordenar |
| sí/no | Casilla; puede activar la visibilidad de otros campos |

Validaciones por tipo: C.I., correo, teléfono y fechas coherentes.

---

## 9. Búsqueda

- SQLite FTS5 con tokenizador `unicode61 remove_diacritics 2` (insensible a tildes) y ranking `bm25`.
- Tablas: `fts_persona`, `fts_expediente`, `fts_documento`. El texto del documento se extrae al generar o adjuntar.
- Tokenizador `trigram` para coincidencias parciales de nombres, si la versión de SQLite lo permite.
- C.I., matrícula y código de expediente: búsqueda exacta o por prefijo sobre columnas indexadas.
- M0 verifica que el SQLite empaquetado trae FTS5.

---

## 10. Seguridad y confidencialidad

Los datos son de clientes bajo secreto profesional.

| Medida | Detalle |
|---|---|
| Ubicación de la base de datos | `%LOCALAPPDATA%\LegalHub\`, fuera de carpetas sincronizadas |
| Interfaz endurecida | CSP estricta, sin contenido remoto, sin `dangerouslySetInnerHTML` |
| Permisos de Tauri | Mínimos: acceso a archivos limitado a la carpeta raíz y a los datos de la aplicación; sin shell; sin HTTP |
| Backups | Cifrados con contraseña (`age`, modo passphrase) |
| Cifrado del equipo | Se recomienda BitLocker o cifrado de dispositivo; la aplicación lo informa |
| Logs | Sin datos personales (nunca nombres ni C.I.); "Exportar diagnóstico" empaqueta logs saneados |
| Telemetría | Ninguna |
| Auditoría | Cadena de hashes (cada evento incluye el hash del anterior) |
| Bloqueo de la aplicación | PIN opcional. Protege contra el acceso casual, **no** contra la extracción de archivos |
| Dependencias | Versiones fijadas con lockfiles; `pnpm audit` y `cargo audit` en CI |

El SHA-256 de los documentos **detecta corrupción accidental, no manipulación**, porque el hash vive en la misma base de datos. La cadena de hashes de la auditoría es lo que da evidencia de integridad. Ninguna de las dos cosas es prueba legal.

Antes de comercializar, revisar con asesoría la normativa local de protección de datos.

---

## 11. Backup y restauración

Implementado en Rust, en *streaming*, para no cargar gigabytes en memoria.

**Backup**

1. Instantánea consistente de la base con la API de backup de SQLite (`rusqlite`), aunque haya escrituras en curso.
2. `manifest.json`: versión de la aplicación, versión del esquema, fecha y SHA-256 de cada archivo.
3. ZIP en streaming de la instantánea, `Modelos\`, `Expedientes\` y configuración.
4. Cifrado con contraseña opcional (`age`). Resultado: `LegalHub_Backup_2026-10-02.lhbak`.
5. **Verificación:** se relee el archivo final y se comprueban los hashes.
6. Backup automático diario al cerrar, con rotación de los últimos N. Destino secundario configurable (otro disco o carpeta externa).

**Restauración**

1. Validar manifiesto y hashes.
2. Extraer en una **carpeta nueva** y correr `PRAGMA integrity_check`.
3. Aplicar migraciones si el backup es de una versión anterior.
4. Hacer un backup previo del estado actual.
5. Intercambiar por renombrado atómico. Nunca se sobrescribe sin respaldo previo.

Prueba automática en CI: crear datos → backup → restaurar en carpeta limpia → comparar.

---

## 12. Calidad y pruebas

| Nivel | Qué se prueba | Herramienta |
|---|---|---|
| Unitarias | Dominio, filtros, validadores, resolver | Vitest, `fast-check` (literales y concordancia) |
| Motor DOCX | Documentos de salida contra esperados (XML canónico + texto) sobre el corpus | Vitest en Node |
| Integración | Repositorios y casos de uso sobre SQLite con las mismas migraciones | Vitest + `better-sqlite3` |
| Rust | Puente SQLite, transacciones, backup y restauración | `cargo test` |
| Apertura de documentos | Cada `.docx` de prueba abre sin error | LibreOffice sin cabeza en CI |
| Interfaz | Formularios críticos | Vitest + Testing Library |
| Humo de extremo a extremo | Flujo completo en la aplicación real | `tauri-driver` (desde M3) |

**Matriz mínima de casos del motor:**

```text
persona natural simple · con segundo apellido · con apellido de casada
persona jurídica con representante y poder
una parte · varias partes · mixto (M+F) · todas F
sin cónyuge · con cónyuge
un inmueble · varios · con varios titulares y porcentajes
C.I. con complemento y expedición
monto con centavos · superficie decimal · fecha 29-feb
campo vacío (opcional y obligatorio)
nombre con tildes, ñ, "&", "<" y comillas
marcador con comillas tipográficas y con mayúscula automática de Word
tabla con filas repetibles · encabezado con marcador · pie con numeración
modelo con cambios controlados (el linter debe fallar)
```

**Corpus real:** 10–15 modelos propios, anonimizados, como banco de pruebas permanente.

**Lista de verificación previa a cada versión:** instalación limpia en máquinas virtuales de Windows 10 y Windows 11, sin permisos de administrador; apertura de documentos generados en Word 365 y Word 2016; restauración de un backup real.

---

## 13. Empaquetado y distribución

- **Instalador NSIS en modo por usuario:** sin administrador, instala en `%LOCALAPPDATA%\Programs\LegalHub`.
- **WebView2:** instalador con el *bootstrapper* embebido (≈ +1,8 MB). Para equipos sin internet se genera además una variante con el instalador sin conexión (≈ +127 MB).
- **Tamaño esperado:** del orden de 10–20 MB sin la variante sin conexión. Se mide en M0.
- **Firma de código:** sin certificado, SmartScreen y Defender alertan al usuario. Se presupuesta desde el piloto.
- **Actualizaciones:** manuales en v1 (nuevo instalador). Las migraciones de base de datos corren al arrancar, con backup previo automático y marcha atrás si fallan.
- **Versionado:** semántico.
- **Licencias:** escáner de licencias en CI. Dependencias principales con licencia MIT o Apache-2.0.

---

## 14. Roadmap

> Estimaciones orientativas para **una persona a tiempo completo**. A medio tiempo, duplicar.

### M0 — Verificación técnica (1–2 semanas)

Antes de construir pantallas se validan las tres suposiciones más riesgosas:

1. **Motor DOCX:** easy-template-x con delimitadores `{{ }}`, resolver propio, bucles en tablas, marcadores en encabezados, comillas tipográficas y marcadores partidos en fragmentos, sobre **10 modelos reales**.
2. **Puente Rust:** `db_tx` atómico, FTS5 disponible, backup y restauración en streaming.
3. **Instalador:** compilar con Tauri, instalar sin administrador en máquinas virtuales limpias de Windows 10 y Windows 11, y medir tamaño y memoria.

**Criterios de avance:** ≥ 80 % del corpus se procesa correctamente con ≤ 15 minutos de preparación por modelo · instalador < 25 MB (sin variante sin conexión) · memoria en reposo < 150 MB · instalación limpia correcta en ambos sistemas.

**Entregable:** informe de resultados y prototipo de línea de comandos del motor.

### M1 — Núcleo y datos (3–4 semanas)

Repositorio, CI, migraciones, puente SQLite, CRUD de expedientes, personas e inmuebles, auditoría, backup/restauración, rutas y nombres seguros.
**Aceptación:** crear un expediente con 2 partes y 1 inmueble; backup → restaurar en carpeta limpia → sin diferencias.

### M2 — Modelos, motor y formulario (3–5 semanas)

Importación de modelos, escáner y linter, paquetes `.lhmodel`, panel de campos, formulario dinámico, filtros jurídicos, hoja de verificación, versionado con snapshot, búsqueda.
**Aceptación de extremo a extremo:** expediente con 2 demandantes (1 F, 1 M) y 1 demandado persona jurídica → generar una demanda desde un modelo real con tabla de partes, encabezado y otrosíes → abre en Word 365 y en Word 2016 sin aviso de reparación → concordancia correcta → hoja de verificación sin pendientes → segunda generación crea `_v02` → restaurar el backup recupera todo.

### M3 — Endurecimiento y piloto (3–4 semanas)

Instalador firmado, backups cifrados, diagnóstico, manual corto, humo de extremo a extremo y **piloto con 3–5 usuarios reales**.
**Aceptación:** el piloto genera ≥ 20 documentos reales sin pérdida de datos; se registran el tiempo por escrito y las correcciones manuales posteriores.

**Total M0–M3: ≈ 10–14 semanas.**

---

## 15. Riesgos

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | Modelos reales demasiado sucios para el motor | Alta | Alta | Linter, corpus, guía de limpieza; se mide en M0 |
| R2 | easy-template-x no cubre un caso real (mantenimiento de un solo autor) | Media | Media | Puerto `MotorPlantillas` y escáner propio permiten reemplazarlo |
| R3 | Escrito con un dato equivocado | Media | Crítico | Hoja de verificación, fallo ruidoso ante datos faltantes, auditoría |
| R4 | Pérdida de datos | Baja | Crítico | WAL, transacciones atómicas, backup verificado, pruebas de restauración |
| R5 | WebView2 ausente o desactualizado en un Windows 10 antiguo | Media | Media | *Bootstrapper* embebido, variante sin conexión, prueba en máquina limpia |
| R6 | SmartScreen o antivirus bloquean el instalador | Alta | Media | Firma de código; instalación por usuario |
| R7 | Curva de aprendizaje de Rust | Media | Baja | Superficie mínima (6 comandos), pruebas en `cargo test` |
| R8 | Fuga de datos de clientes | Baja | Crítico | Backups cifrados, CSP estricta, permisos mínimos, logs sin datos personales |
| R9 | Ampliación de alcance (PDF, Word, IA, nube) | Alta | Alta | Lista "Fuera de v1" con compuertas basadas en el piloto |
| R10 | Competencia (HotDocs, Docassemble, Documate; combinar correspondencia de Word) | Media | Media | Diferencial: localización jurídica, expediente primero, funcionamiento sin conexión, precio; se valida en el piloto |
| R11 | Dependencia de una sola persona | Alta | Alta | Documentación, pruebas, CI reproducible |

---

## 16. Fuera de v1

Se evalúa después del piloto, con evidencia de necesidad:

- Exportación a PDF
- Sugerencia automática de marcadores a partir de un escrito ya redactado (coincidencia con los datos del expediente)
- Biblioteca de cláusulas reutilizables
- Comparación del documento contra el expediente
- Cifrado de la base de datos
- Actualización automática
- OCR de anexos
- Sincronización, multiusuario y nube
- Integración con GEOURBAN
- IA local con revisión humana obligatoria

---

## 17. Primer sprint (M0)

```text
Día 1–2    Repositorio, pnpm, Tauri 2 + React + TS, CI mínimo, carpeta corpus\ (no versionada)
Día 3–5    Reunir y anonimizar 10 modelos reales; clasificarlos por dificultad
Día 3–7    Escáner + linter + resolver cerrado; filtros: concordar, lista, literal, fecha, moneda
Día 6–9    Pruebas golden de los 10 modelos; casos "&", tildes, comillas tipográficas, datos faltantes
Día 6–9    Puente Rust: db_query / db_exec / db_tx, FTS5, backup y restauración
Día 9–10   Compilar instalador; probar en máquinas virtuales limpias de Windows 10 y 11; medir tamaño y memoria
Día 10     Informe de resultados y decisión de avance
```

Requisitos del equipo de desarrollo: Node.js LTS, pnpm, Rust (`rustup`, toolchain MSVC) y las herramientas de compilación de C++ de Visual Studio.

```bash
pnpm create tauri-app legal-hub          # plantilla React + TypeScript
cd legal-hub
pnpm add easy-template-x fflate decimal.js n2words zod react-hook-form @tanstack/react-table
pnpm add -D vitest better-sqlite3 typescript eslint prettier fast-check

cd src-tauri
cargo add rusqlite --features bundled,backup
cargo add zip sha2 age serde_json
```

---

## 18. Fuentes

- Tauri — Instalador de Windows y modos de WebView2: https://v2.tauri.app/distribute/windows-installer/
- easy-template-x: https://github.com/alonrbar/easy-template-x
- rusqlite: https://docs.rs/rusqlite
- SQLite FTS5: https://sqlite.org/fts5.html
- Fin de soporte de Windows 10 y Office 2021: https://heise.de/-11258302
