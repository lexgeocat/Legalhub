import { claveNormalizada } from './texto';

const PELIGROSAS = new Set(['__proto__', 'constructor', 'prototype']);
const esObjeto = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

export function leerRuta(obj: unknown, ruta: string): unknown {
    let actual: unknown = obj;
    for (const seg of ruta.split('.')) {
        if (!esObjeto(actual)) return undefined;
        const buscada = claveNormalizada(seg);
        const k = Object.keys(actual).find((x) => claveNormalizada(x) === buscada);
        if (k === undefined) return undefined;
        actual = actual[k];
    }
    return actual;
}

export function asignarRuta(obj: Record<string, unknown>, ruta: string, valor: unknown): void {
    const segs = ruta.split('.');
    if (segs.some((s) => PELIGROSAS.has(s))) return;
    let cur = obj;
    for (const s of segs.slice(0, -1)) {
        const siguiente = cur[s];
        if (esObjeto(siguiente)) {
            cur = siguiente;
        } else {
            const nuevo: Record<string, unknown> = {};
            cur[s] = nuevo;
            cur = nuevo;
        }
    }
    cur[segs[segs.length - 1]] = valor;
}

export function fusionarProfundo(base: Record<string, unknown>, extra: Record<string, unknown>): Record<string, unknown> {
    const salida: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(extra)) {
        if (PELIGROSAS.has(k)) continue;
        const b = salida[k];
        salida[k] = esObjeto(v) && esObjeto(b) ? fusionarProfundo(b, v) : v;
    }
    return salida;
}