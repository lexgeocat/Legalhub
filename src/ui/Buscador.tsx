import { useEffect, useState } from 'react';
import type { ResultadoBusqueda } from '../application/casosDeUso/buscar';
import { Aviso } from './comunes';
import { mensajeError, useServicios } from './servicios';

export function Buscador({ cerrar, elegir }: { cerrar: () => void; elegir: (r: ResultadoBusqueda) => void }) {
    const s = useServicios();
    const [q, setQ] = useState('');
    const [res, setRes] = useState<ResultadoBusqueda[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const id = setTimeout(() => {
            s.buscar.ejecutar(q).then((r) => (setRes(r), setError(null))).catch((e) => setError(mensajeError(e)));
        }, 200);
        return () => clearTimeout(id);
    }, [q, s]);

    return (
        <div className="modal" onClick={cerrar}>
            <div onClick={(e) => e.stopPropagation()}>
                <input
                    autoFocus
                    placeholder="Persona, C.I., expediente, matrícula o texto de un documento…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && cerrar()}
                />
                <Aviso error={error} />
                {res.map((r) => (
                    <div key={`${r.tipo}:${r.id}`} className="res" onClick={() => elegir(r)}>
                        <span className="etiq">{r.tipo}</span>
                        {r.titulo} <span className="suave">{r.detalle}</span>
                    </div>
                ))}
                {q.trim().length >= 2 && res.length === 0 && !error && <p className="suave">Sin resultados</p>}
            </div>
        </div>
    );
}