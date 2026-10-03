
// domain/entidades/inmueble.ts
export interface Inmueble {
  id: string;
  tipo?: string; // urbano, rural, etc.
  departamento?: string;
  provincia?: string;
  municipio?: string;
  localidad?: string;
  superficieM2?: string; // Guardado como string para precisión
  matricula?: string;
  codigoCatastral?: string;
  ubicacion?: string;
  colindanciasJson: Record<string, string>; // { norte: '...', sur: '...', etc. }
  gravamenes?: string;
  observaciones?: string;
  creadoEn: string; // ISO
  actualizadoEn: string; // ISO
  eliminadoEn?: string; // ISO (borrado lógico)
}
