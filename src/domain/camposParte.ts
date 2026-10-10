import { datoDeFicha, mismoRol } from './catalogo';
import type { CampoParte, TipoCampo } from './fuenteModelo';
import { armarMarcador, type FiltroMarcador } from './marcadores';
import { claveCampo } from './texto';

const FILTRO_TIPO: Partial<Record<TipoCampo, string>> = { fecha: 'fecha', moneda: 'moneda', superficie: 'superficie' };
const esTexto = (t: TipoCampo) => t === 'texto' || t === 'texto_largo';

/** «vendedor.nombre» (ficha) o «vendedor.datos.lugar» (dato propio). Con prefijo '' queda relativo al bloque. */
export const rutaCampoParte = (c: CampoParte, prefijo: string): string =>
    `${prefijo}${c.ficha ? '' : 'datos.'}${c.clave}`;

export function marcadorCampoParte(c: CampoParte, prefijo: string): string {
    const filtros: FiltroMarcador[] = [];
    const f = FILTRO_TIPO[c.tipo];
    if (f) filtros.push({ nombre: f, args: [] });
    if (c.mayus && esTexto(c.tipo)) filtros.push({ nombre: 'mayus', args: [] });
    return armarMarcador({ ruta: rutaCampoParte(c, prefijo), opcional: !c.requerido, filtros });
}

/** Campos de un rol (singular o plural). */
export const camposDeRol = (todos: readonly CampoParte[], rol: string): CampoParte[] =>
    todos.filter((c) => mismoRol(c.rol, rol));

export const separarNombres = (entrada: string): string[] =>
    entrada.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

/* ---------------- Crear varios campos a la vez ---------------- */
export interface PlanCampo {
    nombre: string;
    estado: 'nuevo' | 'existe' | 'invalido';
    campo?: CampoParte;
    motivo?: string;
}

export function planCampos(
    entrada: string,
    rol: string,
    existentes: readonly CampoParte[],
    permitirPropios: boolean,
    tipoDe: (clave: string) => TipoCampo,
    op: { tipo?: TipoCampo; requerido: boolean; mayus: boolean },
): PlanCampo[] {
    const nombres = separarNombres(entrada);
    const unico = nombres.length === 1;
    const etiquetas = new Set(existentes.map((c) => claveCampo(c.etiqueta)));
    const claves = new Set(existentes.map((c) => `${c.ficha ? 'f' : 'd'}:${c.clave}`));

    return nombres.map((nombre): PlanCampo => {
        const k = claveCampo(nombre);
        if (!k) return { nombre, estado: 'invalido', motivo: 'Usa letras o números' };
        if (etiquetas.has(k)) return { nombre, estado: 'existe', motivo: 'Ya existe un campo con ese nombre' };
        const f = datoDeFicha(nombre, rol);
        const clave = f ? f.clave : k;
        const marca = `${f ? 'f' : 'd'}:${clave}`;
        if (claves.has(marca)) return { nombre, estado: 'existe', motivo: 'Ya tienes ese dato' };
        if (!f && !permitirPropios) {
            return { nombre, estado: 'invalido', motivo: 'Aquí solo se usan datos de la ficha (nombre, C.I., domicilio…)' };
        }
        const tipo: TipoCampo = f ? f.tipo : unico && op.tipo ? op.tipo : tipoDe(clave);
        etiquetas.add(k);
        claves.add(marca);
        return {
            nombre,
            estado: 'nuevo',
            campo: {
                rol, clave, etiqueta: nombre, tipo, requerido: op.requerido,
                ...(f ? { ficha: true } : {}),
                ...(op.mayus && esTexto(tipo) ? { mayus: true } : {}),
            },
        };
    });
}

/* ---------------- Redactar un párrafo mezclando texto y campos ---------------- */
export type PiezaFrase =
    | { t: 'txt'; v: string }
    | { t: 'campo'; v: string; campo: CampoParte }
    | { t: 'falta'; v: string };

const TOKEN = /\{\{?\s*([^{}\n]+?)\s*\}\}?/g;

/** El texto lleva los campos como «{Nombre}» (también acepta «{{Nombre}}»). */
export function partirFrase(texto: string, campos: readonly CampoParte[]): PiezaFrase[] {
    const salida: PiezaFrase[] = [];
    let ult = 0;
    for (const m of texto.matchAll(TOKEN)) {
        const i = m.index ?? 0;
        if (i > ult) salida.push({ t: 'txt', v: texto.slice(ult, i) });
        const k = claveCampo(m[1]);
        const campo = campos.find((c) => claveCampo(c.etiqueta) === k) ?? campos.find((c) => c.clave === k);
        salida.push(campo ? { t: 'campo', v: m[1], campo } : { t: 'falta', v: m[1] });
        ult = i + m[0].length;
    }
    if (ult < texto.length) salida.push({ t: 'txt', v: texto.slice(ult) });
    return salida;
}

export function armarFrase(
    texto: string, campos: readonly CampoParte[], prefijo: string,
): { texto: string; faltan: string[] } {
    const faltan: string[] = [];
    const s = partirFrase(texto, campos)
        .map((p) => {
            if (p.t === 'txt') return p.v;
            if (p.t === 'campo') return marcadorCampoParte(p.campo, prefijo);
            faltan.push(p.v);
            return '';
        })
        .join('');
    return { texto: s, faltan };
}