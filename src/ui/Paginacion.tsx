import {
    useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
    type CSSProperties, type ReactNode, type RefObject,
} from 'react';
import type { ConfigPagina } from '../domain/fuenteModelo';
import {
    calcularBandas, crearGeometria, intervaloSalto, margenesLaterales, paginasPara, poligonosExclusion,
    type GeometriaPagina, type Intervalo,
} from '../domain/Paginacion';

const LARGO_MARCA = 14;
const MAX_ITERACIONES = 40;

export interface Paginacion {
    geo: GeometriaPagina;
    paginas: number;
    capas: ReactNode;
    estiloRaiz: CSSProperties;
    remedir: () => void;
}

const esSalto = (n: Element) => (n as HTMLElement).dataset?.salto !== undefined;

const mismos = (a: readonly Intervalo[], b: readonly Intervalo[]) =>
    a.length === b.length && a.every((x, i) => Math.abs(x.a - b[i].a) < 0.75 && Math.abs(x.b - b[i].b) < 0.75);

function PaginaFondo({ g, k }: { g: GeometriaPagina; k: number }) {
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
        </div>
    );
}

export function usePaginacion(
    raiz: RefObject<HTMLElement | null>,
    config: ConfigPagina,
    pxPorCm: number,
    version?: unknown,
): Paginacion {
    const { tamano, simetricos } = config;
    const { superior, inferior, izquierdo, derecho } = config.margenes;
    const geo = useMemo(
        () => crearGeometria({ tamano, simetricos, margenes: { superior, inferior, izquierdo, derecho } }, pxPorCm),
        [tamano, simetricos, superior, inferior, izquierdo, derecho, pxPorCm],
    );

    const [paginas, setPaginas] = useState(1);
    const flotIzq = useRef<HTMLDivElement>(null);
    const flotDer = useRef<HTMLDivElement>(null);
    const geoRef = useRef(geo);
    const estado = useRef({ n: 1, forzados: [] as Intervalo[], izq: '', der: '', alto: '' });

    const medir = useCallback(() => {
        const el = raiz.current;
        const fi = flotIzq.current;
        const fd = flotDer.current;
        if (!el || !fi || !fd) return;
        const g = geoRef.current;
        const st = estado.current;

        const aplicar = (n: number, forzados: readonly Intervalo[]) => {
            const p = poligonosExclusion(g, calcularBandas(g, n, forzados), n);
            const alto = `${Math.round(p.alto * 100) / 100}px`;
            if (st.izq !== p.izq) { fi.style.setProperty('shape-outside', p.izq); st.izq = p.izq; }
            if (st.der !== p.der) { fd.style.setProperty('shape-outside', p.der); st.der = p.der; }
            if (st.alto !== alto) {
                fi.style.height = alto;
                fd.style.height = alto;
                el.style.minHeight = alto;
                st.alto = alto;
            }
        };

        const leer = () => {
            const arriba = el.getBoundingClientRect().top;
            const hijos = Array.from(el.children);
            const saltos = hijos.filter(esSalto).map((h) => intervaloSalto(g, h.getBoundingClientRect().bottom - arriba));
            const ultimo = hijos[hijos.length - 1];
            const yb = ultimo ? ultimo.getBoundingClientRect().bottom - arriba : 0;
            return { saltos, yb };
        };

        let nf = Math.max(st.n, Math.ceil(el.scrollHeight / g.paso), 1);
        let forzados = st.forzados;
        let n = st.n;
        for (let i = 0; i < MAX_ITERACIONES; i++) {
            aplicar(nf, forzados);
            const { saltos, yb } = leer();
            if (!mismos(saltos, forzados)) {
                forzados = saltos;
                continue;
            }
            n = paginasPara(g, yb);
            if (n === nf) break;
            nf = n > nf ? n + 1 : n;
        }
        aplicar(n, forzados);
        st.n = n;
        st.forzados = forzados;
        setPaginas(n);
    }, [raiz]);

    useLayoutEffect(() => {
        geoRef.current = geo;
        medir();
    }, [geo, medir, version]);

    useEffect(() => {
        const el = raiz.current;
        if (!el) return;
        let cuadro = 0;
        const programar = () => {
            cancelAnimationFrame(cuadro);
            cuadro = requestAnimationFrame(medir);
        };
        const o = new ResizeObserver(programar);
        o.observe(el);
        void document.fonts?.ready.then(programar);
        return () => {
            cancelAnimationFrame(cuadro);
            o.disconnect();
        };
    }, [raiz, medir]);

    const capas = useMemo(
        () => (
            <>
                <div className="pg-capa" aria-hidden="true">
                    {Array.from({ length: paginas }, (_, k) => <PaginaFondo key={k} g={geo} k={k} />)}
                </div>
                <div ref={flotIzq} className="pg-excl pg-excl-izq" aria-hidden="true" />
                <div ref={flotDer} className="pg-excl pg-excl-der" aria-hidden="true" />
            </>
        ),
        [geo, paginas],
    );

    const estiloRaiz = useMemo<CSSProperties>(
        () => ({
            position: 'relative',
            zIndex: 1,
            padding: `${geo.mSup}px ${geo.padDer}px 0 ${geo.padIzq}px`,
        }),
        [geo],
    );

    return { geo, paginas, capas, estiloRaiz, remedir: medir };
}