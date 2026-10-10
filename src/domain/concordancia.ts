import { aFemenino } from './personas';

export interface FormasConcordancia { sm: string; sf: string; pm: string; pf: string }

const SIN_TILDE: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };

const ARTICULOS: Record<string, FormasConcordancia> = {
    el: { sm: 'el', sf: 'la', pm: 'los', pf: 'las' },
    del: { sm: 'del', sf: 'de la', pm: 'de los', pf: 'de las' },
    al: { sm: 'al', sf: 'a la', pm: 'a los', pf: 'a las' },
    un: { sm: 'un', sf: 'una', pm: 'unos', pf: 'unas' },
    este: { sm: 'este', sf: 'esta', pm: 'estos', pf: 'estas' },
    ese: { sm: 'ese', sf: 'esa', pm: 'esos', pf: 'esas' },
    aquel: { sm: 'aquel', sf: 'aquella', pm: 'aquellos', pf: 'aquellas' },
};
const INVARIABLES = new Set(['mayor', 'menor', 'mejor', 'peor']);

const articulo = (p: string): FormasConcordancia | undefined => (Object.hasOwn(ARTICULOS, p) ? ARTICULOS[p] : undefined);

export function pluralizar(p: string): string {
    if (!p) return p;
    const acento = /^(.*)([áéíóú])([ns])$/i.exec(p);
    if (acento) return `${acento[1]}${SIN_TILDE[acento[2].toLowerCase()]}${acento[3]}es`;
    if (/[aeiouáéíóú]$/i.test(p)) return `${p}s`;
    if (/z$/i.test(p)) return `${p.slice(0, -1)}ces`;
    if (/[sx]$/i.test(p)) return p;
    return `${p}es`;
}

function simple(p: string): FormasConcordancia {
    const a = articulo(p);
    if (a) return a;
    if (INVARIABLES.has(p)) return { sm: p, sf: p, pm: pluralizar(p), pf: pluralizar(p) };
    const f = aFemenino(p);
    return { sm: p, sf: f, pm: pluralizar(p), pf: pluralizar(f) };
}

function copiarCaja(modelo: string, texto: string): string {
    if (!texto) return texto;
    if (modelo.length > 1 && modelo === modelo.toUpperCase() && modelo !== modelo.toLowerCase()) return texto.toUpperCase();
    const c = modelo.charAt(0);
    return c !== c.toLowerCase() ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}

export function formasConcordancia(entrada: string): FormasConcordancia {
    const t = entrada.trim().replace(/\s+/g, ' ');
    if (!t) return { sm: '', sf: '', pm: '', pf: '' };
    const [primera, ...resto] = t.toLowerCase().split(' ');
    const art = articulo(primera);
    let f: FormasConcordancia;
    if (resto.length === 0) {
        f = simple(primera);
    } else if (art && resto.length === 1) {
        const n = simple(resto[0]);
        f = { sm: `${art.sm} ${n.sm}`, sf: `${art.sf} ${n.sf}`, pm: `${art.pm} ${n.pm}`, pf: `${art.pf} ${n.pf}` };
    } else {
        const cola = resto.join(' ');
        const sg = `${primera} ${cola}`;
        const pl = `${pluralizar(primera)} ${cola}`;
        f = { sm: sg, sf: sg, pm: pl, pf: pl };
    }
    return { sm: copiarCaja(t, f.sm), sf: copiarCaja(t, f.sf), pm: copiarCaja(t, f.pm), pf: copiarCaja(t, f.pf) };
}