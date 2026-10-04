// src/ui/AsistenteDocumento.tsx
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { camposParaFormulario, esCampoCaso, esTextoLargo } from '../application/camposModelo';
import type { DocumentoPreparado } from '../application/casosDeUso/generarDocumento';
import type { ExpedienteResumen, ModeloResumen } from '../application/consultas';
import type { CampoEsquema } from '../application/puertos/motorPlantillas';
import { asignarRuta, leerRuta } from '../domain/rutas';
import { claveCampo, claveNormalizada } from '../domain/texto';
import { Alerta, Aviso, Campo, Insignia, Modal, avisar, datosDeForm, normalizarNumero } from './comunes';
import { mensajeError, useCargar, useServicios } from './servicios';

interface Borrador {
    modelo: ModeloResumen;
    titulo: string;
    faltantes: CampoEsquema[];
    avisos: string[];
    valores: Record<string, string>;
}

type Paso =
    | { n: 'elegir' }
    | { n: 'formulario'; b: Borrador }
    | { n: 'verificar'; b: Borrador; preparado: DocumentoPreparado; caso: Record<string, string> }
    | { n: 'listo'; ruta: string; numero: number };

const ETAPAS = ['Modelo', 'Datos', 'Verificar', 'Listo'];
const INDICE: Record<Paso['n'], number> = { elegir: 0, formulario: 1, verificar: 2, listo: 3 };
const NUMERICOS = new Set(['moneda', 'superficie', 'numero']);

const sinValor = (v: unknown) => v === undefined || v === null || v === '';
const ultimo = (ruta: string) => ruta.split('.').pop() ?? ruta;
const rutaNormal = (ruta: string) => ruta.split('.').map(claveNormalizada).join('.');
const pad = (n: number) => String(n).padStart(2, '0');

function leerEsquema(json: string): CampoEsquema[] {
    try {
        const o: unknown = JSON.parse(json);
        return Array.isArray(o) ? (o as CampoEsquema[]) : [];
    } catch {
        throw new Error('El esquema del modelo está dañado; vuelve a importarlo.');
    }
}

function Entrada({ c, valor }: { c: CampoEsquema; valor: string }) {
    if (c.tipo === 'fecha') return <input type="date" name={c.path} defaultValue={valor} required={c.requerido} />;
    if (NUMERICOS.has(c.tipo)) {
        return <input name={c.path} defaultValue={valor} required={c.requerido} inputMode="decimal" placeholder="1234,56" />;
    }
    if (esTextoLargo(ultimo(c.path))) return <textarea name={c.path} defaultValue={valor} required={c.requerido} />;
    return <input name={c.path} defaultValue={valor} required={c.requerido} />;
}

export function AsistenteDocumento({ expediente, cerrar }: { expediente: ExpedienteResumen; cerrar: () => void }) {
    const s = useServicios();
    const modelos = useCargar(() => s.consultas.listarModelos(), []);
    const docs = useCargar(() => s.consultas.listarDocumentos(expediente.id), [expediente.id]);
    const [paso, setPaso] = useState<Paso>({ n: 'elegir' });
    const [error, setError] = useState<string | null>(null);
    const [trabajando, setTrabajando] = useState(false);
    const [sel, setSel] = useState('');
    const [titulo, setTitulo] = useState('');
    const [q, setQ] = useState('');
    const [guardarCaso, setGuardarCaso] = useState(true);

    const ordenados = useMemo(() => {
        const k = claveNormalizada(q.trim());
        const mismo = (m: ModeloResumen) => Number(m.materia === expediente.tipo);
        return (modelos.datos ?? [])
            .filter((m) => !k || claveNormalizada(`${m.nombre} ${m.descripcion} ${m.categoria}`).includes(k))
            .sort((a, b) => mismo(b) - mismo(a) || a.nombre.localeCompare(b.nombre, 'es'));
    }, [modelos.datos, q, expediente.tipo]);

    const modeloSel = modelos.datos?.find((m) => m.versionId === sel);
    const tituloFinal = titulo.trim() || modeloSel?.nombre || '';
    const existente = docs.datos?.find((d) => d.titulo === tituloFinal);
    const proxima = existente ? Math.max(0, ...existente.versiones.map((v) => v.nro)) + 1 : 1;

    async function continuar() {
        if (!modeloSel) return;
        setTrabajando(true);
        try {
            const esquema = leerEsquema(modeloSel.schemaJson);
            const base = await s.contexto.construir(expediente.id, {});
            const faltantes: CampoEsquema[] = [];
            const avisos: string[] = [];
            for (const c of camposParaFormulario(esquema)) {
                const actual = leerRuta(base, c.path);
                if (Array.isArray(actual)) {
                    if (actual.length === 0) {
                        avisos.push(`«${c.path}» no tiene partes en este expediente: agrégalas en la pestaña Partes o la generación se detendrá.`);
                    }
                    continue;
                }
                if (!sinValor(actual)) continue;
                if (c.tipo === 'lista' || c.tipo === 'ci') {
                    avisos.push(`«${c.path}» no se puede completar a mano aquí: revisa los datos del expediente.`);
                    continue;
                }
                faltantes.push(c);
            }
            setError(null);
            setPaso({ n: 'formulario', b: { modelo: modeloSel, titulo: tituloFinal, faltantes, avisos, valores: {} } });
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    async function revisar(ev: FormEvent<HTMLFormElement>, b: Borrador) {
        ev.preventDefault();
        const f = datosDeForm(ev.currentTarget);
        const datos: Record<string, unknown> = {};
        const caso: Record<string, string> = {};
        for (const c of b.faltantes) {
            const crudo = f[c.path];
            if (crudo === undefined) continue;
            const valor = NUMERICOS.has(c.tipo) ? normalizarNumero(crudo) : crudo;
            asignarRuta(datos, rutaNormal(c.path), valor);
            const segs = c.path.split('.');
            if (esCampoCaso(c.path) && segs.length === 2) caso[claveCampo(segs[1])] = valor;
        }
        setTrabajando(true);
        try {
            const preparado = await s.generarDocumento.preparar(expediente.id, b.modelo.versionId, datos, b.titulo);
            setError(null);
            setPaso({ n: 'verificar', b: { ...b, valores: f }, preparado, caso });
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    async function generar(p: Extract<Paso, { n: 'verificar' }>) {
        setTrabajando(true);
        try {
            const v = await s.generarDocumento.guardar(p.preparado);
            if (guardarCaso && Object.keys(p.caso).length > 0) {
                try {
                    await s.actualizarExpediente.ejecutar(expediente.id, { datos: { ...expediente.datos, ...p.caso } });
                } catch (err) {
                    avisar(`El documento se generó, pero no se guardaron los datos en el expediente: ${mensajeError(err)}`, 'error');
                }
            }
            setError(null);
            avisar(`Documento generado (v${pad(v.numero)})`);
            setPaso({ n: 'listo', ruta: v.ruta, numero: v.numero });
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setTrabajando(false);
        }
    }

    const abrir = (ruta: string) => s.archivos.abrir(ruta).catch((e) => setError(mensajeError(e)));
    const mostrar = (ruta: string) => s.archivos.mostrarEnCarpeta(ruta).catch((e) => setError(mensajeError(e)));

    /* ----- pie según el paso ----- */
    let pie: ReactNode;
    if (paso.n === 'elegir') {
        pie = (
            <>
                <span className="espacio" />
                <button type="button" className="btn btn-sec" onClick={cerrar}>Cancelar</button>
                <button type="button" className="btn btn-pri" disabled={!modeloSel || trabajando} onClick={() => void continuar()}>
                    {trabajando ? 'Preparando…' : 'Continuar'}
                </button>
            </>
        );
    } else if (paso.n === 'formulario') {
        const b = paso.b;
        pie = (
            <>
                <span className="espacio" />
                <button type="button" className="btn btn-sec" onClick={() => { setError(null); setPaso({ n: 'elegir' }); }}>Atrás</button>
                <button type="submit" form="form-asistente" className="btn btn-pri" disabled={trabajando}>
                    {trabajando ? 'Revisando…' : 'Revisar'}
                </button>
                {b.faltantes.length === 0 && null}
            </>
        );
    } else if (paso.n === 'verificar') {
        const p = paso;
        pie = (
            <>
                <span className="espacio" />
                <button type="button" className="btn btn-sec" disabled={trabajando} onClick={() => { setError(null); setPaso({ n: 'formulario', b: p.b }); }}>Atrás</button>
                <button type="button" className="btn btn-pri" disabled={trabajando} onClick={() => void generar(p)}>
                    {trabajando ? 'Generando…' : 'Generar documento'}
                </button>
            </>
        );
    } else {
        const ruta = paso.ruta;
        pie = (
            <>
                <button type="button" className="btn btn-sec" onClick={() => void abrir(ruta)}>Abrir</button>
                <button type="button" className="btn btn-sec" onClick={() => void mostrar(ruta)}>Mostrar en carpeta</button>
                <span className="espacio" />
                <button type="button" className="btn btn-pri" onClick={cerrar}>Terminar</button>
            </>
        );
    }

    const actual = INDICE[paso.n];

    return (
        <Modal titulo="Nuevo documento" ancho="grande" cerrar={cerrar} pie={pie}>
            <p className="suave">Expediente <code>{expediente.codigo}</code> · {expediente.materia}</p>

            <div className="pasos">
                {ETAPAS.map((e, i) => (
                    <div key={e} className={`paso${i === actual ? ' activo' : i < actual ? ' hecho' : ''}`}>
                        <i>{i < actual ? '✓' : i + 1}</i>{e}
                    </div>
                ))}
            </div>

            <Aviso error={error ?? modelos.error} />

            {/* ===== 1. Elegir modelo ===== */}
            {paso.n === 'elegir' && (
                <>
                    {modelos.datos && modelos.datos.length === 0 ? (
                        <Alerta tipo="info">Aún no hay modelos activos. Crea o instala uno en la sección Modelos.</Alerta>
                    ) : (
                        <>
                            <input type="search" placeholder="Buscar modelo…" value={q} onChange={(e) => setQ(e.target.value)} />
                            <div className="lista-opciones">
                                {ordenados.map((m) => (
                                    <button
                                        key={m.versionId}
                                        type="button"
                                        className={`opcion${m.versionId === sel ? ' sel' : ''}`}
                                        onClick={() => setSel(m.versionId)}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div className="fila-chica">
                                                {m.categoria && <Insignia tono="azul">{m.categoria}</Insignia>}
                                                {m.materia === expediente.tipo && <Insignia tono="verde">Recomendado</Insignia>}
                                            </div>
                                            <b>{m.nombre}</b>
                                            <span className="suave">{m.descripcion || `v${m.version} · ${m.numCampos} campos`}</span>
                                        </div>
                                    </button>
                                ))}
                                {ordenados.length === 0 && modelos.datos && <p className="suave">Sin resultados.</p>}
                            </div>
                            <Campo
                                etiqueta="Título del documento"
                                ayuda="Si ya existe un documento con este título, se guarda como una versión nueva."
                            >
                                <input
                                    value={titulo}
                                    onChange={(e) => setTitulo(e.target.value)}
                                    placeholder={modeloSel?.nombre ?? 'Por defecto, el nombre del modelo'}
                                />
                            </Campo>
                            {existente && (
                                <Alerta tipo="info">
                                    Ya existe «{existente.titulo}» con {existente.versiones.length} versión(es): se guardará como v{pad(proxima)}.
                                </Alerta>
                            )}
                        </>
                    )}
                </>
            )}

            {/* ===== 2. Datos faltantes ===== */}
            {paso.n === 'formulario' && (
                <>
                    {paso.b.avisos.map((a) => <Alerta key={a} tipo="adv">{a}</Alerta>)}
                    {paso.b.faltantes.length === 0 ? (
                        <Alerta tipo="ok">No falta ningún dato: todo se completará desde el expediente.</Alerta>
                    ) : (
                        <p className="suave">Estos datos no están en el expediente. Complétalos para generar el documento.</p>
                    )}
                    <form id="form-asistente" className="form-grid" onSubmit={(ev) => void revisar(ev, paso.b)}>
                        {paso.b.faltantes.map((c) => (
                            <Campo
                                key={c.path}
                                etiqueta={`${c.etiqueta}${c.requerido ? ' *' : ' (opcional)'}`}
                                ancho={esTextoLargo(ultimo(c.path))}
                                ayuda={c.path}
                            >
                                <Entrada c={c} valor={paso.b.valores[c.path] ?? ''} />
                            </Campo>
                        ))}
                    </form>
                    {paso.b.faltantes.some((c) => NUMERICOS.has(c.tipo)) && (
                        <p className="suave">Los números admiten punto o coma decimal (10000,50). No uses separador de miles.</p>
                    )}
                    {paso.b.faltantes.some((c) => esCampoCaso(c.path) && c.path.split('.').length === 2) && (
                        <label className="casilla">
                            <input type="checkbox" checked={guardarCaso} onChange={(e) => setGuardarCaso(e.target.checked)} />
                            Guardar estos datos en el expediente para no volver a pedirlos
                        </label>
                    )}
                </>
            )}

            {/* ===== 3. Verificación ===== */}
            {paso.n === 'verificar' && (
                <>
                    <h3>Hoja de verificación</h3>
                    {paso.preparado.verificacion.some((v) => v.opcionalVacio) && (
                        <Alerta tipo="adv">
                            Algunos campos opcionales quedaron vacíos. Revísalos antes de generar.
                        </Alerta>
                    )}
                    {paso.preparado.verificacion.length === 0 ? (
                        <p className="suave">El modelo no usa ningún campo.</p>
                    ) : (
                        <div className="verif-scroll">
                            <div className="tabla-wrap">
                                <table className="tabla tabla-densa">
                                    <thead><tr><th>Dato</th><th>Valor insertado</th></tr></thead>
                                    <tbody>
                                        {paso.preparado.verificacion.map((v, i) => (
                                            <tr key={i}>
                                                <td><code>{v.ruta}</code></td>
                                                <td className="celda-larga">
                                                    {v.opcionalVacio ? <Insignia tono="ambar">Vacío (opcional)</Insignia> : v.valor}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    <details>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Vista previa del texto</summary>
                        <div
                            className="celda-larga"
                            style={{ marginTop: 10, maxHeight: 280, overflow: 'auto', padding: 12, border: '1px solid var(--borde)', borderRadius: 10, background: 'var(--superficie-2)' }}
                        >
                            {paso.preparado.texto}
                        </div>
                    </details>
                </>
            )}

            {/* ===== 4. Listo ===== */}
            {paso.n === 'listo' && (
                <>
                    <Alerta tipo="ok">Documento generado (v{pad(paso.numero)}).</Alerta>
                    <p className="suave"><code>{paso.ruta}</code></p>
                </>
            )}
        </Modal>
    );
}