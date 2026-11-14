import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import {
    COLORES_RESALTADO,
    ESPACIO_MAX_PT,
    ESTILOS_NUMERACION,
    ESTILOS_VINETA,
    esListaOrdenada,
    FUENTES_PAGINA,
    type Alineacion,
    type ColorResaltado,
    type ConfigPagina,
    type TipoNumeracion,
    type TipoVineta,
} from '../../domain/modelos/fuenteModelo';
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
    resaltado: {
        d: 'M15.5 4.5l4 4L9 19H5v-4L15.5 4.5z M13 7l4 4',
        a: 'M15.5 4.5l4 4L9 19H5v-4L15.5 4.5z',
        c: '#ca8a04',
        cl: '#facc15',
    },
    vinetas: {
        d: 'M9 6h11 M9 12h11 M9 18h11 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01',
        a: 'M3.5 5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z M3.5 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z M3.5 18a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z',
        c: '#0284c7',
        cl: '#38bdf8',
    },
    numeracion: {
        d: 'M10 6h10 M10 12h10 M10 18h10 M4 5h1.5v4 M3.5 9H6.5 M3.5 14c.5-.8 2.5-.8 2.5.5 0 1-2.5 2-2.5 3h3',
        c: '#0284c7',
        cl: '#38bdf8',
    },
    tabla: {
        d: 'M3 4.5h18v15H3z M3 9.5h18 M3 14.5h18 M9 4.5v15 M15 4.5v15',
        a: 'M3 4.5h18v5H3z',
        c: '#0d9488',
        cl: '#2dd4bf',
    },
    sinonimos: {
        d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5z M8 8h7 M8 11.5h5 M15.5 14.5l2.5 2.5-2.5 2.5 M12.5 17H18',
        a: 'M6.5 3H19v16H6.5A2.5 2.5 0 0 1 4 16.5v-11A2.5 2.5 0 0 1 6.5 3z',
        c: '#7c3aed',
        cl: '#a78bfa',
    },
    observador: {
        d: 'M9 11.5l2 2 4.5-4.5 M12 3l8 3.5v5.5c0 5-3.4 8.8-8 10-4.6-1.2-8-5-8-10V6.5L12 3z',
        a: 'M12 3l8 3.5v5.5c0 5-3.4 8.8-8 10-4.6-1.2-8-5-8-10V6.5L12 3z',
        c: '#dc2626',
        cl: '#f87171',
    },
    interlineado: {
        d: 'M11 6h10 M11 12h10 M11 18h10 M6 4.5v15 M3.5 7L6 4.5 8.5 7 M3.5 17L6 19.5 8.5 17',
        a: 'M11 5.5h10v13H11z',
        c: '#7c3aed',
        cl: '#a78bfa',
    },
    espacioAntes: {
        d: 'M10.5 13h10.5 M10.5 17.5h8.5 M5.5 10V4 M3 6.5L5.5 4 8 6.5 M3 10.5h5',
        a: 'M10.5 12.5h10.5v5.5H10.5z',
        c: '#7c3aed',
        cl: '#a78bfa',
    },
    espacioDespues: {
        d: 'M10.5 6.5h10.5 M10.5 11h8.5 M5.5 14v6 M3 17.5L5.5 20 8 17.5 M3 13.5h5',
        a: 'M10.5 6h10.5v5.5H10.5z',
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
        d: 'M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h5.2 M14 2.5v5.5h5.5 M19.5 8v3.2 M7.5 11.5h6 M7.5 15h3.5 M17.5 15.6a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z M17.5 13v1.1 M17.5 20.9V22 M13 17.5h1.1 M20.9 17.5H22 M14.3 14.3l.8.8 M19.9 19.9l.8.8 M20.7 14.3l-.8.8 M15.1 19.9l-.8.8',
        a: 'M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h5.2a5.5 5.5 0 0 1 8.3-7.3V8h-5.5V2.5z',
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
export function BarraFormato({
    config,
    formato,
    hoja,
    conFirma,
    bloqueada,
    onConfig,
    panelObservador,
    onAbrirObservador,
    children,
}: {
    config: ConfigPagina;
    formato: FormatoActivo;
    hoja: RefObject<ControlHoja | null>;
    /** Muestra «Línea de firma» (solo al editar modelos). */
    conFirma?: boolean;
    bloqueada?: boolean;
    onConfig: (c: ConfigPagina) => void;
    panelObservador?: 'revision' | 'sinonimos' | null;
    onAbrirObservador?: (modo: 'revision' | 'sinonimos') => void;
    /** Botones extra a la derecha. */
    children?: ReactNode;
}) {
    const h = hoja;
    const [colorActual, setColorActual] = useState<ColorResaltado>('yellow');
    const [vinetaActual, setVinetaActual] = useState<TipoVineta>('ul');
    const [numeracionActual, setNumeracionActual] = useState<TipoNumeracion>('ol');
    const [menuResaltado, setMenuResaltado] = useState(false);
    const [menuVinetas, setMenuVinetas] = useState(false);
    const [menuNumeracion, setMenuNumeracion] = useState(false);
    const [menuTabla, setMenuTabla] = useState(false);
    const [hoverFilas, setHoverFilas] = useState(3);
    const [hoverCols, setHoverCols] = useState(3);
    const [conteoObs, setConteoObs] = useState(0);
    const refWrapHl = useRef<HTMLDivElement>(null);
    const refWrapUl = useRef<HTMLDivElement>(null);
    const refWrapOl = useRef<HTMLDivElement>(null);
    const refWrapTabla = useRef<HTMLDivElement>(null);

    const cerrarMenus = () => {
        setMenuResaltado(false);
        setMenuVinetas(false);
        setMenuNumeracion(false);
        setMenuTabla(false);
    };

    // Suscribirse al observador para mostrar el contador en vivo en la barra de herramientas
    useEffect(() => {
        let desuscribir: (() => void) | undefined;
        const conectar = () => {
            const ctrl = hoja.current;
            if (!ctrl) return;
            setConteoObs(ctrl.estadoObservador().hallazgos.length);
            desuscribir = ctrl.suscribirObservador((est) => {
                setConteoObs(est.hallazgos.length);
            });
        };
        conectar();
        const t = window.setTimeout(conectar, 40);
        return () => {
            window.clearTimeout(t);
            desuscribir?.();
        };
    }, [hoja]);

    // Cerrar menús desplegables al hacer clic fuera
    useEffect(() => {
        if (!menuResaltado && !menuVinetas && !menuNumeracion && !menuTabla) return;
        const alClic = (e: MouseEvent) => {
            const t = e.target as Node | null;
            if (menuResaltado && refWrapHl.current && t && !refWrapHl.current.contains(t)) {
                setMenuResaltado(false);
            }
            if (menuVinetas && refWrapUl.current && t && !refWrapUl.current.contains(t)) {
                setMenuVinetas(false);
            }
            if (menuNumeracion && refWrapOl.current && t && !refWrapOl.current.contains(t)) {
                setMenuNumeracion(false);
            }
            if (menuTabla && refWrapTabla.current && t && !refWrapTabla.current.contains(t)) {
                setMenuTabla(false);
            }
        };
        window.addEventListener('mousedown', alClic);
        return () => window.removeEventListener('mousedown', alClic);
    }, [menuResaltado, menuVinetas, menuNumeracion, menuTabla]);

    const colorBarra = formato.modoResaltado && formato.modoResaltado !== 'quitar'
        ? formato.modoResaltado
        : (formato.resaltado ?? colorActual);
    const infoColor = COLORES_RESALTADO.find((c) => c.valor === colorBarra) ?? COLORES_RESALTADO[0];
    const esVinetaActiva = Boolean(formato.lista && !esListaOrdenada(formato.lista));
    const esNumActiva = esListaOrdenada(formato.lista);
    const ajustarEspacio = (campo: 'espacioAntes' | 'espacioDespues', raw: string) => {
        const n = raw === '' ? 0 : Number(raw);
        if (!Number.isFinite(n)) return;
        const limpio = Math.max(0, Math.min(ESPACIO_MAX_PT, Math.round(n * 10) / 10));
        onConfig({ ...config, [campo]: limpio });
    };

    return (
        <div className="ed-cinta" role="toolbar" aria-label="Barra de herramientas de formato">
            <fieldset className="ed-contenido" disabled={bloqueada}>
                {/* 1. Texto: tipografía, estilos de carácter y resaltado */}
                <section className="ed-modulo" aria-label="Texto">
                    <span className="ed-mod-tit">Texto</span>
                    <div className="ed-mod-fila">
                        <SelectFuente valor={formato.fuente ?? config.fuente} onCambio={(f) => h.current?.fuente(f)} />
                        <SelectTamano valor={formato.tamanoPt ?? config.tamanoPt} onCambio={(n) => h.current?.tamano(n)} />
                        <div className="ed-subgrupo" role="group" aria-label="Estilos de fuente">
                            <Tb titulo="Negrita (Ctrl+N)" activo={formato.negrita} onClick={() => h.current?.comando('negrita')}><b className="ed-fmt-n">N</b></Tb>
                            <Tb titulo="Cursiva (Ctrl+K)" activo={formato.cursiva} onClick={() => h.current?.comando('cursiva')}><i className="ed-fmt-k">K</i></Tb>
                            <Tb titulo="Subrayado (Ctrl+S)" activo={formato.subrayado} onClick={() => h.current?.comando('subrayado')}><u className="ed-fmt-s">S</u></Tb>
                        </div>

                        {/* Resaltador con selector de color */}
                        <div className="ed-split-wrap" ref={refWrapHl}>
                            <div className="ed-subgrupo">
                                <Tb
                                    titulo={
                                        formato.modoResaltado
                                            ? 'Modo resaltado activo (selecciona texto para resaltar · clic o Esc para salir)'
                                            : `Resaltar texto (${infoColor.etiqueta})`
                                    }
                                    activo={!!formato.resaltado || !!formato.modoResaltado}
                                    onClick={() => {
                                        if (formato.modoResaltado) {
                                            h.current?.resaltar(formato.modoResaltado === 'quitar' ? null : formato.modoResaltado);
                                        } else {
                                            h.current?.resaltar(formato.resaltado ? null : colorActual);
                                        }
                                        setMenuResaltado(false);
                                    }}
                                >
                                    <span className="ed-ico-hl-wrap">
                                        <Ico d={ICO.resaltado} />
                                        <span
                                            className="ed-ico-hl-bar"
                                            style={{ background: infoColor.hex }}
                                        />
                                    </span>
                                </Tb>
                                <button
                                    type="button"
                                    className={`ed-tb ed-tb-chev${menuResaltado ? ' on' : ''}`}
                                    title="Elegir color de resaltado"
                                    aria-label="Elegir color de resaltado"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        const abrir = !menuResaltado;
                                        cerrarMenus();
                                        setMenuResaltado(abrir);
                                    }}
                                >
                                    ▾
                                </button>
                            </div>

                            {menuResaltado && (
                                <div
                                    className="ed-popover-menu ed-popover-hl"
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <div className="ed-pop-tit">Color de resaltado</div>
                                    <div className="ed-hl-grid">
                                        {COLORES_RESALTADO.map((c) => (
                                            <button
                                                key={c.valor}
                                                type="button"
                                                className={`ed-hl-swatch${(formato.resaltado ?? colorActual) === c.valor ? ' on' : ''}`}
                                                title={c.etiqueta}
                                                style={{ background: c.hex }}
                                                onClick={() => {
                                                    setColorActual(c.valor);
                                                    h.current?.resaltar(c.valor);
                                                    setMenuResaltado(false);
                                                }}
                                            >
                                                <span>{c.etiqueta}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className="ed-hl-quitar"
                                        onClick={() => {
                                            h.current?.resaltar(null);
                                            setMenuResaltado(false);
                                        }}
                                    >
                                        Sin resaltado
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* 2. Párrafo: alineación, viñetas, numeración y sangría */}
                <section className="ed-modulo" aria-label="Párrafo">
                    <span className="ed-mod-tit">Párrafo</span>
                    <div className="ed-mod-fila">
                        <div className="ed-subgrupo" role="group" aria-label="Alineación">
                            {ALINEACIONES.map((a) => (
                                <Tb key={a} titulo={ETIQ_ALIN[a]} activo={formato.alineacion === a} onClick={() => h.current?.alinear(a)}>
                                    <Ico d={ICO_ALIN[a]} />
                                </Tb>
                            ))}
                        </div>

                        {/* Viñetas con selector de estilo */}
                        <div className="ed-split-wrap" ref={refWrapUl}>
                            <div className="ed-subgrupo" role="group" aria-label="Viñetas">
                                <Tb
                                    titulo="Lista con viñetas (o escribe «- » al inicio del párrafo)"
                                    activo={esVinetaActiva}
                                    onClick={() => {
                                        h.current?.lista(esVinetaActiva ? null : vinetaActual);
                                        cerrarMenus();
                                    }}
                                >
                                    <Ico d={ICO.vinetas} />
                                </Tb>
                                <button
                                    type="button"
                                    className={`ed-tb ed-tb-chev${menuVinetas ? ' on' : ''}`}
                                    title="Elegir estilo de viñeta"
                                    aria-label="Elegir estilo de viñeta"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        const abrir = !menuVinetas;
                                        cerrarMenus();
                                        setMenuVinetas(abrir);
                                    }}
                                >
                                    ▾
                                </button>
                            </div>

                            {menuVinetas && (
                                <div
                                    className="ed-popover-menu ed-popover-lista"
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <div className="ed-pop-tit">Biblioteca de viñetas</div>
                                    <div className="ed-lista-grid">
                                        {ESTILOS_VINETA.map((v) => (
                                            <button
                                                key={v.valor}
                                                type="button"
                                                className={`ed-lista-card${formato.lista === v.valor ? ' on' : ''}`}
                                                title={v.etiqueta}
                                                onClick={() => {
                                                    setVinetaActual(v.valor);
                                                    h.current?.lista(v.valor);
                                                    setMenuVinetas(false);
                                                }}
                                            >
                                                <span className="ed-lista-muestra">
                                                    <span><i>{v.simbolo}</i><em /></span>
                                                    <span><i>{v.simbolo}</i><em /></span>
                                                    <span><i>{v.simbolo}</i><em /></span>
                                                </span>
                                                <small>{v.etiqueta}</small>
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className="ed-hl-quitar"
                                        onClick={() => {
                                            h.current?.lista(null);
                                            setMenuVinetas(false);
                                        }}
                                    >
                                        Ninguna
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Numeración con selector de formato */}
                        <div className="ed-split-wrap" ref={refWrapOl}>
                            <div className="ed-subgrupo" role="group" aria-label="Numeración">
                                <Tb
                                    titulo="Lista numerada (o escribe «1. » al inicio del párrafo)"
                                    activo={esNumActiva}
                                    onClick={() => {
                                        h.current?.lista(esNumActiva ? null : numeracionActual);
                                        cerrarMenus();
                                    }}
                                >
                                    <Ico d={ICO.numeracion} />
                                </Tb>
                                <button
                                    type="button"
                                    className={`ed-tb ed-tb-chev${menuNumeracion ? ' on' : ''}`}
                                    title="Elegir formato de numeración"
                                    aria-label="Elegir formato de numeración"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        const abrir = !menuNumeracion;
                                        cerrarMenus();
                                        setMenuNumeracion(abrir);
                                    }}
                                >
                                    ▾
                                </button>
                            </div>

                            {menuNumeracion && (
                                <div
                                    className="ed-popover-menu ed-popover-lista"
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <div className="ed-pop-tit">Biblioteca de numeración</div>
                                    <div className="ed-lista-grid">
                                        {ESTILOS_NUMERACION.map((n) => (
                                            <button
                                                key={n.valor}
                                                type="button"
                                                className={`ed-lista-card${formato.lista === n.valor ? ' on' : ''}`}
                                                title={n.etiqueta}
                                                onClick={() => {
                                                    setNumeracionActual(n.valor);
                                                    h.current?.lista(n.valor);
                                                    setMenuNumeracion(false);
                                                }}
                                            >
                                                <span className="ed-lista-muestra">
                                                    {n.muestra.map((m, idx) => (
                                                        <span key={idx}><i>{m}</i><em /></span>
                                                    ))}
                                                </span>
                                                <small>{n.etiqueta.split(' (')[0]}</small>
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className="ed-hl-quitar"
                                        onClick={() => {
                                            h.current?.lista(null);
                                            setMenuNumeracion(false);
                                        }}
                                    >
                                        Ninguna
                                    </button>
                                </div>
                            )}
                        </div>

                        <Tb titulo="Sangría de primera línea (1,25 cm)" activo={config.sangria} onClick={() => onConfig({ ...config, sangria: !config.sangria })}>
                            <Ico d={ICO.sangria} />
                        </Tb>
                    </div>
                </section>

                {/* 3. Espaciado: interlineado + espacio antes y después del párrafo */}
                <section className="ed-modulo" aria-label="Espaciado">
                    <span className="ed-mod-tit">Espaciado</span>
                    <div className="ed-mod-fila">
                        <div className="ed-control-icono" title="Interlineado del párrafo">
                            <Ico d={ICO.interlineado} />
                            <SelectInterlineado valor={formato.interlineado ?? config.interlineado} onCambio={(n) => h.current?.interlineado(n)} />
                        </div>
                        <label className="ed-espacio-chip" title="Espacio antes del párrafo (pt)">
                            <Ico d={ICO.espacioAntes} />
                            <input
                                type="number"
                                min={0}
                                max={ESPACIO_MAX_PT}
                                step={1}
                                value={config.espacioAntes}
                                aria-label="Espacio antes del párrafo en puntos"
                                onChange={(e) => ajustarEspacio('espacioAntes', e.target.value)}
                            />
                        </label>
                        <label className="ed-espacio-chip" title="Espacio después del párrafo (pt)">
                            <Ico d={ICO.espacioDespues} />
                            <input
                                type="number"
                                min={0}
                                max={ESPACIO_MAX_PT}
                                step={1}
                                value={config.espacioDespues}
                                aria-label="Espacio después del párrafo en puntos"
                                onChange={(e) => ajustarEspacio('espacioDespues', e.target.value)}
                            />
                        </label>
                    </div>
                </section>

                {/* 4. Estructura: tablas, columnas y firma */}
                <section className="ed-modulo" aria-label="Estructura">
                    <span className="ed-mod-tit">Estructura</span>
                    <div className="ed-mod-fila">
                        <div className="ed-split-wrap" ref={refWrapTabla}>
                            <Tb
                                titulo={formato.enTabla ? 'Opciones de tabla' : 'Insertar tabla en el documento'}
                                activo={menuTabla || formato.enTabla}
                                onClick={() => {
                                    const abrir = !menuTabla;
                                    cerrarMenus();
                                    setMenuTabla(abrir);
                                }}
                            >
                                <Ico d={ICO.tabla} />
                                <span className="ed-chev-mini">▾</span>
                            </Tb>

                            {menuTabla && (
                                <div
                                    className="ed-popover-menu ed-popover-tabla"
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <div className="ed-pop-tit">
                                        Insertar tabla de {hoverFilas} × {hoverCols}
                                    </div>
                                    <div className="ed-tabla-picker">
                                        {[1, 2, 3, 4, 5, 6].map((f) => (
                                            <div key={f} className="ed-tabla-picker-fila">
                                                {[1, 2, 3, 4, 5, 6].map((c) => {
                                                    const on = f <= hoverFilas && c <= hoverCols;
                                                    return (
                                                        <button
                                                            key={c}
                                                            type="button"
                                                            className={`ed-tabla-celda-pick${on ? ' on' : ''}`}
                                                            aria-label={`Insertar tabla de ${f} filas por ${c} columnas`}
                                                            onMouseEnter={() => {
                                                                setHoverFilas(f);
                                                                setHoverCols(c);
                                                            }}
                                                            onClick={() => {
                                                                h.current?.insertarTabla(f, c);
                                                                setMenuTabla(false);
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>

                                    {formato.enTabla && (
                                        <div className="ed-tabla-acciones-menu">
                                            <div className="ed-pop-tit">Editar tabla actual</div>
                                            <div className="ed-tabla-acc-grid">
                                                <button type="button" onClick={() => h.current?.accionTabla('filaArriba')}>
                                                    + Fila arriba
                                                </button>
                                                <button type="button" onClick={() => h.current?.accionTabla('filaAbajo')}>
                                                    + Fila abajo
                                                </button>
                                                <button type="button" onClick={() => h.current?.accionTabla('colIzquierda')}>
                                                    + Col. izq.
                                                </button>
                                                <button type="button" onClick={() => h.current?.accionTabla('colDerecha')}>
                                                    + Col. der.
                                                </button>
                                                <button type="button" onClick={() => h.current?.accionTabla('alternarEncabezado')}>
                                                    Alternar encabezado
                                                </button>
                                                <button type="button" onClick={() => h.current?.accionTabla('eliminarFila')}>
                                                    − Eliminar fila
                                                </button>
                                                <button type="button" onClick={() => h.current?.accionTabla('eliminarColumna')}>
                                                    − Eliminar col.
                                                </button>
                                                <button
                                                    type="button"
                                                    className="peligro"
                                                    onClick={() => { h.current?.accionTabla('eliminarTabla'); setMenuTabla(false); }}
                                                >
                                                    Eliminar tabla
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="ed-control-icono" title="Columnas de lo seleccionado">
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
                            </Tb>
                        )}
                        {conFirma && (
                            <Tb titulo="Insertar línea de firma centrada" onClick={() => h.current?.insertar('[c] ______________________________', true)}>
                                <Ico d={ICO.firma} />
                            </Tb>
                        )}
                    </div>
                </section>

                {/* 5. Redacción: sinónimos y revisión inteligente */}
                <section className="ed-modulo" aria-label="Redacción">
                    <span className="ed-mod-tit">Redacción</span>
                    <div className="ed-mod-fila">
                        <div className="ed-subgrupo">
                            <Tb
                                titulo="Sinónimos jurídicos y mejora de léxico (Ctrl+.)"
                                activo={panelObservador === 'sinonimos'}
                                onClick={() => {
                                    h.current?.abrirSinonimos();
                                    onAbrirObservador?.('sinonimos');
                                }}
                            >
                                <Ico d={ICO.sinonimos} />
                            </Tb>
                            <Tb
                                titulo="Observador inteligente de ortografía, puntuación, gramática y estilo forense"
                                activo={panelObservador === 'revision'}
                                onClick={() => onAbrirObservador?.('revision')}
                            >
                                <Ico d={ICO.observador} />
                                <span className={`ed-badge-obs${conteoObs > 0 ? ' alerta' : ' ok'}`}>
                                    {conteoObs > 0 ? conteoObs : '✓'}
                                </span>
                            </Tb>
                        </div>
                    </div>
                </section>

                {/* 6. Herramientas del documento / asistencia */}
                {children && (
                    <section className="ed-modulo ed-modulo-der" aria-label="Herramientas">
                        <span className="ed-mod-tit">Herramientas</span>
                        <div className="ed-mod-fila">{children}</div>
                    </section>
                )}
            </fieldset>
        </div>
    );
}
