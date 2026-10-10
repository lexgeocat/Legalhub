import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { esTextoLargo, tipoSugerido, usosCaso } from '../application/camposModelo';
import type { ResultadoImportacion, ResultadoValidacion } from '../application/casosDeUso/importarModelo';
import {
    AREA_MIN_CM, FUENTES_PAGINA, MARGEN_MAX_CM, PAGINA_CM, PRESETS_MARGENES,
    fuenteVacia, margenesSeguros, presetDe,
    type Alineacion, type CampoPropio, type DatoParte, type GrupoDatos, type ConfigPagina, type FuenteModelo, type Margenes, type TamanoPagina, type TipoCampo,
} from '../domain/fuenteModelo';
import { claveCampo, etiquetaRol } from '../domain/texto';
import {
    Alerta, Aviso, Campo, Icono, Insignia, Modal, SelectCategoria, SelectMateria, TablaEsquema,
    avisar, confirmar,
} from './comunes';
import { FORMATO_INICIAL, HojaEditable, type ControlHoja, type FormatoActivo, type MenuCampoInfo } from './HojaEditable';
import { PanelCampos } from './PanelCampos';
import { mensajeError, useCargar, useServicios } from './servicios';
import { ROL_PENDIENTE, etiquetaCampoCaso, rolesEnTexto, usosDatosParte } from '../domain/catalogo';
import { GRUPOS_FUENTES, buscarFuente, pilaCss, precargarFuentes } from '../domain/fuentes';
import { ModalMarcador } from './EditorMarcador';
import type { ContextoMarcadores } from '../domain/marcadores';
import { nuevoId } from '../domain/id';
import { datoAsignable, reasignarDato } from '../domain/camposParte';
import { MenuCampo } from './MenuCampo';

interface Inicial { nombre: string; materia: string; categoria: string; descripcion: string; fuente: FuenteModelo }

type Dialogo =
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
    const [partes, setPartes] = useState<string[]>(
        () => [...new Set([...(inicial.fuente.partes ?? []), ...rolesEnTexto(inicial.fuente.texto)])],
    );
    const [grupos, setGrupos] = useState<GrupoDatos[]>(inicial.fuente.grupos ?? []);
    const [ambito, setAmbito] = useState<string[]>([]);
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
    const [verCodigos, setVerCodigos] = useState(false);
    const [pendientes, setPendientes] = useState(0);
    const [menu, setMenu] = useState<MenuCampoInfo | null>(null);
    const cerrarMenu = useCallback(() => setMenu(null), []);
    const contextoMarcadores = useMemo<ContextoMarcadores>(() => ({
        campos: Object.fromEntries(
            campos.map((c) => [claveCampo(c.clave), c.etiqueta.trim() || etiquetaRol(claveCampo(c.clave))]),
        ),
        camposPartes: Object.fromEntries(
            grupos.flatMap((g) => g.datos).filter((d) => !d.ficha)
                .map((d) => [claveCampo(d.clave), d.etiqueta.trim() || etiquetaRol(claveCampo(d.clave))]),
        ),
        partes,
    }), [campos, grupos, partes]);

    const tocar = () => {
        setModificado(true);
        setVerif(null);
        setPendientes(hoja.current?.contarPendientes() ?? 0);
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
        partes,
        grupos,
    });

    /* ----- constructor de campos (panel único) ----- */
    const cambiarCampos = (l: CampoPropio[]) => {
        setCampos(l);
        tocar();
    };
    const cambiarPartes = (l: string[]) => {
        setPartes(l);
        tocar();
    };
    const cambiarGrupos = (l: GrupoDatos[]) => {
        setGrupos(l);
        tocar();
    };
    const insertar = (texto: string, bloque: boolean) => hoja.current?.insertar(texto, bloque);

    /** Declara los «caso.*», datos de partes y roles que escribiste a mano en el texto. */
    /** Declara los «caso.*», datos de partes y roles que escribiste a mano en el texto. */
    function detectar() {
        const texto = hoja.current?.leerTexto() ?? '';
        const GRUPO = 'Datos detectados';
        const idGrupo = grupos.find((g) => g.nombre === GRUPO)?.id ?? nuevoId();

        const declaradas = new Set(campos.map((c) => claveCampo(c.clave)));
        const nuevos: CampoPropio[] = [...usosCaso(texto).entries()]
            .filter(([k]) => !declaradas.has(k))
            .map(([k, u]) => ({
                clave: k, etiqueta: etiquetaCampoCaso(k), tipo: tipoDesdeUso(texto, k), requerido: !u.opcional, grupo: idGrupo,
            }));

        const yaPropios = new Set(grupos.flatMap((g) => g.datos).filter((d) => !d.ficha).map((d) => d.clave));
        const usos = usosDatosParte(texto);
        const propios: DatoParte[] = [];
        for (const u of usos) {
            if (yaPropios.has(u.clave) || propios.some((d) => d.clave === u.clave)) continue;
            propios.push({ clave: u.clave, etiqueta: etiquetaCampoCaso(u.clave), tipo: tipoSugerido(u.clave), requerido: !u.opcional });
        }

        const roles = [...new Set([...rolesEnTexto(texto), ...usos.map((u) => u.rol)])]
            .filter((r) => r !== 'cliente' && r !== 'abogado' && r !== ROL_PENDIENTE && !partes.includes(r));
        if (nuevos.length === 0 && propios.length === 0 && roles.length === 0) {
            avisar('No hay nada nuevo en el texto', 'info');
            return;
        }
        if (nuevos.length > 0) setCampos((l) => [...l, ...nuevos]);
        if (propios.length > 0 || nuevos.length > 0) {
            setGrupos((l) => {
                const i = l.findIndex((g) => g.id === idGrupo);
                if (i < 0) return [...l, { id: idGrupo, nombre: GRUPO, datos: propios }];
                return l.map((g, k) => (k === i ? { ...g, datos: [...g.datos, ...propios] } : g));
            });
        }
        if (roles.length > 0) setPartes((l) => [...l, ...roles]);
        tocar();
        avisar(`Se agregaron ${nuevos.length + propios.length} dato(s) y ${roles.length} parte(s)`);
    }

    /** Asigna a `rol` todos los datos de parte que siguen en ámbar. */
    function asignarPendientes(rol: string) {
        const n = hoja.current?.reasignar((m, amb) => {
            const d = datoAsignable(m, partes);
            return d && d.rol === null ? reasignarDato(m, rol, amb, partes) : null;
        }) ?? 0;
        avisar(
            n > 0 ? `${n} dato(s) asignados a ${etiquetaRol(rol)}` : 'No hay datos pendientes',
            n > 0 ? 'ok' : 'info',
        );
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
            setGrupos(f.grupos ?? []);
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
        precargarFuentes();
    }, []);

    useEffect(() => {
        setPendientes(hoja.current?.contarPendientes() ?? 0);
    }, []);

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
                    {GRUPOS_FUENTES.map((g) => {
                        const lista = fuentes.filter((f) => (buscarFuente(f)?.categoria ?? 'sistema') === g.id);
                        if (lista.length === 0) return null;
                        return (
                            <optgroup key={g.id} label={g.titulo}>
                                {lista.map((f) => (
                                    <option key={f} value={f} title={buscarFuente(f)?.nota} style={{ fontFamily: pilaCss(f) }}>{f}</option>
                                ))}
                            </optgroup>
                        );
                    })}
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
                <div className="espacio" />
                <Tb titulo="Mostrar el código {{…}} de cada campo en vez de su etiqueta corta" activo={verCodigos}
                    onClick={() => setVerCodigos((v) => !v)}>{'{ }'} Códigos</Tb>
                <Tb titulo="Mostrar u ocultar el constructor de campos (datos, partes y género)" activo={panel} onClick={() => setPanel(!panel)}>Campos</Tb>
            </div>

            {/* ===== Hoja + panel ===== */}
            <div className={`ed-cuerpo${panel ? '' : ' sin-panel'}`}>
                <div className="ed-pagina">
                    <HojaEditable
                        ref={hoja}
                        textoInicial={inicial.fuente.texto}
                        config={config}
                        onCambio={tocar}
                        onFormato={setFormato}
                        onEditarCampo={(actual, aplicar) => setDialogo({ n: 'marcador', actual, aplicar })}
                        onMargenes={setMargen}
                        onConfigurarPagina={() => setDialogo({ n: 'pagina' })}
                        onPaginas={setPaginas}
                        onAmbito={setAmbito}
                        contexto={contextoMarcadores}
                        verCodigos={verCodigos}
                        onMenuCampo={setMenu}
                    />
                </div>
                {panel && (
                    <aside className="ed-panel">
                        <PanelCampos
                            campos={campos}
                            partes={partes}
                            grupos={grupos}
                            ambito={ambito}
                            onCampos={cambiarCampos}
                            onPartes={cambiarPartes}
                            onGrupos={cambiarGrupos}
                            onInsertar={insertar}
                            onDetectar={detectar}
                            pendientes={pendientes}
                            onAsignarPendientes={asignarPendientes}
                        />
                    </aside>
                )}
            </div>

            <footer className="ed-estado">
                <span>
                    {PAPEL[config.tamano]} · {config.fuente} {coma(config.tamanoPt)} pt · interlineado {coma(config.interlineado)} ·
                    márgenes sup {coma(mg.superior)} · inf {coma(mg.inferior)} · izq {coma(mg.izquierdo)} · der {coma(mg.derecho)} cm ·
                    ≈ {paginas} pág.
                </span>
                <span>Pasa el mouse sobre un campo para ver qué es · doble clic: editarlo · Ctrl+G guardar</span>
            </footer>

            {/* ===== Diálogos ===== */}
            {dialogo?.n === 'pagina' && (
                <ModalPagina config={config} aplicar={aplicarPagina} cerrar={cerrarDialogo} />
            )}

            {dialogo?.n === 'marcador' && (
                <ModalMarcador
                    actual={dialogo.actual}
                    contexto={contextoMarcadores}
                    campos={campos}
                    cerrar={cerrarDialogo}
                    aplicar={(marcador, cambio) => {
                        dialogo.aplicar(marcador);
                        if (cambio) {
                            setCampos((l) => l.map((c) => (
                                claveCampo(c.clave) === claveCampo(cambio.clave)
                                    ? {
                                        ...c,
                                        ...(cambio.tipo ? { tipo: cambio.tipo } : {}),
                                        ...(cambio.requerido !== undefined ? { requerido: cambio.requerido } : {}),
                                    }
                                    : c
                            )));
                        }
                        tocar();
                    }}
                />
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
            {menu && <MenuCampo info={menu} partes={partes} contexto={contextoMarcadores} cerrar={cerrarMenu} />}
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