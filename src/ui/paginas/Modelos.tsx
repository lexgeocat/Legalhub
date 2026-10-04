import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { ModeloResumen } from '../../application/consultas';
import { CATEGORIAS_MODELO } from '../../domain/fuenteModelo';
import { PLANTILLAS_INICIALES } from '../../domain/plantillasIniciales';
import { claveNormalizada } from '../../domain/texto';
import {
    Alerta, Aviso, Campo, Icono, Insignia, Modal, SelectCategoria, SelectMateria, Vacio, avisar, etiquetaTipo,
} from '../comunes';
import { EditorModelo } from '../EditorModelo';
import { mensajeError, useCargar, useServicios } from '../servicios';
import { VisorModelo } from '../VisorModelo';

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

    return (
        <div className="pagina">
            <div className="pagina-cab">
                <div>
                    <h1>Modelos</h1>
                    <p className="subtitulo">Plantillas de documentos con campos que se completan desde el expediente.</p>
                </div>
                <div className="acciones">
                    <button type="button" className="btn btn-sec" onClick={() => setPlantillas(true)}>Plantillas iniciales</button>
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

            <Aviso error={lista.error} />

            {lista.datos && filtrados.length === 0 && (
                <Vacio
                    titulo={lista.datos.length === 0 ? 'Aún no tienes modelos' : 'Sin resultados'}
                    texto={lista.datos.length === 0 ? 'Crea uno desde cero, importa un .docx con marcadores o instala una plantilla inicial.' : 'Prueba con otra búsqueda o categoría.'}
                >
                    {lista.datos.length === 0 && (
                        <>
                            <button type="button" className="btn btn-pri" onClick={nuevo}>Nuevo modelo</button>
                            <button type="button" className="btn btn-sec" onClick={() => setPlantillas(true)}>Ver plantillas iniciales</button>
                        </>
                    )}
                </Vacio>
            )}

            <div className="modelos-grid">
                {filtrados.map((m: ModeloResumen) => (
                    <div key={m.id} className="modelo-card" role="button" tabIndex={0} onClick={() => ver(m.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') ver(m.id); }}>
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
                        </div>
                    </div>
                ))}
            </div>

            {importando && <ImportarWord cerrar={() => setImportando(false)} hecho={(id) => { setImportando(false); ver(id); }} />}
            {plantillas && <PlantillasIniciales cerrar={() => setPlantillas(false)} hecho={(id) => { setPlantillas(false); ver(id); }} />}
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

function PlantillasIniciales({ cerrar, hecho }: { cerrar: () => void; hecho: (modeloId: string) => void }) {
    const s = useServicios();
    const [ocupado, setOcupado] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function instalar(i: number) {
        setOcupado(i);
        try {
            const r = await s.instalarPlantilla.ejecutar(i);
            avisar('Plantilla instalada. Revísala y ajústala antes de usarla.');
            hecho(r.modeloId);
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setOcupado(null);
        }
    }

    return (
        <Modal titulo="Plantillas iniciales" cerrar={cerrar} pie={<><span className="espacio" /><button type="button" className="btn btn-sec" onClick={cerrar}>Cerrar</button></>}>
            <Alerta tipo="adv">Son borradores de ejemplo para empezar. Revisa su contenido jurídico antes de usarlos en un caso real.</Alerta>
            <Aviso error={error} />
            <div className="lista-opciones">
                {PLANTILLAS_INICIALES.map((p, i) => (
                    <div key={p.nombre} className="opcion">
                        <div style={{ flex: 1 }}>
                            <div className="fila-chica"><Insignia tono="azul">{p.categoria}</Insignia></div>
                            <b>{p.nombre}</b>
                            <span className="suave">{p.descripcion}</span>
                        </div>
                        <button type="button" className="btn btn-pri btn-sm" disabled={ocupado !== null} onClick={() => void instalar(i)}>
                            {ocupado === i ? 'Instalando…' : 'Instalar'}
                        </button>
                    </div>
                ))}
            </div>
        </Modal>
    );
}