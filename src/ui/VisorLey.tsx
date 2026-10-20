import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { NodoConLey } from '../application/casosDeUso/leyes';
import {
    ETIQUETA_NIVEL, NIVELES_LEY, RANGO_NIVEL, TIPOS_LEY, citar, etiquetaNodo, profundidades, rutaDe,
    type ModoCita, type NivelLey, type NodoArbol, type NodoLey,
} from '../domain/leyes';
import { Alerta, Aviso, Campo, Icono, Insignia, Modal, avisar, confirmar, copiarTexto } from './comunes';
import { mensajeError, useCargar, useServicios } from './servicios';
import { useBuscarLeyes } from './useBuscarLeyes';
import { VisorPdf, type ControlVisor } from './VisorPdf';
import './leyes.css';

type Dlg = { n: 'nodo'; nodo?: NodoLey } | { n: 'ley' } | null;

export function VisorLey({ leyId, nodoInicial, volver }: { leyId: string; nodoInicial?: string; volver: () => void }) {
    const s = useServicios();
    const ley = useCargar(() => s.leyes.obtener(leyId), [leyId]);
    const arbol = useCargar(() => s.leyes.nodos(leyId), [leyId]);
    const ruta = ley.datos?.rutaPdf ?? '';
    const pdf = useCargar(() => (ruta ? s.archivos.leer(ruta) : Promise.resolve(null)), [ruta]);
    const visor = useRef<ControlVisor>(null);
    const [pagina, setPagina] = useState(1);
    const [selId, setSelId] = useState<string | null>(nodoInicial ?? null);
    const detalle = useCargar(() => (selId ? s.leyes.obtenerNodo(selId) : Promise.resolve(null)), [selId]);
    const [q, setQ] = useState('');
    const busqueda = useBuscarLeyes(q, leyId);
    const [plegados, setPlegados] = useState<Set<string>>(() => new Set());
    const [dlg, setDlg] = useState<Dlg>(null);
    const [error, setError] = useState<string | null>(null);
    const [ocupado, setOcupado] = useState(false);

    const nodos = useMemo(() => arbol.datos ?? [], [arbol.datos]);

    const idsConHijos = useMemo(() => {
        const ids = new Set<string>();
        nodos.forEach((n, i) => {
            const sig = nodos[i + 1];
            if (sig && RANGO_NIVEL[sig.nivel] > RANGO_NIVEL[n.nivel]) ids.add(n.id);
        });
        return ids;
    }, [nodos]);

    const filas = useMemo(() => {
        const prof = profundidades(nodos);
        const salida: { n: NodoArbol; prof: number; hijos: boolean }[] = [];
        let oculto = -1; // rango de la división plegada
        for (let i = 0; i < nodos.length; i++) {
            const n = nodos[i];
            const r = RANGO_NIVEL[n.nivel];
            if (oculto >= 0) {
                if (r > oculto) continue;
                oculto = -1;
            }
            const hijos = idsConHijos.has(n.id);
            salida.push({ n, prof: prof[i], hijos });
            if (hijos && plegados.has(n.id)) oculto = r;
        }
        return salida;
    }, [nodos, idsConHijos, plegados]);

    /** «Estás en: Libro II › Título III › Art. 120» según la página que se ve. */
    const aqui = useMemo(() => {
        let idx = -1;
        for (let i = nodos.length - 1; i >= 0; i--) {
            if (nodos[i].pagina <= pagina) { idx = i; break; }
        }
        return idx < 0 ? [] : [...rutaDe(nodos, idx), nodos[idx]];
    }, [nodos, pagina]);

    const rutaSel = useMemo(() => {
        const i = nodos.findIndex((n) => n.id === selId);
        return i < 0 ? [] : rutaDe(nodos, i);
    }, [nodos, selId]);

    const l = ley.datos;
    const paginaInicial = nodos.find((n) => n.id === nodoInicial)?.pagina ?? 1;
    const buscando = q.trim() !== '';

    function elegir(id: string, pag: number) {
        setSelId(id);
        visor.current?.irA(pag);
    }

    function alternar(id: string) {
        setPlegados((p) => {
            const n = new Set(p);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
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
        const n = detalle.datos;
        if (!n) return;
        const ok = await copiarTexto(citar({ nombre: n.leyNombre }, n, modo));
        if (ok) avisar('Copiado. Pégalo en el editor con Ctrl+V');
        else setError('No se pudo copiar al portapapeles');
    }

    async function eliminarNodo() {
        const n = detalle.datos;
        if (!n || !(await confirmar(`¿Quitar el marcador «${etiquetaNodo(n)}»? El PDF no cambia.`, 'Quitar marcador'))) return;
        await correr(async () => {
            await s.leyes.eliminarNodo(n.id);
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

            <Aviso error={error ?? ley.error ?? arbol.error ?? pdf.error ?? detalle.error ?? busqueda.error} />
            {arbol.datos && nodos.length === 0 && (
                <Alerta tipo="adv">
                    No se detectó la estructura (¿PDF escaneado o con otro formato?). Puedes navegar el PDF y agregar marcadores a mano con «＋ Marcador aquí».
                </Alerta>
            )}

            <div className="ley-layout">
                <section className="ley-panel">
                    <input type="search" placeholder="Buscar: 1283 · art. 45 · prescripción…" value={q} onChange={(e) => setQ(e.target.value)} />
                    <div className="acciones">
                        <button type="button" className="btn btn-sec btn-sm" onClick={() => setDlg({ n: 'nodo' })}>＋ Marcador aquí (pág. {pagina})</button>
                        <button type="button" className="btn btn-fan btn-sm" onClick={() => setPlegados(new Set(idsConHijos))}>Plegar</button>
                        <button type="button" className="btn btn-fan btn-sm" onClick={() => setPlegados(new Set())}>Desplegar</button>
                    </div>

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
                        ) : (
                            filas.map(({ n, prof, hijos }) => (
                                <div key={n.id} className={`ley-fila n-${n.nivel}${n.id === selId ? ' sel' : ''}`} style={{ paddingLeft: 4 + prof * 14 }}>
                                    {hijos ? (
                                        <button type="button" className="ley-plegar" aria-label={plegados.has(n.id) ? 'Desplegar' : 'Plegar'} onClick={() => alternar(n.id)}>
                                            {plegados.has(n.id) ? '▸' : '▾'}
                                        </button>
                                    ) : <span className="ley-plegar" />}
                                    <button type="button" className="ley-nodo" title={etiquetaNodo(n)} onClick={() => elegir(n.id, n.pagina)}>
                                        <span className="ley-txt">{etiquetaNodo(n)}</span>
                                        <span className="ley-pg">{n.pagina}</span>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {selId && detalle.datos && (
                        <div className="tarjeta ley-detalle">
                            <div>
                                {rutaSel.length > 0 && <div className="suave">{rutaSel.map(etiquetaNodo).join(' › ')}</div>}
                                <h3>{etiquetaNodo(detalle.datos)}</h3>
                                <p className="suave">Pág. {detalle.datos.pagina}</p>
                            </div>
                            <p className="ley-texto">{detalle.datos.texto || 'Marcador sin texto.'}</p>
                            <div className="acciones">
                                <button type="button" className="btn btn-sec btn-sm" onClick={() => void copiar('referencia')}>Copiar referencia</button>
                                <button type="button" className="btn btn-sec btn-sm" onClick={() => void copiar('titulo')}>Con título</button>
                                <button type="button" className="btn btn-sec btn-sm" disabled={!detalle.datos.texto} onClick={() => void copiar('texto')}>Texto citado</button>
                                <button type="button" className="btn btn-fan btn-sm" onClick={() => setDlg({ n: 'nodo', nodo: detalle.datos as NodoConLey })}>Editar</button>
                                <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar marcador" onClick={() => void eliminarNodo()}><Icono n="papelera" tam={15} /></button>
                            </div>
                        </div>
                    )}
                </section>

                <div className="ley-centro">
                    <div className="ley-aqui suave">
                        {aqui.length > 0 ? `Estás en: ${aqui.map(etiquetaNodo).join(' › ')}` : ' '}
                    </div>
                    {pdf.datos && arbol.datos
                        ? <VisorPdf ref={visor} datos={pdf.datos} paginaInicial={paginaInicial} onPagina={setPagina} />
                        : <p className="suave">Cargando el PDF…</p>}
                </div>
            </div>

            {dlg?.n === 'nodo' && (
                <ModalNodo
                    leyId={l.id} nodo={dlg.nodo} pagina={pagina} total={l.numPaginas}
                    cerrar={() => setDlg(null)}
                    guardado={(id) => {
                        setDlg(null);
                        setSelId(id);
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