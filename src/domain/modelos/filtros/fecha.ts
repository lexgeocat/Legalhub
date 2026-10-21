import { ErrorDeDatos } from '../errores';
import { cardinalEntero } from './numeros';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function partes(iso: unknown): { anio: number; mes: number; dia: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '').trim());
  if (!m) throw new ErrorDeDatos(`Fecha inválida: "${String(iso)}" (se esperaba AAAA-MM-DD)`);
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ref = new Date(Date.UTC(anio, mes - 1, dia));
  if (ref.getUTCFullYear() !== anio || ref.getUTCMonth() !== mes - 1 || ref.getUTCDate() !== dia) {
    throw new ErrorDeDatos(`La fecha no existe: ${m[0]}`);
  }
  return { anio, mes, dia };
}

export function fecha(iso: unknown): string {
  const { anio, mes, dia } = partes(iso);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

/**
 * «nueve (9) días del mes de octubre del año 2026».
 * Con el argumento "letras" el año también va en letras: «… del año dos mil veintiséis (2026)».
 */
export function fechalarga(iso: unknown, anioEn = ''): string {
  const { anio, mes, dia } = partes(iso);
  const letras = dia === 21 ? 'veintiún' : cardinalEntero(String(dia)).replace(/uno$/, 'un');
  const dias = dia === 1 ? `${letras} (1) día` : `${letras} (${dia}) días`;
  const anioTxt = anioEn.trim().toLowerCase() === 'letras' ? `${cardinalEntero(String(anio))} (${anio})` : String(anio);
  return `${dias} del mes de ${MESES[mes - 1]} del año ${anioTxt}`;
}

/** Fecha local AAAA-MM-DD (toISOString() devuelve UTC y después de las 20:00 en Bolivia da el día siguiente). */
export function hoyISO(ahora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
}