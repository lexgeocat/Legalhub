export type OrigenJurisprudencia = 'TSJ' | 'TCP';

export interface FichaAnalisisJurisprudencial {
  id?: string;
  maxima?: string;
  sintesis?: string;
  ratioDecidendi?: string;
  descriptor?: string;
  restrictor?: string;
  precedente?: string;
  tipoJurisprudencia?: string; // Reiteradora, Fundadora, Modificadora, Mutadora, etc.
  formaResolucion?: string;    // Legal, Procedente, Infundado, etc.
}

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
  proceso?: string;
  formaResolucion?: string;
  tipoJurisprudencia?: string;
  maxima?: string;
  sintesis?: string;
  ratioDecidendi?: string;
  descriptor?: string;
  restrictor?: string;
  precedente?: string;
  fichas?: FichaAnalisisJurisprudencial[];
  resumen?: string;
  contenidoHtml?: string;
  rutaPdf?: string;
  urlPdf?: string;
  tieneHtml?: boolean;
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

/**
 * Limpia marcas HTML de extractos y convierte tanto estilos de fondo como etiquetas
 * <b>/<strong> (utilizadas por el servidor del TSJ Génesis) en etiquetas semánticas <mark>
 * para que se resalten visualmente con color y no queden únicamente como negrilla simple (S2).
 * Además, si se proporciona un término de búsqueda, resalta coincidencias adicionales.
 */
export function sanearTextoExtracto(html: string, terminosBusqueda?: string): string {
  if (!html) return '';
  let texto = html
    .replace(/<span style=['"][^'"]*background(?:-color)?:\s*#?[a-f0-9]+[^'"]*['"]>/gi, '<mark>')
    .replace(/<\/span>/gi, '</mark>')
    .replace(/<b\b[^>]*>/gi, '<mark>')
    .replace(/<\/b>/gi, '</mark>')
    .replace(/<strong\b[^>]*>/gi, '<mark>')
    .replace(/<\/strong>/gi, '</mark>')
    .replace(/<mark>\s*<mark>/gi, '<mark>')
    .replace(/<\/mark>\s*<\/mark>/gi, '</mark>');

  if (terminosBusqueda && terminosBusqueda.trim()) {
    const palabras = terminosBusqueda
      .trim()
      .split(/\s+/)
      .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter((p) => p.length >= 2);

    if (palabras.length > 0 && !texto.includes('<mark>')) {
      try {
        const regex = new RegExp(`\\b(${palabras.join('|')})`, 'gi');
        texto = texto.replace(regex, '<mark>$1</mark>');
      } catch {
        // En caso de regex inválido, retornar texto normal
      }
    }
  }

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

/** Formatea la Ficha de Análisis Jurisprudencial como texto estructurado para copiar o pegar en escritos */
export function formatearFichaJurisprudencial(
  r: ResolucionJurisprudencia,
  ficha?: FichaAnalisisJurisprudencial
): string {
  const f = ficha ?? r.fichas?.[0] ?? {
    maxima: r.maxima,
    sintesis: r.sintesis,
    ratioDecidendi: r.ratioDecidendi,
    descriptor: r.descriptor,
    restrictor: r.restrictor,
    precedente: r.precedente,
    tipoJurisprudencia: r.tipoJurisprudencia,
    formaResolucion: r.formaResolucion,
  };

  const lineas: string[] = [
    `FICHA DE ANÁLISIS JURISPRUDENCIAL — ${r.origen === 'TCP' ? 'TRIBUNAL CONSTITUCIONAL PLURINACIONAL' : 'TRIBUNAL SUPREMO DE JUSTICIA'}`,
    '════════════════════════════════════════════════════════════════════════════',
    `Sala:                   ${r.sala || '—'}`,
    `Proceso:                ${r.proceso || r.numeroExpediente || '—'}`,
    `N° de Resolución:       ${r.tipoResolucion} ${r.numeroResolucion}`,
    `Fecha de Emisión:       ${r.fechaEmision || '—'}`,
    `Magistrado Relator:     ${r.magistrado || '—'}`,
    `Forma de Resolución:    ${f.formaResolucion || r.formaResolucion || '—'}`,
    `Tipo de Jurisprudencia: ${f.tipoJurisprudencia || r.tipoJurisprudencia || '—'}`,
    '',
    `DESCRIPTOR:`,
    `${f.descriptor || '—'}`,
    '',
    `RESTRICTOR:`,
    `${f.restrictor || '—'}`,
    '',
    `MÁXIMA:`,
    `${f.maxima || '—'}`,
    '',
    `SÍNTESIS DEL CASO:`,
    `${f.sintesis || r.resumen || '—'}`,
    '',
    `EXTRACTO DE LA RATIO DECIDENDI:`,
    `${f.ratioDecidendi || '—'}`,
    '',
    `PRECEDENTE / NORMA APLICADA:`,
    `${f.precedente || '—'}`,
    '════════════════════════════════════════════════════════════════════════════',
    `Cita: ${formatearCitaJurisprudencial(r)}`,
  ];

  return lineas.join('\n');
}

/**
 * Parsea una fecha en formatos comunes bolivianos (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, etc.)
 * retornando el timestamp Unix en milisegundos, o 0 si no es válida.
 */
export function parsearFechaEmision(fecha?: string): number {
  if (!fecha) return 0;
  const f = String(fecha).trim();
  // Formato DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = f.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const dia = Number(dmyMatch[1]);
    const mes = Number(dmyMatch[2]);
    const anio = Number(dmyMatch[3]);
    return new Date(anio, mes - 1, dia).getTime();
  }
  // Formato YYYY-MM-DD o YYYY/MM/DD
  const ymdMatch = f.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const anio = Number(ymdMatch[1]);
    const mes = Number(ymdMatch[2]);
    const dia = Number(ymdMatch[3]);
    return new Date(anio, mes - 1, dia).getTime();
  }
  const parsed = Date.parse(f);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extrae el número correlativo de una resolución para desempatar ordenamientos.
 * Ej: 'AS/1471/2024-RI' -> 1471, '3593/2026-S1' -> 3593
 */
export function extraerNumeroResolucion(nro?: string): number {
  if (!nro) return 0;
  const match = String(nro).match(/(\d+)(?:\/\d{4})?/);
  return match ? Number(match[1]) : 0;
}

/**
 * Ordena resoluciones según la fecha de emisión en orden descendente (más reciente primero).
 * En caso de igualdad de fecha, desempata por correlativo / número o ID descendente.
 */
export function ordenarResolucionesPorFechaDesc<
  T extends { fechaEmision?: string; numeroResolucion?: string; idRemoto?: string; id?: string | number }
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const tA = parsearFechaEmision(a.fechaEmision);
    const tB = parsearFechaEmision(b.fechaEmision);
    if (tB !== tA) return tB - tA;
    const nA = extraerNumeroResolucion(a.numeroResolucion) || Number(a.idRemoto || a.id) || 0;
    const nB = extraerNumeroResolucion(b.numeroResolucion) || Number(b.idRemoto || b.id) || 0;
    return nB - nA;
  });
}

/**
 * Deduce metadatos constitucionales (proceso, departamento, forma de resolución)
 * a partir de la nomenclatura de expediente boliviano y texto de referencia del TCP.
 */
export function deducirMetadatosTcp(
  numeroExpediente?: string,
  referencia?: string
): {
  proceso?: string;
  departamento?: string;
  formaResolucion?: string;
} {
  let proceso: string | undefined = undefined;
  if (numeroExpediente) {
    const exp = numeroExpediente.trim().toUpperCase();
    if (exp.endsWith('-AL')) proceso = 'Acción de Libertad';
    else if (exp.endsWith('-AA')) proceso = 'Acción de Amparo Constitucional';
    else if (exp.endsWith('-AP')) proceso = 'Acción Popular';
    else if (exp.endsWith('-AC')) proceso = 'Acción de Cumplimiento';
    else if (exp.endsWith('-PD')) proceso = 'Protección de Privacidad';
    else if (exp.endsWith('-RD')) proceso = 'Recurso Directo de Nulidad';
    else if (exp.endsWith('-CA')) proceso = 'Consulta de Constitucionalidad';
    else if (exp.endsWith('-CC')) proceso = 'Conflicto de Competencias';
  }

  if (!proceso && referencia) {
    const ref = referencia.toLowerCase();
    if (ref.includes('amparo')) proceso = 'Acción de Amparo Constitucional';
    else if (ref.includes('libertad')) proceso = 'Acción de Libertad';
    else if (ref.includes('popular')) proceso = 'Acción Popular';
    else if (ref.includes('cumplimiento')) proceso = 'Acción de Cumplimiento';
    else if (ref.includes('difamación') || ref.includes('difamacion')) proceso = 'Difamación';
  }

  let departamento: string | undefined = undefined;
  if (referencia) {
    const matchDpto = referencia.match(/\b(La Paz|Cochabamba|Santa Cruz|Chuquisaca|Oruro|Potosí|Potosi|Tarija|Beni|Pando)\b/i);
    if (matchDpto) departamento = matchDpto[1];
  }

  let formaResolucion: string | undefined = undefined;
  if (referencia) {
    if (/\bCONCEDE\b/i.test(referencia)) formaResolucion = 'Concede';
    else if (/\bDENEGA\b/i.test(referencia)) formaResolucion = 'Deniega';
    else if (/\bREVOCA\b/i.test(referencia)) formaResolucion = 'Revoca';
    else if (/\bCONFIRMA\b/i.test(referencia)) formaResolucion = 'Confirma';
    else if (/\bINFUNDAD[OA]\b/i.test(referencia)) formaResolucion = 'Infundado';
    else if (/\bIMPROCEDENTE\b/i.test(referencia)) formaResolucion = 'Improcedente';
  }

  return { proceso, departamento, formaResolucion };
}

/**
 * Extrae metadatos institucionales del TCP directamente del contenido HTML oficial
 * (Magistrado Relator, Sala Especializada, Acción/Proceso, Departamento, Forma de Resolución).
 */
export function extraerMetadatosHtmlTcp(html?: string): Partial<ResolucionJurisprudencia> {
  if (!html) return {};
  const meta: Partial<ResolucionJurisprudencia> = {};

  // Magistrado Relator
  const magMatch = html.match(/Magistrado\s*Relator\s*:\s*([^<\r\n]+)/i);
  if (magMatch) {
    meta.magistrado = magMatch[1].replace(/&nbsp;|\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Sala
  const salaMatch = html.match(/SALA\s+([^\n<]+(?:ESPECIALIZADA|PLENA))/i);
  if (salaMatch) {
    meta.sala = `Sala ${salaMatch[1].replace(/&nbsp;|\u00a0/g, ' ').replace(/\s+/g, ' ').trim()}`;
  }

  // Acción / Proceso
  const accionMatch = html.match(/<p[^>]*><b>\s*(Acci[oó]n\s+de\s+[^<\r\n]+|Recurso\s+[^<\r\n]+)<\/b><\/p>/i);
  if (accionMatch) {
    meta.proceso = accionMatch[1].replace(/&nbsp;|\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Departamento
  const dptoMatch = html.match(/(?:departamento\s+de\s+|distrito\s+judicial\s+de\s+)([A-Za-zÁÉÍÓÚáéíóúñ]+)/i) ||
                    html.match(/\b(La Paz|Cochabamba|Santa Cruz|Chuquisaca|Oruro|Potosí|Potosi|Tarija|Beni|Pando)\b/i);
  if (dptoMatch) {
    meta.departamento = dptoMatch[1].trim();
  }

  // Forma de Resolución (a partir del POR TANTO)
  const porTantoIdx = html.lastIndexOf('POR TANTO');
  if (porTantoIdx !== -1) {
    const resolutivo = html.substring(porTantoIdx);
    if (/\bCONCEDE\b/i.test(resolutivo)) meta.formaResolucion = 'Concede';
    else if (/\bDENEGA\b/i.test(resolutivo)) meta.formaResolucion = 'Deniega';
    else if (/\bREVOCA\b/i.test(resolutivo)) meta.formaResolucion = 'Revoca';
    else if (/\bCONFIRMA\b/i.test(resolutivo)) meta.formaResolucion = 'Confirma';
    else if (/\bIMPROCEDENTE\b/i.test(resolutivo)) meta.formaResolucion = 'Improcedente';
    else if (/\bINADMISIBLE\b/i.test(resolutivo)) meta.formaResolucion = 'Inadmisible';
  }

  return meta;
}

/**
 * Determina si el campo de resumen o extracto debe mostrarse en la tarjeta de resultado.
 * Si el resumen sólo repite el proceso (ej: "Proceso: Violación" devuelto por TSJ Génesis)
 * se descarta para evitar duplicidad visual; si contiene descripción o términos de búsqueda, se mantiene.
 */
export function debeMostrarResumen(resumen?: string, proceso?: string): boolean {
  if (!resumen) return false;
  const textoPlano = resumen.replace(/<[^>]*>/g, '').trim();
  if (!textoPlano) return false;

  const procNorm = (proceso || '').replace(/^Proceso:\s*/i, '').trim().toLowerCase();
  const resNorm = textoPlano.replace(/^Proceso:\s*/i, '').trim().toLowerCase();

  if (resNorm === procNorm || textoPlano.toLowerCase() === `proceso: ${procNorm}`) {
    return false;
  }

  if (/^proceso\s*:?$/i.test(textoPlano)) {
    return false;
  }

  return true;
}
