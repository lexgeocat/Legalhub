export type Fila = Record<string, unknown>;

export interface ResultadoEjecucion {
    cambios: number;
    ultimoIdFila: string | null;
}

export interface Sentencia {
    sql: string;
    params: unknown[];
}

export interface EventoAuditoria {
    accion: string;
    entidad?: string;
    entidadId?: string;
    /** Nunca incluir nombres ni C.I.: solo ids, códigos y contadores. */
    detalle?: Record<string, unknown>;
}

export interface ResultadoAuditoria {
    ok: boolean;
    eventos: number;
    primerRoto: number | null;
}

export interface DbPuerto {
    consultar<T = Fila>(sql: string, params?: unknown[]): Promise<T[]>;
    ejecutar(sql: string, params?: unknown[]): Promise<ResultadoEjecucion>;
    transaccion(sentencias: Sentencia[], auditoria?: EventoAuditoria[]): Promise<ResultadoEjecucion[]>;
    verificarAuditoria(): Promise<ResultadoAuditoria>;
}