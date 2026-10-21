import { useEffect, useState } from 'react';
import type { ResultadoBusquedaLey } from '../../application/casosDeUso/leyes';
import { mensajeError, useServicios } from '../_core/servicios';

/** ≥ 2 letras, o un número suelto («45» = artículo 45). */
export const consultaValida = (q: string): boolean => {
    const k = q.trim();
    return k.length >= 2 || /^\d+$/.test(k);
};

export function useBuscarLeyes(q: string, leyId?: string) {
    const s = useServicios();
    const [res, setRes] = useState<ResultadoBusquedaLey[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!consultaValida(q)) {
            setRes((r) => (r.length > 0 ? [] : r));
            return;
        }
        let vivo = true;
        const id = window.setTimeout(() => {
            s.leyes.buscar(q.trim(), leyId)
                .then((r) => { if (vivo) { setRes(r); setError(null); } })
                .catch((e) => { if (vivo) setError(mensajeError(e)); });
        }, 250);
        return () => {
            vivo = false;
            window.clearTimeout(id);
        };
    }, [q, leyId, s]);

    return { res, error };
}