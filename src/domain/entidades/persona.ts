
// domain/entidades/persona.ts
export type TipoPersona = 'natural' | 'juridica';
export type Genero = 'M' | 'F';
export type EstadoCivil = 
  | 'soltero' 
  | 'casado' 
  | 'casada' 
  | 'divorciado' 
  | 'divorciada' 
  | 'viudo' 
  | 'viuda' 
  | 'union libre';

export interface Persona {
  id: string;
  tipo: TipoPersona;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  apellidoCasada?: string;
  ciNumero?: string;
  ciComplemento?: string;
  ciExpedido?: string;
  fechaNacimiento?: string; // ISO
  genero?: Genero;
  estadoCivil?: EstadoCivil;
  nacionalidad?: string;
  profesion?: string;
  razonSocial?: string;
  nit?: string;
  generoGramatical?: Genero; // Para concordancia
  representanteId?: string;
  poderRef?: string;
  domicilio?: string;
  telefono?: string;
  correo?: string;
  extraJson: Record<string, any>; // Campos adicionales
  creadoEn: string; // ISO
  actualizadoEn: string; // ISO
  eliminadoEn?: string; // ISO (borrado lógico)
}
