import { open } from '@tauri-apps/plugin-dialog';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { fichaDeModelo, seccionesDeModelo, type FichaModelo } from '../../application/camposModelo';
import type { ModeloVisible } from '../../application/casosDeUso/administrarModelos';
import type { DocumentoResumen, ExpedienteResumen, ModeloResumen, PersonaResumen } from '../../application/consultas';
import { claveNormalizada, etiquetaRol } from '../../domain/texto';
import { TIPOS_EXPEDIENTE, clienteAlInicio, obtenerTipo } from '../../domain/tiposExpediente';
import { AsistenteDocumento } from '../AsistenteDocumento';
import {
    Alerta, Aviso, Campo, ESTADOS, ETIQUETA_ESTADO, Icono, Insignia, Modal, Pestanas, Vacio,
    avisar, confirmar, datosDeForm, etiquetaTipo, fechaCorta, fechaHora,
    hayCambiosPendientes, marcarCambiosPendientes, permitirSalir,
} from '../comunes';
import { DatosExpediente } from '../DatosExpediente';
import { Hoja } from '../Hoja';
import { mensajeError, useCargar, useServicios } from '../servicios';
import { esMateriaRecomendada } from '../../domain/fuenteModelo';
import { contextoDeFuente } from '../../domain/marcadores';

type PestanaExp = 'modelo' | 'partes' | 'datos' | 'documentos';

const sinValor = (v: string | undefined) => !v || v.trim() === '';

export function Expediente({ id, volver }: { id: string; volver: () => void }) {
    const s = useServicios();
    const exp = useCargar(() => s.consultas.obtenerExpediente(id), [id]);
    const partes = useCargar(() => s.consultas.listarPartes(id), [id]);
    const docs = useCargar(() => s.consultas.listarDocumentos(id), [id]);
    const personas = useCargar(() => s.consultas.listarPersonas(), []);
    const modelos = useCargar(() => s.consultas.listarModelos(), []);
    const [pestana, setPestana] = useState<PestanaExp | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [asistente, setAsistente] = useState(false);
    const [editando, setEditando] = useState(false);
    const e = exp.datos;

    // Modelo elegido para este expediente y lo que ese modelo pide (partes y datos).
    const modelo = modelos.datos?.find((m) => m.id === e?.modeloId) ?? null;
    const detalle = useCargar(
        () => (modelo ? s.verModelo.ejecutar(modelo.versionId) : Promise.resolve(null)),
        [modelo?.versionId ?? ''],
    );
    const visibleActual = modelo && detalle.datos?.versionId === modelo.versionId ? detalle.datos : null;
    const ultimoVisible = useRef<{ modeloId: string; v: ModeloVisible } | null>(null);
    if (modelo && visibleActual) ultimoVisible.current = { modeloId: modelo.id, v: visibleActual };
    const visible = visibleActual ?? (modelo && ultimoVisible.current?.modeloId === modelo.id ? ultimoVisible.current.v : null);
    const ficha = useMemo(
        () => (visible ? fichaDeModelo(visible.esquema, visible.fuente?.partes ?? []) : null),
        [visible],
    );

    const atras = <button type="button" className="btn btn-fan" onClick={volver}><Icono n="atras" /> Expedientes</button>;
    if (exp.error) return <div className="pagina">{atras}<Aviso error={exp.error} /></div>;
    if (!e || (!modelos.datos && !modelos.error)) return <div className="pagina">{atras}<p className="suave">Cargando…</p></div>;

    const t = obtenerTipo(e.tipo);
    const alInicio = clienteAlInicio(t);
    const activa: PestanaExp = pestana ?? (modelo ? 'partes' : 'modelo');
    const enTrabajo = (p: PestanaExp) => p === 'partes' || p === 'datos';

    /** Cambiar de pestaña: entre Partes y Datos no se pierde nada; al salir de ellas avisa si hay cambios sin guardar. */
    async function irA(p: PestanaExp) {
        if (enTrabajo(activa) && !enTrabajo(p) && !(await permitirSalir())) return;
        setPestana(p);
    }

    async function nuevoDocumento() {
        if (
            hayCambiosPendientes()
            && !(await confirmar('Tienes datos sin guardar: el documento se armará solo con lo ya guardado. ¿Continuar de todos modos?', 'Datos sin guardar'))
        ) return;
        setAsistente(true);
    }

    async function cambiarEstado(estado: string) {
        try {
            await s.actualizarExpediente.ejecutar(id, { estado });
            exp.recargar();
            avisar('Estado actualizado');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    async function elegirModelo(modeloId: string) {
        try {
            await s.actualizarExpediente.ejecutar(id, { modeloId });
            setError(null);
            exp.recargar();
            avisar('Modelo elegido');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    const eliminar = async () => {
        const docsTxt = e.nDocumentos > 0 ? ` Se eliminarán también sus ${e.nDocumentos} documento(s).` : '';
        const ok = await confirmar(
            `¿Eliminar el expediente ${e.codigo} «${e.materia}»?${docsTxt} Los archivos .docx no se borran del disco.`,
            'Eliminar expediente',
        );
        if (!ok) return;
        try {
            await s.eliminarExpediente.ejecutar(id);
            marcarCambiosPendientes(false);
            avisar('Expediente eliminado');
            volver();
        } catch (err) {
            setError(mensajeError(err));
        }
    };

    return (
        <div className="pagina">
            <div>{atras}</div>

            <div className="pagina-cab">
                <div>
                    <div className="fila-chica">
                        <code className="codigo">{e.codigo}</code>
                        <Insignia tono="azul">{etiquetaTipo(e.tipo)}</Insignia>
                        {modelo && <Insignia tono="verde">Modelo: {modelo.nombre}</Insignia>}
                    </div>
                    <h1>{e.materia}</h1>
                    <p className="subtitulo">
                        Cliente: <strong>{e.clienteNombre || (alInicio ? '—' : 'por definir entre las partes')}</strong>
                        {e.referencia && <> · Ref.: {e.referencia}</>}
                        {t.judicial && <> · Juzgado: {e.juzgado || '—'} · Causa N° {e.nroCausa || '—'}</>}
                    </p>
                </div>
                <div className="acciones">
                    <select className="select-estado" value={e.estado} onChange={(ev) => void cambiarEstado(ev.target.value)} aria-label="Estado">
                        {ESTADOS.map((x) => <option key={x} value={x}>{ETIQUETA_ESTADO[x]}</option>)}
                    </select>
                    <button type="button" className="btn btn-sec" onClick={() => setEditando(true)}><Icono n="editar" tam={16} /> Editar</button>
                    <button type="button" className="btn btn-pri" onClick={() => void nuevoDocumento()}><Icono n="mas" tam={16} /> Nuevo documento</button>
                    <button type="button" className="btn btn-peligro" onClick={() => void eliminar()}><Icono n="papelera" tam={16} /> Eliminar</button>
                </div>
            </div>

            <Aviso error={error ?? partes.error ?? docs.error ?? modelos.error ?? detalle.error} />

            <Pestanas<PestanaExp>
                activa={activa}
                cambiar={(p) => void irA(p)}
                items={[
                    { id: 'modelo', etiqueta: '1 · Modelo' },
                    { id: 'partes', etiqueta: '2 · Partes', contador: partes.datos?.length },
                    { id: 'datos', etiqueta: '3 · Datos' },
                    { id: 'documentos', etiqueta: '4 · Documentos', contador: docs.datos?.length },
                ]}
            />

            {activa === 'modelo' && (
                <TabModelo e={e} modelos={modelos.datos ?? []} actual={modelo} visible={visible} ficha={ficha}
                    elegir={(m) => void elegirModelo(m.id)} siguiente={() => void irA('partes')} />
            )}

            {(activa === 'partes' || activa === 'datos') && (
                <DatosExpediente
                    key={e.id}
                    pestana={activa}
                    e={e}
                    modelo={modelo}
                    visible={visible}
                    ficha={ficha}
                    partes={partes.datos ?? []}
                    personas={personas.datos ?? []}
                    recargar={() => { partes.recargar(); exp.recargar(); }}
                    recargarPersonas={personas.recargar}
                    recargarModelos={modelos.recargar}
                    irModelo={() => void irA('modelo')}
                    irPartes={() => setPestana('partes')}
                    irDatos={() => setPestana('datos')}
                    irDocumento={() => setAsistente(true)}
                    onSucio={marcarCambiosPendientes}
                />
            )}
            {activa === 'documentos' && (
                <TabDocumentos docs={docs.datos ?? []} nuevo={() => setAsistente(true)} recargar={docs.recargar} setError={setError} />
            )}

            {editando && (
                <EditarExpediente e={e} personas={personas.datos ?? []} cerrar={() => setEditando(false)}
                    guardado={() => { setEditando(false); exp.recargar(); avisar('Expediente actualizado'); }} />
            )}

            {asistente && (
                <AsistenteDocumento
                    expediente={e}
                    modeloInicial={modelo?.versionId}
                    irADatos={(destino) => { setAsistente(false); exp.recargar(); setPestana(destino); }}
                    cerrar={(generado) => {
                        setAsistente(false);
                        docs.recargar();
                        exp.recargar();
                        if (generado) setPestana('documentos');
                    }}
                />
            )}
        </div>
    );
}

/* ================= 1 · Modelo ================= */
function TabModelo({ e, modelos, actual, visible, ficha, elegir, siguiente }: {
    e: ExpedienteResumen;
    modelos: ModeloResumen[];
    actual: ModeloResumen | null;
    visible: ModeloVisible | null;
    ficha: FichaModelo | null;
    elegir: (m: ModeloResumen) => void;
    siguiente: () => void;
}) {
    const [q, setQ] = useState('');
    const lista = useMemo(() => {
        const k = claveNormalizada(q.trim());
        return modelos
            .filter((m) => !k || claveNormalizada(`${m.nombre} ${m.descripcion} ${m.categoria}`).includes(k))
            .sort((a, b) => Number(esMateriaRecomendada(b.materia, e.tipo)) - Number(esMateriaRecomendada(a.materia, e.tipo)) || a.nombre.localeCompare(b.nombre, 'es'));
    }, [modelos, q, e.tipo]);
    const secciones = useMemo(
        () => (ficha ? seccionesDeModelo(ficha, visible?.fuente?.grupos ?? [], visible?.fuente?.campos ?? []) : []),
        [ficha, visible],
    );
    const ctxMarcadores = useMemo(() => (visible?.fuente ? contextoDeFuente(visible.fuente) : undefined), [visible]);

    if (modelos.length === 0) {
        return <Alerta tipo="info">Aún no hay modelos activos. Crea o instala uno en la sección Modelos y vuelve aquí.</Alerta>;
    }

    return (
        <>
            <div className="tarjeta">
                <div className="tarjeta-cab">
                    <div>
                        <h3>¿Con qué modelo vas a trabajar?</h3>
                        <p className="suave">
                            Según el modelo se arma el formulario de partes y datos. Puedes cambiarlo cuando quieras: lo ya escrito no se pierde.
                        </p>
                    </div>
                </div>
                <input type="search" placeholder="Buscar modelo…" value={q} onChange={(ev) => setQ(ev.target.value)} />
                <div className="lista-opciones">
                    {lista.map((m) => (
                        <button key={m.id} type="button" className={`opcion${actual?.id === m.id ? ' sel' : ''}`}
                            onClick={() => { if (actual?.id !== m.id) elegir(m); }}>
                            <div style={{ flex: 1 }}>
                                <div className="fila-chica">
                                    {m.categoria && <Insignia tono="azul">{m.categoria}</Insignia>}
                                    {esMateriaRecomendada(m.materia, e.tipo) && <Insignia tono="verde">Recomendado</Insignia>}
                                    {actual?.id === m.id && <Insignia tono="violeta">Elegido</Insignia>}
                                </div>
                                <b>{m.nombre}</b>
                                <span className="suave">{m.descripcion || `v${m.version} · ${m.numCampos} campos`}</span>
                            </div>
                        </button>
                    ))}
                    {lista.length === 0 && <p className="suave">Sin resultados.</p>}
                </div>
            </div>

            {actual && (
                <div className="visor-grid">
                    <div className="vista-hoja" style={{ height: 'min(62vh, 640px)', minHeight: 360 }}>
                        {visible
                            ? <Hoja bloques={visible.bloques} config={visible.config} contexto={ctxMarcadores} />
                            : <p className="suave" style={{ padding: 16 }}>Cargando el modelo…</p>}
                    </div>

                    <div className="tarjeta">
                        <div>
                            <h3>Lo que pide este modelo</h3>
                            <p className="suave">«{actual.nombre}» · v{actual.version}</p>
                        </div>
                        {!ficha ? <p className="suave">Analizando…</p> : (
                            <>
                                <div>
                                    <h4 className="grupo-titulo">Partes</h4>
                                    {ficha.roles.length === 0
                                        ? <p className="suave">No usa partes.</p>
                                        : <div className="chips">{ficha.roles.map((r) => <Insignia key={r} tono="violeta">{etiquetaRol(r)}</Insignia>)}</div>}
                                </div>
                                {secciones.map((sec) => (
                                    <div key={sec.id}>
                                        <h4 className="grupo-titulo">{sec.nombre}</h4>
                                        {[...sec.ficha, ...sec.propios].map((d, i) => (
                                            <div key={`p${i}`} className="chk-fila">
                                                <span>{d.etiqueta}</span>
                                                <span className="suave">De las partes</span>
                                            </div>
                                        ))}
                                        {sec.caso.map((c) => (
                                            <div key={c.clave} className="chk-fila">
                                                <span>{c.etiqueta}{c.requerido ? '' : ' (opcional)'}</span>
                                                {sinValor(e.datos[c.clave]) ? <Insignia tono="ambar">Falta</Insignia> : <Insignia tono="verde">Listo</Insignia>}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </>
                        )}
                        <div><button type="button" className="btn btn-pri" onClick={siguiente}>Siguiente: registrar las partes</button></div>
                    </div>
                </div>
            )}
        </>
    );
}

/* ================= 3 · Documentos ================= */
function TabDocumentos({ docs, nuevo, recargar, setError }: {
    docs: DocumentoResumen[]; nuevo: () => void; recargar: () => void; setError: (m: string | null) => void;
}) {
    const s = useServicios();

    async function adjuntar(documentoId: string) {
        try {
            const ruta = await open({ multiple: false, filters: [{ name: 'Word', extensions: ['docx'] }] });
            if (!ruta) return;
            await s.adjuntarVersion.ejecutar(documentoId, ruta);
            setError(null);
            recargar();
            avisar('Versión editada adjuntada');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    async function eliminar(d: DocumentoResumen) {
        const ok = await confirmar(
            `¿Eliminar el documento «${d.titulo}» con sus ${d.versiones.length} versión(es)? Los archivos .docx no se borran del disco.`,
            'Eliminar documento',
        );
        if (!ok) return;
        try {
            await s.eliminarDocumento.ejecutar(d.id);
            setError(null);
            recargar();
            avisar('Documento eliminado');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    const abrir = (ruta: string) => s.archivos.abrir(ruta).catch((err) => setError(mensajeError(err)));
    const mostrar = (ruta: string) => s.archivos.mostrarEnCarpeta(ruta).catch((err) => setError(mensajeError(err)));

    if (docs.length === 0) {
        return (
            <Vacio icono="documento" titulo="Aún no hay documentos" texto="Genera el primero: se completa con las partes y los datos que ya llenaste.">
                <button type="button" className="btn btn-pri" onClick={nuevo}>Nuevo documento</button>
            </Vacio>
        );
    }

    return (
        <>
            {docs.map((d) => (
                <div key={d.id} className="tarjeta">
                    <div className="tarjeta-cab">
                        <div>
                            <h3>{d.titulo}</h3>
                            <p className="suave">{d.versiones.length} versión(es) · creado {fechaCorta(d.creadoEn)}</p>
                        </div>
                        <div className="acciones">
                            <Insignia tono="azul">{d.estado}</Insignia>
                            <button type="button" className="btn btn-sec btn-sm" onClick={() => void adjuntar(d.id)}>Adjuntar versión editada…</button>
                            <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Eliminar documento" title="Eliminar documento"
                                onClick={() => void eliminar(d)}>
                                <Icono n="papelera" tam={15} />
                            </button>
                        </div>
                    </div>
                    <div className="tabla-wrap">
                        <table className="tabla tabla-densa">
                            <tbody>
                                {d.versiones.map((v) => (
                                    <tr key={v.id}>
                                        <td><b>v{String(v.nro).padStart(2, '0')}</b></td>
                                        <td>{v.origen === 'generado' ? 'Generado' : 'Edición externa'}</td>
                                        <td className="suave">{fechaHora(v.creadoEn)}</td>
                                        <td><code title={v.sha256}>{v.sha256.slice(0, 12)}…</code></td>
                                        <td>
                                            <div className="acciones">
                                                <button type="button" className="btn btn-sec btn-sm" onClick={() => void abrir(v.ruta)}>Abrir</button>
                                                <button type="button" className="btn btn-fan btn-sm" onClick={() => void mostrar(v.ruta)}>Mostrar en carpeta</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </>
    );
}

/* ================= Editar expediente ================= */
function EditarExpediente({ e, personas, cerrar, guardado }: {
    e: ExpedienteResumen; personas: PersonaResumen[]; cerrar: () => void; guardado: () => void;
}) {
    const s = useServicios();
    const [tipo, setTipo] = useState(e.tipo);
    const t = obtenerTipo(tipo);
    const alInicio = clienteAlInicio(t);
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);

    async function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const f = datosDeForm(ev.currentTarget);
        setTrabajando(true);
        try {
            await s.actualizarExpediente.ejecutar(e.id, {
                tipo,
                materia: f.materia ?? '',
                referencia: f.referencia ?? '',
                clienteId: f.clienteId ? f.clienteId : null,
                ...(t.judicial ? { juzgado: f.juzgado ?? '', nroCausa: f.nroCausa ?? '' } : {}),
            });
            guardado();
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    return (
        <Modal
            titulo="Editar expediente"
            cerrar={cerrar}
            pie={<><span className="espacio" /><button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button><button type="submit" form="form-editar-exp" className="btn btn-pri" disabled={trabajando}>Guardar</button></>}
        >
            <Aviso error={error} />
            <form id="form-editar-exp" className="form-grid" onSubmit={(ev) => void enviar(ev)}>
                <Campo etiqueta="Tipo" ancho>
                    <select value={tipo} onChange={(ev) => setTipo(ev.target.value)}>
                        {TIPOS_EXPEDIENTE.map((x) => <option key={x.clave} value={x.clave}>{x.etiqueta}</option>)}
                    </select>
                </Campo>
                <Campo etiqueta="Asunto *" ancho><input name="materia" defaultValue={e.materia} required /></Campo>
                <Campo etiqueta={`Cliente${alInicio ? ' *' : ''}`} ayuda={alInicio ? undefined : 'Puedes dejarlo vacío y marcarlo entre las partes.'}>
                    <select name="clienteId" defaultValue={e.clienteId} required={alInicio}>
                        {alInicio ? <option value="" disabled>Elegir…</option> : <option value="">Por definir</option>}
                        {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </Campo>
                <Campo etiqueta="Referencia"><input name="referencia" defaultValue={e.referencia} /></Campo>
                {t.judicial && (
                    <>
                        <Campo etiqueta="Juzgado / tribunal"><input name="juzgado" defaultValue={e.juzgado} /></Campo>
                        <Campo etiqueta="N° de causa"><input name="nroCausa" defaultValue={e.nroCausa} /></Campo>
                    </>
                )}
            </form>
        </Modal>
    );
}