export function claveNormalizada(s: string): string {
    return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function normalizarRol(rol: string): string {
    return claveNormalizada(rol).trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Clave técnica de un campo: «Lugar de firma» → lugar_firma. */
export const claveCampo = normalizarRol;

export function pluralRol(rol: string): string {
    const r = normalizarRol(rol);
    if (/[aeiou]$/.test(r)) return `${r}s`;
    if (/z$/.test(r)) return `${r.slice(0, -1)}ces`;
    if (/s$/.test(r)) return r;
    return `${r}es`;
}

export function etiquetaRol(rol: string): string {
    const t = rol.replace(/_/g, ' ').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
}