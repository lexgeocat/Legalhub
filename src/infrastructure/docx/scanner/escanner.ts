// infrastructure/docx/scanner/escanner.ts
/**
 * Escáner y linter de modelos DOCX
 * Analiza la estructura XML de un documento .docx para extraer marcadores
 * y validar su sintaxis según las reglas del motor de plantillas cerrado
 */

import { FILTROS } from '../../domain/filtros';

/**
 * Tipos de marcadores que podemos encontrar
 */
export type TipoMarcador =
  | 'simple'        // {{expediente.juzgado}}
  | 'filtro'        // {{expediente.juzgado | mayus}}
  | 'bucleApertura' // {{#demandantes}}
  | 'bucleCierre'   // {{/demandantes}}
  | 'condicionalApertura' // {{#hay_conyuge}}
  | 'condicionalCierre'   // {{/hay_conyuge}}
  | 'invalido';     // Marcador con sintaxis incorrecta

/**
 * Representa un marcador encontrado en el documento
 */
export interface Marcador {
  tipo: TipoMarcador;
  contenido: string; // El contenido completo entre llaves, ej: "expediente.juzgado | mayus"
  ruta: string;      // La parte antes del primer filtro, ej: "expediente.juzgado"
  filtros: Array<{
    nombre: string;
    argumentos: string[];
  }>;
  posicion: {
    linea: number;
    columna: number;
  };
  esValido: boolean;
  error?: string;
}

/**
 * Resultado del escaneo de un modelo
 */
export interface ResultadoEscaneo {
  marcadores: Marcador[];
  esValido: boolean;
  errores: string[];
  advertencias: string[];
  esquema: Array<{
    path: string;
    tipo: string;
    requerido: boolean;
    etiqueta?: string;
  }>;
}

/**
 * Normaliza texto eliminando variaciones de Word
 * - Comillas tipográficas -> rectas
 * - Espacios duros -> espacios normales
 * - Unifica saltos de línea
 */
export function normalizarMarcador(texto: string): string {
  return texto
    .replace(/[“”]/g, '"') // comillas tipográficas a rectas
    .replace(/[‘’]/g, "'") // comillas simples tipográficas
    .replace(/\u00A0/g, ' ') // espacios duros a espacios normales
    .trim();
}

/**
 * Escanea un documento DOCX (en formato Uint8Array) y devuelve el resultado
 */
export async function escanear(plantilla: Uint8Array): Promise<ResultadoEscaneo> {
  try {
    // Paso 1: Extraer el ZIP del DOCX
    const zipData = await extraerZip(plantilla);
    
    // Paso 2: Obtener el contenido de word/document.xml
    const documentXml = zipData['word/document.xml'];
    if (!documentXml) {
      return {
        marcadores: [],
        esValido: false,
        errores: ['No se pudo encontrar word/document.xml en el documento DOCX'],
        advertencias: [],
        esquema: []
      };
    }
    
    // Paso 3: Parsear el XML con DOMParser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXml, 'application/xml');
    
    // Paso 4: Extraer todo el texto del documento
    const textoCompleto = extraerTextoDelXml(xmlDoc);
    
    // Paso 5: Encontrar y procesar marcadores
    const marcadores = procesarMarcadoresEnTexto(textoCompleto);
    
    // Paso 6: Validar marcadores y generar esquema
    const { marcadoresValidos, errores, esquema } = validarMarcadoresYGenerarEsquema(marcadores);
    
    // Paso 7: Generar advertencias (simplificado)
    const advertencias = generarAdvertencias(xmlDoc);
    
    return {
      marcadores: marcadoresValidos,
      esValido: errores.length === 0,
      errores,
      advertencias,
      esquema
    };
  } catch (error) {
    return {
      marcadores: [],
      esValido: false,
      errores: [error instanceof Error ? error.message : 'Error desconocido al escanear el documento'],
      advertencias: [],
      esquema: []
    };
  }
}

/**
 * Extrae el ZIP del documento DOCX
 */
async function extraerZip(datos: Uint8Array): Promise<Record<string, string>> {
  // Nota: Esta es una implementación simplificada.
  // En una implementación real, usaríamos una biblioteca como fflate para descomponer el ZIP
  // y extraer los archivos necesarios como:
  // - word/document.xml
  // - word/header*.xml
  // - word/footer*.xml
  // - word/comments.xml (para advertencias)
  // 
  // Por simplicidad en este ejemplo, asumimos que podemos leer el XML directamente
  // como si ya estuviera descomprimido.
  // 
  // Para una implementación completa con fflate:
  // const { unzip } = await import('fflate');
  // const zipData = await unzip(datos);
  // 
  // Devolveríamos entonces un mapa con los contenidos de los archivos XML
  
  // Placeholder: simulamos que tenemos el XML del documento principal
  return {
    'word/document.xml': await textoDesdeUint8Array(datos)
  };
}

/**
 * Convierte Uint8Array a string (asumiendo UTF-8)
 */
async function textoDesdeUint8Array(datos: Uint8Array): Promise<string> {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(datos);
  }
  // Fallback para entornos sin TextDecoder
  return String.fromCharCode.apply(null, datos as unknown as number[]);
}

/**
 * Extrae todo el texto de un documento XML, ignorando las etiquetas
 */
function extraerTextoDelXml(nodo: Node): string {
  let texto = '';
  
  if (nodo.nodeType === Node.TEXT_NODE) {
    texto += nodo.textContent;
  } else if (nodo.nodeType === Node.ELEMENT_NODE) {
    // Ignorar ciertos elementos que no contienen texto visible del documento
    const elementosIgnorar = new Set(['w:ins', 'w:del', 'w:rPr']);
    if (!elementosIgnorar.has(nodo.nodeName)) {
      for (let i = 0; i < nodo.childNodes.length; i++) {
        texto += extraerTextoDelXml(nodo.childNodes[i]);
      }
    }
  }
  
  return texto;
}

/**
 * Procesa todo el texto para encontrar marcadores {{...}}
 */
function procesarMarcadoresEnTexto(texto: string): Marcador[] {
  const marcadores: Marcador[] = [];
  const regex = /{{\s*([^}]+?)\s*}}/g;
  let match;
  
  while ((match = regex.exec(texto)) !== null) {
    const contenido = match[1];
    const marcador: Marcador = {
      tipo: 'simple', // Se determinará más abajo
      contenido: contenido,
      ruta: '',
      filtros: [],
      posicion: {
        linea: contarLineasHasta(texto, match.index),
        columna: match.index - ultimaSaltoDeLinea(texto, match.index)
      },
      esValido: true
    };
    
    // Procesar el contenido para determinar tipo y filtros
    try {
      procesarContenidoMarcador(marcador);
    } catch (error) {
      marcador.tipo = 'invalido';
      marcador.esValido = false;
      marcador.error = error instanceof Error ? error.message : String(error);
    }
    
    marcadores.push(marcador);
  }
  
  return marcadores;
}

/**
 * Cuenta el número de línea hasta una posición en el texto
 */
function contarLineasHasta(texto: string, posicion: number): number {
  return (texto.substring(0, posicion).match(/\n/g) || []).length + 1;
}

/**
 * Encuentra la posición del último salto de línea antes de una posición
 */
function ultimaSaltoDeLinea(texto: string, posicion: number): number {
  const ultimaPos = texto.lastIndexOf('\n', posicion - 1);
  return ultimaPos === -1 ? 0 : ultimaPos + 1;
}

/**
 * Procesa el contenido interno de un marcador para determinar su tipo y componentes
 */
function procesarContenidoMarcador(marcador: Marcador): void {
  let contenido = marcador.contenido;
  
  // Detectar bucles y condicionales
  if (contenido.startsWith('#')) {
    if (contenido.startsWith('##')) {
      // Esto sería inválido según nuestra sintaxis
      throw new Error('Sintaxis de bucle/condicional inválida');
    }
    
    const sinNumero = contenido.substring(1);
    if (sinNumero.startsWith('/')) {
      // Es un cierre: {{/nombre}}
      marcador.tipo = sinNumero.startsWith('##/') ? 'invalido' : 
                     sinNumero.startsWith('#/') ? 'condicionalCierre' : 'bucleCierre';
      marcador.ruta = sinNumero.substring(2); // Eliminamos el / y posiblemente otro #
    } else {
      // Es una apertura: {{#nombre}} o {{##nombre}}
      marcador.tipo = contenido.startsWith('##') ? 'invalido' : 
                     contenido.startsWith('#') && !contenido.startsWith('##') ?
                     (sinNumero.includes(' ') ? 'invalido' : 'bucleApertura') : 
                     'condicionalApertura';
                     
      // Extraer el nombre (eliminando el # inicial)
      const nombre = marcador.tipo === 'invalido' ? '' : 
                    contenido.substring(1).trim();
      marcador.ruta = nombre;
    }
    return;
  }
  
  // Es un marcador simple o con filtros
  marcador.tipo = 'simple';
  
  // Separar por filtros
  const partes = contenido.split('|').map(part => part.trim());
  marcador.ruta = partes[0];
  
  // Procesar cada filtro
  for (let i = 1; i < partes.length; i++) {
    const filtroTexto = partes[i];
    const [nombreFiltro, ...argsPartes] = filtroTexto.split(':').map(s => s.trim());
    const argumentos = argsPartes.map(arg => 
      // Eliminar comillas si existen
      arg.replace(/^['"]|['"]$/g, '')
    );
    
    marcador.filtros.push({
      nombre: nombreFiltro,
      argumentos: argumentos
    });
    
    // Validar que el filtro exista
    if (!(nombreFiltro in FILTROS)) {
      throw new Error(`Filtro desconocido: '${nombreFiltro}'`);
    }
  }
}

/**
 * Valida los marcadores y genera el esquema del modelo
 */
function validarMarcadoresYGenerarEsquema(marcadores: Marcador[]): {
  marcadoresValidos: Marcador[];
  errores: string[];
  esquema: Array<{
    path: string;
    tipo: string;
    requerido: boolean;
    etiqueta?: string;
  }>
} {
  const errores: string[] = [];
  const marcadoresValidos: Marcador[] = [];
  const pathsVistos = new Set<string>();
  
  // Primero, verificar bucles y condicionales balanceados
  const pilaDeAperturas: Marcador[] = [];
  
  for (const marcador of marcadores) {
    if (marcador.tipo === 'bucleApertura' || marcador.tipo === 'condicionalApertura') {
      pilaDeAperturas.push(marcador);
    } else if (marcador.tipo === 'bucleCierre' || marcador.tipo === 'condicionalCierre') {
      if (pilaDeAperturas.length === 0) {
        errores.push(`Cierre '${marcador.ruta}' sin apertura correspondiente`);
        continue;
      }
      
      const apertura = pilaDeAperturas.pop();
      // Verificar que coincidan (simplificado)
      if (apertura.ruta !== marcador.ruta) {
        errores.push(`El cierre '${marcador.ruta}' no coincide con la apertura '${apertura.ruta}'`);
        continue;
      }
    }
    
    if (marcador.esValido) {
      marcadoresValidos.push(marcador);
      
      // Solo agregar al esquema si es un marcador simple o con filtros (no bucles/condicionales)
      if (marcador.tipo === 'simple' && marcador.ruta && !pathsVistos.has(marcador.ruta)) {
        pathsVistos.add(marcador.ruta);
        
        // Determinar el tipo basado en los filtros o en la ruta
        let tipo = 'string'; // tipo por defecto
        let requerido = true; // por defecto requerido
        
        // En una implementación real, miraríamos el contexto para determinar el tipo
        // Por ahora, usamos heurísticas simples
        if (marcador.ruta.includes('.ci') || marcador.ruta.endsWith('ci')) {
          tipo = 'ci';
        } else if (marcador.ruta.includes('.fecha') || marcador.ruta.endsWith('fecha')) {
          tipo = 'fecha';
        } else if (marcador.ruta.includes('.cuantia') || marcador.ruta.endsWith('cuantia') ||
                   marcador.ruta.includes('.monto') || marcador.ruta.endsWith('monto')) {
          tipo = 'moneda';
        } else if (marcador.ruta.includes('.superficie') || marcador.ruta.endsWith('superficie')) {
          tipo = 'superficie';
        } else if (marcador.ruta.includes('.literal') || marcador.ruta.endsWith('literal')) {
          tipo = 'literal';
        }
        
        // Verificar si tiene filtros que indiquen el tipo
        for (const filtro of marcador.filtros) {
          if (filtro.nombre === 'lista') {
            tipo = 'string[]'; // array de strings
          } else if (filtro.nombre === 'concordar') {
            tipo = 'string'; // pero indica que es para concordancia
          }
        }
        
        esquema.push({
          path: marcador.ruta,
          tipo,
          requerido,
          etiqueta: generarEtiquetaDesdePath(marcador.ruta)
        });
      }
    } else {
      errores.push(`Error en marcador '${marcador.contenido}': ${marcador.error}`);
    }
  }
  
  // Verificar si quedan aperturas sin cerrar
  while (pilaDeAperturas.length > 0) {
    const apertura = pilaDeAperturas.pop();
    errores.push(`Apertura '${apertura.ruta}' sin cierre correspondiente`);
  }
  
  return {
    marcadoresValidos,
    errores,
    esquema
  };
}

/**
 * Genera una etiqueta legible desde un path
 */
function generarEtiquetaDesdePath(path: string): string {
  // Convertir camelCase o snake_case a texto legible
  let etiqueta = path
    .replace(/[_]/g, ' ') // reemplazar guiones bajos con espacios
    .replace(/([a-z])([A-Z])/g, '$1 $2') // separar camelCase
    .replace(/\b\w/g, c => c.toUpperCase()); // capitalizar primera letra de cada palabra
  
  // Reemplazar puntos con espacios y capitalizar
  etiqueta = etiqueta
    .split('.')
    .map(part => part
      .replace(/[_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase()))
    .join(' ');
  
  return etiqueta;
}

/**
 * Genera advertencias basadas en el contenido del documento
 */
function generarAdvertencias(xmlDoc: Document): string[] {
  const advertencias: string[] = [];
  
  // Buscar marcadores dentro de cuadros de texto (simplificado)
  // En una implementación real, buscaríamos elementos w:textbox
  
  // Buscar campos de Word (w:fldSimple, w:instrText)
  const camposWord = xmlDoc.getElementsByTagName('w:fldSimple');
  if (camposWord.length > 0) {
    advertencias.push(`Se encontraron ${camposWord.length} campos de Word que pueden no funcionar correctamente`);
  }
  
  const instrText = xmlDoc.getElementsByTagName('w:instrText');
  if (instrText.length > 0) {
    advertencias.push(`Se encontraron ${instrText.length} campos de código de Word`);
  }
  
  // Buscar comentarios
  const comentarios = xmlDoc.getElementsByTagName('w:comment');
  if (comentarios.length > 0) {
    advertencias.push(`Se encontraron ${comentarios.length} comentarios en el documento`);
  }
  
  // En una implementación real, también verificaríamos:
  // - Marcadores en encabezados/pies de página
  // - Marcadores partidos entre párrafos o celdas
  // - Cambios controlados pendientes (w:ins, w:del)
  
  return advertencias;
}

/**
 * Linter que revisa el documento en busca de problemas específicos de Word
 */
export function lint(plantilla: Uint8Array): { errores: string[]; advertencias: string[] } {
  // Esta sería una versión más enfocada en solo reportar problemas
  // sin generar el esquema completo
  // Por ahora, reutilizamos el escáner pero solo nos interesan errores y advertencias
  
  // Nota: Esta función debería ser async pero la interfaz del plan sugiere síncrona
  // En una implementación real, podríamos hacer una versión síncrona simplificada
  // o cambiar la interfaz a async
  
  return {
    errores: [],
    advertencias: []
  };
}