// src/application/ai/proveedoresIa.ts
import { fetch as fetchTauri } from '@tauri-apps/plugin-http';
import { hoyISO } from '../../domain/modelos/filtros/fecha';
import type { AmbitoJuridico, FuenteWebJuridica } from './busquedaJuridicaWeb';
export type { AmbitoJuridico, FuenteWebJuridica } from './busquedaJuridicaWeb';

export type ProveedorIaId = 'ollama' | 'opencode' | 'gemini' | 'groq' | 'claude';

export interface InfoProveedor {
  id: ProveedorIaId;
  nombre: string;
  etiqueta: string;
  descripcion: string;
  /** Dónde obtener la API key */
  urlClave: string;
  /** Si hace falta clave para listar modelos */
  claveParaListar: boolean;
  placeholderClave: string;
}

export const PROVEEDORES_IA: Record<ProveedorIaId, InfoProveedor> = {
  ollama: {
    id: 'ollama',
    nombre: 'Ollama Cloud',
    etiqueta: 'API',
    descripcion:
      'Modelos de Ollama en la nube (https://ollama.com) o en tu propio servidor. La lista de modelos sale directamente del servidor; para generar texto en Ollama Cloud necesitas tu API key (cuenta gratuita con límite de uso).',
    urlClave: 'https://ollama.com/settings/keys',
    claveParaListar: false,
    placeholderClave: 'API key de ollama.com/settings/keys',
  },
  opencode: {
    id: 'opencode',
    nombre: 'OpenCode Console',
    etiqueta: 'Free / De pago',
    descripcion:
      'Modelos de OpenCode Zen (https://opencode.ai/console). Incluye modelos "-free" (DeepSeek Flash, GLM Flash, MiniMax, etc.) y modelos avanzados. Si tu cuenta no tiene saldo en OpenCode, te recomendamos usar Ollama Cloud o Google Gemini que son 100% gratuitos.',
    urlClave: 'https://opencode.ai/console',
    claveParaListar: false,
    placeholderClave: 'API key de OpenCode Console',
  },
  gemini: {
    id: 'gemini',
    nombre: 'Google Gemini',
    etiqueta: 'Capa gratis',
    descripcion: 'Google AI Studio ofrece una capa gratuita con límites por minuto y por día.',
    urlClave: 'https://aistudio.google.com/app/apikey',
    claveParaListar: true,
    placeholderClave: 'AIza...',
  },
  groq: {
    id: 'groq',
    nombre: 'Groq Cloud',
    etiqueta: 'Capa gratis',
    descripcion: 'Inferencia muy rápida con capa gratuita limitada.',
    urlClave: 'https://console.groq.com/keys',
    claveParaListar: true,
    placeholderClave: 'gsk_...',
  },
  claude: {
    id: 'claude',
    nombre: 'Anthropic Claude',
    etiqueta: 'De pago',
    descripcion: 'Requiere saldo en la consola de Anthropic.',
    urlClave: 'https://console.anthropic.com/settings/keys',
    claveParaListar: true,
    placeholderClave: 'sk-ant-...',
  },
};

export const ORDEN_PROVEEDORES: ProveedorIaId[] = ['ollama', 'gemini', 'groq', 'opencode', 'claude'];

export interface ConfigIa {
  proveedorActivo: ProveedorIaId;
  ollamaUrl: string;
  ollamaApiKey: string;
  ollamaModelo: string;
  opencodeApiKey: string;
  opencodeModelo: string;
  geminiApiKey: string;
  geminiModelo: string;
  groqApiKey: string;
  groqModelo: string;
  claudeApiKey: string;
  claudeModelo: string;
  /** Búsqueda web profesional (opcional). Sin clave se usa DuckDuckGo. */
  tavilyApiKey: string;
  temperatura: number;
  /** Tope de tokens de salida por respuesta. */
  maxTokens: number;
  /** Enmascara C.I./NIT/teléfonos/correos antes de enviarlos a la IA o a la web. */
  protegerDatos: boolean;
}

type CampoTexto = Exclude<keyof ConfigIa, 'proveedorActivo' | 'temperatura' | 'maxTokens' | 'protegerDatos'>;

export const CAMPOS_IA: Record<ProveedorIaId, { clave: CampoTexto; modelo: CampoTexto }> = {
  ollama: { clave: 'ollamaApiKey', modelo: 'ollamaModelo' },
  opencode: { clave: 'opencodeApiKey', modelo: 'opencodeModelo' },
  gemini: { clave: 'geminiApiKey', modelo: 'geminiModelo' },
  groq: { clave: 'groqApiKey', modelo: 'groqModelo' },
  claude: { clave: 'claudeApiKey', modelo: 'claudeModelo' },
};

const CLAVE_STORAGE = 'legalhub_ia_config';
const URL_OLLAMA_CLOUD = 'https://ollama.com';

export const CONFIG_IA_DEFECTO: ConfigIa = {
  proveedorActivo: 'ollama',
  ollamaUrl: URL_OLLAMA_CLOUD,
  ollamaApiKey: '', ollamaModelo: '',
  opencodeApiKey: '', opencodeModelo: '',
  geminiApiKey: '', geminiModelo: '',
  groqApiKey: '', groqModelo: '',
  claudeApiKey: '', claudeModelo: '',
  tavilyApiKey: '',
  temperatura: 0.2,
  maxTokens: 8192,
  protegerDatos: true,
};

export function obtenerConfigIa(): ConfigIa {
  try {
    const raw = localStorage.getItem(CLAVE_STORAGE);
    if (!raw) return { ...CONFIG_IA_DEFECTO };
    const cfg: ConfigIa = { ...CONFIG_IA_DEFECTO, ...JSON.parse(raw) };
    if (!cfg.ollamaUrl.trim() || /localhost:11434|api\.ollama\.com/.test(cfg.ollamaUrl)) cfg.ollamaUrl = URL_OLLAMA_CLOUD;
    if (!PROVEEDORES_IA[cfg.proveedorActivo]) cfg.proveedorActivo = 'ollama';
    if (!(cfg.maxTokens >= 256)) cfg.maxTokens = CONFIG_IA_DEFECTO.maxTokens;
    return cfg;
  } catch {
    return { ...CONFIG_IA_DEFECTO };
  }
}

export function guardarConfigIa(cfg: ConfigIa): void {
  try {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(cfg));
  } catch (err) {
    console.error('No se pudo guardar la configuración de IA', err);
  }
}

function normalizarUrlOllama(url: string): string {
  return (url.trim() || URL_OLLAMA_CLOUD).replace(/\/+$/, '').replace(/\/(api|v1)$/, '');
}

/** null = listo para consultar; si no, el motivo en una frase. */
export function motorListo(cfg: ConfigIa): string | null {
  const p = cfg.proveedorActivo;
  const { clave, modelo } = CAMPOS_IA[p];
  const nombre = PROVEEDORES_IA[p].nombre;
  if (!(cfg[modelo] as string).trim()) return `Elige un modelo de ${nombre} en la configuración de IA.`;
  const necesitaClave = p !== 'ollama' || /ollama\.com/i.test(normalizarUrlOllama(cfg.ollamaUrl));
  if (necesitaClave && !(cfg[clave] as string).trim()) return `Falta la API key de ${nombre}.`;
  return null;
}

// ───────────────────────── HTTP ─────────────────────────

const EN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

interface OpcHttp { timeoutMs?: number; signal?: AbortSignal }

/** En escritorio las peticiones salen desde Rust (sin CORS). `signal` permite cancelar desde la UI. */
function http(url: string, init: RequestInit = {}, { timeoutMs = 15000, signal }: OpcHttp = {}): Promise<Response> {
  const opciones: RequestInit = { ...init, signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]) };
  return EN_TAURI ? fetchTauri(url, opciones) : fetch(url, opciones);
}

async function leerError(resp: Response): Promise<string> {
  const texto = await resp.text().catch(() => '');
  try {
    const json = JSON.parse(texto);
    const msg = json?.error?.message ?? json?.error ?? json?.message;
    if (typeof msg === 'string' && msg) return `HTTP ${resp.status}: ${msg}`;
  } catch {
    // no es JSON
  }
  return `HTTP ${resp.status}${texto ? `: ${texto.slice(0, 160)}` : ''}`;
}

function describirFallo(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) return 'El servidor tardó demasiado en responder.';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return EN_TAURI
      ? 'No hay conexión con el servidor. Revisa la URL y tu internet.'
      : 'El navegador bloqueó la petición (CORS). Abre Legal-Hub como app de escritorio (pnpm tauri dev).';
  }
  if (/HTTP 401/.test(msg)) return 'La API key fue rechazada (HTTP 401). Revísala en la configuración de IA.';
  if (/HTTP 429/.test(msg)) return 'Límite de uso del proveedor alcanzado (HTTP 429). Espera un momento o cambia de modelo.';
  if (/Insufficient account funds|insufficient_quota/i.test(msg)) {
    return 'Saldo insuficiente en tu cuenta (HTTP 402). Recarga fondos o usa Ollama Cloud o Google Gemini, que tienen capa gratuita.';
  }
  if (/FreeTierError|free tier can only be used from within/i.test(msg)) {
    return 'OpenCode no permite usar sus modelos "-free" por API externa (HTTP 403). Cambia a Ollama Cloud o Google Gemini.';
  }
  return msg;
}

const cabecerasBearer = (clave: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(clave.trim() ? { Authorization: `Bearer ${clave.trim()}` } : {}),
});
const cabecerasGemini = (clave: string): Record<string, string> => ({ 'Content-Type': 'application/json', 'x-goog-api-key': clave.trim() });
const cabecerasClaude = (clave: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  'x-api-key': clave.trim(),
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
});

/** Modelos de chat de OpenCode (el endpoint lista también modelos que no sirven para chat). */
function opencodeCompatible(id: string): boolean {
  if (id === 'test' || id === 'big-pickle' || /-backup$/.test(id)) return false;
  return /-free$/.test(id) || /^(deepseek-|glm-|kimi-|minimax-|mistral-|qwen|gemini-|gpt-|claude-)/.test(id);
}

// ───────────────────────── Listado de modelos ─────────────────────────

export async function listarModelos(proveedor: ProveedorIaId, cfg: ConfigIa, signal?: AbortSignal): Promise<string[]> {
  const clave = (cfg[CAMPOS_IA[proveedor].clave] as string).trim();
  if (PROVEEDORES_IA[proveedor].claveParaListar && !clave) throw new Error('Pega tu API key para ver tus modelos.');

  const pedir = async <T>(url: string, cabeceras: Record<string, string>): Promise<T> => {
    const r = await http(url, { headers: cabeceras }, { signal });
    if (!r.ok) throw new Error(await leerError(r));
    return (await r.json()) as T;
  };
  type Lista = { data?: { id: string; active?: boolean }[] };

  try {
    let modelos: string[] = [];
    if (proveedor === 'ollama') {
      const base = normalizarUrlOllama(cfg.ollamaUrl);
      try {
        const d = await pedir<{ models?: { name?: string; model?: string }[] }>(`${base}/api/tags`, cabecerasBearer(clave));
        modelos = (d.models ?? []).map((m) => m.name ?? m.model ?? '');
      } catch {
        modelos = ((await pedir<Lista>(`${base}/v1/models`, cabecerasBearer(clave))).data ?? []).map((m) => m.id);
      }
    } else if (proveedor === 'opencode') {
      const d = await pedir<Lista>('https://opencode.ai/zen/v1/models', cabecerasBearer(clave));
      modelos = (d.data ?? []).map((m) => m.id).filter(opencodeCompatible)
        .sort((a, b) => Number(b.endsWith('-free')) - Number(a.endsWith('-free')) || a.localeCompare(b));
    } else if (proveedor === 'groq') {
      const d = await pedir<Lista>('https://api.groq.com/openai/v1/models', cabecerasBearer(clave));
      modelos = (d.data ?? []).filter((m) => m.active !== false).map((m) => m.id).filter((id) => !/whisper|tts|guard|orpheus/i.test(id));
    } else if (proveedor === 'gemini') {
      const d = await pedir<{ models?: { name: string; supportedGenerationMethods?: string[] }[] }>(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', cabecerasGemini(clave),
      );
      modelos = (d.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, '')).filter((id) => !/embedding|aqa|imagen|tts|image/i.test(id));
    } else {
      const d = await pedir<Lista>('https://api.anthropic.com/v1/models?limit=100', cabecerasClaude(clave));
      modelos = (d.data ?? []).map((m) => m.id);
    }
    modelos = [...new Set(modelos.filter(Boolean))];
    if (modelos.length === 0) throw new Error('El servidor respondió, pero no devolvió modelos.');
    return modelos;
  } catch (err) {
    throw new Error(describirFallo(err));
  }
}

const CLAVE_CACHE = 'legalhub_ia_modelos';
const VIGENCIA_CACHE_MS = 6 * 60 * 60 * 1000;
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);

/** Lista con caché de 6 h: cambiar de pestaña o salir de un campo ya no dispara peticiones. */
export async function listarModelosCacheado(proveedor: ProveedorIaId, cfg: ConfigIa, forzar = false): Promise<string[]> {
  const k = `${proveedor}|${proveedor === 'ollama' ? normalizarUrlOllama(cfg.ollamaUrl) : ''}|${hash(cfg[CAMPOS_IA[proveedor].clave] as string)}`;
  let cache: Record<string, { ts: number; modelos: string[] }> = {};
  try { cache = JSON.parse(localStorage.getItem(CLAVE_CACHE) ?? '{}'); } catch { /* sin caché */ }
  const hit = cache[k];
  if (!forzar && hit && Date.now() - hit.ts < VIGENCIA_CACHE_MS) return hit.modelos;
  const modelos = await listarModelos(proveedor, cfg);
  try { localStorage.setItem(CLAVE_CACHE, JSON.stringify({ ...cache, [k]: { ts: Date.now(), modelos } })); } catch { /* sin caché */ }
  return modelos;
}

/** OPCIONAL (botón manual): en Ollama Cloud descarta los modelos que responden 402/429. Hace 1 petición por modelo. */
export async function verificarModelosOllama(cfg: ConfigIa, candidatos: readonly string[], signal?: AbortSignal): Promise<string[]> {
  const base = normalizarUrlOllama(cfg.ollamaUrl);
  const responde = async (id: string) => {
    try {
      const r = await http(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: cabecerasBearer(cfg.ollamaApiKey),
        body: JSON.stringify({ model: id, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      }, { timeoutMs: 6000, signal });
      return r.ok;
    } catch {
      return false;
    }
  };
  const validos: string[] = [];
  for (let i = 0; i < candidatos.length; i += 3) {
    const lote = candidatos.slice(i, i + 3);
    const ok = await Promise.all(lote.map(responde));
    lote.forEach((m, k) => { if (ok[k]) validos.push(m); });
  }
  if (validos.length === 0) throw new Error('Ningún modelo respondió: cuota agotada (429) o requieren plan de pago (402).');
  return validos;
}

// ───────────────────────── Generación con streaming ─────────────────────────

export interface OpcionesGeneracion {
  signal?: AbortSignal;
  /** Recibe el texto acumulado cada vez que llega un fragmento. */
  onTexto?: (acumulado: string) => void;
}
interface Mensajes { sistema: string; usuario: string; maxTokens?: number }
export interface SalidaIa { texto: string; truncado: boolean }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
interface Delta { texto?: string; fin?: string; error?: string; bloqueo?: string }
type Formato = 'ollama' | 'openai' | 'gemini' | 'claude';

const DECODIFICAR: Record<Formato, (o: Json) => Delta> = {
  ollama: (o) => ({ texto: o.message?.content, fin: o.done ? (o.done_reason ?? 'stop') : undefined, error: o.error }),
  openai: (o) => ({
    texto: o.choices?.[0]?.delta?.content,
    fin: o.choices?.[0]?.finish_reason ?? undefined,
    error: o.error?.message ?? (typeof o.error === 'string' ? o.error : undefined),
  }),
  gemini: (o) => ({
    texto: (o.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join(''),
    fin: o.candidates?.[0]?.finishReason,
    error: o.error?.message,
    bloqueo: o.promptFeedback?.blockReason,
  }),
  claude: (o) => (o.type === 'content_block_delta' ? { texto: o.delta?.text }
    : o.type === 'message_delta' ? { fin: o.delta?.stop_reason }
    : o.type === 'error' ? { error: o.error?.message } : {}),
};

async function* lineas(resp: Response): AsyncGenerator<string> {
  const lector = resp.body?.getReader();
  if (!lector) {
    for (const l of (await resp.text()).split('\n')) yield l;
    return;
  }
  const dec = new TextDecoder();
  let resto = '';
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    resto += dec.decode(value, { stream: true });
    const partes = resto.split('\n');
    resto = partes.pop() ?? '';
    for (const l of partes) yield l.replace(/\r$/, '');
  }
  if (resto.trim()) yield resto;
}

function jsonDeLinea(l: string): Json | null {
  const t = (l.startsWith('data:') ? l.slice(5) : l).trim();
  if (!t.startsWith('{')) return null;
  try { return JSON.parse(t) as Json; } catch { return null; }
}

const SEGURIDAD_GEMINI = ['HARASSMENT', 'HATE_SPEECH', 'SEXUALLY_EXPLICIT', 'DANGEROUS_CONTENT']
  .map((c) => ({ category: `HARM_CATEGORY_${c}`, threshold: 'BLOCK_ONLY_HIGH' }));

function armarPeticion(p: ProveedorIaId, cfg: ConfigIa, clave: string, modelo: string, m: Mensajes, ollamaV1 = false) {
  const temperature = cfg.temperatura ?? 0.2;
  const max = m.maxTokens ?? cfg.maxTokens;
  const chat = [{ role: 'system', content: m.sistema }, { role: 'user', content: m.usuario }];
  const post = (headers: Record<string, string>, cuerpo: unknown): RequestInit => ({ method: 'POST', headers, body: JSON.stringify(cuerpo) });
  const openai = (url: string) => ({
    url, formato: 'openai' as Formato,
    init: post(cabecerasBearer(clave), { model: modelo, messages: chat, temperature, max_tokens: max, stream: true }),
  });

  switch (p) {
    case 'ollama': {
      const base = normalizarUrlOllama(cfg.ollamaUrl);
      if (ollamaV1) return openai(`${base}/v1/chat/completions`);
      return {
        url: `${base}/api/chat`, formato: 'ollama' as Formato,
        init: post(cabecerasBearer(clave), { model: modelo, messages: chat, stream: true, options: { temperature, num_predict: max } }),
      };
    }
    case 'opencode': return openai('https://opencode.ai/zen/v1/chat/completions');
    case 'groq': return openai('https://api.groq.com/openai/v1/chat/completions');
    case 'gemini':
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:streamGenerateContent?alt=sse`,
        formato: 'gemini' as Formato,
        init: post(cabecerasGemini(clave), {
          systemInstruction: { parts: [{ text: m.sistema }] },
          contents: [{ role: 'user', parts: [{ text: m.usuario }] }],
          generationConfig: { temperature, maxOutputTokens: max },
          safetySettings: SEGURIDAD_GEMINI,
        }),
      };
    default:
      return {
        url: 'https://api.anthropic.com/v1/messages', formato: 'claude' as Formato,
        init: post(cabecerasClaude(clave), {
          model: modelo, max_tokens: max, temperature, system: m.sistema, stream: true,
          messages: [{ role: 'user', content: m.usuario }],
        }),
      };
  }
}

async function generarTexto(proveedor: ProveedorIaId, cfg: ConfigIa, m: Mensajes, opc: OpcionesGeneracion = {}): Promise<SalidaIa> {
  const clave = (cfg[CAMPOS_IA[proveedor].clave] as string).trim();
  const modelo = (cfg[CAMPOS_IA[proveedor].modelo] as string).trim();
  const nombre = PROVEEDORES_IA[proveedor].nombre;
  const problema = motorListo({ ...cfg, proveedorActivo: proveedor });
  if (problema) throw new Error(problema);

  try {
    let p = armarPeticion(proveedor, cfg, clave, modelo, m);
    let resp = await http(p.url, p.init, { timeoutMs: 300000, signal: opc.signal });
    if (!resp.ok && proveedor === 'ollama' && (resp.status === 404 || resp.status === 405)) {
      p = armarPeticion(proveedor, cfg, clave, modelo, m, true);
      resp = await http(p.url, p.init, { timeoutMs: 300000, signal: opc.signal });
    }
    if (!resp.ok) throw new Error(await leerError(resp));

    let texto = '';
    let fin = '';
    for await (const linea of lineas(resp)) {
      const o = jsonDeLinea(linea);
      if (!o) continue;
      const d = DECODIFICAR[p.formato](o);
      if (d.error) throw new Error(d.error);
      if (d.bloqueo) throw new Error(`${nombre} bloqueó la consulta (${d.bloqueo}).`);
      if (d.texto) {
        texto += d.texto;
        opc.onTexto?.(texto);
      }
      if (d.fin) fin = d.fin;
    }
    if (!texto.trim()) {
      throw new Error(/SAFETY|content_filter/i.test(fin)
        ? `${nombre} filtró la respuesta por seguridad (${fin}).`
        : 'respondió sin texto: el modelo pudo gastar todo el límite razonando. Sube «Longitud máxima» o elige otro modelo.');
    }
    return { texto, truncado: /length|max_tokens/i.test(fin) };
  } catch (err) {
    if (opc.signal?.aborted) throw err;
    throw new Error(`${nombre} (${modelo}): ${describirFallo(err)}`);
  }
}

export async function probarConexionProveedor(
  proveedor: ProveedorIaId,
  cfg: ConfigIa,
): Promise<{ ok: boolean; mensaje: string; modelos?: string[] }> {
  let modelos: string[];
  try {
    modelos = await listarModelosCacheado(proveedor, cfg, true);
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : String(err) };
  }
  const modelo = (cfg[CAMPOS_IA[proveedor].modelo] as string).trim();
  if (!modelo) return { ok: true, mensaje: `${modelos.length} modelos disponibles. Elige uno y vuelve a probar.`, modelos };
  try {
    const { texto } = await generarTexto(proveedor, cfg, {
      sistema: 'Responde de forma muy concisa.', usuario: 'Responde únicamente con la palabra OK.', maxTokens: 300,
    });
    return { ok: true, mensaje: `Conectado: ${modelo} respondió («${texto.trim().slice(0, 30)}»).`, modelos };
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : String(err), modelos };
  }
}

// ───────────────────────── Lex AI ─────────────────────────

export interface ArticuloContexto {
  leyNombre: string;
  numero: string;
  titulo?: string;
  texto: string;
}

export type ModoUsuario = 'consulta' | 'redaccion' | 'revision';
export type ModoLex = ModoUsuario | 'continuar';

export interface CitaDetectada { texto: string; verificada: boolean }

export interface ResultadoRedaccion {
  texto: string;
  citas: CitaDetectada[];
  proveedorUsado: string;
  modeloUsado: string;
  tiempoMs: number;
  truncado: boolean;
}

export interface MensajeChatLex {
  id: string;
  rol: 'usuario' | 'asistente';
  texto: string;
  tiempoMs?: number;
  modeloUsado?: string;
  proveedorUsado?: string;
  citas?: CitaDetectada[];
  fuentesConsultadas?: ArticuloContexto[];
  fuentesWeb?: FuenteWebJuridica[];
  ambitoUsado?: AmbitoJuridico;
  terminoWebBuscado?: string;
  esError?: boolean;
  /** Respuesta cortada por el límite de longitud o interrumpida por el usuario. */
  truncado?: boolean;
  creadoEn: string;
}

export interface ParametrosChatLexAi {
  prompt: string;
  historial?: { rol: 'usuario' | 'asistente'; texto: string }[];
  articulosContexto: ArticuloContexto[];
  leyesSeleccionadasNombres: string[];
  fuentesWeb?: FuenteWebJuridica[];
  ambito?: AmbitoJuridico;
  modo?: ModoLex;
  datosProtegidos?: boolean;
}

const INSTRUCCION_MODO: Record<ModoLex, string> = {
  consulta: 'MODO CONSULTA: responde directo y conciso, con fundamento y citas; no redactes un escrito completo salvo que se pida.',
  redaccion: 'MODO REDACCIÓN: entrega el escrito completo, formal y listo para firma (suma, autoridad, generales de ley, hechos, fundamento de derecho, petitorio, otrosíes). Todo dato que no se te dio va en MAYÚSCULAS entre corchetes, p. ej. [NOMBRE DEL DEMANDANTE].',
  revision: 'MODO REVISIÓN: el abogado pega un borrador. NO lo reescribas entero: lista observaciones numeradas (errores de forma, fundamentación faltante, riesgos procesales, plazos) y propone redacciones alternativas solo de los pasajes problemáticos.',
  continuar: 'MODO CONTINUACIÓN: continúa exactamente donde termina el texto previo. No repitas nada, no saludes, no resumas.',
};

function sistemaLex(modo: ModoLex, datosProtegidos: boolean): string {
  return `Eres "Lex AI", asistente senior de investigación y redacción jurídica para abogados litigantes.
Fecha actual: ${hoyISO()}.

REGLAS DE RIGOR (prioritarias):
1. Fundamenta SOLO con las fuentes del contexto: [L1], [L2]… son artículos de las leyes del despacho y [W1], [W2]… fuentes web. Al usarlas, cita su marca (ej. «conforme al Art. 568 del Código Civil [L2]»).
2. NO inventes artículos, números de Auto Supremo o Sentencia Constitucional, fechas ni textos. Si algo no está en las fuentes y no lo sabes con certeza, escríbelo como [VERIFICAR: detalle] en vez de afirmarlo.
3. Si el contexto dice que no hay artículos de las leyes cargadas para la consulta, indícalo y no reproduzcas de memoria el texto de ningún artículo.
4. Ordenamiento por defecto: Estado Plurinacional de Bolivia (CPE, Código Civil, Código Procesal Civil Ley 439, Código Penal, Código Procesal Penal, etc.). Si no se indica país, aclara al final: «(Fundamentado conforme a la legislación boliviana; indícame si requieres otro país)». Si el usuario indica otro país, aplica solo ese derecho.
5. Aplica el bloque de constitucionalidad (arts. 13, 256 y 410 CPE) y el control de convencionalidad cuando corresponda (CADH, Corte IDH, convenios OIT).
6. No inventes datos de las partes: usa marcadores [NOMBRE DEL DEMANDANTE], [C.I.], [DOMICILIO]…
${datosProtegidos ? '7. Los marcadores [DOC_n], [TEL_n] y [CORREO_n] son datos reservados: consérvalos literalmente.\n' : ''}
${INSTRUCCION_MODO[modo]}

FORMATO: Markdown simple (#, ##, **negrita**, listas, tablas con |). PROHIBIDO usar HTML o entidades (&nbsp;, <br>). Separa párrafos con una línea en blanco. Líneas de firma con guiones bajos (______________________). No abuses de la negrita.`;
}

const recorte = (t: string, max = 3000) => (t.length > max ? `${t.slice(0, 1200)} […] ${t.slice(-(max - 1200))}` : t);

export async function consultarLexAi(params: ParametrosChatLexAi, opc: OpcionesGeneracion = {}): Promise<ResultadoRedaccion> {
  const inicio = Date.now();
  const cfg = obtenerConfigIa();
  const proveedor = cfg.proveedorActivo;
  const {
    prompt, historial = [], articulosContexto: arts, leyesSeleccionadasNombres: nombres,
    fuentesWeb = [], ambito = 'bolivia', modo = 'consulta', datosProtegidos = false,
  } = params;

  const bloqueLeyes = arts.length > 0
    ? arts.map((a, i) => `[L${i + 1}] ${a.leyNombre} · Art. ${a.numero}${a.titulo ? ` (${a.titulo})` : ''}:\n«${a.texto}»`).join('\n\n')
    : nombres.length > 0
      ? `Leyes activas: ${nombres.join(', ')}. NO se encontraron en ellas artículos relacionados con esta consulta.`
      : '';

  let usuario = '';
  if (bloqueLeyes) usuario += `--- LEYES DEL DESPACHO (contexto) ---\n${bloqueLeyes}\n\n`;
  if (fuentesWeb.length > 0) {
    usuario += `--- FUENTES WEB (${ambito.toUpperCase()}) · extractos breves, NO texto íntegro ---\n`
      + fuentesWeb.map((f, i) => `[W${i + 1}] (${f.tipo}) ${f.titulo}\nURL: ${f.url}\nExtracto: «${f.resumen}»`).join('\n\n')
      + '\n\n';
  }
  if (historial.length > 0) {
    usuario += `--- CONVERSACIÓN PREVIA ---\n${historial.slice(-6).map((h) => `${h.rol === 'usuario' ? 'Abogado' : 'Lex AI'}: ${recorte(h.texto)}`).join('\n\n')}\n\n`;
  }
  usuario += `INSTRUCCIÓN DEL ABOGADO:\n${prompt}`;

  const { texto, truncado } = await generarTexto(proveedor, cfg, { sistema: sistemaLex(modo, datosProtegidos), usuario }, opc);
  return {
    texto, truncado,
    citas: extraerCitas(texto, arts, fuentesWeb),
    proveedorUsado: PROVEEDORES_IA[proveedor].nombre,
    modeloUsado: (cfg[CAMPOS_IA[proveedor].modelo] as string) || 'defecto',
    tiempoMs: Date.now() - inicio,
  };
}

const normNum = (n: string) => n.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();

/** Citas del texto. `verificada` = aparece en los artículos o fuentes web que se le dieron al modelo. */
export function extraerCitas(texto: string, articulos: ArticuloContexto[], fuentesWeb: FuenteWebJuridica[]): CitaDetectada[] {
  const salida = new Map<string, CitaDetectada>();
  const poner = (t: string, verificada: boolean) => {
    if (salida.size < 14 && !salida.has(t)) salida.set(t, { texto: t, verificada });
  };
  const enContexto = new Map<string, ArticuloContexto>();
  for (const a of articulos) if (!enContexto.has(normNum(a.numero))) enContexto.set(normNum(a.numero), a);

  for (const m of texto.matchAll(/\b(?:arts?\.?|art[íi]culos?)\s*(\d{1,5}(?:\s*(?:bis|ter|qu[aá]ter))?)/gi)) {
    const a = enContexto.get(normNum(m[1]));
    poner(a ? `Art. ${a.numero} ${a.leyNombre}` : `Art. ${normNum(m[1])}`, !!a);
  }
  const web = fuentesWeb.map((f) => `${f.titulo} ${f.resumen} ${f.url}`).join(' ').toLowerCase();
  for (const m of texto.matchAll(/\b(?:Auto\s+Supremo|A\.?S\.?)\s*(?:N[°º.]*\s*)?(\d+[/\-]\d{2,4})/gi)) {
    poner(`Auto Supremo ${m[1]}`, web.includes(m[1].toLowerCase()));
  }
  for (const m of texto.matchAll(/\b(?:Sentencia\s+Constitucional(?:\s+Plurinacional)?|SCP)\s*(?:N[°º.]*\s*)?(\d+[/\-]\d{2,4}(?:-[A-Z0-9]+)?)/gi)) {
    poner(`SCP ${m[1]}`, web.includes(m[1].toLowerCase()));
  }
  if (/pacto\s+de\s+san\s+jos[eé]|\bcadh\b/i.test(texto)) poner('Pacto de San José (CADH)', true);
  if (/corte\s+interamericana|corte\s+idh/i.test(texto)) poner('Corte IDH', true);
  if (/\bCPE\b|constituci[oó]n\s+pol[ií]tica\s+del\s+estado/i.test(texto)) poner('CPE Bolivia', true);
  return [...salida.values()];
}
