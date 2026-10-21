import { useId, useMemo, type KeyboardEvent, type Ref } from 'react';
import { partirLineas, type DisposicionFlujo, type Paso, type TipoPaso } from '../../domain/procedimientos/procedimientos';
import './procedimientos.css';

export const COLOR_PASO: Record<TipoPaso, { fondo: string; borde: string }> = {
    inicio: { fondo: '#e3f6ea', borde: '#2e9e5b' },
    accion: { fondo: '#eaf0ff', borde: '#4a6be0' },
    documento: { fondo: '#f1ecff', borde: '#7b5bd6' },
    decision: { fondo: '#fff3d6', borde: '#d99a1f' },
    espera: { fondo: '#fdeadb', borde: '#d9742a' },
    fin: { fondo: '#fde8e6', borde: '#c9473b' },
};

const LIMITE: Record<TipoPaso, { max: number; lineas: number }> = {
    inicio: { max: 28, lineas: 2 },
    fin: { max: 28, lineas: 2 },
    accion: { max: 27, lineas: 3 },
    documento: { max: 27, lineas: 3 },
    espera: { max: 24, lineas: 3 },
    decision: { max: 20, lineas: 3 },
};

const TINTA = '#14192b';
const PRIMARIO = '#3556d8';
const FUENTE = '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';

function Forma({ tipo, w, h, fondo, borde, grosor }: {
    tipo: TipoPaso; w: number; h: number; fondo: string; borde: string; grosor: number;
}) {
    const comun = { className: 'fl-forma', fill: fondo, stroke: borde, strokeWidth: grosor, strokeLinejoin: 'round' } as const;
    switch (tipo) {
        case 'inicio':
        case 'fin':
            return <rect {...comun} width={w} height={h} rx={h / 2} />;
        case 'decision':
            return <polygon {...comun} points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} />;
        case 'espera':
            return <polygon {...comun} points={`16,0 ${w - 16},0 ${w},${h / 2} ${w - 16},${h} 16,${h} 0,${h / 2}`} />;
        case 'documento':
            return <path {...comun} d={`M0 0H${w}V${h - 10}q${-w / 4} 14 ${-w / 2} 0t${-w / 2} 0Z`} />;
        default:
            return <rect {...comun} width={w} height={h} rx={8} />;
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
    escala: number;
    svgRef?: Ref<SVGSVGElement>;
    onElegir: (id: string | null) => void;
}

/** Flujograma en SVG puro (sin CSS externo): se puede exportar tal cual. */
export function Flujograma({ disp, pasos, actual, nodosOn, aristasOn, escala, svgRef, onElegir }: Props) {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const mapa = useMemo(() => new Map(pasos.map((p) => [p.id, p] as const)), [pasos]);
    const resalta = nodosOn.size > 0;
    const flecha = `fl${uid}`;

    const teclas = (e: KeyboardEvent<SVGGElement>, id: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onElegir(id);
        }
    };

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
                <marker id={flecha} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M0 0L10 5L0 10z" fill="#8a93a8" />
                </marker>
                <marker id={`${flecha}on`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M0 0L10 5L0 10z" fill={PRIMARIO} />
                </marker>
            </defs>

            <rect width={disp.ancho} height={disp.alto} fill="#ffffff" />

            {/* Carriles */}
            {disp.carriles.map((c, i) => (
                <g key={`${c.nombre}-${i}`}>
                    <rect x={c.x} y={0} width={c.w} height={disp.alto} fill={i % 2 ? '#ffffff' : '#f5f6fa'} stroke="#dde1ea" />
                    {disp.cabecera > 0 && (
                        <>
                            <rect x={c.x} y={0} width={c.w} height={disp.cabecera} fill="#e9ecf4" stroke="#dde1ea" />
                            <text x={c.x + c.w / 2} y={disp.cabecera / 2 + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill="#33405f">
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
                const ancho = Math.max(20, e.etiqueta.length * 6.4 + 12);
                return (
                    <g key={`${e.de}>${e.a}`} opacity={!resalta || on ? 1 : 0.25} pointerEvents="none">
                        <path
                            d={e.d} fill="none" stroke={on ? PRIMARIO : '#8a93a8'} strokeWidth={on ? 2.2 : 1.5}
                            strokeDasharray={e.retorno ? '5 4' : undefined}
                            markerEnd={`url(#${on ? `${flecha}on` : flecha})`}
                        />
                        {e.etiqueta && (
                            <>
                                <rect x={e.lx - ancho / 2} y={e.ly - 10} width={ancho} height={16} rx={4} fill="#ffffff" stroke={on ? PRIMARIO : '#d7dbe6'} />
                                <text x={e.lx} y={e.ly + 1.5} textAnchor="middle" fontSize={11} fontWeight={600} fill={on ? PRIMARIO : '#4a5268'}>
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
                const y0 = n.h / 2 - ((lineas.length - 1) * 14) / 2 + 4.5;
                const tip = [p.titulo, p.responsable, p.plazo && `Plazo: ${p.plazo}`, p.requisitos.length > 0 && `${p.requisitos.length} requisito(s)`]
                    .filter(Boolean).join(' · ');
                return (
                    <g
                        key={n.id} className="fl-nodo" transform={`translate(${n.x} ${n.y})`} role="button" tabIndex={0}
                        aria-label={`${p.titulo}${p.responsable ? `, ${p.responsable}` : ''}`}
                        opacity={on ? 1 : 0.32}
                        onClick={(ev) => { ev.stopPropagation(); onElegir(n.id); }}
                        onKeyDown={(ev) => teclas(ev, n.id)}
                    >
                        <title>{tip}</title>
                        <Forma
                            tipo={p.tipo} w={n.w} h={n.h} fondo={col.fondo}
                            borde={sel ? PRIMARIO : col.borde} grosor={sel ? 3 : 1.6}
                        />
                        <text textAnchor="middle" fontSize={12.5} fontWeight={600} fill={TINTA} pointerEvents="none">
                            {lineas.map((l, i) => <tspan key={i} x={n.w / 2} y={y0 + i * 14}>{l}</tspan>)}
                        </text>
                        {p.requisitos.length > 0 && (
                            <g transform={`translate(${p.tipo === 'decision' ? n.w - 38 : n.w - 8} ${p.tipo === 'decision' ? 16 : 2})`} pointerEvents="none">
                                <circle r={10} fill={PRIMARIO} stroke="#ffffff" strokeWidth={2} />
                                <text y={4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#ffffff">{p.requisitos.length}</text>
                            </g>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}