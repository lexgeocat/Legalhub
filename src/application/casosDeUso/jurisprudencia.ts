import type {
  FiltroBusquedaJurisprudencia,
  ResolucionJurisprudencia,
  ResultadoPaginadoJurisprudencia,
  SalaTsjCatalogo,
  TipoResolucionTsjCatalogo,
} from '../../domain/jurisprudencia/jurisprudencia';
import type {
  IClienteTcp,
  IClienteTsj,
  IRepositorioJurisprudencia,
} from '../puertos/jurisprudencia';

interface Dependencias {
  clienteTsj: IClienteTsj;
  clienteTcp: IClienteTcp;
  repositorio: IRepositorioJurisprudencia;
}

export class JurisprudenciaCasosDeUso {
  private tsj: IClienteTsj;
  private tcp: IClienteTcp;
  private repo: IRepositorioJurisprudencia;

  constructor({ clienteTsj, clienteTcp, repositorio }: Dependencias) {
    this.tsj = clienteTsj;
    this.tcp = clienteTcp;
    this.repo = repositorio;
  }

  private tieneCriterioBusqueda(filtro: FiltroBusquedaJurisprudencia): boolean {
    if (filtro.texto && filtro.texto.trim()) return true;
    if (filtro.origen === 'TSJ') {
      if (filtro.modalidadTsj === 'campos') {
        return !!(filtro.nroResolucion?.trim() || filtro.nroExpediente?.trim() || filtro.partes?.trim());
      }
      if (filtro.modalidadTsj === 'gestion') {
        return !!(filtro.idSalaTsj && filtro.gestion);
      }
      if (filtro.modalidadTsj === 'avanzada') {
        return !!(
          filtro.palabrasTodas?.trim() ||
          filtro.fraseExacta?.trim() ||
          filtro.palabrasCualquiera?.trim() ||
          filtro.palabrasExcluir?.trim()
        );
      }
    }
    return false;
  }

  /**
   * Búsqueda en línea (TSJ, TCP o combinada).
   */
  async buscarEnLinea(filtro: FiltroBusquedaJurisprudencia): Promise<ResultadoPaginadoJurisprudencia> {
    if (!this.tieneCriterioBusqueda(filtro)) {
      return { items: [], total: 0, pagina: 1, totalPaginas: 0 };
    }

    if (filtro.origen === 'TSJ') {
      const res = await this.tsj.buscar(filtro);
      await this.marcarGuardadas(res.items);
      return res;
    }

    if (filtro.origen === 'TCP') {
      const res = await this.tcp.buscar(filtro);
      await this.marcarGuardadas(res.items);
      return res;
    }

    // Buscar en ambos en paralelo
    const limitePorFuente = Math.max(5, Math.floor((filtro.limite ?? 20) / 2));
    const [resTsj, resTcp] = await Promise.allSettled([
      this.tsj.buscar({ ...filtro, limite: limitePorFuente }),
      this.tcp.buscar({ ...filtro, limite: limitePorFuente }),
    ]);

    const itemsTsj = resTsj.status === 'fulfilled' ? resTsj.value.items : [];
    const itemsTcp = resTcp.status === 'fulfilled' ? resTcp.value.items : [];
    const totalTsj = resTsj.status === 'fulfilled' ? resTsj.value.total : 0;
    const totalTcp = resTcp.status === 'fulfilled' ? resTcp.value.total : 0;

    // Intercalar resultados para diversidad de fuentes
    const combinados: ResolucionJurisprudencia[] = [];
    const maxLen = Math.max(itemsTsj.length, itemsTcp.length);
    for (let i = 0; i < maxLen; i++) {
      if (itemsTsj[i]) combinados.push(itemsTsj[i]);
      if (itemsTcp[i]) combinados.push(itemsTcp[i]);
    }

    await this.marcarGuardadas(combinados);

    const total = totalTsj + totalTcp;
    const limit = filtro.limite ?? 20;
    return {
      items: combinados,
      total,
      pagina: filtro.pagina ?? 1,
      totalPaginas: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Búsqueda en la biblioteca local guardada en SQLite */
  async buscarLocal(filtro: FiltroBusquedaJurisprudencia): Promise<ResultadoPaginadoJurisprudencia> {
    return this.repo.buscarLocal(filtro);
  }

  /** Carga el detalle completo con texto HTML si aún no fue cargado */
  async obtenerDetalle(resolucion: ResolucionJurisprudencia): Promise<ResolucionJurisprudencia> {
    if (resolucion.contenidoHtml) {
      return resolucion;
    }

    if (resolucion.origen === 'TSJ') {
      const detalle = await this.tsj.obtenerDetalle(resolucion.id);
      return {
        ...resolucion,
        ...detalle,
        guardadaLocal: resolucion.guardadaLocal,
      };
    }

    if (resolucion.origen === 'TCP') {
      const html = await this.tcp.obtenerDocumentoHtml(resolucion.id);
      return {
        ...resolucion,
        contenidoHtml: html,
      };
    }

    return resolucion;
  }

  /** Descarga el binario PDF desde la fuente original */
  async descargarPdf(resolucion: ResolucionJurisprudencia): Promise<{ buffer: Uint8Array; nombreArchivo: string }> {
    if (resolucion.origen === 'TSJ') {
      return this.tsj.descargarPdf(resolucion.id);
    }
    return this.tcp.descargarPdf(resolucion.id);
  }

  /** Guarda la resolución en la biblioteca local y descarga su PDF si está disponible */
  async guardarEnBiblioteca(resolucion: ResolucionJurisprudencia): Promise<string> {
    // Asegurar que tenemos el contenido completo
    const completa = await this.obtenerDetalle(resolucion);

    let pdfBuffer: Uint8Array | undefined;
    try {
      const resPdf = await this.descargarPdf(completa);
      pdfBuffer = resPdf.buffer;
    } catch {
      // Si la descarga del PDF falla o no tiene PDF escaneado, se guarda con su HTML
    }

    const id = await this.repo.guardar(completa, pdfBuffer);
    return id;
  }

  /** Elimina una resolución de la biblioteca local */
  async eliminarDeBiblioteca(id: string): Promise<void> {
    return this.repo.eliminar(id);
  }

  /** Vincula una jurisprudencia guardada a un expediente del despacho */
  async vincularAExpediente(jurisprudenciaId: string, expedienteId: string, notas?: string): Promise<void> {
    return this.repo.vincularAExpediente(jurisprudenciaId, expedienteId, notas);
  }

  /** Desvincula una jurisprudencia de un expediente */
  async desvincularDeExpediente(jurisprudenciaId: string, expedienteId: string): Promise<void> {
    return this.repo.desvincularDeExpediente(jurisprudenciaId, expedienteId);
  }

  /** Lista la jurisprudencia vinculada a un expediente */
  async listarPorExpediente(expedienteId: string): Promise<ResolucionJurisprudencia[]> {
    return this.repo.listarPorExpediente(expedienteId);
  }

  /** Obtiene las salas del Tribunal Supremo de Justicia */
  async obtenerSalasTsj(): Promise<SalaTsjCatalogo[]> {
    return this.tsj.obtenerSalas();
  }

  /** Obtiene los tipos de resolución del TSJ */
  async obtenerTiposResolucionTsj(idSala?: number): Promise<TipoResolucionTsjCatalogo[]> {
    return this.tsj.obtenerTiposResolucion(idSala);
  }

  private async marcarGuardadas(items: ResolucionJurisprudencia[]): Promise<void> {
    await Promise.all(
      items.map(async (item) => {
        item.guardadaLocal = await this.repo.esGuardada(item.numeroResolucion, item.origen);
      })
    );
  }
}
