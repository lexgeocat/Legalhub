import { useEffect, useMemo, useState } from 'react';
import { seccionesDeModelo, type DatoSeccion, type FichaModelo, type SeccionModelo } from '../../application/camposModelo';
import type { ModeloVisible } from '../../application/casosDeUso/administrarModelos';
import { validarPersona, type DatosPersona } from '../../application/casosDeUso/crearPersona';
import { limpiarDatos } from '../../application/casosDeUso/gestionExpediente';
import type { ExpedienteResumen, ModeloResumen, ParteResumen, PersonaResumen } from '../../application/consultas';
import { mismoRol, rolDesdeTexto } from '../../domain/expedientes/catalogo';
import { FILTROS, ci as cedula } from '../../domain/modelos/filtros';
import { bloquesATexto, type FuenteModelo } from '../../domain/modelos/fuenteModelo';
import { partirNombre } from '../../domain/personas/generalesDeLey';
import { nuevoId } from '../../domain/comun/id';
import { analizarMarcador, type FiltroMarcador } from '../../domain/modelos/marcadores';
import { atributoConcordado, estadoCivilConcordado } from '../../domain/personas/personas';
import { claveCampo, claveNormalizada, etiquetaRol, normalizarRol } from '../../domain/comun/texto';
import { clienteAlInicio, obtenerTipo } from '../../domain/expedientes/tiposExpediente';
import { Alerta, Aviso, Campo, Icono, Insignia, Segmentado, avisar, confirmar, fechaHora } from '../_core/comunes';
import { borrarBorrador, guardarBorrador, leerBorrador } from '../editor/borradores';
import { CampoForm, EntradaDato, OtrosDatos, esLargo } from './DatosCaso';
import { EditorModeloVentana, type LlenadoVentana } from '../editor/EditorModelo';
import type { EdicionDirecta } from '../editor/HojaEditable';
import { FormularioPersona } from './FormularioPersona';
import { mensajeError, useServicios } from '../_core/servicios';

type Campos = Record<string, string>;

/** Una persona en un rol del expediente, tal como se edita en pantalla. */
interface FilaParte {
    id: string;
    /** Rol en singular («vendedor»). */
    rol: string;
    parteId?: string;
    personaId?: string;
    /** Ficha de la persona (claves de DatosPersona). */
    p: Campos;
    /** Datos propios de la parte (municipio, depto…). */
    d: Campos;
    /** Nombre tal como se escribe sobre el documento (para no perder espacios al escribir). */
    nombreLibre?: string;
    /** Firma de `p` al cargar, para saber si hay que actualizar la persona. */
    orig?: string;
}

interface RefParte { rol: string; propio: boolean; clave: string }
/** Lo que se guarda como borrador mientras hay cambios sin guardar. */
interface BorradorDatos { firma: string; valores: Campos; filas: FilaParte[]; eliminadas: string[] }

const NOMBRES = new Set(['nombres', 'apellidoPaterno', 'apellidoMaterno', 'razonSocial']);
const EXPEDIDOS = ['LP', 'CB', 'SC', 'OR', 'PT', 'CH', 'TJ', 'BN', 'PD', 'QR'];
const ESTADOS_CIVILES = ['soltero', 'casado', 'divorciado', 'viudo', 'union libre'];

const ETIQ: Record<string, string> = {
    nombres: 'Nombres', apellidoPaterno: 'Apellido paterno', apellidoMaterno: 'Apellido materno',
    apellidoCasada: 'Apellido de casada', ciNumero: 'C.I. (número)', ciComplemento: 'Complemento',
    ciExpedido: 'Expedido en', estadoCivil: 'Estado civil', nacionalidad: 'Nacionalidad', profesion: 'Profesión',
    fechaNacimiento: 'Fecha de nacimiento', domicilio: 'Domicilio', telefono: 'Teléfono', correo: 'Correo',
    razonSocial: 'Razón social', nit: 'NIT', poderRef: 'Poder (referencia)',
};

/** Dato de la ficha del modelo → campos de la persona que se muestran. */
const FICHA: Record<string, { campos: string[]; principal?: string }> = {
    nombre: { campos: [] },
    nombres: { campos: [], principal: 'nombres' },
    apellido_paterno: { campos: [], principal: 'apellidoPaterno' },
    apellido_materno: { campos: [], principal: 'apellidoMaterno' },
    apellido_casada: { campos: ['apellidoCasada'], principal: 'apellidoCasada' },
    ci: { campos: ['ciNumero', 'ciComplemento', 'ciExpedido'], principal: 'ciNumero' },
    ci_numero: { campos: ['ciNumero'], principal: 'ciNumero' },
    ci_complemento: { campos: ['ciComplemento'] },
    ci_expedido: { campos: ['ciExpedido'], principal: 'ciExpedido' },
    estado_civil: { campos: ['estadoCivil'], principal: 'estadoCivil' },
    nacionalidad: { campos: ['nacionalidad'], principal: 'nacionalidad' },
    profesion: { campos: ['profesion'], principal: 'profesion' },
    fecha_nacimiento: { campos: ['fechaNacimiento'], principal: 'fechaNacimiento' },
    domicilio: { campos: ['domicilio'], principal: 'domicilio' },
    telefono: { campos: ['telefono'], principal: 'telefono' },
    correo: { campos: ['correo'], principal: 'correo' },
    razon_social: { campos: [], principal: 'razonSocial' },
    nit: { campos: ['nit'], principal: 'nit' },
    poder_ref: { campos: ['poderRef'], principal: 'poderRef' },
};
const ALIAS_DOC: Record<string, string> = { nombre_completo: 'nombre', ci_datos: 'ci' };
const FICHA_DOC = new Set([...Object.keys(FICHA), ...Object.keys(ALIAS_DOC)]);
const FICHA_VACIA: FichaModelo = { roles: [], caso: [], datosParte: [], fichaParte: [] };
/** Datos que identifican a la persona: al escribirlos se ofrece elegir su género. */
const CLAVES_NOMBRE = new Set(['nombre', 'nombres', 'apellido_paterno', 'apellido_materno', 'razon_social']);
/** Nombres que el sistema ya usa: no valen como rol de una parte. */
const RESERVADOS = new Set(['cliente', 'abogado', 'caso', 'expediente', 'hoy', 'partes', 'inmuebles', 'sin_parte']);

/* ================= Utilidades ================= */
const sinValor = (v: string | undefined) => !v || v.trim() === '';
const filaNueva = (rol: string): FilaParte => ({ id: nuevoId(), rol: normalizarRol(rol), p: { tipo: 'natural' }, d: {} });

const vacia = (f: FilaParte): boolean =>
    !f.parteId && !f.personaId
    && Object.entries(f.p).every(([k, v]) => k === 'tipo' || sinValor(v))
    && Object.values(f.d).every((v) => sinValor(v));

function nombreDe(f: FilaParte): string {
    if (f.p.tipo === 'juridica') return f.p.razonSocial ?? '';
    return [f.p.nombres, f.p.apellidoPaterno, f.p.apellidoMaterno].filter((x) => !sinValor(x)).join(' ');
}
const textoNombre = (f: FilaParte): string => f.nombreLibre ?? nombreDe(f);

/** El nombre escrito de corrido sobre el documento se reparte en nombres y apellidos. */
function conNombre(f: FilaParte, texto: string): FilaParte {
    if (f.p.tipo === 'juridica') return { ...f, nombreLibre: texto, p: { ...f.p, razonSocial: texto } };
    const x = partirNombre(texto);
    return {
        ...f, nombreLibre: texto,
        p: { ...f.p, nombres: x.nombres ?? '', apellidoPaterno: x.apellidoPaterno ?? '', apellidoMaterno: x.apellidoMaterno ?? '' },
    };
}

function aCampos(d: DatosPersona | null): Campos {
    const c: Campos = { tipo: d?.tipo === 'juridica' ? 'juridica' : 'natural' };
    if (d) for (const [k, v] of Object.entries(d)) if (k !== 'tipo' && typeof v === 'string') c[k] = v;
    return c;
}

function aDatosPersona(f: FilaParte): DatosPersona {
    const limpio: Record<string, string> = {};
    for (const [k, v] of Object.entries(f.p)) if (!sinValor(v)) limpio[k] = v.trim();
    return { ...limpio, tipo: f.p.tipo === 'juridica' ? 'juridica' : 'natural' } as unknown as DatosPersona;
}

/** Errores que impiden guardar (nombre, apellido y género son obligatorios). */
function validar(filas: FilaParte[]): string[] {
    const errores: string[] = [];
    const lleno = filas.filter((f) => !vacia(f));
    const total: Record<string, number> = {};
    for (const f of lleno) total[normalizarRol(f.rol)] = (total[normalizarRol(f.rol)] ?? 0) + 1;
    const visto: Record<string, number> = {};
    for (const f of lleno) {
        const k = normalizarRol(f.rol);
        visto[k] = (visto[k] ?? 0) + 1;
        const quien = etiquetaRol(f.rol) + (total[k] > 1 ? ` ${visto[k]}` : '');
        try {
            validarPersona(aDatosPersona(f));
        } catch (err) {
            errores.push(`${quien}: ${mensajeError(err)}`);
        }
    }
    return errores;
}

/** Falta el nombre o el género: lo que se pide en la pestaña «Partes». */
const faltaIdentidad = (f: FilaParte): boolean => {
    const p = f.p;
    return p.tipo === 'juridica'
        ? sinValor(p.razonSocial) || !p.generoGramatical
        : sinValor(p.nombres) || (sinValor(p.apellidoPaterno) && sinValor(p.apellidoMaterno)) || !p.genero;
};

/** Cuántos datos obligatorios del modelo (pestaña «Datos») faltan en esta persona. */
function faltantesCampos(f: FilaParte, ficha: FichaModelo): number {
    let n = 0;
    for (const u of ficha.fichaParte) {
        if (!u.requerido || !mismoRol(u.rol, f.rol)) continue;
        const campo = FICHA[u.clave]?.principal;
        if (campo && !NOMBRES.has(campo) && sinValor(f.p[campo])) n += 1;
    }
    for (const d of ficha.datosParte) {
        if (d.requerido && mismoRol(d.rol, f.rol) && sinValor(f.d[d.clave])) n += 1;
    }
    return n;
}

/** Datos de la ficha y datos propios que una categoría pide de una parte. */
function camposDe(sec: SeccionModelo, rol: string, ficha: FichaModelo): { campos: string[]; propios: DatoSeccion[] } {
    const usaFicha = (k: string) => ficha.fichaParte.some((u) => mismoRol(u.rol, rol) && u.clave === k);
    const usaPropio = (k: string) => ficha.datosParte.some((d) => mismoRol(d.rol, rol) && d.clave === k);
    return {
        campos: [...new Set(sec.ficha.filter((d) => usaFicha(d.clave)).flatMap((d) => FICHA[d.clave]?.campos ?? []))],
        propios: sec.propios.filter((d) => usaPropio(d.clave)),
    };
}

/* ================= Formulario: una persona ================= */
interface Acciones {
    elegir: (id: string, personaId: string) => void;
    quitar: (f: FilaParte) => void;
    cliente: (f: FilaParte, valor: boolean) => void;
    ficha: (personaId: string) => void;
    poner: (id: string, k: string, v: string) => void;
    ponerD: (id: string, k: string, v: string) => void;
}

function CampoP({ k, f, poner }: { k: string; f: FilaParte; poner: (k: string, v: string) => void }) {
    const v = f.p[k] ?? '';
    const lista = !v || ESTADOS_CIVILES.includes(v) ? ESTADOS_CIVILES : [...ESTADOS_CIVILES, v];
    return (
        <Campo etiqueta={ETIQ[k] ?? k}>
            {k === 'estadoCivil' ? (
                <select value={v} onChange={(ev) => poner(k, ev.target.value)}>
                    <option value="">—</option>
                    {lista.map((x) => <option key={x} value={x}>{etiquetaRol(x)}</option>)}
                </select>
            ) : k === 'fechaNacimiento' ? (
                <input type="date" value={v} onChange={(ev) => poner(k, ev.target.value)} />
            ) : (
                <input
                    value={v}
                    list={k === 'ciExpedido' ? 'expedidos-datos' : undefined}
                    placeholder={k === 'ciExpedido' ? 'LP, CB, SC…' : undefined}
                    onChange={(ev) => poner(k, ev.target.value)}
                />
            )}
        </Campo>
    );
}
const etiquetaPersona = (p: PersonaResumen): string =>
    `${p.nombre}${p.ci ? ` · C.I. ${p.ci}` : p.nit ? ` · NIT ${p.nit}` : ''}`;

/** Busca entre las personas registradas: al elegir una se autocompleta toda su ficha. */
function BuscarPersona({ personas, elegir }: { personas: PersonaResumen[]; elegir: (personaId: string) => void }) {
    const [texto, setTexto] = useState('');
    const porEtiqueta = useMemo(() => new Map(personas.map((p) => [etiquetaPersona(p), p.id] as const)), [personas]);
    return (
        <input
            className="buscar-persona"
            list="personas-datos"
            aria-label="Persona registrada"
            placeholder="Buscar persona registrada…"
            value={texto}
            onChange={(ev) => {
                const v = ev.target.value;
                const id = porEtiqueta.get(v);
                if (id) {
                    setTexto('');
                    elegir(id);
                } else setTexto(v);
            }}
        />
    );
}
/** Pestaña «Partes»: quién interviene (persona, nombre y género). */
function FilaIdentidad({ f, n, total, personas, clienteId, puedeQuitarCliente, acc }: {
    f: FilaParte; n: number; total: number; personas: PersonaResumen[]; clienteId: string;
    puedeQuitarCliente: boolean; acc: Acciones;
}) {
    const natural = f.p.tipo !== 'juridica';
    const esCliente = !!f.personaId && f.personaId === clienteId;
    const poner = (k: string, v: string) => acc.poner(f.id, k, v);

    return (
        <div className="parte-card">
            <div className="parte-cab">
                <Insignia tono="violeta">{etiquetaRol(f.rol)}{total > 1 ? ` ${n + 1}` : ''}</Insignia>
                {esCliente && <Insignia tono="verde">Cliente</Insignia>}
                <span className="espacio" />
                {!f.parteId && (f.personaId ? (
                    <>
                        <Insignia tono="azul">Persona registrada</Insignia>
                        <button type="button" className="btn btn-fan btn-sm" onClick={() => acc.elegir(f.id, '')}>Cambiar persona</button>
                    </>
                ) : personas.length > 0 && (
                    <BuscarPersona personas={personas} elegir={(pid) => acc.elegir(f.id, pid)} />
                ))}
                {f.parteId && (
                    <>
                        <button type="button" className="btn btn-sec btn-sm" disabled={esCliente && !puedeQuitarCliente}
                            onClick={() => acc.cliente(f, !esCliente)}>
                            {esCliente ? 'Quitar de cliente' : 'Es mi cliente'}
                        </button>
                        <button type="button" className="btn btn-fan btn-sm" onClick={() => acc.ficha(f.personaId as string)}>Ficha completa</button>
                    </>
                )}
                {(f.parteId || total > 1) && (
                    <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar" onClick={() => acc.quitar(f)}>
                        <Icono n="papelera" tam={15} />
                    </button>
                )}
            </div>

            <div className="form-grid">
                <div className="ancho">
                    <Segmentado<'natural' | 'juridica'>
                        valor={natural ? 'natural' : 'juridica'}
                        cambiar={(v) => poner('tipo', v)}
                        opciones={[{ id: 'natural', etiqueta: 'Persona natural' }, { id: 'juridica', etiqueta: 'Persona jurídica' }]}
                    />
                </div>
                {natural ? (
                    <>
                        <Campo etiqueta="Nombres *"><input value={f.p.nombres ?? ''} onChange={(ev) => poner('nombres', ev.target.value)} /></Campo>
                        <Campo etiqueta="Apellido paterno"><input value={f.p.apellidoPaterno ?? ''} onChange={(ev) => poner('apellidoPaterno', ev.target.value)} /></Campo>
                        <Campo etiqueta="Apellido materno"><input value={f.p.apellidoMaterno ?? ''} onChange={(ev) => poner('apellidoMaterno', ev.target.value)} /></Campo>
                        <Campo etiqueta="Género *" ayuda="Se usa para concordar (el/la, vendedor/vendedora…).">
                            <select value={f.p.genero ?? ''} onChange={(ev) => poner('genero', ev.target.value)}>
                                <option value="" disabled>Elegir…</option>
                                <option value="M">Masculino</option>
                                <option value="F">Femenino</option>
                            </select>
                        </Campo>
                    </>
                ) : (
                    <>
                        <Campo etiqueta="Razón social *" ancho><input value={f.p.razonSocial ?? ''} onChange={(ev) => poner('razonSocial', ev.target.value)} /></Campo>
                        <Campo etiqueta="Género gramatical *" ayuda="Para concordar con la razón social (el / la).">
                            <select value={f.p.generoGramatical ?? ''} onChange={(ev) => poner('generoGramatical', ev.target.value)}>
                                <option value="" disabled>Elegir…</option>
                                <option value="M">Masculino (el)</option>
                                <option value="F">Femenino (la)</option>
                            </select>
                        </Campo>
                    </>
                )}
            </div>
        </div>
    );
}

/** Pestaña «Datos»: los datos de una parte que pide una categoría (C.I., domicilio, datos propios…). */
function FilaCampos({ f, n, total, campos, propios, clienteId, acc }: {
    f: FilaParte; n: number; total: number; campos: string[]; propios: DatoSeccion[];
    clienteId: string; acc: Acciones;
}) {
    const esCliente = !!f.personaId && f.personaId === clienteId;
    const poner = (k: string, v: string) => acc.poner(f.id, k, v);
    return (
        <div className="parte-card">
            <div className="parte-cab">
                <Insignia tono="violeta">{etiquetaRol(f.rol)}{total > 1 ? ` ${n + 1}` : ''}</Insignia>
                <b>{textoNombre(f) || 'Sin nombre'}</b>
                {esCliente && <Insignia tono="verde">Cliente</Insignia>}
            </div>
            <div className="form-grid">
                {campos.map((k) => <CampoP key={k} k={k} f={f} poner={poner} />)}
                {propios.map((d) => (
                    <Campo key={d.clave} etiqueta={`${d.etiqueta}${d.requerido ? ' *' : ''}`}>
                        <EntradaDato c={d} valor={f.d[d.clave] ?? ''} cambiar={(v) => acc.ponerD(f.id, d.clave, v)} />
                    </Campo>
                ))}
            </div>
        </div>
    );
}

/** ¿El marcador es un dato de una parte? («vendedor.nombre», «vendedor.datos.depto» o, dentro de un bloque, «nombre»). */
function refDeParte(ruta: string, ambito: readonly string[], roles: readonly string[]): RefParte | null {
    const segs = ruta.split('.').map((x) => x.trim()).filter(Boolean);
    const ks = segs.map(claveNormalizada);
    const rolDe = (x: string) => roles.find((r) => mismoRol(r, x));
    const resolver = (rol: string, k: string[], raw: string[]): RefParte | null => {
        if (k.length === 1 && FICHA_DOC.has(k[0])) return { rol, propio: false, clave: ALIAS_DOC[k[0]] ?? k[0] };
        if (k.length === 2 && k[0] === 'datos') return { rol, propio: true, clave: claveCampo(raw[1]) };
        return null;
    };
    if (ks.length >= 2) {
        const rol = rolDe(ks[0]);
        if (rol) return resolver(rol, ks.slice(1), segs.slice(1));
    }
    for (let i = ambito.length - 1; i >= 0; i--) {
        const rol = rolDe(ambito[i]);
        if (rol) return resolver(rol, ks, segs);
    }
    return null;
}

/* ================= Datos reales dentro del editor ================= */
type Resuelto =
    | { tipo: 'caso'; c: CampoForm; filtros: FiltroMarcador[] }
    | { tipo: 'parte'; r: RefParte; f: FilaParte; filtros: FiltroMarcador[] };

const FILTROS_VISIBLES = new Set(['mayus', 'minus', 'titulo', 'fecha', 'fechalarga', 'moneda', 'dolares', 'superficie', 'literal']);

function conFiltros(valor: string, filtros: readonly FiltroMarcador[]): string {
    if (valor.trim() === '') return '';
    let v = valor;
    for (const f of filtros) {
        if (!FILTROS_VISIBLES.has(f.nombre)) continue;
        try {
            v = FILTROS[f.nombre](v, ...f.args);
        } catch {
            return valor;
        }
    }
    return v;
}

/** Lo que se ve en el documento para un dato de una parte (con concordancia de género). */
function textoDeParte(r: RefParte, f: FilaParte): string {
    if (r.propio) return f.d[r.clave] ?? '';
    const g = f.p.tipo === 'juridica' ? f.p.generoGramatical : f.p.genero;
    const genero = g === 'M' || g === 'F' ? g : null;
    if (r.clave === 'nombre') return textoNombre(f);
    if (r.clave === 'ci') {
        return sinValor(f.p.ciNumero) ? '' : cedula([f.p.ciNumero ?? '', f.p.ciComplemento ?? '', f.p.ciExpedido ?? '']);
    }
    const def = FICHA[r.clave];
    const v = f.p[def?.principal ?? def?.campos[0] ?? r.clave] ?? '';
    if (r.clave === 'estado_civil') return estadoCivilConcordado(v, genero);
    if (r.clave === 'nacionalidad' || r.clave === 'profesion') return atributoConcordado(v, genero);
    return v;
}

const fuenteDeBloques = (v: ModeloVisible): FuenteModelo => ({
    version: 1, config: v.config, texto: bloquesATexto(v.bloques), campos: [], partes: [], grupos: [],
});

/* ---------- Edición directa sobre el documento ---------- */
const TRANSFORMACIONES_VISIBLES = ['mayus', 'minus', 'titulo'] as const;
const transformacionDe = (filtros: readonly FiltroMarcador[]): EdicionDirecta['transformar'] =>
    TRANSFORMACIONES_VISIBLES.find((t) => filtros.some((f) => f.nombre === t));

const PISTA_TIPO: Partial<Record<string, string>> = {
    fecha: 'AAAA-MM-DD', fechalarga: 'AAAA-MM-DD', moneda: '1234,56', dolares: '1234,56', superficie: '250', numero: '12',
};

/** «1234567-1A LP» → número, complemento y expedido. */
function leerCi(texto: string): Campos {
    const [primero = '', ...resto] = texto.trim().replace(/\s*-\s*/g, '-').split(/\s+/);
    const m = /^(.*?)(?:-(\d[A-Za-z]))?$/.exec(primero);
    const exp = resto.join(' ');
    return {
        ciNumero: (m?.[1] ?? primero).replace(/\./g, ''),
        ciComplemento: (m?.[2] ?? '').toUpperCase(),
        ciExpedido: exp.length <= 3 ? exp.toUpperCase() : exp,
    };
}

/** Lo escrito sobre el documento vuelve a la ficha / datos propios de la parte. */
function conValorParte(r: RefParte, f: FilaParte, texto: string): FilaParte {
    if (r.propio) return { ...f, d: { ...f.d, [r.clave]: texto } };
    if (r.clave === 'nombre') return conNombre(f, texto);
    if (r.clave === 'ci') return { ...f, p: { ...f.p, ...leerCi(texto) } };
    const def = FICHA[r.clave];
    const campo = def?.principal ?? def?.campos[0] ?? r.clave;
    const valor = r.clave === 'estado_civil' ? estadoCivilConcordado(texto, 'M') : texto; // se guarda en masculino
    return { ...f, nombreLibre: NOMBRES.has(campo) ? undefined : f.nombreLibre, p: { ...f.p, [campo]: valor } };
}

/* ================= Pestañas «Partes» y «Datos» (comparten estado) ================= */
export function DatosExpediente({
    pestana, e, modelo, visible, ficha, partes, personas,
    recargar, recargarPersonas, recargarModelos, irModelo, irPartes, irDatos, irDocumento, onSucio,
}: {
    /** «Partes»: solo quién interviene. «Datos»: formulario por categorías y «Sobre el documento». Comparten lo escrito. */
    pestana: 'partes' | 'datos';
    e: ExpedienteResumen;
    modelo: ModeloResumen | null;
    visible: ModeloVisible | null;
    ficha: FichaModelo | null;
    partes: ParteResumen[];
    personas: PersonaResumen[];
    recargar: () => void;
    recargarPersonas: () => void;
    recargarModelos: () => void;
    irModelo: () => void;
    irPartes: () => void;
    irDatos: () => void;
    irDocumento: () => void;
    /** Avisa si hay cambios sin guardar (para no perderlos al salir). */
    onSucio: (sucio: boolean) => void;
}) {
    const s = useServicios();
    const [editor, setEditor] = useState(false);
    const [valores, setValores] = useState<Campos>({ ...e.datos });
    const [filas, setFilas] = useState<FilaParte[] | null>(null);
    const [eliminadas, setEliminadas] = useState<string[]>([]);
    const [sucio, setSucio] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [fichaDe, setFichaDe] = useState<string | null>(null);
    const [rolNuevo, setRolNuevo] = useState('');

    const alInicio = clienteAlInicio(obtenerTipo(e.tipo));

    useEffect(() => {
        onSucio(sucio);
    }, [sucio, onSucio]);
    useEffect(() => () => onSucio(false), [onSucio]);

    // Los datos del caso se vuelven a leer cuando cambian en la base.
    const firmaDatos = JSON.stringify(e.datos);
    useEffect(() => {
        setValores({ ...e.datos });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firmaDatos]);

    // Las partes se leen de la base; por cada rol del modelo hay siempre una fila lista para llenar.
    const firmaPartes = JSON.stringify(partes.map((x) => [x.id, x.personaId, x.rol, x.datos]));
    useEffect(() => {
        if (modelo && !ficha) return;
        let vivo = true;
        (async () => {
            const cargadas: FilaParte[] = [];
            for (const x of partes) {
                const p = aCampos(await s.consultas.obtenerPersona(x.personaId));
                cargadas.push({
                    id: nuevoId(), rol: normalizarRol(x.rol), parteId: x.id, personaId: x.personaId,
                    p, d: { ...x.datos }, orig: JSON.stringify(p),
                });
            }
            for (const r of ficha?.roles ?? []) if (!cargadas.some((f) => mismoRol(f.rol, r))) cargadas.push(filaNueva(r));
            const orden = (rol: string) => {
                const i = (ficha?.roles ?? []).findIndex((r) => mismoRol(r, rol));
                return i < 0 ? 999 : i;
            };
            cargadas.sort((a, b) => orden(a.rol) - orden(b.rol));
            if (vivo) {
                setFilas(cargadas);
                setEliminadas([]);
            }
        })().catch((error) => {
            if (!vivo) return;
            setErr(mensajeError(error));
            setFilas([]);
        });
        return () => { vivo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firmaPartes, ficha, modelo?.id]);

    // Borrador: se guarda solo mientras haya cambios sin guardar y se ofrece al volver.
    const claveBorrador = `datos:${e.id}`;
    const [borrador, setBorrador] = useState(() => leerBorrador<BorradorDatos>(claveBorrador));

    useEffect(() => {
        if (!sucio || !filas) return;
        const t = window.setTimeout(
            () => guardarBorrador<BorradorDatos>(claveBorrador, { firma: firmaPartes, valores, filas, eliminadas }),
            700,
        );
        return () => window.clearTimeout(t);
    }, [sucio, filas, valores, eliminadas, firmaPartes, claveBorrador]);

    const secciones = useMemo(
        () => (ficha ? seccionesDeModelo(ficha, visible?.fuente?.grupos ?? [], visible?.fuente?.campos ?? []) : []),
        [ficha, visible],
    );
    const roles = useMemo(() => {
        const l = [...(ficha?.roles ?? [])];
        for (const f of filas ?? []) if (!l.some((r) => mismoRol(r, f.rol))) l.push(f.rol);
        return l;
    }, [ficha, filas]);
    const mapaPropios = useMemo(
        () => new Map(secciones.flatMap((x) => x.propios).map((d) => [d.clave, d] as const)),
        [secciones],
    );

    /* ----- cambios ----- */
    const tocar = () => setSucio(true);
    const poner = (clave: string, v: string) => {
        setValores((x) => ({ ...x, [clave]: v }));
        tocar();
    };
    const cambiarFila = (id: string, fn: (f: FilaParte) => FilaParte) => {
        setFilas((l) => (l ?? []).map((f) => (f.id === id ? fn(f) : f)));
        tocar();
    };
    const fijar = (id: string, c: Partial<FilaParte>) =>
        setFilas((l) => (l ?? []).map((f) => (f.id === id ? { ...f, ...c } : f)));
    const ponerP = (id: string, k: string, v: string) =>
        cambiarFila(id, (f) => ({ ...f, nombreLibre: NOMBRES.has(k) ? undefined : f.nombreLibre, p: { ...f.p, [k]: v } }));
    const ponerD = (id: string, k: string, v: string) => cambiarFila(id, (f) => ({ ...f, d: { ...f.d, [k]: v } }));

    /** Sobre el documento se edita siempre la primera persona de cada rol. */
    const editarPrimera = (rol: string, fn: (f: FilaParte) => FilaParte) => {
        tocar();
        setFilas((l) => {
            const lista = l ?? [];
            const i = lista.findIndex((f) => mismoRol(f.rol, rol));
            if (i < 0) return [...lista, fn(filaNueva(rol))];
            return lista.map((f, k) => (k === i ? fn(f) : f));
        });
    };
    const filaDe = (rol: string) => (filas ?? []).find((f) => mismoRol(f.rol, rol));

    async function elegirPersona(id: string, personaId: string) {
        try {
            if (!personaId) {
                cambiarFila(id, (f) => ({ ...f, personaId: undefined, p: { tipo: 'natural' }, nombreLibre: undefined, orig: undefined }));
                return;
            }
            const p = aCampos(await s.consultas.obtenerPersona(personaId));
            cambiarFila(id, (f) => ({ ...f, personaId, p, nombreLibre: undefined, orig: JSON.stringify(p) }));
        } catch (error) {
            setErr(mensajeError(error));
        }
    }

    /** Autollena una parte con la persona que ya es cliente del expediente. */
    async function usarCliente(rol: string) {
        if (!e.clienteId) return;
        let id = (filas ?? []).find((f) => mismoRol(f.rol, rol) && vacia(f))?.id;
        if (!id) {
            const nueva = filaNueva(rol);
            id = nueva.id;
            setFilas((l) => [...(l ?? []), nueva]);
        }
        await elegirPersona(id, e.clienteId);
    }

    async function quitar(f: FilaParte) {
        if (f.parteId && !(await confirmar(`¿Quitar a ${nombreDe(f) || 'esta parte'} como ${etiquetaRol(f.rol).toLowerCase()} de este expediente?`))) return;
        if (f.parteId) setEliminadas((l) => [...l, f.parteId as string]);
        setFilas((l) => {
            const resto = (l ?? []).filter((x) => x.id !== f.id);
            const delModelo = !!ficha?.roles.some((r) => mismoRol(r, f.rol));
            return delModelo && !resto.some((x) => mismoRol(x.rol, f.rol)) ? [...resto, filaNueva(f.rol)] : resto;
        });
        tocar();
    }

    async function marcarCliente(f: FilaParte, valor: boolean) {
        if (!f.personaId) return;
        try {
            await s.actualizarExpediente.ejecutar(e.id, { clienteId: valor ? f.personaId : null });
            recargar();
            avisar(valor ? 'Cliente definido' : 'Cliente quitado');
        } catch (error) {
            setErr(mensajeError(error));
        }
    }

    async function refrescar(personaId: string) {
        const p = aCampos(await s.consultas.obtenerPersona(personaId));
        setFilas((l) => (l ?? []).map((x) => (x.personaId === personaId ? { ...x, p, nombreLibre: undefined, orig: JSON.stringify(p) } : x)));
    }

    /** Guarda partes y datos del caso juntos. `despues` se ejecuta solo si todo se guardó bien. */
    async function guardar(despues?: () => void): Promise<boolean> {
        const lista = filas ?? [];
        const errores = validar(lista);
        if (errores.length > 0) {
            setErr(errores.join('\n'));
            if (editor) avisar(errores.join('\n'), 'error'); // el editor tapa la pantalla: se avisa con un toast
            else if (pestana === 'datos') irPartes(); // los errores son de las partes: se lleva a donde se corrigen
            return false;
        }
        setGuardando(true);
        try {
            for (const id of eliminadas) {
                await s.quitarParte.ejecutar(id);
                setEliminadas((l) => l.filter((x) => x !== id));
            }
            for (const f of lista) {
                if (vacia(f)) continue;
                const datos = aDatosPersona(f);
                let personaId = f.personaId;
                if (!personaId) {
                    // Si el C.I. / NIT ya está registrado se ofrece reutilizar esa ficha (evita duplicados).
                    const dup = await s.consultas.buscarPorDocumento({
                        ciNumero: f.p.ciNumero, ciComplemento: f.p.ciComplemento, nit: f.p.nit,
                    });
                    if (dup && (await confirmar(
                        `«${dup.nombre}» ya está registrada con ese documento. ¿Usar esa persona en lugar de crear otra?`,
                        'Persona ya registrada',
                    ))) {
                        personaId = dup.id;
                        const existente = aCampos(await s.consultas.obtenerPersona(dup.id));
                        fijar(f.id, { personaId, p: existente, nombreLibre: undefined, orig: JSON.stringify(existente) });
                    } else {
                        personaId = await s.crearPersona.ejecutar(datos);
                        fijar(f.id, { personaId, orig: JSON.stringify(f.p) });
                    }
                } else if (JSON.stringify(f.p) !== f.orig) {
                    await s.actualizarPersona.ejecutar(personaId, datos);
                    fijar(f.id, { orig: JSON.stringify(f.p) });
                }
                const propios = limpiarDatos(f.d);
                if (f.parteId) {
                    await s.actualizarDatosParte.ejecutar(f.parteId, propios);
                } else {
                    const parteId = await s.agregarParte.ejecutar({
                        expedienteId: e.id, personaId, rol: f.rol,
                        datosOverride: Object.keys(propios).length > 0 ? { datos: propios } : undefined,
                    });
                    fijar(f.id, { parteId });
                }
            }
            await s.actualizarExpediente.ejecutar(e.id, { datos: valores });
            setErr(null);
            setSucio(false);
            onSucio(false);
            borrarBorrador(claveBorrador);
            setBorrador(null);
            recargar();
            recargarPersonas();
            avisar('Datos guardados');
            despues?.();
            return true;
        } catch (error) {
            setErr(mensajeError(error));
            if (editor) avisar(mensajeError(error), 'error');
            return false;
        } finally {
            setGuardando(false);
        }
    }

    function restaurarBorrador() {
        if (!borrador) return;
        const b = borrador.datos;
        const mismasPartes = b.firma === firmaPartes;
        setValores(b.valores);
        if (mismasPartes) {
            setFilas(b.filas);
            setEliminadas(b.eliminadas);
        }
        setSucio(true);
        setBorrador(null);
        avisar(
            mismasPartes
                ? 'Borrador restaurado'
                : 'Se restauraron los datos del caso; las partes cambiaron desde que se guardó el borrador',
            'info',
        );
    }

    function descartarBorrador() {
        borrarBorrador(claveBorrador);
        setBorrador(null);
    }

    /* ----- estados de pantalla ----- */
    if (pestana === 'datos' && !modelo) {
        return (
            <Alerta tipo="adv">
                Elige primero el modelo: según él se arma el formulario de datos.{' '}
                <button type="button" className="btn btn-enlace" onClick={irModelo}>Elegir modelo</button>
            </Alerta>
        );
    }
    // Las partes se registran sin modelo; con modelo elegido se espera a que cargue lo que pide.
    if (!filas || (modelo && (!ficha || !visible))) return <p className="suave">Cargando…</p>;
    const fichaEf = ficha ?? FICHA_VACIA;

    const registradas = (rol: string) => filas.filter((f) => mismoRol(f.rol, rol) && !vacia(f));

    // «Partes»: ¿quién falta registrar?
    const resumen = roles.map((rol) => {
        const reg = registradas(rol);
        return { rol, registradas: reg.length, falta: reg.length === 0 ? 1 : reg.filter(faltaIdentidad).length };
    });
    const sinRegistrar = resumen.filter((r) => r.registradas === 0).map((r) => r.rol);
    const clienteSinParte = !!e.clienteId && roles.length > 0 && !filas.some((f) => f.personaId === e.clienteId);
    const rolesSugeridos = obtenerTipo(e.tipo).roles
        .map(normalizarRol)
        .filter((r) => !roles.some((x) => mismoRol(x, r)));

    const agregarRol = (texto: string) => {
        const rol = rolDesdeTexto(texto);
        if (!rol) return;
        if (RESERVADOS.has(rol)) {
            avisar(`«${etiquetaRol(rol)}» es un nombre reservado del sistema. Usa otro rol.`, 'error');
            return;
        }
        if (!roles.some((r) => mismoRol(r, rol))) setFilas((l) => [...(l ?? []), filaNueva(rol)]);
        setRolNuevo('');
    };

    // «Datos»: categorías del modelo con lo que pide de cada parte y del caso
    const categorias = secciones
        .map((sec) => ({
            sec,
            partes: roles
                .map((rol) => ({ rol, ...camposDe(sec, rol, fichaEf) }))
                .filter((x) => x.campos.length + x.propios.length > 0),
        }))
        .filter((c) => c.sec.caso.length > 0 || c.partes.length > 0);
    const hayDatos = categorias.length > 0;
    const faltanCaso = fichaEf.caso.filter((c) => c.requerido && sinValor(valores[c.clave])).length;
    const faltanPartes = filas.filter((f) => !vacia(f)).reduce((a, f) => a + faltantesCampos(f, fichaEf), 0);

    const acc: Acciones = {
        elegir: (id, personaId) => void elegirPersona(id, personaId),
        quitar: (f) => void quitar(f),
        cliente: (f, v) => void marcarCliente(f, v),
        ficha: setFichaDe,
        poner: ponerP,
        ponerD,
    };

    /* ----- datos reales dentro del editor a pantalla completa ----- */
    const mapaCaso = new Map(secciones.flatMap((x) => x.caso).map((c) => [c.clave, c] as const));
    const resolver = (marcador: string, ambito: readonly string[]): Resuelto | null => {
        const a = analizarMarcador(marcador);
        if (a?.tipo !== 'valor') return null;
        const segs = a.ruta.split('.').map((x) => x.trim());
        if (segs.length === 2 && claveNormalizada(segs[0]) === 'caso') {
            const c = mapaCaso.get(claveCampo(segs[1]));
            if (c) return { tipo: 'caso', c, filtros: a.filtros };
        }
        const r = refDeParte(a.ruta, ambito, roles);
        const f = r ? filaDe(r.rol) : undefined;
        return r && f ? { tipo: 'parte', r, f, filtros: a.filtros } : null;
    };

    const llenado: LlenadoVentana = {
        sucio,
        guardando,
        soloLectura: !visible?.editable,
        guardarDatos: () => guardar(),
        valor: (m, amb) => {
            const x = resolver(m, amb);
            if (!x) return undefined;
            const bruto = x.tipo === 'caso' ? (valores[x.c.clave] ?? '') : textoDeParte(x.r, x.f);
            return conFiltros(bruto, x.filtros);
        },
        crudo: (m, amb) => {
            const x = resolver(m, amb);
            if (!x) return undefined;
            const transformar = transformacionDe(x.filtros);
            if (x.tipo === 'caso') {
                return {
                    texto: valores[x.c.clave] ?? '', transformar,
                    multilinea: esLargo(x.c), pista: PISTA_TIPO[x.c.tipo],
                };
            }
            const propio = x.r.propio ? mapaPropios.get(x.r.clave) : undefined;
            return {
                texto: textoDeParte(x.r, x.f),
                transformar,
                multilinea: propio ? esLargo(propio) : false,
                pista: propio ? PISTA_TIPO[propio.tipo] : x.r.clave === 'fecha_nacimiento' ? 'AAAA-MM-DD' : undefined,
            };
        },
        guardar: (m, amb, valor) => {
            const x = resolver(m, amb);
            if (!x) return;
            if (x.tipo === 'caso') poner(x.c.clave, valor);
            else editarPrimera(x.r.rol, (f) => conValorParte(x.r, f, valor));
        },
        /** Al escribir el nombre de una parte se elige también su género (Alt+M / Alt+F). */
        selector: (m, amb) => {
            const x = resolver(m, amb);
            if (!x || x.tipo !== 'parte' || x.r.propio || !CLAVES_NOMBRE.has(x.r.clave)) return undefined;
            const juridica = x.f.p.tipo === 'juridica';
            const campo = juridica ? 'generoGramatical' : 'genero';
            return {
                titulo: juridica ? 'Género gramatical' : 'Género',
                valor: x.f.p[campo] ?? '',
                opciones: juridica
                    ? [{ valor: 'M', etiqueta: 'Masculino (el)', tecla: 'm' }, { valor: 'F', etiqueta: 'Femenino (la)', tecla: 'f' }]
                    : [{ valor: 'M', etiqueta: 'Masculino', tecla: 'm' }, { valor: 'F', etiqueta: 'Femenino', tecla: 'f' }],
                cambiar: (v) => editarPrimera(x.r.rol, (f) => ({ ...f, p: { ...f.p, [campo]: v } })),
            };
        },
    };

    // Partes → Datos comparten estado (no hace falta guardar). Cualquier otro salto guarda primero.
    const salta = pestana === 'partes' && !!modelo && hayDatos;
    const destino = pestana === 'partes' ? (!modelo ? irModelo : hayDatos ? irDatos : irDocumento) : irDocumento;
    const textoSiguiente = pestana === 'partes'
        ? (!modelo ? 'Siguiente: elegir el modelo' : hayDatos ? 'Siguiente: llenar los datos' : 'Siguiente: vista previa y edición')
        : sucio ? 'Guardar y ver vista previa' : 'Siguiente: vista previa y edición';
    const siguiente = () => {
        if (sucio && !salta) void guardar(destino);
        else destino();
    };

    return (
        <>
            {borrador && !sucio && (
                <Alerta tipo="info">
                    <div>
                        Hay un borrador sin guardar del {fechaHora(new Date(borrador.ts).toISOString())}.
                        <div className="acciones" style={{ marginTop: 6 }}>
                            <button type="button" className="btn btn-sec btn-sm" onClick={restaurarBorrador}>Restaurar borrador</button>
                            <button type="button" className="btn btn-fan btn-sm" onClick={descartarBorrador}>Descartar</button>
                        </div>
                    </div>
                </Alerta>
            )}
            {pestana === 'partes' ? (
                <>
                    <div className="tarjeta">
                        <div className="tarjeta-cab">
                            <div>
                                <h3>Partes del expediente</h3>
                                <p className="suave">
                                    Quién interviene{modelo ? <> según «{modelo.nombre}»</> : ' en este expediente'}. Busca una persona ya registrada
                                    y se autocompleta, o escribe su nombre y género. Los demás datos (C.I., domicilio…) se llenan en «Datos».
                                </p>
                            </div>
                        </div>
                        <div className="acciones">
                            {e.clienteId && <Insignia tono="verde">Cliente: {e.clienteNombre}</Insignia>}
                            {resumen.map((r) => (
                                <Insignia key={r.rol} tono={r.registradas > 0 && r.falta === 0 ? 'verde' : 'ambar'}>
                                    {etiquetaRol(r.rol)}{r.registradas > 1 ? ` ×${r.registradas}` : ''} ·{' '}
                                    {r.registradas === 0 ? 'sin registrar' : r.falta === 0 ? 'completo' : `faltan ${r.falta}`}
                                </Insignia>
                            ))}
                            {sucio && <Insignia tono="rojo">Sin guardar</Insignia>}
                        </div>
                    </div>

                    {roles.length === 0 && (
                        <Alerta tipo="info">
                            {modelo
                                ? 'Este modelo no usa partes: todo sale de los datos del caso. Si necesitas una, agrégala abajo.'
                                : 'Empieza eligiendo quién interviene (abajo). El modelo se elige en el siguiente paso.'}
                        </Alerta>
                    )}
                    {!e.clienteId && !alInicio && roles.length > 0 && (
                        <Alerta tipo="info">
                            Este expediente aún no tiene cliente. Cuando registres a las partes, marca con «Es mi cliente» a quien te contrata.
                        </Alerta>
                    )}
                    {clienteSinParte && (
                        <Alerta tipo="info">
                            <div>
                                El cliente <b>{e.clienteNombre}</b> aún no figura entre las partes. Regístralo como:
                                <div className="chips" style={{ marginTop: 6 }}>
                                    {roles.map((r) => (
                                        <button key={r} type="button" className="chip" onClick={() => void usarCliente(r)}>
                                            + {etiquetaRol(r)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </Alerta>
                    )}

                    {roles.map((rol) => {
                        const lista = filas.filter((f) => mismoRol(f.rol, rol));
                        const reg = lista.filter((f) => !vacia(f)).length;
                        return (
                            <div key={rol} className="tarjeta">
                                <div className="tarjeta-cab">
                                    <div>
                                        <h3>{etiquetaRol(rol)}</h3>
                                        <p className="suave">{reg === 0 ? 'Sin registrar' : `${reg} registrado(s)`}</p>
                                    </div>
                                    <button type="button" className="btn btn-sec btn-sm"
                                        onClick={() => { setFilas((l) => [...(l ?? []), filaNueva(rol)]); tocar(); }}>
                                        + Agregar otro {etiquetaRol(rol).toLowerCase()}
                                    </button>
                                </div>
                                {lista.map((f, n) => (
                                    <FilaIdentidad key={f.id} f={f} n={n} total={lista.length} personas={personas}
                                        clienteId={e.clienteId} puedeQuitarCliente={!alInicio} acc={acc} />
                                ))}
                            </div>
                        );
                    })}

                    <div className="tarjeta">
                        <div className="tarjeta-cab">
                            <div>
                                <h3>Agregar una parte</h3>
                                <p className="suave">
                                    {modelo
                                        ? 'Si el documento necesita otro rol, agrégalo aquí.'
                                        : 'Aún no hay modelo: elige los roles que intervienen según el tipo de expediente.'}
                                </p>
                            </div>
                        </div>
                        {rolesSugeridos.length > 0 && (
                            <div className="chips">
                                {rolesSugeridos.map((r) => (
                                    <button key={r} type="button" className="chip" onClick={() => agregarRol(r)}>+ {etiquetaRol(r)}</button>
                                ))}
                            </div>
                        )}
                        <form className="acciones" onSubmit={(ev) => { ev.preventDefault(); agregarRol(rolNuevo); }}>
                            <input value={rolNuevo} placeholder="Otro rol: testigo, fiador…" style={{ maxWidth: 260 }}
                                onChange={(ev) => setRolNuevo(ev.target.value)} />
                            <button type="submit" className="btn btn-sec btn-sm" disabled={!rolNuevo.trim()}>Agregar</button>
                        </form>
                    </div>
                </>
            ) : (
                <>
                    <div className="tarjeta">
                        <div className="tarjeta-cab">
                            <div>
                                <h3>Datos del expediente</h3>
                                <p className="suave">
                                    Los que pide «{modelo?.nombre}», ordenados por categoría. Llénalos en un formulario o escribe directo sobre el documento.
                                </p>
                            </div>
                            <button type="button" className="btn btn-pri" onClick={() => setEditor(true)}>
                                <Icono n="documento" tam={16} /> Llenar sobre el documento
                            </button>
                        </div>
                        <div className="acciones">
                            {faltanPartes + faltanCaso === 0 ? <Insignia tono="verde">Datos completos</Insignia> : (
                                <>
                                    {faltanPartes > 0 && <Insignia tono="ambar">Faltan {faltanPartes} dato(s) de las partes</Insignia>}
                                    {faltanCaso > 0 && <Insignia tono="ambar">Faltan {faltanCaso} dato(s) del caso</Insignia>}
                                </>
                            )}
                            {sucio && <Insignia tono="rojo">Sin guardar</Insignia>}
                        </div>
                    </div>

                    {sinRegistrar.length > 0 && (
                        <Alerta tipo="adv">
                            Aún no registraste a: {sinRegistrar.map(etiquetaRol).join(', ')}.{' '}
                            <button type="button" className="btn btn-enlace" onClick={irPartes}>Ir a Partes</button>
                        </Alerta>
                    )}

                    {!hayDatos && (
                        <Alerta tipo="info">Este modelo no pide más datos que los de las partes.</Alerta>
                    )}

                    {categorias.map(({ sec, partes: bloques }) => (
                        <div key={sec.id} className="tarjeta">
                            <div className="tarjeta-cab">
                                <div>
                                    <h3>{sec.nombre}</h3>
                                    <p className="suave">{sec.caso.length + sec.ficha.length + sec.propios.length} dato(s)</p>
                                </div>
                            </div>

                            {bloques.map(({ rol, campos, propios }) => {
                                const lista = registradas(rol);
                                return (
                                    <div key={rol} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {lista.length === 0 && (
                                            <p className="suave">Aún no hay {etiquetaRol(rol).toLowerCase()} registrado: agrégalo en la pestaña Partes.</p>
                                        )}
                                        {lista.map((f, n) => (
                                            <FilaCampos key={f.id} f={f} n={n} total={lista.length} campos={campos} propios={propios}
                                                clienteId={e.clienteId} acc={acc} />
                                        ))}
                                    </div>
                                );
                            })}

                            {sec.caso.length > 0 && (
                                <div className="form-grid">
                                    {sec.caso.map((c) => (
                                        <Campo key={c.clave} etiqueta={`${c.etiqueta}${c.requerido ? ' *' : ''}`} ancho={c.tipo === 'texto_largo'}>
                                            <EntradaDato c={c} valor={valores[c.clave] ?? ''} cambiar={(v) => poner(c.clave, v)} />
                                        </Campo>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    <OtrosDatos conocidos={fichaEf.caso.map((c) => c.clave)} valores={valores} cambiar={poner} />
                </>
            )}

            <Aviso error={err} />

            <div className="barra-datos">
                <button type="button" className="btn btn-pri" disabled={!sucio || guardando} onClick={() => void guardar()}>
                    {guardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <span className="espacio" />
                {pestana === 'datos' && (
                    <button type="button" className="btn btn-fan" onClick={irPartes}>← Partes</button>
                )}
                <button type="button" className="btn btn-sec" disabled={guardando} onClick={siguiente}>
                    {textoSiguiente}
                </button>
            </div>

            <datalist id="expedidos-datos">{EXPEDIDOS.map((x) => <option key={x} value={x} />)}</datalist>
            <datalist id="personas-datos">{personas.map((p) => <option key={p.id} value={etiquetaPersona(p)} />)}</datalist>

            {fichaDe && (
                <FormularioPersona
                    id={fichaDe}
                    personas={personas}
                    cerrar={() => setFichaDe(null)}
                    guardado={(id) => {
                        setFichaDe(null);
                        recargarPersonas();
                        refrescar(id).catch((error) => setErr(mensajeError(error)));
                        avisar('Persona actualizada');
                    }}
                />
            )}
            {editor && modelo && visible && (
                <EditorModeloVentana
                    modeloId={modelo.id}
                    inicial={{
                        nombre: modelo.nombre, materia: modelo.materia, categoria: modelo.categoria, descripcion: modelo.descripcion,
                        fuente: visible.fuente ?? fuenteDeBloques(visible),
                    }}
                    volver={() => setEditor(false)}
                    guardado={() => recargarModelos()}
                    llenado={llenado}
                />
            )}
        </>
    );
}