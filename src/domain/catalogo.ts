import type { CampoPropio } from './fuenteModelo';
import { claveNormalizada, etiquetaRol, normalizarRol, pluralRol } from './texto';
import { ROLES_CONOCIDOS } from './tiposExpediente';

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
    if (k.startsWith('hay_')) return 'flag';
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
        case 'cliente': return { valida: resto.length >= 1 && enPersona(resto) };
        case 'abogado':
            return { valida: resto.length >= 1 && (enPersona(resto) || (resto.length === 1 && claveNormalizada(resto[0]) === 'matricula_profesional')) };
        case 'partes':
        case 'inmuebles':
            return { valida: true };
        default:
    }
    if (raiz.startsWith('hay_')) return { valida: resto.length === 0 };
    if (ROLES.has(raiz) && resto.length === 0) return { valida: true };
    if (SINGULARES.has(raiz) && resto.length >= 1 && enPersona(resto)) return { valida: true };
    if (resto.length === 0) return { valida: true, aviso: `«${ruta}» no está en el catálogo; verifica que exista en el contexto` };
    if (enPersona(resto)) return { valida: true, aviso: `«${segs[0]}» no es un rol conocido; se asume un rol dinámico` };
    return { valida: false };
}

/* ---------------- Panel de campos ---------------- */

export interface ItemPanel { etiqueta: string; texto: string; bloque?: boolean }
export interface GrupoPanel { id: string; titulo: string; ayuda?: string; abierto?: boolean; items: ItemPanel[] }

const ETIQUETAS: Record<string, string> = {
    nombre: 'Nombre completo', nombres: 'Nombres', apellido_paterno: 'Apellido paterno', apellido_materno: 'Apellido materno',
    apellido_casada: 'Apellido de casada', ci: 'C.I. (con complemento y expedición)', ci_numero: 'C.I. (solo número)',
    ci_complemento: 'C.I. (complemento)', ci_expedido: 'C.I. (expedido en)', genero: 'Género', estado_civil: 'Estado civil',
    nacionalidad: 'Nacionalidad', profesion: 'Profesión', fecha_nacimiento: 'Fecha de nacimiento', domicilio: 'Domicilio',
    telefono: 'Teléfono', correo: 'Correo', razon_social: 'Razón social', nit: 'NIT', poder_ref: 'Poder (referencia)',
    domicilio_procesal: 'Domicilio procesal',
};
const ETIQUETAS_EXP: Record<string, string> = {
    codigo: 'Código interno', tipo: 'Tipo de expediente', materia: 'Asunto', referencia: 'Referencia',
    juzgado: 'Juzgado', nro_causa: 'N° de causa', estado: 'Estado',
};
const SIN_PANEL = ['id', 'tipo', 'ci_datos', 'representante', 'porcentaje', 'nombre_completo'];
const CAMPOS_PANEL: string[] = CAMPOS_PERSONA.filter((c) => !SIN_PANEL.includes(c));

function itemsPersona(prefijo: string): ItemPanel[] {
    const items: ItemPanel[] = CAMPOS_PANEL.map((c) => ({ etiqueta: ETIQUETAS[c] ?? c, texto: `{{${prefijo}${c}}}` }));
    items.splice(1, 0, { etiqueta: 'Nombre en MAYÚSCULAS', texto: `{{${prefijo}nombre | mayus}}` });
    return items;
}

export function construirPanel(rolSingular: string): GrupoPanel[] {
    const singular = normalizarRol(rolSingular) || 'demandante';
    const plural = pluralRol(singular);
    return [
        {
            id: 'rol', titulo: `Partes: ${etiquetaRol(plural).toLowerCase()}`, abierto: true,
            ayuda: 'Escribe arriba el rol (demandante, vendedor, arrendatario…). Los bloques se insertan en líneas propias.',
            items: [
                { etiqueta: 'Lista de nombres («A, B y C»)', texto: `{{${plural} | lista}}` },
                {
                    etiqueta: 'Un párrafo por parte (bucle)', bloque: true,
                    texto: `{{#${plural}}}\n{{nombre | mayus}}, con C.I. N° {{ci}}, {{estado_civil}}, {{nacionalidad}}, con domicilio en {{domicilio}};\n{{/${plural}}}`,
                },
                { etiqueta: 'Concordancia: el / la / los / las', texto: `{{${plural} | concordar:"el":"la":"los":"las"}}` },
                { etiqueta: 'Concordancia: señor / señora', texto: `{{${plural} | concordar:"señor":"señora":"señores":"señoras"}}` },
                { etiqueta: 'Concordancia: mayor de edad', texto: `{{${plural} | concordar:"mayor de edad":"mayor de edad":"mayores de edad":"mayores de edad"}}` },
                { etiqueta: 'Solo si existe este rol', bloque: true, texto: `{{#hay_${plural}}}\n…\n{{/hay_${plural}}}` },
            ],
        },
        { id: 'rol1', titulo: `Primera parte (${singular})`, items: itemsPersona(`${singular}.`) },
        {
            id: 'exp', titulo: 'Expediente',
            items: CAMPOS_EXPEDIENTE.map((c) => ({ etiqueta: ETIQUETAS_EXP[c] ?? c, texto: `{{expediente.${c}}}` })),
        },
        { id: 'fecha', titulo: 'Fecha', items: [{ etiqueta: 'Fecha de hoy («2 de octubre de 2026»)', texto: '{{hoy | fecha}}' }] },
        { id: 'cliente', titulo: 'Cliente', items: itemsPersona('cliente.') },
        {
            id: 'abogado', titulo: 'Abogado',
            items: [...itemsPersona('abogado.'), { etiqueta: 'Matrícula profesional', texto: '{{abogado.matricula_profesional}}' }],
        },
        {
            id: 'inm', titulo: 'Inmuebles',
            ayuda: 'Los campos van dentro del bloque de inmuebles.',
            items: [
                {
                    etiqueta: 'Un párrafo por inmueble (bucle)', bloque: true,
                    texto: '{{#inmuebles}}\nInmueble ubicado en {{ubicacion}}, matrícula N° {{matricula}}, superficie {{superficie | superficie}}, de propiedad de {{titulares | lista}}.\n{{/inmuebles}}',
                },
                { etiqueta: 'Superficie en número y literal', texto: '{{superficie | superficie}}' },
                { etiqueta: 'Matrícula', texto: '{{matricula}}' },
                { etiqueta: 'Código catastral', texto: '{{codigo_catastral}}' },
                { etiqueta: 'Ubicación', texto: '{{ubicacion}}' },
                { etiqueta: 'Titulares', texto: '{{titulares | lista}}' },
                { etiqueta: 'Colindancia norte', texto: '{{colindancias.norte}}' },
                { etiqueta: 'Colindancia sur', texto: '{{colindancias.sur}}' },
                { etiqueta: 'Colindancia este', texto: '{{colindancias.este}}' },
                { etiqueta: 'Colindancia oeste', texto: '{{colindancias.oeste}}' },
            ],
        },
        {
            id: 'cond', titulo: 'Condicionales',
            items: [{ etiqueta: 'Solo si la primera parte está casada', bloque: true, texto: '{{#hay_conyuge}}\n…\n{{/hay_conyuge}}' }],
        },
    ];
}

export const itemsDeCampos = (campos: CampoPropio[]): ItemPanel[] =>
    campos.map((c) => ({ etiqueta: c.etiqueta, texto: `{{caso.${c.clave}}}` }));

/* ---------------- Campos según el bloque donde está el cursor ---------------- */
const ITEMS_INMUEBLE: ItemPanel[] = [
    { etiqueta: 'Ubicación', texto: '{{ubicacion}}' },
    { etiqueta: 'Matrícula', texto: '{{matricula}}' },
    { etiqueta: 'Código catastral', texto: '{{codigo_catastral}}' },
    { etiqueta: 'Superficie en número y literal', texto: '{{superficie | superficie}}' },
    { etiqueta: 'Tipo', texto: '{{tipo}}' },
    { etiqueta: 'Departamento', texto: '{{departamento}}' },
    { etiqueta: 'Provincia', texto: '{{provincia}}' },
    { etiqueta: 'Municipio', texto: '{{municipio}}' },
    { etiqueta: 'Localidad', texto: '{{localidad}}' },
    { etiqueta: 'Colindancia norte', texto: '{{colindancias.norte}}' },
    { etiqueta: 'Colindancia sur', texto: '{{colindancias.sur}}' },
    { etiqueta: 'Colindancia este', texto: '{{colindancias.este}}' },
    { etiqueta: 'Colindancia oeste', texto: '{{colindancias.oeste}}' },
    { etiqueta: 'Gravámenes', texto: '{{gravamenes}}' },
    { etiqueta: 'Observaciones', texto: '{{observaciones}}' },
    { etiqueta: 'Titulares («A, B y C»)', texto: '{{titulares | lista}}' },
    {
        etiqueta: 'Un párrafo por titular (bucle)', bloque: true,
        texto: '{{#titulares}}\n{{nombre | mayus}}, con C.I. N° {{ci}}, {{porcentaje}}%;\n{{/titulares}}',
    },
];

/**
 * Campos relativos al bloque abierto en el cursor: dentro de «{{#demandantes}}» basta escribir {{nombre}}.
 * Devuelve null si el cursor no está dentro de ningún bloque con datos.
 */
export function construirPanelAmbito(ambito: readonly string[]): GrupoPanel | null {
    for (const contenedor of [...ambito].reverse()) {
        const tipo = tipoContenedor(contenedor);
        if (tipo === 'flag') continue;
        const titulo = `Dentro de «${contenedor}»`;
        const ayuda = `Estás dentro del bloque «${contenedor}»: los campos se escriben sin prefijo.`;
        if (tipo === 'inmueble') return { id: 'ambito', titulo, ayuda, abierto: true, items: ITEMS_INMUEBLE };
        const items = itemsPersona('');
        if (claveNormalizada(contenedor) === 'titulares') {
            items.push({ etiqueta: 'Porcentaje de propiedad', texto: '{{porcentaje}}' });
        }
        return { id: 'ambito', titulo, ayuda, abierto: true, items };
    }
    return null;
}