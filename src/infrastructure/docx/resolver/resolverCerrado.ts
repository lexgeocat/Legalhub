import { ScopeData, type ScopeDataArgs, type ScopeDataResolver } from 'easy-template-x';
import type { EntradaVerificacion } from '../../../application/puertos/motorPlantillas';
import { ErrorDeDatos, FILTROS } from '../../../domain/filtros';
import { claveNormalizada, mensaje, normalizarCaracteres, parsearToken } from '../gramatica';

export interface OpcionesResolver {
  /** Rutas (como aparecen en el modelo) que pueden quedar vacías. */
  opcionales?: ReadonlySet<string>;
  bitacora?: EntradaVerificacion[];
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function hijo(padre: unknown, clave: string): { existe: boolean; valor?: unknown } {
  if (Array.isArray(padre)) {
    if (!/^\d+$/.test(clave)) return { existe: false };
    const i = Number(clave);
    return i < padre.length ? { existe: true, valor: padre[i] } : { existe: false };
  }
  if (!esObjeto(padre)) return { existe: false };
  const buscada = claveNormalizada(clave);
  for (const k of Object.keys(padre)) {
    if (claveNormalizada(k) === buscada) return { existe: true, valor: padre[k] };
  }
  return { existe: false };
}

function ambitos(raiz: unknown, padres: string[]): unknown[] {
  const cadena: unknown[] = [raiz];
  let actual: unknown = raiz;
  for (const p of padres) {
    const h = hijo(actual, p);
    if (!h.existe || h.valor === null || h.valor === undefined) break;
    actual = h.valor;
    cadena.push(actual);
  }
  return cadena;
}

function buscar(cadena: unknown[], ruta: string): { encontrado: boolean; valor?: unknown } {
  if (ruta === '.') return { encontrado: true, valor: cadena[cadena.length - 1] };
  const segmentos = ruta.split('.');
  for (let i = cadena.length - 1; i >= 0; i--) {
    let actual: unknown = cadena[i];
    let ok = true;
    for (const s of segmentos) {
      const h = hijo(actual, s);
      if (!h.existe) {
        ok = false;
        break;
      }
      actual = h.valor;
    }
    if (ok) return { encontrado: true, valor: actual };
  }
  return { encontrado: false };
}

export function resolverCerrado(opciones: OpcionesResolver = {}): ScopeDataResolver {
  const opcionales = new Set([...(opciones.opcionales ?? [])].map(claveNormalizada));

  return (args: ScopeDataArgs) => {
    const { path, strPath, data } = args;
    if (!path.length) return ScopeData.defaultResolver(args);

    const ultimo: unknown = path[path.length - 1];
    if (typeof ultimo === 'number') {
      const todos = strPath.map(String);
      const cadena = ambitos(data, todos);
      return cadena.length === todos.length + 1 ? cadena[cadena.length - 1] : ScopeData.defaultResolver(args);
    }

    const etiqueta = (ultimo ?? {}) as { name?: unknown; rawText?: unknown };
    const nombre = normalizarCaracteres(String(etiqueta.name ?? '')).trim();
    const crudo = typeof etiqueta.rawText === 'string' ? normalizarCaracteres(etiqueta.rawText) : '';
    const esContenedor = nombre.startsWith('#') || /^\{\{\s*#/.test(crudo);
    const limpio = nombre.replace(/^#\s*/, '');

    let token;
    try {
      token = parsearToken(esContenedor ? `#${limpio}` : limpio);
    } catch (e) {
      throw new ErrorDeDatos(`Marcador inválido «${nombre}»: ${mensaje(e)}`);
    }
    if (token.tipo === 'cierre') throw new ErrorDeDatos(`Marcador de cierre inesperado «${nombre}»`);

    const padres = strPath.slice(0, -1).map(String);
    const cadena = ambitos(data, padres);
    const resuelto = buscar(cadena, token.ruta);

    if (token.tipo === 'apertura') {
      if (!resuelto.encontrado) {
        throw new ErrorDeDatos(`El modelo usa «#${token.ruta}» pero el contexto no lo define`);
      }
      return resuelto.valor ?? false;
    }

    const rutaVisible = [...padres, token.ruta].join('.');
    const esOpcional = opcionales.has(claveNormalizada(token.ruta));
    let valor: unknown = resuelto.valor;
    const sinDato = valor === undefined || valor === null || valor === '';

    if (sinDato) {
      if (!esOpcional) {
        throw new ErrorDeDatos(
          resuelto.encontrado ? `Falta el dato «${rutaVisible}»` : `Dato desconocido «${rutaVisible}»`,
        );
      }
      opciones.bitacora?.push({ ruta: rutaVisible, valor: '', opcionalVacio: true });
      return '';
    }

    for (const f of token.filtros) {
      if (!Object.hasOwn(FILTROS, f.nombre)) throw new ErrorDeDatos(`Filtro desconocido «${f.nombre}»`);
      try {
        valor = FILTROS[f.nombre](valor, ...f.args);
      } catch (e) {
        throw new ErrorDeDatos(`«${rutaVisible} | ${f.nombre}»: ${mensaje(e)}`);
      }
    }

    let texto: string;
    if (typeof valor === 'string') texto = valor;
    else if (typeof valor === 'number' || typeof valor === 'bigint' || typeof valor === 'boolean') texto = String(valor);
    else if (esObjeto(valor) && !Array.isArray(valor) && valor.toString !== Object.prototype.toString) texto = String(valor);
    else throw new ErrorDeDatos(`«${rutaVisible}» no es un valor de texto; usa un filtro (p. ej. lista)`);

    opciones.bitacora?.push({ ruta: rutaVisible, valor: texto });
    return texto;
  };
}