import type { ReactNode } from 'react';

export function Aviso({ error }: { error: string | null }) {
    return error ? <pre className="error">{error}</pre> : null;
}

export function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
    return (
        <label className="campo">
            <span>{etiqueta}</span>
            {children}
        </label>
    );
}

/** Campos del formulario sin los vacíos, con espacios recortados. */
export function datosDeForm(form: HTMLFormElement): Record<string, string> {
    return Object.fromEntries(
        [...new FormData(form)]
            .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
            .map(([k, v]) => [k, String(v).trim()]),
    );
}