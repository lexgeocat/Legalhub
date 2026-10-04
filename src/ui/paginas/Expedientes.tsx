import { useState, type FormEvent } from 'react';
import { Aviso, Campo, datosDeForm } from '../comunes';
import { mensajeError, useCargar, useServicios } from '../servicios';

export function Expedientes({ abrir }: { abrir: (id: string) => void }) {
    const s = useServicios();
    const lista = useCargar(() => s.consultas.listarExpedientes(), []);
    const personas = useCargar(() => s.consultas.listarPersonas(), []);
    const [error, setError] = useState<string | null>(null);

    async function crear(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = datosDeForm(e.currentTarget);
        try {
            const exp = await s.crearExpediente.ejecutar({
                materia: f.materia, referencia: f.referencia, juzgado: f.juzgado, nroCausa: f.nroCausa, clienteId: f.clienteId,
            });
            abrir(exp.id);
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    return (
        <>
            <h2>Expedientes</h2>
            <Aviso error={error ?? lista.error} />
            <table>
                <thead><tr><th>Código</th><th>Materia</th><th>Cliente</th><th>Estado</th><th>Juzgado</th></tr></thead>
                <tbody>
                    {lista.datos?.map((x) => (
                        <tr key={x.id} className="click" onClick={() => abrir(x.id)}>
                            <td>{x.codigo}</td><td>{x.materia}</td><td>{x.clienteNombre}</td><td>{x.estado}</td><td>{x.juzgado}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <h3>Nuevo expediente</h3>
            <form className="panel" onSubmit={crear}>
                <Campo etiqueta="Materia *"><input name="materia" required /></Campo>
                <Campo etiqueta="Cliente *">
                    <select name="clienteId" required defaultValue="">
                        <option value="" disabled>Elegir…</option>
                        {personas.datos?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </Campo>
                <Campo etiqueta="Referencia"><input name="referencia" /></Campo>
                <Campo etiqueta="Juzgado"><input name="juzgado" /></Campo>
                <Campo etiqueta="N° de causa"><input name="nroCausa" /></Campo>
                <div className="ancho"><button type="submit">Crear expediente</button></div>
            </form>
        </>
    );
}