import { useMemo, useState, type FormEvent } from 'react';
import { esTextoLargo } from '../../application/camposModelo';
import type { PersonaResumen } from '../../application/consultas';
import { claveNormalizada } from '../../domain/texto';
import { GRUPOS_TIPO, TIPOS_EXPEDIENTE, TIPO_POR_DEFECTO, obtenerTipo } from '../../domain/tiposExpediente';
import {
    Alerta, Aviso, Campo, ESTADOS, ETIQUETA_ESTADO, EstadoInsignia, Icono, Insignia, Modal, Vacio, datosDeForm, etiquetaTipo, fechaCorta,
} from '../comunes';
import { mensajeError, useCargar, useServicios } from '../servicios';

export function Expedientes({ abrir, irPersonas }: { abrir: (id: string) => void; irPersonas: () => void }) {
    const s = useServicios();
    const lista = useCargar(() => s.consultas.listarExpedientes(), []);
    const personas = useCargar(() => s.consultas.listarPersonas(), []);
    const [q, setQ] = useState('');
    const [tipoF, setTipoF] = useState('');
    const [estadoF, setEstadoF] = useState('');
    const [nuevo, setNuevo] = useState(false);

    const filtrados = useMemo(() => {
        const k = claveNormalizada(q.trim());
        return (lista.datos ?? []).filter(
            (e) =>
                (!tipoF || e.tipo === tipoF) &&
                (!estadoF || e.estado === estadoF) &&
                (!k || claveNormalizada([e.codigo, e.materia, e.clienteNombre, e.juzgado, e.nroCausa, e.referencia].join(' ')).includes(k)),
        );
    }, [lista.datos, q, tipoF, estadoF]);

    const todos = lista.datos ?? [];
    const activos = todos.filter((e) => e.estado === 'abierto' || e.estado === 'en_tramite').length;
    const suspendidos = todos.filter((e) => e.estado === 'suspendido').length;
    const cerrados = todos.filter((e) => e.estado === 'cerrado' || e.estado === 'archivado').length;

    return (
        <div className="pagina">
            <div className="pagina-cab">
                <div>
                    <h1>Expedientes</h1>
                    <p className="subtitulo">Procesos judiciales, contratos, documentos privados, trámites y asesorías.</p>
                </div>
                <button type="button" className="btn btn-pri" onClick={() => setNuevo(true)}><Icono n="mas" tam={16} /> Nuevo expediente</button>
            </div>

            <div className="resumen-grid">
                <div className="estadistica"><span className="suave">Activos</span><b>{activos}</b></div>
                <div className="estadistica"><span className="suave">Suspendidos</span><b>{suspendidos}</b></div>
                <div className="estadistica"><span className="suave">Cerrados / archivados</span><b>{cerrados}</b></div>
                <div className="estadistica"><span className="suave">Total</span><b>{todos.length}</b></div>
            </div>

            <div className="filtros">
                <input className="buscar" type="search" placeholder="Buscar por código, asunto, cliente, juzgado…" value={q} onChange={(e) => setQ(e.target.value)} />
                <select value={tipoF} onChange={(e) => setTipoF(e.target.value)}>
                    <option value="">Todos los tipos</option>
                    {TIPOS_EXPEDIENTE.map((t) => <option key={t.clave} value={t.clave}>{t.etiqueta}</option>)}
                </select>
                <select value={estadoF} onChange={(e) => setEstadoF(e.target.value)}>
                    <option value="">Todos los estados</option>
                    {ESTADOS.map((x) => <option key={x} value={x}>{ETIQUETA_ESTADO[x]}</option>)}
                </select>
            </div>

            <Aviso error={lista.error} />

            {lista.datos && filtrados.length === 0 ? (
                <Vacio
                    icono="carpeta"
                    titulo={todos.length === 0 ? 'Aún no hay expedientes' : 'Sin resultados'}
                    texto={todos.length === 0 ? 'Crea el primero: elige el tipo (proceso, contrato, trámite…) y el cliente.' : 'Prueba con otros filtros.'}
                >
                    {todos.length === 0 && <button type="button" className="btn btn-pri" onClick={() => setNuevo(true)}>Nuevo expediente</button>}
                </Vacio>
            ) : (
                <div className="tabla-wrap">
                    <table className="tabla tabla-click">
                        <thead>
                            <tr><th>Código</th><th>Asunto</th><th>Cliente</th><th>Estado</th><th className="num">Partes</th><th className="num">Docs.</th><th>Creado</th></tr>
                        </thead>
                        <tbody>
                            {filtrados.map((x) => (
                                <tr key={x.id} tabIndex={0} onClick={() => abrir(x.id)} onKeyDown={(e) => { if (e.key === 'Enter') abrir(x.id); }}>
                                    <td><code>{x.codigo}</code></td>
                                    <td>
                                        <div className="celda-titulo">{x.materia}</div>
                                        <div className="suave">{etiquetaTipo(x.tipo)}{x.juzgado ? ` · ${x.juzgado}` : ''}</div>
                                    </td>
                                    <td>{x.clienteNombre || '—'}</td>
                                    <td><EstadoInsignia estado={x.estado} /></td>
                                    <td className="num">{x.nPartes}</td>
                                    <td className="num">{x.nDocumentos}</td>
                                    <td className="suave">{fechaCorta(x.creadoEn)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {nuevo && (
                <NuevoExpediente
                    personas={personas.datos ?? []}
                    cerrar={() => setNuevo(false)}
                    creado={(id) => { setNuevo(false); abrir(id); }}
                    irPersonas={() => { setNuevo(false); irPersonas(); }}
                />
            )}
        </div>
    );
}

function NuevoExpediente({ personas, cerrar, creado, irPersonas }: {
    personas: PersonaResumen[];
    cerrar: () => void;
    creado: (id: string) => void;
    irPersonas: () => void;
}) {
    const s = useServicios();
    const [tipo, setTipo] = useState(TIPO_POR_DEFECTO);
    const t = obtenerTipo(tipo);
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);

    async function enviar(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = datosDeForm(e.currentTarget);
        setTrabajando(true);
        try {
            const datos: Record<string, string> = {};
            for (const c of t.campos) {
                const v = f[`caso.${c.clave}`];
                if (v) datos[c.clave] = v;
            }
            const exp = await s.crearExpediente.ejecutar({
                tipo,
                materia: f.materia ?? '',
                clienteId: f.clienteId ?? '',
                referencia: f.referencia,
                juzgado: t.judicial ? f.juzgado : undefined,
                nroCausa: t.judicial ? f.nroCausa : undefined,
                datos,
            });
            creado(exp.id);
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    return (
        <Modal
            titulo="Nuevo expediente"
            ancho="grande"
            cerrar={cerrar}
            pie={<><span className="espacio" /><button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button><button type="submit" form="form-nuevo-exp" className="btn btn-pri" disabled={trabajando || personas.length === 0}>Crear expediente</button></>}
        >
            <Aviso error={error} />
            <div>
                {GRUPOS_TIPO.map((g) => (
                    <div key={g}>
                        <h4 className="grupo-titulo">{g}</h4>
                        <div className="tipos-grid">
                            {TIPOS_EXPEDIENTE.filter((x) => x.grupo === g).map((x) => (
                                <button key={x.clave} type="button" className={`tipo-opcion${x.clave === tipo ? ' sel' : ''}`} onClick={() => setTipo(x.clave)}>
                                    {x.etiqueta}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {personas.length === 0 && (
                <Alerta tipo="adv">
                    Primero registra al cliente. <button type="button" className="btn btn-enlace" onClick={irPersonas}>Ir a Personas</button>
                </Alerta>
            )}

            <form id="form-nuevo-exp" className="form-grid" onSubmit={(e) => void enviar(e)}>
                <Campo etiqueta="Asunto *" ancho><input name="materia" required placeholder="Ej.: Cumplimiento de contrato · Compraventa lote 12" /></Campo>
                <Campo etiqueta="Cliente *">
                    <select name="clienteId" required defaultValue="">
                        <option value="" disabled>Elegir…</option>
                        {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </Campo>
                <Campo etiqueta="Referencia"><input name="referencia" /></Campo>
                {t.judicial && (
                    <>
                        <Campo etiqueta="Juzgado / tribunal"><input name="juzgado" /></Campo>
                        <Campo etiqueta="N° de causa" ayuda="Lo asigna la autoridad; distinto del código interno."><input name="nroCausa" /></Campo>
                    </>
                )}
                <fieldset key={tipo} style={{ display: 'contents', border: 0, padding: 0 }}>
                    {t.campos.map((c) => (
                        <Campo key={c.clave} etiqueta={c.etiqueta} ancho={esTextoLargo(c.clave)}>
                            {esTextoLargo(c.clave) ? <textarea name={`caso.${c.clave}`} /> : <input name={`caso.${c.clave}`} />}
                        </Campo>
                    ))}
                </fieldset>
            </form>
            {t.campos.length > 0 && <p className="suave">Los datos del caso son opcionales: se usan como {'{{caso.…}}'} en los modelos y puedes completarlos después.</p>}
        </Modal>
    );
}

export { Insignia as _InsigniaReexport };