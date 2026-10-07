export interface HallazgoTexto {
    nivel: 'error' | 'aviso';
    mensaje: string;
}

const REGLAS: { nivel: HallazgoTexto['nivel']; re: RegExp; mensaje: string }[] = [
    { nivel: 'error', re: /\{\{|\}\}/, mensaje: 'Quedó un marcador sin completar' },
    { nivel: 'aviso', re: /\b(?:undefined|NaN)\b|\[object Object\]/, mensaje: 'Aparece un valor técnico («undefined», «NaN»…)' },
    { nivel: 'aviso', re: /,\s*,|;\s*;|\(\s*\)|«\s*»/, mensaje: 'Quedaron signos vacíos (por ejemplo «, ,» o «()»): puede faltar un dato opcional' },
    { nivel: 'aviso', re: /[^\S\n\t]+[,;:.]/, mensaje: 'Hay un espacio antes de un signo de puntuación' },
];

/** Revisa el texto ya completado y devuelve lo que huele mal (con un fragmento para ubicarlo). */
export function revisarTexto(texto: string): HallazgoTexto[] {
    const salida: HallazgoTexto[] = [];
    for (const r of REGLAS) {
        const m = r.re.exec(texto);
        if (!m) continue;
        const veces = [...texto.matchAll(new RegExp(r.re.source, 'g'))].length;
        const ini = Math.max(0, m.index - 24);
        const fin = Math.min(texto.length, m.index + m[0].length + 24);
        const frag = texto.slice(ini, fin).replace(/\s*\n\s*/g, ' ¶ ').trim();
        salida.push({
            nivel: r.nivel,
            mensaje: `${r.mensaje}${veces > 1 ? ` (${veces} veces)` : ''}: «…${frag}…»`,
        });
    }
    return salida;
}