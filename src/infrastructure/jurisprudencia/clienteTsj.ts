import {
  ordenarResolucionesPorFechaDesc,
  type FiltroBusquedaJurisprudencia,
  type ResolucionJurisprudencia,
  type ResultadoPaginadoJurisprudencia,
  type SalaTsjCatalogo,
  type TipoResolucionTsjCatalogo,
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
  subtipo_resolucion?: string;
  formas_resoluciones?: string;
  forma_resolucion?: string;
  magistrado?: string;
  materia?: string;
  resumen?: string;
  departamento?: string;
  demandante?: string;
  demandado?: string;
  procesos?: string;
  proceso?: string;
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
  private cacheGestion = new Map<string, { items: ResolucionJurisprudencia[]; timestamp: number }>();

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

    // 1. Modalidad Consulta por Gestión: descarga los registros de la gestión, los ordena
    // por fecha de emisión en el más reciente (descendente) y pagina en memoria.
    if (modalidad === 'gestion') {
      if (!filtro.idSalaTsj) {
        throw new Error('Para la consulta por gestión del TSJ debes seleccionar una Sala institucional.');
      }
      return await this.buscarPorGestion(
        filtro.idSalaTsj,
        filtro.gestion ? Number(filtro.gestion) : new Date().getFullYear(),
        page,
        limit
      );
    }

    let endpointUrl: string;
    let payload: Record<string, unknown>;

    if (modalidad === 'campos') {
      const subcampo = filtro.subcampoTsj ?? 'resolucion';
      if (subcampo === 'expediente') {
        endpointUrl = `${BASE_URL}/resoluciones/busqueda_por_nro_expediente`;
        payload = {
          nroExpediente: (filtro.nroExpediente || filtro.texto).trim(),
          idSala: filtro.idSalaTsj ?? null,
          paginate: { page, limit, sortBy: 'fecha_emision', order: 'desc' },
        };
      } else if (subcampo === 'partes') {
        endpointUrl = `${BASE_URL}/resoluciones/busqueda_por_partes`;
        payload = {
          searchText: (filtro.partes || filtro.texto).trim(),
          idSala: filtro.idSalaTsj ?? null,
          paginate: { page, limit, sortBy: 'fecha_emision', order: 'desc' },
        };
      } else {
        endpointUrl = `${BASE_URL}/resoluciones/busqueda_por_nro_resolucion`;
        payload = {
          nroResolucion: (filtro.nroResolucion || filtro.texto).trim(),
          idSala: filtro.idSalaTsj ?? null,
          paginate: { page, limit, sortBy: 'fecha_emision', order: 'desc' },
        };
      }
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
        paginate: { page, limit, sortBy: 'fecha_emision', order: 'desc' },
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
        paginate: { page, limit, sortBy: 'fecha_emision', order: 'desc' },
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

    const rawItems: ResolucionJurisprudencia[] = (json.data?.data ?? []).map((item) => ({
      id: String(item.id),
      idRemoto: String(item.id),
      origen: 'TSJ',
      tipoResolucion: item.tipo_resolucion || 'Auto Supremo',
      subtipoResolucion: item.subtipo_resolucion,
      numeroResolucion: item.nro_resolucion,
      numeroExpediente: item.nro_expediente,
      fechaEmision: item.fecha_emision,
      sala: item.sala,
      departamento: item.departamento,
      magistrado: item.magistrado,
      proceso: item.procesos || item.proceso,
      formaResolucion: item.formas_resoluciones || item.forma_resolucion,
      materia: item.materia,
      demandante: item.demandante,
      demandado: item.demandado,
      resumen: item.resumen || (item.procesos ? `Proceso: ${item.procesos}` : undefined),
    }));

    // Asegurar ordenamiento descendente por fecha de emisión (más reciente primero)
    const items = ordenarResolucionesPorFechaDesc(rawItems);

    return {
      items,
      total: json.data?.meta?.count ?? items.length,
      pagina: json.data?.meta?.page ?? page,
      totalPaginas: json.data?.meta?.totalPages ?? Math.max(1, Math.ceil((json.data?.meta?.count ?? items.length) / limit)),
    };
  }

  private async buscarPorGestion(
    idSala: number,
    gestion: number,
    page: number,
    limit: number
  ): Promise<ResultadoPaginadoJurisprudencia> {
    const claveCache = `${idSala}_${gestion}`;
    const ahora = Date.now();
    const TTL_MS = 3 * 60 * 1000; // 3 minutos

    let todosLosItems: ResolucionJurisprudencia[] | null = null;
    const cacheado = this.cacheGestion.get(claveCache);

    if (cacheado && (page > 1 || ahora - cacheado.timestamp < TTL_MS)) {
      todosLosItems = cacheado.items;
    }

    if (!todosLosItems) {
      const res = await fetchHttp(`${BASE_URL}/resoluciones/busqueda_por_gestion`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          idSala,
          gestion,
          idTipoRes: null,
          paginate: { page: 1, limit: 2000 },
        }),
      });

      if (!res.ok) {
        throw new Error(`Error del servidor TSJ Génesis (${res.status}): ${res.statusText}`);
      }

      const json: TsjSearchResponse = await res.json();
      if (json.success === false) {
        throw new Error(json.message || 'Error en la respuesta del TSJ');
      }

      let rawItems: TsjItem[] = json.data?.data ?? [];
      const totalPages = json.data?.meta?.totalPages ?? 1;

      if (totalPages > 1) {
        for (let p = 2; p <= totalPages; p++) {
          try {
            const resP = await fetchHttp(`${BASE_URL}/resoluciones/busqueda_por_gestion`, {
              method: 'POST',
              headers: HEADERS,
              body: JSON.stringify({
                idSala,
                gestion,
                idTipoRes: null,
                paginate: { page: p, limit: 2000 },
              }),
            });
            if (resP.ok) {
              const jsonP: TsjSearchResponse = await resP.json();
              if (jsonP.success !== false && Array.isArray(jsonP.data?.data)) {
                rawItems = rawItems.concat(jsonP.data.data);
              }
            }
          } catch {
            break;
          }
        }
      }

      const mapeados: ResolucionJurisprudencia[] = rawItems.map((item) => ({
        id: String(item.id),
        idRemoto: String(item.id),
        origen: 'TSJ',
        tipoResolucion: item.tipo_resolucion || 'Auto Supremo',
        subtipoResolucion: item.subtipo_resolucion,
        numeroResolucion: item.nro_resolucion,
        numeroExpediente: item.nro_expediente,
        fechaEmision: item.fecha_emision,
        sala: item.sala,
        departamento: item.departamento,
        magistrado: item.magistrado,
        proceso: item.procesos || item.proceso,
        formaResolucion: item.formas_resoluciones || item.forma_resolucion,
        materia: item.materia,
        demandante: item.demandante,
        demandado: item.demandado,
        resumen: item.resumen || (item.procesos ? `Proceso: ${item.procesos}` : undefined),
      }));

      todosLosItems = ordenarResolucionesPorFechaDesc(mapeados);
      this.cacheGestion.set(claveCache, { items: todosLosItems, timestamp: ahora });
    }

    const total = todosLosItems.length;
    const totalPaginas = Math.max(1, Math.ceil(total / limit));
    const inicio = (page - 1) * limit;
    const itemsPagina = todosLosItems.slice(inicio, inicio + limit);

    return {
      items: itemsPagina,
      total,
      pagina: page,
      totalPaginas,
    };
  }

  async obtenerDetalle(id: string): Promise<ResolucionJurisprudencia> {
    // Intentar primero con /jurisprudencia/:id que incluye las fichas jurisprudenciales completas
    let res = await fetchHttp(`${BASE_URL}/jurisprudencia/${id}`, {
      method: 'GET',
      headers: HEADERS,
    });

    if (!res.ok) {
      // Fallback a /resoluciones/:id
      res = await fetchHttp(`${BASE_URL}/resoluciones/${id}`, {
        method: 'GET',
        headers: HEADERS,
      });
    }

    if (!res.ok) {
      throw new Error(`No se pudo cargar el detalle del TSJ (${res.status})`);
    }

    const json = await res.json();
    if (json.success === false) {
      throw new Error(json.message || 'No se pudo obtener el detalle de la resolución');
    }

    const d = json.data;

    // Procesar array de jurisprudencia (fichas jurisprudenciales oficiales)
    const rawFichas = Array.isArray(d.jurisprudencia) ? d.jurisprudencia : [];
    const fichas = rawFichas.map((j: Record<string, unknown>) => ({
      id: j.id != null ? String(j.id) : undefined,
      maxima: typeof j.maxima === 'string' ? j.maxima : undefined,
      sintesis: typeof j.sintesis === 'string' ? j.sintesis : undefined,
      ratioDecidendi: typeof j.ratio === 'string' ? j.ratio : undefined,
      descriptor: typeof j.descriptor === 'string' ? j.descriptor : undefined,
      restrictor: typeof j.restrictor === 'string' ? j.restrictor : undefined,
      precedente: typeof j.precedente === 'string' ? j.precedente : undefined,
      tipoJurisprudencia: typeof j.tipo_jurisprudencia === 'string' ? j.tipo_jurisprudencia : undefined,
      formaResolucion: typeof d.formas_resoluciones === 'string' ? d.formas_resoluciones : undefined,
    }));

    const primeraFicha = fichas[0];

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
      proceso: d.procesos || d.nro_expediente,
      formaResolucion: d.formas_resoluciones,
      tipoJurisprudencia: primeraFicha?.tipoJurisprudencia,
      maxima: primeraFicha?.maxima,
      sintesis: primeraFicha?.sintesis,
      ratioDecidendi: primeraFicha?.ratioDecidendi,
      descriptor: primeraFicha?.descriptor,
      restrictor: primeraFicha?.restrictor,
      precedente: primeraFicha?.precedente,
      fichas: fichas.length > 0 ? fichas : undefined,
      contenidoHtml: d.contenido,
      urlPdf: d.url_pdf_escaneado,
      tieneHtml: d.tiene_html,
    };
  }

  async descargarPdf(id: string, urlPdf?: string): Promise<{ buffer: Uint8Array; nombreArchivo: string }> {
    let res: Response;
    if (urlPdf) {
      res = await fetchHttp(urlPdf, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf, */*',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });
    } else {
      res = await fetchHttp(`${BASE_URL}/resoluciones/${id}/pdf`, {
        method: 'GET',
        headers: HEADERS,
      });
    }

    if (!res.ok) {
      if (!urlPdf) {
        try {
          const det = await this.obtenerDetalle(id);
          if (det.urlPdf) {
            return await this.descargarPdf(id, det.urlPdf);
          }
        } catch {
          // Fallback omitido si detalle no tiene urlPdf
        }
      }
      throw new Error(`No se pudo descargar el PDF de la resolución TSJ (${res.status})`);
    }

    const arrayBuf = await res.arrayBuffer();
    return {
      buffer: new Uint8Array(arrayBuf),
      nombreArchivo: `TSJ_${id}.pdf`,
    };
  }
}
