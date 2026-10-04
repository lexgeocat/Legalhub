import { open } from '@tauri-apps/plugin-dialog';
import { useState, type FormEvent } from 'react';
import { AsistenteDocumento } from '../AsistenteDocumento';
import { Aviso, Campo, datosDeForm } from '../comunes';
import { mensajeError, useCargar, useServicios } from '../servicios';

export function Expediente({ id, volver }: { id: string; volver: () => void }) {
    const s = useServicios();
    const exp = useCargar(() => s.consultas.obtenerExpediente(id), [id]);
    const partes = useCargar(() => s.consultas.listarPartes(id), [id]);
    const docs = useCargar(() => s.consultas.listarDocumentos(id), [id]);
    const personas = useCargar(() => s.consultas.listarPersonas(), []);
    const [error, setError] = useState<string | null>(null);
    const [nuevo, setNuevo] = useState(false);

    async function agregarParte(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = e.currentTarget;
        const f = datosDeForm(form);
        try {
            await s.agregarParte.ejecutar({ expedienteId: id, personaId: f.personaId, rol: f.rol, domicilioProcesal: f.domicilioProcesal });
            form.reset();
            setError(null);
            partes.recargar();
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    async function adjuntar(documentoId: string) {
        try {
            const ruta = await open({ multiple: false, filters: [{ name: 'Word', extensions: ['docx'] }] });
            if (!ruta) return;
            await s.adjuntarVersion.ejecutar(documentoId, ruta);
            setError(null);
            docs.recargar();
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    const aviso = (p: Promise<void>) => p.catch((e) => setError(mensajeError(e)));

    return (
        <>
            <p><button className="sec" onClick={volver}>← Expedientes</button></p>
            <h2>{exp.datos ? `${exp.datos.codigo} · ${exp.datos.materia}` : 'Expediente'}</h2>
            {exp.datos && <p className="suave">Cliente: {exp.datos.clienteNombre} · Estado: {exp.datos.estado} · Juzgado: {exp.datos.juzgado || '—'}</p>}
            <Aviso error={error ?? exp.error ?? partes.error ?? docs.error} />

            <h3>Partes</h3>
            <table>
                <thead><tr><th>Rol</th><th>Persona</th><th>Domicilio procesal</th></tr></thead>
                <tbody>{partes.datos?.map((p) => <tr key={p.id}><td>{p.rol}</td><td>{p.nombre}</td><td>{p.domicilioProcesal}</td></tr>)}</tbody>
            </table>
            <form className="panel" onSubmit={agregarParte}>
                <Campo etiqueta="Persona *">
                    <select name="personaId" required defaultValue="">
                        <option value="" disabled>Elegir…</option>
                        {personas.datos?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </Campo>
                <Campo etiqueta="Rol *">
                    <input name="rol" list="roles" required placeholder="demandante" />
                    <datalist id="roles"><option value="demandante" /><option value="demandado" /><option value="tercero" /><option value="acusado" /><option value="denunciante" /></datalist>
                </Campo>
                <Campo etiqueta="Domicilio procesal"><input name="domicilioProcesal" /></Campo>
                <div className="ancho"><button type="submit">Agregar parte</button></div>
            </form>

            <h3>Documentos</h3>
            <div className="acciones"><button onClick={() => setNuevo(true)}>+ Nuevo documento</button></div>
            {nuevo && <AsistenteDocumento expedienteId={id} cerrar={() => { setNuevo(false); docs.recargar(); }} />}
            {docs.datos?.map((d) => (
                <section key={d.id} className="panel">
                    <div className="ancho acciones">
                        <strong>{d.titulo}</strong><span className="suave">{d.estado}</span>
                        <button className="sec" onClick={() => adjuntar(d.id)}>Adjuntar versión editada…</button>
                    </div>
                    <div className="ancho">
                        <table>
                            <tbody>
                                {d.versiones.map((v) => (
                                    <tr key={v.id}>
                                        <td>v{String(v.nro).padStart(2, '0')}</td><td>{v.origen}</td>
                                        <td>{new Date(v.creadoEn).toLocaleString()}</td>
                                        <td className="mono">{v.sha256.slice(0, 12)}…</td>
                                        <td className="acciones">
                                            <button className="sec" onClick={() => aviso(s.archivos.abrir(v.ruta))}>Abrir</button>
                                            <button className="sec" onClick={() => aviso(s.archivos.mostrarEnCarpeta(v.ruta))}>Mostrar en carpeta</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ))}
        </>
    );
}