import { PRIMARIOS, type ConfigTema } from './tema';

/** Etiqueta corta y legible del esquema y acento activo. */
export function etiquetaConfigTema(cfg: ConfigTema): string {
    const p = PRIMARIOS.find((x) => x.id === cfg.primary)?.nombre ?? cfg.primary;
    return `${cfg.colorScheme === 'dark' ? 'Oscuro' : 'Claro'} · ${p}`;
}

/** Icono SVG representativo del esquema claro u oscuro. */
export function IconoTema({ oscuro, tam = 16 }: { oscuro: boolean; tam?: number }) {
    if (oscuro) {
        return (
            <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" fillOpacity="0.16" />
                <path d="M18 4v3M16.5 5.5h3" />
            </svg>
        );
    }
    return (
        <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.18" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
    );
}

/** Icono de paleta con indicador de acento vivo. */
export function IconoPaleta({ color, tam = 16 }: { color?: string; tam?: number }) {
    return (
        <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0 0 20c1.3 0 2-.9 2-2 0-.55-.2-1.05-.58-1.45-.38-.4-.58-.9-.58-1.45 0-1.1.9-2 2-2h2.25A4.9 4.9 0 0 0 22 10.2C22 5.65 17.52 2 12 2z" />
            <circle cx="7.2" cy="12.2" r="1.15" fill="currentColor" stroke="none" />
            <circle cx="9.8" cy="7.7" r="1.15" fill="currentColor" stroke="none" />
            <circle cx="14.7" cy="7.5" r="1.15" fill="currentColor" stroke="none" />
            <circle cx="17.3" cy="11.2" r="1.9" fill={color || 'currentColor'} stroke="none" />
        </svg>
    );
}
