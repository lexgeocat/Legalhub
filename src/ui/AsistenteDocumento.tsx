// src/ui/AsistenteDocumento.tsx
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
    camposParaFormulario, esCampoCaso, esTextoLargo, fichaDeModelo, seccionesDeModelo,
} from '../application/camposModelo';
import type { ModeloVisible } from '../application/casosDeUso/administrarModelos';
import type { DocumentoPreparado } from '../application/casosDeUso/generarDocumento';
import type { ResultadoImportacion } from '../application/casosDeUso/importarModelo';
import type { ExpedienteResumen, ModeloResumen } from '../application/consultas';
import type { CampoEsquema, EntradaVerificacion } from '../application/puertos/motorPlantillas';
import { mismoRol } from '../domain/catalogo';
import { mismoTexto, type AnalisisModelo } from '../domain/edicionModelo';
import {
    bloquesATexto, margenesIguales, parsearTexto,
    type Bloque, type ConfigPagina, type FuenteModelo,
} from '../domain/fuenteModelo';
import { revisarTexto, type HallazgoTexto } from '../domain/revisionTexto';
import { asignarRuta, leerRuta } from '../domain/rutas';
import { claveCampo, claveNormalizada, etiquetaRol, pluralRol } from '../domain/texto';
import type { Servicios } from '../infrastructure/composicion';
import { ActualizarModelo } from './ActualizarModelo';
import {
    Alerta, Aviso, Campo, Icono, Insignia, Modal, Pestanas, avisar, confirmar, datosDeForm, normalizarNumero,
} from './comunes';
import { EditorDocumento } from './EdicionDocumento';
import { Hoja } from './Hoja';
import { mensajeError, useCargar, useServicios } from './servicios';

/* ---------------- Tipos ---------------- */
interface Pendiente { seccion: string; texto: string }

interface Analisis {
    detalle: ModeloVisible;
    /** Datos de las partes y del caso que faltan: se completan en la pestaña «Datos». */
    pendientes: Pendiente[];
    /** Datos que no son de las partes ni del caso (expediente, abogado…): se piden aquí. */
    otros: CampoEsquema[];
    /** Categoría (grupo del modelo) a la que pertenece una ruta de dato. */
    categoria: (ruta: string) => string;
    orden: string[];
    /** Pestaña del expediente donde se completa lo que falta. */
    destino: 'partes' | 'datos';
}

interface Borrador extends Analisis {
    modelo: ModeloResumen;
    titulo: string;
    valores: Record<string, string>;
}

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

const ETAPAS = ['Modelo', 'Revisar datos', 'Vista previa y edición', 'Generado'];
const INDICE: Record<Paso['n'], number> = { elegir: 0, formulario: 1, verificar: 2, listo: 3 };
const NUMERICOS = new Set(['moneda', 'dolares', 'superficie', 'numero']);
const PARTES = 'Datos de las partes';
const EXPEDIENTE = 'Expediente';
const OTROS = 'Otros datos';
const ALIAS_FICHA: Record<string, string> = { nombre_completo: 'nombre', ci_datos: 'ci' };

const sinValor = (v: unknown) => v === undefined || v === null || v === '';
const ultimo = (ruta: string) => ruta.split('.').pop() ?? ruta;
const rutaNormal = (ruta: string) => ruta.split('.').map(claveNormalizada).join('.');
const pad = (n: number) => String(n).padStart(2, '0');
const esLargo = (c: CampoEsquema) => c.tipo === 'texto_largo' || esTextoLargo(ultimo(c.path));

function agrupar<T>(items: readonly T[], clave: (x: T) => string, orden: readonly string[]): [string, T[]][] {
    const m = new Map<string, T[]>();
    for (const x of items) {
        const k = clave(x);
        m.set(k, [...(m.get(k) ?? []), x]);
    }
    const pos = (n: string) => {
        const i = orden.indexOf(n);
        return i < 0 ? 999 : i;
    };
    return [...m].sort((a, b) => pos(a[0]) - pos(b[0]));
}

/* ---------------- Qué falta para generar con este modelo ---------------- */
async function analizarModelo(s: Servicios, exp: ExpedienteResumen, m: ModeloResumen): Promise<Analisis> {
    const detalle = await s.verModelo.ejecutar(m.versionId);
    const ficha = fichaDeModelo(detalle.esquema, detalle.fuente?.partes ?? []);
    const secciones = seccionesDeModelo(ficha, detalle.fuente?.grupos ?? [], detalle.fuente?.campos ?? []);
    const base = await s.contexto.construir(exp.id, {});

    interface Info { sec: string; etiqueta: string }
    const casoSec = new Map<string, Info>();
    const fichaSec = new Map<string, Info>();
    const propioSec = new Map<string, Info>();
    for (const sec of secciones) {
        for (const c of sec.caso) casoSec.set(c.clave, { sec: sec.nombre, etiqueta: c.etiqueta });
        for (const d of sec.ficha) fichaSec.set(d.clave, { sec: sec.nombre, etiqueta: d.etiqueta });
        for (const d of sec.propios) propioSec.set(d.clave, { sec: sec.nombre, etiqueta: d.etiqueta });
    }

    const pendientes: Pendiente[] = [];
    let enPartes = false; // lo que falta se resuelve en «Partes» (quién interviene), no en «Datos»

    // 1) Partes: que exista alguien por rol y que tenga los datos que pide el modelo
    for (const rol of ficha.roles) {
        const lista = leerRuta(base, pluralRol(rol));
        const personas: unknown[] = Array.isArray(lista) ? lista : [];
        if (personas.length === 0) {
            pendientes.push({ seccion: PARTES, texto: `Falta registrar al ${etiquetaRol(rol).toLowerCase()}` });
            enPartes = true;
            continue;
        }
        personas.forEach((p, i) => {
            const quien = etiquetaRol(rol) + (personas.length > 1 ? ` ${i + 1}` : '');
            const g = leerRuta(p, 'genero');
            if (g !== 'M' && g !== 'F') {
                pendientes.push({ seccion: PARTES, texto: `${quien}: falta el género` });
                enPartes = true;
            }
            for (const u of ficha.fichaParte) {
                if (!u.requerido || !mismoRol(u.rol, rol) || !sinValor(leerRuta(p, u.clave))) continue;
                const d = fichaSec.get(u.clave);
                pendientes.push({ seccion: d?.sec ?? PARTES, texto: `${quien}: ${d?.etiqueta ?? etiquetaRol(u.clave)}` });
            }
            for (const d of ficha.datosParte) {
                if (!d.requerido || !mismoRol(d.rol, rol) || !sinValor(leerRuta(p, `datos.${d.clave}`))) continue;
                const x = propioSec.get(d.clave);
                pendientes.push({ seccion: x?.sec ?? PARTES, texto: `${quien}: ${x?.etiqueta ?? d.etiqueta}` });
            }
        });
    }
    // 2) Datos del caso
    for (const c of ficha.caso) {
        if (!c.requerido || !sinValor(leerRuta(base, `caso.${c.clave}`))) continue;
        pendientes.push({ seccion: casoSec.get(c.clave)?.sec ?? OTROS, texto: c.etiqueta });
    }

    // 3) Lo demás (expediente, cliente, abogado…)
    const otros: CampoEsquema[] = [];
    let clienteAvisado = false;
    for (const c of camposParaFormulario(detalle.esquema)) {
        if (!c.requerido || esCampoCaso(c.path)) continue;
        const raiz = c.path.split('.')[0];
        if (ficha.roles.some((r) => mismoRol(r, raiz))) continue;
        const actual = leerRuta(base, c.path);
        if (Array.isArray(actual)) {
            if (actual.length === 0) pendientes.push({ seccion: OTROS, texto: `«${c.path}» no tiene registros en este expediente` });
            continue;
        }
        if (!sinValor(actual)) continue;
        if (claveNormalizada(raiz) === 'cliente' && !exp.clienteId) {
            if (!clienteAvisado) {
                pendientes.push({ seccion: PARTES, texto: 'Falta definir al cliente (en «Partes», marca «Es mi cliente»)' });
                clienteAvisado = true;
                enPartes = true;
            }
            continue;
        }
        otros.push(c);
    }

    const categoria = (ruta: string): string => {
        const segs = ruta.split('.');
        const raiz = claveNormalizada(segs[0] ?? '');
        const ult = claveCampo(segs[segs.length - 1] ?? '');
        if (raiz === 'caso') return casoSec.get(claveCampo(segs[1] ?? ''))?.sec ?? OTROS;
        if (segs.some((x) => ficha.roles.some((r) => mismoRol(r, x)))) {
            if (segs.length >= 2 && claveNormalizada(segs[segs.length - 2]) === 'datos') return propioSec.get(ult)?.sec ?? PARTES;
            return fichaSec.get(ALIAS_FICHA[ult] ?? ult)?.sec ?? PARTES;
        }
        if (['expediente', 'cliente', 'abogado', 'hoy'].includes(raiz)) return EXPEDIENTE;
        return OTROS;
    };

    const orden = [...new Set([...secciones.map((x) => x.nombre), PARTES, EXPEDIENTE, OTROS])];
    return { detalle, pendientes, otros, categoria, orden, destino: enPartes ? 'partes' : 'datos' };
}

/** Prepara la vista previa con el MISMO .docx que se va a guardar. */
function armarVista(s: Servicios, p: DocumentoPreparado, d: ModeloVisible): VistaPrevia {
    let bloques: Bloque[] = [];
    try {
        bloques = s.lector.aBloques(p.docx);
    } catch {
        /* sin vista paginada: se muestra el texto plano */
    }
    return { bloques, config: d.config, editable: d.editable, hallazgos: revisarTexto(p.texto) };
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
function PasoVerificar({ p, proxima, existe, cambiarTitulo, editando, ocupado, editar, descartar, aplicar, restaurar, actualizarModelo }: {
    p: DatosVerificar;
    proxima: number;
    /** Ya hay un documento con este título (se guarda como versión nueva). */
    existe: boolean;
    cambiarTitulo: (t: string) => void;
    editando: boolean;
    ocupado: boolean;
    editar: () => void;
    descartar: () => void;
    aplicar: (texto: string, config: ConfigPagina) => void;
    restaurar: () => void;
    actualizarModelo: () => void;
}) {
    const [pestana, setPestana] = useState<PestanaVerif>('documento');
    const { preparado, vista, original, b } = p;
    const hayVacios = preparado.verificacion.some((v) => v.opcionalVacio);
    const grupos = useMemo(
        () => agrupar(preparado.verificacion, (v) => b.categoria(v.ruta), b.orden),
        [preparado.verificacion, b],
    );

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
            <div className="fila-chica" style={{ marginBottom: 0 }}>
                <Insignia tono="azul">{b.modelo.nombre}</Insignia>
                <Insignia>v{b.modelo.version}</Insignia>
            </div>

            <Campo
                etiqueta="Título del documento"
                ayuda={existe
                    ? `Ya existe un documento con este título: se guardará como versión v${pad(proxima)}.`
                    : 'Con este nombre se guarda y aparece en «Documentos».'}
            >
                <input value={b.titulo} placeholder={b.modelo.nombre} onChange={(e) => cambiarTitulo(e.target.value)} />
            </Campo>

            <Alerta tipo="info">
                Así quedará el documento. Todavía no se guardó nada: edítalo aquí mismo y, cuando esté listo, pulsa «Generar documento».
            </Alerta>
            {original && (
                <Alerta tipo="adv">
                    Editaste este documento a mano: se guardará con tus cambios. Si el cambio sirve para los próximos documentos, usa «Actualizar modelo».
                </Alerta>
            )}
            {b.modelo.version > 0 && p.modeloNuevo !== null && (
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
                <button type="button" className="btn btn-pri btn-sm" disabled={ocupado || vista.bloques.length === 0} onClick={editar}>
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
                    <div className="vista-hoja" style={{ height: 'min(58vh, 640px)', minHeight: 340 }}>
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
                        {grupos.map(([nombre, items]) => (
                            <div key={nombre}>
                                <h4 className="verif-grupo">{nombre}</h4>
                                <div className="tabla-wrap">
                                    <table className="tabla tabla-densa">
                                        <tbody>
                                            {items.map((v: EntradaVerificacion, i) => (
                                                <tr key={i}>
                                                    <td style={{ width: '38%' }}><code>{v.ruta}</code></td>
                                                    <td className="celda-larga">
                                                        {v.opcionalVacio ? <Insignia tono="ambar">Vacío (opcional)</Insignia> : v.valor}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </>
    );
}

/* ---------------- Asistente ---------------- */
export function AsistenteDocumento({ expediente, modeloInicial, irADatos, cerrar }: {
    expediente: ExpedienteResumen;
    /** Versión del modelo elegido en la pestaña «Modelo» del expediente. */
    modeloInicial?: string;
    /** Cierra el asistente y lleva a la pestaña donde se completa lo que falta. */
    irADatos: (destino: 'partes' | 'datos') => void;
    /** `generado`: se creó un documento (el expediente recarga la lista y muestra «Documentos»). */
    cerrar: (generado?: boolean) => void;
}) {
    const s = useServicios();
    const modelos = useCargar(() => s.consultas.listarModelos(), []);
    const docs = useCargar(() => s.consultas.listarDocumentos(expediente.id), [expediente.id]);
    const [sel, setSel] = useState(modeloInicial ?? '');
    const [cambiando, setCambiando] = useState(false);
    const [paso, setPaso] = useState<Paso>({ n: 'elegir' });
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);
    const [analizando, setAnalizando] = useState(false);
    const [editando, setEditando] = useState(false);
    const [dlg, setDlg] = useState<{ analisis: AnalisisModelo; versionId: string; modelo: ModeloResumen } | null>(null);
    const [titulo, setTitulo] = useState('');
    const [q, setQ] = useState('');
    const [auto, setAuto] = useState(!!modeloInicial);
    const arranque = useRef(false);

    const ordenados = useMemo(() => {
        const k = claveNormalizada(q.trim());
        const mismo = (m: ModeloResumen) => Number(m.materia === expediente.tipo);
        return (modelos.datos ?? [])
            .filter((m) => !k || claveNormalizada(`${m.nombre} ${m.descripcion} ${m.categoria}`).includes(k))
            .sort((a, b) => mismo(b) - mismo(a) || a.nombre.localeCompare(b.nombre, 'es'));
    }, [modelos.datos, q, expediente.tipo]);

    const modeloSel = modelos.datos?.find((m) => m.versionId === sel);
    const tituloFinal = titulo.trim() || modeloSel?.nombre || '';
    const tituloVigente = paso.n === 'verificar' ? (paso.b.titulo.trim() || paso.b.modelo.nombre) : tituloFinal;
    const existente = docs.datos?.find((d) => d.titulo === tituloVigente);
    const proxima = existente ? Math.max(0, ...existente.versiones.map((v) => v.nro)) + 1 : 1;

    const cambiarVerificacion = (f: (p: DatosVerificar) => DatosVerificar) =>
        setPaso((prev) => (prev.n === 'verificar' ? f(prev) : prev));

    const cambiarTitulo = (t: string) => cambiarVerificacion((p) => ({ ...p, b: { ...p.b, titulo: t } }));

    // Si el expediente ya tiene modelo se salta el paso «Modelo»: se revisa lo que falta y se va directo a la vista previa.
    useEffect(() => {
        if (arranque.current || !modeloInicial || !modelos.datos) return;
        arranque.current = true;
        const m = modelos.datos.find((x) => x.versionId === modeloInicial);
        if (m) void continuar(m);
        else setAuto(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modelos.datos]);

    /** Renderiza en memoria con el MISMO .docx que se guardará. Lanza ErrorDeDatos si falta algo. */
    async function prepararVista(b: Borrador, datos: Record<string, unknown>) {
        const preparado = await s.generarDocumento.preparar(expediente.id, b.modelo.versionId, datos, b.titulo);
        setPaso({ n: 'verificar', b, preparado, vista: armarVista(s, preparado, b.detalle), original: null, modeloNuevo: null });
    }

    async function continuar(m: ModeloResumen | undefined = modeloSel) {
        if (!m) return;
        setTrabajando(true);
        try {
            // El modelo del asistente pasa a ser el del expediente: así «Datos» pide lo mismo.
            if (m.id !== expediente.modeloId) {
                await s.actualizarExpediente.ejecutar(expediente.id, { modeloId: m.id });
            }
            const a = await analizarModelo(s, expediente, m);
            const b: Borrador = { ...a, modelo: m, titulo: titulo.trim() || m.nombre, valores: {} };
            setError(null);
            if (a.pendientes.length === 0 && a.otros.length === 0) await prepararVista(b, {});
            else setPaso({ n: 'formulario', b });
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
            setAuto(false);
        }
    }

    async function revisar(ev: FormEvent<HTMLFormElement>, b: Borrador) {
        ev.preventDefault();
        if (b.pendientes.length > 0) return;
        const f = datosDeForm(ev.currentTarget);
        const datos: Record<string, unknown> = {};
        for (const c of b.otros) {
            const crudo = f[c.path];
            if (crudo === undefined) continue;
            asignarRuta(datos, rutaNormal(c.path), NUMERICOS.has(c.tipo) ? normalizarNumero(crudo) : crudo);
        }
        setTrabajando(true);
        try {
            await prepararVista({ ...b, valores: f }, datos);
            setError(null);
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
        cambiarVerificacion((p) => ({
            ...p,
            b: { ...p.b, modelo: { ...p.b.modelo, versionId: r.modeloVersionId, version: r.version } },
            preparado: { ...p.preparado, modeloVersionId: r.modeloVersionId },
            original: null,
            modeloNuevo: r.version,
        }));
        avisar(`Modelo actualizado: versión ${r.version}`);
    }

    /* ----- generar ----- */
    async function generar(p: DatosVerificar) {
        setTrabajando(true);
        try {
            const tituloDoc = p.b.titulo.trim() || p.b.modelo.nombre;
            const v = await s.generarDocumento.guardar({ ...p.preparado, titulo: tituloDoc });
            setError(null);
            docs.recargar();
            avisar(`Documento generado (v${pad(v.numero)})`);
            setPaso({ n: 'listo', ruta: v.ruta, numero: v.numero });
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    async function volverAtras(p: DatosVerificar) {
        if (p.original && !(await confirmar('Al volver se perderán las ediciones hechas a mano en este documento. ¿Volver?', 'Volver'))) return;
        setError(null);
        setTitulo(p.b.titulo);
        const hayAlgo = p.b.pendientes.length > 0 || p.b.otros.length > 0;
        setPaso(hayAlgo ? { n: 'formulario', b: p.b } : { n: 'elegir' });
    }

    async function cerrarSeguro() {
        if (dlg) return;
        if (paso.n === 'listo') {
            cerrar(true);
            return;
        }
        const sinGuardar = editando || (paso.n === 'verificar' && paso.original !== null);
        if (sinGuardar && !(await confirmar('Hay ediciones sin guardar en este documento. ¿Salir y descartarlas?', 'Salir'))) return;
        cerrar(false);
    }

    const abrir = (ruta: string) => s.archivos.abrir(ruta).catch((e) => setError(mensajeError(e)));
    const mostrar = (ruta: string) => s.archivos.mostrarEnCarpeta(ruta).catch((e) => setError(mensajeError(e)));

    const preparando = auto && !modelos.error;

    /* ----- pie según el paso ----- */
    let pie: ReactNode;
    if (paso.n === 'elegir') {
        pie = (
            <>
                <span className="espacio" />
                <button type="button" className="btn btn-sec" onClick={() => cerrar(false)}>Cancelar</button>
                <button type="button" className="btn btn-pri" disabled={!modeloSel || trabajando || preparando} onClick={() => void continuar()}>
                    {trabajando ? 'Revisando datos…' : 'Continuar a la vista previa'}
                </button>
            </>
        );
    } else if (paso.n === 'formulario') {
        const hayPend = paso.b.pendientes.length > 0;
        const destino = paso.b.destino;
        pie = (
            <>
                <span className="espacio" />
                <button type="button" className="btn btn-sec" onClick={() => { setError(null); setPaso({ n: 'elegir' }); }}>Atrás</button>
                {hayPend ? (
                    <button type="button" className="btn btn-pri" onClick={() => irADatos(destino)}>
                        {destino === 'partes' ? 'Completar las partes' : 'Completar los datos del caso'}
                    </button>
                ) : (
                    <button type="submit" form="form-asistente" className="btn btn-pri" disabled={trabajando}>
                        {trabajando ? 'Preparando vista previa…' : 'Ver vista previa'}
                    </button>
                )}
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
                <button type="button" className="btn btn-sec" disabled={trabajando || analizando} onClick={() => void volverAtras(p)}>Atrás</button>
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
                <button type="button" className="btn btn-pri" onClick={() => cerrar(true)}>Ver en Documentos</button>
            </>
        );
    }

    const actual = INDICE[paso.n];

    return (
        <>
            <Modal titulo="Nuevo documento" ancho={editando ? 'completa' : 'grande'} cerrar={() => void cerrarSeguro()} pie={pie}>
                <p className="suave">Expediente <code>{expediente.codigo}</code> · {expediente.materia}</p>

                <div className="pasos">
                    {ETAPAS.map((e, i) => (
                        <div key={e} className={`paso${i === actual ? ' activo' : i < actual ? ' hecho' : ''}`}>
                            <i>{i < actual ? '✓' : i + 1}</i>{e}
                        </div>
                    ))}
                </div>

                <Aviso error={error ?? modelos.error} />

                {/* ===== 1. Modelo y título ===== */}
                {paso.n === 'elegir' && preparando && (
                    <p className="suave">Preparando el documento con los datos del expediente…</p>
                )}
                {paso.n === 'elegir' && !preparando && (
                    modelos.datos && modelos.datos.length === 0 ? (
                        <Alerta tipo="info">Aún no hay modelos activos. Crea o instala uno en la sección Modelos.</Alerta>
                    ) : (
                        <>
                            {modeloSel && !cambiando ? (
                                <div className="opcion sel" style={{ cursor: 'default' }}>
                                    <div style={{ flex: 1 }}>
                                        <div className="fila-chica">
                                            {modeloSel.categoria && <Insignia tono="azul">{modeloSel.categoria}</Insignia>}
                                            <Insignia tono="violeta">
                                                {modeloSel.id === expediente.modeloId ? 'Modelo del expediente' : 'Elegido'}
                                            </Insignia>
                                        </div>
                                        <b>{modeloSel.nombre}</b>
                                        <span className="suave">{modeloSel.descripcion || `v${modeloSel.version} · ${modeloSel.numCampos} campos`}</span>
                                    </div>
                                    <button type="button" className="btn btn-sec btn-sm" onClick={() => setCambiando(true)}>Cambiar modelo</button>
                                </div>
                            ) : (
                                <>
                                    <input type="search" placeholder="Buscar modelo…" value={q} onChange={(e) => setQ(e.target.value)} />
                                    <div className="lista-opciones">
                                        {ordenados.map((m) => (
                                            <button
                                                key={m.versionId}
                                                type="button"
                                                className={`opcion${m.versionId === sel ? ' sel' : ''}`}
                                                onClick={() => { setSel(m.versionId); setCambiando(false); }}
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
                                    {modeloSel && (
                                        <div>
                                            <button type="button" className="btn btn-fan btn-sm" onClick={() => setCambiando(false)}>
                                                Mantener «{modeloSel.nombre}»
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

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
                    )
                )}

                {/* ===== 2. Revisar datos: lo que falta va por categorías; aquí no se vuelve a pedir ===== */}
                {paso.n === 'formulario' && (
                    paso.b.pendientes.length > 0 ? (
                        <>
                            <Alerta tipo="adv">
                                Para generar «{paso.b.modelo.nombre}» faltan {paso.b.pendientes.length} dato(s) del expediente.
                                Se llenan una sola vez en las pestañas «Partes» y «Datos» (formulario o sobre el documento), ordenados por categoría.
                            </Alerta>
                            {agrupar(paso.b.pendientes, (x) => x.seccion, paso.b.orden).map(([nombre, items]) => (
                                <div key={nombre}>
                                    <h4 className="grupo-titulo">{nombre}</h4>
                                    {items.map((x, i) => (
                                        <div key={i} className="chk-fila">
                                            <span>{x.texto}</span>
                                            <Insignia tono="ambar">Falta</Insignia>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </>
                    ) : (
                        <>
                            <Alerta tipo="ok">Las partes y los datos del caso están completos.</Alerta>
                            <p className="suave">
                                Estos datos no son de las partes ni del caso (salen del expediente o de Configuración). Complétalos para generar el documento.
                            </p>
                            <form id="form-asistente" className="form-grid" onSubmit={(ev) => void revisar(ev, paso.b)}>
                                {paso.b.otros.map((c) => (
                                    <Campo key={c.path} etiqueta={`${c.etiqueta} *`} ancho={esLargo(c)} ayuda={c.path}>
                                        <Entrada c={c} valor={paso.b.valores[c.path] ?? ''} />
                                    </Campo>
                                ))}
                            </form>
                            {paso.b.otros.some((c) => NUMERICOS.has(c.tipo)) && (
                                <p className="suave">Escribe los números como quieras: 15000,50 · 15.000,50 · 15000.50.</p>
                            )}
                        </>
                    )
                )}

                {/* ===== 3. Vista previa, edición y actualizar el modelo ===== */}
                {paso.n === 'verificar' && (
                    <PasoVerificar
                        p={paso}
                        proxima={proxima}
                        existe={!!existente}
                        cambiarTitulo={cambiarTitulo}
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
                        <Alerta tipo="ok">
                            Documento generado (v{pad(paso.numero)}). Ya aparece en la pestaña «Documentos» del expediente.
                        </Alerta>
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