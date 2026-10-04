
export interface Modelo {
  id: string;
  nombre: string;
  materia?: string;
  categoria?: string;
  descripcion?: string;
  activo: boolean;
  creadoEn: string; // ISO
}