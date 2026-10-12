import { esTextoLargo } from '../application/camposModelo';
import { etiquetaRol } from '../domain/texto';
import { Campo } from './comunes';

export interface CampoForm { clave: string; etiqueta: string; tipo: string; requerido?: boolean }

const NUMERICOS = new Set(['moneda', 'dolares', 'superficie', 'numero']);
const ES_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const esLargo = (c: CampoForm): boolean => c.tipo === 'texto_largo' || esTextoLargo(c.clave);

/** Campo de un dato (formulario o cuadro de llenado sobre el documento). */
export function EntradaDato({ c, valor, cambiar, enLinea = false }: {
    c: CampoForm; valor: string; cambiar: (v: string) => void; enLinea?: boolean;
}) {
    const largo = esLargo(c);
    const clase = enLinea ? `en-linea${largo ? ' largo' : ''}${valor.trim() ? '' : ' sin-valor'}` : undefined;

    // Una fecha guardada a mano que no sea AAAA-MM-DD se muestra como texto para no perderla.
    if (c.tipo === 'fecha' && (valor === '' || ES_ISO.test(valor))) {
        return (
            <input type="date" className={clase} aria-label={c.etiqueta} value={valor}
                style={enLinea ? { minWidth: '15ch' } : undefined} onChange={(ev) => cambiar(ev.target.value)} />
        );
    }
    if (largo) {
        return (
            <textarea className={clase} aria-label={c.etiqueta} rows={enLinea ? 3 : undefined}
                placeholder={enLinea ? c.etiqueta : undefined} value={valor} onChange={(ev) => cambiar(ev.target.value)} />
        );
    }
    const numerico = NUMERICOS.has(c.tipo);
    return (
        <input className={clase} aria-label={c.etiqueta} value={valor}
            inputMode={numerico ? 'decimal' : undefined}
            placeholder={numerico ? '1234,56' : enLinea ? c.etiqueta : undefined}
            style={enLinea ? { width: `${Math.min(48, Math.max(10, valor.length + 2))}ch` } : undefined}
            onChange={(ev) => cambiar(ev.target.value)} />
    );
}

/** Datos guardados que el modelo actual no usa: no se pierden al guardar. */
export function OtrosDatos({ conocidos, valores, cambiar }: {
    conocidos: readonly string[]; valores: Record<string, string>; cambiar: (clave: string, v: string) => void;
}) {
    const otros = Object.keys(valores).filter((k) => !conocidos.includes(k));
    if (otros.length === 0) return null;
    return (
        <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Otros datos guardados ({otros.length})</summary>
            <p className="suave">Este modelo no los usa, pero siguen guardados por si cambias de modelo.</p>
            <div className="form-grid" style={{ marginTop: 8 }}>
                {otros.map((k) => (
                    <Campo key={k} etiqueta={etiquetaRol(k)}>
                        <input value={valores[k] ?? ''} onChange={(ev) => cambiar(k, ev.target.value)} />
                    </Campo>
                ))}
            </div>
        </details>
    );
}