import type { TipoCampo } from './fuenteModelo';
import { claveCampo, claveNormalizada, etiquetaRol, normalizarRol, pluralRol } from './texto';
import { ROLES_CONOCIDOS, TIPOS_EXPEDIENTE } from './tiposExpediente';

export const CAMPOS_PERSONA = [
    'id', 'tipo', 'nombre', 'nombre_completo', 'nombres', 'apellido_paterno', 'apellido_materno', 'apellido_casada',
    'ci', 'ci_datos', 'ci_numero', 'ci_complemento', 'ci_expedido', 'genero', 'estado_civil', 'nacionalidad',
    'profesion', 'fecha_nacimiento', 'domicilio', 'telefono', 'correo', 'razon_social', 'nit', 'poder_ref',
    'domicilio_procesal', 'representante', 'porcentaje', 'datos',
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
/** Rol provisional de los datos de parte que aún no se asignaron: «{{sin_parte.nombre}}». */
export const ROL_PENDIENTE = 'sin_parte';
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
    if (k === 'datos') return resto.length === 1; // datos propios de la parte: «datos.lugar_nacimiento»
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

/* ---------------- Utilidades del constructor ---------------- */

/** Acepta «vendedores» o «vendedor» y devuelve siempre el singular (si lo conoce). */
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

/** Roles (singular) que el texto ya usa: «{{#vendedores}}», «{{demandantes | lista}}», «{{vendedor.nombre}}». */
export function rolesEnTexto(texto: string): string[] {
    const salida = new Set<string>();
    for (const m of texto.matchAll(/\{\{\s*#?\s*([\p{L}_][\p{L}\p{N}_]*)/gu)) {
        const k = claveNormalizada(m[1]);
        const r = ROLES_CONOCIDOS.find((x) => x === k || pluralRol(x) === k);
        if (r) salida.add(r);
    }
    return [...salida];
}

/* ---------------- Datos de la ficha de la persona y datos propios de cada parte ---------------- */
export interface DatoFicha {
    clave: string;
    /** Nombre corto: también sirve de sugerencia al crear un campo. */
    etiqueta: string;
    tipo: TipoCampo;
    alias: string[];
    /** Solo existe para este rol («abogado»). */
    exclusivo?: string;
}

export const DATOS_FICHA: readonly DatoFicha[] = [
    { clave: 'nombre', etiqueta: 'Nombre completo', tipo: 'texto', alias: ['nombre', 'nombres_y_apellidos', 'compareciente'] },
    { clave: 'nombres', etiqueta: 'Nombres', tipo: 'texto', alias: [] },
    { clave: 'apellido_paterno', etiqueta: 'Apellido paterno', tipo: 'texto', alias: ['paterno', 'primer_apellido'] },
    { clave: 'apellido_materno', etiqueta: 'Apellido materno', tipo: 'texto', alias: ['materno', 'segundo_apellido'] },
    { clave: 'apellido_casada', etiqueta: 'Apellido de casada', tipo: 'texto', alias: ['apellido_casada'] },
    { clave: 'ci', etiqueta: 'C.I.', tipo: 'texto', alias: ['ci', 'cedula', 'cedula_de_identidad', 'cedula_identidad', 'carnet', 'carnet_de_identidad', 'documento_de_identidad'] },
    { clave: 'ci_expedido', etiqueta: 'Expedido en', tipo: 'texto', alias: ['expedido', 'ci_expedido', 'lugar_de_expedicion'] },
    { clave: 'domicilio', etiqueta: 'Domicilio', tipo: 'texto', alias: ['direccion', 'residencia'] },
    { clave: 'estado_civil', etiqueta: 'Estado civil', tipo: 'texto', alias: [] },
    { clave: 'nacionalidad', etiqueta: 'Nacionalidad', tipo: 'texto', alias: [] },
    { clave: 'profesion', etiqueta: 'Profesión', tipo: 'texto', alias: ['ocupacion', 'profesion_u_ocupacion', 'oficio'] },
    { clave: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'fecha', alias: ['nacimiento', 'fecha_nacimiento'] },
    { clave: 'telefono', etiqueta: 'Teléfono', tipo: 'texto', alias: ['celular', 'telefono_celular'] },
    { clave: 'correo', etiqueta: 'Correo', tipo: 'texto', alias: ['correo_electronico', 'email', 'e_mail'] },
    { clave: 'razon_social', etiqueta: 'Razón social', tipo: 'texto', alias: [] },
    { clave: 'nit', etiqueta: 'NIT', tipo: 'texto', alias: [] },
    { clave: 'poder_ref', etiqueta: 'Poder', tipo: 'texto', alias: ['poder_notarial', 'poder_ref'] },
    { clave: 'domicilio_procesal', etiqueta: 'Domicilio procesal', tipo: 'texto', alias: [] },
    { clave: 'matricula_profesional', etiqueta: 'Matrícula profesional', tipo: 'texto', alias: ['matricula', 'registro_profesional'], exclusivo: 'abogado' },
];

/** ¿El nombre escrito corresponde a un dato de la ficha de la persona? («Cédula» → ci, «Dirección» → domicilio…) */
export function datoDeFicha(texto: string, rol?: string): DatoFicha | undefined {
    const k = claveCampo(texto);
    if (!k) return undefined;
    return DATOS_FICHA.find(
        (d) => (!d.exclusivo || d.exclusivo === rol)
            && (d.clave === k || claveCampo(d.etiqueta) === k || d.alias.includes(k)),
    );
}

/** «vendedor» ≡ «vendedores» (cualquier combinación de singular y plural). */
export function mismoRol(a: string, b: string): boolean {
    const x = normalizarRol(a);
    const y = normalizarRol(b);
    return !!x && !!y && (x === y || pluralRol(x) === y || x === pluralRol(y));
}

export interface DatoDeParte {
    /** Rol tal como aparece en el modelo (puede ser plural) o null si no se sabe. */
    rol: string | null;
    clave: string;
    /** true: está escrito sin prefijo dentro de un bloque («{{datos.lugar}}»). */
    relativo: boolean;
}

/** «vendedor.datos.lugar» o, dentro de un bloque, «datos.lugar». */
export function datoDeParteEnRuta(path: string, ambito: readonly string[]): DatoDeParte | null {
    const s = path.split('.').map(claveCampo);
    if (s.length === 3 && s[1] === 'datos' && s[0] && s[2]) return { rol: s[0], clave: s[2], relativo: false };
    if (s.length === 2 && s[0] === 'datos' && s[1]) {
        return { rol: ambito.length > 0 ? ambito[ambito.length - 1] : null, clave: s[1], relativo: true };
    }
    return null;
}

/** Datos propios de partes que el texto ya usa: «{{vendedor.datos.lugar_nacimiento?}}». */
export function usosDatosParte(texto: string): { rol: string; clave: string; opcional: boolean }[] {
    const salida = new Map<string, { rol: string; clave: string; opcional: boolean }>();
    const re = /\{\{\s*([\p{L}_][\p{L}\p{N}_]*)\.datos\.([\p{L}_][\p{L}\p{N}_]*)\s*(\?)?/giu;
    for (const m of texto.matchAll(re)) {
        const rol = rolDesdeTexto(m[1]);
        const clave = claveCampo(m[2]);
        const k = `${rol}|${clave}`;
        const previo = salida.get(k);
        const opcional = m[3] === '?';
        salida.set(k, { rol, clave, opcional: previo ? previo.opcional && opcional : opcional });
    }
    return [...salida.values()];
}