import type { Sentencia } from './puertos/db';

const IDENT = /^[a-z_][a-z0-9_]*$/;

export function insertar(tabla: string, valores: Record<string, unknown>): Sentencia {
    const cols = Object.keys(valores);
    if (!IDENT.test(tabla) || !cols.every((c) => IDENT.test(c))) throw new Error('Identificador SQL inválido');
    return {
        sql: `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `?${i + 1}`).join(', ')})`,
        params: cols.map((c) => valores[c] ?? null),
    };
}