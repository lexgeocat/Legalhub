export type RolParte =
  | 'demandante'
  | 'demandado'
  | 'tercero'
  | 'acusado'
  | 'denunciante'
  | (string & {});

export interface Parte {
  id: string;
  expedienteId: string;
  personaId: string;
  rol: RolParte;
  orden: number;
  domicilioProcesal?: string;
  representanteId?: string;
  datosOverrideJson: Record<string, unknown>;
}