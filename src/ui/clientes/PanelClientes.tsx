import { useEffect, useMemo, useRef, useState } from 'react';
import { claveNormalizada } from '../../domain/comun/texto';
import { ETIQUETA_ESTADO, Icono, iniciales } from '../_core/comunes';
import { useCargar, useServicios } from '../_core/servicios';

/** Clientes asignados a los expedientes (barra lateral). Cada cliente se despliega con sus expedientes. */
export function PanelClientes({ activo, abrir, ficha }: {
    /** Expediente abierto ahora: se resalta y su cliente se despliega. */
    activo: string | null;
    abrir: (expedienteId: string) => void;
    ficha: (personaId: string) => void;
}) {
    const s = useServicios();
    const lista = useCargar(() => s.consultas.listarClientes(), []);
    const recargar = useRef(lista.recargar);
    const [q, setQ] = useState('');
    const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set());
    const clientes = useMemo(() => lista.datos ?? [], [lista.datos]);

    useEffect(() => {
        recargar.current = lista.recargar;
    });

    // Se refresca solo cuando algo se guarda en la base (asignar cliente, editar una persona, crear o borrar expedientes…).
    useEffect(() => s.db.suscribir(() => recargar.current()), [s]);

    useEffect(() => {
        if (!activo) return;
        const c = clientes.find((x) => x.expedientes.some((e) => e.id === activo));
        if (c) setAbiertos((prev) => (prev.has(c.id) ? prev : new Set(prev).add(c.id)));
    }, [activo, clientes]);

    const k = claveNormalizada(q.trim());
    const visibles = useMemo(
        () => (!k
            ? clientes
            : clientes.filter((c) => claveNormalizada(
                `${c.nombre} ${c.documento} ${c.expedientes.map((e) => `${e.codigo} ${e.materia}`).join(' ')}`,
            ).includes(k))),
        [clientes, k],
    );

    const alternar = (id: string) =>
        setAbiertos((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });

    return (
        <section className="nav-clientes" aria-label="Clientes">
            <div className="nav-clientes-cab">
                <Icono n="personas" tam={15} />
                <span>Clientes</span>
                <span className="nav-contador">{clientes.length}</span>
            </div>

            {clientes.length > 5 && (
                <input className="nav-clientes-buscar" type="search" placeholder="Filtrar clientes…"
                    value={q} onChange={(e) => setQ(e.target.value)} />
            )}

            <div className="nav-clientes-lista">
                {lista.error && <p className="nav-clientes-vacio">{lista.error}</p>}
                {!lista.error && lista.datos && clientes.length === 0 && (
                    <p className="nav-clientes-vacio">Aquí aparecen los clientes asignados a tus expedientes.</p>
                )}
                {k !== '' && clientes.length > 0 && visibles.length === 0 && (
                    <p className="nav-clientes-vacio">Sin resultados.</p>
                )}

                {visibles.map((c) => {
                    const abierto = k !== '' || abiertos.has(c.id);
                    return (
                        <div key={c.id} className="nav-cliente">
                            <div className="nav-cliente-fila">
                                <button type="button" className="nav-cliente-btn" aria-expanded={abierto}
                                    title={c.documento ? `${c.nombre} · ${c.documento}` : c.nombre}
                                    onClick={() => alternar(c.id)}>
                                    <span className="nav-avatar">{iniciales(c.nombre)}</span>
                                    <span className="nav-cliente-nombre">{c.nombre || 'Sin nombre'}</span>
                                    <span className="nav-contador"
                                        title={`${c.activos} activo(s) de ${c.expedientes.length} expediente(s)`}>
                                        {c.expedientes.length}
                                    </span>
                                </button>
                                <button type="button" className="nav-cliente-ficha" aria-label={`Ficha de ${c.nombre}`}
                                    title="Ver ficha" onClick={() => ficha(c.id)}>
                                    <Icono n="editar" tam={14} />
                                </button>
                            </div>

                            {abierto && (
                                <div className="nav-cliente-exps">
                                    {c.expedientes.map((x) => (
                                        <button key={x.id} type="button" className={`nav-exp${x.id === activo ? ' activo' : ''}`}
                                            title={`${x.codigo} · ${x.materia} (${ETIQUETA_ESTADO[x.estado] ?? x.estado})`}
                                            onClick={() => abrir(x.id)}>
                                            <span className={`nav-punto e-${x.estado}`} />
                                            <span className="nav-exp-cod">{x.codigo}</span>
                                            <span className="nav-exp-txt">{x.materia}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}