import { useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { tipoSugerido } from '../application/camposModelo';
import { ROL_PENDIENTE, mismoRol, rolDesdeTexto } from '../domain/catalogo';
import {
    armarFrase, datosDe, deCaso, marcadorDato, partirFrase, planCampos, planDatos,
    type DatoInsertable,
} from '../domain/camposParte';
import { formasConcordancia, type FormasConcordancia } from '../domain/concordancia';
import {
    TIPOS_CAMPO, type CampoPropio, type DatoParte, type GrupoDatos, type TipoCampo,
} from '../domain/fuenteModelo';
import { nuevoId } from '../domain/id';
import { matizDePersona } from '../domain/marcadores';
import { claveCampo, claveNormalizada, etiquetaRol, pluralRol } from '../domain/texto';
import { Campo, Icono, Segmentado, confirmar } from './comunes';

type Pestana = 'datos' | 'partes' | 'genero';
type Insertar = (texto: string, bloque: boolean) => void;
type Alcance = 'parte' | 'caso';
type Modo = null | 'agregar' | 'nombre' | { t: 'caso' | 'parte'; i: number };

const SIN_AMBITO: readonly string[] = [];
/** Nombres que el sistema ya usa para otra cosa. */
const RESERVADOS = new Set(['cliente', 'abogado', 'caso', 'expediente', 'hoy', 'partes', 'inmuebles', ROL_PENDIENTE]);

/** Evita que el botón le quite el foco (y el cursor) a la hoja. */
const quieto = (e: { preventDefault(): void }) => e.preventDefault();
const nombreTipo = (t: string) => TIPOS_CAMPO.find((x) => x.valor === t)?.etiqueta ?? t;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const esTexto = (t: TipoCampo) => t === 'texto' || t === 'texto_largo';
const edita = (m: Modo, t: 'caso' | 'parte', i: number) => typeof m === 'object' && m !== null && m.t === t && m.i === i;

const SUGERENCIAS_GRUPO = ['Generales de ley', 'Datos del inmueble', 'Precio y forma de pago', 'Datos del vehículo'];
const SUGERENCIAS_PARTE = ['vendedor', 'comprador', 'demandante', 'demandado', 'poderdante', 'apoderado', 'testigo'];
const PALABRAS_RAPIDAS = ['el', 'el señor', 'del', 'al', 'un', 'señor', 'domiciliado', 'portador', 'mayor de edad'];

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

/* ================= Piezas pequeñas ================= */
/** Así se ve el dato en el documento: azul = del caso, ámbar = de una parte sin asignar. */
function ChipDato({ caso, texto }: { caso: boolean; texto: string }) {
    return (
        <span className="mk" data-k={caso ? 'dato' : 'pendiente'}>
            <span className="mk-e">{texto}</span>
        </span>
    );
}

interface LineaPlan { nombre: string; estado: 'nuevo' | 'existe' | 'invalido'; texto: string }

function PlanVista({ plan }: { plan: LineaPlan[] }) {
    if (plan.length === 0) return null;
    return (
        <ul className="cb-plan">
            {plan.map((x, i) => (
                <li key={i} className={x.estado === 'nuevo' ? 'ok' : x.estado === 'existe' ? 'ya' : 'no'}>
                    <b>{x.nombre}</b>
                    <span>{x.texto}</span>
                </li>
            ))}
        </ul>
    );
}

function SelectTipo({ valor, onCambio }: { valor: TipoCampo; onCambio: (t: TipoCampo) => void }) {
    return (
        <select aria-label="Tipo de dato" value={valor} onChange={(e) => onCambio(e.target.value as TipoCampo)}>
            {TIPOS_CAMPO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
        </select>
    );
}

/* ================= Pestaña DATOS: crear grupo ================= */
function FormGrupo({ existentes, onCrear, onCancelar }: {
    existentes: string[]; onCrear: (nombre: string) => void; onCancelar?: () => void;
}) {
    const [nombre, setNombre] = useState('');
    const [error, setError] = useState<string | null>(null);
    const usados = new Set(existentes.map(claveNormalizada));
    const libres = SUGERENCIAS_GRUPO.filter((s) => !usados.has(claveNormalizada(s)));

    function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const n = nombre.trim();
        if (!n) {
            setError('Ponle un nombre al grupo, por ejemplo «Generales de ley».');
            return;
        }
        if (usados.has(claveNormalizada(n))) {
            setError('Ya tienes un grupo con ese nombre.');
            return;
        }
        onCrear(n);
    }

    return (
        <form className="cb-edicion" onSubmit={enviar}>
            <input aria-label="Nombre del grupo" autoFocus value={nombre}
                placeholder="Nombre del grupo: Generales de ley, Datos del inmueble, Precio…"
                onChange={(e) => { setNombre(e.target.value); setError(null); }} />
            {libres.length > 0 && (
                <div className="chips">
                    {libres.map((s) => (
                        <button key={s} type="button" className="chip" onClick={() => { setNombre(s); setError(null); }}>{s}</button>
                    ))}
                </div>
            )}
            <p className="pc-nota">
                Un grupo junta datos que van juntos. Después le agregas los datos: del caso (precio, plazo…) o de una parte
                (nombre, C.I., domicilio…).
            </p>
            {error && <p className="pc-error">{error}</p>}
            <div className="pc-acciones">
                <button type="submit" className="btn btn-pri btn-sm">Crear grupo</button>
                {onCancelar && <button type="button" className="btn btn-fan btn-sm" onClick={onCancelar}>Cancelar</button>}
            </div>
        </form>
    );
}

/* ================= Pestaña DATOS: agregar datos a un grupo ================= */
function FormDatos({ grupoId, campos, datosParte, onAgregar, onCancelar }: {
    grupoId: string;
    campos: CampoPropio[];
    datosParte: DatoParte[];
    onAgregar: (parte: DatoParte[], caso: CampoPropio[]) => void;
    onCancelar: () => void;
}) {
    const [alcance, setAlcance] = useState<Alcance>('parte');
    const [texto, setTexto] = useState('');
    const [tipo, setTipo] = useState<TipoCampo>('texto');
    const [manual, setManual] = useState(false);
    const [requerido, setRequerido] = useState(true);
    const [mayus, setMayus] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const etiquetasCaso = new Set(campos.map((c) => claveCampo(c.etiqueta || c.clave)));
    const etiquetasParte = datosParte.map((d) => claveCampo(d.etiqueta));
    const forzado = manual ? tipo : undefined;

    const planParte = alcance === 'parte'
        ? planDatos(texto, datosParte, tipoSugerido, { tipo: forzado, requerido, mayus }, etiquetasCaso)
        : [];
    const planCaso = alcance === 'caso'
        ? planCampos(
            texto,
            {
                etiquetas: new Set([...etiquetasCaso, ...etiquetasParte]),
                clavesCaso: new Set(campos.map((c) => claveCampo(c.clave))),
            },
            tipoSugerido,
            { tipo: forzado, requerido, grupo: grupoId },
        )
        : [];

    const nuevosParte = planParte.flatMap((x) => (x.estado === 'nuevo' && x.dato ? [x.dato] : []));
    const nuevosCaso = planCaso.flatMap((x) => (x.estado === 'nuevo' && x.campo ? [x.campo] : []));
    const total = nuevosParte.length + nuevosCaso.length;

    const lineas: LineaPlan[] = alcance === 'parte'
        ? planParte.map((x) => ({
            nombre: x.nombre,
            estado: x.estado,
            texto: x.estado === 'nuevo'
                ? (x.dato?.ficha ? '→ de la ficha de la persona' : `→ dato propio de la parte · ${nombreTipo(x.dato?.tipo ?? 'texto')}`)
                : `→ ${x.motivo}`,
        }))
        : planCaso.map((x) => ({
            nombre: x.nombre,
            estado: x.estado,
            texto: x.estado === 'nuevo' ? `→ dato del caso · ${nombreTipo(x.campo?.tipo ?? 'texto')}` : `→ ${x.motivo}`,
        }));

    const unico = lineas.length === 1 && total === 1;
    const sugerido = alcance === 'parte' ? nuevosParte[0] : nuevosCaso[0];
    const editaTipo = unico && !(alcance === 'parte' && nuevosParte[0]?.ficha);

    function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        if (total === 0) {
            setError('Escribe al menos un dato nuevo. Separa con comas para crear varios.');
            return;
        }
        onAgregar(nuevosParte, nuevosCaso);
    }

    return (
        <form className="cb-edicion" onSubmit={enviar}>
            <Segmentado<Alcance>
                valor={alcance}
                cambiar={(a) => { setAlcance(a); setManual(false); setError(null); }}
                opciones={[{ id: 'parte', etiqueta: 'De una parte' }, { id: 'caso', etiqueta: 'Del caso' }]}
            />
            <p className="pc-nota">
                {alcance === 'parte'
                    ? 'Dato de las personas (nombre, C.I., domicilio, lugar de nacimiento…). Al insertarlo queda en ámbar hasta que lo asignes a una parte.'
                    : 'Dato único del expediente (precio, plazo, lugar de firma…). Se llena una sola vez y no depende de ninguna parte.'}
            </p>
            <input aria-label="Nombre del dato" autoFocus value={texto}
                placeholder={alcance === 'parte'
                    ? 'Ej.: Nombre completo, C.I., Domicilio, Estado civil'
                    : 'Ej.: Precio, Plazo de entrega, Lugar de firma'}
                onChange={(e) => { setTexto(e.target.value); setError(null); }} />
            <PlanVista plan={lineas} />
            {editaTipo && (
                <SelectTipo valor={manual ? tipo : (sugerido?.tipo ?? 'texto')}
                    onCambio={(t) => { setTipo(t); setManual(true); }} />
            )}
            <div className="pc-acciones">
                <label className="casilla">
                    <input type="checkbox" checked={requerido} onChange={(e) => setRequerido(e.target.checked)} />
                    Obligatorio
                </label>
                {alcance === 'parte' && (
                    <label className="casilla">
                        <input type="checkbox" checked={mayus} onChange={(e) => setMayus(e.target.checked)} />
                        EN MAYÚSCULAS
                    </label>
                )}
            </div>
            {error && <p className="pc-error">{error}</p>}
            <div className="pc-acciones">
                <button type="submit" className="btn btn-pri btn-sm" disabled={total === 0}>
                    {total > 1 ? `Agregar ${total} datos` : 'Agregar'}
                </button>
                <button type="button" className="btn btn-fan btn-sm" onClick={onCancelar}>Cancelar</button>
            </div>
        </form>
    );
}

/* ================= Editar un dato ================= */
function EditarCaso({ c, grupos, ocupadas, onGuardar, onCancelar }: {
    c: CampoPropio; grupos: GrupoDatos[]; ocupadas: ReadonlySet<string>;
    onGuardar: (c: CampoPropio) => void; onCancelar: () => void;
}) {
    const [etiqueta, setEtiqueta] = useState(c.etiqueta);
    const [tipo, setTipo] = useState<TipoCampo>(c.tipo);
    const [requerido, setRequerido] = useState(c.requerido);
    const [grupo, setGrupo] = useState(c.grupo ?? '');
    const [error, setError] = useState<string | null>(null);

    function guardar() {
        const nombre = etiqueta.trim() || etiquetaRol(claveCampo(c.clave));
        if (ocupadas.has(claveCampo(nombre))) {
            setError('Ya hay otro dato con ese nombre.');
            return;
        }
        onGuardar({ ...c, etiqueta: nombre, tipo, requerido, grupo: grupo || undefined });
    }

    return (
        <div className="cb-edicion">
            <input aria-label="Nombre del dato" value={etiqueta} onChange={(e) => { setEtiqueta(e.target.value); setError(null); }} />
            <SelectTipo valor={tipo} onCambio={setTipo} />
            <select aria-label="Grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
                <option value="">(sin grupo)</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
            <label className="casilla">
                <input type="checkbox" checked={requerido} onChange={(e) => setRequerido(e.target.checked)} />
                Obligatorio
            </label>
            <p className="pc-nota">Clave interna: <code>caso.{c.clave}</code>. Lo que ya insertaste en el texto no cambia.</p>
            {error && <p className="pc-error">{error}</p>}
            <div className="pc-acciones">
                <button type="button" className="btn btn-pri btn-sm" onClick={guardar}>Guardar</button>
                <button type="button" className="btn btn-fan btn-sm" onClick={onCancelar}>Cancelar</button>
            </div>
        </div>
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
    const texto = esTexto(tipo);

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
            {!d.ficha && <SelectTipo valor={tipo} onCambio={setTipo} />}
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

/* ================= Fila de un dato ================= */
function FilaDato({ caso, etiqueta, meta, titulo, onInsertar, onEditar, onQuitar }: {
    caso: boolean; etiqueta: string; meta: string; titulo: string;
    onInsertar: () => void; onEditar: () => void; onQuitar: () => void;
}) {
    return (
        <div className="cb-fila">
            <button type="button" className="cb-insertar" title={titulo} onMouseDown={quieto} onClick={onInsertar}>
                <span className="cb-nombre"><ChipDato caso={caso} texto={etiqueta} /></span>
                <span className="cb-meta">{meta}</span>
            </button>
            <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Editar dato" onMouseDown={quieto}
                onClick={onEditar}><Icono n="editar" tam={15} /></button>
            <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar dato" onMouseDown={quieto}
                onClick={onQuitar}><Icono n="papelera" tam={15} /></button>
        </div>
    );
}

/* ================= Tarjeta de un grupo (g = null: datos sin grupo) ================= */
function TarjetaGrupo({ g, campos, grupos, prefijo, enBloque, onCampos, onGrupos, onInsertar }: {
    g: GrupoDatos | null;
    campos: CampoPropio[];
    grupos: GrupoDatos[];
    /** '' dentro del bloque de una parte; «sin_parte.» en cualquier otro lugar. */
    prefijo: string;
    enBloque: Parte | null;
    onCampos: (c: CampoPropio[]) => void;
    onGrupos: (g: GrupoDatos[]) => void;
    onInsertar: Insertar;
}) {
    const idsGrupos = new Set(grupos.map((x) => x.id));
    const propios = campos
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => (g ? c.grupo === g.id : !c.grupo || !idsGrupos.has(c.grupo)));
    const delGrupo: DatoParte[] = g?.datos ?? [];
    const total = propios.length + delGrupo.length;

    const [abierta, setAbierta] = useState(true);
    const [modo, setModo] = useState<Modo>(g && total === 0 ? 'agregar' : null);
    const [nombre, setNombre] = useState(g?.nombre ?? '');

    /** Etiquetas de TODOS los datos menos el que se edita (un nombre no se repite). */
    const etiquetasSin = (excepto: object) => new Set([
        ...campos.filter((x) => x !== excepto).map((x) => claveCampo(x.etiqueta || x.clave)),
        ...datosDe(grupos).filter((x) => x !== excepto).map((x) => claveCampo(x.etiqueta)),
    ]);

    const cambiarDatos = (datos: DatoParte[]) => {
        if (g) onGrupos(grupos.map((x) => (x.id === g.id ? { ...x, datos } : x)));
    };

    function guardarNombre() {
        const n = nombre.trim();
        if (g && n) onGrupos(grupos.map((x) => (x.id === g.id ? { ...x, nombre: n } : x)));
        else setNombre(g?.nombre ?? '');
        setModo(null);
    }

    async function quitar() {
        if (!g) return;
        if (total > 0 && !(await confirmar(
            `¿Quitar el grupo «${g.nombre}» con sus ${plural(total, 'dato', 'datos')}? Lo que ya insertaste en el texto no cambia.`,
            'Quitar grupo',
        ))) return;
        onGrupos(grupos.filter((x) => x.id !== g.id));
        onCampos(campos.filter((c) => c.grupo !== g.id));
    }

    const tituloParte = enBloque
        ? `Se inserta para cada ${enBloque.etiqueta.toLowerCase()} (el cursor está dentro de su bloque)`
        : 'Se inserta en ámbar (sin asignar). Luego clic derecho sobre él → Asignar a…';

    return (
        <div className="cb-tarjeta">
            <div className="cb-tarjeta-cab">
                {modo === 'nombre' && g ? (
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
                            <b>{g ? g.nombre : 'Sin grupo'}</b>
                            <span className="suave">{plural(total, 'dato', 'datos')}</span>
                        </button>
                        {g && (
                            <>
                                <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Renombrar grupo" onMouseDown={quieto}
                                    onClick={() => { setNombre(g.nombre); setModo('nombre'); }}><Icono n="editar" tam={15} /></button>
                                <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar grupo" onMouseDown={quieto}
                                    onClick={() => void quitar()}><Icono n="papelera" tam={15} /></button>
                            </>
                        )}
                    </>
                )}
            </div>

            {abierta && (
                <>
                    {!g && <p className="pc-nota">Datos que no están en ningún grupo. Edítalos para asignarles uno.</p>}
                    {g && total === 0 && modo !== 'agregar' && (
                        <p className="pc-ayuda">Grupo vacío. Agrega los datos que necesitas.</p>
                    )}

                    {propios.map(({ c, i }) => (edita(modo, 'caso', i) ? (
                        <EditarCaso key={`c${i}`} c={c} grupos={grupos} ocupadas={etiquetasSin(c)}
                            onCancelar={() => setModo(null)}
                            onGuardar={(nuevo) => { onCampos(campos.map((x, k) => (k === i ? nuevo : x))); setModo(null); }} />
                    ) : (
                        <FilaDato key={`c${i}`} caso
                            etiqueta={c.etiqueta || etiquetaRol(claveCampo(c.clave))}
                            meta={`Del caso · ${nombreTipo(c.tipo)}${c.requerido ? '' : ' · opcional'}`}
                            titulo="Dato del caso: se llena una sola vez en el expediente"
                            onInsertar={() => onInsertar(marcadorDato(deCaso(c), ''), false)}
                            onEditar={() => setModo({ t: 'caso', i })}
                            onQuitar={() => onCampos(campos.filter((_, k) => k !== i))} />
                    )))}

                    {delGrupo.map((d, i) => (edita(modo, 'parte', i) ? (
                        <EditarDatoParte key={`p${i}`} d={d} ocupadas={etiquetasSin(d)}
                            onCancelar={() => setModo(null)}
                            onGuardar={(nuevo) => { cambiarDatos(delGrupo.map((x, k) => (k === i ? nuevo : x))); setModo(null); }} />
                    ) : (
                        <FilaDato key={`p${i}`} caso={false}
                            etiqueta={d.etiqueta}
                            meta={`De una parte · ${d.ficha ? 'ficha de la persona' : `dato propio · ${nombreTipo(d.tipo)}`}${d.mayus ? ' · MAYÚSCULAS' : ''}${d.requerido ? '' : ' · opcional'}`}
                            titulo={tituloParte}
                            onInsertar={() => onInsertar(marcadorDato(d, prefijo), false)}
                            onEditar={() => setModo({ t: 'parte', i })}
                            onQuitar={() => cambiarDatos(delGrupo.filter((_, k) => k !== i))} />
                    )))}

                    {g && (modo === 'agregar' ? (
                        <FormDatos grupoId={g.id} campos={campos} datosParte={datosDe(grupos)}
                            onCancelar={() => setModo(null)}
                            onAgregar={(parte, caso) => {
                                if (parte.length > 0) cambiarDatos([...g.datos, ...parte]);
                                if (caso.length > 0) onCampos([...campos, ...caso]);
                                setModo(null);
                            }} />
                    ) : (
                        <div className="pc-acciones">
                            <button type="button" className="btn btn-sec btn-sm" onClick={() => setModo('agregar')}>
                                <Icono n="mas" tam={14} /> Dato
                            </button>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

/* ================= Redactar un párrafo mezclando texto y datos ================= */
function Redactor({ datos, partes, enBloque, onInsertar, onListo }: {
    datos: DatoInsertable[]; partes: Parte[]; enBloque: Parte | null; onInsertar: Insertar; onListo: () => void;
}) {
    const [texto, setTexto] = useState('');
    const [destino, setDestino] = useState('');
    const area = useRef<HTMLTextAreaElement>(null);
    const piezas = useMemo(() => partirFrase(texto, datos), [texto, datos]);
    const desconocidos = piezas.flatMap((x) => (x.t === 'falta' ? [x.v] : []));
    const vacio = texto.trim() === '';
    const [modo, rolId] = destino.split(':');
    const parte = partes.find((p) => p.id === rolId) ?? null;
    const ejemplo = datos.length > 0
        ? datos.slice(0, 3).map((c) => `{${c.etiqueta}}`).join(', tu texto aquí ')
        : 'Primero crea los datos en un grupo';

    function poner(c: DatoInsertable) {
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
        let prefijo = `${ROL_PENDIENTE}.`;
        let envolver: Parte | null = null;
        if (enBloque) prefijo = '';
        else if (modo === 'cada' && parte) {
            prefijo = '';
            envolver = parte;
        } else if (modo === 'uno' && parte) prefijo = `${parte.id}.`;

        const { texto: t, faltan } = armarFrase(texto.trim(), datos, prefijo);
        if (faltan.length > 0 || t.trim() === '') return;
        if (envolver) onInsertar(`{{#${envolver.plural}}}\n${t}\n{{/${envolver.plural}}}`, true);
        else onInsertar(t, t.includes('\n'));
        setTexto('');
        onListo();
    }

    return (
        <div className="cb-edicion">
            <span className="cb-sub">Párrafo: escribe y toca los datos para meterlos en el texto</span>
            <textarea ref={area} aria-label="Párrafo" value={texto} placeholder={ejemplo}
                onChange={(e) => setTexto(e.target.value)} />
            {datos.length > 0 && (
                <div className="chips">
                    {datos.map((c, i) => (
                        <button key={i} type="button" className={`chip ${c.caso ? 'chip-caso' : 'chip-parte'}`}
                            title={c.caso ? 'Dato del caso' : 'Dato de una parte'} onMouseDown={quieto} onClick={() => poner(c)}>
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
                            ? <ChipDato key={i} caso={!!x.campo.caso} texto={x.campo.etiqueta} />
                            : <span key={i} className="mk-falta">{`{${x.v}}`}</span>))}
            </div>
            {desconocidos.length > 0 && (
                <p className="pc-error">No existe el dato: {desconocidos.map((d) => `{${d}}`).join(', ')}. Créalo o corrige el nombre.</p>
            )}

            {enBloque ? (
                <p className="pc-nota">
                    El cursor está dentro del bloque «cada {enBloque.etiqueta.toLowerCase()}»: se inserta una vez y el bloque la repite por persona.
                </p>
            ) : (
                <Campo etiqueta="¿De quién se habla?" ayuda="Puedes dejarlo sin asignar y hacerlo después con clic derecho.">
                    <select value={destino} onChange={(e) => setDestino(e.target.value)}>
                        <option value="">Asignar después (clic derecho)</option>
                        {partes.map((p) => (
                            <option key={`c${p.id}`} value={`cada:${p.id}`}>Repetir por cada {p.etiqueta.toLowerCase()}</option>
                        ))}
                        {partes.filter((p) => p.id !== p.plural).map((p) => (
                            <option key={`u${p.id}`} value={`uno:${p.id}`}>Solo el primer {p.etiqueta.toLowerCase()}</option>
                        ))}
                    </select>
                </Campo>
            )}
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

/* ================= Pestaña DATOS ================= */
function TabDatos({ campos, grupos, partes, ambito, onCampos, onGrupos, onInsertar, onDetectar }: {
    campos: CampoPropio[];
    grupos: GrupoDatos[];
    partes: Parte[];
    ambito: readonly string[];
    onCampos: (c: CampoPropio[]) => void;
    onGrupos: (g: GrupoDatos[]) => void;
    onInsertar: Insertar;
    onDetectar: () => void;
}) {
    const [creando, setCreando] = useState(false);
    const [redactando, setRedactando] = useState(false);

    /** Parte cuyo bloque «{{#…}}» contiene el cursor (los datos de parte se insertan sin prefijo). */
    const enBloque = useMemo(() => {
        for (let i = ambito.length - 1; i >= 0; i--) {
            const p = partes.find((x) => mismoRol(x.id, ambito[i]));
            if (p) return p;
        }
        return null;
    }, [ambito, partes]);
    const prefijo = enBloque ? '' : `${ROL_PENDIENTE}.`;
    const insertables = useMemo<DatoInsertable[]>(() => [...datosDe(grupos), ...campos.map(deCaso)], [grupos, campos]);
    const idsGrupos = new Set(grupos.map((g) => g.id));
    const hayLibres = campos.some((c) => !c.grupo || !idsGrupos.has(c.grupo));

    return (
        <>
            <p className="pc-ayuda">
                Arma aquí tus grupos de datos (Generales de ley, Datos del inmueble, Precio…). Cada dato es <b>del caso</b> (se llena
                una vez) o <b>de una parte</b> (queda en <span className="pc-ambar">ámbar</span> hasta que lo asignes a una parte).
            </p>

            <div className="cb-cab-seccion">
                <span>Grupos de datos</span>
                <div className="pc-acciones" style={{ margin: 0 }}>
                    <button type="button" className="btn btn-sec btn-sm" onClick={() => setCreando((v) => !v)}>
                        <Icono n="mas" tam={14} /> Grupo
                    </button>
                    <button type="button" className="btn btn-sec btn-sm" disabled={insertables.length === 0}
                        title="Escribe un párrafo mezclando texto y datos" onClick={() => setRedactando((v) => !v)}>
                        Redactar párrafo
                    </button>
                    <button type="button" className="btn btn-fan btn-sm" onMouseDown={quieto} onClick={onDetectar}
                        title="Busca en el texto los {{caso.…}}, datos de partes y roles que escribiste a mano">
                        Detectar
                    </button>
                </div>
            </div>

            {enBloque && (
                <p className="pc-nota">
                    El cursor está dentro del bloque «cada {enBloque.etiqueta.toLowerCase()}»: los datos de parte se insertan
                    sin asignar nada (cada persona del bloque).
                </p>
            )}

            {redactando && (
                <Redactor datos={insertables} partes={partes} enBloque={enBloque} onInsertar={onInsertar}
                    onListo={() => setRedactando(false)} />
            )}

            {(creando || grupos.length === 0) && (
                <FormGrupo existentes={grupos.map((g) => g.nombre)}
                    onCrear={(nombre) => { onGrupos([...grupos, { id: nuevoId(), nombre, datos: [] }]); setCreando(false); }}
                    onCancelar={grupos.length > 0 ? () => setCreando(false) : undefined} />
            )}

            {grupos.map((g) => (
                <TarjetaGrupo key={g.id} g={g} campos={campos} grupos={grupos} prefijo={prefijo} enBloque={enBloque}
                    onCampos={onCampos} onGrupos={onGrupos} onInsertar={onInsertar} />
            ))}
            {hayLibres && (
                <TarjetaGrupo g={null} campos={campos} grupos={grupos} prefijo={prefijo} enBloque={enBloque}
                    onCampos={onCampos} onGrupos={onGrupos} onInsertar={onInsertar} />
            )}
        </>
    );
}

/* ================= Pestaña PARTES ================= */
function TabPartes({ lista, pendientes, onAgregar, onQuitar, onAsignarPendientes, onInsertar }: {
    lista: Parte[];
    pendientes: number;
    /** Devuelve un mensaje de error, o null si se agregó. */
    onAgregar: (rol: string) => string | null;
    onQuitar: (p: Parte) => void;
    onAsignarPendientes: (rol: string) => void;
    onInsertar: Insertar;
}) {
    const [rol, setRol] = useState('');
    const [error, setError] = useState<string | null>(null);
    const libres = SUGERENCIAS_PARTE.filter((s) => !lista.some((p) => mismoRol(p.id, s)));

    function agregar(texto: string) {
        const e = onAgregar(texto);
        if (e) {
            setError(e);
            return;
        }
        setRol('');
        setError(null);
    }

    return (
        <>
            <p className="pc-ayuda">
                Crea las partes que intervienen (vendedor, comprador, demandante…). Después asigna los datos ámbar del documento:
                clic derecho sobre cada uno, o todos juntos con el botón de cada parte.
            </p>

            <form className="cb-edicion" onSubmit={(ev) => { ev.preventDefault(); agregar(rol); }}>
                <div className="cb-fila-form">
                    <input aria-label="Rol de la parte" placeholder="Rol: vendedor, demandante, testigo…" value={rol}
                        onChange={(e) => { setRol(e.target.value); setError(null); }} />
                    <button type="submit" className="btn btn-pri btn-sm">Agregar</button>
                </div>
                {libres.length > 0 && (
                    <div className="chips">
                        {libres.map((s) => (
                            <button key={s} type="button" className="chip" onClick={() => agregar(s)}>+ {s}</button>
                        ))}
                    </div>
                )}
                {error && <p className="pc-error">{error}</p>}
            </form>

            {lista.length === 0 && <p className="pc-ayuda">Aún no creaste ninguna parte.</p>}

            {lista.map((p) => (
                <div key={p.id} className="cb-tarjeta">
                    <div className="cb-tarjeta-cab">
                        <i className="cb-punto" style={{ '--h': p.matiz } as CSSProperties} />
                        <b>{p.etiqueta}</b>
                        <span className="suave">varios: {p.plural}</span>
                        <span className="espacio" />
                        <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar parte" title="Quitar esta parte"
                            onMouseDown={quieto} onClick={() => onQuitar(p)}><Icono n="papelera" tam={15} /></button>
                    </div>
                    <div className="pc-acciones">
                        <button type="button" className="btn btn-sec btn-sm" disabled={pendientes === 0} onMouseDown={quieto}
                            title="Asigna a esta parte todos los datos en ámbar del documento"
                            onClick={() => onAsignarPendientes(p.id)}>
                            Asignarle los pendientes ({pendientes})
                        </button>
                        <button type="button" className="btn btn-sec btn-sm" onMouseDown={quieto}
                            title="Un bloque que repite su contenido por cada persona con este rol"
                            onClick={() => onInsertar(`{{#${p.plural}}}\n…\n{{/${p.plural}}}`, true)}>
                            Bloque «cada {p.etiqueta.toLowerCase()}»
                        </button>
                    </div>
                </div>
            ))}

            <p className="pc-nota">
                Tip: selecciona varios datos del documento, clic derecho sobre uno de ellos y asígnalos todos de una vez.
            </p>
        </>
    );
}

/* ================= Pestaña GÉNERO ================= */
function TabGenero({ lista, quien, onSel, onInsertar }: {
    lista: Parte[]; quien: Parte | null; onSel: (id: string) => void; onInsertar: Insertar;
}) {
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
        return <p className="pc-ayuda">Primero crea una parte en la pestaña «Partes»: el género se calcula con las personas de esa parte.</p>;
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
                <Campo etiqueta="¿De quién se habla?">
                    <select value={quien.id} onChange={(e) => onSel(e.target.value)}>
                        {lista.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
                    </select>
                </Campo>
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
export function PanelCampos({
    campos, partes, grupos, ambito = SIN_AMBITO, pendientes = 0,
    onCampos, onPartes, onGrupos, onInsertar, onDetectar, onAsignarPendientes,
}: {
    campos: CampoPropio[];
    partes: string[];
    grupos: GrupoDatos[];
    /** Bloques «{{#…}}» abiertos donde está el cursor del editor. */
    ambito?: readonly string[];
    /** Datos de parte insertados que aún no se asignaron (en ámbar). */
    pendientes?: number;
    onCampos: (c: CampoPropio[]) => void;
    onPartes: (p: string[]) => void;
    onGrupos: (g: GrupoDatos[]) => void;
    onInsertar: Insertar;
    onDetectar: () => void;
    onAsignarPendientes?: (rol: string) => void;
}) {
    const [pestana, setPestana] = useState<Pestana>('datos');
    const [sel, setSel] = useState('');
    const lista = useMemo(() => dePartes(partes), [partes]);
    const quien = lista.find((p) => p.id === sel) ?? lista[0] ?? null;
    const nDatos = campos.length + datosDe(grupos).length;

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
        { id: 'datos', etiqueta: `Datos${nDatos ? ` (${nDatos})` : ''}` },
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
                {pendientes > 0 && (
                    <div className="pc-pendientes">
                        <b>{plural(pendientes, 'dato sin asignar', 'datos sin asignar')} (en ámbar)</b>
                        <span>
                            Clic derecho sobre un dato ámbar del documento → «Asignar a…». También puedes seleccionar un párrafo
                            y asignar todos sus datos juntos.
                        </span>
                        {pestana !== 'partes' && (
                            <div>
                                <button type="button" className="btn btn-sec btn-sm" onClick={() => setPestana('partes')}>Ir a Partes</button>
                            </div>
                        )}
                    </div>
                )}

                {pestana === 'datos' && (
                    <TabDatos campos={campos} grupos={grupos} partes={lista} ambito={ambito}
                        onCampos={onCampos} onGrupos={onGrupos} onInsertar={onInsertar} onDetectar={onDetectar} />
                )}
                {pestana === 'partes' && (
                    <TabPartes lista={lista} pendientes={pendientes} onAgregar={agregarParte}
                        onQuitar={(p) => void quitarParte(p)}
                        onAsignarPendientes={(r) => onAsignarPendientes?.(r)} onInsertar={onInsertar} />
                )}
                {pestana === 'genero' && <TabGenero lista={lista} quien={quien} onSel={setSel} onInsertar={onInsertar} />}
            </div>

            <div className="pc-pie">
                <p className="pc-ayuda">
                    Clic: inserta en el cursor · Clic derecho en un dato ámbar: asignarlo a una parte · Doble clic en un campo: editarlo.
                </p>
            </div>
        </div>
    );
}