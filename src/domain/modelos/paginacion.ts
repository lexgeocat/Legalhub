import { PAGINA_CM, margenesSeguros, type ConfigPagina } from './fuenteModelo';

/** Separación visual entre hojas (px). */
export const GAP_PAGINAS_PX = 20;

/** Chromium maqueta en múltiplos de 1/64 px: alinear la geometría a esa rejilla evita deriva acumulada entre franjas. */
const snap = (n: number) => Math.round(n * 64) / 64;

export interface GeometriaPagina {
    ancho: number;
    alto: number;
    gap: number;
    /** Distancia entre el borde superior de una hoja y el de la siguiente. */
    paso: number;
    mSup: number;
    mInf: number;
    izq: number;
    der: number;
    simetricos: boolean;
    /** Relleno lateral fijo del texto. Con márgenes simétricos es el menor de los dos; el resto lo ponen las exclusiones. */
    padIzq: number;
    padDer: number;
}

/**
 * Tramo vertical del flujo. Los tramos son contiguos (cada y0 es el y1 del anterior) y no llevan márgenes:
 * el margen de un float también excluye texto, así que la posición sale solo de apilar alturas.
 */
export interface Exclusion {
    y0: number;
    y1: number;
    /** true: ancho completo (margen inferior + separación + margen superior). false: área de texto de una hoja. */
    completa: boolean;
    /** Solo si !completa: ancho libre de texto medido desde el borde de la hoja; 0 si basta el relleno de la raíz. */
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
    const px = (cm: number) => snap(cm * pxPorCm);
    const alto = px(p.h);
    const izq = px(m.izquierdo);
    const der = px(m.derecho);
    const simetricos = !!c.simetricos;
    const minimo = Math.min(izq, der);
    return {
        ancho: px(p.w), alto, gap: snap(gap), paso: snap(alto + gap),
        mSup: px(m.superior), mInf: px(m.inferior),
        izq, der, simetricos,
        padIzq: simetricos ? minimo : izq,
        padDer: simetricos ? minimo : der,
    };
}

/** Márgenes laterales de la hoja k (0 = primera). Con márgenes simétricos se invierten en las impares. */
export function margenesLaterales(g: GeometriaPagina, k: number): { izq: number; der: number } {
    if (!g.simetricos || k % 2 === 0) return { izq: g.izq, der: g.der };
    return { izq: g.der, der: g.izq };
}

export const inicioContenido = (g: GeometriaPagina, k: number) => snap(k * g.paso + g.mSup);
export const finContenido = (g: GeometriaPagina, k: number) => snap(k * g.paso + g.alto - g.mInf);
export const alturaTotal = (g: GeometriaPagina, paginas: number) =>
    snap((Math.max(1, Math.floor(paginas)) - 1) * g.paso + g.alto);

/** Altura de la franja entre dos áreas de texto (margen inferior + separación + margen superior). */
export const alturaFranja = (g: GeometriaPagina) => g.mInf + g.gap + g.mSup;

/** Páginas que ocupa un texto cuyo borde inferior está en y (px desde el borde superior de la primera hoja). */
export function paginasPara(g: GeometriaPagina, yInferior: number): number {
    if (!(yInferior > 0)) return 1;
    return Math.max(1, Math.floor((yInferior - 1) / g.paso) + 1);
}

export const paginaDe = (g: GeometriaPagina, y: number) => Math.max(0, Math.floor(y / g.paso));

/** Altura de un salto de página que empieza en y para que lo siguiente caiga al inicio de la hoja siguiente. */
export function alturaSalto(g: GeometriaPagina, y: number): number {
    return snap(Math.max(0, inicioContenido(g, paginaDe(g, y) + 1) - y));
}

/**
 * Cota alta de las hojas que hacen falta cuando el texto desbordó las `hojasConstruidas` que tenían franjas.
 * Descuenta las franjas ya existentes para obtener la altura neta y deja un 10 % por cortes de línea.
 */
export function paginasCota(g: GeometriaPagina, yTexto: number, hojasConstruidas: number): number {
    const util = Math.max(1, g.alto - g.mSup - g.mInf);
    const neta = Math.max(0, yTexto - hojasConstruidas * alturaFranja(g) - g.mSup);
    return Math.max(1, Math.ceil(neta / (util * 0.9)) + 2);
}

/** Franja superior de la 1.ª hoja y, por cada hoja, su área de texto y la franja que la separa de la siguiente. */
export function exclusiones(g: GeometriaPagina, paginas: number): Exclusion[] {
    const n = Math.max(1, Math.floor(paginas));
    const salida: Exclusion[] = [];
    const poner = (e: Exclusion) => {
        if (e.y1 - e.y0 > 0.01) salida.push(e);
    };
    poner({ y0: 0, y1: g.mSup, completa: true, izq: 0, der: 0 });
    for (let k = 0; k < n; k++) {
        const { izq, der } = margenesLaterales(g, k);
        poner({
            y0: inicioContenido(g, k),
            y1: finContenido(g, k),
            completa: false,
            izq: izq > g.padIzq + 0.01 ? izq : 0,
            der: der > g.padDer + 0.01 ? der : 0,
        });
        poner({ y0: finContenido(g, k), y1: inicioContenido(g, k + 1), completa: true, izq: 0, der: 0 });
    }
    return salida;
}