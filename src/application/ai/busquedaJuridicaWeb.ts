// src/application/ai/busquedaJuridicaWeb.ts
import { fetch as fetchTauri } from '@tauri-apps/plugin-http';

const EN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export type AmbitoJuridico = 'bolivia' | 'tratados' | 'comparado' | 'general';

export interface FuenteWebJuridica {
  titulo: string;
  url: string;
  resumen: string;
  tipo: 'jurisprudencia' | 'tratado' | 'doctrina' | 'general';
}

export interface ResultadoInvestigacionWeb {
  fuentes: FuenteWebJuridica[];
  terminoBuscado: string;
  ambito: AmbitoJuridico;
}

export const ETIQUETAS_AMBITO: Record<
  AmbitoJuridico,
  { nombre: string; etiquetaCorta: string; icono: string; descripcion: string }
> = {
  bolivia: {
    nombre: 'Bolivia (TSJ / TCP / Leyes)',
    etiquetaCorta: 'Bolivia',
    icono: '🇧🇴',
    descripcion: 'Autos Supremos del TSJ, Sentencias Constitucionales del TCP y Códigos de Bolivia.'
  },
  tratados: {
    nombre: 'Tratados & Corte IDH',
    etiquetaCorta: 'Tratados / CIDH',
    icono: '🌐',
    descripcion: 'Pacto de San José, Bloque de Constitucionalidad (Art. 410 CPE) y fallos de la Corte IDH.'
  },
  comparado: {
    nombre: 'Derecho Comparado',
    etiquetaCorta: 'Comparado',
    icono: '🌎',
    descripcion: 'Legislación y doctrina comparada de otros países (Latinoamérica / España).'
  },
  general: {
    nombre: 'General / Todas las fuentes',
    etiquetaCorta: 'General',
    icono: '⚖️',
    descripcion: 'Búsqueda web amplia de doctrina, artículos y jurisprudencia sin filtros territoriales.'
  }
};

/** Ejecuta peticiones HTTP respetando el entorno Tauri o navegador */
async function http(url: string, opciones?: RequestInit, timeoutMs = 12000): Promise<Response> {
  const f = EN_TAURI ? fetchTauri : fetch;
  const controller = new AbortController();
  const idTimer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await f(url, { ...opciones, signal: controller.signal });
    clearTimeout(idTimer);
    return resp;
  } catch (err) {
    clearTimeout(idTimer);
    throw err;
  }
}

/**
 * Realiza una búsqueda web jurídica en vivo para obtener jurisprudencia vinculante,
 * autos supremos, sentencias constitucionales y tratados internacionales.
 */
export async function buscarJurisprudenciaWeb(
  prompt: string,
  ambito: AmbitoJuridico = 'bolivia'
): Promise<ResultadoInvestigacionWeb> {
  const consultaLimpia = prompt
    .replace(/^(busca|buscar|encuentra|dime|cuales son|redacta|elabora|analiza|por favor)\s+/gi, '')
    .trim();

  let queryFinal = '';
  if (ambito === 'bolivia') {
    queryFinal = `jurisprudencia bolivia auto supremo sentencia constitucional ${consultaLimpia}`;
  } else if (ambito === 'tratados') {
    queryFinal = `tratados internacionales derechos humanos pacto san jose corte idh bolivia ${consultaLimpia}`;
  } else if (ambito === 'comparado') {
    queryFinal = `derecho comparado legislacion jurisprudencia ${consultaLimpia}`;
  } else {
    queryFinal = `jurisprudencia legislacion doctrina ${consultaLimpia}`;
  }

  try {
    const res = await http(
      'https://html.duckduckgo.com/html/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: `q=${encodeURIComponent(queryFinal)}`
      },
      12000
    );

    if (!res.ok) {
      return { fuentes: [], terminoBuscado: queryFinal, ambito };
    }

    const html = await res.text();
    const chunks = html.split(/class="result\s+/);
    const fuentes: FuenteWebJuridica[] = [];

    for (let i = 1; i < chunks.length && fuentes.length < 5; i++) {
      const chunk = chunks[i];
      const aMatch = chunk.match(/<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const snipMatch = chunk.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

      if (aMatch && snipMatch) {
        let url = aMatch[1];
        const uddgMatch = url.match(/[?&]uddg=([^&]+)/);
        if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);

        const titulo = aMatch[2].replace(/<[^>]+>/g, '').trim();
        const resumen = snipMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/&amp;/g, '&')
          .trim();

        let tipo: FuenteWebJuridica['tipo'] = 'general';
        const combo = (titulo + ' ' + resumen + ' ' + url).toLowerCase();
        if (/auto supremo|sentencia constitucional|tsj|tcp|jurisprudencia|tribunal/.test(combo)) {
          tipo = 'jurisprudencia';
        } else if (/tratado|convenci[oó]n|corte idh|pacto de san jos[eé]|derechos humanos/.test(combo)) {
          tipo = 'tratado';
        } else if (/doctrina|analisis|codigo|ley/.test(combo)) {
          tipo = 'doctrina';
        }

        fuentes.push({ titulo, url, resumen, tipo });
      }
    }

    return { fuentes, terminoBuscado: queryFinal, ambito };
  } catch (err) {
    console.warn('No se pudo completar la búsqueda jurídica web en vivo:', err);
    return { fuentes: [], terminoBuscado: queryFinal, ambito };
  }
}
