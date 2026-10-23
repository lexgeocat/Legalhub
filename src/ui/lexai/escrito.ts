// src/ui/lexai/escrito.ts
import type { GeneradorDocx } from '../../application/puertos/modelos';
import { CONFIG_POR_DEFECTO, type FuenteModelo } from '../../domain/modelos/fuenteModelo';

export type BloqueLegal =
  | { t: 'h'; n: 1 | 2 | 3; texto: string }
  | { t: 'p'; texto: string }
  | { t: 'lista'; ordenada: boolean; items: string[] }
  | { t: 'tabla'; filas: string[][] }
  | { t: 'firmas'; izq: string[]; der: string[] }
  | { t: 'nota'; texto: string }
  | { t: 'hr' };

export interface Pieza { t: 'txt' | 'b' | 'i' | 'ref' | 'campo'; v: string }

const TAGS = /<\/?(?:br|p|div|span|b|i|u|em|strong|ul|ol|li|h[1-6]|table|thead|tbody|tr|td|th|hr|center|font)\b[^>]*>/gi;

/** Quita HTML real, pero conserva marcadores como <NOMBRE DEL DEMANDANTE> (los pasa a [..]). */
export function limpiarEntidadesYHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(TAGS, '')
    .replace(/<([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 /.,#°_:-]{2,})>/g, '[$1]')
    .replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Limpia markdown para copiar al portapapeles sin destruir viñetas ni formateo legítimo */
export function limpiarParaPortapapeles(raw: string): string {
  let t = limpiarEntidadesYHtml(raw);
  // Reemplazar divisores
  t = t.replace(/^[*\-_]{3,}$/gm, '────────────────────────────────────────────────────────────');
  // Encabezados # Titulo -> Titulo
  t = t.replace(/^#{1,6}\s+/gm, '');
  // Quitar negritas y cursivas markdown
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
  t = t.replace(/__([^_]+)__/g, '$1');
  t = t.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3');
  t = t.replace(/\*\*/g, '');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

/** Divide el texto en piezas inline reconociendo negritas, cursivas, referencias y marcadores [CAMPO] */
export function descomponerInline(texto: string): Pieza[] {
  const piezas: Pieza[] = [];
  const re = /(\[L\d+\]|\[W\d+\]|\*\*[^*]+\*\*|__[^_]+__|\[[A-ZÁÉÍÓÚÑ0-9_ -]{3,}\]|\*[^*\n]+\*)/g;
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > ultimo) {
      piezas.push({ t: 'txt', v: texto.slice(ultimo, idx) });
    }
    const val = m[0];
    if (val.startsWith('[L') || val.startsWith('[W')) {
      piezas.push({ t: 'ref', v: val });
    } else if (val.startsWith('**') || val.startsWith('__')) {
      piezas.push({ t: 'b', v: val.slice(2, -2) });
    } else if (val.startsWith('*') && val.endsWith('*')) {
      piezas.push({ t: 'i', v: val.slice(1, -1) });
    } else if (val.startsWith('[') && val.endsWith(']')) {
      piezas.push({ t: 'campo', v: val.slice(1, -1) });
    } else {
      piezas.push({ t: 'txt', v: val });
    }
    ultimo = idx + val.length;
  }
  if (ultimo < texto.length) {
    piezas.push({ t: 'txt', v: texto.slice(ultimo) });
  }
  return piezas;
}

/** Parsea los bloques legales de un texto markdown formal */
export function parsearBloques(raw: string): BloqueLegal[] {
  const limpio = limpiarEntidadesYHtml(raw);
  const bloquesRaw = limpio.split(/\n{2,}/);
  const salida: BloqueLegal[] = [];

  for (const b of bloquesRaw) {
    const t = b.trim();
    if (!t) continue;

    // Divisor
    if (/^[*\-_]{3,}$/.test(t)) {
      salida.push({ t: 'hr' });
      continue;
    }

    // Encabezados
    if (t.startsWith('# ')) {
      salida.push({ t: 'h', n: 1, texto: t.replace(/^#\s+/, '').trim() });
      continue;
    }
    if (t.startsWith('## ')) {
      salida.push({ t: 'h', n: 2, texto: t.replace(/^##\s+/, '').trim() });
      continue;
    }
    if (t.startsWith('### ')) {
      salida.push({ t: 'h', n: 3, texto: t.replace(/^###\s+/, '').trim() });
      continue;
    }

    // Tablas Markdown (| col 1 | col 2 |)
    const lineas = t.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lineas.length >= 2 && lineas.every((l) => l.startsWith('|') && l.endsWith('|'))) {
      const filas = lineas
        .filter((l) => !/^\|[\s\-:|]+\|$/.test(l)) // descartar fila separadora
        .map((l) => l.slice(1, -1).split('|').map((c) => c.trim()));
      if (filas.length > 0) {
        salida.push({ t: 'tabla', filas });
        continue;
      }
    }

    // Firmas
    if (
      t.includes('______') ||
      (/firma/i.test(t) && (t.includes('C.I.') || /vendedor|comprador|abogado|demandante|demandado/i.test(t)))
    ) {
      const colIzq: string[] = [];
      const colDer: string[] = [];
      let esDoble = false;

      for (const linea of lineas) {
        const partes = linea.trim().split(/\s{4,}/);
        if (partes.length >= 2) {
          esDoble = true;
          colIzq.push(partes[0].trim());
          colDer.push(partes[1].trim());
        } else {
          colIzq.push(linea.trim());
        }
      }
      salida.push({ t: 'firmas', izq: colIzq, der: esDoble ? colDer : [] });
      continue;
    }

    // Listas
    if (lineas.length > 0 && lineas.every((l) => /^\s*(\d+\.|[-*•])\s+/.test(l))) {
      const ordenada = /^\s*\d+\.\s+/.test(lineas[0]);
      const items = lineas.map((l) => l.replace(/^\s*(\d+\.|[-*•])\s+/, '').trim());
      salida.push({ t: 'lista', ordenada, items });
      continue;
    }

    // Notas / recomendaciones
    if (/^\*\*(?:RECOMENDACI[ÓO]N|NOTA|IMPORTANTE|ADVERTENCIA)/i.test(t) || t.startsWith('> ')) {
      salida.push({ t: 'nota', texto: t.replace(/^>\s*/, '') });
      continue;
    }

    // Párrafo
    salida.push({ t: 'p', texto: t });
  }

  return salida;
}

/** Construye un Uint8Array .docx usando el GeneradorDocxFflate del sistema */
export function construirDocx(generador: GeneradorDocx, texto: string): Uint8Array {
  const limpio = limpiarParaPortapapeles(texto);
  const fuente: FuenteModelo = {
    version: 1,
    config: {
      ...CONFIG_POR_DEFECTO,
      tamano: 'carta',
      fuente: 'Times New Roman',
      tamanoPt: 12,
      interlineado: 1.5,
    },
    texto: limpio,
    campos: [],
  };
  return generador.generar(fuente);
}
