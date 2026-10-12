import { useState, type ReactNode, type RefObject } from 'react';
import { margenesSeguros, type ConfigPagina, type Margenes, type TamanoPagina } from '../domain/fuenteModelo';
import type { ContextoMarcadores } from '../domain/marcadores';
import { BarraFormato, coma } from './BarraFormato';
import {
    FORMATO_INICIAL, HojaEditable,
    type ControlHoja, type FormatoActivo, type LlenadoHoja, type MenuCampoInfo,
} from './HojaEditable';
import { ModalPagina } from './ModalPagina';

const PAPEL: Record<TamanoPagina, string> = { carta: 'Carta', oficio: 'Oficio', a4: 'A4' };

/**
 * Editor único: se usa en el editor de modelos, al llenar sobre el documento y al editar el documento generado.
 * Va dentro de un contenedor `.ed-ventana` (columna flex a pantalla completa).
 */
export function EditorHoja({
    hoja, textoInicial, config, onConfig, onCambio, conFirma, soloLectura, contexto, verCodigos, llenado,
    onAmbito, onMenuCampo, onEditarCampo, barra, panel, ayuda,
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
    onEditarCampo?: (actual: string, aplicar: (nuevo: string) => void) => void;
    barra?: ReactNode;
    panel?: ReactNode;
    ayuda?: string;
}) {
    const [formato, setFormato] = useState<FormatoActivo>(FORMATO_INICIAL);
    const [paginas, setPaginas] = useState(1);
    const [dlgPagina, setDlgPagina] = useState(false);
    const mg = margenesSeguros(config.margenes, config.tamano);

    const cambiar = (c: ConfigPagina) => {
        onConfig(c);
        window.setTimeout(() => hoja.current?.enfocar(), 0);
    };
    const setMargen = (lado: keyof Margenes, cm: number) =>
        onConfig({ ...config, margenes: margenesSeguros({ ...config.margenes, [lado]: cm }, config.tamano) });

    return (
        <>
            <BarraFormato
                config={config} formato={formato} hoja={hoja} conFirma={conFirma} bloqueada={soloLectura}
                onConfig={cambiar} onPagina={() => setDlgPagina(true)}
            >
                {barra}
            </BarraFormato>

            <div className={`ed-cuerpo${panel ? '' : ' sin-panel'}`}>
                <div className="ed-pagina">
                    <HojaEditable
                        ref={hoja}
                        textoInicial={textoInicial}
                        config={config}
                        soloLectura={soloLectura}
                        llenado={llenado}
                        contexto={contexto}
                        verCodigos={verCodigos}
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
                {panel && <aside className="ed-panel">{panel}</aside>}
            </div>

            <footer className="ed-estado">
                <span>
                    {PAPEL[config.tamano]} · {config.fuente} {coma(config.tamanoPt)} pt · interlineado {coma(config.interlineado)} ·
                    márgenes sup {coma(mg.superior)} · inf {coma(mg.inferior)} · izq {coma(mg.izquierdo)} · der {coma(mg.derecho)} cm ·
                    ≈ {paginas} pág.
                </span>
                <span>{ayuda}</span>
            </footer>

            {dlgPagina && (
                <ModalPagina
                    config={config}
                    cerrar={() => setDlgPagina(false)}
                    aplicar={(tamano, margenes, simetricos, espacio) =>
                        cambiar({ ...config, tamano, margenes: margenesSeguros(margenes, tamano), simetricos, ...espacio })}
                />
            )}
        </>
    );
}