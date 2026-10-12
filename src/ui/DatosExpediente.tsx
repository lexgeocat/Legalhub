import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { seccionesDeModelo, type DatoSeccion, type FichaModelo, type SeccionModelo } from '../application/camposModelo';
import type { ModeloVisible } from '../application/casosDeUso/administrarModelos';
import { validarPersona, type DatosPersona } from '../application/casosDeUso/crearPersona';
import { limpiarDatos } from '../application/casosDeUso/gestionExpediente';
import type { ExpedienteResumen, ModeloResumen, ParteResumen, PersonaResumen } from '../application/consultas';
import { mismoRol } from '../domain/catalogo';
import type { Bloque, BloqueParrafo, ConfigPagina } from '../domain/fuenteModelo';
import { pilaCss } from '../domain/fuentes';
import { partirNombre } from '../domain/generalesDeLey';
import { nuevoId } from '../domain/id';
import { analizarMarcador, describirMarcador, type ContextoMarcadores } from '../domain/marcadores';
import { claveCampo, claveNormalizada, etiquetaRol, normalizarRol } from '../domain/texto';
import { clienteAlInicio, obtenerTipo } from '../domain/tiposExpediente';
import { Alerta, Aviso, Campo, Icono, Insignia, Segmentado, avisar, confirmar } from './comunes';
import { EntradaDato, OtrosDatos, type CampoForm } from './DatosCaso';
import { FormularioPersona } from './FormularioPersona';
import { mensajeError, useServicios } from './servicios';

type Campos = Record<string, string>;
type Modo = 'formulario' | 'documento';

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

const NOMBRES = new Set(['nombres', 'apellidoPaterno', 'apellidoMaterno', 'razonSocial']);
const EXPEDIDOS = ['LP', 'CB', 'SC', 'OR', 'PT', 'CH', 'TJ', 'BN', 'PD'];
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

/* ================= Sobre el documento ================= */
function ambitosPorParrafo(bloques: Bloque[]): string[][] {
    const pila: string[] = [];
    return bloques.map((b) => {
        const antes = [...pila];
        if (b.tipo === 'parrafo') {
            for (const t of b.tramos) {
                if (!t.marcador) continue;
                const a = analizarMarcador(t.texto);
                if (a?.tipo === 'apertura') pila.push(a.ruta);
                else if (a?.tipo === 'cierre') {
                    const i = pila.map(claveNormalizada).lastIndexOf(claveNormalizada(a.ruta));
                    if (i >= 0) pila.length = i;
                }
            }
        }
        return antes;
    });
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

function EntradaParteDoc({ r, f, editar, conGenero, propio }: {
    r: RefParte; f: FilaParte; editar: (fn: (f: FilaParte) => FilaParte) => void; conGenero: boolean; propio?: DatoSeccion;
}) {
    const p = f.p;
    const jur = p.tipo === 'juridica';
    const rolTxt = etiquetaRol(r.rol).toLowerCase();
    const caja = (v: string) => `en-linea${v.trim() ? '' : ' sin-valor'}`;
    const ancho = (v: string, min = 10): CSSProperties => ({ width: `${Math.min(48, Math.max(min, v.length + 2))}ch` });
    const poner = (k: string, v: string) =>
        editar((x) => ({ ...x, nombreLibre: NOMBRES.has(k) ? undefined : x.nombreLibre, p: { ...x.p, [k]: v } }));

    if (r.propio) {
        const c: CampoForm = { clave: r.clave, etiqueta: propio?.etiqueta ?? etiquetaRol(r.clave), tipo: propio?.tipo ?? 'texto', requerido: propio?.requerido };
        return <EntradaDato enLinea c={c} valor={f.d[r.clave] ?? ''} cambiar={(v) => editar((x) => ({ ...x, d: { ...x.d, [r.clave]: v } }))} />;
    }

    if (r.clave === 'nombre') {
        const v = textoNombre(f);
        const kg = jur ? 'generoGramatical' : 'genero';
        const g = p[kg] ?? '';
        return (
            <>
                <input className={caja(v)} aria-label={`Nombre del ${rolTxt}`} placeholder={`Nombre del ${rolTxt}`}
                    value={v} style={ancho(v, 18)} onChange={(ev) => editar((x) => conNombre(x, ev.target.value))} />
                {conGenero && (
                    <select className={caja(g)} aria-label={`Género del ${rolTxt}`} title="El género es obligatorio" value={g}
                        onChange={(ev) => poner(kg, ev.target.value)}>
                        <option value="">¿Género?</option>
                        <option value="M">{jur ? 'Masculino (el)' : 'Masculino'}</option>
                        <option value="F">{jur ? 'Femenino (la)' : 'Femenino'}</option>
                    </select>
                )}
            </>
        );
    }

    const def = FICHA[r.clave];
    const campo = def?.principal ?? def?.campos[0] ?? r.clave;
    const v = p[campo] ?? '';
    const selExpedido = (
        <select className={caja(p.ciExpedido ?? '')} aria-label="Expedido en" value={p.ciExpedido ?? ''} onChange={(ev) => poner('ciExpedido', ev.target.value)}>
            <option value="">Exp.</option>
            {EXPEDIDOS.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
    );

    if (campo === 'ciExpedido') return selExpedido;
    if (campo === 'estadoCivil') {
        return (
            <select className={caja(v)} aria-label="Estado civil" value={v} onChange={(ev) => poner(campo, ev.target.value)}>
                <option value="">Estado civil</option>
                {(!v || ESTADOS_CIVILES.includes(v) ? ESTADOS_CIVILES : [...ESTADOS_CIVILES, v]).map((x) => <option key={x} value={x}>{etiquetaRol(x)}</option>)}
            </select>
        );
    }
    if (campo === 'fechaNacimiento') return <input type="date" className={caja(v)} aria-label={ETIQ[campo]} value={v} onChange={(ev) => poner(campo, ev.target.value)} />;
    return (
        <>
            <input className={caja(v)} aria-label={ETIQ[campo] ?? campo} placeholder={ETIQ[campo] ?? campo} value={v}
                style={ancho(v)} onChange={(ev) => poner(campo, ev.target.value)} />
            {r.clave === 'ci' && selExpedido}
        </>
    );
}

function ParrafoDoc({ b, i, ambito, config, campos, propios, roles, valores, cambiar, contexto, primeros, fila, editar }: {
    b: BloqueParrafo; i: number; ambito: readonly string[]; config: ConfigPagina;
    campos: ReadonlyMap<string, CampoForm>; propios: ReadonlyMap<string, DatoSeccion>; roles: readonly string[];
    valores: Campos; cambiar: (k: string, v: string) => void; contexto: ContextoMarcadores;
    primeros: ReadonlySet<string>; fila: (rol: string) => FilaParte | undefined;
    editar: (rol: string, fn: (f: FilaParte) => FilaParte) => void;
}) {
    const estilo: CSSProperties = {
        textAlign: b.alineacion === 'both' ? 'justify' : b.alineacion,
        lineHeight: b.interlineado,
        fontWeight: b.estilo === 'normal' ? undefined : 700,
        fontSize: b.estilo === 'titulo' ? `${config.tamanoPt + 2}pt` : undefined,
    };
    return (
        <p className="papel-p" style={estilo}>
            {b.tramos.length === 0 && '\u00A0'}
            {b.tramos.map((t, j) => {
                if (!t.marcador) {
                    return (
                        <span key={j} style={{
                            fontWeight: t.negrita ? 700 : undefined,
                            fontStyle: t.cursiva ? 'italic' : undefined,
                            textDecoration: t.subrayado ? 'underline' : undefined,
                            fontFamily: t.fuente ? pilaCss(t.fuente) : undefined,
                            fontSize: t.tamanoPt ? `${t.tamanoPt}pt` : undefined,
                        }}>{t.texto}</span>
                    );
                }
                // Negrita y cursiva puestas al campo en el editor: se ven también al llenarlo.
                const fmt: CSSProperties = {
                    fontWeight: t.negrita ? 700 : undefined,
                    fontStyle: t.cursiva ? 'italic' : undefined,
                };
                const a = analizarMarcador(t.texto);
                if (a?.tipo === 'valor') {
                    const segs = a.ruta.split('.').map((x) => x.trim());
                    if (segs.length === 2 && claveNormalizada(segs[0]) === 'caso') {
                        const clave = claveCampo(segs[1]);
                        const c = campos.get(clave);
                        if (c) {
                            return (
                                <span key={j} style={fmt}>
                                    <EntradaDato enLinea c={c} valor={valores[clave] ?? ''} cambiar={(v) => cambiar(clave, v)} />
                                </span>
                            );
                        }
                    }
                    const r = refDeParte(a.ruta, ambito, roles);
                    const f = r ? fila(r.rol) : undefined;
                    if (r && f) {
                        return (
                            <span key={j} style={fmt}>
                                <EntradaParteDoc r={r} f={f} editar={(fn) => editar(r.rol, fn)}
                                    conGenero={primeros.has(`${i}:${j}`)} propio={propios.get(r.clave)} />
                            </span>
                        );
                    }
                }
                const m = describirMarcador(t.texto, contexto);
                return (
                    <span key={j} className="mk" data-k={m.tipo} style={{ '--h': m.matiz, ...fmt } as CSSProperties}
                        title={`${m.titulo}${m.detalle ? ` — ${m.detalle}` : ''}`}>
                        <span className="mk-e">{m.corto}</span>
                    </span>
                );
            })}
        </p>
    );
}

function LlenadoDocumento({ bloques, config, campos, propios, roles, valores, cambiar, fila, editar }: {
    bloques: Bloque[]; config: ConfigPagina; campos: CampoForm[]; propios: ReadonlyMap<string, DatoSeccion>;
    roles: string[]; valores: Campos; cambiar: (k: string, v: string) => void;
    fila: (rol: string) => FilaParte | undefined;
    editar: (rol: string, fn: (f: FilaParte) => FilaParte) => void;
}) {
    const mapa = useMemo(() => new Map(campos.map((c) => [c.clave, c] as const)), [campos]);
    const contexto = useMemo<ContextoMarcadores>(
        () => ({ campos: Object.fromEntries(campos.map((c) => [c.clave, c.etiqueta])), partes: roles }),
        [campos, roles],
    );
    const ambitos = useMemo(() => ambitosPorParrafo(bloques), [bloques]);

    /** El género se pregunta junto a la primera vez que aparece el nombre de cada parte. */
    const { primeros, conNombre: rolesConNombre } = useMemo(() => {
        const primeros = new Set<string>();
        const conNombre = new Set<string>();
        bloques.forEach((b, i) => {
            if (b.tipo !== 'parrafo') return;
            b.tramos.forEach((t, j) => {
                if (!t.marcador) return;
                const a = analizarMarcador(t.texto);
                if (a?.tipo !== 'valor') return;
                const r = refDeParte(a.ruta, ambitos[i], roles);
                if (r && !r.propio && r.clave === 'nombre' && !conNombre.has(r.rol)) {
                    conNombre.add(r.rol);
                    primeros.add(`${i}:${j}`);
                }
            });
        });
        return { primeros, conNombre };
    }, [bloques, ambitos, roles]);

    const sinNombre = roles.filter((r) => !rolesConNombre.has(r));

    return (
        <>
            <div className="papel" style={{ fontFamily: pilaCss(config.fuente), fontSize: `${config.tamanoPt}pt`, lineHeight: config.interlineado }}>
                {bloques.length === 0 && <p className="suave">El documento está vacío.</p>}
                {bloques.map((b, i) => (b.tipo === 'salto'
                    ? <hr key={i} className="papel-salto" />
                    : (
                        <ParrafoDoc key={i} b={b} i={i} ambito={ambitos[i]} config={config} campos={mapa} propios={propios}
                            roles={roles} valores={valores} cambiar={cambiar} contexto={contexto} primeros={primeros}
                            fila={fila} editar={editar} />
                    )))}
            </div>
            {sinNombre.length > 0 && (
                <Alerta tipo="adv">
                    El documento no muestra el nombre de: {sinNombre.map(etiquetaRol).join(', ')}. Regístralo en la pestaña «Partes».
                </Alerta>
            )}
        </>
    );
}
/* ================= Pestañas «Partes» y «Datos» (comparten estado) ================= */
export function DatosExpediente({
    pestana, e, modelo, visible, ficha, partes, personas,
    recargar, recargarPersonas, irModelo, irPartes, irDatos, irDocumento, onSucio,
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
    irModelo: () => void;
    irPartes: () => void;
    irDatos: () => void;
    irDocumento: () => void;
    /** Avisa si hay cambios sin guardar (para no perderlos al salir). */
    onSucio: (sucio: boolean) => void;
}) {
    const s = useServicios();
    const [modo, setModo] = useState<Modo>('formulario');
    const [valores, setValores] = useState<Campos>({ ...e.datos });
    const [filas, setFilas] = useState<FilaParte[] | null>(null);
    const [eliminadas, setEliminadas] = useState<string[]>([]);
    const [sucio, setSucio] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [fichaDe, setFichaDe] = useState<string | null>(null);

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
        if (!ficha) return;
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
            for (const r of ficha.roles) if (!cargadas.some((f) => mismoRol(f.rol, r))) cargadas.push(filaNueva(r));
            const orden = (rol: string) => {
                const i = ficha.roles.findIndex((r) => mismoRol(r, rol));
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
    }, [firmaPartes, ficha]);

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
    async function guardar(despues?: () => void) {
        const lista = filas ?? [];
        const errores = validar(lista);
        if (errores.length > 0) {
            setErr(errores.join('\n'));
            if (pestana === 'datos') irPartes(); // los errores son de las partes: se lleva a donde se corrigen
            return;
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
                    personaId = await s.crearPersona.ejecutar(datos);
                    fijar(f.id, { personaId, orig: JSON.stringify(f.p) });
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
            recargar();
            recargarPersonas();
            avisar('Datos guardados');
            despues?.();
        } catch (error) {
            setErr(mensajeError(error));
        } finally {
            setGuardando(false);
        }
    }

    /* ----- estados de pantalla ----- */
    if (!modelo) {
        return (
            <Alerta tipo="adv">
                Primero elige el modelo: según él se arma la lista de partes y el formulario de datos.{' '}
                <button type="button" className="btn btn-enlace" onClick={irModelo}>Elegir modelo</button>
            </Alerta>
        );
    }
    if (!ficha || !visible || !filas) return <p className="suave">Cargando el modelo…</p>;

    const registradas = (rol: string) => filas.filter((f) => mismoRol(f.rol, rol) && !vacia(f));

    // «Partes»: ¿quién falta registrar?
    const resumen = ficha.roles.map((rol) => {
        const reg = registradas(rol);
        return { rol, registradas: reg.length, falta: reg.length === 0 ? 1 : reg.filter(faltaIdentidad).length };
    });
    const sinRegistrar = resumen.filter((r) => r.registradas === 0).map((r) => r.rol);
    const clienteSinParte = !!e.clienteId && ficha.roles.length > 0 && !filas.some((f) => f.personaId === e.clienteId);

    // «Datos»: categorías del modelo con lo que pide de cada parte y del caso
    const categorias = secciones
        .map((sec) => ({
            sec,
            partes: roles
                .map((rol) => ({ rol, ...camposDe(sec, rol, ficha) }))
                .filter((x) => x.campos.length + x.propios.length > 0),
        }))
        .filter((c) => c.sec.caso.length > 0 || c.partes.length > 0);
    const hayDatos = categorias.length > 0;
    const faltanCaso = ficha.caso.filter((c) => c.requerido && sinValor(valores[c.clave])).length;
    const faltanPartes = filas.filter((f) => !vacia(f)).reduce((a, f) => a + faltantesCampos(f, ficha), 0);

    const acc: Acciones = {
        elegir: (id, personaId) => void elegirPersona(id, personaId),
        quitar: (f) => void quitar(f),
        cliente: (f, v) => void marcarCliente(f, v),
        ficha: setFichaDe,
        poner: ponerP,
        ponerD,
    };

    const selector = (
        <Segmentado<Modo>
            valor={modo}
            cambiar={setModo}
            opciones={[{ id: 'formulario', etiqueta: 'Formulario' }, { id: 'documento', etiqueta: 'Sobre el documento' }]}
        />
    );

    const documento = (
        <div className="tarjeta">
            <p className="suave">
                Escribe en los huecos (amarillos = vacíos). Al escribir el nombre de una parte, elige también su <b>género</b>: es obligatorio.
                Si hay varios vendedores o compradores, agrégalos en la pestaña Partes.
            </p>
            <LlenadoDocumento
                bloques={visible.bloques} config={visible.config} campos={ficha.caso} propios={mapaPropios}
                roles={ficha.roles} valores={valores} cambiar={poner} fila={filaDe} editar={editarPrimera}
            />
        </div>
    );

    const haciaDatos = pestana === 'partes' && hayDatos;
    const siguiente = () => {
        if (haciaDatos) irDatos(); // entre Partes y Datos no se pierde nada: comparten estado
        else if (sucio) void guardar(irDocumento);
        else irDocumento();
    };

    return (
        <>
            {pestana === 'partes' ? (
                <>
                    <div className="tarjeta">
                        <div className="tarjeta-cab">
                            <div>
                                <h3>Partes del expediente</h3>
                                <p className="suave">
                                    Quién interviene según «{modelo.nombre}». Busca una persona ya registrada y se autocompleta, o escribe su nombre y género.
                                    Los demás datos (C.I., domicilio…) se llenan en «Datos».
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

                    {ficha.roles.length === 0 && (
                        <Alerta tipo="info">Este modelo no usa partes: todo sale de los datos del caso.</Alerta>
                    )}
                    {!e.clienteId && !alInicio && ficha.roles.length > 0 && (
                        <Alerta tipo="info">
                            Este expediente aún no tiene cliente. Cuando registres a las partes, marca con «Es mi cliente» a quien te contrata.
                        </Alerta>
                    )}
                    {clienteSinParte && (
                        <Alerta tipo="info">
                            <div>
                                El cliente <b>{e.clienteNombre}</b> aún no figura entre las partes. Regístralo como:
                                <div className="chips" style={{ marginTop: 6 }}>
                                    {ficha.roles.map((r) => (
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
                </>
            ) : (
                <>
                    <div className="tarjeta">
                        <div className="tarjeta-cab">
                            <div>
                                <h3>Datos del expediente</h3>
                                <p className="suave">
                                    Los que pide «{modelo.nombre}», ordenados por categoría. Llénalos en un formulario o escribe directo sobre el documento.
                                </p>
                            </div>
                            {selector}
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

                    {modo === 'formulario' && !hayDatos && (
                        <Alerta tipo="info">Este modelo no pide más datos que los de las partes.</Alerta>
                    )}

                    {modo === 'formulario' && categorias.map(({ sec, partes: bloques }) => (
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

                    {modo === 'documento' && documento}

                    <OtrosDatos conocidos={ficha.caso.map((c) => c.clave)} valores={valores} cambiar={poner} />
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
                    {haciaDatos ? 'Siguiente: llenar los datos' : sucio ? 'Guardar y ver vista previa' : 'Siguiente: vista previa y edición'}
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
        </>
    );
}