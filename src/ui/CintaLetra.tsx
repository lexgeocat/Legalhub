import type { RefObject } from 'react';
import { FUENTES_PAGINA, type ConfigPagina } from '../domain/fuenteModelo';
import { GRUPOS_FUENTES, buscarFuente, pilaCss } from '../domain/fuentes';
import type { ControlHoja, FormatoActivo } from './HojaEditable';

export const TAMANOS_LETRA = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 36];
export const INTERLINEADOS = [1, 1.15, 1.5, 2, 2.5, 3];
export const coma = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export function SelectFuente({ valor, onCambio }: { valor: string; onCambio: (f: string) => void }) {
    const fuentes = FUENTES_PAGINA.includes(valor) ? FUENTES_PAGINA : [...FUENTES_PAGINA, valor];
    return (
        <select className="ed-fuente" aria-label="Fuente" title="Fuente" value={valor} onChange={(e) => onCambio(e.target.value)}>
            {GRUPOS_FUENTES.map((g) => {
                const lista = fuentes.filter((f) => (buscarFuente(f)?.categoria ?? 'sistema') === g.id);
                if (lista.length === 0) return null;
                return (
                    <optgroup key={g.id} label={g.titulo}>
                        {lista.map((f) => (
                            <option key={f} value={f} title={buscarFuente(f)?.nota} style={{ fontFamily: pilaCss(f) }}>{f}</option>
                        ))}
                    </optgroup>
                );
            })}
        </select>
    );
}

export function SelectTamano({ valor, onCambio }: { valor: number; onCambio: (n: number) => void }) {
    const lista = TAMANOS_LETRA.includes(valor) ? TAMANOS_LETRA : [...TAMANOS_LETRA, valor].sort((a, b) => a - b);
    return (
        <select aria-label="Tamaño de letra" title="Tamaño de letra" value={valor} onChange={(e) => onCambio(Number(e.target.value))}>
            {lista.map((n) => <option key={n} value={n}>{coma(n)}</option>)}
        </select>
    );
}

export function SelectInterlineado({ valor, onCambio }: { valor: number; onCambio: (n: number) => void }) {
    const lista = INTERLINEADOS.includes(valor) ? INTERLINEADOS : [...INTERLINEADOS, valor].sort((a, b) => a - b);
    return (
        <select aria-label="Interlineado" title="Interlineado" value={valor} onChange={(e) => onCambio(Number(e.target.value))}>
            {lista.map((n) => <option key={n} value={n}>{coma(n)}</option>)}
        </select>
    );
}

/** Fuente, tamaño, interlineado y columnas de la SELECCIÓN (no del documento entero). */
export function CintaLetra({ config, formato, hoja }: {
    config: ConfigPagina;
    formato: FormatoActivo;
    hoja: RefObject<ControlHoja | null>;
}) {
    return (
        <>
            <SelectFuente valor={formato.fuente ?? config.fuente} onCambio={(f) => hoja.current?.fuente(f)} />
            <SelectTamano valor={formato.tamanoPt ?? config.tamanoPt} onCambio={(n) => hoja.current?.tamano(n)} />
            <SelectInterlineado valor={formato.interlineado ?? config.interlineado} onCambio={(n) => hoja.current?.interlineado(n)} />
            <select
                aria-label="Columnas"
                title="Columnas de lo seleccionado, como en Word. Sin selección y con «1 columna» se deshace toda la región donde está el cursor."
                value={formato.columnas}
                onChange={(e) => hoja.current?.columnas(Number(e.target.value))}
            >
                <option value={1}>1 columna</option>
                <option value={2}>2 columnas</option>
            </select>
            <button
                type="button"
                className="ed-tb"
                disabled={formato.columnas < 2}
                title="Salto de columna (Ctrl+Mayús+Enter): lo que sigue al cursor pasa a la columna siguiente"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => hoja.current?.saltoColumna()}
            >
                Salto de columna
            </button>
        </>
    );
}