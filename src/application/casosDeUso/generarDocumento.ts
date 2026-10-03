
// application/casosDeUso/generarDocumento.ts
import { Documento, DocumentoVersion } from '../entidades/documento';
import { ModeloVersion } from '../entidades/modeloVersion';
import { MotorPlantillas } from '../puertos/motorPlantillas';

// Definimos los puertos que este caso de uso necesita
export interface DbPuertos {
  consultar(sql: string, params: any[]): Promise<any[]>;
  ejecutar(sql: string, params: any[]): Promise<{ cambios: number; lastInsertRowid?: string }>;
}

export interface ArchivosPuertos {
  guardarDocumento(contenido: Uint8Array, ruta: string): Promise<void>;
  obtenerRutaModelo(modeloVersionId: string): Promise<string>;
}

export interface ModeloPuertos {
  obtenerModeloVersion(id: string): Promise<ModeloVersion | null>;
}

interface Dependencias {
  dbPuertos: DbPuertos;
  archivosPuertos: ArchivosPuertos;
  modeloPuertos: ModeloPuertos;
  motorPlantillas: MotorPlantillas;
}

/**
 * Caso de uso para generar un documento a partir de un modelo y un expediente
 */
export class GenerarDocumento {
  constructor(
    private dependencias: Dependencias
  ) {}

  async ejecutar(
    expedienteId: string,
    modeloVersionId: string,
    datosFormulario: Record<string, any>, // Los datos que el usuario llenó en el formulario
    titulo: string
  ): Promise<DocumentoVersion> {
    const { dbPuertos, archivosPuertos, modeloPuertos, motorPlantillas } = this.dependencias;
    
    // 1. Obtener el modelo y su versión
    const modeloVersion = await modeloPuertos.obtenerModeloVersion(modeloVersionId);
    if (!modeloVersion) {
      throw new Error(Modelo versión no encontrado: );
    }
    
    // 2. Obtener la ruta del paquete del modelo
    const rutaPaquete = await archivosPuertos.obtenerRutaModelo(modeloVersionId);
    // En una implementación real, extraeríamos el .docx del paquete .lhmodel
    // Por ahora, usamos un placeholder
    const plantillaDocx = new Uint8Array(); // Esto vendría de extraer el ZIP
    
    // 3. Escanear el modelo para obtener su esquema (opcional, pero útil para validación)
    // const escaneo = await motorPlantillas.escanear(plantillaDocx);
    // if (!escaneo.esValido) {
    //   throw new Error(Modelo inválido: );
    // }
    
    // 4. Preparar el contexto para el motor de plantillas
    // Esto incluiría datos del expediente, partes, etc.
    // Por ahora, usamos un contexto simplificado
    const contexto: any = {
      expediente: {
        // Aquí irían los datos del expediente obtenidos de la BD
        codigo: 'LH-2026-0001',
        materia: 'Prueba',
        // ... otros campos
      },
      partes: {
        demandantes: [],
        demandados: []
        // ... se llenarían con datos reales
      },
      caso: {
        // ... datos del caso desde el formulario
        ...datosFormulario
      },
      hoy: new Date().toISOString().split('T')[0] // Fecha actual
      // ... otros contextos según el plan
    };
    
    // 5. Renderizar el documento
    let documentoGenerado: Uint8Array;
    try {
      documentoGenerado = await motorPlantillas.renderizar(plantillaDocx, contexto);
    } catch (error) {
      throw new Error(Error al renderizar el documento: );
    }
    
    // 6. Generar una ruta única para guardar el documento
    const timestamp = new Date().getTime();
    const rutaDocumento = documentos//_v01_.docx;
    
    // 7. Guardar el documento físicamente
    await archivosPuertos.guardarDocumento(documentoGenerado, rutaDocumento);
    
    // 8. Calcular el SHA-256 del documento (placeholder)
    const sha256 = 'placeholder_hash'; // En realidad, usaríamos una librería de hash
    
    // 9. Crear el registro del documento (si no existe)
    // Primero verificamos si ya existe un documento con este título para este expediente
    const documentoExistente = await dbPuertos.consultar(
      SELECT id FROM documento WHERE expediente_id = ? AND titulo = ?,
      [expedienteId, titulo]
    );
    
    let documentoId: string;
    if (documentoExistente.length === 0) {
      // Crear nuevo documento
      documentoId = this.generarId();
      await dbPuertos.ejecutar(
        INSERT INTO documento (id, expediente_id, titulo, estado, created_at) 
         VALUES (?, ?, ?, 'borrador', ?),
        [documentoId, expedienteId, titulo, new Date().toISOString()]
      );
    } else {
      documentoId = documentoExistente[0].id;
      
      // Actualizar el estado a 'generado' o similar
      await dbPuertos.ejecutar(
        UPDATE documento SET estado = 'generado' WHERE id = ?,
        [documentoId]
      );
    }
    
    // 10. Determinar el número de versión del documento
    const resultadoVersion = await dbPuertos.consultar(
      SELECT COALESCE(MAX(numero), 0) + 1 as proximo FROM documento_version WHERE documento_id = ?,
      [documentoId]
    );
    const numeroVersion = resultadoVersion[0].proximo || 1;
    
    // 11. Crear la versión del documento
    const documentoVersionId = this.generarId();
    const documentoVersion: DocumentoVersion = {
      id: documentoVersionId,
      documentoId,
      numero: numeroVersion,
      modeloVersionId: modeloVersion.id,
      datosSnapshotJson: JSON.stringify({
        // Combinar datos del expediente + datos del formulario
        // En una implementación real, haríamos una consulta completa
        ...datosFormulario
      }),
      ruta: rutaDocumento,
      sha256: sha256,
      origen: 'generado',
      creadoEn: new Date().toISOString()
    };
    
    // 12. Guardar la versión en la base de datos
    await dbPuertos.ejecutar(
      INSERT INTO documento_version (
        id, documento_id, numero, modelo_version_id, 
        datos_snapshot_json, ruta, sha256, origen, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?),
      [
        documentoVersion.id,
        documentoVersion.documentoId,
        documentoVersion.numero,
        documentoVersion.modeloVersionId,
        documentoVersion.datosSnapshotJson,
        documentoVersion.ruta,
        documentoVersion.sha256,
        documentoVersion.origen,
        documentoVersion.creadoEn
      ]
    );
    
    return documentoVersion;
  }
  
  /**
   * Genera un ID único (placeholder)
   */
  private generarId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}
