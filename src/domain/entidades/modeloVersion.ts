
// domain/entidades/modeloVersion.ts
export interface ModeloVersion {
  id: string;
  modeloId: string; // Referencia a Modelo
  version: number;
  rutaPaquete: string; // Ruta al archivo .lhmodel
  sha256: string;      // Hash del paquete
  schemaJson: string;  // Esquema extraído del modelo (JSON string)
  notas?: string;
  creadoEn: string; // ISO
}
