import type {
    DbPuerto, EventoAuditoria, Fila, ResultadoAuditoria, ResultadoEjecucion, Sentencia,
} from '../../application/puertos/db';

/** Envuelve la BD y avisa (con antirrebote) cuando se escribió algo: los paneles se refrescan solos. */
export class DbObservable implements DbPuerto {
    private readonly oyentes = new Set<() => void>();
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor(private readonly base: DbPuerto) { }

    suscribir(f: () => void): () => void {
        this.oyentes.add(f);
        return () => {
            this.oyentes.delete(f);
        };
    }

    private avisar(): void {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.oyentes.forEach((f) => f()), 120);
    }

    consultar<T = Fila>(sql: string, params?: unknown[]): Promise<T[]> {
        return this.base.consultar<T>(sql, params);
    }

    async ejecutar(sql: string, params?: unknown[]): Promise<ResultadoEjecucion> {
        const r = await this.base.ejecutar(sql, params);
        this.avisar();
        return r;
    }

    async transaccion(sentencias: Sentencia[], auditoria?: EventoAuditoria[]): Promise<ResultadoEjecucion[]> {
        const r = await this.base.transaccion(sentencias, auditoria);
        this.avisar();
        return r;
    }

    verificarAuditoria(): Promise<ResultadoAuditoria> {
        return this.base.verificarAuditoria();
    }
}