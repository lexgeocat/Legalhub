import {
    useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
    type CSSProperties, type ReactNode, type RefObject,
} from 'react';
import type { ConfigPagina } from '../domain/fuenteModelo';
import {
    alturaSalto, alturaTotal, crearGeometria, exclusiones, margenesLaterales, paginasCota, paginasPara,
    type Exclusion, type GeometriaPagina,
} from '../domain/paginacion';

const LARGO_MARCA = 14;
const MAX_ITERACIONES = 8;
const MAX_HOJAS = 4000;

export interface Paginacion {
    geo: GeometriaPagina;
    paginas: number;
    /** Hojas blancas (van detrás del texto). */
    fondos: ReactNode;
    /** Contenedor del flujo: contiene a `refExcl` y, justo después, a la raíz del texto. */
    refFlujo: RefObject<HTMLDivElement | null>;
    /** Contenedor (vacío) donde el hook coloca las franjas. Va ANTES de la raíz del texto. */
    refExcl: RefObject<HTMLDivElement | null>;
    estiloCaja: CSSProperties;
    estiloRaiz: CSSProperties;
    remedir: () => void;
}

const esSalto = (n: Element) => (n as HTMLElement).dataset?.salto !== undefined;

/**
 * Apila floats contiguos con `clear`, SIN márgenes (el margen de un float también excluye texto).
 * - Franja completa: 100 % de ancho; el texto baja hasta debajo de ella.
 * - Zona de texto: un float estrecho en los bordes (margen lateral extra) o, si no hace falta,
 *   un testigo de 1 px en el borde derecho (cae dentro del relleno de la raíz) que mantiene la pila contigua.
 */
function construirExclusiones(cont: HTMLElement, lista: readonly Exclusion[]): void {
    const frag = document.createDocumentFragment();
    const flotante = (lado: 'left' | 'right', ancho: string, alto: number, limpiar: 'both' | 'right') => {
        const d = document.createElement('div');
        d.style.cssText =
            `float:${lado};clear:${limpiar};width:${ancho};height:${alto}px;margin:0;padding:0;border:0;`;
        frag.appendChild(d);
    };
    for (const e of lista) {
        const alto = e.y1 - e.y0;
        if (e.completa) {
            flotante('left', '100%', alto, 'both');
        } else if (e.izq > 0) {
            flotante('left', `${e.izq}px`, alto, 'both');
            if (e.der > 0) flotante('right', `${e.der}px`, alto, 'right');
        } else if (e.der > 0) {
            flotante('right', `${e.der}px`, alto, 'both');
        } else {
            flotante('right', '1px', alto, 'both');
        }
    }
    cont.replaceChildren(frag);
}

function PaginaFondo({ g, k, total }: { g: GeometriaPagina; k: number; total: number }) {
    const { izq, der } = margenesLaterales(g, k);
    const x1 = izq;
    const x2 = g.ancho - der;
    const y1 = g.mSup;
    const y2 = g.alto - g.mInf;
    const m = (v: number) => Math.min(LARGO_MARCA, Math.max(0, v));
    const d = [
        `M${x1 - m(x1)} ${y1}H${x1}V${y1 - m(y1)}`,
        `M${x2 + m(g.ancho - x2)} ${y1}H${x2}V${y1 - m(y1)}`,
        `M${x1 - m(x1)} ${y2}H${x1}V${y2 + m(g.mInf)}`,
        `M${x2 + m(g.ancho - x2)} ${y2}H${x2}V${y2 + m(g.mInf)}`,
    ].join('');
    return (
        <div className="pg-hoja" style={{ top: k * g.paso, width: g.ancho, height: g.alto }}>
            <svg width={g.ancho} height={g.alto} viewBox={`0 0 ${g.ancho} ${g.alto}`} aria-hidden="true">
                <path d={d} />
            </svg>
            {g.mInf >= 28 && (
                <span className="pg-num" style={{ top: g.alto - g.mInf / 2 - 6 }}>{k + 1} / {total}</span>
            )}
        </div>
    );
}

/**
 * Paginación continua para un flujo de bloques (editor o visor).
 * `version` fuerza una nueva medición cuando cambia el contenido gestionado por React.
 */
export function usePaginacion(
    refRaiz: RefObject<HTMLElement | null>,
    config: Pick<ConfigPagina, 'tamano' | 'simetricos' | 'margenes'>,
    pxPorCm: number,
    version?: unknown,
): Paginacion {
    const { tamano, simetricos } = config;
    const { superior, inferior, izquierdo, derecho } = config.margenes;
    const geo = useMemo(
        () => crearGeometria({ tamano, simetricos, margenes: { superior, inferior, izquierdo, derecho } }, pxPorCm),
        [tamano, simetricos, superior, inferior, izquierdo, derecho, pxPorCm],
    );

    const refFlujo = useRef<HTMLDivElement>(null);
    const refExcl = useRef<HTMLDivElement>(null);
    const [paginas, setPaginas] = useState(1);
    const geoRef = useRef(geo);
    const estado = useRef<{ geo: GeometriaPagina | null; f: number; alto: string }>({ geo: null, f: 0, alto: '' });

    const medir = useCallback(() => {
        const raiz = refRaiz.current;
        const flujo = refFlujo.current;
        const excl = refExcl.current;
        if (!raiz || !flujo || !excl) return;
        const g = geoRef.current;
        const st = estado.current;

        const origen = () => flujo.getBoundingClientRect().top;

        /** Cada salto de página mide lo necesario para que lo siguiente empiece en la hoja siguiente. */
        const ajustarSaltos = () => {
            for (const s of Array.from(raiz.children)) {
                if (!esSalto(s)) continue;
                const el = s as HTMLElement;
                const h = alturaSalto(g, el.getBoundingClientRect().top - origen());
                const actual = Number.parseFloat(el.style.height) || 0;
                if (Math.abs(actual - h) > 0.02) el.style.height = `${h}px`;
            }
        };
        const fondoTexto = () => {
            const ultimo = raiz.lastElementChild;
            return ultimo ? ultimo.getBoundingClientRect().bottom - origen() : 0;
        };

        // `f` = hojas con franjas construidas. Debe ser (hojas usadas + 1): una de reserva.
        let f = Math.max(2, st.f);
        let n = 1;
        for (let i = 0; i < MAX_ITERACIONES; i++) {
            if (st.geo !== g || st.f !== f) {
                construirExclusiones(excl, exclusiones(g, f));
                st.geo = g;
                st.f = f;
            }
            ajustarSaltos();
            const yb = fondoTexto();
            n = paginasPara(g, yb);
            if (n + 1 <= f) {
                if (f > 2 * n + 8) {
                    f = n + 3; // sobran muchas hojas (borraste texto): recorta
                    continue;
                }
                break;
            }
            // El texto desbordó las franjas construidas: estima de una vez cuántas hacen falta (pegados grandes).
            f = Math.min(MAX_HOJAS, Math.max(n + 1, paginasCota(g, yb, f)));
        }

        const alto = `${alturaTotal(g, n)}px`;
        if (st.alto !== alto) {
            flujo.style.height = alto;
            (raiz as HTMLElement).style.minHeight = alto;
            st.alto = alto;
        }
        setPaginas(n);
    }, [refRaiz]);

    useLayoutEffect(() => {
        geoRef.current = geo;
        medir();
    }, [geo, medir, version]);

    useEffect(() => {
        const el = refRaiz.current;
        if (!el) return;
        let cuadro = 0;
        const programar = () => {
            cancelAnimationFrame(cuadro);
            cuadro = requestAnimationFrame(medir);
        };
        const o = new ResizeObserver(programar);
        o.observe(el);
        const fuentes = document.fonts;
        void fuentes?.ready.then(programar);
        fuentes?.addEventListener('loadingdone', programar);
        return () => {
            cancelAnimationFrame(cuadro);
            o.disconnect();
            fuentes?.removeEventListener('loadingdone', programar);
        };
    }, [refRaiz, medir]);

    const fondos = useMemo(
        () => (
            <div className="pg-fondos" aria-hidden="true">
                {Array.from({ length: paginas }, (_, k) => <PaginaFondo key={k} g={geo} k={k} total={paginas} />)}
            </div>
        ),
        [geo, paginas],
    );
    const estiloCaja = useMemo<CSSProperties>(() => ({ width: geo.ancho }), [geo]);
    // 1px arriba: evita que el margen del primer bloque «escape» de la raíz.
    const estiloRaiz = useMemo<CSSProperties>(
        () => ({ padding: `1px ${geo.padDer}px 0 ${geo.padIzq}px` }),
        [geo],
    );

    return { geo, paginas, fondos, refFlujo, refExcl, estiloCaja, estiloRaiz, remedir: medir };
}