import type {
  FiltroBusquedaJurisprudencia,
  OrigenJurisprudencia,
  ResolucionJurisprudencia,
  ResultadoPaginadoJurisprudencia,
  SalaTsjCatalogo,
  TipoResolucionTsjCatalogo,
} from '../../domain/jurisprudencia/jurisprudencia';

export interface IClienteTsj {
  buscar(filtro: FiltroBusquedaJurisprudencia): Promise<ResultadoPaginadoJurisprudencia>;
  obtenerDetalle(id: string): Promise<ResolucionJurisprudencia>;
  descargarPdf(id: string, urlPdf?: string): Promise<{ buffer: Uint8Array; nombreArchivo: string }>;
  obtenerSalas(): Promise<SalaTsjCatalogo[]>;
  obtenerTiposResolucion(idSala?: number): Promise<TipoResolucionTsjCatalogo[]>;
}

export interface IClienteTcp {
  buscar(filtro: FiltroBusquedaJurisprudencia): Promise<ResultadoPaginadoJurisprudencia>;
  obtenerDocumentoHtml(resolucionId: string | number): Promise<string>;
  descargarPdf(resolucionId: string | number): Promise<{ buffer: Uint8Array; nombreArchivo: string }>;
}

export interface IRepositorioJurisprudencia {
  guardar(resolucion: ResolucionJurisprudencia, pdfBuffer?: Uint8Array): Promise<string>;
  eliminar(id: string): Promise<void>;
  buscarLocal(filtro: FiltroBusquedaJurisprudencia): Promise<ResultadoPaginadoJurisprudencia>;
  obtenerPorId(id: string): Promise<ResolucionJurisprudencia | null>;
  obtenerPorNumeroYOrigen(numeroResolucion: string, origen: OrigenJurisprudencia): Promise<ResolucionJurisprudencia | null>;
  vincularAExpediente(jurisprudenciaId: string, expedienteId: string, notas?: string): Promise<void>;
  desvincularDeExpediente(jurisprudenciaId: string, expedienteId: string): Promise<void>;
  listarPorExpediente(expedienteId: string): Promise<ResolucionJurisprudencia[]>;
  esGuardada(numeroResolucion: string, origen: OrigenJurisprudencia): Promise<boolean>;
  obtenerMapaGuardadas(items: { numero: string; origen: OrigenJurisprudencia }[]): Promise<Map<string, string>>;
}
