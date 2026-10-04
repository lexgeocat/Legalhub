import { invoke } from '@tauri-apps/api/core';
import type {
    DbPuerto, EventoAuditoria, Fila, ResultadoAuditoria, ResultadoEjecucion, Sentencia,
} from '../../application/puertos/db';

export class DbTauri implements DbPuerto {
    consultar<T = Fila>(sql: string, params: unknown[] = []): Promise<T[]> {
        return invoke<T[]>('db_query', { sql, params });
    }
    ejecutar(sql: string, params: unknown[] = []): Promise<ResultadoEjecucion> {
        return invoke<ResultadoEjecucion>('db_exec', { sql, params });
    }
    transaccion(sentencias: Sentencia[], auditoria?: EventoAuditoria[]): Promise<ResultadoEjecucion[]> {
        return invoke<ResultadoEjecucion[]>('db_tx', { sentencias, auditoria });
    }
    verificarAuditoria(): Promise<ResultadoAuditoria> {
        return invoke<ResultadoAuditoria>('auditoria_verificar');
    }
}