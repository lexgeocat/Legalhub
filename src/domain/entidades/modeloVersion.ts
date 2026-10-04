export interface ModeloVersion {
  id: string;
  modeloId: string;
  version: number;
  rutaPaquete: string; // .lhmodel
  sha256: string; // hash del paquete
  schemaJson: string;
  editable: boolean; // true si se creó en el editor (tiene texto fuente)
  notas?: string;
  creadoEn: string; // ISO
}