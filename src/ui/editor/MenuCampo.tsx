import { useLayoutEffect, useEffect, useRef, useState, type CSSProperties } from 'react';
import { datoAsignable, reasignarDato } from '../../domain/camposParte';
import { mismoRol } from '../../domain/catalogo';
import { describirMarcador, matizDePersona, type ContextoMarcadores } from '../../domain/marcadores';
import { etiquetaRol } from '../../domain/texto';
import type { MenuCampoInfo } from './HojaEditable';

/** Menú de clic derecho sobre un campo del documento: asignar un dato de parte, editarlo o quitarlo. */
export function MenuCampo({ info, partes, contexto, cerrar }: {
    info: MenuCampoInfo;
    /** Roles (singular) creados en el modelo. */
    partes: string[];
    contexto: ContextoMarcadores;
    cerrar: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ left: info.x, top: info.y });

    useLayoutEffect(() => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        setPos({
            left: Math.max(8, Math.min(info.x, window.innerWidth - r.width - 8)),
            top: Math.max(8, Math.min(info.y, window.innerHeight - r.height - 8)),
        });
    }, [info]);

    useEffect(() => {
        const abierto = Date.now();
        const fuera = (e: Event) => {
            if (!ref.current?.contains(e.target as Node)) cerrar();
        };
        const tecla = (e: KeyboardEvent) => {
            if (e.key === 'Escape') cerrar();
        };
        // El navegador puede desplazar el texto al hacer clic derecho: se ignora justo al abrir.
        const desplazar = () => {
            if (Date.now() - abierto > 250) cerrar();
        };
        window.addEventListener('mousedown', fuera, true);
        window.addEventListener('keydown', tecla, true);
        window.addEventListener('blur', cerrar);
        window.addEventListener('resize', cerrar);
        window.addEventListener('scroll', desplazar, true);
        return () => {
            window.removeEventListener('mousedown', fuera, true);
            window.removeEventListener('keydown', tecla, true);
            window.removeEventListener('blur', cerrar);
            window.removeEventListener('resize', cerrar);
            window.removeEventListener('scroll', desplazar, true);
        };
    }, [cerrar]);

    const asignable = (m: string) => datoAsignable(m, partes, info.ambito);
    const actual = asignable(info.marcador);
    const asignado = (m: string) => {
        const d = asignable(m);
        return !!d && d.rol !== null;
    };
    const asignablesSel = info.seleccion.filter((m) => asignable(m) !== null).length;
    const lote = info.seleccion.length > 1 && asignablesSel > 0;
    const puede = lote || actual !== null;
    const hayAsignado = lote ? info.seleccion.some(asignado) : asignado(info.marcador);
    const desc = describirMarcador(info.marcador, contexto);

    function asignar(rol: string | null) {
        if (lote) {
            info.reemplazarSeleccion((m, amb) => reasignarDato(m, rol, amb, partes));
        } else {
            const nuevo = reasignarDato(info.marcador, rol, info.ambito, partes);
            if (nuevo) info.reemplazar(nuevo);
        }
        cerrar();
    }

    return (
        <div ref={ref} className="mk-menu" role="menu" style={pos}
            onMouseDown={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
            <div className="mk-menu-cab">
                <b>{lote ? `${info.seleccion.length} campos seleccionados` : desc.titulo}</b>
                {!lote && desc.detalle && <span>{desc.detalle}</span>}
                {!lote && desc.ejemplo && <span>Ej.: {desc.ejemplo}</span>}
            </div>

            {puede ? (
                <>
                    <div className="mk-menu-tit">
                        {lote ? `Asignar los ${asignablesSel} datos de parte a…` : 'Asignar a…'}
                    </div>
                    {partes.length === 0 ? (
                        <p className="mk-menu-nota">Aún no hay partes. Créalas en la pestaña «Partes» del panel.</p>
                    ) : (
                        partes.map((p) => (
                            <button key={p} type="button" role="menuitem" className="mk-menu-item" onClick={() => asignar(p)}>
                                <i className="cb-punto" style={{ '--h': matizDePersona(p, partes) } as CSSProperties} />
                                {etiquetaRol(p)}
                                {!lote && actual?.rol && mismoRol(actual.rol, p) && <span className="mk-menu-ok">actual</span>}
                            </button>
                        ))
                    )}
                    {hayAsignado && (
                        <button type="button" role="menuitem" className="mk-menu-item" onClick={() => asignar(null)}>
                            Dejar sin asignar
                        </button>
                    )}
                </>
            ) : (
                <p className="mk-menu-nota">
                    {desc.tipo === 'dato'
                        ? 'Es un dato del caso: no depende de ninguna parte, por eso mantiene su color.'
                        : 'Este campo no se asigna a una parte.'}
                </p>
            )}

            {!lote && (
                <>
                    <div className="mk-menu-sep" />
                    <button type="button" role="menuitem" className="mk-menu-item" onClick={() => { info.editar(); cerrar(); }}>
                        Editar campo…
                    </button>
                    <button type="button" role="menuitem" className="mk-menu-item peligro" onClick={() => { info.reemplazar(''); cerrar(); }}>
                        Quitar campo
                    </button>
                </>
            )}
        </div>
    );
}