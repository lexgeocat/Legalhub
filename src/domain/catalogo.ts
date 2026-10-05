import { hacerOpcional, marcadorDeCampo, type CampoPropio, type TipoCampo } from './fuenteModelo';
import { fecha, hoyISO } from './filtros/fecha';
import { aFemenino } from './personas';
import { claveCampo, claveNormalizada, etiquetaRol, normalizarRol, pluralRol } from './texto';
import { ROLES_CONOCIDOS, TIPOS_EXPEDIENTE } from './tiposExpediente';

export const CAMPOS_PERSONA = [
    'id', 'tipo', 'nombre', 'nombre_completo', 'nombres', 'apellido_paterno', 'apellido_materno', 'apellido_casada',
    'ci', 'ci_datos', 'ci_numero', 'ci_complemento', 'ci_expedido', 'genero', 'estado_civil', 'nacionalidad',
    'profesion', 'fecha_nacimiento', 'domicilio', 'telefono', 'correo', 'razon_social', 'nit', 'poder_ref',
    'domicilio_procesal', 'representante', 'porcentaje',
] as const;
export const CAMPOS_EXPEDIENTE = ['codigo', 'tipo', 'materia', 'referencia', 'juzgado', 'nro_causa', 'estado'] as const;
export const CAMPOS_INMUEBLE = [
    'id', 'tipo', 'departamento', 'provincia', 'municipio', 'localidad', 'superficie_m2', 'superficie',
    'matricula', 'codigo_catastral', 'ubicacion', 'colindancias', 'gravamenes', 'observaciones', 'titulares',
] as const;

const set = (l: readonly string[]) => new Set(l.map(claveNormalizada));
const PERSONA = set(CAMPOS_PERSONA);
const EXPEDIENTE = set(CAMPOS_EXPEDIENTE);
const INMUEBLE = set(CAMPOS_INMUEBLE);
const COLINDANCIAS = set(['norte', 'sur', 'este', 'oeste']);
const ROLES = set([...ROLES_CONOCIDOS.map(pluralRol), 'partes']);
const SINGULARES = set(ROLES_CONOCIDOS);

export interface ResultadoRuta {
    valida: boolean;
    aviso?: string;
}

type TipoContenedor = 'persona' | 'inmueble' | 'flag' | 'rol_desconocido';

function tipoContenedor(nombre: string): TipoContenedor {
    const k = claveNormalizada(nombre);
    if (k === 'inmuebles') return 'inmueble';
    if (k === 'titulares' || ROLES.has(k)) return 'persona';
    if (k.startsWith('hay_') || k.includes('.')) return 'flag';
    return 'rol_desconocido';
}

function enPersona(segs: string[]): boolean {
    const [primero, ...resto] = segs;
    const k = claveNormalizada(primero);
    if (!PERSONA.has(k)) return false;
    if (k === 'representante') return resto.length === 0 || enPersona(resto);
    return resto.length === 0;
}

function enInmueble(segs: string[]): boolean {
    const [primero, ...resto] = segs;
    const k = claveNormalizada(primero);
    if (!INMUEBLE.has(k)) return false;
    if (k === 'colindancias') return resto.length === 0 || (resto.length === 1 && COLINDANCIAS.has(claveNormalizada(resto[0])));
    return resto.length === 0;
}

export function validarRutaCatalogo(ruta: string, ambito: readonly string[]): ResultadoRuta {
    if (ruta === '.') return { valida: true };
    const segs = ruta.split('.');

    for (const contenedor of [...ambito].reverse()) {
        const tipo = tipoContenedor(contenedor);
        if (tipo === 'flag') continue;
        if (tipo === 'inmueble' ? enInmueble(segs) : enPersona(segs)) {
            return tipo === 'rol_desconocido'
                ? { valida: true, aviso: `El bloque «${contenedor}» no es un rol conocido; se asume una lista de personas` }
                : { valida: true };
        }
    }

    const raiz = claveNormalizada(segs[0]);
    const resto = segs.slice(1);
    switch (raiz) {
        case 'hoy': return { valida: resto.length === 0 };
        case 'caso': return { valida: resto.length >= 1 };
        case 'expediente': return { valida: resto.length === 1 && EXPEDIENTE.has(claveNormalizada(resto[0])) };
        case 'cliente': return { valida: resto.length === 0 || enPersona(resto) };
        case 'abogado':
            return { valida: resto.length === 0 || enPersona(resto) || (resto.length === 1 && claveNormalizada(resto[0]) === 'matricula_profesional') };
        case 'partes':
        case 'inmuebles':
            return { valida: true };
        default:
    }
    if (raiz.startsWith('hay_')) return { valida: resto.length === 0 };
    if (ROLES.has(raiz) && resto.length === 0) return { valida: true };
    if (SINGULARES.has(raiz) && resto.length === 0) return { valida: true };
    if (SINGULARES.has(raiz) && resto.length >= 1 && enPersona(resto)) return { valida: true };
    if (resto.length === 0) return { valida: true, aviso: `«${ruta}» no está en el catálogo; verifica que exista en el contexto` };
    if (enPersona(resto)) return { valida: true, aviso: `«${segs[0]}» no es un rol conocido; se asume un rol dinámico` };
    return { valida: false };
}

/* ---------------- Panel de campos ---------------- */

export type SeccionPanel = 'personas' | 'caso' | 'inmuebles' | 'logica';

export const SECCIONES_PANEL: readonly { id: SeccionPanel; etiqueta: string }[] = [
    { id: 'personas', etiqueta: 'Personas' },
    { id: 'caso', etiqueta: 'Caso' },
    { id: 'inmuebles', etiqueta: 'Inmuebles' },
    { id: 'logica', etiqueta: 'Condiciones' },
];

export interface ItemPanel {
    etiqueta: string;
    /** Marcador real que se inserta en el texto. */
    texto: string;
    /** Varias líneas con inicio y cierre: se inserta en párrafos propios. */
    bloque?: boolean;
    /** Cómo se verá en el documento final. */
    ejemplo?: string;
    /** Una frase: cuándo conviene usarlo. */
    ayuda?: string;
    /** Otras palabras con las que alguien podría buscarlo. */
    claves?: string;
    /** Va bajo «Más datos» para no abrumar. */
    avanzado?: boolean;
}

export interface GrupoPanel {
    id: string;
    seccion: SeccionPanel;
    titulo: string;
    ayuda?: string;
    abierto?: boolean;
    items: ItemPanel[];
}

const rotulo = (r: string) => r.replace(/_/g, ' ');
const NOMBRES_EJ = 'Juan Pérez, María López y Pedro Gómez';
const FEMENINO_IGUAL = new Set(['testigo']);

function hoyEnLetras(): string {
    try {
        return fecha(hoyISO());
    } catch {
        return '5 de octubre de 2026';
    }
}

/** Acepta «vendedores» o «vendedor» y devuelve siempre el singular. */
export function rolDesdeTexto(texto: string): string {
    const n = normalizarRol(texto);
    return ROLES_CONOCIDOS.find((r) => pluralRol(r) === n) ?? n;
}

/** Etiqueta amable para una clave «caso.x» («lugar_firma» → «Lugar de firma»). */
export function etiquetaCampoCaso(clave: string): string {
    const k = claveNormalizada(clave);
    for (const t of TIPOS_EXPEDIENTE) {
        const c = t.campos.find((x) => x.clave === k);
        if (c) return c.etiqueta;
    }
    return etiquetaRol(k);
}

/** Descripción en lenguaje llano de un bloque abierto («#vendedores» → «cada vendedor»). */
export function describirBloque(contenedor: string): string {
    const k = claveNormalizada(contenedor);
    if (k === 'hay_conyuge') return 'solo si la primera parte es casada';
    if (k.startsWith('hay_')) return `solo si hay ${rotulo(k.slice(4))}`;
    if (k === 'inmuebles') return 'cada inmueble';
    if (k === 'titulares') return 'cada titular';
    const s = ROLES_CONOCIDOS.find((r) => pluralRol(r) === k);
    return s ? `cada ${rotulo(s)}` : contenedor;
}

/* ----- Datos de una persona ----- */
interface DefPersona {
    campo: string; // puede llevar filtros: «nombre | mayus»
    etiqueta: string;
    ejemplo: string;
    ayuda?: string;
    claves?: string;
    avanzado?: boolean;
    /** Suele estar vacío: se inserta con «?» para que no detenga la generación. */
    opcional?: boolean;
}

const DEF_PERSONA: DefPersona[] = [
    { campo: 'nombre', etiqueta: 'Nombre completo', ejemplo: 'Juan Carlos Pérez Mamani', claves: 'nombres apellidos compareciente razon social' },
    { campo: 'nombre | mayus', etiqueta: 'Nombre completo en MAYÚSCULAS', ejemplo: 'JUAN CARLOS PÉREZ MAMANI', ayuda: 'Es la forma habitual en las comparecencias.', claves: 'mayuscula mayusculas' },
    { campo: 'ci', etiqueta: 'Cédula de identidad (completa)', ejemplo: '1234567-1A LP', ayuda: 'Número, complemento y lugar de expedición, juntos.', claves: 'ci carnet cedula identidad documento' },
    { campo: 'domicilio', etiqueta: 'Domicilio', ejemplo: 'Av. Arce N° 2345, La Paz', claves: 'direccion vive residencia' },
    { campo: 'estado_civil', etiqueta: 'Estado civil', ejemplo: 'casado', ayuda: 'Se ajusta solo al género (casado / casada).', claves: 'soltero casado viudo divorciado' },
    { campo: 'nacionalidad', etiqueta: 'Nacionalidad', ejemplo: 'boliviano', ayuda: 'Se ajusta solo al género (boliviano / boliviana).' },
    { campo: 'profesion', etiqueta: 'Profesión u ocupación', ejemplo: 'abogado', ayuda: 'Se ajusta al género cuando corresponde.', claves: 'oficio trabajo ocupacion' },
    { campo: 'fecha_nacimiento | fecha', etiqueta: 'Fecha de nacimiento', ejemplo: '12 de marzo de 1985', claves: 'nacio edad' },
    { campo: 'nombres', etiqueta: 'Solo los nombres', ejemplo: 'Juan Carlos', avanzado: true },
    { campo: 'apellido_paterno', etiqueta: 'Apellido paterno', ejemplo: 'Pérez', avanzado: true },
    { campo: 'apellido_materno', etiqueta: 'Apellido materno', ejemplo: 'Mamani', avanzado: true },
    { campo: 'apellido_casada', etiqueta: 'Apellido de casada', ejemplo: 'López', avanzado: true, opcional: true, ayuda: 'Queda en blanco si la persona no lo tiene.' },
    { campo: 'ci_numero', etiqueta: 'C.I.: solo el número', ejemplo: '1234567', avanzado: true },
    { campo: 'ci_complemento', etiqueta: 'C.I.: complemento', ejemplo: '1A', avanzado: true, opcional: true },
    { campo: 'ci_expedido', etiqueta: 'C.I.: expedido en', ejemplo: 'LP', avanzado: true },
    { campo: 'telefono', etiqueta: 'Teléfono', ejemplo: '70123456', avanzado: true, opcional: true, claves: 'celular' },
    { campo: 'correo', etiqueta: 'Correo electrónico', ejemplo: 'juan@correo.com', avanzado: true, opcional: true, claves: 'email mail' },
    { campo: 'razon_social', etiqueta: 'Razón social (empresas)', ejemplo: 'Constructora Andina S.R.L.', avanzado: true, opcional: true },
    { campo: 'nit', etiqueta: 'NIT (empresas)', ejemplo: '1020304056', avanzado: true, opcional: true },
    { campo: 'poder_ref', etiqueta: 'Poder del representante (referencia)', ejemplo: 'Poder N° 345/2024', avanzado: true, opcional: true },
    { campo: 'representante.nombre', etiqueta: 'Representante legal: nombre', ejemplo: 'María Quispe Flores', avanzado: true, opcional: true, ayuda: 'Para partes que son empresas. En blanco si no tiene representante.' },
    { campo: 'representante.ci', etiqueta: 'Representante legal: C.I.', ejemplo: '7654321 LP', avanzado: true, opcional: true },
    { campo: 'domicilio_procesal', etiqueta: 'Domicilio procesal de esta parte', ejemplo: 'Calle Loayza N° 250, Of. 3', avanzado: true, opcional: true, claves: 'procesal casilla' },
];

interface OpcionesPersona {
    representante?: boolean;
    domicilioProcesal?: boolean;
}

function itemsPersona(prefijo: string, o: OpcionesPersona = {}): ItemPanel[] {
    return DEF_PERSONA
        .filter((d) => (o.representante || !d.campo.startsWith('representante.')) && (o.domicilioProcesal || d.campo !== 'domicilio_procesal'))
        .map((d) => {
            const texto = `{{${prefijo}${d.campo}}}`;
            return {
                etiqueta: d.etiqueta, ejemplo: d.ejemplo, ayuda: d.ayuda, claves: d.claves, avanzado: d.avanzado,
                texto: d.opcional ? hacerOpcional(texto) : texto,
            };
        });
}

/* ----- Frases para «todas las partes con un rol» ----- */
function itemsDeRol(singular: string, plural: string): ItemPanel[] {
    const m = rotulo(singular);
    const f = FEMENINO_IGUAL.has(m) ? m : aFemenino(m);
    const pm = rotulo(plural);
    const pf = rotulo(pluralRol(f));
    const [M, F, PM, PF] = [m, f, pm, pf].map((x) => x.toUpperCase());
    const conc = (...p: string[]) => `{{${plural} | concordar:${p.map((x) => `"${x}"`).join(':')}}}`;
    return [
        {
            etiqueta: 'Presentar a cada parte (un párrafo por persona)', bloque: true,
            texto: `{{#${plural}}}\n{{nombre | mayus}}, con C.I. N° {{ci}}, {{nacionalidad}}, {{estado_civil}}, con domicilio en {{domicilio}};\n{{/${plural}}}`,
            ejemplo: 'JUAN PÉREZ MAMANI, con C.I. N° 1234567 LP, boliviano, casado, con domicilio en Av. Arce N° 2345;',
            ayuda: 'Se repite solo: si hay 3 partes, salen 3 párrafos.',
            claves: 'comparecencia comparecientes generales de ley repetir cada parte bucle',
        },
        { etiqueta: 'Nombres en una sola línea', texto: `{{${plural} | lista}}`, ejemplo: NOMBRES_EJ, ayuda: 'Con una sola parte muestra solo su nombre.', claves: 'lista nombres juntos' },
        {
            etiqueta: `«${M}» (cambia según género y cantidad)`, texto: conc(M, F, PM, PF),
            ejemplo: `${M} · ${F} · ${PM} · ${PF}`, ayuda: 'Elige sola la forma correcta. Útil en «en calidad de…».', claves: 'en calidad de concordancia genero',
        },
        {
            etiqueta: 'Líneas de firma (una por parte)', bloque: true,
            texto: `{{#${plural}}}\n[c] ______________________________\n[c] {{nombre | mayus}}\n[c] C.I. {{ci}}\n{{/${plural}}}`,
            ejemplo: '______________  ·  JUAN PÉREZ MAMANI  ·  C.I. 1234567 LP',
            ayuda: 'Cada parte con su línea, nombre y C.I., centrados.', claves: 'firma firmas',
        },
        { etiqueta: 'Nombres en una línea, en MAYÚSCULAS', avanzado: true, texto: `{{${plural} | lista | mayus}}`, ejemplo: NOMBRES_EJ.toUpperCase() },
        { etiqueta: `«el ${m}» / «la ${f}»…`, avanzado: true, texto: conc(`el ${m}`, `la ${f}`, `los ${pm}`, `las ${pf}`), ejemplo: `el ${m} · la ${f} · los ${pm} · las ${pf}` },
        { etiqueta: 'El / la / los / las', avanzado: true, texto: conc('el', 'la', 'los', 'las'), ejemplo: 'el · la · los · las' },
        { etiqueta: 'Señor / señora / señores / señoras', avanzado: true, texto: conc('señor', 'señora', 'señores', 'señoras'), ejemplo: 'señor · señora · señores · señoras' },
        { etiqueta: 'Mayor de edad / mayores de edad', avanzado: true, texto: conc('mayor de edad', 'mayor de edad', 'mayores de edad', 'mayores de edad'), ejemplo: 'mayor de edad · mayores de edad' },
        {
            etiqueta: 'Verbo en singular o plural', avanzado: true, texto: conc('declara', 'declara', 'declaran', 'declaran'),
            ejemplo: 'declara (una parte) · declaran (varias)',
            ayuda: 'Cambia las palabras con doble clic sobre el campo, por ejemplo «comparece / comparecen».',
        },
        {
            etiqueta: 'Presentar a cada parte que es empresa', bloque: true, avanzado: true,
            texto: `{{#${plural}}}\n{{nombre | mayus}}, con NIT {{nit}}, con domicilio en {{domicilio}}, representada legalmente por {{representante.nombre}}, con C.I. N° {{representante.ci}}, según {{poder_ref}};\n{{/${plural}}}`,
            ejemplo: 'CONSTRUCTORA ANDINA S.R.L., con NIT 1020304056, con domicilio en Av. Arce N° 100, representada legalmente por María Quispe, con C.I. N° 7654321 LP, según Poder N° 345/2024;',
            ayuda: 'Solo si todas las partes con este rol son empresas con representante y poder.',
        },
    ];
}

/* ----- Datos propios del modelo («caso.*») ----- */
function ejemploDeTipo(t: TipoCampo): string {
    switch (t) {
        case 'fecha': return hoyEnLetras();
        case 'moneda': return 'Bs. 15.000,50 (Quince mil 50/100 bolivianos)';
        case 'superficie': return '250 m² (doscientos cincuenta metros cuadrados)';
        case 'numero': return '12';
        case 'texto_largo': return 'Un párrafo completo, escrito al generar el documento';
        default: return 'Un texto corto, escrito al generar el documento';
    }
}

/** Una sola forma de armar el marcador de un campo propio: la de `marcadorDeCampo`. */
export function itemsDeCampos(campos: CampoPropio[]): ItemPanel[] {
    const salida: ItemPanel[] = [];
    for (const c of campos) {
        const clave = claveCampo(c.clave);
        if (!clave) continue;
        const etiqueta = c.etiqueta.trim() || etiquetaRol(clave);
        salida.push({
            etiqueta, texto: marcadorDeCampo({ ...c, clave }), ejemplo: ejemploDeTipo(c.tipo), claves: clave,
            ayuda: c.requerido ? undefined : 'Opcional: si no se completa, queda en blanco.',
        });
        if (c.tipo === 'numero') {
            salida.push({ etiqueta: `${etiqueta}, en letras`, avanzado: true, texto: `{{caso.${clave}${c.requerido ? '' : '?'} | literal}}`, ejemplo: 'doce' });
        }
    }
    return salida;
}

export function construirGrupoPropios(campos: CampoPropio[]): GrupoPanel {
    const items = itemsDeCampos(campos);
    return {
        id: 'propios', seccion: 'caso', abierto: true,
        titulo: 'Datos que se piden al generar este documento',
        ayuda: items.length > 0
            ? 'Son los datos propios de este modelo (precio, plazo, hechos…). El asistente los pide si no están en el expediente.'
            : 'Aún no hay datos propios. Usa «Campo nuevo» en la cinta para crear uno (precio, plazo, lugar…) y aparecerá aquí.',
        items,
    };
}

/* ----- Inmuebles ----- */
const ITEMS_INMUEBLE: ItemPanel[] = [
    { etiqueta: 'Ubicación', texto: '{{ubicacion}}', ejemplo: 'Calle Comercio N° 123, zona Central', claves: 'direccion lugar' },
    { etiqueta: 'Matrícula (Derechos Reales)', texto: '{{matricula}}', ejemplo: '2.01.0.99.0012345', claves: 'folio real registro' },
    { etiqueta: 'Superficie en número y en letras', texto: '{{superficie | superficie}}', ejemplo: '250 m² (doscientos cincuenta metros cuadrados)', claves: 'metros m2 area' },
    { etiqueta: 'Titulares en una línea', texto: '{{titulares | lista}}', ejemplo: 'Juan Pérez y María López', claves: 'propietarios duenos' },
    {
        etiqueta: 'Colindancias en una frase',
        texto: 'al norte, {{colindancias.norte}}; al sur, {{colindancias.sur}}; al este, {{colindancias.este}}; y al oeste, {{colindancias.oeste}}',
        ejemplo: 'al norte, Calle Comercio; al sur, lote 14; al este, lote 12; y al oeste, Av. Arce', claves: 'limites linderos norte sur este oeste',
    },
    {
        etiqueta: 'Un párrafo por titular', bloque: true,
        texto: '{{#titulares}}\n{{nombre | mayus}}, con C.I. N° {{ci}}, propietario del {{porcentaje}}%;\n{{/titulares}}',
        ejemplo: 'JUAN PÉREZ MAMANI, con C.I. N° 1234567 LP, propietario del 50%;', ayuda: 'Requiere el porcentaje de cada titular.',
    },
    { etiqueta: 'Código catastral', avanzado: true, texto: '{{codigo_catastral}}', ejemplo: '010-123-456' },
    { etiqueta: 'Tipo de inmueble', avanzado: true, texto: '{{tipo}}', ejemplo: 'urbano' },
    { etiqueta: 'Departamento', avanzado: true, texto: '{{departamento}}', ejemplo: 'La Paz' },
    { etiqueta: 'Provincia', avanzado: true, texto: '{{provincia}}', ejemplo: 'Murillo' },
    { etiqueta: 'Municipio', avanzado: true, texto: '{{municipio}}', ejemplo: 'La Paz' },
    { etiqueta: 'Localidad', avanzado: true, texto: '{{localidad}}', ejemplo: 'Sopocachi' },
    { etiqueta: 'Colindancia norte', avanzado: true, texto: '{{colindancias.norte}}', ejemplo: 'Calle Comercio' },
    { etiqueta: 'Colindancia sur', avanzado: true, texto: '{{colindancias.sur}}', ejemplo: 'Lote 14' },
    { etiqueta: 'Colindancia este', avanzado: true, texto: '{{colindancias.este}}', ejemplo: 'Lote 12' },
    { etiqueta: 'Colindancia oeste', avanzado: true, texto: '{{colindancias.oeste}}', ejemplo: 'Av. Arce' },
    { etiqueta: 'Gravámenes', avanzado: true, texto: '{{gravamenes?}}', ejemplo: 'Hipoteca a favor del Banco X', ayuda: 'Queda en blanco si no hay.' },
    { etiqueta: 'Observaciones', avanzado: true, texto: '{{observaciones?}}', ejemplo: 'Sin observaciones', ayuda: 'Queda en blanco si no hay.' },
];

/* ----- Expediente y fecha ----- */
const ITEMS_EXPEDIENTE: ItemPanel[] = [
    { etiqueta: 'Asunto del expediente', texto: '{{expediente.materia}}', ejemplo: 'Cumplimiento de contrato', claves: 'proceso materia' },
    { etiqueta: 'Juzgado o tribunal', texto: '{{expediente.juzgado}}', ejemplo: 'Juzgado Público Civil y Comercial 5.º', claves: 'juez autoridad' },
    { etiqueta: 'N° de causa', texto: '{{expediente.nro_causa?}}', ejemplo: '1234/2026', ayuda: 'Queda en blanco si aún no tiene.', claves: 'caso numero nurej' },
    { etiqueta: 'Referencia', texto: '{{expediente.referencia?}}', ejemplo: 'Lote 12, zona Sur', ayuda: 'Queda en blanco si no se usa.' },
    { etiqueta: 'Código interno del expediente', texto: '{{expediente.codigo}}', ejemplo: `LH-${new Date().getFullYear()}-0012`, avanzado: true },
    { etiqueta: 'Tipo de expediente (interno)', texto: '{{expediente.tipo}}', ejemplo: 'civil', avanzado: true },
    { etiqueta: 'Estado (interno)', texto: '{{expediente.estado}}', ejemplo: 'en_tramite', avanzado: true },
];

/* ----- Panel completo ----- */
export function construirPanel(rol: string): GrupoPanel[] {
    const singular = rolDesdeTexto(rol) || 'demandante';
    const plural = pluralRol(singular);
    const grupos: GrupoPanel[] = [
        {
            id: 'rol', seccion: 'personas', abierto: true, titulo: `${etiquetaRol(rotulo(plural))}: una o varias partes`,
            ayuda: 'Para cuando el texto habla de todas las partes con este rol a la vez.',
            items: itemsDeRol(singular, plural),
        },
        {
            id: 'cliente', seccion: 'personas', titulo: 'Nuestro cliente',
            ayuda: 'La persona que contrata tus servicios en este expediente.',
            items: [
                { etiqueta: 'Señor / señora', texto: '{{cliente | concordar:"señor":"señora"}}', ejemplo: 'señor · señora', ayuda: 'Según el género del cliente.' },
                ...itemsPersona('cliente.', { representante: true }),
            ],
        },
        {
            id: 'abogado', seccion: 'personas', titulo: 'Abogado (tus datos)',
            ayuda: 'Se completan en Configuración → Datos generales.',
            items: [
                { etiqueta: 'Matrícula profesional', texto: '{{abogado.matricula_profesional}}', ejemplo: 'Reg. Prof. 12345', claves: 'registro colegio' },
                { etiqueta: 'Domicilio procesal del abogado', texto: '{{abogado.domicilio_procesal}}', ejemplo: 'Calle Loayza N° 250, Of. 3', claves: 'procesal casilla otrosi' },
                { etiqueta: 'El abogado / la abogada', texto: '{{abogado | concordar:"el abogado":"la abogada"}}', ejemplo: 'el abogado · la abogada', ayuda: 'Según el género del abogado.' },
                ...itemsPersona('abogado.'),
            ],
        },
        { id: 'exp', seccion: 'caso', abierto: true, titulo: 'Datos del expediente', items: ITEMS_EXPEDIENTE },
        {
            id: 'fecha', seccion: 'caso', abierto: true, titulo: 'Fecha y lugar',
            items: [
                { etiqueta: 'Fecha de hoy, en letras', texto: '{{hoy | fecha}}', ejemplo: hoyEnLetras(), ayuda: 'Se pone sola al generar el documento.', claves: 'dia hoy' },
                { etiqueta: 'Lugar y fecha de firma', texto: '{{caso.lugar_firma}}, {{hoy | fecha}}', ejemplo: `La Paz, ${hoyEnLetras()}`, ayuda: 'Pregunta el lugar al generar el documento.', claves: 'ciudad lugar' },
            ],
        },
        {
            id: 'inm', seccion: 'inmuebles', abierto: true, titulo: 'Describir los inmuebles',
            ayuda: 'Los datos de un inmueble (matrícula, superficie…) se insertan DENTRO de uno de estos bloques: pon el cursor ahí y el panel te los ofrecerá.',
            items: [
                {
                    etiqueta: 'Describir cada inmueble (un párrafo por inmueble)', bloque: true,
                    texto: '{{#inmuebles}}\nInmueble ubicado en {{ubicacion}}, con matrícula N° {{matricula}} y una superficie de {{superficie | superficie}}, de propiedad de {{titulares | lista}}.\n{{/inmuebles}}',
                    ejemplo: 'Inmueble ubicado en Calle Comercio N° 123, con matrícula N° 2.01.0.99.0012345 y una superficie de 250 m² (doscientos cincuenta metros cuadrados), de propiedad de Juan Pérez y María López.',
                    claves: 'bien propiedad terreno lote casa',
                },
                {
                    etiqueta: 'Colindancias de cada inmueble', bloque: true,
                    texto: '{{#inmuebles}}\nColindancias: al norte, {{colindancias.norte}}; al sur, {{colindancias.sur}}; al este, {{colindancias.este}}; y al oeste, {{colindancias.oeste}}.\n{{/inmuebles}}',
                    ejemplo: 'Colindancias: al norte, Calle Comercio; al sur, lote 14; al este, lote 12; y al oeste, Av. Arce.',
                    claves: 'limites linderos',
                },
            ],
        },
        {
            id: 'cond', seccion: 'logica', abierto: true, titulo: 'Mostrar un texto solo si corresponde',
            ayuda: 'Cada bloque tiene una línea de inicio y otra de cierre: escribe tu texto entre las dos (el «…» se reemplaza).',
            items: [
                { etiqueta: `Solo si hay ${rotulo(plural)}`, bloque: true, texto: `{{#hay_${plural}}}\n…\n{{/hay_${plural}}}`, ayuda: 'El texto sale únicamente si el expediente tiene al menos una parte con este rol.' },
                { etiqueta: 'Solo si la primera parte es casada', bloque: true, texto: '{{#hay_conyuge}}\n…\n{{/hay_conyuge}}', ayuda: 'Sirve, por ejemplo, para la cláusula del cónyuge.' },
            ],
        },
        {
            id: 'rep', seccion: 'logica', abierto: true, titulo: 'Repetir un texto',
            ayuda: 'Dentro del bloque, el panel te ofrece los datos de cada persona o inmueble sin prefijo.',
            items: [
                { etiqueta: `Por cada ${rotulo(singular)}`, bloque: true, texto: `{{#${plural}}}\n…\n{{/${plural}}}` },
                { etiqueta: 'Por cada inmueble', bloque: true, texto: '{{#inmuebles}}\n…\n{{/inmuebles}}' },
            ],
        },
    ];
    if (singular !== plural) {
        grupos.splice(1, 0, {
            id: 'rol1', seccion: 'personas', titulo: `${etiquetaRol(rotulo(singular))}: solo la primera parte`,
            ayuda: 'Úsalo si hay una sola parte con este rol. Si hay varias, solo sale la primera: usa «Presentar a cada parte».',
            items: itemsPersona(`${singular}.`, { representante: true, domicilioProcesal: true }),
        });
    }
    return grupos;
}

/** Campos relativos al bloque donde está el cursor: dentro de «{{#demandantes}}» basta escribir {{nombre}}. */
export function construirPanelAmbito(ambito: readonly string[]): GrupoPanel | null {
    for (const contenedor of [...ambito].reverse()) {
        const tipo = tipoContenedor(contenedor);
        if (tipo === 'flag') continue;
        const donde = describirBloque(contenedor);
        const base = {
            id: 'ambito', abierto: true, titulo: `Estás dentro de: ${donde}`,
            ayuda: `Este texto se repite por ${donde}. Aquí los datos se escriben sin prefijo.`,
        };
        if (tipo === 'inmueble') return { ...base, seccion: 'inmuebles', items: ITEMS_INMUEBLE };
        const items = itemsPersona('', { representante: true, domicilioProcesal: true });
        if (claveNormalizada(contenedor) === 'titulares') {
            items.unshift({ etiqueta: 'Porcentaje de propiedad', texto: '{{porcentaje}}', ejemplo: '50' });
        }
        return { ...base, seccion: 'personas', items };
    }
    return null;
}