import { useId, useMemo, type KeyboardEvent, type Ref } from 'react';
import { partirLineas, type DisposicionFlujo, type Paso, type TipoPaso } from '../../domain/procedimientos/procedimientos';
import './procedimientos.css';

export interface EstiloPaso {
    fondo: string;
    borde: string;
    acento: string;
    texto: string;
    degrade: [string, string];
    fondoOscuro: string;
    bordeOscuro: string;
    acentoOscuro: string;
    textoOscuro: string;
    degradeOscuro: [string, string];
}

export const COLOR_PASO: Record<TipoPaso, EstiloPaso> = {
    inicio: {
        fondo: '#dcfce7',
        borde: '#15803d',
        acento: '#16a34a',
        texto: '#14532d',
        degrade: ['#f0fdf4', '#bbf7d0'],
        fondoOscuro: '#064e3b',
        bordeOscuro: '#34d399',
        acentoOscuro: '#10b981',
        textoOscuro: '#ecfdf5',
        degradeOscuro: ['#065f46', '#022c22'],
    },
    accion: {
        fondo: '#dbeafe',
        borde: '#1d4ed8',
        acento: '#2563eb',
        texto: '#1e3a8a',
        degrade: ['#eff6ff', '#bfdbfe'],
        fondoOscuro: '#1e3a8a',
        bordeOscuro: '#60a5fa',
        acentoOscuro: '#3b82f6',
        textoOscuro: '#eff6ff',
        degradeOscuro: ['#1e40af', '#0f172a'],
    },
    documento: {
        fondo: '#f3e8ff',
        borde: '#7e22ce',
        acento: '#9333ea',
        texto: '#581c87',
        degrade: ['#faf5ff', '#e9d5ff'],
        fondoOscuro: '#4c1d95',
        bordeOscuro: '#c084fc',
        acentoOscuro: '#a855f7',
        textoOscuro: '#faf5ff',
        degradeOscuro: ['#581c87', '#1e1035'],
    },
    decision: {
        fondo: '#fef3c7',
        borde: '#b45309',
        acento: '#d97706',
        texto: '#78350f',
        degrade: ['#fffbeb', '#fde68a'],
        fondoOscuro: '#78350f',
        bordeOscuro: '#fbbf24',
        acentoOscuro: '#f59e0b',
        textoOscuro: '#fef3c7',
        degradeOscuro: ['#854d0e', '#291804'],
    },
    espera: {
        fondo: '#ffedd5',
        borde: '#c2410c',
        acento: '#ea580c',
        texto: '#7c2d12',
        degrade: ['#fff7ed', '#fed7aa'],
        fondoOscuro: '#7c2d12',
        bordeOscuro: '#fb923c',
        acentoOscuro: '#f97316',
        textoOscuro: '#fff7ed',
        degradeOscuro: ['#9a3412', '#2a0e05'],
    },
    fin: {
        fondo: '#fee2e2',
        borde: '#b91c1c',
        acento: '#dc2626',
        texto: '#7f1d1d',
        degrade: ['#fef2f2', '#fecaca'],
        fondoOscuro: '#7f1d1d',
        bordeOscuro: '#f87171',
        acentoOscuro: '#ef4444',
        textoOscuro: '#fef2f2',
        degradeOscuro: ['#991b1b', '#300808'],
    },
};

const LIMITE: Record<TipoPaso, { max: number; lineas: number }> = {
    inicio: { max: 28, lineas: 2 },
    fin: { max: 28, lineas: 2 },
    accion: { max: 27, lineas: 3 },
    documento: { max: 27, lineas: 3 },
    espera: { max: 24, lineas: 3 },
    decision: { max: 20, lineas: 3 },
};

const FUENTE = '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif';

function Forma({ tipo, w, h, gradId, borde, grosor }: {
    tipo: TipoPaso; w: number; h: number; gradId: string; borde: string; grosor: number;
}) {
    const comun = {
        className: 'fl-forma',
        fill: `url(#${gradId})`,
        stroke: borde,
        strokeWidth: grosor,
        strokeLinejoin: 'round' as const,
    };
    switch (tipo) {
        case 'inicio':
        case 'fin':
            return <rect {...comun} width={w} height={h} rx={h / 2} />;
        case 'decision':
            return <polygon {...comun} points={`${w / 2},2 ${w - 2},${h / 2} ${w / 2},${h - 2} 2,${h / 2}`} />;
        case 'espera':
            return <polygon {...comun} points={`16,0 ${w - 16},0 ${w},${h / 2} ${w - 16},${h} 16,${h} 0,${h / 2}`} />;
        case 'documento':
            return <path {...comun} d={`M0 0H${w}V${h - 12}q${-w / 4} 16 ${-w / 2} 0t${-w / 2} 0Z`} />;
        default:
            return <rect {...comun} width={w} height={h} rx={10} />;
    }
}

interface Props {
    disp: DisposicionFlujo;
    pasos: readonly Paso[];
    /** Paso seleccionado o actual del recorrido. */
    actual: string | null;
    /** Si no está vacío, lo que no esté aquí se atenúa. */
    nodosOn: ReadonlySet<string>;
    /** Conexiones resaltadas: «idOrigen>idDestino». */
    aristasOn: ReadonlySet<string>;
    escala?: number;
    svgRef?: Ref<SVGSVGElement>;
    onElegir: (id: string | null) => void;
    esOscuro?: boolean;
}

/** Flujograma en SVG puro (sin CSS externo): se puede exportar tal cual con calidad ejecutiva. */
export function Flujograma({ disp, pasos, actual, nodosOn, aristasOn, escala = 1, svgRef, onElegir, esOscuro = false }: Props) {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const mapa = useMemo(() => new Map(pasos.map((p) => [p.id, p] as const)), [pasos]);
    const resalta = nodosOn.size > 0;
    const flecha = `fl${uid}`;
    const primario = esOscuro ? '#38bdf8' : '#2563eb';

    const teclas = (e: KeyboardEvent<SVGGElement>, id: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onElegir(id);
        }
    };

    const tipos = Object.keys(COLOR_PASO) as TipoPaso[];

    return (
        <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            role="group"
            aria-label="Flujograma del procedimiento"
            width={disp.ancho * escala}
            height={disp.alto * escala}
            viewBox={`0 0 ${disp.ancho} ${disp.alto}`}
            fontFamily={FUENTE}
        >
            <defs>
                <filter id={`${flecha}sombra`} x="-15%" y="-15%" width="130%" height="130%">
                    <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor={esOscuro ? '#000000' : '#0f172a'} floodOpacity={esOscuro ? 0.55 : 0.1} />
                </filter>
                <filter id={`${flecha}sel`} x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={primario} floodOpacity={esOscuro ? 0.8 : 0.55} />
                    <feDropShadow dx="0" dy="2" stdDeviation="7" floodColor={primario} floodOpacity={esOscuro ? 0.35 : 0.25} />
                </filter>
                <linearGradient id={`${flecha}carril`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={esOscuro ? '#232b3a' : '#f8fafc'} />
                    <stop offset="100%" stopColor={esOscuro ? '#18202d' : '#f1f5f9'} />
                </linearGradient>
                {tipos.map((t) => {
                    const col = COLOR_PASO[t];
                    const par = esOscuro ? col.degradeOscuro : col.degrade;
                    return (
                        <linearGradient key={t} id={`${flecha}grad-${t}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={par[0]} />
                            <stop offset="100%" stopColor={par[1]} />
                        </linearGradient>
                    );
                })}
                <marker id={flecha} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M0 1.5L8 5L0 8.5z" fill={esOscuro ? '#64748b' : '#94a3b8'} />
                </marker>
                <marker id={`${flecha}on`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M0 1.5L8 5L0 8.5z" fill={primario} />
                </marker>
            </defs>

            <rect width={disp.ancho} height={disp.alto} fill={esOscuro ? '#141923' : '#ffffff'} rx={8} />

            {/* Carriles */}
            {disp.carriles.map((c, i) => (
                <g key={`${c.nombre}-${i}`}>
                    <rect
                        x={c.x}
                        y={0}
                        width={c.w}
                        height={disp.alto}
                        fill={esOscuro ? (i % 2 === 0 ? '#141923' : '#18202d') : (i % 2 === 0 ? '#ffffff' : '#f8fafc')}
                        stroke={esOscuro ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}
                        strokeWidth={1}
                    />
                    {disp.cabecera > 0 && (
                        <>
                            <rect
                                x={c.x}
                                y={0}
                                width={c.w}
                                height={disp.cabecera}
                                fill={`url(#${flecha}carril)`}
                                stroke={esOscuro ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}
                                strokeWidth={1}
                            />
                            <rect
                                x={c.x}
                                y={disp.cabecera - 2}
                                width={c.w}
                                height={2}
                                fill={esOscuro ? '#60a5fa' : '#2563eb'}
                                opacity={esOscuro ? 0.9 : 0.7}
                            />
                            <text
                                x={c.x + c.w / 2}
                                y={disp.cabecera / 2 + 5}
                                textAnchor="middle"
                                fontSize={13}
                                fontWeight={700}
                                fill={esOscuro ? '#f1f5f9' : '#1e293b'}
                                letterSpacing="0.02em"
                            >
                                {c.nombre.length > 30 ? `${c.nombre.slice(0, 29)}…` : c.nombre}
                            </text>
                        </>
                    )}
                </g>
            ))}

            {/* Un clic en el fondo quita la selección */}
            <rect width={disp.ancho} height={disp.alto} fill="transparent" onClick={() => onElegir(null)} />

            {/* Conexiones */}
            {disp.enlaces.map((e) => {
                const on = aristasOn.has(`${e.de}>${e.a}`);
                const ancho = Math.max(22, e.etiqueta.length * 6.5 + 14);
                return (
                    <g key={`${e.de}>${e.a}`} opacity={!resalta || on ? 1 : 0.25} pointerEvents="none">
                        <path
                            d={e.d}
                            fill="none"
                            stroke={on ? primario : (esOscuro ? '#64748b' : '#94a3b8')}
                            strokeWidth={on ? 2.5 : 1.7}
                            strokeDasharray={e.retorno ? '6 4' : undefined}
                            markerEnd={`url(#${on ? `${flecha}on` : flecha})`}
                        />
                        {e.etiqueta && (
                            <>
                                <rect
                                    x={e.lx - ancho / 2}
                                    y={e.ly - 10}
                                    width={ancho}
                                    height={18}
                                    rx={6}
                                    fill={esOscuro ? '#1e2636' : '#ffffff'}
                                    stroke={on ? primario : (esOscuro ? 'rgba(255, 255, 255, 0.2)' : '#cbd5e1')}
                                    strokeWidth={1.4}
                                    filter={`url(#${flecha}sombra)`}
                                />
                                <text
                                    x={e.lx}
                                    y={e.ly + 2.5}
                                    textAnchor="middle"
                                    fontSize={11}
                                    fontWeight={650}
                                    fill={on ? primario : (esOscuro ? '#e2e8f0' : '#334155')}
                                >
                                    {e.etiqueta}
                                </text>
                            </>
                        )}
                    </g>
                );
            })}

            {/* Pasos */}
            {disp.nodos.map((n) => {
                const p = mapa.get(n.id);
                if (!p) return null;
                const sel = actual === n.id;
                const on = !resalta || nodosOn.has(n.id);
                const col = COLOR_PASO[p.tipo];
                const lim = LIMITE[p.tipo];
                const lineas = partirLineas(p.titulo, lim.max, lim.lineas);
                const y0 = n.h / 2 - ((lineas.length - 1) * 15) / 2 + 4.5;
                const tip = [p.titulo, p.responsable, p.plazo && `Plazo: ${p.plazo}`, p.requisitos.length > 0 && `${p.requisitos.length} requisito(s)`]
                    .filter(Boolean).join(' · ');
                const bordeColor = sel ? primario : (esOscuro ? col.bordeOscuro : col.borde);
                const textoColor = esOscuro ? col.textoOscuro : col.texto;

                return (
                    <g
                        key={n.id}
                        className="fl-nodo"
                        transform={`translate(${n.x} ${n.y})`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${p.titulo}${p.responsable ? `, ${p.responsable}` : ''}`}
                        opacity={on ? 1 : 0.28}
                        filter={sel ? `url(#${flecha}sel)` : `url(#${flecha}sombra)`}
                        onClick={(ev) => { ev.stopPropagation(); onElegir(n.id); }}
                        onKeyDown={(ev) => teclas(ev, n.id)}
                    >
                        <title>{tip}</title>
                        <Forma
                            tipo={p.tipo}
                            w={n.w}
                            h={n.h}
                            gradId={`${flecha}grad-${p.tipo}`}
                            borde={bordeColor}
                            grosor={sel ? 2.8 : 2.2}
                        />
                        <text
                            textAnchor="middle"
                            fontSize={12.5}
                            fontWeight={650}
                            fill={textoColor}
                            pointerEvents="none"
                        >
                            {lineas.map((l, i) => <tspan key={i} x={n.w / 2} y={y0 + i * 15}>{l}</tspan>)}
                        </text>
                        {p.requisitos.length > 0 && (
                            <g transform={`translate(${p.tipo === 'decision' ? n.w - 38 : n.w - 8} ${p.tipo === 'decision' ? 16 : 2})`} pointerEvents="none">
                                <circle r={10} fill={primario} stroke={esOscuro ? '#141923' : '#ffffff'} strokeWidth={2.2} />
                                <text y={3.5} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#ffffff">{p.requisitos.length}</text>
                            </g>
                        )}
                    </g>
                );
            })}

            {/* Borde exterior del diagrama */}
            <rect width={disp.ancho} height={disp.alto} fill="none" stroke={esOscuro ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'} strokeWidth={1.5} rx={8} pointerEvents="none" />
        </svg>
    );
}