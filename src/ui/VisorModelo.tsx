import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Alerta, Aviso, Campo, Icono, Insignia, Pestanas, SelectCategoria, SelectMateria, TablaEsquema, avisar, confirmar, etiquetaTipo, fechaHora } from './comunes';
import { Hoja } from './Hoja';
import { mensajeError, useCargar, useServicios } from './servicios';

type PestanaVisor = 'campos' | 'versiones' | 'datos';

export function VisorModelo({ modeloId, volver, editar, abrir }: {
    modeloId: string;
    volver: () => void;
    editar: (versionId: string) => void;
    abrir: (modeloId: string) => void;
}) {
    const s = useServicios();
    const modelo = useCargar(() => s.consultas.obtenerModelo(modeloId), [modeloId]);
    const versiones = useCargar(() => s.consultas.listarVersionesModelo(modeloId), [modeloId]);
    const [elegida, setElegida] = useState<string | null>(null);
    const activa = elegida ?? versiones.datos?.[0]?.id ?? null;
    const contenido = useCargar(() => (activa ? s.verModelo.ejecutar(activa) : Promise.resolve(null)), [activa]);
    const [pestana, setPestana] = useState<PestanaVisor>('campos');
    const [error, setError] = useState<string | null>(null);
    const [ocupado, setOcupado] = useState(false);
    const [advertencias, setAdvertencias] = useState<string[]>([]);

    const m = modelo.datos;
    const c = contenido.datos;
    const ultima = versiones.datos?.[0]?.id ?? null;
    const esUltima = !!activa && activa === ultima;

    const recargar = () => {
        modelo.recargar();
        versiones.recargar();
        setElegida(null);
    };

    async function correr(fn: () => Promise<void>) {
        setOcupado(true);
        try {
            await fn();
            setError(null);
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setOcupado(false);
        }
    }

    async function subir(e: ChangeEvent<HTMLInputElement>) {
        const archivo = e.target.files?.[0];
        e.target.value = '';
        if (!archivo || !m) return;
        await correr(async () => {
            const r = await s.importarModelo.ejecutar({ modeloId, nombre: m.nombre, docx: new Uint8Array(await archivo.arrayBuffer()) });
            setAdvertencias(r.escaneo.advertencias);
            avisar(`Versión ${r.version} importada`);
            recargar();
        });
    }

    async function convertir() {
        if (!activa) return;
        if (!(await confirmar('Se creará una versión editable con el texto del documento. Se simplifica el formato: se pierden encabezados, pies, imágenes y tablas. La versión de Word se conserva. ¿Continuar?'))) return;
        await correr(async () => {
            const r = await s.convertirModelo.ejecutar(activa);
            setAdvertencias(r.escaneo.advertencias);
            avisar(`Convertido: versión ${r.version} editable`);
            recargar();
        });
    }

    async function duplicar() {
        if (!activa) return;
        await correr(async () => {
            const r = await s.duplicarModelo.ejecutar(activa);
            avisar('Modelo duplicado');
            abrir(r.modeloId);
        });
    }

    async function alternar() {
        if (!m) return;
        await correr(async () => {
            await s.alternarModeloActivo.ejecutar(modeloId, !m.activo);
            avisar(m.activo ? 'Modelo archivado' : 'Modelo restaurado');
            recargar();
        });
    }

    async function eliminar() {
        if (!m) return;
        let usos = 0;
        try {
            usos = await s.eliminarModelo.usos(modeloId);
        } catch {
            /* si falla el conteo, igual se pide confirmación */
        }
        const uso = usos > 0 ? ` Se usó en ${usos} documento(s); esos documentos no se modifican.` : '';
        if (!(await confirmar(`¿Eliminar el modelo «${m.nombre}» con todas sus versiones?${uso}`, 'Eliminar modelo'))) return;
        await correr(async () => {
            await s.eliminarModelo.ejecutar(modeloId);
            avisar('Modelo eliminado');
            volver();
        });
    }

    async function copiaTrabajo() {
        if (!activa) return;
        await correr(async () => {
            await s.importarModelo.copiaDeTrabajo(activa);
            avisar('Copia abierta. Edítala en Word, guárdala y súbela como nueva versión.', 'info');
        });
    }

    async function guardarDatos(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const t = (k: string) => String(f.get(k) ?? '');
        await correr(async () => {
            await s.editarDatosModelo.ejecutar(modeloId, { nombre: t('nombre'), materia: t('materia'), categoria: t('categoria'), descripcion: t('descripcion') });
            avisar('Datos guardados');
            recargar();
        });
    }

    if (modelo.error) return <div className="pagina"><button type="button" className="btn btn-fan" onClick={volver}><Icono n="atras" /> Modelos</button><Aviso error={modelo.error} /></div>;
    if (!m) return <div className="pagina"><p className="suave">Cargando…</p></div>;

    return (
        <div className="pagina pagina-ancha">
            <div><button type="button" className="btn btn-fan" onClick={volver}><Icono n="atras" /> Modelos</button></div>

            <div className="pagina-cab">
                <div>
                    <div className="fila-chica">
                        {m.categoria && <Insignia tono="azul">{m.categoria}</Insignia>}
                        {m.materia && <Insignia tono="violeta">{etiquetaTipo(m.materia)}</Insignia>}
                        <Insignia tono={c?.editable ? 'verde' : 'gris'}>{c?.editable ? 'Editable' : 'Importado de Word'}</Insignia>
                        {!m.activo && <Insignia tono="ambar">Archivado</Insignia>}
                    </div>
                    <h1>{m.nombre}</h1>
                    {m.descripcion && <p className="subtitulo">{m.descripcion}</p>}
                </div>
                <div className="acciones">
                    {c?.editable && activa && (
                        <button type="button" className="btn btn-pri" onClick={() => editar(activa)}><Icono n="editar" tam={16} /> Editar</button>
                    )}
                    {c && !c.editable && (
                        <>
                            <button type="button" className="btn btn-pri" disabled={ocupado} onClick={() => void convertir()}>Convertir a editable</button>
                            <button type="button" className="btn btn-sec" disabled={ocupado} onClick={() => void copiaTrabajo()}>Abrir en Word</button>
                            <label className="btn btn-sec" style={{ cursor: 'pointer' }}>
                                Subir nueva versión…
                                <input type="file" accept=".docx" hidden onChange={(e) => void subir(e)} />
                            </label>
                        </>
                    )}
                    <button type="button" className="btn btn-sec" disabled={ocupado} onClick={() => void duplicar()}>Duplicar</button>
                    <button type="button" className="btn btn-sec" disabled={ocupado} onClick={() => void alternar()}>{m.activo ? 'Archivar' : 'Restaurar'}</button>
                    <button type="button" className="btn btn-peligro" disabled={ocupado} onClick={() => void eliminar()}>Eliminar</button>
                </div>
            </div>

            <Aviso error={error ?? contenido.error} />
            {!esUltima && activa && <Alerta tipo="info">Estás viendo una versión anterior. Al generar documentos se usa siempre la última versión.</Alerta>}
            {advertencias.length > 0 && (
                <Alerta tipo="adv">
                    <div className="lista-avisos">{advertencias.map((a) => <span key={a}>{a}</span>)}</div>
                </Alerta>
            )}
            {c && !c.editable && (
                <Alerta tipo="info">Vista simplificada: aquí no se muestran encabezados, pies, tablas ni imágenes, pero el documento generado sí los conserva. Para cambiar el modelo usa «Abrir en Word» y sube el archivo como nueva versión.</Alerta>
            )}

            <div className="visor-grid">
                <div className="vista-hoja" style={{ height: 'calc(100vh - 290px)', minHeight: 420 }}>
                    {c ? <Hoja bloques={c.bloques} config={c.config} /> : <p className="suave" style={{ padding: 16 }}>Cargando…</p>}
                </div>

                <div className="tarjeta">
                    <Pestanas<PestanaVisor>
                        activa={pestana}
                        cambiar={setPestana}
                        items={[
                            { id: 'campos', etiqueta: 'Campos', contador: c?.esquema.length },
                            { id: 'versiones', etiqueta: 'Versiones', contador: versiones.datos?.length },
                            { id: 'datos', etiqueta: 'Datos' },
                        ]}
                    />
                    {pestana === 'campos' && (c ? <TablaEsquema esquema={c.esquema} /> : <p className="suave">Cargando…</p>)}
                    {pestana === 'versiones' && (
                        <div className="tabla-wrap">
                            <table className="tabla tabla-densa">
                                <tbody>
                                    {versiones.datos?.map((v) => (
                                        <tr key={v.id}>
                                            <td><b>v{v.version}</b> {v.id === activa && <Insignia tono="azul">viendo</Insignia>}</td>
                                            <td>{v.editable ? 'Editable' : 'Word'}</td>
                                            <td className="suave">{fechaHora(v.creadoEn)}{v.notas ? ` · ${v.notas}` : ''}</td>
                                            <td><button type="button" className="btn btn-sec btn-sm" onClick={() => setElegida(v.id)}>Ver</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {pestana === 'datos' && (
                        <form key={`${m.nombre}|${m.categoria}|${m.materia}|${m.descripcion}`} className="form-grid" onSubmit={(e) => void guardarDatos(e)}>
                            <Campo etiqueta="Nombre" ancho><input name="nombre" defaultValue={m.nombre} required /></Campo>
                            <Campo etiqueta="Categoría" ancho><SelectCategoria name="categoria" defaultValue={m.categoria} /></Campo>
                            <Campo etiqueta="Materia" ancho><SelectMateria name="materia" defaultValue={m.materia} /></Campo>
                            <Campo etiqueta="Descripción" ancho><textarea name="descripcion" defaultValue={m.descripcion} /></Campo>
                            <div className="ancho"><button type="submit" className="btn btn-pri" disabled={ocupado}>Guardar datos</button></div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}