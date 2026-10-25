export type OrigenJurisprudencia = 'TSJ' | 'TCP';

export interface ResolucionJurisprudencia {
  id: string;
  origen: OrigenJurisprudencia;
  tipoResolucion: string;
  subtipoResolucion?: string;
  numeroResolucion: string;
  numeroExpediente?: string;
  fechaEmision: string;
  sala?: string;
  departamento?: string;
  magistrado?: string;
  demandante?: string;
  demandado?: string;
  materia?: string;
  resumen?: string;
  contenidoHtml?: string;
  rutaPdf?: string;
  guardadaLocal?: boolean;
}

export type ModalidadBusquedaTsj = 'simple' | 'campos' | 'gestion' | 'avanzada';
export type SubcampoBusquedaTsj = 'resolucion' | 'expediente' | 'partes';

export interface SalaTsjCatalogo {
  id: number;
  nombre: string;
}

export interface TipoResolucionTsjCatalogo {
  id: number;
  nombre: string;
}

export interface FiltroBusquedaJurisprudencia {
  texto: string;
  origen: 'TODOS' | 'TSJ' | 'TCP';
  materia?: string;
  sala?: string;
  tipoResolucion?: string;
  gestion?: string;
  pagina?: number;
  limite?: number;

  // Modalidades y campos avanzados de TSJ Génesis
  modalidadTsj?: ModalidadBusquedaTsj;
  subcampoTsj?: SubcampoBusquedaTsj;
  nroResolucion?: string;
  nroExpediente?: string;
  partes?: string;
  idSalaTsj?: number | null;
  idTipoResTsj?: number | null;
  palabrasTodas?: string;
  fraseExacta?: string;
  palabrasCualquiera?: string;
  palabrasExcluir?: string;
}

export interface ResultadoPaginadoJurisprudencia {
  items: ResolucionJurisprudencia[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

export interface VinculoExpedienteJurisprudencia {
  id: string;
  jurisprudenciaId: string;
  expedienteId: string;
  notas?: string;
  creadaEn: string;
}

/** Formatea una cita formal de jurisprudencia boliviana para insertar en memoriales o demandas */
export function formatearCitaJurisprudencial(r: ResolucionJurisprudencia): string {
  const partes: string[] = [];
  const tipo = r.tipoResolucion.trim();
  const num = r.numeroResolucion.trim();
  const fecha = r.fechaEmision ? ` de ${r.fechaEmision}` : '';

  if (r.origen === 'TCP') {
    partes.push(`Cfr. ${tipo} ${num}${fecha}`);
    if (r.sala) partes.push(r.sala);
    partes.push('Tribunal Constitucional Plurinacional de Bolivia');
  } else {
    partes.push(`Cfr. ${tipo} N° ${num}${fecha}`);
    if (r.sala) partes.push(r.sala);
    partes.push('Tribunal Supremo de Justicia');
  }

  if (r.magistrado) {
    partes.push(`Magistrado Relator: ${r.magistrado}`);
  }

  return partes.join(', ') + '.';
}

/** Limpia marcas HTML agresivas de extractos dejando formato legible */
export function sanearTextoExtracto(html: string): string {
  if (!html) return '';
  return html
    .replace(/<span style=['"][^'"]*['"]>/gi, '<mark>')
    .replace(/<\/span>/gi, '</mark>')
    .replace(/\r\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
