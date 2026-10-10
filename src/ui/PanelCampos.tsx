import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { tipoSugerido } from '../application/camposModelo';
import { rolDesdeTexto } from '../domain/catalogo';
import { formasConcordancia, type FormasConcordancia } from '../domain/concordancia';
import { TIPOS_CAMPO, marcadorDeCampo, type CampoPropio, type TipoCampo } from '../domain/fuenteModelo';
import { claveCampo, etiquetaRol, pluralRol } from '../domain/texto';
import { ROLES_CONOCIDOS } from '../domain/tiposExpediente';
import { Campo, Icono, Segmentado } from './comunes';
import { matizDePersona } from '../domain/marcadores';

type Pestana = 'datos' | 'partes' | 'genero';
type Insertar = (texto: string, bloque: boolean) => void;
type Modo = 'cada' | 'una';

/** Evita que el botón le quite el foco (y el cursor) a la hoja. */
const quieto = (e: { preventDefault(): void }) => e.preventDefault();
const nombreTipo = (t: string) => TIPOS_CAMPO.find((x) => x.valor === t)?.etiqueta ?? t;

/* ---------------- Personas disponibles ---------------- */
interface Persona {
    id: string;
    etiqueta: string;
    /** Expresión para «todas las personas con este rol» (vendedores) o la única (cliente). */
    plural: string;
    /** Expresión para «la primera persona» (vendedor). */
    singular: string;
    varias: boolean;
    fija: boolean;
}

const CLIENTE: Persona = { id: '@cliente', etiqueta: 'Cliente', plural: 'cliente', singular: 'cliente', varias: false, fija: true };
const ABOGADO: Persona = { id: '@abogado', etiqueta: 'Abogado (yo)', plural: 'abogado', singular: 'abogado', varias: false, fija: true };
const dePersona = (rol: string): Persona => ({
    id: rol, etiqueta: etiquetaRol(rol), plural: pluralRol(rol), singular: rol, varias: true, fija: false,
});

const DATOS_PERSONA: { id: string; etiqueta: string; antes?: string; filtro?: string }[] = [
    { id: 'nombre', etiqueta: 'Nombre completo' },
    { id: 'ci', etiqueta: 'C.I.', antes: 'con C.I. N° ' },
    { id: 'domicilio', etiqueta: 'Domicilio', antes: 'con domicilio en ' },
    { id: 'estado_civil', etiqueta: 'Estado civil' },
    { id: 'nacionalidad', etiqueta: 'Nacionalidad' },
    { id: 'profesion', etiqueta: 'Profesión' },
    { id: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', antes: 'nacimiento: ', filtro: ' | fecha' },
    { id: 'telefono', etiqueta: 'Teléfono', antes: 'teléfono ' },
    { id: 'correo', etiqueta: 'Correo', antes: 'correo ' },
];

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
                    title="Busca en el texto los {{caso.…}} y roles que escribiste a mano">
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
function Ficha({ p, onInsertar }: { p: Persona; onInsertar: Insertar }) {
    const [sel, setSel] = useState<ReadonlySet<string>>(() => new Set(['nombre', 'ci']));
    const [mayus, setMayus] = useState(true);
    const [modo, setModo] = useState<Modo>('cada');
    const puedeUna = !p.varias || p.singular !== p.plural;
    const repetir = p.varias && (modo === 'cada' || !puedeUna);

    function alternar(id: string) {
        const n = new Set(sel);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        setSel(n);
    }

    const prefijo = repetir ? '' : `${p.singular}.`;
    const linea = DATOS_PERSONA
        .filter((d) => sel.has(d.id))
        .map((d) => `${d.antes ?? ''}{{${prefijo}${d.id}${d.id === 'nombre' && mayus ? ' | mayus' : (d.filtro ?? '')}}}`)
        .join(', ');
    const texto = repetir ? `{{#${p.plural}}}\n${linea}\n{{/${p.plural}}}` : linea;

    return (
        <div className="cb-edicion">
            <span className="cb-sub">¿Qué datos quieres mostrar?</span>
            <div className="cb-datos">
                {DATOS_PERSONA.map((d) => (
                    <label key={d.id} className="casilla">
                        <input type="checkbox" checked={sel.has(d.id)} onChange={() => alternar(d.id)} />
                        {d.etiqueta}
                    </label>
                ))}
            </div>
            {sel.has('nombre') && (
                <label className="casilla">
                    <input type="checkbox" checked={mayus} onChange={(e) => setMayus(e.target.checked)} />
                    Nombre en MAYÚSCULAS
                </label>
            )}
            {p.varias && puedeUna && (
                <Segmentado<Modo>
                    valor={modo} cambiar={setModo}
                    opciones={[{ id: 'cada', etiqueta: 'Cada persona' }, { id: 'una', etiqueta: 'Solo la primera' }]}
                />
            )}
            <span className="cb-sub">Así se insertará</span>
            <code className="cb-prev">{linea ? texto : 'Elige al menos un dato'}</code>
            <p className="pc-nota">
                {repetir
                    ? 'Se repite sola: una línea por cada persona con este rol. Ajusta la redacción después, en el documento.'
                    : 'Escribe después el texto que quieras alrededor.'}
            </p>
            <div>
                <button type="button" className="btn btn-pri btn-sm" disabled={!linea} onMouseDown={quieto}
                    onClick={() => onInsertar(texto, repetir)}>
                    Insertar en el cursor
                </button>
            </div>
        </div>
    );
}

function TarjetaPersona({ p, matiz, abierta, alternar, quitar, onInsertar, irAGenero }: {
    p: Persona; matiz: number; abierta: boolean; alternar: () => void; quitar?: () => void; onInsertar: Insertar; irAGenero: () => void;
}) {
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
            <div className="pc-acciones">
                <button type="button" className="btn btn-sec btn-sm" onMouseDown={quieto}
                    title={p.varias ? 'Todos los nombres en una línea: «Juan y María»' : 'Nombre completo'}
                    onClick={() => onInsertar(p.varias ? `{{${p.plural} | lista}}` : `{{${p.singular}.nombre}}`, false)}>
                    {p.varias ? 'Nombres' : 'Nombre'}
                </button>
                <button type="button" className="btn btn-sec btn-sm" onMouseDown={quieto} onClick={alternar}>
                    {abierta ? 'Cerrar ficha' : 'Armar ficha…'}
                </button>
                <button type="button" className="btn btn-sec btn-sm" onClick={irAGenero}>Género…</button>
            </div>
            {abierta && <Ficha p={p} onInsertar={onInsertar} />}
        </div>
    );
}

function TabPartes({ partes, personas, onPartes, onInsertar, irAGenero }: {
    partes: string[]; personas: Persona[]; onPartes: (p: string[]) => void; onInsertar: Insertar; irAGenero: (id: string) => void;
}) {
    const [nuevo, setNuevo] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [abierta, setAbierta] = useState<string | null>(null);

    function agregar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        const r = rolDesdeTexto(nuevo);
        if (!r) {
            setError('Escribe el rol: vendedor, demandante, testigo…');
            return;
        }
        if (!partes.includes(r)) onPartes([...partes, r]);
        setNuevo('');
        setError(null);
        setAbierta(r);
    }

    return (
        <>
            <p className="pc-ayuda">
                Las personas que intervienen. Crea cada rol con el nombre que uses (vendedor, comodante, testigo…):
                los datos salen de la pestaña Partes del expediente.
            </p>
            <form className="cb-form" onSubmit={agregar}>
                <div className="cb-fila-form">
                    <input list="roles-constructor" aria-label="Rol de la parte" placeholder="Rol: vendedor, demandante…"
                        value={nuevo} onChange={(e) => { setNuevo(e.target.value); setError(null); }} />
                    <button type="submit" className="btn btn-pri btn-sm">Agregar</button>
                </div>
                <datalist id="roles-constructor">{ROLES_CONOCIDOS.map((r) => <option key={r} value={r} />)}</datalist>
                {error && <p className="pc-error">{error}</p>}
            </form>

            {personas.map((p) => (
                <TarjetaPersona key={p.id} p={p} matiz={matizDePersona(p.id, partes)} abierta={abierta === p.id}
                    alternar={() => setAbierta(abierta === p.id ? null : p.id)}
                    quitar={p.fija ? undefined : () => onPartes(partes.filter((x) => x !== p.id))}
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
    const rapidas = useMemo(() => {
        const rol = p.fija || p.singular.includes('_')
            ? []
            : [`el ${p.singular}`, `EL ${p.singular.toUpperCase()}`, p.singular.toUpperCase()];
        return [...PALABRAS_RAPIDAS, ...rol];
    }, [p]);
    const f: FormasConcordancia = { ...auto, ...manual };

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
export function PanelCampos({ campos, partes, onCampos, onPartes, onInsertar, onDetectar }: {
    campos: CampoPropio[];
    partes: string[];
    onCampos: (c: CampoPropio[]) => void;
    onPartes: (p: string[]) => void;
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
                    <TabPartes partes={partes} personas={personas} onPartes={onPartes} onInsertar={onInsertar} irAGenero={irAGenero} />
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