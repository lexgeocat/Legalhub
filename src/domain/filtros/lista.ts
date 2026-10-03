
// domain/filtros/lista.ts
export function lista(array: string[]): string {
  if (array.length === 0) return '';
  if (array.length === 1) return array[0];
  if (array.length === 2) return array[0] + ' y ' + array[1];
  
  // Para 3 o más elementos: A, B, C y D
  return array.slice(0, -1).join(', ') + ' y ' + array[array.length - 1];
}
