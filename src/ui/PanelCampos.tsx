import { useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { tipoSugerido } from '../application/camposModelo';
import { mismoRol, rolDesdeTexto } from '../domain/catalogo';
import { armarFrase, datosDe, marcadorDato, partirFrase, planDatos, type PlanDato } from '../domain/camposParte';
import { formasConcordancia, type FormasConcordancia } from '../domain/concordancia';
import {
    TIPOS_CAMPO, marcadorDeCampo, type CampoPropio, type DatoParte, type GrupoDatos, type TipoCampo,
} from '../domain/fuenteModelo';
import { nuevoId } from '../domain/id';
import { matizDePersona } from '../domain/marcadores';
import { claveCampo, etiquetaRol, pluralRol } from '../domain/texto';
import { Campo, Icono, Segmentado, confirmar } from './comunes';

type Pestana = 'datos' | 'partes' | 'genero';
type Insertar = (texto: string, bloque: boolean) => void;
type Modo = 'cada' | 'una';

const SIN_AMBITO: readonly string[] = [];
/** Nombres que el sistema ya usa para otra cosa (el cliente del expediente, los datos del abogado…). */
const RESERVADOS = new Set(['cliente', 'abogado', 'caso', 'expediente', 'hoy', 'partes', 'inmuebles']);

/** Evita que el botón le quite el foco (y el cursor) a la hoja. */
const quieto = (e: { preventDefault(): void }) => e.preventDefault();
const nombreTipo = (t: string) => TIPOS_CAMPO.find((x) => x.valor === t)?.etiqueta ?? t;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/* ---------------- Partes ---------------- */
interface Parte {
    /** Rol en singular: «vendedor». */
    id: string;
    etiqueta: string;
    /** «vendedores»: todas las personas con ese rol. */
    plural: string;
    matiz: number;
}

const dePartes = (roles: string[]): Parte[] =>
    roles.map((r) => ({ id: r, etiqueta: etiquetaRol(r), plural: pluralRol(r), matiz: matizDePersona(r, roles) }));

const PALABRAS_RAPIDAS = ['el', 'el señor', 'del', 'al', 'un', 'señor', 'domiciliado', 'portador', 'mayor de edad'];

/* ================= Pestaña DATOS ================= */
function EditarDato({ c, onGuardar, onCancelar }: {
    c: CampoPropio; onGuardar: (c: CampoPropio) => void; onCancelar: () => void;
}) {
    const [etiqueta, setEtiqueta] = useState(c.etiqueta);
    const [tipo, setTipo] = useState<TipoCampo>(c.tipo);
    const [requerido, setRequerido] = useState(c.requerido);
    return (
        <div className="cb-edicion">
            <input aria-label="Nombre del dato" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
            <div className="cb-fila-form">
                <select aria-label="Tipo de dato" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCampo)}>
                    {TIPOS_CAMPO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                </select>
                <label className="casilla">
                    <input type="checkbox" checked={requerido} onChange={(e) => setRequerido(e.target.checked)} />
                    Obligatorio
                </label>
            </div>
            <p className="pc-nota">Clave interna: <code>caso.{c.clave}</code>. Lo que ya insertaste en el texto no cambia.</p>
            <div className="pc-acciones">
                <button type="button" className="btn btn-pri btn-sm"
                    onClick={() => onGuardar({ ...c, etiqueta: etiqueta.trim() || etiquetaRol(claveCampo(c.clave)), tipo, requerido })}>
                    Guardar
                </button>
                <button type="button" className="btn btn-fan btn-sm" onClick={onCancelar}>Cancelar</button>
            </div>
        </div>
    );
}

function TabDatos({ campos, onCampos, onInsertar, onDetectar }: {
    campos: CampoPropio[];
    onCampos: (c: CampoPropio[]) => void;
    onInsertar: Insertar;
    onDetectar: () => void;
}) {
    const [etiqueta, setEtiqueta] = useState('');
    const [tipo, setTipo] = useState<TipoCampo>('texto');
    const [manual, setManual] = useState(false);
    const [requerido, setRequerido] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editando, setEditando] = useState<number | null>(null);
    const clave = claveCampo(etiqueta);
    const existente = clave ? campos.find((c) => claveCampo(c.clave) === clave) : undefined;

    function cambiarNombre(v: string) {
        setEtiqueta(v);
        setError(null);
        if (!manual) setTipo(tipoSugerido(claveCampo(v)));
    }

    function crear(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        if (!clave) {
            setError('Escribe un nombre (letras o números)');
            return;
        }
        const c: CampoPropio = existente ?? { clave, etiqueta: etiqueta.trim(), tipo, requerido };
        if (!existente) onCampos([...campos, c]);
        onInsertar(marcadorDeCampo({ ...c, clave: claveCampo(c.clave) }), false);
        setEtiqueta('');
        setTipo('texto');
        setManual(false);
        setRequerido(true);
        setError(null);
    }

    return (
        <>
            <p className="pc-ayuda">
                Crea aquí los datos que cambian en cada documento (precio, plazo, lugar, hechos…).
                Se completan en el expediente o cuando generas el documento.
            </p>

            <form className="cb-form" onSubmit={crear}>
                <input aria-label="Nombre del dato" placeholder="Nombre: Precio, Plazo de entrega, Lugar de firma…"
                    value={etiqueta} onChange={(e) => cambiarNombre(e.target.value)} />
                <div className="cb-fila-form">
                    <select aria-label="Tipo de dato" value={tipo}
                        onChange={(e) => { setTipo(e.target.value as TipoCampo); setManual(true); }}>
                        {TIPOS_CAMPO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                    </select>
                    <label className="casilla">
                        <input type="checkbox" checked={requerido} onChange={(e) => setRequerido(e.target.checked)} />
                        Obligatorio
                    </label>
                </div>
                <p className="pc-nota">
                    {existente
                        ? `Ya existe «caso.${clave}»: se insertará el que ya tienes.`
                        : clave ? `Se insertará como caso.${clave}` : 'El nombre puede llevar espacios y tildes.'}
                </p>
                {error && <p className="pc-error">{error}</p>}
                <div><button type="submit" className="btn btn-pri btn-sm">{existente ? 'Insertar el existente' : 'Crear e insertar'}</button></div>
            </form>

            <div className="cb-titulo">
                <span>Mis datos ({campos.length})</span>
                <button type="button" className="btn btn-fan btn-sm" onMouseDown={quieto} onClick={onDetectar}
                    title="Busca en el texto los {{caso.…}}, datos de partes y roles que escribiste a mano">
                    Detectar del texto
                </button>
            </div>

            {campos.length === 0 && <p className="pc-ayuda">Aún no creaste ningún dato. Empieza con el formulario de arriba.</p>}

            {campos.map((c, i) => editando === i ? (
                <EditarDato key={i} c={c}
                    onCancelar={() => setEditando(null)}
                    onGuardar={(nuevo) => { onCampos(campos.map((x, k) => (k === i ? nuevo : x))); setEditando(null); }} />
            ) : (
                <div key={i} className="cb-fila">
                    <button type="button" className="cb-insertar" title="Insertar en el cursor" onMouseDown={quieto}
                        onClick={() => onInsertar(marcadorDeCampo({ ...c, clave: claveCampo(c.clave) }), false)}>
                        <span className="cb-nombre">{c.etiqueta || etiquetaRol(c.clave)}</span>
                        <span className="cb-meta">{nombreTipo(c.tipo)}{c.requerido ? '' : ' · opcional'}</span>
                    </button>
                    <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Editar dato" onMouseDown={quieto}
                        onClick={() => setEditando(i)}><Icono n="editar" tam={15} /></button>
                    <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar dato" onMouseDown={quieto}
                        onClick={() => onCampos(campos.filter((_, k) => k !== i))}><Icono n="papelera" tam={15} /></button>
                </div>
            ))}
        </>
    );
}

/* ================= «¿De quién se habla?» (compartido por Partes y Género) ================= */
function Quien({ partes, valor, onCambiar, onAgregar, onQuitar }: {
    partes: Parte[];
    valor: Parte | null;
    onCambiar: (id: string) => void;
    /** Devuelve un mensaje de error, o null si se agregó. */
    onAgregar: (rol: string) => string | null;
    onQuitar: (p: Parte) => void;
}) {
    const [nuevo, setNuevo] = useState('');
    const [abierto, setAbierto] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const formulario = abierto || partes.length === 0;

    function agregar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const e = onAgregar(nuevo);
        if (e) {
            setError(e);
            return;
        }
        setNuevo('');
        setError(null);
        setAbierto(false);
    }

    return (
        <div className="cb-quien">
            <span className="cb-sub">¿De quién se habla?</span>
            {valor && (
                <div className="cb-quien-fila">
                    <i className="cb-punto" style={{ '--h': valor.matiz } as CSSProperties} />
                    <select aria-label="¿De quién se habla?" value={valor.id} onChange={(e) => onCambiar(e.target.value)}>
                        {partes.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
                    </select>
                    <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar esta parte" title="Quitar esta parte"
                        onMouseDown={quieto} onClick={() => onQuitar(valor)}><Icono n="papelera" tam={15} /></button>
                    <button type="button" className="btn btn-sec btn-sm" onMouseDown={quieto} onClick={() => setAbierto((a) => !a)}>
                        {abierto ? 'Cerrar' : '+ Parte'}
                    </button>
                </div>
            )}
            {formulario && (
                <form className="cb-fila-form" onSubmit={agregar}>
                    <input aria-label="Rol de la parte" placeholder="Rol: vendedor, demandante, testigo…"
                        value={nuevo} onChange={(e) => { setNuevo(e.target.value); setError(null); }} />
                    <button type="submit" className="btn btn-pri btn-sm">Agregar</button>
                </form>
            )}
            {error && <p className="pc-error">{error}</p>}
            {partes.length === 0 && (
                <p className="pc-nota">Crea las partes que intervienen en el documento (con el nombre que uses). Los datos que armes se reutilizan en todas.</p>
            )}
        </div>
    );
}

/* ================= Pestaña PARTES: grupos de datos ================= */
function PlanVista({ plan }: { plan: PlanDato[] }) {
    if (plan.length === 0) return null;
    return (
        <ul className="cb-plan">
            {plan.map((x, i) => (
                <li key={i} className={x.estado === 'nuevo' ? 'ok' : x.estado === 'existe' ? 'ya' : 'no'}>
                    <b>{x.nombre}</b>
                    <span>
                        {x.estado === 'nuevo'
                            ? (x.dato?.ficha ? '→ de la ficha de la persona' : `→ dato nuevo · ${nombreTipo(x.dato?.tipo ?? 'texto')}`)
                            : `→ ${x.motivo}`}
                    </span>
                </li>
            ))}
        </ul>
    );
}

function FormGrupo({ todos, onCrear, onCancelar }: {
    todos: DatoParte[]; onCrear: (g: GrupoDatos) => void; onCancelar?: () => void;
}) {
    const [nombre, setNombre] = useState('');
    const [texto, setTexto] = useState('');
    const [error, setError] = useState<string | null>(null);
    const plan = planDatos(texto, todos, tipoSugerido, { requerido: true, mayus: false });
    const listos = plan.flatMap((x) => (x.estado === 'nuevo' && x.dato ? [x.dato] : []));

    function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const n = nombre.trim();
        if (!n) {
            setError('Ponle un nombre al grupo, por ejemplo «Generales de ley».');
            return;
        }
        onCrear({ id: nuevoId(), nombre: n, datos: listos });
    }

    return (
        <form className="cb-edicion" onSubmit={enviar}>
            <input aria-label="Nombre del grupo" autoFocus placeholder="Nombre del grupo: Generales de ley, Datos del vehículo…"
                value={nombre} onChange={(e) => { setNombre(e.target.value); setError(null); }} />
            <textarea aria-label="Datos del grupo" placeholder="Datos, separados por comas: Nombre completo, C.I., Domicilio, Estado civil"
                value={texto} onChange={(e) => setTexto(e.target.value)} />
            <PlanVista plan={plan} />
            <p className="pc-nota">
                Si el nombre coincide con la ficha de la persona (nombre, C.I., domicilio…) se toma de ahí; si no, es un dato nuevo
                que llenas en el expediente. Es opcional: puedes crear el grupo vacío y agregar datos después.
            </p>
            {error && <p className="pc-error">{error}</p>}
            <div className="pc-acciones">
                <button type="submit" className="btn btn-pri btn-sm">
                    {listos.length > 0 ? `Crear grupo con ${plural(listos.length, 'dato', 'datos')}` : 'Crear grupo'}
                </button>
                {onCancelar && <button type="button" className="btn btn-fan btn-sm" onClick={onCancelar}>Cancelar</button>}
            </div>
        </form>
    );
}

function FormDatos({ todos, onAgregar, onCancelar }: {
    todos: DatoParte[]; onAgregar: (l: DatoParte[]) => void; onCancelar: () => void;
}) {
    const [texto, setTexto] = useState('');
    const [tipo, setTipo] = useState<TipoCampo>('texto');
    const [manual, setManual] = useState(false);
    const [requerido, setRequerido] = useState(true);
    const [mayus, setMayus] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const plan = planDatos(texto, todos, tipoSugerido, { tipo: manual ? tipo : undefined, requerido, mayus });
    const listos = plan.flatMap((x) => (x.estado === 'nuevo' && x.dato ? [x.dato] : []));
    const propio = plan.length === 1 && listos[0] && !listos[0].ficha ? listos[0] : null;

    function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        if (listos.length === 0) {
            setError('Escribe al menos un dato nuevo. Separa con comas para crear varios.');
            return;
        }
        onAgregar(listos);
    }

    return (
        <form className="cb-edicion" onSubmit={enviar}>
            <input aria-label="Nombre del dato" autoFocus placeholder="Ej.: Lugar de nacimiento, Nombre del padre, Teléfono"
                value={texto} onChange={(e) => { setTexto(e.target.value); setError(null); }} />
            <PlanVista plan={plan} />
            {propio && (
                <select aria-label="Tipo de dato" value={manual ? tipo : propio.tipo}
                    onChange={(e) => { setTipo(e.target.value as TipoCampo); setManual(true); }}>
                    {TIPOS_CAMPO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                </select>
            )}
            <div className="pc-acciones">
                <label className="casilla">
                    <input type="checkbox" checked={requerido} onChange={(e) => setRequerido(e.target.checked)} />
                    Obligatorio
                </label>
                <label className="casilla">
                    <input type="checkbox" checked={mayus} onChange={(e) => setMayus(e.target.checked)} />
                    EN MAYÚSCULAS
                </label>
            </div>
            {error && <p className="pc-error">{error}</p>}
            <div className="pc-acciones">
                <button type="submit" className="btn btn-pri btn-sm" disabled={listos.length === 0}>
                    {listos.length > 1 ? `Agregar ${listos.length} datos` : 'Agregar'}
                </button>
                <button type="button" className="btn btn-fan btn-sm" onClick={onCancelar}>Cancelar</button>
            </div>
        </form>
    );
}

function EditarDatoParte({ d, ocupadas, onGuardar, onCancelar }: {
    d: DatoParte; ocupadas: ReadonlySet<string>; onGuardar: (d: DatoParte) => void; onCancelar: () => void;
}) {
    const [etiqueta, setEtiqueta] = useState(d.etiqueta);
    const [tipo, setTipo] = useState<TipoCampo>(d.tipo);
    const [requerido, setRequerido] = useState(d.requerido);
    const [mayus, setMayus] = useState(!!d.mayus);
    const [error, setError] = useState<string | null>(null);
    const texto = tipo === 'texto' || tipo === 'texto_largo';

    function guardar() {
        const nombre = etiqueta.trim() || d.etiqueta;
        if (ocupadas.has(claveCampo(nombre))) {
            setError('Ya hay otro dato con ese nombre.');
            return;
        }
        onGuardar({ ...d, etiqueta: nombre, tipo, requerido, mayus: texto && mayus ? true : undefined });
    }

    return (
        <div className="cb-edicion">
            <input aria-label="Nombre del dato" value={etiqueta} onChange={(e) => { setEtiqueta(e.target.value); setError(null); }} />
            {!d.ficha && (
                <select aria-label="Tipo de dato" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCampo)}>
                    {TIPOS_CAMPO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                </select>
            )}
            <div className="pc-acciones">
                <label className="casilla">
                    <input type="checkbox" checked={requerido} onChange={(e) => setRequerido(e.target.checked)} />
                    Obligatorio
                </label>
                {texto && (
                    <label className="casilla">
                        <input type="checkbox" checked={mayus} onChange={(e) => setMayus(e.target.checked)} />
                        EN MAYÚSCULAS
                    </label>
                )}
            </div>
            <p className="pc-nota">
                {d.ficha
                    ? 'Se toma de la ficha de la persona.'
                    : <>Dato propio (<code>datos.{d.clave}</code>): se llena en el expediente, pestaña Partes → Datos.</>}
            </p>
            {error && <p className="pc-error">{error}</p>}
            <div className="pc-acciones">
                <button type="button" className="btn btn-pri btn-sm" onClick={guardar}>Guardar</button>
                <button type="button" className="btn btn-fan btn-sm" onClick={onCancelar}>Cancelar</button>
            </div>
        </div>
    );
}

function TarjetaGrupo({ g, todos, quien, dentro, onCambiar, onQuitar, onInsertar }: {
    g: GrupoDatos;
    todos: DatoParte[];
    quien: Parte | null;
    dentro: boolean;
    onCambiar: (g: GrupoDatos) => void;
    onQuitar: () => void;
    onInsertar: Insertar;
}) {
    const [abierta, setAbierta] = useState(true);
    const [modo, setModo] = useState<null | 'agregar' | 'nombre' | number>(g.datos.length === 0 ? 'agregar' : null);
    const [nombre, setNombre] = useState(g.nombre);
    const prefijo = quien && !dentro ? `${quien.id}.` : '';

    const cambiarDatos = (datos: DatoParte[]) => onCambiar({ ...g, datos });

    function guardarNombre() {
        const n = nombre.trim();
        if (n) onCambiar({ ...g, nombre: n });
        else setNombre(g.nombre);
        setModo(null);
    }

    async function quitar() {
        if (g.datos.length > 0 && !(await confirmar(
            `¿Quitar el grupo «${g.nombre}» con sus ${plural(g.datos.length, 'dato', 'datos')}? Lo que ya insertaste en el texto no cambia.`,
            'Quitar grupo',
        ))) return;
        onQuitar();
    }

    return (
        <div className="cb-tarjeta">
            <div className="cb-tarjeta-cab">
                {modo === 'nombre' ? (
                    <>
                        <input aria-label="Nombre del grupo" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); guardarNombre(); }
                                if (e.key === 'Escape') { setNombre(g.nombre); setModo(null); }
                            }} />
                        <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Guardar nombre" onMouseDown={quieto}
                            onClick={guardarNombre}><Icono n="ok" tam={15} /></button>
                    </>
                ) : (
                    <>
                        <button type="button" className="cb-grupo-tit" aria-expanded={abierta} onMouseDown={quieto}
                            onClick={() => setAbierta((a) => !a)}>
                            <span aria-hidden="true">{abierta ? '▾' : '▸'}</span>
                            <b>{g.nombre}</b>
                            <span className="suave">{plural(g.datos.length, 'dato', 'datos')}</span>
                        </button>
                        <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Renombrar grupo" onMouseDown={quieto}
                            onClick={() => { setNombre(g.nombre); setModo('nombre'); }}><Icono n="editar" tam={15} /></button>
                        <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar grupo" onMouseDown={quieto}
                            onClick={() => void quitar()}><Icono n="papelera" tam={15} /></button>
                    </>
                )}
            </div>

            {abierta && (
                <>
                    {g.datos.length === 0 && modo !== 'agregar' && <p className="pc-ayuda">Grupo vacío. Agrega los datos que se piden de cada parte.</p>}

                    {g.datos.map((d, i) => modo === i ? (
                        <EditarDatoParte key={i} d={d}
                            ocupadas={new Set(todos.filter((x) => x !== d).map((x) => claveCampo(x.etiqueta)))}
                            onCancelar={() => setModo(null)}
                            onGuardar={(nuevo) => { cambiarDatos(g.datos.map((x, k) => (k === i ? nuevo : x))); setModo(null); }} />
                    ) : (
                        <div key={i} className="cb-fila">
                            <button type="button" className="cb-insertar" disabled={!quien} onMouseDown={quieto}
                                title={quien
                                    ? `Insertar para ${quien.etiqueta}${dentro ? ' (cada persona del bloque)' : ''}`
                                    : 'Primero crea una parte (arriba)'}
                                onClick={() => quien && onInsertar(marcadorDato(d, prefijo), false)}>
                                <span className="cb-nombre">{d.etiqueta}</span>
                                <span className="cb-meta">
                                    {d.ficha ? 'Ficha de la persona' : `Dato propio · ${nombreTipo(d.tipo)}`}
                                    {d.mayus ? ' · MAYÚSCULAS' : ''}{d.requerido ? '' : ' · opcional'}
                                </span>
                            </button>
                            <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Editar dato" onMouseDown={quieto}
                                onClick={() => setModo(i)}><Icono n="editar" tam={15} /></button>
                            <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar dato" onMouseDown={quieto}
                                onClick={() => cambiarDatos(g.datos.filter((_, k) => k !== i))}><Icono n="papelera" tam={15} /></button>
                        </div>
                    ))}

                    {modo === 'agregar' ? (
                        <FormDatos todos={todos} onCancelar={() => setModo(null)}
                            onAgregar={(nuevos) => { cambiarDatos([...g.datos, ...nuevos]); setModo(null); }} />
                    ) : (
                        <div className="pc-acciones">
                            <button type="button" className="btn btn-sec btn-sm" onClick={() => setModo('agregar')}>
                                <Icono n="mas" tam={14} /> Dato
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function Redactor({ quien, datos, dentro, onInsertar, onListo }: {
    quien: Parte; datos: DatoParte[]; dentro: boolean; onInsertar: Insertar; onListo: () => void;
}) {
    const [texto, setTexto] = useState('');
    const [modo, setModo] = useState<Modo>('cada');
    const area = useRef<HTMLTextAreaElement>(null);
    const puedeUna = quien.id !== quien.plural;
    const repetir = !dentro && (modo === 'cada' || !puedeUna);
    const prefijo = dentro || repetir ? '' : `${quien.id}.`;
    const piezas = useMemo(() => partirFrase(texto, datos), [texto, datos]);
    const desconocidos = piezas.flatMap((x) => (x.t === 'falta' ? [x.v] : []));
    const vacio = texto.trim() === '';
    const ejemplo = datos.length > 0
        ? datos.slice(0, 3).map((c) => `{${c.etiqueta}}`).join(', tu texto aquí ')
        : 'Primero crea los datos en un grupo';

    function poner(c: DatoParte) {
        const ficha = `{${c.etiqueta}}`;
        const el = area.current;
        const a = el?.selectionStart ?? texto.length;
        const b = el?.selectionEnd ?? a;
        setTexto(texto.slice(0, a) + ficha + texto.slice(b));
        requestAnimationFrame(() => {
            if (!el) return;
            el.focus();
            el.setSelectionRange(a + ficha.length, a + ficha.length);
        });
    }

    function insertar() {
        const { texto: t, faltan } = armarFrase(texto.trim(), datos, prefijo);
        if (faltan.length > 0 || t.trim() === '') return;
        if (repetir) onInsertar(`{{#${quien.plural}}}\n${t}\n{{/${quien.plural}}}`, true);
        else onInsertar(t, t.includes('\n'));
        setTexto('');
        onListo();
    }

    return (
        <div className="cb-edicion">
            <span className="cb-sub">
                Párrafo para <i className="cb-punto" style={{ '--h': quien.matiz } as CSSProperties} /> {quien.etiqueta}: escribe y toca los datos
            </span>
            <textarea ref={area} aria-label="Párrafo" value={texto} placeholder={ejemplo}
                onChange={(e) => setTexto(e.target.value)} />
            {datos.length > 0 && (
                <div className="chips">
                    {datos.map((c, i) => (
                        <button key={i} type="button" className="chip" title="Insertar este dato en el texto"
                            onMouseDown={quieto} onClick={() => poner(c)}>
                            + {c.etiqueta}
                        </button>
                    ))}
                </div>
            )}

            <span className="cb-sub">Así se verá</span>
            <div className="cb-redaccion">
                {vacio
                    ? <span className="suave">Aquí aparece tu párrafo con los datos como etiquetas.</span>
                    : piezas.map((x, i) => (x.t === 'txt'
                        ? <span key={i}>{x.v}</span>
                        : x.t === 'campo'
                            ? <span key={i} className="mk" data-k="persona" style={{ '--h': quien.matiz } as CSSProperties}><span className="mk-e">{x.campo.etiqueta}</span></span>
                            : <span key={i} className="mk-falta">{`{${x.v}}`}</span>))}
            </div>
            {desconocidos.length > 0 && (
                <p className="pc-error">No existe el dato: {desconocidos.map((d) => `{${d}}`).join(', ')}. Créalo o corrige el nombre.</p>
            )}

            {dentro ? (
                <p className="pc-nota">
                    El cursor está dentro del bloque «cada {quien.id.replace(/_/g, ' ')}»: se inserta una vez, y el bloque ya la repite por persona.
                </p>
            ) : puedeUna ? (
                <Segmentado<Modo> valor={modo} cambiar={setModo}
                    opciones={[{ id: 'cada', etiqueta: 'Repetir por cada persona' }, { id: 'una', etiqueta: 'Solo la primera' }]} />
            ) : null}
            <p className="pc-nota">
                Tips: <code>[c]</code> al inicio de una línea la centra · <code>**texto**</code> = negrita · cada línea es un párrafo.
            </p>
            <div className="pc-acciones">
                <button type="button" className="btn btn-pri btn-sm" disabled={vacio || desconocidos.length > 0}
                    onMouseDown={quieto} onClick={insertar}>
                    Insertar en el cursor
                </button>
                <button type="button" className="btn btn-fan btn-sm" onClick={onListo}>Cerrar</button>
            </div>
        </div>
    );
}

function TabPartes({ grupos, quien, ambito, onGrupos, onInsertar }: {
    grupos: GrupoDatos[]; quien: Parte | null; ambito: readonly string[];
    onGrupos: (g: GrupoDatos[]) => void; onInsertar: Insertar;
}) {
    const [nuevoGrupo, setNuevoGrupo] = useState(false);
    const [redactando, setRedactando] = useState(false);
    const todos = useMemo(() => datosDe(grupos), [grupos]);
    const dentro = !!quien && ambito.some((a) => mismoRol(a, quien.id));

    return (
        <>
            <p className="pc-ayuda">
                Agrupa los datos que se piden de las personas (una sola vez). Luego elige arriba «¿De quién se habla?»
                y toca un dato para insertarlo para esa parte.
            </p>

            <div className="cb-cab-seccion">
                <span>Datos de las partes</span>
                <div className="pc-acciones" style={{ margin: 0 }}>
                    <button type="button" className="btn btn-sec btn-sm" onClick={() => setNuevoGrupo((v) => !v)}>
                        <Icono n="mas" tam={14} /> Grupo
                    </button>
                    <button type="button" className="btn btn-sec btn-sm" disabled={!quien || todos.length === 0}
                        title={!quien ? 'Primero crea una parte' : todos.length === 0 ? 'Primero crea algunos datos' : 'Escribe un párrafo mezclando texto y datos'}
                        onClick={() => setRedactando((v) => !v)}>
                        Redactar párrafo
                    </button>
                </div>
            </div>

            {quien && dentro && (
                <p className="pc-nota">
                    El cursor está dentro del bloque «cada {quien.id.replace(/_/g, ' ')}»: los datos se insertan sin prefijo (cada persona del bloque).
                </p>
            )}

            {redactando && quien && (
                <Redactor quien={quien} datos={todos} dentro={dentro} onInsertar={onInsertar} onListo={() => setRedactando(false)} />
            )}

            {(nuevoGrupo || grupos.length === 0) && (
                <FormGrupo todos={todos}
                    onCrear={(g) => { onGrupos([...grupos, g]); setNuevoGrupo(false); }}
                    onCancelar={grupos.length > 0 ? () => setNuevoGrupo(false) : undefined} />
            )}

            {grupos.map((g) => (
                <TarjetaGrupo key={g.id} g={g} todos={todos} quien={quien} dentro={dentro}
                    onCambiar={(nuevo) => onGrupos(grupos.map((x) => (x.id === g.id ? nuevo : x)))}
                    onQuitar={() => onGrupos(grupos.filter((x) => x.id !== g.id))}
                    onInsertar={onInsertar} />
            ))}
        </>
    );
}

/* ================= Pestaña GÉNERO ================= */
function TabGenero({ quien, onInsertar }: { quien: Parte | null; onInsertar: Insertar }) {
    const [palabra, setPalabra] = useState('el');
    const [manual, setManual] = useState<Partial<FormasConcordancia>>({});
    const auto = useMemo(() => formasConcordancia(palabra), [palabra]);
    const f: FormasConcordancia = { ...auto, ...manual };
    const rapidas = useMemo(() => {
        const rol = quien && !quien.id.includes('_')
            ? [`el ${quien.id}`, `EL ${quien.id.toUpperCase()}`, quien.id.toUpperCase()]
            : [];
        return [...PALABRAS_RAPIDAS, ...rol];
    }, [quien]);

    if (!quien) {
        return <p className="pc-ayuda">Primero crea una parte arriba: el género se calcula con las personas de esa parte.</p>;
    }

    const limpio = (s: string) => s.replace(/"/g, '').trim();
    const sm = limpio(f.sm);
    const sf = limpio(f.sf);
    const pm = limpio(f.pm) || limpio(auto.pm);
    const pf = limpio(f.pf) || limpio(auto.pf);
    const listo = sm !== '' && sf !== '';
    const marcador = `{{${quien.plural} | concordar:"${sm}":"${sf}":"${pm}":"${pf}"}}`;

    const cambiar = (v: string) => {
        setPalabra(v);
        setManual({});
    };
    const forma = (k: keyof FormasConcordancia, etiqueta: string) => (
        <Campo etiqueta={etiqueta}>
            <input value={f[k]} onChange={(e) => setManual((m) => ({ ...m, [k]: e.target.value }) as Partial<FormasConcordancia>)} />
        </Campo>
    );

    return (
        <>
            <p className="pc-ayuda">
                El documento elige solo la forma correcta según el género registrado de la persona (o personas):
                el/la, los/las, señor/señora, domiciliado/domiciliada…
            </p>

            <div className="cb-form">
                <Campo etiqueta="Palabra en masculino" ayuda="Escribe la que necesites o toca una de abajo.">
                    <input value={palabra} placeholder="el, señor, domiciliado, mayor de edad…" onChange={(e) => cambiar(e.target.value)} />
                </Campo>
                <div className="chips">
                    {rapidas.map((w) => (
                        <button key={w} type="button" className={`chip${palabra.trim() === w ? ' sel' : ''}`}
                            onMouseDown={quieto} onClick={() => cambiar(w)}>{w}</button>
                    ))}
                </div>

                <div className="cb-formas">
                    {forma('sm', 'Masculino')}
                    {forma('sf', 'Femenino')}
                    {forma('pm', 'Masculino (varios)')}
                    {forma('pf', 'Femenino (varias)')}
                </div>

                <span className="cb-sub">Resultado en el documento</span>
                <div className="cb-ejemplo">
                    <div><span>Un hombre</span>{sm || '—'}</div>
                    <div><span>Una mujer</span>{sf || '—'}</div>
                    <div><span>Varios (o mixto)</span>{pm || '—'}</div>
                    <div><span>Varias mujeres</span>{pf || '—'}</div>
                </div>

                <div>
                    <button type="button" className="btn btn-pri btn-sm" disabled={!listo} onMouseDown={quieto}
                        onClick={() => onInsertar(marcador, false)}>
                        Insertar para {quien.etiqueta}
                    </button>
                </div>
            </div>
            <p className="pc-nota">
                Con hombres y mujeres juntos se usa el masculino plural. Si alguien no tiene género registrado,
                la generación se detiene y te avisa.
            </p>
        </>
    );
}

/* ================= Panel ================= */
export function PanelCampos({ campos, partes, grupos, ambito = SIN_AMBITO, onCampos, onPartes, onGrupos, onInsertar, onDetectar }: {
    campos: CampoPropio[];
    partes: string[];
    grupos: GrupoDatos[];
    /** Bloques «{{#…}}» abiertos donde está el cursor del editor. */
    ambito?: readonly string[];
    onCampos: (c: CampoPropio[]) => void;
    onPartes: (p: string[]) => void;
    onGrupos: (g: GrupoDatos[]) => void;
    onInsertar: Insertar;
    onDetectar: () => void;
}) {
    const [pestana, setPestana] = useState<Pestana>('datos');
    const [sel, setSel] = useState('');
    const lista = useMemo(() => dePartes(partes), [partes]);
    const quien = lista.find((p) => p.id === sel) ?? lista[0] ?? null;

    function agregarParte(texto: string): string | null {
        const r = rolDesdeTexto(texto);
        if (!r) return 'Escribe el rol: vendedor, demandante, testigo…';
        if (RESERVADOS.has(r)) {
            return `«${r}» es un nombre reservado del sistema. Usa otro (poderdante, contratante, solicitante…).`;
        }
        if (!partes.includes(r)) onPartes([...partes, r]);
        setSel(r);
        return null;
    }

    async function quitarParte(p: Parte) {
        if (!(await confirmar(`¿Quitar la parte «${p.etiqueta}» del modelo? Lo que ya insertaste en el texto no cambia.`, 'Quitar parte'))) return;
        onPartes(partes.filter((x) => x !== p.id));
    }

    const items: { id: Pestana; etiqueta: string }[] = [
        { id: 'datos', etiqueta: `Datos${campos.length ? ` (${campos.length})` : ''}` },
        { id: 'partes', etiqueta: `Partes${partes.length ? ` (${partes.length})` : ''}` },
        { id: 'genero', etiqueta: 'Género' },
    ];

    return (
        <div className="pc">
            <div className="pc-cab">
                <h3>Campos del documento</h3>
                <div className="pc-tabs tres" role="tablist" aria-label="Constructor de campos">
                    {items.map((i) => (
                        <button key={i.id} type="button" role="tab" aria-selected={i.id === pestana}
                            className={`pc-tab${i.id === pestana ? ' activa' : ''}`}
                            onMouseDown={quieto} onClick={() => setPestana(i.id)}>
                            {i.etiqueta}
                        </button>
                    ))}
                </div>
            </div>

            <div className="pc-cuerpo">
                {pestana !== 'datos' && (
                    <Quien partes={lista} valor={quien} onCambiar={setSel} onAgregar={agregarParte}
                        onQuitar={(p) => void quitarParte(p)} />
                )}
                {pestana === 'datos' && (
                    <TabDatos campos={campos} onCampos={onCampos} onInsertar={onInsertar} onDetectar={onDetectar} />
                )}
                {pestana === 'partes' && (
                    <TabPartes grupos={grupos} quien={quien} ambito={ambito} onGrupos={onGrupos} onInsertar={onInsertar} />
                )}
                {pestana === 'genero' && <TabGenero quien={quien} onInsertar={onInsertar} />}
            </div>

            <div className="pc-pie">
                <p className="pc-ayuda">Clic: inserta en el cursor · Doble clic sobre un campo del texto: editarlo.</p>
            </div>
        </div>
    );
}