import { open } from '@tauri-apps/plugin-dialog';
import { useState, type FormEvent } from 'react';
import { tipoSugerido } from '../../application/camposModelo';
import type { DocumentoResumen, ExpedienteResumen, InmuebleResumen, ParteResumen, PersonaResumen } from '../../application/consultas';
import { claveCampo, etiquetaRol } from '../../domain/texto';
import { ROLES_CONOCIDOS, TIPOS_EXPEDIENTE, obtenerTipo } from '../../domain/tiposExpediente';
import { AsistenteDocumento } from '../AsistenteDocumento';
import {
    Alerta, Aviso, Campo, ESTADOS, ETIQUETA_ESTADO, Icono, Insignia, Modal, Pestanas, Vacio,
    avisar, confirmar, datosDeForm, etiquetaTipo, fechaCorta, fechaHora, normalizarNumero,
} from '../comunes';
import { mensajeError, useCargar, useServicios } from '../servicios';

type PestanaExp = 'resumen' | 'partes' | 'inmuebles' | 'documentos';

export function Expediente({ id, volver }: { id: string; volver: () => void }) {
    const s = useServicios();
    const exp = useCargar(() => s.consultas.obtenerExpediente(id), [id]);
    const partes = useCargar(() => s.consultas.listarPartes(id), [id]);
    const inmuebles = useCargar(() => s.consultas.listarInmuebles(id), [id]);
    const docs = useCargar(() => s.consultas.listarDocumentos(id), [id]);
    const personas = useCargar(() => s.consultas.listarPersonas(), []);
    const [pestana, setPestana] = useState<PestanaExp>('resumen');
    const [error, setError] = useState<string | null>(null);
    const [asistente, setAsistente] = useState(false);
    const [editando, setEditando] = useState(false);
    const e = exp.datos;

    const atras = <button type="button" className="btn btn-fan" onClick={volver}><Icono n="atras" /> Expedientes</button>;
    if (exp.error) return <div className="pagina">{atras}<Aviso error={exp.error} /></div>;
    if (!e) return <div className="pagina">{atras}<p className="suave">Cargando…</p></div>;

    const t = obtenerTipo(e.tipo);

    async function cambiarEstado(estado: string) {
        try {
            await s.actualizarExpediente.ejecutar(id, { estado });
            exp.recargar();
            avisar('Estado actualizado');
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
                    </div>
                    <h1>{e.materia}</h1>
                    <p className="subtitulo">
                        Cliente: <strong>{e.clienteNombre || '—'}</strong>
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

            <Aviso error={error ?? partes.error ?? inmuebles.error ?? docs.error} />

            <Pestanas<PestanaExp>
                activa={pestana}
                cambiar={setPestana}
                items={[
                    { id: 'resumen', etiqueta: 'Resumen' },
                    { id: 'partes', etiqueta: 'Partes', contador: partes.datos?.length },
                    { id: 'inmuebles', etiqueta: 'Inmuebles', contador: inmuebles.datos?.length },
                    { id: 'documentos', etiqueta: 'Documentos', contador: docs.datos?.length },
                ]}
            />

            {pestana === 'resumen' && <TabResumen e={e} recargar={exp.recargar} setError={setError} />}
            {pestana === 'partes' && <TabPartes e={e} partes={partes.datos ?? []} personas={personas.datos ?? []} recargar={() => { partes.recargar(); exp.recargar(); }} setError={setError} />}
            {pestana === 'inmuebles' && <TabInmuebles expedienteId={id} inmuebles={inmuebles.datos ?? []} personas={personas.datos ?? []} recargar={inmuebles.recargar} />}
            {pestana === 'documentos' && <TabDocumentos docs={docs.datos ?? []} nuevo={() => setAsistente(true)} recargar={docs.recargar} setError={setError} />}

            {editando && (
                <EditarExpediente e={e} personas={personas.datos ?? []} cerrar={() => setEditando(false)} guardado={() => { setEditando(false); exp.recargar(); avisar('Expediente actualizado'); }} />
            )}
            {asistente && (
                <AsistenteDocumento expediente={e} cerrar={() => { setAsistente(false); docs.recargar(); exp.recargar(); }} />
            )}
        </div>
    );
}

/* ---------------- Resumen ---------------- */
function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
    return <div className="dato"><dt>{etiqueta}</dt><dd>{children || '—'}</dd></div>;
}

interface CampoDato { clave: string; etiqueta: string; tipo: string }

function EntradaCaso({ c, valor }: { c: CampoDato; valor: string }) {
    const nombre = `caso.${c.clave}`;
    // Una fecha guardada a mano que no sea AAAA-MM-DD se muestra como texto para no perderla al guardar.
    if (c.tipo === 'fecha' && (valor === '' || /^\d{4}-\d{2}-\d{2}$/.test(valor))) {
        return <input type="date" name={nombre} defaultValue={valor} />;
    }
    if (c.tipo === 'moneda' || c.tipo === 'superficie' || c.tipo === 'numero') {
        return <input name={nombre} defaultValue={valor} inputMode="decimal" placeholder="1234,56" />;
    }
    if (c.tipo === 'texto_largo') return <textarea name={nombre} defaultValue={valor} />;
    return <input name={nombre} defaultValue={valor} />;
}

function TabResumen({ e, recargar, setError }: { e: ExpedienteResumen; recargar: () => void; setError: (m: string | null) => void }) {
    const s = useServicios();
    const deModelos = useCargar(() => s.consultas.camposDeModelos(), []);
    const t = obtenerTipo(e.tipo);

    const mod = new Map((deModelos.datos ?? []).map((c) => [c.clave, c] as const));
    const campos: CampoDato[] = [];
    const vistos = new Set<string>();
    const poner = (c: CampoDato) => {
        if (vistos.has(c.clave)) return;
        vistos.add(c.clave);
        campos.push(c);
    };
    for (const c of t.campos) poner({ clave: c.clave, etiqueta: c.etiqueta, tipo: mod.get(c.clave)?.tipo ?? tipoSugerido(c.clave) });
    for (const c of mod.values()) poner(c);
    for (const k of Object.keys(e.datos)) poner({ clave: k, etiqueta: etiquetaRol(k), tipo: tipoSugerido(k) });

    async function guardar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const f = datosDeForm(ev.currentTarget);
        const datos: Record<string, string> = {};
        for (const c of campos) {
            const v = f[`caso.${c.clave}`];
            if (v) datos[c.clave] = v;
        }
        if (f.nuevo_nombre && f.nuevo_valor) datos[claveCampo(f.nuevo_nombre)] = f.nuevo_valor;
        try {
            await s.actualizarExpediente.ejecutar(e.id, { datos });
            setError(null);
            recargar();
            avisar('Datos del caso guardados');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    return (
        <>
            <div className="tarjeta">
                <h3>Datos del expediente</h3>
                <dl className="datos-lista">
                    <Dato etiqueta="Tipo">{etiquetaTipo(e.tipo)}</Dato>
                    <Dato etiqueta="Cliente">{e.clienteNombre}</Dato>
                    <Dato etiqueta="Referencia">{e.referencia}</Dato>
                    {t.judicial && <Dato etiqueta="Juzgado">{e.juzgado}</Dato>}
                    {t.judicial && <Dato etiqueta="N° de causa">{e.nroCausa}</Dato>}
                    <Dato etiqueta="Creado">{fechaCorta(e.creadoEn)}</Dato>
                </dl>
            </div>

            <form key={JSON.stringify(e.datos) + e.tipo} className="tarjeta" onSubmit={(ev) => void guardar(ev)}>
                <div className="tarjeta-cab">
                    <div>
                        <h3>Datos del caso</h3>
                        <p className="suave">
                            Aquí se completan los datos que creaste en tus modelos (se usan como {'{{caso.clave}}'}).
                            Lo que dejes aquí no se vuelve a pedir al generar documentos.
                        </p>
                    </div>
                </div>
                <div className="form-grid">
                    {campos.map((c) => (
                        <Campo key={c.clave} etiqueta={c.etiqueta} ancho={c.tipo === 'texto_largo'} ayuda={`caso.${c.clave}`}>
                            <EntradaCaso c={c} valor={e.datos[c.clave] ?? ''} />
                        </Campo>
                    ))}
                    <Campo etiqueta="Agregar otro dato (nombre)"><input name="nuevo_nombre" placeholder="Ej.: Fecha de entrega" /></Campo>
                    <Campo etiqueta="Valor"><input name="nuevo_valor" /></Campo>
                </div>
                <div><button type="submit" className="btn btn-pri">Guardar datos del caso</button></div>
            </form>
        </>
    );
}

/* ---------------- Partes ---------------- */
function TabPartes({ e, partes, personas, recargar, setError }: {
    e: ExpedienteResumen; partes: ParteResumen[]; personas: PersonaResumen[]; recargar: () => void; setError: (m: string | null) => void;
}) {
    const s = useServicios();
    const t = obtenerTipo(e.tipo);
    const [rol, setRol] = useState(t.roles[0] ?? '');

    async function agregar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const form = ev.currentTarget;
        const f = datosDeForm(form);
        try {
            await s.agregarParte.ejecutar({ expedienteId: e.id, personaId: f.personaId ?? '', rol, domicilioProcesal: f.domicilioProcesal });
            form.reset();
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
            {partes.length === 0 ? (
                <Vacio icono="personas" titulo="Sin partes" texto="Agrega a las personas que intervienen y su rol. Los modelos las usan para listas, bucles y concordancia de género." />
            ) : (
                <div className="tabla-wrap">
                    <table className="tabla">
                        <thead><tr><th>Rol</th><th>Persona</th><th>Domicilio procesal</th><th /></tr></thead>
                        <tbody>
                            {partes.map((p) => (
                                <tr key={p.id}>
                                    <td><Insignia tono="violeta">{etiquetaRol(p.rol)}</Insignia></td>
                                    <td className="celda-titulo">{p.nombre}</td>
                                    <td>{p.domicilioProcesal || <span className="suave">—</span>}</td>
                                    <td className="num"><button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar parte" onClick={() => void quitar(p)}><Icono n="papelera" tam={15} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <form className="tarjeta" onSubmit={(ev) => void agregar(ev)}>
                <h3>Agregar parte</h3>
                {personas.length === 0 && <Alerta tipo="adv">No hay personas registradas. Créalas primero en la sección Personas.</Alerta>}
                <div className="form-grid">
                    <Campo etiqueta="Persona *">
                        <select name="personaId" required defaultValue="">
                            <option value="" disabled>Elegir…</option>
                            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                    </Campo>
                    <Campo etiqueta="Rol *">
                        <input list="roles-expediente" value={rol} onChange={(ev) => setRol(ev.target.value)} required placeholder="demandante, vendedor…" />
                        <datalist id="roles-expediente">{ROLES_CONOCIDOS.map((r) => <option key={r} value={r} />)}</datalist>
                    </Campo>
                    <Campo etiqueta="Domicilio procesal"><input name="domicilioProcesal" /></Campo>
                    <div className="ancho chips">
                        {t.roles.map((r) => (
                            <button key={r} type="button" className={`chip${rol === r ? ' sel' : ''}`} onClick={() => setRol(r)}>{r}</button>
                        ))}
                    </div>
                </div>
                <div><button type="submit" className="btn btn-pri" disabled={personas.length === 0}>Agregar parte</button></div>
            </form>
        </>
    );
}

/* ---------------- Inmuebles ---------------- */
const DEPARTAMENTOS = ['La Paz', 'Cochabamba', 'Santa Cruz', 'Oruro', 'Potosí', 'Chuquisaca', 'Tarija', 'Beni', 'Pando'];

function TabInmuebles({ expedienteId, inmuebles, personas, recargar }: {
    expedienteId: string; inmuebles: InmuebleResumen[]; personas: PersonaResumen[]; recargar: () => void;
}) {
    const [nuevo, setNuevo] = useState(false);
    return (
        <>
            <div className="acciones"><button type="button" className="btn btn-pri" onClick={() => setNuevo(true)}><Icono n="mas" tam={16} /> Nuevo inmueble</button></div>
            {inmuebles.length === 0 ? (
                <Vacio icono="carpeta" titulo="Sin inmuebles" texto="Registra los inmuebles involucrados: matrícula, superficie, colindancias y titulares." />
            ) : (
                <div className="tabla-wrap">
                    <table className="tabla">
                        <thead><tr><th>Matrícula</th><th>Tipo</th><th>Ubicación</th><th className="num">Superficie (m²)</th><th>Titulares</th></tr></thead>
                        <tbody>
                            {inmuebles.map((i) => (
                                <tr key={i.id}>
                                    <td><code>{i.matricula || '—'}</code></td>
                                    <td>{i.tipo || '—'}</td>
                                    <td>{i.ubicacion || '—'}</td>
                                    <td className="num">{i.superficieM2 || '—'}</td>
                                    <td>{i.titulares || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {nuevo && <NuevoInmueble expedienteId={expedienteId} personas={personas} cerrar={() => setNuevo(false)} creado={() => { setNuevo(false); recargar(); avisar('Inmueble registrado'); }} />}
        </>
    );
}

function NuevoInmueble({ expedienteId, personas, cerrar, creado }: {
    expedienteId: string; personas: PersonaResumen[]; cerrar: () => void; creado: () => void;
}) {
    const s = useServicios();
    const [titulares, setTitulares] = useState([{ personaId: '', porcentaje: '' }]);
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);

    const cambiar = (i: number, p: Partial<{ personaId: string; porcentaje: string }>) =>
        setTitulares((l) => l.map((t, k) => (k === i ? { ...t, ...p } : t)));

    async function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const f = datosDeForm(ev.currentTarget);
        const unicos = new Map<string, string>();
        for (const t of titulares) if (t.personaId) unicos.set(t.personaId, t.porcentaje);
        setTrabajando(true);
        try {
            await s.crearInmueble.ejecutar({
                tipo: f.tipo, departamento: f.departamento, provincia: f.provincia, municipio: f.municipio, localidad: f.localidad,
                superficieM2: f.superficieM2 ? normalizarNumero(f.superficieM2) : undefined,
                matricula: f.matricula, codigoCatastral: f.codigoCatastral, ubicacion: f.ubicacion,
                colindancias: { norte: f.norte, sur: f.sur, este: f.este, oeste: f.oeste },
                gravamenes: f.gravamenes, observaciones: f.observaciones,
                titulares: [...unicos].map(([personaId, porcentaje]) => ({ personaId, porcentaje: porcentaje ? normalizarNumero(porcentaje) : undefined })),
                expedienteId,
            });
            creado();
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    return (
        <Modal
            titulo="Nuevo inmueble"
            ancho="grande"
            cerrar={cerrar}
            pie={<><span className="espacio" /><button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button><button type="submit" form="form-inmueble" className="btn btn-pri" disabled={trabajando}>Guardar inmueble</button></>}
        >
            <Aviso error={error} />
            <form id="form-inmueble" className="form-grid" onSubmit={(ev) => void enviar(ev)}>
                <Campo etiqueta="Tipo">
                    <input name="tipo" list="tipos-inmueble" placeholder="urbano, rural, lote…" />
                    <datalist id="tipos-inmueble"><option value="urbano" /><option value="rural" /><option value="lote" /><option value="casa" /><option value="departamento" /><option value="terreno" /></datalist>
                </Campo>
                <Campo etiqueta="Matrícula (Derechos Reales)"><input name="matricula" /></Campo>
                <Campo etiqueta="Código catastral"><input name="codigoCatastral" /></Campo>
                <Campo etiqueta="Superficie (m²)" ayuda="Con punto o coma decimal, máximo 2 decimales."><input name="superficieM2" inputMode="decimal" /></Campo>
                <Campo etiqueta="Departamento">
                    <select name="departamento" defaultValue=""><option value="">—</option>{DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}</select>
                </Campo>
                <Campo etiqueta="Provincia"><input name="provincia" /></Campo>
                <Campo etiqueta="Municipio"><input name="municipio" /></Campo>
                <Campo etiqueta="Localidad"><input name="localidad" /></Campo>
                <Campo etiqueta="Ubicación (dirección)" ancho><input name="ubicacion" /></Campo>
                <Campo etiqueta="Colindancia norte"><input name="norte" /></Campo>
                <Campo etiqueta="Colindancia sur"><input name="sur" /></Campo>
                <Campo etiqueta="Colindancia este"><input name="este" /></Campo>
                <Campo etiqueta="Colindancia oeste"><input name="oeste" /></Campo>
                <Campo etiqueta="Gravámenes" ancho><input name="gravamenes" /></Campo>
                <Campo etiqueta="Observaciones" ancho><textarea name="observaciones" /></Campo>

                <div className="ancho">
                    <h4 className="grupo-titulo">Titulares</h4>
                    <div className="lista-opciones">
                        {titulares.map((t, i) => (
                            <div key={i} className="fila-titular">
                                <select value={t.personaId} onChange={(ev) => cambiar(i, { personaId: ev.target.value })}>
                                    <option value="">Elegir persona…</option>
                                    {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>
                                <input value={t.porcentaje} onChange={(ev) => cambiar(i, { porcentaje: ev.target.value })} placeholder="% (opcional)" inputMode="decimal" />
                                <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar titular" onClick={() => setTitulares((l) => (l.length > 1 ? l.filter((_, k) => k !== i) : l))}><Icono n="cerrar" tam={15} /></button>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <button type="button" className="btn btn-sec btn-sm" onClick={() => setTitulares((l) => [...l, { personaId: '', porcentaje: '' }])}>Agregar titular</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

/* ---------------- Documentos ---------------- */
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
            <Vacio icono="documento" titulo="Aún no hay documentos" texto="Genera el primero a partir de un modelo: se completa con los datos del expediente.">
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
                            <button
                                type="button"
                                className="btn btn-fan btn-icono btn-sm"
                                aria-label="Eliminar documento"
                                title="Eliminar documento"
                                onClick={() => void eliminar(d)}
                            >
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

/* ---------------- Editar expediente ---------------- */
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