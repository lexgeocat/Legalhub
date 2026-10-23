// src/ui/lexai/ModalGuardarEnExpediente.tsx
import { useState } from 'react';
import type { ExpedienteResumen } from '../../application/consultas';
import { Modal, avisar } from '../_core/comunes';
import { useCargar, useServicios } from '../_core/servicios';
import { construirDocx } from './escrito';

interface Props {
  texto: string;
  cerrar: () => void;
  alGuardar?: (expedienteId: string, titulo: string) => void;
}

export function ModalGuardarEnExpediente({ texto, cerrar, alGuardar }: Props) {
  const s = useServicios();
  const expedientes = useCargar(() => s.consultas.listarExpedientes(), []);
  const [expedienteId, setExpedienteId] = useState<string>('');
  const [titulo, setTitulo] = useState<string>('Escrito Jurídico');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!expedienteId) {
      avisar('Selecciona un expediente de destino', 'info');
      return;
    }
    if (!titulo.trim()) {
      avisar('Ingresa un título para el documento', 'info');
      return;
    }

    setGuardando(true);
    try {
      const docx = construirDocx(s.generador, texto);
      await s.guardarEscritoIa.ejecutar(expedienteId, titulo.trim(), docx);
      avisar('Documento guardado como nueva versión en el expediente');
      alGuardar?.(expedienteId, titulo.trim());
      cerrar();
    } catch (err) {
      avisar(`Error al guardar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const lista: ExpedienteResumen[] = expedientes.datos ?? [];

  return (
    <Modal titulo="Guardar Escrito en Expediente" cerrar={cerrar}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-2)', lineHeight: 1.5 }}>
          Se compilará el documento en formato <b>Word (.docx)</b> y se registrará como una nueva versión
          dentro de la carpeta documental del expediente seleccionado.
        </p>

        <div className="lexai-campo-fila">
          <label>Expediente de destino</label>
          <select
            value={expedienteId}
            onChange={(e) => setExpedienteId(e.target.value)}
            disabled={guardando || expedientes.datos === null}
          >
            <option value="">-- Elige un expediente --</option>
            {lista.map((exp) => (
              <option key={exp.id} value={exp.id}>
                {exp.codigo} · {exp.referencia || exp.clienteNombre || exp.materia || 'Sin referencia'}
              </option>
            ))}
          </select>
        </div>

        <div className="lexai-campo-fila">
          <label>Título del Documento</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Demanda Ejecutiva por Pagaré"
            disabled={guardando}
          />
        </div>

        <div className="acciones" style={{ marginTop: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-sec" onClick={cerrar} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-pri"
            onClick={guardar}
            disabled={guardando || !expedienteId || !titulo.trim()}
          >
            {guardando ? 'Guardando en expediente...' : 'Guardar versión (.docx)'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
