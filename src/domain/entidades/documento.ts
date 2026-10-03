
// domain/entidades/documento.ts
export type EstadoDocumento = 
  | 'borrador' 
  | 'generado' 
  | 'revisado' 
  | 'entregado';

export interface Documento {
  id: string;
  expedienteId: string; // Referencia a Expediente
  titulo: string;
  estado: EstadoDocumento;
  creadoEn: string; // ISO
  eliminadoEn?: string; // ISO (borrado lógico)
}
