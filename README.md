# Legal-Hub

Aplicación de escritorio (Tauri 2 + React 19 + TypeScript) para la gestión de un despacho jurídico:
expedientes, personas, modelos de documentos (.docx), procedimientos y leyes.

## Scripts

| Comando           | Qué hace                                                             |
| ----------------- | -------------------------------------------------------------------- |
| `pnpm tauri dev`  | Arranca la app de escritorio en modo desarrollo                      |
| `pnpm dev`        | Solo el frontend (Vite, puerto 1420)                                 |
| `pnpm build`      | Typecheck + build del frontend en `dist/`                            |
| `pnpm tauri build`| Genera el instalador NSIS                                            |
| `pnpm typecheck`  | `tsc --noEmit`                                                       |
| `pnpm fuentes`    | Regenera `public/fuentes/` desde `@fontsource` (ver `scripts/`)      |

## Arquitectura

Arquitectura hexagonal en capas. Las dependencias solo apuntan hacia adentro:
`ui → infrastructure → application → domain`.

```
src/
├── main.tsx · App.tsx · App.css      Punto de entrada y navegación
├── domain/                           Reglas de negocio puras (sin I/O)
│   ├── comun/                        errores, id, texto, nombreArchivo, version
│   ├── entidades/                    Persona, Expediente, ModeloVersion, DocumentoVersion
│   ├── expedientes/                  tipos de expediente, catálogo de datos, rutas
│   ├── personas/                     personas, generales de ley
│   ├── modelos/                      marcadores, fuente del modelo, campos, edición,
│   │   └── filtros/                  concordancia, paginación, plantillas iniciales
│   ├── fuentes/                      catálogo tipográfico (fuentes.json)
│   ├── leyes/
│   └── procedimientos/
├── application/                      Casos de uso y puertos (interfaces)
│   ├── casosDeUso/
│   └── puertos/
├── infrastructure/                   Adaptadores: SQLite (Tauri), archivos, docx, pdf, fuentes
│   └── composicion.ts                Composition root: conecta puertos con adaptadores
└── ui/                               Componentes React
    ├── _core/                        servicios (contexto) y componentes comunes
    ├── compartidos/                  piezas reutilizadas entre páginas
    ├── paginas/                      una por sección del menú
    ├── editor/  leyes/  pdf/  clientes/  procedimientos/

src-tauri/
├── src/                              Backend Rust (db, backup)
└── migrations/                       Migraciones SQL numeradas
```

### Convenciones

- Un módulo nuevo va en su carpeta dentro de cada capa (`domain/<modulo>/`, `ui/<modulo>/`).
- `domain/` no importa nada de las otras capas.
- Las migraciones SQL son inmutables: los cambios se agregan con un archivo nuevo numerado.
