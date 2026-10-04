// src/ui/paginas/Personas.tsx
import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import type { DatosPersona } from '../../application/casosDeUso/crearPersona';
import type { PersonaResumen } from '../../application/consultas';
import { claveNormalizada, etiquetaRol } from '../../domain/texto';
import {
    Aviso, Campo, Icono, Insignia, Modal, Segmentado, Vacio, avisar, confirmar, datosDeForm, iniciales,
} from '../comunes';
import { mensajeError, useCargar, useServicios } from '../servicios';

type TipoPersona = 'natural' | 'juridica';

const ESTADOS_CIVILES = ['soltero', 'casado', 'divorciado', 'viudo', 'union libre'];
const BASE_ESTADO: Record<string, string> = { soltera: 'soltero', casada: 'casado', divorciada: 'divorciado', viuda: 'viudo' };
const EXPEDIDOS = ['LP', 'CB', 'SC', 'OR', 'PT', 'CH', 'TJ', 'BN', 'PD'];
const SIN_CAJA: CSSProperties = { display: 'contents', border: 0, padding: 0, margin: 0 };

export function Personas({ inicial }: { inicial?: string }) {
    const s = useServicios();
    const lista = useCargar(() => s.consultas.listarPersonas(), []);
    const [q, setQ] = useState('');
    const [tipoF, setTipoF] = useState('');
    const [editor, setEditor] = useState<{ id?: string } | null>(inicial ? { id: inicial } : null);
    const [error, setError] = useState<string | null>(null);

    const filtradas = useMemo(() => {
        const k = claveNormalizada(q.trim());
        return (lista.datos ?? []).filter(
            (p) =>
                (!tipoF || p.tipo === tipoF) &&
                (!k || claveNormalizada([p.nombre, p.ci, p.nit, p.telefono].join(' ')).includes(k)),
        );
    }, [lista.datos, q, tipoF]);

    const total = lista.datos?.length ?? 0;

    async function eliminar(p: PersonaResumen) {
        if (!(await confirmar(`¿Eliminar a ${p.nombre}? Esta acción no se puede deshacer desde la aplicación.`))) return;
        try {
            await s.eliminarPersona.ejecutar(p.id);
            setError(null);
            lista.recargar();
            avisar('Persona eliminada');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    return (
        <div className="pagina">
            <div className="pagina-cab">
                <div>
                    <h1>Personas</h1>
                    <p className="subtitulo">Clientes, partes, representantes y abogados. Sus datos alimentan los modelos de documentos.</p>
                </div>
                <button type="button" className="btn btn-pri" onClick={() => setEditor({})}>
                    <Icono n="mas" tam={16} /> Nueva persona
                </button>
            </div>

            <div className="filtros">
                <input
                    className="buscar"
                    type="search"
                    placeholder="Buscar por nombre, C.I., NIT o teléfono…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <select value={tipoF} onChange={(e) => setTipoF(e.target.value)}>
                    <option value="">Todos los tipos</option>
                    <option value="natural">Personas naturales</option>
                    <option value="juridica">Personas jurídicas</option>
                </select>
            </div>

            <Aviso error={error ?? lista.error} />

            {lista.datos && filtradas.length === 0 ? (
                <Vacio
                    icono="personas"
                    titulo={total === 0 ? 'Aún no hay personas' : 'Sin resultados'}
                    texto={total === 0 ? 'Registra a tus clientes y a las demás partes para usarlos en expedientes y documentos.' : 'Prueba con otra búsqueda o filtro.'}
                >
                    {total === 0 && (
                        <button type="button" className="btn btn-pri" onClick={() => setEditor({})}>Nueva persona</button>
                    )}
                </Vacio>
            ) : (
                <div className="tabla-wrap">
                    <table className="tabla tabla-click">
                        <thead>
                            <tr><th>Persona</th><th>Tipo</th><th>Documento</th><th>Teléfono</th><th /></tr>
                        </thead>
                        <tbody>
                            {filtradas.map((p) => (
                                <tr
                                    key={p.id}
                                    tabIndex={0}
                                    onClick={() => setEditor({ id: p.id })}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) setEditor({ id: p.id }); }}
                                >
                                    <td>
                                        <div className="celda-persona">
                                            <span className="avatar">{iniciales(p.nombre)}</span>
                                            <span className="celda-titulo">{p.nombre || '—'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <Insignia tono={p.tipo === 'juridica' ? 'violeta' : 'azul'}>
                                            {p.tipo === 'juridica' ? 'Jurídica' : 'Natural'}
                                        </Insignia>
                                    </td>
                                    <td>
                                        {p.tipo === 'juridica'
                                            ? (p.nit ? `NIT ${p.nit}` : <span className="suave">—</span>)
                                            : (p.ci ? `C.I. ${p.ci}` : <span className="suave">—</span>)}
                                    </td>
                                    <td>{p.telefono || <span className="suave">—</span>}</td>
                                    <td className="num">
                                        <div className="acciones" style={{ justifyContent: 'flex-end' }}>
                                            <button
                                                type="button"
                                                className="btn btn-fan btn-icono btn-sm"
                                                aria-label="Editar persona"
                                                onClick={(e) => { e.stopPropagation(); setEditor({ id: p.id }); }}
                                            >
                                                <Icono n="editar" tam={15} />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-fan btn-icono btn-sm"
                                                aria-label="Eliminar persona"
                                                onClick={(e) => { e.stopPropagation(); void eliminar(p); }}
                                            >
                                                <Icono n="papelera" tam={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {editor && (
                <FormularioPersona
                    id={editor.id}
                    personas={lista.datos ?? []}
                    cerrar={() => setEditor(null)}
                    guardado={() => {
                        const editado = !!editor.id;
                        setEditor(null);
                        lista.recargar();
                        avisar(editado ? 'Persona actualizada' : 'Persona creada');
                    }}
                />
            )}
        </div>
    );
}

/* ---------------- Carga de la persona a editar ---------------- */
function FormularioPersona({ id, personas, cerrar, guardado }: {
    id?: string; personas: PersonaResumen[]; cerrar: () => void; guardado: () => void;
}) {
    const s = useServicios();
    const carga = useCargar(async () => ({ datos: id ? await s.consultas.obtenerPersona(id) : null }), [id]);
    const titulo = id ? 'Editar persona' : 'Nueva persona';
    const pieCerrar = (
        <><span className="espacio" /><button type="button" className="btn btn-sec" onClick={cerrar}>Cerrar</button></>
    );

    if (carga.error) {
        return <Modal titulo={titulo} cerrar={cerrar} pie={pieCerrar}><Aviso error={carga.error} /></Modal>;
    }
    if (!carga.datos) {
        return <Modal titulo={titulo} cerrar={cerrar} pie={pieCerrar}><p className="suave">Cargando…</p></Modal>;
    }
    if (id && !carga.datos.datos) {
        return <Modal titulo={titulo} cerrar={cerrar} pie={pieCerrar}><Aviso error="La persona ya no existe o fue eliminada." /></Modal>;
    }
    return <FormPersona id={id} inicial={carga.datos.datos} personas={personas} cerrar={cerrar} guardado={guardado} />;
}

/* ---------------- Formulario ---------------- */
function FormPersona({ id, inicial, personas, cerrar, guardado }: {
    id?: string; inicial: DatosPersona | null; personas: PersonaResumen[]; cerrar: () => void; guardado: () => void;
}) {
    const s = useServicios();
    const [tipo, setTipo] = useState<TipoPersona>(inicial?.tipo ?? 'natural');
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);

    const v = (k: keyof DatosPersona): string => {
        const x = inicial?.[k];
        return typeof x === 'string' ? x : '';
    };

    const estadoActual = v('estadoCivil').trim();
    const estadoBase = BASE_ESTADO[claveNormalizada(estadoActual)] ?? estadoActual;
    const estados = estadoBase && !ESTADOS_CIVILES.includes(estadoBase) ? [...ESTADOS_CIVILES, estadoBase] : ESTADOS_CIVILES;
    const naturales = personas.filter((p) => p.tipo === 'natural' && p.id !== id);

    async function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const f = datosDeForm(ev.currentTarget);
        setTrabajando(true);
        try {
            const datos = { ...f, tipo } as unknown as DatosPersona;
            if (id) await s.actualizarPersona.ejecutar(id, datos);
            else await s.crearPersona.ejecutar(datos);
            guardado();
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    return (
        <Modal
            titulo={id ? 'Editar persona' : 'Nueva persona'}
            ancho="grande"
            cerrar={cerrar}
            pie={
                <>
                    <span className="espacio" />
                    <button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button>
                    <button type="submit" form="form-persona" className="btn btn-pri" disabled={trabajando}>
                        {id ? 'Guardar cambios' : 'Crear persona'}
                    </button>
                </>
            }
        >
            <Aviso error={error} />
            <form id="form-persona" className="form-grid" onSubmit={(ev) => void enviar(ev)}>
                <div className="ancho">
                    <Segmentado<TipoPersona>
                        valor={tipo}
                        cambiar={setTipo}
                        opciones={[{ id: 'natural', etiqueta: 'Persona natural' }, { id: 'juridica', etiqueta: 'Persona jurídica' }]}
                    />
                </div>

                {/* Los campos del tipo no activo quedan deshabilitados: no se validan ni se envían, pero conservan lo escrito. */}
                <fieldset disabled={tipo !== 'natural'} hidden={tipo !== 'natural'} style={SIN_CAJA}>
                    <Campo etiqueta="Nombres *"><input name="nombres" defaultValue={v('nombres')} required /></Campo>
                    <Campo etiqueta="Apellido paterno"><input name="apellidoPaterno" defaultValue={v('apellidoPaterno')} /></Campo>
                    <Campo etiqueta="Apellido materno"><input name="apellidoMaterno" defaultValue={v('apellidoMaterno')} /></Campo>
                    <Campo etiqueta="Apellido de casada"><input name="apellidoCasada" defaultValue={v('apellidoCasada')} /></Campo>
                    <Campo etiqueta="C.I. (número)"><input name="ciNumero" defaultValue={v('ciNumero')} /></Campo>
                    <Campo etiqueta="Complemento"><input name="ciComplemento" defaultValue={v('ciComplemento')} /></Campo>
                    <Campo etiqueta="Expedido en">
                        <input name="ciExpedido" list="expedidos-persona" defaultValue={v('ciExpedido')} placeholder="LP, CB, SC…" />
                        <datalist id="expedidos-persona">{EXPEDIDOS.map((e) => <option key={e} value={e} />)}</datalist>
                    </Campo>
                    <Campo etiqueta="Género *" ayuda="Se usa para la concordancia (el/la, soltero/soltera…).">
                        <select name="genero" defaultValue={v('genero')} required>
                            <option value="" disabled>Elegir…</option>
                            <option value="M">Masculino</option>
                            <option value="F">Femenino</option>
                        </select>
                    </Campo>
                    <Campo etiqueta="Estado civil">
                        <select name="estadoCivil" defaultValue={estadoBase}>
                            <option value="">—</option>
                            {estados.map((e) => <option key={e} value={e}>{etiquetaRol(e)}</option>)}
                        </select>
                    </Campo>
                    <Campo etiqueta="Nacionalidad"><input name="nacionalidad" defaultValue={v('nacionalidad')} placeholder="boliviano" /></Campo>
                    <Campo etiqueta="Profesión"><input name="profesion" defaultValue={v('profesion')} /></Campo>
                    <Campo etiqueta="Fecha de nacimiento"><input type="date" name="fechaNacimiento" defaultValue={v('fechaNacimiento')} /></Campo>
                </fieldset>

                <fieldset disabled={tipo !== 'juridica'} hidden={tipo !== 'juridica'} style={SIN_CAJA}>
                    <Campo etiqueta="Razón social *" ancho><input name="razonSocial" defaultValue={v('razonSocial')} required /></Campo>
                    <Campo etiqueta="NIT"><input name="nit" defaultValue={v('nit')} /></Campo>
                    <Campo etiqueta="Género gramatical *" ayuda="Para la concordancia con la razón social (el / la).">
                        <select name="generoGramatical" defaultValue={v('generoGramatical')} required>
                            <option value="" disabled>Elegir…</option>
                            <option value="M">Masculino (el)</option>
                            <option value="F">Femenino (la)</option>
                        </select>
                    </Campo>
                    <Campo etiqueta="Representante legal" ayuda={naturales.length === 0 ? 'Registra primero a la persona natural que la representa.' : undefined}>
                        <select name="representanteId" defaultValue={v('representanteId')}>
                            <option value="">—</option>
                            {naturales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                    </Campo>
                    <Campo etiqueta="Poder (referencia)"><input name="poderRef" defaultValue={v('poderRef')} /></Campo>
                </fieldset>

                <Campo etiqueta="Domicilio" ancho><input name="domicilio" defaultValue={v('domicilio')} /></Campo>
                <Campo etiqueta="Teléfono"><input name="telefono" defaultValue={v('telefono')} inputMode="tel" /></Campo>
                <Campo etiqueta="Correo"><input name="correo" type="email" defaultValue={v('correo')} /></Campo>
            </form>
        </Modal>
    );
}