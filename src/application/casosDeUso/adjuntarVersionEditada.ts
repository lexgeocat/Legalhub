import type { DocumentoVersion } from '../../domain/entidades';
import { nuevoId } from '../../domain/id';
import { nombreSeguro } from '../../domain/nombreArchivo';
import type { ArchivosPuerto } from '../puertos/archivos';
import type { DbPuerto } from '../puertos/db';
import type { MotorPlantillas } from '../puertos/motorPlantillas';

export class AdjuntarVersionEditada {
    constructor(private readonly dep: { db: DbPuerto; archivos: ArchivosPuerto; motor: MotorPlantillas }) { }

    async ejecutar(documentoId: string, rutaOrigen: string): Promise<DocumentoVersion> {
        const { db, archivos, motor } = this.dep;
        const [doc] = await db.consultar<{ titulo: string; codigo: string }>(
            `SELECT d.titulo, e.codigo FROM documento d JOIN expediente e ON e.id = d.expediente_id
       WHERE d.id = ?1 AND d.deleted_at IS NULL`,
            [documentoId],
        );
        if (!doc) throw new Error(`Documento no encontrado: ${documentoId}`);

        const bytes = await archivos.leer(rutaOrigen);
        const texto = motor.textoPlano(bytes);

        const [ultima] = await db.consultar<{ nro: number; datos_snapshot_json: string }>(
            'SELECT nro, datos_snapshot_json FROM documento_version WHERE documento_id = ?1 ORDER BY nro DESC LIMIT 1',
            [documentoId],
        );
        const numero = (ultima?.nro ?? 0) + 1;
        const ruta = await archivos.rutaDocumento(doc.codigo, `${nombreSeguro(doc.titulo)}_v${String(numero).padStart(2, '0')}.docx`);
        await archivos.crearNuevo(ruta, bytes);
        const sha256 = await archivos.sha256(ruta);

        const creadoEn = new Date().toISOString();
        const version: DocumentoVersion = {
            id: nuevoId(), documentoId, numero, datosSnapshotJson: ultima?.datos_snapshot_json ?? '{}',
            ruta, sha256, origen: 'edicion_externa', creadoEn,
        };
        await db.transaccion(
            [
                {
                    sql: `INSERT INTO documento_version
                  (id, documento_id, nro, modelo_version_id, datos_snapshot_json, ruta, sha256, origen, created_at)
                VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, 'edicion_externa', ?7)`,
                    params: [version.id, documentoId, numero, version.datosSnapshotJson, ruta, sha256, creadoEn],
                },
                { sql: 'DELETE FROM fts_documento WHERE documento_id = ?1', params: [documentoId] },
                { sql: 'INSERT INTO fts_documento (documento_id, texto) VALUES (?1, ?2)', params: [documentoId, texto] },
            ],
            [{ accion: 'documento.adjuntar', entidad: 'documento_version', entidadId: version.id, detalle: { expediente: doc.codigo, nro: numero, sha256 } }],
        );
        return version;
    }
}