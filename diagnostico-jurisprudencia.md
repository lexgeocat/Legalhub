# Diagnóstico — Módulo Jurisprudencia (Legal-Hub)

Revisión estática del código (24/10/2026). Los ítems marcados con ⚠ dependen de la versión de librerías o de las APIs externas: conviene verificarlos en ejecución.
Los códigos entre corchetes `[n]` remiten a los parches entregados en el chat.

## 0. Resumen

| Severidad | Cantidad | Qué significa |
|---|---|---|
| Crítico | 8 | Resultados vacíos o filtrados en silencio, datos que no se guardan o no se borran, HTML remoto sin sanear |
| Alto | 10 | Estado mezclado, rutas, backup, errores tragados, FTS |
| Medio | 12 | UX cargada, consistencia, rendimiento |
| Mejora | 10 | Funcionalidad a completar |

Causa raíz principal: el módulo mezcla tres identidades de una resolución (id remoto del TSJ/TCP, id local de SQLite y «lo que se ve en la lista») y comparte un solo estado de filtros entre modalidades y pestañas.

---

## 1. Bugs de la consulta

| ID | Sev | Dónde | Problema | Efecto | Fix |
|---|---|---|---|---|---|
| Q1 | Crítico | `Jurisprudencia.tsx` (efecto de salas) | Al cargar, `setIdSalaTsj(salas[0].id)`: queda preseleccionada «Sala Penal 1» | Búsqueda simple, N° de resolución, expediente y partes se filtran **en silencio** a esa sala (el selector de sala ni siquiera está visible en «Simple») | [11] no se preselecciona nada |
| Q2 | Crítico | `Jurisprudencia.tsx` + `casosDeUso/jurisprudencia.ts` | «Consulta por Gestión» muestra `2026` pero el estado `gestion` es `''`; `tieneCriterioBusqueda` exige `gestion` | Pulsar «Consultar Gestión» devuelve «Sin resultados» sin error | [3][11] estado propio `gestionTsj` con año actual |
| Q3 | Alto | `tieneCriterioBusqueda` | Si hay texto, devuelve `true` sin mirar la modalidad | Texto residual de «Simple» se reutiliza como N° de resolución/expediente | [1][3] criterio por modalidad |
| Q4 | Alto | Página | `modalidadTsj`, `subcampoTsj`, `nroResolucion`… se conservan al cambiar de fuente/pestaña | Con «Ambas fuentes» el TSJ puede buscar con una modalidad oculta | [3][11] modo único + se fuerza `simple` fuera de TSJ |
| Q5 | Alto | `cambiarABusquedaPorResolucion` | Llama `ejecutarBusqueda` con `subcampoTsj` viejo (el `set` es asíncrono) | Busca el N° como expediente/partes | [11] filtro construido de forma explícita |
| Q6 | Alto | Biblioteca | Origen por defecto `TSJ` (compartido con la pestaña en línea) | Las sentencias TCP guardadas «no aparecen» | [11] filtros propios de biblioteca (`TODOS`) |
| Q7 | Alto | Biblioteca | El selector de sala guarda `idSalaTsj` pero `buscarLocal` filtra por `sala` (texto) | Filtro de sala sin efecto | [11] campo de texto |
| Q8 | Alto ⚠ | `repositorioJurisprudenciaSqlite.buscarLocal` | `JOIN fts_jurisprudencia fts … WHERE fts MATCH ?`: alias en MATCH de FTS5 | Muy probable `no such column: fts` al buscar texto en la biblioteca (el resto de la app usa el nombre de tabla sin alias) | [7] |
| Q9 | Medio | `buscarLocal` | `"frase completa"*` = una sola frase | «debido proceso contrato» exige adyacencia | [7] un token por término (AND) |
| Q10 | Alto | Página | Un solo `resultados` para ambas pestañas | Al volver a «En línea» se ven los resultados de la biblioteca | [11] estado por pestaña |
| Q11 | Alto | Página/clientes | Sin control de carrera, sin timeout, sin cancelar | Dos búsquedas seguidas pueden pintar la antigua; «Consultando…» infinito | [4][11] secuencia + timeout |
| Q12 | Medio | `buscarEnLinea` («Ambas») | Pide `limite/2` a cada fuente y calcula páginas con `limite` | Paginación incoherente; resultados perdidos | [3] |
| Q13 | Medio | `ClienteTcp.buscar` | Ignora `gestion`/`materia`/`sala`; no hay paginado de servidor (descarga todo y corta en cliente en cada página) | Filtros «adicionales» decorativos con TCP; red repetida | [6] filtro por año + caché 5 min |
| Q14 | Alto ⚠ | `firmarPeticionTcp` | Se firma el JSON con claves **ordenadas** pero se envía `JSON.stringify(payload)` con otro orden | Posibles 401/403 intermitentes | [6] se envía exactamente lo firmado |
| Q15 | Medio | `ClienteTcp` | `new Date(iso).toLocaleDateString('es-BO')` sobre fecha en UTC | En Bolivia (UTC-4) la fecha retrocede un día | [6] |
| Q16 | Medio | `ClienteTsj.buscar` | Nunca mira `json.success` | Un rechazo del servidor se ve como «Sin resultados» | [5] |
| Q17 | Medio | `obtenerSalas/obtenerTiposResolucion` | El **respaldo** se guarda en caché si falló la red | Queda el catálogo viejo hasta reiniciar | [5] |
| Q18 | Medio | `obtenerTiposResolucion` | Respaldo con ids inventados (`1,2,3`); los tipos no se recargan al cambiar de sala | Filtro por tipo puede apuntar a otro id | [5][11] |
| Q19 | Bajo | Clientes/UI | «Auto Supremo» fijo como valor por defecto y en la insignia de **todo** resultado TSJ | Sentencias/Resoluciones mal rotuladas | [5][11] |
| Q20 | Medio | `marcarGuardadas` | Una consulta SQL por resultado (N+1 por IPC) | Lentitud | [3][7] |

## 2. Bugs de datos, ids y persistencia

| ID | Sev | Problema | Fix |
|---|---|---|---|
| D1 | Crítico | `alternarGuardado`: `eliminarDeBiblioteca(r.id)` con `id` **remoto** en resultados en línea | No borra nada pero avisa «Eliminada» | [1][3][11] `idLocal` |
| D2 | Crítico | Modal: tras guardar, `id` pasa a ser el local; «Descargar PDF» pide `/resoluciones/<ULID>/pdf` | 404 | [3][12] `idRemoto` separado |
| D3 | Crítico | `VincularExpedienteModal`: si `guardadaLocal` usa `resolucion.id` (remoto) | Violación de FK; error genérico tragado | [13] |
| D4 | Alto | `INSERT OR REPLACE` en `jurisprudencia_expediente` sin `UNIQUE` | Vínculos duplicados | [7][8] índice único + `ON CONFLICT` |
| D5 | Crítico | `ArchivosTauri.escribir` no crea la carpeta `Jurisprudencia/` | Primer PDF/guardado falla | [9] |
| D6 | Alto | `nombreArchivo` viene de `Content-Disposition` sin sanear | Escritura fuera de la carpeta (`../`) | [3][5] nombre derivado de origen+número |
| D7 | Medio | «Descargar PDF» usa el nombre del servidor, «Guardar» usa otro | Dos PDF de la misma resolución | [10] un solo nombre |
| D8 | Medio | `{...resolucion, ...detalle}` pisa con `undefined` | Pierde sala/expediente del listado | [1] `mezclarDetalle` |
| D9 | Medio | FTS indexa `contenido_html` crudo; no indexa partes ni tipo | Basura (`span`, `style`) y no se encuentra por demandante | [8] `texto_plano` + triggers |
| D10 | Medio | Escrituras con `db.ejecutar` sueltas, sin transacción ni auditoría | Inconsistente con el resto (hash-chain de auditoría) | [7] |
| D11 | Medio | Listados con `SELECT j.*` | Se carga el HTML completo de cada fila | [7] |
| D12 | Alto | `backup.rs`: `CARPETAS` no incluye `Jurisprudencia` | Los respaldos pierden los PDF | [8] |
| D13 | Medio | `ruta_pdf` absoluta | Se rompe al restaurar en otra PC (problema general de la app) | Recomendación §8 |
| D14 | Medio | No se valida que el binario sea PDF | Se guarda un JSON de error como `.pdf` | [3] cabecera `%PDF` |
| D15 | Bajo | El PDF se escribe antes de la transacción | Si falla la BD queda huérfano (nombre determinista: se sobrescribe luego) | Aceptado |

## 3. Seguridad

| ID | Sev | Problema | Fix |
|---|---|---|---|
| S1 | Crítico | `dangerouslySetInnerHTML` con HTML de servidores externos sin sanear (`contenidoHtml`, `resumen`). El CSP bloquea scripts, pero un `<a href>` puede navegar toda la ventana de la app y se puede alterar la interfaz | [1][12] lista blanca de etiquetas, sin atributos ni enlaces |
| S2 | Alto | `sanearTextoExtracto` convierte **todo** `</span>` en `</mark>` y todo `<span style>` en `<mark>` (etiquetas desbalanceadas) y deja pasar cualquier otra etiqueta | [1] tokenizador con pila |
| S3 | Medio | `apikey` del TSJ y `SECRET_KEY` del TCP incrustadas en el código, y `User-Agent`/`Origin` suplantados | Moverlas a una constante de configuración, documentar el riesgo y detectar cambios (§8) |
| S4 | Medio | `capabilities/default.json`: `http:default` permite cualquier `https://*/*` | Acotar a dominios usados (TSJ, TCP, proveedores de IA) |

## 4. Infraestructura

- **I1 (Alto)** `fetchHttp`: cualquier error de `fetchTauri` cae al `fetch` del navegador (CORS) y oculta la causa; el «proxy local» `/api-tsj` ante un 403 **no existe en producción** (solo en `vite dev`). → [4]
- **I2 (Alto ⚠)** `tauri-plugin-http` descarta cabeceras prohibidas (`Origin`, `Referer`) salvo con la feature `unsafe-headers`. Sin ella el TSJ puede responder 403. → [8] `Cargo.toml`
- **I3 (Medio)** Sin tests de clientes ni repositorio; solo hay tests del dominio. → [15] (parcial)

## 5. Interfaz demasiado cargada

Hoy, para buscar en el TSJ hay en pantalla: 2 pestañas, 3 pastillas de fuente (con emoji), 4 botones de modalidad con insignias, 3 botones de subcampo, selector de sala, selector de año, tipo, 4 chips de operadores, un botón de filtros adicionales y un banner de «tip» por modalidad. Cada tarjeta de resultado tiene 5 acciones.

Propuesta aplicada en [11]:
1. **Una fila**: Fuente (TSJ / TCP / Ambas) + «Buscar por» (un `<select>` con 6 opciones: texto, N° resolución, expediente, partes, sala y gestión, avanzada).
2. **Un solo campo principal** + botón Buscar. Los demás campos solo aparecen en «Sala y gestión» y «Avanzada».
3. **Filtros** colapsados con contador; los filtros activos nunca quedan ocultos.
4. Tarjeta con 3 acciones (Ver, Copiar cita, Guardar). PDF y Vincular viven en el detalle.
5. Se eliminan emojis, los chips de operadores (la pista lo explica) y el texto promocional («oficial», «milisegundos»). El TSJ/TCP se consultan por servicios no documentados: no conviene llamarlos «oficiales».
6. Otros defectos de UI: título de tarjeta clicable sin teclado (ahora `<button>`); barras de scroll anidadas en el modal (`max-height` del detalle); `var(--color-texto-apagado)` **no existe** (usar `--texto-3`); «Caso» vs «Expediente» mezclados; validaciones con toast verde.

## 6. Funcionalidad incompleta

- **F1** Vincular a un expediente **no tiene contraparte**: ninguna pantalla muestra la jurisprudencia vinculada (`listarPorExpediente` y `desvincularDeExpediente` no se usan). Falta una pestaña «Jurisprudencia» en `Expediente.tsx`.
- **F2** «Disponible sin conexión» no se cumple: nunca se abre el PDF local (`rutaPdf` no se usa) y, en la biblioteca, el detalle intentaba la red. → [3][10]
- **F3** Las notas del vínculo se guardan pero no se ven en ningún lado.
- **F4** No hay forma de insertar la cita en el editor de modelos/documentos (sí existe para normativa en `PanelLeyes`).
- **F5** Lex AI no usa la biblioteca como fuente: `busquedaJuridicaWeb.ts` raspa DuckDuckGo en vez de usar `ClienteTsj`/`ClienteTcp` y el FTS local.
- **F6** El buscador global (Ctrl+K) no busca en jurisprudencia ni en normativa (y su texto de ayuda dice «inmuebles», que tampoco busca).
- **F7** `materia` usa una lista fija (Civil/Penal/Social/Contencioso/Familia) distinta de `MATERIAS_MODELO`; en «Simple» y «Avanzada» las listas eran distintas. No hay garantía de que coincida con lo que espera la API. ⚠ validar valores reales.
- **F8** TCP: `tipoResolucion` se rotula siempre «Sentencia Constitucional Plurinacional» aunque el origen sea un Auto o una Declaración. ⚠ revisar valores reales de `item.tipoResolucion`.
- **F9** Formatos de fecha distintos por fuente (`dd/mm/aaaa` en TSJ, texto largo en TCP): conviene guardar ISO y formatear al mostrar.

## 7. Archivos huérfanos / basura / código muerto

Dentro del módulo:
- `VinculoExpedienteJurisprudencia` (dominio): tipo sin uso → eliminado en [1].
- `ResolucionJurisprudencia.rutaPdf`: se llenaba y no se usaba → ahora se usa.
- CSS sin uso tras el rediseño: `.juris-pills-fuente`, `.juris-pill-btn*`, `.juris-tsj-modalidades-nav`, `.juris-tsj-mod-*`, `.juris-subcampos-bar`, `.juris-subcampo-btn*`, `.juris-operadores-chips`, `.juris-chip-operador*`, `.juris-campo-avanzado*` ([14]).
- Íconos (`comunes.tsx`) sin referencias que vi: `mano`, `mazo`, `filtro`; y `diana`, `rayo`, `calendario` si aplicas el rediseño.

Fuera del módulo (para decidir):
- **`src/ui/clientes/PanelClientes.tsx` no se importa en ningún lado** (App.tsx ya no lo usa). Con él quedan muertos: `Consultas.listarClientes`, los tipos `ClienteResumen`/`ClienteExpediente`, `iniciales()` en `comunes.tsx` y todo el bloque `.nav-cliente*`, `.nav-clientes*`, `.nav-popover*`, `.nav-avatar*`, `.nav-exp*`, `.nav-punto*`, `.nav-colapsado-badge` de `App.css`. Elimínalos o vuelve a montarlo.
- Migraciones `013_redaccion.sql` y `014_redaccion_banco.sql`: crean `escrito_propio`, `redaccion_historial`, `redaccion_banco` sin ningún código que las use (no se pueden borrar los archivos porque ya están aplicadas; si el módulo no va, una migración 017 con `DROP TABLE`).
- `LexAi.css`: `.lexai-prompt-pie`, `.lexai-prompt-info-contexto`, `.lexai-lbl-ambito`, `.lexai-ambito-pista`, `.lexai-pie-web-tag` sin uso; `.lexai-select-ambito` está definida dos veces.
- `src/domain/entidades/persona.ts` solo exporta `Genero`.
- `sha256_archivo` se usa, pero `ArchivosPuerto.sha256` nunca se llama para jurisprudencia: no hay verificación de integridad de los PDF guardados.

## 8. Mejoras recomendadas (por valor)

1. **Pestaña «Jurisprudencia» en el expediente**: listar, ver nota, abrir PDF, citar, desvincular (cierra F1/F3/F4).
2. **Alimentar a Lex AI** con la biblioteca local (FTS) y con `ClienteTsj` directo como fuente `[J1]`, en lugar de DuckDuckGo.
3. **Insertar cita en el editor** (pestaña en `BuscadorLeyes`), reutilizando `citaParaEditor`.
4. **Visor de PDF integrado** con `VisorPdf` (ya existe) en lugar de abrir una app externa; y extraer texto con `LectorPdfPdfjs` cuando la resolución no trae HTML (PDF escaneado).
5. **Rutas relativas a la carpeta raíz** en BD (`Jurisprudencia/…`) para que backups y cambios de carpeta no rompan las rutas (aplica también a documentos y modelos).
6. **Centralizar credenciales/URLs** de TSJ/TCP en un archivo de constantes, con un «health check» que muestre un aviso claro cuando la API cambie.
7. **Caché de búsqueda en línea** (TTL corto) y botón «Cancelar».
8. **Citas configurables** (SCP 0812/2023-S3, AS 0554/2026-FF) y fechas ISO.
9. **Tests**: clientes con `fetch` simulado, repositorio con SQLite en memoria, sanitizador.
10. **Aviso legal** en la pantalla: la fuente es un servicio público no documentado; verificar el texto antes de citarlo.

## 9. Orden de aplicación sugerido

1. [8] migración 016 + `db.rs` + `backup.rs` + `Cargo.toml` · [9] `escribir`
2. [1] dominio · [2] puerto · [7] repositorio · [3] caso de uso
3. [4] `httpHelper` · [5] TSJ · [6] TCP
4. [10] `acciones.ts` · [12] detalle · [13] vincular · [11] página · [14] CSS
5. [15] tests → `pnpm test` y `pnpm tauri dev`
