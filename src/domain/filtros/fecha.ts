
// domain/filtros/fecha.ts
export function fecha(fechaISO: string): string {
  if (!fechaISO) return '';
  
  const fecha = new Date(fechaISO);
  if (isNaN(fecha.getTime())) return '';
  
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(fecha);
}
