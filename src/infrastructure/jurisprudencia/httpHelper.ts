import { fetch as fetchTauri } from '@tauri-apps/plugin-http';

const EN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const EN_NAVEGADOR = typeof window !== 'undefined';

export async function fetchHttp(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);

  // El servidor de TSJ Génesis valida que la petición provenga del dominio oficial https://genesis.tsj.bo
  if (url.includes('apigenesis.tsj.bo')) {
    headers.set('Origin', 'https://genesis.tsj.bo');
    headers.set('Referer', 'https://genesis.tsj.bo/');
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
  }

  const opciones: RequestInit = {
    ...init,
    headers,
  };

  // En Tauri usamos el cliente de red nativo (Rust reqwest) que no está atado a las restricciones CORS del navegador
  if (EN_TAURI) {
    try {
      const respuesta = await fetchTauri(url, opciones);
      // Si por alguna razón la petición en Tauri devolviese 403 de origen, intentamos por proxy local si está disponible
      if (respuesta.status === 403 && url.includes('apigenesis.tsj.bo')) {
        const proxyUrl = url.replace('https://apigenesis.tsj.bo', '/api-tsj');
        return await fetch(proxyUrl, opciones);
      }
      return respuesta;
    } catch {
      // Fallback a fetch si ocurre error IPC
    }
  }

  // En modo desarrollo en navegador web (Vite), usamos el proxy para saltar CORS del navegador
  if (EN_NAVEGADOR && url.includes('apigenesis.tsj.bo')) {
    const proxyUrl = url.replace('https://apigenesis.tsj.bo', '/api-tsj');
    return await fetch(proxyUrl, opciones);
  }

  return await fetch(url, opciones);
}
