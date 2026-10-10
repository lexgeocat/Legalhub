// src/ui/AsistenteDocumento.tsx
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { camposParaFormulario, esCampoCaso, esTextoLargo } from '../application/camposModelo';
import type { DocumentoPreparado } from '../application/casosDeUso/generarDocumento';
import type { ResultadoImportacion } from '../application/casosDeUso/importarModelo';
import type { ExpedienteResumen, ModeloResumen } from '../application/consultas';
import type { CampoEsquema } from '../application/puertos/motorPlantillas';
import { mismoTexto, type AnalisisModelo } from '../domain/edicionModelo';
import {
    CONFIG_POR_DEFECTO, bloquesATexto, margenesIguales, parsearTexto,
    type Bloque, type ConfigPagina, type FuenteModelo,
} from '../domain/fuenteModelo';
import { revisarTexto, type HallazgoTexto } from '../domain/revisionTexto';
import { asignarRuta, leerRuta } from '../domain/rutas';
import { claveCampo, claveNormalizada } from '../domain/texto';
import type { Servicios } from '../infrastructure/composicion';
import { ActualizarModelo } from './ActualizarModelo';
import {
    Alerta, Aviso, Campo, Icono, Insignia, Modal, Pestanas, avisar, confirmar, datosDeForm, normalizarNumero,
} from './comunes';
import { EditorDocumento } from './EdicionDocumento';
import { Hoja } from './Hoja';
import { mensajeError, useCargar, useServicios } from './servicios';
import { datoDeParteEnRuta } from '../domain/catalogo';

interface Borrador {
    modelo: ModeloResumen;
    titulo: string;
    faltantes: CampoEsquema[];
    avisos: string[];
    valores: Record<string, string>;
}

/** Lo necesario para mostrar el documento ya completado, con el aspecto del editor. */
interface VistaPrevia {
    bloques: Bloque[];
    config: ConfigPagina;
    editable: boolean;
    hallazgos: HallazgoTexto[];
}

interface Original { preparado: DocumentoPreparado; vista: VistaPrevia }

interface DatosVerificar {
    n: 'verificar';
    b: Borrador;
    preparado: DocumentoPreparado;
    caso: Record<string, string>;
    vista: VistaPrevia;
    /** El documento tal como salió del modelo, mientras tenga ediciones hechas a mano. */
    original: Original | null;
    /** Versión del modelo creada desde este documento. */
    modeloNuevo: number | null;
}

type Paso =
    | { n: 'elegir' }
    | { n: 'formulario'; b: Borrador }
    | DatosVerificar
    | { n: 'listo'; ruta: string; numero: number };

type PestanaVerif = 'documento' | 'datos';

const ETAPAS = ['Modelo', 'Datos', 'Revisar', 'Listo'];
const INDICE: Record<Paso['n'], number> = { elegir: 0, formulario: 1, verificar: 2, listo: 3 };
const NUMERICOS = new Set(['moneda', 'superficie', 'numero']);

const sinValor = (v: unknown) => v === undefined || v === null || v === '';
const ultimo = (ruta: string) => ruta.split('.').pop() ?? ruta;
const rutaNormal = (ruta: string) => ruta.split('.').map(claveNormalizada).join('.');
const pad = (n: number) => String(n).padStart(2, '0');
const sinGenero = (v: unknown): boolean =>
    (Array.isArray(v) ? v : [v]).some((p) => {
        const g = (p as { genero?: unknown } | null)?.genero;
        return g !== 'M' && g !== 'F';
    });
const esLargo = (c: CampoEsquema) => c.tipo === 'texto_largo' || esTextoLargo(ultimo(c.path));

function leerEsquema(json: string): CampoEsquema[] {
    try {
        const o: unknown = JSON.parse(json);
        return Array.isArray(o) ? (o as CampoEsquema[]) : [];
    } catch {
        throw new Error('El esquema del modelo está dañado; vuelve a importarlo.');
    }
}

/**
 * Prepara la vista previa con el MISMO .docx que se va a guardar: se lee con el lector del visor
 * y se dibuja con la misma hoja del editor (fuente, márgenes, interlineado y páginas del modelo).
 */
async function armarVista(s: Servicios, p: DocumentoPreparado, versionId: string): Promise<VistaPrevia> {
    let config: ConfigPagina = { ...CONFIG_POR_DEFECTO, margenes: { ...CONFIG_POR_DEFECTO.margenes } };
    let editable = false;
    try {
        const v = await s.verModelo.ejecutar(versionId);
        config = v.config;
        editable = v.editable;
    } catch {
        /* sin la configuración del modelo se usa la estándar */
    }
    let bloques: Bloque[] = [];
    try {
        bloques = s.lector.aBloques(p.docx);
    } catch {
        /* sin vista paginada: se muestra el texto plano */
    }
    return { bloques, config, editable, hallazgos: revisarTexto(p.texto) };
}

function Entrada({ c, valor }: { c: CampoEsquema; valor: string }) {
    if (c.tipo === 'fecha') return <input type="date" name={c.path} defaultValue={valor} required={c.requerido} />;
    if (NUMERICOS.has(c.tipo)) {
        return <input name={c.path} defaultValue={valor} required={c.requerido} inputMode="decimal" placeholder="1234,56" />;
    }
    if (esLargo(c)) return <textarea name={c.path} defaultValue={valor} required={c.requerido} />;
    return <input name={c.path} defaultValue={valor} required={c.requerido} />;
}

/* ---------------- Paso 3: revisar el documento en limpio (y editarlo) ---------------- */
function PasoVerificar({ p, editando, ocupado, editar, descartar, aplicar, restaurar, actualizarModelo }: {
    p: DatosVerificar;
    editando: boolean;
    ocupado: boolean;
    editar: () => void;
    descartar: () => void;
    aplicar: (texto: string, config: ConfigPagina) => void;
    restaurar: () => void;
    actualizarModelo: () => void;
}) {
    const [pestana, setPestana] = useState<PestanaVerif>('documento');
    const { preparado, vista, original } = p;
    const hayVacios = preparado.verificacion.some((v) => v.opcionalVacio);

    if (editando) {
        return (
            <EditorDocumento
                bloques={vista.bloques}
                config={vista.config}
                aviso={!vista.editable
                    ? 'Este modelo viene de Word: al editar aquí se simplifica el formato (sin encabezados, pies, tablas ni imágenes) y se usa la página estándar.'
                    : undefined}
                aplicar={aplicar}
                descartar={descartar}
            />
        );
    }

    return (
        <>
            <Alerta tipo="info">
                Así quedará el documento. Todavía no se guardó nada: puedes editarlo aquí mismo o volver atrás y corregir los datos.
            </Alerta>
            {original && (
                <Alerta tipo="adv">
                    Editaste este documento a mano: se guardará con tus cambios. Si el cambio sirve para los próximos documentos, usa «Actualizar modelo».
                </Alerta>
            )}
            {p.modeloNuevo !== null && (
                <Alerta tipo="ok">Modelo actualizado: versión {p.modeloNuevo}. Los próximos documentos ya salen con los cambios.</Alerta>
            )}
            {vista.hallazgos.map((h, i) => (
                <Alerta key={i} tipo={h.nivel === 'error' ? 'error' : 'adv'}>{h.mensaje}</Alerta>
            ))}
            {hayVacios && (
                <Alerta tipo="adv">
                    Algunos campos opcionales quedaron vacíos (míralos en «Datos insertados»). Confirma que el texto se lee bien sin ellos.
                </Alerta>
            )}

            <div className="acciones">
                <button type="button" className="btn btn-sec btn-sm" disabled={ocupado || vista.bloques.length === 0} onClick={editar}>
                    <Icono n="editar" tam={15} /> Editar documento
                </button>
                {original && (
                    <>
                        <button type="button" className="btn btn-sec btn-sm" disabled={ocupado || !vista.editable} onClick={actualizarModelo}
                            title={!vista.editable ? 'Solo se puede actualizar un modelo creado en el editor. Conviértelo a editable desde su ficha.' : 'Lleva tus cambios al modelo'}>
                            {ocupado ? 'Revisando…' : 'Actualizar modelo…'}
                        </button>
                        <button type="button" className="btn btn-fan btn-sm" disabled={ocupado} onClick={restaurar}>Volver al original</button>
                    </>
                )}
            </div>

            <Pestanas<PestanaVerif>
                activa={pestana}
                cambiar={setPestana}
                items={[
                    { id: 'documento', etiqueta: 'Documento' },
                    { id: 'datos', etiqueta: 'Datos insertados', contador: preparado.verificacion.length },
                ]}
            />

            {pestana === 'documento' && (
                <>
                    <div className="vista-hoja" style={{ height: 'min(56vh, 620px)', minHeight: 340 }}>
                        {vista.bloques.length > 0 ? (
                            <Hoja bloques={vista.bloques} config={vista.config} resaltar={false} />
                        ) : (
                            <div className="celda-larga" style={{ padding: 16, background: '#fff' }}>{preparado.texto}</div>
                        )}
                    </div>
                    {!vista.editable && !original && (
                        <p className="suave">
                            Vista simplificada: este modelo viene de Word, así que aquí no se ven encabezados, pies, tablas ni imágenes,
                            pero el documento generado sí los conserva.
                        </p>
                    )}
                </>
            )}

            {pestana === 'datos' && (
                preparado.verificacion.length === 0 ? (
                    <p className="suave">El modelo no usa ningún campo.</p>
                ) : (
                    <div className="verif-scroll">
                        <div className="tabla-wrap">
                            <table className="tabla tabla-densa">
                                <thead><tr><th>Dato</th><th>Valor insertado</th></tr></thead>
                                <tbody>
                                    {preparado.verificacion.map((v, i) => (
                                        <tr key={i}>
                                            <td><code>{v.ruta}</code></td>
                                            <td className="celda-larga">
                                                {v.opcionalVacio ? <Insignia tono="ambar">Vacío (opcional)</Insignia> : v.valor}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}
        </>
    );
}

export function AsistenteDocumento({ expediente, cerrar }: { expediente: ExpedienteResumen; cerrar: () => void }) {
    const s = useServicios();
    const modelos = useCargar(() => s.consultas.listarModelos(), []);
    const docs = useCargar(() => s.consultas.listarDocumentos(expediente.id), [expediente.id]);
    const [paso, setPaso] = useState<Paso>({ n: 'elegir' });
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);
    const [analizando, setAnalizando] = useState(false);
    const [editando, setEditando] = useState(false);
    const [dlg, setDlg] = useState<{ analisis: AnalisisModelo; versionId: string; modelo: ModeloResumen } | null>(null);
    const [sel, setSel] = useState('');
    const [titulo, setTitulo] = useState('');
    const [q, setQ] = useState('');
    const [guardarCaso, setGuardarCaso] = useState(true);

    const ordenados = useMemo(() => {
        const k = claveNormalizada(q.trim());
        const mismo = (m: ModeloResumen) => Number(m.materia === expediente.tipo);
        return (modelos.datos ?? [])
            .filter((m) => !k || claveNormalizada(`${m.nombre} ${m.descripcion} ${m.categoria}`).includes(k))
            .sort((a, b) => mismo(b) - mismo(a) || a.nombre.localeCompare(b.nombre, 'es'));
    }, [modelos.datos, q, expediente.tipo]);

    const modeloSel = modelos.datos?.find((m) => m.versionId === sel);
    const tituloFinal = titulo.trim() || modeloSel?.nombre || '';
    const existente = docs.datos?.find((d) => d.titulo === tituloFinal);
    const proxima = existente ? Math.max(0, ...existente.versiones.map((v) => v.nro)) + 1 : 1;

    const cambiarVerificacion = (f: (p: DatosVerificar) => DatosVerificar) =>
        setPaso((prev) => (prev.n === 'verificar' ? f(prev) : prev));

    async function continuar() {
        if (!modeloSel) return;
        setTrabajando(true);
        try {
            const esquema = leerEsquema(modeloSel.schemaJson);
            const base = await s.contexto.construir(expediente.id, {});
            const faltantes: CampoEsquema[] = [];
            const avisos: string[] = [];
            for (const c of camposParaFormulario(esquema)) {
                const actual = leerRuta(base, c.path);
                if (Array.isArray(actual) && actual.length === 0) {
                    avisos.push(`«${c.path}» no tiene partes en este expediente: agrégalas en la pestaña Partes o la generación se detendrá.`);
                    continue;
                }
                if (c.tipo === 'concordancia' && actual !== undefined && actual !== null && sinGenero(actual)) {
                    avisos.push(`«${c.path}»: falta el género de alguna persona. Edítala en Personas o la generación se detendrá.`);
                    continue;
                }
                if (Array.isArray(actual) || !sinValor(actual)) continue;
                if (c.tipo === 'lista' || c.tipo === 'ci' || c.tipo === 'concordancia') {
                    avisos.push(`«${c.path}» sale de las personas del expediente y no está registrado: agrega la parte con ese rol (pestaña Partes) o revisa los datos.`);
                    continue;
                }
                faltantes.push(c);
            }
            for (const c of esquema) {
                const d = datoDeParteEnRuta(c.path, c.ambito ?? []);
                if (!d?.relativo || !d.rol || !c.requerido) continue;
                const personas = leerRuta(base, d.rol);
                if (!Array.isArray(personas) || personas.length === 0) continue;
                const sin = personas.filter((p) => sinValor(leerRuta(p, `datos.${d.clave}`))).length;
                if (sin > 0) {
                    avisos.push(`Falta «${c.etiqueta}» en ${sin} de ${personas.length} (${d.rol.replace(/_/g, ' ')}): complétalo en el expediente, pestaña Partes → Datos, o la generación se detendrá.`);
                }
            }
            setError(null);
            setPaso({ n: 'formulario', b: { modelo: modeloSel, titulo: tituloFinal, faltantes, avisos, valores: {} } });
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    async function revisar(ev: FormEvent<HTMLFormElement>, b: Borrador) {
        ev.preventDefault();
        const f = datosDeForm(ev.currentTarget);
        const datos: Record<string, unknown> = {};
        const caso: Record<string, string> = {};
        for (const c of b.faltantes) {
            const crudo = f[c.path];
            if (crudo === undefined) continue;
            const valor = NUMERICOS.has(c.tipo) ? normalizarNumero(crudo) : crudo;
            asignarRuta(datos, rutaNormal(c.path), valor);
            const segs = c.path.split('.');
            if (esCampoCaso(c.path) && segs.length === 2) caso[claveCampo(segs[1])] = valor;
        }
        setTrabajando(true);
        try {
            const preparado = await s.generarDocumento.preparar(expediente.id, b.modelo.versionId, datos, b.titulo);
            const vista = await armarVista(s, preparado, b.modelo.versionId);
            setError(null);
            setPaso({ n: 'verificar', b: { ...b, valores: f }, preparado, caso, vista, original: null, modeloNuevo: null });
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    /* ----- editar el documento a mano ----- */
    async function iniciarEdicion(p: DatosVerificar) {
        if (!p.vista.editable && !p.original) {
            const ok = await confirmar(
                'Este modelo viene de Word. Al editar aquí se simplifica el formato: se pierden encabezados, pies, tablas e imágenes y se usa la página estándar. Si necesitas conservarlos, genera el documento y edítalo en Word («Adjuntar versión editada»). ¿Editar de todos modos?',
                'Editar documento',
            );
            if (!ok) return;
        }
        setError(null);
        setEditando(true);
    }

    async function aplicarEdicion(p: DatosVerificar, texto: string, config: ConfigPagina) {
        const base: Original = p.original ?? { preparado: p.preparado, vista: p.vista };
        const sinCambios = mismoTexto(bloquesATexto(base.vista.bloques), texto)
            && margenesIguales(base.vista.config.margenes, config.margenes);
        if (sinCambios) {
            // Vuelve al documento original tal cual (con sus fuentes incrustadas).
            setPaso({ ...p, preparado: base.preparado, vista: base.vista, original: null });
            setEditando(false);
            avisar('No hubo cambios en el documento', 'info');
            return;
        }
        setTrabajando(true);
        try {
            const fuente: FuenteModelo = { version: 1, config, texto, campos: [] };
            const nuevo = await s.generarDocumento.conTextoEditado(base.preparado, fuente);
            const vista: VistaPrevia = { ...base.vista, bloques: parsearTexto(texto), config, hallazgos: revisarTexto(nuevo.texto) };
            setPaso({ ...p, preparado: nuevo, vista, original: base });
            setEditando(false);
            setError(null);
            avisar('Cambios aplicados al documento');
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    async function restaurar(p: DatosVerificar) {
        if (!p.original) return;
        if (!(await confirmar('Se descartarán las ediciones hechas a mano. ¿Volver al documento original?', 'Volver al original'))) return;
        setPaso({ ...p, preparado: p.original.preparado, vista: p.original.vista, original: null });
        setError(null);
    }

    /* ----- llevar los cambios al modelo ----- */
    async function abrirActualizarModelo(p: DatosVerificar) {
        if (!p.original) return;
        setAnalizando(true);
        try {
            const valores = p.original.preparado.verificacion
                .filter((v) => !v.opcionalVacio && v.valor)
                .map((v) => v.valor);
            const analisis = await s.actualizarModelo.analizar(
                p.b.modelo.versionId,
                p.original.preparado.datos,
                bloquesATexto(p.original.vista.bloques),
                bloquesATexto(p.vista.bloques),
                valores,
            );
            setError(null);
            setDlg({ analisis, versionId: p.b.modelo.versionId, modelo: p.b.modelo });
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setAnalizando(false);
        }
    }

    function modeloActualizado(r: ResultadoImportacion) {
        setDlg(null);
        modelos.recargar();
        setSel(r.modeloVersionId);
        // El documento queda ligado a la versión nueva y deja de contar como «editado»: ya es lo que dice el modelo.
        cambiarVerificacion((p) => ({
            ...p,
            b: { ...p.b, modelo: { ...p.b.modelo, versionId: r.modeloVersionId, version: r.version } },
            preparado: { ...p.preparado, modeloVersionId: r.modeloVersionId },
            original: null,
            modeloNuevo: r.version,
        }));
        avisar(`Modelo actualizado: versión ${r.version}`);
    }

    async function generar(p: DatosVerificar) {
        setTrabajando(true);
        try {
            const v = await s.generarDocumento.guardar(p.preparado);
            if (guardarCaso && Object.keys(p.caso).length > 0) {
                try {
                    await s.actualizarExpediente.ejecutar(expediente.id, { datos: { ...expediente.datos, ...p.caso } });
                } catch (err) {
                    avisar(`El documento se generó, pero no se guardaron los datos en el expediente: ${mensajeError(err)}`, 'error');
                }
            }
            setError(null);
            avisar(`Documento generado (v${pad(v.numero)})`);
            setPaso({ n: 'listo', ruta: v.ruta, numero: v.numero });
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    async function volverAlFormulario(p: DatosVerificar) {
        if (p.original && !(await confirmar('Al volver se perderán las ediciones hechas a mano en este documento. ¿Volver?', 'Volver'))) return;
        setError(null);
        setPaso({ n: 'formulario', b: p.b });
    }

    async function cerrarSeguro() {
        if (dlg) return;
        const sinGuardar = editando || (paso.n === 'verificar' && paso.original !== null);
        if (sinGuardar && !(await confirmar('Hay ediciones sin guardar en este documento. ¿Salir y descartarlas?', 'Salir'))) return;
        cerrar();
    }

    const abrir = (ruta: string) => s.archivos.abrir(ruta).catch((e) => setError(mensajeError(e)));
    const mostrar = (ruta: string) => s.archivos.mostrarEnCarpeta(ruta).catch((e) => setError(mensajeError(e)));

    /* ----- pie según el paso ----- */
    let pie: ReactNode;
    if (paso.n === 'elegir') {
        pie = (
            <>
                <span className="espacio" />
                <button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button>
                <button type="button" className="btn btn-pri" disabled={!modeloSel || trabajando} onClick={() => void continuar()}>
                    {trabajando ? 'Preparando…' : 'Continuar'}
                </button>
            </>
        );
    } else if (paso.n === 'formulario') {
        pie = (
            <>
                <span className="espacio" />
                <button type="button" className="btn btn-sec" onClick={() => { setError(null); setPaso({ n: 'elegir' }); }}>Atrás</button>
                <button type="submit" form="form-asistente" className="btn btn-pri" disabled={trabajando}>
                    {trabajando ? 'Preparando vista previa…' : 'Ver vista previa'}
                </button>
            </>
        );
    } else if (paso.n === 'verificar') {
        const p = paso;
        pie = editando ? (
            <>
                <span className="suave">Estás editando: pulsa «Aplicar al documento» para volver a la vista previa.</span>
                <span className="espacio" />
            </>
        ) : (
            <>
                <span className="espacio" />
                <button type="button" className="btn btn-sec" disabled={trabajando || analizando} onClick={() => void volverAlFormulario(p)}>Atrás</button>
                <button type="button" className="btn btn-pri" disabled={trabajando || analizando} onClick={() => void generar(p)}>
                    {trabajando ? 'Generando…' : 'Generar documento'}
                </button>
            </>
        );
    } else {
        const ruta = paso.ruta;
        pie = (
            <>
                <button type="button" className="btn btn-sec" onClick={() => void abrir(ruta)}>Abrir</button>
                <button type="button" className="btn btn-sec" onClick={() => void mostrar(ruta)}>Mostrar en carpeta</button>
                <span className="espacio" />
                <button type="button" className="btn btn-pri" onClick={cerrar}>Terminar</button>
            </>
        );
    }

    const actual = INDICE[paso.n];

    return (
        <>
            <Modal titulo="Nuevo documento" ancho="grande" cerrar={() => void cerrarSeguro()} pie={pie}>
                <p className="suave">Expediente <code>{expediente.codigo}</code> · {expediente.materia}</p>

                <div className="pasos">
                    {ETAPAS.map((e, i) => (
                        <div key={e} className={`paso${i === actual ? ' activo' : i < actual ? ' hecho' : ''}`}>
                            <i>{i < actual ? '✓' : i + 1}</i>{e}
                        </div>
                    ))}
                </div>

                <Aviso error={error ?? modelos.error} />

                {/* ===== 1. Elegir modelo ===== */}
                {paso.n === 'elegir' && (
                    <>
                        {modelos.datos && modelos.datos.length === 0 ? (
                            <Alerta tipo="info">Aún no hay modelos activos. Crea o instala uno en la sección Modelos.</Alerta>
                        ) : (
                            <>
                                <input type="search" placeholder="Buscar modelo…" value={q} onChange={(e) => setQ(e.target.value)} />
                                <div className="lista-opciones">
                                    {ordenados.map((m) => (
                                        <button
                                            key={m.versionId}
                                            type="button"
                                            className={`opcion${m.versionId === sel ? ' sel' : ''}`}
                                            onClick={() => setSel(m.versionId)}
                                        >
                                            <div style={{ flex: 1 }}>
                                                <div className="fila-chica">
                                                    {m.categoria && <Insignia tono="azul">{m.categoria}</Insignia>}
                                                    {m.materia === expediente.tipo && <Insignia tono="verde">Recomendado</Insignia>}
                                                </div>
                                                <b>{m.nombre}</b>
                                                <span className="suave">{m.descripcion || `v${m.version} · ${m.numCampos} campos`}</span>
                                            </div>
                                        </button>
                                    ))}
                                    {ordenados.length === 0 && modelos.datos && <p className="suave">Sin resultados.</p>}
                                </div>
                                <Campo
                                    etiqueta="Título del documento"
                                    ayuda="Si ya existe un documento con este título, se guarda como una versión nueva."
                                >
                                    <input
                                        value={titulo}
                                        onChange={(e) => setTitulo(e.target.value)}
                                        placeholder={modeloSel?.nombre ?? 'Por defecto, el nombre del modelo'}
                                    />
                                </Campo>
                                {existente && (
                                    <Alerta tipo="info">
                                        Ya existe «{existente.titulo}» con {existente.versiones.length} versión(es): se guardará como v{pad(proxima)}.
                                    </Alerta>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* ===== 2. Datos faltantes ===== */}
                {paso.n === 'formulario' && (
                    <>
                        {paso.b.avisos.map((a) => <Alerta key={a} tipo="adv">{a}</Alerta>)}
                        {paso.b.faltantes.length === 0 ? (
                            <Alerta tipo="ok">No falta ningún dato: todo se completará desde el expediente.</Alerta>
                        ) : (
                            <p className="suave">Estos datos no están en el expediente. Complétalos para generar el documento.</p>
                        )}
                        <form id="form-asistente" className="form-grid" onSubmit={(ev) => void revisar(ev, paso.b)}>
                            {paso.b.faltantes.map((c) => (
                                <Campo
                                    key={c.path}
                                    etiqueta={`${c.etiqueta}${c.requerido ? ' *' : ' (opcional)'}`}
                                    ancho={esLargo(c)}
                                    ayuda={c.path}
                                >
                                    <Entrada c={c} valor={paso.b.valores[c.path] ?? ''} />
                                </Campo>
                            ))}
                        </form>
                        {paso.b.faltantes.some((c) => NUMERICOS.has(c.tipo)) && (
                            <p className="suave">Escribe los números como quieras: 15000,50 · 15.000,50 · 15000.50.</p>
                        )}
                        {paso.b.faltantes.some((c) => esCampoCaso(c.path) && c.path.split('.').length === 2) && (
                            <label className="casilla">
                                <input type="checkbox" checked={guardarCaso} onChange={(e) => setGuardarCaso(e.target.checked)} />
                                Guardar estos datos en el expediente para no volver a pedirlos
                            </label>
                        )}
                    </>
                )}

                {/* ===== 3. Revisar en limpio, editar y actualizar el modelo ===== */}
                {paso.n === 'verificar' && (
                    <PasoVerificar
                        p={paso}
                        editando={editando}
                        ocupado={trabajando || analizando}
                        editar={() => void iniciarEdicion(paso)}
                        descartar={() => setEditando(false)}
                        aplicar={(texto, config) => void aplicarEdicion(paso, texto, config)}
                        restaurar={() => void restaurar(paso)}
                        actualizarModelo={() => void abrirActualizarModelo(paso)}
                    />
                )}

                {/* ===== 4. Listo ===== */}
                {paso.n === 'listo' && (
                    <>
                        <Alerta tipo="ok">Documento generado (v{pad(paso.numero)}).</Alerta>
                        <p className="suave"><code>{paso.ruta}</code></p>
                    </>
                )}
            </Modal>

            {dlg && (
                <ActualizarModelo
                    modelo={dlg.modelo}
                    versionId={dlg.versionId}
                    analisis={dlg.analisis}
                    cerrar={() => setDlg(null)}
                    aplicado={modeloActualizado}
                />
            )}
        </>
    );
}