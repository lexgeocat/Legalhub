import type {
  FiltroBusquedaJurisprudencia,
  ResolucionJurisprudencia,
  ResultadoPaginadoJurisprudencia,
} from '../../domain/jurisprudencia/jurisprudencia';
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

async function firmarPeticionTcp(metodo: string, cuerpo?: unknown): Promise<{ timestamp: string; hash: string }> {
  const timestamp = Date.now().toString();
  let strCuerpo = '';

  if (cuerpo) {
    if (metodo.toUpperCase() === 'GET') {
      const rec = cuerpo as Record<string, string>;
      strCuerpo = Object.keys(rec).sort().map(k => `${k}=${rec[k]}`).join('&');
    } else {
      strCuerpo = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(ordenarClavesObjeto(cuerpo));
    }
  }

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

export class ClienteTcp implements IClienteTcp {
  async buscar(filtro: FiltroBusquedaJurisprudencia): Promise<ResultadoPaginadoJurisprudencia> {
    const url = `${BASE_URL}/buscador-jurisprudencia/buscarResolucionJurisprudencia`;
    const payload = {
      texto: filtro.texto,
      tipoBusqueda: 'todos',
      seccionId: 0,
    };

    const { timestamp, hash } = await firmarPeticionTcp('POST', payload);

    const res = await fetchHttp(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': 'angular-app',
        'X-Timestamp': timestamp,
        'X-Hash': hash,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Error en el buscador del TCP (${res.status}): ${res.statusText}`);
    }

    const itemsRaw: TcpItem[] = await res.json();
    if (!Array.isArray(itemsRaw)) {
      return { items: [], total: 0, pagina: 1, totalPaginas: 0 };
    }

    const total = itemsRaw.length;
    const page = filtro.pagina ?? 1;
    const limit = filtro.limite ?? 20;
    const inicio = (page - 1) * limit;
    const paginaItems = itemsRaw.slice(inicio, inicio + limit);

    const items: ResolucionJurisprudencia[] = paginaItems.map((item) => {
      let fechaFormateada = item.fecha;
      try {
        if (item.fecha) {
          const d = new Date(item.fecha);
          fechaFormateada = d.toLocaleDateString('es-BO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        }
      } catch {
        // mantener fecha original si falla el formateo
      }

      return {
        id: String(item.resolucionId),
        origen: 'TCP',
        tipoResolucion: item.tipoResolucion ? `Sentencia Constitucional Plurinacional` : 'Sentencia Constitucional',
        subtipoResolucion: item.tipoResolucion,
        numeroResolucion: item.resolucion,
        numeroExpediente: item.numeroExpediente,
        fechaEmision: fechaFormateada,
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
      nombreArchivo: `SCP_${resolucionId}.pdf`,
    };
  }
}
