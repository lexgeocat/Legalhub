
// domain/entidades/modelo.ts
export interface Modelo {
  id: string;
  nombre: string;
  materia?: string;
  categoria?: string;
  activo: boolean;
  creadoEn: string; // ISO
}
