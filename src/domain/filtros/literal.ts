
// domain/filtros/literal.ts
import { toWords } from 'n2words';

export function literal(numero: number | string): string {
  const num = typeof numero === 'string' ? parseFloat(numero) : numero;
  if (isNaN(num)) return '';
  
  // n2words con lenguaje español
  return toWords(num, { lang: 'es' });
}
