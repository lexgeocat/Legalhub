import { ErrorDeDatos } from '../errores';

type Genero = 'M' | 'F';
type ConGenero = { genero: Genero | null };

export function concordar(
  entrada: ConGenero | ConGenero[],
  singM: string, singF: string, plurM?: string, plurF?: string,
): string {
  const partes = Array.isArray(entrada) ? entrada : [entrada];
  if (partes.length === 0) return '';
  if (partes.some((p) => p?.genero !== 'M' && p?.genero !== 'F')) {
    throw new ErrorDeDatos('Falta el género de una de las partes');
  }
  const pm = plurM ?? singM + 's';
  const pf = plurF ?? singF + 's';
  const todasF = partes.every((p) => p.genero === 'F');
  if (partes.length === 1) return todasF ? singF : singM;
  return todasF ? pf : pm;
}