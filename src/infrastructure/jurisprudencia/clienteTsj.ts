import type {
  FiltroBusquedaJurisprudencia,
  ResolucionJurisprudencia,
  ResultadoPaginadoJurisprudencia,
  SalaTsjCatalogo,
  TipoResolucionTsjCatalogo,
} from '../../domain/jurisprudencia/jurisprudencia';
import type { IClienteTsj } from '../../application/puertos/jurisprudencia';
import { fetchHttp } from './httpHelper';

const BASE_URL = 'https://apigenesis.tsj.bo/api/v1';

const HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
  'username': 'buscadorgenesis',
  'apikey': 'CiAYFxnN4GwYgtDv+0jo8MSm1VuTZ53ah8aJ2L8GkgI=',
  'Origin': 'https://genesis.tsj.bo',
  'Referer': 'https://genesis.tsj.bo/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

interface TsjItem {
  id: string | number;
  nro_resolucion: string;
  nro_expediente?: string;
  fecha_emision: string;
  sala?: string;
  tipo_resolucion?: string;
  formas_resoluciones?: string;
  resumen?: string;
  departamento?: string;
  demandante?: string;
  demandado?: string;
  procesos?: string;
}

interface TsjSearchResponse {
  success: boolean;
  message?: string;
  data: {
    meta: {
      count: number;
      page: number;
      perPage: number;
      totalPages: number;
    };
    data: TsjItem[];
  };
}

interface TsjDetailResponse {
  success: boolean;
  message?: string;
  data: {
    id: number | string;
    nro_resolucion: string;
    nro_expediente?: string;
    fecha_emision: string;
    demandante?: string;
    demandado?: string;
    departamento?: string;
    sala?: string;
    tipo_resolucion: string;
    subtipo_resolucion?: string;
    magistrado?: string;
    materia?: string;
    formas_resoluciones?: string;
    contenido?: string;
    tiene_html?: boolean;
    url_pdf_escaneado?: string;
  };
}

const SALAS_FALLBACK: SalaTsjCatalogo[] = [
  { id: 2, nombre: 'Sala Penal 1' },
  { id: 4, nombre: 'Sala Penal Liquidadora' },
  { id: 6, nombre: 'Sala Civil 1' },
  { id: 8, nombre: 'Sala Civil Liquidadora' },
  { id: 10, nombre: 'Sala Social' },
  { id: 12, nombre: 'Sala Plena' },
  { id: 21, nombre: 'Sala Civil' },
  { id: 22, nombre: 'Sala Contenciosa y Contenciosa Adm. Social 1ra' },
  { id: 23, nombre: 'Sala Contenciosa y Contenciosa Adm. Social 2da' },
  { id: 24, nombre: 'Sala Penal' },
  { id: 30, nombre: 'Sala Social Liquidadora' },
  { id: 31, nombre: 'Sala Social 1era Liquidadora' },
  { id: 32, nombre: 'Sala Social 2da Liquidadora' },
  { id: 5011, nombre: 'Sala Civil 2' },
  { id: 5012, nombre: 'Sala Penal 2' },
];

export class ClienteTsj implements IClienteTsj {
  private salasCache: SalaTsjCatalogo[] | null = null;
  private tiposResCache = new Map<number | string, TipoResolucionTsjCatalogo[]>();

  async obtenerSalas(): Promise<SalaTsjCatalogo[]> {
    if (this.salasCache) return this.salasCache;
    try {
      const res = await fetchHttp(`${BASE_URL}/catalogos/salas`, {
        method: 'GET',
        headers: HEADERS,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success !== false && Array.isArray(json.data) && json.data.length > 0) {
          this.salasCache = json.data;
          return json.data;
        }
      }
    } catch {
      // Si falla la red, usar catálogo de respaldo temporal sin guardar en salasCache (Q17)
    }
    return SALAS_FALLBACK;
  }

  async obtenerTiposResolucion(idSala?: number): Promise<TipoResolucionTsjCatalogo[]> {
    const clave = idSala ?? 'todas';
    if (this.tiposResCache.has(clave)) {
      return this.tiposResCache.get(clave)!;
    }

    try {
      const url = idSala
        ? `${BASE_URL}/catalogos/tipos-resoluciones?idSala=${idSala}`
        : `${BASE_URL}/catalogos/tipos-resoluciones`;
      const res = await fetchHttp(url, { method: 'GET', headers: HEADERS });
      if (res.ok) {
        const json = await res.json();
        if (json.success !== false && Array.isArray(json.data) && json.data.length > 0) {
          this.tiposResCache.set(clave, json.data);
          return json.data;
        }
      }
    } catch {
      // Fallback
    }

    const fallback: TipoResolucionTsjCatalogo[] = [
      { id: 1, nombre: 'Auto Supremo' },
      { id: 2, nombre: 'Sentencia' },
      { id: 3, nombre: 'Resolución' },
    ];
    return fallback;
  }

  async buscar(filtro: FiltroBusquedaJurisprudencia): Promise<ResultadoPaginadoJurisprudencia> {
    const page = filtro.pagina ?? 1;
    const limit = filtro.limite ?? 15;
    const modalidad = filtro.modalidadTsj ?? 'simple';

    let endpointUrl: string;
    let payload: Record<string, unknown>;

    if (modalidad === 'campos') {
      const subcampo = filtro.subcampoTsj ?? 'resolucion';
      if (subcampo === 'expediente') {
        endpointUrl = `${BASE_URL}/resoluciones/busqueda_por_nro_expediente`;
        payload = {
          nroExpediente: (filtro.nroExpediente || filtro.texto).trim(),
          idSala: filtro.idSalaTsj ?? null,
          paginate: { page, limit },
        };
      } else if (subcampo === 'partes') {
        endpointUrl = `${BASE_URL}/resoluciones/busqueda_por_partes`;
        payload = {
          searchText: (filtro.partes || filtro.texto).trim(),
          idSala: filtro.idSalaTsj ?? null,
          paginate: { page, limit },
        };
      } else {
        endpointUrl = `${BASE_URL}/resoluciones/busqueda_por_nro_resolucion`;
        payload = {
          nroResolucion: (filtro.nroResolucion || filtro.texto).trim(),
          idSala: filtro.idSalaTsj ?? null,
          paginate: { page, limit },
        };
      }
    } else if (modalidad === 'gestion') {
      if (!filtro.idSalaTsj) {
        throw new Error('Para la consulta por gestión del TSJ debes seleccionar una Sala institucional.');
      }
      endpointUrl = `${BASE_URL}/resoluciones/busqueda_por_gestion`;
      payload = {
        idSala: filtro.idSalaTsj,
        gestion: Number(filtro.gestion || new Date().getFullYear()),
        idTipoRes: filtro.idTipoResTsj ?? null,
        paginate: { page, limit },
      };
    } else if (modalidad === 'avanzada') {
      endpointUrl = `${BASE_URL}/resoluciones/busqueda_avanzada`;
      let todas: string | null = null;
      let exacta: string | null = null;
      let cualquiera: string | null = null;

      if (filtro.fraseExacta?.trim()) {
        exacta = filtro.fraseExacta.trim();
      } else if (filtro.palabrasTodas?.trim()) {
        todas = filtro.palabrasTodas.trim();
      } else if (filtro.palabrasCualquiera?.trim()) {
        cualquiera = filtro.palabrasCualquiera.trim();
      } else if (filtro.texto?.trim()) {
        todas = filtro.texto.trim();
      }

      payload = {
        searchData: {
          todasEstasPalabras: todas,
          estaPalabraOFraseExacta: exacta,
          cualquieraEstasPalabras: cualquiera,
          ningunaEstasPalabras: filtro.palabrasExcluir?.trim() || null,
        },
        filter: {
          ...(filtro.idSalaTsj ? { idSala: filtro.idSalaTsj } : {}),
          ...(filtro.gestion ? { gestion: Number(filtro.gestion) } : {}),
          ...(filtro.materia ? { materia: filtro.materia } : {}),
        },
        paginate: { page, limit },
      };
    } else {
      endpointUrl = `${BASE_URL}/resoluciones/busqueda_simple`;
      payload = {
        searchText: filtro.texto.trim(),
        filter: {
          ...(filtro.materia ? { materia: filtro.materia } : {}),
          ...(filtro.idSalaTsj ? { idSala: filtro.idSalaTsj } : {}),
          ...(filtro.sala ? { sala: filtro.sala } : {}),
          ...(filtro.gestion ? { gestion: filtro.gestion } : {}),
        },
        paginate: { page, limit },
      };
    }

    const res = await fetchHttp(endpointUrl, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Error del servidor TSJ Génesis (${res.status}): ${res.statusText}`);
    }

    const json: TsjSearchResponse = await res.json();
    if (json.success === false) {
      throw new Error(json.message || 'Error en la respuesta del TSJ');
    }

    const items: ResolucionJurisprudencia[] = (json.data?.data ?? []).map((item) => ({
      id: String(item.id),
      idRemoto: String(item.id),
      origen: 'TSJ',
      tipoResolucion: item.tipo_resolucion || 'Auto Supremo',
      numeroResolucion: item.nro_resolucion,
      numeroExpediente: item.nro_expediente,
      fechaEmision: item.fecha_emision,
      sala: item.sala,
      departamento: item.departamento,
      demandante: item.demandante,
      demandado: item.demandado,
      resumen: item.resumen || (item.procesos ? `Proceso: ${item.procesos}` : undefined),
    }));

    return {
      items,
      total: json.data?.meta?.count ?? items.length,
      pagina: json.data?.meta?.page ?? page,
      totalPaginas: json.data?.meta?.totalPages ?? Math.max(1, Math.ceil((json.data?.meta?.count ?? items.length) / limit)),
    };
  }

  async obtenerDetalle(id: string): Promise<ResolucionJurisprudencia> {
    const res = await fetchHttp(`${BASE_URL}/resoluciones/${id}`, {
      method: 'GET',
      headers: HEADERS,
    });

    if (!res.ok) {
      throw new Error(`No se pudo cargar el detalle del TSJ (${res.status})`);
    }

    const json: TsjDetailResponse = await res.json();
    if (json.success === false) {
      throw new Error(json.message || 'No se pudo obtener el detalle de la resolución');
    }

    const d = json.data;

    return {
      id: String(d.id),
      idRemoto: String(d.id),
      origen: 'TSJ',
      tipoResolucion: d.tipo_resolucion || 'Auto Supremo',
      subtipoResolucion: d.subtipo_resolucion,
      numeroResolucion: d.nro_resolucion,
      numeroExpediente: d.nro_expediente,
      fechaEmision: d.fecha_emision,
      sala: d.sala,
      departamento: d.departamento,
      magistrado: d.magistrado,
      demandante: d.demandante,
      demandado: d.demandado,
      materia: d.materia,
      contenidoHtml: d.contenido,
    };
  }

  async descargarPdf(id: string): Promise<{ buffer: Uint8Array; nombreArchivo: string }> {
    const res = await fetchHttp(`${BASE_URL}/resoluciones/${id}/pdf`, {
      method: 'GET',
      headers: HEADERS,
    });

    if (!res.ok) {
      throw new Error(`No se pudo descargar el PDF de la resolución TSJ (${res.status})`);
    }

    const arrayBuf = await res.arrayBuffer();
    return {
      buffer: new Uint8Array(arrayBuf),
      nombreArchivo: `TSJ_${id}.pdf`,
    };
  }
}
