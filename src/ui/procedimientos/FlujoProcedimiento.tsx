import { save } from '@tauri-apps/plugin-dialog';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { nombreSeguro } from '../domain/nombreArchivo';
import {
    ETIQUETA_PASO, TIPOS_PASO, calcularFlujo, caminoHasta, flujoBase, nuevoPaso, revisarFlujo, sinPaso,
    type HallazgoFlujo, type Paso, type Requisito, type Salida, type TipoPaso,
} from '../domain/procedimientos';
import { Alerta, Aviso, Campo, Icono, Insignia, Modal, Segmentado, Vacio, avisar, confirmar } from './_core/comunes';
import { COLOR_PASO, Flujograma } from './Flujograma';
import { mensajeError, useServicios } from './_core/servicios';
import './procedimientos.css';

type Modo = 'editar' | 'recorrer';

const nombresDe = (ids: readonly string[], requisitos: readonly Requisito[]): Requisito[] =>
    ids.map((id) => requisitos.find((r) => r.id === id)).filter((r): r is Requisito => !!r);

export function FlujoProcedimiento({ nombre, pasos, carriles, requisitos, responsables, cambiarPasos, cambiarCarriles }: {
    nombre: string;
    pasos: Paso[];
    carriles: string[];
    requisitos: Requisito[];
    responsables: string[];
    cambiarPasos: (p: Paso[]) => void;
    cambiarCarriles: (c: string[]) => void;
}) {
    const s = useServicios();
    const svg = useRef<SVGSVGElement>(null);
    const lienzo = useRef<HTMLDivElement>(null);
    const [ancho, setAncho] = useState(0);
    const [zoom, setZoom] = useState<number | null>(null); // null = ajustar al ancho
    const [modo, setModo] = useState<Modo>('editar');
    const [sel, setSel] = useState<string | null>(null);
    const [recorrido, setRecorrido] = useState<string[]>([]);
    const [dlg, setDlg] = useState<{ paso: Paso | null; desde?: Paso } | null>(null);
    const [exportando, setExportando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mapa = useMemo(() => new Map(pasos.map((p) => [p.id, p] as const)), [pasos]);
    const disp = useMemo(() => calcularFlujo(pasos, carriles), [pasos, carriles]);
    const hallazgos = useMemo(() => revisarFlujo(pasos), [pasos]);
    const paso = sel ? mapa.get(sel) ?? null : null;
    const ruta = useMemo(() => recorrido.filter((id) => mapa.has(id)), [recorrido, mapa]);
    const actualRec = modo === 'recorrer' ? ruta[ruta.length - 1] ?? null : null;

    useEffect(() => {
        const el = lienzo.current;
        if (!el) return;
        const medir = () => setAncho(el.clientWidth);
        medir();
        const o = new ResizeObserver(medir);
        o.observe(el);
        return () => o.disconnect();
    }, []);

    const fit = ancho > 0 && disp.ancho > 0 ? (ancho - 24) / disp.ancho : 1;
    const escala = zoom ?? Math.min(1.15, Math.max(0.4, fit));

    function centrar(id: string) {
        const n = disp.nodos.find((x) => x.id === id);
        const el = lienzo.current;
        if (!n || !el) return;
        el.scrollTo({
            left: Math.max(0, (n.x + n.w / 2) * escala - el.clientWidth / 2),
            top: Math.max(0, (n.y + n.h / 2) * escala - el.clientHeight / 2),
            behavior: 'smooth',
        });
    }

    useEffect(() => {
        if (actualRec) centrar(actualRec);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actualRec]);

    /* ----- resaltado: camino hasta el paso elegido, o lo recorrido ----- */
    const resalte = useMemo(() => {
        const vacio = { nodos: new Set<string>(), aristas: new Set<string>() };
        if (exportando) return vacio;
        if (modo === 'recorrer') {
            return { nodos: new Set(ruta), aristas: new Set(ruta.slice(1).map((id, i) => `${ruta[i]}>${id}`)) };
        }
        return sel && mapa.has(sel) ? caminoHasta(disp.enlaces, sel) : vacio;
    }, [exportando, modo, ruta, sel, mapa, disp.enlaces]);
    const actual = exportando ? null : modo === 'recorrer' ? actualRec : paso?.id ?? null;

    /* ----- acciones ----- */
    function iniciar() {
        const ini = pasos.find((p) => p.tipo === 'inicio') ?? pasos[0];
        setRecorrido(ini ? [ini.id] : []);
    }

    function cambiarModo(m: Modo) {
        setModo(m);
        if (m === 'recorrer') {
            iniciar();
            setSel(null);
        }
    }

    function alElegir(id: string | null) {
        if (modo === 'editar') {
            setSel(id);
            return;
        }
        if (!id) return;
        const ult = mapa.get(ruta[ruta.length - 1] ?? '');
        if (ult?.siguientes.some((x) => x.a === id)) {
            setRecorrido([...ruta, id]);
            return;
        }
        const i = ruta.indexOf(id);
        if (i >= 0) setRecorrido(ruta.slice(0, i + 1));
    }

    function guardarPaso(p: Paso, desde?: { id: string; etiqueta: string }) {
        let lista = pasos.some((x) => x.id === p.id) ? pasos.map((x) => (x.id === p.id ? p : x)) : [...pasos, p];
        if (desde) {
            lista = lista.map((x) => (x.id === desde.id && !x.siguientes.some((e) => e.a === p.id)
                ? { ...x, siguientes: [...x.siguientes, { a: p.id, etiqueta: desde.etiqueta }] }
                : x));
        }
        cambiarPasos(lista);
        setSel(p.id);
        setDlg(null);
    }

    async function quitarPaso(p: Paso) {
        const ok = await confirmar(`¿Quitar el paso «${p.titulo}»? También se eliminan las conexiones que llegan a él.`, 'Quitar paso');
        if (!ok) return;
        cambiarPasos(sinPaso(pasos, p.id));
        setSel(null);
    }

    function moverCarril(i: number, d: -1 | 1) {
        const nombres = disp.carriles.map((c) => c.nombre);
        const j = i + d;
        if (j < 0 || j >= nombres.length) return;
        [nombres[i], nombres[j]] = [nombres[j], nombres[i]];
        cambiarCarriles(nombres);
    }

    function ajustarZoom(d: number) {
        setZoom(Math.min(2, Math.max(0.25, Math.round((escala + d) * 100) / 100)));
    }

    async function exportar() {
        if (!svg.current) return;
        try {
            flushSync(() => setExportando(true)); // se dibuja sin resaltados
            const clon = svg.current?.cloneNode(true) as SVGSVGElement | undefined;
            setExportando(false);
            if (!clon) return;
            clon.setAttribute('width', String(Math.ceil(disp.ancho)));
            clon.setAttribute('height', String(Math.ceil(disp.alto)));
            const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clon)}`;
            const destino = await save({
                defaultPath: `${nombreSeguro(nombre.trim() || 'Flujograma')}.svg`,
                filters: [{ name: 'Imagen SVG', extensions: ['svg'] }],
            });
            if (!destino) return;
            await s.archivos.escribir(destino, new TextEncoder().encode(xml));
            setError(null);
            avisar('Flujograma exportado');
        } catch (e) {
            setExportando(false);
            setError(mensajeError(e));
        }
    }

    const irA = (id: string) => {
        setSel(id);
        centrar(id);
    };

    return (
        <div className="fl-layout">
            <div className="fl-escena">
                <div className="fl-barra">
                    <Segmentado<Modo>
                        valor={modo}
                        cambiar={cambiarModo}
                        opciones={[{ id: 'editar', etiqueta: 'Editar' }, { id: 'recorrer', etiqueta: 'Recorrer paso a paso' }]}
                    />
                    {modo === 'editar' && (
                        <button type="button" className="btn btn-sec btn-sm" onClick={() => setDlg({ paso: null })}>
                            <Icono n="mas" tam={14} /> Paso
                        </button>
                    )}
                    <span className="espacio" />
                    <button type="button" className="btn btn-fan btn-sm" aria-label="Reducir" onClick={() => ajustarZoom(-0.1)}>−</button>
                    <span className="suave">{Math.round(escala * 100)} %</span>
                    <button type="button" className="btn btn-fan btn-sm" aria-label="Ampliar" onClick={() => ajustarZoom(0.1)}>+</button>
                    <button type="button" className="btn btn-fan btn-sm" onClick={() => setZoom(null)}>Ajustar</button>
                    <button type="button" className="btn btn-sec btn-sm" disabled={pasos.length === 0} onClick={() => void exportar()}>Exportar SVG</button>
                </div>

                <Aviso error={error} />

                <div className="fl-lienzo" ref={lienzo}>
                    {pasos.length === 0 ? (
                        <Vacio
                            icono="flujo"
                            titulo="Aún no hay flujograma"
                            texto="Dibújalo paso a paso: cada paso tiene un responsable (carril), un tipo y sus salidas. También puedes partir de un esquema básico."
                        >
                            <button type="button" className="btn btn-pri" onClick={() => { cambiarPasos(flujoBase()); }}>Empezar con inicio y fin</button>
                            <button type="button" className="btn btn-sec" onClick={() => setDlg({ paso: null })}>Agregar el primer paso</button>
                        </Vacio>
                    ) : (
                        <Flujograma
                            disp={disp} pasos={pasos} actual={actual} nodosOn={resalte.nodos} aristasOn={resalte.aristas}
                            escala={escala} svgRef={svg} onElegir={alElegir}
                        />
                    )}
                </div>
            </div>

            <aside className="fl-lateral">
                {modo === 'recorrer' ? (
                    <PanelRecorrido
                        ruta={ruta} mapa={mapa} requisitos={requisitos}
                        avanzar={(id) => setRecorrido([...ruta, id])}
                        atras={() => setRecorrido(ruta.slice(0, -1))}
                        reiniciar={iniciar}
                        saltar={(i) => setRecorrido(ruta.slice(0, i + 1))}
                    />
                ) : paso ? (
                    <PanelPaso
                        paso={paso} pasos={pasos} mapa={mapa} requisitos={requisitos} ir={irA}
                        editar={() => setDlg({ paso })}
                        agregar={() => setDlg({ paso: null, desde: paso })}
                        quitar={() => void quitarPaso(paso)}
                    />
                ) : (
                    <PanelGeneral
                        pasos={pasos} hallazgos={hallazgos} carriles={disp.carriles.map((c) => c.nombre)}
                        ir={irA} moverCarril={moverCarril}
                    />
                )}
            </aside>

            {dlg && (
                <ModalPaso
                    inicial={dlg.paso} desde={dlg.desde} pasos={pasos} requisitos={requisitos} responsables={responsables}
                    guardar={guardarPaso} cerrar={() => setDlg(null)}
                />
            )}
        </div>
    );
}

/* ================= Panel: paso elegido ================= */
function PanelPaso({ paso, pasos, mapa, requisitos, ir, editar, agregar, quitar }: {
    paso: Paso;
    pasos: readonly Paso[];
    mapa: ReadonlyMap<string, Paso>;
    requisitos: readonly Requisito[];
    ir: (id: string) => void;
    editar: () => void;
    agregar: () => void;
    quitar: () => void;
}) {
    const entradas = pasos.filter((p) => p.siguientes.some((x) => x.a === paso.id));
    const reqs = nombresDe(paso.requisitos, requisitos);
    const col = COLOR_PASO[paso.tipo];
    return (
        <div className="tarjeta fl-panel-paso">
            <div>
                <span className="fl-tipo" style={{ background: col.fondo, borderColor: col.borde }}>{ETIQUETA_PASO[paso.tipo]}</span>
                <h3>{paso.titulo}</h3>
                <p className="suave">
                    {[paso.responsable, paso.plazo && `Plazo: ${paso.plazo}`].filter(Boolean).join(' · ') || 'Sin responsable ni plazo'}
                </p>
            </div>

            <div className="acciones">
                <button type="button" className="btn btn-sec btn-sm" onClick={editar}><Icono n="editar" tam={14} /> Editar</button>
                {paso.tipo !== 'fin' && (
                    <button type="button" className="btn btn-pri btn-sm" onClick={agregar}><Icono n="mas" tam={14} /> Paso siguiente</button>
                )}
                <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar paso" title="Quitar paso" onClick={quitar}>
                    <Icono n="papelera" tam={15} />
                </button>
            </div>

            {paso.detalle && <p className="fl-texto">{paso.detalle}</p>}
            {paso.baseLegal && (
                <div>
                    <h4 className="grupo-titulo">Base legal</h4>
                    <p className="fl-texto">{paso.baseLegal}</p>
                </div>
            )}

            {reqs.length > 0 && (
                <div>
                    <h4 className="grupo-titulo">Requisitos de este paso</h4>
                    {reqs.map((r) => (
                        <div key={r.id} className="chk-fila">
                            <span>{r.nombre}</span>
                            <Insignia tono={r.obligatorio ? 'azul' : 'gris'}>{r.obligatorio ? 'Obligatorio' : 'Opcional'}</Insignia>
                        </div>
                    ))}
                </div>
            )}

            <div>
                <h4 className="grupo-titulo">Salidas</h4>
                {paso.siguientes.length === 0 && <p className="suave">{paso.tipo === 'fin' ? 'Es un paso final.' : 'Sin salidas todavía.'}</p>}
                <div className="lista-opciones">
                    {paso.siguientes.map((x) => (
                        <button key={x.a} type="button" className="opcion" onClick={() => ir(x.a)}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <b>{x.etiqueta || 'Continúa en'}</b>
                                <span className="suave">{mapa.get(x.a)?.titulo}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {entradas.length > 0 && (
                <div>
                    <h4 className="grupo-titulo">Llega desde</h4>
                    <div className="chips">
                        {entradas.map((p) => <button key={p.id} type="button" className="chip" onClick={() => ir(p.id)}>{p.titulo}</button>)}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ================= Panel: vista general ================= */
const LEYENDA: { tipo: TipoPaso; clase: string }[] = TIPOS_PASO.map((tipo) => ({ tipo, clase: `lg-${tipo}` }));

function PanelGeneral({ pasos, hallazgos, carriles, ir, moverCarril }: {
    pasos: readonly Paso[];
    hallazgos: readonly HallazgoFlujo[];
    carriles: string[];
    ir: (id: string) => void;
    moverCarril: (i: number, d: -1 | 1) => void;
}) {
    return (
        <div className="tarjeta fl-panel-paso">
            <div>
                <h3>Revisión del flujo</h3>
                <p className="suave">Haz clic en un paso para ver su detalle y el camino que lleva hasta él.</p>
            </div>

            {pasos.length > 0 && hallazgos.length === 0 && <Alerta tipo="ok">El flujo está completo y conectado.</Alerta>}
            {hallazgos.map((h, i) => (
                <Alerta key={i} tipo={h.nivel === 'error' ? 'error' : 'adv'}>
                    {h.texto}
                    {h.pasoId && (
                        <>
                            {' '}
                            <button type="button" className="btn btn-enlace" onClick={() => ir(h.pasoId as string)}>Ver paso</button>
                        </>
                    )}
                </Alerta>
            ))}

            {carriles.length > 1 && (
                <div>
                    <h4 className="grupo-titulo">Orden de los carriles</h4>
                    {carriles.map((c, i) => (
                        <div key={c} className="chk-fila">
                            <span>{c}</span>
                            <span className="acciones">
                                <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Mover a la izquierda" disabled={i === 0} onClick={() => moverCarril(i, -1)}>←</button>
                                <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Mover a la derecha" disabled={i === carriles.length - 1} onClick={() => moverCarril(i, 1)}>→</button>
                            </span>
                        </div>
                    ))}
                    <p className="pc-nota">El carril de cada paso sale de su «Responsable».</p>
                </div>
            )}

            <div>
                <h4 className="grupo-titulo">Leyenda</h4>
                <div className="fl-leyenda">
                    {LEYENDA.map(({ tipo, clase }) => (
                        <span key={tipo}>
                            <i className={clase} style={{ background: COLOR_PASO[tipo].fondo, borderColor: COLOR_PASO[tipo].borde }} />
                            {ETIQUETA_PASO[tipo]}
                        </span>
                    ))}
                    <span><i className="lg-retorno" />Retorno / repetir</span>
                    <span><b className="lg-badge">3</b>Requisitos del paso</span>
                </div>
            </div>
        </div>
    );
}

/* ================= Panel: recorrido guiado ================= */
function PanelRecorrido({ ruta, mapa, requisitos, avanzar, atras, reiniciar, saltar }: {
    ruta: string[];
    mapa: ReadonlyMap<string, Paso>;
    requisitos: readonly Requisito[];
    avanzar: (id: string) => void;
    atras: () => void;
    reiniciar: () => void;
    saltar: (indice: number) => void;
}) {
    const paso = mapa.get(ruta[ruta.length - 1] ?? '');
    if (!paso) return <div className="tarjeta"><p className="suave">No hay pasos para recorrer.</p></div>;
    const reqs = nombresDe(paso.requisitos, requisitos);
    const col = COLOR_PASO[paso.tipo];
    return (
        <div className="tarjeta fl-panel-paso">
            <div>
                <span className="fl-tipo" style={{ background: col.fondo, borderColor: col.borde }}>
                    Paso {ruta.length} · {ETIQUETA_PASO[paso.tipo]}
                </span>
                <h3>{paso.titulo}</h3>
                <p className="suave">
                    {[paso.responsable, paso.plazo && `Plazo: ${paso.plazo}`].filter(Boolean).join(' · ') || 'Sin responsable ni plazo'}
                </p>
            </div>

            {paso.detalle && <p className="fl-texto">{paso.detalle}</p>}
            {paso.baseLegal && <p className="suave">Base legal: {paso.baseLegal}</p>}

            {reqs.length > 0 && (
                <div>
                    <h4 className="grupo-titulo">Necesitas en este paso</h4>
                    {reqs.map((r) => (
                        <div key={r.id} className="chk-fila">
                            <span>{r.nombre}</span>
                            <Insignia tono={r.obligatorio ? 'azul' : 'gris'}>{r.obligatorio ? 'Obligatorio' : 'Opcional'}</Insignia>
                        </div>
                    ))}
                </div>
            )}

            <div>
                <h4 className="grupo-titulo">{paso.tipo === 'decision' ? 'Elige qué ocurre' : 'Continuar'}</h4>
                {paso.siguientes.length === 0 ? (
                    <Alerta tipo="ok">{paso.tipo === 'fin' ? 'Fin del procedimiento.' : 'Aquí termina el recorrido (el paso no tiene salidas).'}</Alerta>
                ) : (
                    <div className="lista-opciones">
                        {paso.siguientes.map((x) => (
                            <button key={x.a} type="button" className="opcion" onClick={() => avanzar(x.a)}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <b>{x.etiqueta || 'Continuar'}</b>
                                    <span className="suave">{mapa.get(x.a)?.titulo}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="acciones">
                <button type="button" className="btn btn-sec btn-sm" disabled={ruta.length <= 1} onClick={atras}>← Atrás</button>
                <button type="button" className="btn btn-fan btn-sm" onClick={reiniciar}>Reiniciar</button>
            </div>

            <div>
                <h4 className="grupo-titulo">Camino recorrido</h4>
                <ol className="fl-historial">
                    {ruta.map((id, i) => (
                        <li key={`${id}-${i}`}>
                            <button type="button" className="btn btn-enlace" onClick={() => saltar(i)}>{mapa.get(id)?.titulo}</button>
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
}

/* ================= Crear / editar un paso ================= */
function ModalPaso({ inicial, desde, pasos, requisitos, responsables, guardar, cerrar }: {
    inicial: Paso | null;
    /** Paso del que sale este (al crear con «Paso siguiente»). */
    desde?: Paso;
    pasos: readonly Paso[];
    requisitos: readonly Requisito[];
    responsables: readonly string[];
    guardar: (p: Paso, desde?: { id: string; etiqueta: string }) => void;
    cerrar: () => void;
}) {
    const [tipo, setTipo] = useState<TipoPaso>(inicial?.tipo ?? (pasos.length === 0 ? 'inicio' : 'accion'));
    const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
    const [detalle, setDetalle] = useState(inicial?.detalle ?? '');
    const [responsable, setResponsable] = useState(inicial?.responsable ?? desde?.responsable ?? '');
    const [plazo, setPlazo] = useState(inicial?.plazo ?? '');
    const [baseLegal, setBaseLegal] = useState(inicial?.baseLegal ?? '');
    const [reqs, setReqs] = useState<Set<string>>(() => new Set(inicial?.requisitos ?? []));
    const [salidas, setSalidas] = useState<Salida[]>(inicial?.siguientes ?? []);
    const [etiquetaDesde, setEtiquetaDesde] = useState(
        desde?.tipo === 'decision' ? (desde.siguientes.length === 0 ? 'Sí' : desde.siguientes.length === 1 ? 'No' : '') : '',
    );
    const [error, setError] = useState<string | null>(null);
    const otros = pasos.filter((p) => p.id !== inicial?.id);

    function alternarReq(id: string) {
        setReqs((p) => {
            const n = new Set(p);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    }

    function agregarSalida() {
        const libre = otros.find((p) => !salidas.some((x) => x.a === p.id));
        const etiqueta = tipo === 'decision' ? (salidas.length === 0 ? 'Sí' : salidas.length === 1 ? 'No' : '') : '';
        setSalidas([...salidas, { a: libre?.id ?? '', etiqueta }]);
    }

    function enviar(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const t = titulo.trim();
        if (!t) {
            setError('Ponle un título al paso.');
            return;
        }
        const siguientes: Salida[] = [];
        if (tipo !== 'fin') {
            for (const x of salidas) {
                if (x.a && !siguientes.some((y) => y.a === x.a)) siguientes.push({ a: x.a, etiqueta: x.etiqueta.trim() });
            }
        }
        const base = inicial ?? nuevoPaso(tipo, t);
        guardar(
            {
                ...base, tipo, titulo: t, detalle: detalle.trim(), responsable: responsable.trim(), plazo: plazo.trim(),
                baseLegal: baseLegal.trim(), requisitos: requisitos.filter((r) => reqs.has(r.id)).map((r) => r.id), siguientes,
            },
            desde ? { id: desde.id, etiqueta: etiquetaDesde.trim() } : undefined,
        );
    }

    return (
        <Modal
            titulo={inicial ? 'Editar paso' : desde ? `Paso siguiente de «${desde.titulo}»` : 'Nuevo paso'}
            ancho="grande"
            cerrar={cerrar}
            pie={<><span className="espacio" /><button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button><button type="submit" form="form-paso" className="btn btn-pri">Guardar paso</button></>}
        >
            {error && <Alerta tipo="error">{error}</Alerta>}
            <form id="form-paso" className="form-grid" onSubmit={enviar}>
                <Campo etiqueta="Tipo">
                    <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPaso)}>
                        {TIPOS_PASO.map((t) => <option key={t} value={t}>{ETIQUETA_PASO[t]}</option>)}
                    </select>
                </Campo>
                <Campo etiqueta="Responsable (carril)" ayuda="Quien ejecuta el paso: Cliente, Abogado, Juzgado…">
                    <input list="dl-resp-paso" value={responsable} onChange={(e) => setResponsable(e.target.value)} />
                </Campo>
                <Campo etiqueta="Título *" ancho>
                    <input
                        autoFocus value={titulo} onChange={(e) => { setTitulo(e.target.value); setError(null); }}
                        placeholder={tipo === 'decision' ? '¿El juzgado admite la demanda?' : 'Presentar la demanda en el juzgado'}
                    />
                </Campo>
                <Campo etiqueta="Plazo"><input value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="Ej.: 3 días hábiles" /></Campo>
                <Campo etiqueta="Base legal"><input value={baseLegal} onChange={(e) => setBaseLegal(e.target.value)} placeholder="Ej.: art. 45 del Código…" /></Campo>
                <Campo etiqueta="Descripción" ancho><textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} /></Campo>

                {desde && (
                    <Campo
                        etiqueta={`Etiqueta de la conexión desde «${desde.titulo}»`}
                        ancho
                        ayuda={desde.tipo === 'decision' ? 'Es una decisión: indica qué respuesta lleva a este paso (Sí, No, Observada…).' : 'Opcional.'}
                    >
                        <input value={etiquetaDesde} onChange={(e) => setEtiquetaDesde(e.target.value)} />
                    </Campo>
                )}

                {requisitos.length > 0 && (
                    <div className="campo ancho">
                        <span className="campo-etiq">Requisitos que se necesitan en este paso</span>
                        <div className="fl-reqs">
                            {requisitos.map((r) => (
                                <label key={r.id} className="casilla">
                                    <input type="checkbox" checked={reqs.has(r.id)} onChange={() => alternarReq(r.id)} />
                                    {r.nombre}
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {tipo !== 'fin' && (
                    <div className="campo ancho">
                        <span className="campo-etiq">Salidas (a qué paso lleva)</span>
                        {tipo === 'decision' && <span className="campo-ayuda">Una decisión necesita al menos dos salidas, cada una con su etiqueta.</span>}
                        {salidas.map((x, i) => (
                            <div key={i} className="fl-salida-fila">
                                <select value={x.a} onChange={(e) => setSalidas(salidas.map((y, k) => (k === i ? { ...y, a: e.target.value } : y)))}>
                                    <option value="" disabled>Elegir paso…</option>
                                    {otros.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                                </select>
                                <input
                                    value={x.etiqueta} placeholder="Etiqueta (Sí, No…)"
                                    onChange={(e) => setSalidas(salidas.map((y, k) => (k === i ? { ...y, etiqueta: e.target.value } : y)))}
                                />
                                <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar salida" onClick={() => setSalidas(salidas.filter((_, k) => k !== i))}>
                                    <Icono n="cerrar" tam={14} />
                                </button>
                            </div>
                        ))}
                        <div>
                            <button type="button" className="btn btn-sec btn-sm" disabled={otros.length === 0} onClick={agregarSalida}>
                                <Icono n="mas" tam={14} /> Agregar salida
                            </button>
                        </div>
                    </div>
                )}
            </form>
            <datalist id="dl-resp-paso">{responsables.map((x) => <option key={x} value={x} />)}</datalist>
        </Modal>
    );
}