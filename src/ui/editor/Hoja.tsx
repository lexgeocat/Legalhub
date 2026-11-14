import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
    CONFIG_POR_DEFECTO, ESPACIO_SUBTITULO_PT, ESPACIO_TITULO_PT, PAGINA_CM,
    esListaOrdenada, formatearMarcadorLista,
    type Bloque, type BloqueParrafo, type BloqueTabla, type ConfigPagina, type Tramo,
} from '../../domain/modelos/fuenteModelo';
import { usePaginacion } from '../compartidos/Paginacion';
import { pilaCss } from '../../domain/fuentes/fuentes';
import { describirMarcador, type ContextoMarcadores } from '../../domain/modelos/marcadores';
import { lineaCss, useRazonLinea } from './metricasFuente';
const PX_POR_CM = 37.7953;

function Tramos({ tramos, estilo, resaltar, escala, contexto }: {
    tramos: Tramo[]; estilo: BloqueParrafo['estilo']; resaltar: boolean; escala: number; contexto?: ContextoMarcadores;
}) {
    if (tramos.length === 0) return <>{'\u00A0'}</>;
    return (
        <>
            {tramos.map((t, i) => {
                if (resaltar && t.marcador) {
                    const m = describirMarcador(t.texto, contexto);
                    return (
                        <span key={i} className="mk" data-k={m.tipo}
                            style={{
                                '--h': m.matiz,
                                fontWeight: t.negrita || estilo !== 'normal' ? 700 : undefined,
                                fontStyle: t.cursiva ? 'italic' : undefined,
                                textDecoration: t.subrayado ? 'underline' : undefined,
                                fontFamily: t.fuente ? pilaCss(t.fuente) : undefined,
                                fontSize: t.tamanoPt ? `${(t.tamanoPt * escala * 0.82).toFixed(2)}pt` : undefined,
                            } as CSSProperties}
                            title={`${m.titulo}${m.detalle ? ` — ${m.detalle}` : ''}${m.ejemplo ? `\nEj.: ${m.ejemplo}` : ''}`}>
                            <span className="mk-e">{m.corto}</span>
                        </span>
                    );
                }
                const nodo = (
                    <span
                        key={i}
                        style={{
                            fontWeight: t.negrita || estilo !== 'normal' ? 700 : undefined,
                            fontStyle: t.cursiva ? 'italic' : undefined,
                            textDecoration: t.subrayado ? 'underline' : undefined,
                            fontFamily: t.fuente ? pilaCss(t.fuente) : undefined,
                            fontSize: t.tamanoPt ? `${(t.tamanoPt * escala).toFixed(2)}pt` : undefined,
                        }}
                    >
                        {t.texto}
                    </span>
                );
                return t.resaltado ? (
                    <mark key={i} className="ed-hl" data-hl={t.resaltado}>
                        {nodo}
                    </mark>
                ) : nodo;
            })}
        </>
    );
}

function ParrafoHoja({ b, cfg, escala, resaltar, contexto, numLista, numPadre }: {
    b: BloqueParrafo; cfg: ConfigPagina; escala: number; resaltar: boolean; contexto?: ContextoMarcadores; numLista?: number; numPadre?: number;
}) {
    const titulo = b.estilo === 'titulo';
    const sub = b.estilo === 'subtitulo';
    const esBloque = resaltar && b.tramos.length === 1 && b.tramos[0].marcador && /^\{\{\s*[#/]/.test(b.tramos[0].texto);
    const antes = titulo ? ESPACIO_TITULO_PT : sub ? ESPACIO_SUBTITULO_PT : cfg.espacioAntes;
    const despues = titulo ? ESPACIO_TITULO_PT : sub ? ESPACIO_SUBTITULO_PT : cfg.espacioDespues;
    const estilo: CSSProperties = {
        textAlign: b.alineacion === 'both' ? 'justify' : b.alineacion,
        // Como Word: el espacio «antes» se suma al «después» del párrafo anterior (no se colapsa).
        margin: `0 0 ${(despues * escala).toFixed(2)}pt`,
        paddingTop: `${(antes * escala).toFixed(2)}pt`,
        fontSize: titulo ? `${(cfg.tamanoPt + 2) * escala}pt` : undefined,
        lineHeight: b.interlineado ? lineaCss(b.interlineado) : undefined,
        breakBefore: b.nuevaColumna && (b.columnas ?? 1) > 1 ? 'column' : undefined,
        textIndent:
            !b.lista && cfg.sangria && b.estilo === 'normal' && (b.alineacion === 'both' || b.alineacion === 'left')
                ? `${1.25 * escala}cm`
                : undefined,
    };
    return (
        <p
            className={esBloque ? 'mk-bloque' : undefined}
            style={estilo}
            data-lista={b.lista}
            data-num={esListaOrdenada(b.lista) ? formatearMarcadorLista(b.lista, numLista ?? 1, numPadre ?? 1) : undefined}
        >
            <Tramos tramos={b.tramos} estilo={b.estilo} resaltar={resaltar} escala={escala} contexto={contexto} />
        </p>
    );
}

function TablaHoja({ b, cfg, escala, resaltar, contexto }: {
    b: BloqueTabla; cfg: ConfigPagina; escala: number; resaltar: boolean; contexto?: ContextoMarcadores;
}) {
    const despues = cfg.espacioDespues;
    return (
        <table
            className="ed-tabla"
            data-tabla="1"
            data-encabezado={b.encabezado ? '1' : undefined}
            style={{ margin: `0 0 ${(despues * escala).toFixed(2)}pt` }}
        >
            <tbody>
                {b.filas.map((fila, rIdx) => {
                    const esTh = rIdx === 0 && !!b.encabezado;
                    return (
                        <tr key={rIdx}>
                            {fila.map((celda, cIdx) => {
                                const Tag = esTh ? 'th' : 'td';
                                const al = celda.alineacion ?? (esTh ? 'center' : 'left');
                                return (
                                    <Tag
                                        key={cIdx}
                                        style={{ textAlign: al === 'both' ? 'justify' : al }}
                                    >
                                        <Tramos
                                            tramos={celda.tramos}
                                            estilo="normal"
                                            resaltar={resaltar}
                                            escala={escala}
                                            contexto={contexto}
                                        />
                                    </Tag>
                                );
                            })}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/** Vista previa paginada: hojas separadas, márgenes respetados en todas las páginas. */
export function Hoja({ bloques, config = CONFIG_POR_DEFECTO, resaltar = true, contexto }: {
    bloques: Bloque[]; config?: ConfigPagina; resaltar?: boolean; contexto?: ContextoMarcadores;
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
    const razon = useRazonLinea(config.fuente);
    // Cualquier cosa que cambie la altura del texto fuerza una nueva paginación.
    const medida = useMemo(
        () => ({
            bloques, razon, i: config.interlineado, a: config.espacioAntes, d: config.espacioDespues,
            f: config.fuente, t: config.tamanoPt,
        }),
        [bloques, razon, config.interlineado, config.espacioAntes, config.espacioDespues, config.fuente, config.tamanoPt],
    );
    const pg = usePaginacion(raiz, config, PX_POR_CM * escala, medida);

    // Los párrafos consecutivos en columnas van dentro de una región de 2 columnas.
    const piezas: ReactNode[] = [];
    let numOl = 0;
    let numPadre = 0;
    let numSub = 0;
    let tipoOlActual = '';
    const avanzarLista = (lista: BloqueParrafo['lista']) => {
        if (lista === 'ol') {
            numPadre = tipoOlActual === 'ol' || tipoOlActual === 'ol-sub' ? numPadre + 1 : 1;
            numSub = 0;
            numOl = numPadre;
            tipoOlActual = 'ol';
        } else if (lista === 'ol-sub') {
            if (tipoOlActual !== 'ol' && tipoOlActual !== 'ol-sub') numPadre = 1;
            else if (numPadre === 0) numPadre = 1;
            numSub += 1;
            numOl = numSub;
            tipoOlActual = 'ol-sub';
        } else if (esListaOrdenada(lista)) {
            numOl = tipoOlActual === lista ? numOl + 1 : 1;
            numPadre = 0;
            numSub = 0;
            tipoOlActual = lista;
        } else {
            numOl = 0;
            numPadre = 0;
            numSub = 0;
            tipoOlActual = '';
        }
    };
    for (let i = 0; i < bloques.length;) {
        const b = bloques[i];
        if (b.tipo === 'salto') {
            avanzarLista(undefined);
            piezas.push(<div key={i} className="pg-salto" data-salto="1"><span>Salto de página</span></div>);
            i += 1;
            continue;
        }
        if (b.tipo === 'tabla') {
            avanzarLista(undefined);
            piezas.push(<TablaHoja key={i} b={b} cfg={config} escala={escala} resaltar={resaltar} contexto={contexto} />);
            i += 1;
            continue;
        }
        if ((b.columnas ?? 1) < 2) {
            avanzarLista(b.lista);
            piezas.push(<ParrafoHoja key={i} b={b} cfg={config} escala={escala} resaltar={resaltar} contexto={contexto} numLista={numOl} numPadre={numPadre} />);
            i += 1;
            continue;
        }
        const grupo: ReactNode[] = [];
        let j = i;
        while (j < bloques.length) {
            const x = bloques[j];
            if (x.tipo !== 'parrafo' || (x.columnas ?? 1) < 2) break;
            avanzarLista(x.lista);
            grupo.push(<ParrafoHoja key={j} b={x} cfg={config} escala={escala} resaltar={resaltar} contexto={contexto} numLista={numOl} numPadre={numPadre} />);
            j += 1;
        }
        piezas.push(<div key={`c${i}`} className="sec-cols">{grupo}</div>);
        i = j;
    }

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
                            lineHeight: lineaCss(config.interlineado),
                            '--esc': escala,
                            '--rl': razon,
                        } as CSSProperties}
                    >
                        {bloques.length === 0 && <p className="hoja-vacia">El documento está vacío.</p>}
                        {piezas}
                    </div>
                </div>
            </div>
        </div>
    );
}