import { useState } from 'react';
import type {
  FichaAnalisisJurisprudencial,
  ResolucionJurisprudencia,
} from '../../domain/jurisprudencia/jurisprudencia';
import {
  formatearCitaJurisprudencial,
  formatearFichaJurisprudencial,
} from '../../domain/jurisprudencia/jurisprudencia';
import { Icono, Insignia, avisar } from '../_core/comunes';

interface Props {
  resolucion: ResolucionJurisprudencia;
  alGuardarFicha?: (fichaActualizada: Partial<ResolucionJurisprudencia>) => Promise<void>;
  editable?: boolean;
}

export function FichaJurisprudencialCard({ resolucion, alGuardarFicha, editable }: Props) {
  const fichas = resolucion.fichas && resolucion.fichas.length > 0
    ? resolucion.fichas
    : [
        {
          maxima: resolucion.maxima,
          sintesis: resolucion.sintesis,
          ratioDecidendi: resolucion.ratioDecidendi,
          descriptor: resolucion.descriptor,
          restrictor: resolucion.restrictor,
          precedente: resolucion.precedente,
          tipoJurisprudencia: resolucion.tipoJurisprudencia,
          formaResolucion: resolucion.formaResolucion,
        },
      ];

  const [fichaActivaIdx, setFichaActivaIdx] = useState(0);
  const fichaActual: FichaAnalisisJurisprudencial = fichas[fichaActivaIdx] || fichas[0] || {};

  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Formulario de edición
  const [maxima, setMaxima] = useState(fichaActual.maxima || '');
  const [sintesis, setSintesis] = useState(fichaActual.sintesis || resolucion.resumen || '');
  const [ratio, setRatio] = useState(fichaActual.ratioDecidendi || '');
  const [descriptor, setDescriptor] = useState(fichaActual.descriptor || '');
  const [restrictor, setRestrictor] = useState(fichaActual.restrictor || '');
  const [precedente, setPrecedente] = useState(fichaActual.precedente || '');
  const [formaResolucion, setFormaResolucion] = useState(fichaActual.formaResolucion || resolucion.formaResolucion || '');
  const [tipoJurisprudencia, setTipoJurisprudencia] = useState(fichaActual.tipoJurisprudencia || resolucion.tipoJurisprudencia || '');

  async function copiarTexto(texto: string, mensaje: string) {
    if (!texto) {
      avisar('No hay contenido para copiar', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(texto);
      avisar(mensaje);
    } catch {
      avisar('No se pudo copiar al portapapeles', 'error');
    }
  }

  async function guardarCambios() {
    if (!alGuardarFicha) return;
    setGuardando(true);
    try {
      const fichaActualizada: FichaAnalisisJurisprudencial = {
        ...fichaActual,
        maxima: maxima.trim() || undefined,
        sintesis: sintesis.trim() || undefined,
        ratioDecidendi: ratio.trim() || undefined,
        descriptor: descriptor.trim() || undefined,
        restrictor: restrictor.trim() || undefined,
        precedente: precedente.trim() || undefined,
        formaResolucion: formaResolucion.trim() || undefined,
        tipoJurisprudencia: tipoJurisprudencia.trim() || undefined,
      };

      const nuevasFichas = [...fichas];
      nuevasFichas[fichaActivaIdx] = fichaActualizada;

      await alGuardarFicha({
        maxima: fichaActualizada.maxima,
        sintesis: fichaActualizada.sintesis,
        ratioDecidendi: fichaActualizada.ratioDecidendi,
        descriptor: fichaActualizada.descriptor,
        restrictor: fichaActualizada.restrictor,
        precedente: fichaActualizada.precedente,
        formaResolucion: fichaActualizada.formaResolucion,
        tipoJurisprudencia: fichaActualizada.tipoJurisprudencia,
        fichas: nuevasFichas,
      });

      setEditando(false);
      avisar('Ficha jurisprudencial actualizada');
    } catch {
      avisar('No se pudieron guardar los cambios en la ficha', 'error');
    } finally {
      setGuardando(false);
    }
  }

  const tieneDatosFicha = !!(
    fichaActual.maxima ||
    fichaActual.ratioDecidendi ||
    fichaActual.descriptor ||
    fichaActual.sintesis ||
    resolucion.maxima ||
    resolucion.ratioDecidendi
  );

  return (
    <div className="ficha-juris-contenedor">
      {/* Barra superior de herramientas y pestañas de tesis si hay múltiples */}
      <div className="ficha-juris-herramientas">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {fichas.length > 1 && (
            <div className="ficha-juris-tesis-selector">
              {fichas.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`btn btn-sm ${fichaActivaIdx === idx ? 'btn-pri' : 'btn-sec'}`}
                  onClick={() => {
                    setFichaActivaIdx(idx);
                    setEditando(false);
                  }}
                >
                  Tesis #{idx + 1}
                </button>
              ))}
            </div>
          )}

          {fichaActual.tipoJurisprudencia && (
            <Insignia tono="violeta">
              Línea: {fichaActual.tipoJurisprudencia}
            </Insignia>
          )}

          {(fichaActual.formaResolucion || resolucion.formaResolucion) && (
            <Insignia tono="verde">
              Forma: {fichaActual.formaResolucion || resolucion.formaResolucion}
            </Insignia>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sec btn-sm"
            onClick={() =>
              copiarTexto(
                formatearFichaJurisprudencial(resolucion, fichaActual),
                'Ficha jurisprudencial copiada al portapapeles'
              )
            }
            title="Copiar la ficha completa para pegar en memoriales o informes"
          >
            <Icono n="documento" tam={14} /> Copiar Ficha
          </button>

          {fichaActual.ratioDecidendi && (
            <button
              type="button"
              className="btn btn-sec btn-sm"
              onClick={() =>
                copiarTexto(fichaActual.ratioDecidendi!, 'Ratio decidendi copiada')
              }
              title="Copiar extracto de la ratio decidendi"
            >
              <Icono n="pluma" tam={14} /> Copiar Ratio
            </button>
          )}

          {fichaActual.maxima && (
            <button
              type="button"
              className="btn btn-sec btn-sm"
              onClick={() => copiarTexto(fichaActual.maxima!, 'Máxima jurídica copiada')}
              title="Copiar máxima jurisprudencial"
            >
              <Icono n="balanza" tam={14} /> Copiar Máxima
            </button>
          )}

          {editable && alGuardarFicha && !editando && (
            <button
              type="button"
              className="btn btn-sec btn-sm"
              onClick={() => {
                setMaxima(fichaActual.maxima || '');
                setSintesis(fichaActual.sintesis || resolucion.resumen || '');
                setRatio(fichaActual.ratioDecidendi || '');
                setDescriptor(fichaActual.descriptor || '');
                setRestrictor(fichaActual.restrictor || '');
                setPrecedente(fichaActual.precedente || '');
                setFormaResolucion(fichaActual.formaResolucion || resolucion.formaResolucion || '');
                setTipoJurisprudencia(fichaActual.tipoJurisprudencia || resolucion.tipoJurisprudencia || '');
                setEditando(true);
              }}
            >
              <Icono n="editar" tam={14} /> Editar Ficha
            </button>
          )}
        </div>
      </div>

      {editando ? (
        /* MODO DE EDICIÓN DE LA FICHA */
        <div className="ficha-juris-edicion">
          <h4 style={{ margin: '0 0 12px 0', color: 'var(--texto-1)' }}>
            Editar Ficha de Análisis Jurisprudencial
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label className="ficha-juris-label">Forma de Resolución</label>
              <input
                type="text"
                value={formaResolucion}
                onChange={(e) => setFormaResolucion(e.target.value)}
                placeholder="Ej: Legal, Procedente, Infundado..."
              />
            </div>
            <div>
              <label className="ficha-juris-label">Tipo de Jurisprudencia (Línea)</label>
              <input
                type="text"
                value={tipoJurisprudencia}
                onChange={(e) => setTipoJurisprudencia(e.target.value)}
                placeholder="Ej: Reiteradora, Fundadora, Modificadora..."
              />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label className="ficha-juris-label">Descriptor Temático</label>
            <input
              type="text"
              value={descriptor}
              onChange={(e) => setDescriptor(e.target.value)}
              placeholder="Ej: Derecho Civil / Derecho Procesal Civil / Recursos / Compulsa"
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label className="ficha-juris-label">Restrictor</label>
            <input
              type="text"
              value={restrictor}
              onChange={(e) => setRestrictor(e.target.value)}
              placeholder="Precisión delimitadora del caso concreto..."
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label className="ficha-juris-label">Máxima Jurisprudencial</label>
            <textarea
              rows={3}
              value={maxima}
              onChange={(e) => setMaxima(e.target.value)}
              placeholder="La regla jurídica o tesis central vinculante..."
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label className="ficha-juris-label">Extracto de la Ratio Decidendi</label>
            <textarea
              rows={4}
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              placeholder="Texto textual del razonamiento jurídico decisivo del tribunal..."
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label className="ficha-juris-label">Síntesis del Caso (Supuesto Fáctico)</label>
            <textarea
              rows={3}
              value={sintesis}
              onChange={(e) => setSintesis(e.target.value)}
              placeholder="Hechos y controversia procesal relevante..."
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="ficha-juris-label">Precedente / Norma Aplicada</label>
            <input
              type="text"
              value={precedente}
              onChange={(e) => setPrecedente(e.target.value)}
              placeholder="Leyes, artículos o sentencias precedentes aplicadas..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-sec"
              onClick={() => setEditando(false)}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-pri"
              onClick={guardarCambios}
              disabled={guardando}
            >
              <Icono n="ok" tam={14} /> {guardando ? 'Guardando...' : 'Guardar Ficha'}
            </button>
          </div>
        </div>
      ) : (
        /* MODO DE VISUALIZACIÓN ELEGANTE DE LA FICHA */
        <div className="ficha-juris-cuerpo">
          {/* Ficha Header: Datos de Identificación Formal */}
          <div className="ficha-juris-identificacion">
            <div className="ficha-juris-campo-meta">
              <span className="ficha-juris-meta-tit">SALA</span>
              <span className="ficha-juris-meta-val">{resolucion.sala || '—'}</span>
            </div>
            <div className="ficha-juris-campo-meta">
              <span className="ficha-juris-meta-tit">PROCESO / EXP.</span>
              <span className="ficha-juris-meta-val">
                {resolucion.proceso || resolucion.numeroExpediente || '—'}
              </span>
            </div>
            <div className="ficha-juris-campo-meta">
              <span className="ficha-juris-meta-tit">N° DE RESOLUCIÓN</span>
              <span className="ficha-juris-meta-val" style={{ fontWeight: 600, color: 'var(--primario)' }}>
                {resolucion.tipoResolucion} {resolucion.numeroResolucion}
              </span>
            </div>
            <div className="ficha-juris-campo-meta">
              <span className="ficha-juris-meta-tit">FECHA</span>
              <span className="ficha-juris-meta-val">{resolucion.fechaEmision || '—'}</span>
            </div>
          </div>

          {/* 1. DESCRIPTOR */}
          {fichaActual.descriptor && (
            <div className="ficha-juris-seccion">
              <div className="ficha-juris-seccion-header">
                <Icono n="carpeta" tam={15} />
                <span>DESCRIPTOR</span>
              </div>
              <div className="ficha-juris-descriptor-ruta">
                {fichaActual.descriptor.split('/').map((seg, i, arr) => (
                  <span key={i} className="ficha-juris-descriptor-seg">
                    {seg.trim()}
                    {i < arr.length - 1 && <span className="ficha-juris-descriptor-sep">/</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 2. RESTRICTOR */}
          {fichaActual.restrictor && (
            <div className="ficha-juris-seccion">
              <div className="ficha-juris-seccion-header">
                <Icono n="filtro" tam={15} />
                <span>RESTRICTOR</span>
              </div>
              <div className="ficha-juris-restrictor-caja">
                {fichaActual.restrictor}
              </div>
            </div>
          )}

          {/* 3. MÁXIMA JURISPRUDENCIAL */}
          {fichaActual.maxima ? (
            <div className="ficha-juris-seccion">
              <div className="ficha-juris-seccion-header">
                <Icono n="balanza" tam={15} />
                <span>MÁXIMA JURISPRUDENCIAL</span>
              </div>
              <div className="ficha-juris-maxima-caja">
                <p className="ficha-juris-maxima-texto">
                  {fichaActual.maxima}
                </p>
              </div>
            </div>
          ) : !tieneDatosFicha ? (
            <div className="ficha-juris-aviso-vacio">
              <p style={{ margin: 0, fontWeight: 500 }}>
                Esta resolución aún no cuenta con una ficha jurisprudencial indexada oficialmente.
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--texto-3)' }}>
                Puedes consultar el texto íntegro en la pestaña contigua o presionar «Editar Ficha» para estructurar tu propio análisis.
              </p>
            </div>
          ) : null}

          {/* 4. SÍNTESIS DEL CASO */}
          {(fichaActual.sintesis || resolucion.resumen) && (
            <div className="ficha-juris-seccion">
              <div className="ficha-juris-seccion-header">
                <Icono n="documento" tam={15} />
                <span>SÍNTESIS DEL CASO</span>
              </div>
              <div className="ficha-juris-sintesis-caja">
                {fichaActual.sintesis || resolucion.resumen}
              </div>
            </div>
          )}

          {/* 5. EXTRACTO DE LA RATIO DECIDENDI */}
          {fichaActual.ratioDecidendi && (
            <div className="ficha-juris-seccion">
              <div className="ficha-juris-seccion-header">
                <Icono n="pluma" tam={15} />
                <span>EXTRACTO DE LA RATIO DECIDENDI</span>
              </div>
              <blockquote className="ficha-juris-ratio-bloque">
                {fichaActual.ratioDecidendi}
              </blockquote>
            </div>
          )}

          {/* 6. PRECEDENTE / NORMA APLICADA */}
          {fichaActual.precedente && (
            <div className="ficha-juris-seccion">
              <div className="ficha-juris-seccion-header">
                <Icono n="libro" tam={15} />
                <span>PRECEDENTE / NORMA APLICADA</span>
              </div>
              <div className="ficha-juris-precedente-caja">
                {fichaActual.precedente}
              </div>
            </div>
          )}

          {/* Cita formal al pie */}
          <div className="ficha-juris-pie-cita">
            <span style={{ fontSize: '0.8rem', color: 'var(--texto-3)', fontWeight: 600 }}>
              CITA FORMAL RECOMENDADA:
            </span>
            <code className="ficha-juris-cita-codigo">
              {formatearCitaJurisprudencial(resolucion)}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
