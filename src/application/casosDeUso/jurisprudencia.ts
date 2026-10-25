import type {
  FiltroBusquedaJurisprudencia,
  ResolucionJurisprudencia,
  ResultadoPaginadoJurisprudencia,
  SalaTsjCatalogo,
  TipoResolucionTsjCatalogo,
} from '../../domain/jurisprudencia/jurisprudencia';
import {
  esPdfValido,
  extraerMetadatosHtmlTcp,
  generarNombreArchivoPdf,
  mezclarDetalle,
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
    if (filtro.origen === 'TSJ') {
      const mod = filtro.modalidadTsj ?? 'simple';
      if (mod === 'campos') {
        return !!(filtro.nroResolucion?.trim() || filtro.nroExpediente?.trim() || filtro.partes?.trim());
      }
      if (mod === 'gestion') {
        return !!filtro.idSalaTsj;
      }
      if (mod === 'avanzada') {
        return !!(
          filtro.palabrasTodas?.trim() ||
          filtro.fraseExacta?.trim() ||
          filtro.palabrasCualquiera?.trim() ||
          filtro.palabrasExcluir?.trim()
        );
      }
      return !!filtro.texto?.trim();
    }
    return !!filtro.texto?.trim();
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

    // Si ya está guardada localmente, buscar en SQLite primero (F2)
    if (resolucion.guardadaLocal || resolucion.idLocal) {
      const local = resolucion.idLocal
        ? await this.repo.obtenerPorId(resolucion.idLocal)
        : await this.repo.obtenerPorNumeroYOrigen(resolucion.numeroResolucion, resolucion.origen);
      if (local && local.contenidoHtml) {
        return mezclarDetalle(resolucion, local);
      }
    }

    const idRemoto = resolucion.idRemoto ?? resolucion.id;

    if (resolucion.origen === 'TSJ') {
      const detalle = await this.tsj.obtenerDetalle(idRemoto);
      return mezclarDetalle(resolucion, detalle);
    }

    if (resolucion.origen === 'TCP') {
      const html = await this.tcp.obtenerDocumentoHtml(idRemoto);
      const metadatosTcp = extraerMetadatosHtmlTcp(html);
      return mezclarDetalle(resolucion, { ...metadatosTcp, contenidoHtml: html });
    }

    return resolucion;
  }

  /** Descarga el binario PDF desde la fuente original validando integridad (%PDF) (D14) */
  async descargarPdf(resolucion: ResolucionJurisprudencia): Promise<{ buffer: Uint8Array; nombreArchivo: string }> {
    const idRemoto = resolucion.idRemoto ?? resolucion.id;
    let res: { buffer: Uint8Array; nombreArchivo: string };

    if (resolucion.origen === 'TSJ') {
      res = await this.tsj.descargarPdf(idRemoto, resolucion.urlPdf);
    } else {
      res = await this.tcp.descargarPdf(idRemoto);
    }

    if (!esPdfValido(res.buffer)) {
      throw new Error('El archivo devuelto por el servidor no tiene una cabecera PDF válida');
    }

    return {
      buffer: res.buffer,
      nombreArchivo: generarNombreArchivoPdf(resolucion.origen, resolucion.numeroResolucion),
    };
  }

  /** Guarda la resolución en la biblioteca local y descarga su PDF si está disponible */
  async guardarEnBiblioteca(resolucion: ResolucionJurisprudencia): Promise<ResolucionJurisprudencia> {
    const completa = await this.obtenerDetalle(resolucion);

    let pdfBuffer: Uint8Array | undefined;
    try {
      const resPdf = await this.descargarPdf(completa);
      pdfBuffer = resPdf.buffer;
    } catch {
      // Si la descarga del PDF falla o no tiene PDF escaneado, se guarda con su HTML
    }

    const idLocal = await this.repo.guardar(completa, pdfBuffer);
    completa.idLocal = idLocal;
    completa.guardadaLocal = true;
    return completa;
  }

  /** Elimina una resolución de la biblioteca local admitiendo idLocal o resolución remota (D1) */
  async eliminarDeBiblioteca(resolucionOId: ResolucionJurisprudencia | string): Promise<void> {
    if (typeof resolucionOId === 'string') {
      await this.repo.eliminar(resolucionOId);
      return;
    }

    if (resolucionOId.idLocal) {
      await this.repo.eliminar(resolucionOId.idLocal);
      resolucionOId.guardadaLocal = false;
      resolucionOId.idLocal = undefined;
      return;
    }

    const existente = await this.repo.obtenerPorNumeroYOrigen(
      resolucionOId.numeroResolucion,
      resolucionOId.origen
    );
    if (existente?.id) {
      await this.repo.eliminar(existente.id);
      resolucionOId.guardadaLocal = false;
      resolucionOId.idLocal = undefined;
    }
  }

  /** Vincula una jurisprudencia a un expediente asegurando persistencia previa (D3) */
  async vincularAExpediente(resolucionOId: ResolucionJurisprudencia | string, expedienteId: string, notas?: string): Promise<void> {
    let idLocal: string | undefined;
    if (typeof resolucionOId === 'string') {
      idLocal = resolucionOId;
    } else {
      if (!resolucionOId.idLocal || !resolucionOId.guardadaLocal) {
        const guardada = await this.guardarEnBiblioteca(resolucionOId);
        idLocal = guardada.idLocal;
      } else {
        idLocal = resolucionOId.idLocal;
      }
    }
    if (!idLocal) {
      throw new Error('No se pudo determinar el identificador local de la resolución para vincularla al expediente');
    }
    await this.repo.vincularAExpediente(idLocal, expedienteId, notas);
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
    if (items.length === 0) return;
    const mapa = await this.repo.obtenerMapaGuardadas(
      items.map((it) => ({ numero: it.numeroResolucion, origen: it.origen }))
    );
    for (const item of items) {
      const clave = `${item.origen}:${item.numeroResolucion}`;
      const idLocal = mapa.get(clave);
      if (idLocal) {
        item.guardadaLocal = true;
        item.idLocal = idLocal;
      } else {
        item.guardadaLocal = false;
      }
    }
  }
}
