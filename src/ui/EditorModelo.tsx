import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { esTextoLargo, usosCaso } from '../application/camposModelo';
import type { ResultadoImportacion, ResultadoValidacion } from '../application/casosDeUso/importarModelo';
import {
    FUENTES_PAGINA, TIPOS_CAMPO, fuenteVacia, marcadorDeCampo, parsearTexto,
    type CampoPropio, type ConfigPagina, type FuenteModelo, type TamanoPagina, type TipoCampo,
} from '../domain/fuenteModelo';
import { claveCampo, etiquetaRol } from '../domain/texto';
import {
    Alerta, Aviso, Campo, Icono, Insignia, Pestanas, Segmentado, SelectCategoria, SelectMateria, TablaEsquema, Vacio,
    avisar, confirmar,
} from './comunes';
import { Hoja } from './Hoja';
import { PanelCampos } from './PanelCampos';
import { mensajeError, useCargar, useServicios } from './servicios';

type PestanaEditor = 'texto' | 'campos' | 'pagina' | 'datos';
type ModoVista = 'escribir' | 'previa' | 'ambos';

interface Inicial { nombre: string; materia: string; categoria: string; descripcion: string; fuente: FuenteModelo }

const INTERLINEADOS = [1, 1.15, 1.5, 2];
const RE_ALINEACION = /^\[(c|d|i|j)\]\s?/i;
const TIPO_POR_FILTRO: Record<string, TipoCampo> = { moneda: 'moneda', fecha: 'fecha', superficie: 'superficie', literal: 'numero' };

const normalizarCampos = (l: CampoPropio[]): CampoPropio[] =>
    l.map((c) => {
        const clave = claveCampo(c.clave);
        return { ...c, clave, etiqueta: c.etiqueta.trim() || etiquetaRol(clave) };
    });

function tipoDesdeUso(texto: string, clave: string): TipoCampo {
    const m = new RegExp(`\\{\\{\\s*caso\\.${clave}\\s*\\??\\s*\\|\\s*(moneda|fecha|superficie|literal)`, 'iu').exec(texto);
    if (m) return TIPO_POR_FILTRO[m[1].toLowerCase()];
    return esTextoLargo(clave) ? 'texto_largo' : 'texto';
}

/* ---------------- Carga ---------------- */
export function EditorModelo({ modeloId, versionId, volver, guardado }: {
    modeloId?: string;
    versionId?: string;
    volver: () => void;
    guardado: (r: ResultadoImportacion) => void;
}) {
    const s = useServicios();
    const carga = useCargar(async () => {
        if (!versionId) return null;
        const [vista, modelo] = await Promise.all([
            s.verModelo.ejecutar(versionId),
            modeloId ? s.consultas.obtenerModelo(modeloId) : Promise.resolve(null),
        ]);
        return { vista, modelo };
    }, [versionId, modeloId]);

    const atras = (
        <button type="button" className="btn btn-fan" onClick={volver}><Icono n="atras" /> Modelos</button>
    );

    if (versionId) {
        if (carga.error) return <div className="pagina">{atras}<Aviso error={carga.error} /></div>;
        if (!carga.datos) return <div className="pagina">{atras}<p className="suave">Cargando…</p></div>;
        const { vista, modelo } = carga.datos;
        if (!vista.fuente) {
            return (
                <div className="pagina">
                    {atras}
                    <Alerta tipo="adv">Este modelo viene de Word y no se puede editar aquí. Conviértelo a editable desde su ficha.</Alerta>
                </div>
            );
        }
        return (
            <EditorInterno
                modeloId={modeloId}
                inicial={{
                    nombre: modelo?.nombre ?? '', materia: modelo?.materia ?? '', categoria: modelo?.categoria ?? '',
                    descripcion: modelo?.descripcion ?? '', fuente: vista.fuente,
                }}
                volver={volver}
                guardado={guardado}
            />
        );
    }
    return (
        <EditorInterno
            modeloId={undefined}
            inicial={{ nombre: '', materia: '', categoria: '', descripcion: '', fuente: fuenteVacia() }}
            volver={volver}
            guardado={guardado}
        />
    );
}

/* ---------------- Editor ---------------- */
function EditorInterno({ modeloId: idInicial, inicial, volver, guardado }: {
    modeloId?: string;
    inicial: Inicial;
    volver: () => void;
    guardado: (r: ResultadoImportacion) => void;
}) {
    const s = useServicios();
    const [modeloId, setModeloId] = useState(idInicial);
    const [nombre, setNombre] = useState(inicial.nombre);
    const [materia, setMateria] = useState(inicial.materia);
    const [categoria, setCategoria] = useState(inicial.categoria);
    const [descripcion, setDescripcion] = useState(inicial.descripcion);
    const [config, setConfig] = useState<ConfigPagina>(inicial.fuente.config);
    const [texto, setTexto] = useState(inicial.fuente.texto);
    const [campos, setCampos] = useState<CampoPropio[]>(inicial.fuente.campos);
    const [notas, setNotas] = useState('');
    const [pestana, setPestana] = useState<PestanaEditor>('texto');
    const [vista, setVista] = useState<ModoVista>('escribir');
    const [verif, setVerif] = useState<ResultadoValidacion | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [modificado, setModificado] = useState(false);
    const [ultima, setUltima] = useState<number | null>(null);
    const ta = useRef<HTMLTextAreaElement>(null);
    const pendiente = useRef<{ txt: string; bloque: boolean } | null>(null);

    const fuente = useMemo<FuenteModelo>(() => ({ version: 1, config, texto, campos }), [config, texto, campos]);
    const bloques = useMemo(() => parsearTexto(texto), [texto]);
    const tocar = () => {
        setModificado(true);
        setVerif(null);
    };

    /* ----- edición del texto ----- */
    function reemplazar(ini: number, fin: number, nuevo: string, selIni = ini + nuevo.length, selFin = selIni) {
        const el = ta.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(ini, fin);
        let ok = true;
        if (nuevo === '') ok = ini === fin ? true : document.execCommand('delete');
        else ok = document.execCommand('insertText', false, nuevo);
        if (!ok) {
            setTexto(el.value.slice(0, ini) + nuevo + el.value.slice(fin));
            tocar();
        }
        window.setTimeout(() => el.setSelectionRange(selIni, selFin), 0);
    }

    function envolver(marca: string) {
        const el = ta.current;
        if (!el) return;
        const a = el.selectionStart;
        const b = el.selectionEnd;
        const sel = el.value.slice(a, b);
        const quitar = sel.length >= marca.length * 2 && sel.startsWith(marca) && sel.endsWith(marca) && !(marca === '*' && sel.startsWith('**'));
        if (quitar) {
            reemplazar(a, b, sel.slice(marca.length, sel.length - marca.length), a, b - marca.length * 2);
        } else if (a === b) {
            reemplazar(a, b, marca + marca, a + marca.length);
        } else {
            reemplazar(a, b, marca + sel + marca, a + marca.length, b + marca.length);
        }
    }

    function transformarLineas(fn: (linea: string) => string) {
        const el = ta.current;
        if (!el) return;
        const v = el.value;
        const ini = el.selectionStart === 0 ? 0 : v.lastIndexOf('\n', el.selectionStart - 1) + 1;
        let fin = v.indexOf('\n', el.selectionEnd);
        if (fin === -1) fin = v.length;
        const nuevo = v.slice(ini, fin).split('\n').map(fn).join('\n');
        reemplazar(ini, fin, nuevo, ini, ini + nuevo.length);
    }

    function alinear(letra: 'c' | 'd' | 'i' | 'j') {
        transformarLineas((l) => (l.trim() === '===' ? l : `[${letra}] ${l.replace(RE_ALINEACION, '')}`));
    }

    function estilo(prefijo: '# ' | '## ') {
        transformarLineas((l) => {
            if (l.trim() === '===') return l;
            const alin = RE_ALINEACION.exec(l)?.[0] ?? '';
            let resto = l.slice(alin.length);
            const h = /^(#{1,2})\s+/.exec(resto);
            const mismo = !!h && `${h[1]} ` === prefijo;
            if (h) resto = resto.slice(h[0].length);
            return alin + (mismo ? '' : prefijo) + resto;
        });
    }

    function insertarAhora(txt: string, bloque: boolean) {
        const el = ta.current;
        if (!el) return;
        const a = el.selectionStart;
        const b = el.selectionEnd;
        const v = el.value;
        let nuevo = txt;
        if (bloque) {
            const antes = a === 0 || v[a - 1] === '\n' ? '' : '\n';
            const despues = b >= v.length || v[b] === '\n' ? '' : '\n';
            nuevo = antes + txt + despues;
        }
        const marca = nuevo.indexOf('…');
        if (marca >= 0) reemplazar(a, b, nuevo, a + marca, a + marca + 1);
        else reemplazar(a, b, nuevo);
    }

    function insertar(txt: string, bloque = false) {
        if (pestana === 'texto' && vista !== 'previa') {
            insertarAhora(txt, bloque);
            return;
        }
        pendiente.current = { txt, bloque };
        setPestana('texto');
        if (vista === 'previa') setVista('escribir');
    }

    useEffect(() => {
        if (pestana === 'texto' && vista !== 'previa' && pendiente.current) {
            const p = pendiente.current;
            pendiente.current = null;
            insertarAhora(p.txt, p.bloque);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pestana, vista]);

    function teclas(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (!(e.ctrlKey || e.metaKey)) return;
        const k = e.key.toLowerCase();
        if (k === 'b') { e.preventDefault(); envolver('**'); }
        else if (k === 'i') { e.preventDefault(); envolver('*'); }
        else if (k === 'u') { e.preventDefault(); envolver('++'); }
        else if (k === 's') { e.preventDefault(); void guardar(false); }
    }

    /* ----- campos propios ----- */
    const actualizarCampo = (i: number, cambios: Partial<CampoPropio>) => {
        setCampos((l) => l.map((c, k) => (k === i ? { ...c, ...cambios } : c)));
        tocar();
    };
    const cambiarEtiqueta = (i: number, etiqueta: string) => {
        setCampos((l) => l.map((c, k) => {
            if (k !== i) return c;
            const auto = !c.clave || c.clave === claveCampo(c.etiqueta);
            return { ...c, etiqueta, clave: auto ? claveCampo(etiqueta) : c.clave };
        }));
        tocar();
    };
    const agregarCampo = () => {
        setCampos((l) => [...l, { clave: '', etiqueta: '', tipo: 'texto', requerido: true }]);
        tocar();
    };
    const quitarCampo = (i: number) => {
        setCampos((l) => l.filter((_, k) => k !== i));
        tocar();
    };
    function detectar() {
        const declaradas = new Set(campos.map((c) => claveCampo(c.clave)));
        const nuevos: CampoPropio[] = [...usosCaso(texto).entries()]
            .filter(([k]) => !declaradas.has(k))
            .map(([k, u]) => ({ clave: k, etiqueta: etiquetaRol(k), tipo: tipoDesdeUso(texto, k), requerido: !u.opcional }));
        if (nuevos.length === 0) {
            avisar('No hay campos nuevos en el texto', 'info');
            return;
        }
        setCampos((l) => [...l, ...nuevos]);
        tocar();
        avisar(`Se agregaron ${nuevos.length} campo(s)`);
    }

    const setCfg = (p: Partial<ConfigPagina>) => {
        setConfig((c) => ({ ...c, ...p }));
        tocar();
    };

    /* ----- verificar y guardar ----- */
    function verificar() {
        try {
            const r = s.importarModelo.validar({ ...fuente, campos: normalizarCampos(campos) });
            setVerif(r);
            setError(null);
        } catch (e) {
            setError(mensajeError(e));
        }
    }

    async function guardar(cerrarDespues: boolean) {
        if (guardando) return;
        setGuardando(true);
        try {
            const f: FuenteModelo = { ...fuente, campos: normalizarCampos(campos) };
            const r = await s.importarModelo.desdeFuente({
                modeloId, nombre, materia, categoria, descripcion, notas, fuente: f,
            });
            setModeloId(r.modeloId);
            setUltima(r.version);
            setCampos(f.campos);
            setModificado(false);
            setNotas('');
            setError(null);
            setVerif({ docx: new Uint8Array(), esquema: r.escaneo.esquema, errores: [], advertencias: r.escaneo.advertencias, info: r.escaneo.info });
            avisar(`Modelo guardado como versión ${r.version}`);
            guardado(r);
            if (cerrarDespues) volver();
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setGuardando(false);
        }
    }

    async function salir() {
        if (modificado && !(await confirmar('Hay cambios sin guardar. ¿Salir sin guardarlos?'))) return;
        volver();
    }

    return (
        <div className="pagina pagina-ancha">
            <div className="editor-cab">
                <button type="button" className="btn btn-fan" onClick={() => void salir()}><Icono n="atras" /> Modelos</button>
                <input className="editor-nombre" placeholder="Nombre del modelo" value={nombre}
                    onChange={(e) => { setNombre(e.target.value); tocar(); }} />
                {ultima && <Insignia tono="verde">Guardado v{ultima}</Insignia>}
                {modificado && <Insignia tono="ambar">Sin guardar</Insignia>}
                <div className="espacio" />
                <button type="button" className="btn btn-sec" onClick={verificar}>Verificar</button>
                <button type="button" className="btn btn-sec" disabled={guardando} onClick={() => void guardar(true)}>Guardar y cerrar</button>
                <button type="button" className="btn btn-pri" disabled={guardando} onClick={() => void guardar(false)}>Guardar versión</button>
            </div>

            <Aviso error={error} />
            {verif && <PanelVerificacion r={verif} cerrar={() => setVerif(null)} />}

            <div className="editor-grid">
                <div className="editor-principal">
                    <Pestanas<PestanaEditor>
                        activa={pestana}
                        cambiar={setPestana}
                        items={[
                            { id: 'texto', etiqueta: 'Texto' },
                            { id: 'campos', etiqueta: 'Campos del caso', contador: campos.length },
                            { id: 'pagina', etiqueta: 'Página' },
                            { id: 'datos', etiqueta: 'Datos del modelo' },
                        ]}
                    />

                    {/* ===== TEXTO ===== */}
                    <div hidden={pestana !== 'texto'}>
                        <div className="barra-herr">
                            <button type="button" className="btn btn-fan btn-sm" title="Negrita (Ctrl+B)" onClick={() => envolver('**')}><b>N</b></button>
                            <button type="button" className="btn btn-fan btn-sm" title="Cursiva (Ctrl+I)" onClick={() => envolver('*')}><i>K</i></button>
                            <button type="button" className="btn btn-fan btn-sm" title="Subrayado (Ctrl+U)" onClick={() => envolver('++')}><u>S</u></button>
                            <span className="sep" />
                            <button type="button" className="btn btn-fan btn-sm" title="Título (centrado, negrita)" onClick={() => estilo('# ')}>Título</button>
                            <button type="button" className="btn btn-fan btn-sm" title="Subtítulo" onClick={() => estilo('## ')}>Subtítulo</button>
                            <span className="sep" />
                            <button type="button" className="btn btn-fan btn-sm" onClick={() => alinear('i')}>Izq.</button>
                            <button type="button" className="btn btn-fan btn-sm" onClick={() => alinear('c')}>Centro</button>
                            <button type="button" className="btn btn-fan btn-sm" onClick={() => alinear('d')}>Der.</button>
                            <button type="button" className="btn btn-fan btn-sm" onClick={() => alinear('j')}>Justif.</button>
                            <span className="sep" />
                            <button type="button" className="btn btn-fan btn-sm" onClick={() => insertarAhora('===', true)}>Salto de página</button>
                            <button type="button" className="btn btn-fan btn-sm" onClick={() => insertarAhora('[c] ______________________________', true)}>Línea de firma</button>
                            <div className="espacio" />
                            <Segmentado<ModoVista>
                                valor={vista}
                                cambiar={setVista}
                                opciones={[{ id: 'escribir', etiqueta: 'Escribir' }, { id: 'ambos', etiqueta: 'Dividida' }, { id: 'previa', etiqueta: 'Vista previa' }]}
                            />
                        </div>
                        <div className={`editor-cols modo-${vista}`}>
                            <textarea
                                ref={ta}
                                className="area-texto"
                                spellCheck
                                lang="es"
                                value={texto}
                                onChange={(e) => { setTexto(e.target.value); tocar(); }}
                                onKeyDown={teclas}
                                placeholder={'Escribe el documento aquí. Cada línea es un párrafo.\n\nUsa el panel de la derecha para insertar campos, por ejemplo {{expediente.juzgado}}.'}
                            />
                            <div className="vista-hoja"><Hoja bloques={bloques} config={config} /></div>
                        </div>
                        <details className="ayuda-sintaxis">
                            <summary>Sintaxis del editor</summary>
                            <ul>
                                <li><code>**negrita**</code> · <code>*cursiva*</code> · <code>++subrayado++</code></li>
                                <li><code># Título</code> (centrado) · <code>## Subtítulo</code></li>
                                <li><code>[c]</code> centrado · <code>[d]</code> derecha · <code>[i]</code> izquierda · <code>[j]</code> justificado, al inicio de la línea</li>
                                <li><code>===</code> en una línea sola: salto de página</li>
                                <li>Los bloques <code>{'{{#rol}}'}</code> y <code>{'{{/rol}}'}</code> van cada uno en su propia línea</li>
                                <li>Campo opcional: <code>{'{{caso.plazo?}}'}</code> · Para un asterisco literal: <code>\*</code></li>
                                <li>Atajos: Ctrl+B, Ctrl+I, Ctrl+U y Ctrl+S (guardar)</li>
                            </ul>
                        </details>
                    </div>

                    {/* ===== CAMPOS ===== */}
                    <div hidden={pestana !== 'campos'}>
                        <div className="tarjeta">
                            <div className="tarjeta-cab">
                                <div>
                                    <h3>Campos del caso</h3>
                                    <p className="suave">Datos propios de este documento que no vienen de personas ni de inmuebles (precio, plazo, hechos…). Se toman del expediente o el asistente los pide al generar.</p>
                                </div>
                                <div className="acciones">
                                    <button type="button" className="btn btn-sec btn-sm" onClick={detectar}>Detectar del texto</button>
                                    <button type="button" className="btn btn-pri btn-sm" onClick={agregarCampo}><Icono n="mas" tam={15} /> Agregar campo</button>
                                </div>
                            </div>
                            {campos.length === 0 ? (
                                <Vacio titulo="Sin campos propios" texto="Agrega los campos que necesite tu modelo, o usa «Detectar del texto» si ya escribiste marcadores {{caso.…}}." />
                            ) : (
                                <div className="tabla-wrap">
                                    <table className="tabla tabla-densa">
                                        <thead><tr><th>Etiqueta</th><th>Clave</th><th>Tipo</th><th>Obligatorio</th><th /></tr></thead>
                                        <tbody>
                                            {campos.map((c, i) => (
                                                <tr key={i}>
                                                    <td><input value={c.etiqueta} placeholder="Ej.: Lugar de firma" onChange={(e) => cambiarEtiqueta(i, e.target.value)} /></td>
                                                    <td>
                                                        <input className="mono" value={c.clave} placeholder="lugar_firma"
                                                            onChange={(e) => actualizarCampo(i, { clave: e.target.value })}
                                                            onBlur={(e) => actualizarCampo(i, { clave: claveCampo(e.target.value) })} />
                                                    </td>
                                                    <td>
                                                        <select value={c.tipo} onChange={(e) => actualizarCampo(i, { tipo: e.target.value as TipoCampo })}>
                                                            {TIPOS_CAMPO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                                                        </select>
                                                    </td>
                                                    <td><input type="checkbox" checked={c.requerido} onChange={(e) => actualizarCampo(i, { requerido: e.target.checked })} /></td>
                                                    <td>
                                                        <div className="acciones">
                                                            <button type="button" className="btn btn-sec btn-sm" disabled={!claveCampo(c.clave)}
                                                                onClick={() => insertar(marcadorDeCampo({ ...c, clave: claveCampo(c.clave) }))}>Insertar</button>
                                                            <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar campo" onClick={() => quitarCampo(i)}>
                                                                <Icono n="papelera" tam={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ===== PÁGINA ===== */}
                    <div hidden={pestana !== 'pagina'}>
                        <div className="tarjeta">
                            <h3>Formato de la página</h3>
                            <div className="form-grid">
                                <Campo etiqueta="Tamaño de papel">
                                    <select value={config.tamano} onChange={(e) => setCfg({ tamano: e.target.value as TamanoPagina })}>
                                        <option value="carta">Carta (21,6 × 27,9 cm)</option>
                                        <option value="oficio">Oficio (21,6 × 33 cm)</option>
                                        <option value="a4">A4 (21 × 29,7 cm)</option>
                                    </select>
                                </Campo>
                                <Campo etiqueta="Fuente">
                                    <select value={config.fuente} onChange={(e) => setCfg({ fuente: e.target.value })}>
                                        {FUENTES_PAGINA.map((f) => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </Campo>
                                <Campo etiqueta="Tamaño de letra (pt)">
                                    <input type="number" min={8} max={24} step={0.5} value={config.tamanoPt}
                                        onChange={(e) => setCfg({ tamanoPt: Number(e.target.value) || 12 })} />
                                </Campo>
                                <Campo etiqueta="Interlineado">
                                    <select value={config.interlineado} onChange={(e) => setCfg({ interlineado: Number(e.target.value) })}>
                                        {INTERLINEADOS.map((n) => <option key={n} value={n}>{String(n).replace('.', ',')}</option>)}
                                    </select>
                                </Campo>
                                <label className="casilla ancho">
                                    <input type="checkbox" checked={config.sangria} onChange={(e) => setCfg({ sangria: e.target.checked })} />
                                    Sangría de primera línea en los párrafos
                                </label>
                            </div>
                            <p className="suave">Márgenes: 2,5 cm arriba, abajo y derecha; 3 cm a la izquierda. La vista previa en la pestaña «Texto» refleja estos valores.</p>
                        </div>
                    </div>

                    {/* ===== DATOS ===== */}
                    <div hidden={pestana !== 'datos'}>
                        <div className="tarjeta">
                            <h3>Datos del modelo</h3>
                            <div className="form-grid">
                                <Campo etiqueta="Categoría">
                                    <SelectCategoria value={categoria} onChange={(e) => { setCategoria(e.target.value); tocar(); }} />
                                </Campo>
                                <Campo etiqueta="Materia / tipo de expediente" ayuda="El asistente sugiere primero los modelos de la misma materia.">
                                    <SelectMateria value={materia} onChange={(e) => { setMateria(e.target.value); tocar(); }} />
                                </Campo>
                                <Campo etiqueta="Descripción" ancho>
                                    <textarea value={descripcion} onChange={(e) => { setDescripcion(e.target.value); tocar(); }} />
                                </Campo>
                                <Campo etiqueta="Nota de esta versión (opcional)" ancho>
                                    <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Qué cambió en esta versión" />
                                </Campo>
                            </div>
                        </div>
                    </div>
                </div>

                <aside className="panel-lateral">
                    <PanelCampos campos={campos} onInsertar={insertar} />
                </aside>
            </div>
        </div>
    );
}

function PanelVerificacion({ r, cerrar }: { r: ResultadoValidacion; cerrar: () => void }) {
    const ok = r.errores.length === 0;
    return (
        <div className="tarjeta verif">
            <div className="tarjeta-cab">
                <h3>{ok ? 'El modelo es válido' : 'El modelo tiene errores'}</h3>
                <button type="button" className="btn btn-fan btn-icono" onClick={cerrar} aria-label="Cerrar"><Icono n="cerrar" /></button>
            </div>
            <div className="lista-avisos">
                {r.errores.map((m, i) => <Alerta key={`e${i}`} tipo="error">{m}</Alerta>)}
                {r.advertencias.map((m, i) => <Alerta key={`a${i}`} tipo="adv">{m}</Alerta>)}
                {ok && r.advertencias.length === 0 && <Alerta tipo="ok">Sin errores ni advertencias.</Alerta>}
            </div>
            {r.info.length > 0 && <p className="suave">{r.info.join(' · ')}</p>}
            {r.esquema.length > 0 && (
                <details>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{r.esquema.length} campos detectados</summary>
                    <div style={{ marginTop: 10 }}><TablaEsquema esquema={r.esquema} /></div>
                </details>
            )}
        </div>
    );
}