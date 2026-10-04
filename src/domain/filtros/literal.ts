import { ErrorDeDatos } from '../errores';
import { aDecimal, cardinalEntero } from './numeros';

export function literal(numero: unknown): string {
  const d = aDecimal(numero);
  if (d.decimalPlaces() > 2) {
    throw new ErrorDeDatos(`El literal admite máximo 2 decimales: ${d.toString()}`);
  }
  const signo = d.isNegative() && !d.isZero() ? 'menos ' : '';
  const [entero, dec] = d.abs().toFixed(2).split('.');
  return `${signo}${cardinalEntero(entero)}${dec === '00' ? '' : ` con ${dec}/100`}`;
}