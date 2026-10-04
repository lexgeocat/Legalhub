import { useState, type FormEvent } from 'react';
import type { ResultadoImportacion } from '../../application/casosDeUso/importarModelo';
import { BLOQUES_LISTOS, PANEL_CAMPOS } from '../../domain/catalogo';
import { Aviso, Campo } from '../comunes';
import { mensajeError, useCargar, useServicios } from '../servicios';

export function Modelos() {
    const s = useServicios();
    const lista = useCargar(() => s.consultas.listarModelos(), []);
    const [error, setError] = useState<string | null>(null);
    const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);

    async function importar(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = e.currentTarget;
        const datos = new FormData(form);
        const archivo = datos.get('archivo');
        const modeloId = String(datos.get('modeloId') ?? '');
        const existente = lista.datos?.find((m) => m.id === modeloId);
        try {
            if (!(archivo instanceof File) || archivo.size === 0) throw new Error('Elige un archivo .docx');
            const r = await s.importarModelo.ejecutar({
                modeloId: modeloId || undefined,
                nombre: existente?.nombre ?? String(datos.get('nombre') ?? ''),
                materia: String(datos.get('materia') ?? '') || undefined,
                docx: new Uint8Array(await archivo.arrayBuffer()),
            });
            setResultado(r);
            setError(null);
            form.reset();
            lista.recargar();
        } catch (err) {
            setResultado(null);
            setError(mensajeError(err));
        }
    }

    return (
        <>
            <h2>Modelos</h2>
            <Aviso error={error ?? lista.error} />
            <table>
                <thead><tr><th>Modelo</th><th>Materia</th><th>Versión</th><th>Campos</th><th /></tr></thead>
                <tbody>
                    {lista.datos?.map((m) => (
                        <tr key={m.id}>
                            <td>{m.nombre}</td><td>{m.materia}</td><td>v{m.version}</td>
                            <td>{(JSON.parse(m.schemaJson) as unknown[]).length}</td>
                            <td>
                                <button className="sec" onClick={() => s.importarModelo.copiaDeTrabajo(m.versionId).catch((e) => setError(mensajeError(e)))}>
                                    Abrir copia de trabajo
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <h3>Importar modelo o nueva versión</h3>
            <form className="panel" onSubmit={importar}>
                <Campo etiqueta="Nueva versión de…">
                    <select name="modeloId" defaultValue="">
                        <option value="">(modelo nuevo)</option>
                        {lista.datos?.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                </Campo>
                <Campo etiqueta="Nombre (si es nuevo)"><input name="nombre" /></Campo>
                <Campo etiqueta="Materia"><input name="materia" /></Campo>
                <Campo etiqueta="Archivo .docx"><input type="file" name="archivo" accept=".docx" /></Campo>
                <div className="ancho"><button type="submit">Escanear e importar</button></div>
            </form>

            {resultado && (
                <>
                    <p className="ok">Modelo importado como v{resultado.version}. {resultado.escaneo.info.join(' ')}</p>
                    {resultado.escaneo.advertencias.length > 0 && <div className="adv">{resultado.escaneo.advertencias.map((a) => <div key={a}>⚠ {a}</div>)}</div>}
                </>
            )}

            <h3>Panel de campos</h3>
            <p className="suave">Copia el marcador y pégalo en Word. Los bloques listos incluyen listas, bucles y condicionales.</p>
            <section className="panel">
                <div className="ancho"><strong>Bloques listos</strong></div>
                {BLOQUES_LISTOS.map((b) => (
                    <button key={b.nombre} className="sec" onClick={() => navigator.clipboard.writeText(b.texto)}>{b.nombre}</button>
                ))}
                {PANEL_CAMPOS.map((g) => (
                    <div key={g.grupo} className="ancho">
                        <strong>{g.grupo}</strong>
                        <div className="acciones">
                            {g.marcadores.map((m) => (
                                <button key={m} className="sec mono" onClick={() => navigator.clipboard.writeText(m)}>{m}</button>
                            ))}
                        </div>
                    </div>
                ))}
            </section>
        </>
    );
}