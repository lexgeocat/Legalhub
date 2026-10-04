// src/ui/paginas/Configuracion.tsx
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useState, type FormEvent } from 'react';
import { hoyISO } from '../../domain/filtros/fecha';
import { VERSION_APP } from '../../domain/version';
import { Alerta, Aviso, Campo, Modal, avisar, confirmar } from '../comunes';
import { mensajeError, useCargar, useServicios } from '../servicios';

type Ocupado = 'guardar' | 'respaldo' | 'restaurar' | 'auditoria' | null;

export function Configuracion() {
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

    const c = cfg.datos;
    const naturales = (personas.datos ?? []).filter((p) => p.tipo === 'natural');

    return (
        <div className="pagina">
            <div className="pagina-cab">
                <div>
                    <h1>Configuración</h1>
                    <p className="subtitulo">Datos del abogado, carpeta de trabajo, respaldos y verificación de integridad.</p>
                </div>
            </div>

            <Aviso error={error ?? cfg.error ?? personas.error} />

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

                        <Campo etiqueta="Abogado (persona)" ayuda={naturales.length === 0 ? 'Registra primero al abogado en la sección Personas.' : undefined}>
                            <select name="abogadoPersonaId" defaultValue={c.abogadoPersonaId ?? ''}>
                                <option value="">—</option>
                                {naturales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </Campo>
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
        </div>
    );
}