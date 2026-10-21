import { useMemo, useState } from 'react';
import type { ProcedimientoResumen } from '../../domain/procedimientos';
import { PROCEDIMIENTOS_INICIALES } from '../../domain/procedimientosIniciales';
import { claveNormalizada } from '../../domain/texto';
import {
    Alerta, Aviso, Icono, Insignia, Modal, Vacio, avisar, confirmar, etiquetaMateria, fechaCorta,
} from '../_core/comunes';
import { EditorProcedimiento } from '../EditorProcedimiento';
import { mensajeError, useCargar, useServicios } from '../_core/servicios';

type Vista = { n: 'lista' } | { n: 'editar'; id?: string };

/** Requisitos de un trámite y su flujograma procedimental. */
export function Procedimientos() {
    const [vista, setVista] = useState<Vista>({ n: 'lista' });

    if (vista.n === 'editar') {
        return (
            <EditorProcedimiento
                key={vista.id ?? 'nuevo'}
                id={vista.id}
                volver={() => setVista({ n: 'lista' })}
            />
        );
    }
    return (
        <Lista
            abrir={(id) => setVista({ n: 'editar', id })}
            nuevo={() => setVista({ n: 'editar' })}
        />
    );
}

function Lista({ abrir, nuevo }: { abrir: (id: string) => void; nuevo: () => void }) {
    const s = useServicios();
    const lista = useCargar(() => s.procedimientos.listar(), []);
    const [q, setQ] = useState('');
    const [materia, setMateria] = useState('');
    const [plantillas, setPlantillas] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const todos = useMemo(() => lista.datos ?? [], [lista.datos]);
    const materias = useMemo(() => [...new Set(todos.map((p) => p.materia).filter(Boolean))], [todos]);

    const filtrados = useMemo(() => {
        const k = claveNormalizada(q.trim());
        return todos.filter(
            (p) => (!materia || p.materia === materia)
                && (!k || claveNormalizada(`${p.nombre} ${p.descripcion} ${p.baseLegal} ${etiquetaMateria(p.materia)}`).includes(k)),
        );
    }, [todos, q, materia]);

    async function duplicar(p: ProcedimientoResumen) {
        try {
            const id = await s.procedimientos.duplicar(p.id);
            setError(null);
            avisar('Procedimiento duplicado');
            abrir(id);
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    async function eliminar(p: ProcedimientoResumen) {
        if (!(await confirmar(`¿Eliminar el procedimiento «${p.nombre}» con sus ${p.numRequisitos} requisito(s) y ${p.numPasos} paso(s)?`, 'Eliminar procedimiento'))) return;
        try {
            await s.procedimientos.eliminar(p.id);
            setError(null);
            lista.recargar();
            avisar('Procedimiento eliminado');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    return (
        <div className="pagina">
            <div className="pagina-cab">
                <div>
                    <h1>Procedimientos</h1>
                    <p className="subtitulo">
                        Requisitos de cada trámite o proceso y su flujograma procedimental: quién hace qué, en qué orden y con qué documentos.
                    </p>
                </div>
                <div className="acciones">
                    <button type="button" className="btn btn-sec" onClick={() => setPlantillas(true)}>Plantillas</button>
                    <button type="button" className="btn btn-pri" onClick={nuevo}><Icono n="mas" tam={16} /> Nuevo procedimiento</button>
                </div>
            </div>

            <div className="filtros">
                <input className="buscar" type="search" placeholder="Buscar procedimiento…" value={q} onChange={(e) => setQ(e.target.value)} />
                {materias.length > 0 && (
                    <select value={materia} onChange={(e) => setMateria(e.target.value)}>
                        <option value="">Todas las materias</option>
                        {materias.map((m) => <option key={m} value={m}>{etiquetaMateria(m)}</option>)}
                    </select>
                )}
            </div>

            <Aviso error={error ?? lista.error} />

            {lista.datos && filtrados.length === 0 && (
                <Vacio
                    icono="flujo"
                    titulo={todos.length === 0 ? 'Aún no hay procedimientos' : 'Sin resultados'}
                    texto={todos.length === 0
                        ? 'Crea uno desde cero (requisitos + flujograma) o instala la plantilla de ejemplo.'
                        : 'Prueba con otra búsqueda o materia.'}
                >
                    {todos.length === 0 && (
                        <>
                            <button type="button" className="btn btn-pri" onClick={nuevo}>Nuevo procedimiento</button>
                            <button type="button" className="btn btn-sec" onClick={() => setPlantillas(true)}>Ver plantillas</button>
                        </>
                    )}
                </Vacio>
            )}

            <div className="modelos-grid">
                {filtrados.map((p) => (
                    <div key={p.id} className="modelo-card" role="button" tabIndex={0} onClick={() => abrir(p.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) abrir(p.id); }}>
                        <div className="mc-cab">
                            <Insignia tono="azul">Procedimiento</Insignia>
                            {p.materia && <Insignia tono="violeta">{etiquetaMateria(p.materia)}</Insignia>}
                        </div>
                        <h3>{p.nombre}</h3>
                        <p className="mc-desc">{p.descripcion || p.baseLegal || 'Sin descripción'}</p>
                        <span className="suave">Actualizado {fechaCorta(p.actualizadoEn)}</span>
                        <div className="mc-pie">
                            <span>{p.numRequisitos} requisitos</span>
                            <span>{p.numPasos} pasos</span>
                            <span className="espacio" />
                            <button type="button" className="btn btn-fan btn-sm" title="Crear una copia"
                                onClick={(e) => { e.stopPropagation(); void duplicar(p); }}>
                                Duplicar
                            </button>
                            <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Eliminar procedimiento" title="Eliminar procedimiento"
                                onClick={(e) => { e.stopPropagation(); void eliminar(p); }}>
                                <Icono n="papelera" tam={15} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {plantillas && <Plantillas cerrar={() => setPlantillas(false)} hecho={(id) => { setPlantillas(false); abrir(id); }} />}
        </div>
    );
}

function Plantillas({ cerrar, hecho }: { cerrar: () => void; hecho: (id: string) => void }) {
    const s = useServicios();
    const [ocupado, setOcupado] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function instalar(i: number) {
        setOcupado(i);
        try {
            const id = await s.procedimientos.instalarInicial(i);
            avisar('Plantilla instalada. Revísala y ajústala antes de usarla.');
            hecho(id);
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setOcupado(null);
        }
    }

    return (
        <Modal
            titulo="Plantillas de procedimientos"
            cerrar={cerrar}
            pie={<><span className="espacio" /><button type="button" className="btn btn-pri" onClick={cerrar}>Cerrar</button></>}
        >
            <Alerta tipo="adv">
                Son borradores de ejemplo. Revisa los requisitos, los plazos y la base legal con la norma y la práctica de tu juzgado antes de usarlos en un caso real.
            </Alerta>
            <Aviso error={error} />
            <div className="lista-opciones">
                {PROCEDIMIENTOS_INICIALES.map((p, i) => (
                    <div key={p.nombre} className="opcion">
                        <div style={{ flex: 1 }}>
                            <div className="fila-chica">
                                {p.materia && <Insignia tono="violeta">{etiquetaMateria(p.materia)}</Insignia>}
                                <Insignia tono="gris">{p.requisitos.length} requisitos · {p.flujo.pasos.length} pasos</Insignia>
                            </div>
                            <b>{p.nombre}</b>
                            <span className="suave">{p.descripcion}</span>
                        </div>
                        <button type="button" className="btn btn-pri btn-sm" disabled={ocupado !== null} onClick={() => void instalar(i)}>
                            {ocupado === i ? 'Instalando…' : 'Instalar'}
                        </button>
                    </div>
                ))}
            </div>
        </Modal>
    );
}