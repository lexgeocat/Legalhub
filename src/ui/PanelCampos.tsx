import { useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { tipoSugerido } from '../application/camposModelo';
import { DATOS_FICHA, mismoRol, rolDesdeTexto } from '../domain/catalogo';
import { armarFrase, marcadorCampoParte, partirFrase, planCampos } from '../domain/camposParte';
import { formasConcordancia, type FormasConcordancia } from '../domain/concordancia';
import { TIPOS_CAMPO, marcadorDeCampo, type CampoParte, type CampoPropio, type TipoCampo } from '../domain/fuenteModelo';
import { matizDePersona } from '../domain/marcadores';
import { claveCampo, etiquetaRol, pluralRol } from '../domain/texto';
import { Campo, Icono, Segmentado, confirmar } from './comunes';

type Pestana = 'datos' | 'partes' | 'genero';
type Insertar = (texto: string, bloque: boolean) => void;
type Modo = 'cada' | 'una';
type ModoTarjeta = null | 'crear' | 'redactar' | number;

const SIN_AMBITO: readonly string[] = [];

/** Evita que el botón le quite el foco (y el cursor) a la hoja. */
const quieto = (e: { preventDefault(): void }) => e.preventDefault();
const nombreTipo = (t: string) => TIPOS_CAMPO.find((x) => x.valor === t)?.etiqueta ?? t;

/* ---------------- Personas disponibles ---------------- */
interface Persona {
    id: string;
    etiqueta: string;
    /** Expresión para «todas las personas con este rol» (vendedores) o la única (cliente). */
    plural: string;
    /** Expresión para «la primera persona» (vendedor). También es la clave del rol en los campos. */
    singular: string;
    varias: boolean;
    fija: boolean;
}

const CLIENTE: Persona = { id: '@cliente', etiqueta: 'Cliente', plural: 'cliente', singular: 'cliente', varias: false, fija: true };
const ABOGADO: Persona = { id: '@abogado', etiqueta: 'Abogado (yo)', plural: 'abogado', singular: 'abogado', varias: false, fija: true };
const dePersona = (rol: string): Persona => ({
    id: rol, etiqueta: etiquetaRol(rol), plural: pluralRol(rol), singular: rol, varias: true, fija: false,
});

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

/* ================= Pestaña PARTES ================= */
function FormCrearCampo({ p, existentes, onCrear, onCancelar }: {
    p: Persona; existentes: CampoParte[]; onCrear: (l: CampoParte[]) => void; onCancelar: () => void;
}) {
    const [texto, setTexto] = useState('');
    const [tipo, setTipo] = useState<TipoCampo>('texto');
    const [manual, setManual] = useState(false);
    const [requerido, setRequerido] = useState(true);
    const [mayus, setMayus] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const plan = planCampos(texto, p.singular, existentes, !p.fija, tipoSugerido, {
        tipo: manual ? tipo : undefined, requerido, mayus,
    });
    const listos = plan.flatMap((x) => (x.estado === 'nuevo' && x.campo ? [x.campo] : []));
    const propio = plan.length === 1 && listos[0] && !listos[0].ficha ? listos[0] : null;
    const sugerencias = DATOS_FICHA.filter((d) => !d.exclusivo || d.exclusivo === p.singular);

    function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        if (listos.length === 0) {
            setError('Escribe al menos un campo nuevo. Separa con comas para crear varios.');
            return;
        }
        onCrear(listos);
    }

    return (
        <form className="cb-edicion" onSubmit={enviar}>
            <input aria-label="Nombre del campo" list={`fichas-${p.singular}`} autoFocus
                placeholder="Ej.: Nombre, C.I., Domicilio, Lugar de nacimiento"
                value={texto} onChange={(e) => { setTexto(e.target.value); setError(null); }} />
            <datalist id={`fichas-${p.singular}`}>{sugerencias.map((d) => <option key={d.clave} value={d.etiqueta} />)}</datalist>
            <p className="pc-nota">
                {p.fija
                    ? 'Se toman de la ficha de la persona (Configuración, para el abogado). Separa con comas para crear varios.'
                    : 'Si el nombre coincide con la ficha de la persona (nombre, C.I., domicilio…) se toma de ahí; si no, es un dato nuevo que llenas en el expediente. Separa con comas para crear varios.'}
            </p>

            {plan.length > 0 && (
                <ul className="cb-plan">
                    {plan.map((x, i) => (
                        <li key={i} className={x.estado === 'nuevo' ? 'ok' : x.estado === 'existe' ? 'ya' : 'no'}>
                            <b>{x.nombre}</b>
                            <span>
                                {x.estado === 'nuevo'
                                    ? (x.campo?.ficha ? '→ de la ficha de la persona' : `→ dato nuevo · ${nombreTipo(x.campo?.tipo ?? 'texto')}`)
                                    : `→ ${x.motivo}`}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

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
                    {listos.length === 1 ? 'Crear e insertar' : `Crear ${listos.length || ''} campos`.trim()}
                </button>
                <button type="button" className="btn btn-fan btn-sm" onClick={onCancelar}>Cancelar</button>
            </div>
        </form>
    );
}

function EditarCampoParte({ c, ocupadas, onGuardar, onCancelar }: {
    c: CampoParte; ocupadas: ReadonlySet<string>; onGuardar: (c: CampoParte) => void; onCancelar: () => void;
}) {
    const [etiqueta, setEtiqueta] = useState(c.etiqueta);
    const [tipo, setTipo] = useState<TipoCampo>(c.tipo);
    const [requerido, setRequerido] = useState(c.requerido);
    const [mayus, setMayus] = useState(!!c.mayus);
    const [error, setError] = useState<string | null>(null);
    const texto = tipo === 'texto' || tipo === 'texto_largo';

    function guardar() {
        const nombre = etiqueta.trim() || c.etiqueta;
        if (ocupadas.has(claveCampo(nombre))) {
            setError('Ya hay otro campo con ese nombre en esta parte.');
            return;
        }
        onGuardar({ ...c, etiqueta: nombre, tipo, requerido, mayus: texto && mayus ? true : undefined });
    }

    return (
        <div className="cb-edicion">
            <input aria-label="Nombre del campo" value={etiqueta} onChange={(e) => { setEtiqueta(e.target.value); setError(null); }} />
            {!c.ficha && (
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
                {c.ficha
                    ? 'Se toma de la ficha de la persona.'
                    : <>Dato propio (<code>datos.{c.clave}</code>): se llena en el expediente, pestaña Partes → Datos.</>}
            </p>
            {error && <p className="pc-error">{error}</p>}
            <div className="pc-acciones">
                <button type="button" className="btn btn-pri btn-sm" onClick={guardar}>Guardar</button>
                <button type="button" className="btn btn-fan btn-sm" onClick={onCancelar}>Cancelar</button>
            </div>
        </div>
    );
}

function Redactor({ p, matiz, campos, dentro, onInsertar, onListo }: {
    p: Persona; matiz: number; campos: CampoParte[]; dentro: boolean; onInsertar: Insertar; onListo: () => void;
}) {
    const [texto, setTexto] = useState('');
    const [modo, setModo] = useState<Modo>('cada');
    const area = useRef<HTMLTextAreaElement>(null);
    const puedeUna = !p.varias || p.singular !== p.plural;
    const repetir = !dentro && p.varias && (modo === 'cada' || !puedeUna);
    const prefijo = dentro || repetir ? '' : `${p.singular}.`;
    const piezas = useMemo(() => partirFrase(texto, campos), [texto, campos]);
    const desconocidos = piezas.flatMap((x) => (x.t === 'falta' ? [x.v] : []));
    const vacio = texto.trim() === '';
    const ejemplo = campos.length > 0
        ? campos.slice(0, 3).map((c) => `{${c.etiqueta}}`).join(', tu texto aquí ')
        : 'Primero crea los campos con «Crear campo»';

    function poner(c: CampoParte) {
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
        const { texto: t, faltan } = armarFrase(texto.trim(), campos, prefijo);
        if (faltan.length > 0 || t.trim() === '') return;
        const lineas = t.split('\n');
        if (repetir) onInsertar(`{{#${p.plural}}}\n${t}\n{{/${p.plural}}}`, true);
        else onInsertar(t, lineas.length > 1);
        setTexto('');
        onListo();
    }

    return (
        <div className="cb-edicion">
            <span className="cb-sub">Escribe el párrafo y toca los campos</span>
            <textarea ref={area} aria-label="Párrafo" value={texto} placeholder={ejemplo}
                onChange={(e) => setTexto(e.target.value)} />
            {campos.length > 0 && (
                <div className="chips">
                    {campos.map((c, i) => (
                        <button key={i} type="button" className="chip" title="Insertar este campo en el texto"
                            onMouseDown={quieto} onClick={() => poner(c)}>
                            + {c.etiqueta}
                        </button>
                    ))}
                </div>
            )}

            <span className="cb-sub">Así se verá</span>
            <div className="cb-redaccion">
                {vacio
                    ? <span className="suave">Aquí aparece tu párrafo con los campos como etiquetas.</span>
                    : piezas.map((x, i) => (x.t === 'txt'
                        ? <span key={i}>{x.v}</span>
                        : x.t === 'campo'
                            ? <span key={i} className="mk" data-k="persona" style={{ '--h': matiz } as CSSProperties}><span className="mk-e">{x.campo.etiqueta}</span></span>
                            : <span key={i} className="mk-falta">{`{${x.v}}`}</span>))}
            </div>
            {desconocidos.length > 0 && (
                <p className="pc-error">No existe el campo: {desconocidos.map((d) => `{${d}}`).join(', ')}. Créalo o corrige el nombre.</p>
            )}

            {dentro ? (
                <p className="pc-nota">
                    El cursor está dentro del bloque «cada {p.singular.replace(/_/g, ' ')}»: se inserta una vez, y el bloque
                    ya la repite por persona.
                </p>
            ) : p.varias && puedeUna ? (
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

function TarjetaPersona({ p, matiz, campos, dentro, autoAbrir, onCampos, quitar, onInsertar, irAGenero }: {
    p: Persona; matiz: number; campos: CampoParte[]; dentro: boolean; autoAbrir: boolean;
    onCampos: (lista: CampoParte[]) => void; quitar?: () => void; onInsertar: Insertar; irAGenero: () => void;
}) {
    const [modo, setModo] = useState<ModoTarjeta>(autoAbrir ? 'crear' : null);
    const prefijo = dentro ? '' : `${p.singular}.`;
    const alternar = (m: 'crear' | 'redactar') => setModo((a) => (a === m ? null : m));

    function crear(nuevos: CampoParte[]) {
        onCampos([...campos, ...nuevos]);
        if (nuevos.length === 1) onInsertar(marcadorCampoParte(nuevos[0], prefijo), false);
        setModo(null);
    }

    return (
        <div className="cb-tarjeta">
            <div className="cb-tarjeta-cab">
                <i className="cb-punto" style={{ '--h': matiz } as CSSProperties} />
                <b>{p.etiqueta}</b>
                <span className="suave">
                    {p.varias ? 'una o varias personas' : p.id === CLIENTE.id ? 'quien contrata tus servicios' : 'tus datos (Configuración)'}
                </span>
                <span className="espacio" />
                {quitar && (
                    <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar parte" onMouseDown={quieto}
                        onClick={quitar}><Icono n="papelera" tam={15} /></button>
                )}
            </div>

            {dentro && (
                <p className="pc-nota">El cursor está dentro del bloque «cada {p.singular.replace(/_/g, ' ')}»: los campos se insertan sin prefijo (cada persona).</p>
            )}
            {campos.length === 0 && modo !== 'crear' && (
                <p className="pc-ayuda">Aún no hay campos. Toca «Crear campo» y escribe, por ejemplo: Nombre, C.I., Domicilio.</p>
            )}

            {campos.map((c, i) => modo === i ? (
                <EditarCampoParte key={i} c={c}
                    ocupadas={new Set(campos.filter((_, k) => k !== i).map((x) => claveCampo(x.etiqueta)))}
                    onCancelar={() => setModo(null)}
                    onGuardar={(nuevo) => { onCampos(campos.map((x, k) => (k === i ? nuevo : x))); setModo(null); }} />
            ) : (
                <div key={i} className="cb-fila">
                    <button type="button" className="cb-insertar" title="Insertar en el cursor" onMouseDown={quieto}
                        onClick={() => onInsertar(marcadorCampoParte(c, prefijo), false)}>
                        <span className="cb-nombre">{c.etiqueta}</span>
                        <span className="cb-meta">
                            {c.ficha ? 'Ficha de la persona' : `Dato propio · ${nombreTipo(c.tipo)}`}
                            {c.mayus ? ' · MAYÚSCULAS' : ''}{c.requerido ? '' : ' · opcional'}
                        </span>
                    </button>
                    <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Editar campo" onMouseDown={quieto}
                        onClick={() => setModo(i)}><Icono n="editar" tam={15} /></button>
                    <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar campo" onMouseDown={quieto}
                        onClick={() => onCampos(campos.filter((_, k) => k !== i))}><Icono n="papelera" tam={15} /></button>
                </div>
            ))}

            {modo === 'crear' && <FormCrearCampo p={p} existentes={campos} onCrear={crear} onCancelar={() => setModo(null)} />}
            {modo === 'redactar' && (
                <Redactor p={p} matiz={matiz} campos={campos} dentro={dentro} onInsertar={onInsertar} onListo={() => setModo(null)} />
            )}

            <div className="pc-acciones">
                <button type="button" className="btn btn-sec btn-sm" onClick={() => alternar('crear')}>
                    <Icono n="mas" tam={14} /> Crear campo
                </button>
                <button type="button" className="btn btn-sec btn-sm" onClick={() => alternar('redactar')}>Redactar párrafo</button>
                <button type="button" className="btn btn-sec btn-sm" onClick={irAGenero}>Género…</button>
            </div>
        </div>
    );
}

function TabPartes({ partes, personas, camposPartes, ambito, onPartes, onCamposPartes, onInsertar, irAGenero }: {
    partes: string[]; personas: Persona[]; camposPartes: CampoParte[]; ambito: readonly string[];
    onPartes: (p: string[]) => void; onCamposPartes: (c: CampoParte[]) => void;
    onInsertar: Insertar; irAGenero: (id: string) => void;
}) {
    const [nuevo, setNuevo] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [foco, setFoco] = useState<string | null>(null);

    function agregar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const r = rolDesdeTexto(nuevo);
        if (!r) {
            setError('Escribe el rol: vendedor, demandante, testigo…');
            return;
        }
        if (r === 'cliente' || r === 'abogado') {
            setError('«Cliente» y «Abogado» ya están disponibles abajo.');
            return;
        }
        if (!partes.includes(r)) onPartes([...partes, r]);
        setNuevo('');
        setError(null);
        setFoco(r);
    }

    async function quitar(p: Persona) {
        const mios = camposPartes.filter((c) => c.rol === p.singular);
        if (mios.length > 0 && !(await confirmar(
            `Se quitarán también los ${mios.length} campo(s) de «${p.etiqueta}». Lo que ya insertaste en el texto no cambia. ¿Continuar?`,
            'Quitar parte',
        ))) return;
        onPartes(partes.filter((x) => x !== p.id));
        if (mios.length > 0) onCamposPartes(camposPartes.filter((c) => c.rol !== p.singular));
    }

    return (
        <>
            <p className="pc-ayuda">
                Crea cada rol con el nombre que uses (vendedor, comodante, testigo…). En cada parte creas tus campos
                y redactas el párrafo mezclando texto y campos.
            </p>
            <form className="cb-form" onSubmit={agregar}>
                <div className="cb-fila-form">
                    <input aria-label="Rol de la parte" placeholder="Rol: vendedor, demandante…"
                        value={nuevo} onChange={(e) => { setNuevo(e.target.value); setError(null); }} />
                    <button type="submit" className="btn btn-pri btn-sm">Agregar</button>
                </div>
                {error && <p className="pc-error">{error}</p>}
            </form>

            {personas.map((p) => (
                <TarjetaPersona key={p.id} p={p} matiz={matizDePersona(p.id, partes)}
                    campos={camposPartes.filter((c) => c.rol === p.singular)}
                    dentro={p.varias && ambito.some((a) => mismoRol(a, p.singular))}
                    autoAbrir={foco === p.id}
                    onCampos={(lista) => onCamposPartes([...camposPartes.filter((c) => c.rol !== p.singular), ...lista])}
                    quitar={p.fija ? undefined : () => void quitar(p)}
                    onInsertar={onInsertar} irAGenero={() => irAGenero(p.id)} />
            ))}
        </>
    );
}

/* ================= Pestaña GÉNERO ================= */
function TabGenero({ personas, fuenteId, cambiarFuente, onInsertar }: {
    personas: Persona[]; fuenteId: string; cambiarFuente: (id: string) => void; onInsertar: Insertar;
}) {
    const p = personas.find((x) => x.id === fuenteId) ?? personas[0];
    const [palabra, setPalabra] = useState('el');
    const [manual, setManual] = useState<Partial<FormasConcordancia>>({});
    const auto = useMemo(() => formasConcordancia(palabra), [palabra]);
    const f: FormasConcordancia = { ...auto, ...manual };
    const rapidas = useMemo(() => {
        const rol = p.fija || p.singular.includes('_')
            ? []
            : [`el ${p.singular}`, `EL ${p.singular.toUpperCase()}`, p.singular.toUpperCase()];
        return [...PALABRAS_RAPIDAS, ...rol];
    }, [p]);

    const limpio = (s: string) => s.replace(/"/g, '').trim();
    const sm = limpio(f.sm);
    const sf = limpio(f.sf);
    const pm = limpio(f.pm) || limpio(auto.pm);
    const pf = limpio(f.pf) || limpio(auto.pf);
    const listo = sm !== '' && sf !== '';
    const marcador = `{{${p.plural} | concordar:"${sm}":"${sf}":"${pm}":"${pf}"}}`;

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
                    <select value={p.id} onChange={(e) => cambiarFuente(e.target.value)}>
                        {personas.map((x) => <option key={x.id} value={x.id}>{x.etiqueta}</option>)}
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
                    {p.varias && forma('pm', 'Masculino (varios)')}
                    {p.varias && forma('pf', 'Femenino (varias)')}
                </div>

                <span className="cb-sub">Resultado en el documento</span>
                <div className="cb-ejemplo">
                    <div><span>{p.varias ? 'Un hombre' : 'Si es hombre'}</span>{sm || '—'}</div>
                    <div><span>{p.varias ? 'Una mujer' : 'Si es mujer'}</span>{sf || '—'}</div>
                    {p.varias && <div><span>Varios (o mixto)</span>{pm || '—'}</div>}
                    {p.varias && <div><span>Varias mujeres</span>{pf || '—'}</div>}
                </div>

                <div>
                    <button type="button" className="btn btn-pri btn-sm" disabled={!listo} onMouseDown={quieto}
                        onClick={() => onInsertar(marcador, false)}>
                        Insertar en el cursor
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
export function PanelCampos({ campos, partes, camposPartes, ambito = SIN_AMBITO, onCampos, onPartes, onCamposPartes, onInsertar, onDetectar }: {
    campos: CampoPropio[];
    partes: string[];
    camposPartes: CampoParte[];
    /** Bloques «{{#…}}» abiertos donde está el cursor del editor. */
    ambito?: readonly string[];
    onCampos: (c: CampoPropio[]) => void;
    onPartes: (p: string[]) => void;
    onCamposPartes: (c: CampoParte[]) => void;
    onInsertar: Insertar;
    onDetectar: () => void;
}) {
    const [pestana, setPestana] = useState<Pestana>('datos');
    const [generoDe, setGeneroDe] = useState<string>(partes[0] ?? CLIENTE.id);
    const personas = useMemo<Persona[]>(() => [...partes.map(dePersona), CLIENTE, ABOGADO], [partes]);

    const irAGenero = (id: string) => {
        setGeneroDe(id);
        setPestana('genero');
    };

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
                {pestana === 'datos' && <TabDatos campos={campos} onCampos={onCampos} onInsertar={onInsertar} onDetectar={onDetectar} />}
                {pestana === 'partes' && (
                    <TabPartes partes={partes} personas={personas} camposPartes={camposPartes} ambito={ambito}
                        onPartes={onPartes} onCamposPartes={onCamposPartes} onInsertar={onInsertar} irAGenero={irAGenero} />
                )}
                {pestana === 'genero' && (
                    <TabGenero personas={personas} fuenteId={generoDe} cambiarFuente={setGeneroDe} onInsertar={onInsertar} />
                )}
            </div>

            <div className="pc-pie">
                <p className="pc-ayuda">Clic: inserta en el cursor · Doble clic sobre un campo del texto: editarlo.</p>
            </div>
        </div>
    );
}