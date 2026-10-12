import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import type { DatosPersona } from '../application/casosDeUso/crearPersona';
import type { PersonaResumen } from '../application/consultas';
import { escribirGeneralesDeLey, leerGeneralesDeLey } from '../domain/generalesDeLey';
import { claveNormalizada, etiquetaRol } from '../domain/texto';
import { Alerta, Aviso, Campo, Modal, Segmentado, avisar, copiarTexto, datosDeForm, fechaHora } from './comunes';
import { borrarBorrador, guardarBorrador, leerBorrador } from './borradores';
import { mensajeError, useCargar, useServicios } from './servicios';

type TipoPersona = 'natural' | 'juridica';

const ESTADOS_CIVILES = ['soltero', 'casado', 'divorciado', 'viudo', 'union libre'];
const BASE_ESTADO: Record<string, string> = { soltera: 'soltero', casada: 'casado', divorciada: 'divorciado', viuda: 'viudo' };
const EXPEDIDOS = ['LP', 'CB', 'SC', 'OR', 'PT', 'CH', 'TJ', 'BN', 'PD', 'QR'];
const SIN_CAJA: CSSProperties = { display: 'contents', border: 0, padding: 0, margin: 0 };

/** Crea (sin `id`) o edita una persona. `guardado` recibe el id de la persona. `usoBorrador` separa los borradores por contexto. */
export function FormularioPersona({ id, usoBorrador = 'nueva', personas, cerrar, guardado }: {
    id?: string; usoBorrador?: string; personas: PersonaResumen[]; cerrar: () => void; guardado: (id: string) => void;
}) {
    const s = useServicios();
    const carga = useCargar(async () => ({ datos: id ? await s.consultas.obtenerPersona(id) : null }), [id]);
    const titulo = id ? 'Editar persona' : 'Nueva persona';
    const pieCerrar = (
        <><span className="espacio" /><button type="button" className="btn btn-sec" onClick={cerrar}>Cerrar</button></>
    );

    if (carga.error) return <Modal titulo={titulo} cerrar={cerrar} pie={pieCerrar}><Aviso error={carga.error} /></Modal>;
    if (!carga.datos) return <Modal titulo={titulo} cerrar={cerrar} pie={pieCerrar}><p className="suave">Cargando…</p></Modal>;
    if (id && !carga.datos.datos) {
        return <Modal titulo={titulo} cerrar={cerrar} pie={pieCerrar}><Aviso error="La persona ya no existe o fue eliminada." /></Modal>;
    }
    return <FormPersona id={id} uso={usoBorrador} inicial={carga.datos.datos} personas={personas} cerrar={cerrar} guardado={guardado} />;
}

interface BorradorPersona { tipo: TipoPersona; campos: Record<string, string> }

function FormPersona({ id, uso, inicial, personas, cerrar, guardado }: {
    id?: string; uso: string; inicial: DatosPersona | null; personas: PersonaResumen[]; cerrar: () => void; guardado: (id: string) => void;
}) {
    const s = useServicios();
    const formRef = useRef<HTMLFormElement>(null);
    const [tipo, setTipo] = useState<TipoPersona>(inicial?.tipo ?? 'natural');
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);
    const [pegado, setPegado] = useState('');
    const [nota, setNota] = useState<string | null>(null);
    // Borrador de la ficha nueva (al editar una existente no se usa).
    const claveBorrador = id ? null : `persona:${uso}`;
    const [pendiente, setPendiente] = useState(() => (claveBorrador ? leerBorrador<BorradorPersona>(claveBorrador) : null));
    const timer = useRef(0);
    useEffect(() => () => window.clearTimeout(timer.current), []);

    function recordar(tipoActual: TipoPersona = tipo) {
        // Mientras haya un borrador sin resolver no se pisa.
        if (!claveBorrador || pendiente) return;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            const form = formRef.current;
            if (!form) return;
            const campos = datosDeForm(form);
            if (Object.keys(campos).length > 0) guardarBorrador<BorradorPersona>(claveBorrador, { tipo: tipoActual, campos });
        }, 400);
    }

    function restaurarBorrador() {
        const form = formRef.current;
        if (!pendiente || !form) return;
        setTipo(pendiente.datos.tipo);
        for (const [k, x] of Object.entries(pendiente.datos.campos)) {
            const el = form.elements.namedItem(k);
            if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) el.value = x;
        }
        setPendiente(null);
    }

    function descartarBorrador() {
        if (claveBorrador) borrarBorrador(claveBorrador);
        setPendiente(null);
    }

    const v = (k: keyof DatosPersona): string => {
        const x = inicial?.[k];
        return typeof x === 'string' ? x : '';
    };

    const estadoActual = v('estadoCivil').trim();
    const estadoBase = BASE_ESTADO[claveNormalizada(estadoActual)] ?? estadoActual;
    const estados = estadoBase && !ESTADOS_CIVILES.includes(estadoBase) ? [...ESTADOS_CIVILES, estadoBase] : ESTADOS_CIVILES;
    const naturales = personas.filter((p) => p.tipo === 'natural' && p.id !== id);

    /** Las generales de ley que el abogado ya tiene en Word → se rellena la ficha (se revisa antes de guardar). */
    function rellenar() {
        const form = formRef.current;
        if (!form) return;
        const hallados = Object.entries(leerGeneralesDeLey(pegado)).filter(([, x]) => typeof x === 'string' && x !== '');
        if (hallados.length === 0) {
            setNota('No reconocí datos en ese texto. Prueba con: nombre, C.I. y expedido, estado civil, profesión y domicilio.');
            return;
        }
        for (const [k, x] of hallados) {
            const el = form.elements.namedItem(k);
            if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) el.value = x as string;
        }
        setNota(`Se rellenaron ${hallados.length} campos. Revisa nombres y apellidos antes de guardar.`);
    }

    /** La ficha → una línea de generales de ley lista para pegar en Word. */
    async function copiarGenerales() {
        const form = formRef.current;
        if (!form) return;
        const texto = escribirGeneralesDeLey({ ...datosDeForm(form), tipo });
        if (!texto) {
            avisar('Escribe al menos el nombre para armar las generales de ley', 'info');
            return;
        }
        const ok = await copiarTexto(texto);
        avisar(ok ? 'Generales de ley copiadas: pégalas en Word' : 'No se pudo copiar', ok ? 'ok' : 'error');
    }

    async function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        window.clearTimeout(timer.current);
        const f = datosDeForm(ev.currentTarget);
        setTrabajando(true);
        try {
            const datos = { ...f, tipo } as unknown as DatosPersona;
            let personaId: string;
            if (id) {
                await s.actualizarPersona.ejecutar(id, datos);
                personaId = id;
            } else {
                personaId = await s.crearPersona.ejecutar(datos);
            }
            if (claveBorrador) borrarBorrador(claveBorrador);
            guardado(personaId);
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
                    <button type="button" className="btn btn-fan" onClick={() => void copiarGenerales()}
                        title="Copia las generales de ley armadas con estos datos, listas para pegar en Word">
                        Copiar generales de ley
                    </button>
                    <span className="espacio" />
                    <button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button>
                    <button type="submit" form="form-persona" className="btn btn-pri" disabled={trabajando}>
                        {id ? 'Guardar cambios' : 'Crear persona'}
                    </button>
                </>
            }
        >
            <Aviso error={error} />
            {pendiente && (
                <Alerta tipo="info">
                    <div>
                        Quedó una ficha sin guardar ({fechaHora(new Date(pendiente.ts).toISOString())}).
                        <div className="acciones" style={{ marginTop: 6 }}>
                            <button type="button" className="btn btn-sec btn-sm" onClick={restaurarBorrador}>Restaurar</button>
                            <button type="button" className="btn btn-fan btn-sm" onClick={descartarBorrador}>Descartar</button>
                        </div>
                    </div>
                </Alerta>
            )}
            <form id="form-persona" ref={formRef} className="form-grid" onInput={() => recordar()} onSubmit={(ev) => void enviar(ev)}>
                <div className="ancho">
                    <Segmentado<TipoPersona>
                        valor={tipo}
                        cambiar={(t) => { setTipo(t); recordar(t); }}
                        opciones={[{ id: 'natural', etiqueta: 'Persona natural' }, { id: 'juridica', etiqueta: 'Persona jurídica' }]}
                    />
                </div>

                {tipo === 'natural' && (
                    <div className="ancho">
                        <details>
                            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>¿Ya tienes las generales de ley en Word? Pégalas aquí</summary>
                            <div className="cb-edicion">
                                <textarea
                                    value={pegado}
                                    onChange={(e) => setPegado(e.target.value)}
                                    placeholder="Ej.: Juan Carlos Pérez Gómez, mayor de edad, boliviano, casado, comerciante, con C.I. 1234567 LP, domiciliado en la calle Sucre N° 123, La Paz"
                                />
                                <div className="pc-acciones">
                                    <button type="button" className="btn btn-sec btn-sm" disabled={!pegado.trim()} onClick={rellenar}>
                                        Rellenar la ficha
                                    </button>
                                </div>
                                {nota && <p className="pc-nota">{nota}</p>}
                            </div>
                        </details>
                    </div>
                )}

                {/* Los campos del tipo no activo quedan deshabilitados: no se validan ni se envían, pero conservan lo escrito. */}
                <fieldset disabled={tipo !== 'natural'} hidden={tipo !== 'natural'} style={SIN_CAJA}>
                    <h4 className="ancho grupo-titulo">Nombre</h4>
                    <Campo etiqueta="Nombres *"><input name="nombres" defaultValue={v('nombres')} required /></Campo>
                    <Campo etiqueta="Apellido paterno"><input name="apellidoPaterno" defaultValue={v('apellidoPaterno')} /></Campo>
                    <Campo etiqueta="Apellido materno"><input name="apellidoMaterno" defaultValue={v('apellidoMaterno')} /></Campo>
                    <Campo etiqueta="Apellido de casada"><input name="apellidoCasada" defaultValue={v('apellidoCasada')} /></Campo>

                    <h4 className="ancho grupo-titulo">Cédula de identidad</h4>
                    <Campo etiqueta="C.I. (número)"><input name="ciNumero" defaultValue={v('ciNumero')} /></Campo>
                    <Campo etiqueta="Complemento"><input name="ciComplemento" defaultValue={v('ciComplemento')} /></Campo>
                    <Campo etiqueta="Expedido en">
                        <input name="ciExpedido" list="expedidos-persona" defaultValue={v('ciExpedido')} placeholder="LP, CB, SC…" />
                        <datalist id="expedidos-persona">{EXPEDIDOS.map((e) => <option key={e} value={e} />)}</datalist>
                    </Campo>

                    <h4 className="ancho grupo-titulo">Datos personales</h4>
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
                    <h4 className="ancho grupo-titulo">Empresa</h4>
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

                <h4 className="ancho grupo-titulo">Contacto</h4>
                <Campo etiqueta="Domicilio" ancho><input name="domicilio" defaultValue={v('domicilio')} /></Campo>
                <Campo etiqueta="Teléfono"><input name="telefono" defaultValue={v('telefono')} inputMode="tel" /></Campo>
                <Campo etiqueta="Correo"><input name="correo" type="email" defaultValue={v('correo')} /></Campo>
            </form>
        </Modal>
    );
}