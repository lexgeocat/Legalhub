
// domain/filtros/titulo.ts
export function titulo(texto: string): string {
  if (!texto) return texto;

  // Palabras que no se capitalizan (excepto si son la primera palabra)
  const minusculas = ['de', 'del', 'la', 'las', 'los', 'y', 'o', 'u', 'ni', 'por', 'para', 'con'];

  return texto
    .split(' ')
    .map((palabra, indice) => {
      const lower = palabra.toLowerCase();
      // Si es la primera palabra o no está en la lista de minúsculas, capitalizar
      if (indice === 0 || !minusculas.includes(lower)) {
        return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
      }
      return lower;
    })
    .join(' ');
}
