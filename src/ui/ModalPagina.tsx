import { useState, type FormEvent } from 'react';
import {
    AREA_MIN_CM, ESPACIO_MAX_PT, MARGEN_MAX_CM, PAGINA_CM, PRESETS_MARGENES, presetDe,
    type ConfigPagina, type Margenes, type TamanoPagina,
} from '../domain/fuenteModelo';
import { coma } from './BarraFormato';
import { Aviso, Campo, Modal } from './comunes';

const LADOS: (keyof Margenes)[] = ['superior', 'inferior', 'izquierdo', 'derecho'];
const NOMBRE_LADO: Record<keyof Margenes, string> = {
    superior: 'Superior', inferior: 'Inferior', izquierdo: 'Izquierdo', derecho: 'Derecho',
};

export interface EspacioParrafo { espacioAntes: number; espacioDespues: number }

const aTextos = (m: Margenes): Record<keyof Margenes, string> => ({
    superior: coma(m.superior), inferior: coma(m.inferior), izquierdo: coma(m.izquierdo), derecho: coma(m.derecho),
});
const aNumero = (s: string) => (s.trim() === '' ? NaN : Number(s.trim().replace(',', '.')));

function MiniPagina({ w, h, m }: { w: number; h: number; m: Margenes | null }) {
    const ancho = 120;
    const k = ancho / w;
    const alto = h * k;
    const x = (m?.izquierdo ?? 0) * k;
    const y = (m?.superior ?? 0) * k;
    const anchoUtil = m ? Math.max(0, (w - m.izquierdo - m.derecho) * k) : 0;
    const altoUtil = m ? Math.max(0, (h - m.superior - m.inferior) * k) : 0;
    const lineas = Math.min(40, Math.floor((altoUtil - 2) / 6));
    return (
        <svg width={ancho} height={alto} aria-hidden="true" style={{ flex: 'none', background: '#fff', border: '1px solid var(--borde-fuerte)', boxShadow: 'var(--sombra)' }}>
            {m && anchoUtil > 0 && altoUtil > 0 && (
                <>
                    <rect x={x} y={y} width={anchoUtil} height={altoUtil} fill="none" stroke="#8b9bd9" strokeDasharray="3 2" />
                    {Array.from({ length: Math.max(0, lineas) }, (_, i) => (
                        <line key={i} x1={x + 3} x2={x + anchoUtil - 3} y1={y + 5 + i * 6} y2={y + 5 + i * 6} stroke="#c3c8d6" strokeWidth="1.5" />
                    ))}
                </>
            )}
        </svg>
    );
}

export function ModalPagina({ config, aplicar, cerrar }: {
    config: ConfigPagina;
    aplicar: (tamano: TamanoPagina, m: Margenes, simetricos: boolean, espacio: EspacioParrafo) => void;
    cerrar: () => void;
}) {
    const [tamano, setTamano] = useState<TamanoPagina>(config.tamano);
    const [txt, setTxt] = useState(aTextos(config.margenes));
    const [sim, setSim] = useState(config.simetricos);
    const [antes, setAntes] = useState(coma(config.espacioAntes));
    const [despues, setDespues] = useState(coma(config.espacioDespues));
    const [error, setError] = useState<string | null>(null);

    const nums: Margenes = {
        superior: aNumero(txt.superior), inferior: aNumero(txt.inferior),
        izquierdo: aNumero(txt.izquierdo), derecho: aNumero(txt.derecho),
    };
    const valido = LADOS.every((l) => Number.isFinite(nums[l]) && nums[l] >= 0);
    const preset = valido ? presetDe(nums, sim) : undefined;
    const pag = PAGINA_CM[tamano];

    const enviar = (ev: FormEvent<HTMLFormElement>) => {
        ev.preventDefault();
        if (!valido) {
            setError('Escribe cada margen en centímetros (por ejemplo 2,5).');
            return;
        }
        if (LADOS.some((l) => nums[l] > MARGEN_MAX_CM)) {
            setError(`Ningún margen puede pasar de ${MARGEN_MAX_CM} cm.`);
            return;
        }
        if (pag.w - nums.izquierdo - nums.derecho < AREA_MIN_CM) {
            setError(`Los márgenes izquierdo y derecho dejan menos de ${AREA_MIN_CM} cm de ancho para el texto.`);
            return;
        }
        if (pag.h - nums.superior - nums.inferior < AREA_MIN_CM) {
            setError(`Los márgenes superior e inferior dejan menos de ${AREA_MIN_CM} cm de alto para el texto.`);
            return;
        }
        const nAntes = aNumero(antes);
        const nDespues = aNumero(despues);
        if ([nAntes, nDespues].some((n) => !Number.isFinite(n) || n < 0 || n > ESPACIO_MAX_PT)) {
            setError(`El espacio antes y después va de 0 a ${ESPACIO_MAX_PT} pt (por ejemplo 6).`);
            return;
        }
        aplicar(tamano, nums, sim, { espacioAntes: nAntes, espacioDespues: nDespues });
        cerrar();
    };

    return (
        <Modal titulo="Configurar página" cerrar={cerrar}
            pie={
                <>
                    <span className="espacio" />
                    <button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button>
                    <button type="submit" form="form-pagina" className="btn btn-pri">Aplicar</button>
                </>
            }>
            <Aviso error={error} />
            <form id="form-pagina" onSubmit={enviar}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 20, alignItems: 'start' }}>
                <div className="form-grid">
                    <Campo etiqueta="Tamaño de papel">
                        <select value={tamano} onChange={(e) => { setTamano(e.target.value as TamanoPagina); setError(null); }}>
                            <option value="carta">Carta (21,6 × 27,9 cm)</option>
                            <option value="oficio">Oficio (21,6 × 33 cm)</option>
                            <option value="a4">A4 (21 × 29,7 cm)</option>
                        </select>
                    </Campo>
                    <Campo etiqueta="Márgenes predefinidos">
                        <select value={preset?.id ?? 'personalizado'}
                            onChange={(e) => {
                                const p = PRESETS_MARGENES.find((x) => x.id === e.target.value);
                                if (p) { setTxt(aTextos(p.margenes)); setSim(p.simetricos); setError(null); }
                            }}>
                            {PRESETS_MARGENES.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
                            {!preset && <option value="personalizado">Personalizado</option>}
                        </select>
                    </Campo>
                    {LADOS.map((l) => (
                        <Campo key={l} etiqueta={`${NOMBRE_LADO[l]} (cm)`}>
                            <input inputMode="decimal" value={txt[l]}
                                onChange={(e) => { setTxt((t) => ({ ...t, [l]: e.target.value })); setError(null); }} />
                        </Campo>
                    ))}
                    <label className="casilla ancho">
                        <input type="checkbox" checked={sim} onChange={(e) => setSim(e.target.checked)} />
                        Márgenes simétricos (espejo): el izquierdo pasa a ser el interior y se alterna en cada hoja
                    </label>

                    <h4 className="ancho grupo-titulo">Párrafo</h4>
                    <Campo etiqueta="Espacio antes (pt)">
                        <input inputMode="decimal" value={antes}
                            onChange={(e) => { setAntes(e.target.value); setError(null); }} />
                    </Campo>
                    <Campo etiqueta="Espacio después (pt)">
                        <input inputMode="decimal" value={despues}
                            onChange={(e) => { setDespues(e.target.value); setError(null); }} />
                    </Campo>
                    <p className="suave ancho">
                        Equivale a Word → Párrafo → Espaciado (predeterminado: antes 0 · después 6). Se aplica a todo el texto normal;
                        los títulos (#) y subtítulos (##) llevan su propio espacio. El interlineado se cambia desde la cinta.
                    </p>

                    <p className="suave ancho">
                        Memorial: superior 5,5 · inferior 2 · izquierdo 4 · derecho 2. Los márgenes se aplican a todas las páginas, como en Word.
                    </p>
                </div>
                <MiniPagina w={pag.w} h={pag.h} m={valido ? nums : null} />
            </form>
        </Modal>
    );
}