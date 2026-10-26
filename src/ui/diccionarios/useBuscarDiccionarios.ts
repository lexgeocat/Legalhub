import { useEffect, useState } from 'react';
import type { ResultadoBusquedaDiccionario } from '../../domain/diccionarios/diccionarios';
import { mensajeError, useServicios } from '../_core/servicios';

export const consultaValidaDiccionario = (q: string): boolean => {
  const k = q.trim();
  return k.length >= 2;
};

export function useBuscarDiccionarios(q: string, diccionarioId?: string, limite = 40) {
  const s = useServicios();
  const [res, setRes] = useState<ResultadoBusquedaDiccionario[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!consultaValidaDiccionario(q)) {
      setRes((r) => (r.length > 0 ? [] : r));
      setCargando(false);
      return;
    }

    let vivo = true;
    setCargando(true);
    const id = window.setTimeout(() => {
      s.diccionarios
        .buscar(q.trim(), diccionarioId || undefined, limite)
        .then((r) => {
          if (vivo) {
            setRes(r);
            setError(null);
            setCargando(false);
          }
        })
        .catch((e) => {
          if (vivo) {
            setError(mensajeError(e));
            setCargando(false);
          }
        });
    }, 200);

    return () => {
      vivo = false;
      window.clearTimeout(id);
    };
  }, [q, diccionarioId, limite, s]);

  return { res, cargando, error };
}
