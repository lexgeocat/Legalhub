import { useState } from 'react';
import type { ResultadoImportacion } from '../application/casosDeUso/importarModelo';
import type { ModeloResumen } from '../application/consultas';
import type { AnalisisModelo, CambioModelo } from '../domain/edicionModelo';
import { Alerta, Aviso, Insignia, Modal, type Tono } from './comunes';
import { mensajeError, useServicios } from './servicios';

const TITULO: Record<CambioModelo['tipo'], string> = {
    editar: 'Cambia una línea', insertar: 'Agrega una línea', eliminar: 'Quita una línea',
};
const TONO: Record<CambioModelo['tipo'], Tono> = { editar: 'azul', insertar: 'verde', eliminar: 'rojo' };

export function ActualizarModelo({ modelo, versionId, analisis, cerrar, aplicado }: {
    modelo: ModeloResumen;
    versionId: string;
    analisis: AnalisisModelo;
    cerrar: () => void;
    aplicado: (r: ResultadoImportacion) => void;
}) {
    const s = useServicios();
    const { cambios, descartes } = analisis;
    // Lo que trae datos de este caso queda sin marcar: no debe colarse en el modelo sin que lo decidas.
    const [elegidos, setElegidos] = useState<Set<string>>(() => new Set(cambios.filter((c) => !c.conDatos).map((c) => c.id)));
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);

    const alternar = (id: string) =>
        setElegidos((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });

    async function guardar() {
        const lista = cambios.filter((c) => elegidos.has(c.id));
        setTrabajando(true);
        try {
            const r = await s.actualizarModelo.aplicar(
                { modeloId: modelo.id, nombre: modelo.nombre, materia: modelo.materia, categoria: modelo.categoria, descripcion: modelo.descripcion },
                versionId,
                lista,
            );
            aplicado(r);
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    return (
        <Modal
            titulo={`Actualizar el modelo «${modelo.nombre}»`}
            ancho="grande"
            cerrar={cerrar}
            pie={
                <>
                    <button type="button" className="btn btn-fan btn-sm" disabled={trabajando || cambios.length === 0}
                        onClick={() => setElegidos(new Set(cambios.map((c) => c.id)))}>Marcar todo</button>
                    <button type="button" className="btn btn-fan btn-sm" disabled={trabajando}
                        onClick={() => setElegidos(new Set())}>Quitar todo</button>
                    <span className="espacio" />
                    <button type="button" className="btn btn-sec" disabled={trabajando} onClick={cerrar}>Cancelar</button>
                    <button type="button" className="btn btn-pri" disabled={trabajando || elegidos.size === 0} onClick={() => void guardar()}>
                        {trabajando ? 'Guardando…' : `Actualizar modelo (${elegidos.size})`}
                    </button>
                </>
            }
        >
            <Alerta tipo="info">
                Elige qué cambios de tu documento valen también para los próximos. Se guarda como una <b>versión nueva</b> del modelo
                (la anterior se conserva) y los documentos ya generados no cambian. Los campos {'{{…}}'} se mantienen.
            </Alerta>
            <Aviso error={error} />

            {cambios.length === 0 ? (
                <Alerta tipo="adv">No hay cambios que se puedan llevar al modelo automáticamente.</Alerta>
            ) : (
                <div className="lista-opciones">
                    {cambios.map((c) => (
                        <label key={c.id} className="cambio-modelo">
                            <input type="checkbox" checked={elegidos.has(c.id)} onChange={() => alternar(c.id)} />
                            <div className="cambio-cuerpo">
                                <div className="fila-chica">
                                    <Insignia tono={TONO[c.tipo]}>{TITULO[c.tipo]}</Insignia>
                                    {c.enBloque && <Insignia tono="violeta">Dentro de un bloque: afecta a todas las repeticiones</Insignia>}
                                    {c.conDatos && <Insignia tono="ambar">Trae datos de este caso</Insignia>}
                                </div>
                                {c.antes.length > 0 && (
                                    <div>
                                        <span className="suave">En el modelo ahora</span>
                                        <pre className="cambio-linea antes">{c.antes.join('\n')}</pre>
                                    </div>
                                )}
                                {c.despues.length > 0 && (
                                    <div>
                                        <span className="suave">Quedaría</span>
                                        <pre className="cambio-linea despues">{c.despues.join('\n')}</pre>
                                    </div>
                                )}
                                {c.conDatos && (
                                    <p className="suave">
                                        Se guardaría tal cual y saldría en todos los documentos nuevos. Márcalo solo si es texto fijo y no un dato del cliente.
                                    </p>
                                )}
                            </div>
                        </label>
                    ))}
                </div>
            )}

            {descartes.length > 0 && (
                <details>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>No se pueden llevar al modelo ({descartes.length})</summary>
                    <div className="lista-avisos" style={{ marginTop: 8 }}>
                        {descartes.map((d, i) => (
                            <Alerta key={i} tipo="adv">
                                <b>«{d.texto}»</b> — {d.motivo}
                            </Alerta>
                        ))}
                    </div>
                </details>
            )}
        </Modal>
    );
}