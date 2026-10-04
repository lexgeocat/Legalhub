import { ErrorDeDatos } from '../errores';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function fecha(iso: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '').trim());
  if (!m) throw new ErrorDeDatos(`Fecha inválida: "${String(iso)}" (se esperaba AAAA-MM-DD)`);
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ref = new Date(Date.UTC(anio, mes - 1, dia));
  if (ref.getUTCFullYear() !== anio || ref.getUTCMonth() !== mes - 1 || ref.getUTCDate() !== dia) {
    throw new ErrorDeDatos(`La fecha no existe: ${m[0]}`);
  }
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

/** Fecha local AAAA-MM-DD (toISOString() devuelve UTC y después de las 20:00 en Bolivia da el día siguiente). */
export function hoyISO(ahora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
}