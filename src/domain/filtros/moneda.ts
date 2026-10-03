
// domain/filtros/moneda.ts
import Decimal from 'decimal.js';

export function moneda(monto: number | string | Decimal, simbolo: string = 'Bs.'): string {
  if (monto === null || monto === undefined) return '';
  
  const decimal = new Decimal(monto);
  if (!decimal.isFinite()) return '';
  
  // Formato con 2 decimales, separador de miles como punto y decimal como coma
  const formato = decimal.toFixed(2);
  const partes = formato.split('.');
  const entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimalPart = partes[1];
  
  const montoFormateado = \\ \,\\;
  
  // Convertir a literal (opcional, según el ejemplo del plan)
  // const literalMonto = literal(monto);
  // return \\ (\ bolivianos)\;
  
  return montoFormateado;
}
