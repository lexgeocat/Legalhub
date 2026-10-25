import { useEffect, useState } from 'react';
import type { ResolucionJurisprudencia } from '../../domain/jurisprudencia/jurisprudencia';
import { formatearCitaJurisprudencial } from '../../domain/jurisprudencia/jurisprudencia';
import { Aviso, Icono, Insignia, Modal, avisar } from '../_core/comunes';
import { mensajeError, useServicios } from '../_core/servicios';

interface Props {
  resolucion: ResolucionJurisprudencia;
  cerrar: () => void;
  alCambiarGuardado?: () => void;
  abrirVincular?: () => void;
}

export function DetalleResolucionModal({ resolucion, cerrar, alCambiarGuardado, abrirVincular }: Props) {
  const s = useServicios();
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [detalle, setDetalle] = useState<ResolucionJurisprudencia>(resolucion);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let montado = true;
    async function cargar() {
      if (resolucion.contenidoHtml) return;
      setCargando(true);
      try {
        const compl = await s.jurisprudencia.obtenerDetalle(resolucion);
        if (montado) {
          setDetalle(compl);
        }
      } catch (err) {
        if (montado) setError(mensajeError(err));
      } finally {
        if (montado) setCargando(false);
      }
    }
    cargar();
    return () => {
      montado = false;
    };
  }, [resolucion, s.jurisprudencia]);

  async function alternarGuardado() {
    setGuardando(true);
    try {
      if (detalle.guardadaLocal) {
        await s.jurisprudencia.eliminarDeBiblioteca(detalle.id);
        setDetalle((prev) => ({ ...prev, guardadaLocal: false }));
        avisar('Eliminada de tu biblioteca local');
      } else {
        const idLocal = await s.jurisprudencia.guardarEnBiblioteca(detalle);
        setDetalle((prev) => ({ ...prev, id: idLocal, guardadaLocal: true }));
        avisar('Guardada en tu biblioteca local (disponible sin conexión)');
      }
      alCambiarGuardado?.();
    } catch (err) {
      avisar(`Error: ${mensajeError(err)}`);
    } finally {
      setGuardando(false);
    }
  }

  async function copiarCita() {
    const cita = formatearCitaJurisprudencial(detalle);
    try {
      await navigator.clipboard.writeText(cita);
      avisar('Cita jurídica copiada al portapapeles');
    } catch {
      avisar('No se pudo copiar automáticamente al portapapeles');
    }
  }

  async function descargarPdf() {
    setDescargandoPdf(true);
    try {
      const { buffer, nombreArchivo } = await s.jurisprudencia.descargarPdf(detalle);
      // Guardar en la carpeta de Jurisprudencia de la app
      const ruta = await s.archivos.rutaJurisprudencia(nombreArchivo);
      await s.archivos.escribir(ruta, buffer);
      avisar(`PDF guardado en disco: ${nombreArchivo}`);
      // Abrir en el lector predeterminado del sistema
      await s.archivos.abrir(ruta);
    } catch (err) {
      avisar(`No se pudo descargar el PDF: ${mensajeError(err)}`);
    } finally {
      setDescargandoPdf(false);
    }
  }

  return (
    <Modal
      titulo={`${detalle.tipoResolucion} ${detalle.numeroResolucion}`}
      cerrar={cerrar}
      ancho="grande"
      pie={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-sec"
              onClick={copiarCita}
              title="Copiar cita jurídica formal"
            >
              <Icono n="documento" tam={15} /> Copiar Cita Legal
            </button>
            {abrirVincular && (
              <button
                type="button"
                className="btn btn-sec"
                onClick={abrirVincular}
                title="Vincular resolución a un caso del despacho"
              >
                <Icono n="carpeta" tam={15} /> Vincular a Expediente
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-sec"
              onClick={descargarPdf}
              disabled={descargandoPdf}
            >
              <Icono n="documento" tam={15} /> {descargandoPdf ? 'Descargando...' : 'Descargar PDF'}
            </button>
            <button
              type="button"
              className={`btn ${detalle.guardadaLocal ? 'btn-sec' : 'btn-pri'}`}
              onClick={alternarGuardado}
              disabled={guardando}
            >
              <Icono n={detalle.guardadaLocal ? 'ok' : 'mas'} tam={15} />{' '}
              {detalle.guardadaLocal ? 'Guardada en Biblioteca' : 'Guardar en mi Biblioteca'}
            </button>
          </div>
        </div>
      }
    >
      <div className="detalle-jurisprudencia">
        {/* Cabecera con metadatos clave */}
        <div className="juris-meta-box">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
            <Insignia tono={detalle.origen === 'TSJ' ? 'ambar' : 'azul'}>
              {detalle.origen === 'TSJ' ? 'Tribunal Supremo (TSJ)' : 'Tribunal Constitucional (TCP)'}
            </Insignia>
            {detalle.sala && <Insignia tono="gris">{detalle.sala}</Insignia>}
            {detalle.fechaEmision && <Insignia tono="gris">{detalle.fechaEmision}</Insignia>}
            {detalle.guardadaLocal && <Insignia tono="verde">Biblioteca Local</Insignia>}
          </div>

          <div className="juris-grid-datos">
            {detalle.numeroExpediente && (
              <div>
                <span className="juris-etiq">Expediente:</span> <strong>{detalle.numeroExpediente}</strong>
              </div>
            )}
            {detalle.magistrado && (
              <div>
                <span className="juris-etiq">Magistrado Relator:</span> <strong>{detalle.magistrado}</strong>
              </div>
            )}
            {detalle.demandante && (
              <div>
                <span className="juris-etiq">Demandante / Accionante:</span> {detalle.demandante}
              </div>
            )}
            {detalle.demandado && (
              <div>
                <span className="juris-etiq">Demandado / Accionado:</span> {detalle.demandado}
              </div>
            )}
            {detalle.departamento && (
              <div>
                <span className="juris-etiq">Distrito:</span> {detalle.departamento}
              </div>
            )}
            {detalle.materia && (
              <div>
                <span className="juris-etiq">Materia:</span> {detalle.materia}
              </div>
            )}
          </div>
        </div>

        {error && <Aviso error={error} />}

        {cargando ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-texto-apagado)' }}>
            <p>Cargando texto completo de la resolución...</p>
          </div>
        ) : detalle.contenidoHtml ? (
          <div
            className="juris-lector-html"
            dangerouslySetInnerHTML={{ __html: detalle.contenidoHtml }}
          />
        ) : detalle.resumen ? (
          <div style={{ marginTop: '16px' }}>
            <h4 style={{ marginBottom: '8px' }}>Extracto Jurisprudencial:</h4>
            <div
              className="juris-resumen-box"
              dangerouslySetInnerHTML={{ __html: detalle.resumen }}
            />
          </div>
        ) : (
          <p style={{ marginTop: '20px', color: 'var(--color-texto-apagado)' }}>
            No se encontró contenido de texto para esta resolución. Puedes descargar el PDF oficial con el botón inferior.
          </p>
        )}
      </div>
    </Modal>
  );
}
