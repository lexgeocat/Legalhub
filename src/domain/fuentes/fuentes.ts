import catalogo from './fuentes.json';

export type CategoriaFuente = 'serif' | 'sans' | 'sistema';

export interface FuenteCatalogo {
    familia: string;
    categoria: CategoriaFuente;
    generica: 'serif' | 'sans-serif';
    /** Paquete @fontsource: solo las fuentes que la app incluye (y puede incrustar en el .docx). */
    paquete?: string;
    /** Fuente incluida de métricas equivalentes, usada como respaldo en pantalla. */
    equivalente?: string;
    nota?: string;
}

export const CATALOGO_FUENTES = catalogo as unknown as readonly FuenteCatalogo[];
export const NOMBRES_FUENTES: string[] = CATALOGO_FUENTES.map((f) => f.familia);

export const GRUPOS_FUENTES: readonly { id: CategoriaFuente; titulo: string }[] = [
    { id: 'serif', titulo: 'Serif · clásicas (incluidas)' },
    { id: 'sans', titulo: 'Sans · modernas (incluidas)' },
    { id: 'sistema', titulo: 'Instaladas en Windows / Word' },
];

export function buscarFuente(familia: string): FuenteCatalogo | undefined {
    const k = familia.trim().toLowerCase();
    return CATALOGO_FUENTES.find((f) => f.familia.toLowerCase() === k);
}

/** Valor para `font-family`: la fuente, un respaldo de métricas parecidas y la genérica. */
export function pilaCss(familia: string): string {
    const f = buscarFuente(familia);
    const generica = f?.generica ?? 'serif';
    const nombre = familia.replace(/["\\]/g, '');
    const respaldo = f?.equivalente ? `"${f.equivalente}"` : generica === 'serif' ? '"Times New Roman"' : 'Arial';
    return `"${nombre}", ${respaldo}, ${generica}`;
}

/** Pide al navegador las fuentes incluidas para que el selector las muestre bien desde el primer clic. */
export function precargarFuentes(): void {
    if (typeof document === 'undefined' || !document.fonts) return;
    for (const f of CATALOGO_FUENTES) {
        if (!f.paquete) continue;
        for (const v of ['400 14px', 'italic 400 14px', '700 14px', 'italic 700 14px']) {
            void document.fonts.load(`${v} "${f.familia}"`).catch(() => undefined);
        }
    }
}