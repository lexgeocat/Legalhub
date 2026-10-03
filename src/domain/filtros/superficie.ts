
// domain/filtros/superficie.ts
import Decimal from 'decimal.js';

export function superficie(valor: number | string): string {
  if (valor === null || valor === undefined) return '';
  
  const decimal = new Decimal(valor);
  if (!decimal.isFinite()) return '';
  
  // Formato con separador de miles como punto y sin decimales (o con decimales si es necesario)
  const valorNum = decimal.toNumber();
  if (valorNum === 0) return '0 m²';
  
  // Determinar si mostrar decimales
  let parteEntera: string;
  let parteDecimal: string = '';
  
  const str = decimal.toFixed(2); // Siempre 2 decimales para procesar
  const partes = str.split('.');
  parteEntera = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Solo mostrar decimales si no son cero
  if (partes[1] !== '00') {
    parteDecimal = ',' + partes[1];
  }
  
  const numeroFormateado = parteEntera + parteDecimal;
  
  // Convertir a literal
  const literalValor = literal(valor);
  
  return \\ m² (\ metros cuadrados)\;
}
