import { open } from '@tauri-apps/plugin-dialog';
import { useMemo, useState, type FormEvent } from 'react';
import { fichaDeModelo, type DatoParteFicha, type FichaModelo } from '../../application/camposModelo';
import type { ModeloVisible } from '../../application/casosDeUso/administrarModelos';
import type { DocumentoResumen, ExpedienteResumen, ModeloResumen, ParteResumen, PersonaResumen } from '../../application/consultas';
import { mismoRol } from '../../domain/catalogo';
import { claveNormalizada, etiquetaRol } from '../../domain/texto';
import { TIPOS_EXPEDIENTE, obtenerTipo } from '../../domain/tiposExpediente';
import { AsistenteDocumento } from '../AsistenteDocumento';
import {
    Alerta, Aviso, Campo, ESTADOS, ETIQUETA_ESTADO, Icono, Insignia, Modal, Pestanas, Segmentado, Vacio,
    avisar, confirmar, datosDeForm, etiquetaTipo, fechaCorta, fechaHora,
} from '../comunes';
import { EntradaDato, LlenadoEnDocumento, OtrosDatos, esLargo } from '../DatosCaso';
import { FormularioPersona } from '../FormularioPersona';
import { Hoja } from '../Hoja';
import { mensajeError, useCargar, useServicios } from '../servicios';

type PestanaExp = 'modelo' | 'partes' | 'datos' | 'documentos';
type ModoDatos = 'formulario' | 'documento';

const sinValor = (v: string | undefined) => !v || v.trim() === '';
const firma = (d: Record<string, string>) =>
    JSON.stringify(Object.entries(d).filter(([, v]) => v.trim() !== '').sort(([a], [b]) => a.localeCompare(b)));

export function Expediente({ id, volver }: { id: string; volver: () => void }) {
    const s = useServicios();
    const exp = useCargar(() => s.consultas.obtenerExpediente(id), [id]);
    const partes = useCargar(() => s.consultas.listarPartes(id), [id]);
    const docs = useCargar(() => s.consultas.listarDocumentos(id), [id]);
    const personas = useCargar(() => s.consultas.listarPersonas(), []);
    const modelos = useCargar(() => s.consultas.listarModelos(), []);
    const [pestana, setPestana] = useState<PestanaExp | null>(null);
    const [modoDatos, setModoDatos] = useState<ModoDatos>('formulario');
    const [error, setError] = useState<string | null>(null);
    const [asistente, setAsistente] = useState(false);
    const [editando, setEditando] = useState(false);
    const [datosDe, setDatosDe] = useState<ParteResumen | null>(null);
    const [fichaDe, setFichaDe] = useState<string | null>(null);
    const e = exp.datos;

    // Modelo elegido para este expediente y lo que ese modelo pide (partes y datos).
    const modelo = modelos.datos?.find((m) => m.id === e?.modeloId) ?? null;
    const detalle = useCargar(
        () => (modelo ? s.verModelo.ejecutar(modelo.versionId) : Promise.resolve(null)),
        [modelo?.versionId ?? ''],
    );
    const visible = modelo && detalle.datos?.versionId === modelo.versionId ? detalle.datos : null;
    const ficha = useMemo(
        () => (visible ? fichaDeModelo(visible.esquema, visible.fuente?.partes ?? []) : null),
        [visible],
    );

    const atras = <button type="button" className="btn btn-fan" onClick={volver}><Icono n="atras" /> Expedientes</button>;
    if (exp.error) return <div className="pagina">{atras}<Aviso error={exp.error} /></div>;
    if (!e || (!modelos.datos && !modelos.error)) return <div className="pagina">{atras}<p className="suave">Cargando…</p></div>;

    const t = obtenerTipo(e.tipo);
    const activa: PestanaExp = pestana ?? (modelo ? 'partes' : 'modelo');

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
                        Cliente: <strong>{e.clienteNombre || '—'}</strong>
                        {e.referencia && <> · Ref.: {e.referencia}</>}
                        {t.judicial && <> · Juzgado: {e.juzgado || '—'} · Causa N° {e.nroCausa || '—'}</>}
                    </p>
                </div>
                <div className="acciones">
                    <select className="select-estado" value={e.estado} onChange={(ev) => void cambiarEstado(ev.target.value)} aria-label="Estado">
                        {ESTADOS.map((x) => <option key={x} value={x}>{ETIQUETA_ESTADO[x]}</option>)}
                    </select>
                    <button type="button" className="btn btn-sec" onClick={() => setEditando(true)}><Icono n="editar" tam={16} /> Editar</button>
                    <button type="button" className="btn btn-pri" onClick={() => setAsistente(true)}><Icono n="mas" tam={16} /> Nuevo documento</button>
                    <button type="button" className="btn btn-peligro" onClick={() => void eliminar()}><Icono n="papelera" tam={16} /> Eliminar</button>
                </div>
            </div>

            <Aviso error={error ?? partes.error ?? docs.error ?? modelos.error ?? detalle.error} />

            <Pestanas<PestanaExp>
                activa={activa}
                cambiar={setPestana}
                items={[
                    { id: 'modelo', etiqueta: '1 · Modelo' },
                    { id: 'partes', etiqueta: '2 · Partes', contador: partes.datos?.length },
                    { id: 'datos', etiqueta: '3 · Datos' },
                    { id: 'documentos', etiqueta: '4 · Documentos', contador: docs.datos?.length },
                ]}
            />

            {activa === 'modelo' && (
                <TabModelo e={e} modelos={modelos.datos ?? []} actual={modelo} visible={visible} ficha={ficha}
                    elegir={(m) => void elegirModelo(m.id)} siguiente={() => setPestana('partes')} />
            )}
            {activa === 'partes' && (
                <TabPartes
                    e={e} partes={partes.datos ?? []} personas={personas.datos ?? []} ficha={ficha} hayModelo={!!modelo}
                    recargar={() => { partes.recargar(); exp.recargar(); }}
                    recargarPersonas={personas.recargar}
                    setError={setError}
                    irModelo={() => setPestana('modelo')}
                    editarFicha={setFichaDe}
                    editarDatos={setDatosDe}
                />
            )}
            {activa === 'datos' && (
                <TabDatos
                    key={JSON.stringify(e.datos)}
                    e={e} modelo={modelo} visible={visible} ficha={ficha} partes={partes.datos ?? []}
                    modo={modoDatos} setModo={setModoDatos}
                    recargar={exp.recargar} setError={setError}
                    irModelo={() => setPestana('modelo')} irPartes={() => setPestana('partes')}
                    editarFicha={setFichaDe} editarDatos={setDatosDe}
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
                    cerrar={() => { setAsistente(false); docs.recargar(); exp.recargar(); }}
                />
            )}
            {datosDe && ficha && (
                <DatosParte
                    key={datosDe.id}
                    p={datosDe}
                    campos={ficha.datosParte.filter((d) => mismoRol(datosDe.rol, d.rol))}
                    cerrar={() => setDatosDe(null)}
                    guardado={() => { setDatosDe(null); partes.recargar(); avisar('Datos de la parte guardados'); }}
                />
            )}
            {fichaDe && (
                <FormularioPersona
                    id={fichaDe}
                    personas={personas.datos ?? []}
                    cerrar={() => setFichaDe(null)}
                    guardado={() => { setFichaDe(null); partes.recargar(); personas.recargar(); avisar('Persona actualizada'); }}
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
            .sort((a, b) => Number(b.materia === e.tipo) - Number(a.materia === e.tipo) || a.nombre.localeCompare(b.nombre, 'es'));
    }, [modelos, q, e.tipo]);

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
                            Según el modelo se te piden las partes y los datos. Puedes cambiarlo cuando quieras: lo ya escrito no se pierde.
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
                                    {m.materia === e.tipo && <Insignia tono="verde">Recomendado</Insignia>}
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
                            ? <Hoja bloques={visible.bloques} config={visible.config} />
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
                                <div>
                                    <h4 className="grupo-titulo">Datos del caso ({ficha.caso.length})</h4>
                                    {ficha.caso.length === 0 && <p className="suave">No pide datos del caso.</p>}
                                    {ficha.caso.map((c) => (
                                        <div key={c.clave} className="chk-fila">
                                            <span>{c.etiqueta}{c.requerido ? '' : ' (opcional)'}</span>
                                            {sinValor(e.datos[c.clave]) ? <Insignia tono="ambar">Falta</Insignia> : <Insignia tono="verde">Listo</Insignia>}
                                        </div>
                                    ))}
                                </div>
                                {ficha.datosParte.length > 0 && (
                                    <div>
                                        <h4 className="grupo-titulo">Datos propios de las partes</h4>
                                        {ficha.datosParte.map((d) => (
                                            <div key={`${d.rol}|${d.clave}`} className="chk-fila">
                                                <span>{d.etiqueta}</span>
                                                <span className="suave">{etiquetaRol(d.rol)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                        <div><button type="button" className="btn btn-pri" onClick={siguiente}>Siguiente: crear las partes</button></div>
                    </div>
                </div>
            )}
        </>
    );
}

/* ================= 2 · Partes ================= */
function TabPartes({ e, partes, personas, ficha, hayModelo, recargar, recargarPersonas, setError, irModelo, editarFicha, editarDatos }: {
    e: ExpedienteResumen;
    partes: ParteResumen[];
    personas: PersonaResumen[];
    ficha: FichaModelo | null;
    hayModelo: boolean;
    recargar: () => void;
    recargarPersonas: () => void;
    setError: (m: string | null) => void;
    irModelo: () => void;
    editarFicha: (personaId: string) => void;
    editarDatos: (p: ParteResumen) => void;
}) {
    const s = useServicios();
    const [rol, setRol] = useState('');
    const [personaId, setPersonaId] = useState('');
    const [domicilio, setDomicilio] = useState('');
    const [nueva, setNueva] = useState(false);

    // Primero los roles que pide el modelo; luego los típicos del tipo de expediente.
    const sugeridos = [...new Set([...(ficha?.roles ?? []), ...obtenerTipo(e.tipo).roles])];

    async function agregar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        try {
            await s.agregarParte.ejecutar({ expedienteId: e.id, personaId, rol, domicilioProcesal: domicilio || undefined });
            setPersonaId('');
            setDomicilio('');
            setError(null);
            recargar();
            avisar('Parte agregada');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    async function quitar(p: ParteResumen) {
        if (!(await confirmar(`¿Quitar a ${p.nombre} como ${p.rol} de este expediente?`))) return;
        try {
            await s.quitarParte.ejecutar(p.id);
            recargar();
            avisar('Parte quitada');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    return (
        <>
            {!hayModelo && (
                <Alerta tipo="adv">
                    Primero elige el modelo: según él se sugieren los roles y se piden los datos de cada parte.{' '}
                    <button type="button" className="btn btn-enlace" onClick={irModelo}>Elegir modelo</button>
                </Alerta>
            )}

            {partes.length === 0 ? (
                <Vacio icono="personas" titulo="Sin partes"
                    texto="Agrega a las personas que intervienen y su rol. Los modelos las usan para listas, bloques repetidos y concordancia de género." />
            ) : (
                <div className="tabla-wrap">
                    <table className="tabla">
                        <thead><tr><th>Rol</th><th>Persona</th><th>Domicilio procesal</th><th /></tr></thead>
                        <tbody>
                            {partes.map((p) => {
                                const pedidos = ficha ? ficha.datosParte.filter((d) => mismoRol(p.rol, d.rol)) : [];
                                const llenos = pedidos.filter((d) => !sinValor(p.datos[d.clave])).length;
                                return (
                                    <tr key={p.id}>
                                        <td><Insignia tono="violeta">{etiquetaRol(p.rol)}</Insignia></td>
                                        <td className="celda-titulo">{p.nombre}</td>
                                        <td>{p.domicilioProcesal || <span className="suave">—</span>}</td>
                                        <td className="num">
                                            <div className="acciones" style={{ justifyContent: 'flex-end' }}>
                                                <button type="button" className="btn btn-sec btn-sm"
                                                    title="Editar la ficha de la persona (C.I., estado civil, domicilio…)"
                                                    onClick={() => editarFicha(p.personaId)}>Ficha</button>
                                                {pedidos.length > 0 && (
                                                    <button type="button" className="btn btn-sec btn-sm"
                                                        title="Datos propios que pide el modelo para esta parte"
                                                        onClick={() => editarDatos(p)}>Datos {llenos}/{pedidos.length}</button>
                                                )}
                                                <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar parte"
                                                    onClick={() => void quitar(p)}><Icono n="papelera" tam={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {hayModelo && (
                <form className="tarjeta" onSubmit={(ev) => void agregar(ev)}>
                    <h3>Agregar parte</h3>
                    {personas.length === 0 && <Alerta tipo="adv">Aún no hay personas registradas: crea la primera con «Nueva persona».</Alerta>}
                    <div className="chips">
                        {sugeridos.map((r) => {
                            const hecho = partes.some((p) => mismoRol(p.rol, r));
                            return (
                                <button key={r} type="button" className={`chip${mismoRol(rol, r) ? ' sel' : ''}`} onClick={() => setRol(r)}>
                                    {hecho ? '✓ ' : ''}{r}
                                </button>
                            );
                        })}
                    </div>
                    <div className="form-grid">
                        <Campo etiqueta="Rol *">
                            <input list="roles-expediente" value={rol} onChange={(ev) => setRol(ev.target.value)} required placeholder="vendedor, demandante…" />
                            <datalist id="roles-expediente">{sugeridos.map((r) => <option key={r} value={r} />)}</datalist>
                        </Campo>
                        <Campo etiqueta="Persona *">
                            <select value={personaId} onChange={(ev) => setPersonaId(ev.target.value)} required>
                                <option value="" disabled>Elegir…</option>
                                {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </Campo>
                        <Campo etiqueta="Domicilio procesal" ancho>
                            <input value={domicilio} onChange={(ev) => setDomicilio(ev.target.value)} />
                        </Campo>
                    </div>
                    <div className="acciones">
                        <button type="submit" className="btn btn-pri" disabled={personas.length === 0}>Agregar parte</button>
                        <button type="button" className="btn btn-sec" onClick={() => setNueva(true)}><Icono n="mas" tam={16} /> Nueva persona</button>
                    </div>
                </form>
            )}

            {nueva && (
                <FormularioPersona
                    personas={personas}
                    cerrar={() => setNueva(false)}
                    guardado={(nuevoId) => { setNueva(false); recargarPersonas(); setPersonaId(nuevoId); avisar('Persona creada'); }}
                />
            )}
        </>
    );
}

/* Datos propios de una parte: solo los que pide el modelo elegido. */
function DatosParte({ p, campos, cerrar, guardado }: {
    p: ParteResumen; campos: DatoParteFicha[]; cerrar: () => void; guardado: () => void;
}) {
    const s = useServicios();
    const [vals, setVals] = useState<Record<string, string>>({ ...p.datos });
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);
    const poner = (clave: string, valor: string) => setVals((x) => ({ ...x, [clave]: valor }));

    async function guardar() {
        setTrabajando(true);
        try {
            await s.actualizarDatosParte.ejecutar(p.id, vals);
            guardado();
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    return (
        <Modal
            titulo={`Datos de ${p.nombre} · ${etiquetaRol(p.rol)}`}
            cerrar={cerrar}
            pie={
                <>
                    <span className="espacio" />
                    <button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button>
                    <button type="button" className="btn btn-pri" disabled={trabajando} onClick={() => void guardar()}>Guardar</button>
                </>
            }
        >
            <Aviso error={error} />
            <div className="form-grid">
                {campos.map((c) => (
                    <Campo key={c.clave} etiqueta={`${c.etiqueta}${c.requerido ? ' *' : ''}`} ancho={esLargo(c)}>
                        <EntradaDato c={c} valor={vals[c.clave] ?? ''} cambiar={(v) => poner(c.clave, v)} />
                    </Campo>
                ))}
            </div>
            <OtrosDatos conocidos={campos.map((c) => c.clave)} valores={vals} cambiar={poner} />
        </Modal>
    );
}

/* ================= 3 · Datos ================= */
function TabDatos({ e, modelo, visible, ficha, partes, modo, setModo, recargar, setError, irModelo, irPartes, editarFicha, editarDatos }: {
    e: ExpedienteResumen;
    modelo: ModeloResumen | null;
    visible: ModeloVisible | null;
    ficha: FichaModelo | null;
    partes: ParteResumen[];
    modo: ModoDatos;
    setModo: (m: ModoDatos) => void;
    recargar: () => void;
    setError: (m: string | null) => void;
    irModelo: () => void;
    irPartes: () => void;
    editarFicha: (personaId: string) => void;
    editarDatos: (p: ParteResumen) => void;
}) {
    const s = useServicios();
    const [valores, setValores] = useState<Record<string, string>>({ ...e.datos });
    const [guardando, setGuardando] = useState(false);

    if (!modelo) {
        return (
            <Alerta tipo="adv">
                Primero elige el modelo: los datos que se piden dependen de él.{' '}
                <button type="button" className="btn btn-enlace" onClick={irModelo}>Elegir modelo</button>
            </Alerta>
        );
    }
    if (!ficha || !visible) return <p className="suave">Cargando el modelo…</p>;

    const campos = ficha.caso;
    const poner = (clave: string, valor: string) => setValores((x) => ({ ...x, [clave]: valor }));
    const sucio = firma(valores) !== firma(e.datos);
    const faltan = campos.filter((c) => c.requerido && sinValor(valores[c.clave])).length;

    async function guardar() {
        setGuardando(true);
        try {
            await s.actualizarExpediente.ejecutar(e.id, { datos: valores });
            setError(null);
            recargar();
            avisar('Datos guardados');
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setGuardando(false);
        }
    }

    return (
        <>
            <div className="tarjeta">
                <div className="tarjeta-cab">
                    <div>
                        <h3>Datos del caso</h3>
                        <p className="suave">
                            Los que pide «{modelo.nombre}». Llénalos en un formulario o escribe directo sobre el documento, como en Word.
                        </p>
                    </div>
                    {campos.length > 0 && (
                        <Segmentado<ModoDatos>
                            valor={modo}
                            cambiar={setModo}
                            opciones={[{ id: 'formulario', etiqueta: 'Formulario' }, { id: 'documento', etiqueta: 'Sobre el documento' }]}
                        />
                    )}
                </div>

                {campos.length === 0 && <Alerta tipo="info">Este modelo no pide datos del caso: todo sale de las partes.</Alerta>}

                {campos.length > 0 && modo === 'formulario' && (
                    <div className="form-grid">
                        {campos.map((c) => (
                            <Campo key={c.clave} etiqueta={`${c.etiqueta}${c.requerido ? ' *' : ''}`} ancho={esLargo(c)}>
                                <EntradaDato c={c} valor={valores[c.clave] ?? ''} cambiar={(v) => poner(c.clave, v)} />
                            </Campo>
                        ))}
                    </div>
                )}

                {campos.length > 0 && modo === 'documento' && (
                    <>
                        <p className="suave">
                            Escribe en los huecos azules (amarillos = vacíos). Los datos de las partes (nombre, C.I., domicilio…) salen de la pestaña Partes:
                            toca uno para ir allí.
                        </p>
                        <LlenadoEnDocumento
                            bloques={visible.bloques} config={visible.config} campos={campos} roles={ficha.roles}
                            valores={valores} cambiar={poner} alChip={irPartes}
                        />
                    </>
                )}

                <OtrosDatos conocidos={campos.map((c) => c.clave)} valores={valores} cambiar={poner} />

                <div className="acciones">
                    <button type="button" className="btn btn-pri" disabled={!sucio || guardando} onClick={() => void guardar()}>
                        {guardando ? 'Guardando…' : 'Guardar datos'}
                    </button>
                    {sucio && <Insignia tono="ambar">Sin guardar</Insignia>}
                    {campos.length > 0 && (faltan > 0
                        ? <Insignia tono="ambar">Faltan {faltan} obligatorio(s)</Insignia>
                        : <Insignia tono="verde">Datos completos</Insignia>)}
                </div>
            </div>

            {ficha.roles.length > 0 && (
                <div className="tarjeta">
                    <div>
                        <h3>Partes y sus datos</h3>
                        <p className="suave">Revisa la ficha de cada persona (C.I., estado civil, domicilio…) y completa los datos propios que pide el modelo.</p>
                    </div>
                    {ficha.roles.map((r) => {
                        const lista = partes.filter((p) => mismoRol(p.rol, r));
                        const pedidos = ficha.datosParte.filter((d) => mismoRol(r, d.rol));
                        return (
                            <div key={r}>
                                <h4 className="grupo-titulo">{etiquetaRol(r)}</h4>
                                {lista.length === 0 ? (
                                    <p className="suave">
                                        Aún no hay nadie con este rol.{' '}
                                        <button type="button" className="btn btn-enlace" onClick={irPartes}>Crear parte</button>
                                    </p>
                                ) : lista.map((p) => {
                                    const llenos = pedidos.filter((d) => !sinValor(p.datos[d.clave])).length;
                                    return (
                                        <div key={p.id} className="chk-fila">
                                            <span className="celda-titulo">{p.nombre}</span>
                                            <span className="acciones">
                                                <button type="button" className="btn btn-sec btn-sm" onClick={() => editarFicha(p.personaId)}>Ficha</button>
                                                {pedidos.length > 0 && (
                                                    <button type="button" className="btn btn-sec btn-sm" onClick={() => editarDatos(p)}>
                                                        Datos {llenos}/{pedidos.length}
                                                    </button>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

/* ================= 4 · Documentos ================= */
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
            <Vacio icono="documento" titulo="Aún no hay documentos" texto="Genera el primero a partir del modelo: se completa con las partes y los datos del expediente.">
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
                clienteId: f.clienteId ?? '',
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
                <Campo etiqueta="Cliente *">
                    <select name="clienteId" defaultValue={e.clienteId} required>
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