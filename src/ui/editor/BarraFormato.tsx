import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { FUENTES_PAGINA, type Alineacion, type ConfigPagina } from '../../domain/modelos/fuenteModelo';
import { GRUPOS_FUENTES, buscarFuente, pilaCss } from '../../domain/fuentes/fuentes';
import type { ControlHoja, EstadoHistorial, FormatoActivo } from './HojaEditable';

export const TAMANOS_LETRA = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 36];
export const INTERLINEADOS = [1, 1.15, 1.5, 2, 2.5, 3];
export const coma = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export function SelectFuente({ valor, onCambio }: { valor: string; onCambio: (f: string) => void }) {
    const fuentes = FUENTES_PAGINA.includes(valor) ? FUENTES_PAGINA : [...FUENTES_PAGINA, valor];
    return (
        <select className="ed-select ed-fuente" aria-label="Fuente" title="Fuente tipográfica" value={valor} onChange={(e) => onCambio(e.target.value)}>
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
        <select className="ed-select ed-tamano" aria-label="Tamaño de letra" title="Tamaño de letra (pt)" value={valor} onChange={(e) => onCambio(Number(e.target.value))}>
            {lista.map((n) => <option key={n} value={n}>{coma(n)} pt</option>)}
        </select>
    );
}

export function SelectInterlineado({ valor, onCambio }: { valor: number; onCambio: (n: number) => void }) {
    const lista = INTERLINEADOS.includes(valor) ? INTERLINEADOS : [...INTERLINEADOS, valor].sort((a, b) => a - b);
    return (
        <select className="ed-select-interno" aria-label="Interlineado" title="Interlineado del párrafo" value={valor} onChange={(e) => onCambio(Number(e.target.value))}>
            {lista.map((n) => <option key={n} value={n}>{coma(n)}</option>)}
        </select>
    );
}

export interface DefIcoEditor {
    d: string;
    a?: string;
    c?: string;
    cl?: string;
}

export const ICO = {
    deshacer: {
        d: 'M9 14L4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
        a: 'M4 9l5-5v10L4 9z',
        c: '#2563eb',
        cl: '#60a5fa',
    },
    rehacer: {
        d: 'M15 14l5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
        a: 'M20 9l-5-5v10l5-5z',
        c: '#2563eb',
        cl: '#60a5fa',
    },
    interlineado: {
        d: 'M11 6h10 M11 12h10 M11 18h10 M6 4.5v15 M3.5 7L6 4.5 8.5 7 M3.5 17L6 19.5 8.5 17',
        a: 'M11 5.5h10v13H11z',
        c: '#7c3aed',
        cl: '#a78bfa',
    },
    sangria: {
        d: 'M12 6h9 M3 12h18 M3 18h18 M3 6h5.5 M6 3.5L8.5 6 6 8.5',
        a: 'M3 3.5L8.5 6 3 8.5V3.5z',
        c: '#0d9488',
        cl: '#2dd4bf',
    },
    columnas: {
        d: 'M3 4.5h7.5v15H3z M13.5 4.5H21v15h-7.5z M5 8h3.5 M5 11.5h3.5 M5 15h2.5 M15.5 8H19 M15.5 11.5H19 M15.5 15h2.5',
        a: 'M3 4.5h7.5v15H3z M13.5 4.5H21v15h-7.5z',
        c: '#0891b2',
        cl: '#22d3ee',
    },
    saltoColumna: {
        d: 'M3 5h6.5v14H3z M14 14h7 M14 18h5 M12.5 9.5c1-3 3.5-4.5 7-4.5 M17 2.5L20 5l-3 2.5',
        a: 'M3 5h6.5v14H3z',
        c: '#0891b2',
        cl: '#22d3ee',
    },
    firma: {
        d: 'M3 20h18 M4 16l2.5 2.5 M6.5 16L4 18.5 M15.5 4.5a2.1 2.1 0 0 1 3 3L11 15l-3.5.8.8-3.5 7.2-7.8z',
        a: 'M15.5 4.5a2.1 2.1 0 0 1 3 3L11 15l-3.5.8.8-3.5 7.2-7.8z',
        c: '#d97706',
        cl: '#fbbf24',
    },
    pagina: {
        d: 'M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5z M14 2.5v6h6 M7.5 12h9 M7.5 15.5h9 M7.5 8.5h3.5',
        a: 'M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5h-6v-6z',
        c: '#2563eb',
        cl: '#60a5fa',
    },
    ojo: {
        d: 'M2 12s3.5-6.5 10-6.5 10 6.5 10 6.5-3.5 6.5-10 6.5S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
        a: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
        c: '#059669',
        cl: '#34d399',
    },
    codigos: {
        d: 'M8 4H6.5A2.5 2.5 0 0 0 4 6.5v3A2.5 2.5 0 0 1 1.5 12 2.5 2.5 0 0 1 4 14.5v3A2.5 2.5 0 0 0 6.5 20H8 M16 4h1.5A2.5 2.5 0 0 1 20 6.5v3a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0-2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5H16 M9.5 12h.01 M14.5 12h.01',
        c: '#0284c7',
        cl: '#38bdf8',
    },
    campos: {
        d: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01 M11 11l4 4 M9 13l3 3',
        a: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z',
        c: '#d97706',
        cl: '#fbbf24',
    },
    guia: {
        d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z M9 2v7l2.5-1.8L14 9V2',
        a: 'M6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
        c: '#7c3aed',
        cl: '#a78bfa',
    },
    leyes: {
        d: 'M12 5.5C10.2 4.3 7.5 4 4.5 4A1.5 1.5 0 0 0 3 5.5v12A1.5 1.5 0 0 0 4.5 19c3 0 5.7.3 7.5 1.5 1.8-1.2 4.5-1.5 7.5-1.5A1.5 1.5 0 0 0 21 17.5v-12A1.5 1.5 0 0 0 19.5 4c-3 0-5.7.3-7.5 1.5z M12 5.5v15 M6 9h3.5 M6 12.5h3.5 M14.5 9H18 M14.5 12.5H18',
        a: 'M12 5.5C10.2 4.3 7.5 4 4.5 4A1.5 1.5 0 0 0 3 5.5v12A1.5 1.5 0 0 0 4.5 19c3 0 5.7.3 7.5 1.5V5.5z',
        c: '#2563eb',
        cl: '#60a5fa',
    },
    diccionario: {
        d: 'M5 4.5A2.5 2.5 0 0 1 7.5 2H19a1 1 0 0 1 1 1v15.5a1 1 0 0 1-1 1H7.5A2.5 2.5 0 0 0 5 22V4.5z M5 19.5A2.5 2.5 0 0 0 7.5 22H19v-2.5 M8.5 2v17.5 M11.5 13l2-5.5 2 5.5 M12.1 11.5h2.8',
        a: 'M8.5 2H19a1 1 0 0 1 1 1v15.5a1 1 0 0 1-1 1H8.5V2z',
        c: '#db2777',
        cl: '#f472b6',
    },
} satisfies Record<string, DefIcoEditor>;

const ICO_ALIN: Record<Alineacion, DefIcoEditor> = {
    left: { d: 'M3 5.5h18 M3 10h12 M3 14.5h18 M3 19h10', a: 'M3 5h12v14H3z', c: '#0284c7', cl: '#38bdf8' },
    center: { d: 'M3 5.5h18 M6 10h12 M3 14.5h18 M7 19h10', a: 'M6 5h12v14H6z', c: '#0284c7', cl: '#38bdf8' },
    right: { d: 'M3 5.5h18 M9 10h12 M3 14.5h18 M11 19h10', a: 'M9 5h12v14H9z', c: '#0284c7', cl: '#38bdf8' },
    both: { d: 'M3 5.5h18 M3 10h18 M3 14.5h18 M3 19h18', a: 'M3 5h18v14H3z', c: '#0284c7', cl: '#38bdf8' },
};
const ETIQ_ALIN: Record<Alineacion, string> = {
    left: 'Alinear a la izquierda (Ctrl+Q)',
    center: 'Centrar (Ctrl+T)',
    right: 'Alinear a la derecha (Ctrl+D)',
    both: 'Justificar (Ctrl+J)',
};
const ALINEACIONES: Alineacion[] = ['left', 'center', 'right', 'both'];

export function Ico({ d }: { d: string | DefIcoEditor }) {
    const def: DefIcoEditor = typeof d === 'string' ? { d } : d;
    const estilo = def.c
        ? ({ '--ico-c': def.c, '--ico-cl': def.cl ?? def.c } as CSSProperties)
        : undefined;
    return (
        <svg
            className={`ed-ico${def.c ? ' ed-ico-color' : ''}`}
            style={estilo}
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {def.a && <path d={def.a} fill="currentColor" fillOpacity={0.2} stroke="none" fillRule="evenodd" />}
            <path d={def.d} />
        </svg>
    );
}

/** Controles de Deshacer y Rehacer para la barra superior de la ventana (junto al nombre del documento). */
export function ControlesHistorial({ hoja, bloqueada }: {
    hoja: RefObject<ControlHoja | null>;
    bloqueada?: boolean;
}) {
    const [hist, setHist] = useState<EstadoHistorial>({ puedeDeshacer: false, puedeRehacer: false });

    useEffect(() => {
        let limpiar: (() => void) | undefined;
        const conectar = () => {
            const ctrl = hoja.current;
            if (!ctrl) return;
            setHist(ctrl.estadoHistorial());
            limpiar = ctrl.suscribirHistorial(setHist);
        };
        conectar();
        const t = window.setTimeout(conectar, 0);
        return () => {
            window.clearTimeout(t);
            limpiar?.();
        };
    }, [hoja]);

    return (
        <div className="ed-historial-bar" role="group" aria-label="Deshacer y rehacer">
            <button
                type="button"
                className="ed-tb ed-tb-hist"
                title="Deshacer (Ctrl+Z)"
                aria-label="Deshacer (Ctrl+Z)"
                disabled={bloqueada || !hist.puedeDeshacer}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => hoja.current?.deshacer()}
            >
                <Ico d={ICO.deshacer} />
            </button>
            <button
                type="button"
                className="ed-tb ed-tb-hist"
                title="Rehacer (Ctrl+Y)"
                aria-label="Rehacer (Ctrl+Y)"
                disabled={bloqueada || !hist.puedeRehacer}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => hoja.current?.rehacer()}
            >
                <Ico d={ICO.rehacer} />
            </button>
        </div>
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

/** Cinta de formato estructurada por secciones para el editor de escritos, el llenado y la edición del documento. */
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
        <div className="ed-cinta" role="toolbar" aria-label="Barra de herramientas de formato">
            <fieldset className="ed-contenido" disabled={bloqueada}>
                {/* 1. Tipografía y estilos de carácter */}
                <div className="ed-grupo" role="group" aria-label="Tipografía">
                    <SelectFuente valor={formato.fuente ?? config.fuente} onCambio={(f) => h.current?.fuente(f)} />
                    <SelectTamano valor={formato.tamanoPt ?? config.tamanoPt} onCambio={(n) => h.current?.tamano(n)} />
                    <div className="ed-subgrupo" role="group" aria-label="Estilos de fuente">
                        <Tb titulo="Negrita (Ctrl+N)" activo={formato.negrita} onClick={() => h.current?.comando('negrita')}><b className="ed-fmt-n">N</b></Tb>
                        <Tb titulo="Cursiva (Ctrl+K)" activo={formato.cursiva} onClick={() => h.current?.comando('cursiva')}><i className="ed-fmt-k">K</i></Tb>
                        <Tb titulo="Subrayado (Ctrl+S)" activo={formato.subrayado} onClick={() => h.current?.comando('subrayado')}><u className="ed-fmt-s">S</u></Tb>
                    </div>
                </div>

                <Sep />

                {/* 2. Párrafo: alineación, interlineado y sangría */}
                <div className="ed-grupo" role="group" aria-label="Párrafo">
                    <div className="ed-subgrupo" role="group" aria-label="Alineación">
                        {ALINEACIONES.map((a) => (
                            <Tb key={a} titulo={ETIQ_ALIN[a]} activo={formato.alineacion === a} onClick={() => h.current?.alinear(a)}>
                                <Ico d={ICO_ALIN[a]} />
                            </Tb>
                        ))}
                    </div>
                    <div className="ed-control-icono" title="Interlineado del párrafo">
                        <Ico d={ICO.interlineado} />
                        <SelectInterlineado valor={formato.interlineado ?? config.interlineado} onCambio={(n) => h.current?.interlineado(n)} />
                    </div>
                    <Tb titulo="Sangría de primera línea (1,25 cm)" activo={config.sangria} onClick={() => onConfig({ ...config, sangria: !config.sangria })}>
                        <Ico d={ICO.sangria} />
                        <span>Sangría</span>
                    </Tb>
                </div>

                <Sep />

                {/* 3. Disposición de página e inserción */}
                <div className="ed-grupo" role="group" aria-label="Diseño y página">
                    <div className="ed-control-icono" title="Columnas de lo seleccionado, como en Word">
                        <Ico d={ICO.columnas} />
                        <select className="ed-select-interno" aria-label="Columnas" value={formato.columnas}
                            onChange={(e) => h.current?.columnas(Number(e.target.value))}>
                            <option value={1}>1 col.</option>
                            <option value={2}>2 cols.</option>
                        </select>
                    </div>
                    {formato.columnas > 1 && (
                        <Tb titulo="Salto de columna (Ctrl+Mayús+Enter): lo que sigue al cursor pasa a la columna siguiente"
                            onClick={() => h.current?.saltoColumna()}>
                            <Ico d={ICO.saltoColumna} />
                            <span>Salto col.</span>
                        </Tb>
                    )}
                    {conFirma && (
                        <Tb titulo="Insertar línea de firma centrada" onClick={() => h.current?.insertar('[c] ______________________________', true)}>
                            <Ico d={ICO.firma} />
                            <span>Firma</span>
                        </Tb>
                    )}
                    <Tb titulo="Configurar página: tamaño de papel, márgenes y espaciado" onClick={onPagina}>
                        <Ico d={ICO.pagina} />
                        <span>Página…</span>
                    </Tb>
                </div>

                <div className="espacio" />

                {/* 4. Herramientas de asistencia y paneles laterales */}
                {children && (
                    <div className="ed-grupo ed-grupo-der" role="group" aria-label="Herramientas y paneles">
                        {children}
                    </div>
                )}
            </fieldset>
        </div>
    );
}
