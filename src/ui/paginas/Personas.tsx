import { useMemo, useState } from 'react';
import type { PersonaResumen } from '../../application/consultas';
import { escribirGeneralesDeLey } from '../../domain/generalesDeLey';
import { claveNormalizada } from '../../domain/texto';
import { Aviso, Icono, Insignia, Vacio, avisar, confirmar, copiarTexto, iniciales } from '../comunes';
import { FormularioPersona } from '../FormularioPersona';
import { mensajeError, useCargar, useServicios } from '../servicios';

export function Personas({ inicial }: { inicial?: string }) {
    const s = useServicios();
    const lista = useCargar(() => s.consultas.listarPersonas(), []);
    const [q, setQ] = useState('');
    const [tipoF, setTipoF] = useState('');
    const [editor, setEditor] = useState<{ id?: string } | null>(inicial ? { id: inicial } : null);
    const [error, setError] = useState<string | null>(null);

    const filtradas = useMemo(() => {
        const k = claveNormalizada(q.trim());
        return (lista.datos ?? []).filter(
            (p) =>
                (!tipoF || p.tipo === tipoF) &&
                (!k || claveNormalizada([p.nombre, p.ci, p.nit, p.telefono].join(' ')).includes(k)),
        );
    }, [lista.datos, q, tipoF]);

    const total = lista.datos?.length ?? 0;

    async function eliminar(p: PersonaResumen) {
        if (!(await confirmar(`¿Eliminar a ${p.nombre}? Esta acción no se puede deshacer desde la aplicación.`))) return;
        try {
            await s.eliminarPersona.ejecutar(p.id);
            setError(null);
            lista.recargar();
            avisar('Persona eliminada');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    /** Copia las generales de ley ya armadas, para pegarlas en Word. */
    async function copiarGenerales(p: PersonaResumen) {
        try {
            const d = await s.consultas.obtenerPersona(p.id);
            const texto = d ? escribirGeneralesDeLey(d) : '';
            if (!texto) {
                avisar('Faltan datos para armar las generales de ley', 'info');
                return;
            }
            const ok = await copiarTexto(texto);
            avisar(ok ? 'Generales de ley copiadas: pégalas en Word' : 'No se pudo copiar', ok ? 'ok' : 'error');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    return (
        <div className="pagina">
            <div className="pagina-cab">
                <div>
                    <h1>Personas</h1>
                    <p className="subtitulo">Clientes, partes, representantes y abogados. Puedes pegar sus generales de ley desde Word y copiarlas de vuelta.</p>
                </div>
                <button type="button" className="btn btn-pri" onClick={() => setEditor({})}>
                    <Icono n="mas" tam={16} /> Nueva persona
                </button>
            </div>

            <div className="filtros">
                <input className="buscar" type="search" placeholder="Buscar por nombre, C.I., NIT o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
                <select value={tipoF} onChange={(e) => setTipoF(e.target.value)}>
                    <option value="">Todos los tipos</option>
                    <option value="natural">Personas naturales</option>
                    <option value="juridica">Personas jurídicas</option>
                </select>
            </div>

            <Aviso error={error ?? lista.error} />

            {lista.datos && filtradas.length === 0 ? (
                <Vacio
                    icono="personas"
                    titulo={total === 0 ? 'Aún no hay personas' : 'Sin resultados'}
                    texto={total === 0 ? 'Registra a tus clientes y a las demás partes. Si ya tienes sus generales de ley en Word, pégalas y se rellena la ficha.' : 'Prueba con otra búsqueda o filtro.'}
                >
                    {total === 0 && <button type="button" className="btn btn-pri" onClick={() => setEditor({})}>Nueva persona</button>}
                </Vacio>
            ) : (
                <div className="tabla-wrap">
                    <table className="tabla tabla-click">
                        <thead><tr><th>Persona</th><th>Tipo</th><th>Documento</th><th>Teléfono</th><th /></tr></thead>
                        <tbody>
                            {filtradas.map((p) => (
                                <tr key={p.id} tabIndex={0} onClick={() => setEditor({ id: p.id })}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) setEditor({ id: p.id }); }}>
                                    <td>
                                        <div className="celda-persona">
                                            <span className="avatar">{iniciales(p.nombre)}</span>
                                            <span className="celda-titulo">{p.nombre || '—'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <Insignia tono={p.tipo === 'juridica' ? 'violeta' : 'azul'}>{p.tipo === 'juridica' ? 'Jurídica' : 'Natural'}</Insignia>
                                    </td>
                                    <td>
                                        {p.tipo === 'juridica'
                                            ? (p.nit ? `NIT ${p.nit}` : <span className="suave">—</span>)
                                            : (p.ci ? `C.I. ${p.ci}` : <span className="suave">—</span>)}
                                    </td>
                                    <td>{p.telefono || <span className="suave">—</span>}</td>
                                    <td className="num">
                                        <div className="acciones" style={{ justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Copiar generales de ley"
                                                title="Copiar generales de ley (para pegar en Word)"
                                                onClick={(e) => { e.stopPropagation(); void copiarGenerales(p); }}>
                                                <Icono n="copiar" tam={15} />
                                            </button>
                                            <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Editar persona"
                                                onClick={(e) => { e.stopPropagation(); setEditor({ id: p.id }); }}>
                                                <Icono n="editar" tam={15} />
                                            </button>
                                            <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Eliminar persona"
                                                onClick={(e) => { e.stopPropagation(); void eliminar(p); }}>
                                                <Icono n="papelera" tam={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {editor && (
                <FormularioPersona
                    id={editor.id}
                    personas={lista.datos ?? []}
                    cerrar={() => setEditor(null)}
                    guardado={() => {
                        const editado = !!editor.id;
                        setEditor(null);
                        lista.recargar();
                        avisar(editado ? 'Persona actualizada' : 'Persona creada');
                    }}
                />
            )}
        </div>
    );
}