import {
    memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
    type CSSProperties, type Ref,
} from 'react';
import 'pdfjs-dist/web/pdf_viewer.css';
import {
    RenderingCancelledException, TextLayer, getDocument,
    type PDFDocumentProxy, type RenderTask,
} from '../infrastructure/pdf/pdfjs';
import './leyes.css';
import { mensajeError } from './servicios';

export interface ControlVisor { irA(pagina: number): void }

const GAP = 12;
const PAD = 16;

interface Tam { w: number; h: number }

/** Mayor índice con tops[i] <= y. */
function buscarIndice(tops: readonly number[], y: number): number {
    let lo = 0;
    let hi = tops.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (tops[mid] <= y) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}

/** Una hoja: canvas + capa de texto (seleccionable). Solo existe mientras está cerca de la pantalla. */
const PaginaPdf = memo(function PaginaPdf({ doc, numero, escala, ancho, alto, izq, arriba }: {
    doc: PDFDocumentProxy; numero: number; escala: number; ancho: number; alto: number; izq: number; arriba: number;
}) {
    const cont = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = cont.current;
        if (!el) return;
        let vivo = true;
        const est: { tarea: RenderTask | null; capa: TextLayer | null } = { tarea: null, capa: null };

        void (async () => {
            const pagina = await doc.getPage(numero);
            if (!vivo) return;
            const vp = pagina.getViewport({ scale: escala });
            const dpr = window.devicePixelRatio || 1;
            const lienzo = document.createElement('canvas');
            lienzo.width = Math.floor(vp.width * dpr);
            lienzo.height = Math.floor(vp.height * dpr);
            lienzo.style.width = `${vp.width}px`;
            lienzo.style.height = `${vp.height}px`;
            const ctx = lienzo.getContext('2d');
            if (!ctx) return;
            const txt = document.createElement('div');
            txt.className = 'textLayer';

            est.tarea = pagina.render({
                canvasContext: ctx,
                viewport: vp,
                transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
            });
            est.capa = new TextLayer({ textContentSource: pagina.streamTextContent(), container: txt, viewport: vp });
            await Promise.all([est.tarea.promise, est.capa.render()]);
            if (vivo) el.replaceChildren(lienzo, txt); // se cambia de golpe: sin parpadeo al hacer zoom
        })().catch((e) => {
            if (!(e instanceof RenderingCancelledException)) console.warn(`PDF: no se pudo dibujar la página ${numero}`, e);
        });

        return () => {
            vivo = false;
            est.tarea?.cancel();
            est.capa?.cancel();
        };
    }, [doc, numero, escala]);

    const estilo = {
        left: izq, top: arriba, width: ancho, height: alto, '--scale-factor': escala, '--user-unit': 1,
    } as CSSProperties;
    return <div ref={cont} className="ley-pagina" data-pagina={numero} style={estilo} />;
});

/** Visor continuo con virtualización: solo se dibujan las hojas cercanas a la pantalla. */
export function VisorPdf({ ref, datos, paginaInicial = 1, onPagina }: {
    ref?: Ref<ControlVisor>;
    datos: Uint8Array;
    /** Solo se usa al abrir. */
    paginaInicial?: number;
    onPagina?: (n: number) => void;
}) {
    const raiz = useRef<HTMLDivElement>(null);
    const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tams, setTams] = useState<Tam[]>([]);
    const [zoom, setZoom] = useState<number | null>(null); // null = ajustar al ancho
    const [caja, setCaja] = useState({ w: 0, h: 0 });
    const [scroll, setScroll] = useState(0);
    const [campo, setCampo] = useState('');
    const inicial = useRef(paginaInicial);
    const saltado = useRef(false);
    const ultima = useRef(0);
    const razon = useRef(0);
    const primeraEscala = useRef(true);

    /* ----- carga: abre el PDF y mide todas las hojas (para que el scroll sea exacto) ----- */
    useEffect(() => {
        let vivo = true;
        const tarea = getDocument({ data: datos.slice(), isEvalSupported: false });
        tarea.promise
            .then(async (d) => {
                const medidas: Tam[] = [];
                for (let i = 1; i <= d.numPages; i++) {
                    const p = await d.getPage(i);
                    const v = p.getViewport({ scale: 1 });
                    medidas.push({ w: v.width, h: v.height });
                    p.cleanup();
                    if (!vivo) return;
                }
                setDoc(d);
                setTams(medidas);
            })
            .catch((e) => { if (vivo) setError(mensajeError(e)); });
        return () => {
            vivo = false;
            void tarea.destroy();
        };
    }, [datos]);

    useEffect(() => {
        const el = raiz.current;
        if (!el) return;
        const medir = () => setCaja({ w: el.clientWidth, h: el.clientHeight });
        medir();
        const o = new ResizeObserver(medir);
        o.observe(el);
        return () => o.disconnect();
    }, []);

    /* ----- geometría ----- */
    const maxW = useMemo(() => tams.reduce((a, t) => Math.max(a, t.w), 1), [tams]);
    const ajuste = caja.w > 0 ? Math.min(2, Math.max(0.3, (caja.w - 2 * PAD) / maxW)) : 1;
    const escala = zoom ?? ajuste;
    const { tops, total } = useMemo(() => {
        const t: number[] = [];
        let y = PAD;
        for (const m of tams) {
            t.push(y);
            y += m.h * escala + GAP;
        }
        return { tops: t, total: y - GAP + PAD };
    }, [tams, escala]);
    const ancho = Math.max(caja.w, maxW * escala + 2 * PAD);

    const hay = tams.length > 0;
    const desde = hay ? buscarIndice(tops, Math.max(0, scroll - caja.h)) : 0;
    const hasta = hay ? buscarIndice(tops, scroll + caja.h * 2) : -1;
    const actual = hay ? buscarIndice(tops, scroll + caja.h / 3) + 1 : 0;

    useEffect(() => {
        if (actual > 0 && actual !== ultima.current) {
            ultima.current = actual;
            onPagina?.(actual);
        }
    }, [actual, onPagina]);

    const irA = useCallback((n: number) => {
        const el = raiz.current;
        if (!el || tops.length === 0) return;
        const i = Math.min(tops.length, Math.max(1, Math.round(n))) - 1;
        el.scrollTop = Math.max(0, tops[i] - PAD / 2);
    }, [tops]);
    useImperativeHandle(ref, () => ({ irA }), [irA]);

    // Salto inicial, cuando ya se conocen el tamaño de la caja y el de las hojas.
    useEffect(() => {
        if (!doc || !hay || caja.w === 0 || saltado.current) return;
        saltado.current = true;
        irA(inicial.current);
    }, [doc, hay, caja.w, irA]);

    // Al cambiar el zoom se conserva la posición relativa dentro del documento.
    useLayoutEffect(() => {
        if (primeraEscala.current) {
            primeraEscala.current = false;
            return;
        }
        if (raiz.current) raiz.current.scrollTop = razon.current * total;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [escala]);

    const cambiarZoom = (d: number) => setZoom(Math.min(4, Math.max(0.3, Math.round((escala + d) * 100) / 100)));

    return (
        <div className="ley-visor-caja">
            <div className="ley-visor-barra">
                <button type="button" className="btn btn-fan btn-sm" aria-label="Reducir" onClick={() => cambiarZoom(-0.15)}>−</button>
                <span className="suave">{Math.round(escala * 100)} %</span>
                <button type="button" className="btn btn-fan btn-sm" aria-label="Ampliar" onClick={() => cambiarZoom(0.15)}>+</button>
                <button type="button" className="btn btn-fan btn-sm" onClick={() => setZoom(null)}>Ajustar al ancho</button>
                <span className="espacio" />
                <span className="suave">Pág.</span>
                <input
                    className="ley-pag" inputMode="numeric" aria-label="Número de página" value={campo || String(actual || '')}
                    onChange={(e) => setCampo(e.target.value.replace(/\D/g, ''))}
                    onBlur={() => setCampo('')}
                    onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        if (campo) irA(Number(campo));
                        setCampo('');
                    }}
                />
                <span className="suave">/ {tams.length}</span>
            </div>

            <div
                ref={raiz}
                className="ley-visor"
                onScroll={(e) => {
                    const y = e.currentTarget.scrollTop;
                    razon.current = total > 0 ? y / total : 0;
                    setScroll(y);
                }}
            >
                {error && <p className="error" style={{ margin: 16 }}>{error}</p>}
                {!doc && !error && <p className="suave" style={{ padding: 16 }}>Preparando el PDF…</p>}
                {doc && (
                    <div style={{ position: 'relative', width: ancho, height: total }}>
                        {Array.from({ length: Math.max(0, hasta - desde + 1) }, (_, k) => {
                            const i = desde + k;
                            const w = tams[i].w * escala;
                            return (
                                <PaginaPdf
                                    key={i} doc={doc} numero={i + 1} escala={escala}
                                    ancho={w} alto={tams[i].h * escala} izq={Math.max(PAD, (ancho - w) / 2)} arriba={tops[i]}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}