import { claveNormalizada } from './texto';

export const CAMPOS_PERSONA = [
    'id', 'tipo', 'nombre', 'nombre_completo', 'nombres', 'apellido_paterno', 'apellido_materno', 'apellido_casada',
    'ci', 'ci_datos', 'ci_numero', 'ci_complemento', 'ci_expedido', 'genero', 'estado_civil', 'nacionalidad',
    'profesion', 'fecha_nacimiento', 'domicilio', 'telefono', 'correo', 'razon_social', 'nit', 'poder_ref',
    'domicilio_procesal', 'representante', 'porcentaje',
] as const;
export const CAMPOS_EXPEDIENTE = ['codigo', 'materia', 'referencia', 'juzgado', 'nro_causa', 'estado'] as const;
export const CAMPOS_INMUEBLE = [
    'id', 'tipo', 'departamento', 'provincia', 'municipio', 'localidad', 'superficie_m2', 'superficie',
    'matricula', 'codigo_catastral', 'ubicacion', 'colindancias', 'gravamenes', 'observaciones', 'titulares',
] as const;

const set = (l: readonly string[]) => new Set(l.map(claveNormalizada));
const PERSONA = set(CAMPOS_PERSONA);
const EXPEDIENTE = set(CAMPOS_EXPEDIENTE);
const INMUEBLE = set(CAMPOS_INMUEBLE);
const COLINDANCIAS = set(['norte', 'sur', 'este', 'oeste']);
const ROLES = set(['demandantes', 'demandados', 'terceros', 'acusados', 'denunciantes', 'partes']);
const SINGULARES = set(['demandante', 'demandado', 'tercero', 'acusado', 'denunciante']);

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

export const BLOQUES_LISTOS = [
    { nombre: 'Lista de partes', texto: '{{demandantes | lista}}' },
    { nombre: 'Bucle de partes', texto: '{{#demandantes}}\n{{nombre | mayus}}, con C.I. N° {{ci}}, {{estado_civil}}, con domicilio en {{domicilio}};\n{{/demandantes}}' },
    { nombre: 'Condicional de cónyuge', texto: '{{#hay_conyuge}}\n…\n{{/hay_conyuge}}' },
    { nombre: 'Concordancia', texto: '{{demandantes | concordar:"mayor de edad":"mayor de edad":"mayores de edad":"mayores de edad"}}' },
];

const EN_BLOQUE_PERSONA = CAMPOS_PERSONA.filter((c) => !['id', 'ci_datos', 'representante', 'porcentaje'].includes(c));

export const PANEL_CAMPOS: { grupo: string; marcadores: string[] }[] = [
    { grupo: 'Expediente', marcadores: CAMPOS_EXPEDIENTE.map((c) => `{{expediente.${c}}}`) },
    { grupo: 'Fecha de hoy', marcadores: ['{{hoy | fecha}}'] },
    { grupo: 'Dentro de un bloque de partes ({{#demandantes}})', marcadores: EN_BLOQUE_PERSONA.map((c) => `{{${c}}}`) },
    { grupo: 'Cliente', marcadores: EN_BLOQUE_PERSONA.map((c) => `{{cliente.${c}}}`) },
    { grupo: 'Abogado', marcadores: [...EN_BLOQUE_PERSONA.map((c) => `{{abogado.${c}}}`), '{{abogado.matricula_profesional}}'] },
    { grupo: 'Dentro de un bloque de inmuebles ({{#inmuebles}})', marcadores: ['{{superficie | superficie}}', '{{matricula}}', '{{codigo_catastral}}', '{{ubicacion}}', '{{colindancias.norte}}', '{{colindancias.sur}}', '{{colindancias.este}}', '{{colindancias.oeste}}', '{{titulares | lista}}'] },
    { grupo: 'Caso (campos libres)', marcadores: ['{{caso.cuantia | moneda}}', '{{caso.hechos}}', '{{caso.petitorio}}'] },
];