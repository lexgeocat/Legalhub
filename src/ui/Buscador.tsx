import { useEffect, useState, type KeyboardEvent } from 'react';
import type { ResultadoBusqueda } from '../application/casosDeUso/buscar';
import { Aviso, Icono, Insignia, type Tono } from './comunes';
import { mensajeError, useServicios } from './servicios';

const ETIQUETA: Record<ResultadoBusqueda['tipo'], string> = {
    persona: 'Persona', expediente: 'Expediente', documento: 'Documento', inmueble: 'Inmueble',
};
const TONO: Record<ResultadoBusqueda['tipo'], Tono> = {
    persona: 'violeta', expediente: 'azul', documento: 'verde', inmueble: 'ambar',
};

export function Buscador({ cerrar, elegir }: { cerrar: () => void; elegir: (r: ResultadoBusqueda) => void }) {
    const s = useServicios();
    const [q, setQ] = useState('');
    const [res, setRes] = useState<ResultadoBusqueda[]>([]);
    const [sel, setSel] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let vivo = true;
        const id = setTimeout(() => {
            s.buscar.ejecutar(q)
                .then((r) => {
                    if (!vivo) return;
                    setRes(r);
                    setSel(0);
                    setError(null);
                })
                .catch((e) => vivo && setError(mensajeError(e)));
        }, 180);
        return () => {
            vivo = false;
            clearTimeout(id);
        };
    }, [q, s]);

    useEffect(() => {
        document.querySelector('.res.sel')?.scrollIntoView({ block: 'nearest' });
    }, [sel]);

    function teclas(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Escape') cerrar();
        else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSel((i) => Math.min(res.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSel((i) => Math.max(0, i - 1));
        } else if (e.key === 'Enter' && res[sel]) elegir(res[sel]);
    }

    return (
        <div className="buscador-fondo" onClick={cerrar}>
            <div className="buscador" onClick={(e) => e.stopPropagation()}>
                <div className="buscador-cab">
                    <Icono n="buscar" />
                    <input
                        autoFocus
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={teclas}
                        placeholder="Persona, C.I., expediente, matrícula o texto de un documento…"
                    />
                </div>
                <div className="buscador-res">
                    <Aviso error={error} />
                    {res.map((r, i) => (
                        <div key={`${r.tipo}:${r.id}`} className={`res${i === sel ? ' sel' : ''}`} onClick={() => elegir(r)} onMouseMove={() => setSel(i)}>
                            <Insignia tono={TONO[r.tipo]}>{ETIQUETA[r.tipo]}</Insignia>
                            <div className="res-texto">
                                <b>{r.titulo}</b>
                                {r.detalle && <span className="suave">{r.detalle}</span>}
                            </div>
                        </div>
                    ))}
                    {q.trim().length >= 2 && res.length === 0 && !error && <p className="suave" style={{ padding: 14 }}>Sin resultados.</p>}
                    {q.trim().length < 2 && <p className="suave" style={{ padding: 14 }}>Escribe al menos 2 letras. Encuentra personas, expedientes, documentos e inmuebles.</p>}
                </div>
                <div className="buscador-pie"><span>↑↓ moverse</span><span>Enter abrir</span><span>Esc cerrar</span></div>
            </div>
        </div>
    );
}