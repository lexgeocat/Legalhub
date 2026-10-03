
// domain/entidades/parte.ts
export type RolParte = 
  | 'demandante' 
  | 'demandado' 
  | 'tercero' 
  | 'acusado' 
  | 'denunciante'
// y otros roles según necesidad;

export interface Parte {
  id: string;
  expedienteId: string; // Referencia a Expediente
  personaId: string;    // Referencia a Persona
  rol: RolParte;
  orden: number;        // Orden de aparición en listas
  domicilioProcesal?: string;
  representanteId?: string; // Si representa a otra persona
  datosOverrideJson: Record<string, any>; // Datos específicos para este caso
  creadoEn: string; // ISO
  actualizadoEn: string; // ISO
  eliminadoEn?: string; // ISO (borrado lógico)
}
