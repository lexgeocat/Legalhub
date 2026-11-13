# Scriptor — Plan de desarrollo de un editor de redacción general y jurídica (sin IA)

> **Nombre de trabajo:** Scriptor (provisional)
> **Versión del documento:** 1.0 (borrador de planificación)
> **Fecha:** 25 de octubre de 2026
> **Naturaleza del sistema:** editor de documentos tipo Word con herramientas de redacción basadas en **reglas, diccionarios, plantillas, fórmulas y listas de verificación**. **No usa inteligencia artificial generativa ni modelos de aprendizaje automático.** Sugiere, marca y ordena; nunca redacta ni corrige por su cuenta.

---

## Tabla de contenido

0. [Resumen ejecutivo](#0-resumen-ejecutivo)
1. [Visión, principios y alcance](#1-visión-principios-y-alcance)
2. [Mapa de las ocho áreas a módulos del sistema](#2-mapa-de-las-ocho-áreas-a-módulos-del-sistema)
3. [Arquitectura técnica](#3-arquitectura-técnica)
4. [Diseño de la interfaz](#4-diseño-de-la-interfaz)
5. [Especificación detallada de los módulos (Áreas 1 a 8)](#5-especificación-detallada-de-los-módulos)
6. [Modelo de datos](#6-modelo-de-datos)
7. [Catálogo inicial de reglas de estilo](#7-catálogo-inicial-de-reglas-de-estilo)
8. [Catálogo de conectores: taxonomía y producción del dataset](#8-catálogo-de-conectores-taxonomía-y-producción-del-dataset)
9. [Plantillas de documentos y de párrafos](#9-plantillas-de-documentos-y-de-párrafos)
10. [Perfiles de estilo](#10-perfiles-de-estilo)
11. [Hoja de ruta por fases](#11-hoja-de-ruta-por-fases)
12. [Estrategia de pruebas y calidad](#12-estrategia-de-pruebas-y-calidad)
13. [Gobernanza del contenido](#13-gobernanza-del-contenido)
14. [Riesgos y mitigaciones](#14-riesgos-y-mitigaciones)
15. [Distribución, actualización y soporte](#15-distribución-actualización-y-soporte)
16. [Apéndices](#16-apéndices)

---

## 0. Resumen ejecutivo

### 0.1 Problema

Quien redacta documentos jurídicos o profesionales de alto nivel necesita, al mismo tiempo, un procesador de texto, un corrector, una biblioteca de fórmulas y conectores, un archivo de normas y jurisprudencia, y una lista de control para no olvidar nada. Hoy esas herramientas están dispersas, y las soluciones con IA generativa plantean tres problemas serios en el ámbito jurídico: pueden **inventar normas o jurisprudencia**, **envían texto confidencial a servidores externos** y **no son reproducibles** (la misma entrada puede dar salidas distintas).

### 0.2 Solución

Un editor de documentos con un **panel de herramientas determinista**: cada herramienta se basa en reglas, listas, fórmulas o plantillas que el equipo (y el propio usuario) pueden ver, editar y verificar. El sistema:

- Funciona **sin conexión** y guarda los datos **en el equipo del usuario**.
- **Nunca modifica el texto sin que el usuario lo acepte** (no hay autocorrección silenciosa).
- Cubre las **ocho áreas** de dominio de la redacción general y jurídica (sección 2).
- Convierte el conocimiento del dominio (conectores, reglas, plantillas, fichas) en **datos editables**, de modo que ampliar el sistema es agregar contenido y no reescribir código.

### 0.3 Qué se entrega

| Entregable | Descripción |
|---|---|
| Editor | Editor de texto enriquecido con estilos, numeración, tablas, notas al pie, comentarios y control de cambios |
| Panel de herramientas | Conectores, Revisión, Citas, Argumento, Glosario, Plantillas |
| Motor de análisis | Ortografía, reglas de estilo, métricas de cohesión y legibilidad, detectores de consistencia |
| Módulo jurídico | Biblioteca de normas, citador, fichas de jurisprudencia, constructor de argumentos, ficha de caso, calculadora de plazos |
| Módulo de revisión | Verificador de citas, chequeos de consistencia, perfiles de estilo, modo lectura final |
| Paquetes de contenido | Datasets versionados (conectores, reglas, plantillas, fichas), separados por jurisdicción |
| Exportación | Word (.docx), PDF, Markdown y texto plano |

### 0.4 Cifras de referencia del alcance

| Elemento | Meta para la versión 1.0 |
|---|---|
| Conectores y marcadores catalogados | 700 a 900 registros |
| Reglas de estilo, ortografía y tipografía | 150 a 250 reglas, cada una con casos de prueba |
| Plantillas de documento | 10 tipos base, adaptables por jurisdicción |
| Plantillas de párrafo | 8 a 12 esqueletos |
| Fichas de tipos de argumento jurídico | 14 |
| Fichas de falacias | 18 a 20 |
| Glosario jurídico base | 300 a 500 términos (editable por el usuario) |
| Tiempo de desarrollo estimado | 154 a 205 días-persona (≈ 31 a 41 semanas, 7 a 10 meses) con una persona desarrolladora, más trabajo de contenido en paralelo (sección 11) |

---

## 1. Visión, principios y alcance

### 1.1 Qué es y qué no es

| Scriptor **es** | Scriptor **no es** |
|---|---|
| Un editor con herramientas que ayudan a redactar mejor | Un generador de texto ni un "asistente que escribe por ti" |
| Un sistema determinista y auditable | Una caja negra: toda alerta indica qué regla la produjo |
| Una biblioteca personal de normas y fichas que el usuario carga y verifica | Una base de datos oficial de legislación ni un servicio de vigencia normativa |
| Una ayuda para ordenar la verificación de citas | Un verificador automático de que una norma está vigente |
| Una herramienta de apoyo al profesional | Un sustituto del criterio jurídico ni asesoría legal |

### 1.2 Principios de diseño

1. **Determinismo.** Misma entrada, misma salida. Toda sugerencia se puede explicar con una regla, una lista o una fórmula.
2. **El usuario decide.** Las alertas se aceptan, se ignoran o se silencian. Nada se reescribe solo.
3. **Cero invención.** El sistema solo inserta texto que el usuario cargó (normas, fichas, plantillas) o que viene en los paquetes de contenido con su fuente indicada.
4. **Local primero (local-first).** Sin cuenta, sin servidor obligatorio, sin envío de documentos. Funciona sin internet.
5. **Contenido como datos.** Conectores, reglas, plantillas y fichas viven en archivos JSON con esquema validado. Se pueden editar, exportar, versionar y compartir.
6. **Transparencia de límites.** Las reglas tienen falsos positivos. Cada regla muestra su severidad, su motivo y un botón para ignorarla o desactivarla.
7. **Configurabilidad por jurisdicción y por perfil.** Fórmulas, tratamientos, plazos y estructuras cambian según el país y el tipo de escrito. Nada jurídico se fija "de fábrica" sin poder cambiarse.
8. **Privacidad por defecto.** Sin telemetría. Cifrado local opcional para documentos sensibles.
9. **Velocidad percibida.** El análisis corre fuera del hilo principal y es incremental; escribir nunca se siente lento.
10. **Accesibilidad.** Navegación por teclado completa, contraste suficiente, compatibilidad con lectores de pantalla.

### 1.3 Usuarios objetivo

| Perfil | Necesidad principal | Módulos que más usa |
|---|---|---|
| Abogado litigante | Escritos procesales sólidos, citas exactas, control de plazos | Plantillas, Citador, Normas, Argumento, Plazos, Verificador de citas |
| Abogado corporativo / contractual | Contratos consistentes, cláusulas reutilizables, cifras en letras | Plantillas de contrato, Campos variables, Cifras a letras, Consistencia |
| Juez, secretario o funcionario judicial | Resoluciones estructuradas, congruencia, lenguaje claro | Plantillas de sentencia, Legibilidad, Fórmulas resolutivas |
| Servidor público / administrativo | Oficios, informes, resoluciones formales | Plantillas epistolares, Tabla coloquial a formal, Estructura |
| Estudiante de derecho o de letras | Aprender a redactar, ensayos y trabajos académicos | Conectores por intención, Fichas de argumento, Checklists, Falacias |
| Redactor profesional general | Informes y textos formales claros y cohesionados | Conectores, Métricas, Estilo, Vocabulario formal |

### 1.4 Historias de usuario clave

- *Como abogado*, quiero insertar el texto exacto de un artículo de mi biblioteca de normas con su cita ya formateada, para no transcribir y equivocarme.
- *Como redactor*, quiero elegir "quiero contrastar" y ver los conectores adecuados con su puntuación, para no usar un conector que no corresponde.
- *Como abogado*, quiero ver una lista de las normas y sentencias citadas en mi escrito con su estado de verificación, para no presentar una cita sin revisar.
- *Como juez*, quiero que el sistema me avise si mis oraciones superan cierta longitud o si la legibilidad es muy baja, para que la sentencia sea comprensible.
- *Como abogado contractual*, quiero que el monto en cifras y en letras coincida siempre, para evitar discrepancias en un contrato.
- *Como estudiante*, quiero una guía paso a paso para armar un argumento con contraargumento y refutación, para aprender la estructura.
- *Como usuario*, quiero exportar a Word manteniendo numeración, notas al pie y tabla de contenido, para compartir el documento con colegas.
- *Como usuario*, quiero que mis documentos nunca salgan de mi computadora, para proteger la confidencialidad de mis clientes.

### 1.5 Alcance por versiones

| Versión | Incluye |
|---|---|
| **MVP (fases 0-1)** | Editor, corrector ortográfico, panel de conectores con búsqueda e inserción, selector por intención, 3 plantillas (demanda, recurso, carta), exportación a Word y PDF, guardado local |
| **v0.5 (fase 2)** | Motor de reglas de estilo, detectores de conectores, métricas de párrafo y legibilidad, tabla coloquial a formal, perfiles de estilo básicos |
| **v1.0 (fases 3-4)** | Módulo jurídico completo, verificador de citas, control de cambios, versiones, chequeos de consistencia, modo lectura final, 10 plantillas |
| **v1.x (fase 5)** | Versión de escritorio, calculadora de plazos avanzada, copias de seguridad, paquetes de jurisdicción adicionales, colaboración sin servidor (intercambio de archivos) |
| **Fuera de alcance** | IA generativa, corrección automática silenciosa, consulta en línea de vigencia legal, OCR de documentos escaneados, colaboración en tiempo real con servidor, aplicación móvil nativa |

### 1.6 Indicadores de éxito

| Indicador | Meta |
|---|---|
| Alertas útiles (aceptadas o reconocidas como válidas) | ≥ 70 % tras la calibración de reglas |
| Falsos positivos reportados | ≤ 15 % por regla; las reglas que superen el umbral se degradan a "aviso" o se afinan |
| Tiempo de análisis incremental al editar un párrafo | ≤ 150 ms |
| Tiempo de análisis completo de un documento de 20 000 palabras | ≤ 2 s (en segundo plano) |
| Arranque en frío de la aplicación | ≤ 3 s |
| Documentos exportados que abren sin pérdida de formato en Word y LibreOffice | 100 % en la batería de pruebas |
| Satisfacción de usuarios piloto (5 a 10 profesionales) | ≥ 4 de 5 en utilidad y facilidad |

---

## 2. Mapa de las ocho áreas a módulos del sistema

Las ocho áreas de dominio se traducen en módulos concretos. La columna "Tipo de herramienta" indica con qué técnica se resuelve cada una, siempre sin IA.

**Leyenda de técnicas:** `REGLA` (patrón o heurística), `DICC` (diccionario o lista), `PLANT` (plantilla), `CHECK` (lista de verificación), `CALC` (fórmula o algoritmo), `REG` (registro de datos del usuario).

| # | Área de dominio | Módulo del sistema | Tipo de herramienta | Fase |
|---|---|---|---|---|
| 1 | Ortografía y gramática | Corrector ortográfico, reglas de locuciones, queísmo y dequeísmo, tipografía, signos emparejados | DICC, REGLA | 1-2 |
| 2 | Conectores y relaciones lógicas | Panel de conectores, selector por intención, detectores de repetición y de pares incompletos, mapa de conectores | DICC, REGLA, CALC | 1-2 |
| 3 | Coherencia, cohesión y párrafos | Plantillas de párrafo, métricas de longitud, legibilidad, repetición léxica, etiquetado de idea central | PLANT, CALC, REG | 2 |
| 4 | Vocabulario y lenguaje formal | Tabla coloquial a formal, muletillas, tesauro, glosario, fórmulas, latinismos, consistencia terminológica | DICC, REGLA | 2 |
| 5 | Estructura y organización documental | Plantillas por tipo de escrito, checklist de secciones, campos variables, numeración, TOC, notas, referencias cruzadas | PLANT, CHECK | 1-4 |
| 6 | Argumentación y razonamiento | Constructor de argumento, fichas de tipos de argumento, matriz de contraargumentos, cuadro hecho-prueba-norma, falacias | PLANT, CHECK, REG | 3 |
| 7 | Técnica jurídica, interpretación y jurisprudencia | Biblioteca de normas, insertar artículo, citador, fichas de jurisprudencia, checklist de interpretación, plazos, ficha de caso | REG, CHECK, CALC | 3 |
| 8 | Revisión, verificación de fuentes y adaptación | Control de cambios, versiones, verificador de citas, consistencia, perfiles de estilo, modo lectura final | REG, REGLA, CHECK | 4 |

### 2.1 Matriz de trazabilidad (resumen)

Cada funcionalidad de la sección 5 lleva un identificador `A{área}-{nn}` (por ejemplo, `A2-06`). Ese identificador se usa en la hoja de ruta (sección 11), en las pruebas (sección 12) y en el repositorio de contenido (sección 13), de modo que siempre se pueda responder: *¿qué área cubre esto, en qué fase llega y cómo se prueba?*


---

## 3. Arquitectura técnica

### 3.1 Stack recomendado y alternativas

| Capa | Recomendación | Alternativas | Criterio de decisión |
|---|---|---|---|
| Plataforma | Aplicación web instalable (PWA) y después empaquetado de escritorio con Tauri | Electron; solo web | Offline, multiplataforma, bajo peso. Tauri pesa mucho menos que Electron; Electron tiene más madurez en ciertos APIs |
| Lenguaje | TypeScript | JavaScript | Tipado para esquemas de datos y reglas; menos errores |
| Framework de interfaz | React o Svelte | Vue | Elegir el que domine el equipo; el editor no depende de esta elección |
| Editor | TipTap sobre ProseMirror | ProseMirror directo; Lexical; Slate | ProseMirror da control fino del esquema del documento y de las *decoraciones*. Verificar el licenciamiento actual de las extensiones de TipTap: algunas (comentarios, historial, colaboración) pueden ser de pago, y en ese caso conviene implementarlas directamente sobre ProseMirror |
| Ortografía | `nspell` con diccionario Hunspell en español | Typo.js; Hunspell en WASM | `nspell` es JavaScript puro y admite diccionario personal. Revisar la licencia del diccionario antes de distribuir (suele ser multilicencia) |
| Motor de reglas | Motor propio de patrones (regex Unicode + listas + trie) | LanguageTool autoalojado | El motor propio mantiene todo en el navegador. LanguageTool es potente pero requiere Java y servidor local, lo que complica el uso sin conexión |
| Búsqueda | FlexSearch | lunr; MiniSearch | Velocidad y búsqueda con tolerancia a tildes |
| Base de datos local | IndexedDB mediante Dexie | SQLite en WASM (sql.js, wa-sqlite) | Dexie es simple y suficiente. SQLite en WASM sería preferible si hay consultas relacionales complejas |
| Segmentación de texto | `Intl.Segmenter` si está disponible, con segmentador propio de respaldo | — | El segmentador propio es necesario igualmente por las abreviaturas jurídicas (*art.*, *inc.*, *fs.*) |
| Comparación de versiones | `diff-match-patch` | jsdiff | Diferencias a nivel de palabra |
| Importar .docx | `mammoth` (conversión a HTML limpio) | Procesamiento XML propio | Rápido de integrar; no conserva el 100 % del formato |
| Importar PDF (texto) | `pdfjs-dist` | — | Solo PDF con texto. El OCR queda fuera de alcance |
| Exportar .docx | Librería `docx` | Plantillas con `docxtemplater` | Soporta numeración, notas al pie, encabezados, tabla de contenido |
| Exportar PDF | Impresión con CSS paginado (PWA) o impresión a PDF nativa (Tauri) | `pdf-lib`, `pdfmake` | Fidelidad frente a control; se define en la fase 1 con una prueba de concepto |
| Pruebas | Vitest (unitarias), Playwright (extremo a extremo) | Jest, Cypress | Velocidad y soporte de navegadores |
| Empaquetado de contenido | Archivos JSON con esquema JSON Schema, validados con Ajv | — | Validación automática en integración continua |

> **Nota sobre "sin IA":** el sistema no incluye modelos de aprendizaje automático. Esto también excluye el OCR moderno (que usa redes neuronales) y cualquier servicio externo de correcciones. Si en el futuro se desea ampliar, debe ser un módulo opcional y claramente separado.

### 3.2 Diagrama de capas

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INTERFAZ (React/Svelte)                      │
│  Barra superior · Panel izquierdo · Editor · Panel derecho · Barra  │
└───────────────┬─────────────────────────────────────┬───────────────┘
                │ comandos / estado                   │ alertas (decoraciones)
┌───────────────▼───────────────┐       ┌─────────────▼───────────────┐
│      NÚCLEO DEL EDITOR        │       │    MOTOR DE ANÁLISIS        │
│  ProseMirror (esquema propio) │◄─────►│    (Web Worker)             │
│  Comandos · Plugins · Historial│       │  Segmentación · Reglas ·    │
│  Control de cambios · Campos  │       │  Conectores · Métricas ·    │
└───────────────┬───────────────┘       │  Consistencia · Ortografía  │
                │                       └─────────────┬───────────────┘
┌───────────────▼─────────────────────────────────────▼───────────────┐
│                  CAPA DE DATOS (Dexie / IndexedDB)                  │
│  Documentos · Versiones · Normas · Fichas · Casos · Preferencias    │
│  Paquetes de contenido (conectores, reglas, plantillas, calendarios)│
└───────────────┬─────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────────┐
│    ENTRADA / SALIDA: .docx · .pdf · .md · .txt · .scriptor (copia)  │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Estructura sugerida del repositorio

```
scriptor/
├─ apps/
│  ├─ web/                    # PWA
│  └─ desktop/                # Empaquetado Tauri (fase 5)
├─ packages/
│  ├─ editor/                 # Esquema ProseMirror, extensiones, comandos
│  ├─ analysis/               # Motor de análisis (corre en Worker)
│  │  ├─ segmenter/           # Párrafos, oraciones, palabras
│  │  ├─ spelling/            # nspell + diccionario personal
│  │  ├─ rules/               # Ejecutor de reglas (regex, listas, heurísticas)
│  │  ├─ connectors/          # Trie, detectores, mapa
│  │  ├─ metrics/             # Sílabas, legibilidad, repetición, densidad
│  │  └─ consistency/         # Partes, fechas, montos, referencias
│  ├─ legal/                  # Normas, citador, jurisprudencia, plazos, casos
│  ├─ export/                 # docx, pdf, md, txt
│  ├─ storage/                # Capa Dexie, migraciones, copias de seguridad
│  └─ schemas/                # JSON Schema de todos los tipos de contenido
├─ content/
│  ├─ core-es/                # Paquete base en español (general)
│  │  ├─ connectors/
│  │  ├─ rules/
│  │  ├─ templates/
│  │  ├─ glossary/
│  │  └─ arguments/
│  └─ jurisdiction-xx/        # Paquete por jurisdicción (plantillas, fórmulas, calendario)
├─ tests/
│  ├─ rules-corpus/           # Casos positivos y negativos por regla
│  ├─ e2e/
│  └─ fixtures/
└─ docs/
```

### 3.4 Pipeline de análisis

El motor de análisis convierte el documento en alertas mediante una cadena fija de etapas:

```
Documento (ProseMirror)
   │
   ▼
1. EXTRACCIÓN       Texto plano por bloque + mapa de desplazamientos (offset ↔ posición del editor)
   │
   ▼
2. ZONAS EXCLUIDAS  Se omiten: citas textuales marcadas, campos variables, marcadores [COMPLETAR],
   │                URLs, correos, código, números de expediente, latinismos marcados (solo para ortografía)
   ▼
3. SEGMENTACIÓN     Párrafos → oraciones → palabras (respetando abreviaturas y decimales)
   │
   ▼
4. NORMALIZACIÓN    NFC, minúsculas, versión sin tildes para comparación tolerante
   │
   ▼
5. ANALIZADORES     En paralelo y por capas:
   │                 a) Ortografía        b) Reglas de patrón   c) Conectores
   │                 d) Métricas          e) Estructura         f) Consistencia
   ▼
6. AGREGACIÓN       Alertas → deduplicar → filtrar por perfil activo → quitar silenciadas
   │
   ▼
7. EMISIÓN          Alertas enviadas a la interfaz como decoraciones (no entran al documento)
```

**Decisiones técnicas clave:**

- **Las alertas son *decoraciones*, no marcas del documento.** Así no contaminan el contenido, no se exportan y no entran al historial de cambios.
- **Mapa de desplazamientos.** El análisis opera sobre texto plano, pero las alertas deben señalar rangos en el editor. Se mantiene una tabla bloque → (offset de texto ↔ posición ProseMirror).
- **Análisis incremental.** Cada párrafo tiene un hash de contenido. Al editar, solo se reanalizan los párrafos con hash nuevo (más los vecinos inmediatos para los detectores de repetición). Los análisis globales (mapa de conectores, consistencia, legibilidad total) se ejecutan en diferido (*debounce* de 800 ms o al quedar inactivo el navegador).
- **Alertas ignoradas persistentes.** Cuando el usuario ignora una alerta, se guarda `ruleId` + hash del contexto (±40 caracteres). Si el texto cambia, la alerta puede volver a aparecer; si no, permanece silenciada.
- **Expresiones regulares con Unicode.** En JavaScript, `\b` solo reconoce límites ASCII y falla con letras acentuadas. El motor compila los patrones con la bandera `u` y reemplaza `\b` por *lookarounds* de la forma `(?<![\p{L}\p{N}_])` y `(?![\p{L}\p{N}_])`.
- **Búsqueda de múltiples patrones.** Los conectores (cientos de frases) se buscan con un **trie** (o algoritmo de Aho-Corasick) sobre tokens normalizados, no con cientos de regex, para mantener el rendimiento.

### 3.5 Presupuestos de rendimiento

| Operación | Presupuesto | Estrategia |
|---|---|---|
| Pulsación de tecla a pantalla | < 16 ms | El análisis nunca corre en el hilo principal |
| Análisis incremental de un párrafo | ≤ 150 ms | Hash por párrafo; Web Worker |
| Análisis completo (20 000 palabras) | ≤ 2 s | Análisis por lotes con cesión de hilo; progreso visible |
| Búsqueda en conectores (≈ 900 registros) | ≤ 30 ms | Índice FlexSearch en memoria |
| Búsqueda en biblioteca de normas (≈ 50 000 artículos) | ≤ 150 ms | Índice por norma, carga perezosa |
| Exportar un documento de 100 páginas a .docx | ≤ 5 s | Generación en Worker |
| Arranque en frío | ≤ 3 s | *Service worker*, carga diferida de módulos jurídicos |

### 3.6 Esquema del documento (nodos y marcas ProseMirror)

**Nodos de bloque:** `párrafo`, `encabezado` (niveles 1 a 6), `lista_ordenada`, `lista_viñetas`, `ítem`, `cláusula` (para contratos, con numeración ordinal), `cita_en_bloque`, `tabla` (`fila`, `celda`), `salto_de_página`, `bloque_de_firma`, `nota_al_pie_contenido`.

**Nodos en línea:** `campo_variable` (atómico, referencia un campo del documento), `marcador_completar` (atómico, con nota), `referencia_cruzada` (apunta a un id de sección o punto), `llamada_nota_al_pie`, `cita_normativa` (enlazada a una ficha del citador).

**Marcas:** `negrita`, `cursiva`, `subrayado`, `cita_textual` (excluye el texto de las reglas), `latinismo` (cursiva automática y exención ortográfica), `comentario`, `cambio_insertado`, `cambio_eliminado`, `enlace`.

**Atributos del documento:** tipo de escrito, perfil de estilo, jurisdicción, tamaño de papel, márgenes, interlineado, fuente, tabla de campos variables, ficha de caso vinculada.

### 3.7 Persistencia local (IndexedDB)

| Almacén | Contenido | Índices principales |
|---|---|---|
| `documentos` | Documento actual en JSON ProseMirror + metadatos | id, título, tipo, actualizado |
| `versiones` | Instantáneas del documento | documentoId, fecha, etiqueta |
| `alertas_ignoradas` | Alertas silenciadas por regla y contexto | documentoId, ruleId, hash |
| `normas` | Cabecera de cada norma cargada | id, tipo, número, jurisdicción |
| `articulos` | Cada artículo de cada norma | normaId, número, texto indexado |
| `jurisprudencia` | Fichas de sentencias | id, tribunal, fecha, materia |
| `casos` | Fichas de caso y cronologías | id, expediente, estado |
| `citas_verificacion` | Estado de verificación de cada cita | documentoId, citaId, estado |
| `glosario_usuario` | Términos jurídicos y preferencias terminológicas | término |
| `diccionario_usuario` | Palabras agregadas al corrector | palabra |
| `plantillas_usuario` | Plantillas y fragmentos propios | id, tipo |
| `calendarios` | Feriados y reglas de cómputo | jurisdicción, año |
| `paquetes` | Paquetes de contenido instalados y su versión | id, versión |
| `preferencias` | Perfil activo, reglas desactivadas, atajos, tema | clave |

**Riesgo conocido:** el navegador puede borrar IndexedDB bajo presión de almacenamiento. Mitigaciones: solicitar almacenamiento persistente (`navigator.storage.persist()`), recordatorios de copia de seguridad, guardado en archivo local (File System Access API donde exista) y exportación periódica a `.scriptor`.

### 3.8 Funcionamiento sin conexión (PWA)

- *Service worker* que precarga la aplicación y los paquetes de contenido.
- Todo el análisis y la edición funcionan sin red; no hay llamadas externas.
- Actualización de contenido por **importación manual** de paquetes (archivo) y, opcionalmente, verificación de nuevas versiones cuando haya conexión, con confirmación del usuario.
- Los nombres de archivo `.scriptor` (ZIP con JSON) permiten mover documentos y bibliotecas entre equipos.

### 3.9 Exportación

| Formato | Contenido conservado | Notas técnicas |
|---|---|---|
| `.docx` | Estilos, numeración multinivel, tablas, notas al pie, encabezados y pies, tabla de contenido, saltos de página, comentarios | Se mapea cada nodo del esquema a elementos de la librería `docx`. Se validan los archivos abriéndolos en Word y LibreOffice |
| `.pdf` | Diseño paginado con márgenes, numeración de página, TOC | Prueba de concepto en la fase 1 para decidir entre CSS paginado, `pdfmake` o impresión nativa |
| `.md` | Estructura y formato básico | Útil para respaldo y control de versiones externo |
| `.txt` | Texto plano | Sin formato |
| `.scriptor` | Documento + versiones + campos + fichas vinculadas | Copia de seguridad completa |

**Compuerta de exportación:** antes de exportar, el sistema muestra el **modo lectura final** (sección 5, Área 8) con pendientes, alertas abiertas y citas sin verificar. El usuario puede exportar igualmente, pero queda advertido.

### 3.10 Seguridad y privacidad

- **Sin telemetría** y sin envío de contenido. Los contadores de uso, si existen, se guardan solo en el equipo.
- **Cifrado local opcional** de documentos con clave del usuario (Web Crypto API, AES-GCM, derivación de clave con PBKDF2 o Argon2 en WASM). Aviso claro: si se pierde la clave, no hay recuperación.
- **Importación segura:** el contenido importado (DOCX, HTML, PDF) se sanea antes de mostrarse para evitar inyección de código.
- **Paquetes de contenido:** validados contra esquema y, si se distribuyen, firmados (hash SHA-256 en el manifiesto; firma digital opcional).
- **Política de contenido de terceros:** el sistema no incluye normas ni jurisprudencia propias; el usuario carga las fuentes oficiales que tiene derecho a usar.

### 3.11 Paquetes de jurisdicción

Todo lo que cambia por país o fuero vive en un **paquete de jurisdicción** independiente del código:

| Elemento del paquete | Ejemplos |
|---|---|
| Estructura de escritos | Secciones y nombres de cada tipo de escrito procesal |
| Fórmulas procesales | Encabezados, tratamientos, petitorios, fórmulas de cierre y de resolución |
| Formato de cita | Plantillas de cita de normas y de sentencias |
| Jerarquía normativa | Orden de las fuentes y su peso |
| Calendario y cómputo | Feriados, días inhábiles, reglas de cómputo de plazos |
| Formato de página | Tamaño de papel, márgenes, interlineado, fuente de uso habitual |
| Moneda y formato numérico | Nombre de la moneda, separadores decimales y de miles, convención de monto en letras |
| Siglas y abreviaturas | Tabla propia de la jurisdicción |

El paquete base (`core-es`) es neutral; cada jurisdicción agrega o reemplaza elementos.

### 3.12 Extensibilidad

- **Reglas definidas por datos:** agregar una regla de estilo es agregar un registro JSON (sección 6), con casos de prueba.
- **Reglas con código (heurísticas):** se escriben como funciones puras en el paquete `analysis/rules`, con interfaz `(contexto) → alertas[]`, y se registran por identificador.
- **Plantillas y fragmentos del usuario:** el usuario puede crear y compartir sus propias plantillas, cláusulas y fichas.
- **Importar y exportar contenido:** cualquier elemento (un conector, una plantilla, un conjunto de reglas) se exporta como JSON para compartirlo.

---

## 4. Diseño de la interfaz

### 4.1 Distribución de la pantalla

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ☰ Scriptor │ Tipo: Recurso ▾ │ Perfil: Jurídico-procesal ▾ │ Pendientes: 7 │ Exportar ▾ │
├──────────────────┬─────────────────────────────────────────────┬─────────────────────┤
│ ESQUEMA          │                                             │ [Conectores]        │
│ ▸ I. Antecedentes│   (Editor)                                  │ [Revisión]          │
│ ▸ II. Agravios   │                                             │ [Citas]             │
│   · Agravio 1    │   Texto del documento con alertas           │ [Argumento]         │
│   · Agravio 2    │   subrayadas, campos variables resaltados   │ [Glosario]          │
│ ▸ III. Petitorio │   y marcadores [COMPLETAR] visibles.        │ [Plantillas]        │
│                  │                                             │ ─────────────────── │
│ CHECKLIST        │                                             │ (contenido de la    │
│ ☑ Identificación │                                             │  pestaña activa)    │
│ ☑ Tempestividad  │                                             │                     │
│ ☐ Petitorio      │                                             │                     │
├──────────────────┴─────────────────────────────────────────────┴─────────────────────┤
│ 3 420 palabras · 14 párr. · INFLESZ 48 (algo difícil) · 5 alertas · 22 conectores · ⚠ 3 citas │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Descripción de los paneles

**Barra superior.** Menú principal, selector de **tipo de escrito** (carga la plantilla y la checklist), selector de **perfil de estilo** (activa o desactiva reglas), contador de **pendientes** (marcadores `[COMPLETAR]`, alertas graves y citas sin verificar) y menú **Exportar**.

**Panel izquierdo.**
- *Esquema:* árbol de encabezados navegable, con reordenamiento arrastrando secciones. Muestra la **etiqueta de idea central** de cada párrafo (Área 3) si el usuario la definió.
- *Checklist de estructura:* secciones obligatorias del tipo de escrito, marcadas automáticamente cuando detecta el encabezado correspondiente y manualmente si el usuario lo decide.

**Centro: editor.**
- Barra de formato (estilos, listas, numeración, tablas, notas al pie, referencias cruzadas).
- Alertas como subrayados de colores: **rojo** (error), **ámbar** (aviso), **azul** (sugerencia de estilo). El subrayado es discreto y desactivable.
- Menú contextual con la alerta: motivo, regla, 1 a 3 sugerencias, y las acciones **Aplicar**, **Ignorar esta vez**, **Ignorar en este documento** y **Desactivar regla**.
- Campos variables con fondo tenue; marcadores `[COMPLETAR]` con fondo ámbar.

**Panel derecho (pestañas).**

| Pestaña | Contenido |
|---|---|
| **Conectores** | Búsqueda, filtros (categoría, ámbito, registro, tipo de escrito), selector por intención, ficha del conector, favoritos, mapa de conectores del documento |
| **Revisión** | Lista de alertas del documento (filtrable por severidad y regla), métricas del párrafo y del documento, detectores de repetición y cohesión |
| **Citas** | Biblioteca de normas, insertar artículo, citador, fichas de jurisprudencia, verificador de citas |
| **Argumento** | Constructor de argumento, fichas de tipos de argumento, matriz de contraargumentos, cuadro hecho-prueba-norma, checklist de falacias |
| **Glosario** | Glosario jurídico, tesauro formal, tabla coloquial a formal, latinismos, fórmulas por sección, preferencias terminológicas |
| **Plantillas** | Plantillas de documento, esqueletos de párrafo, cláusulas y fragmentos reutilizables |

**Barra inferior.** Palabras, párrafos, índice de legibilidad con su interpretación, número de alertas, conectores usados y citas pendientes de verificación. Cada indicador es clicable y abre el detalle correspondiente.

### 4.3 Modos de trabajo

| Modo | Descripción |
|---|---|
| **Redacción** | Vista normal con el panel derecho abierto en Conectores o Plantillas |
| **Enfoque** | Oculta paneles y alertas; solo el editor |
| **Revisión** | Activa todas las alertas, abre el panel Revisión y muestra el control de cambios |
| **Lectura final** | Pantalla única con pendientes, alertas abiertas, citas sin verificar e inconsistencias, previa a exportar |
| **Estudio** | Pensado para estudiantes: muestra las explicaciones largas de cada regla y de cada ficha |

### 4.4 Atajos de teclado sugeridos

| Atajo | Acción |
|---|---|
| `Ctrl/Cmd + K` | Buscar conector por texto |
| `Ctrl/Cmd + Shift + K` | Selector de conector por intención |
| `Ctrl/Cmd + J` | Abrir biblioteca de normas e insertar artículo |
| `Ctrl/Cmd + Shift + C` | Abrir citador |
| `Ctrl/Cmd + .` | Ver sugerencias de la alerta bajo el cursor |
| `F8` / `Shift + F8` | Ir a la siguiente / anterior alerta |
| `Ctrl/Cmd + Shift + L` | Insertar marcador `[COMPLETAR]` |
| `Ctrl/Cmd + Alt + M` | Etiquetar idea central del párrafo |
| `Ctrl/Cmd + Shift + R` | Modo lectura final |
| `Ctrl/Cmd + Shift + V` | Guardar versión con etiqueta |

### 4.5 Accesibilidad y usabilidad

- Toda función es accesible por teclado; foco visible; orden de tabulación lógico.
- Contraste mínimo WCAG 2.1 AA; el color nunca es el único indicador (las alertas llevan icono y texto).
- Compatibilidad con lectores de pantalla: roles ARIA en paneles, anuncios de alertas bajo demanda (no automáticos para no interrumpir).
- Tamaño de fuente de la interfaz y del editor configurable de forma independiente.
- Temas claro, oscuro y de alto contraste.
- **Incorporación (onboarding):** documento de ejemplo con alertas deliberadas y un recorrido de 5 minutos por las herramientas.

---

## 5. Especificación detallada de los módulos

**Convenciones de esta sección**

- **Prioridad (MoSCoW):** `M` imprescindible, `S` importante, `C` deseable.
- **Fase:** número de fase de la hoja de ruta (sección 11).
- **Criterios de aceptación:** condiciones verificables para dar la funcionalidad por terminada.
- **Límites conocidos:** lo que la técnica sin IA no puede resolver, declarado de forma explícita.

---

### 5.1 Área 1 — Ortografía y gramática

**Objetivo.** Detectar errores ortográficos, tipográficos y un conjunto acotado de errores gramaticales y de uso frecuentes, explicando cada alerta y ofreciendo hasta tres sugerencias.

#### Funcionalidades

| ID | Funcionalidad | Prior. | Fase |
|---|---|---|---|
| A1-01 | Corrector ortográfico con diccionario Hunspell en español | M | 1 |
| A1-02 | Diccionario personal (palabras, nombres propios, términos jurídicos) con importación y exportación | M | 1 |
| A1-03 | Reglas de locuciones incorrectas (*en base a*, *dentro del marco de*, *a nivel de*, etc.) | M | 2 |
| A1-04 | Detección de queísmo y dequeísmo por lista de verbos y locuciones | S | 2 |
| A1-05 | Aviso de posible gerundio de posterioridad (heurística) | S | 2 |
| A1-06 | Tipografía: espacios dobles, espacio antes de signos, falta de espacio tras coma, puntos suspensivos, comillas, rayas | M | 2 |
| A1-07 | Signos emparejados: `¿?`, `¡!`, paréntesis, corchetes, comillas y rayas de diálogo | M | 2 |
| A1-08 | Mayúsculas y minúsculas: días, meses, cargos, tratamientos, inicio de oración | S | 2 |
| A1-09 | Tildes: diacríticas, *solo*, demostrativos, monosílabos, palabras mal acentuadas frecuentes | S | 2 |
| A1-10 | Abreviaturas, siglas y símbolos con tabla editable (*art.*, *arts.*, *inc.*, *núm.*, *fs.*) | S | 2 |
| A1-11 | Convención de números y cifras (separadores, porcentajes, ordinales) | S | 2 |
| A1-12 | Pares y parónimos frecuentes (*a ver*/*haber*, *sino*/*si no*, *porque*/*por qué*, *aparte*/*a parte*) como lista de revisión manual con ejemplos | C | 2 |
| A1-13 | Concordancia básica (artículo y sustantivo en casos regulares y excepciones como *el agua*) | C | 4+ |

#### Cómo funciona

**Ortografía (A1-01, A1-02).**

1. Se tokenizan las palabras con Unicode (letras, apóstrofes, guiones internos).
2. Se omiten: números, URLs, correos, siglas en mayúscula (configurable), campos variables, marcadores `[COMPLETAR]`, citas textuales y latinismos marcados.
3. Cada palabra se consulta en el diccionario Hunspell combinado con el diccionario del usuario y el glosario jurídico.
4. Si no existe, se piden hasta 3 sugerencias, ordenadas por distancia y frecuencia.
5. El usuario puede **Agregar al diccionario** (se guarda con sus formas flexionadas cuando el diccionario lo permite).

**Reglas de patrón (A1-03 a A1-12).**

- Cada regla es un registro con patrón, mensaje, sugerencias, severidad y perfiles (sección 6.2 y catálogo en la sección 7).
- Los patrones se compilan con límites de palabra Unicode.
- Las **excepciones** se declaran por regla (por ejemplo, *a nivel de* dentro de *a nivel nacional* no se marca).
- Las reglas heurísticas (gerundio, queísmo en construcciones ambiguas) se marcan como `severidad: "aviso"` o `"sugerencia"`, nunca como `"error"`.

**Signos emparejados (A1-07).** Se recorre cada oración con una pila: cada signo de apertura debe cerrarse en la misma oración o párrafo (según el signo). Se informa el signo huérfano y su posición.

**Mayúsculas (A1-08).** Lista de días y meses que no deben ir en mayúscula salvo al inicio de oración; lista de cargos y tratamientos con su regla (por ejemplo, minúscula cuando acompañan a un nombre propio, salvo que la jurisdicción indique otro uso); aviso de oración que comienza con minúscula tras punto.

#### Interfaz

- Subrayado ondulado en el editor; menú contextual con motivo, sugerencias y acciones (sección 4.2).
- Pestaña **Revisión** con listado agrupado por tipo (ortografía, tipografía, uso) y filtros por severidad.
- Ajustes: activar o desactivar reglas individuales o familias; elegir el estilo de comillas (angulares «», inglesas “” o rectas) y de rayas.

#### Criterios de aceptación

- Detecta ≥ 95 % de los errores del corpus de pruebas ortográficas de referencia (500 oraciones con errores conocidos).
- Cada regla tiene ≥ 5 casos positivos y ≥ 5 negativos que pasan en integración continua.
- Ninguna alerta se aplica sin acción del usuario.
- Una palabra agregada al diccionario personal deja de marcarse de inmediato y persiste entre sesiones.
- Las zonas excluidas (citas textuales, campos, latinismos) no generan alertas ortográficas.

#### Límites conocidos

- Sin análisis sintáctico completo, la **concordancia compleja**, los errores de **sentido** (palabras correctas mal usadas, como *infringir*/*infligir*) y la **ambigüedad** quedan fuera. Algunos de estos casos se cubren con la lista de revisión manual (A1-12).
- El gerundio de posterioridad y el queísmo tienen falsos positivos: por eso son avisos.
- Los nombres propios y términos técnicos nuevos requieren diccionario personal.

---

### 5.2 Área 2 — Conectores y relaciones lógicas

**Objetivo.** Que el usuario elija el conector correcto por su función lógica, lo inserte con la puntuación adecuada y reciba avisos cuando el texto abuse de uno o carezca de relaciones lógicas explícitas.

#### Funcionalidades

| ID | Funcionalidad | Prior. | Fase |
|---|---|---|---|
| A2-01 | Panel de conectores con búsqueda tolerante a tildes y filtros (categoría, ámbito, registro, tipo de escrito, perfil) | M | 1 |
| A2-02 | Inserción con un clic: capitaliza si abre oración, añade la coma o el punto y coma que corresponda | M | 1 |
| A2-03 | Ficha de conector: función, posición, puntuación, ejemplo, errores comunes, sinónimos | M | 1 |
| A2-04 | Selector por intención ("quiero contrastar", "quiero concluir", "quiero citar una norma") | M | 1 |
| A2-05 | Favoritos y colecciones personales de conectores | S | 2 |
| A2-06 | Detector: mismo conector en párrafos consecutivos o dentro de una ventana | M | 2 |
| A2-07 | Detector: párrafos sin ningún conector (en documentos extensos) | S | 2 |
| A2-08 | Detector: desequilibrio de categorías (por ejemplo, 80 % aditivos) | S | 2 |
| A2-09 | Detector: pares incompletos (*si bien es cierto que…* sin *no es menos cierto que…*) | S | 2 |
| A2-10 | Detector: puntuación incorrecta del conector (falta de comas) | M | 2 |
| A2-11 | Alternativas al hacer clic sobre un conector ya usado (sinónimos de la misma categoría) | M | 2 |
| A2-12 | Mapa de conectores: resumen visual por categoría, por párrafo y por frecuencia | S | 2 |
| A2-13 | Aviso de conector consecutivo sin antecedente (por ejemplo, *por consiguiente* en el primer párrafo) | C | 4 |
| A2-14 | Colecciones de conectores por sección de plantilla (por ejemplo, "fundamento normativo" en una demanda) | S | 2 |

#### Cómo funciona

**Búsqueda y filtros (A2-01).** Índice en memoria (FlexSearch) sobre `texto`, `sinonimos`, `categoria`, `funcion` y `ejemplo`. La búsqueda normaliza tildes y mayúsculas. Los filtros se combinan con AND; las categorías con OR.

**Inserción con puntuación (A2-02).** Algoritmo:

```
dado: conector C, posición del cursor P
si P está al inicio de oración:
    insertar C con inicial mayúscula
    si C.puntuacion.despues == "coma": añadir ","
si P está dentro de una oración:
    si C.puntuacion.antes incluye "punto_y_coma" o "coma": asegurar que el carácter anterior
        sea ese signo (ofrecer elegir si hay más de uno)
    si C.puntuacion.despues == "coma": añadir ","
    mantener minúscula inicial
si C.tipo == "par" (por ejemplo, "si bien es cierto que ... no es menos cierto que ..."):
    insertar ambos miembros con un marcador [COMPLETAR] entre ellos
```

**Selector por intención (A2-04).** Tabla fija de intenciones que apuntan a categorías (sección 8.3). El usuario ve primero 5 a 8 conectores sugeridos por esa intención, y puede ampliar a toda la categoría.

**Detector de repetición (A2-06).**

1. Se construye un trie con las formas normalizadas de todos los conectores marcados `detectable: true`.
2. Para cada párrafo se obtienen los conectores usados, por coincidencia más larga (para que *no obstante* no se confunda con *no*).
3. Se compara el conjunto del párrafo *n* con los de los párrafos *n-1* y *n-2* (ventana configurable).
4. Si hay repetición, se genera una alerta de severidad `sugerencia` sobre la segunda aparición y se ofrecen sinónimos de la misma categoría y registro.

> Los conectores muy cortos o ambiguos (*si*, *como*, *para*, *así*, *luego*, *pues*) se marcan `detectable: false` y no participan en los detectores, para evitar ruido.

**Pares incompletos (A2-09).** Tabla de pares con su orden. Si aparece el primer miembro en un párrafo y no aparece el segundo en los dos párrafos siguientes, se marca como sugerencia. Ejemplos de pares: *por un lado… por otro*, *si bien es cierto que… no es menos cierto que…*, *no solo… sino también*, *de una parte… de otra*, *en primer lugar… en segundo lugar… por último*.

**Desequilibrio de categorías (A2-08).** Se calcula la proporción de cada categoría sobre el total de conectores detectables. Si una supera un umbral configurable (por defecto 50 %) y hay ≥ 10 conectores, se muestra una sugerencia general en la pestaña Revisión.

**Puntuación del conector (A2-10).** Para cada conector detectado se verifica la coma posterior (cuando `puntuacion.despues == "coma"`) y el signo anterior (cuando abre oración o está en medio). Se omiten los casos en que el conector forme parte de una estructura que no requiere coma (por ejemplo, *no obstante* como parte de una locución verbal).

#### Interfaz

- Pestaña **Conectores**: barra de búsqueda; chips de filtros; lista con el conector, su categoría y un icono de ficha; botón **Insertar**.
- Vista **Por intención**: botones grandes con intenciones agrupadas (Ordenar, Añadir, Contrastar, Conceder, Explicar causa, Concluir, Ejemplificar, Reformular, Enfatizar, Citar norma, Citar jurisprudencia, Valorar prueba, Refutar, Pedir).
- **Mapa de conectores**: gráfico de barras por categoría y línea de tiempo por párrafo (cuáles y dónde).
- Ficha con ejemplos **bueno y malo** del uso del conector.

#### Criterios de aceptación

- Buscar "no obstante" y "no obstante," (con coma) devuelve el mismo resultado.
- Insertar *sin embargo* al inicio de una oración produce `Sin embargo,` con la coma.
- El detector no marca *no obstante* como repetición de *no* ni de *obstante* por separado.
- El mapa de conectores refleja los cambios en menos de 1 s tras dejar de escribir.
- Cada conector del dataset tiene categoría, ámbito, registro, puntuación y ejemplo.

#### Límites conocidos

- El sistema no verifica que el conector sea *lógicamente* correcto en el contexto (no entiende el significado). La función lógica se garantiza por el **selector por intención** y por las **fichas**, no por análisis semántico.
- La detección de pares incompletos depende de que ambos miembros aparezcan en forma estándar.

---

### 5.3 Área 3 — Coherencia, cohesión y construcción de párrafos

**Objetivo.** Dar al usuario esqueletos de párrafo y métricas objetivas (longitud, legibilidad, repeticiones) para detectar texto denso, repetitivo o desordenado.

#### Funcionalidades

| ID | Funcionalidad | Prior. | Fase |
|---|---|---|---|
| A3-01 | Plantillas de párrafo (general, argumentativo, jurídico, narrativo, refutación, transición) con marcadores | M | 1-2 |
| A3-02 | Alerta de longitud de oración (umbral configurable por perfil) | M | 2 |
| A3-03 | Alerta de longitud de párrafo (palabras y número de oraciones) | S | 2 |
| A3-04 | Índice de legibilidad: Szigriszt-Pazos (escala INFLESZ) y Fernández-Huerta | M | 2 |
| A3-05 | Repetición léxica dentro de una ventana (excluye palabras vacías) | M | 2 |
| A3-06 | Aviso de párrafos de una sola oración (cuando el perfil lo desaconseja) | C | 2 |
| A3-07 | Densidad de conectores por 100 palabras | S | 2 |
| A3-08 | Etiquetado manual de la idea central de cada párrafo y vista de hilo argumental | S | 2 |
| A3-09 | Oraciones consecutivas que empiezan con la misma palabra | S | 2 |
| A3-10 | Complejidad sintáctica aproximada (número de comas, subordinadas con *que*, incisos entre paréntesis) | C | 2 |
| A3-11 | Densidad de nominalizaciones (palabras en *-ción*, *-miento*, *-dad*) | C | 4 |
| A3-12 | Informe de métricas del documento (exportable) | S | 4 |

#### Plantillas de párrafo

Cada plantilla es un esqueleto con marcadores `[COMPLETAR: …]` y una colección de conectores sugeridos por posición (detalle en la sección 9.2). Familias:

1. **General:** idea central → desarrollo → cierre.
2. **Argumentativo (PEEL):** *Point* (afirmación) → *Evidence* (evidencia) → *Explanation* (explicación) → *Link* (enlace con la tesis).
3. **Jurídico (subsunción):** premisa normativa → premisa fáctica → subsunción → conclusión.
4. **Narrativo de hechos:** circunstancia temporal → hecho → consecuencia → prueba.
5. **Refutación:** tesis contraria → debilidad → contraargumento → norma o prueba que respalda.
6. **Transición:** cierre de la idea anterior → puente → anuncio de la siguiente.

#### Cómo funciona

**Segmentación de oraciones.** El segmentador propio:

- Separa por `.`, `?`, `!`, `…` seguidos de espacio y mayúscula o fin de párrafo.
- No corta tras abreviaturas de la tabla `abreviaturas` (*art.*, *arts.*, *inc.*, *núm.*, *fs.*, *Dr.*, *Sr.*, *Ud.*, *etc.*, *p. ej.*, *cfr.*, *op. cit.*, *pág.*, *vol.*, *ed.*, *Ltda.*, *S.A.*, *vs.*, entre otras) ni tras números con punto (`1.500`, `3.2.1`) ni en iniciales de nombres (`J. P. Pérez`).
- No corta dentro de citas entre comillas cuando el punto final está dentro de la cita y continúa la oración principal.

**Conteo de sílabas (para legibilidad).** Algoritmo por reglas, sin diccionario:

```
1. Normalizar a minúsculas; marcar vocales: fuertes (a, e, o, á, é, ó), débiles (i, u, ü), débiles tónicas (í, ú).
2. Agrupar vocales contiguas en "núcleos".
3. Dentro de cada núcleo, separar (hiato) cuando:
   - dos vocales fuertes contiguas (poeta → po-e-ta),
   - una débil tónica (í, ú) junto a una fuerte (día → dí-a, país → pa-ís),
   - una fuerte y una débil tónica (grúa → grú-a).
4. Mantener unidas (diptongo o triptongo): fuerte+débil átona (aire, rey), débil+fuerte (cuadro),
   débil+débil (ruido, cuidado), y secuencias débil+fuerte+débil (buey, averiguáis).
5. Tratar "y" final de palabra como vocal (rey, hoy). Tratar "h" intercalada como no separadora de diptongos por defecto
   (prohibir → prohi-bir), con excepciones en lista.
6. Número de sílabas = número de núcleos tras la separación de hiatos.
```

Meta de precisión: ≥ 98 % de conteos correctos sobre un corpus de 1 000 palabras verificadas, incluyendo casos difíciles (*aeropuerto*, *ahumado*, *búho*, *ruido*, *reír*, *guion*, *hielo*, *cuota*).

**Índices de legibilidad.**

- **Szigriszt-Pazos (INFLESZ):** `IFSZ = 206,835 − 62,3 × (S / P) − (P / F)`, donde `S` = sílabas, `P` = palabras, `F` = oraciones.

  | IFSZ | Interpretación |
  |---|---|
  | < 40 | Muy difícil |
  | 40 a 55 | Algo difícil |
  | 55 a 65 | Normal |
  | 65 a 80 | Bastante fácil |
  | > 80 | Muy fácil |

- **Fernández-Huerta:** `FH = 206,84 − 0,60 × P100 − 1,02 × F100`, donde `P100` = sílabas por cada 100 palabras y `F100` = oraciones por cada 100 palabras.

Se muestra el valor del documento y por párrafo. En textos jurídicos es normal obtener valores en la franja "algo difícil"; el perfil define un **objetivo** (por ejemplo, ≥ 45) y no una exigencia universal. Las fórmulas están orientadas a texto corrido: las tablas, listas y bloques de citas se excluyen del cálculo.

**Repetición léxica (A3-05).**

1. Se eliminan palabras vacías (artículos, preposiciones, conjunciones, pronombres, verbos auxiliares).
2. Se agrupan formas por raíz simple (heurística de truncamiento por sufijos comunes) o por lema si el usuario cargó una lista de lemas (opcional).
3. En una ventana deslizante (por defecto, 100 palabras), si una palabra aparece ≥ 3 veces, se genera una sugerencia con sinónimos del tesauro formal.
4. Los términos del glosario jurídico marcados `repetible: true` se omiten (en derecho, repetir el término técnico es correcto para evitar ambigüedad).

**Inicio de oración repetido (A3-09).** Se compara la primera palabra (normalizada) de oraciones consecutivas; ≥ 3 coincidencias seguidas generan una sugerencia.

**Complejidad (A3-10).** Puntaje = (comas × 1) + (subordinadas con *que* × 2) + (paréntesis × 2) + (palabras > umbral × 0,5). Solo orientativo, mostrado como "oración compleja" cuando supera un umbral por perfil.

**Etiquetado de idea central (A3-08).** Cada párrafo puede llevar una etiqueta corta (hasta 80 caracteres) escrita por el usuario. El panel izquierdo muestra el **hilo**: la secuencia de etiquetas. Párrafos sin etiqueta se muestran en gris; párrafos con etiquetas casi idénticas generan una sugerencia de fusión o de reformulación.

#### Interfaz

- Panel **Revisión → Métricas**: tarjetas con longitud media de oración, oraciones largas, legibilidad, repeticiones, densidad de conectores.
- Barra inferior con INFLESZ clicable.
- Resalte de oraciones largas (borde izquierdo ámbar) que se activa o desactiva.
- Menú contextual de párrafo: **Insertar esqueleto**, **Etiquetar idea central**.

#### Criterios de aceptación

- El segmentador no parte `art. 45 inc. 2` ni `Bs. 1.500,50` en oraciones distintas (casos de prueba).
- Las métricas del documento coinciden con una calculadora de referencia en ±1 punto sobre 10 textos de prueba.
- Una oración de 60 palabras genera alerta en el perfil jurídico con umbral por defecto de 35 palabras.
- Cambiar el perfil actualiza los umbrales y las alertas en menos de 1 s.

#### Límites conocidos

- Las métricas **no miden la calidad del razonamiento** ni la coherencia semántica; miden proxies (longitud, repetición, densidad). Se presentan como orientaciones.
- La legibilidad calculada por fórmulas penaliza los textos con terminología técnica inevitable.

---

### 5.4 Área 4 — Vocabulario y lenguaje formal

**Objetivo.** Elevar el registro, evitar coloquialismos y muletillas, y mantener consistencia terminológica, con una biblioteca de fórmulas y un glosario que el usuario controla.

#### Funcionalidades

| ID | Funcionalidad | Prior. | Fase |
|---|---|---|---|
| A4-01 | Tabla coloquial a formal, editable | M | 2 |
| A4-02 | Detector de muletillas y verbos débiles (*hacer*, *tener*, *poner*, *dar*, *cosa*) | S | 2 |
| A4-03 | Tesauro de sinónimos formales | S | 2 |
| A4-04 | Glosario jurídico propio (términos, definiciones del usuario, fuente, repetible) | M | 3 |
| A4-05 | Biblioteca de fórmulas por sección (verbos para citar normas, verbos de dicción, petitorios, cortesía) | M | 1-2 |
| A4-06 | Latinismos: lista con significado, cursiva automática, aviso de exceso | S | 2 |
| A4-07 | Pleonasmos y redundancias (*volver a reiterar*, *subir arriba*, *lapso de tiempo*) | S | 2 |
| A4-08 | Oralidad y abreviaturas de chat (*q*, *xq*, *tb*, contracciones coloquiales) | S | 2 |
| A4-09 | Frases burocráticas y clichés (*proceder a*, *en el día de la fecha*, *el mismo/dicho* en exceso) | C | 2 |
| A4-10 | Control de persona gramatical según perfil (impersonal vs. primera persona) | C | 2 |
| A4-11 | Consistencia terminológica: término preferente y variantes (por ejemplo, *la parte demandada* y no *el demandado*, o al revés) | S | 3 |
| A4-12 | Siglas: aviso cuando una sigla aparece sin definirse en su primera mención | S | 2 |

#### Cómo funciona

**Tabla coloquial a formal (A4-01).** Registros con la expresión coloquial, una o varias alternativas formales, el contexto de uso y el perfil. Ejemplos: *pero* (como conector inicial) → *no obstante*, *sin embargo*; *por culpa de* → *a causa de*, *debido a*; *cosa* → [término preciso]; *más o menos* → *aproximadamente*; *tener que* → *deber*, *corresponde*. El motor busca la expresión por coincidencia de frase completa y propone las alternativas.

**Muletillas y verbos débiles (A4-02).** Lista de verbos de bajo contenido semántico. El detector cuenta apariciones por 100 palabras y marca la oración cuando el verbo se repite por encima del umbral. Las alternativas provienen del tesauro (por ejemplo, *hacer* → *realizar*, *efectuar*, *elaborar*, *celebrar*, *constituir*, según el objeto).

**Tesauro formal (A4-03).** Registros `{lema, sinonimos[], registro, restricciones}`. Las restricciones indican combinaciones válidas (por ejemplo, *celebrar un contrato* sí, *celebrar una sentencia* no). El contenido se redacta de manera propia (no se copia de diccionarios con derechos).

**Glosario jurídico (A4-04) y consistencia (A4-11).**

- Cada término del glosario tiene `termino`, `definicion` (redactada por el usuario o por el equipo editorial), `fuente`, `variantes_aceptadas[]`, `variantes_a_evitar[]` y `repetible`.
- El detector de consistencia busca las variantes a evitar y sugiere el término preferente. También detecta que dos variantes aceptadas se usen mezcladas en un mismo documento, si el usuario activa "una sola denominación por concepto".

**Latinismos (A4-06).** Lista con forma, traducción, ejemplo y nivel de uso (frecuente, técnico, raro). Al insertar desde el panel, se aplica la marca `latinismo` (cursiva). Si la proporción de latinismos supera un umbral (por defecto, 3 cada 500 palabras en el perfil general; 8 en el procesal), se muestra una sugerencia y la alternativa en español cuando existe.

**Siglas (A4-12).** Se detectan secuencias de 2 a 6 mayúsculas. Si no están en la tabla de siglas conocidas, ni en el glosario, ni van precedidas o seguidas de su desarrollo entre paréntesis en su primera aparición, se emite un aviso: *"Sigla sin definir en su primera mención"*.

**Biblioteca de fórmulas (A4-05).** Fichas con `texto`, `seccion` (introductoria, narración, fundamento, prueba, petitorio, cierre), `tipo_escrito[]`, `jurisdiccion` y `variables` (por ejemplo, `{numero_articulo}`). Se insertan con un clic y los campos variables quedan como marcadores.

#### Interfaz

- Pestaña **Glosario** con sub-pestañas: Glosario jurídico, Tesauro, Coloquial → formal, Latinismos, Fórmulas.
- Editor de glosario con importación y exportación CSV y JSON.
- Alerta de coloquialismo con la alternativa propuesta y botón **Aplicar**.

#### Criterios de aceptación

- El usuario puede agregar, editar y borrar términos y reglas en la tabla coloquial→formal y los cambios se reflejan sin reiniciar.
- *a nivel de* y *a nivel nacional* se tratan distinto (excepción declarada).
- Las inserciones de latinismos quedan en cursiva y excluidas de la ortografía.
- El detector de consistencia encuentra el 100 % de las variantes declaradas "a evitar" en los textos de prueba.

#### Límites conocidos

- El sistema no distingue el **significado** de las palabras en contexto; las sugerencias de sinónimos son candidatos que el usuario debe validar.
- La calidad depende del contenido del tesauro y del glosario, que requieren revisión lingüística y jurídica humana (sección 13).

---

### 5.5 Área 5 — Estructura y organización documental

**Objetivo.** Que cada escrito tenga la estructura propia de su tipo, no falte ninguna sección obligatoria y el formato (numeración, notas, referencias, tabla de contenido) sea consistente y exportable.

#### Funcionalidades

| ID | Funcionalidad | Prior. | Fase |
|---|---|---|---|
| A5-01 | Plantillas por tipo de escrito (10 tipos base) | M | 1 (3), 4 (10) |
| A5-02 | Checklist de secciones obligatorias con detección automática por encabezado | M | 1 |
| A5-03 | Campos variables (partes, domicilios, fechas, montos, expediente) que se completan una vez y se replican | M | 1 |
| A5-04 | Marcadores `[COMPLETAR]` con nota, y panel de pendientes | M | 1 |
| A5-05 | Numeración multinivel (I., 1., a), i)) y cláusulas ordinales (PRIMERA, SEGUNDA…) | M | 1 |
| A5-06 | Tabla de contenido, encabezados y pies de página, numeración de páginas | M | 1 |
| A5-07 | Notas al pie | M | 1 |
| A5-08 | Referencias cruzadas (*véase el punto II*) con actualización automática | S | 3 |
| A5-09 | Márgenes, interlineado, fuente y tamaño de papel configurables por jurisdicción | M | 1 |
| A5-10 | Bloque de firmas y tabla de partes | S | 3 |
| A5-11 | Reordenar secciones arrastrando en el esquema | S | 3 |
| A5-12 | Importar `.docx` existentes | S | 4 |
| A5-13 | Exportar a `.docx`, `.pdf`, `.md`, `.txt` | M | 1 |
| A5-14 | Biblioteca de cláusulas y fragmentos reutilizables | S | 3 |
| A5-15 | Tamaños de papel (A4, carta, oficio/legal) y ajustes de impresión | S | 1 |
| A5-16 | Plantillas propias del usuario (guardar un documento como plantilla) | S | 3 |

#### Cómo funciona

**Plantilla de documento.** Un registro JSON con: tipo, jurisdicción, lista ordenada de **secciones** (id, título, obligatoriedad, contenido guía, esqueleto con marcadores, conectores y fórmulas sugeridos, número de sección y reglas de numeración), **campos variables** requeridos, **formato de página** y **perfil de estilo** por defecto (sección 6.4).

**Checklist de secciones (A5-02).** Cada sección obligatoria de la plantilla tiene un **detector**: se considera presente si existe un encabezado cuyo texto normalizado coincide con alguno de los títulos aceptados de esa sección (lista de sinónimos, por ejemplo "Petitorio", "Petición", "Solicitud"). El usuario puede marcar manualmente una sección como cumplida. Al exportar, las secciones obligatorias faltantes aparecen en el **modo lectura final**.

**Campos variables (A5-03).**

- Se definen en una tabla del documento: `{id, etiqueta, tipo, valor, formato}`. Tipos: texto, fecha, monto, lista de partes, número de expediente, domicilio.
- En el texto aparecen como nodos atómicos `campo_variable`. Cambiar el valor actualiza todas las apariciones.
- Los campos de tipo **fecha** y **monto** ofrecen formatos de salida (por ejemplo, fecha en letras; monto en cifras y en letras).
- Campos sin valor aparecen como pendientes.

**Numeración (A5-05).**

- Esquemas predefinidos: `I. → 1. → a) → i)`; `Capítulo I → Artículo 1 → Inciso a)`; `PRIMERA → SEGUNDA → …` para cláusulas.
- Conversión de números a ordinales en letras (primero a vigésimo y compuestos, con la forma configurable *décimo primero* o *undécimo*) y a romanos.
- La numeración se mantiene al reordenar secciones; las referencias cruzadas se actualizan.

**Notas al pie y referencias cruzadas (A5-07, A5-08).** Las notas se numeran de forma automática y se mapean a notas al pie reales de Word en la exportación. Las referencias cruzadas apuntan a identificadores estables de sección; si la sección se elimina, la referencia queda marcada como **rota** y aparece en la lista de pendientes.

**Formato por jurisdicción (A5-09).** El paquete de jurisdicción define fuente, tamaño, interlineado, márgenes, tamaño de papel y si se numeran las líneas o los folios. El usuario puede sobrescribirlos por documento.

**Importar .docx (A5-12).** Se usa conversión a HTML limpio, se mapean encabezados y listas a nodos del esquema y se informa qué elementos no pudieron conservarse (por ejemplo, cuadros de texto o campos de combinación complejos).

#### Interfaz

- Selector de tipo en la barra superior: al cambiar, ofrece **Aplicar plantilla** (documento nuevo) o **Solo cargar la checklist** (documento existente).
- Panel izquierdo: esquema + checklist con casillas.
- Panel **Variables** (accesible desde la barra superior): tabla editable de campos del documento.
- Panel de **Pendientes**: lista de `[COMPLETAR]`, campos vacíos, secciones obligatorias faltantes, referencias rotas.

#### Criterios de aceptación

- Cambiar el nombre de una parte en la tabla de variables actualiza todas las apariciones al instante.
- Una demanda sin sección de petitorio aparece con ese ítem en rojo en la checklist y en el modo lectura final.
- El `.docx` exportado conserva numeración multinivel, notas al pie y tabla de contenido, verificado al abrir en Word y LibreOffice.
- Reordenar una sección renumera automáticamente y actualiza las referencias cruzadas.

#### Límites conocidos

- La detección de secciones por encabezado depende de que el usuario respete los títulos (o los sinónimos definidos).
- La importación de `.docx` complejos puede perder formato (cuadros de texto, objetos incrustados).

---

### 5.6 Área 6 — Argumentación y razonamiento

**Objetivo.** Dar estructura al razonamiento: que cada tesis tenga premisas y evidencia, que se anticipen los contraargumentos, que cada hecho relevante esté vinculado a su prueba y a su fundamento legal, y que el usuario pueda revisar su texto contra una lista de falacias.

#### Funcionalidades

| ID | Funcionalidad | Prior. | Fase |
|---|---|---|---|
| A6-01 | Constructor guiado de argumento (tesis, premisas, evidencia, contraargumento, refutación, conclusión) | M | 3 |
| A6-02 | Fichas de tipos de argumento jurídico (14) | M | 3 |
| A6-03 | Matriz de contraargumentos | S | 3 |
| A6-04 | Cuadro hecho–prueba–norma con alertas de vacíos | M | 3 |
| A6-05 | Checklist de falacias (18 a 20 fichas) | S | 3 |
| A6-06 | Esquema de silogismo jurídico (norma, hecho, conclusión) | S | 3 |
| A6-07 | Mapa de agravios para recursos (agravio → norma violada → prueba → petición) | S | 3 |
| A6-08 | Volcado de las fichas al documento, con estructura y conectores sugeridos | M | 3 |
| A6-09 | Vista de estructura del argumento (esquema visual) | C | 5 |

#### Constructor guiado de argumento (A6-01)

Asistente de varios pasos. **Todo el contenido lo escribe el usuario**; el sistema solo da la estructura, las preguntas guía y los conectores típicos.

| Paso | Pregunta guía | Resultado |
|---|---|---|
| 1. Tesis | ¿Qué afirmo exactamente y qué pido? | Enunciado de una oración |
| 2. Premisa normativa | ¿Qué norma, principio o precedente sostiene mi tesis? (enlazable a la biblioteca de normas) | Una o más premisas con cita |
| 3. Premisa fáctica | ¿Qué hechos encajan en esa norma? | Hechos numerados |
| 4. Evidencia | ¿Con qué prueba acredito cada hecho? | Enlaces a pruebas (A6-04) |
| 5. Subsunción | ¿Por qué esos hechos caen bajo esa norma? | Razonamiento que une premisas |
| 6. Contraargumento | ¿Qué respondería la contraparte? | Enunciado del contraargumento |
| 7. Refutación | ¿Por qué ese contraargumento no prospera? | Respuesta con norma o prueba |
| 8. Conclusión | ¿Qué se sigue y qué se solicita? | Enunciado final |

**Volcado al texto (A6-08).** Cada ficha completada se convierte en un esqueleto de párrafos con los textos del usuario y conectores sugeridos entre pasos (por ejemplo, entre premisa normativa y fáctica, *en el presente caso*; antes de la conclusión, *en consecuencia*). El usuario elige cuáles insertar.

#### Fichas de tipos de argumento jurídico (A6-02)

Cada ficha contiene: **nombre**, **definición** (redacción propia), **cuándo usarlo**, **estructura**, **conectores típicos**, **riesgos y falacias asociadas**, **ejemplo genérico ficticio** y **checklist de control**.

| # | Argumento | Idea resumida | Conectores típicos |
|---|---|---|---|
| 1 | Literal o gramatical | El sentido natural de las palabras de la norma | *a tenor de*, *del tenor literal*, *conforme al sentido propio de las palabras* |
| 2 | Sistemático | La norma se interpreta en relación con el conjunto del ordenamiento | *de una lectura armónica*, *en concordancia con*, *en el marco de* |
| 3 | Teleológico | La finalidad (*ratio legis*) de la norma | *con miras a*, *en aras de*, *la finalidad perseguida* |
| 4 | Histórico | Antecedentes y evolución de la norma | *originalmente*, *con la reforma de*, *de los antecedentes* |
| 5 | A contrario sensu | Si la norma regula un supuesto, excluye el opuesto | *a contrario sensu*, *por el contrario*, *se sigue que no* |
| 6 | A fortiori | Si vale para lo menor, vale con mayor razón para lo mayor (o a la inversa) | *a mayor abundamiento*, *con mayor razón*, *a fortiori* |
| 7 | Por analogía (a pari, a simili) | Igual razón, igual solución | *por analogía*, *ubi eadem ratio*, *en el mismo sentido* |
| 8 | Reducción al absurdo | La tesis contraria conduce a un resultado inaceptable | *de aceptarse*, *conduciría a*, *resultaría absurdo* |
| 9 | De autoridad (doctrinal) | Apoyo en la doctrina autorizada | *la doctrina coincide*, *siguiendo a*, *en palabras de* |
| 10 | De precedente (jurisprudencial) | Apoyo en decisiones anteriores | *conforme al criterio*, *la línea jurisprudencial*, *ha sostenido reiteradamente* |
| 11 | De coherencia | Evita contradicciones con otras normas o decisiones | *en coherencia con*, *so pena de contradicción* |
| 12 | Consecuencialista | Consecuencias prácticas de cada interpretación | *de ello se seguiría*, *el efecto práctico*, *las consecuencias* |
| 13 | Principialista | Apoyo en principios generales o constitucionales | *al amparo del principio de*, *en virtud del principio* |
| 14 | De la voluntad del legislador | Intención del legislador según los trabajos preparatorios | *de los trabajos preparatorios*, *la intención del legislador* |

> El contenido de cada ficha debe ser redactado por el equipo editorial con revisión jurídica (sección 13). Los ejemplos son ficticios.

#### Matriz de contraargumentos (A6-03)

Tabla editable con columnas: **Afirmación de la contraparte** · **Tipo de debilidad** (fáctica, normativa, probatoria, lógica, procesal) · **Mi respuesta** · **Norma o prueba que respalda** · **Estado** (pendiente, redactada, insertada). Admite exportar como anexo o insertar la respuesta en el documento.

#### Cuadro hecho–prueba–norma (A6-04)

Cada fila relaciona un **hecho relevante**, la **prueba** que lo acredita (con referencia al expediente o anexo) y la **norma** que le da efecto jurídico (enlazada a la biblioteca). El sistema muestra alertas:

- Hecho sin prueba asociada.
- Pretensión (o petitorio) sin fundamento legal asociado.
- Prueba no vinculada a ningún hecho.
- Norma citada en el documento que no figura en el cuadro (informativo).

#### Checklist de falacias (A6-05)

Lista de revisión manual con: **nombre**, **definición**, **pregunta de control** y **ejemplo ficticio**. Familias:

| Familia | Ejemplos |
|---|---|
| De relevancia | Apelación a la emoción, a la compasión, a la tradición, a la novedad, a la ignorancia, *ad hominem*, *tu quoque*, hombre de paja, arenque rojo (desvío del tema) |
| De presunción | Petición de principio, cuestión compleja, falsa dicotomía, falsa analogía |
| De causalidad | *Post hoc ergo propter hoc*, falsa causa, pendiente resbaladiza |
| De generalización | Generalización apresurada, composición, división |
| De ambigüedad | Equívoco, anfibología, énfasis engañoso |
| De autoridad | Apelación a autoridad indebida (no pertinente o no verificable) |

El usuario recorre la checklist y marca "aplica / no aplica / revisar" por párrafo; el resultado se guarda en el documento y aparece en el modo lectura final.

#### Mapa de agravios (A6-07)

Para recursos: una tarjeta por agravio con **resolución impugnada (punto concreto)**, **norma o principio vulnerado**, **prueba o parte del expediente que lo evidencia**, **perjuicio concreto** y **petición**. Permite verificar que cada agravio está completo antes de redactar.

#### Interfaz

- Pestaña **Argumento** con vistas: *Asistente*, *Fichas*, *Contraargumentos*, *Hecho-Prueba-Norma*, *Falacias*, *Agravios*.
- Botón **Insertar en el documento** en cada vista, con vista previa del esqueleto y selección de bloques.
- Las fichas se pueden duplicar y personalizar.

#### Criterios de aceptación

- Completar el asistente genera un esqueleto con los textos del usuario en el orden correcto y con conectores sugeridos editables.
- El cuadro hecho-prueba-norma marca en rojo un hecho sin prueba y desaparece la marca al vincularla.
- Las fichas de argumento y de falacias son editables y exportables.
- Ninguna ficha genera contenido nuevo de manera automática: solo organiza lo que el usuario escribió.

#### Límites conocidos

- El sistema **no evalúa la solidez del argumento**; solo verifica que la estructura esté completa y que los enlaces existan.
- La detección de falacias es **manual** (checklist). Detectarlas automáticamente exigiría comprensión semántica.

---

### 5.7 Área 7 — Técnica jurídica, interpretación normativa y jurisprudencia

**Objetivo.** Permitir que el usuario cite normas y jurisprudencia con exactitud y formato uniforme, trabajar con su propia biblioteca verificada, aplicar listas de control de interpretación y controlar plazos, sin que el sistema invente contenido jurídico.

#### Funcionalidades

| ID | Funcionalidad | Prior. | Fase |
|---|---|---|---|
| A7-01 | Biblioteca de normas: importar TXT, HTML, DOCX y PDF con texto; indexar por artículo | M | 3 |
| A7-02 | **Insertar artículo**: copia el texto exacto del artículo con su cita formateada | M | 3 |
| A7-03 | Citador con formato uniforme (formatos configurables por jurisdicción) | M | 3 |
| A7-04 | Fichas de jurisprudencia (tribunal, sala, número, fecha, hechos, *ratio decidendi*, extracto, enlace) | M | 3 |
| A7-05 | Checklist de interpretación y de conflicto normativo | M | 3 |
| A7-06 | Calculadora de plazos configurable | S | 3 (básica), 5 (avanzada) |
| A7-07 | Ficha de caso, cronología procesal y documentos vinculados | S | 3 |
| A7-08 | Búsqueda en normas, fichas y glosario | M | 3 |
| A7-09 | Detección automática de citas en el texto (patrones configurables por jurisdicción) | M | 3 |
| A7-10 | Verificador de **cita textual**: compara un texto entre comillas con el artículo almacenado y marca diferencias | S | 3 |
| A7-11 | Versionado de normas cargadas (fecha de consulta, fuente, hash, nota de modificación) | S | 3 |
| A7-12 | Jerarquía normativa configurable (pirámide del ordenamiento) | S | 3 |
| A7-13 | Glosario de términos procesales y de institutos | S | 3 |

#### Biblioteca de normas (A7-01, A7-02, A7-11)

**Importación.**

1. El usuario carga el texto oficial de una norma (TXT, HTML, DOCX o PDF con texto) y completa la **ficha de la norma**: tipo, número, fecha de promulgación, órgano, jurisdicción, fuente (URL o publicación oficial), **fecha de consulta** y observaciones.
2. El **analizador de estructura** detecta artículos mediante patrones (configurables): `Artículo N`, `Art. N`, `ARTÍCULO N.-`, y también capítulos, títulos, secciones, incisos y numerales.
3. El resultado se muestra en un **árbol de estructura** para que el usuario corrija a mano lo que el analizador no detectó bien (esto es parte del flujo, no una excepción).
4. Se guarda el **hash** del texto importado y la fecha, para poder detectar cambios si se vuelve a importar la norma.

**Insertar artículo (A7-02).**

- Búsqueda por norma + número de artículo, o por palabras clave dentro del texto del artículo.
- El sistema inserta, a elección: (a) la **cita corta** (*art. 45 del Código X*), (b) el **texto textual** del artículo entre comillas con la marca `cita_textual`, o (c) ambos.
- El texto insertado es siempre el almacenado; el sistema **no reescribe ni resume**.
- La cita queda enlazada a la ficha (nodo `cita_normativa`): al pasar el cursor se ve el texto almacenado y su fecha de consulta.

**Verificador de cita textual (A7-10).** Compara (a nivel de palabra, con tolerancia opcional a mayúsculas y signos) el texto citado en el documento con el artículo almacenado. Marca omisiones, adiciones y cambios, y permite restituir el texto exacto con un clic.

**Importar normas (límites).** Los PDF escaneados no se procesan (no hay OCR). Los PDF con texto pueden traer cortes de línea y encabezados de página que el analizador limpia con reglas (eliminación de encabezados repetidos, unión de palabras partidas por guion de fin de línea) y un paso de revisión manual.

#### Citador con formato uniforme (A7-03)

Formulario por tipo de fuente que genera la cita siempre igual. Los formatos se definen en el paquete de jurisdicción mediante plantillas con variables.

| Tipo de fuente | Campos |
|---|---|
| Norma | Tipo, número, fecha, órgano, artículo, inciso, numeral, fuente oficial, fecha de consulta |
| Sentencia | Tribunal, sala, número, fecha, partes (si procede), considerando o fundamento, fuente |
| Doctrina (libro) | Autor, título, edición, editorial, lugar, año, página |
| Doctrina (artículo) | Autor, título, revista, volumen, número, año, páginas, enlace |
| Documento del expediente | Descripción, fojas o folio, fecha, anexo |

Ejemplo de plantilla de cita de norma (sintaxis de variables, ilustrativa):

```
{tipo} {numero}{, de fecha}{ fecha}, art. {articulo}{, inc. {inciso}}{, num. {numeral}}
```

#### Fichas de jurisprudencia (A7-04)

Campos: tribunal, sala, número o identificador, fecha, jurisdicción, materia, **hechos relevantes**, **cuestión jurídica**, ***ratio decidendi*** (redactada por el usuario), ***obiter dicta*** (opcional), **extracto textual** (con página o considerando), **fuente y enlace**, **estado** (verificada / pendiente), **notas de vigencia** (por ejemplo, "posible cambio de criterio posterior"), **etiquetas**. Las fichas pueden insertarse como cita corta, como extracto o como párrafo de precedente con esqueleto.

#### Checklist de interpretación y de conflicto normativo (A7-05)

Lista de verificación con explicaciones, para recorrer antes de afirmar que una norma aplica:

**1. Vigencia y aplicación en el tiempo**
- ¿La norma estaba vigente en la fecha de los hechos?
- ¿Hay reformas, derogaciones o disposiciones transitorias? (verificar fuente oficial)
- ¿Corresponde aplicación retroactiva o ultraactividad según el ordenamiento?

**2. Jerarquía y competencia**
- ¿Hay una norma de rango superior que prevalezca?
- ¿El órgano que dictó la norma era competente en la materia?

**3. Conflicto entre normas del mismo rango**
- Criterio cronológico: norma posterior sobre anterior.
- Criterio de especialidad: norma especial sobre general.
- Criterio de jerarquía.
- ¿Hay antinomia aparente o real? ¿Cuál criterio aplica y por qué?

**4. Interpretación**
- Literal o gramatical, sistemática, teleológica, histórica (cuando cabe).
- Principio *pro* aplicable (por ejemplo, *in dubio pro reo*, *pro operario*, *pro persona*, según la materia).
- Interpretación conforme a la Constitución y a tratados, si el ordenamiento lo exige.

**5. Integración**
- ¿Hay laguna? ¿Qué mecanismo de integración admite el ordenamiento (analogía, principios generales, costumbre)?

**6. Fuentes de verificación**
- ¿El texto citado coincide con la fuente oficial? ¿Fecha de consulta registrada?

El orden y el contenido exactos de la checklist se ajustan en el paquete de jurisdicción.

#### Calculadora de plazos (A7-06)

**Principio de diseño:** el sistema **no trae plazos legales fijos** (cambian y varían por materia y fuero). Trae un **motor de cómputo configurable**; el usuario o el paquete de jurisdicción definen los valores.

| Entrada | Descripción |
|---|---|
| Fecha de inicio | Notificación, publicación o el hecho que dispara el plazo |
| Cantidad y unidad | Días hábiles, días calendario, meses, años |
| Calendario | Feriados, días inhábiles, vacaciones o ferias judiciales y suspensiones definidos por el usuario o el paquete |
| Regla de inicio | El día de la notificación se cuenta o no; el plazo comienza al día siguiente hábil o no |
| Regla de vencimiento | Si vence en día inhábil, se prorroga al siguiente hábil o no; hora límite de presentación |
| Fuente del plazo | Texto libre para anotar la norma que lo fija (por ejemplo, artículo y norma) |

**Salida:** fecha de vencimiento, desglose día por día (con la razón de cada día excluido) y una advertencia fija: *"Calculado con las reglas configuradas. Verifique contra la norma aplicable y el calendario oficial."* Se guarda el historial de cálculos en la ficha del caso.

#### Ficha de caso (A7-07)

Campos: partes y representantes, número de expediente, órgano, materia y tipo de proceso, estado, **cronología procesal** (fecha, acto, documento vinculado, plazo derivado), documentos y escritos asociados, normas y sentencias del caso, notas. Se pueden generar alertas de plazos cercanos (notificaciones locales, si el usuario las activa).

#### Detección de citas en el texto (A7-09)

Patrones configurables por jurisdicción. Ejemplo ilustrativo de patrón genérico para citas de artículos:

```
(?<![\p{L}\p{N}])(arts?\.|artículos?)\s*\d+[A-Za-z]?(\s*(bis|ter|quater))?(\s*(inc\.|inciso|num\.|numeral|párr\.|párrafo)\s*[\dIVXa-z]+)*
```

Las citas detectadas se agregan al **verificador de citas** (Área 8); las que coinciden con una norma cargada se enlazan automáticamente, las demás quedan como "sin enlazar".

#### Interfaz

- Pestaña **Citas** con sub-secciones: *Normas*, *Jurisprudencia*, *Doctrina*, *Citador*, *Verificador*.
- Árbol de la norma a la izquierda y texto del artículo a la derecha, con botones **Insertar texto** / **Insertar cita**.
- Ficha de caso accesible desde la barra superior y desde el documento (si está vinculado).

#### Criterios de aceptación

- Insertar un artículo produce un texto idéntico (carácter por carácter) al almacenado.
- El verificador de cita textual detecta una palabra omitida o cambiada.
- La calculadora de plazos reproduce exactamente un conjunto de 20 casos de prueba definidos con un calendario de ejemplo (incluyendo vencimiento en inhábil y suspensión).
- Una norma importada puede corregirse a mano en su estructura y reindexarse.
- El sistema nunca presenta un artículo o una sentencia que el usuario no haya cargado.

#### Límites conocidos

- **Vigencia:** el sistema no puede saber si una norma sigue vigente ni si fue reformada. Solo ordena la verificación que hace el usuario.
- **Calidad de importación** de PDF con formato complejo. El árbol de estructura requiere revisión humana.
- **Plazos:** su exactitud depende por completo de la configuración cargada.

---

### 5.8 Área 8 — Revisión, verificación de fuentes y adaptación al tipo de escrito

**Objetivo.** Cerrar el ciclo de redacción con herramientas que ordenen la revisión, verifiquen consistencia y garanticen que el documento final esté completo, citado y adaptado a su tipo.

#### Funcionalidades

| ID | Funcionalidad | Prior. | Fase |
|---|---|---|---|
| A8-01 | Control de cambios (insertar/eliminar con autoría y fecha) | M | 4 |
| A8-02 | Comentarios en hilos | M | 4 |
| A8-03 | Historial de versiones con etiquetas y comparación entre versiones | M | 4 |
| A8-04 | **Verificador de citas** (tabla con estado, responsable, fecha y fuente) | M | 4 |
| A8-05 | Consistencia de nombres de partes y entidades | M | 4 |
| A8-06 | Consistencia de fechas (formato, cronología) y de montos | M | 4 |
| A8-07 | Conversor de cifras a letras y verificador cifra-letra | M | 4 |
| A8-08 | Referencias cruzadas rotas y numeración saltada | M | 4 |
| A8-09 | Perfiles de estilo por tipo de escrito | M | 2 (básicos), 4 (completos) |
| A8-10 | Modo lectura final (pendientes, alertas abiertas, citas sin verificar) | M | 4 |
| A8-11 | Informe de revisión exportable | S | 4 |
| A8-12 | Registro de fuente por dato (norma, URL, fecha de consulta, quién verificó) | S | 4 |
| A8-13 | Copias de seguridad y recuperación (`.scriptor`, autoguardado) | M | 1 (básica), 5 (completa) |
| A8-14 | Comparador de documentos (A vs. B) | S | 4 |
| A8-15 | Anonimización asistida por lista (reemplazo coherente de nombres por [PARTE A], [PARTE B]) | C | 5 |

#### Verificador de citas (A8-04)

1. Al abrir el panel (o antes de exportar), el sistema **extrae** del texto todas las citas detectadas (A7-09) y las menciones a normas, sentencias y doctrina enlazadas por nodos `cita_normativa`.
2. Arma una tabla con una fila por cita:

   | Columna | Descripción |
   |---|---|
   | Cita | Texto de la cita y ubicación en el documento |
   | Tipo | Norma, sentencia, doctrina, expediente |
   | Enlazada | Sí/No (a una ficha de la biblioteca) |
   | Texto coincide | Resultado del verificador de cita textual (si aplica) |
   | Estado | `pendiente`, `verificada`, `vigente`, `derogada/modificada`, `no encontrada` |
   | Verificó | Nombre o iniciales del usuario que verificó |
   | Fecha | Fecha de la verificación |
   | Fuente | URL o publicación consultada |
   | Nota | Observaciones |

3. El usuario actualiza el estado manualmente. **El sistema solo ordena la verificación; no la realiza.**
4. En el modo lectura final, las citas `pendiente` o `no encontrada` se muestran como advertencias.

#### Chequeos de consistencia (A8-05 a A8-08)

| Chequeo | Método |
|---|---|
| Nombres de partes | Lista de partes del documento (campos variables). Se comparan variantes del nombre mediante normalización (sin tildes, sin mayúsculas, sin puntuación) y distancia de edición; las apariciones no idénticas a la forma canónica se marcan para revisión |
| Fechas | Se detectan fechas en varios formatos (`12/03/2026`, `12 de marzo de 2026`) y se verifica: formato uniforme, fechas imposibles, orden cronológico en secciones que lo exigen (por ejemplo, cronología de hechos) |
| Montos | Se detectan cantidades con símbolo de moneda y se verifica formato y coherencia entre apariciones de un mismo monto |
| Cifra-letra | Para patrones como `1.500,00 (mil quinientos 00/100)`, se convierte la cifra a letras con el algoritmo del sistema y se compara con las letras escritas |
| Referencias cruzadas | Toda referencia apunta a un identificador existente; se avisa de las rotas |
| Numeración | Secuencia continua en listas, artículos, cláusulas y notas; se avisa de saltos o repeticiones |

**Algoritmo de cifras a letras (A8-07).** Reglas principales del español para implementarlo y probarlo:

- Unidades y decenas especiales: *diez, once, doce, trece, catorce, quince*; *dieciséis… diecinueve*; *veinte, veintiuno… veintinueve*; desde 31, *treinta y uno*, etc.
- Centenas: *cien* (exacto) / *ciento* (con resto); *quinientos*, *setecientos*, *novecientos* (formas irregulares); concordancia de género en las centenas (*doscientas libras*, *doscientos dólares*) y también ante *mil* (*doscientas mil libras*).
- Apócope de *uno* → *un* ante sustantivo masculino (*veintiún mil pesos*); *una* ante femenino.
- *Mil*: sin *un* delante (*mil*, no *un mil*), pero *dos mil*, *veintiún mil*.
- *Millón* y *millones* se escriben con *de* ante el sustantivo cuando no hay más cifras (*un millón de pesos*, pero *un millón doscientos mil pesos*).
- *Billón* equivale a 10¹² (escala larga).
- Moneda, género y fracción decimal (`00/100`) **configurables** en el paquete de jurisdicción.

Batería mínima de pruebas: ≥ 200 casos, incluyendo 0, 1, 15, 16, 21, 31, 100, 101, 500, 1 000, 1 001, 21 000, 100 000, 1 000 000, 1 000 001, 2 000 000, 1 500 000 000 y 1 000 000 000 000.

#### Perfiles de estilo (A8-09)

Cada perfil define qué reglas están activas, con qué severidad y qué umbrales se aplican (detalle en la sección 10). Cambiar de perfil actualiza las alertas al instante. Los perfiles son editables y duplicables.

#### Modo lectura final (A8-10)

Pantalla única que consolida, antes de exportar:

| Bloque | Contenido |
|---|---|
| Pendientes | `[COMPLETAR]`, campos variables vacíos |
| Estructura | Secciones obligatorias faltantes |
| Alertas abiertas | Por severidad, con acceso directo al punto del texto |
| Citas | Sin verificar, sin enlazar, con diferencias en el texto |
| Consistencia | Nombres, fechas, montos, cifras-letras, referencias y numeración |
| Argumentos | Hechos sin prueba, pretensiones sin fundamento, falacias marcadas "revisar" |
| Métricas | Legibilidad y oraciones largas respecto del objetivo del perfil |
| Plazos | Plazos próximos del caso vinculado |

Cada bloque muestra un semáforo (verde, ámbar, rojo). El usuario puede exportar con advertencias, pero el informe de revisión (A8-11) deja constancia de lo que quedó abierto.

#### Control de cambios, comentarios y versiones (A8-01 a A8-03, A8-14)

- **Control de cambios:** modo "Sugerencias" que registra inserciones y eliminaciones con autor y fecha; **Aceptar / Rechazar** por cambio o en bloque.
- **Comentarios:** hilos anclados a rangos de texto, con estado (abierto/resuelto).
- **Versiones:** instantáneas automáticas (por ejemplo, cada 10 minutos de actividad y al exportar) y manuales con etiqueta. Se conservan según una política de retención configurable.
- **Comparación:** diferencias a nivel de palabra entre dos versiones (con *diff-match-patch*), mostradas como inserciones y eliminaciones en línea.

#### Interfaz

- Pestaña **Revisión** (alertas y métricas) y pestaña **Citas → Verificador**.
- Botón **Lectura final** en la barra superior (con el contador de pendientes).
- Panel de **Versiones** y **Comentarios** accesible desde el menú del documento.

#### Criterios de aceptación

- El verificador de citas lista el 100 % de las citas del corpus de prueba y conserva el estado entre sesiones.
- El conversor de cifras a letras pasa los ≥ 200 casos de prueba.
- Un documento con un hecho sin prueba, un `[COMPLETAR]` y una cita pendiente muestra los tres en el modo lectura final.
- Comparar dos versiones muestra correctamente inserciones y eliminaciones a nivel de palabra.
- Los perfiles activan y desactivan reglas sin reiniciar.

#### Límites conocidos

- La **verificación de fuentes la hace la persona**: el sistema solo estructura el registro y sus estados.
- La consistencia de nombres es **aproximada** (variantes muy distintas, apodos o abreviaturas pueden no detectarse).
- El control de cambios y los comentarios están pensados para uso individual o por intercambio de archivos, no para coedición en tiempo real.

---

## 6. Modelo de datos

Todo el contenido del sistema se guarda como registros JSON con un **esquema validado** (JSON Schema + Ajv). Esto permite editar el contenido sin tocar el código, validarlo en integración continua, versionarlo en Git y distribuirlo en paquetes.

### 6.1 Convenciones generales

| Campo | Descripción |
|---|---|
| `id` | Identificador estable con prefijo por tipo y número (`C-0231`, `R-LOC-001`, `T-DEM-001`). Nunca se reutiliza un id eliminado |
| `version` | Versión semántica del registro o del paquete (`1.2.0`) |
| `estado` | `borrador`, `revisado`, `aprobado`, `obsoleto` |
| `idioma` | `es` por defecto; `es-XX` para variantes regionales |
| `jurisdiccion` | `null` (general) o código de jurisdicción |
| `fuente` | Referencia bibliográfica **de respaldo** (no se copia el texto de la fuente) |
| `creado_por`, `revisado_por`, `fecha` | Trazabilidad editorial |
| `notas_internas` | Comentarios para el equipo, no visibles al usuario final |

### 6.2 Regla de estilo

```json
{
  "id": "R-LOC-001",
  "familia": "locucion",
  "patron": "en base a",
  "tipo_patron": "frase",
  "flags": ["i"],
  "excepciones": [],
  "mensaje": "Locución incorrecta en el uso normativo recomendado.",
  "explicacion": "Se recomienda 'con base en' o 'sobre la base de'.",
  "sugerencias": ["con base en", "sobre la base de", "según"],
  "severidad": "error",
  "perfiles": ["general", "academico", "juridico-procesal", "resolucion", "contrato", "epistolar"],
  "preserva_mayuscula": true,
  "fuente": "Criterio de la norma panhispánica (consultar ficha editorial)",
  "casos_prueba": {
    "positivos": ["En base a lo expuesto, se resuelve.", "Se decide en base a los hechos."],
    "negativos": ["Con base en lo expuesto, se resuelve.", "La base a la que me refiero es sólida."]
  },
  "estado": "aprobado"
}
```

Tipos de patrón admitidos: `frase` (coincidencia literal con límites de palabra Unicode), `regex` (expresión con bandera `u`), `lista` (conjunto de formas) y `funcion` (referencia a una heurística programada, por ejemplo `signos_emparejados`).

### 6.3 Conector

```json
{
  "id": "C-0231",
  "texto": "no obstante",
  "forma_normalizada": "no obstante",
  "categoria": "CONTRASTIVO",
  "subcategoria": "adversativo",
  "funcion": "Introduce una idea que se opone o limita parcialmente la anterior sin anularla.",
  "ambito": ["general", "juridico"],
  "registro": "formal",
  "posicion": ["inicio", "medio"],
  "puntuacion": {
    "antes": ["punto", "punto_y_coma", "coma"],
    "despues": "coma",
    "nota": "Va entre comas cuando se intercala; tras punto o punto y coma si abre oración."
  },
  "tipos_escrito": ["demanda", "recurso", "sentencia", "dictamen", "ensayo", "informe"],
  "perfiles": ["general", "academico", "juridico-procesal", "resolucion"],
  "detectable": true,
  "requiere_pareja": false,
  "errores_comunes": ["Usarlo sin contraste real", "Omitir la coma posterior"],
  "sinonimos": ["C-0187", "C-0192", "C-0240"],
  "ejemplo": "El contrato fue firmado; no obstante, nunca se ejecutó.",
  "ejemplo_incorrecto": "El contrato fue firmado no obstante nunca se ejecutó.",
  "jurisdiccion": null,
  "estado": "aprobado"
}
```

**Par de conectores (relación entre dos registros):**

```json
{
  "id": "P-0012",
  "miembros": [
    { "texto": "si bien es cierto que", "rol": "apertura" },
    { "texto": "no es menos cierto que", "rol": "cierre" }
  ],
  "ventana_parrafos": 2,
  "ejemplo": "Si bien es cierto que el plazo venció, no es menos cierto que la notificación fue defectuosa."
}
```

### 6.4 Plantilla de documento

```json
{
  "id": "T-REC-001",
  "tipo": "recurso",
  "nombre": "Recurso (estructura base)",
  "jurisdiccion": null,
  "perfil_defecto": "juridico-procesal",
  "formato_pagina": {
    "papel": "A4", "margenes_cm": [2.5, 2.5, 3, 2.5],
    "fuente": "Times New Roman", "tamano_pt": 12, "interlineado": 1.5,
    "numeracion_paginas": true
  },
  "campos_requeridos": ["parte_recurrente", "autoridad", "expediente", "resolucion_impugnada", "fecha_notificacion"],
  "secciones": [
    {
      "id": "sec-identificacion",
      "titulo": "Identificación de la resolución impugnada",
      "titulos_aceptados": ["Resolución impugnada", "Acto recurrido", "Identificación"],
      "obligatoria": true,
      "orden": 1,
      "guia": "Identifique la resolución, su fecha, el órgano que la dictó y la fecha de notificación.",
      "esqueleto": "Mediante resolución de [COMPLETAR: fecha], notificada el [COMPLETAR: fecha de notificación], el [COMPLETAR: órgano] dispuso [COMPLETAR: contenido].",
      "categorias_conectores": ["JUR-INT", "JUR-HEC"],
      "formulas": ["F-0041", "F-0042"],
      "numeracion": "romano"
    }
  ],
  "checklist_extra": [
    "Verificar la tempestividad con la calculadora de plazos",
    "Verificar legitimación y competencia"
  ]
}
```

### 6.5 Plantilla de párrafo

```json
{
  "id": "PP-ARG-001",
  "nombre": "Argumentativo (PEEL)",
  "bloques": [
    { "rol": "afirmacion", "esqueleto": "[COMPLETAR: afirmación central]", "conectores": ["INT", "ENF"] },
    { "rol": "evidencia", "esqueleto": "[COMPLETAR: dato, norma o prueba]", "conectores": ["CAU", "JUR-PRU"] },
    { "rol": "explicacion", "esqueleto": "[COMPLETAR: por qué la evidencia respalda la afirmación]", "conectores": ["CNS", "REF"] },
    { "rol": "enlace", "esqueleto": "[COMPLETAR: relación con la tesis]", "conectores": ["CNL", "REC"] }
  ]
}
```

### 6.6 Ficha de tipo de argumento y de falacia

```json
{
  "id": "A-0006",
  "tipo": "argumento",
  "nombre": "A fortiori",
  "definicion": "(redacción propia del equipo editorial)",
  "cuando_usarlo": "(guía)",
  "estructura": ["Premisa mayor", "Premisa menor (el caso es más fuerte o más débil)", "Conclusión"],
  "conectores_tipicos": ["a mayor abundamiento", "con mayor razón", "a fortiori"],
  "riesgos": ["F-0004", "F-0012"],
  "ejemplo_ficticio": "(texto)",
  "checklist": ["¿La premisa mayor está respaldada por norma o precedente?", "¿La diferencia de grado es real y relevante?"]
}
```

```json
{
  "id": "F-0004",
  "tipo": "falacia",
  "nombre": "Generalización apresurada",
  "definicion": "(redacción propia)",
  "pregunta_control": "¿La muestra de casos o hechos es suficiente y representativa para la conclusión?",
  "ejemplo_ficticio": "(texto)"
}
```

### 6.7 Norma y artículo

```json
{
  "id": "N-00045",
  "tipo": "ley",
  "numero": "1234",
  "titulo": "(título de la norma)",
  "fecha_promulgacion": "2020-05-14",
  "organo": "(órgano emisor)",
  "jurisdiccion": "XX",
  "fuente": "(publicación oficial o URL)",
  "fecha_consulta": "2026-10-25",
  "hash_texto": "sha256:...",
  "nota_vigencia": "pendiente de verificación",
  "estructura": [
    { "tipo": "titulo", "id": "t1", "rotulo": "Título I", "hijos": ["cap1"] },
    { "tipo": "capitulo", "id": "cap1", "rotulo": "Capítulo I", "hijos": ["a1", "a2"] }
  ]
}
```

```json
{
  "id": "N-00045/a1",
  "normaId": "N-00045",
  "numero": "1",
  "rotulo": "Artículo 1",
  "epigrafe": "(si lo hay)",
  "texto": "(texto exacto cargado por el usuario)",
  "incisos": [ { "id": "i1", "rotulo": "I.", "texto": "..." } ],
  "revisado_manualmente": true
}
```

### 6.8 Ficha de jurisprudencia

```json
{
  "id": "J-00312",
  "tribunal": "(tribunal)",
  "sala": "(sala)",
  "numero": "(identificador)",
  "fecha": "2024-03-18",
  "materia": "civil",
  "hechos": "(resumen del usuario)",
  "cuestion_juridica": "(texto)",
  "ratio_decidendi": "(redacción del usuario)",
  "extractos": [ { "texto": "(texto exacto)", "ubicacion": "considerando 5" } ],
  "fuente": "(URL o publicación)",
  "estado_verificacion": "pendiente",
  "nota_vigencia": "",
  "etiquetas": ["prescripción", "notificación"]
}
```

### 6.9 Ficha de caso y evento procesal

```json
{
  "id": "K-0007",
  "expediente": "(número)",
  "organo": "(órgano)",
  "materia": "(materia)",
  "partes": [ { "rol": "demandante", "nombre": "(nombre)", "representante": "(nombre)" } ],
  "estado": "en trámite",
  "cronologia": [
    {
      "fecha": "2026-09-30",
      "acto": "Notificación de la resolución",
      "documento": "doc-0045",
      "plazo": { "cantidad": 5, "unidad": "dias_habiles", "vence": "2026-10-07", "fuente": "(norma que fija el plazo)" }
    }
  ],
  "documentos": ["doc-0045"],
  "normas": ["N-00045"],
  "jurisprudencia": ["J-00312"]
}
```

### 6.10 Cita y verificación

```json
{
  "id": "V-000981",
  "documentoId": "doc-0045",
  "texto_cita": "art. 45 de la Ley 1234",
  "tipo": "norma",
  "enlace": "N-00045/a45",
  "ubicacion": { "bloque": 37, "desde": 112, "hasta": 135 },
  "texto_coincide": true,
  "estado": "verificada",
  "verifico": "Iniciales",
  "fecha_verificacion": "2026-10-25",
  "fuente_consultada": "(URL o publicación)",
  "nota": ""
}
```

### 6.11 Hecho, prueba y norma

```json
{
  "id": "H-0021",
  "documentoId": "doc-0045",
  "hecho": "El contrato fue suscrito el 12 de marzo de 2026.",
  "pruebas": [ { "id": "PR-0003", "descripcion": "Contrato original", "ubicacion": "Anexo 2, fs. 5-9" } ],
  "normas": [ "N-00045/a3" ],
  "pretension_relacionada": "Declaratoria de incumplimiento",
  "estado": "completo"
}
```

### 6.12 Término del glosario

```json
{
  "id": "G-0105",
  "termino": "litisconsorcio",
  "definicion": "(redacción propia o del usuario)",
  "variantes_aceptadas": ["litis consorcio"],
  "variantes_a_evitar": [],
  "repetible": true,
  "fuente": "(referencia)",
  "ambito": "procesal"
}
```

### 6.13 Calendario y cómputo de plazos

```json
{
  "id": "CAL-XX-2026",
  "jurisdiccion": "XX",
  "anio": 2026,
  "dias_habiles_semana": [1, 2, 3, 4, 5],
  "feriados": [ { "fecha": "2026-01-01", "nombre": "Año Nuevo" } ],
  "periodos_inhabiles": [ { "desde": "2026-07-01", "hasta": "2026-07-15", "motivo": "(descripción)" } ],
  "reglas": {
    "contar_dia_de_notificacion": false,
    "prorroga_si_vence_en_inhabil": true,
    "hora_limite": "16:00"
  }
}
```

### 6.14 Perfil de estilo

```json
{
  "id": "PERF-JURPROC",
  "nombre": "Jurídico-procesal",
  "reglas": {
    "familias_activas": ["ortografia", "locucion", "tipografia", "dequeismo", "jur", "pleonasmo", "registro"],
    "overrides": [ { "id": "R-LOC-003", "severidad": "sugerencia" }, { "id": "R-REG-010", "activa": false } ]
  },
  "umbrales": {
    "oracion_max_palabras": 45,
    "parrafo_max_palabras": 220,
    "legibilidad_objetivo_inflesz": 45,
    "latinismos_por_500_palabras": 8,
    "ventana_repeticion_palabras": 100,
    "ventana_conectores_parrafos": 2
  },
  "persona_gramatical": "impersonal",
  "estilo_comillas": "angulares"
}
```

### 6.15 Alerta (estructura interna)

```json
{
  "id": "al-7f3a",
  "documentoId": "doc-0045",
  "ruleId": "R-LOC-001",
  "rango": { "desde": 1204, "hasta": 1213 },
  "contexto_hash": "9c1d...",
  "severidad": "error",
  "mensaje": "Locución incorrecta en el uso normativo recomendado.",
  "sugerencias": ["con base en", "sobre la base de", "según"],
  "estado": "abierta"
}
```

Estados: `abierta`, `aplicada`, `ignorada_una_vez`, `ignorada_documento`, `regla_desactivada`.

### 6.16 Manifiesto de paquete de contenido

```json
{
  "id": "core-es",
  "nombre": "Paquete base en español",
  "version": "1.0.0",
  "compatible_con": ">=1.0.0 <2.0.0",
  "jurisdiccion": null,
  "licencia": "(licencia del contenido)",
  "contenido": {
    "conectores": "connectors/*.json",
    "reglas": "rules/*.json",
    "plantillas": "templates/*.json",
    "glosario": "glossary/*.json",
    "argumentos": "arguments/*.json"
  },
  "checksums": { "connectors/general.json": "sha256:..." },
  "changelog": "CHANGELOG.md"
}
```

---

## 7. Catálogo inicial de reglas de estilo

Esta sección lista el **punto de partida** de reglas para la fase 2 (aproximadamente 70 reglas de las 150 a 250 de la meta). Cada regla se implementa como registro (sección 6.2) con sus casos de prueba. Las sugerencias se redactan para que el usuario decida; **ninguna se aplica sola**.

**Notación:** *Sev.* = severidad (`E` error, `A` aviso, `S` sugerencia). Los patrones se escriben en su forma legible; el motor los compila con límites de palabra Unicode (sección 3.4).

### 7.1 Identificadores y familias

| Familia | Prefijo | Contenido |
|---|---|---|
| Ortografía | `R-ORT-` | Delegada principalmente al diccionario; reglas específicas adicionales |
| Locuciones y usos | `R-LOC-` | Locuciones incorrectas o desaconsejadas |
| Queísmo y dequeísmo | `R-DEQ-` | Régimen preposicional de verbos y locuciones |
| Tipografía | `R-TIP-` | Espacios, signos, comillas, rayas, números |
| Mayúsculas | `R-MAY-` | Uso de mayúsculas y minúsculas |
| Tildes | `R-TIL-` | Acentuación de uso frecuente |
| Pleonasmos | `R-PLE-` | Redundancias |
| Registro | `R-REG-` | Oralidad, coloquialismos, abreviaturas de chat |
| Jurídico | `R-JUR-` | Estilo y técnica de redacción jurídica |
| Cohesión | `R-COH-` | Longitud, repetición, densidad (basadas en métricas) |

### 7.2 Locuciones y usos (`R-LOC-`)

| ID | Detecta | Sugerencia | Sev. | Notas |
|---|---|---|---|---|
| R-LOC-001 | *en base a* | *con base en*; *sobre la base de*; *según* | E | |
| R-LOC-002 | *dentro del marco de* | *en el marco de* | A | |
| R-LOC-003 | *a nivel de* | *en el ámbito de*; *en materia de*; *respecto de* | S | Excepción: *a nivel nacional/regional/local/mundial* y *a nivel del mar* |
| R-LOC-004 | *de acuerdo a* | *de acuerdo con*; *conforme a* | A | |
| R-LOC-005 | *en relación a* | *en relación con*; *con relación a* | A | |
| R-LOC-006 | *sobretodo* | *sobre todo* | E | |
| R-LOC-007 | *a cerca de* | *acerca de* | A | Revisar: *a cerca de* es válido si *cerca* es adverbio de lugar |
| R-LOC-008 | *haber si*; *ha ver* | *a ver si*; *a ver* | E | |
| R-LOC-009 | *pero sin embargo* | *pero*; *sin embargo* | A | Redundancia de dos adversativos |
| R-LOC-010 | *en el día de la fecha* | *hoy*; *en esta fecha* | S | Fórmula burocrática |
| R-LOC-011 | *bajo el punto de vista* | *desde el punto de vista* | A | |
| R-LOC-012 | *a grosso modo* | *grosso modo*; *a grandes rasgos* | E | |
| R-LOC-013 | *en la medida que* | *en la medida en que* | A | |
| R-LOC-014 | *hubieron* (como impersonal); *habían habido* | *hubo*; *había habido* | A | Excepción: *hubieron de* + infinitivo |
| R-LOC-015 | *más mejor*; *más peor*; *más mayor*; *más menor* | *mejor*; *peor*; *mayor*; *menor* | E | |
| R-LOC-016 | *detrás mío*; *delante mío*; *encima mío*; *cerca mío* | *detrás de mí*; *delante de mí*… | A | Registro formal |
| R-LOC-017 | *con respecto de* | *con respecto a* | S | Variante menos habitual |
| R-LOC-018 | *a la brevedad posible* usado como orden vaga | *en el plazo de [COMPLETAR]* | S | Solo en perfil jurídico, como recordatorio de precisión |
| R-LOC-019 | *tratar de que* con verbo en subjuntivo (estructura dudosa) | Revisar régimen | S | Heurística |
| R-LOC-020 | *a parte* (cuando no precede a sustantivo) | *aparte* | A | Revisión manual (A1-12) |

### 7.3 Queísmo y dequeísmo (`R-DEQ-`)

**Dequeísmo** (sobra *de* antes de *que*), con la lista de verbos que **no** llevan *de*: *pensar, creer, opinar, decir, afirmar, sostener, considerar, manifestar, señalar, indicar, expresar, declarar, establecer, resolver*. Se excluyen a propósito verbos como *informar* o *advertir*, que sí admiten *de que* (*informó de que…*), para evitar falsos positivos.

| ID | Patrón | Sugerencia | Sev. |
|---|---|---|---|
| R-DEQ-001 | `{verbo de la lista} + de que` (por ejemplo, *pienso de que*, *sostuvo de que*) | Eliminar *de* | A |
| R-DEQ-002 | *es posible de que*; *es probable de que*; *es necesario de que* | Eliminar *de* | A |
| R-DEQ-003 | *resulta de que*, *consiste de que* | *resulta que*; *consiste en que* | A |

**Queísmo** (falta *de* ante *que*) en construcciones que lo exigen.

| ID | Patrón | Sugerencia | Sev. |
|---|---|---|---|
| R-DEQ-010 | *me alegro que*; *se alegró que* | *me alegro de que* | A |
| R-DEQ-011 | *darse cuenta que* (todas las formas) | *darse cuenta de que* | A |
| R-DEQ-012 | *acordarse que*; *olvidarse que* | *acordarse de que*; *olvidarse de que* | A |
| R-DEQ-013 | *estar seguro que*; *tener la certeza que* | *estar seguro de que*; *tener la certeza de que* | A |
| R-DEQ-014 | *a pesar que* | *a pesar de que* | A |
| R-DEQ-015 | *con el objeto que*; *con la finalidad que* | *con el objeto de que*; *con la finalidad de que* | A |
| R-DEQ-016 | *debido que* | *debido a que* | A |

> Todas las reglas de esta familia se lanzan como **aviso** con la nota "revise el régimen preposicional del verbo".

### 7.4 Tipografía y signos (`R-TIP-`)

| ID | Detecta | Sugerencia | Sev. |
|---|---|---|---|
| R-TIP-001 | Dos o más espacios seguidos | Un solo espacio | A |
| R-TIP-002 | Espacio antes de `, . ; : ) ] ! ?` | Eliminar el espacio | A |
| R-TIP-003 | Falta de espacio tras `, ; :` (si va seguido de letra) y tras `.` (si va seguido de mayúscula y no es abreviatura, decimal, URL ni sigla) | Insertar espacio | A |
| R-TIP-004 | Espacio tras `(` o `[`, o antes de `)` o `]` | Eliminar el espacio | A |
| R-TIP-005 | *etc...*; *y etc.*; *etc* sin punto | *etc.*; *etc.* | A |
| R-TIP-006 | Cuatro o más puntos; dos puntos seguidos | `...` o `…` según el ajuste del usuario | A |
| R-TIP-007 | Comillas rectas `"…"` o mezcla de estilos | Comillas angulares «…» o inglesas “…” (según perfil) | S |
| R-TIP-008 | Signos de apertura o cierre sin pareja (`¿?`, `¡!`, paréntesis, corchetes, comillas) | Mostrar el signo huérfano | E |
| R-TIP-009 | Guion corto `-` con espacios usado como raya | Raya `—` | S |
| R-TIP-010 | Porcentaje pegado (`10%`) | `10 %` (con espacio fino o normal) | S |
| R-TIP-011 | `hrs`, `hrs.`, `h.` en horas | `h` (por ejemplo, `16:30 h`) | S |
| R-TIP-012 | Coma antes o después de conectores según la ficha (`sin embargo`, `no obstante`, `es decir`, etc.) | Insertar la coma que falta | A |
| R-TIP-013 | Mezcla de formatos de fecha en el documento | Unificar el formato | A |
| R-TIP-014 | `Nº`, `N°`, `Num.`, `Núm` sin uniformidad | Usar una sola forma (configurable: *núm.*, *n.º*, *N.°*) | S |
| R-TIP-015 | Doble signo de puntuación (`,,`, `;;`, `..`) | Eliminar el sobrante | A |
| R-TIP-016 | Salto de línea manual dentro de un párrafo | Unir o crear nuevo párrafo | S |

### 7.5 Mayúsculas (`R-MAY-`) y tildes (`R-TIL-`)

| ID | Detecta | Sugerencia | Sev. |
|---|---|---|---|
| R-MAY-001 | Días de la semana con mayúscula inicial en medio de oración | Minúscula | A |
| R-MAY-002 | Meses con mayúscula inicial en medio de oración | Minúscula | A |
| R-MAY-003 | Oración que empieza con minúscula tras punto | Mayúscula | A |
| R-MAY-004 | Cargos y tratamientos según la tabla configurable (por ejemplo, *Juez* tras artículo y sin nombre propio) | Ajustar según la tabla | S |
| R-MAY-005 | Palabras en MAYÚSCULAS sostenidas fuera de títulos y encabezados | Revisar | S |
| R-TIL-001 | *sólo* | *solo* | S |
| R-TIL-002 | *éste, ésta, éstos, ése, ésa, aquél…* | *este, esta, ese, aquel…* | S |
| R-TIL-003 | *guión*; *fué*; *fuí*; *vió*; *dió* | *guion*; *fue*; *fui*; *vio*; *dio* | A |
| R-TIL-004 | *truhán*; *fié*; *crió*; *riáis* y otros monosílabos o voces con tilde indebida de la lista | *truhan*; *fie*; *crio*; *riais* | A |

### 7.6 Pleonasmos y redundancias (`R-PLE-`)

| ID | Detecta | Sugerencia | Sev. |
|---|---|---|---|
| R-PLE-001 | *volver a reiterar* | *reiterar* | A |
| R-PLE-002 | *subir arriba*; *bajar abajo*; *salir afuera*; *entrar adentro* | *subir*; *bajar*; *salir*; *entrar* | A |
| R-PLE-003 | *lapso de tiempo* | *lapso*; *periodo* | S |
| R-PLE-004 | *totalmente completo*; *completamente lleno* | *completo*; *lleno* | S |
| R-PLE-005 | *prever con antelación* | *prever* | S |
| R-PLE-006 | *accidente fortuito* | *accidente* | S |
| R-PLE-007 | *resumir brevemente* | *resumir* | S |
| R-PLE-008 | *hacer mención de* | *mencionar* | S |
| R-PLE-009 | *aunque sin embargo*; *pero no obstante* | Un solo conector | A |
| R-PLE-010 | *en la actualidad de hoy en día* y similares (lista editable) | Una sola expresión temporal | S |

### 7.7 Registro: oralidad y coloquialismos (`R-REG-`)

| ID | Detecta | Sugerencia | Sev. |
|---|---|---|---|
| R-REG-001 | *q*, *xq*, *pq*, *tb*, *tmb*, *dnd*, *pa* (abreviaturas de chat) | Forma completa | A |
| R-REG-002 | *o sea* (en perfiles formales) | *es decir*; *esto es* | S |
| R-REG-003 | *más o menos* | *aproximadamente* | S |
| R-REG-004 | *por culpa de* (sin carga negativa) | *a causa de*; *debido a* | S |
| R-REG-005 | *tener que* + infinitivo en perfil normativo | *deber*; *corresponde* | S |
| R-REG-006 | *cosa(s)* | Término preciso (abre la tabla coloquial→formal) | S |
| R-REG-007 | *un montón de*; *un poco de*; *bastante* (cantidad vaga) | *numerosos*; *cierto número de*; cifra exacta | S |
| R-REG-008 | Contracciones y apócopes coloquiales (*pa'*, *na'*) | Forma completa | A |
| R-REG-009 | Signos de exclamación repetidos (`!!`) | Un solo signo | A |
| R-REG-010 | Primera persona (*yo, nosotros, mi, nuestro*) en perfiles impersonales | Revisar construcción impersonal | S |

### 7.8 Estilo y técnica jurídica (`R-JUR-`)

| ID | Detecta | Sugerencia | Sev. |
|---|---|---|---|
| R-JUR-001 | *el mismo*, *la misma*, *los mismos*, *las mismas* como pronombre anafórico (por ejemplo, *se notificó el mismo*) | Pronombre personal o repetir el sustantivo | A |
| R-JUR-002 | *dicho/a/os/as* más de 3 veces por cada 200 palabras | Variar: *aquel*, *el citado*, artículo definido | S |
| R-JUR-003 | *proceder a* + infinitivo (*se procede a notificar*) | Verbo directo (*se notifica*) | S |
| R-JUR-004 | Gerundio tras coma que pueda indicar posterioridad (`,` + *-ando/-iendo/-yendo*) | Reformular con verbo conjugado o *y luego* | S |
| R-JUR-005 | Latinismo sin cursiva (de la lista de latinismos) | Aplicar la marca `latinismo` | S |
| R-JUR-006 | Secuencia de otrosíes incompleta (*segundo otrosí* sin *primer otrosí*) | Revisar el orden | A |
| R-JUR-007 | Mezcla de *art.* y *artículo* en el mismo documento | Unificar | S |
| R-JUR-008 | Cita de norma incompleta (sin número, fecha o nombre según el formato de la jurisdicción) | Completar con el citador | A |
| R-JUR-009 | *toda vez que* o *por cuanto* más de 2 veces por cada 300 palabras | Variar con otros causales | S |
| R-JUR-010 | Sección *Considerando* o *Resultando* con numeración discontinua | Revisar numeración | A |
| R-JUR-011 | Tratamiento procesal inconsistente (*Su Señoría*, *Vuestra Autoridad*, *honorable tribunal*) según el paquete | Unificar | S |
| R-JUR-012 | Petitorio sin verbos de solicitud (*solicito*, *pido*, *ruego*, *se sirva*) | Revisar redacción del petitorio | S |

### 7.9 Cohesión (`R-COH-`, basadas en métricas)

| ID | Detecta | Sev. |
|---|---|---|
| R-COH-001 | Oración que supera el umbral del perfil | S |
| R-COH-002 | Párrafo que supera el umbral de palabras o de oraciones | S |
| R-COH-003 | Palabra repetida ≥ 3 veces en la ventana (excluye términos repetibles del glosario) | S |
| R-COH-004 | Tres oraciones consecutivas con la misma palabra inicial | S |
| R-COH-005 | Mismo conector en párrafos consecutivos | S |
| R-COH-006 | Párrafo largo sin ningún conector | S |
| R-COH-007 | Desequilibrio de categorías de conectores | S |
| R-COH-008 | Legibilidad del documento por debajo del objetivo del perfil | S |
| R-COH-009 | Párrafo de una sola oración (en perfiles que lo desaconsejan) | S |
| R-COH-010 | Oración compleja (puntaje por encima del umbral) | S |

### 7.10 Ejemplos de reglas en formato máquina

```json
[
  {
    "id": "R-DEQ-001",
    "familia": "dequeismo",
    "tipo_patron": "regex",
    "patron": "(?<![\\p{L}])(pienso|pensamos|creo|creemos|opino|opinamos|dijo|dijeron|afirmó|afirmaron|sostuvo|sostuvieron|señaló|señalaron|manifestó|manifestaron|indicó|indicaron|declaró|declararon)\\s+de\\s+que(?![\\p{L}])",
    "flags": ["iu"],
    "mensaje": "Posible dequeísmo: este verbo no suele llevar la preposición 'de' ante 'que'.",
    "sugerencias": ["$1 que"],
    "severidad": "aviso"
  },
  {
    "id": "R-DEQ-011",
    "familia": "dequeismo",
    "tipo_patron": "regex",
    "patron": "(?<![\\p{L}])(me di|se dio|se dieron|nos dimos|darse|dar)\\s+cuenta\\s+que(?![\\p{L}])",
    "flags": ["iu"],
    "mensaje": "Posible queísmo: 'darse cuenta' lleva 'de' ante 'que'.",
    "sugerencias": ["$1 cuenta de que"],
    "severidad": "aviso"
  },
  {
    "id": "R-TIP-003",
    "familia": "tipografia",
    "tipo_patron": "regex",
    "patron": "(?<=[\\p{L}]),(?=[\\p{L}])",
    "flags": ["u"],
    "excepciones_contexto": ["url", "numero_decimal", "campo_variable"],
    "mensaje": "Falta un espacio después de la coma.",
    "sugerencias": [", "],
    "severidad": "aviso"
  },
  {
    "id": "R-JUR-004",
    "familia": "juridico",
    "tipo_patron": "regex",
    "patron": ",\\s*\\p{L}+(ando|iendo|yendo)(?![\\p{L}])",
    "flags": ["iu"],
    "mensaje": "Gerundio tras coma: revise si expresa una acción posterior (uso desaconsejado).",
    "sugerencias": [],
    "severidad": "sugerencia"
  },
  {
    "id": "R-MAY-002",
    "familia": "mayusculas",
    "tipo_patron": "funcion",
    "funcion": "mes_en_mayuscula_no_inicial",
    "mensaje": "Los nombres de los meses se escriben con minúscula inicial.",
    "severidad": "aviso"
  }
]
```

### 7.11 Gestión del ciclo de vida de una regla

1. **Propuesta** (con ejemplos, fuente de respaldo y severidad sugerida).
2. **Redacción** del registro y de **≥ 5 casos positivos y ≥ 5 negativos**.
3. **Pruebas automáticas**: el patrón debe detectar todos los positivos y ninguno de los negativos.
4. **Calibración** sobre un corpus de textos reales (mide falsos positivos). Si superan el 15 %, se degrada a `sugerencia`, se agregan excepciones o se retira.
5. **Revisión editorial** (lingüística y, si es `R-JUR-`, jurídica) y paso a `aprobado`.
6. **Seguimiento**: si los usuarios la ignoran o desactivan con frecuencia (contador local, visible solo para el propio usuario), se revisa en la siguiente versión.

---

## 8. Catálogo de conectores: taxonomía y producción del dataset

Esta sección define cómo organizar las listas de conectores y marcadores que ya reunimos (general y jurídica) en un dataset estructurado, buscable y mantenible. Es el **activo de contenido más importante** del sistema.

### 8.1 Taxonomía de categorías

**Ámbito general**

| Código | Categoría | Subcategorías | Registros estimados |
|---|---|---|---|
| INT | Introductores y apertura | inicio, propósito del texto, tema nuevo, planteamiento del problema, contexto | 40 |
| ORD | Ordenadores | apertura, continuación, cierre de secuencia, por bloques | 35 |
| ADI | Aditivos | suma simple, refuerzo, misma línea | 45 |
| ADV | Contrastivos y adversativos | oposición, restricción, contraste | 45 |
| CNC | Concesivos | concesión, concesión reforzada | 35 |
| CAU | Causales | causa, razón, fundamento | 50 |
| CNS | Consecutivos | consecuencia, deducción | 45 |
| CND | Condicionales e hipotéticos | condición, supuesto, salvedad | 45 |
| FIN | Finales | propósito, finalidad | 20 |
| TMP | Temporales | anterioridad, simultaneidad, posterioridad, frecuencia, inmediatez | 50 |
| ESP | Espaciales | ubicación, orientación | 20 |
| CMP | Comparativos y analógicos | semejanza, diferencia, analogía | 30 |
| EJE | Ejemplificativos | ejemplo, ilustración, enumeración | 25 |
| REF | Reformuladores y explicativos | explicación, rectificación, precisión | 35 |
| ENF | Enfáticos y de refuerzo | destacar, confirmar, realzar | 45 |
| DIG | Digresivos y de retorno | digresión, retorno | 15 |
| OPI | Posicionamiento y opinión | personal, impersonal | 25 |
| CER | Certeza, probabilidad y atenuación | certeza, probabilidad, atenuación | 40 |
| REC | Recapitulación | resumen, retoma | 20 |
| CNL | Conclusivos y de cierre | conclusión, cierre | 35 |

**Ámbito jurídico**

| Código | Categoría | Subcategorías | Registros estimados |
|---|---|---|---|
| JUR-INT | Introductores de escritos y resoluciones | encabezado, presentación, objeto, antecedentes, identificación del acto | 30 |
| JUR-HEC | Narración de hechos | hechos, circunstancias, constancia | 35 |
| JUR-NOR | Fundamento normativo | conformidad, amparo, aplicación, verbos para citar normas | 50 |
| JUR-JUR | Jurisprudencia y doctrina | precedente, línea jurisprudencial, doctrina | 35 |
| JUR-PRU | Fundamento probatorio | valoración, acreditación, carga | 40 |
| JUR-ARG | Argumentación e inferencia | premisa, inferencia, refuerzo, lógicos, interpretación | 50 |
| JUR-OPO | Oposición, salvedad y contraargumentación | oposición, salvedad, rechazo del argumento contrario | 45 |
| JUR-CND | Condición y salvedad procesal | supuesto, apercibimiento | 25 |
| JUR-CNS | Consecuencia y conclusión lógica | consecuencia, procedencia | 35 |
| JUR-REM | Remisión y referencia interna | supra/infra, referencias, abreviaturas de cita | 30 |
| JUR-REF | Reformulación y precisión | sentido estricto/amplio, precisión | 20 |
| JUR-RES | Resolutivos | decisión, admisión y rechazo, efectos, cierre | 45 |
| JUR-PET | Conclusivos y petitorio | cierre argumentativo, petición, otrosíes | 35 |
| JUR-COR | Cortesía y trato procesal | tratamientos, cierre cortés | 20 |
| LAT | Latinismos y locuciones | argumentación, tiempo, principios, sentencia, naturaleza, interpretación, vicios, generales | 90 |

**Total estimado:** 700 a 900 registros para la v1.0.

### 8.2 Atributos de etiquetado y su efecto en el sistema

| Atributo | Valores | Efecto |
|---|---|---|
| `categoria` / `subcategoria` | Códigos de la taxonomía | Filtros, selector por intención, mapa de conectores |
| `ambito` | `general`, `juridico` | Filtro del panel; perfil |
| `registro` | `neutro`, `formal`, `culto`, `tecnico`, `arcaizante`, `latinismo` | Avisos de exceso (arcaizantes y latinismos), filtros |
| `posicion` | `inicio`, `medio`, `final`, `intercalado` | Orientación de la inserción |
| `puntuacion.antes` / `.despues` | Valores controlados | Inserción y detector de puntuación |
| `detectable` | `true` / `false` | Participación en detectores. `false` para formas muy cortas o ambiguas (*si*, *como*, *para*, *así*, *luego*, *pues*, *entonces*) |
| `requiere_pareja` | `true` / `false` + id del par | Detector de pares incompletos |
| `tipos_escrito` | Lista | Sugerencias por tipo de documento |
| `jurisdiccion` | `null` o código | Fórmulas procesales propias de un país o fuero |
| `sinonimos` | Lista de ids | Alternativas de la misma categoría y registro |
| `errores_comunes` | Lista de textos | Se muestran en la ficha |
| `peso` | 1 a 5 | Orden de aparición en el panel (más frecuente o más recomendable primero) |
| `observacion_editorial` | Texto | Nota para el equipo (por ejemplo, "arcaizante: usar con moderación") |

### 8.3 Selector por intención: tabla de ejemplo

Cada intención apunta a una o más categorías y a un conjunto breve de conectores de partida (ordenados por `peso`).

| Intención del usuario | Categorías | Ejemplos de partida |
|---|---|---|
| Abrir el escrito | INT, JUR-INT | *el presente escrito tiene por objeto*, *ante su autoridad comparezco y expongo*, *el propósito de este trabajo es* |
| Plantear el problema | INT | *la cuestión que se plantea es*, *cabe preguntarse*, *resulta pertinente indagar* |
| Ordenar ideas | ORD | *en primer lugar*, *a continuación*, *por último*, *por un lado… por otro* |
| Añadir información | ADI | *además*, *asimismo*, *a ello se suma*, *no solo… sino también* |
| Contrastar | ADV | *no obstante*, *sin embargo*, *en cambio*, *por el contrario* |
| Conceder algo | CNC | *si bien*, *aun cuando*, *pese a que*, *si bien es cierto que… no es menos cierto que…* |
| Explicar la causa | CAU, JUR-ARG (premisa) | *dado que*, *puesto que*, *toda vez que*, *habida cuenta de que* |
| Indicar consecuencia | CNS, JUR-CNS | *por consiguiente*, *en consecuencia*, *de ahí que*, *de ello se desprende* |
| Poner una condición | CND, JUR-CND | *siempre y cuando*, *en el supuesto de que*, *a menos que*, *bajo apercibimiento de* |
| Expresar finalidad | FIN | *a fin de que*, *con el propósito de*, *en aras de* |
| Situar en el tiempo | TMP, JUR-HEC | *con anterioridad*, *posteriormente*, *en esa oportunidad*, *a la fecha* |
| Comparar | CMP | *al igual que*, *a diferencia de*, *por analogía* |
| Dar un ejemplo | EJE | *por ejemplo*, *a modo de ilustración*, *tal es el caso de* |
| Reformular | REF, JUR-REF | *es decir*, *en otras palabras*, *en sentido estricto*, *vale decir* |
| Enfatizar | ENF | *cabe destacar*, *conviene subrayar*, *de hecho*, *sobre todo* |
| Atenuar o matizar | CER | *en cierta medida*, *por lo general*, *salvo mejor criterio* |
| Recapitular | REC | *como se ha expuesto*, *en síntesis*, *recapitulando* |
| Concluir | CNL, JUR-PET | *en conclusión*, *en definitiva*, *por todo lo expuesto*, *de lo expuesto se concluye* |
| Narrar hechos | JUR-HEC | *es el caso que*, *se suscitó*, *obra en autos que*, *en el presente caso* |
| Fundar en una norma | JUR-NOR | *en virtud de*, *conforme a*, *a tenor de lo dispuesto en*, *al amparo de* |
| Citar jurisprudencia o doctrina | JUR-JUR | *conforme al criterio jurisprudencial*, *la doctrina mayoritaria*, *ha sostenido reiteradamente* |
| Valorar la prueba | JUR-PRU | *de la valoración conjunta de la prueba*, *queda acreditado*, *no ha sido desvirtuado* |
| Razonar o inferir | JUR-ARG | *se colige*, *a mayor abundamiento*, *a contrario sensu*, *de una lectura armónica* |
| Rebatir | JUR-OPO | *no resulta atendible*, *carece de sustento*, *contrariamente a lo sostenido*, *no es óbice que* |
| Remitir a otra parte | JUR-REM | *como se indicó supra*, *véase*, *en el considerando precedente* |
| Resolver | JUR-RES | *se declara*, *se desestima*, *se confirma*, *se ordena* |
| Pedir | JUR-PET | *solicito se sirva*, *pido se admita*, *otrosí digo*, *es justicia que espero* |
| Tratamiento cortés | JUR-COR | *con el debido respeto*, *con la venia de su autoridad*, *honorable tribunal* |

### 8.4 Pares de conectores (muestra inicial)

| Primer miembro | Segundo miembro | Uso |
|---|---|---|
| por un lado | por otro (lado) | Contraste o enumeración en dos bloques |
| de una parte | de otra | Ídem, registro formal |
| por una parte | por otra (parte) | Ídem |
| no solo | sino también | Adición enfática |
| si bien es cierto que | no es menos cierto que | Concesión y contraposición, muy usado en lo jurídico |
| en primer lugar | en segundo lugar … por último | Secuencia ordenada |
| primeramente | seguidamente … finalmente | Secuencia ordenada |
| bien… | bien… | Alternativa |
| ya sea… | o… | Alternativa |
| tanto… | como… | Inclusión de dos elementos |
| de un lado | de otro | Contraste, registro formal |
| otrosí digo (primer) | otrosí digo (segundo) | Secuencia de petitorios accesorios, según la jurisdicción |

### 8.5 Proceso de producción del dataset

| Paso | Actividad | Responsable | Salida |
|---|---|---|---|
| 1 | **Consolidar** las listas fuente (la guía de conectores general y jurídica) en una hoja de cálculo maestra | Editor de contenido | Hoja maestra con una fila por conector |
| 2 | **Normalizar** (minúsculas, sin duplicados, formas con variantes tipo *en base a*/*con base en* revisadas) | Editor | Hoja depurada |
| 3 | **Asignar** categoría, subcategoría, ámbito, registro, posición, `detectable` | Editor + lingüista | Etiquetado base |
| 4 | **Redactar** función, puntuación, ejemplo correcto, ejemplo incorrecto y errores comunes (redacción **propia**, no copiada de diccionarios) | Lingüista | Fichas completas |
| 5 | **Enlazar** sinónimos y pares | Editor | Relaciones por id |
| 6 | **Revisión jurídica** de todas las categorías `JUR-*` y `LAT` (uso procesal, jurisdicciones) | Abogado revisor | Aprobación jurídica |
| 7 | **Validación automática** (esquema, duplicados, que el ejemplo contenga el conector, que los sinónimos existan) | Integración continua | Informe de errores |
| 8 | **Publicación** del paquete versionado (`core-es@1.0.0`) | Responsable de contenido | Paquete firmado |

**Validaciones automatizables:**

- El `ejemplo` contiene la forma del conector (con flexión de mayúscula inicial).
- No hay dos registros con la misma `forma_normalizada` y la misma categoría.
- Todos los `sinonimos` y `pares` apuntan a ids existentes.
- Los campos obligatorios están completos.
- Los conectores `arcaizante` o `latinismo` tienen `observacion_editorial`.
- La puntuación declarada es coherente con el ejemplo (por ejemplo, si `despues = coma`, el ejemplo tiene coma tras el conector).

**Esfuerzo estimado de contenido (orientativo):** 40 a 60 horas de edición y lingüística para ≈ 800 registros, más 15 a 20 horas de revisión jurídica de las categorías `JUR-*` y `LAT`.

### 8.6 Ejemplos de registros

```json
{
  "id": "C-0412",
  "texto": "a mayor abundamiento",
  "categoria": "JUR-ARG",
  "subcategoria": "refuerzo",
  "funcion": "Añade un argumento adicional que refuerza una conclusión ya sustentada, sin ser indispensable.",
  "ambito": ["juridico"],
  "registro": "tecnico",
  "posicion": ["inicio"],
  "puntuacion": { "antes": ["punto", "punto_y_coma"], "despues": "coma" },
  "tipos_escrito": ["demanda", "recurso", "alegatos", "sentencia"],
  "detectable": true,
  "ejemplo": "A mayor abundamiento, la prueba documental confirma que la notificación se practicó fuera de plazo.",
  "errores_comunes": ["Usarlo para introducir el argumento principal en lugar de uno de refuerzo"],
  "sinonimos": ["C-0415", "C-0416"]
}
```

```json
{
  "id": "C-0733",
  "texto": "ex nunc",
  "categoria": "LAT",
  "subcategoria": "tiempo",
  "funcion": "Indica que los efectos operan desde el momento presente hacia adelante, sin alcanzar el pasado.",
  "ambito": ["juridico"],
  "registro": "latinismo",
  "traduccion": "desde ahora",
  "marca_cursiva": true,
  "detectable": true,
  "ejemplo": "La nulidad produce efectos ex nunc.",
  "observacion_editorial": "Contrastar con 'ex tunc' en la ficha."
}
```

```json
{
  "id": "C-0620",
  "texto": "otrosí digo",
  "categoria": "JUR-PET",
  "subcategoria": "otrosies",
  "funcion": "Abre un petitorio accesorio al final del escrito, separado del principal.",
  "ambito": ["juridico"],
  "registro": "arcaizante",
  "jurisdiccion": null,
  "requiere_pareja": true,
  "par": "P-0031",
  "puntuacion": { "antes": ["punto"], "despues": "dos_puntos" },
  "observacion_editorial": "Uso variable según la jurisdicción. Verificar en el paquete de cada país.",
  "ejemplo": "Primer otrosí digo: que se tenga por ofrecida la prueba documental que se acompaña."
}
```

---

## 9. Plantillas de documentos y de párrafos

Las estructuras son **neutrales** y deben adaptarse a cada jurisdicción mediante el paquete correspondiente (nombres de secciones, orden, fórmulas y requisitos formales). La columna **Sugerencias** indica categorías de conectores y fórmulas que el panel ofrece cuando el cursor está en esa sección.

### 9.1 Plantillas de documento

#### 9.1.1 Demanda o memorial inicial (`T-DEM`)

| # | Sección | Oblig. | Contenido guía | Sugerencias |
|---|---|---|---|---|
| 1 | Suma o encabezado | Sí | Resumen del objeto del escrito en una línea | JUR-INT |
| 2 | Autoridad destinataria | Sí | Órgano y tratamiento | JUR-COR |
| 3 | Identificación de las partes | Sí | Datos del demandante, representación, domicilio procesal; datos del demandado | JUR-INT |
| 4 | Objeto o pretensión | Sí | Qué se pide, de forma precisa | JUR-INT, FIN |
| 5 | Hechos | Sí | Narración numerada y cronológica; un hecho por numeral | JUR-HEC, TMP |
| 6 | Fundamentos de derecho | Sí | Normas aplicables y subsunción de los hechos | JUR-NOR, JUR-ARG, JUR-JUR |
| 7 | Ofrecimiento de prueba | Sí | Medios de prueba y su vinculación con los hechos | JUR-PRU |
| 8 | Petitorio | Sí | Peticiones concretas, en orden de importancia | JUR-PET |
| 9 | Otrosíes | No | Peticiones accesorias | JUR-PET |
| 10 | Lugar, fecha y firma | Sí | Lugar, fecha, firmas (parte y patrocinio) | JUR-COR |

*Checklist extra:* competencia verificada; legitimación; cuantía; domicilios; anexos listados.

#### 9.1.2 Contestación (`T-CON`)

| # | Sección | Oblig. | Contenido guía | Sugerencias |
|---|---|---|---|---|
| 1 | Suma y autoridad | Sí | Referencia del proceso | JUR-INT |
| 2 | Identificación del contestante | Sí | Datos y representación | JUR-INT |
| 3 | Admisión o negación de los hechos | Sí | Respuesta específica, numeral por numeral | JUR-HEC, JUR-OPO |
| 4 | Versión propia de los hechos | No | Narración alternativa | JUR-HEC |
| 5 | Excepciones y defensas | Según el caso | Previas, de fondo, perentorias | JUR-OPO, JUR-NOR |
| 6 | Fundamentos de derecho | Sí | Normas y argumentos | JUR-NOR, JUR-ARG |
| 7 | Prueba | Sí | Medios ofrecidos | JUR-PRU |
| 8 | Petitorio | Sí | Rechazo y peticiones | JUR-PET |
| 9 | Otrosíes y firma | Según el caso | | JUR-PET, JUR-COR |

#### 9.1.3 Recurso (apelación, casación, reposición y análogos) (`T-REC`)

| # | Sección | Oblig. | Contenido guía | Sugerencias |
|---|---|---|---|---|
| 1 | Suma y autoridad | Sí | Recurso interpuesto y órgano | JUR-INT |
| 2 | Identificación de la resolución impugnada | Sí | Fecha, órgano, contenido, fecha de notificación | JUR-INT, JUR-HEC |
| 3 | Tempestividad y legitimación | Sí | Cómputo del plazo, interés y gravamen | JUR-NOR, TMP |
| 4 | Antecedentes | Sí | Síntesis procesal relevante | JUR-HEC |
| 5 | Agravios o motivos | Sí | Un apartado por agravio (mapa de agravios, A6-07) | JUR-ARG, JUR-OPO |
| 6 | Fundamentos de derecho | Sí | Normas y jurisprudencia | JUR-NOR, JUR-JUR |
| 7 | Petitorio | Sí | Qué se solicita al superior (revocar, anular, modificar) | JUR-PET |
| 8 | Otrosíes y firma | Según el caso | | JUR-PET, JUR-COR |

*Checklist extra:* tempestividad con la calculadora; requisitos de admisibilidad del recurso; agravios concretos y no genéricos.

#### 9.1.4 Alegatos (`T-ALE`)

| # | Sección | Oblig. | Contenido guía | Sugerencias |
|---|---|---|---|---|
| 1 | Introducción | Sí | Objeto del escrito y síntesis de la controversia | JUR-INT |
| 2 | Hechos probados | Sí | Hechos acreditados, con vinculación probatoria (cuadro H-P-N) | JUR-HEC, JUR-PRU |
| 3 | Valoración de la prueba | Sí | Análisis de cada medio de prueba | JUR-PRU, ENF |
| 4 | Derecho aplicable | Sí | Normas y subsunción | JUR-NOR, JUR-ARG |
| 5 | Refutación de la contraparte | Sí | Contraargumentos (matriz A6-03) | JUR-OPO |
| 6 | Conclusión y petitorio | Sí | | JUR-CNS, JUR-PET |

#### 9.1.5 Sentencia o auto (`T-SEN`)

| # | Sección | Oblig. | Contenido guía | Sugerencias |
|---|---|---|---|---|
| 1 | Encabezado | Sí | Órgano, lugar, fecha, partes, expediente | JUR-INT |
| 2 | Vistos / Resultandos | Sí | Antecedentes y síntesis de lo actuado | JUR-INT, JUR-HEC |
| 3 | Considerandos | Sí | Fundamentación fáctica, probatoria y jurídica, con numeración | JUR-NOR, JUR-JUR, JUR-PRU, JUR-ARG |
| 4 | Parte resolutiva (fallo) | Sí | Decisión, congruente con lo pedido y lo considerado | JUR-RES |
| 5 | Cierre y firma | Sí | Notifíquese, regístrese, firma | JUR-RES |

*Checklist extra:* congruencia entre pretensiones y fallo (sin *ultra*, *extra* ni *citra petita*); motivación suficiente; numeración continua de considerandos; costas.

#### 9.1.6 Dictamen o informe legal (`T-DIC`)

| # | Sección | Oblig. | Contenido guía | Sugerencias |
|---|---|---|---|---|
| 1 | Consulta planteada | Sí | Pregunta o cuestión, tal como se formuló | INT |
| 2 | Antecedentes y hechos | Sí | Hechos relevantes y documentos revisados | JUR-HEC |
| 3 | Marco normativo | Sí | Normas aplicables (con cita exacta) | JUR-NOR |
| 4 | Análisis | Sí | Razonamiento, alternativas y riesgos | JUR-ARG, CND, CER |
| 5 | Conclusiones | Sí | Respuesta directa a la consulta | CNL, JUR-CNS |
| 6 | Recomendaciones | No | Pasos sugeridos | FIN, CND |
| 7 | Reservas y alcance | Sí | Limitaciones del informe | CER |

#### 9.1.7 Contrato (`T-CTR`)

| # | Sección | Oblig. | Contenido guía |
|---|---|---|---|
| 1 | Título y lugar y fecha | Sí | Tipo de contrato; lugar y fecha |
| 2 | Comparecientes | Sí | Datos, capacidad y representación (campos variables) |
| 3 | Antecedentes o declaraciones | No | Contexto, declaraciones de las partes |
| 4 | Cláusulas | Sí | Numeradas con ordinales (PRIMERA, SEGUNDA…): objeto, precio y forma de pago, plazo, obligaciones de cada parte, garantías, incumplimiento y penalidades, resolución, confidencialidad, fuerza mayor, solución de controversias, ley aplicable, notificaciones y domicilios |
| 5 | Firmas | Sí | Bloque de firmas y testigos (si procede) |
| 6 | Anexos | No | Lista de anexos |

*Checklist extra:* cifras en letras y números coinciden; definiciones usadas de forma consistente; remisiones entre cláusulas válidas; plazos y fechas coherentes; biblioteca de cláusulas reutilizables disponible.

#### 9.1.8 Carta, oficio o requerimiento (`T-CAR`)

| # | Sección | Oblig. | Contenido guía |
|---|---|---|---|
| 1 | Lugar y fecha | Sí | |
| 2 | Destinatario | Sí | Nombre, cargo, institución, tratamiento |
| 3 | Referencia o asunto | Sí | Resumen en una línea |
| 4 | Exposición | Sí | Antecedentes y fundamento, breves |
| 5 | Requerimiento o solicitud | Sí | Qué se pide, con plazo y apercibimiento si corresponde |
| 6 | Cierre cortés y firma | Sí | Fórmula de cortesía y firma |

#### 9.1.9 Ensayo o artículo (`T-ENS`)

| # | Sección | Oblig. | Contenido guía |
|---|---|---|---|
| 1 | Introducción | Sí | Contexto, problema, tesis y plan del texto |
| 2 | Desarrollo | Sí | Apartados con subtítulos; un argumento por apartado |
| 3 | Contraargumentos | Recomendada | Objeciones y respuesta |
| 4 | Conclusión | Sí | Retoma la tesis y expone implicaciones |
| 5 | Referencias | Según el caso | Bibliografía en el formato elegido |

#### 9.1.10 Informe general (`T-INF`)

| # | Sección | Oblig. | Contenido guía |
|---|---|---|---|
| 1 | Resumen ejecutivo | Recomendada | Hallazgos y recomendaciones en pocas líneas |
| 2 | Objetivo y alcance | Sí | |
| 3 | Metodología o fuentes | Según el caso | |
| 4 | Desarrollo y resultados | Sí | |
| 5 | Conclusiones | Sí | |
| 6 | Recomendaciones | Recomendada | |
| 7 | Anexos | No | |

### 9.2 Plantillas de párrafo (esqueletos)

Cada esqueleto se inserta con los marcadores `[COMPLETAR]`. Los conectores entre corchetes son **sugerencias editables** que dependen de la posición.

**PP-GEN-001 · General**
```
[Idea central en una oración: COMPLETAR].
[Conector de desarrollo: además / asimismo / en este sentido], [desarrollo: COMPLETAR].
[Conector de ejemplo: por ejemplo / a modo de ilustración], [ejemplo: COMPLETAR].
[Conector de cierre: en consecuencia / en suma], [cierre que retoma la idea central: COMPLETAR].
```

**PP-ARG-001 · Argumentativo (PEEL)**
```
[Afirmación: COMPLETAR].
[Conector causal: dado que / puesto que], [evidencia: dato, norma o prueba: COMPLETAR].
[Conector consecutivo: por ello / de ahí que], [explicación de por qué la evidencia respalda la afirmación: COMPLETAR].
[Conector de enlace: en consecuencia / en este sentido], [vínculo con la tesis general: COMPLETAR].
```

**PP-JUR-001 · Jurídico (subsunción)**
```
[Premisa normativa: el artículo [COMPLETAR] de [norma] establece que [COMPLETAR: texto o paráfrasis].]
[Conector: en el presente caso / en la especie], [premisa fáctica: se acredita que [COMPLETAR] con [prueba: COMPLETAR].]
[Subsunción: toda vez que / por cuanto], [razón por la cual el hecho encaja en la norma: COMPLETAR].
[Conclusión: en consecuencia / por ende], [resulta procedente [COMPLETAR].]
```

**PP-HEC-001 · Narración de hechos**
```
[Circunstancia temporal: el [COMPLETAR: fecha] / con posterioridad / en esa oportunidad], [hecho: COMPLETAR].
[Consecuencia o desarrollo: ello determinó que / como resultado], [COMPLETAR].
[Constancia probatoria: así consta en [COMPLETAR: prueba, fojas o anexo].]
```

**PP-REF-001 · Refutación**
```
[Tesis contraria: la contraparte sostiene que [COMPLETAR]].
[Concesión opcional: si bien es cierto que [COMPLETAR]], [no es menos cierto que [COMPLETAR]].
[Debilidad: no resulta atendible / carece de sustento, pues [COMPLETAR: debilidad fáctica, normativa o probatoria].]
[Respaldo: conforme a [norma, prueba o precedente: COMPLETAR].]
```

**PP-TRA-001 · Transición**
```
[Cierre de la idea anterior: Establecido lo anterior / Habiéndose expuesto [COMPLETAR]],
[Puente: corresponde ahora analizar / cabe abordar [COMPLETAR: siguiente tema]].
```

**PP-PET-001 · Petitorio**
```
Por todo lo expuesto, [fórmula de petición: solicito se sirva / pido se admita],
[petición principal: COMPLETAR].
[Petición subsidiaria (opcional): En subsidio, [COMPLETAR].]
```

**PP-CON-001 · Conclusión de ensayo o informe**
```
[Retoma de la tesis: En definitiva / En conclusión, [COMPLETAR]].
[Síntesis de los argumentos: como se ha expuesto, [COMPLETAR].]
[Implicaciones o recomendaciones: de ello se sigue que [COMPLETAR].]
```

---

## 10. Perfiles de estilo

Un perfil define qué familias de reglas están activas, con qué severidad y con qué umbrales. Todos son **editables y duplicables**; los que se muestran son valores de partida.

| Parámetro | General | Académico | Jurídico-procesal | Resolución judicial | Contractual | Epistolar y administrativo |
|---|---|---|---|---|---|---|
| Registro esperado | Formal medio | Formal-culto | Formal-técnico | Formal-técnico | Técnico preciso | Formal cortés |
| Máx. palabras por oración | 35 | 40 | 45 | 50 | 40 | 30 |
| Máx. palabras por párrafo | 150 | 200 | 220 | 250 | 180 | 120 |
| Objetivo INFLESZ (mínimo) | 55 | 45 | 45 | 40 | 40 | 55 |
| Latinismos (por 500 palabras) | 2 | 3 | 8 | 10 | 6 | 1 |
| Arcaísmos (*empero*, *otrosí*, *verbigracia*) | Aviso | Aviso | Permitidos | Permitidos | Permitidos con moderación | Aviso |
| Persona gramatical | Libre | Impersonal | Impersonal; primera persona en el escrito de parte según costumbre | Impersonal | Tercera persona | Primera persona del plural o singular |
| Gerundio tras coma (R-JUR-004) | Sugerencia | Sugerencia | Aviso | Aviso | Aviso | Sugerencia |
| Reglas de registro coloquial (`R-REG`) | Activas | Activas | Activas | Activas | Activas | Activas |
| Ventana de repetición léxica | 100 palabras | 120 | 100 | 100 | 150 (los términos definidos son repetibles) | 80 |
| Ventana de conectores repetidos | 2 párrafos | 2 | 2 | 2 | 3 | 2 |
| Pares incompletos (A2-09) | Activo | Activo | Activo | Activo | Inactivo | Inactivo |
| Interlineado y fuente por defecto | 1,15 / sans-serif | 1,5 / serif | Según jurisdicción | Según jurisdicción | 1,15 / serif | 1,15 / serif |
| Comillas | Angulares | Angulares | Angulares | Angulares | Angulares | Angulares |
| Checklist de estructura | No | Ensayo | Según plantilla | Sentencia | Contrato | Carta |

**Perfiles adicionales sugeridos:** *Dictamen*, *Estudiante* (reglas con explicación larga y modo Estudio), *Notarial* (fórmulas propias), *Legislativo* (técnica normativa: estructura de artículos, remisiones y definiciones).

**Reglas de activación:**

- Elegir un **tipo de escrito** propone un perfil, pero el usuario puede cambiarlo.
- Desactivar una regla en un perfil **no** la desactiva en otros.
- Las excepciones por documento (alertas ignoradas) se conservan al cambiar de perfil.

---

## 11. Hoja de ruta por fases

**Supuestos de las estimaciones**

- Una persona desarrolladora con experiencia en TypeScript y ProseMirror, trabajando a tiempo completo.
- Un **equipo de contenido en paralelo** (editor lingüista y abogado revisor) que produce los datasets; ese trabajo **no** está incluido en los días de desarrollo.
- Los días son **días-persona de trabajo efectivo** y se dan como rango (mínimo–máximo). Las semanas se calculan a 5 días por semana, sin contingencia.
- Las estimaciones se refinaron respecto del borrador inicial al detallar las tareas; se recalculan al terminar la fase 0.

### 11.1 Resumen de fases

| Fase | Contenido principal | Esfuerzo (días) | Duración aprox. |
|---|---|---|---|
| **F0** | Entrevistas, decisiones de alcance, esquemas de datos, pruebas de concepto | 11–17 | 3–4 semanas |
| **F1** | Editor, ortografía, conectores, 3 plantillas, campos variables, exportación | 35–44 | 7–9 semanas |
| **F2** | Reglas de estilo, detectores de conectores, métricas, vocabulario formal, perfiles básicos | 25–36 | 5–8 semanas |
| **F3** | Normas, citador, jurisprudencia, argumentación, ficha de caso, plazos básicos | 50–64 | 10–13 semanas |
| **F4** | Control de cambios, versiones, verificador de citas, consistencia, lectura final, 10 plantillas | 33–44 | 7–9 semanas |
| **F5** | Escritorio, plazos avanzados, copias de seguridad, paquetes adicionales, mejoras | Continuo | Continuo |
| **Total F0–F4** | | **154–205** | **≈ 31–41 semanas (≈ 7–10 meses)** |

> **Orden de prioridad:** el valor diferencial del sistema está en los **conectores y el selector por intención (F1)**, en el **módulo jurídico (F3)** y en el **verificador de citas y la lectura final (F4)**. Si hay que recortar, se recorta primero la fase 5.

### 11.2 Detalle por fase

#### Fase 0 — Definición y validación

| ID | Tarea | Días |
|---|---|---|
| F0-01 | Entrevistas a 5–8 usuarios objetivo y priorización de funciones | 2–3 |
| F0-02 | Decisión de jurisdicción inicial y de los 3 tipos de escrito prioritarios | 1–2 |
| F0-03 | Wireframes de baja fidelidad y prueba de comprensión con usuarios | 2–3 |
| F0-04 | Esquemas JSON (sección 6), convenciones de ids y validación Ajv | 2–3 |
| F0-05 | Pruebas de concepto: ProseMirror + decoraciones + Web Worker; nspell con el diccionario completo; exportación .docx con numeración y notas; opciones de PDF | 3–4 |
| F0-06 | Repositorio, integración continua, licencias de dependencias y de diccionarios | 1–2 |
| | **Total de desarrollo** | **11–17** |

**Criterios de salida:**

- Jurisdicción inicial y tres tipos de escrito prioritarios decididos y documentados.
- Esquemas JSON aprobados y validación automática funcionando en CI.
- Pruebas de concepto exitosas: decoraciones en un Worker sin bloquear la escritura; `.docx` con numeración y notas abre bien en Word y LibreOffice; decisión de ruta para PDF.
- Wireframes validados con al menos 3 usuarios.
- Hoja maestra de conectores completada en un 70 % o más (trabajo de contenido).

#### Fase 1 — MVP

| ID | Tarea | Días |
|---|---|---|
| F1-01 | Estructura de la aplicación PWA, CI y esquema base del documento | 2–3 |
| F1-02 | Barra de formato, estilos, listas y tablas | 3–4 |
| F1-03 | Guardado local, autoguardado y lista de documentos | 2–3 |
| F1-04 | Ortografía: nspell, Worker, decoraciones y menú de alerta (A1-01) | 4–5 |
| F1-05 | Diccionario personal (A1-02) | 1 |
| F1-06 | Capa de contenido: carga de paquetes, validación y índice de búsqueda | 2 |
| F1-07 | Panel de conectores: búsqueda, filtros y ficha (A2-01, A2-03) | 2–3 |
| F1-08 | Inserción con puntuación y selector por intención (A2-02, A2-04) | 2 |
| F1-09 | Motor de plantillas, 3 plantillas y checklist de secciones (A5-01, A5-02) | 3–4 |
| F1-10 | Campos variables, marcadores [COMPLETAR] y panel de pendientes (A5-03, A5-04) | 2–3 |
| F1-11 | Numeración multinivel, tabla de contenido y notas al pie (A5-05 a A5-07) | 3 |
| F1-12 | Exportación a .docx (A5-13) | 3–4 |
| F1-13 | Exportación a PDF, .md y .txt | 2 |
| F1-14 | Formato de página y tamaños de papel; copia de seguridad básica .scriptor (A5-09, A5-15, A8-13) | 2 |
| F1-15 | QA, accesibilidad base y documentación de uso | 2–3 |
| | **Total de desarrollo** | **35–44** |

**Criterios de salida:**

- Un usuario puede crear un escrito desde plantilla, corregir ortografía, insertar conectores por búsqueda o por intención, completar campos y exportarlo a Word y PDF.
- El `.docx` conserva numeración, notas al pie y tabla de contenido (verificado en Word y LibreOffice).
- Funciona sin conexión y conserva los documentos al cerrar y abrir el navegador.
- Sin errores bloqueantes; accesibilidad por teclado de las funciones principales.
- Cinco usuarios piloto completan un escrito de prueba sin ayuda.

#### Fase 2 — Estilo, cohesión y vocabulario

| ID | Tarea | Días |
|---|---|---|
| F2-01 | Motor de reglas: ejecutor, patrones Unicode, excepciones y severidades | 3–4 |
| F2-02 | Banco de pruebas de reglas (corpus positivo y negativo) y carga de ≈ 70 reglas del catálogo | 2–3 |
| F2-03 | Segmentador de oraciones y tokenizador con abreviaturas | 2–3 |
| F2-04 | Detectores de conectores: trie, repetición, párrafos sin conectores, pares, puntuación (A2-06 a A2-11) | 3–4 |
| F2-05 | Métricas: sílabas, INFLESZ, Fernández-Huerta, longitudes, repetición léxica, inicio repetido, densidad (A3-02 a A3-10) | 3–4 |
| F2-06 | Etiquetado de idea central y vista de hilo (A3-08) | 1–2 |
| F2-07 | Plantillas de párrafo (A3-01) | 1–2 |
| F2-08 | Tabla coloquial→formal, muletillas, tesauro, latinismos y siglas (A4-01 a A4-08, A4-12) | 2–3 |
| F2-09 | Perfiles de estilo básicos (A8-09) | 2 |
| F2-10 | Panel Revisión: lista de alertas, métricas y mapa de conectores (A2-12) | 3–4 |
| F2-11 | Biblioteca de fórmulas por sección (A4-05) | 1–2 |
| F2-12 | Calibración de falsos positivos, rendimiento y QA | 2–3 |
| | **Total de desarrollo** | **25–36** |

**Criterios de salida:**

- ≈ 70 reglas aprobadas, cada una con ≥ 5 casos positivos y ≥ 5 negativos, y falsos positivos ≤ 15 % en el corpus de calibración.
- Detectores de conectores y métricas validados con los textos de prueba (±1 punto en legibilidad frente a la calculadora de referencia).
- Perfiles básicos (general, académico, jurídico-procesal, epistolar) cambian las alertas en menos de 1 s.
- Rendimiento dentro del presupuesto de la sección 3.5.

#### Fase 3 — Módulo jurídico

| ID | Tarea | Días |
|---|---|---|
| F3-01 | Almacenes y modelo de datos legal (normas, artículos, fichas, casos) | 2–3 |
| F3-02 | Importador de normas (TXT, HTML, DOCX, PDF con texto) y limpieza (A7-01) | 4–5 |
| F3-03 | Analizador de estructura de artículos y editor de árbol (A7-01) | 4–5 |
| F3-04 | Insertar artículo, cita enlazada y verificador de cita textual (A7-02, A7-10) | 3–4 |
| F3-05 | Citador con formatos configurables (A7-03) | 3–4 |
| F3-06 | Fichas de jurisprudencia (A7-04) | 2–3 |
| F3-07 | Detección de citas en el texto con patrones por jurisdicción (A7-09) | 2–3 |
| F3-08 | Búsqueda en normas, fichas y glosario (A7-08) | 2 |
| F3-09 | Glosario jurídico y consistencia terminológica (A4-04, A4-11) | 2–3 |
| F3-10 | Constructor de argumento y volcado al texto (A6-01, A6-08) | 4–5 |
| F3-11 | Fichas de tipos de argumento y de falacias (A6-02, A6-05) | 2 |
| F3-12 | Matriz de contraargumentos, cuadro hecho-prueba-norma y mapa de agravios (A6-03, A6-04, A6-07) | 4–5 |
| F3-13 | Checklist de interpretación y de conflicto normativo (A7-05) | 1–2 |
| F3-14 | Ficha de caso y cronología procesal (A7-07) | 3 |
| F3-15 | Calculadora de plazos básica (A7-06) | 3–4 |
| F3-16 | Referencias cruzadas, bloque de firmas, reordenar secciones y biblioteca de cláusulas (A5-08, A5-10, A5-11, A5-14) | 4–5 |
| F3-17 | Versionado de normas y jerarquía normativa (A7-11, A7-12) | 2 |
| F3-18 | QA, pruebas de integración y rendimiento con bibliotecas grandes | 3–4 |
| | **Total de desarrollo** | **50–64** |

**Criterios de salida:**

- Flujo completo funcionando: importar una norma → corregir su estructura → insertar un artículo → verificar la cita textual → armar un argumento con hecho-prueba-norma → calcular un plazo → vincular todo a una ficha de caso.
- Insertar artículo produce texto idéntico al almacenado.
- El cuadro hecho-prueba-norma alerta de vacíos.
- Calculadora de plazos reproduce los 20 casos de prueba definidos.
- Bibliotecas grandes (≈ 50 000 artículos) dentro del presupuesto de búsqueda.

#### Fase 4 — Revisión y cierre de v1.0

| ID | Tarea | Días |
|---|---|---|
| F4-01 | Control de cambios (A8-01) | 4–5 |
| F4-02 | Comentarios en hilos (A8-02) | 2–3 |
| F4-03 | Historial de versiones y comparación (A8-03, A8-14) | 3–4 |
| F4-04 | Verificador de citas con estados y persistencia (A8-04, A8-12) | 3–4 |
| F4-05 | Chequeos de consistencia: partes, fechas, montos, referencias y numeración (A8-05, A8-06, A8-08) | 4–5 |
| F4-06 | Conversor de cifras a letras, verificador cifra-letra y ≥ 200 pruebas (A8-07) | 3–4 |
| F4-07 | Perfiles completos y editor de perfiles (A8-09) | 2–3 |
| F4-08 | Modo lectura final e informe de revisión (A8-10, A8-11) | 3–4 |
| F4-09 | Importar .docx (A5-12) | 2–3 |
| F4-10 | Plantillas restantes (7 tipos) y checklists (A5-01) | 3–4 |
| F4-11 | Piloto con usuarios, correcciones y endurecimiento | 4–5 |
| | **Total de desarrollo** | **33–44** |

**Criterios de salida:**

- El modo lectura final consolida pendientes, alertas, citas, consistencia y argumentos.
- El verificador de citas conserva los estados entre sesiones.
- Conversor de cifras a letras pasa ≥ 200 casos de prueba.
- Diez plantillas de documento disponibles con sus checklists.
- Piloto con ≥ 8 usuarios completado y hallazgos críticos corregidos; versión candidata a 1.0.

#### Fase 5 — Pulido y evolución (continua)

Backlog priorizado, sin fecha fija:

1. Versión de escritorio con Tauri (acceso a archivos, copias de seguridad en carpeta, menú nativo).
2. Calculadora de plazos avanzada (suspensiones, plazos encadenados, recordatorios locales).
3. Paquetes de jurisdicción adicionales.
4. Copias de seguridad automáticas y restauración guiada.
5. Colaboración por intercambio de archivos con fusión de cambios.
6. Anonimización asistida por lista (A8-15).
7. Concordancia básica (A1-13), nominalizaciones (A3-11), conector sin antecedente (A2-13).
8. Vista visual de la estructura del argumento (A6-09).
9. Cifrado local de documentos (opcional) y bloqueo con contraseña.
10. Accesibilidad avanzada y localización de la interfaz.

### 11.3 Trabajo de contenido en paralelo (horas orientativas)

| Fase | Contenido | Horas aprox. | Responsable |
|---|---|---|---|
| F0–F1 | Dataset de conectores (≈ 800 registros): consolidación, etiquetado, ejemplos | 40–60 | Editor lingüista |
| F0–F1 | Revisión jurídica de categorías `JUR-*` y latinismos | 15–20 | Abogado revisor |
| F1 | 3 plantillas de documento (demanda, recurso, carta) con checklists | 15–25 | Abogado + editor |
| F2 | ≈ 70 reglas con casos de prueba y corpus de calibración | 50–70 | Lingüista |
| F2 | Tabla coloquial→formal, muletillas, tesauro, siglas | 30–40 | Lingüista |
| F2 | Plantillas de párrafo y fórmulas por sección | 15–20 | Editor + abogado |
| F3 | Fichas de 14 tipos de argumento y ≈ 20 falacias | 25–35 | Abogado + lingüista |
| F3 | Glosario jurídico base (300–500 términos) | 30–50 | Abogado |
| F3 | Checklist de interpretación, formatos de cita y calendario de ejemplo del paquete de jurisdicción | 25–40 | Abogado |
| F4 | 7 plantillas restantes y checklists | 25–35 | Abogado + editor |
| F4 | Documento de ejemplo y recorrido de incorporación | 10–15 | Editor |
| F2–F4 | Ampliación de reglas hasta 150–250 | 60–100 | Lingüista |

### 11.4 Equipo y roles

| Rol | Dedicación | Responsabilidades |
|---|---|---|
| Desarrollo (TypeScript, ProseMirror) | Tiempo completo | Todo el código de la aplicación y del motor |
| Editor lingüista | Medio tiempo desde la fase 0 | Dataset de conectores, reglas, tesauro, glosario, pruebas lingüísticas |
| Abogado revisor | 4 a 8 h por semana en fases 1, 3 y 4 | Revisión jurídica de contenidos, plantillas y checklists; pruebas de uso |
| Diseño UX | Parcial en fases 0 a 2 | Wireframes, sistema visual, accesibilidad |
| Usuarios piloto (5 a 10) | Puntual | Pruebas de aceptación al final de cada fase |

### 11.5 Hitos

| Hito | Fase | Descripción |
|---|---|---|
| M0 | Fin de F0 | Alcance, esquemas y pruebas de concepto aprobados |
| M1 | Fin de F1 | **MVP**: editor + conectores + plantillas + exportación |
| M2 | Fin de F2 | **Alfa de estilo**: reglas, métricas y perfiles |
| M3 | Fin de F3 | **Beta jurídica**: normas, citador, argumentos, casos |
| M4 | Fin de F4 | **Candidata a v1.0**: verificación y lectura final |
| M5 | Tras el piloto | **Versión 1.0** |

### 11.6 Dependencias y camino crítico

```
F0 (esquemas + spikes) ─► F1 (editor, conectores, plantillas, export)
                              │
                              ├─► F2 (motor de reglas, métricas) ──┐
                              │                                    ├─► F4 (revisión, lectura final) ─► v1.0
                              └─► F3 (normas, citador, argumentos) ┘
```

- **Camino crítico:** esquemas de datos (F0) → capa de contenido (F1) → motor de reglas (F2) → verificador de citas (F4).
- **Dependencias de contenido:** el dataset de conectores debe estar al ≥ 70 % antes de cerrar F1; las reglas y su corpus de calibración, antes de cerrar F2; los formatos de cita y el calendario del paquete de jurisdicción, antes de iniciar F3.
- F2 y F3 pueden **solaparse** si hay más de una persona desarrolladora.

### 11.7 Plan de recorte (si el tiempo o el presupuesto se reducen)

**Nunca se recorta:** panel de conectores y selector por intención, insertar artículo y citador, verificador de citas, modo lectura final, privacidad local.

| Nivel | Se pospone | Ahorro aproximado |
|---|---|---|
| 1 | Anonimización (A8-15), comparador de documentos (A8-14), importar `.docx` (A5-12), nominalizaciones (A3-11), concordancia (A1-13) | 8 a 12 días |
| 2 | Calculadora de plazos (A7-06) y ficha de caso (A7-07), mapa de agravios (A6-07) | 8 a 10 días |
| 3 | Reducir plantillas de 10 a 6; perfiles completos a los 4 básicos | 4 a 6 días |
| 4 | Control de cambios (A8-01) y comentarios (A8-02), sustituidos por historial de versiones y comparación | 6 a 8 días |

---

## 12. Estrategia de pruebas y calidad

### 12.1 Niveles de prueba

| Nivel | Qué prueba | Herramienta | Cuándo |
|---|---|---|---|
| Unitarias | Segmentador, contador de sílabas, legibilidad, cifras a letras, cómputo de plazos, analizador de artículos, ejecutor de reglas | Vitest | En cada cambio (CI) |
| Datos | Esquema JSON, ids únicos, referencias válidas, ejemplos que contienen el conector, casos positivos y negativos de cada regla | Ajv + scripts de validación | En cada cambio de contenido (CI) |
| Integración | Editor + Worker + alertas como decoraciones; mapa de desplazamientos; persistencia en IndexedDB | Vitest + navegador simulado | En cada cambio |
| Extremo a extremo | Flujos completos del usuario (crear desde plantilla, insertar conector, insertar artículo, verificar cita, exportar) | Playwright | Antes de cada hito |
| Exportación | Apertura de `.docx` y PDF en Word y LibreOffice; comparación de estructura (numeración, notas, TOC) | Scripts + revisión manual con lista | Antes de cada hito |
| Rendimiento | Presupuestos de la sección 3.5 con documentos de 5 000, 20 000 y 60 000 palabras | Playwright + mediciones | Fin de F1, F2 y F3 |
| Accesibilidad | Teclado, contraste, lector de pantalla | axe + pruebas manuales | Fin de F1 y F4 |
| Aceptación | Tareas reales con usuarios piloto | Observación y cuestionario | Fin de cada fase |

### 12.2 Corpus de pruebas

| Corpus | Contenido | Uso |
|---|---|---|
| Ortografía | 500 oraciones con errores conocidos y 500 sin errores | Precisión y recuperación de A1-01 |
| Reglas | ≥ 5 positivos y ≥ 5 negativos **por regla** | Pruebas unitarias del catálogo |
| Calibración | 30 a 50 textos reales **anonimizados** (escritos, resoluciones, contratos, ensayos) | Medir falsos positivos por regla |
| Silabeo | 1 000 palabras con número de sílabas verificado | Legibilidad |
| Legibilidad | 10 textos con valores obtenidos con una calculadora de referencia | Validación de IFSZ y FH |
| Números | ≥ 200 cifras con su escritura en letras | Conversor de cifras |
| Plazos | 20 casos con calendario de ejemplo (inhábiles, suspensión, prórroga) | Calculadora |
| Normas | 5 normas de ejemplo en TXT, HTML, DOCX y PDF con texto | Importador y analizador de estructura |
| Citas | 50 formas de cita de normas y sentencias | Detector de citas |
| Exportación | 10 documentos con numeración compleja, tablas y notas | Fidelidad de `.docx` y PDF |

> **Anonimización:** los textos reales se anonimizan antes de entrar al corpus (nombres, documentos de identidad, domicilios, números de expediente). Nunca se incluyen documentos confidenciales de clientes sin autorización expresa.

### 12.3 Métricas de calidad de las reglas

Para cada regla se registra:

- **Precisión:** alertas correctas / alertas emitidas (meta ≥ 85 %).
- **Cobertura:** casos del corpus detectados / casos existentes (referencial).
- **Tasa de ignorado** en el piloto.
- **Costo de ruido:** alertas por 1 000 palabras (si una regla genera más de 5 por 1 000 palabras en textos corrientes, se revisa).

Reglas con precisión < 85 % se degradan a `sugerencia`, se afinan o se retiran.

### 12.4 Definición de terminado (DoD) para cada funcionalidad

- Criterios de aceptación de la sección 5 cumplidos y verificados.
- Pruebas automáticas escritas y en verde.
- Documentada en la ayuda en la aplicación (con ejemplo).
- Accesible por teclado.
- Sin regresiones de rendimiento frente al presupuesto.
- Revisada por una persona distinta de quien la desarrolló.
- Si afecta contenido jurídico: revisada por el abogado revisor.

### 12.5 Pruebas con usuarios

- **Tareas tipo** por perfil (por ejemplo: *redactar un recurso a partir de la plantilla, insertar tres artículos y verificar las citas*; *corregir un texto con 20 problemas deliberados*).
- Medición de **tiempo de tarea**, **errores** y **satisfacción** (escala 1 a 5), y observación de dónde se detienen.
- Entrevista final: qué herramientas usarían a diario y cuáles les estorban.
- Resultados registrados y priorizados para la fase siguiente.

---

## 13. Gobernanza del contenido

El contenido (conectores, reglas, plantillas, fichas, glosario) es el corazón del producto. Un contenido deficiente produce alertas ruidosas o errores de fondo, aunque el código sea impecable.

### 13.1 Roles editoriales

| Rol | Responsabilidad |
|---|---|
| Responsable de contenido | Define prioridades, aprueba paquetes, mantiene el calendario de versiones |
| Editor lingüista | Redacta y revisa conectores, reglas, tesauro y explicaciones |
| Abogado revisor | Revisa fórmulas procesales, plantillas, fichas de argumentación y checklists |
| Mantenedor técnico | Valida esquemas, ejecuta pruebas y construye los paquetes |

### 13.2 Flujo de cambios de contenido

```
Propuesta (issue/ficha) ─► Redacción ─► Pruebas automáticas ─► Revisión editorial
        ▲                                                           │
        │                                                           ▼
   Retroalimentación ◄── Publicación del paquete ◄── Aprobación (lingüística y, si aplica, jurídica)
```

- Todo el contenido vive en un **repositorio Git** con revisión por solicitud de cambios.
- Cada registro lleva `creado_por`, `revisado_por`, `fecha` y `estado`.
- Los paquetes se publican con **versionado semántico**: `MAJOR` (cambio de esquema o eliminación de ids), `MINOR` (nuevo contenido), `PATCH` (correcciones).
- Un `CHANGELOG` por paquete describe altas, modificaciones y bajas.
- Los ids eliminados se marcan `obsoleto` y nunca se reutilizan.

### 13.3 Fuentes y derechos

| Tema | Criterio |
|---|---|
| Normas lingüísticas (ortografía, gramática, puntuación) | Basarse en las obras académicas de referencia del español y en libros de estilo reconocidos (por ejemplo, el *Libro de estilo de la justicia*); registrar la fuente de **respaldo** en el campo `fuente` |
| Texto de las explicaciones | **Redacción propia.** No se copian definiciones, ejemplos ni explicaciones de diccionarios, gramáticas o manuales con derechos |
| Diccionarios Hunspell | Revisar la licencia exacta de la variante usada y sus obligaciones (atribución, distribución del código fuente, etc.) antes de distribuir |
| Normas y sentencias | El sistema **no incluye** textos de normas ni jurisprudencia: los carga el usuario. Se recomienda usar fuentes oficiales y respetar sus condiciones de uso |
| Plantillas y fórmulas | Elaboración propia a partir de estructuras habituales; no copiar modelos protegidos de editoriales |
| Librerías de terceros | Inventario de dependencias con su licencia; revisión de compatibilidad con el modelo de distribución elegido |
| Ejemplos | Todos **ficticios**; nunca casos reales ni datos personales |

### 13.4 Calidad editorial: lista de control por registro

- [ ] Redacción propia y sin copias de otras obras.
- [ ] Ejemplo correcto, claro y representativo.
- [ ] Ejemplo incorrecto (cuando aplica) realmente ilustra el error.
- [ ] Puntuación declarada coincide con el ejemplo.
- [ ] Registro y ámbito correctos.
- [ ] Revisado por una persona distinta de quien lo redactó.
- [ ] Revisión jurídica realizada si es `JUR-*`, `LAT` o una plantilla procesal.

### 13.5 Mantenimiento

- **Revisión trimestral** de reglas con alta tasa de ignorado y de nuevas formas recurrentes en los textos de calibración.
- **Revisión anual** de formatos de cita, fórmulas procesales y calendarios de cada paquete de jurisdicción.
- Canal de **sugerencias del usuario** (formulario local que genera un archivo para enviar, sin telemetría automática).

---

## 14. Riesgos y mitigaciones

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| 1 | **Falsos positivos** que irritan al usuario y lo llevan a ignorar todo | Alta | Alto | Severidades graduadas; corpus de calibración; excepciones por regla; "ignorar" y "desactivar regla" siempre disponibles; meta de precisión ≥ 85 % |
| 2 | El usuario **confía en que el sistema valida la ley** (vigencia, interpretación) | Media | Muy alto | Mensajes claros de límite; campos "fecha de consulta" y "verificada por el usuario"; el sistema no afirma vigencia; aviso en el modo lectura final |
| 3 | **Contenido jurídico incorrecto** en plantillas o fórmulas | Media | Alto | Revisión por abogado; paquetes por jurisdicción; estado `aprobado`; versionado y changelog |
| 4 | **Pérdida de datos** (el navegador borra IndexedDB, fallo de disco) | Media | Muy alto | Almacenamiento persistente; autoguardado; copias `.scriptor`; recordatorio periódico de exportar; en escritorio, archivos reales en disco |
| 5 | **Exportación a Word con pérdida de formato** | Media | Alto | Pruebas de fidelidad desde la fase 0; conjunto de documentos de prueba; lista de elementos no soportados |
| 6 | **Rendimiento** en documentos largos o bibliotecas grandes | Media | Medio | Análisis incremental y en Worker; carga perezosa; índices; presupuestos medidos en CI |
| 7 | **Licencias** de diccionarios o librerías incompatibles con la distribución | Media | Alto | Inventario de licencias en la fase 0; alternativa de diccionario; consulta legal antes del lanzamiento |
| 8 | **Importación de normas** de baja calidad (PDF con formato complejo) | Alta | Medio | Revisión manual del árbol; limpieza por reglas; no soportar PDF escaneado; guía de buenas fuentes |
| 9 | **Alcance creciente** (añadir funciones sin terminar las anteriores) | Alta | Alto | Hoja de ruta por fases con criterios de salida; plan de recorte (11.7); revisión de alcance en cada hito |
| 10 | **Costo de mantenimiento del contenido** (reglas, fórmulas, calendarios) | Alta | Medio | Gobernanza (sección 13); contenido como datos; revisión periódica; plantillas de jurisdicción modulares |
| 11 | **Dependencia de librerías de editor** con extensiones de pago o cambios de licencia | Media | Medio | Núcleo sobre ProseMirror; evaluar licencias en fase 0; encapsular extensiones propietarias |
| 12 | **Variedad regional del español** (términos, ortografía, tratamientos) | Media | Medio | Paquetes de jurisdicción; perfiles; ajuste de diccionarios por variante |
| 13 | **Adopción**: los usuarios están acostumbrados a Word | Alta | Alto | Importar y exportar `.docx`; atajos familiares; incorporación guiada; valor claro en conectores y citas |
| 14 | **Seguridad** de datos locales sensibles | Media | Alto | Sin telemetría; cifrado opcional; saneamiento de importaciones; documentación de buenas prácticas |
| 15 | **Accesibilidad** insuficiente | Media | Medio | Revisiones en F1 y F4; pruebas con lector de pantalla; uso de roles ARIA |

---

## 15. Distribución, actualización y soporte

### 15.1 Canales de distribución

| Canal | Descripción | Fase |
|---|---|---|
| PWA | Instalable desde el navegador; actualizaciones automáticas de la aplicación | 1 |
| Escritorio (Windows, macOS, Linux) | Empaquetado con Tauri; acceso a archivos locales y copias en carpeta | 5 |
| Distribución institucional | Instalación en redes cerradas con paquetes de contenido preaprobados | 5 |

### 15.2 Actualización de contenido

- **Paquetes de contenido versionados** que se importan manualmente (archivo) o, con conexión y confirmación del usuario, se descargan desde un repositorio de paquetes.
- Antes de instalar un paquete se muestra el **changelog** y se pueden revertir versiones.
- Los cambios del usuario (diccionario personal, glosario propio, plantillas propias) **nunca se sobrescriben** al actualizar un paquete.
- Los registros modificados por el usuario sobre un registro del paquete se guardan como **derivados** y se avisa si el original cambió.

### 15.3 Licenciamiento (decisión pendiente)

Opciones a evaluar, con consulta legal:

| Modelo | Ventaja | Consideración |
|---|---|---|
| Código abierto (código) + contenido con licencia propia | Confianza, auditabilidad, comunidad | Revisar compatibilidad con la licencia de los diccionarios |
| Licencia comercial con paquetes de jurisdicción de pago | Ingresos para mantener el contenido | Definir política de actualizaciones |
| Licencia institucional | Colegios de abogados, universidades, órganos judiciales | Soporte y personalización |

### 15.4 Documentación y soporte

- **Ayuda en la aplicación:** cada regla, conector y ficha tiene su explicación; modo Estudio con explicaciones largas.
- **Guía de inicio** de 5 minutos con un documento de ejemplo.
- **Manual de contenido** para editores (cómo agregar un conector, una regla, una plantilla, un paquete de jurisdicción).
- **Registro de cambios** visible en la aplicación.
- Canal de soporte por correo o formulario local (sin telemetría automática).

---

## 16. Apéndices

### Apéndice A — Mapa de funcionalidades por fase

| Fase | Funcionalidades (IDs) |
|---|---|
| F1 | A1-01, A1-02, A2-01 a A2-04, A3-01 (parcial), A4-05 (parcial), A5-01 (3 plantillas), A5-02 a A5-07, A5-09, A5-13, A5-15, A8-13 (básica) |
| F2 | A1-03 a A1-12, A2-05 a A2-12, A2-14, A3-01 a A3-10, A4-01 a A4-03, A4-05 a A4-10, A4-12, A8-09 (básicos) |
| F3 | A4-04, A4-11, A5-08, A5-10, A5-11, A5-14, A5-16, A6-01 a A6-08, A7-01 a A7-13 |
| F4 | A3-12, A5-01 (10 plantillas), A5-12, A8-01 a A8-12, A8-14 |
| F5 | A1-13, A2-13, A3-11, A6-09, A8-13 (completa), A8-15, A7-06 (avanzada) |

### Apéndice B — Cobertura de las ocho áreas de dominio

| Área | Módulos | Cobertura |
|---|---|---|
| 1. Ortografía y gramática | Corrector, reglas de locuciones, queísmo y dequeísmo, tipografía, signos emparejados, mayúsculas, tildes | Alta en ortografía y tipografía; **parcial** en gramática (patrones conocidos) |
| 2. Conectores y relaciones lógicas | Panel, selector por intención, detectores, mapa, pares | Alta |
| 3. Coherencia, cohesión y párrafos | Plantillas de párrafo, métricas, legibilidad, repeticiones, hilo de ideas | Media-alta (proxies objetivos; no mide el razonamiento) |
| 4. Vocabulario y lenguaje formal | Tabla coloquial→formal, tesauro, glosario, fórmulas, latinismos, consistencia terminológica | Alta; depende de la calidad del contenido |
| 5. Estructura y organización documental | Plantillas, checklist, campos variables, numeración, TOC, notas, referencias | Alta |
| 6. Argumentación y razonamiento | Constructor, fichas, matriz de contraargumentos, hecho-prueba-norma, falacias | Alta en **estructura**; no evalúa solidez |
| 7. Técnica jurídica, interpretación y jurisprudencia | Normas, insertar artículo, citador, jurisprudencia, checklist, plazos, caso | Alta; **no verifica vigencia** |
| 8. Revisión, verificación de fuentes y adaptación | Cambios, versiones, verificador de citas, consistencia, perfiles, lectura final | Alta; la verificación la hace el usuario |

### Apéndice C — Decisiones pendientes

| # | Decisión | Opciones | Recomendación | Cuándo |
|---|---|---|---|---|
| 1 | Jurisdicción inicial | Cualquiera; la de los usuarios piloto | La de los primeros usuarios con acceso a revisión jurídica | Fase 0 |
| 2 | Tipos de escrito de la fase 1 | Demanda, recurso, carta, contrato, dictamen… | Demanda, recurso y carta | Fase 0 |
| 3 | Librería de editor | TipTap, ProseMirror directo, Lexical | ProseMirror/TipTap, tras revisar licencias | Fase 0 |
| 4 | Ruta de exportación a PDF | CSS paginado, `pdfmake`, impresión nativa | Decidir tras la prueba de concepto | Fase 0 |
| 5 | Diccionario ortográfico | Hunspell es_ES u otras variantes | Variante compatible con la licencia de distribución | Fase 0 |
| 6 | Almacenamiento | IndexedDB (Dexie) vs. SQLite en WASM | Dexie, salvo consultas relacionales complejas | Fase 0 |
| 7 | Modelo de licencia y distribución | Abierto, comercial, institucional | Definir con asesoría legal | Antes de F4 |
| 8 | Nombre y marca | Scriptor u otro | Verificar disponibilidad y registro | Antes de F4 |
| 9 | Plataforma de escritorio | Tauri o Electron | Tauri, si la prueba de concepto funciona | Antes de F5 |
| 10 | Cifrado local | Opcional desde v1.0 o posterior | Posterior (F5) salvo requisito institucional | Fase 3 |

### Apéndice D — Lista de verificación de lanzamiento de v1.0

**Producto**
- [ ] Las 8 áreas cubiertas según los criterios de aceptación.
- [ ] Todas las plantillas y checklists revisadas por el abogado.
- [ ] Documento de ejemplo y recorrido de incorporación disponibles.
- [ ] Sin errores críticos ni bloqueantes abiertos.

**Calidad**
- [ ] Reglas con precisión ≥ 85 % en el corpus de calibración.
- [ ] Presupuestos de rendimiento cumplidos.
- [ ] Exportaciones verificadas en Word y LibreOffice.
- [ ] Accesibilidad verificada (teclado, contraste, lector de pantalla).

**Datos y privacidad**
- [ ] Verificado que no hay envío de datos a servidores externos.
- [ ] Copias de seguridad y restauración probadas.
- [ ] Almacenamiento persistente solicitado y comprobado.

**Legal y licencias**
- [ ] Inventario de dependencias y licencias revisado.
- [ ] Licencia del diccionario ortográfico verificada.
- [ ] Avisos de límites (vigencia, no asesoría legal) visibles.
- [ ] Términos de uso y política de privacidad redactados.

**Contenido**
- [ ] Paquete `core-es@1.0.0` firmado y versionado.
- [ ] Paquete de jurisdicción inicial publicado.
- [ ] Manual de contenido para editores completo.

### Apéndice E — Glosario del proyecto

| Término | Significado en este documento |
|---|---|
| **Alerta** | Aviso del motor de análisis sobre un rango de texto, con motivo y sugerencias; siempre ignorable |
| **Campo variable** | Dato (parte, fecha, monto) definido una vez y replicado en todo el documento |
| **Conector** | Palabra o expresión que relaciona ideas y marca su función lógica |
| **Decoración** | Elemento visual del editor que no forma parte del contenido del documento (usado para las alertas) |
| **Detectable** | Atributo de un conector que indica si participa en los detectores automáticos |
| **Determinista** | Que produce siempre el mismo resultado ante la misma entrada |
| **Ficha** | Registro estructurado (de conector, argumento, falacia, norma, sentencia, caso) |
| **Intención** | Propósito comunicativo del usuario ("contrastar", "concluir") al que se asocian categorías de conectores |
| **Marcador `[COMPLETAR]`** | Texto provisional que el usuario debe reemplazar; se cuenta como pendiente |
| **Paquete de contenido** | Conjunto versionado de datasets (conectores, reglas, plantillas, etc.) |
| **Paquete de jurisdicción** | Paquete con fórmulas, formatos, calendarios y estructuras propias de un país o fuero |
| **Perfil de estilo** | Conjunto de reglas y umbrales activos según el tipo de escrito |
| **Regla** | Patrón, lista o heurística que detecta un problema de redacción |
| **Verificador de citas** | Tabla que ordena el estado de verificación de cada norma o sentencia citada |

### Apéndice F — Herramientas y tecnologías mencionadas

ProseMirror, TipTap, Dexie (IndexedDB), FlexSearch, nspell y diccionarios Hunspell, Ajv (validación de JSON Schema), `docx`, `mammoth`, `pdfjs-dist`, `diff-match-patch`, Vitest, Playwright, axe, Tauri, Electron, LanguageTool (opcional, autoalojado). Verificar la **licencia y la versión vigente** de cada una al iniciar la fase 0.

---

**Aviso de alcance.** Este documento es un plan de desarrollo. No constituye asesoría jurídica. Las estructuras de escritos, fórmulas procesales, plazos y formatos de cita son **plantillas de partida** que deben adaptarse y validarse con profesionales del derecho de cada jurisdicción antes de su uso en la práctica.
