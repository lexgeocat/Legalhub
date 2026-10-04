import { PAGINA_CM, margenesSeguros, type ConfigPagina } from './fuenteModelo';

export const GAP_PAGINAS_PX = 16;

export interface GeometriaPagina {
    ancho: number;
    alto: number;
    gap: number;
    paso: number;
    mSup: number;
    mInf: number;
    izq: number;
    der: number;
    simetricos: boolean;
    padIzq: number;
    padDer: number;
}

export interface Intervalo { a: number; b: number }

export interface Banda {
    y0: number;
    y1: number;
    zona: boolean;
    izq: number;
    der: number;
}

export function crearGeometria(
    c: Pick<ConfigPagina, 'tamano' | 'margenes' | 'simetricos'>,
    pxPorCm: number,
    gap: number = GAP_PAGINAS_PX,
): GeometriaPagina {
    const p = PAGINA_CM[c.tamano] ?? PAGINA_CM.carta;
    const m = margenesSeguros(c.margenes, c.tamano);
    const px = (cm: number) => cm * pxPorCm;
    const alto = px(p.h);
    const izq = px(m.izquierdo);
    const der = px(m.derecho);
    const simetricos = !!c.simetricos;
    const minimo = Math.min(izq, der);
    return {
        ancho: px(p.w), alto, gap, paso: alto + gap,
        mSup: px(m.superior), mInf: px(m.inferior),
        izq, der, simetricos,
        padIzq: simetricos ? minimo : izq,
        padDer: simetricos ? minimo : der,
    };
}

export function margenesLaterales(g: GeometriaPagina, k: number): { izq: number; der: number } {
    if (!g.simetricos || k % 2 === 0) return { izq: g.izq, der: g.der };
    return { izq: g.der, der: g.izq };
}

export const alturaTotal = (g: GeometriaPagina, paginas: number) => (Math.max(1, paginas) - 1) * g.paso + g.alto;

export function paginasPara(g: GeometriaPagina, yInferior: number): number {
    if (!(yInferior > 0)) return 1;
    return Math.max(1, Math.floor((yInferior - 1) / g.paso) + 1);
}

export function intervaloSalto(g: GeometriaPagina, yInferiorMarcador: number): Intervalo {
    const k = Math.max(0, Math.floor((yInferiorMarcador - 1) / g.paso));
    return { a: yInferiorMarcador, b: (k + 1) * g.paso + g.mSup };
}

export function calcularBandas(g: GeometriaPagina, paginas: number, forzados: readonly Intervalo[] = []): Banda[] {
    const n = Math.max(1, Math.floor(paginas));
    const orden = forzados.filter((f) => f.b > f.a).sort((x, y) => x.a - y.a);
    const bandas: Banda[] = [];
    const poner = (y0: number, y1: number, zona: boolean, izq = 0, der = 0) => {
        if (y1 - y0 > 0.01) bandas.push({ y0, y1, zona, izq, der });
    };

    poner(0, g.mSup, true);
    for (let k = 0; k < n; k++) {
        const base = k * g.paso;
        const ini = base + g.mSup;
        const fin = base + g.alto - g.mInf;
        const { izq, der } = margenesLaterales(g, k);

        let cursor = ini;
        for (const f of orden) {
            if (f.b <= cursor || f.a >= fin) continue;
            const a = Math.max(f.a, cursor);
            poner(cursor, a, false, izq, der);
            const b = Math.min(f.b, fin);
            poner(a, b, true);
            cursor = b;
        }
        poner(cursor, fin, false, izq, der);

        const siguiente = k + 1 < n ? (k + 1) * g.paso + g.mSup : base + g.alto;
        poner(fin, siguiente, true);
    }
    return bandas;
}

export interface PoligonosExclusion {
    izq: string;
    der: string;
    alto: number;
}

const f2 = (n: number) => `${Math.round(n * 100) / 100}px`;

export function poligonosExclusion(g: GeometriaPagina, bandas: readonly Banda[], paginas: number): PoligonosExclusion {
    const alto = alturaTotal(g, paginas);
    const mitad = g.ancho / 2;
    const pi: string[] = [`${f2(0)} ${f2(0)}`];
    const pd: string[] = [`${f2(mitad)} ${f2(0)}`];
    for (const b of bandas) {
        const xi = b.zona ? mitad : Math.min(Math.max(0, b.izq), mitad);
        const xd = b.zona ? 0 : Math.max(0, mitad - Math.min(Math.max(0, b.der), mitad));
        pi.push(`${f2(xi)} ${f2(b.y0)}`, `${f2(xi)} ${f2(b.y1)}`);
        pd.push(`${f2(xd)} ${f2(b.y0)}`, `${f2(xd)} ${f2(b.y1)}`);
    }
    pi.push(`${f2(0)} ${f2(alto)}`);
    pd.push(`${f2(mitad)} ${f2(alto)}`);
    return { izq: `polygon(${pi.join(', ')})`, der: `polygon(${pd.join(', ')})`, alto };
}