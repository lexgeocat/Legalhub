import type {
  FiltroBusquedaJurisprudencia,
  ResolucionJurisprudencia,
  ResultadoPaginadoJurisprudencia,
} from '../../domain/jurisprudencia/jurisprudencia';
import { formatearFechaIsoBolivia } from '../../domain/jurisprudencia/jurisprudencia';
import type { IClienteTcp } from '../../application/puertos/jurisprudencia';
import { fetchHttp } from './httpHelper';

const BASE_URL = 'https://buscador.tcpbolivia.bo/api';
const SECRET_KEY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

interface TcpItem {
  resolucionId: number;
  expedienteId: number;
  numeroExpediente: string;
  referencia: string;
  tipoResolucion: string;
  resolucion: string;
  fecha: string;
  baseId?: number;
}

function ordenarClavesObjeto(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.keys(obj as Record<string, unknown>)
    .sort()
    .reduce((acc, key) => {
      acc[key] = (obj as Record<string, unknown>)[key];
      return acc;
    }, {} as Record<string, unknown>);
}

async function firmarPeticionTcp(metodo: string, cuerpoSerializado?: string): Promise<{ timestamp: string; hash: string }> {
  const timestamp = Date.now().toString();
  const strCuerpo = cuerpoSerializado ?? '';
  const cadenaFirma = `${metodo.toUpperCase()}|${strCuerpo}|${timestamp}`;
  const encoder = new TextEncoder();
  const claveBin = encoder.encode(SECRET_KEY);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    claveBin,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const firmaBuf = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(cadenaFirma));
  const hash = Array.from(new Uint8Array(firmaBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { timestamp, hash };
}

interface CacheEntrada {
  items: TcpItem[];
  expira: number;
}

export class ClienteTcp implements IClienteTcp {
  private cache = new Map<string, CacheEntrada>();

  async buscar(filtro: FiltroBusquedaJurisprudencia): Promise<ResultadoPaginadoJurisprudencia> {
    const texto = filtro.texto.trim();
    const cacheKey = `${texto.toLowerCase()}`;
    const ahora = Date.now();

    let itemsRaw: TcpItem[];

    // Caché de 5 minutos para búsquedas idénticas evitando red repetida (Q13)
    const enCache = this.cache.get(cacheKey);
    if (enCache && enCache.expira > ahora) {
      itemsRaw = enCache.items;
    } else {
      const url = `${BASE_URL}/buscador-jurisprudencia/buscarResolucionJurisprudencia`;
      const payload = {
        seccionId: 0,
        texto,
        tipoBusqueda: 'todos',
      };

      // Enviar exactamente la misma cadena serializada y ordenada que se firma (Q14)
      const cuerpoSerializado = JSON.stringify(ordenarClavesObjeto(payload));
      const { timestamp, hash } = await firmarPeticionTcp('POST', cuerpoSerializado);

      const res = await fetchHttp(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': 'angular-app',
          'X-Timestamp': timestamp,
          'X-Hash': hash,
        },
        body: cuerpoSerializado,
      });

      if (!res.ok) {
        throw new Error(`Error en el buscador del TCP (${res.status}): ${res.statusText}`);
      }

      const resJson = await res.json();
      itemsRaw = Array.isArray(resJson) ? resJson : [];
      this.cache.set(cacheKey, { items: itemsRaw, expira: ahora + 5 * 60 * 1000 });
    }

    // Filtrar localmente por gestión (año) o materia si se especificaron
    let filtrados = itemsRaw;
    if (filtro.gestion) {
      const g = filtro.gestion.trim();
      filtrados = filtrados.filter((it) => it.fecha?.startsWith(g) || it.resolucion?.includes(g));
    }
    if (filtro.materia) {
      const m = filtro.materia.toLowerCase();
      filtrados = filtrados.filter(
        (it) => it.tipoResolucion?.toLowerCase().includes(m) || it.referencia?.toLowerCase().includes(m)
      );
    }

    const total = filtrados.length;
    const page = filtro.pagina ?? 1;
    const limit = filtro.limite ?? 15;
    const inicio = (page - 1) * limit;
    const paginaItems = filtrados.slice(inicio, inicio + limit);

    const items: ResolucionJurisprudencia[] = paginaItems.map((item) => {
      const tipoReal = item.tipoResolucion?.trim() || 'Sentencia Constitucional Plurinacional';
      return {
        id: String(item.resolucionId),
        idRemoto: String(item.resolucionId),
        origen: 'TCP',
        tipoResolucion: tipoReal,
        subtipoResolucion: item.tipoResolucion,
        numeroResolucion: item.resolucion,
        numeroExpediente: item.numeroExpediente,
        fechaEmision: formatearFechaIsoBolivia(item.fecha),
        resumen: item.referencia,
      };
    });

    return {
      items,
      total,
      pagina: page,
      totalPaginas: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async obtenerDocumentoHtml(resolucionId: string | number): Promise<string> {
    const url = `${BASE_URL}/buscador-resolucion/getDocumentHTML/${resolucionId}`;
    const { timestamp, hash } = await firmarPeticionTcp('GET');

    const res = await fetchHttp(url, {
      method: 'GET',
      headers: {
        'X-Client-ID': 'angular-app',
        'X-Timestamp': timestamp,
        'X-Hash': hash,
      },
    });

    if (!res.ok) {
      throw new Error(`No se pudo cargar el documento HTML del TCP (${res.status})`);
    }

    const json = await res.json();
    return json.HTML ?? '';
  }

  async descargarPdf(resolucionId: string | number): Promise<{ buffer: Uint8Array; nombreArchivo: string }> {
    const url = `${BASE_URL}/buscador-resolucion/getDocumentPDF/${resolucionId}`;
    const { timestamp, hash } = await firmarPeticionTcp('GET');

    const res = await fetchHttp(url, {
      method: 'GET',
      headers: {
        'X-Client-ID': 'angular-app',
        'X-Timestamp': timestamp,
        'X-Hash': hash,
      },
    });

    if (!res.ok) {
      throw new Error(`No se pudo descargar el PDF de la resolución del TCP (${res.status})`);
    }

    const json = await res.json();
    if (!json.PDF || !Array.isArray(json.PDF.data)) {
      throw new Error('La resolución no tiene un archivo PDF disponible en el TCP');
    }

    const buffer = new Uint8Array(json.PDF.data);
    return {
      buffer,
      nombreArchivo: `TCP_${resolucionId}.pdf`,
    };
  }
}
