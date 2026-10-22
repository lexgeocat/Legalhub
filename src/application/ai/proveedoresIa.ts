// src/application/ai/proveedoresIa.ts
import { fetch as fetchTauri } from '@tauri-apps/plugin-http';
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
    placeholderClave: 'API key de ollama.com/settings/keys'
  },
  opencode: {
    id: 'opencode',
    nombre: 'OpenCode Console',
    etiqueta: 'Free / De pago',
    descripcion:
      'Modelos de OpenCode Zen (https://opencode.ai/console). Incluye modelos "-free" (DeepSeek Flash, GLM Flash, MiniMax, etc.) y modelos avanzados. Si tu cuenta no tiene saldo en OpenCode, te recomendamos usar Ollama Cloud o Google Gemini que son 100% gratuitos.',
    urlClave: 'https://opencode.ai/console',
    claveParaListar: false,
    placeholderClave: 'API key de OpenCode Console'
  },
  gemini: {
    id: 'gemini',
    nombre: 'Google Gemini',
    etiqueta: 'Capa gratis',
    descripcion: 'Google AI Studio ofrece una capa gratuita con límites por minuto y por día.',
    urlClave: 'https://aistudio.google.com/app/apikey',
    claveParaListar: true,
    placeholderClave: 'AIza...'
  },
  groq: {
    id: 'groq',
    nombre: 'Groq Cloud',
    etiqueta: 'Capa gratis',
    descripcion: 'Inferencia muy rápida con capa gratuita limitada.',
    urlClave: 'https://console.groq.com/keys',
    claveParaListar: true,
    placeholderClave: 'gsk_...'
  },
  claude: {
    id: 'claude',
    nombre: 'Anthropic Claude',
    etiqueta: 'De pago',
    descripcion: 'Requiere saldo en la consola de Anthropic.',
    urlClave: 'https://console.anthropic.com/settings/keys',
    claveParaListar: true,
    placeholderClave: 'sk-ant-...'
  }
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
  temperatura: number;
}

type CampoTexto = Exclude<keyof ConfigIa, 'proveedorActivo' | 'temperatura'>;

/** Campos de configuración (clave y modelo) de cada proveedor */
export const CAMPOS_IA: Record<ProveedorIaId, { clave: CampoTexto; modelo: CampoTexto }> = {
  ollama: { clave: 'ollamaApiKey', modelo: 'ollamaModelo' },
  opencode: { clave: 'opencodeApiKey', modelo: 'opencodeModelo' },
  gemini: { clave: 'geminiApiKey', modelo: 'geminiModelo' },
  groq: { clave: 'groqApiKey', modelo: 'groqModelo' },
  claude: { clave: 'claudeApiKey', modelo: 'claudeModelo' }
};

const CLAVE_STORAGE = 'legalhub_ia_config';
const URL_OLLAMA_CLOUD = 'https://ollama.com';

export const CONFIG_IA_DEFECTO: ConfigIa = {
  proveedorActivo: 'ollama',
  ollamaUrl: URL_OLLAMA_CLOUD,
  ollamaApiKey: '',
  ollamaModelo: '',
  opencodeApiKey: '',
  opencodeModelo: '',
  geminiApiKey: '',
  geminiModelo: '',
  groqApiKey: '',
  groqModelo: '',
  claudeApiKey: '',
  claudeModelo: '',
  temperatura: 0.2
};

export function obtenerConfigIa(): ConfigIa {
  try {
    const raw = localStorage.getItem(CLAVE_STORAGE);
    if (!raw) return { ...CONFIG_IA_DEFECTO };
    const cfg: ConfigIa = { ...CONFIG_IA_DEFECTO, ...JSON.parse(raw) };
    // Versiones anteriores guardaban localhost o api.ollama.com (que no existe) por defecto
    if (!cfg.ollamaUrl.trim() || /localhost:11434|api\.ollama\.com/.test(cfg.ollamaUrl)) {
      cfg.ollamaUrl = URL_OLLAMA_CLOUD;
    }
    if (!PROVEEDORES_IA[cfg.proveedorActivo]) cfg.proveedorActivo = 'ollama';
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

// ───────────────────────── HTTP ─────────────────────────

const EN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * En la app de escritorio las peticiones salen desde Rust (plugin HTTP), así no las bloquea
 * el CORS del webview: ollama.com, por ejemplo, no envía cabeceras CORS.
 */
function http(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const opciones: RequestInit = { ...init, signal: AbortSignal.timeout(timeoutMs) };
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
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return 'El servidor tardó demasiado en responder.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return EN_TAURI
      ? 'No hay conexión con el servidor. Revisa la URL y tu internet.'
      : 'El navegador bloqueó la petición (CORS). Abre Legal-Hub como app de escritorio (pnpm tauri dev).';
  }
  if (/Insufficient account funds|insufficient_quota/i.test(msg)) {
    return 'Saldo insuficiente en tu cuenta (HTTP 402 Insufficient account funds). Necesitas recargar fondos en opencode.ai/console para usar modelos de pago, o usar Ollama Cloud o Google Gemini que son 100% gratuitos.';
  }
  if (/FreeTierError|free tier can only be used from within/i.test(msg)) {
    return 'OpenCode bloquea los modelos "-free" para llamadas API externas (HTTP 403 FreeTierError: solo funcionan en la app de escritorio de OpenCode). Para usar IA gratuita por API directamente en Legal-Hub, te recomendamos cambiar a Ollama Cloud (minimax-m3.1-flash) o Google Gemini.';
  }
  return msg;
}

function normalizarUrlOllama(url: string): string {
  return (url.trim() || URL_OLLAMA_CLOUD).replace(/\/+$/, '').replace(/\/(api|v1)$/, '');
}

function cabecerasBearer(clave: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (clave.trim()) h.Authorization = `Bearer ${clave.trim()}`;
  return h;
}

function cabecerasOpenCode(clave: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'opencode/1.18.32',
    'x-opencode-client': 'cli'
  };
  if (clave.trim()) h.Authorization = `Bearer ${clave.trim()}`;
  return h;
}

function cabecerasClaude(clave: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': clave.trim(),
    'anthropic-version': '2023-06-01',
    // Necesaria solo si se llama desde el navegador; inocua desde Rust
    'anthropic-dangerous-direct-browser-access': 'true'
  };
}

/**
 * Filtra los modelos compatibles de OpenCode para el endpoint de chat/completions.
 * Incluye todos los modelos "-free" (DeepSeek, GLM, MiniMax, Nemotron, etc.) y los modelos de chat de consola.
 */
function opencodeCompatible(id: string): boolean {
  if (id === 'test' || id === 'big-pickle' || /-backup$/.test(id)) return false;
  // Permitir explícitamente todos los modelos -free de OpenCode
  if (/-free$/.test(id)) return true;
  // Permitir los modelos de chat reconocidos de OpenCode
  if (/^(deepseek-|glm-|kimi-|minimax-|mistral-|qwen|gemini-|gpt-|claude-)/.test(id)) return true;
  return false;
}

// ───────────────────────── Listado de modelos ─────────────────────────

/** Lista los modelos reales que ofrece el proveedor con la configuración dada. Lanza Error si falla. */
export async function listarModelos(proveedor: ProveedorIaId, cfg: ConfigIa): Promise<string[]> {
  const clave = (cfg[CAMPOS_IA[proveedor].clave] as string).trim();
  if (PROVEEDORES_IA[proveedor].claveParaListar && !clave) {
    throw new Error('Pega tu API key para ver tus modelos.');
  }

  try {
    let modelos: string[] = [];

    if (proveedor === 'ollama') {
      const base = normalizarUrlOllama(cfg.ollamaUrl);
      const esCloud = /ollama\.com/i.test(base);
      let resp = await http(`${base}/api/tags`, { headers: cabecerasBearer(clave) });
      if (resp.ok) {
        const data = await resp.json();
        modelos = (data.models ?? []).map((m: { name?: string; model?: string }) => m.name ?? m.model ?? '');
      } else {
        resp = await http(`${base}/v1/models`, { headers: cabecerasBearer(clave) });
        if (!resp.ok) throw new Error(await leerError(resp));
        const data = await resp.json();
        modelos = (data.data ?? []).map((m: { id: string }) => m.id);
      }

      // En Ollama Cloud, verificar en vivo cada modelo y conservar ÚNICAMENTE los que responden con 200 OK.
      // Descarta modelos con cuota agotada (HTTP 429), planes restringidos (HTTP 402) o modelos de sistema (HTTP 400).
      if (esCloud && modelos.length > 0) {
        // Priorizar modelos conocidos y rápidos para agilizar la prueba
        const prioridad = ['minimax-m3.1-flash', 'gpt-oss:20b', 'gpt-oss:120b', 'nemotron-3-nano:30b'];
        const ordenados = [
          ...prioridad.filter((p) => modelos.includes(p)),
          ...modelos.filter((m) => !prioridad.includes(m))
        ];

        const verificarModelo = async (id: string): Promise<boolean> => {
          try {
            const probe = await http(
              `${base}/v1/chat/completions`,
              {
                method: 'POST',
                headers: cabecerasBearer(clave),
                body: JSON.stringify({
                  model: id,
                  messages: [{ role: 'user', content: 'ping' }],
                  max_tokens: 1
                })
              },
              4500
            );
            return probe.ok; // Solo pasa si el servidor responde 200 OK
          } catch {
            return false;
          }
        };

        const validos: string[] = [];
        // Verificamos en lotes de 3 para evitar saturar la tasa concurrente
        for (let i = 0; i < ordenados.length; i += 3) {
          const lote = ordenados.slice(i, i + 3);
          const estados = await Promise.all(lote.map(verificarModelo));
          for (let j = 0; j < lote.length; j++) {
            if (estados[j]) validos.push(lote[j]);
          }
        }

        if (validos.length > 0) {
          modelos = validos;
        } else {
          throw new Error(
            'Ningún modelo de Ollama Cloud respondió exitosamente. Los modelos de tu cuenta alcanzaron el límite de cuota (HTTP 429) o requieren suscripción Pro (HTTP 402).'
          );
        }
      }
    }

    if (proveedor === 'opencode') {
      const resp = await http('https://opencode.ai/zen/v1/models', { headers: cabecerasOpenCode(clave) });
      if (!resp.ok) throw new Error(await leerError(resp));
      const data = await resp.json();
      const todos = (data.data ?? []).map((m: { id: string }) => m.id).filter(opencodeCompatible);

      // Ordenar: primero los modelos -free, luego los demás en orden alfabético
      modelos = todos.sort((a: string, b: string) => {
        const aFree = a.endsWith('-free');
        const bFree = b.endsWith('-free');
        if (aFree && !bFree) return -1;
        if (!aFree && bFree) return 1;
        return a.localeCompare(b);
      });
    }

    if (proveedor === 'groq') {
      const resp = await http('https://api.groq.com/openai/v1/models', { headers: cabecerasBearer(clave) });
      if (!resp.ok) throw new Error(await leerError(resp));
      const data = await resp.json();
      modelos = (data.data ?? [])
        .filter((m: { active?: boolean }) => m.active !== false)
        .map((m: { id: string }) => m.id)
        .filter((id: string) => !/whisper|tts|guard|orpheus|distil-whisper/i.test(id));
    }

    if (proveedor === 'gemini') {
      const resp = await http(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(clave)}`
      );
      if (!resp.ok) throw new Error(await leerError(resp));
      const data = await resp.json();
      modelos = (data.models ?? [])
        .filter((m: { supportedGenerationMethods?: string[] }) =>
          m.supportedGenerationMethods?.includes('generateContent')
        )
        .map((m: { name: string }) => m.name.replace(/^models\//, ''))
        .filter((id: string) => !/embedding|aqa|imagen|tts|image/i.test(id));
    }

    if (proveedor === 'claude') {
      const resp = await http('https://api.anthropic.com/v1/models?limit=100', { headers: cabecerasClaude(clave) });
      if (!resp.ok) throw new Error(await leerError(resp));
      const data = await resp.json();
      modelos = (data.data ?? []).map((m: { id: string }) => m.id);
    }

    modelos = Array.from(new Set(modelos.filter(Boolean)));
    if (modelos.length === 0) throw new Error('El servidor respondió, pero no devolvió modelos.');
    return modelos;
  } catch (err) {
    throw new Error(describirFallo(err));
  }
}

// ───────────────────────── Generación ─────────────────────────

interface Mensajes {
  sistema: string;
  usuario: string;
  maxTokens: number;
}

async function generarTexto(proveedor: ProveedorIaId, cfg: ConfigIa, m: Mensajes): Promise<string> {
  const clave = (cfg[CAMPOS_IA[proveedor].clave] as string).trim();
  const modelo = (cfg[CAMPOS_IA[proveedor].modelo] as string).trim();
  const temperatura = cfg.temperatura ?? 0.2;
  const nombre = PROVEEDORES_IA[proveedor].nombre;

  if (!modelo) throw new Error(`Elige un modelo de ${nombre} en la configuración de IA.`);
  const necesitaClave =
    proveedor !== 'ollama' || normalizarUrlOllama(cfg.ollamaUrl).includes('ollama.com');
  if (necesitaClave && !clave) throw new Error(`Falta la API key de ${nombre}.`);

  const chatOpenAi = async (url: string) => {
    const resp = await http(
      url,
      {
        method: 'POST',
        headers: cabecerasBearer(clave),
        body: JSON.stringify({
          model: modelo,
          messages: [
            { role: 'system', content: m.sistema },
            { role: 'user', content: m.usuario }
          ],
          temperature: temperatura,
          max_tokens: m.maxTokens
        })
      },
      120000
    );
    if (!resp.ok) throw new Error(await leerError(resp));
    const data = await resp.json();
    return (data.choices?.[0]?.message?.content as string) ?? '';
  };

  try {
    let texto = '';

    if (proveedor === 'ollama') {
      const base = normalizarUrlOllama(cfg.ollamaUrl);
      // Para modelos con razonamiento profundo (deepseek, gpt-oss, qwen, minimax),
      // num_predict no debe ser inferior a 150 para no cortar el bloque de pensamiento
      const minPredict = Math.max(m.maxTokens, 150);

      const resp = await http(
        `${base}/api/chat`,
        {
          method: 'POST',
          headers: cabecerasBearer(clave),
          body: JSON.stringify({
            model: modelo,
            messages: [
              { role: 'system', content: m.sistema },
              { role: 'user', content: m.usuario }
            ],
            stream: false,
            options: { temperature: temperatura, num_predict: minPredict }
          })
        },
        180000
      );

      if (!resp.ok) {
        // En Ollama Cloud, intentar /v1/chat/completions si /api/chat responde error
        const respV1 = await http(
          `${base}/v1/chat/completions`,
          {
            method: 'POST',
            headers: cabecerasBearer(clave),
            body: JSON.stringify({
              model: modelo,
              messages: [
                { role: 'system', content: m.sistema },
                { role: 'user', content: m.usuario }
              ],
              temperature: temperatura,
              max_tokens: minPredict
            })
          },
          180000
        );

        if (respV1.ok) {
          const dataV1 = await respV1.json();
          texto =
            (dataV1.choices?.[0]?.message?.content as string) ||
            (dataV1.choices?.[0]?.message?.reasoning_content as string) ||
            '';
        } else {
          throw new Error(await leerError(resp));
        }
      } else {
        const data = await resp.json();
        // Modelos de razonamiento pueden responder en content, thinking o reasoning
        texto =
          (data.message?.content as string) ||
          (data.message?.thinking as string) ||
          (data.message?.reasoning as string) ||
          (data.response as string) ||
          (data.choices?.[0]?.message?.content as string) ||
          '';
      }
    }

    if (proveedor === 'opencode') {
      const resp = await http(
        'https://opencode.ai/zen/v1/chat/completions',
        {
          method: 'POST',
          headers: cabecerasOpenCode(clave),
          body: JSON.stringify({
            model: modelo,
            messages: [
              { role: 'system', content: m.sistema },
              { role: 'user', content: m.usuario }
            ],
            temperature: temperatura,
            max_tokens: m.maxTokens
          })
        },
        120000
      );
      if (!resp.ok) throw new Error(await leerError(resp));
      const data = await resp.json();
      texto = (data.choices?.[0]?.message?.content as string) ?? '';
    }

    if (proveedor === 'groq') {
      texto = await chatOpenAi('https://api.groq.com/openai/v1/chat/completions');
    }

    if (proveedor === 'gemini') {
      const resp = await http(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(clave)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: m.sistema }] },
            contents: [{ role: 'user', parts: [{ text: m.usuario }] }],
            generationConfig: { temperature: temperatura, maxOutputTokens: m.maxTokens }
          })
        },
        120000
      );
      if (!resp.ok) throw new Error(await leerError(resp));
      const data = await resp.json();
      texto = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
    }

    if (proveedor === 'claude') {
      const resp = await http(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: cabecerasClaude(clave),
          body: JSON.stringify({
            model: modelo,
            max_tokens: m.maxTokens,
            temperature: temperatura,
            system: m.sistema,
            messages: [{ role: 'user', content: m.usuario }]
          })
        },
        120000
      );
      if (!resp.ok) throw new Error(await leerError(resp));
      const data = await resp.json();
      texto = (data.content ?? [])
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('');
    }

    if (!texto.trim()) throw new Error(`${nombre} respondió sin texto.`);
    return texto;
  } catch (err) {
    throw new Error(`${nombre} (${modelo}): ${describirFallo(err)}`);
  }
}

/** Prueba real: lista modelos y, si hay modelo elegido, hace una generación mínima (valida la API key). */
export async function probarConexionProveedor(
  proveedor: ProveedorIaId,
  cfg: ConfigIa
): Promise<{ ok: boolean; mensaje: string; modelos?: string[] }> {
  let modelos: string[];
  try {
    modelos = await listarModelos(proveedor, cfg);
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : String(err) };
  }

  const modelo = (cfg[CAMPOS_IA[proveedor].modelo] as string).trim();
  if (!modelo) {
    return { ok: true, mensaje: `${modelos.length} modelos disponibles. Elige uno y vuelve a probar.`, modelos };
  }

  try {
    const salida = await generarTexto(proveedor, cfg, {
      sistema: 'Responde de forma muy concisa.',
      usuario: 'Responde únicamente con la palabra OK.',
      maxTokens: 150
    });
    const detalle = salida.trim().slice(0, 30);
    return {
      ok: true,
      mensaje: `Conectado: ${modelo} respondió exitosamente${detalle ? ` ("${detalle}")` : ''}.`,
      modelos
    };
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : String(err), modelos };
  }
}

// ───────────────────────── Redacción Lex AI ─────────────────────────

export interface ArticuloContexto {
  leyNombre: string;
  numero: string;
  titulo?: string;
  texto: string;
}

export interface ParametrosRedaccion {
  tipoEscrito: string;
  tono: string;
  tribunal?: string;
  instrucciones: string;
  articulosContexto: ArticuloContexto[];
  leyesSeleccionadasNombres: string[];
}

export interface ResultadoRedaccion {
  texto: string;
  citasDetectadas: string[];
  proveedorUsado: string;
  modeloUsado: string;
  tiempoMs: number;
}

/** Construye el prompt legal procesal con el grounding de NotebookLM */
function construirPromptLegal(params: ParametrosRedaccion): { systemPrompt: string; userPrompt: string } {
  const { tipoEscrito, tono, tribunal, instrucciones, articulosContexto, leyesSeleccionadasNombres } = params;

  let bloqueLeyes = '';
  if (articulosContexto.length > 0) {
    bloqueLeyes = articulosContexto
      .map(
        (a, idx) =>
          `[FUENTE JURÍDICA ${idx + 1}]: ${a.leyNombre} · Artículo ${a.numero}${a.titulo ? ` (${a.titulo})` : ''}:\n«${a.texto}»`
      )
      .join('\n\n');
  } else if (leyesSeleccionadasNombres.length > 0) {
    bloqueLeyes = `Leyes seleccionadas por el despacho: ${leyesSeleccionadasNombres.join(', ')}. (Fundamenta con base en estas normas sustantivas y adjetivas).`;
  } else {
    bloqueLeyes = 'Utiliza la legislación y códigos procesales pertinentes con fundamentación doctrinal estricta.';
  }

  const systemPrompt = `Eres "Lex AI", un Asistente Senior de Redacción Procesal y Doctrina Jurídica de alto prestigio para despachos de abogados (estilo Harvey AI y Clio).
Tu objetivo es redactar un documento jurídico formal, pulcro, persuasivo y procesalmente impecable.

REGLAS DE REDACCIÓN GROUNDED (Estilo NotebookLM Jurídico):
1. DEBES FUNDAMENTAR el escrito usando ESTRICTAMENTE las leyes y artículos proporcionados en las fuentes.
2. Cada vez que invoques un precepto normativo, indícalo expresamente (ejemplo: «conforme prescribe el Art. 568 del Código Civil...»).
3. Estructura el escrito según la técnica procesal correspondiente:
   - SUMA / EPÍGRAFE: Identificación del tipo de escrito.
   - AUTORIDAD: Designación del juzgado o tribunal (${tribunal || 'Señor Juez Público en Materia Civil y Comercial'}).
   - GENERALES DE LEY: Identificación procesal de las partes.
   - HECHOS / ANTECEDENTES: Relación cronológica y circunstanciada.
   - FUNDAMENTACIÓN JURÍDICA: Subsunción de los hechos en el derecho invocando las fuentes citadas.
   - PETITORIO: Pretensiones claras, precisas y congruentes.
   - OTROSÍES: Domicilio procesal, prueba documental, patrocinios.
4. Tono procesal solicitado: ${tono}.
5. No inventes artículos ni leyes no existentes. Respeta la literalidad y el espíritu de las fuentes.
6. No inventes nombres, cédulas ni domicilios de las partes: si no se proporcionan, deja marcadores como [NOMBRE DEL DEMANDANTE].
7. FORMATO LIMPIO Y PRESENTACIÓN PROCESAL (IMPRESCINDIBLE):
   - ESTRICTAMENTE PROHIBIDO usar etiquetas HTML (<br>, &nbsp;, <p>, <div>, etc.) ni entidades web.
   - Utiliza saltos de línea estándar (\n\n) para separar párrafos o cláusulas.
   - Para las líneas de firmas al final, utiliza texto limpio (ej: ______________________) sin etiquetas html.`;

  const userPrompt = `TIPO DE ESCRITO SOLICITADO: ${tipoEscrito.toUpperCase()}
${tribunal ? `DIRIGIDO A: ${tribunal}` : ''}

FUENTES DE DERECHO SELECCIONADAS (GROUNDING):
${bloqueLeyes}

HECHOS E INSTRUCCIONES ESPECÍFICAS DEL CASO:
${instrucciones}

Por favor, redacta el escrito legal íntegro, listo para impresión y firma.`;

  return { systemPrompt, userPrompt };
}

/** Redacta con el proveedor activo. Si falla, lanza el error real (no se genera texto de relleno). */
export async function redactarConLexAi(params: ParametrosRedaccion): Promise<ResultadoRedaccion> {
  const inicio = Date.now();
  const cfg = obtenerConfigIa();
  const proveedor = cfg.proveedorActivo;
  const { systemPrompt, userPrompt } = construirPromptLegal(params);

  const texto = await generarTexto(proveedor, cfg, { sistema: systemPrompt, usuario: userPrompt, maxTokens: 4096 });

  return {
    texto,
    citasDetectadas: extraerCitas(texto, params.articulosContexto),
    proveedorUsado: PROVEEDORES_IA[proveedor].nombre,
    modeloUsado: (cfg[CAMPOS_IA[proveedor].modelo] as string) || 'defecto',
    tiempoMs: Date.now() - inicio
  };
}

export interface MensajeChatLex {
  id: string;
  rol: 'usuario' | 'asistente';
  texto: string;
  tiempoMs?: number;
  modeloUsado?: string;
  proveedorUsado?: string;
  citasDetectadas?: string[];
  fuentesConsultadas?: ArticuloContexto[];
  fuentesWeb?: FuenteWebJuridica[];
  ambitoUsado?: AmbitoJuridico;
  terminoWebBuscado?: string;
  creadoEn: string;
}

export interface ParametrosChatLexAi {
  prompt: string;
  historial?: { rol: 'usuario' | 'asistente'; texto: string }[];
  articulosContexto: ArticuloContexto[];
  leyesSeleccionadasNombres: string[];
  fuentesWeb?: FuenteWebJuridica[];
  ambito?: AmbitoJuridico;
}

/** Interacción directa con Lex AI guiada por prompts, con investigación de leyes y jurisprudencia web */
export async function consultarLexAi(params: ParametrosChatLexAi): Promise<ResultadoRedaccion> {
  const inicio = Date.now();
  const cfg = obtenerConfigIa();
  const proveedor = cfg.proveedorActivo;

  const {
    prompt,
    historial = [],
    articulosContexto,
    leyesSeleccionadasNombres,
    fuentesWeb = [],
    ambito = 'bolivia'
  } = params;

  let bloqueLeyes = '';
  if (articulosContexto.length > 0) {
    bloqueLeyes = articulosContexto
      .map(
        (a, idx) =>
          `[FUENTE JURÍDICA ${idx + 1}]: ${a.leyNombre} · Artículo ${a.numero}${a.titulo ? ` (${a.titulo})` : ''}:\n«${a.texto}»`
      )
      .join('\n\n');
  } else if (leyesSeleccionadasNombres.length > 0) {
    bloqueLeyes = `Leyes activas en el contexto: ${leyesSeleccionadasNombres.join(', ')}.`;
  }

  const systemPrompt = `Eres "Lex AI", Asistente Senior de Inteligencia, Jurisprudencia y Redacción Jurídica para despachos y abogados litigantes.
Tu objetivo es responder, consultar doctrina, investigar jurisprudencia y redactar directamente según las instrucciones del usuario mediante prompts, con fundamentación legal estricta y rigor procesal.

DIRECTRICES DE INVESTIGACIÓN JURÍDICA Y ORDENAMIENTO:
1. ORDENAMIENTO JURÍDICO APLICABLE:
   - El ordenamiento jurídico preferente por defecto es el del Estado Plurinacional de Bolivia (Constitución Política del Estado, Código Civil, Código Procesal Civil, Código Penal, Código Procesal Penal, etc.).
   - Si el usuario te hace una pregunta general sobre una institución legal o procesal sin especificar país (ej: "¿Cuáles son los plazos para contestar una demanda?"), responde y fundamenta conforme al ordenamiento jurídico boliviano y aclara de forma elegante: «(Fundamentado conforme a la legislación procesal boliviana. Si requiere el análisis para otro país como Argentina, España, México o Colombia, indíquemelo con gusto)».
   - Si el usuario te especifica un país o legislación comparada, subsume el análisis estrictamente en el derecho de ese país.
2. JURISPRUDENCIA VINCULANTE:
   - Si dispones de fuentes web o de jurisprudencia en el contexto, cita expresamente los precedentes vinculantes (ej: Auto Supremo N° ..., Sala Civil del TSJ, o Sentencia Constitucional Plurinacional SCP ...).
3. TRATADOS INTERNACIONALES Y CONTROL DE CONVENCIONALIDAD:
   - Aplica el Bloque de Constitucionalidad (Art. 410.II y Art. 256 de la CPE de Bolivia).
   - Invoca los instrumentos internacionales de derechos humanos pertinentes (Pacto de San José de Costa Rica - CADH, sentencias u opiniones consultivas de la Corte Interamericana de Derechos Humanos - Corte IDH, Convenios OIT, etc.).
4. REDACCIÓN Y CONSULTAS:
   - Si el usuario te pide redactar un escrito procesal (demanda, memorial, contestación, recurso, contrato, etc.), redáctalo completo, formal, estructurado y listo para firma.
   - Si el usuario te hace una consulta de doctrina o jurisprudencia, sé directo, conciso, riguroso y cita las fuentes con precisión.
5. FORMATO LIMPIO Y PRESENTACIÓN JURÍDICA:
   - ESTRICTAMENTE PROHIBIDO usar etiquetas HTML (<br>, &nbsp;, <p>, <div>, etc.) ni entidades web.
   - Utiliza saltos de línea estándar (\n\n) para separar párrafos o cláusulas.
   - Para las líneas de firmas, usa líneas de texto limpio (ej: ______________________) sin tags HTML ni &nbsp;.
   - No satures con asteriscos innecesarios; usa negrita solo para títulos o nombres de cláusulas.`;

  let promptUsuarioConContexto = '';
  if (bloqueLeyes) {
    promptUsuarioConContexto += `--- FUENTES DE DERECHO EN CONTEXTO (LEYES) ---\n${bloqueLeyes}\n-----------------------------------------------\n\n`;
  }

  if (fuentesWeb.length > 0) {
    promptUsuarioConContexto += `--- JURISPRUDENCIA, TRATADOS Y FUENTES WEB EN VIVO (${ambito.toUpperCase()}) ---\n`;
    for (const [idx, f] of fuentesWeb.entries()) {
      promptUsuarioConContexto += `[DOC WEB ${idx + 1} - ${f.tipo.toUpperCase()}]: ${f.titulo}\nEnlace / URL: ${f.url}\nExtracto / Fundamento:\n«${f.resumen}»\n\n`;
    }
    promptUsuarioConContexto += `--------------------------------------------------------------------\n\n`;
  }

  if (historial.length > 0) {
    promptUsuarioConContexto += '--- CONVERSACIÓN PREVIA ---\n';
    for (const h of historial.slice(-6)) {
      promptUsuarioConContexto += `${h.rol === 'usuario' ? 'Abogado' : 'Lex AI'}: ${h.texto}\n\n`;
    }
    promptUsuarioConContexto += '---------------------------\n\n';
  }

  promptUsuarioConContexto += `INSTRUCCIÓN / PROMPT DEL ABOGADO:\n${prompt}`;

  const texto = await generarTexto(proveedor, cfg, {
    sistema: systemPrompt,
    usuario: promptUsuarioConContexto,
    maxTokens: 4096
  });

  return {
    texto,
    citasDetectadas: extraerCitas(texto, articulosContexto),
    proveedorUsado: PROVEEDORES_IA[proveedor].nombre,
    modeloUsado: (cfg[CAMPOS_IA[proveedor].modelo] as string) || 'defecto',
    tiempoMs: Date.now() - inicio
  };
}

/** Extrae citas legales, jurisprudencia y tratados encontrados en el texto */
function extraerCitas(texto: string, fuentes: ArticuloContexto[]): string[] {
  const citas = new Set<string>();

  // Citas extraídas de las fuentes provistas
  for (const f of fuentes) {
    if (texto.toLowerCase().includes(`art. ${f.numero}`) || texto.toLowerCase().includes(`artículo ${f.numero}`)) {
      citas.add(`Art. ${f.numero} ${f.leyNombre}`);
    }
  }

  // Preceptos jurisprudenciales bolivianos (Autos Supremos, SCPs)
  const regexAs = /(?:Auto\s+Supremo|A\.?S\.?)\s*(?:N[°º.]*\s*)?(\d+[\/\-]\d+)/gi;
  let matchAs;
  while ((matchAs = regexAs.exec(texto)) !== null) {
    if (citas.size < 10) citas.add(`Auto Supremo ${matchAs[1]}`);
  }

  const regexScp = /(?:Sentencia\s+Constitucional(?:\s+Plurinacional)?|SCP)\s*(?:N[°º.]*\s*)?(\d+[\/\-]\d+(?:-[A-Z0-9]+)?)/gi;
  let matchScp;
  while ((matchScp = regexScp.exec(texto)) !== null) {
    if (citas.size < 10) citas.add(`SCP ${matchScp[1]}`);
  }

  // Tratados y cortes comunes
  if (/pacto\s+de\s+san\s+jos[eé]|cadh/i.test(texto)) citas.add('Pacto de San José (CADH)');
  if (/corte\s+interamericana|corte\s+idh/i.test(texto)) citas.add('Corte IDH');
  if (/cpe|constituci[oó]n\s+pol[íi]tica\s+del\s+estado/i.test(texto)) citas.add('CPE Bolivia');

  // Expresiones regulares para artículos comunes
  const regex = /(?:Arts?\.?|Art[íi]culos?)\s*(\d{1,5}(?:\s*(?:bis|ter))?)/gi;
  let match;
  while ((match = regex.exec(texto)) !== null) {
    if (citas.size < 12) {
      citas.add(`Art. ${match[1]}`);
    }
  }

  return Array.from(citas);
}
