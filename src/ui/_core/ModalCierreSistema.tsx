// src/ui/_core/ModalCierreSistema.tsx
import { useEffect, useRef, useState } from 'react';
import {
    cancelarCierreSistema,
    confirmarCierreSistema,
    suscribirCierre,
    type EstadoCierreSistema,
} from './guardiaCierre';
import { Icono } from './comunes';

export function ModalCierreSistema() {
    const [visible, setVisible] = useState(false);
    const [estado, setEstado] = useState<EstadoCierreSistema>({
        ocupado: false,
        conCambios: false,
        tareas: [],
        cambios: [],
    });
    const [cerrando, setCerrando] = useState(false);
    const [avisoWeb, setAvisoWeb] = useState(false);
    const btnSeguroRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        return suscribirCierre((solicitado, nuevoEstado) => {
            setVisible(solicitado);
            setEstado(nuevoEstado);
            if (!solicitado) {
                setCerrando(false);
                setAvisoWeb(false);
            }
        });
    }, []);

    // Foco inicial en el botón más seguro al abrir el diálogo
    useEffect(() => {
        if (visible) {
            const timer = window.setTimeout(() => {
                btnSeguroRef.current?.focus();
            }, 30);
            return () => window.clearTimeout(timer);
        }
    }, [visible]);

    // Teclado: Escape siempre cancela; Enter confirma solo si no hay tareas ni cambios
    useEffect(() => {
        if (!visible) return;
        const tecla = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                cancelarCierreSistema();
            } else if (e.key === 'Enter' && !estado.ocupado && !estado.conCambios && !cerrando) {
                e.preventDefault();
                void ejecutarSalida();
            }
        };
        window.addEventListener('keydown', tecla);
        return () => window.removeEventListener('keydown', tecla);
    }, [visible, estado.ocupado, estado.conCambios, cerrando]);

    if (!visible) return null;

    const ejecutarSalida = async () => {
        setCerrando(true);
        try {
            await confirmarCierreSistema();
            const esTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
            if (!esTauri) {
                setAvisoWeb(true);
            }
        } catch (err) {
            console.error('Error al confirmar cierre:', err);
        } finally {
            setCerrando(false);
        }
    };

    return (
        <div className="modal-fondo mcs-fondo" role="dialog" aria-modal="true" aria-labelledby="mcs-titulo">
            <div className={`modal-caja mcs-caja ${estado.ocupado ? 'mcs-ocupado' : estado.conCambios ? 'mcs-cambios' : 'mcs-normal'}`}>
                {/* Cabecera */}
                <header className="modal-cab mcs-cab">
                    <div className="mcs-cab-icono">
                        {estado.ocupado ? (
                            <div className="mcs-ico-pulso">
                                <Icono n="rayo" tam={22} />
                            </div>
                        ) : estado.conCambios ? (
                            <div className="mcs-ico-alerta">
                                <Icono n="alerta" tam={22} />
                            </div>
                        ) : (
                            <div className="mcs-ico-info">
                                <Icono n="balanza" tam={22} />
                            </div>
                        )}
                        <div>
                            <h2 id="mcs-titulo">
                                {estado.ocupado
                                    ? 'Operación en curso en el sistema'
                                    : estado.conCambios
                                    ? 'Modificaciones pendientes de guardar'
                                    : '¿Salir de LEGAL-HUB?'}
                            </h2>
                            <p className="mcs-subtitulo">
                                {estado.ocupado
                                    ? 'El sistema está realizando tareas activas'
                                    : estado.conCambios
                                    ? 'Hay trabajo que se perderá si sales ahora'
                                    : 'Confirmación de cierre de la aplicación'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn-fan btn-icono"
                        onClick={cancelarCierreSistema}
                        aria-label="Cerrar ventana emergente"
                        title="Cancelar (Esc)"
                    >
                        <Icono n="cerrar" tam={16} />
                    </button>
                </header>

                {/* Contenido según el estado detectado */}
                <div className="modal-cuerpo mcs-cuerpo">
                    {estado.ocupado ? (
                        <div className="mcs-bloque mcs-bloque-ocupado">
                            <div className="mcs-aviso-txt">
                                <strong>LEGAL-HUB está ejecutando procesos en este momento:</strong>
                            </div>
                            <ul className="mcs-lista">
                                {estado.tareas.map((t) => (
                                    <li key={t.id} className="mcs-item-tarea">
                                        <span className="mcs-punto-activo" />
                                        <span>{t.descripcion}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mcs-nota-peligro">
                                <Icono n="alerta" tam={15} />
                                <span>
                                    Cerrar el sistema ahora podría interrumpir la operación y ocasionar pérdida o corrupción de datos. Te sugerimos esperar unos segundos a que finalice.
                                </span>
                            </div>
                        </div>
                    ) : estado.conCambios ? (
                        <div className="mcs-bloque mcs-bloque-cambios">
                            <div className="mcs-aviso-txt">
                                <strong>Tienes cambios sin guardar en los siguientes elementos:</strong>
                            </div>
                            <ul className="mcs-lista">
                                {estado.cambios.map((c) => (
                                    <li key={c.id} className="mcs-item-cambio">
                                        <Icono n="editar" tam={14} />
                                        <span>{c.descripcion}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mcs-nota-alerta">
                                <Icono n="alerta" tam={15} />
                                <span>
                                    Si cierras el programa en este momento, todas las modificaciones que no hayas guardado se perderán definitivamente.
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="mcs-bloque mcs-bloque-libre">
                            <p className="mcs-txt-libre">
                                Todas tus tareas y datos están al día. ¿Estás seguro de que deseas cerrar y salir de LEGAL-HUB?
                            </p>
                        </div>
                    )}
                    {avisoWeb && (
                        <div className="mcs-nota-alerta">
                            <Icono n="alerta" tam={15} />
                            <span>
                                En el navegador web la política de seguridad impide que una página cierre la pestaña automáticamente. Por favor cierra esta pestaña con <strong>Ctrl + W</strong> o en la «✕» de tu navegador.
                            </span>
                        </div>
                    )}
                </div>

                {/* Botones de acción */}
                <footer className="modal-pie mcs-pie">
                    {estado.ocupado ? (
                        <>
                            <button
                                ref={btnSeguroRef}
                                type="button"
                                className="btn btn-pri"
                                onClick={cancelarCierreSistema}
                            >
                                Esperar a que termine
                            </button>
                            <button
                                type="button"
                                className="btn btn-peligro"
                                disabled={cerrando}
                                onClick={() => void ejecutarSalida()}
                            >
                                {cerrando ? 'Cerrando…' : 'Forzar cierre de todos modos'}
                            </button>
                        </>
                    ) : estado.conCambios ? (
                        <>
                            <button
                                ref={btnSeguroRef}
                                type="button"
                                className="btn btn-pri"
                                onClick={cancelarCierreSistema}
                            >
                                Seguir trabajando
                            </button>
                            <button
                                type="button"
                                className="btn btn-peligro"
                                disabled={cerrando}
                                onClick={() => void ejecutarSalida()}
                            >
                                {cerrando ? 'Cerrando…' : 'Descartar cambios y salir'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                ref={btnSeguroRef}
                                type="button"
                                className="btn btn-sec"
                                onClick={cancelarCierreSistema}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="btn btn-pri"
                                disabled={cerrando}
                                onClick={() => void ejecutarSalida()}
                            >
                                {cerrando ? 'Saliendo…' : 'Salir de LEGAL-HUB'}
                            </button>
                        </>
                    )}
                </footer>
            </div>
        </div>
    );
}

