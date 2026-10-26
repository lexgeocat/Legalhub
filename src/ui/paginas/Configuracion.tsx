// src/ui/paginas/Configuracion.tsx
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useState, type FormEvent } from 'react';
import { hoyISO } from '../../domain/modelos/filtros/fecha';
import { VERSION_APP } from '../../domain/comun/version';
import { Alerta, Aviso, Campo, Icono, Insignia, Modal, avisar, confirmar } from '../_core/comunes';
import { FormularioPersona } from '../compartidos/FormularioPersona';
import { mensajeError, useCargar, useServicios } from '../_core/servicios';
import { useTema } from '../_core/tema';
import { ModalSubirDiccionario } from '../diccionarios/ModalSubirDiccionario';

type Ocupado = 'guardar' | 'respaldo' | 'restaurar' | 'auditoria' | 'limpieza' | null;

export function Configuracion() {
    const [tema, fijarTema] = useTema();
    const s = useServicios();
    const cfg = useCargar(() => s.config.cargar(), []);
    const personas = useCargar(() => s.consultas.listarPersonas(), []);
    const [error, setError] = useState<string | null>(null);
    const [clave, setClave] = useState('');
    const [clave2, setClave2] = useState('');
    const [raizNueva, setRaizNueva] = useState<string | null>(null);
    const [ocupado, setOcupado] = useState<Ocupado>(null);
    const [auditoria, setAuditoria] = useState<{ ok: boolean; texto: string } | null>(null);
    const [respaldoOk, setRespaldoOk] = useState<string | null>(null);
    const [restaurado, setRestaurado] = useState<string | null>(null);
    const [fichaAbogado, setFichaAbogado] = useState<{ id?: string } | null>(null);
    const [abogadoSel, setAbogadoSel] = useState<string | null>(null);

    const c = cfg.datos;
    const diccionarios = useCargar(() => s.diccionarios.listar(), []);
    const [subirDicc, setSubirDicc] = useState(false);
    const [importandoBase, setImportandoBase] = useState(false);
    const abogadoId = abogadoSel ?? c?.abogadoPersonaId ?? '';
    // Solo se consulta la ficha del abogado: ya no se lista a todas las personas.
    const abogado = useCargar(
        async () => ({ nombre: abogadoId ? await s.consultas.obtenerNombrePersona(abogadoId) : null }),
        [abogadoId],
    );
    const nombreAbogado = abogadoId ? (abogado.datos?.nombre ?? null) : null;

    async function guardar(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setOcupado('guardar');
        try {
            await s.config.guardar({
                abogadoPersonaId: String(f.get('abogadoPersonaId') ?? ''),
                abogadoMatricula: String(f.get('abogadoMatricula') ?? '').trim(),
                abogadoDomicilioProcesal: String(f.get('abogadoDomicilioProcesal') ?? '').trim(),
                ...(raizNueva ? { carpetaRaiz: raizNueva } : {}),
            });
            setError(null);
            if (raizNueva) {
                window.location.reload();
                return;
            }
            cfg.recargar();
            avisar('Configuración guardada');
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setOcupado(null);
        }
    }

    async function elegirRaiz() {
        try {
            // Nota: la carpeta debe estar permitida en src-tauri/capabilities/default.json (fs:scope y opener).
            const d = await open({ directory: true, multiple: false });
            if (d) setRaizNueva(d);
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    async function respaldar() {
        if (clave && clave !== clave2) {
            setError('Las contraseñas no coinciden');
            return;
        }
        try {
            const destino = await save({
                defaultPath: `LegalHub_Backup_${hoyISO()}.lhbak`,
                filters: [{ name: 'Respaldo de Legal-Hub', extensions: ['lhbak'] }],
            });
            if (!destino) return;
            setOcupado('respaldo');
            await invoke<string>('crear_backup', { destino, contrasena: clave || null, raiz: s.raiz });
            setRespaldoOk(`Respaldo creado y verificado: ${destino}`);
            setError(null);
        } catch (err) {
            setRespaldoOk(null);
            setError(mensajeError(err));
        } finally {
            setOcupado(null);
        }
    }

    async function restaurar() {
        try {
            const origen = await open({ multiple: false, filters: [{ name: 'Respaldo de Legal-Hub', extensions: ['lhbak'] }] });
            if (!origen) return;
            const ok = await confirmar(
                'Se reemplazarán la base de datos, los modelos y los expedientes actuales (antes se guarda una copia previa). ¿Continuar?',
                'Restaurar respaldo',
            );
            if (!ok) return;
            setOcupado('restaurar');
            const msg = await invoke<string>('restaurar_backup', { origen, contrasena: clave || null, raiz: s.raiz });
            setError(null);
            setRestaurado(msg);
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setOcupado(null);
        }
    }

    async function verificarAuditoria() {
        setOcupado('auditoria');
        try {
            const r = await s.db.verificarAuditoria();
            setAuditoria(
                r.ok
                    ? { ok: true, texto: `Auditoría íntegra (${r.eventos} eventos verificados).` }
                    : { ok: false, texto: `La cadena de auditoría se rompe en el evento ${r.primerRoto}. Los registros pudieron ser alterados.` },
            );
            setError(null);
        } catch (err) {
            setAuditoria(null);
            setError(mensajeError(err));
        } finally {
            setOcupado(null);
        }
    }

    /** Archiva a las personas que ya no figuran en ningún expediente, inmueble ni como representante. */
    async function limpiarPersonas() {
        setOcupado('limpieza');
        try {
            const conservar = abogadoId || null;
            const n = await s.limpiarPersonas.contar(conservar);
            if (n === 0) {
                avisar('No hay personas sin vínculos', 'info');
                return;
            }
            const ok = await confirmar(
                `Hay ${n} persona(s) que no figuran en ningún expediente, inmueble ni como representante. ` +
                '¿Quitarlas de las listas? No se borran documentos ni archivos.',
                'Limpiar personas',
            );
            if (!ok) return;
            await s.limpiarPersonas.ejecutar(conservar);
            setError(null);
            personas.recargar();
            avisar(`${n} persona(s) quitadas de las listas`);
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setOcupado(null);
        }
    }

    async function eliminarDiccionario(id: string, nombre: string) {
        const ok = await confirmar(
            `¿Eliminar el diccionario «${nombre}» y todos sus términos indexados?`,
            'Eliminar diccionario',
        );
        if (!ok) return;
        try {
            await s.diccionarios.eliminar(id);
            diccionarios.recargar();
            avisar('Diccionario eliminado');
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    async function importarColeccionBase() {
        setImportandoBase(true);
        setError(null);
        try {
            const coleccion = [
                {
                    archivo: 'DICCIONARIO JURIDICO ELEMENTAL - Guillermo Cabanellas de Torres.pdf',
                    nombre: 'Diccionario Jurídico Elemental',
                    autor: 'Guillermo Cabanellas de Torres',
                    descripcion: 'Definiciones esenciales de derecho civil, penal, laboral, procesal y constitucional.',
                },
                {
                    archivo: 'DICCIONARIO JURIDICO_MANUEL OSORIO.pdf',
                    nombre: 'Diccionario de Ciencias Jurídicas, Políticas y Sociales',
                    autor: 'Manuel Ossorio',
                    descripcion: 'Compendio doctrinal latinoamericano de conceptos jurídicos y procesales.',
                },
                {
                    archivo: 'GLOSARIO DE TÉRMINOS PARA LA IMPLEMENTACIÓN DE LA LEY INTEGRAL PARA GARANTIZAR A LAS MUJERES UNA VIDA LIBRE DE VIOLENCIA.pdf',
                    nombre: 'Glosario de Términos - Ley 348',
                    autor: 'Ministerio de Justicia del Estado Plurinacional de Bolivia',
                    descripcion: 'Definiciones técnico-jurídicas para la aplicación de la Ley 348.',
                },
            ];

            let count = 0;
            for (const item of coleccion) {
                try {
                    const ruta = `F:/Apps_web/legal-hub/diccionarios/${item.archivo}`;
                    const bytes = await s.archivos.leer(ruta);
                    await s.diccionarios.importar(bytes, {
                        nombre: item.nombre,
                        autor: item.autor,
                        descripcion: item.descripcion,
                    });
                    count++;
                } catch {
                    // Si ya existe o error en uno, se continúa con el siguiente
                }
            }
            diccionarios.recargar();
            avisar(`Se importaron ${count} diccionarios correctamente a la base.`);
        } catch (err) {
            setError(`Error al importar colección: ${mensajeError(err)}`);
        } finally {
            setImportandoBase(false);
        }
    }

    return (
        <div className="pagina">
            <div className="pagina-cab">
                <div>
                    <h1>Configuración</h1>
                    <p className="subtitulo">Datos del abogado, carpeta de trabajo, respaldos y verificación de integridad.</p>
                </div>
            </div>

            <Aviso error={error ?? cfg.error ?? personas.error ?? abogado.error} />
            <section className="tarjeta">
                <div className="tarjeta-cab">
                    <div>
                        <h3>Apariencia y tema</h3>
                        <p className="suave">Personaliza el entorno visual del despacho. El modo oscuro reduce la fatiga visual durante sesiones prolongadas de redacción y lectura de expedientes.</p>
                    </div>
                </div>
                <div className="tema-selector-grid">
                    <button
                        type="button"
                        className={`tema-opcion-card${tema === 'oxford' ? ' sel' : ''}`}
                        onClick={() => {
                            fijarTema('oxford');
                            avisar('Tema Oxford Editorial activado');
                        }}
                    >
                        <div className="tema-preview tema-preview-claro">
                            <div className="tp-nav" />
                            <div className="tp-content">
                                <div className="tp-bar" />
                                <div className="tp-card" />
                            </div>
                        </div>
                        <div className="tema-opcion-info">
                            <div className="tema-opcion-titulo">
                                <Icono n="sol" tam={16} />
                                <b>Oxford Editorial</b>
                                {tema === 'oxford' && <Insignia tono="azul">Activo</Insignia>}
                            </div>
                            <p className="suave">Oxford Navy & Alabastro. Tonalidad de prestigio jurídico y legibilidad óptima para despachos.</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        className={`tema-opcion-card${tema === 'slate' ? ' sel' : ''}`}
                        onClick={() => {
                            fijarTema('slate');
                            avisar('Tema Slate Dusk activado');
                        }}
                    >
                        <div className="tema-preview tema-preview-oscuro">
                            <div className="tp-nav" />
                            <div className="tp-content">
                                <div className="tp-bar" />
                                <div className="tp-card" />
                            </div>
                        </div>
                        <div className="tema-opcion-info">
                            <div className="tema-opcion-titulo">
                                <Icono n="luna" tam={16} />
                                <b>Slate Dusk</b>
                                {tema === 'slate' && <Insignia tono="azul">Activo</Insignia>}
                            </div>
                            <p className="suave">Pizarra nocturno suave anti-fatiga. Diseñado para juristas en jornadas de trabajo prolongadas.</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        className={`tema-opcion-card${tema === 'rose' ? ' sel' : ''}`}
                        onClick={() => {
                            fijarTema('rose');
                            avisar('Tema Rose Quartz Boutique activado');
                        }}
                    >
                        <div className="tema-preview" style={{ background: '#fdfbf9', borderColor: '#f2e2df' }}>
                            <div className="tp-nav" style={{ background: '#22111a', borderRight: '1px solid rgba(244, 215, 222, 0.15)' }} />
                            <div className="tp-content">
                                <div className="tp-bar" style={{ background: '#9d4466' }} />
                                <div className="tp-card" style={{ background: '#ffffff', borderColor: '#f2e2df' }} />
                            </div>
                        </div>
                        <div className="tema-opcion-info">
                            <div className="tema-opcion-titulo">
                                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#9d4466' }} />
                                <b>Rose Quartz Boutique</b>
                                {tema === 'rose' && <Insignia tono="violeta">Activo</Insignia>}
                            </div>
                            <p className="suave">Panel oscuro boutique (Plum Wine & Rose Gold) con espacio de trabajo marfil suave. Sofisticación para firmas ejecutivas.</p>
                        </div>
                    </button>
                </div>
            </section>

            {c && (
                <form key={JSON.stringify(c)} className="tarjeta" onSubmit={(e) => void guardar(e)}>
                    <div className="tarjeta-cab">
                        <div>
                            <h3>Datos generales</h3>
                            <p className="suave">Se usan en los modelos como {'{{abogado.…}}'}.</p>
                        </div>
                    </div>

                    <div className="form-grid">
                        <div className="campo ancho">
                            <span className="campo-etiq">Carpeta de trabajo</span>
                            <div className="acciones">
                                <code>{raizNueva ?? s.raiz}</code>
                                <button type="button" className="btn btn-sec btn-sm" onClick={() => void elegirRaiz()}>Cambiar…</button>
                                {raizNueva && (
                                    <button type="button" className="btn btn-fan btn-sm" onClick={() => setRaizNueva(null)}>Descartar cambio</button>
                                )}
                            </div>
                            <span className="campo-ayuda">Contiene Modelos y Expedientes. Al cambiarla, mueve tus archivos a mano antes de guardar.</span>
                        </div>

                        {raizNueva && (
                            <div className="ancho">
                                <Alerta tipo="adv">
                                    La carpeta nueva se aplicará al guardar y la aplicación se recargará. Los archivos de la carpeta anterior no se mueven solos.
                                </Alerta>
                            </div>
                        )}

                        <div className="campo">
                            <span className="campo-etiq">Abogado</span>
                            <input type="hidden" name="abogadoPersonaId" value={abogadoId} />
                            <div className="acciones">
                                {nombreAbogado ? (
                                    <Insignia tono="verde">{nombreAbogado}</Insignia>
                                ) : (
                                    <span className="suave">
                                        {abogadoId && abogado.datos ? 'La ficha guardada ya no existe.' : 'Sin registrar.'}
                                    </span>
                                )}
                            </div>
                            <span className="campo-ayuda">Solo se usa tu ficha: aquí no se listan clientes ni contrapartes.</span>
                        </div>
                        <div className="campo">
                            <span className="campo-etiq">Mis datos</span>
                            <div className="acciones">
                                <button type="button" className="btn btn-sec btn-sm"
                                    onClick={() => setFichaAbogado(nombreAbogado ? { id: abogadoId } : {})}>
                                    {nombreAbogado ? 'Editar mis datos…' : 'Registrar mis datos…'}
                                </button>
                                {abogadoId && (
                                    <button type="button" className="btn btn-fan btn-sm" onClick={() => setAbogadoSel('')}>Quitar</button>
                                )}
                            </div>
                        </div>
                        <Campo etiqueta="Matrícula profesional">
                            <input name="abogadoMatricula" defaultValue={c.abogadoMatricula} />
                        </Campo>
                        <Campo etiqueta="Domicilio procesal" ancho>
                            <input name="abogadoDomicilioProcesal" defaultValue={c.abogadoDomicilioProcesal} />
                        </Campo>
                    </div>

                    <div>
                        <button type="submit" className="btn btn-pri" disabled={ocupado !== null}>
                            {ocupado === 'guardar' ? 'Guardando…' : 'Guardar configuración'}
                        </button>
                    </div>
                </form>
            )}

            <section className="tarjeta">
                <div className="tarjeta-cab">
                    <div>
                        <h3>Personas</h3>
                        <p className="suave">
                            Quita de las listas a quienes ya no figuran en ningún expediente (por ejemplo, tras eliminar expedientes).
                            Tu ficha de abogado nunca se toca.
                        </p>
                    </div>
                </div>
                <div>
                    <button type="button" className="btn btn-sec" disabled={ocupado !== null} onClick={() => void limpiarPersonas()}>
                        {ocupado === 'limpieza' ? 'Revisando…' : 'Limpiar personas sin vínculos'}
                    </button>
                </div>
            </section>

            <section className="tarjeta">
                <div className="tarjeta-cab">
                    <div>
                        <h3>Diccionarios Jurídicos (PDF)</h3>
                        <p className="suave">
                            Fuentes doctrinales y glosarios para consulta y citación en documentos. El motor indexa automáticamente los términos y definiciones con SQLite FTS5 y lectura sincronizada en visor PDF.
                        </p>
                    </div>
                    <div className="acciones">
                        <button
                            type="button"
                            className="btn btn-sec btn-sm"
                            disabled={importandoBase}
                            onClick={() => void importarColeccionBase()}
                            title="Importa los 3 diccionarios esenciales (Cabanellas, Ossorio, Glosario Ley 348) ubicados en la carpeta diccionarios"
                        >
                            <Icono n="libro" tam={14} /> {importandoBase ? 'Importando colección…' : 'Colección Base (3 Obras)'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-pri btn-sm"
                            onClick={() => setSubirDicc(true)}
                        >
                            <Icono n="mas" tam={14} /> Subir Diccionario…
                        </button>
                    </div>
                </div>

                {diccionarios.datos && diccionarios.datos.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', background: 'var(--fondo-2)', borderRadius: '8px', border: '1px dashed var(--borde-2)' }}>
                        <p style={{ margin: '0 0 10px 0', fontWeight: 600, color: 'var(--texto-1)' }}>Aún no tienes diccionarios jurídicos cargados</p>
                        <p className="suave" style={{ margin: '0 0 16px 0', fontSize: '0.85rem' }}>
                            Puedes importar con 1 clic los 3 diccionarios fundamentales del sistema (Cabanellas, Ossorio, Ley 348) o subir cualquier otro archivo PDF doctrinal.
                        </p>
                        <div className="acciones" style={{ justifyContent: 'center' }}>
                            <button
                                type="button"
                                className="btn btn-pri btn-sm"
                                disabled={importandoBase}
                                onClick={() => void importarColeccionBase()}
                            >
                                <Icono n="libro" tam={14} /> {importandoBase ? 'Importando colección…' : 'Cargar 3 Diccionarios Esenciales'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-sec btn-sm"
                                onClick={() => setSubirDicc(true)}
                            >
                                Subir PDF personalizado…
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="tabla-responsive">
                        <table className="tabla" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Diccionario</th>
                                    <th>Autor</th>
                                    <th>Páginas</th>
                                    <th>Términos Indexados</th>
                                    <th style={{ textAlign: 'right' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {diccionarios.datos?.map((d) => (
                                    <tr key={d.id}>
                                        <td>
                                            <b>{d.nombre}</b>
                                            {d.descripcion && (
                                                <div className="suave" style={{ fontSize: '0.78rem', marginTop: '2px' }}>
                                                    {d.descripcion}
                                                </div>
                                            )}
                                        </td>
                                        <td>{d.autor || <span className="suave">—</span>}</td>
                                        <td>
                                            <Insignia tono="azul">{d.numPaginas} págs.</Insignia>
                                        </td>
                                        <td>
                                            <Insignia tono="verde">{d.numTerminos.toLocaleString()} términos</Insignia>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                type="button"
                                                className="btn btn-fan btn-sm"
                                                title="Eliminar este diccionario"
                                                onClick={() => void eliminarDiccionario(d.id, d.nombre)}
                                            >
                                                <Icono n="papelera" tam={14} /> Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="tarjeta">
                <div className="tarjeta-cab">
                    <div>
                        <h3>Respaldo y restauración</h3>
                        <p className="suave">Incluye la base de datos, los modelos y los expedientes. Se verifica con hashes al crearlo.</p>
                    </div>
                </div>

                <div className="form-grid">
                    <Campo etiqueta="Contraseña" ayuda="Opcional. Sin ella el respaldo queda sin cifrar. Si la pierdes, no podrás restaurarlo.">
                        <input type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
                    </Campo>
                    <Campo etiqueta="Repetir contraseña" ayuda="Solo al crear un respaldo cifrado.">
                        <input type="password" autoComplete="new-password" value={clave2} disabled={!clave} onChange={(e) => setClave2(e.target.value)} />
                    </Campo>
                </div>

                {respaldoOk && <Alerta tipo="ok">{respaldoOk}</Alerta>}

                <div className="acciones">
                    <button type="button" className="btn btn-pri" disabled={ocupado !== null} onClick={() => void respaldar()}>
                        {ocupado === 'respaldo' ? 'Creando respaldo…' : 'Crear respaldo…'}
                    </button>
                    <button type="button" className="btn btn-sec" disabled={ocupado !== null} onClick={() => void restaurar()}>
                        {ocupado === 'restaurar' ? 'Restaurando…' : 'Restaurar respaldo…'}
                    </button>
                </div>
            </section>

            <section className="tarjeta">
                <div className="tarjeta-cab">
                    <div>
                        <h3>Integridad</h3>
                        <p className="suave">Comprueba que la cadena de auditoría no haya sido alterada.</p>
                    </div>
                </div>
                {auditoria && <Alerta tipo={auditoria.ok ? 'ok' : 'error'}>{auditoria.texto}</Alerta>}
                <div>
                    <button type="button" className="btn btn-sec" disabled={ocupado !== null} onClick={() => void verificarAuditoria()}>
                        {ocupado === 'auditoria' ? 'Verificando…' : 'Verificar cadena de auditoría'}
                    </button>
                </div>
            </section>

            <p className="suave">Legal-Hub versión {VERSION_APP}</p>

            {restaurado && (
                <Modal
                    titulo="Restauración completa"
                    cerrar={() => window.location.reload()}
                    pie={
                        <>
                            <span className="espacio" />
                            <button type="button" className="btn btn-pri" onClick={() => window.location.reload()}>Reiniciar Legal-Hub</button>
                        </>
                    }
                >
                    <Alerta tipo="ok">{restaurado}</Alerta>
                    <p className="suave">La aplicación se recargará para usar los datos restaurados.</p>
                </Modal>
            )}

            {fichaAbogado && (
                <FormularioPersona
                    id={fichaAbogado.id}
                    usoBorrador="abogado"
                    personas={personas.datos ?? []}
                    cerrar={() => setFichaAbogado(null)}
                    guardado={(id) => {
                        setFichaAbogado(null);
                        setAbogadoSel(id);
                        personas.recargar();
                        abogado.recargar();
                        avisar('Datos guardados. Pulsa «Guardar configuración» para fijarte como abogado.');
                    }}
                />
            )}

            {subirDicc && (
                <ModalSubirDiccionario
                    cerrar={() => {
                        setSubirDicc(false);
                        diccionarios.recargar();
                    }}
                    alGuardar={() => {
                        setSubirDicc(false);
                        diccionarios.recargar();
                    }}
                />
            )}
        </div>
    );
}