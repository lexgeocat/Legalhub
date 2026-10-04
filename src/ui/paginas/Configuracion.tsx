import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useState, type FormEvent } from 'react';
import { hoyISO } from '../../domain/filtros/fecha';
import { Aviso, Campo } from '../comunes';
import { mensajeError, useCargar, useServicios } from '../servicios';

export function Configuracion() {
    const s = useServicios();
    const cfg = useCargar(() => s.config.cargar(), []);
    const personas = useCargar(() => s.consultas.listarPersonas(), []);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);
    const [clave, setClave] = useState('');
    const [raizNueva, setRaizNueva] = useState<string | null>(null);

    async function guardar(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
            await s.config.guardar({
                abogadoPersonaId: String(f.get('abogadoPersonaId') ?? ''),
                abogadoMatricula: String(f.get('abogadoMatricula') ?? ''),
                abogadoDomicilioProcesal: String(f.get('abogadoDomicilioProcesal') ?? ''),
                ...(raizNueva ? { carpetaRaiz: raizNueva } : {}),
            });
            if (raizNueva) window.location.reload();
            setOk('Configuración guardada');
            setError(null);
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    async function elegirRaiz() {
        const d = await open({ directory: true, multiple: false });
        if (d) setRaizNueva(d);
    }

    async function respaldar() {
        try {
            const destino = await save({
                defaultPath: `LegalHub_Backup_${hoyISO()}.lhbak`,
                filters: [{ name: 'Respaldo de Legal-Hub', extensions: ['lhbak'] }],
            });
            if (!destino) return;
            await invoke<string>('crear_backup', { destino, contrasena: clave || null, raiz: s.raiz });
            setOk(`Respaldo creado y verificado: ${destino}`);
            setError(null);
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    async function restaurar() {
        try {
            const origen = await open({ multiple: false, filters: [{ name: 'Respaldo de Legal-Hub', extensions: ['lhbak'] }] });
            if (!origen) return;
            if (!window.confirm('Se reemplazarán la base de datos, los modelos y los expedientes actuales (se guarda una copia previa). ¿Continuar?')) return;
            const msg = await invoke<string>('restaurar_backup', { origen, contrasena: clave || null, raiz: s.raiz });
            window.alert(msg);
            window.location.reload();
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    async function auditoria() {
        try {
            const r = await s.db.verificarAuditoria();
            if (r.ok) setOk(`Auditoría íntegra (${r.eventos} eventos)`);
            else setError(`La cadena de auditoría se rompe en el evento ${r.primerRoto}`);
        } catch (err) {
            setError(mensajeError(err));
        }
    }

    const c = cfg.datos;
    return (
        <>
            <h2>Configuración</h2>
            <Aviso error={error ?? cfg.error} />
            {ok && <p className="ok">{ok}</p>}
            {c && (
                <form className="panel" onSubmit={guardar} key={JSON.stringify(c)}>
                    <div className="ancho">
                        <strong>Carpeta de trabajo</strong>
                        <div className="acciones">
                            <span className="mono">{raizNueva ?? s.raiz}</span>
                            <button type="button" className="sec" onClick={elegirRaiz}>Cambiar…</button>
                        </div>
                        <span className="suave">Contiene Modelos, Expedientes y Backups. Al cambiarla, mueve tus archivos a mano antes de guardar.</span>
                    </div>
                    <Campo etiqueta="Abogado (persona)">
                        <select name="abogadoPersonaId" defaultValue={c.abogadoPersonaId ?? ''}>
                            <option value="">—</option>
                            {personas.datos?.filter((p) => p.tipo === 'natural').map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                    </Campo>
                    <Campo etiqueta="Matrícula profesional"><input name="abogadoMatricula" defaultValue={c.abogadoMatricula} /></Campo>
                    <Campo etiqueta="Domicilio procesal"><input name="abogadoDomicilioProcesal" defaultValue={c.abogadoDomicilioProcesal} /></Campo>
                    <div className="ancho"><button type="submit">Guardar</button></div>
                </form>
            )}

            <h3>Respaldo y restauración</h3>
            <section className="panel">
                <Campo etiqueta="Contraseña (opcional; sin ella el respaldo queda sin cifrar)">
                    <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} />
                </Campo>
                <div className="ancho acciones">
                    <button onClick={respaldar}>Crear respaldo…</button>
                    <button className="sec" onClick={restaurar}>Restaurar respaldo…</button>
                    <button className="sec" onClick={auditoria}>Verificar cadena de auditoría</button>
                </div>
            </section>
        </>
    );
}