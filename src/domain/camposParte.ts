import { CAMPOS_PERSONA, ROL_PENDIENTE, datoDeFicha, mismoRol } from './catalogo';
import {
    marcadorDeCampo,
    type CampoPropio, type DatoParte, type GrupoDatos, type TipoCampo,
} from './fuenteModelo';
import { analizarMarcador, armarMarcador, type FiltroMarcador } from './marcadores';
import { claveCampo, claveNormalizada, etiquetaRol, normalizarRol } from './texto';

const FILTRO_TIPO: Partial<Record<TipoCampo, string>> = { fecha: 'fecha', moneda: 'moneda', superficie: 'superficie' };
const esTexto = (t: TipoCampo) => t === 'texto' || t === 'texto_largo';

/** Dato listo para insertar: de una parte (ficha o propio) o del caso. */
export type DatoInsertable = DatoParte & { caso?: boolean };

export const deCaso = (c: CampoPropio): DatoInsertable => {
    const clave = claveCampo(c.clave);
    return { clave, etiqueta: c.etiqueta.trim() || etiquetaRol(clave), tipo: c.tipo, requerido: c.requerido, caso: true };
};

export const datosDe = (grupos: readonly GrupoDatos[]): DatoParte[] => grupos.flatMap((g) => g.datos);

/** «vendedor.nombre» (ficha) o «vendedor.datos.lugar» (dato propio). Con prefijo '' queda relativo al bloque. */
export const rutaDato = (d: DatoParte, prefijo: string): string =>
    `${prefijo}${d.ficha ? '' : 'datos.'}${d.clave}`;

export function marcadorDato(d: DatoInsertable, prefijo: string): string {
    if (d.caso) {
        return marcadorDeCampo({ clave: d.clave, etiqueta: d.etiqueta, tipo: d.tipo, requerido: d.requerido });
    }
    const filtros: FiltroMarcador[] = [];
    const f = FILTRO_TIPO[d.tipo];
    if (f) filtros.push({ nombre: f, args: [] });
    if (d.mayus && esTexto(d.tipo)) filtros.push({ nombre: 'mayus', args: [] });
    return armarMarcador({ ruta: rutaDato(d, prefijo), opcional: !d.requerido, filtros });
}

export const separarNombres = (entrada: string): string[] =>
    entrada.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

/* ---------------- Crear varios datos a la vez ---------------- */
export interface PlanDato {
    nombre: string;
    estado: 'nuevo' | 'existe' | 'invalido';
    dato?: DatoParte;
    motivo?: string;
}

/**
 * «Nombre, C.I., Lugar de nacimiento» → un dato de parte por cada nombre. Si coincide con la ficha de la persona
 * se toma de ahí; si no, es un dato propio que se llena en el expediente.
 * `otras` son etiquetas ya usadas por datos del caso (para no repetir nombres).
 */
export function planDatos(
    entrada: string,
    existentes: readonly DatoParte[],
    tipoDe: (clave: string) => TipoCampo,
    op: { tipo?: TipoCampo; requerido: boolean; mayus: boolean },
    otras: ReadonlySet<string> = new Set(),
): PlanDato[] {
    const nombres = separarNombres(entrada);
    const unico = nombres.length === 1;
    const etiquetas = new Set([...existentes.map((d) => claveCampo(d.etiqueta)), ...otras]);
    const claves = new Set(existentes.map((d) => `${d.ficha ? 'f' : 'd'}:${d.clave}`));

    return nombres.map((nombre): PlanDato => {
        const k = claveCampo(nombre);
        if (!k) return { nombre, estado: 'invalido', motivo: 'Usa letras o números' };
        if (etiquetas.has(k)) return { nombre, estado: 'existe', motivo: 'Ya existe un dato con ese nombre' };
        const f = datoDeFicha(nombre);
        const clave = f ? f.clave : k;
        const marca = `${f ? 'f' : 'd'}:${clave}`;
        if (claves.has(marca)) return { nombre, estado: 'existe', motivo: 'Ya tienes ese dato' };
        const tipo: TipoCampo = f ? f.tipo : unico && op.tipo ? op.tipo : tipoDe(clave);
        etiquetas.add(k);
        claves.add(marca);
        return {
            nombre,
            estado: 'nuevo',
            dato: {
                clave, etiqueta: nombre, tipo, requerido: op.requerido,
                ...(f ? { ficha: true } : {}),
                ...(op.mayus && esTexto(tipo) ? { mayus: true } : {}),
            },
        };
    });
}

/* ---------------- Crear varios datos del caso a la vez ---------------- */
export interface PlanCampo {
    nombre: string;
    estado: 'nuevo' | 'existe' | 'invalido';
    campo?: CampoPropio;
    motivo?: string;
}

export function planCampos(
    entrada: string,
    usadas: { etiquetas: ReadonlySet<string>; clavesCaso: ReadonlySet<string> },
    tipoDe: (clave: string) => TipoCampo,
    op: { tipo?: TipoCampo; requerido: boolean; grupo?: string },
): PlanCampo[] {
    const nombres = separarNombres(entrada);
    const unico = nombres.length === 1;
    const etiquetas = new Set(usadas.etiquetas);
    const claves = new Set(usadas.clavesCaso);

    return nombres.map((nombre): PlanCampo => {
        const k = claveCampo(nombre);
        if (!k) return { nombre, estado: 'invalido', motivo: 'Usa letras o números' };
        if (etiquetas.has(k) || claves.has(k)) return { nombre, estado: 'existe', motivo: 'Ya existe un dato con ese nombre' };
        etiquetas.add(k);
        claves.add(k);
        const tipo = unico && op.tipo ? op.tipo : tipoDe(k);
        return {
            nombre,
            estado: 'nuevo',
            campo: { clave: k, etiqueta: nombre, tipo, requerido: op.requerido, ...(op.grupo ? { grupo: op.grupo } : {}) },
        };
    });
}

/* ---------------- Redactar un párrafo mezclando texto y datos ---------------- */
export type PiezaFrase =
    | { t: 'txt'; v: string }
    | { t: 'campo'; v: string; campo: DatoInsertable }
    | { t: 'falta'; v: string };

const TOKEN = /\{\{?\s*([^{}\n]+?)\s*\}\}?/g;

/** El texto lleva los datos como «{Nombre}» (también acepta «{{Nombre}}»). */
export function partirFrase(texto: string, datos: readonly DatoInsertable[]): PiezaFrase[] {
    const salida: PiezaFrase[] = [];
    let ult = 0;
    for (const m of texto.matchAll(TOKEN)) {
        const i = m.index ?? 0;
        if (i > ult) salida.push({ t: 'txt', v: texto.slice(ult, i) });
        const k = claveCampo(m[1]);
        const campo = datos.find((c) => claveCampo(c.etiqueta) === k) ?? datos.find((c) => c.clave === k);
        salida.push(campo ? { t: 'campo', v: m[1], campo } : { t: 'falta', v: m[1] });
        ult = i + m[0].length;
    }
    if (ult < texto.length) salida.push({ t: 'txt', v: texto.slice(ult) });
    return salida;
}

export function armarFrase(
    texto: string, datos: readonly DatoInsertable[], prefijo: string,
): { texto: string; faltan: string[] } {
    const faltan: string[] = [];
    const s = partirFrase(texto, datos)
        .map((p) => {
            if (p.t === 'txt') return p.v;
            if (p.t === 'campo') return marcadorDato(p.campo, prefijo);
            faltan.push(p.v);
            return '';
        })
        .join('');
    return { texto: s, faltan };
}

/* ---------------- Asignar datos de parte (clic derecho) ---------------- */
const FICHA = new Set(CAMPOS_PERSONA.map(claveNormalizada));

function esDatoDePersona(segs: readonly string[]): boolean {
    const k = claveNormalizada(segs[0] ?? '');
    if (k === 'datos') return segs.length === 2 && !!segs[1];
    if (k === 'representante') return segs.length >= 2;
    return FICHA.has(k) && segs.length === 1;
}

export interface DatoAsignable {
    /** Rol actual (singular) o null si está sin asignar. */
    rol: string | null;
    /** Lo que sigue al rol: «nombre» o «datos.lugar». */
    resto: string;
}

/** ¿El marcador es un dato de parte que se puede (re)asignar? Los del caso, cliente, abogado y relativos no. */
export function datoAsignable(marcador: string, roles: readonly string[]): DatoAsignable | null {
    const a = analizarMarcador(marcador);
    if (!a || a.tipo !== 'valor') return null;
    const segs = a.ruta.split('.').map((s) => s.trim()).filter(Boolean);
    if (segs.length < 2) return null;
    const resto = segs.slice(1);
    if (!esDatoDePersona(resto)) return null;
    const raiz = claveNormalizada(segs[0]);
    if (raiz === ROL_PENDIENTE) return { rol: null, resto: resto.join('.') };
    const rol = roles.find((r) => mismoRol(r, raiz));
    return rol ? { rol: normalizarRol(rol), resto: resto.join('.') } : null;
}

/**
 * Nuevo marcador al asignar el dato a `rol` (null = dejarlo sin asignar).
 * Devuelve null si no aplica o no cambia nada. Un dato pendiente dentro del bloque de esa parte queda relativo.
 */
export function reasignarDato(
    marcador: string, rol: string | null, ambito: readonly string[], roles: readonly string[],
): string | null {
    const d = datoAsignable(marcador, roles);
    const a = analizarMarcador(marcador);
    if (!d || !a) return null;
    if (rol === null && d.rol === null) return null;
    if (rol !== null && d.rol !== null && mismoRol(d.rol, rol)) return null;
    const dentro = rol !== null && d.rol === null && ambito.some((x) => mismoRol(x, rol));
    const ruta = rol === null
        ? `${ROL_PENDIENTE}.${d.resto}`
        : dentro ? d.resto : `${normalizarRol(rol)}.${d.resto}`;
    return armarMarcador({ ruta, opcional: a.opcional, filtros: a.filtros });
}