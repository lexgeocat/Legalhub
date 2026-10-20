import { useState, type FormEvent } from 'react';
import type { Ley } from '../../application/casosDeUso/leyes';
import { TIPOS_LEY, etiquetaNodo } from '../../domain/leyes';
import { Aviso, Campo, Icono, Insignia, Modal, Vacio, avisar, confirmar } from '../comunes';
import { mensajeError, useCargar, useServicios } from '../servicios';
import { useBuscarLeyes } from '../useBuscarLeyes';
import { VisorLey } from '../VisorLey';

export function Leyes() {
    const [vista, setVista] = useState<{ leyId: string; nodoId?: string } | null>(null);
    if (vista) {
        return (
            <VisorLey
                key={`${vista.leyId}:${vista.nodoId ?? ''}`}
                leyId={vista.leyId}
                nodoInicial={vista.nodoId}
                volver={() => setVista(null)}
            />
        );
    }
    return <ListaLeyes abrir={(leyId, nodoId) => setVista({ leyId, nodoId })} />;
}

function ListaLeyes({ abrir }: { abrir: (leyId: string, nodoId?: string) => void }) {
    const s = useServicios();
    const lista = useCargar(() => s.leyes.listar(), []);
    const [q, setQ] = useState('');
    const busqueda = useBuscarLeyes(q);
    const [importando, setImportando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const leyes = lista.datos ?? [];

    async function eliminar(l: Ley) {
        if (!(await confirmar(`¿Quitar «${l.nombre}» de la biblioteca? El PDF no se borra del disco.`, 'Quitar ley'))) return;
        try {
            await s.leyes.eliminar(l.id);
            setError(null);
            lista.recargar();
            avisar('Ley quitada');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    return (
        <div className="pagina">
            <div className="pagina-cab">
                <div>
                    <h1>Leyes</h1>
                    <p className="subtitulo">
                        Sube el PDF de un código o ley: se ordena por libros, títulos, capítulos, secciones y artículos para navegarlo con marcadores y citarlo en tus modelos.
                    </p>
                </div>
                <button type="button" className="btn btn-pri" onClick={() => setImportando(true)}>
                    <Icono n="mas" tam={16} /> Subir PDF
                </button>
            </div>

            <div className="filtros">
                <input className="buscar" type="search" placeholder="Buscar en todas las leyes: 1283 · prescripción…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            <Aviso error={error ?? lista.error ?? busqueda.error} />

            {q.trim() !== '' ? (
                <div className="lista-opciones">
                    {busqueda.res.map((r) => (
                        <button key={r.id} type="button" className="opcion" onClick={() => abrir(r.leyId, r.id)}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="fila-chica"><Insignia tono="azul">{r.leyNombre}</Insignia><span className="suave">Pág. {r.pagina}</span></div>
                                <b>{etiquetaNodo(r)}</b>
                                {r.extracto && <span className="suave">{r.extracto}</span>}
                            </div>
                        </button>
                    ))}
                    {busqueda.res.length === 0 && <p className="suave">Sin resultados.</p>}
                </div>
            ) : lista.datos && leyes.length === 0 ? (
                <Vacio icono="libro" titulo="Aún no hay leyes" texto="Sube un PDF (Código Civil, Código Penal, una ley…) y queda ordenado y buscable.">
                    <button type="button" className="btn btn-pri" onClick={() => setImportando(true)}>Subir PDF</button>
                </Vacio>
            ) : (
                <div className="modelos-grid">
                    {leyes.map((l) => (
                        <div key={l.id} className="modelo-card" role="button" tabIndex={0} onClick={() => abrir(l.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) abrir(l.id); }}>
                            <div className="mc-cab">
                                <Insignia tono="azul">{l.tipo || 'Ley'}</Insignia>
                            </div>
                            <h3>{l.nombre}</h3>
                            <p className="mc-desc">{l.norma || 'Sin norma indicada'}</p>
                            <div className="mc-pie">
                                <span>{l.numPaginas} págs.</span>
                                <span>{l.numArticulos} artículos</span>
                                <span className="espacio" />
                                <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar ley" title="Quitar ley"
                                    onClick={(e) => { e.stopPropagation(); void eliminar(l); }}>
                                    <Icono n="papelera" tam={15} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {importando && (
                <ImportarLey cerrar={() => setImportando(false)} hecho={(id) => { setImportando(false); abrir(id); }} />
            )}
        </div>
    );
}

function ImportarLey({ cerrar, hecho }: { cerrar: () => void; hecho: (leyId: string) => void }) {
    const s = useServicios();
    const [archivo, setArchivo] = useState<File | null>(null);
    const [nombre, setNombre] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);

    async function enviar(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!archivo) {
            setError('Elige un archivo .pdf');
            return;
        }
        const f = new FormData(e.currentTarget);
        const t = (k: string) => String(f.get(k) ?? '').trim() || undefined;
        setTrabajando(true);
        try {
            const r = await s.leyes.importar(new Uint8Array(await archivo.arrayBuffer()), { nombre, tipo: t('tipo'), norma: t('norma') });
            if (r.sinTexto) {
                avisar('El PDF no tiene texto (¿escaneado?). Se cargó sin estructura: agrega marcadores a mano.', 'info');
            } else {
                avisar(`${r.articulos} artículos y ${r.nodos - r.articulos} divisiones detectados. Revisa el árbol y corrige lo que haga falta.`);
            }
            hecho(r.leyId);
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    return (
        <Modal
            titulo="Subir ley en PDF"
            cerrar={cerrar}
            pie={<><span className="espacio" /><button type="button" className="btn btn-sec" disabled={trabajando} onClick={cerrar}>Cancelar</button><button type="submit" form="form-ley-nueva" className="btn btn-pri" disabled={trabajando}>{trabajando ? 'Analizando el PDF…' : 'Subir y analizar'}</button></>}
        >
            <Aviso error={error} />
            <form id="form-ley-nueva" className="form-grid" onSubmit={(e) => void enviar(e)}>
                <Campo etiqueta="Archivo .pdf *" ancho ayuda="Debe tener texto seleccionable (no una foto escaneada).">
                    <input type="file" accept=".pdf,application/pdf" required onChange={(e) => {
                        const a = e.target.files?.[0] ?? null;
                        setArchivo(a);
                        if (a && !nombre) setNombre(a.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim());
                    }} />
                </Campo>
                <Campo etiqueta="Nombre *" ancho ayuda="Así se cita: «artículo 12 del Código Civil».">
                    <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                </Campo>
                <Campo etiqueta="Tipo">
                    <select name="tipo" defaultValue="">
                        <option value="">—</option>
                        {TIPOS_LEY.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                </Campo>
                <Campo etiqueta="Norma"><input name="norma" placeholder="Ej.: Ley N° 439" />