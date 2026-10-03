
// domain/filtros/concordar.ts
type Genero = 'M' | 'F';

export function concordar(
  partes: { genero: Genero | null }[],
  singM: string, singF: string, plurM?: string, plurF?: string,
): string {
  if (partes.length === 0) return '';
  if (partes.some(p => p.genero === null)) {
    throw new ErrorDeDatos('Falta el género de una de las partes');
  }
  const pm = plurM ?? singM + 's';
  const pf = plurF ?? singF + 's';
  const todasF = partes.every(p => p.genero === 'F');
  if (partes.length === 1) return todasF ? singF : singM;
  return todasF ? pf : pm;
}

// Definimos el error personalizado
export class ErrorDeDatos extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorDeDatos';
  }
}
