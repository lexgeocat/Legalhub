export class ErrorDeSintaxis extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ErrorDeSintaxis';
    }
}

export interface LlamadaFiltro {
    nombre: string;
    args: string[];
}

export type Token =
    | { tipo: 'valor'; ruta: string; opcional: boolean; filtros: LlamadaFiltro[] }
    | { tipo: 'apertura'; ruta: string }
    | { tipo: 'cierre'; ruta: string };

const IDENT = /^[\p{L}_][\p{L}\p{N}_]*$/u;

export const mensaje = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Reemplazo 1 a 1 (conserva las posiciones): comillas tipográficas y espacios duros. */
export function normalizarCaracteres(s: string): string {
    return s
        .replace(/[“”«»„]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\u00A0/g, ' ');
}

export { claveNormalizada } from '../../domain/texto';
function dividir(s: string, sep: string): string[] {
    const partes: string[] = [];
    let actual = '';
    let dentro = false;
    for (const ch of s) {
        if (ch === '"') dentro = !dentro;
        if (ch === sep && !dentro) {
            partes.push(actual);
            actual = '';
        } else {
            actual += ch;
        }
    }
    if (dentro) throw new ErrorDeSintaxis('Comillas sin cerrar');
    partes.push(actual);
    return partes;
}

function validarRuta(texto: string): string {
    const ruta = texto.trim();
    if (ruta === '.') return ruta;
    if (!ruta || !ruta.split('.').every((p) => IDENT.test(p))) {
        throw new ErrorDeSintaxis(`Ruta inválida: «${ruta}»`);
    }
    return ruta;
}

function parsearFiltro(texto: string): LlamadaFiltro {
    const [nombre, ...args] = dividir(texto, ':').map((p) => p.trim());
    if (!IDENT.test(nombre)) throw new ErrorDeSintaxis(`Nombre de filtro inválido: «${nombre}»`);
    return {
        nombre: nombre.toLowerCase(),
        args: args.map((a) => {
            const m = /^"([\s\S]*)"$/.exec(a);
            if (!m) throw new ErrorDeSintaxis(`El argumento debe ir entre comillas: «${a}»`);
            return m[1];
        }),
    };
}

export function parsearToken(crudo: string): Token {
    const s = normalizarCaracteres(crudo).trim();
    if (s.startsWith('#')) return { tipo: 'apertura', ruta: validarRuta(s.slice(1)) };
    if (s.startsWith('/')) return { tipo: 'cierre', ruta: validarRuta(s.slice(1)) };
    const [rutaTxt, ...filtrosTxt] = dividir(s, '|');
    const limpia = rutaTxt.trim();
    const opcional = limpia.endsWith('?');
    return {
        tipo: 'valor',
        ruta: validarRuta(opcional ? limpia.slice(0, -1) : limpia),
        opcional,
        filtros: filtrosTxt.map(parsearFiltro),
    };
}