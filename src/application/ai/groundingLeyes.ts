import { claveNormalizada } from '../../domain/comun/texto';
import type { Ley, Leyes, ResultadoBusquedaLey } from '../casosDeUso/leyes';
import type { ArticuloContexto } from './proveedoresIa';
import { extraerTerminos, numerosDeArticulo } from './textoConsulta';

export interface ResultadoGrounding {
  articulos: ArticuloContexto[];
  leyesNombres: string[];
  terminosBuscados: string[];
}

interface Opciones { presupuesto?: number; maxArticulos?: number }

const MAX_TEXTO = 1500;
const recortar = (t: string) => (t.length > MAX_TEXTO ? `${t.slice(0, MAX_TEXTO).trimEnd()} […]` : t);

/**
 * Recupera de las leyes cargadas los artículos más relevantes para la consulta.
 * Ranking por fusión de resultados (número exacto > frase > palabras sueltas), en paralelo y con tope de contexto.
 * Si nada coincide devuelve [] (nunca artículos de relleno).
 */
export async function recopilarGroundingLeyes(
  servicios: { leyes: Leyes },
  ids: ReadonlySet<string>,
  consulta: string,
  leyes: readonly Ley[],
  { presupuesto = 14000, maxArticulos = 10 }: Opciones = {},
): Promise<ResultadoGrounding> {
  const elegidas = leyes.filter((l) => ids.has(l.id));
  const leyesNombres = elegidas.map((l) => l.nombre);
  const numeros = numerosDeArticulo(consulta);
  const terminos = extraerTerminos(consulta, 8);
  if (elegidas.length === 0) return { articulos: [], leyesNombres, terminosBuscados: terminos };

  const todas = elegidas.length === leyes.length;
  const buscarEn = async (q: string, limite: number): Promise<ResultadoBusquedaLey[]> => {
    if (todas) return (await servicios.leyes.buscar(q, undefined, limite * 2)).filter((r) => ids.has(r.leyId));
    return (await Promise.all(elegidas.map((l) => servicios.leyes.buscar(q, l.id, limite)))).flat();
  };

  const puntos = new Map<string, number>();
  const nodos = new Map<string, ResultadoBusquedaLey>();
  const sumar = (lista: readonly ResultadoBusquedaLey[], peso: number) =>
    lista.filter((r) => r.nivel === 'articulo').forEach((r, rango) => {
      nodos.set(r.id, r);
      puntos.set(r.id, (puntos.get(r.id) ?? 0) + peso / (10 + rango));
    });

  await Promise.all([
    ...numeros.map(async (n) => sumar((await buscarEn(n, 3)).filter((r) => claveNormalizada(r.numero) === n), 100)),
    ...(terminos.length > 1 ? [buscarEn(terminos.slice(0, 3).join(' '), 8).then((r) => sumar(r, 4))] : []),
    ...terminos.slice(0, 4).map(async (t) => sumar(await buscarEn(t, 6), 2)),
  ]);

  const ranking = [...puntos].sort((a, b) => b[1] - a[1]).slice(0, maxArticulos * 2).map(([id]) => id);
  const detalles = await Promise.all(ranking.map((id) => servicios.leyes.obtenerNodo(id)));

  const articulos: ArticuloContexto[] = [];
  let usado = 0;
  for (const d of detalles) {
    if (!d?.texto.trim() || articulos.length >= maxArticulos) continue;
    const texto = recortar(d.texto.trim());
    if (usado + texto.length > presupuesto) break;
    usado += texto.length;
    articulos.push({ leyNombre: d.leyNombre, numero: d.numero, titulo: d.titulo || undefined, texto });
  }
  return { articulos, leyesNombres, terminosBuscados: [...numeros, ...terminos] };
}
