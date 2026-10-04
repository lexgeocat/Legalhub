import { useState, type FormEvent } from 'react';
import type { DocumentoPreparado } from '../application/casosDeUso/generarDocumento';
import type { ModeloResumen } from '../application/consultas';
import type { CampoEsquema } from '../application/puertos/motorPlantillas';
import { asignarRuta, leerRuta } from '../domain/rutas';
import { Aviso, Campo, datosDeForm } from './comunes';
import { mensajeError, useCargar, useServicios } from './servicios';

type Paso =
    | { n: 'elegir' }
    | { n: 'formulario'; modelo: ModeloResumen; titulo: string; faltantes: CampoEsquema[] }
    | { n: 'verificar'; preparado: DocumentoPreparado }
    | { n: 'listo'; ruta: string };

const vacio = (v: unknown) => v === undefined || v === null || v === '';
const largo = /hechos|petitorio|descripcion|observacion|fundamento/i;

function entrada(c: CampoEsquema) {
    if (c.tipo === 'fecha') return <input type="date" name={c.path} />;
    if (c.tipo === 'moneda' || c.tipo === 'superficie' || c.tipo === 'numero') return <input name={c.path} inputMode="decimal" placeholder="1234.56" />;
    if (largo.test(c.path)) return <textarea name={c.path} />;
    return <input name={c.path} />;
}

export function AsistenteDocumento({ expedienteId, cerrar }: { expedienteId: string; cerrar: () => void }) {
    const s = useServicios();
    const modelos = useCargar(() => s.consultas.listarModelos(), []);
    const [paso, setPaso] = useState<Paso>({ n: 'elegir' });
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);

    async function elegir(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = datosDeForm(e.currentTarget);
        const modelo = modelos.datos?.find((m) => m.versionId === f.versionId);
        if (!modelo) return;
        try {
            const esquema = JSON.parse(modelo.schemaJson) as CampoEsquema[];
            const base = await s.contexto.construir(expedienteId, {});
            const faltantes = esquema.filter((c) => c.ambito.length === 0 && c.path !== '.' && vacio(leerRuta(base, c.path)));
            setError(null);
            setPaso({ n: 'formulario', modelo, titulo: f.titulo || modelo.nombre, faltantes });
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    async function revisar(e: FormEvent<HTMLFormElement>, p: Extract<Paso, { n: 'formulario' }>) {
        e.preventDefault();
        const f = datosDeForm(e.currentTarget);
        const datos: Record<string, unknown> = {};
        for (const c of p.faltantes) if (f[c.path] !== undefined) asignarRuta(datos, c.path, f[c.path]);
        setTrabajando(true);
        try {
            const preparado = await s.generarDocumento.preparar(expedienteId, p.modelo.versionId, datos, p.titulo);
            setError(null);
            setPaso({ n: 'verificar', preparado });
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    async function generar(preparado: DocumentoPreparado) {
        setTrabajando(true);
        try {
            const v = await s.generarDocumento.guardar(preparado);
            setError(null);
            setPaso({ n: 'listo', ruta: v.ruta });
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    return (
        <section className="panel">
            <div className="ancho acciones"><strong>Nuevo documento</strong><button className="sec" onClick={cerrar}>Cerrar</button></div>
            <div className="ancho"><Aviso error={error ?? modelos.error} /></div>

            {paso.n === 'elegir' && (
                <form className="ancho panel" onSubmit={elegir}>
                    <Campo etiqueta="Modelo *">
                        <select name="versionId" required defaultValue="">
                            <option value="" disabled>Elegir…</option>
                            {modelos.datos?.map((m) => <option key={m.versionId} value={m.versionId}>{m.nombre} (v{m.version})</option>)}
                        </select>
                    </Campo>
                    <Campo etiqueta="Título del documento"><input name="titulo" placeholder="(por defecto, el nombre del modelo)" /></Campo>
                    <div className="ancho"><button type="submit">Continuar</button></div>
                </form>
            )}

            {paso.n === 'formulario' && (
                <form className="ancho panel" onSubmit={(e) => revisar(e, paso)}>
                    {paso.faltantes.length === 0 && <p className="ancho suave">No falta ningún dato general: se completará todo desde el expediente.</p>}
                    {paso.faltantes.map((c) => (
                        <Campo key={c.path} etiqueta={`${c.etiqueta} (${c.path})`}>{entrada(c)}</Campo>
                    ))}
                    {paso.faltantes.some((c) => ['moneda', 'superficie', 'numero'].includes(c.tipo)) && (
                        <p className="ancho suave">Números con punto decimal y sin separador de miles (10000.50).</p>
                    )}
                    <div className="ancho acciones">
                        <button type="button" className="sec" onClick={() => setPaso({ n: 'elegir' })}>Atrás</button>
                        <button type="submit" disabled={trabajando}>Revisar</button>
                    </div>
                </form>
            )}

            {paso.n === 'verificar' && (
                <div className="ancho">
                    <h3>Hoja de verificación</h3>
                    <table>
                        <thead><tr><th>Dato</th><th>Valor insertado</th></tr></thead>
                        <tbody>
                            {paso.preparado.verificacion.map((v, i) => (
                                <tr key={i}><td className="mono">{v.ruta}</td><td>{v.opcionalVacio ? '⚠ vacío (opcional en este modelo)' : v.valor}</td></tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="acciones" style={{ marginTop: 12 }}>
                        <button className="sec" onClick={() => setPaso({ n: 'elegir' })}>Volver</button>
                        <button disabled={trabajando} onClick={() => generar(paso.preparado)}>Generar documento</button>
                    </div>
                </div>
            )}

            {paso.n === 'listo' && (
                <div className="ancho">
                    <p className="ok">Documento generado: <span className="mono">{paso.ruta}</span></p>
                    <div className="acciones">
                        <button onClick={() => s.archivos.abrir(paso.ruta).catch((e) => setError(mensajeError(e)))}>Abrir</button>
                        <button className="sec" onClick={() => s.archivos.mostrarEnCarpeta(paso.ruta).catch((e) => setError(mensajeError(e)))}>Mostrar en carpeta</button>
                        <button className="sec" onClick={cerrar}>Terminar</button>
                    </div>
                </div>
            )}
        </section>
    );
}