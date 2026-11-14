// src/ui/_core/guardiaCierre.ts
/**
 * Guardián de Cierre Seguro del Sistema para LEGAL-HUB.
 * Rastrea en tiempo real:
 *  1. Tareas y procesos críticos en ejecución (guardar, generar documento, respaldar, restaurar).
 *  2. Trabajo y cambios pendientes de guardar (editores de escritos, documentos, datos de expediente).
 * Intercepta los intentos de cierre (botón X, Alt+F4) y coordina la ventana emergente de confirmación.
 */

export interface TareaActiva {
    id: string;
    descripcion: string;
}

export interface BloqueoCambio {
    id: string;
    descripcion: string;
}

export interface EstadoCierreSistema {
    ocupado: boolean;
    conCambios: boolean;
    tareas: TareaActiva[];
    cambios: BloqueoCambio[];
}

const tareasActivas = new Map<string, string>();
const cambiosPendientes = new Map<string, string>();
const oyentesCierre = new Set<(solicitado: boolean, estado: EstadoCierreSistema) => void>();
const desuscribirCloseRequested = new Set<() => void>();
let cierreSolicitado = false;
let salidaAutorizada = false;

export const estaSalidaAutorizada = (): boolean => salidaAutorizada;

/** Registra el `unlisten` de `onCloseRequested` para poder desactivar el interceptor antes de cerrar la ventana. */
export function registrarInterceptorCierre(unlisten: () => void): () => void {
    desuscribirCloseRequested.add(unlisten);
    return () => {
        desuscribirCloseRequested.delete(unlisten);
    };
}

export function obtenerEstadoCierre(): EstadoCierreSistema {
    return {
        ocupado: tareasActivas.size > 0,
        conCambios: cambiosPendientes.size > 0,
        tareas: Array.from(tareasActivas.entries()).map(([id, descripcion]) => ({ id, descripcion })),
        cambios: Array.from(cambiosPendientes.entries()).map(([id, descripcion]) => ({ id, descripcion })),
    };
}

function notificar() {
    const estado = obtenerEstadoCierre();
    oyentesCierre.forEach((fn) => fn(cierreSolicitado, estado));
}

/**
 * Registra una tarea crítica en ejecución.
 * Devuelve una función para dar de baja la tarea cuando finalice.
 */
export function registrarTarea(id: string, descripcion: string): () => void {
    tareasActivas.set(id, descripcion);
    notificar();
    return () => {
        tareasActivas.delete(id);
        notificar();
    };
}

/**
 * Registra o quita un bloqueo de cambios pendientes con descripción legible.
 */
export function registrarCambio(id: string, descripcion: string | null | undefined): void {
    if (descripcion && descripcion.trim() !== '') {
        cambiosPendientes.set(id, descripcion.trim());
    } else {
        cambiosPendientes.delete(id);
    }
    notificar();
}

/** Indica si hay alguna tarea en curso en el sistema. */
export const hayTareasActivas = (): boolean => tareasActivas.size > 0;

/** Indica si hay modificaciones o trabajo sin guardar en cualquier parte del sistema. */
export const hayCambiosPendientes = (): boolean => cambiosPendientes.size > 0;

/** Compatibilidad con el marcador booleano anterior. */
export const marcarCambiosPendientes = (v: boolean, id = 'general', desc = 'Datos del expediente con cambios sin guardar'): void => {
    registrarCambio(id, v ? desc : null);
};

/** Abre la ventana emergente de verificación de cierre. */
export function solicitarCierreSistema(): void {
    salidaAutorizada = false;
    cierreSolicitado = true;
    notificar();
}

/** Cierra la ventana emergente y cancela el cierre. */
export function cancelarCierreSistema(): void {
    salidaAutorizada = false;
    cierreSolicitado = false;
    notificar();
}

/** Suscripción reactiva para la ventana emergente de confirmación de cierre. */
export function suscribirCierre(cb: (solicitado: boolean, estado: EstadoCierreSistema) => void): () => void {
    oyentesCierre.add(cb);
    cb(cierreSolicitado, obtenerEstadoCierre());
    return () => {
        oyentesCierre.delete(cb);
    };
}

/**
 * Ejecuta el cierre definitivo del sistema.
 * Desactiva primero los oyentes `onCloseRequested` (que en Tauri v2 redirigen a `destroy()`)
 * y luego ejecuta `close()` y `destroy()`.
 */
export async function confirmarCierreSistema(): Promise<void> {
    salidaAutorizada = true;
    cierreSolicitado = false;
    tareasActivas.clear();
    cambiosPendientes.clear();

    // Desregistrar todos los interceptores `onCloseRequested` activos para que `close()` cierre la ventana nativa directamente
    for (const unlisten of Array.from(desuscribirCloseRequested)) {
        try {
            unlisten();
        } catch {
            /* ignorar */
        }
    }
    desuscribirCloseRequested.clear();

    const esTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (esTauri) {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().close();
            return;
        } catch (errClose) {
            console.warn('close() falló, probando destroy():', errClose);
        }
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().destroy();
            return;
        } catch (errDestroy) {
            console.warn('destroy() falló:', errDestroy);
        }
    }
    window.close();
}

