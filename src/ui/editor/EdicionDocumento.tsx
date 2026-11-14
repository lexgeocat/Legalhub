import { useEffect, useRef, useState, type ReactNode } from 'react';
import { bloquesATexto, type Bloque, type ConfigPagina } from '../../domain/modelos/fuenteModelo';
import { ControlesHistorial, ICO, Ico, Tb } from './BarraFormato';
import { Alerta, Icono, Insignia, confirmar, registrarCambio } from '../_core/comunes';
import { EditorHoja } from './EditorHoja';
import type { ControlHoja } from './HojaEditable';
import { PanelLeyes } from '../leyes/PanelLeyes';
import { PanelDiccionario } from '../diccionarios/PanelDiccionario';
import { ModalGuiaRedaccion } from './ModalGuiaRedaccion';

import { ControlesVentana } from '../_core/ControlesVentana';

/** Edita un documento ya completado con el mismo editor del modelo, a pantalla completa y sin campos. */
export function EditorDocumento({ bloques, config: configInicial, aviso, aplicar, descartar }: {
    bloques: Bloque[];
    config: ConfigPagina;
    /** Aviso fijo sobre lo que se pierde al editar (modelos de Word). */
    aviso?: ReactNode;
    aplicar: (texto: string, config: ConfigPagina) => void;
    descartar: () => void;
}) {
    const hoja = useRef<ControlHoja>(null);
    const [textoInicial] = useState(() => bloquesATexto(bloques));
    const [config, setConfig] = useState<ConfigPagina>(configInicial);
    const [modificado, setModificado] = useState(false);
    const [panelActivo, setPanelActivo] = useState<'leyes' | 'diccionario' | null>(null);
    const [verGuiaRedaccion, setVerGuiaRedaccion] = useState(false);
    const [dlgPagina, setDlgPagina] = useState(false);

    useEffect(() => {
        if (modificado) {
            registrarCambio('editor-documento', 'Documento con ediciones hechas a mano sin aplicar');
        } else {
            registrarCambio('editor-documento', null);
        }
        return () => registrarCambio('editor-documento', null);
    }, [modificado]);

    async function salir() {
        if (modificado && !(await confirmar('Hay cambios sin aplicar. ¿Descartarlos?', 'Descartar cambios'))) return;
        descartar();
    }

    return (
        <div className="ed-ventana alto">
            <header className="ed-barra-titulo" data-tauri-drag-region>
                <button type="button" className="btn btn-fan" onClick={() => void salir()}><Icono n="atras" /> Vista previa</button>
                <div className="ed-sep-v" />
                <ControlesHistorial hoja={hoja} />
                <div className="ed-sep-v" />
                <div className="ed-office-centro" data-tauri-drag-region>
                    <b className="ed-titulo">Editar documento</b>
                    {modificado && <Insignia tono="ambar">Sin aplicar</Insignia>}
                </div>
                <div className="ed-acciones-top">
                    <button
                        type="button"
                        className="ed-top-pagina-btn"
                        title="Configurar página: tamaño de papel, márgenes y espaciado"
                        onClick={() => setDlgPagina(true)}
                    >
                        <Ico d={ICO.pagina} />
                        <span>Configuración de página</span>
                    </button>
                    <button type="button" className="btn btn-sec" onClick={() => void salir()}>Descartar</button>
                    <button type="button" className="btn btn-pri"
                        onClick={() => aplicar(hoja.current?.leerTexto() ?? textoInicial, config)}>
                        Aplicar al documento
                    </button>
                </div>
                <div className="ed-sep-v" />
                <ControlesVentana variante="editor" />
            </header>

            {aviso && <div className="ed-aviso"><Alerta tipo="adv">{aviso}</Alerta></div>}

            <EditorHoja
                hoja={hoja}
                paginaAbierta={dlgPagina}
                onPaginaAbierta={setDlgPagina}
                textoInicial={textoInicial}
                config={config}
                onConfig={(c) => { setConfig(c); setModificado(true); }}
                onCambio={() => setModificado(true)}
                barra={
                    <>
                        <div className="ed-subgrupo" role="group" aria-label="Paneles de consulta">
                            <Tb
                                titulo="Buscar y citar un artículo de una ley en el cursor"
                                activo={panelActivo === 'leyes'}
                                onClick={() => setPanelActivo((p) => (p === 'leyes' ? null : 'leyes'))}
                            >
                                <Ico d={ICO.leyes} />
                            </Tb>
                            <Tb
                                titulo="Buscar términos y citar definiciones doctrinales en el cursor"
                                activo={panelActivo === 'diccionario'}
                                onClick={() => setPanelActivo((p) => (p === 'diccionario' ? null : 'diccionario'))}
                            >
                                <Ico d={ICO.diccionario} />
                            </Tb>
                        </div>
                        <Tb
                            titulo="Ver compendio y fórmulas de redacción jurídica (Aperturas, Conectores, Técnica forense y Cierres)"
                            activo={verGuiaRedaccion}
                            onClick={() => setVerGuiaRedaccion(true)}
                        >
                            <Ico d={ICO.guia} />
                        </Tb>
                    </>
                }
                panel={
                    panelActivo === 'leyes' ? (
                        <PanelLeyes onInsertar={(t, b) => hoja.current?.insertar(t, b)} />
                    ) : panelActivo === 'diccionario' ? (
                        <PanelDiccionario onInsertar={(t, b) => hoja.current?.insertar(t, b)} />
                    ) : undefined
                }
                ayuda="Ctrl+N negrita · Ctrl+K cursiva · Ctrl+S subrayado · «Guía Redacción»: fórmulas y compendio forense"
            />

            {verGuiaRedaccion && (
                <ModalGuiaRedaccion cerrar={() => setVerGuiaRedaccion(false)} />
            )}
        </div>
    );
}