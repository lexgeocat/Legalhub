import { useRef, useState, type ReactNode } from 'react';
import { bloquesATexto, type Bloque, type ConfigPagina } from '../../domain/modelos/fuenteModelo';
import { Tb } from './BarraFormato';
import { Alerta, Icono, Insignia, confirmar } from '../_core/comunes';
import { EditorHoja } from './EditorHoja';
import type { ControlHoja } from './HojaEditable';
import { PanelLeyes } from '../leyes/PanelLeyes';
import { PanelDiccionario } from '../diccionarios/PanelDiccionario';

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

    async function salir() {
        if (modificado && !(await confirmar('Hay cambios sin aplicar. ¿Descartarlos?', 'Descartar cambios'))) return;
        descartar();
    }

    return (
        <div className="ed-ventana alto">
            <header className="ed-barra-titulo">
                <button type="button" className="btn btn-fan" onClick={() => void salir()}><Icono n="atras" /> Vista previa</button>
                <b className="ed-titulo">Editar documento</b>
                {modificado && <Insignia tono="ambar">Sin aplicar</Insignia>}
                <div className="espacio" />
                <button type="button" className="btn btn-sec" onClick={() => void salir()}>Descartar</button>
                <button type="button" className="btn btn-pri"
                    onClick={() => aplicar(hoja.current?.leerTexto() ?? textoInicial, config)}>
                    Aplicar al documento
                </button>
            </header>

            {aviso && <div className="ed-aviso"><Alerta tipo="adv">{aviso}</Alerta></div>}

            <EditorHoja
                hoja={hoja}
                textoInicial={textoInicial}
                config={config}
                onConfig={(c) => { setConfig(c); setModificado(true); }}
                onCambio={() => setModificado(true)}
                barra={
                    <>
                        <Tb
                            titulo="Buscar y citar un artículo de una ley en el cursor"
                            activo={panelActivo === 'leyes'}
                            onClick={() => setPanelActivo((p) => (p === 'leyes' ? null : 'leyes'))}
                        >
                            Leyes
                        </Tb>
                        <Tb
                            titulo="Buscar términos y citar definiciones doctrinales en el cursor"
                            activo={panelActivo === 'diccionario'}
                            onClick={() => setPanelActivo((p) => (p === 'diccionario' ? null : 'diccionario'))}
                        >
                            Diccionario
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
                ayuda="Ctrl+N negrita · Ctrl+K cursiva · Ctrl+S subrayado · arrastra los márgenes en la regla · «Leyes» y «Diccionario»: cita en cursor"
            />
        </div>
    );
}