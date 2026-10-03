
// domain/entidades/documentoVersion.ts
export type OrigenVersion = 
  | 'generado' 
  | 'edicion_externa';

export interface DocumentoVersion {
  id: string;
  documentoId: string; // Referencia a Documento
  numero: number;      // Número de versión (v01, v02, etc.)
  modeloVersionId?: string; // Referencia a ModeloVersion (opcional para ediciones externas)
  datosSnapshotJson: string; // JSON con los datos usados para generar este documento
  ruta: string;        // Ruta al archivo .docx generado
  sha256: string;      // Hash del documento generado
  origen: OrigenVersion;
  creadoEn: string; // ISO
}
