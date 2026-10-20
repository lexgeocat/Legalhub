import { useState } from 'react';
import { citaParaEditor, citar, etiquetaNodo, type ModoCita } from '../domain/leyes';
import { Aviso, Insignia, avisar, copiarTexto } from './comunes';
import { useCargar, useServicios } from './servicios';
import { consultaValida, useBuscarLeyes } from './useBuscarLeyes';
import './leyes.css';

type Insertar = (texto: string, bloque: boolean) => void;

/** Evita que el botón le quite el foco (y el cursor) al editor. */
const quieto = (e: { preventDefault(): void }) => e.preventDefault();

const MODOS: { modo: ModoCita; titulo: string }[] = [
    { modo: 'referencia', titulo: 'Referencia' },
    { modo: 'titulo', titulo: 'Referencia con título' },
    { modo: 'texto', titulo: 'Texto citado' },
];

/** Buscador + citas de leyes. Se usa dentro del panel de campos y en la edición del documento. */
export function BuscadorLeyes({ onInsertar }: { onInsertar: Insertar }) {
    const s = useServicios();
    const leyes = useCargar(() => s.leyes.listar(), []);
    const [leyId, setLeyId] = useState('');
    const [q, setQ] = useState('');
    const [selId, setSelId] = useState<string | null>(null);
    const busqueda = useBuscarLeyes(q, leyId || undefined);
    const detalle = useCargar(() => (selId ? s.leyes.obtenerNodo(selId) : Promise.resolve(null)), [selId]);
    const nodo = detalle.datos && detalle.datos.id === selId ? detalle.datos : null;
    const lista = leyes.datos ?? [];

    const cita = (modo: ModoCita) => (nodo ? citar({ nombre: nodo.leyNombre }, nodo, modo) : '');

    function insertar(modo: ModoCita) {
        if (!nodo) return;
        onInsertar(citaParaEditor(cita(modo)), false);
        avisar('Cita insertada en el cursor');
    }

    async function copiar(modo: ModoCita) {
        const ok = await copiarTexto(cita(modo));
        if (ok) avisar('Copiado');
        else avisar('No se pudo copiar al portapapeles', 'error');
    }

    return (
        <>
            <Aviso error={busqueda.error ?? detalle.error ?? leyes.error} />

            {leyes.datos && lista.length === 0 ? (
                <p className="pc-ayuda">Aún no hay leyes. Sube un PDF en la sección «Leyes» y vuelve aquí.</p>
            ) : (
                <div className="cb-edicion">
                    <select aria-label="Ley" value={leyId} onChange={(e) => { setLeyId(e.target.value); setSelId(null); }}>
                        <option value="">Todas las leyes</option>
                        {lista.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                    <input type="search" aria-label="Buscar en las leyes" placeholder="1283 · art. 45 · prescripción…"
                        value={q} onChange={(e) => setQ(e.target.value)} />
                    {!consultaValida(q) && (
                        <p className="pc-nota">Busca por número de artículo (1283, art. 45) o por texto (mínimo 2 letras).</p>
                    )}
                </div>
            )}

            {consultaValida(q) && busqueda.res.length === 0 && <p className="pc-nota">Sin resultados.</p>}

            {busqueda.res.length > 0 && (
                <div className="lista-opciones ley-cita-res">
                    {busqueda.res.map((r) => (
                        <button key={r.id} type="button" className={`opcion${r.id === selId ? ' sel' : ''}`}
                            onMouseDown={quieto} onClick={() => setSelId(r.id)}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="fila-chica">
                                    {!leyId && <Insignia tono="azul">{r.leyNombre}</Insignia>}
                                    <span className="suave">Pág. {r.pagina}</span>
                                </div>
                                <b>{etiquetaNodo(r)}</b>
                                {r.extracto && <span className="suave ley-extracto">{r.extracto}</span>}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {nodo && (
                <div className="cb-tarjeta">
                    <div className="cb-tarjeta-cab">
                        <b>{etiquetaNodo(nodo)}</b>
                        <span className="suave">{nodo.leyNombre} · pág. {nodo.pagina}</span>
                    </div>
                    {MODOS.map((m) => (
                        <div key={m.modo} className="ley-cita">
                            <div className="ley-cita-cab">
                                <b>{m.titulo}</b>
                                <span className="espacio" />
                                <button type="button" className="btn btn-pri btn-sm" disabled={m.modo === 'texto' && !nodo.texto}
                                    onMouseDown={quieto} onClick={() => insertar(m.modo)}>Insertar</button>
                                <button type="button" className="btn btn-fan btn-sm" disabled={m.modo === 'texto' && !nodo.texto}
                                    onMouseDown={quieto} onClick={() => void copiar(m.modo)}>Copiar</button>
                            </div>
                            <p className="ley-cita-vista">{m.modo === 'texto' && !nodo.texto ? 'Este marcador no tiene texto.' : cita(m.modo)}</p>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

/** Panel completo (para la edición del documento). */
export function PanelLeyes({ onInsertar }: { onInsertar: Insertar }) {
    return (
        <div className="pc">
            <div className="pc-cab"><h3>Citar una ley</h3></div>
            <div className="pc-cuerpo"><BuscadorLeyes onInsertar={onInsertar} /></div>
            <div className="pc-pie">
                <p className="pc-ayuda">Se inserta donde está el cursor. Las leyes se suben en la sección «Leyes».</p>
            </div>
        </div>
    );
}