import { datoDeFicha } from './catalogo';
import type { DatoParte, GrupoDatos, TipoCampo } from './fuenteModelo';
import { armarMarcador, type FiltroMarcador } from './marcadores';
import { claveCampo } from './texto';

const FILTRO_TIPO: Partial<Record<TipoCampo, string>> = { fecha: 'fecha', moneda: 'moneda', superficie: 'superficie' };
const esTexto = (t: TipoCampo) => t === 'texto' || t === 'texto_largo';

export const datosDe = (grupos: readonly GrupoDatos[]): DatoParte[] => grupos.flatMap((g) => g.datos);

/** «vendedor.nombre» (ficha) o «vendedor.datos.lugar» (dato propio). Con prefijo '' queda relativo al bloque. */
export const rutaDato = (d: DatoParte, prefijo: string): string =>
    `${prefijo}${d.ficha ? '' : 'datos.'}${d.clave}`;

export function marcadorDato(d: DatoParte, prefijo: string): string {
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
 * «Nombre, C.I., Lugar de nacimiento» → un dato por cada nombre. Si coincide con la ficha de la persona
 * (nombre, C.I., domicilio…) se toma de ahí; si no, es un dato propio que se llena en el expediente.
 * `existentes` son los datos de TODOS los grupos: un dato no se repite entre grupos.
 */
export function planDatos(
    entrada: string,
    existentes: readonly DatoParte[],
    tipoDe: (clave: string) => TipoCampo,
    op: { tipo?: TipoCampo; requerido: boolean; mayus: boolean },
): PlanDato[] {
    const nombres = separarNombres(entrada);
    const unico = nombres.length === 1;
    const etiquetas = new Set(existentes.map((d) => claveCampo(d.etiqueta)));
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

/* ---------------- Redactar un párrafo mezclando texto y datos ---------------- */
export type PiezaFrase =
    | { t: 'txt'; v: string }
    | { t: 'campo'; v: string; campo: DatoParte }
    | { t: 'falta'; v: string };

const TOKEN = /\{\{?\s*([^{}\n]+?)\s*\}\}?/g;

/** El texto lleva los datos como «{Nombre}» (también acepta «{{Nombre}}»). */
export function partirFrase(texto: string, datos: readonly DatoParte[]): PiezaFrase[] {
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
    texto: string, datos: readonly DatoParte[], prefijo: string,
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