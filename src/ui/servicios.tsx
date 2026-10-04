import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { crearServicios, type Servicios } from '../infrastructure/composicion';

export const mensajeError = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const Ctx = createContext<Servicios | null>(null);

export function ServiciosProvider({ children }: { children: ReactNode }) {
    const [servicios, setServicios] = useState<Servicios | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        crearServicios().then(setServicios).catch((e) => setError(mensajeError(e)));
    }, []);

    if (error) return <p className="error">No se pudo iniciar Legal-Hub: {error}</p>;
    if (!servicios) return <p>Cargando…</p>;
    return <Ctx.Provider value={servicios}>{children}</Ctx.Provider>;
}

export function useServicios(): Servicios {
    const s = useContext(Ctx);
    if (!s) throw new Error('Servicios no inicializados');
    return s;
}

export function useCargar<T>(fn: () => Promise<T>, deps: unknown[]) {
    const [datos, setDatos] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [n, setN] = useState(0);
    useEffect(() => {
        let vivo = true;
        fn()
            .then((d) => vivo && (setDatos(d), setError(null)))
            .catch((e) => vivo && setError(mensajeError(e)));
        return () => {
            vivo = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, n]);
    return { datos, error, recargar: () => setN((x) => x + 1) };
}