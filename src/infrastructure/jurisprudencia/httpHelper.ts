import { fetch as fetchTauri } from '@tauri-apps/plugin-http';

const EN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const EN_NAVEGADOR = typeof window !== 'undefined';

export async function fetchHttp(url: string, init?: RequestInit, timeoutMs = 25000): Promise<Response> {
  const headers = new Headers(init?.headers);

  // Inyectar cabeceras requeridas para TSJ Génesis
  if (url.includes('apigenesis.tsj.bo')) {
    headers.set('Origin', 'https://genesis.tsj.bo');
    headers.set('Referer', 'https://genesis.tsj.bo/');
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
  }

  // Controlador de timeout para evitar peticiones colgadas indefinidas (Q11)
  const signal = init?.signal ?? (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
    ? AbortSignal.timeout(timeoutMs)
    : undefined);

  const opciones: RequestInit = {
    ...init,
    headers,
    signal,
  };

  // En Tauri usamos el cliente Rust nativo (reqwest) con unsafe-headers
  if (EN_TAURI) {
    try {
      return await fetchTauri(url, opciones);
    } catch (err) {
      throw new Error(`Error de conexión con el servidor judicial: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // En modo desarrollo en navegador web Vite (sin Tauri), usar proxy dev para evitar CORS
  if (EN_NAVEGADOR && url.includes('apigenesis.tsj.bo')) {
    const proxyUrl = url.replace('https://apigenesis.tsj.bo', '/api-tsj');
    return await fetch(proxyUrl, opciones);
  }

  return await fetch(url, opciones);
}
