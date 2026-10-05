import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { esTextoLargo, usosCaso } from '../application/camposModelo';
import type { ResultadoImportacion, ResultadoValidacion } from '../application/casosDeUso/importarModelo';
import {
    AREA_MIN_CM, FUENTES_PAGINA, MARGEN_MAX_CM, PAGINA_CM, PRESETS_MARGENES, TIPOS_CAMPO,
    fuenteVacia, marcadorDeCampo, margenesSeguros, presetDe,
    type Alineacion, type CampoPropio, type ConfigPagina, type FuenteModelo, type Margenes, type TamanoPagina, type TipoCampo,
} from '../domain/fuenteModelo';
import { claveCampo, etiquetaRol } from '../domain/texto';
import {
    Alerta, Aviso, Campo, Icono, Insignia, Modal, SelectCategoria, SelectMateria, TablaEsquema, Vacio,
    avisar, confirmar,
} from './comunes';
import { FORMATO_INICIAL, HojaEditable, type ControlHoja, type FormatoActivo } from './HojaEditable';
import { PanelCampos } from './PanelCampos';
import { mensajeError, useCargar, useServicios } from './servicios';
import { etiquetaCampoCaso } from '../domain/catalogo';

interface Inicial { nombre: string; materia: string; categoria: string; descripcion: string; fuente: FuenteModelo }

type Dialogo =
    | { n: 'campos' }
    | { n: 'nuevoCampo' }
    | { n: 'datos' }
    | { n: 'pagina' }
    | { n: 'verificacion' }
    | { n: 'marcador'; actual: string; aplicar: (nuevo: string) => void };

const INTERLINEADOS = [1, 1.15, 1.5, 2];
const TAMANOS_LETRA = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24];
const PAPEL: Record<TamanoPagina, string> = { carta: 'Carta', oficio: 'Oficio', a4: 'A4' };
const TIPO_POR_FILTRO: Record<string, TipoCampo> = { moneda: 'moneda', fecha: 'fecha', superficie: 'superficie', literal: 'numero' };
const LADOS: (keyof Margenes)[] = ['superior', 'inferior', 'izquierdo', 'derecho'];
const NOMBRE_LADO: Record<keyof Margenes, string> = {
    superior: 'Superior', inferior: 'Inferior', izquierdo: 'Izquierdo', derecho: 'Derecho',
};

const ICO = {
    deshacer: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
    rehacer: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
};
const ICO_ALIN: Record<Alineacion, string> = {
    left: 'M4 6h16 M4 10h10 M4 14h16 M4 18h10',
    center: 'M4 6h16 M7 10h10 M4 14h16 M7 18h10',
    right: 'M4 6h16 M10 10h10 M4 14h16 M10 18h10',
    both: 'M4 6h16 M4 10h16 M4 14h16 M4 18h16',
};
const ETIQ_ALIN: Record<Alineacion, string> = {
    left: 'Alinear a la izquierda', center: 'Centrar', right: 'Alinear a la derecha', both: 'Justificar',
};

const coma = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

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

/* ---------------- Piezas de la cinta ---------------- */
function Ico({ d }: { d: string }) {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={d} />
        </svg>
    );
}

/** Botón de la cinta: no le quita el foco (ni la selección) a la hoja. */
function Tb({ titulo, activo, onClick, children }: {
    titulo: string; activo?: boolean; onClick: () => void; children: ReactNode;
}) {
    return (
        <button type="button" className={`ed-tb${activo ? ' on' : ''}`} title={titulo} aria-label={titulo}
            aria-pressed={activo} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
            {children}
        </button>
    );
}

const Sep = () => <span className="sep" />;

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

/* ---------------- Ventana del editor ---------------- */
function EditorInterno({ modeloId: idInicial, inicial, volver, guardado }: {
    modeloId?: string;
    inicial: Inicial;
    volver: () => void;
    guardado: (r: ResultadoImportacion) => void;
}) {
    const s = useServicios();
    const hoja = useRef<ControlHoja>(null);
    const guardarRef = useRef<() => void>(() => undefined);

    const [modeloId, setModeloId] = useState(idInicial);
    const [nombre, setNombre] = useState(inicial.nombre);
    const [materia, setMateria] = useState(inicial.materia);
    const [categoria, setCategoria] = useState(inicial.categoria);
    const [descripcion, setDescripcion] = useState(inicial.descripcion);
    const [config, setConfig] = useState<ConfigPagina>(inicial.fuente.config);
    const [campos, setCampos] = useState<CampoPropio[]>(inicial.fuente.campos);
    const [notas, setNotas] = useState('');
    const [formato, setFormato] = useState<FormatoActivo>(FORMATO_INICIAL);
    const [panel, setPanel] = useState(true);
    const [paginas, setPaginas] = useState(1);
    const [dialogo, setDialogo] = useState<Dialogo | null>(null);
    const [verif, setVerif] = useState<ResultadoValidacion | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [modificado, setModificado] = useState(false);
    const [ultima, setUltima] = useState<number | null>(null);
    const [ambito, setAmbito] = useState<string[]>([]);

    const tocar = () => {
        setModificado(true);
        setVerif(null);
    };
    const cerrarDialogo = () => setDialogo(null);

    const setCfg = (p: Partial<ConfigPagina>) => {
        setConfig((c) => ({ ...c, ...p }));
        tocar();
        window.setTimeout(() => hoja.current?.enfocar(), 0);
    };

    /** Desde la regla: un solo margen, sin quitarle el foco a la hoja. */
    const setMargen = (lado: keyof Margenes, cm: number) => {
        setConfig((c) => ({ ...c, margenes: margenesSeguros({ ...c.margenes, [lado]: cm }, c.tamano) }));
        tocar();
    };

    const aplicarPagina = (tamano: TamanoPagina, margenes: Margenes, simetricos: boolean) => {
        setCfg({ tamano, margenes: margenesSeguros(margenes, tamano), simetricos });
    };
    const armarFuente = (): FuenteModelo => ({
        version: 1,
        config,
        texto: hoja.current?.leerTexto() ?? inicial.fuente.texto,
        campos: normalizarCampos(campos),
    });

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
    const insertarCampo = (c: CampoPropio) => {
        hoja.current?.insertar(marcadorDeCampo({ ...c, clave: claveCampo(c.clave) }), false);
        cerrarDialogo();
    };
    function crearEInsertar(c: CampoPropio) {
        const existente = campos.find((x) => claveCampo(x.clave) === c.clave);
        if (!existente) {
            setCampos((l) => [...l, c]);
            tocar();
        }
        hoja.current?.insertar(marcadorDeCampo(existente ?? c), false);
        cerrarDialogo();
    }
    function detectar() {
        const texto = hoja.current?.leerTexto() ?? '';
        const declaradas = new Set(campos.map((c) => claveCampo(c.clave)));
        const nuevos: CampoPropio[] = [...usosCaso(texto).entries()]
            .filter(([k]) => !declaradas.has(k))
            .map(([k, u]) => ({ clave: k, etiqueta: etiquetaCampoCaso(k), tipo: tipoDesdeUso(texto, k), requerido: !u.opcional }));
        if (nuevos.length === 0) {
            avisar('No hay campos nuevos en el texto', 'info');
            return;
        }
        setCampos((l) => [...l, ...nuevos]);
        tocar();
        avisar(`Se agregaron ${nuevos.length} campo(s)`);
    }

    /** Inserta desde el panel y declara los «caso.*» que el texto usa y aún no existen. */
    function insertarDesdePanel(texto: string, bloque: boolean) {
        hoja.current?.insertar(texto, bloque);
        const declaradas = new Set(campos.map((c) => claveCampo(c.clave)));
        const nuevos: CampoPropio[] = [...usosCaso(texto).entries()]
            .filter(([k]) => !declaradas.has(k))
            .map(([k, u]) => ({ clave: k, etiqueta: etiquetaCampoCaso(k), tipo: tipoDesdeUso(texto, k), requerido: !u.opcional }));
        if (nuevos.length === 0) return;
        setCampos((l) => [...l, ...nuevos]);
        tocar();
    }

    /* ----- verificar y guardar ----- */
    function verificar() {
        try {
            setVerif(s.importarModelo.validar(armarFuente()));
            setError(null);
            setDialogo({ n: 'verificacion' });
        } catch (e) {
            setError(mensajeError(e));
        }
    }

    async function guardar(cerrarDespues: boolean) {
        if (guardando) return;
        setGuardando(true);
        try {
            const f = armarFuente();
            const r = await s.importarModelo.desdeFuente({
                modeloId, nombre, materia, categoria, descripcion, notas, fuente: f,
            });
            setModeloId(r.modeloId);
            setUltima(r.version);
            setCampos(f.campos);
            setModificado(false);
            setNotas('');
            setError(null);
            avisar(`Modelo guardado como versión ${r.version}`);
            guardado(r);
            if (cerrarDespues) {
                volver();
            } else if (r.escaneo.advertencias.length > 0) {
                setVerif({ docx: new Uint8Array(), esquema: r.escaneo.esquema, errores: [], advertencias: r.escaneo.advertencias, info: r.escaneo.info });
                setDialogo({ n: 'verificacion' });
            }
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

    useEffect(() => {
        guardarRef.current = () => void guardar(false);
    });
    useEffect(() => {
        const f = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 'g' || k === 's')) {
                e.preventDefault();
                guardarRef.current();
            }
        };
        window.addEventListener('keydown', f);
        return () => window.removeEventListener('keydown', f);
    }, []);

    /* ----- listas de la cinta (incluyen el valor actual aunque no sea estándar) ----- */
    const fuentes = FUENTES_PAGINA.includes(config.fuente) ? FUENTES_PAGINA : [...FUENTES_PAGINA, config.fuente];
    const tamanos = TAMANOS_LETRA.includes(config.tamanoPt)
        ? TAMANOS_LETRA : [...TAMANOS_LETRA, config.tamanoPt].sort((a, b) => a - b);
    const interlineados = INTERLINEADOS.includes(config.interlineado)
        ? INTERLINEADOS : [...INTERLINEADOS, config.interlineado].sort((a, b) => a - b);
    const preset = presetDe(config.margenes, config.simetricos);
    const mg = config.margenes;

    return (
        <div className="ed-ventana">
            {/* ===== Barra de título ===== */}
            <header className="ed-barra-titulo">
                <button type="button" className="btn btn-fan" onClick={() => void salir()}><Icono n="atras" /> Modelos</button>
                <input className="editor-nombre" placeholder="Nombre del modelo" value={nombre}
                    onChange={(e) => { setNombre(e.target.value); tocar(); }} />
                {ultima && <Insignia tono="verde">Guardado v{ultima}</Insignia>}
                {modificado && <Insignia tono="ambar">Sin guardar</Insignia>}
                <div className="espacio" />
                <button type="button" className="btn btn-fan" onClick={() => setDialogo({ n: 'datos' })}>Propiedades</button>
                <button type="button" className="btn btn-sec" onClick={verificar}>Verificar</button>
                <button type="button" className="btn btn-sec" disabled={guardando} onClick={() => void guardar(true)}>Guardar y cerrar</button>
                <button type="button" className="btn btn-pri" disabled={guardando} onClick={() => void guardar(false)}>Guardar versión</button>
            </header>

            {error && <div className="ed-aviso"><Aviso error={error} /></div>}

            {/* ===== Cinta de formato ===== */}
            <div className="ed-cinta" role="toolbar" aria-label="Formato">
                <Tb titulo="Deshacer (Ctrl+Z)" onClick={() => hoja.current?.deshacer()}><Ico d={ICO.deshacer} /></Tb>
                <Tb titulo="Rehacer (Ctrl+Y)" onClick={() => hoja.current?.rehacer()}><Ico d={ICO.rehacer} /></Tb>
                <Sep />
                <select className="ed-fuente" aria-label="Fuente" value={config.fuente} onChange={(e) => setCfg({ fuente: e.target.value })}>
                    {fuentes.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <select aria-label="Tamaño de letra" value={config.tamanoPt} onChange={(e) => setCfg({ tamanoPt: Number(e.target.value) })}>
                    {tamanos.map((n) => <option key={n} value={n}>{coma(n)}</option>)}
                </select>
                <select aria-label="Interlineado" title="Interlineado" value={config.interlineado}
                    onChange={(e) => setCfg({ interlineado: Number(e.target.value) })}>
                    {interlineados.map((n) => <option key={n} value={n}>{coma(n)}</option>)}
                </select>
                <Sep />
                <Tb titulo="Negrita (Ctrl+N)" activo={formato.negrita} onClick={() => hoja.current?.comando('negrita')}><b>N</b></Tb>
                <Tb titulo="Cursiva (Ctrl+K)" activo={formato.cursiva} onClick={() => hoja.current?.comando('cursiva')}><i>K</i></Tb>
                <Tb titulo="Subrayado (Ctrl+S)" activo={formato.subrayado} onClick={() => hoja.current?.comando('subrayado')}><u>S</u></Tb>
                <Sep />
                <Tb titulo="Título (centrado, negrita)" activo={formato.estilo === 'titulo'} onClick={() => hoja.current?.estilo('titulo')}>Título</Tb>
                <Tb titulo="Subtítulo" activo={formato.estilo === 'subtitulo'} onClick={() => hoja.current?.estilo('subtitulo')}>Subtítulo</Tb>
                <Sep />
                {(['left', 'center', 'right', 'both'] as Alineacion[]).map((a) => (
                    <Tb key={a} titulo={ETIQ_ALIN[a]} activo={formato.alineacion === a} onClick={() => hoja.current?.alinear(a)}>
                        <Ico d={ICO_ALIN[a]} />
                    </Tb>
                ))}
                <Sep />
                <Tb titulo="Salto de página" onClick={() => hoja.current?.saltoPagina()}>Salto de página</Tb>
                <Tb titulo="Línea de firma" onClick={() => hoja.current?.insertar('[c] ______________________________', true)}>Línea de firma</Tb>
                <Sep />
                <select aria-label="Tamaño de papel" title="Tamaño de papel" value={config.tamano}
                    onChange={(e) => {
                        const t = e.target.value as TamanoPagina;
                        setCfg({ tamano: t, margenes: margenesSeguros(config.margenes, t) });
                    }}>
                    {(Object.keys(PAPEL) as TamanoPagina[]).map((t) => <option key={t} value={t}>{PAPEL[t]}</option>)}
                </select>
                <span className="etq">Márgenes</span>
                <select aria-label="Márgenes" title={`Sup. ${coma(mg.superior)} · Inf. ${coma(mg.inferior)} · Izq. ${coma(mg.izquierdo)} · Der. ${coma(mg.derecho)} cm`}
                    value={preset?.id ?? 'personalizado'}
                    onChange={(e) => {
                        const p = PRESETS_MARGENES.find((x) => x.id === e.target.value);
                        if (p) setCfg({ margenes: margenesSeguros(p.margenes, config.tamano), simetricos: p.simetricos });
                    }}>
                    {PRESETS_MARGENES.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
                    {!preset && <option value="personalizado">Personalizado</option>}
                </select>
                <Tb titulo="Configurar página: papel y márgenes en cm" onClick={() => setDialogo({ n: 'pagina' })}>Página…</Tb>
                <Tb titulo="Sangría de primera línea" activo={config.sangria} onClick={() => setCfg({ sangria: !config.sangria })}>Sangría</Tb>
                <Sep />
                <Tb titulo="Crear un campo nuevo e insertarlo en el cursor" onClick={() => setDialogo({ n: 'nuevoCampo' })}>
                    <Icono n="mas" tam={14} /> Campo nuevo
                </Tb>
                <Tb titulo="Administrar los campos del caso" onClick={() => setDialogo({ n: 'campos' })}>Campos del caso ({campos.length})</Tb>
                <div className="espacio" />
                <Tb titulo="Mostrar u ocultar el panel de campos" activo={panel} onClick={() => setPanel(!panel)}>Panel de campos</Tb>
            </div>

            {/* ===== Hoja + panel ===== */}
            <div className={`ed-cuerpo${panel ? '' : ' sin-panel'}`}>
                <div className="ed-pagina">
                    <HojaEditable
                        ref={hoja}
                        textoInicial={inicial.fuente.texto}
                        config={config}
                        onCambio={tocar}
                        onAmbito={setAmbito}
                        onFormato={setFormato}
                        onEditarCampo={(actual, aplicar) => setDialogo({ n: 'marcador', actual, aplicar })}
                        onMargenes={setMargen}
                        onConfigurarPagina={() => setDialogo({ n: 'pagina' })}
                        onPaginas={setPaginas}
                    />
                </div>
                {panel && (
                    <aside className="ed-panel">
                        <PanelCampos campos={campos} ambito={ambito} materia={materia} onInsertar={insertarDesdePanel} />
                    </aside>
                )}
            </div>

            <footer className="ed-estado">
                <span>
                    {PAPEL[config.tamano]} · {config.fuente} {coma(config.tamanoPt)} pt · interlineado {coma(config.interlineado)} ·
                    márgenes sup {coma(mg.superior)} · inf {coma(mg.inferior)} · izq {coma(mg.izquierdo)} · der {coma(mg.derecho)} cm ·
                    ≈ {paginas} pág.
                </span>
                <span>Arrastra los márgenes en la regla · doble clic en la regla: configurar página · Ctrl+S guardar</span>
            </footer>

            {/* ===== Diálogos ===== */}
            {dialogo?.n === 'pagina' && (
                <ModalPagina config={config} aplicar={aplicarPagina} cerrar={cerrarDialogo} />
            )}

            {dialogo?.n === 'marcador' && (
                <ModalMarcador actual={dialogo.actual} aplicar={dialogo.aplicar} cerrar={cerrarDialogo} />
            )}

            {dialogo?.n === 'nuevoCampo' && (
                <ModalNuevoCampo cerrar={cerrarDialogo} crear={crearEInsertar} />
            )}

            {dialogo?.n === 'verificacion' && verif && (
                <Modal titulo="Verificación del modelo" ancho="grande" cerrar={cerrarDialogo}
                    pie={<><span className="espacio" /><button type="button" className="btn btn-pri" onClick={cerrarDialogo}>Cerrar</button></>}>
                    <ContenidoVerificacion r={verif} />
                </Modal>
            )}

            {dialogo?.n === 'datos' && (
                <Modal titulo="Propiedades del modelo" cerrar={cerrarDialogo}
                    pie={<><span className="espacio" /><button type="button" className="btn btn-pri" onClick={cerrarDialogo}>Listo</button></>}>
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
                </Modal>
            )}

            {dialogo?.n === 'campos' && (
                <Modal titulo="Campos del caso" ancho="grande" cerrar={cerrarDialogo}
                    pie={<><span className="espacio" /><button type="button" className="btn btn-pri" onClick={cerrarDialogo}>Listo</button></>}>
                    <div className="tarjeta-cab">
                        <p className="suave">Datos propios de este documento que no vienen de personas ni de inmuebles (precio, plazo, hechos…). Se toman del expediente o el asistente los pide al generar.</p>
                        <div className="acciones">
                            <button type="button" className="btn btn-sec btn-sm" onClick={detectar}>Detectar del texto</button>
                            <button type="button" className="btn btn-pri btn-sm" onClick={agregarCampo}><Icono n="mas" tam={15} /> Agregar campo</button>
                        </div>
                    </div>
                    {campos.length === 0 ? (
                        <Vacio titulo="Sin campos propios" texto="Usa «Campo nuevo» en la cinta, o «Detectar del texto» si ya escribiste marcadores {{caso.…}}." />
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
                                                    <button type="button" className="btn btn-sec btn-sm" disabled={!claveCampo(c.clave)} onClick={() => insertarCampo(c)}>Insertar</button>
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
                </Modal>
            )}
        </div>
    );
}

/* ---------------- Configurar página ---------------- */
const aTextos = (m: Margenes): Record<keyof Margenes, string> => ({
    superior: coma(m.superior), inferior: coma(m.inferior), izquierdo: coma(m.izquierdo), derecho: coma(m.derecho),
});
const aNumero = (s: string) => (s.trim() === '' ? NaN : Number(s.trim().replace(',', '.')));

function MiniPagina({ w, h, m }: { w: number; h: number; m: Margenes | null }) {
    const ancho = 120;
    const k = ancho / w;
    const alto = h * k;
    const x = (m?.izquierdo ?? 0) * k;
    const y = (m?.superior ?? 0) * k;
    const anchoUtil = m ? Math.max(0, (w - m.izquierdo - m.derecho) * k) : 0;
    const altoUtil = m ? Math.max(0, (h - m.superior - m.inferior) * k) : 0;
    const lineas = Math.min(40, Math.floor((altoUtil - 2) / 6));
    return (
        <svg width={ancho} height={alto} aria-hidden="true" style={{ flex: 'none', background: '#fff', border: '1px solid var(--borde-fuerte)', boxShadow: 'var(--sombra)' }}>
            {m && anchoUtil > 0 && altoUtil > 0 && (
                <>
                    <rect x={x} y={y} width={anchoUtil} height={altoUtil} fill="none" stroke="#8b9bd9" strokeDasharray="3 2" />
                    {Array.from({ length: Math.max(0, lineas) }, (_, i) => (
                        <line key={i} x1={x + 3} x2={x + anchoUtil - 3} y1={y + 5 + i * 6} y2={y + 5 + i * 6} stroke="#c3c8d6" strokeWidth="1.5" />
                    ))}
                </>
            )}
        </svg>
    );
}

function ModalPagina({ config, aplicar, cerrar }: {
    config: ConfigPagina;
    aplicar: (tamano: TamanoPagina, m: Margenes, simetricos: boolean) => void;
    cerrar: () => void;
}) {
    const [tamano, setTamano] = useState<TamanoPagina>(config.tamano);
    const [txt, setTxt] = useState(aTextos(config.margenes));
    const [sim, setSim] = useState(config.simetricos);
    const [error, setError] = useState<string | null>(null);

    const nums: Margenes = {
        superior: aNumero(txt.superior), inferior: aNumero(txt.inferior),
        izquierdo: aNumero(txt.izquierdo), derecho: aNumero(txt.derecho),
    };
    const valido = LADOS.every((l) => Number.isFinite(nums[l]) && nums[l] >= 0);
    const preset = valido ? presetDe(nums, sim) : undefined;
    const pag = PAGINA_CM[tamano];

    const enviar = (ev: FormEvent<HTMLFormElement>) => {
        ev.preventDefault();
        if (!valido) {
            setError('Escribe cada margen en centímetros (por ejemplo 2,5).');
            return;
        }
        if (LADOS.some((l) => nums[l] > MARGEN_MAX_CM)) {
            setError(`Ningún margen puede pasar de ${MARGEN_MAX_CM} cm.`);
            return;
        }
        if (pag.w - nums.izquierdo - nums.derecho < AREA_MIN_CM) {
            setError(`Los márgenes izquierdo y derecho dejan menos de ${AREA_MIN_CM} cm de ancho para el texto.`);
            return;
        }
        if (pag.h - nums.superior - nums.inferior < AREA_MIN_CM) {
            setError(`Los márgenes superior e inferior dejan menos de ${AREA_MIN_CM} cm de alto para el texto.`);
            return;
        }
        aplicar(tamano, nums, sim);
        cerrar();
    };

    return (
        <Modal titulo="Configurar página" cerrar={cerrar}
            pie={
                <>
                    <span className="espacio" />
                    <button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button>
                    <button type="submit" form="form-pagina" className="btn btn-pri">Aplicar</button>
                </>
            }>
            <Aviso error={error} />
            <form id="form-pagina" onSubmit={enviar}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 20, alignItems: 'start' }}>
                <div className="form-grid">
                    <Campo etiqueta="Tamaño de papel">
                        <select value={tamano} onChange={(e) => { setTamano(e.target.value as TamanoPagina); setError(null); }}>
                            <option value="carta">Carta (21,6 × 27,9 cm)</option>
                            <option value="oficio">Oficio (21,6 × 33 cm)</option>
                            <option value="a4">A4 (21 × 29,7 cm)</option>
                        </select>
                    </Campo>
                    <Campo etiqueta="Márgenes predefinidos">
                        <select value={preset?.id ?? 'personalizado'}
                            onChange={(e) => {
                                const p = PRESETS_MARGENES.find((x) => x.id === e.target.value);
                                if (p) { setTxt(aTextos(p.margenes)); setSim(p.simetricos); setError(null); }
                            }}>
                            {PRESETS_MARGENES.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
                            {!preset && <option value="personalizado">Personalizado</option>}
                        </select>
                    </Campo>
                    {LADOS.map((l) => (
                        <Campo key={l} etiqueta={`${NOMBRE_LADO[l]} (cm)`}>
                            <input inputMode="decimal" value={txt[l]}
                                onChange={(e) => { setTxt((t) => ({ ...t, [l]: e.target.value })); setError(null); }} />
                        </Campo>
                    ))}
                    <label className="casilla ancho">
                        <input type="checkbox" checked={sim} onChange={(e) => setSim(e.target.checked)} />
                        Márgenes simétricos (espejo): el izquierdo pasa a ser el interior y se alterna en cada hoja
                    </label>
                    <p className="suave ancho">
                        Memorial: superior 5,5 · inferior 2 · izquierdo 4 · derecho 2. Los márgenes se aplican a todas las páginas, como en Word.
                    </p>
                </div>
                <MiniPagina w={pag.w} h={pag.h} m={valido ? nums : null} />
            </form>
        </Modal>
    );
}

/* ---------------- Diálogos pequeños ---------------- */
function ModalMarcador({ actual, aplicar, cerrar }: {
    actual: string; aplicar: (nuevo: string) => void; cerrar: () => void;
}) {
    const [valor, setValor] = useState(actual);
    const enviar = (ev: FormEvent<HTMLFormElement>) => {
        ev.preventDefault();
        aplicar(valor);
        cerrar();
    };
    return (
        <Modal titulo="Editar campo" ancho="chica" cerrar={cerrar}
            pie={
                <>
                    <button type="button" className="btn btn-peligro" onClick={() => { aplicar(''); cerrar(); }}>Quitar campo</button>
                    <span className="espacio" />
                    <button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button>
                    <button type="submit" form="form-marcador" className="btn btn-pri">Aplicar</button>
                </>
            }>
            <form id="form-marcador" onSubmit={enviar}>
                <Campo etiqueta="Marcador" ayuda="Ej.: {{caso.precio | moneda}}. Un «?» al final del nombre lo hace opcional.">
                    <input className="mono" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} />
                </Campo>
            </form>
        </Modal>
    );
}

function ModalNuevoCampo({ cerrar, crear }: { cerrar: () => void; crear: (c: CampoPropio) => void }) {
    const [etiqueta, setEtiqueta] = useState('');
    const [tipo, setTipo] = useState<TipoCampo>('texto');
    const [requerido, setRequerido] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const clave = claveCampo(etiqueta);

    const enviar = (ev: FormEvent<HTMLFormElement>) => {
        ev.preventDefault();
        if (!clave) {
            setError('Escribe un nombre para el campo (letras o números)');
            return;
        }
        crear({ clave, etiqueta: etiqueta.trim(), tipo, requerido });
    };

    return (
        <Modal titulo="Nuevo campo del caso" ancho="chica" cerrar={cerrar}
            pie={
                <>
                    <span className="espacio" />
                    <button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button>
                    <button type="submit" form="form-nuevo-campo" className="btn btn-pri">Crear e insertar</button>
                </>
            }>
            <Aviso error={error} />
            <form id="form-nuevo-campo" className="form-grid" onSubmit={enviar}>
                <Campo etiqueta="Nombre del campo" ancho ayuda={clave ? `Se insertará como caso.${clave}` : 'Ej.: Lugar de firma, Precio, Plazo'}>
                    <input autoFocus value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
                </Campo>
                <Campo etiqueta="Tipo">
                    <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCampo)}>
                        {TIPOS_CAMPO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                    </select>
                </Campo>
                <label className="casilla">
                    <input type="checkbox" checked={requerido} onChange={(e) => setRequerido(e.target.checked)} />
                    Obligatorio
                </label>
            </form>
        </Modal>
    );
}

function ContenidoVerificacion({ r }: { r: ResultadoValidacion }) {
    const ok = r.errores.length === 0;
    return (
        <>
            <Alerta tipo={ok ? 'ok' : 'error'}>{ok ? 'El modelo es válido.' : 'El modelo tiene errores.'}</Alerta>
            <div className="lista-avisos">
                {r.errores.map((m, i) => <Alerta key={`e${i}`} tipo="error">{m}</Alerta>)}
                {r.advertencias.map((m, i) => <Alerta key={`a${i}`} tipo="adv">{m}</Alerta>)}
            </div>
            {r.info.length > 0 && <p className="suave">{r.info.join(' · ')}</p>}
            {r.esquema.length > 0 && (
                <>
                    <h3>{r.esquema.length} campos detectados</h3>
                    <TablaEsquema esquema={r.esquema} />
                </>
            )}
        </>
    );
}