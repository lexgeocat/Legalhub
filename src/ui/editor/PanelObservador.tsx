import { useEffect, useMemo, useState, type RefObject } from 'react';
import {
    type CategoriaObservador,
    type HallazgoObservador,
    type MetricasDocumento,
} from '../../domain/redaccion/observadorRedaccion';
import {
    adaptarReemplazo,
    buscarSinonimos,
    explorarTesauro,
} from '../../domain/redaccion/tesauroForense';
import type { ControlHoja, EstadoObservador } from './HojaEditable';

const ETIQ_CAT: Record<CategoriaObservador, { corto: string; largo: string }> = {
    ortografia: { corto: 'Ortografía', largo: 'Ortografía y acentuación' },
    puntuacion: { corto: 'Puntuación', largo: 'Signos de puntuación' },
    gramatica: { corto: 'Gramática', largo: 'Gramática y concordancia' },
    estilo: { corto: 'Estilo', largo: 'Estilo forense y claridad' },
};

const METRICAS_VACIAS: MetricasDocumento = {
    palabras: 0,
    caracteres: 0,
    oraciones: 0,
    parrafos: 0,
    promedioPalabrasPorOracion: 0,
    oracionesLargas: 0,
    puntajeCalidad: 100,
    nivelClaridad: 'Excelente',
};

export function PanelObservador({
    hoja,
    onCerrar,
    modoInicial = 'revision',
}: {
    hoja: RefObject<ControlHoja | null>;
    onCerrar: () => void;
    modoInicial?: 'revision' | 'sinonimos';
}) {
    const [estado, setEstado] = useState<EstadoObservador>({
        activo: true,
        hallazgos: [],
        metricas: METRICAS_VACIAS,
        palabraSeleccionada: '',
    });
    const [pestana, setPestana] = useState<'revision' | 'sinonimos'>(modoInicial);
    const [filtroCat, setFiltroCat] = useState<'todas' | CategoriaObservador>('todas');
    const [consultaTesauro, setConsultaTesauro] = useState('');

    useEffect(() => {
        setPestana(modoInicial);
    }, [modoInicial]);

    useEffect(() => {
        let desuscribir: (() => void) | undefined;
        const conectar = () => {
            const ctrl = hoja.current;
            if (!ctrl) return;
            const actual = ctrl.estadoObservador();
            setEstado(actual);
            if (actual.palabraSeleccionada && !consultaTesauro) {
                setConsultaTesauro(actual.palabraSeleccionada);
            }
            desuscribir = ctrl.suscribirObservador((nuevo) => {
                setEstado(nuevo);
            });
        };
        conectar();
        const t = window.setTimeout(conectar, 30);
        return () => {
            window.clearTimeout(t);
            desuscribir?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hoja]);

    useEffect(() => {
        if (estado.palabraSeleccionada) {
            setConsultaTesauro(estado.palabraSeleccionada);
        }
    }, [estado.palabraSeleccionada]);

    const conteos = useMemo(() => {
        const c: Record<CategoriaObservador, number> = {
            ortografia: 0,
            puntuacion: 0,
            gramatica: 0,
            estilo: 0,
        };
        for (const h of estado.hallazgos) {
            c[h.categoria] = (c[h.categoria] ?? 0) + 1;
        }
        return c;
    }, [estado.hallazgos]);

    const hallazgosFiltrados = useMemo(() => {
        if (filtroCat === 'todas') return estado.hallazgos;
        return estado.hallazgos.filter((h) => h.categoria === filtroCat);
    }, [estado.hallazgos, filtroCat]);

    const corregibles = useMemo(
        () => hallazgosFiltrados.filter((h) => h.sugerencias.length > 0),
        [hallazgosFiltrados],
    );

    const resultadoDirecto = useMemo(
        () => (consultaTesauro.trim() ? buscarSinonimos(consultaTesauro.trim()) : null),
        [consultaTesauro],
    );

    const entradasTesauro = useMemo(
        () => explorarTesauro(consultaTesauro.trim()),
        [consultaTesauro],
    );

    const corregirTodo = () => {
        const ctrl = hoja.current;
        if (!ctrl || corregibles.length === 0) return;
        const ordenados: HallazgoObservador[] = [...corregibles].sort((a, b) => {
            if (b.parrafoIndex !== a.parrafoIndex) return b.parrafoIndex - a.parrafoIndex;
            return b.desde - a.desde;
        });
        for (const h of ordenados) {
            if (h.sugerencias.length > 0) {
                ctrl.aplicarHallazgo(h.id, h.sugerencias[0]);
            }
        }
    };

    const m = estado.metricas;
    const colorPuntaje =
        m.puntajeCalidad >= 90
            ? 'ok'
            : m.puntajeCalidad >= 75
              ? 'bueno'
              : m.puntajeCalidad >= 55
                ? 'adv'
                : 'err';

    return (
        <div className="ed-panel-obs" role="region" aria-label="Observador de Redacción y Sinónimos">
            <div className="ed-obs-cab">
                <div className="ed-obs-tit-wrap">
                    <span className="ed-obs-badge-ico" aria-hidden="true">✓</span>
                    <div>
                        <strong className="ed-obs-titulo">Observador Forense</strong>
                        <span className="ed-obs-subtitulo">Ortografía, puntuación, gramática y léxico</span>
                    </div>
                </div>
                <div className="ed-obs-cab-acc">
                    <button
                        type="button"
                        className={`ed-obs-switch${estado.activo ? ' on' : ''}`}
                        title={estado.activo ? 'Desactivar subrayado en vivo' : 'Activar subrayado en vivo'}
                        onClick={() => hoja.current?.alternarObservador()}
                    >
                        {estado.activo ? 'En vivo' : 'Pausado'}
                    </button>
                    <button
                        type="button"
                        className="ed-pop-obs-cerrar"
                        title="Cerrar panel"
                        aria-label="Cerrar panel"
                        onClick={onCerrar}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Tarjeta de puntaje y métricas del escrito */}
            <div className="ed-obs-metricas">
                <div className={`ed-obs-score ${colorPuntaje}`}>
                    <span className="ed-obs-score-num">{m.puntajeCalidad}</span>
                    <span className="ed-obs-score-lbl">{m.nivelClaridad}</span>
                </div>
                <div className="ed-obs-stats">
                    <div>
                        <b>{m.palabras}</b>
                        <span>palabras</span>
                    </div>
                    <div>
                        <b>{m.oraciones}</b>
                        <span>oraciones</span>
                    </div>
                    <div>
                        <b>{m.promedioPalabrasPorOracion}</b>
                        <span>pal./oración</span>
                    </div>
                    <div>
                        <b>{estado.hallazgos.length}</b>
                        <span>observaciones</span>
                    </div>
                </div>
            </div>

            {/* Selector de pestaña principal */}
            <div className="ed-obs-tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={pestana === 'revision'}
                    className={`ed-obs-tab${pestana === 'revision' ? ' activa' : ''}`}
                    onClick={() => setPestana('revision')}
                >
                    Revisión ({estado.hallazgos.length})
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={pestana === 'sinonimos'}
                    className={`ed-obs-tab${pestana === 'sinonimos' ? ' activa' : ''}`}
                    onClick={() => setPestana('sinonimos')}
                >
                    Sinónimos y Léxico
                </button>
            </div>

            {pestana === 'revision' ? (
                <div className="ed-obs-cuerpo">
                    <div className="ed-obs-filtros">
                        <button
                            type="button"
                            className={`ed-obs-chip${filtroCat === 'todas' ? ' on' : ''}`}
                            onClick={() => setFiltroCat('todas')}
                        >
                            Todas ({estado.hallazgos.length})
                        </button>
                        {(['ortografia', 'puntuacion', 'gramatica', 'estilo'] as CategoriaObservador[]).map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                className={`ed-obs-chip cat-${cat}${filtroCat === cat ? ' on' : ''}`}
                                onClick={() => setFiltroCat(cat)}
                            >
                                <span className={`ed-obs-dot cat-${cat}`} />
                                {ETIQ_CAT[cat].corto} ({conteos[cat]})
                            </button>
                        ))}
                    </div>

                    {corregibles.length > 1 && (
                        <div className="ed-obs-lote">
                            <span>{corregibles.length} correcciones automáticas listas</span>
                            <button
                                type="button"
                                className="ed-obs-btn-lote"
                                onClick={corregirTodo}
                            >
                                Corregir todo ({corregibles.length})
                            </button>
                        </div>
                    )}

                    <div className="ed-obs-lista">
                        {!estado.activo ? (
                            <div className="ed-obs-vacio">
                                <p>El observador en tiempo real está pausado.</p>
                                <button
                                    type="button"
                                    className="ed-obs-btn-lote"
                                    onClick={() => hoja.current?.alternarObservador(true)}
                                >
                                    Reactivar observador
                                </button>
                            </div>
                        ) : hallazgosFiltrados.length === 0 ? (
                            <div className="ed-obs-vacio ok">
                                <span className="ed-obs-ok-ico" aria-hidden="true">✓</span>
                                <b>Sin observaciones en esta categoría</b>
                                <p>
                                    {filtroCat === 'todas'
                                        ? 'La ortografía, los signos de puntuación, la concordancia gramatical y el estilo forense lucen impecables.'
                                        : `No se detectaron problemas de ${ETIQ_CAT[filtroCat].largo.toLowerCase()}.`}
                                </p>
                            </div>
                        ) : (
                            hallazgosFiltrados.map((h) => (
                                <div
                                    key={h.id}
                                    className={`ed-obs-card cat-${h.categoria}`}
                                    onClick={() => hoja.current?.irAHallazgo(h.id)}
                                >
                                    <div className="ed-obs-card-cab">
                                        <span className={`ed-pop-obs-cat cat-${h.categoria}`}>
                                            {ETIQ_CAT[h.categoria].corto}
                                        </span>
                                        <strong className="ed-obs-card-tit">{h.titulo}</strong>
                                    </div>

                                    <div className="ed-obs-card-frag">
                                        <del>{h.fragmento}</del>
                                        {h.sugerencias[0] !== undefined && (
                                            <>
                                                <span className="ed-obs-flecha">→</span>
                                                <ins>{h.sugerencias[0] === '' ? '(eliminar)' : h.sugerencias[0]}</ins>
                                            </>
                                        )}
                                    </div>

                                    <p className="ed-obs-card-msg">{h.explicacion}</p>

                                    {h.sugerencias.length > 0 && (
                                        <div
                                            className="ed-obs-card-sugs"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {h.sugerencias.map((sug, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    className="ed-pop-obs-sug"
                                                    onClick={() =>
                                                        hoja.current?.aplicarHallazgo(
                                                            h.id,
                                                            sug === '(eliminar duplicado)' ? '' : sug,
                                                        )
                                                    }
                                                >
                                                    {sug === '' ? '(eliminar)' : sug}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div
                                        className="ed-obs-card-pie"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            type="button"
                                            className="ed-pop-obs-btn"
                                            onClick={() => hoja.current?.ignorarHallazgo(h.id)}
                                        >
                                            Ignorar
                                        </button>
                                        {h.categoria === 'ortografia' && !/\s/.test(h.fragmento.trim()) && (
                                            <button
                                                type="button"
                                                className="ed-pop-obs-btn"
                                                onClick={() =>
                                                    hoja.current?.agregarPalabraDiccionario(h.fragmento.trim())
                                                }
                                            >
                                                + Al diccionario
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="ed-obs-cuerpo">
                    <div className="ed-obs-buscador">
                        <input
                            type="search"
                            placeholder="Buscar palabra o verbo (ej. pedir, decir, probar, daño)…"
                            value={consultaTesauro}
                            onChange={(e) => setConsultaTesauro(e.target.value)}
                        />
                        {estado.palabraSeleccionada && (
                            <div className="ed-obs-palabra-activa">
                                En el cursor: <b>«{estado.palabraSeleccionada}»</b>
                                <span className="ed-obs-nota-clic">
                                    (clic en un sinónimo para reemplazar respetando conjugación y mayúsculas)
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="ed-obs-lista">
                        {resultadoDirecto && (
                            <div className="ed-obs-tesauro-card destacado">
                                <div className="ed-obs-tesauro-cab">
                                    <strong>«{resultadoDirecto.terminoOriginal}»</strong>
                                    {resultadoDirecto.lema !== resultadoDirecto.terminoOriginal.toLowerCase() && (
                                        <span className="ed-obs-lema">lema: {resultadoDirecto.lema}</span>
                                    )}
                                    <span className="ed-obs-cat-tag">{resultadoDirecto.categoria}</span>
                                </div>
                                {resultadoDirecto.definicionBreve && (
                                    <p className="ed-obs-tesauro-nota">{resultadoDirecto.definicionBreve}</p>
                                )}
                                {resultadoDirecto.grupos.map((g, gi) => (
                                    <div key={gi} className="ed-pop-obs-grupo">
                                        <div className="ed-obs-grupo-lbl">{g.etiqueta}</div>
                                        <div className="ed-pop-obs-sugs">
                                            {g.opciones.map((op, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    className={`ed-pop-obs-sug ${g.registro === 'forense' ? 'forense' : 'Sinonimo'}`}
                                                    title={`Reemplazar en el documento (lema: ${op.base})`}
                                                    onClick={() => hoja.current?.reemplazarPalabraActual(op.reemplazo)}
                                                >
                                                    {op.reemplazo}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {entradasTesauro.map((ent) => {
                            if (resultadoDirecto && ent.lema === resultadoDirecto.lema) return null;
                            const basePalabra = estado.palabraSeleccionada || ent.lema;
                            return (
                                <div key={ent.lema} className="ed-obs-tesauro-card">
                                    <div className="ed-obs-tesauro-cab">
                                        <strong>{ent.lema}</strong>
                                        <span className="ed-obs-cat-tag">{ent.categoria}</span>
                                    </div>
                                    {ent.definicionBreve && <p className="ed-obs-tesauro-nota">{ent.definicionBreve}</p>}
                                    {ent.grupos.map((g, gi) => (
                                        <div key={gi} className="ed-pop-obs-grupo">
                                            <div className="ed-obs-grupo-lbl">{g.etiqueta}</div>
                                            <div className="ed-pop-obs-sugs">
                                                {g.opciones.map((op, i) => {
                                                    const adaptado = estado.palabraSeleccionada
                                                        ? adaptarReemplazo(basePalabra, op.base, ent.categoria)
                                                        : op.reemplazo;
                                                    return (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            className={`ed-pop-obs-sug ${g.registro === 'forense' ? 'forense' : 'Sinonimo'}`}
                                                            title={
                                                                estado.palabraSeleccionada
                                                                    ? `Reemplazar «${estado.palabraSeleccionada}» por «${adaptado}»`
                                                                    : `Insertar «${adaptado}»`
                                                            }
                                                            onClick={() => {
                                                                if (estado.palabraSeleccionada) {
                                                                    hoja.current?.reemplazarPalabraActual(adaptado);
                                                                } else {
                                                                    hoja.current?.insertar(adaptado, false);
                                                                }
                                                            }}
                                                        >
                                                            {adaptado}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
