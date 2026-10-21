import type { ReactNode, RefObject } from 'react';
import { FUENTES_PAGINA, type Alineacion, type ConfigPagina } from '../../domain/modelos/fuenteModelo';
import { GRUPOS_FUENTES, buscarFuente, pilaCss } from '../../domain/fuentes/fuentes';
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

const ICO = {
    deshacer: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
    rehacer: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
};
const ICO_ALIN: Record<Alineacion, string> = {
    left: 'M4 6h16 M4 10h10 M4 14h16 M4 18h10',
    center: 'M4 6h16 M7 10h10 M4 14h16 M7 18h10',
    right: 'M4 6h16 M10 10h10 M4 14h16 M10 18h10',
    both: 'M4 6h16 M4 10h16 M4 14h16 M4 18h16',
};
const ETIQ_ALIN: Record<Alineacion, string> = {
    left: 'Alinear a la izquierda', center: 'Centrar', right: 'Alinear a la derecha', both: 'Justificar',
};
const ALINEACIONES: Alineacion[] = ['left', 'center', 'right', 'both'];

export function Ico({ d }: { d: string }) {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={d} />
        </svg>
    );
}

/** Botón de la cinta: no le quita el foco (ni la selección) a la hoja. */
export function Tb({ titulo, activo, onClick, children }: {
    titulo: string; activo?: boolean; onClick: () => void; children: ReactNode;
}) {
    return (
        <button type="button" className={`ed-tb${activo ? ' on' : ''}`} title={titulo} aria-label={titulo}
            aria-pressed={activo} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
            {children}
        </button>
    );
}

export const Sep = () => <span className="sep" />;

/** Cinta de formato única para el editor de modelos, el llenado y la edición del documento. */
export function BarraFormato({ config, formato, hoja, conFirma, bloqueada, onConfig, onPagina, children }: {
    config: ConfigPagina;
    formato: FormatoActivo;
    hoja: RefObject<ControlHoja | null>;
    /** Muestra «Línea de firma» (solo al editar modelos). */
    conFirma?: boolean;
    bloqueada?: boolean;
    onConfig: (c: ConfigPagina) => void;
    onPagina: () => void;
    /** Botones extra a la derecha. */
    children?: ReactNode;
}) {
    const h = hoja;
    return (
        <div className="ed-cinta" role="toolbar" aria-label="Formato">
            <fieldset className="ed-contenido" disabled={bloqueada}>
                <Tb titulo="Deshacer (Ctrl+Z)" onClick={() => h.current?.deshacer()}><Ico d={ICO.deshacer} /></Tb>
                <Tb titulo="Rehacer (Ctrl+Y)" onClick={() => h.current?.rehacer()}><Ico d={ICO.rehacer} /></Tb>
                <Sep />

                <SelectFuente valor={formato.fuente ?? config.fuente} onCambio={(f) => h.current?.fuente(f)} />
                <SelectTamano valor={formato.tamanoPt ?? config.tamanoPt} onCambio={(n) => h.current?.tamano(n)} />
                <SelectInterlineado valor={formato.interlineado ?? config.interlineado} onCambio={(n) => h.current?.interlineado(n)} />
                <Sep />

                <Tb titulo="Negrita (Ctrl+N)" activo={formato.negrita} onClick={() => h.current?.comando('negrita')}><b>N</b></Tb>
                <Tb titulo="Cursiva (Ctrl+K)" activo={formato.cursiva} onClick={() => h.current?.comando('cursiva')}><i>K</i></Tb>
                <Tb titulo="Subrayado (Ctrl+S)" activo={formato.subrayado} onClick={() => h.current?.comando('subrayado')}><u>S</u></Tb>
                <Sep />

                {ALINEACIONES.map((a) => (
                    <Tb key={a} titulo={ETIQ_ALIN[a]} activo={formato.alineacion === a} onClick={() => h.current?.alinear(a)}>
                        <Ico d={ICO_ALIN[a]} />
                    </Tb>
                ))}
                <Sep />

                <select aria-label="Columnas" title="Columnas de lo seleccionado, como en Word." value={formato.columnas}
                    onChange={(e) => h.current?.columnas(Number(e.target.value))}>
                    <option value={1}>1 columna</option>
                    <option value={2}>2 columnas</option>
                </select>
                {formato.columnas > 1 && (
                    <Tb titulo="Salto de columna (Ctrl+Mayús+Enter): lo que sigue al cursor pasa a la columna siguiente"
                        onClick={() => h.current?.saltoColumna()}>Salto de columna</Tb>
                )}

                {conFirma && (
                    <>
                        <Sep />
                        <Tb titulo="Insertar línea de firma" onClick={() => h.current?.insertar('[c] ______________________________', true)}>
                            Línea de firma
                        </Tb>
                    </>
                )}
                <Sep />

                <Tb titulo="Sangría de primera línea" activo={config.sangria} onClick={() => onConfig({ ...config, sangria: !config.sangria })}>
                    Sangría
                </Tb>
                <Tb titulo="Configurar página: papel y márgenes en cm" onClick={onPagina}>Página…</Tb>

                <div className="espacio" />
                {children}
            </fieldset>
        </div>
    );
}