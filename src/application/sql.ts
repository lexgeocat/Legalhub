import type { Sentencia } from './puertos/db';

const IDENT = /^[a-z_][a-z0-9_]*$/;

function validar(tabla: string, cols: string[]): void {
    if (!IDENT.test(tabla) || cols.length === 0 || !cols.every((c) => IDENT.test(c))) {
        throw new Error('Identificador SQL inválido');
    }
}

export function insertar(tabla: string, valores: Record<string, unknown>): Sentencia {
    const cols = Object.keys(valores);
    validar(tabla, cols);
    return {
        sql: `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `?${i + 1}`).join(', ')})`,
        params: cols.map((c) => valores[c] ?? null),
    };
}

export function actualizar(tabla: string, id: string, valores: Record<string, unknown>): Sentencia {
    const cols = Object.keys(valores);
    validar(tabla, cols);
    return {
        sql: `UPDATE ${tabla} SET ${cols.map((c, i) => `${c} = ?${i + 1}`).join(', ')} WHERE id = ?${cols.length + 1}`,
        params: [...cols.map((c) => valores[c] ?? null), id],
    };
}