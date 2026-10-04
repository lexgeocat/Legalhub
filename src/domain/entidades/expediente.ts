export type EstadoExpediente = 'abierto' | 'en_tramite' | 'suspendido' | 'cerrado' | 'archivado';

export interface Expediente {
  id: string;
  codigo: string; // LH-AAAA-NNNN
  tipo: string; // clave de TIPOS_EXPEDIENTE
  materia: string; // asunto
  referencia?: string;
  estado: EstadoExpediente;
  juzgado?: string;
  nroCausa?: string;
  clienteId: string;
  datos: Record<string, string>; // «caso.*» precargado en los modelos
  creadoEn: string;
  actualizadoEn: string;
  eliminadoEn?: string;
}