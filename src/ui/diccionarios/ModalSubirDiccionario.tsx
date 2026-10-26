import { useState, type FormEvent } from 'react';
import { Aviso, Campo, Icono, Modal, avisar } from '../_core/comunes';
import { mensajeError, useServicios } from '../_core/servicios';

interface Props {
  cerrar: () => void;
  alImportar?: () => void;
  alGuardar?: () => void;
}

export function ModalSubirDiccionario({ cerrar, alImportar, alGuardar }: Props) {
  const s = useServicios();
  const [nombre, setNombre] = useState('');
  const [autor, setAutor] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!archivo) {
      setError('Debes seleccionar un archivo PDF');
      return;
    }
    if (!nombre.trim()) {
      setError('Indica el nombre de la obra o diccionario');
      return;
    }

    setCargando(true);
    setError(null);
    try {
      const buffer = new Uint8Array(await archivo.arrayBuffer());
      const res = await s.diccionarios.importar(buffer, {
        nombre: nombre.trim(),
        autor: autor.trim() || undefined,
        descripcion: descripcion.trim() || undefined,
      });

      avisar(
        `Diccionario importado: ${res.numPaginas} páginas y ${res.numTerminos} términos indexados.`
      );
      alImportar?.();
      alGuardar?.();
      cerrar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  function alSeleccionarArchivo(f: File | null) {
    setArchivo(f);
    if (f && !nombre) {
      // Auto-rellenar nombre legible a partir del archivo
      const limpio = f.name
        .replace(/\.pdf$/i, '')
        .replace(/[-_]/g, ' ')
        .trim();
      setNombre(limpio.charAt(0).toUpperCase() + limpio.slice(1));
    }
  }

  return (
    <Modal
      titulo="Subir Diccionario Jurídico (PDF)"
      cerrar={cerrar}
      ancho="media"
      pie={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
          <button type="button" className="btn btn-sec" onClick={cerrar} disabled={cargando}>
            Cancelar
          </button>
          <button type="submit" form="form-subir-dicc" className="btn btn-pri" disabled={cargando || !archivo}>
            <Icono n="mas" tam={15} /> {cargando ? 'Analizando e indexando PDF...' : 'Subir e Indexar'}
          </button>
        </div>
      }
    >
      <form id="form-subir-dicc" onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {error && <Aviso error={error} />}

        <Campo etiqueta="Archivo PDF del Diccionario *">
          <input
            type="file"
            accept=".pdf"
            disabled={cargando}
            onChange={(e) => alSeleccionarArchivo(e.target.files?.[0] || null)}
          />
        </Campo>

        <Campo etiqueta="Nombre de la Obra o Diccionario *">
          <input
            type="text"
            placeholder="Ej: Diccionario Jurídico Elemental, Diccionario de Ciencias Jurídicas..."
            value={nombre}
            disabled={cargando}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Autor / Editorial / Institución (Opcional)">
          <input
            type="text"
            placeholder="Ej: Guillermo Cabanellas de Torres, Manuel Ossorio, Min. de Justicia..."
            value={autor}
            disabled={cargando}
            onChange={(e) => setAutor(e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Descripción o Área Temática (Opcional)">
          <textarea
            rows={2}
            placeholder="Ej: Derecho civil, penal, procesal, constitucional y laboral..."
            value={descripcion}
            disabled={cargando}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </Campo>

        {cargando && (
          <div style={{ padding: '16px', background: 'var(--superficie-2)', borderRadius: '6px', textAlign: 'center' }}>
            <div className="juris-spinner" style={{ margin: '0 auto 10px' }} />
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--texto)' }}>
              Extrayendo texto, detectando lemas jurídicos e indexando en base de datos FTS5...
            </p>
            <span style={{ fontSize: '0.78rem', color: 'var(--texto-3)' }}>
              Esto puede tomar unos segundos según el número de páginas.
            </span>
          </div>
        )}
      </form>
    </Modal>
  );
}
