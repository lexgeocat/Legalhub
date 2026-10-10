import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { ModeloResumen } from '../../application/consultas';
import { CATEGORIAS_MODELO } from '../../domain/fuenteModelo';
import { PLANTILLAS_INICIALES } from '../../domain/plantillasIniciales';
import { claveNormalizada } from '../../domain/texto';
import {
    Alerta, Aviso, Campo, Icono, Insignia, Modal, Pestanas, SelectCategoria, SelectMateria, Vacio,
    avisar, confirmar, etiquetaTipo, fechaCorta,
} from '../comunes';
import { EditorModelo } from '../EditorModelo';
import { mensajeError, useCargar, useServicios } from '../servicios';
import { VisorModelo } from '../VisorModelo';
import { open } from '@tauri-apps/plugin-dialog';
import type { ResultadoImportacion } from '../../application/casosDeUso/importarModelo';
import type { PlantillaGuardada } from '../../application/casosDeUso/plantillas';

type Vista =
    | { n: 'lista' }
    | { n: 'ver'; modeloId: string }
    | { n: 'editar'; modeloId?: string; versionId?: string };

export function Modelos() {
    const [vista, setVista] = useState<Vista>({ n: 'lista' });
    const ultimo = useRef<string | null>(null);

    if (vista.n === 'ver') {
        const id = vista.modeloId;
        return (
            <VisorModelo
                key={id}
                modeloId={id}
                volver={() => setVista({ n: 'lista' })}
                editar={(versionId) => setVista({ n: 'editar', modeloId: id, versionId })}
                abrir={(nuevo) => setVista({ n: 'ver', modeloId: nuevo })}
            />
        );
    }

    if (vista.n === 'editar') {
        const origen = vista.modeloId;
        return (
            <EditorModelo
                key={`${origen ?? 'nuevo'}:${vista.versionId ?? ''}`}
                modeloId={origen}
                versionId={vista.versionId}
                guardado={(r) => { ultimo.current = r.modeloId; }}
                volver={() => {
                    const id = ultimo.current ?? origen;
                    ultimo.current = null;
                    setVista(id ? { n: 'ver', modeloId: id } : { n: 'lista' });
                }}
            />
        );
    }

    return (
        <ListaModelos
            ver={(id) => setVista({ n: 'ver', modeloId: id })}
            nuevo={() => setVista({ n: 'editar' })}
        />
    );
}

function ListaModelos({ ver, nuevo }: { ver: (id: string) => void; nuevo: () => void }) {
    const s = useServicios();
    const [archivados, setArchivados] = useState(false);
    const lista = useCargar(() => s.consultas.listarModelos(archivados), [archivados]);
    const [q, setQ] = useState('');
    const [cat, setCat] = useState('');
    const [importando, setImportando] = useState(false);
    const [plantillas, setPlantillas] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const filtrados = useMemo(() => {
        const k = claveNormalizada(q.trim());
        return (lista.datos ?? []).filter(
            (m) => (!cat || m.categoria === cat) && (!k || claveNormalizada(`${m.nombre} ${m.descripcion} ${m.categoria} ${etiquetaTipo(m.materia)}`).includes(k)),
        );
    }, [lista.datos, q, cat]);

    const categorias = useMemo(
        () => [...new Set([...CATEGORIAS_MODELO, ...(lista.datos ?? []).map((m) => m.categoria).filter(Boolean)])],
        [lista.datos],
    );

    async function eliminar(m: ModeloResumen) {
        try {
            const usos = await s.eliminarModelo.usos(m.id);
            const uso = usos > 0 ? ` Se usó en ${usos} documento(s); esos documentos no se modifican.` : '';
            if (!(await confirmar(`¿Eliminar el modelo «${m.nombre}» con todas sus versiones?${uso}`, 'Eliminar modelo'))) return;
            await s.eliminarModelo.ejecutar(m.id);
            setError(null);
            lista.recargar();
            avisar('Modelo eliminado');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    return (
        <div className="pagina">
            <div className="pagina-cab">
                <div>
                    <h1>Modelos</h1>
                    <p className="subtitulo">Plantillas de documentos con campos que se completan desde el expediente.</p>
                </div>
                <div className="acciones">
                    <button type="button" className="btn btn-sec" onClick={() => setPlantillas(true)}>Plantillas</button>
                    <button type="button" className="btn btn-sec" onClick={() => setImportando(true)}>Importar Word</button>
                    <button type="button" className="btn btn-pri" onClick={nuevo}><Icono n="mas" tam={16} /> Nuevo modelo</button>
                </div>
            </div>

            <div className="filtros">
                <input className="buscar" type="search" placeholder="Buscar modelo…" value={q} onChange={(e) => setQ(e.target.value)} />
                <select value={cat} onChange={(e) => setCat(e.target.value)}>
                    <option value="">Todas las categorías</option>
                    {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="casilla">
                    <input type="checkbox" checked={archivados} onChange={(e) => setArchivados(e.target.checked)} />
                    Mostrar archivados
                </label>
            </div>

            <Aviso error={error ?? lista.error} />

            {lista.datos && filtrados.length === 0 && (
                <Vacio
                    titulo={lista.datos.length === 0 ? 'Aún no tienes modelos' : 'Sin resultados'}
                    texto={lista.datos.length === 0 ? 'Crea uno desde cero, importa un .docx con marcadores o instala una plantilla inicial.' : 'Prueba con otra búsqueda o categoría.'}
                >
                    {lista.datos.length === 0 && (
                        <>
                            <button type="button" className="btn btn-pri" onClick={nuevo}>Nuevo modelo</button>
                            <button type="button" className="btn btn-sec" onClick={() => setPlantillas(true)}>Ver plantillas</button>
                        </>
                    )}
                </Vacio>
            )}

            <div className="modelos-grid">
                {filtrados.map((m: ModeloResumen) => (
                    <div key={m.id} className="modelo-card" role="button" tabIndex={0} onClick={() => ver(m.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) ver(m.id); }}>
                        <div className="mc-cab">
                            <Insignia tono="azul">{m.categoria || 'Sin categoría'}</Insignia>
                            {m.materia && <Insignia tono="violeta">{etiquetaTipo(m.materia)}</Insignia>}
                            {!m.activo && <Insignia tono="ambar">Archivado</Insignia>}
                        </div>
                        <h3>{m.nombre}</h3>
                        <p className="mc-desc">{m.descripcion || 'Sin descripción'}</p>
                        <div className="mc-pie">
                            <span>v{m.version}</span>
                            <span>{m.editable ? 'Editable' : 'Word'}</span>
                            <span>{m.numCampos} campos</span>
                            <span className="espacio" />
                            <button
                                type="button"
                                className="btn btn-fan btn-icono btn-sm"
                                aria-label="Eliminar modelo"
                                title="Eliminar modelo"
                                onClick={(e) => { e.stopPropagation(); void eliminar(m); }}
                            >
                                <Icono n="papelera" tam={15} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {importando && <ImportarWord cerrar={() => setImportando(false)} hecho={(id) => { setImportando(false); ver(id); }} />}
            {plantillas && <Plantillas cerrar={() => setPlantillas(false)} hecho={(id) => { setPlantillas(false); ver(id); }} />}
        </div>
    );
}

function ImportarWord({ cerrar, hecho }: { cerrar: () => void; hecho: (modeloId: string) => void }) {
    const s = useServicios();
    const [nombre, setNombre] = useState('');
    const [archivo, setArchivo] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);

    async function enviar(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const t = (k: string) => String(f.get(k) ?? '') || undefined;
        if (!archivo) {
            setError('Elige un archivo .docx');
            return;
        }
        setTrabajando(true);
        try {
            const r = await s.importarModelo.ejecutar({
                nombre, materia: t('materia'), categoria: t('categoria'), descripcion: t('descripcion'),
                docx: new Uint8Array(await archivo.arrayBuffer()),
            });
            const n = r.escaneo.advertencias.length;
            avisar(n > 0 ? `Modelo importado con ${n} advertencia(s)` : 'Modelo importado');
            hecho(r.modeloId);
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    return (
        <Modal
            titulo="Importar modelo de Word"
            cerrar={cerrar}
            pie={<><span className="espacio" /><button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button><button type="submit" form="form-importar" className="btn btn-pri" disabled={trabajando}>Escanear e importar</button></>}
        >
            <Alerta tipo="info">El archivo debe ser un .docx con marcadores como {'{{expediente.juzgado}}'} escritos en Word. Se revisa antes de guardarlo.</Alerta>
            <Aviso error={error} />
            <form id="form-importar" className="form-grid" onSubmit={(e) => void enviar(e)}>
                <Campo etiqueta="Archivo .docx *" ancho>
                    <input type="file" accept=".docx" required onChange={(e) => {
                        const a = e.target.files?.[0] ?? null;
                        setArchivo(a);
                        if (a && !nombre) setNombre(a.name.replace(/\.docx$/i, ''));
                    }} />
                </Campo>
                <Campo etiqueta="Nombre del modelo *" ancho><input value={nombre} onChange={(e) => setNombre(e.target.value)} required /></Campo>
                <Campo etiqueta="Categoría"><SelectCategoria name="categoria" defaultValue="" /></Campo>
                <Campo etiqueta="Materia"><SelectMateria name="materia" defaultValue="" /></Campo>
                <Campo etiqueta="Descripción" ancho><textarea name="descripcion" /></Campo>
            </form>
        </Modal>
    );
}

type PestanaPlantillas = 'incluidas' | 'mias';

function Plantillas({ cerrar, hecho }: { cerrar: () => void; hecho: (modeloId: string) => void }) {
    const s = useServicios();
    const [pestana, setPestana] = useState<PestanaPlantillas>('incluidas');
    const mias = useCargar(() => s.plantillas.listar(), []);
    const [ocupado, setOcupado] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function instalar(clave: string, correr: () => Promise<ResultadoImportacion>) {
        setOcupado(clave);
        try {
            const r = await correr();
            avisar('Plantilla instalada. Revísala y ajústala antes de usarla.');
            hecho(r.modeloId);
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setOcupado(null);
        }
    }

    async function importarArchivo() {
        try {
            const ruta = await open({ multiple: false, filters: [{ name: 'Modelo de Legal-Hub', extensions: ['lhmodel'] }] });
            if (!ruta) return;
            setOcupado('archivo');
            await s.plantillas.agregarDeArchivo(ruta);
            setError(null);
            mias.recargar();
            setPestana('mias');
            avisar('Plantilla agregada a «Mis plantillas»');
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setOcupado(null);
        }
    }

    async function quitar(p: PlantillaGuardada) {
        if (!(await confirmar(`¿Quitar la plantilla «${p.nombre}» de tu lista? Los modelos ya instalados no cambian.`, 'Quitar plantilla'))) return;
        try {
            await s.plantillas.eliminar(p.id);
            setError(null);
            mias.recargar();
            avisar('Plantilla quitada');
        } catch (e) {
            setError(mensajeError(e));
        }
    }

    return (
        <Modal
            titulo="Plantillas"
            cerrar={cerrar}
            pie={
                <>
                    <button type="button" className="btn btn-sec" disabled={ocupado !== null} onClick={() => void importarArchivo()}>
                        {ocupado === 'archivo' ? 'Importando…' : 'Importar archivo .lhmodel…'}
                    </button>
                    <span className="espacio" />
                    <button type="button" className="btn btn-pri" onClick={cerrar}>Cerrar</button>
                </>
            }
        >
            <Pestanas<PestanaPlantillas>
                activa={pestana}
                cambiar={setPestana}
                items={[
                    { id: 'incluidas', etiqueta: 'Incluidas', contador: PLANTILLAS_INICIALES.length },
                    { id: 'mias', etiqueta: 'Mis plantillas', contador: mias.datos?.length },
                ]}
            />
            <Aviso error={error ?? mias.error} />

            {pestana === 'incluidas' && (
                <>
                    <Alerta tipo="adv">Son borradores de ejemplo para empezar. Revisa su contenido jurídico antes de usarlos en un caso real.</Alerta>
                    <div className="lista-opciones">
                        {PLANTILLAS_INICIALES.map((p, i) => (
                            <div key={p.nombre} className="opcion">
                                <div style={{ flex: 1 }}>
                                    <div className="fila-chica"><Insignia tono="azul">{p.categoria}</Insignia></div>
                                    <b>{p.nombre}</b>
                                    <span className="suave">{p.descripcion}</span>
                                </div>
                                <button type="button" className="btn btn-pri btn-sm" disabled={ocupado !== null}
                                    onClick={() => void instalar(`i${i}`, () => s.instalarPlantilla.ejecutar(i))}>
                                    {ocupado === `i${i}` ? 'Instalando…' : 'Instalar'}
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {pestana === 'mias' && (
                mias.datos && mias.datos.length === 0 ? (
                    <Vacio
                        titulo="Aún no tienes plantillas propias"
                        texto="Abre un modelo terminado y usa «Guardar como plantilla», o importa un archivo .lhmodel que te hayan pasado."
                    />
                ) : (
                    <div className="lista-opciones">
                        {(mias.datos ?? []).map((p) => (
                            <div key={p.id} className="opcion">
                                <div style={{ flex: 1 }}>
                                    <div className="fila-chica">
                                        {p.categoria && <Insignia tono="azul">{p.categoria}</Insignia>}
                                        {p.materia && <Insignia tono="violeta">{etiquetaTipo(p.materia)}</Insignia>}
                                        <Insignia tono={p.editable ? 'verde' : 'gris'}>{p.editable ? 'Editable' : 'Word'}</Insignia>
                                    </div>
                                    <b>{p.nombre}</b>
                                    <span className="suave">
                                        {p.descripcion || `${p.numCampos} campos`} · guardada {fechaCorta(p.creadaEn)}
                                    </span>
                                </div>
                                <button type="button" className="btn btn-pri btn-sm" disabled={ocupado !== null}
                                    onClick={() => void instalar(`p${p.id}`, () => s.plantillas.instalar(p.id))}>
                                    {ocupado === `p${p.id}` ? 'Instalando…' : 'Instalar'}
                                </button>
                                <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar plantilla" title="Quitar de mis plantillas"
                                    disabled={ocupado !== null} onClick={() => void quitar(p)}>
                                    <Icono n="papelera" tam={15} />
                                </button>
                            </div>
                        ))}
                    </div>
                )
            )}
        </Modal>
    );
}