import { useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { AREA_MIN_CM, type Margenes } from '../domain/fuenteModelo';

const PX_POR_CM = 37.7953;
const GROSOR = 20;
const ZONA = 12; // ancho de la zona sensible de cada asa

export type LadoMargen = keyof Margenes;

const NOMBRE: Record<LadoMargen, string> = {
    superior: 'Superior', inferior: 'Inferior', izquierdo: 'Izquierdo', derecho: 'Derecho',
};
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

interface Props {
    orientacion: 'h' | 'v';
    /** Largo de la hoja en cm (ancho para la horizontal, alto para la vertical). */
    largoCm: number;
    escala: number;
    /** Margen al inicio (izquierdo o superior) y al final (derecho o inferior), en cm. */
    ini: number;
    fin: number;
    ladoIni: LadoMargen;
    ladoFin: LadoMargen;
    onCambio: (lado: LadoMargen, cm: number) => void;
    onAbrir: () => void;
}

export function Regla({ orientacion, largoCm, escala, ini, fin, ladoIni, ladoFin, onCambio, onAbrir }: Props) {
    const h = orientacion === 'h';
    const px = PX_POR_CM * escala;
    const largo = largoCm * px;
    const caja = useRef<HTMLDivElement>(null);
    const activo = useRef<LadoMargen | null>(null);
    const ultimo = useRef<number | null>(null);
    const [arr, setArr] = useState<{ lado: LadoMargen; cm: number } | null>(null);

    const marcas = useMemo(() => {
        const salida: ReactNode[] = [];
        const desde = -Math.floor(ini * 2 + 1e-6);
        const hasta = Math.floor((largoCm - ini) * 2 + 1e-6);
        for (let d = desde; d <= hasta; d++) {
            const p = (ini + d / 2) * px;
            const entero = d % 2 === 0;
            if (entero && d !== 0) {
                const n = String(Math.abs(d / 2));
                salida.push(
                    h
                        ? <text key={`n${d}`} className="regla-num" x={p} y={14} textAnchor="middle">{n}</text>
                        : <text key={`n${d}`} className="regla-num" x={GROSOR / 2} y={p + 3.5} textAnchor="middle">{n}</text>,
                );
                continue;
            }
            const a = (GROSOR - (entero ? 10 : 4)) / 2;
            const b = GROSOR - a;
            salida.push(
                h
                    ? <line key={`m${d}`} className="regla-marca" x1={p} x2={p} y1={a} y2={b} />
                    : <line key={`m${d}`} className="regla-marca" x1={a} x2={b} y1={p} y2={p} />,
            );
        }
        return salida;
    }, [largoCm, ini, px, h]);

    function calcular(e: PointerEvent<Element>, lado: LadoMargen): number {
        const r = caja.current?.getBoundingClientRect();
        if (!r) return lado === ladoIni ? ini : fin;
        const pos = (h ? e.clientX - r.left : e.clientY - r.top) / px; // cm desde el borde del papel
        const desdeIni = lado === ladoIni;
        const medida = desdeIni ? pos : largoCm - pos;
        const otro = desdeIni ? fin : ini;
        const tope = Math.max(0, Math.floor((largoCm - otro - AREA_MIN_CM) * 10) / 10);
        return Math.min(tope, Math.max(0, Math.round(medida * 10) / 10));
    }

    function bajar(e: PointerEvent<SVGRectElement>, lado: LadoMargen) {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        activo.current = lado;
        ultimo.current = lado === ladoIni ? ini : fin;
        setArr({ lado, cm: ultimo.current });
    }

    function mover(e: PointerEvent<SVGRectElement>, lado: LadoMargen) {
        if (activo.current !== lado) return;
        const v = calcular(e, lado);
        if (v === ultimo.current) return;
        ultimo.current = v;
        setArr({ lado, cm: v });
        onCambio(lado, v);
    }

    function soltar(e: PointerEvent<SVGRectElement>, lado: LadoMargen) {
        if (activo.current !== lado) return;
        activo.current = null;
        ultimo.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        setArr(null);
    }

    const rect = (clase: string, centro: number, grueso: number) =>
        h
            ? { className: clase, x: centro - grueso / 2, y: 0, width: grueso, height: GROSOR }
            : { className: clase, x: 0, y: centro - grueso / 2, width: GROSOR, height: grueso };

    const asa = (lado: LadoMargen, valor: number) => {
        const pos = (lado === ladoIni ? valor : largoCm - valor) * px;
        return (
            <g key={lado}>
                <rect {...rect('regla-asa', pos, 3)} />
                <rect
                    {...rect('regla-asa-zona', pos, ZONA)}
                    onPointerDown={(e) => bajar(e, lado)}
                    onPointerMove={(e) => mover(e, lado)}
                    onPointerUp={(e) => soltar(e, lado)}
                    onPointerCancel={(e) => soltar(e, lado)}
                >
                    <title>{`Margen ${NOMBRE[lado].toLowerCase()}: ${fmt(valor)} cm · arrastra para cambiarlo · doble clic: configurar página`}</title>
                </rect>
            </g>
        );
    };

    const posTip = arr ? (arr.lado === ladoIni ? arr.cm : largoCm - arr.cm) * px : 0;

    return (
        <div
            ref={caja}
            className={`regla regla-${orientacion}`}
            style={{ width: h ? largo : GROSOR, height: h ? GROSOR : largo }}
            onMouseDown={(e) => e.preventDefault()}
            onDoubleClick={onAbrir}
        >
            <svg width={h ? largo : GROSOR} height={h ? GROSOR : largo} aria-hidden="true">
                <rect
                    className="regla-zona"
                    x={0} y={0} width={h ? largo : GROSOR} height={h ? GROSOR : largo}
                />
                <rect
                    className="regla-papel"
                    {...(h
                        ? { x: ini * px, y: 0, width: Math.max(0, (largoCm - ini - fin) * px), height: GROSOR }
                        : { x: 0, y: ini * px, width: GROSOR, height: Math.max(0, (largoCm - ini - fin) * px) })}
                />
                {marcas}
                {asa(ladoIni, ini)}
                {asa(ladoFin, fin)}
            </svg>
            {arr && (
                <div className="regla-tip" style={h ? { left: posTip + 8, top: GROSOR + 6 } : { top: posTip, left: GROSOR + 6 }}>
                    {NOMBRE[arr.lado]}: {fmt(arr.cm)} cm
                </div>
            )}
        </div>
    );
}