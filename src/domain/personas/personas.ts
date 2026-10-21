import type { Genero } from './entidades';
import { claveNormalizada } from './texto';

const ESTADO_CIVIL: Record<string, readonly [string, string]> = {
    soltero: ['soltero', 'soltera'], soltera: ['soltero', 'soltera'],
    casado: ['casado', 'casada'], casada: ['casado', 'casada'],
    divorciado: ['divorciado', 'divorciada'], divorciada: ['divorciado', 'divorciada'],
    viudo: ['viudo', 'viuda'], viuda: ['viudo', 'viuda'],
};

const SIN_TILDE: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };

export function aFemenino(valor: string): string {
    const v = valor.trim();
    if (!v || /\s/.test(v)) return v;
    if (/o$/i.test(v)) return `${v.slice(0, -1)}a`;
    const m = /^(.*)([áéíóú])(n|s)$/i.exec(v);
    if (m && (m[3].toLowerCase() === 'n' || m[2].toLowerCase() === 'é')) {
        return `${m[1]}${SIN_TILDE[m[2].toLowerCase()]}${m[3]}a`;
    }
    if (/(ol|or)$/i.test(v)) return `${v}a`;
    return v;
}

export function estadoCivilConcordado(valor: string | null | undefined, genero: Genero | null): string {
    const v = (valor ?? '').trim();
    if (!v) return '';
    const par = ESTADO_CIVIL[claveNormalizada(v)];
    if (!par || !genero) return v;
    return genero === 'F' ? par[1] : par[0];
}

/** Solo feminiza (nunca masculiniza: «belga», «persa» se romperían). Palabras compuestas no se tocan. */
export function atributoConcordado(valor: string | null | undefined, genero: Genero | null): string {
    const v = (valor ?? '').trim();
    if (!v) return '';
    return genero === 'F' ? aFemenino(v) : v;
}

export function nombrePersona(p: Record<string, unknown>): string {
    const t = (k: string) => (typeof p[k] === 'string' ? (p[k] as string).trim() : '');
    if (t('tipo') === 'juridica') return t('razon_social');
    const base = [t('nombres'), t('apellido_paterno'), t('apellido_materno')].filter(Boolean).join(' ');
    const casada = t('apellido_casada');
    return casada ? `${base} de ${casada}` : base;
}