import { ErrorDeDatos } from '../errores';

const conjuncion = (siguiente: string) => (/^h?[ií](?![aeiouáéíóú])/i.test(siguiente) ? 'e' : 'y');

export function lista(items: unknown): string {
  if (!Array.isArray(items)) throw new ErrorDeDatos('El filtro lista espera una lista');
  const nombres = items.map((e: unknown) => {
    if (typeof e === 'string') return e.trim();
    if (typeof e === 'object' && e !== null && typeof (e as { nombre?: unknown }).nombre === 'string') {
      return (e as { nombre: string }).nombre.trim();
    }
    throw new ErrorDeDatos('Cada elemento de la lista debe ser texto o tener «nombre»');
  });
  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0];
  const ultimo = nombres[nombres.length - 1];
  return `${nombres.slice(0, -1).join(', ')} ${conjuncion(ultimo)} ${ultimo}`;
}