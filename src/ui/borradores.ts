const PREFIJO = 'lh:borrador:';
const VIGENCIA_MS = 14 * 24 * 60 * 60 * 1000;

export interface Borrador<T> { ts: number; datos: T }

export function leerBorrador<T>(clave: string): Borrador<T> | null {
    try {
        const crudo = localStorage.getItem(PREFIJO + clave);
        if (!crudo) return null;
        const s = JSON.parse(crudo) as { ts?: unknown; datos?: T };
        if (typeof s.ts !== 'number' || s.datos === undefined || Date.now() - s.ts > VIGENCIA_MS) {
            localStorage.removeItem(PREFIJO + clave);
            return null;
        }
        return { ts: s.ts, datos: s.datos };
    } catch {
        return null;
    }
}

export function guardarBorrador<T>(clave: string, datos: T): void {
    try {
        localStorage.setItem(PREFIJO + clave, JSON.stringify({ ts: Date.now(), datos }));
    } catch {
        /* sin almacenamiento o sin cuota: el borrador es opcional */
    }
}

export function borrarBorrador(clave: string): void {
    try {
        localStorage.removeItem(PREFIJO + clave);
    } catch {
        /* sin efecto */
    }
}

/** Elimina los borradores caducados (se llama al iniciar la app). */
export function purgarVencidos(): void {
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (!k?.startsWith(PREFIJO)) continue;
            try {
                const ts = (JSON.parse(localStorage.getItem(k) ?? '{}') as { ts?: unknown }).ts;
                if (typeof ts !== 'number' || Date.now() - ts > VIGENCIA_MS) localStorage.removeItem(k);
            } catch {
                localStorage.removeItem(k);
            }
        }
    } catch {
        /* sin efecto */
    }
}