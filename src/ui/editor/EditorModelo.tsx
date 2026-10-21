import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { esTextoLargo, tipoSugerido, usosCaso } from '../../application/camposModelo';
import type { ResultadoImportacion, ResultadoValidacion } from '../../application/casosDeUso/importarModelo';
import { datoAsignable, reasignarDato } from '../../domain/modelos/camposParte';
import { ROL_PENDIENTE, etiquetaCampoCaso, rolesEnTexto, usosDatosParte } from '../../domain/expedientes/catalogo';
import {
    fuenteVacia,
    type CampoPropio, type ConfigPagina, type DatoParte, type FuenteModelo, type GrupoDatos, type TipoCampo,
} from '../../domain/modelos/fuenteModelo';
import { precargarFuentes } from '../../domain/fuentes/fuentes';
import { nuevoId } from '../../domain/comun/id';
import { contextoDeFuente, describirMarcador, type ContextoMarcadores } from '../../domain/modelos/marcadores';
import { claveCampo, etiquetaRol } from '../../domain/comun/texto';
import { SelectFuente, SelectInterlineado, SelectTamano, Tb } from './BarraFormato';
import {
    Alerta, Aviso, Campo, Icono, Insignia, Modal, Segmentado, SelectCategoria, SelectMateria, TablaEsquema,
    avisar, confirmar,
} from '../_core/comunes';
import { EditorHoja } from './EditorHoja';
import { ModalMarcador } from './EditorMarcador';
import type { ControlHoja, EdicionDirecta, LlenadoHoja, MenuCampoInfo, SelectorEdicion } from './HojaEditable';
import { MenuCampo } from './MenuCampo';
import { PanelCampos } from './PanelCampos';
import { mensajeError, useCargar, useServicios } from '../_core/servicios';

export interface Inicial { nombre: string; materia: string; categoria: string; descripcion: string; fuente: FuenteModelo }

type Dialogo =
    | { n: 'datos' }
    | { n: 'verificacion' }
    | { n: 'marcador'; actual: string; aplicar: (nuevo: string) => void; ambito: string[] };

type VistaEditor = 'llenar' | 'modelo';

/** Lo que aporta Expediente → Datos para llenar los datos reales escribiendo directamente sobre el documento. */
export interface LlenadoVentana {
    /** Texto del dato tal como se ve en el documento: '' = falta, undefined = no se llena aquí (queda como etiqueta). */
    valor: (marcador: string, ambito: string[]) => string | undefined;
    /** Texto crudo (sin filtros) que se edita sobre el propio documento. */
    crudo: (marcador: string, ambito: string[]) => EdicionDirecta | undefined;
    /** Recibe lo escrito sobre el documento (queda en el estado del expediente; «Guardar datos» lo persiste). */
    guardar: (marcador: string, ambito: readonly string[], valor: string) => void;
    sucio: boolean;
    guardando: boolean;
    /** true si se guardó bien. */
    guardarDatos: () => Promise<boolean>;
    /** Modelo de Word: solo se llenan datos. */
    /** Selector junto al dato mientras se edita (género al escribir el nombre de una parte). */
    selector?: (marcador: string, ambito: string[]) => SelectorEdicion | undefined;
    soloLectura?: boolean;
}

const TIPO_POR_FILTRO: Record<string, TipoCampo> = {
    moneda: 'moneda', dolares: 'dolares', fechalarga: 'fechalarga', fecha: 'fecha', superficie: 'superficie', literal: 'numero',
};

const normalizarCampos = (l: CampoPropio[]): CampoPropio[] =>
    l.map((c) => {
        const clave = claveCampo(c.clave);
        return { ...c, clave, etiqueta: c.etiqueta.trim() || etiquetaRol(clave) };
    });

function tipoDesdeUso(texto: string, clave: string): TipoCampo {
    const m = new RegExp(`\\{\\{\\s*caso\\.${clave}\\s*\\??\\s*\\|\\s*(moneda|dolares|fechalarga|fecha|superficie|literal)`, 'iu').exec(texto);
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
            <EditorModeloVentana
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
        <EditorModeloVentana
            modeloId={undefined}
            inicial={{ nombre: '', materia: '', categoria: '', descripcion: '', fuente: fuenteVacia() }}
            volver={volver}
            guardado={guardado}
        />
    );
}

/* ---------------- Ventana del editor (modelo y llenado) ---------------- */
export function EditorModeloVentana({ modeloId: idInicial, inicial, volver, guardado, llenado }: {
    modeloId?: string;
    inicial: Inicial;
    volver: () => void;
    guardado: (r: ResultadoImportacion) => void;
    /** Si se indica, la ventana abre en «Llenar datos» y permite pasar a «Editar modelo». */
    llenado?: LlenadoVentana;
}) {
    const s = useServicios();
    const hoja = useRef<ControlHoja>(null);
    const guardarRef = useRef<() => void>(() => undefined);
    const soloLectura = !!llenado?.soloLectura;

    const [vista, setVista] = useState<VistaEditor>(llenado ? 'llenar' : 'modelo');
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
    const [panelAbierto, setPanelAbierto] = useState(true);
    const [dialogo, setDialogo] = useState<Dialogo | null>(null);
    const [verif, setVerif] = useState<ResultadoValidacion | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [modificado, setModificado] = useState(false);
    const [ultima, setUltima] = useState<number | null>(null);
    const [verCodigos, setVerCodigos] = useState(false);
    const [verEjemplos, setVerEjemplos] = useState(false);
    const [pendientes, setPendientes] = useState(0);
    const [menu, setMenu] = useState<MenuCampoInfo | null>(null);
    const cerrarMenu = useCallback(() => setMenu(null), []);

    const contextoMarcadores = useMemo<ContextoMarcadores>(
        () => contextoDeFuente({ campos, grupos, partes }),
        [campos, grupos, partes],
    );

    /** «Llenar datos»: se escribe directamente sobre el dato del documento. «Ejemplos»: solo vista. */
    const llenadoHoja = useMemo<LlenadoHoja | undefined>(() => {
        if (llenado && vista === 'llenar') {
            return { valor: llenado.valor, crudo: llenado.crudo, guardar: llenado.guardar, selector: llenado.selector };
        }
        if (verEjemplos && vista === 'modelo') {
            return {
                soloVista: true,
                valor: (m) => describirMarcador(m, contextoMarcadores).ejemplo || undefined,
            };
        }
        return undefined;
    }, [llenado, vista, verEjemplos, contextoMarcadores]);

    const tocar = () => {
        setModificado(true);
        setVerif(null);
        setPendientes(hoja.current?.contarPendientes() ?? 0);
    };
    const cerrarDialogo = () => setDialogo(null);

    function cambiarVista(v: VistaEditor) {
        setMenu(null);
        setVerEjemplos(false);
        setVista(v);
    }

    /** Fuente / tamaño / interlineado base del documento (Propiedades). */
    const setBase = (p: Partial<ConfigPagina>) => {
        setConfig((c) => ({ ...c, ...p }));
        tocar();
    };

    const armarFuente = (): FuenteModelo => ({
        version: 1,
        config,
        texto: hoja.current?.leerTexto() ?? inicial.fuente.texto,
        campos: normalizarCampos(campos),
        partes,
        grupos,
    });

    /* ----- constructor de campos ----- */
    const cambiarCampos = (l: CampoPropio[]) => { setCampos(l); tocar(); };
    const cambiarPartes = (l: string[]) => { setPartes(l); tocar(); };
    const cambiarGrupos = (l: GrupoDatos[]) => { setGrupos(l); tocar(); };
    const insertar = (texto: string, bloque: boolean) => hoja.current?.insertar(texto, bloque);

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
        if (guardando || soloLectura) return;
        // Al guardar el modelo se recargan las partes: primero se guardan los datos para no perderlos.
        if (llenado?.sucio && !(await llenado.guardarDatos())) return;
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
        if (modificado && !soloLectura && !(await confirmar('Hay cambios del modelo sin guardar. ¿Salir sin guardarlos?'))) return;
        volver();
    }

    useEffect(() => {
        guardarRef.current = () => {
            if (llenado && vista === 'llenar') void llenado.guardarDatos();
            else void guardar(false);
        };
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

    const modoModelo = vista === 'modelo';

    return (
        <div className="ed-ventana">
            {/* ===== Barra de título ===== */}
            <header className="ed-barra-titulo">
                <button type="button" className="btn btn-fan" onClick={() => void salir()}>
                    <Icono n="atras" /> {llenado ? 'Expediente' : 'Modelos'}
                </button>

                {modoModelo ? (
                    <input className="editor-nombre" placeholder="Nombre del modelo" value={nombre} readOnly={soloLectura}
                        onChange={(e) => { setNombre(e.target.value); tocar(); }} />
                ) : (
                    <b className="ed-nombre" title={nombre}>{nombre}</b>
                )}

                {llenado && !soloLectura && (
                    <Segmentado<VistaEditor>
                        valor={vista}
                        cambiar={cambiarVista}
                        opciones={[{ id: 'llenar', etiqueta: 'Llenar datos' }, { id: 'modelo', etiqueta: 'Editar modelo' }]}
                    />
                )}
                {llenado && soloLectura && <Insignia tono="gris">Modelo de Word: solo llenado</Insignia>}
                {ultima && <Insignia tono="verde">Modelo guardado v{ultima}</Insignia>}
                {modificado && <Insignia tono="ambar">Modelo sin guardar</Insignia>}
                {llenado?.sucio && <Insignia tono="rojo">Datos sin guardar</Insignia>}

                <div className="espacio" />

                {llenado && !modoModelo ? (
                    <>
                        {modificado && (
                            <button type="button" className="btn btn-sec" disabled={guardando} onClick={() => void guardar(false)}>
                                Guardar modelo
                            </button>
                        )}
                        <button type="button" className="btn btn-pri" disabled={!llenado.sucio || llenado.guardando}
                            onClick={() => void llenado.guardarDatos()}>
                            {llenado.guardando ? 'Guardando…' : 'Guardar datos'}
                        </button>
                    </>
                ) : (
                    <>
                        <button type="button" className="btn btn-fan" onClick={() => setDialogo({ n: 'datos' })}>Propiedades</button>
                        <button type="button" className="btn btn-sec" onClick={verificar}>Verificar</button>
                        {!llenado && (
                            <button type="button" className="btn btn-sec" disabled={guardando} onClick={() => void guardar(true)}>Guardar y cerrar</button>
                        )}
                        <button type="button" className="btn btn-pri" disabled={guardando} onClick={() => void guardar(false)}>Guardar versión</button>
                    </>
                )}
            </header>

            {error && <div className="ed-aviso"><Aviso error={error} /></div>}
            {llenado && !modoModelo && modificado && (
                <div className="ed-aviso">
                    <Alerta tipo="info">Cambiaste el texto del modelo. Guárdalo («Guardar modelo») para poder llenar los campos nuevos.</Alerta>
                </div>
            )}

            {/* ===== Cinta + hoja + panel + pie (compartido) ===== */}
            <EditorHoja
                hoja={hoja}
                textoInicial={inicial.fuente.texto}
                config={config}
                onConfig={(c) => { setConfig(c); tocar(); }}
                onCambio={tocar}
                conFirma={modoModelo}
                soloLectura={soloLectura}
                contexto={contextoMarcadores}
                verCodigos={modoModelo && verCodigos}
                llenado={llenadoHoja}
                onAmbito={setAmbito}
                onMenuCampo={modoModelo ? setMenu : undefined}
                onEditarCampo={modoModelo ? (actual, aplicar, amb) => setDialogo({ n: 'marcador', actual, aplicar, ambito: amb }) : undefined}
                barra={modoModelo ? (
                    <>
                        <Tb titulo="Ver el documento con los datos de ejemplo de cada campo" activo={verEjemplos}
                            onClick={() => { setVerEjemplos((v) => !v); setVerCodigos(false); }}>Ejemplos</Tb>
                        <Tb titulo="Mostrar el código {{…}} de cada campo en vez de su etiqueta corta" activo={verCodigos}
                            onClick={() => { setVerCodigos((v) => !v); setVerEjemplos(false); }}>{'{ }'} Códigos</Tb>
                        <Tb titulo="Mostrar u ocultar el constructor de campos (datos, partes y género)" activo={panelAbierto}
                            onClick={() => setPanelAbierto((v) => !v)}>Campos</Tb>
                    </>
                ) : undefined}
                panel={modoModelo && panelAbierto ? (
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
                ) : undefined}
                ayuda={modoModelo
                    ? 'Pasa el mouse sobre un campo para ver qué es · doble clic: editarlo · Ctrl+G guardar'
                    : 'Clic en un dato y escribe · Enter confirma · Esc cancela · Tab siguiente dato · Ctrl+G guardar datos'}
            />

            {/* ===== Diálogos ===== */}
            {dialogo?.n === 'marcador' && (
                <ModalMarcador
                    actual={dialogo.actual}
                    ambito={dialogo.ambito}
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
                        <Campo etiqueta="Fuente base" ayuda="La usa todo el texto que no tenga una fuente propia.">
                            <SelectFuente valor={config.fuente} onCambio={(f) => setBase({ fuente: f })} />
                        </Campo>
                        <Campo etiqueta="Tamaño base (pt)">
                            <SelectTamano valor={config.tamanoPt} onCambio={(n) => setBase({ tamanoPt: n })} />
                        </Campo>
                        <Campo etiqueta="Interlineado base">
                            <SelectInterlineado valor={config.interlineado} onCambio={(n) => setBase({ interlineado: n })} />
                        </Campo>
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