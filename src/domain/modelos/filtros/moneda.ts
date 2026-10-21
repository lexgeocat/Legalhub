import { ErrorDeDatos } from '../../comun/errores';
import { aDecimal, agruparMiles, capitalizar, cardinalEntero } from './numeros';

export function moneda(monto: unknown, simbolo = 'Bs.', nombre = 'bolivianos'): string {
  const d = aDecimal(monto, 'monto');
  if (d.isNegative()) throw new ErrorDeDatos(`El monto no puede ser negativo: ${d.toString()}`);
  if (d.decimalPlaces() > 2) {
    throw new ErrorDeDatos(`El monto admite máximo 2 decimales: ${d.toString()}`);
  }
  const [entero, centavos] = d.toFixed(2).split('.');
  return `${simbolo} ${agruparMiles(entero)},${centavos} (${capitalizar(cardinalEntero(entero))} ${centavos}/100 ${nombre})`;
}

/** Montos en dólares: «$us. 1.500,00 (Mil quinientos 00/100 dólares americanos)». */
export function dolares(monto: unknown, simbolo = '$us.', nombre = 'dólares americanos'): string {
  return moneda(monto, simbolo, nombre);
}