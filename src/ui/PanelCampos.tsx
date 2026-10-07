import {
    memo, useCallback, useEffect, useMemo, useRef, useState,
    type FormEvent, type KeyboardEvent, type ReactNode,
} from 'react';
import { camposSugeridos, tipoSugerido } from '../application/camposModelo';
import {
    SECCIONES_PANEL, construirGrupoPropios, construirGrupoSugeridos, construirPanel, construirPanelAmbito,
    describirBloque, rolDesdeTexto,
    type FuentePersona, type GrupoPanel, type ItemPanel, type SeccionPanel,
} from '../domain/catalogo';
import { TIPOS_CAMPO, hacerOpcional, type CampoPropio, type TipoCampo } from '../domain/fuenteModelo';
import { claveCampo, claveNormalizada, etiquetaRol } from '../domain/texto';
import { ROLES_CONOCIDOS, TIPOS_EXPEDIENTE } from '../domain/tiposExpediente';
import { Icono, copiarConAviso } from './comunes';

const ROLES_RAPIDOS = ['demandante', 'demandado', 'vendedor', 'comprador', 'arrendador', 'arrendatario', 'poderdante', 'apoderado'];
const CLAVE_RECIENTES = 'legalhub.panel.recientes';
const PREF_BLANCO = 'legalhub.panel.enBlanco';
const PREF_CODIGO = 'legalhub.panel.verCodigo';
const MAX_RECIENTES = 5;
const SIN_AMBITO: readonly string[] = [];

function leerRecientes(): ItemPanel[] {
    try {
        const o: unknown = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? '[]');
        if (!Array.isArray(o)) return [];
        return o
            .filter((x) => !!x && typeof x.etiqueta === 'string' && typeof x.texto === 'string')
            .map((x) => ({
                etiqueta: x.etiqueta as string, texto: x.texto as string, bloque: !!x.bloque,
                ejemplo: typeof x.ejemplo === 'string' ? (x.ejemplo as string) : undefined,
            }))
            .slice(0, MAX_RECIENTES);
    } catch {
        return [];
    }
}

function guardarRecientes(l: ItemPanel[]): void {
    try {
        localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(l));
    } catch {
        /* sin almacenamiento: no pasa nada */
    }
}

function usePreferencia(clave: string, inicial: boolean): [boolean, (v: boolean) => void] {
    const [valor, setValor] = useState<boolean>(() => {
        try {
            const g = localStorage.getItem(clave);
            return g === null ? inicial : g === '1';
        } catch {
            return inicial;
        }
    });
    const poner = useCallback((v: boolean) => {
        setValor(v);
        try {
            localStorage.setItem(clave, v ? '1' : '0');
        } catch {
            /* sin almacenamiento */
        }
    }, [clave]);
    return [valor, poner];
}

/** Marca como opcionales («?») todos los campos de un texto; los bloques no se tocan. */
const volverOpcional = (t: string) => t.replace(/\{\{[^}]*\}\}/g, (m) => hacerOpcional(m));

const rolesSugeridos = (materia?: string): string[] => {
    const t = TIPOS_EXPEDIENTE.find((x) => x.clave === materia);
    return t && t.roles.length > 0 ? [...t.roles] : ROLES_RAPIDOS;
};

const tipoBloque = (texto: string) => (/\{\{#hay_/.test(texto) ? 'Condicional' : 'Se repite');

/* ---------------- Fila: etiqueta + ejemplo en una línea; la ayuda va en el tooltip ---------------- */
const Fila = memo(function Fila({ item, onUsar, verCodigo }: {
    item: ItemPanel; onUsar: (i: ItemPanel) => void; verCodigo: boolean;
}) {
    return (
        <div className="pc-item">
            <button type="button" className="pc-insertar"
                title={item.ayuda ?? 'Clic para insertar en el cursor'}
                onMouseDown={(e) => e.preventDefault()} onClick={() => onUsar(item)}>
                <span className="pc-etiq">
                    {item.etiqueta}
                    {item.bloque && <span className={`pc-tag${/\{\{#hay_/.test(item.texto) ? ' cond' : ''}`}>{tipoBloque(item.texto)}</span>}
                </span>
                {item.ejemplo && <span className="pc-ejemplo">Ej.: {item.ejemplo}</span>}
                {verCodigo && <code className="pc-codigo">{item.texto}</code>}
            </button>
            <button type="button" className="btn btn-fan btn-icono btn-sm" title="Copiar el código para pegarlo en otro lugar"
                aria-label="Copiar código" onMouseDown={(e) => e.preventDefault()} onClick={() => void copiarConAviso(item.texto)}>
                <Icono n="copiar" tam={15} />
            </button>
        </div>
    );
});

function Grupo({ g, abierto, forzar, alternar, onUsar, verCodigo, pie }: {
    g: GrupoPanel; abierto: boolean; forzar: boolean;
    alternar: (id: string, porDefecto: boolean) => void; onUsar: (i: ItemPanel) => void; verCodigo: boolean;
    pie?: ReactNode;
}) {
    const [mas, setMas] = useState(false);
    const visible = forzar || abierto;
    const principales = g.items.filter((i) => !i.avanzado);
    const extra = g.items.filter((i) => i.avanzado);
    const verExtra = forzar || mas || principales.length === 0;
    const fila = (i: ItemPanel, k: number) => <Fila key={`${i.texto}:${k}`} item={i} onUsar={onUsar} verCodigo={verCodigo} />;
    return (
        <section className="pc-grupo">
            <button type="button" className="pc-grupo-tit" aria-expanded={visible}
                onMouseDown={(e) => e.preventDefault()} onClick={() => alternar(g.id, !!g.abierto)}>
                <span>{g.titulo}</span>
                <span className="suave">{visible ? '−' : '+'}</span>
            </button>
            {visible && (
                <>
                    {g.ayuda && <p className="pc-ayuda">{g.ayuda}</p>}
                    {principales.map(fila)}
                    {extra.length > 0 && !verExtra && (
                        <button type="button" className="pc-mas" onMouseDown={(e) => e.preventDefault()} onClick={() => setMas(true)}>
                            Más datos ({extra.length})…
                        </button>
                    )}
                    {verExtra && extra.map(fila)}
                    {pie}
                </>
            )}
        </section>
    );
}

/* ---------------- Creador de campos propios ---------------- */
function CrearCampo({ total, declaradas, onCrear, onAdministrar }: {
    total: number;
    declaradas: ReadonlySet<string>;
    onCrear: (c: CampoPropio) => void;
    onAdministrar?: () => void;
}) {
    const [abierto, setAbierto] = useState(total === 0);
    const [etiqueta, setEtiqueta] = useState('');
    const [tipo, setTipo] = useState<TipoCampo>('texto');
    const [manual, setManual] = useState(false);
    const [requerido, setRequerido] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const entrada = useRef<HTMLInputElement>(null);
    const clave = claveCampo(etiqueta);
    const existe = !!clave && declaradas.has(clave);

    function cambiarNombre(v: string) {
        setEtiqueta(v);
        setError(null);
        if (!manual) setTipo(tipoSugerido(claveCampo(v)));
    }

    function enviar(ev: FormEvent<HTMLFormElement>) {
        ev.preventDefault();
        if (!clave) {
            setError('Escribe un nombre (letras o números)');
            return;
        }
        onCrear({ clave, etiqueta: etiqueta.trim(), tipo, requerido });
        setEtiqueta('');
        setTipo('texto');
        setManual(false);
        setError(null);
    }

    function abrir() {
        setAbierto(true);
        window.setTimeout(() => entrada.current?.focus(), 0);
    }

    if (!abierto) {
        return (
            <div className="pc-acciones">
                <button type="button" className="btn btn-sec btn-sm" onClick={abrir}><Icono n="mas" tam={14} /> Crear campo</button>
                {onAdministrar && total > 0 && (
                    <button type="button" className="btn btn-fan btn-sm" onClick={onAdministrar}>Administrar ({total})…</button>
                )}
            </div>
        );
    }

    return (
        <form className="pc-crear" onSubmit={enviar}>
            <input ref={entrada} aria-label="Nombre del campo" placeholder="Nombre: Plazo de entrega, Monto, Lugar…"
                value={etiqueta} onChange={(e) => cambiarNombre(e.target.value)} />
            <div className="pc-crear-fila">
                <select aria-label="Tipo de dato" value={tipo}
                    onChange={(e) => { setTipo(e.target.value as TipoCampo); setManual(true); }}>
                    {TIPOS_CAMPO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                </select>
                <label className="casilla">
                    <input type="checkbox" checked={requerido} onChange={(e) => setRequerido(e.target.checked)} />
                    Obligatorio
                </label>
            </div>
            <p className="pc-nota">
                {existe
                    ? `Ya tienes «caso.${clave}»: se insertará el que ya existe.`
                    : clave ? `Se insertará como caso.${clave}` : 'Si no está en el expediente, el asistente lo pide al generar.'}
            </p>
            {error && <p className="pc-error">{error}</p>}
            <div className="pc-acciones">
                <button type="submit" className="btn btn-pri btn-sm">Crear e insertar</button>
                {total > 0 && <button type="button" className="btn btn-fan btn-sm" onClick={() => setAbierto(false)}>Cancelar</button>}
                {onAdministrar && total > 0 && (
                    <button type="button" className="btn btn-fan btn-sm" onClick={onAdministrar}>Administrar ({total})…</button>
                )}
            </div>
        </form>
    );
}

/* ---------------- Panel ---------------- */
export function PanelCampos({ campos, ambito = SIN_AMBITO, materia, onInsertar, onCrearCampo, onAdministrar }: {
    campos: CampoPropio[];
    /** Bloques «{{#…}}» abiertos donde está el cursor del editor. */
    ambito?: readonly string[];
    /** Tipo de expediente del modelo: sugiere roles y campos habituales. */
    materia?: string;
    onInsertar: (texto: string, bloque: boolean) => void;
    /** Declara el campo (si no existe) y lo inserta en el cursor. */
    onCrearCampo: (c: CampoPropio) => void;
    /** Abre el diálogo «Campos del caso». */
    onAdministrar?: () => void;
}) {
    const rolesSug = useMemo(() => rolesSugeridos(materia), [materia]);
    const [rolElegido, setRolElegido] = useState<string | null>(null);
    const [fuente, setFuente] = useState<FuentePersona>('rol');
    const rol = rolElegido ?? rolesSug[0] ?? 'demandante';
    const rolActual = rolDesdeTexto(rol);
    const [seccion, setSeccion] = useState<SeccionPanel>('personas');
    const [q, setQ] = useState('');
    const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
    const [recientes, setRecientes] = useState<ItemPanel[]>(leerRecientes);
    const [enBlanco, setEnBlanco] = usePreferencia(PREF_BLANCO, false);
    const [verCodigo, setVerCodigo] = usePreferencia(PREF_CODIGO, false);
    const cuerpo = useRef<HTMLDivElement>(null);
    const buscador = useRef<HTMLInputElement>(null);
    const insertar = useRef(onInsertar);

    useEffect(() => {
        insertar.current = onInsertar;
    });
    useEffect(() => {
        guardarRecientes(recientes);
    }, [recientes]);

    const usar = useCallback((item: ItemPanel) => {
        insertar.current(enBlanco && !item.bloque ? volverOpcional(item.texto) : item.texto, !!item.bloque);
        setRecientes((l) => [
            { etiqueta: item.etiqueta, texto: item.texto, bloque: !!item.bloque, ejemplo: item.ejemplo },
            ...l.filter((x) => x.texto !== item.texto),
        ].slice(0, MAX_RECIENTES));
    }, [enBlanco]);

    const alternar = useCallback((id: string, porDefecto: boolean) => {
        setAbiertos((a) => ({ ...a, [id]: !(a[id] ?? porDefecto) }));
    }, []);

    const ctx = useMemo(() => construirPanelAmbito(ambito), [ambito]);
    const declaradas = useMemo(() => new Set(campos.map((c) => claveCampo(c.clave))), [campos]);
    const camposSug = useMemo(() => camposSugeridos(materia, campos), [materia, campos]);
    const grupos = useMemo<GrupoPanel[]>(() => {
        const sug = construirGrupoSugeridos(camposSug);
        return [
            ...(ctx ? [ctx] : []),
            construirGrupoPropios(campos),
            ...(sug ? [sug] : []),
            ...construirPanel(rol, fuente),
        ];
    }, [ctx, campos, camposSug, rol, fuente]);

    const tokens = claveNormalizada(q.trim()).split(/\s+/).filter(Boolean);
    const buscando = tokens.length > 0;
    const coincide = (i: ItemPanel) => {
        const h = claveNormalizada(`${i.etiqueta} ${i.ejemplo ?? ''} ${i.ayuda ?? ''} ${i.claves ?? ''} ${i.texto}`);
        return tokens.every((t) => h.includes(t));
    };
    const nombreSeccion = (s: SeccionPanel) => SECCIONES_PANEL.find((x) => x.id === s)?.etiqueta ?? '';

    const delTab = buscando ? grupos : grupos.filter((g) => g === ctx || g.seccion === seccion);
    const reciente: GrupoPanel[] = !buscando && recientes.length > 0
        ? [{ id: 'recientes', seccion, titulo: 'Usados hace poco', abierto: true, items: recientes }]
        : [];
    const orden = [...delTab.filter((g) => g === ctx), ...reciente, ...delTab.filter((g) => g !== ctx)];
    const visibles = orden
        .map((g) => ({
            ...g,
            titulo: buscando && g !== ctx ? `${nombreSeccion(g.seccion)} · ${g.titulo}` : g.titulo,
            items: buscando ? g.items.filter(coincide) : g.items,
        }))
        .filter((g) => (buscando ? g.items.length > 0 : g.items.length > 0 || !!g.ayuda));

    function teclasBuscador(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Escape') {
            setQ('');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            cuerpo.current?.querySelector<HTMLButtonElement>('.pc-insertar')?.focus();
        } else if (e.key === 'Enter') {
            const primero = visibles[0]?.items[0];
            if (primero) {
                e.preventDefault();
                usar(primero);
            }
        }
    }

    function teclasLista(e: KeyboardEvent<HTMLDivElement>) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const botones = Array.from(cuerpo.current?.querySelectorAll<HTMLButtonElement>('.pc-insertar') ?? []);
        const i = botones.indexOf(document.activeElement as HTMLButtonElement);
        if (i < 0) return;
        e.preventDefault();
        if (e.key === 'ArrowUp' && i === 0) buscador.current?.focus();
        else botones[Math.max(0, Math.min(botones.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    }

    return (
        <div className="pc">
            <div className="pc-cab">
                <h3>Insertar en el documento</h3>
                <input ref={buscador} type="search" aria-label="Buscar dato" value={q}
                    placeholder="Buscar: cédula, domicilio, precio… (Enter inserta)"
                    onChange={(e) => setQ(e.target.value)} onKeyDown={teclasBuscador} />
                {!buscando && (
                    <div className="pc-tabs" role="tablist" aria-label="Tipo de dato">
                        {SECCIONES_PANEL.map((s) => (
                            <button key={s.id} type="button" role="tab" aria-selected={s.id === seccion}
                                className={`pc-tab${s.id === seccion ? ' activa' : ''}`}
                                onMouseDown={(e) => e.preventDefault()} onClick={() => setSeccion(s.id)}>
                                {s.etiqueta}
                            </button>
                        ))}
                    </div>
                )}
                {ambito.length > 0 && <div className="pc-ctx">Cursor dentro de: {ambito.map(describirBloque).join(' › ')}</div>}
            </div>

            <div className="pc-cuerpo" ref={cuerpo} onKeyDown={teclasLista}>
                {(seccion === 'personas' || buscando) && (
                    <div className="pc-rol">
                        <span className="campo-etiq">¿De quién hablas?</span>
                        <div className="chips">
                            {rolesSug.slice(0, 12).map((r) => (
                                <button key={r} type="button" className={`chip${fuente === 'rol' && rolActual === r ? ' sel' : ''}`}
                                    onClick={() => { setRolElegido(r); setFuente('rol'); }}>
                                    {etiquetaRol(r)}
                                </button>
                            ))}
                            <button type="button" className={`chip${fuente === 'cliente' ? ' sel' : ''}`} onClick={() => setFuente('cliente')}>Cliente</button>
                            <button type="button" className={`chip${fuente === 'abogado' ? ' sel' : ''}`} onClick={() => setFuente('abogado')}>Abogado (yo)</button>
                        </div>
                        {fuente === 'rol' && (
                            <>
                                <input list="roles-panel" aria-label="Rol de las partes" value={rol}
                                    placeholder="Otro rol: fiador, testigo…" onChange={(e) => setRolElegido(e.target.value)} />
                                <datalist id="roles-panel">{ROLES_CONOCIDOS.map((r) => <option key={r} value={r} />)}</datalist>
                            </>
                        )}
                    </div>
                )}

                {visibles.length === 0 && (
                    <p className="pc-ayuda">
                        {buscando
                            ? `No encontré «${q.trim()}». Prueba otra palabra (cédula, domicilio, fecha, precio…) o cambia «¿De quién hablas?».`
                            : 'Nada para mostrar aquí.'}
                    </p>
                )}
                {visibles.map((g) => (
                    <Grupo key={g.id} g={g} abierto={abiertos[g.id] ?? !!g.abierto} forzar={buscando}
                        alternar={alternar} onUsar={usar} verCodigo={verCodigo}
                        pie={g.id === 'propios' && !buscando
                            ? <CrearCampo total={campos.length} declaradas={declaradas} onCrear={onCrearCampo} onAdministrar={onAdministrar} />
                            : undefined} />
                ))}
            </div>

            <div className="pc-pie">
                <details className="pc-opc">
                    <summary>Opciones</summary>
                    <label className="casilla"
                        title="Normalmente, si falta un dato la generación se detiene y te lo avisa (es lo más seguro). Con esta opción, lo insertado queda en blanco; la hoja de verificación te lo marca antes de generar.">
                        <input type="checkbox" checked={enBlanco} onChange={(e) => setEnBlanco(e.target.checked)} />
                        Si falta un dato, dejarlo en blanco
                    </label>
                    <label className="casilla">
                        <input type="checkbox" checked={verCodigo} onChange={(e) => setVerCodigo(e.target.checked)} />
                        Mostrar el código de cada campo
                    </label>
                </details>
                <p className="pc-ayuda">Clic: inserta en el cursor · Doble clic sobre un campo del texto: editarlo.</p>
            </div>
        </div>
    );
}