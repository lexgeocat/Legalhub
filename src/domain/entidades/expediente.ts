
// domain/entidades/expediente.ts
export type EstadoExpediente = 
  | 'abierto' 
  | 'en_tramite' 
  | 'suspendido' 
  | 'cerrado' 
  | 'archivado';

export interface Expediente {
  id: string;
  codigo: string; // Formato LH-AAAA-NNNN
  materia: string;
  referencia?: string;
  estado: EstadoExpediente;
  juzgado?: string;
  nroCausa?: string; // Número que asigna la autoridad
  clienteId: string; // Referencia a Persona
  creadoEn: string; // ISO
  actualizadoEn: string; // ISO
  eliminadoEn?: string; // ISO (borrado lógico)
}
