import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import type { Ley, NodoConLey } from '../../application/casosDeUso/leyes';
import {
    ETIQUETA_NIVEL, NIVELES_LEY, TIPOS_LEY, citar, construirOrg, etiquetaNodo, rangoArticulos, rutaDe,
    type ModoCita, type NivelLey, type NodoArbol, type NodoLey, type NodoOrg,
} from '../../domain/leyes/leyes';
import { Alerta, Aviso, Campo, Icono, Insignia, Modal, avisar, confirmar, copiarTexto } from '../_core/comunes';
import { mensajeError, useCargar, useServicios } from '../_core/servicios';
import { useBuscarLeyes } from './useBuscarLeyes';
import { VisorPdf, type ControlVisor } from '../pdf/VisorPdf';
import './leyes.css';

type Dlg = { n: 'nodo'; nodo?: NodoLey } | { n: 'ley' } | null;
type Elegir = (id: string, pagina: number) => void;

/** Línea que empieza como inciso: «a)», «1.», «-»… */
const INCISO = /^(?:\d{1,2}[.)°º]|[a-zñ]\)|[ivxl]+[.)]|[-•–—])\s/i;

/** Cabecera y rubro de un marcador: «Libro II» + «DE LAS PERSONAS» · «Art. 12» + «Objeto». */
function partesNodo(n: Pick<NodoArbol, 'nivel' | 'numero' | 'titulo'>): { cab: string; titulo: string } {
    if (n.nivel === 'articulo') return { cab: `Art. ${n.numero}`, titulo: n.titulo };
    const cab = n.numero ? `${ETIQUETA_NIVEL[n.nivel]} ${n.numero}` : n.titulo ? '' : ETIQUETA_NIVEL[n.nivel];
    return { cab, titulo: n.titulo };
}

/* ================= Árbol (organigrama) ================= */
function Rama({ lista, selId, enRuta, plegados, verArt, alternar, elegir }: {
    lista: NodoOrg[];
    selId: string | null;
    enRuta: ReadonlySet<string>;
    plegados: ReadonlySet<string>;
    verArt: boolean;
    alternar: (id: string) => void;
    elegir: Elegir;
}) {
    const visibles = verArt ? lista : lista.filter((o) => o.n.nivel !== 'articulo');
    if (visibles.length === 0) return null;
    return (
        <ul className="org-rama">
            {visibles.map((o) => {
                const { cab, titulo } = partesNodo(o.n);
                const hijos = verArt ? o.hijos : o.hijos.filter((h) => h.n.nivel !== 'articulo');
                const plegado = plegados.has(o.n.id);
                const rango = o.n.nivel === 'articulo' ? '' : rangoArticulos(o);
                const clase = `org-fila niv-${o.n.nivel}${o.n.id === selId ? ' sel' : ''}${enRuta.has(o.n.id) ? ' en-ruta' : ''}`;
                const tip = `${etiquetaNodo(o.n)}${rango ? ` · ${o.arts} artículo(s)` : ''} · pág. ${o.n.pagina}`;
                return (
                    <li key={o.n.id}>
                        <div className={clase}>
                            {hijos.length > 0 ? (
                                <button type="button" className="org-plegar" aria-label={plegado ? 'Desplegar' : 'Plegar'}
                                    onClick={() => alternar(o.n.id)}>
                                    {plegado ? '▸' : '▾'}
                                </button>
                            ) : <span className="org-plegar" />}
                            <button type="button" className="org-nodo" title={tip} onClick={() => elegir(o.n.id, o.n.pagina)}>
                                {cab && <span className="org-cab">{cab}</span>}
                                {titulo && <span className="org-tit">{titulo}</span>}
                                {rango && <span className="org-meta">{rango}</span>}
                            </button>
                        </div>
                        {hijos.length > 0 && !plegado && (
                            <Rama lista={o.hijos} selId={selId} enRuta={enRuta} plegados={plegados} verArt={verArt}
                                alternar={alternar} elegir={elegir} />
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

/* ================= Contenido de una división (tarjetas + artículos) ================= */
function Contenido({ lista, elegir }: { lista: NodoOrg[]; elegir: Elegir }) {
    const divisiones = lista.filter((o) => o.n.nivel !== 'articulo');
    const articulos = lista.filter((o) => o.n.nivel === 'articulo');
    if (divisiones.length === 0 && articulos.length === 0) return null;
    return (
        <>
            {divisiones.length > 0 && (
                <div className="ley-cards">
                    {divisiones.map((o) => {
                        const { cab, titulo } = partesNodo(o.n);
                        return (
                            <button key={o.n.id} type="button" className={`ley-card niv-${o.n.nivel}`}
                                onClick={() => elegir(o.n.id, o.n.pagina)}>
                                <span className="ley-card-niv">{ETIQUETA_NIVEL[o.n.nivel]}</span>
                                <b>{cab || titulo}</b>
                                {cab && titulo && <span className="ley-card-tit">{titulo}</span>}
                                <span className="suave">
                                    {rangoArticulos(o) || 'Sin artículos'}{o.arts > 1 ? ` · ${o.arts} arts.` : ''}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
            {articulos.length > 0 && (
                <div>
                    <h4 className="grupo-titulo">Artículos ({articulos.length})</h4>
                    <div className="ley-arts">
                        {articulos.map((o) => (
                            <button key={o.n.id} type="button" className="ley-art"
                                title={o.n.titulo || `Artículo ${o.n.numero}`} onClick={() => elegir(o.n.id, o.n.pagina)}>
                                <b>{o.n.numero}</b>
                                {o.n.titulo && <span>{o.n.titulo}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

/* ================= Lector: texto del marcador elegido ================= */
function Lector({ ley, selId, nodo, orgNodo, raices, ruta, anterior, siguiente, elegir, verPdf, copiar, editar, quitar }: {
    ley: Ley;
    selId: string | null;
    nodo: NodoConLey | null;
    orgNodo: NodoOrg | undefined;
    raices: NodoOrg[];
    ruta: NodoArbol[];
    anterior: NodoArbol | null;
    siguiente: NodoArbol | null;
    elegir: Elegir;
    verPdf: (pagina: number) => void;
    copiar: (modo: ModoCita) => void;
    editar: (n: NodoLey) => void;
    quitar: () => void;
}) {
    if (!selId) {
        return (
            <div className="ley-lector">
                <div>
                    <h2>{ley.nombre}</h2>
                    <p className="suave">
                        {ley.numArticulos} artículos · {ley.numPaginas} págs. Elige un libro, título, capítulo o artículo para leerlo aquí.
                    </p>
                </div>
                {raices.length === 0
                    ? <p className="suave">No hay marcadores todavía.</p>
                    : <Contenido lista={raices} elegir={elegir} />}
            </div>
        );
    }
    if (!nodo) return <div className="ley-lector"><p className="suave">Cargando…</p></div>;

    const { cab, titulo } = partesNodo(nodo);
    const parrafos = nodo.texto.split('\n').map((p) => p.trim()).filter(Boolean);
    const esArticulo = nodo.nivel === 'articulo';
    const rango = orgNodo && !esArticulo ? rangoArticulos(orgNodo) : '';

    return (
        <article className="ley-lector">
            {ruta.length > 0 && (
                <nav className="ley-migas" aria-label="Ubicación">
                    {ruta.map((r) => (
                        <span key={r.id} className="ley-miga-par">
                            <button type="button" className="ley-miga" title={etiquetaNodo(r)} onClick={() => elegir(r.id, r.pagina)}>
                                {etiquetaNodo(r)}
                            </button>
                            <span aria-hidden="true">›</span>
                        </span>
                    ))}
                </nav>
            )}

            <header>
                <div className="fila-chica">
                    <Insignia tono={esArticulo ? 'gris' : 'azul'}>{ETIQUETA_NIVEL[nodo.nivel]}</Insignia>
                    <span className="suave">Pág. {nodo.pagina}</span>
                    {rango && <Insignia tono="verde">{rango}</Insignia>}
                </div>
                <h2>{cab || titulo}</h2>
                {cab && titulo && <p className="ley-rubro">{titulo}</p>}
            </header>

            <div className="acciones">
                <button type="button" className="btn btn-pri btn-sm" onClick={() => copiar('referencia')}>Copiar referencia</button>
                <button type="button" className="btn btn-sec btn-sm" onClick={() => copiar('titulo')}>Con título</button>
                <button type="button" className="btn btn-sec btn-sm" disabled={!nodo.texto} onClick={() => copiar('texto')}>Texto citado</button>
                <span className="espacio" />
                <button type="button" className="btn btn-fan btn-sm" onClick={() => verPdf(nodo.pagina)}>Ver en el PDF</button>
                <button type="button" className="btn btn-fan btn-sm" onClick={() => editar(nodo)}>Editar</button>
                <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar marcador" onClick={quitar}>
                    <Icono n="papelera" tam={15} />
                </button>
            </div>

            {parrafos.length > 0 ? (
                <div className="ley-cuerpo">
                    {parrafos.map((p, i) => <p key={i} className={INCISO.test(p) ? 'inciso' : undefined}>{p}</p>)}
                </div>
            ) : esArticulo && (
                <Alerta tipo="info">Este marcador no tiene texto. Ábrelo en el PDF o pulsa «Editar» para pegarlo.</Alerta>
            )}

            {!esArticulo && orgNodo && <Contenido lista={orgNodo.hijos} elegir={elegir} />}

            <div className="ley-nav">
                <button type="button" className="btn btn-sec btn-sm" disabled={!anterior}
                    onClick={() => anterior && elegir(anterior.id, anterior.pagina)}>
                    <span className="ley-nav-txt">← {anterior ? etiquetaNodo(anterior) : 'Anterior'}</span>
                </button>
                <button type="button" className="btn btn-sec btn-sm" disabled={!siguiente}
                    onClick={() => siguiente && elegir(siguiente.id, siguiente.pagina)}>
                    <span className="ley-nav-txt">{siguiente ? etiquetaNodo(siguiente) : 'Siguiente'} →</span>
                </button>
            </div>
        </article>
    );
}

/* ================= PDF (solo se carga cuando se abre) ================= */
function PanelPdf({ ley, visor, inicial, marcando, pagina, aqui, onPagina, marcar, cerrar }: {
    ley: Ley;
    visor: RefObject<ControlVisor | null>;
    inicial: number;
    marcando: boolean;
    pagina: number;
    aqui: NodoArbol[];
    onPagina: (n: number) => void;
    marcar: () => void;
    cerrar: () => void;
}) {
    const s = useServicios();
    const pdf = useCargar(() => s.archivos.leer(ley.rutaPdf), [ley.rutaPdf]);
    return (
        <>
            <div className="ley-pdf-cab">
                <div className="ley-pdf-info">
                    <b>{marcando ? 'Nuevo marcador' : 'PDF original'}</b>
                    <span className="suave">
                        {marcando ? 'Ve a la página donde empieza y pulsa «Marcar aquí».' : 'Así se ve la página en el documento original.'}
                    </span>
                </div>
                <button type="button" className="btn btn-pri btn-sm" onClick={marcar}>＋ Marcar aquí (pág. {pagina})</button>
                <button type="button" className="btn btn-fan btn-sm" onClick={cerrar}>Cerrar PDF</button>
            </div>
            <div className="ley-aqui suave">
                {aqui.length > 0 ? `Estás en: ${aqui.map(etiquetaNodo).join(' › ')}` : ' '}
            </div>
            <Aviso error={pdf.error} />
            {pdf.datos
                ? <VisorPdf ref={visor} datos={pdf.datos} paginaInicial={inicial} onPagina={onPagina} />
                : <p className="suave">Cargando el PDF…</p>}
        </>
    );
}

/* ================= Pantalla ================= */
export function VisorLey({ leyId, nodoInicial, volver }: { leyId: string; nodoInicial?: string; volver: () => void }) {
    const s = useServicios();
    const ley = useCargar(() => s.leyes.obtener(leyId), [leyId]);
    const arbol = useCargar(() => s.leyes.nodos(leyId), [leyId]);
    const visor = useRef<ControlVisor>(null);
    const [pdf, setPdf] = useState<{ marcando: boolean; inicial: number } | null>(null);
    const [pagina, setPagina] = useState(1);
    const [selId, setSelId] = useState<string | null>(nodoInicial ?? null);
    const detalle = useCargar(() => (selId ? s.leyes.obtenerNodo(selId) : Promise.resolve(null)), [selId]);
    const [q, setQ] = useState('');
    const busqueda = useBuscarLeyes(q, leyId);
    const [plegados, setPlegados] = useState<Set<string>>(() => new Set());
    const [verArt, setVerArt] = useState(false);
    const [dlg, setDlg] = useState<Dlg>(null);
    const [error, setError] = useState<string | null>(null);
    const [ocupado, setOcupado] = useState(false);

    const nodos = useMemo(() => arbol.datos ?? [], [arbol.datos]);
    const org = useMemo(() => construirOrg(nodos), [nodos]);
    const conHijos = useMemo(
        () => [...org.porId.values()].filter((o) => o.hijos.length > 0).map((o) => o.n.id),
        [org],
    );
    const indiceSel = useMemo(() => nodos.findIndex((n) => n.id === selId), [nodos, selId]);
    const rutaSel = useMemo(() => (indiceSel < 0 ? [] : rutaDe(nodos, indiceSel)), [nodos, indiceSel]);
    const enRuta = useMemo(() => new Set(rutaSel.map((n) => n.id)), [rutaSel]);
    const anterior = indiceSel > 0 ? nodos[indiceSel - 1] : null;
    const siguiente = indiceSel >= 0 && indiceSel < nodos.length - 1 ? nodos[indiceSel + 1] : null;
    const nodo = detalle.datos && detalle.datos.id === selId ? detalle.datos : null;
    const buscando = q.trim() !== '';

    /** «Estás en: Libro II › Título III › Art. 120» según la página que se ve en el PDF. */
    const aqui = useMemo(() => {
        if (!pdf) return [];
        let idx = -1;
        for (let i = nodos.length - 1; i >= 0; i--) {
            if (nodos[i].pagina <= pagina) { idx = i; break; }
        }
        return idx < 0 ? [] : [...rutaDe(nodos, idx), nodos[idx]];
    }, [pdf, nodos, pagina]);

    useEffect(() => {
        document.querySelector('.ley-arbol .org-fila.sel')?.scrollIntoView({ block: 'nearest' });
    }, [selId, nodos.length]);

    const l = ley.datos;

    function elegir(id: string, pag: number) {
        setSelId(id);
        const i = nodos.findIndex((n) => n.id === id);
        if (i >= 0) {
            // Se despliegan los ancestros para que el elegido quede visible en el árbol.
            const ancestros = new Set(rutaDe(nodos, i).map((n) => n.id));
            setPlegados((p) => ([...p].some((x) => ancestros.has(x)) ? new Set([...p].filter((x) => !ancestros.has(x))) : p));
        }
        if (pdf) visor.current?.irA(pag);
    }

    function alternar(id: string) {
        setPlegados((p) => {
            const n = new Set(p);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    }

    /** Abre el PDF para elegir en qué página va el marcador nuevo. */
    function marcar() {
        if (pdf) {
            setPdf({ ...pdf, marcando: true });
            return;
        }
        const p = nodo?.pagina ?? 1;
        setPagina(p);
        setPdf({ marcando: true, inicial: p });
    }

    function verPdf(pag: number) {
        if (pdf) {
            visor.current?.irA(pag);
            return;
        }
        setPagina(pag);
        setPdf({ marcando: false, inicial: pag });
    }

    async function correr(fn: () => Promise<void>) {
        setOcupado(true);
        try {
            await fn();
            setError(null);
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setOcupado(false);
        }
    }

    async function copiar(modo: ModoCita) {
        if (!nodo) return;
        const ok = await copiarTexto(citar({ nombre: nodo.leyNombre }, nodo, modo));
        if (ok) avisar('Copiado. Pégalo en el editor con Ctrl+V');
        else setError('No se pudo copiar al portapapeles');
    }

    async function eliminarNodo() {
        if (!nodo || !(await confirmar(`¿Quitar el marcador «${etiquetaNodo(nodo)}»? El PDF no cambia.`, 'Quitar marcador'))) return;
        const id = nodo.id;
        await correr(async () => {
            await s.leyes.eliminarNodo(id);
            setSelId(null);
            arbol.recargar();
            ley.recargar();
        });
    }

    async function reanalizar() {
        if (!l || !(await confirmar('Se volverá a detectar la estructura del PDF y se reemplazarán TODOS los marcadores, incluidos los que agregaste o corregiste a mano. ¿Continuar?', 'Volver a analizar'))) return;
        await correr(async () => {
            const n = await s.leyes.reanalizar(l.id);
            setSelId(null);
            arbol.recargar();
            ley.recargar();
            avisar(`${n} marcadores detectados`);
        });
    }

    async function eliminarLey() {
        if (!l || !(await confirmar(`¿Quitar «${l.nombre}» de la biblioteca? El PDF no se borra del disco.`, 'Quitar ley'))) return;
        await correr(async () => {
            await s.leyes.eliminar(l.id);
            avisar('Ley quitada');
            volver();
        });
    }

    const atras = <button type="button" className="btn btn-fan" onClick={volver}><Icono n="atras" /> Leyes</button>;
    if (ley.error) return <div className="pagina">{atras}<Aviso error={ley.error} /></div>;
    if (!l) return <div className="pagina">{atras}<p className="suave">Cargando…</p></div>;

    const hayVisibles = verArt ? org.raices.length > 0 : org.raices.some((o) => o.n.nivel !== 'articulo');

    return (
        <div className="pagina pagina-ancha">
            <div>{atras}</div>

            <div className="pagina-cab">
                <div>
                    <div className="fila-chica">
                        {l.tipo && <Insignia tono="azul">{l.tipo}</Insignia>}
                        <Insignia>{l.numPaginas} págs.</Insignia>
                        <Insignia tono="verde">{l.numArticulos} artículos</Insignia>
                    </div>
                    <h1>{l.nombre}</h1>
                    {l.norma && <p className="subtitulo">{l.norma}</p>}
                </div>
                <div className="acciones">
                    <button type="button" className="btn btn-sec" disabled={ocupado} onClick={() => setDlg({ n: 'ley' })}>Datos</button>
                    <button type="button" className="btn btn-sec" disabled={ocupado} onClick={() => void s.archivos.abrir(l.rutaPdf).catch((e) => setError(mensajeError(e)))}>Abrir PDF original</button>
                    <button type="button" className="btn btn-sec" disabled={ocupado} onClick={() => void reanalizar()}>{ocupado ? 'Analizando…' : 'Volver a analizar'}</button>
                    <button type="button" className="btn btn-peligro" disabled={ocupado} onClick={() => void eliminarLey()}>Quitar</button>
                </div>
            </div>

            <Aviso error={error ?? arbol.error ?? detalle.error ?? busqueda.error} />
            {arbol.datos && nodos.length === 0 && (
                <Alerta tipo="adv">
                    No se detectó la estructura (¿PDF escaneado o con otro formato?). Pulsa «＋ Marcador» para abrir el PDF y agregar marcadores a mano.
                </Alerta>
            )}

            <div className="ley-layout">
                <section className="ley-panel">
                    <input type="search" placeholder="Buscar: 1283 · art. 45 · prescripción…" value={q} onChange={(e) => setQ(e.target.value)} />
                    <div className="acciones">
                        <button type="button" className="btn btn-sec btn-sm" onClick={marcar}>＋ Marcador</button>
                        <button type="button" className="btn btn-sec btn-sm"
                            onClick={() => (pdf ? setPdf(null) : verPdf(nodo?.pagina ?? 1))}>
                            {pdf ? 'Ocultar PDF' : 'Ver PDF'}
                        </button>
                        <span className="espacio" />
                        <button type="button" className="btn btn-fan btn-sm" onClick={() => setPlegados(new Set(conHijos))}>Plegar</button>
                        <button type="button" className="btn btn-fan btn-sm" onClick={() => setPlegados(new Set())}>Desplegar</button>
                    </div>
                    <label className="casilla">
                        <input type="checkbox" checked={verArt} onChange={(e) => setVerArt(e.target.checked)} />
                        Con artículos en el árbol
                    </label>

                    <div className="ley-arbol">
                        {buscando ? (
                            busqueda.res.length === 0
                                ? <p className="suave" style={{ padding: 10 }}>Sin resultados.</p>
                                : busqueda.res.map((r) => (
                                    <button key={r.id} type="button" className="opcion" style={{ marginBottom: 6 }} onClick={() => elegir(r.id, r.pagina)}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <b>{etiquetaNodo(r)}</b>
                                            <span className="suave">Pág. {r.pagina}{r.extracto ? ` · ${r.extracto}` : ''}</span>
                                        </div>
                                    </button>
                                ))
                        ) : !hayVisibles ? (
                            <p className="suave" style={{ padding: 10 }}>
                                {org.raices.length === 0 ? 'Sin marcadores.' : 'Esta ley no tiene divisiones: activa «Con artículos en el árbol».'}
                            </p>
                        ) : (
                            <Rama lista={org.raices} selId={selId} enRuta={enRuta} plegados={plegados} verArt={verArt}
                                alternar={alternar} elegir={elegir} />
                        )}
                    </div>
                </section>

                <div className="ley-centro">
                    {pdf ? (
                        <PanelPdf
                            ley={l} visor={visor} inicial={pdf.inicial} marcando={pdf.marcando} pagina={pagina} aqui={aqui}
                            onPagina={setPagina}
                            marcar={() => setDlg({ n: 'nodo' })}
                            cerrar={() => setPdf(null)}
                        />
                    ) : (
                        <Lector
                            ley={l} selId={selId} nodo={nodo} orgNodo={selId ? org.porId.get(selId) : undefined}
                            raices={org.raices} ruta={rutaSel} anterior={anterior} siguiente={siguiente}
                            elegir={elegir} verPdf={verPdf} copiar={(m) => void copiar(m)}
                            editar={(n) => setDlg({ n: 'nodo', nodo: n })}
                            quitar={() => void eliminarNodo()}
                        />
                    )}
                </div>
            </div>

            {dlg?.n === 'nodo' && (
                <ModalNodo
                    leyId={l.id} nodo={dlg.nodo} pagina={pagina} total={l.numPaginas}
                    cerrar={() => setDlg(null)}
                    guardado={(id) => {
                        setDlg(null);
                        setSelId(id);
                        if (pdf?.marcando) setPdf(null); // marcador listo: se vuelve al texto
                        arbol.recargar();
                        detalle.recargar();
                        ley.recargar();
                        avisar('Marcador guardado');
                    }}
                />
            )}
            {dlg?.n === 'ley' && (
                <ModalLey
                    ley={l} cerrar={() => setDlg(null)}
                    guardado={() => { setDlg(null); ley.recargar(); avisar('Datos guardados'); }}
                />
            )}
        </div>
    );
}

/* ---------------- Crear / editar un marcador ---------------- */
function ModalNodo({ leyId, nodo, pagina, total, cerrar, guardado }: {
    leyId: string; nodo?: NodoLey; pagina: number; total: number; cerrar: () => void; guardado: (id: string) => void;
}) {
    const s = useServicios();
    const [nivel, setNivel] = useState<NivelLey>(nodo?.nivel ?? 'articulo');
    const [numero, setNumero] = useState(nodo?.numero ?? '');
    const [titulo, setTitulo] = useState(nodo?.titulo ?? '');
    const [pag, setPag] = useState(String(nodo?.pagina ?? pagina));
    const [texto, setTexto] = useState(nodo?.texto ?? '');
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);

    async function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const p = Number(pag);
        if (!Number.isFinite(p) || p < 1 || p > total) {
            setError(`La página va de 1 a ${total}.`);
            return;
        }
        setTrabajando(true);
        try {
            guardado(await s.leyes.guardarNodo({ id: nodo?.id, leyId, nivel, numero, titulo, pagina: p, texto }));
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    return (
        <Modal
            titulo={nodo ? 'Editar marcador' : 'Nuevo marcador'}
            cerrar={cerrar}
            pie={<><span className="espacio" /><button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button><button type="submit" form="form-nodo" className="btn btn-pri" disabled={trabajando}>Guardar</button></>}
        >
            <Aviso error={error} />
            <form id="form-nodo" className="form-grid" onSubmit={(ev) => void enviar(ev)}>
                <Campo etiqueta="Nivel">
                    <select value={nivel} onChange={(e) => setNivel(e.target.value as NivelLey)}>
                        {NIVELES_LEY.map((n) => <option key={n} value={n}>{ETIQUETA_NIVEL[n]}</option>)}
                    </select>
                </Campo>
                <Campo etiqueta="Número" ayuda="Ej.: 1283 · 12 bis · II · Primero"><input value={numero} onChange={(e) => setNumero(e.target.value)} /></Campo>
                <Campo etiqueta="Título / rubro" ancho><input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Objeto · De las personas" /></Campo>
                <Campo etiqueta={`Página (1–${total})`}><input inputMode="numeric" value={pag} onChange={(e) => setPag(e.target.value)} /></Campo>
                <Campo etiqueta="Texto (para citarlo)" ancho><textarea value={texto} onChange={(e) => setTexto(e.target.value)} /></Campo>
            </form>
        </Modal>
    );
}

/* ---------------- Datos de la ley ---------------- */
function ModalLey({ ley, cerrar, guardado }: {
    ley: { id: string; nombre: string; tipo: string; norma: string }; cerrar: () => void; guardado: () => void;
}) {
    const s = useServicios();
    const [nombre, setNombre] = useState(ley.nombre);
    const [tipo, setTipo] = useState(ley.tipo);
    const [norma, setNorma] = useState(ley.norma);
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);

    async function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        setTrabajando(true);
        try {
            await s.leyes.editarDatos(ley.id, { nombre, tipo, norma });
            guardado();
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    return (
        <Modal
            titulo="Datos de la ley"
            cerrar={cerrar}
            pie={<><span className="espacio" /><button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button><button type="submit" form="form-ley" className="btn btn-pri" disabled={trabajando}>Guardar</button></>}
        >
            <Aviso error={error} />
            <form id="form-ley" className="form-grid" onSubmit={(ev) => void enviar(ev)}>
                <Campo etiqueta="Nombre *" ancho ayuda="Así se cita: «artículo 12 del Código Civil»."><input value={nombre} onChange={(e) => setNombre(e.target.value)} required /></Campo>
                <Campo etiqueta="Tipo">
                    <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                        <option value="">—</option>
                        {TIPOS_LEY.map((x) => <option key={x} value={x}>{x}</option>)}
                        {tipo && !(TIPOS_LEY as readonly string[]).includes(tipo) && <option value={tipo}>{tipo}</option>}
                    </select>
                </Campo>
                <Campo etiqueta="Norma"><input value={norma} onChange={(e) => setNorma(e.target.value)} placeholder="Ej.: Ley N° 439" /></Campo>
            </form>
        </Modal>
    );
}