import type { DocumentoVersion } from '../../domain/entidades';
import { nuevoId } from '../../domain/id';
import { nombreSeguro } from '../../domain/nombreArchivo';
import type { ArchivosPuerto } from '../puertos/archivos';
import type { ConstructorContexto } from '../puertos/contexto';
import type { DbPuerto, Sentencia } from '../puertos/db';
import type { RepositorioModelos } from '../puertos/modelos';
import type { EntradaVerificacion, MotorPlantillas } from '../puertos/motorPlantillas';

export interface DependenciasGenerarDocumento {
  db: DbPuerto;
  archivos: ArchivosPuerto;
  modelos: RepositorioModelos;
  contexto: ConstructorContexto;
  motor: MotorPlantillas;
}

export interface DocumentoPreparado {
  expedienteId: string;
  codigoExpediente: string;
  modeloVersionId: string;
  titulo: string;
  datos: Record<string, unknown>;
  docx: Uint8Array;
  texto: string;
  verificacion: EntradaVerificacion[];
}

export class GenerarDocumento {
  constructor(private readonly dep: DependenciasGenerarDocumento) { }

  /** Renderiza en memoria. Si falta un dato lanza ErrorDeDatos y no toca disco ni BD. */
  async preparar(
    expedienteId: string,
    modeloVersionId: string,
    datosFormulario: Record<string, unknown>,
    titulo: string,
  ): Promise<DocumentoPreparado> {
    const { db, modelos, contexto, motor } = this.dep;
    const tituloLimpio = titulo.trim();
    if (!tituloLimpio) throw new Error('Falta el título del documento');

    const [exp] = await db.consultar<{ codigo: string }>(
      'SELECT codigo FROM expediente WHERE id = ?1 AND deleted_at IS NULL',
      [expedienteId],
    );
    if (!exp) throw new Error(`Expediente no encontrado: ${expedienteId}`);

    const plantilla = await modelos.leerPlantilla(modeloVersionId);
    const datos = await contexto.construir(expedienteId, datosFormulario);
    const { docx, verificacion } = await motor.renderizar(plantilla, datos);
    return {
      expedienteId, codigoExpediente: exp.codigo, modeloVersionId, titulo: tituloLimpio,
      datos, docx, texto: motor.textoPlano(docx), verificacion,
    };
  }

  async guardar(p: DocumentoPreparado): Promise<DocumentoVersion> {
    const { db, archivos } = this.dep;

    const [existente] = await db.consultar<{ id: string }>(
      'SELECT id FROM documento WHERE expediente_id = ?1 AND titulo = ?2 AND deleted_at IS NULL',
      [p.expedienteId, p.titulo],
    );
    const documentoId = existente?.id ?? nuevoId();
    const [{ proximo }] = await db.consultar<{ proximo: number }>(
      'SELECT COALESCE(MAX(nro), 0) + 1 AS proximo FROM documento_version WHERE documento_id = ?1',
      [documentoId],
    );

    const nombre = `${nombreSeguro(p.titulo)}_v${String(proximo).padStart(2, '0')}.docx`;
    const ruta = await archivos.rutaDocumento(p.codigoExpediente, nombre);
    await archivos.crearNuevo(ruta, p.docx);
    const sha256 = await archivos.sha256(ruta);

    const creadoEn = new Date().toISOString();
    const version: DocumentoVersion = {
      id: nuevoId(), documentoId, numero: proximo, modeloVersionId: p.modeloVersionId,
      datosSnapshotJson: JSON.stringify(p.datos), ruta, sha256, origen: 'generado', creadoEn,
    };

    const sentencias: Sentencia[] = [];
    if (existente) {
      sentencias.push({ sql: `UPDATE documento SET estado = 'generado' WHERE id = ?1`, params: [documentoId] });
    } else {
      sentencias.push({
        sql: `INSERT INTO documento (id, expediente_id, titulo, estado, created_at) VALUES (?1, ?2, ?3, 'generado', ?4)`,
        params: [documentoId, p.expedienteId, p.titulo, creadoEn],
      });
    }
    sentencias.push(
      {
        sql: `INSERT INTO documento_version
                (id, documento_id, nro, modelo_version_id, datos_snapshot_json, ruta, sha256, origen, created_at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
        params: [version.id, documentoId, version.numero, version.modeloVersionId, version.datosSnapshotJson, ruta, sha256, version.origen, creadoEn],
      },
      { sql: 'DELETE FROM fts_documento WHERE documento_id = ?1', params: [documentoId] },
      { sql: 'INSERT INTO fts_documento (documento_id, texto) VALUES (?1, ?2)', params: [documentoId, p.texto] },
    );
    await db.transaccion(sentencias, [
      { accion: 'documento.generar', entidad: 'documento_version', entidadId: version.id, detalle: { expediente: p.codigoExpediente, nro: proximo, sha256 } },
    ]);
    return version;
  }

  async ejecutar(
    expedienteId: string,
    modeloVersionId: string,
    datosFormulario: Record<string, unknown>,
    titulo: string,
  ): Promise<DocumentoVersion> {
    return this.guardar(await this.preparar(expedienteId, modeloVersionId, datosFormulario, titulo));
  }
}