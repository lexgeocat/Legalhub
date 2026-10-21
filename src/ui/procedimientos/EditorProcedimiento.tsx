import { useEffect, useMemo, useRef, useState } from 'react';
import {
    sinRequisito,
    type DatosProcedimiento, type Paso, type Procedimiento, type Requisito,
} from '../../domain/procedimientos/procedimientos';
import { borrarBorrador, guardarBorrador, leerBorrador } from '../editor/borradores';
import {
    Alerta, Aviso, Campo, Icono, Insignia, Pestanas, SelectMateria,
    avisar, confirmar, etiquetaMateria, marcarCambiosPendientes,
} from '../_core/comunes';
import { FlujoProcedimiento } from './FlujoProcedimiento';
import { RequisitosProcedimiento } from './RequisitosProcedimiento';
import { mensajeError, useCargar, useServicios } from '../_core/servicios';
import './procedimientos.css';

type PestanaProc = 'requisitos' | 'flujo' | 'datos';

const RESPONSABLES_BASE = ['Cliente', 'Abogado', 'Juzgado', 'Demandante', 'Demandado'];

interface BorradorProc {
    nombre: string;
    materia: string;
    descripcion: string;
    baseLegal: string;
    requisitos: Requisito[];
    carriles: string[];
    pasos: Paso[];
}

/** Crea (sin `id`) o edita un procedimiento. */
export function EditorProcedimiento({ id, volver }: { id?: string; volver: () => void }) {
    const s = useServicios();
    const carga = useCargar(async () => ({ p: id ? await s.procedimientos.obtener(id) : null }), [id]);
    const atras = <button type="button" className="btn btn-fan" onClick={volver}><Icono n="atras" /> Procedimientos</button>;

    if (carga.error) return <div className="pagina">{atras}<Aviso error={carga.error} /></div>;
    if (!carga.datos) return <div className="pagina">{atras}<p className="suave">Cargando…</p></div>;
    if (id && !carga.datos.p) return <div className="pagina">{atras}<Aviso error="El procedimiento ya no existe." /></div>;
    return <Editor inicial={carga.datos.p} volver={volver} />;
}

function Editor({ inicial, volver }: { inicial: Procedimiento | null; volver: () => void }) {
    const s = useServicios();
    const [idActual, setIdActual] = useState(inicial?.id);
    const [nombre, setNombre] = useState(inicial?.nombre ?? '');
    const [materia, setMateria] = useState(inicial?.materia ?? '');
    const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '');
    const [baseLegal, setBaseLegal] = useState(inicial?.baseLegal ?? '');
    const [requisitos, setRequisitos] = useState<Requisito[]>(inicial?.requisitos ?? []);
    const [pasos, setPasos] = useState<Paso[]>(inicial?.flujo.pasos ?? []);
    const [carriles, setCarriles] = useState<string[]>(inicial?.flujo.carriles ?? []);
    const [pestana, setPestana] = useState<PestanaProc>(inicial ? 'requisitos' : 'datos');
    const [sucio, setSucio] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clave = `procedimiento:${idActual ?? 'nuevo'}`;
    const [borrador, setBorrador] = useState(() => leerBorrador<BorradorProc>(clave));
    const guardarRef = useRef<() => void>(() => undefined);

    const tocar = () => setSucio(true);

    const usos = useMemo(() => {
        const m = new Map<string, number>();
        for (const p of pasos) for (const r of p.requisitos) m.set(r, (m.get(r) ?? 0) + 1);
        return m;
    }, [pasos]);

    const responsables = useMemo(
        () => [...new Set([...RESPONSABLES_BASE, ...requisitos.map((r) => r.quien), ...pasos.map((p) => p.responsable)]
            .map((x) => x.trim()).filter(Boolean))],
        [requisitos, pasos],
    );

    /* ----- avisa a la navegación lateral si hay cambios sin guardar ----- */
    useEffect(() => {
        marcarCambiosPendientes(sucio);
    }, [sucio]);
    useEffect(() => () => marcarCambiosPendientes(false), []);

    /* ----- borrador automático ----- */
    useEffect(() => {
        if (!sucio) return undefined;
        const t = window.setTimeout(
            () => guardarBorrador<BorradorProc>(clave, { nombre, materia, descripcion, baseLegal, requisitos, carriles, pasos }),
            700,
        );
        return () => window.clearTimeout(t);
    }, [sucio, clave, nombre, materia, descripcion, baseLegal, requisitos, carriles, pasos]);

    function restaurarBorrador() {
        if (!borrador) return;
        const b = borrador.datos;
        setNombre(b.nombre);
        setMateria(b.materia);
        setDescripcion(b.descripcion);
        setBaseLegal(b.baseLegal);
        setRequisitos(b.requisitos);
        setCarriles(b.carriles);
        setPasos(b.pasos);
        setSucio(true);
        setBorrador(null);
        avisar('Borrador restaurado', 'info');
    }

    function descartarBorrador() {
        borrarBorrador(clave);
        setBorrador(null);
    }

    /* ----- guardar ----- */
    async function guardar(): Promise<boolean> {
        if (guardando) return false;
        if (!nombre.trim()) {
            setError('Ponle un nombre al procedimiento.');
            setPestana('datos');
            return false;
        }
        setGuardando(true);
        try {
            const datos: DatosProcedimiento = { nombre, materia, descripcion, baseLegal, requisitos, flujo: { carriles, pasos } };
            let id = idActual;
            if (id) {
                await s.procedimientos.guardar(id, datos);
            } else {
                id = await s.procedimientos.crear(datos);
                setIdActual(id);
            }
            borrarBorrador('procedimiento:nuevo');
            borrarBorrador(`procedimiento:${id}`);
            setBorrador(null);
            setSucio(false);
            setError(null);
            avisar('Procedimiento guardado');
            return true;
        } catch (e) {
            setError(mensajeError(e));
            return false;
        } finally {
            setGuardando(false);
        }
    }

    async function salir() {
        if (sucio && !(await confirmar('Hay cambios sin guardar. Quedará un borrador para restaurarlos al volver. ¿Salir?', 'Cambios sin guardar'))) return;
        volver();
    }

    async function quitarRequisito(rid: string) {
        const n = usos.get(rid) ?? 0;
        if (n > 0 && !(await confirmar(
            `Este requisito se usa en ${n} paso(s) del flujograma. ¿Quitarlo también de ellos?`,
            'Quitar requisito',
        ))) return;
        setRequisitos((l) => l.filter((r) => r.id !== rid));
        setPasos((l) => sinRequisito(l, rid));
        tocar();
    }

    useEffect(() => {
        guardarRef.current = () => { void guardar(); };
    });

    useEffect(() => {
        const f = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && ['g', 's'].includes(e.key.toLowerCase())) {
                e.preventDefault();
                guardarRef.current();
            }
        };
        window.addEventListener('keydown', f);
        return () => window.removeEventListener('keydown', f);
    }, []);

    return (
        <div className="pagina pagina-ancha">
            <div>
                <button type="button" className="btn btn-fan" onClick={() => void salir()}>
                    <Icono n="atras" /> Procedimientos
                </button>
            </div>

            <div className="pagina-cab">
                <div>
                    <div className="fila-chica">
                        {!idActual && <Insignia tono="ambar">Nuevo</Insignia>}
                        {materia && <Insignia tono="violeta">{etiquetaMateria(materia)}</Insignia>}
                        {sucio && <Insignia tono="rojo">Sin guardar</Insignia>}
                    </div>
                    <h1>{nombre.trim() || 'Nuevo procedimiento'}</h1>
                    {(descripcion || baseLegal) && <p className="subtitulo">{descripcion || baseLegal}</p>}
                </div>
                <div className="acciones">
                    <button type="button" className="btn btn-sec" onClick={() => void salir()}>Cerrar</button>
                    <button type="button" className="btn btn-pri" disabled={guardando || (!sucio && !!idActual)} onClick={() => void guardar()}>
                        {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </div>

            {borrador && !sucio && (
                <Alerta tipo="info">
                    <div>
                        Hay un borrador sin guardar de este procedimiento.
                        <div className="acciones" style={{ marginTop: 6 }}>
                            <button type="button" className="btn btn-sec btn-sm" onClick={restaurarBorrador}>Restaurar borrador</button>
                            <button type="button" className="btn btn-fan btn-sm" onClick={descartarBorrador}>Descartar</button>
                        </div>
                    </div>
                </Alerta>
            )}

            <Aviso error={error} />

            <Pestanas<PestanaProc>
                activa={pestana}
                cambiar={setPestana}
                items={[
                    { id: 'requisitos', etiqueta: 'Requisitos', contador: requisitos.length },
                    { id: 'flujo', etiqueta: 'Flujograma', contador: pasos.length },
                    { id: 'datos', etiqueta: 'Datos generales' },
                ]}
            />

            {pestana === 'requisitos' && (
                <RequisitosProcedimiento
                    nombre={nombre}
                    requisitos={requisitos}
                    quienes={responsables}
                    usos={usos}
                    cambiar={(l) => { setRequisitos(l); tocar(); }}
                    quitar={(rid) => void quitarRequisito(rid)}
                />
            )}

            {pestana === 'flujo' && (
                <FlujoProcedimiento
                    nombre={nombre}
                    pasos={pasos}
                    carriles={carriles}
                    requisitos={requisitos}
                    responsables={responsables}
                    cambiarPasos={(p) => { setPasos(p); tocar(); }}
                    cambiarCarriles={(c) => { setCarriles(c); tocar(); }}
                />
            )}

            {pestana === 'datos' && (
                <div className="tarjeta">
                    <div className="tarjeta-cab">
                        <div>
                            <h3>Datos generales</h3>
                            <p className="suave">Nombre, materia y la base legal que respalda el trámite.</p>
                        </div>
                    </div>
                    <div className="form-grid">
                        <Campo etiqueta="Nombre *" ancho>
                            <input
                                value={nombre} placeholder="Ej.: Fijación de asistencia familiar"
                                onChange={(e) => { setNombre(e.target.value); setError(null); tocar(); }}
                            />
                        </Campo>
                        <Campo etiqueta="Materia">
                            <SelectMateria value={materia} onChange={(e) => { setMateria(e.target.value); tocar(); }} />
                        </Campo>
                        <Campo etiqueta="Base legal" ancho ayuda="Normas que regulan el trámite. Verifica que estén vigentes.">
                            <input
                                value={baseLegal} placeholder="Ej.: Código de las Familias y del Proceso Familiar"
                                onChange={(e) => { setBaseLegal(e.target.value); tocar(); }}
                            />
                        </Campo>
                        <Campo etiqueta="Descripción" ancho>
                            <textarea value={descripcion} onChange={(e) => { setDescripcion(e.target.value); tocar(); }} />
                        </Campo>
                    </div>
                </div>
            )}
        </div>
    );
}