import { ErrorDeDatos } from '../../domain/errores';
import type { DbPuerto, Sentencia } from '../puertos/db';

const ahoraISO = () => new Date().toISOString();

/** Borrado lógico: el documento deja de mostrarse y buscarse; los .docx quedan en disco. */
export class EliminarDocumento {
    constructor(private readonly db: DbPuerto) { }

    async ejecutar(id: string): Promise<void> {
        const [doc] = await this.db.consultar<{ codigo: string }>(
            `SELECT e.codigo FROM documento d JOIN expediente e ON e.id = d.expediente_id
             WHERE d.id = ?1 AND d.deleted_at IS NULL`,
            [id],
        );
        if (!doc) throw new ErrorDeDatos('El documento ya no existe');
        await this.db.transaccion(
            [
                { sql: 'UPDATE documento SET deleted_at = ?2 WHERE id = ?1', params: [id, ahoraISO()] },
                { sql: 'DELETE FROM fts_documento WHERE documento_id = ?1', params: [id] },
            ],
            [{ accion: 'documento.eliminar', entidad: 'documento', entidadId: id, detalle: { expediente: doc.codigo } }],
        );
    }
}

/** Borrado lógico del expediente, sus documentos y los inmuebles que no pertenecen a otro expediente. */
export class EliminarExpediente {
    constructor(private readonly db: DbPuerto) { }

    async ejecutar(id: string): Promise<void> {
        const [exp] = await this.db.consultar<{ codigo: string }>(
            'SELECT codigo FROM expediente WHERE id = ?1 AND deleted_at IS NULL',
            [id],
        );
        if (!exp) throw new ErrorDeDatos('El expediente ya no existe');
        const [{ n }] = await this.db.consultar<{ n: number }>(
            'SELECT COUNT(*) AS n FROM documento WHERE expediente_id = ?1 AND deleted_at IS NULL',
            [id],
        );
        const ahora = ahoraISO();
        const sentencias: Sentencia[] = [
            {
                sql: `DELETE FROM fts_documento
                      WHERE documento_id IN (SELECT id FROM documento WHERE expediente_id = ?1 AND deleted_at IS NULL)`,
                params: [id],
            },
            {
                sql: 'UPDATE documento SET deleted_at = ?2 WHERE expediente_id = ?1 AND deleted_at IS NULL',
                params: [id, ahora],
            },
            {
                sql: `UPDATE inmueble SET deleted_at = ?2, updated_at = ?2
                      WHERE deleted_at IS NULL
                        AND id IN (SELECT inmueble_id FROM expediente_inmueble WHERE expediente_id = ?1)
                        AND id NOT IN (
                          SELECT ei.inmueble_id FROM expediente_inmueble ei
                          JOIN expediente e ON e.id = ei.expediente_id
                          WHERE ei.expediente_id <> ?1 AND e.deleted_at IS NULL)`,
                params: [id, ahora],
            },
            { sql: 'UPDATE expediente SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1', params: [id, ahora] },
        ];
        await this.db.transaccion(sentencias, [
            { accion: 'expediente.eliminar', entidad: 'expediente', entidadId: id, detalle: { codigo: exp.codigo, documentos: Number(n) } },
        ]);
    }
}

/** Borrado lógico del modelo con todas sus versiones. Los documentos ya generados no se tocan. */
export class EliminarModelo {
    constructor(private readonly db: DbPuerto) { }

    /** Documentos vigentes generados con alguna versión del modelo. */
    async usos(id: string): Promise<number> {
        const [f] = await this.db.consultar<{ n: number }>(
            `SELECT COUNT(DISTINCT d.id) AS n
             FROM documento_version dv
             JOIN modelo_version mv ON mv.id = dv.modelo_version_id
             JOIN documento d ON d.id = dv.documento_id
             WHERE mv.modelo_id = ?1 AND d.deleted_at IS NULL`,
            [id],
        );
        return Number(f?.n ?? 0);
    }

    async ejecutar(id: string): Promise<void> {
        const [m] = await this.db.consultar<{ id: string }>(
            'SELECT id FROM modelo WHERE id = ?1 AND deleted_at IS NULL',
            [id],
        );
        if (!m) throw new ErrorDeDatos('El modelo ya no existe');
        const usos = await this.usos(id);
        await this.db.transaccion(
            [{ sql: 'UPDATE modelo SET deleted_at = ?2, activo = 0 WHERE id = ?1', params: [id, ahoraISO()] }],
            [{ accion: 'modelo.eliminar', entidad: 'modelo', entidadId: id, detalle: { documentos: usos } }],
        );
    }
}