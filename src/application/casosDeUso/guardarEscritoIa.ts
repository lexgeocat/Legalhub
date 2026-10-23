import type { DocumentoVersion } from '../../domain/entidades';
import { ErrorDeDatos } from '../../domain/comun/errores';
import { nuevoId } from '../../domain/comun/id';
import { nombreSeguro } from '../../domain/comun/nombreArchivo';
import type { ArchivosPuerto } from '../puertos/archivos';
import type { DbPuerto, Sentencia } from '../puertos/db';
import type { MotorPlantillas } from '../puertos/motorPlantillas';

/** Guarda un .docx producido por Lex AI como documento (nueva versión si el título ya existe) dentro de un expediente. */
export class GuardarEscritoIa {
  constructor(private readonly dep: { db: DbPuerto; archivos: ArchivosPuerto; motor: MotorPlantillas }) { }

  async ejecutar(expedienteId: string, titulo: string, docx: Uint8Array): Promise<DocumentoVersion> {
    const { db, archivos, motor } = this.dep;
    const t = titulo.trim();
    if (!t) throw new ErrorDeDatos('Falta el título del documento');
    const [exp] = await db.consultar<{ codigo: string }>(
      'SELECT codigo FROM expediente WHERE id = ?1 AND deleted_at IS NULL', [expedienteId],
    );
    if (!exp) throw new ErrorDeDatos('El expediente ya no existe');

    const [existente] = await db.consultar<{ id: string }>(
      'SELECT id FROM documento WHERE expediente_id = ?1 AND titulo = ?2 AND deleted_at IS NULL', [expedienteId, t],
    );
    const documentoId = existente?.id ?? nuevoId();
    const [{ proximo }] = await db.consultar<{ proximo: number }>(
      `SELECT COALESCE(MAX(v.nro), 0) + 1 AS proximo
       FROM documento_version v JOIN documento d ON d.id = v.documento_id
       WHERE d.expediente_id = ?1 AND d.titulo = ?2`,
      [expedienteId, t],
    );

    const ruta = await archivos.rutaDocumento(exp.codigo, `${nombreSeguro(t)}_v${String(proximo).padStart(2, '0')}.docx`);
    await archivos.crearNuevo(ruta, docx);
    const sha256 = await archivos.sha256(ruta);
    const creadoEn = new Date().toISOString();
    const version: DocumentoVersion = {
      id: nuevoId(), documentoId, numero: proximo, datosSnapshotJson: JSON.stringify({ origen: 'lex-ai' }),
      ruta, sha256, origen: 'generado', creadoEn,
    };

    const sentencias: Sentencia[] = [
      existente
        ? { sql: `UPDATE documento SET estado = 'generado' WHERE id = ?1`, params: [documentoId] }
        : {
          sql: `INSERT INTO documento (id, expediente_id, titulo, estado, created_at) VALUES (?1, ?2, ?3, 'generado', ?4)`,
          params: [documentoId, expedienteId, t, creadoEn],
        },
      {
        sql: `INSERT INTO documento_version
                (id, documento_id, nro, modelo_version_id, datos_snapshot_json, ruta, sha256, origen, created_at)
              VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, 'generado', ?7)`,
        params: [version.id, documentoId, proximo, version.datosSnapshotJson, ruta, sha256, creadoEn],
      },
      { sql: 'DELETE FROM fts_documento WHERE documento_id = ?1', params: [documentoId] },
      { sql: 'INSERT INTO fts_documento (documento_id, texto) VALUES (?1, ?2)', params: [documentoId, motor.textoPlano(docx)] },
    ];
    await db.transaccion(sentencias, [
      { accion: 'documento.lexai', entidad: 'documento_version', entidadId: version.id, detalle: { expediente: exp.codigo, nro: proximo, sha256 } },
    ]);
    return version;
  }
}
