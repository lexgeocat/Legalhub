import { useState } from 'react';
import type { ResolucionJurisprudencia } from '../../domain/jurisprudencia/jurisprudencia';
import { Campo, Icono, Modal, avisar } from '../_core/comunes';
import { mensajeError, useCargar, useServicios } from '../_core/servicios';

interface Props {
  resolucion: ResolucionJurisprudencia;
  cerrar: () => void;
  alVincular?: () => void;
}

export function VincularExpedienteModal({ resolucion, cerrar, alVincular }: Props) {
  const s = useServicios();
  const lista = useCargar(() => s.consultas.listarExpedientes(), []);
  const [expedienteId, setExpedienteId] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  const expedientes = lista.datos ?? [];

  async function vincular() {
    if (!expedienteId) {
      avisar('Por favor selecciona un expediente', 'error');
      return;
    }
    setGuardando(true);
    try {
      await s.jurisprudencia.vincularAExpediente(resolucion, expedienteId, notas.trim() || undefined);
      avisar('Jurisprudencia vinculada exitosamente al expediente');
      alVincular?.();
      cerrar();
    } catch (err) {
      avisar(`No se pudo vincular la resolución al expediente: ${mensajeError(err)}`, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={`Vincular a Caso: ${resolucion.tipoResolucion} ${resolucion.numeroResolucion}`}
      cerrar={cerrar}
      ancho="media"
      pie={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
          <button type="button" className="btn btn-sec" onClick={cerrar}>
            Cancelar
          </button>
          <button type="button" className="btn btn-pri" onClick={vincular} disabled={guardando || !expedienteId}>
            <Icono n="ok" tam={15} /> {guardando ? 'Vinculando...' : 'Confirmar Vínculo'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ margin: 0, color: 'var(--texto-3)', fontSize: '0.9rem' }}>
          Asocia este precedente judicial a un caso activo de tu despacho para consultarlo o citarlo fácilmente desde el expediente.
        </p>

        <Campo etiqueta="Seleccionar Expediente *" ancho>
          <select
            value={expedienteId}
            onChange={(e) => setExpedienteId(e.target.value)}
            disabled={guardando}
          >
            <option value="">-- Elige un expediente --</option>
            {expedientes.map((exp) => (
              <option key={exp.id} value={exp.id}>
                {exp.codigo} · {exp.referencia || exp.clienteNombre || exp.tipo} ({exp.tipo})
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Notas o Justificación de Aplicación (Opcional)" ancho>
          <textarea
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej: Precedente clave para la contestación de demanda respecto a prescripción adquisitiva..."
            disabled={guardando}
          />
        </Campo>
      </div>
    </Modal>
  );
}
