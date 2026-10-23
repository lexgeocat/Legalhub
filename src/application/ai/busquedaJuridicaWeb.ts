import { fetch as fetchTauri } from '@tauri-apps/plugin-http';
import { extraerTerminos } from './textoConsulta';

const EN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export type AmbitoJuridico = 'bolivia' | 'tratados' | 'comparado' | 'general';
export type TipoFuenteWeb = 'jurisprudencia' | 'tratado' | 'norma' | 'doctrina' | 'general';

export interface FuenteWebJuridica {
  titulo: string;
  url: string;
  resumen: string;
  tipo: TipoFuenteWeb;
}

export interface ResultadoInvestigacionWeb {
  fuentes: FuenteWebJuridica[];
  terminoBuscado: string;
  ambito: AmbitoJuridico;
}

export const ETIQUETAS_AMBITO: Record<AmbitoJuridico, { nombre: string; etiquetaCorta: string; icono: string; descripcion: string }> = {
  bolivia: { nombre: 'Bolivia (TSJ / TCP / Leyes)', etiquetaCorta: 'Bolivia', icono: '🇧🇴', descripcion: 'Autos Supremos del TSJ, Sentencias Constitucionales del TCP y normas de Bolivia.' },
  tratados: { nombre: 'Tratados & Corte IDH', etiquetaCorta: 'Tratados / CIDH', icono: '🌐', descripcion: 'Pacto de San José, bloque de constitucionalidad y fallos de la Corte IDH.' },
  comparado: { nombre: 'Derecho Comparado', etiquetaCorta: 'Comparado', icono: '🌎', descripcion: 'Legislación y doctrina de otros países (Latinoamérica / España).' },
  general: { nombre: 'General / Todas las fuentes', etiquetaCorta: 'General', icono: '⚖️', descripcion: 'Búsqueda amplia de doctrina, artículos y jurisprudencia.' },
};

/** Dominios de referencia por tipo. */
const DOMINIOS: Record<'jurisprudencia' | 'norma' | 'tratado', string[]> = {
  jurisprudencia: ['tsj.bo', 'tcpbolivia.bo', 'organojudicial.gob.bo'],
  norma: ['gacetaoficialdebolivia.gob.bo', 'lexivox.org'],
  tratado: ['corteidh.or.cr', 'oas.org', 'ohchr.org', 'ilo.org', 'un.org'],
};
const FILTRO_POR_AMBITO: Record<AmbitoJuridico, string[]> = {
  bolivia: [...DOMINIOS.jurisprudencia, ...DOMINIOS.norma],
  tratados: DOMINIOS.tratado,
  comparado: [],
  general: [],
};
const PRIORIDAD: Record<TipoFuenteWeb, number> = { jurisprudencia: 0, norma: 1, tratado: 2, doctrina: 3, general: 4 };

const hostDe = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};
const coincide = (host: string, dominios: readonly string[]) => dominios.some((d) => host === d || host.endsWith(`.${d}`));

function clasificar(url: string, texto: string): TipoFuenteWeb {
  const h = hostDe(url);
  for (const t of ['jurisprudencia', 'tratado', 'norma'] as const) if (coincide(h, DOMINIOS[t])) return t;
  const c = `${texto} ${url}`.toLowerCase();
  if (/auto supremo|sentencia constitucional|jurisprudencia/.test(c)) return 'jurisprudencia';
  if (/tratado|convenci[oó]n|corte idh|pacto de san jos[eé]/.test(c)) return 'tratado';
  if (/c[oó]digo|ley n|decreto/.test(c)) return 'norma';
  if (/doctrina|an[aá]lisis|art[ií]culo/.test(c)) return 'doctrina';
  return 'general';
}

/** Consulta corta con palabras clave (nunca el prompt completo: lleva hechos y datos del cliente). */
function construirConsulta(prompt: string, ambito: AmbitoJuridico): string {
  const prefijo = { bolivia: 'bolivia jurisprudencia', tratados: 'corte interamericana convención americana', comparado: 'derecho comparado', general: '' }[ambito];
  return `${prefijo} ${extraerTerminos(prompt, 8).join(' ')}`.trim();
}

async function http(url: string, init: RequestInit, signal?: AbortSignal, timeoutMs = 12000): Promise<Response> {
  const opciones: RequestInit = { ...init, signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]) };
  return EN_TAURI ? fetchTauri(url, opciones) : fetch(url, opciones);
}

const limpiar = (s: string) =>
  s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();

/** Recomendado: https://tavily.com (clave gratuita). Con dominios oficiales primero; si hay pocos resultados, sin filtro. */
async function tavily(consulta: string, ambito: AmbitoJuridico, clave: string, signal?: AbortSignal): Promise<FuenteWebJuridica[]> {
  const pedir = async (dominios: string[]) => {
    const r = await http('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}` },
      body: JSON.stringify({ query: consulta, max_results: 6, search_depth: 'basic', ...(dominios.length ? { include_domains: dominios } : {}) }),
    }, signal, 20000);
    if (!r.ok) throw new Error(`Tavily HTTP ${r.status}`);
    return ((await r.json()) as { results?: { title: string; url: string; content: string }[] }).results ?? [];
  };
  const dominios = FILTRO_POR_AMBITO[ambito];
  let res = await pedir(dominios);
  if (res.length < 2 && dominios.length > 0) res = await pedir([]);
  return res.map((x) => ({ titulo: x.title, url: x.url, resumen: x.content, tipo: clasificar(x.url, `${x.title} ${x.content}`) }));
}

/** Respaldo sin clave. Frágil por naturaleza (scraping): si DuckDuckGo cambia o bloquea, falla con aviso. */
async function duckduckgo(consulta: string, signal?: AbortSignal): Promise<FuenteWebJuridica[]> {
  const res = await http('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: `q=${encodeURIComponent(consulta)}`,
  }, signal);
  if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);
  const html = await res.text();
  const salida: FuenteWebJuridica[] = [];
  for (const chunk of html.split(/class="result\s+/).slice(1)) {
    const a = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(chunk);
    const sn = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(chunk);
    if (!a || !sn) continue;
    const u = /[?&]uddg=([^&]+)/.exec(a[1]);
    const url = u ? decodeURIComponent(u[1]) : a[1];
    const titulo = limpiar(a[2]);
    const resumen = limpiar(sn[1]);
    salida.push({ titulo, url, resumen, tipo: clasificar(url, `${titulo} ${resumen}`) });
  }
  if (salida.length === 0) throw new Error('DuckDuckGo no devolvió resultados (posible bloqueo o cambio de formato)');
  return salida;
}

function depurar(fuentes: FuenteWebJuridica[]): FuenteWebJuridica[] {
  const vistos = new Set<string>();
  return fuentes
    .filter((f) => {
      const k = f.url.split('#')[0];
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .map((f) => ({ ...f, resumen: f.resumen.slice(0, 600) }))
    .sort((a, b) => PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo])
    .slice(0, 5);
}

export async function buscarJurisprudenciaWeb(
  prompt: string,
  ambito: AmbitoJuridico = 'bolivia',
  opciones: { signal?: AbortSignal; tavilyKey?: string } = {},
): Promise<ResultadoInvestigacionWeb> {
  const consulta = construirConsulta(prompt, ambito);
  const { signal, tavilyKey } = opciones;
  let crudas: FuenteWebJuridica[] = [];
  try {
    if (tavilyKey?.trim()) {
      try { crudas = await tavily(consulta, ambito, tavilyKey.trim(), signal); } catch (e) { if (signal?.aborted) throw e; }
    }
    if (crudas.length === 0) crudas = await duckduckgo(consulta, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('Búsqueda jurídica web omitida:', err);
  }
  return { fuentes: depurar(crudas), terminoBuscado: consulta, ambito };
}
