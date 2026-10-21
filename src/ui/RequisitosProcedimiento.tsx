import { useMemo, useState, type FormEvent } from 'react';
import { nuevoId } from '../domain/id';
import {
    FORMATOS_REQUISITO, agruparRequisitos, etiquetaFormato, textoRequisitos,
    type FormatoRequisito, type Requisito,
} from '../domain/procedimientos';
import { claveNormalizada } from '../domain/texto';
import { Alerta, Campo, Icono, Insignia, Modal, avisar, copiarTexto } from './_core/comunes';
import './procedimientos.css';

export function RequisitosProcedimiento({ nombre, requisitos, quienes, usos, cambiar, quitar }: {
    nombre: string;
    requisitos: Requisito[];
    /** Sugerencias para «quién lo aporta». */
    quienes: string[];
    /** Cuántos pasos del flujograma usan cada requisito. */
    usos: ReadonlyMap<string, number>;
    cambiar: (lista: Requisito[]) => void;
    quitar: (id: string) => void;
}) {
    const [texto, setTexto] = useState('');
    const [grupo, setGrupo] = useState('');
    const [quien, setQuien] = useState('');
    const [oblig, setOblig] = useState(true);
    const [editando, setEditando] = useState<Requisito | null>(null);
    const [recibidos, setRecibidos] = useState<Set<string>>(() => new Set());

    const grupos = useMemo(() => agruparRequisitos(requisitos), [requisitos]);
    const nombresGrupo = grupos.map((g) => g.grupo).filter(Boolean);
    const obligatorios = requisitos.filter((r) => r.obligatorio).length;
    const faltan = requisitos.filter((r) => !recibidos.has(r.id)).length;

    function agregar(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const existentes = new Set(requisitos.map((r) => claveNormalizada(r.nombre)));
        const nuevos: Requisito[] = [];
        for (const n of texto.split(/[\n;]+/).map((x) => x.trim()).filter(Boolean)) {
            const k = claveNormalizada(n);
            if (existentes.has(k)) continue;
            existentes.add(k);
            nuevos.push({
                id: nuevoId(), grupo: grupo.trim(), nombre: n, detalle: '', quien: quien.trim(),
                formato: '', donde: '', obligatorio: oblig,
            });
        }
        if (nuevos.length === 0) {
            avisar('No hay requisitos nuevos que agregar', 'info');
            return;
        }
        cambiar([...requisitos, ...nuevos]);
        setTexto('');
        avisar(`${nuevos.length} requisito(s) agregado(s)`);
    }

    function mover(id: string, d: -1 | 1) {
        const i = requisitos.findIndex((r) => r.id === id);
        if (i < 0) return;
        const g = claveNormalizada(requisitos[i].grupo);
        let j = i + d;
        while (j >= 0 && j < requisitos.length && claveNormalizada(requisitos[j].grupo) !== g) j += d;
        if (j < 0 || j >= requisitos.length) return;
        const copia = [...requisitos];
        [copia[i], copia[j]] = [copia[j], copia[i]];
        cambiar(copia);
    }

    function alternar(id: string) {
        setRecibidos((p) => {
            const n = new Set(p);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    }

    async function copiar() {
        if (faltan === 0) {
            avisar('Ya marcaste todo como recibido', 'info');
            return;
        }
        const ok = await copiarTexto(textoRequisitos(nombre.trim() || 'Procedimiento', requisitos, recibidos));
        avisar(ok ? 'Lista copiada: pégala en WhatsApp o en un correo' : 'No se pudo copiar al portapapeles', ok ? 'ok' : 'error');
    }

    return (
        <>
            <div className="tarjeta">
                <div className="tarjeta-cab">
                    <div>
                        <h3>Agregar requisitos</h3>
                        <p className="suave">Escribe uno o varios (sepáralos con «;» o con un salto de línea). Después puedes completar el detalle de cada uno.</p>
                    </div>
                </div>
                <form className="form-grid" onSubmit={agregar}>
                    <Campo etiqueta="Requisito(s)" ancho>
                        <textarea
                            value={texto} onChange={(e) => setTexto(e.target.value)}
                            placeholder={'Certificado de nacimiento del beneficiario; C.I. del demandante; Contrato de alquiler'}
                        />
                    </Campo>
                    <Campo etiqueta="Grupo">
                        <input list="dl-grupo-req" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Del beneficiario, De las partes…" />
                    </Campo>
                    <Campo etiqueta="¿Quién lo aporta?">
                        <input list="dl-quien-req" value={quien} onChange={(e) => setQuien(e.target.value)} placeholder="Demandante, Abogado…" />
                    </Campo>
                    <div className="campo">
                        <span className="campo-etiq">&nbsp;</span>
                        <div className="acciones">
                            <label className="casilla">
                                <input type="checkbox" checked={oblig} onChange={(e) => setOblig(e.target.checked)} /> Obligatorio
                            </label>
                            <button type="submit" className="btn btn-pri" disabled={texto.trim() === ''}>
                                <Icono n="mas" tam={15} /> Agregar
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            <div className="req-resumen">
                <Insignia tono="azul">{requisitos.length} requisitos</Insignia>
                <Insignia tono="verde">{obligatorios} obligatorios</Insignia>
                <Insignia>{requisitos.length - obligatorios} opcionales</Insignia>
                <span className="espacio" />
                <span className="suave">{requisitos.length - faltan} de {requisitos.length} recibidos (solo en esta sesión)</span>
                <button type="button" className="btn btn-sec btn-sm" disabled={requisitos.length === 0} onClick={() => void copiar()}>
                    Copiar lo que falta
                </button>
            </div>

            {requisitos.length === 0 && (
                <Alerta tipo="info">Aún no hay requisitos. Agrega el primero arriba: por ejemplo, el certificado de nacimiento del beneficiario.</Alerta>
            )}

            {grupos.map((g) => (
                <section key={g.grupo || '_sin'} className="tarjeta">
                    <div className="tarjeta-cab">
                        <h3>{g.grupo || 'Sin grupo'}</h3>
                        <span className="suave">{g.items.length} requisito(s)</span>
                    </div>
                    <div>
                        {g.items.map((r) => {
                            const n = usos.get(r.id) ?? 0;
                            return (
                                <div key={r.id} className={`req-fila${recibidos.has(r.id) ? ' hecho' : ''}`}>
                                    <input
                                        type="checkbox" checked={recibidos.has(r.id)} onChange={() => alternar(r.id)}
                                        aria-label={`Recibido: ${r.nombre}`} title="Marcar como recibido"
                                    />
                                    <div className="req-cuerpo">
                                        <span className="req-nombre">{r.nombre}</span>
                                        <div className="req-meta">
                                            <Insignia tono={r.obligatorio ? 'azul' : 'gris'}>{r.obligatorio ? 'Obligatorio' : 'Opcional'}</Insignia>
                                            {r.formato && <Insignia tono="violeta">{etiquetaFormato(r.formato)}</Insignia>}
                                            {r.quien && <Insignia tono="ambar">Aporta: {r.quien}</Insignia>}
                                            {n > 0 && <Insignia tono="verde">Usado en {n} paso(s)</Insignia>}
                                        </div>
                                        {r.donde && <span className="suave">Dónde se obtiene: {r.donde}</span>}
                                        {r.detalle && <span className="suave">{r.detalle}</span>}
                                    </div>
                                    <div className="req-acciones">
                                        <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Subir" title="Subir" onClick={() => mover(r.id, -1)}>↑</button>
                                        <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Bajar" title="Bajar" onClick={() => mover(r.id, 1)}>↓</button>
                                        <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Editar" title="Editar" onClick={() => setEditando(r)}>
                                            <Icono n="editar" tam={15} />
                                        </button>
                                        <button type="button" className="btn btn-fan btn-icono btn-sm" aria-label="Quitar" title="Quitar" onClick={() => quitar(r.id)}>
                                            <Icono n="papelera" tam={15} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}

            <datalist id="dl-grupo-req">{nombresGrupo.map((x) => <option key={x} value={x} />)}</datalist>
            <datalist id="dl-quien-req">{quienes.map((x) => <option key={x} value={x} />)}</datalist>

            {editando && (
                <ModalRequisito
                    r={editando} grupos={nombresGrupo} quienes={quienes}
                    cerrar={() => setEditando(null)}
                    guardar={(nuevo) => {
                        cambiar(requisitos.map((x) => (x.id === nuevo.id ? nuevo : x)));
                        setEditando(null);
                    }}
                />
            )}
        </>
    );
}

function ModalRequisito({ r, grupos, quienes, guardar, cerrar }: {
    r: Requisito; grupos: string[]; quienes: string[]; guardar: (r: Requisito) => void; cerrar: () => void;
}) {
    const [nombre, setNombre] = useState(r.nombre);
    const [grupo, setGrupo] = useState(r.grupo);
    const [quien, setQuien] = useState(r.quien);
    const [formato, setFormato] = useState<FormatoRequisito>(r.formato);
    const [donde, setDonde] = useState(r.donde);
    const [detalle, setDetalle] = useState(r.detalle);
    const [oblig, setOblig] = useState(r.obligatorio);
    const [error, setError] = useState<string | null>(null);

    function enviar(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!nombre.trim()) {
            setError('El requisito necesita un nombre.');
            return;
        }
        guardar({
            ...r, nombre: nombre.trim(), grupo: grupo.trim(), quien: quien.trim(), formato,
            donde: donde.trim(), detalle: detalle.trim(), obligatorio: oblig,
        });
    }

    return (
        <Modal
            titulo="Editar requisito"
            cerrar={cerrar}
            pie={<><span className="espacio" /><button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button><button type="submit" form="form-req" className="btn btn-pri">Guardar</button></>}
        >
            {error && <Alerta tipo="error">{error}</Alerta>}
            <form id="form-req" className="form-grid" onSubmit={enviar}>
                <Campo etiqueta="Requisito *" ancho><input autoFocus value={nombre} onChange={(e) => { setNombre(e.target.value); setError(null); }} /></Campo>
                <Campo etiqueta="Grupo"><input list="dl-grupo-edit" value={grupo} onChange={(e) => setGrupo(e.target.value)} /></Campo>
                <Campo etiqueta="¿Quién lo aporta?"><input list="dl-quien-edit" value={quien} onChange={(e) => setQuien(e.target.value)} /></Campo>
                <Campo etiqueta="Formato">
                    <select value={formato} onChange={(e) => setFormato(e.target.value as FormatoRequisito)}>
                        {FORMATOS_REQUISITO.map((f) => <option key={f.valor} value={f.valor}>{f.etiqueta}</option>)}
                    </select>
                </Campo>
                <Campo etiqueta="Dónde se obtiene"><input value={donde} onChange={(e) => setDonde(e.target.value)} placeholder="Registro Cívico, empleador, notaría…" /></Campo>
                <Campo etiqueta="Detalle u observación" ancho><textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} /></Campo>
                <label className="casilla ancho">
                    <input type="checkbox" checked={oblig} onChange={(e) => setOblig(e.target.checked)} />
                    Obligatorio (si no, queda como opcional o «según el caso»)
                </label>
            </form>
            <datalist id="dl-grupo-edit">{grupos.map((x) => <option key={x} value={x} />)}</datalist>
            <datalist id="dl-quien-edit">{quienes.map((x) => <option key={x} value={x} />)}</datalist>
        </Modal>
    );
}