import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { construirPanel, construirPanelAmbito, type GrupoPanel, type ItemPanel } from '../domain/catalogo';
import { marcadorDeCampo, type CampoPropio } from '../domain/fuenteModelo';
import { claveCampo, claveNormalizada } from '../domain/texto';
import { ROLES_CONOCIDOS } from '../domain/tiposExpediente';
import { copiarConAviso, Icono } from './comunes';

const ROLES_RAPIDOS = ['demandante', 'demandado', 'vendedor', 'comprador', 'arrendador', 'arrendatario', 'poderdante', 'apoderado'];
const CLAVE_RECIENTES = 'legalhub.panel.recientes';
const MAX_RECIENTES = 6;
const SIN_AMBITO: readonly string[] = [];

function leerRecientes(): ItemPanel[] {
    try {
        const o: unknown = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? '[]');
        if (!Array.isArray(o)) return [];
        return o
            .filter((x) => !!x && typeof x.etiqueta === 'string' && typeof x.texto === 'string')
            .map((x) => ({ etiqueta: x.etiqueta as string, texto: x.texto as string, bloque: !!x.bloque }))
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

const Fila = memo(function Fila({ item, onUsar }: { item: ItemPanel; onUsar: (i: ItemPanel) => void }) {
    return (
        <div className="pc-item">
            <button type="button" className="pc-insertar" title="Insertar en el cursor"
                onMouseDown={(e) => e.preventDefault()} onClick={() => onUsar(item)}>
                <span className="pc-etiq">
                    {item.etiqueta}
                    {item.bloque && <span className="pc-tag">Bloque</span>}
                </span>
                <code className="pc-codigo">{item.texto}</code>
            </button>
            <button type="button" className="btn btn-fan btn-icono btn-sm" title="Copiar marcador"
                onMouseDown={(e) => e.preventDefault()} onClick={() => void copiarConAviso(item.texto)}>
                <Icono n="copiar" tam={15} />
            </button>
        </div>
    );
});

function Grupo({ g, abierto, forzar, alternar, onUsar }: {
    g: GrupoPanel; abierto: boolean; forzar: boolean; alternar: (id: string) => void; onUsar: (i: ItemPanel) => void;
}) {
    const visible = forzar || abierto;
    return (
        <section className="pc-grupo">
            <button type="button" className="pc-grupo-tit" aria-expanded={visible} onClick={() => alternar(g.id)}>
                <span>{g.titulo}</span>
                <span className="suave">{visible ? '−' : '+'}</span>
            </button>
            {visible && (
                <>
                    {g.ayuda && <p className="pc-ayuda">{g.ayuda}</p>}
                    {g.items.map((i, k) => <Fila key={`${i.texto}:${k}`} item={i} onUsar={onUsar} />)}
                </>
            )}
        </section>
    );
}

export function PanelCampos({ campos, ambito = SIN_AMBITO, onInsertar }: {
    campos: CampoPropio[];
    /** Bloques «{{#…}}» abiertos donde está el cursor del editor. */
    ambito?: readonly string[];
    onInsertar: (texto: string, bloque: boolean) => void;
}) {
    const [rol, setRol] = useState('demandante');
    const [q, setQ] = useState('');
    const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
    const [recientes, setRecientes] = useState<ItemPanel[]>(leerRecientes);
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
        insertar.current(item.texto, !!item.bloque);
        setRecientes((l) => [
            { etiqueta: item.etiqueta, texto: item.texto, bloque: !!item.bloque },
            ...l.filter((x) => x.texto !== item.texto),
        ].slice(0, MAX_RECIENTES));
    }, []);

    const alternar = useCallback((id: string) => {
        setAbiertos((a) => ({ ...a, [id]: !(a[id] ?? false) }));
    }, []);

    const ctx = useMemo(() => construirPanelAmbito(ambito), [ambito]);

    const grupos = useMemo<GrupoPanel[]>(() => {
        const propios: GrupoPanel = {
            id: 'propios',
            titulo: 'Campos del caso (de este modelo)',
            abierto: true,
            ayuda: campos.some((c) => c.clave.trim()) ? undefined : 'Crea campos en la pestaña «Campos del caso» y aparecerán aquí.',
            items: campos
                .filter((c) => claveCampo(c.clave))
                .map((c) => ({ etiqueta: c.etiqueta || c.clave, texto: marcadorDeCampo({ ...c, clave: claveCampo(c.clave) }) })),
        };
        return [...(ctx ? [ctx] : []), propios, ...construirPanel(rol)];
    }, [rol, campos, ctx]);

    const tokens = claveNormalizada(q.trim()).split(/\s+/).filter(Boolean);
    const buscando = tokens.length > 0;
    const coincide = (i: ItemPanel) => {
        const h = claveNormalizada(`${i.etiqueta} ${i.texto}`);
        return tokens.every((t) => h.includes(t));
    };

    const todos: GrupoPanel[] = !buscando && recientes.length > 0
        ? [...(ctx ? [ctx] : []), { id: 'recientes', titulo: 'Usados recientemente', abierto: true, items: recientes },
        ...grupos.filter((g) => g !== ctx)]
        : grupos;

    const visibles = todos
        .map((g) => ({ ...g, items: buscando ? g.items.filter(coincide) : g.items }))
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
                <h3>Campos y bloques</h3>
                <input ref={buscador} type="search" placeholder="Buscar campo… (Enter inserta el primero)"
                    value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={teclasBuscador} />
                <label className="campo">
                    <span className="campo-etiq">Rol de las partes (singular)</span>
                    <input list="roles-panel" value={rol} onChange={(e) => setRol(e.target.value)} placeholder="demandante, vendedor…" />
                    <datalist id="roles-panel">
                        {ROLES_CONOCIDOS.map((r) => <option key={r} value={r} />)}
                    </datalist>
                </label>
                <div className="chips">
                    {ROLES_RAPIDOS.map((r) => (
                        <button key={r} type="button" className={`chip${claveNormalizada(rol) === r ? ' sel' : ''}`} onClick={() => setRol(r)}>{r}</button>
                    ))}
                </div>
                {ambito.length > 0 && (
                    <div className="pc-ctx">Cursor dentro de {ambito.map((a) => `#${a}`).join(' › ')}</div>
                )}
            </div>
            <div className="pc-cuerpo" ref={cuerpo} onKeyDown={teclasLista}>
                {visibles.length === 0 && <p className="pc-ayuda">Sin coincidencias.</p>}
                {visibles.map((g) => (
                    <Grupo key={g.id} g={g} abierto={abiertos[g.id] ?? !!g.abierto} forzar={buscando}
                        alternar={(id) => setAbiertos((a) => ({ ...a, [id]: !(a[id] ?? !!g.abierto) }))} onUsar={usar} />
                ))}
            </div>
        </div>
    );
}