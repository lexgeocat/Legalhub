export interface Diccionario {
  id: string;
  nombre: string;
  autor?: string;
  descripcion?: string;
  rutaPdf: string;
  sha256: string;
  numPaginas: number;
  numTerminos: number;
  creadaEn: string;
}

export interface TerminoDiccionario {
  id: string;
  diccionarioId: string;
  termino: string;
  definicion: string;
  pagina: number;
  orden: number;
}

export type TerminoBorrador = Pick<TerminoDiccionario, 'termino' | 'definicion' | 'pagina'>;

export interface DatosDiccionario {
  nombre: string;
  autor?: string;
  descripcion?: string;
}

export interface ResultadoBusquedaDiccionario {
  id: string;
  diccionarioId: string;
  diccionarioNombre: string;
  diccionarioAutor?: string;
  termino: string;
  definicion: string;
  pagina: number;
  extracto: string;
}

export interface ResultadoImportacionDiccionario {
  diccionarioId: string;
  numPaginas: number;
  numTerminos: number;
  sinTexto: boolean;
}

/**
 * Analiza las líneas extraídas página por página de un PDF de diccionario jurídico
 * y reconoce términos de entrada (lemmata) y sus definiciones o explicaciones.
 */
export function analizarDiccionario(paginas: string[][]): TerminoBorrador[] {
  const terminos: TerminoBorrador[] = [];

  let terminoActual: string | null = null;
  let lineasDefinicion: string[] = [];
  let paginaTermino = 1;

  const guardarActual = () => {
    if (terminoActual) {
      const def = lineasDefinicion.join(' ').replace(/\s+/g, ' ').trim();
      terminos.push({
        termino: terminoActual,
        definicion: def || terminoActual,
        pagina: paginaTermino,
      });
      terminoActual = null;
      lineasDefinicion = [];
    }
  };

  for (let numPag = 0; numPag < paginas.length; numPag++) {
    const pagina = numPag + 1;
    const lineas = paginas[numPag];
    if (!lineas || lineas.length === 0) continue;

    for (const linea of lineas) {
      const trimmed = linea.trim();
      if (!trimmed || /^\d+$/.test(trimmed)) continue;

      // Omitir encabezados y metadatos editoriales de portada
      if (
        /^(VOCABULARIO JUR[IÍ]DICO|DICCIONARIO JUR[IÍ]DICO|GLOSARIO DE T[EÉ]RMINOS|DICCIONARIO DE CIENCIAS)\b/i.test(trimmed) ||
        /^(editorial|edici[oó]n|i\.?s\.?b\.?n|derechos reservados|prohibida su copia|datascan|todos los derechos|impreso en|publicaci[oó]n de la|comunidad de derechos|autores:|diagramaci[oó]n:|dep[oó]sito legal)\b/i.test(trimmed)
      ) {
        continue;
      }

      // PATRÓN 1: Cabanellas con asterisco "*TÉRMINO. Definición" o "*TÉRMINO"
      // Ej: "*AMOJONAMIENTO. El acto de señalar...", "* A BENEFICIO DE INVENTARIO."
      const mAstDef = /^\*+\s*([A-ZÁÉÍÓÚÑ"'][A-Za-zÁÉÍÓÚÑ0-9\s"'\-/,.ºª()]{1,80}?)[.:]\s+(.+)$/.exec(trimmed);
      const mAstSolo = /^\*+\s*([A-ZÁÉÍÓÚÑ"'][A-Za-zÁÉÍÓÚÑ0-9\s"'\-/,.ºª()]{1,80})[.:]?\s*$/.exec(trimmed);

      // PATRÓN 2: Glosario Ley 348 "Término (Art. ...)"
      const mArt = /^([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ\s,/]{2,70})\s*(\(Art\.[^\)]+\))\s*:?\s*(.*)$/.exec(trimmed);

      // PATRÓN 3: "Término: Definición..." o "Término:" en línea sola
      const mColonDef = /^([A-ZÁÉÍÓÚÑ"'][A-Za-zÁÉÍÓÚÑáéíóúñ\s"'\-/]{2,50}):\s+([A-Za-zÁÉÍÓÚÑáéíóúñ].+)$/.exec(trimmed);
      const mColonSolo = /^([A-ZÁÉÍÓÚÑ"'][A-Za-zÁÉÍÓÚÑáéíóúñ\s"'\-/,.]{2,60}):\s*$/.exec(trimmed);

      // PATRÓN 4: Manuel Ossorio / Entradas en línea sola (ej. "A beneficio de inventario", "Abogado", "Acción reivindicatoria")
      const esTituloOssorio =
        pagina > 1 &&
        trimmed.length >= 3 &&
        trimmed.length <= 65 &&
        /^[A-ZÁÉÍÓÚÑ“"][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s"'-/“”,]{2,63}$/.test(trimmed) &&
        !/[.;,:\-–—]$/.test(trimmed) &&
        !/^(si|cuando|para|por|como|aunque|pero|seg[uú]n|además|as[ií]|tambi[eé]n|donde|entre|hacia|hasta|desde|quien|quienes|cual|cuales)\b/i.test(trimmed) &&
        !/\b(el|la|los|las|un|una|unos|unas|de|del|en|por|para|con|sin|que|y|o)\s*$/i.test(trimmed) &&
        trimmed.split(/\s+/).length <= 7;


      if (mAstDef) {
        guardarActual();
        terminoActual = mAstDef[1].replace(/[*"']/g, '').replace(/\s+/g, ' ').trim();
        paginaTermino = pagina;
        lineasDefinicion.push(mAstDef[2]);
      } else if (mAstSolo) {
        guardarActual();
        terminoActual = mAstSolo[1].replace(/[*"']/g, '').replace(/\s+/g, ' ').trim();
        paginaTermino = pagina;
      } else if (mArt) {
        guardarActual();
        terminoActual = `${mArt[1].trim()} ${mArt[2].trim()}`;
        paginaTermino = pagina;
        if (mArt[3]) lineasDefinicion.push(mArt[3]);
      } else if (mColonDef) {
        guardarActual();
        terminoActual = mColonDef[1].replace(/["']/g, '').trim();
        paginaTermino = pagina;
        lineasDefinicion.push(mColonDef[2]);
      } else if (mColonSolo) {
        guardarActual();
        terminoActual = mColonSolo[1].replace(/["']/g, '').trim();
        paginaTermino = pagina;
      } else if (esTituloOssorio) {
        guardarActual();
        terminoActual = trimmed.replace(/[“"”]/g, '').trim();
        paginaTermino = pagina;
      } else {
        lineasDefinicion.push(trimmed);
      }
    }
  }

  guardarActual();

  // Si tras procesar todas las páginas no se extrajo ningún término por patrones,
  // indexamos página por página para garantizar que todo el texto sea consultable
  if (terminos.length === 0) {
    for (let numPag = 0; numPag < paginas.length; numPag++) {
      const pagina = numPag + 1;
      const lineas = paginas[numPag] || [];
      const textoLimpio = lineas.filter((l) => l.trim().length > 2 && !/^\d+$/.test(l.trim()));
      if (textoLimpio.length > 0) {
        terminos.push({
          termino: `Página ${pagina}`,
          definicion: textoLimpio.join(' ').trim(),
          pagina,
        });
      }
    }
  }

  return terminos;
}


/**
 * Formatea una cita jurídica doctrinal lista para insertar en memoriales, contratos o documentos.
 */
export function formatearCitaDiccionario(
  termino: string,
  definicion: string,
  diccionarioNombre: string,
  autor?: string,
  pagina?: number
): string {
  const autorTxt = autor ? `${autor}, ` : '';
  const pagTxt = pagina ? `, pág. ${pagina}` : '';
  const defRecortada = definicion.length > 300 ? `${definicion.slice(0, 297)}...` : definicion;
  return `«${termino}: ${defRecortada}» (Cfr. ${autorTxt}${diccionarioNombre}${pagTxt}).`;
}

/**
 * Resalta las palabras buscadas con <mark> en el texto de una definición
 */
export function sanearTextoDefinicion(texto: string, consulta?: string): string {
  if (!texto) return '';
  let res = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (consulta && consulta.trim().length >= 2) {
    const palabras = consulta
      .trim()
      .split(/\s+/)
      .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter((p) => p.length >= 2);

    if (palabras.length > 0) {
      const re = new RegExp(`(${palabras.join('|')})`, 'gi');
      res = res.replace(re, '<mark>$1</mark>');
    }
  }

  return res;
}
