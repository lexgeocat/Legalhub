import { useEffect, useMemo, useState } from 'react';
import { pilaCss } from '../../domain/fuentes/fuentes';

/**
 * Word: «interlineado 1,5» = 1,5 × altura de línea NATURAL de la fuente
 * (ascendente + descendente + interlineado externo; Times New Roman / Arial ≈ 1,15 × tamaño).
 * CSS: `line-height: 1.5` = 1,5 × tamaño. Sin este factor la vista previa mete ~15 % más líneas por hoja.
 */
export const RAZON_LINEA_RESPALDO = 1.15;

const cache = new Map<string, number>();

function medir(familia: string): number {
    if (typeof document === 'undefined' || !document.body) return RAZON_LINEA_RESPALDO;
    const sonda = document.createElement('div');
    sonda.setAttribute('aria-hidden', 'true');
    sonda.style.cssText = [
        'position:absolute', 'left:-9999px', 'top:0', 'visibility:hidden', 'margin:0', 'padding:0', 'border:0',
        'white-space:nowrap', 'font-weight:400', 'font-style:normal', 'font-size:200px', 'line-height:normal',
        `font-family:${pilaCss(familia)}`,
    ].join(';');
    sonda.textContent = 'Hgjpq';
    document.body.appendChild(sonda);
    const alto = sonda.getBoundingClientRect().height;
    sonda.remove();
    const r = alto / 200;
    return Number.isFinite(r) && r > 0.9 && r < 2 ? Math.round(r * 1000) / 1000 : RAZON_LINEA_RESPALDO;
}

export function razonLinea(familia: string): number {
    const k = familia.trim().toLowerCase();
    let r = cache.get(k);
    if (r === undefined) {
        r = medir(familia);
        cache.set(k, r);
    }
    return r;
}

/** Valor CSS (número) de un interlineado estilo Word. Requiere `--rl` en un ancestro. */
export const lineaCss = (factor: number): string => `calc(${factor} * var(--rl, ${RAZON_LINEA_RESPALDO}))`;

/** Razón de línea de la fuente; se vuelve a medir cuando terminan de cargar las fuentes. */
export function useRazonLinea(familia: string): number {
    const [version, setVersion] = useState(0);
    useEffect(() => {
        const fuentes = typeof document !== 'undefined' ? document.fonts : undefined;
        if (!fuentes) return undefined;
        let vivo = true;
        const refrescar = () => {
            if (!vivo) return;
            cache.clear();
            setVersion((v) => v + 1);
        };
        void fuentes.ready.then(refrescar);
        fuentes.addEventListener('loadingdone', refrescar);
        return () => {
            vivo = false;
            fuentes.removeEventListener('loadingdone', refrescar);
        };
    }, [familia]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => razonLinea(familia), [familia, version]);
}