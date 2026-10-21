import { ErrorDeDatos } from '../errores';
import { aDecimal, agruparMiles, cardinalEntero } from './numeros';

export function superficie(valor: unknown): string {
  const d = aDecimal(valor, 'valor de superficie');
  if (d.isNegative()) throw new ErrorDeDatos(`La superficie no puede ser negativa: ${d.toString()}`);
  if (d.decimalPlaces() > 2) {
    throw new ErrorDeDatos(`La superficie admite máximo 2 decimales: ${d.toString()}`);
  }
  const [entero, dec] = d.toFixed(2).split('.');
  const numero = agruparMiles(entero) + (dec === '00' ? '' : `,${dec}`);
  const lit = cardinalEntero(entero) + (dec === '00' ? '' : ` con ${dec}/100`);
  return `${numero} m² (${lit} metros cuadrados)`;
}