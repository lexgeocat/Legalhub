import { useEffect, useMemo, useRef, useState } from 'react';
import type { PersonaDetalle, VinculoPersona } from '../../application/consultas';
import { claveNormalizada, etiquetaRol } from '../../domain/texto';
import {
    Alerta, Aviso, EstadoInsignia, Icono, Insignia, Segmentado, Vacio, avisar, confirmar, etiquetaTipo,
} from '../_core/comunes';
import { FormularioPersona } from '../compartidos/FormularioPersona';
import { mensajeError, useCargar, useServicios } from '../_core/servicios';

type Filtro = 'todas' | 'clientes' | 'partes' | 'libres';
type TipoF = '' | 'natural' | 'juridica';

/** Directorio único de personas: cada una se registra una sola vez y se reutiliza en todos los expedientes. */
export function Personas({ abrirExpediente }: { abrirExpediente: (id: string) => void }) {
    const s = useServicios();
    const lista = useCargar(() => s.consultas.listarPersonasDetalle(), []);
    const recargar = useRef(lista.recargar);
    useEffect(() => {
        recargar.current = lista.recargar;
    });
    // Se refresca sola cuando algo se guarda en la base.
    useEffect(() => s.db.suscribir(() => recargar.current()), [s]);

    const [q, setQ] = useState('');
    const [filtro, setFiltro] = useState<Filtro>('todas');
    const [tipoF, setTipoF] = useState<TipoF>('');
    const [sel, setSel] = useState<string | null>(null);
    const [form, setForm] = useState<{ id?: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [ocupado, setOcupado] = useState(false);

    const todas = useMemo(() => lista.datos ?? [], [lista.datos]);
    const vinc = useCargar(
        () => (sel ? s.consultas.listarVinculosPersona(sel) : Promise.resolve([] as VinculoPersona[])),
        [sel, lista.datos],
    );

    const repetidos = useMemo(() => {
        const m = new Map<string, number>();
        for (const p of todas) if (p.claveDoc) m.set(p.claveDoc, (m.get(p.claveDoc) ?? 0) + 1);
        return new Set([...m].filter(([, n]) => n > 1).map(([k]) => k));
    }, [todas]);

    const k = claveNormalizada(q.trim());
    const filtradas = useMemo(
        () => todas.filter((p) =>
            (!tipoF || p.tipo === tipoF)
            && (filtro === 'todas'
                || (filtro === 'clientes' && p.nCliente > 0)
                || (filtro === 'partes' && p.nPartes > 0)
                || (filtro === 'libres' && p.nCliente + p.nPartes === 0))
            && (!k || claveNormalizada(`${p.nombre} ${p.documento} ${p.telefono} ${p.correo}`).includes(k))),
        [todas, tipoF, filtro, k],
    );

    const nClientes = todas.filter((p) => p.nCliente > 0).length;
    const nLibres = todas.filter((p) => p.nCliente + p.nPartes === 0).length;
    const seleccionada = todas.find((p) => p.id === sel) ?? null;
    const gemelas = seleccionada?.claveDoc
        ? todas.filter((x) => x.id !== seleccionada.id && x.claveDoc === seleccionada.claveDoc)
        : [];

    async function eliminar(p: PersonaDetalle) {
        if (!(await confirmar(`¿Eliminar a «${p.nombre}»? Se quita de las listas; no se borra ningún documento.`, 'Eliminar persona'))) return;
        try {
            await s.eliminarPersona.ejecutar(p.id);
            setError(null);
            setSel(null);
            avisar('Persona eliminada');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    async function unificar(principal: PersonaDetalle, repetida: PersonaDetalle) {
        const ok = await confirmar(
            `Se pasarán todos los vínculos de «${repetida.nombre}» a «${principal.nombre}» y la ficha repetida se quitará de las listas. ¿Unificar?`,
            'Unificar personas',
        );
        if (!ok) return;
        try {
            await s.unificarPersonas.ejecutar(principal.id, repetida.id);
            setError(null);
            avisar('Personas unificadas');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    async function limpiar() {
        setOcupado(true);
        try {
            const cfg = await s.config.cargar();
            const n = await s.limpiarPersonas.contar(cfg.abogadoPersonaId);
            if (n === 0) {
                avisar('No hay personas sin vínculos', 'info');
                return;
            }
            const ok = await confirmar(
                `Hay ${n} persona(s) que no figuran en ningún expediente ni como representante. ¿Quitarlas de las listas? Tu ficha de abogado no se toca.`,
                'Quitar personas sin vínculos',
            );
            if (!ok) return;
            await s.limpiarPersonas.ejecutar(cfg.abogadoPersonaId);
            setError(null);
            setSel(null);
            avisar(`${n} persona(s) quitadas`);
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setOcupado(false);
        }
    }

    return (
        <div className="pagina">
            <div className="pagina-cab">
                <div>
                    <h1>Personas</h1>
                    <p className="subtitulo">
                        Directorio único de clientes, contrapartes y representantes. Cada persona se registra una sola vez y se reutiliza en todos los expedientes.
                    </p>
                </div>
                <button type="button" className="btn btn-pri" onClick={() => setForm({})}>
                    <Icono n="mas" tam={16} /> Nueva persona
                </button>
            </div>

            <div className="resumen-grid">
                <div className="estadistica"><span className="suave">Total</span><b>{todas.length}</b></div>
                <div className="estadistica"><span className="suave">Clientes</span><b>{nClientes}</b></div>
                <div className="estadistica"><span className="suave">Documentos repetidos</span><b>{repetidos.size}</b></div>
                <div className="estadistica"><span className="suave">Sin vínculos</span><b>{nLibres}</b></div>
            </div>

            <div className="filtros">
                <input className="buscar" type="search" placeholder="Buscar por nombre, C.I., NIT, teléfono o correo…"
                    value={q} onChange={(e) => setQ(e.target.value)} />
                <Segmentado<Filtro>
                    valor={filtro}
                    cambiar={setFiltro}
                    opciones={[
                        { id: 'todas', etiqueta: 'Todas' },
                        { id: 'clientes', etiqueta: 'Clientes' },
                        { id: 'partes', etiqueta: 'Partes' },
                        { id: 'libres', etiqueta: 'Sin vínculos' },
                    ]}
                />
                <select value={tipoF} onChange={(e) => setTipoF(e.target.value as TipoF)}>
                    <option value="">Naturales y jurídicas</option>
                    <option value="natural">Solo naturales</option>
                    <option value="juridica">Solo jurídicas</option>
                </select>
                {filtro === 'libres' && nLibres > 0 && (
                    <button type="button" className="btn btn-sec btn-sm" disabled={ocupado} onClick={() => void limpiar()}>
                        {ocupado ? 'Revisando…' : 'Quitar las sin vínculos'}
                    </button>
                )}
            </div>

            <Aviso error={error ?? lista.error} />

            {lista.datos && todas.length === 0 ? (
                <Vacio icono="personas" titulo="Aún no hay personas"
                    texto="Registra a tus clientes y contrapartes una sola vez; después las eliges en cada expediente.">
                    <button type="button" className="btn btn-pri" onClick={() => setForm({})}>Nueva persona</button>
                </Vacio>
            ) : (
                <div className={seleccionada ? 'visor-grid' : undefined}>
                    <div className="tabla-wrap">
                        <table className="tabla tabla-click">
                            <thead>
                                <tr><th>Persona</th><th>Documento</th><th>Contacto</th><th>Vínculos</th></tr>
                            </thead>
                            <tbody>
                                {filtradas.map((p) => (
                                    <tr key={p.id} tabIndex={0}
                                        style={p.id === sel ? { background: 'var(--primario-claro)' } : undefined}
                                        onClick={() => setSel(p.id)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) setSel(p.id); }}>
                                        <td>
                                            <div className="celda-titulo">{p.nombre || 'Sin nombre'}</div>
                                            <div className="acciones">
                                                <Insignia>{p.tipo === 'juridica' ? 'Jurídica' : 'Natural'}</Insignia>
                                                {p.claveDoc && repetidos.has(p.claveDoc) && <Insignia tono="rojo">Documento repetido</Insignia>}
                                            </div>
                                        </td>
                                        <td>{p.documento || <span className="suave">—</span>}</td>
                                        <td>
                                            {p.telefono || p.correo
                                                ? <>{p.telefono}{p.telefono && p.correo ? <br /> : null}<span className="suave">{p.correo}</span></>
                                                : <span className="suave">—</span>}
                                        </td>
                                        <td>
                                            {p.nCliente + p.nPartes === 0 ? <span className="suave">Sin vínculos</span> : (
                                                <div className="acciones">
                                                    {p.nCliente > 0 && <Insignia tono="verde">Cliente · {p.nCliente}</Insignia>}
                                                    {p.nPartes > 0 && <Insignia tono="violeta">Parte · {p.nPartes}</Insignia>}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filtradas.length === 0 && (
                                    <tr><td colSpan={4} className="suave">Sin resultados.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {seleccionada && (
                        <div className="tarjeta">
                            <div className="tarjeta-cab">
                                <div>
                                    <h3>{seleccionada.nombre || 'Sin nombre'}</h3>
                                    <p className="suave">{seleccionada.documento || 'Sin documento registrado'}</p>
                                </div>
                                <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Cerrar detalle" onClick={() => setSel(null)}>
                                    <Icono n="cerrar" tam={15} />
                                </button>
                            </div>

                            <div className="acciones">
                                <button type="button" className="btn btn-sec btn-sm" onClick={() => setForm({ id: seleccionada.id })}>
                                    <Icono n="editar" tam={15} /> Editar ficha
                                </button>
                                <button type="button" className="btn btn-peligro btn-sm" onClick={() => void eliminar(seleccionada)}>
                                    <Icono n="papelera" tam={15} /> Eliminar
                                </button>
                            </div>

                            {(seleccionada.telefono || seleccionada.correo) && (
                                <p className="suave">{[seleccionada.telefono, seleccionada.correo].filter(Boolean).join(' · ')}</p>
                            )}

                            {gemelas.length > 0 && (
                                <Alerta tipo="adv">
                                    <div>
                                        Hay otra ficha con el mismo documento. Conserva una y unifica la repetida:
                                        {gemelas.map((g) => (
                                            <div key={g.id} className="acciones" style={{ marginTop: 6 }}>
                                                <b>{g.nombre}</b>
                                                <button type="button" className="btn btn-sec btn-sm" onClick={() => void unificar(seleccionada, g)}>
                                                    Unificar en esta ficha
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </Alerta>
                            )}

                            <h4 className="grupo-titulo">Expedientes</h4>
                            <Aviso error={vinc.error} />
                            {vinc.datos && vinc.datos.length === 0 && <p className="suave">Todavía no figura en ningún expediente.</p>}
                            <div className="lista-opciones">
                                {(vinc.datos ?? []).map((v, i) => (
                                    <button key={`${v.expedienteId}:${v.rol}:${i}`} type="button" className="opcion"
                                        onClick={() => abrirExpediente(v.expedienteId)}>
                                        <div style={{ flex: 1 }}>
                                            <div className="fila-chica">
                                                <code>{v.codigo}</code>
                                                <Insignia tono={v.rol === 'cliente' ? 'verde' : 'violeta'}>{etiquetaRol(v.rol)}</Insignia>
                                                <EstadoInsignia estado={v.estado} />
                                            </div>
                                            <b>{v.materia}</b>
                                            <span className="suave">{etiquetaTipo(v.tipo)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {form && (
                <FormularioPersona
                    id={form.id}
                    usoBorrador="personas"
                    personas={todas}
                    cerrar={() => setForm(null)}
                    guardado={(id) => {
                        avisar(form.id ? 'Persona actualizada' : 'Persona creada');
                        setForm(null);
                        setSel(id);
                    }}
                />
            )}
        </div>
    );
}