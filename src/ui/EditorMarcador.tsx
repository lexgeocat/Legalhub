import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { formasConcordancia, type FormasConcordancia } from '../domain/concordancia';
import type { CampoPropio, TipoCampo } from '../domain/fuenteModelo';
import {
    TRANSFORMACIONES, armarDato, armarGenero, describirMarcador, editarMarcador, formatosPara, resolverRol,
    type ContextoMarcadores, type EdicionMarcador, type Formato, type Transformacion,
} from '../domain/marcadores';
import { claveCampo, claveNormalizada, etiquetaRol, pluralRol } from '../domain/texto';
import { Alerta, Aviso, Campo, Modal } from './comunes';

/** Cambio que el editor pide en el campo declarado («Datos» del constructor). */
export interface CambioCampo { clave: string; tipo?: TipoCampo; requerido?: boolean }
type Aplicar = (marcador: string, cambio?: CambioCampo) => void;

const TIPO_DE_FORMATO: Record<string, TipoCampo> = { fecha: 'fecha', moneda: 'moneda', superficie: 'superficie', literal: 'numero' };
const TIPOS_ESPECIALES = new Set<TipoCampo>(['fecha', 'moneda', 'superficie', 'numero']);

function Vista({ marcador, contexto }: { marcador: string; contexto: ContextoMarcadores }) {
    const i = describirMarcador(marcador, contexto);
    return (
        <div className="cb-vista ancho">
            <span className="cb-sub">Así se ve en el documento</span>
            <div>
                <span className="mk" data-k={i.tipo} style={{ '--h': i.matiz } as CSSProperties}>
                    <span className="mk-e">{i.corto}</span>
                </span>
                <span className="suave"> {i.titulo}</span>
            </div>
            {i.detalle && <span className="suave">{i.detalle}</span>}
        </div>
    );
}

/* ---------------- Dato (persona, caso, expediente…) ---------------- */
function FormDato({ e, contexto, campos, aplicar }: {
    e: Extract<EdicionMarcador, { n: 'dato' }>;
    contexto: ContextoMarcadores;
    campos: CampoPropio[];
    aplicar: Aplicar;
}) {
    const [opcional, setOpcional] = useState(e.opcional);
    const [transformacion, setTransformacion] = useState<Transformacion>(e.transformacion);
    const [formato, setFormato] = useState<Formato>(e.formato);
    const formatos = formatosPara(e.ruta, e.formato);
    const marcador = armarDato({ ruta: e.ruta, opcional, transformacion, formato });
    const segs = e.ruta.split('.');
    const esCaso = claveNormalizada(segs[0]) === 'caso' && segs.length === 2;
    const declarado = esCaso ? campos.find((c) => claveCampo(c.clave) === claveCampo(segs[1])) : undefined;

    function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        let cambio: CambioCampo | undefined;
        if (declarado) {
            const tipo = formato ? TIPO_DE_FORMATO[formato] : TIPOS_ESPECIALES.has(declarado.tipo) ? 'texto' : declarado.tipo;
            const requerido = !opcional;
            if (tipo !== declarado.tipo || requerido !== declarado.requerido) cambio = { clave: declarado.clave, tipo, requerido };
        }
        aplicar(marcador, cambio);
    }

    return (
        <form id="form-marcador" className="form-grid" onSubmit={enviar}>
            <Vista marcador={marcador} contexto={contexto} />
            <Campo etiqueta="Mostrar como" ancho={formatos.length <= 1}>
                <select value={transformacion} onChange={(ev) => setTransformacion(ev.target.value as Transformacion)}>
                    {TRANSFORMACIONES.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                </select>
            </Campo>
            {formatos.length > 1 && (
                <Campo etiqueta="Formato">
                    <select value={formato} onChange={(ev) => setFormato(ev.target.value as Formato)}>
                        {formatos.map((f) => <option key={f.valor} value={f.valor}>{f.etiqueta}</option>)}
                    </select>
                </Campo>
            )}
            <label className="casilla ancho">
                <input type="checkbox" checked={opcional} onChange={(ev) => setOpcional(ev.target.checked)} />
                Opcional: si no hay dato, queda en blanco (en vez de detener la generación)
            </label>
        </form>
    );
}

/* ---------------- Género ---------------- */
function FormGenero({ e, contexto, aplicar }: {
    e: Extract<EdicionMarcador, { n: 'genero' }>;
    contexto: ContextoMarcadores;
    aplicar: Aplicar;
}) {
    const [ruta, setRuta] = useState(e.ruta);
    const [f, setF] = useState<FormasConcordancia>(e.formas);
    const [error, setError] = useState<string | null>(null);
    const varias = resolverRol(ruta, contexto)?.plural ?? /s$/.test(claveNormalizada(ruta));
    const marcador = armarGenero(ruta, f, varias);

    const opciones = useMemo(() => {
        const l = [
            ...(contexto.partes ?? []).map((p) => ({ valor: pluralRol(p), etiqueta: `${etiquetaRol(pluralRol(p))} (una o varias personas)` })),
        ];
        return l.some((o) => claveNormalizada(o.valor) === claveNormalizada(e.ruta))
            ? l : [...l, { valor: e.ruta, etiqueta: etiquetaRol(e.ruta) }];
    }, [contexto.partes, e.ruta]);

    function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        if (!f.sm.trim() || !f.sf.trim()) {
            setError('Escribe al menos la forma masculina y la femenina.');
            return;
        }
        aplicar(marcador);
    }

    return (
        <form id="form-marcador" className="form-grid" onSubmit={enviar}>
            <Aviso error={error} />
            <Vista marcador={marcador} contexto={contexto} />
            <Campo etiqueta="¿De quién se habla?" ancho>
                <select value={ruta} onChange={(ev) => setRuta(ev.target.value)}>
                    {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                </select>
            </Campo>
            <Campo etiqueta="Masculino" ayuda="Si lo cambias, las demás formas se calculan solas.">
                <input value={f.sm} onChange={(ev) => { setF(formasConcordancia(ev.target.value)); setError(null); }} />
            </Campo>
            <Campo etiqueta="Femenino">
                <input value={f.sf} onChange={(ev) => setF({ ...f, sf: ev.target.value })} />
            </Campo>
            {varias && (
                <Campo etiqueta="Masculino (varios)">
                    <input value={f.pm} onChange={(ev) => setF({ ...f, pm: ev.target.value })} />
                </Campo>
            )}
            {varias && (
                <Campo etiqueta="Femenino (varias)">
                    <input value={f.pf} onChange={(ev) => setF({ ...f, pf: ev.target.value })} />
                </Campo>
            )}
        </form>
    );
}

/* ---------------- Código a mano ---------------- */
function FormLibre({ actual, avanzado, aplicar }: { actual: string; avanzado: boolean; aplicar: Aplicar }) {
    const [valor, setValor] = useState(actual);
    return (
        <form id="form-marcador" onSubmit={(ev) => { ev.preventDefault(); aplicar(valor.trim()); }}>
            {!avanzado && (
                <Alerta tipo="info">Este campo usa una combinación especial: se edita directamente su código.</Alerta>
            )}
            <Campo etiqueta="Código" ayuda="Ej.: {{caso.precio | moneda}}. Un «?» al final del nombre lo hace opcional.">
                <input className="mono" autoFocus value={valor} onChange={(ev) => setValor(ev.target.value)} />
            </Campo>
        </form>
    );
}

/* ---------------- Ventana ---------------- */
export function ModalMarcador({ actual, contexto, campos, aplicar, cerrar }: {
    actual: string;
    contexto: ContextoMarcadores;
    campos: CampoPropio[];
    /** Marcador vacío = quitar el campo. */
    aplicar: Aplicar;
    cerrar: () => void;
}) {
    const inicial = useMemo(() => editarMarcador(actual), [actual]);
    const [crudo, setCrudo] = useState(inicial.n === 'libre');
    const hecho: Aplicar = (m, cambio) => {
        aplicar(m, cambio);
        cerrar();
    };
    const titulo = inicial.n === 'genero' ? 'Editar género' : inicial.n === 'bloque' ? 'Bloque' : 'Editar campo';
    const guiado = inicial.n === 'genero' || inicial.n === 'dato';

    return (
        <Modal titulo={titulo} ancho="media" cerrar={cerrar}
            pie={
                <>
                    <button type="button" className="btn btn-peligro" onClick={() => hecho('')}>Quitar campo</button>
                    <span className="espacio" />
                    <button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button>
                    {(crudo || inicial.n !== 'bloque') && (
                        <button type="submit" form="form-marcador" className="btn btn-pri">Aplicar</button>
                    )}
                </>
            }>
            {crudo || inicial.n === 'libre' ? (
                <FormLibre actual={actual} avanzado={guiado} aplicar={hecho} />
            ) : inicial.n === 'genero' ? (
                <FormGenero e={inicial} contexto={contexto} aplicar={hecho} />
            ) : inicial.n === 'dato' ? (
                <FormDato e={inicial} contexto={contexto} campos={campos} aplicar={hecho} />
            ) : (
                <>
                    <Vista marcador={actual} contexto={contexto} />
                    <Alerta tipo="info">
                        Los bloques repiten o condicionan el texto que queda entre su inicio y su cierre.
                        Si quitas uno, quita también el otro.
                    </Alerta>
                </>
            )}
            {guiado && (
                <div>
                    <button type="button" className="btn btn-enlace" onClick={() => setCrudo((c) => !c)}>
                        {crudo ? 'Volver al editor sencillo' : 'Editar el código a mano'}
                    </button>
                </div>
            )}
        </Modal>
    );
}