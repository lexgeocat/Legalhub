import { useMemo, type CSSProperties } from 'react';
import { esTextoLargo } from '../application/camposModelo';
import type { Bloque, BloqueParrafo, ConfigPagina } from '../domain/fuenteModelo';
import { pilaCss } from '../domain/fuentes';
import { analizarMarcador, describirMarcador, type ContextoMarcadores } from '../domain/marcadores';
import { claveCampo, claveNormalizada, etiquetaRol } from '../domain/texto';
import { Campo } from './comunes';

export interface CampoForm { clave: string; etiqueta: string; tipo: string; requerido?: boolean }

const NUMERICOS = new Set(['moneda', 'dolares', 'superficie', 'numero']);
const ES_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const esLargo = (c: CampoForm): boolean => c.tipo === 'texto_largo' || esTextoLargo(c.clave);

/** Campo de un dato (formulario o escrito directo en el documento). */
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

/* ---------------- Llenar sobre el documento ---------------- */
function ParrafoLleno({ b, config, campos, valores, cambiar, contexto, alChip }: {
    b: BloqueParrafo; config: ConfigPagina; campos: ReadonlyMap<string, CampoForm>; valores: Record<string, string>;
    cambiar: (clave: string, valor: string) => void; contexto: ContextoMarcadores; alChip?: () => void;
}) {
    const estilo: CSSProperties = {
        textAlign: b.alineacion === 'both' ? 'justify' : b.alineacion,
        lineHeight: b.interlineado,
        fontWeight: b.estilo === 'normal' ? undefined : 700,
        fontSize: b.estilo === 'titulo' ? `${config.tamanoPt + 2}pt` : undefined,
    };
    return (
        <p className="papel-p" style={estilo}>
            {b.tramos.length === 0 && '\u00A0'}
            {b.tramos.map((t, i) => {
                if (!t.marcador) {
                    return (
                        <span key={i} style={{
                            fontWeight: t.negrita ? 700 : undefined,
                            fontStyle: t.cursiva ? 'italic' : undefined,
                            textDecoration: t.subrayado ? 'underline' : undefined,
                            fontFamily: t.fuente ? pilaCss(t.fuente) : undefined,
                            fontSize: t.tamanoPt ? `${t.tamanoPt}pt` : undefined,
                        }}>{t.texto}</span>
                    );
                }
                const a = analizarMarcador(t.texto);
                const segs = a?.tipo === 'valor' ? a.ruta.split('.').map((x) => x.trim()) : [];
                if (segs.length === 2 && claveNormalizada(segs[0]) === 'caso') {
                    const clave = claveCampo(segs[1]);
                    const c = campos.get(clave);
                    if (c) return <EntradaDato key={i} enLinea c={c} valor={valores[clave] ?? ''} cambiar={(v) => cambiar(clave, v)} />;
                }
                // Dato de una parte, fecha de hoy, bloques…: se muestra como etiqueta (se completa solo).
                const m = describirMarcador(t.texto, contexto);
                return (
                    <span key={i} className="mk" data-k={m.tipo} style={{ '--h': m.matiz } as CSSProperties}
                        title={`${m.titulo}${m.detalle ? ` — ${m.detalle}` : ''}`} onClick={alChip}>
                        <span className="mk-e">{m.corto}</span>
                    </span>
                );
            })}
        </p>
    );
}

/** El modelo como documento, con los datos del caso como huecos que se escriben ahí mismo. */
export function LlenadoEnDocumento({ bloques, config, campos, roles, valores, cambiar, alChip }: {
    bloques: Bloque[]; config: ConfigPagina; campos: CampoForm[]; roles: string[];
    valores: Record<string, string>; cambiar: (clave: string, valor: string) => void; alChip?: () => void;
}) {
    const mapa = useMemo(() => new Map(campos.map((c) => [c.clave, c] as const)), [campos]);
    const contexto = useMemo<ContextoMarcadores>(
        () => ({ campos: Object.fromEntries(campos.map((c) => [c.clave, c.etiqueta])), partes: roles }),
        [campos, roles],
    );
    return (
        <div className="papel" style={{ fontFamily: pilaCss(config.fuente), fontSize: `${config.tamanoPt}pt`, lineHeight: config.interlineado }}>
            {bloques.length === 0 && <p className="suave">El documento está vacío.</p>}
            {bloques.map((b, i) => (b.tipo === 'salto'
                ? <hr key={i} className="papel-salto" />
                : <ParrafoLleno key={i} b={b} config={config} campos={mapa} valores={valores} cambiar={cambiar} contexto={contexto} alChip={alChip} />))}
        </div>
    );
}