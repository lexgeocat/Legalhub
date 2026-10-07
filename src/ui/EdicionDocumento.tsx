import { useRef, useState, type ReactNode } from 'react';
import {
    bloquesATexto, margenesSeguros,
    type Alineacion, type Bloque, type ConfigPagina, type Margenes,
} from '../domain/fuenteModelo';
import { Alerta, confirmar } from './comunes';
import { FORMATO_INICIAL, HojaEditable, type ControlHoja, type FormatoActivo } from './HojaEditable';

const ICO = {
    deshacer: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
    rehacer: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
};
const ICO_ALIN: Record<Alineacion, string> = {
    left: 'M4 6h16 M4 10h10 M4 14h16 M4 18h10',
    center: 'M4 6h16 M7 10h10 M4 14h16 M7 18h10',
    right: 'M4 6h16 M10 10h10 M4 14h16 M10 18h10',
    both: 'M4 6h16 M4 10h16 M4 14h16 M4 18h16',
};
const ETIQ_ALIN: Record<Alineacion, string> = {
    left: 'Alinear a la izquierda', center: 'Centrar', right: 'Alinear a la derecha', both: 'Justificar',
};
const ALINEACIONES: Alineacion[] = ['left', 'center', 'right', 'both'];

function Ico({ d }: { d: string }) {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={d} />
        </svg>
    );
}

/** Botón de la cinta: no le quita el foco (ni la selección) a la hoja. */
function Tb({ titulo, activo, onClick, children }: {
    titulo: string; activo?: boolean; onClick: () => void; children: ReactNode;
}) {
    return (
        <button type="button" className={`ed-tb${activo ? ' on' : ''}`} title={titulo} aria-label={titulo}
            aria-pressed={activo} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
            {children}
        </button>
    );
}

const Sep = () => <span className="sep" />;

/** Edita un documento ya completado, con la misma hoja del editor de modelos. */
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
    const [formato, setFormato] = useState<FormatoActivo>(FORMATO_INICIAL);
    const [paginas, setPaginas] = useState(1);
    const [modificado, setModificado] = useState(false);

    const tocar = () => setModificado(true);
    const setMargen = (lado: keyof Margenes, cm: number) => {
        setConfig((c) => ({ ...c, margenes: margenesSeguros({ ...c.margenes, [lado]: cm }, c.tamano) }));
        tocar();
    };

    async function salir() {
        if (modificado && !(await confirmar('Hay cambios sin aplicar. ¿Descartarlos?', 'Descartar cambios'))) return;
        descartar();
    }

    return (
        <>
            {aviso && <Alerta tipo="adv">{aviso}</Alerta>}
            <div className="asist-edit">
                <div className="ed-cinta" role="toolbar" aria-label="Formato del documento">
                    <Tb titulo="Deshacer (Ctrl+Z)" onClick={() => hoja.current?.deshacer()}><Ico d={ICO.deshacer} /></Tb>
                    <Tb titulo="Rehacer (Ctrl+Y)" onClick={() => hoja.current?.rehacer()}><Ico d={ICO.rehacer} /></Tb>
                    <Sep />
                    <Tb titulo="Negrita (Ctrl+N)" activo={formato.negrita} onClick={() => hoja.current?.comando('negrita')}><b>N</b></Tb>
                    <Tb titulo="Cursiva (Ctrl+K)" activo={formato.cursiva} onClick={() => hoja.current?.comando('cursiva')}><i>K</i></Tb>
                    <Tb titulo="Subrayado (Ctrl+S)" activo={formato.subrayado} onClick={() => hoja.current?.comando('subrayado')}><u>S</u></Tb>
                    <Sep />
                    {ALINEACIONES.map((a) => (
                        <Tb key={a} titulo={ETIQ_ALIN[a]} activo={formato.alineacion === a} onClick={() => hoja.current?.alinear(a)}>
                            <Ico d={ICO_ALIN[a]} />
                        </Tb>
                    ))}
                    <Sep />
                    <Tb titulo="Salto de página (Ctrl+Enter)" onClick={() => hoja.current?.saltoPagina()}>Salto de página</Tb>
                    <div className="espacio" />
                    <button type="button" className="btn btn-fan btn-sm" onClick={() => void salir()}>Descartar</button>
                    <button type="button" className="btn btn-pri btn-sm"
                        onClick={() => aplicar(hoja.current?.leerTexto() ?? textoInicial, config)}>
                        Aplicar al documento
                    </button>
                </div>

                <div className="ed-pagina asist-hoja">
                    <HojaEditable
                        ref={hoja}
                        textoInicial={textoInicial}
                        config={config}
                        onCambio={tocar}
                        onFormato={setFormato}
                        onEditarCampo={() => undefined}
                        onMargenes={setMargen}
                        onConfigurarPagina={() => undefined}
                        onPaginas={setPaginas}
                    />
                </div>

                <div className="ed-estado">
                    <span>≈ {paginas} pág. · Ctrl+N negrita · Ctrl+K cursiva · Ctrl+S subrayado</span>
                    <span>Arrastra los márgenes en la regla</span>
                </div>
            </div>
        </>
    );
}