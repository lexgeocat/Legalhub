import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
    CONFIG_POR_DEFECTO, PAGINA_CM,
    type Bloque, type BloqueParrafo, type ConfigPagina, type Tramo,
} from '../domain/fuenteModelo';
import { usePaginacion } from './Paginacion';
import { pilaCss } from '../domain/fuentes';
const PX_POR_CM = 37.7953;

function Tramos({ tramos, estilo, resaltar }: { tramos: Tramo[]; estilo: BloqueParrafo['estilo']; resaltar: boolean }) {
    if (tramos.length === 0) return <>{'\u00A0'}</>;
    return (
        <>
            {tramos.map((t, i) => (
                <span
                    key={i}
                    className={resaltar && t.marcador ? 'mk' : undefined}
                    style={{
                        fontWeight: t.negrita || estilo !== 'normal' ? 700 : undefined,
                        fontStyle: t.cursiva ? 'italic' : undefined,
                        textDecoration: t.subrayado ? 'underline' : undefined,
                    }}
                >
                    {t.texto}
                </span>
            ))}
        </>
    );
}

function ParrafoHoja({ b, cfg, escala, resaltar }: { b: BloqueParrafo; cfg: ConfigPagina; escala: number; resaltar: boolean }) {
    const titulo = b.estilo === 'titulo';
    const sub = b.estilo === 'subtitulo';
    const esBloque = resaltar && b.tramos.length === 1 && b.tramos[0].marcador && /^\{\{\s*[#/]/.test(b.tramos[0].texto);
    const estilo: CSSProperties = {
        textAlign: b.alineacion === 'both' ? 'justify' : b.alineacion,
        margin: `${(titulo ? 12 : sub ? 6 : 0) * escala}pt 0 ${(titulo ? 12 : sub ? 6 : 6) * escala}pt`,
        fontSize: titulo ? `${(cfg.tamanoPt + 2) * escala}pt` : undefined,
        textIndent:
            cfg.sangria && b.estilo === 'normal' && (b.alineacion === 'both' || b.alineacion === 'left')
                ? `${1.25 * escala}cm`
                : undefined,
    };
    return (
        <p className={esBloque ? 'mk-bloque' : undefined} style={estilo}>
            <Tramos tramos={b.tramos} estilo={b.estilo} resaltar={resaltar} />
        </p>
    );
}

/** Vista previa paginada: hojas separadas, márgenes respetados en todas las páginas. */
export function Hoja({ bloques, config = CONFIG_POR_DEFECTO, resaltar = true }: {
    bloques: Bloque[]; config?: ConfigPagina; resaltar?: boolean;
}) {
    const cont = useRef<HTMLDivElement>(null);
    const raiz = useRef<HTMLDivElement>(null);
    const [ancho, setAncho] = useState(0);

    useEffect(() => {
        const el = cont.current;
        if (!el) return;
        const medir = () => setAncho(el.clientWidth);
        medir();
        const o = new ResizeObserver(medir);
        o.observe(el);
        return () => o.disconnect();
    }, []);

    const pag = PAGINA_CM[config.tamano] ?? PAGINA_CM.carta;
    const escala = ancho > 0 ? Math.min(1, Math.max(0.5, (ancho - 28) / (pag.w * PX_POR_CM))) : 0.6;
    const pt = (n: number) => `${(n * escala).toFixed(2)}pt`;
    const pg = usePaginacion(raiz, config, PX_POR_CM * escala, bloques);

    return (
        <div className="hoja-wrap" ref={cont}>
            <div className="pg-caja" style={pg.estiloCaja}>
                {pg.fondos}
                <div className="pg-flujo" ref={pg.refFlujo}>
                    <div className="pg-excl" ref={pg.refExcl} aria-hidden="true" />
                    <div
                        ref={raiz}
                        className="hoja-lectura"
                        style={{
                            ...pg.estiloRaiz,
                            fontFamily: pilaCss(config.fuente),
                            tabSize: `${(1.25 * escala).toFixed(3)}cm`,
                            fontSize: pt(config.tamanoPt),
                            lineHeight: config.interlineado,
                        }}
                    >
                        {bloques.length === 0 && <p className="hoja-vacia">El documento está vacío.</p>}
                        {bloques.map((b, i) =>
                            b.tipo === 'salto' ? (
                                <div key={i} className="pg-salto" data-salto="1"><span>Salto de página</span></div>
                            ) : (
                                <ParrafoHoja key={i} b={b} cfg={config} escala={escala} resaltar={resaltar} />
                            ),
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}