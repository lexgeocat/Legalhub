import { useEffect, useState } from 'react';
import type { ResolucionJurisprudencia } from '../../domain/jurisprudencia/jurisprudencia';
import {
  formatearCitaJurisprudencial,
  sanearContenidoHtml,
} from '../../domain/jurisprudencia/jurisprudencia';
import { Aviso, Icono, Insignia, Modal, avisar } from '../_core/comunes';
import { mensajeError, useServicios } from '../_core/servicios';
import { FichaJurisprudencialCard } from './FichaJurisprudencialCard';
import { VisorPdf } from '../pdf/VisorPdf';

interface Props {
  resolucion: ResolucionJurisprudencia;
  cerrar: () => void;
  alCambiarGuardado?: () => void;
  abrirVincular?: () => void;
}

type VistaModal = 'pdf' | 'ficha' | 'texto';

export function DetalleResolucionModal({ resolucion, cerrar, alCambiarGuardado, abrirVincular }: Props) {
  const s = useServicios();
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [detalle, setDetalle] = useState<ResolucionJurisprudencia>(resolucion);
  const [error, setError] = useState<string | null>(null);

  // Pestaña activa: PDF Oficial vs Ficha Jurisprudencial vs Texto Transcrito
  const [vista, setVista] = useState<VistaModal>(() => {
    // Si no tiene HTML o es reciente (scanned), abrir directamente en PDF
    if (!resolucion.contenidoHtml || resolucion.contenidoHtml.trim().length <= 50) {
      return 'pdf';
    }
    return resolucion.fichas && resolucion.fichas.length > 0 ? 'ficha' : 'texto';
  });

  // Estado del visor de PDF
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [cargandoPdf, setCargandoPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);

  useEffect(() => {
    let montado = true;
    async function cargar() {
      if (resolucion.contenidoHtml && (resolucion.maxima || resolucion.fichas)) return;
      setCargando(true);
      try {
        const compl = await s.jurisprudencia.obtenerDetalle(resolucion);
        if (montado) {
          setDetalle(compl);
          // Si no tiene transcripción HTML pero tiene PDF escaneado (como en resoluciones 2026)
          if (!compl.contenidoHtml || compl.contenidoHtml.trim().length <= 50) {
            setVista('pdf');
          } else if (compl.maxima || (compl.fichas && compl.fichas.length > 0)) {
            setVista('ficha');
          } else {
            setVista('texto');
          }
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

  // Cargar binario del PDF cuando se seleccione la vista 'pdf'
  useEffect(() => {
    let montado = true;
    if (vista !== 'pdf' || pdfBytes || cargandoPdf) return;

    async function obtenerBytes() {
      setCargandoPdf(true);
      setErrorPdf(null);
      try {
        if (detalle.rutaPdf) {
          const bytes = await s.archivos.leer(detalle.rutaPdf);
          if (montado) setPdfBytes(bytes);
        } else {
          const { buffer } = await s.jurisprudencia.descargarPdf(detalle);
          if (montado) setPdfBytes(buffer);
        }
      } catch (err) {
        if (montado) setErrorPdf(mensajeError(err));
      } finally {
        if (montado) setCargandoPdf(false);
      }
    }

    obtenerBytes();
    return () => {
      montado = false;
    };
  }, [vista, detalle, pdfBytes, cargandoPdf, s.archivos, s.jurisprudencia]);

  async function alternarGuardado() {
    setGuardando(true);
    try {
      if (detalle.guardadaLocal) {
        await s.jurisprudencia.eliminarDeBiblioteca(detalle);
        setDetalle((prev) => ({ ...prev, guardadaLocal: false, idLocal: undefined }));
        avisar('Eliminada de tu biblioteca local');
      } else {
        const guardada = await s.jurisprudencia.guardarEnBiblioteca(detalle);
        setDetalle(guardada);
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
      if (detalle.rutaPdf) {
        await s.archivos.abrir(detalle.rutaPdf);
        avisar('Abriendo PDF almacenado en disco...');
        return;
      }

      const { buffer, nombreArchivo } = await s.jurisprudencia.descargarPdf(detalle);
      const ruta = await s.archivos.rutaJurisprudencia(nombreArchivo);
      await s.archivos.escribir(ruta, buffer);
      setDetalle((prev) => ({ ...prev, rutaPdf: ruta }));
      setPdfBytes(buffer);
      avisar(`PDF guardado en disco: ${nombreArchivo}`);
      await s.archivos.abrir(ruta);
    } catch (err) {
      avisar(`No se pudo descargar el PDF: ${mensajeError(err)}`);
    } finally {
      setDescargandoPdf(false);
    }
  }

  async function guardarFichaActualizada(cambios: Partial<ResolucionJurisprudencia>) {
    const fusionado = { ...detalle, ...cambios };
    setDetalle(fusionado);
    if (detalle.guardadaLocal || detalle.idLocal) {
      await s.jurisprudencia.guardarEnBiblioteca(fusionado);
      alCambiarGuardado?.();
    }
  }

  // Título sin redundancias: "AS/1142/2026-F" sin anteponer "Auto Supremo" si ya lo contiene
  const nroLimpio = detalle.numeroResolucion?.trim() || '';
  const yaTienePrefijo = /^(AS\/|Auto\s+Supremo|SCP\s+|SC\s+|AC\s+)/i.test(nroLimpio);
  const tituloModal = yaTienePrefijo
    ? nroLimpio
    : `${detalle.tipoResolucion} ${nroLimpio}`.trim();

  const tituloCompleto = detalle.numeroExpediente
    ? `${tituloModal} · Exp. ${detalle.numeroExpediente}`
    : tituloModal;

  const tieneHtmlReal = Boolean(detalle.contenidoHtml && detalle.contenidoHtml.trim().length > 50);

  return (
    <Modal
      titulo={tituloCompleto}
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
              <Icono n="documento" tam={15} />{' '}
              {descargandoPdf ? 'Descargando...' : detalle.rutaPdf ? 'Abrir en Lector del Sistema' : 'Descargar PDF'}
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
        {/* Selector de Vistas: Visor PDF Oficial vs Ficha Jurisprudencial vs Texto Transcrito */}
        <div className="ficha-modal-tabs">
          <button
            type="button"
            className={`ficha-modal-tab-btn ${vista === 'pdf' ? 'activa' : ''}`}
            onClick={() => setVista('pdf')}
          >
            <Icono n="documento" tam={16} /> Visor PDF Oficial
            <Insignia tono="azul">Oficial</Insignia>
          </button>
          <button
            type="button"
            className={`ficha-modal-tab-btn ${vista === 'ficha' ? 'activa' : ''}`}
            onClick={() => setVista('ficha')}
          >
            <Icono n="documento" tam={16} /> Ficha Jurisprudencial
            {(detalle.fichas?.length ?? 0) > 0 && (
              <Insignia tono="gris">{detalle.fichas!.length}</Insignia>
            )}
          </button>
          {tieneHtmlReal && (
            <button
              type="button"
              className={`ficha-modal-tab-btn ${vista === 'texto' ? 'activa' : ''}`}
              onClick={() => setVista('texto')}
            >
              <Icono n="libro" tam={16} /> Texto Transcrito
            </button>
          )}
        </div>

        {error && <Aviso error={error} />}

        {cargando ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--texto-3)' }}>
            <p style={{ fontSize: '1.05rem', marginBottom: '8px' }}>Cargando resolución y metadatos oficiales...</p>
            <span style={{ fontSize: '0.85rem' }}>Consultando repositorio...</span>
          </div>
        ) : vista === 'pdf' ? (
          <div className="juris-modal-visor-pdf-container">
            {errorPdf && (
              <Aviso error={`No se pudo cargar el visor de PDF integrado: ${errorPdf}`} />
            )}
            {cargandoPdf && (
              <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--texto-2)' }}>
                <div className="juris-spinner" style={{ margin: '0 auto 12px' }} />
                <p>Cargando documento PDF oficial desde el repositorio...</p>
              </div>
            )}
            {pdfBytes && !cargandoPdf && (
              <div style={{ height: '64vh', display: 'flex', flexDirection: 'column' }}>
                <VisorPdf datos={pdfBytes} />
              </div>
            )}
          </div>
        ) : vista === 'ficha' ? (
          <FichaJurisprudencialCard
            resolucion={detalle}
            alGuardarFicha={guardarFichaActualizada}
            editable={true}
          />
        ) : (
          <div>
            {/* Cabecera con metadatos clave para texto transcrito */}
            <div className="juris-meta-box">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                <Insignia tono={detalle.origen === 'TSJ' ? 'ambar' : 'azul'}>
                  {detalle.origen === 'TSJ' ? 'TSJ' : 'TCP'}
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
                    <span className="juris-etiq">Demandante:</span> {detalle.demandante}
                  </div>
                )}
                {detalle.demandado && (
                  <div>
                    <span className="juris-etiq">Demandado:</span> {detalle.demandado}
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

            {detalle.contenidoHtml ? (
              <div
                className="juris-lector-html"
                dangerouslySetInnerHTML={{ __html: sanearContenidoHtml(detalle.contenidoHtml) }}
              />
            ) : (
              <div style={{ marginTop: '20px', padding: '24px', background: 'var(--superficie-2)', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ color: 'var(--texto-2)', marginBottom: '12px' }}>
                  Esta resolución fue digitalizada directamente como documento PDF oficial y no cuenta con transcripción HTML.
                </p>
                <button type="button" className="btn btn-pri" onClick={() => setVista('pdf')}>
                  <Icono n="documento" tam={16} /> Abrir en Visor PDF Integrado
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
