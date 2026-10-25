export type OrigenJurisprudencia = 'TSJ' | 'TCP';

export interface ResolucionJurisprudencia {
  id: string; // Identificador principal
  idRemoto?: string; // ID remoto en API TSJ/TCP (ej: "97159", "221924")
  idLocal?: string; // ID local en SQLite jurisprudencia_guardada (ULID)
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

/** Genera un nombre de archivo PDF determinista y seguro sin path traversal */
export function generarNombreArchivoPdf(origen: OrigenJurisprudencia, numeroResolucion: string): string {
  const numLimpio = numeroResolucion.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${origen}_${numLimpio}.pdf`;
}

/** Mezcla los datos del listado con el detalle completo sin sobreescribir con undefined (D8) */
export function mezclarDetalle(
  base: ResolucionJurisprudencia,
  detalle: Partial<ResolucionJurisprudencia>
): ResolucionJurisprudencia {
  const resultado: ResolucionJurisprudencia = { ...base };
  for (const [k, v] of Object.entries(detalle) as [keyof ResolucionJurisprudencia, unknown][]) {
    if (v !== undefined && v !== null && v !== '') {
      (resultado as unknown as Record<string, unknown>)[k] = v;
    }
  }
  if (base.idLocal) resultado.idLocal = base.idLocal;
  if (base.idRemoto && !resultado.idRemoto) resultado.idRemoto = base.idRemoto;
  if (base.guardadaLocal !== undefined) resultado.guardadaLocal = base.guardadaLocal;
  return resultado;
}

/** Valida que un arreglo de bytes comience con la cabecera mágica de PDF (%PDF) (D14) */
export function esPdfValido(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 4) return false;
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/** Parsea fechas ISO (YYYY-MM-DD) sin desfase horario por UTC en Bolivia (Q15) */
export function formatearFechaIsoBolivia(fechaStr: string): string {
  if (!fechaStr) return '';
  const match = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, anio, mes, dia] = match;
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const mIdx = parseInt(mes, 10) - 1;
    return `${parseInt(dia, 10)} de ${meses[mIdx] ?? mes} de ${anio}`;
  }
  return fechaStr;
}

/**
 * Sanitiza contenido HTML remoto permitiendo únicamente etiquetas semánticas seguras
 * y eliminando enlaces, scripts, iframes, estilos en línea y controladores de eventos (S1).
 */
export function sanearContenidoHtml(html: string): string {
  if (!html) return '';
  // 1. Eliminar etiquetas script, style, iframe, object, embed, form
  let limpio = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

  // 2. Convertir enlaces en texto simple para evitar navegación de la ventana de la app (S1)
  limpio = limpio.replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1');

  // 3. Permitir solo etiquetas semánticas seguras
  const etiquetasPermitidas = /^(p|br|b|strong|i|em|u|mark|h1|h2|h3|h4|h5|h6|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|div|span|hr)$/i;

  limpio = limpio.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (_coincidencia, tag) => {
    if (!etiquetasPermitidas.test(tag)) {
      return '';
    }
    const tagMinuscula = tag.toLowerCase();
    if (_coincidencia.startsWith('</')) return `</${tagMinuscula}>`;
    if (tagMinuscula === 'br' || tagMinuscula === 'hr') return `<${tagMinuscula} />`;
    return `<${tagMinuscula}>`;
  });

  return limpio.replace(/\r\n/g, ' ').trim();
}

/** Limpia marcas HTML agresivas de extractos convirtiendo resaltados a <mark> (S2) */
export function sanearTextoExtracto(html: string): string {
  if (!html) return '';
  const texto = html
    .replace(/<span style=['"][^'"]*background(?:-color)?:\s*#?[a-f0-9]+[^'"]*['"]>/gi, '<mark>')
    .replace(/<\/span>/gi, '</mark>');
  return sanearContenidoHtml(texto);
}

/** Formatea una cita formal de jurisprudencia boliviana para insertar en memoriales o demandas */
export function formatearCitaJurisprudencial(r: ResolucionJurisprudencia): string {
  const partes: string[] = [];
  const tipo = (r.tipoResolucion || (r.origen === 'TSJ' ? 'Auto Supremo' : 'Sentencia Constitucional Plurinacional')).trim();
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
