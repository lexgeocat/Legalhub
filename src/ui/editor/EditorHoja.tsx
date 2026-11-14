import { useState, type ReactNode, type RefObject } from 'react';
import { margenesSeguros, type ConfigPagina, type Margenes, type TamanoPagina } from '../../domain/modelos/fuenteModelo';
import type { ContextoMarcadores } from '../../domain/modelos/marcadores';
import { BarraFormato, coma } from './BarraFormato';
import {
    FORMATO_INICIAL, HojaEditable,
    type ControlHoja, type FormatoActivo, type LlenadoHoja, type MenuCampoInfo,
} from './HojaEditable';
import { PanelObservador } from './PanelObservador';
import { ModalPagina } from '../compartidos/ModalPagina';

const PAPEL: Record<TamanoPagina, string> = { carta: 'Carta', oficio: 'Oficio', a4: 'A4' };

/**
 * Editor único: se usa en el editor de modelos, al llenar sobre el documento y al editar el documento generado.
 * Va dentro de un contenedor `.ed-ventana` (columna flex a pantalla completa).
 */
export function EditorHoja({
    hoja, textoInicial, config, onConfig, onCambio, conFirma, soloLectura, contexto, verCodigos, llenado,
    onAmbito, onMenuCampo, onEditarCampo, barra, panel, ayuda, paginaAbierta, onPaginaAbierta,
}: {
    hoja: RefObject<ControlHoja | null>;
    textoInicial: string;
    config: ConfigPagina;
    onConfig: (c: ConfigPagina) => void;
    onCambio: () => void;
    conFirma?: boolean;
    soloLectura?: boolean;
    contexto?: ContextoMarcadores;
    verCodigos?: boolean;
    llenado?: LlenadoHoja;
    onAmbito?: (a: string[]) => void;
    onMenuCampo?: (i: MenuCampoInfo) => void;
    onEditarCampo?: (actual: string, aplicar: (nuevo: string) => void, ambito: string[]) => void;
    barra?: ReactNode;
    panel?: ReactNode;
    ayuda?: string;
    paginaAbierta?: boolean;
    onPaginaAbierta?: (abierta: boolean) => void;
}) {
    const [formato, setFormato] = useState<FormatoActivo>(FORMATO_INICIAL);
    const [paginas, setPaginas] = useState(1);
    const [dlgPaginaInt, setDlgPaginaInt] = useState(false);
    const dlgPagina = paginaAbierta ?? dlgPaginaInt;
    const setDlgPagina = onPaginaAbierta ?? setDlgPaginaInt;
    const [panelObs, setPanelObs] = useState<'revision' | 'sinonimos' | null>(null);
    const [zoomPct, setZoomPct] = useState(100);
    const mg = margenesSeguros(config.margenes, config.tamano);
    const ajustarZoom = (v: number) => setZoomPct(Math.max(50, Math.min(200, Math.round(v))));

    const cambiar = (c: ConfigPagina) => {
        onConfig(c);
        window.setTimeout(() => hoja.current?.enfocar(), 0);
    };
    const setMargen = (lado: keyof Margenes, cm: number) =>
        onConfig({ ...config, margenes: margenesSeguros({ ...config.margenes, [lado]: cm }, config.tamano) });

    const alternarPanelObs = (modo: 'revision' | 'sinonimos') => {
        setPanelObs((actual) => (actual === modo ? null : modo));
    };

    const panelEfectivo = panelObs ? (
        <PanelObservador
            hoja={hoja}
            modoInicial={panelObs}
            onCerrar={() => setPanelObs(null)}
        />
    ) : panel;

    return (
        <>
            <BarraFormato
                config={config}
                formato={formato}
                hoja={hoja}
                conFirma={conFirma}
                bloqueada={soloLectura}
                onConfig={cambiar}
                panelObservador={panelObs}
                onAbrirObservador={alternarPanelObs}
            >
                {barra}
            </BarraFormato>

            <div className={`ed-cuerpo${panelEfectivo ? '' : ' sin-panel'}`}>
                <div
                    className="ed-pagina"
                    onWheel={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            ajustarZoom(zoomPct + (e.deltaY < 0 ? 10 : -10));
                        }
                    }}
                >
                    <HojaEditable
                        ref={hoja}
                        textoInicial={textoInicial}
                        config={config}
                        soloLectura={soloLectura}
                        llenado={llenado}
                        contexto={contexto}
                        verCodigos={verCodigos}
                        zoom={zoomPct / 100}
                        onCambio={onCambio}
                        onFormato={setFormato}
                        onEditarCampo={onEditarCampo ?? (() => undefined)}
                        onMargenes={setMargen}
                        onConfigurarPagina={() => setDlgPagina(true)}
                        onPaginas={setPaginas}
                        onAmbito={onAmbito}
                        onMenuCampo={onMenuCampo}
                    />
                </div>
                {panelEfectivo && <aside className="ed-panel">{panelEfectivo}</aside>}
            </div>

            <footer className="ed-estado">
                <span className="ed-estado-info">
                    {PAPEL[config.tamano]} · {config.fuente} {coma(config.tamanoPt)} pt · interlineado {coma(config.interlineado)} ·
                    márgenes sup {coma(mg.superior)} · inf {coma(mg.inferior)} · izq {coma(mg.izquierdo)} · der {coma(mg.derecho)} cm ·
                    ≈ {paginas} pág.
                </span>
                <div className="ed-estado-der">
                    {ayuda && <span className="ed-estado-ayuda">{ayuda}</span>}
                    <div className="ed-zoom" role="group" aria-label="Control de zoom">
                        <button
                            type="button"
                            className="ed-zoom-btn"
                            title="Alejar (Ctrl + Rueda abajo)"
                            aria-label="Alejar"
                            disabled={zoomPct <= 50}
                            onClick={() => ajustarZoom(zoomPct - 10)}
                        >
                            −
                        </button>
                        <div className="ed-zoom-slider-wrap">
                            <span className="ed-zoom-marca" aria-hidden="true" />
                            <input
                                type="range"
                                className="ed-zoom-slider"
                                min={50}
                                max={200}
                                step={5}
                                value={zoomPct}
                                aria-label="Nivel de zoom"
                                title={`Zoom: ${zoomPct}%`}
                                onChange={(e) => ajustarZoom(Number(e.target.value))}
                            />
                        </div>
                        <button
                            type="button"
                            className="ed-zoom-btn"
                            title="Acercar (Ctrl + Rueda arriba)"
                            aria-label="Acercar"
                            disabled={zoomPct >= 200}
                            onClick={() => ajustarZoom(zoomPct + 10)}
                        >
                            +
                        </button>
                        <button
                            type="button"
                            className="ed-zoom-pct"
                            title="Restablecer zoom al 100%"
                            onClick={() => setZoomPct(100)}
                        >
                            {zoomPct}%
                        </button>
                    </div>
                </div>
            </footer>

            {dlgPagina && (
                <ModalPagina
                    config={config}
                    cerrar={() => setDlgPagina(false)}
                    aplicar={(tamano, margenes, simetricos) =>
                        cambiar({ ...config, tamano, margenes: margenesSeguros(margenes, tamano), simetricos })}
                />
            )}
        </>
    );
}
