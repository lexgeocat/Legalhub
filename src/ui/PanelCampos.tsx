import { useMemo, useState } from 'react';
import { construirPanel, type GrupoPanel, type ItemPanel } from '../domain/catalogo';
import { marcadorDeCampo, type CampoPropio } from '../domain/fuenteModelo';
import { claveCampo, claveNormalizada } from '../domain/texto';
import { ROLES_CONOCIDOS } from '../domain/tiposExpediente';
import { copiarConAviso, Icono } from './comunes';

const ROLES_RAPIDOS = ['demandante', 'demandado', 'vendedor', 'comprador', 'arrendador', 'arrendatario', 'poderdante', 'apoderado'];

function Fila({ item, onInsertar }: { item: ItemPanel; onInsertar: (texto: string, bloque: boolean) => void }) {
    return (
        <div className="pc-item">
            <button type="button" className="pc-insertar" title="Insertar en el cursor"
                onMouseDown={(e) => e.preventDefault()} onClick={() => onInsertar(item.texto, !!item.bloque)}>
                <span className="pc-etiq">{item.etiqueta}</span>
                <code className="pc-codigo">{item.texto}</code>
            </button>
            <button type="button" className="btn btn-fan btn-icono btn-sm" title="Copiar marcador"
                onMouseDown={(e) => e.preventDefault()} onClick={() => void copiarConAviso(item.texto)}>
                <Icono n="copiar" tam={15} />
            </button>
        </div>
    );
}

function Grupo({ g, forzar, onInsertar }: { g: GrupoPanel; forzar: boolean; onInsertar: (t: string, b: boolean) => void }) {
    const [abierto, setAbierto] = useState(!!g.abierto);
    const visible = forzar || abierto;
    return (
        <section className="pc-grupo">
            <button type="button" className="pc-grupo-tit" onClick={() => setAbierto(!abierto)}>
                <span>{g.titulo}</span>
                <span className="suave">{visible ? '−' : '+'}</span>
            </button>
            {visible && (
                <>
                    {g.ayuda && <p className="pc-ayuda">{g.ayuda}</p>}
                    {g.items.map((i) => <Fila key={i.texto} item={i} onInsertar={onInsertar} />)}
                </>
            )}
        </section>
    );
}

export function PanelCampos({ campos, onInsertar }: {
    campos: CampoPropio[];
    onInsertar: (texto: string, bloque: boolean) => void;
}) {
    const [rol, setRol] = useState('demandante');
    const [q, setQ] = useState('');

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
        return [propios, ...construirPanel(rol)];
    }, [rol, campos]);

    const k = claveNormalizada(q.trim());
    const visibles = grupos
        .map((g) => ({ ...g, items: k ? g.items.filter((i) => claveNormalizada(`${i.etiqueta} ${i.texto}`).includes(k)) : g.items }))
        .filter((g) => (k ? g.items.length > 0 : g.items.length > 0 || !!g.ayuda));

    return (
        <div className="pc">
            <div className="pc-cab">
                <h3>Campos y bloques</h3>
                <input type="search" placeholder="Buscar campo…" value={q} onChange={(e) => setQ(e.target.value)} />
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
            </div>
            <div className="pc-cuerpo">
                {visibles.length === 0 && <p className="pc-ayuda">Sin coincidencias.</p>}
                {visibles.map((g) => <Grupo key={`${g.id}:${rol}`} g={g} forzar={!!k} onInsertar={onInsertar} />)}
            </div>
        </div>
    );
}