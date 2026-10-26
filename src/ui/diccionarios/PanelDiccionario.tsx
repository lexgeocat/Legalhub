import { useState } from 'react';
import { formatearCitaDiccionario } from '../../domain/diccionarios/diccionarios';
import { Aviso, Icono, Insignia, avisar, copiarTexto } from '../_core/comunes';
import { useCargar, useServicios } from '../_core/servicios';
import { consultaValidaDiccionario, useBuscarDiccionarios } from './useBuscarDiccionarios';
import './diccionarios.css';

type Insertar = (texto: string, bloque: boolean) => void;

/** Evita que el botón le quite el foco al cursor del editor. */
const quieto = (e: { preventDefault(): void }) => e.preventDefault();

export function PanelDiccionario({ onInsertar }: { onInsertar: Insertar }) {
  const s = useServicios();
  const listaDiccionarios = useCargar(() => s.diccionarios.listar(), []);
  const [diccId, setDiccId] = useState('');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string | null>(null);

  const busqueda = useBuscarDiccionarios(q, diccId || undefined, 30);
  const diccionarios = listaDiccionarios.datos ?? [];

  const terminoSeleccionado = busqueda.res.find((r) => r.id === selId) || null;

  function insertarSoloDefinicion(r: typeof terminoSeleccionado) {
    if (!r) return;
    onInsertar(r.definicion, false);
    avisar('Definición insertada en el cursor');
  }

  function insertarCitaCompleta(r: typeof terminoSeleccionado) {
    if (!r) return;
    const cita = formatearCitaDiccionario(
      r.termino,
      r.definicion,
      r.diccionarioNombre,
      r.diccionarioAutor,
      r.pagina
    );
    onInsertar(cita, false);
    avisar('Cita doctrinal insertada en el cursor');
  }

  async function copiarCita(r: typeof terminoSeleccionado) {
    if (!r) return;
    const cita = formatearCitaDiccionario(
      r.termino,
      r.definicion,
      r.diccionarioNombre,
      r.diccionarioAutor,
      r.pagina
    );
    const ok = await copiarTexto(cita);
    if (ok) avisar('Cita copiada al portapapeles');
    else avisar('Error al copiar', 'error');
  }

  return (
    <div className="panel-dicc">
      <Aviso error={busqueda.error ?? listaDiccionarios.error} />

      {listaDiccionarios.datos && diccionarios.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--texto-3)' }}>
          <p style={{ margin: '0 0 8px 0' }}>Aún no hay diccionarios jurídicos cargados.</p>
          <span style={{ fontSize: '0.82rem' }}>
            Ve a «Diccionarios» o a «Configuración» para cargar tus PDFs (Cabanellas, Ossorio, etc.).
          </span>
        </div>
      ) : (
        <div className="panel-dicc-form">
          <select
            aria-label="Seleccionar Diccionario"
            value={diccId}
            onChange={(e) => {
              setDiccId(e.target.value);
              setSelId(null);
            }}
          >
            <option value="">Todos los diccionarios ({diccionarios.length})</option>
            {diccionarios.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre} {d.autor ? `(${d.autor})` : ''}
              </option>
            ))}
          </select>

          <input
            type="search"
            aria-label="Buscar término jurídico"
            placeholder="Buscar término: prescripción, dolo, usucapión…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {!consultaValidaDiccionario(q) && (
            <p className="pc-nota" style={{ margin: 0 }}>
              Escribe al menos 2 letras para buscar términos o conceptos.
            </p>
          )}
        </div>
      )}

      {busqueda.cargando && (
        <div style={{ padding: '8px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--texto-3)' }}>
          Buscando en diccionarios jurídicos...
        </div>
      )}

      {consultaValidaDiccionario(q) && !busqueda.cargando && busqueda.res.length === 0 && (
        <p className="pc-nota">Sin resultados coincidentes con «{q}».</p>
      )}

      {busqueda.res.length > 0 && (
        <div className="panel-dicc-lista">
          {busqueda.res.map((r) => {
            const estaSel = r.id === selId;
            return (
              <div key={r.id} className={`panel-dicc-card ${estaSel ? 'sel' : ''}`}>
                <div
                  role="button"
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelId(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setSelId(r.id);
                  }}
                >
                  <div className="panel-dicc-card-cab">
                    <span className="panel-dicc-card-titulo">{r.termino}</span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <Insignia tono="azul">{r.diccionarioNombre.slice(0, 15)}</Insignia>
                      <span className="suave" style={{ fontSize: '0.74rem' }}>
                        pág. {r.pagina}
                      </span>
                    </div>
                  </div>
                  <div className="panel-dicc-card-desc">{r.extracto}</div>
                </div>

                <div className="panel-dicc-acciones">
                  <button
                    type="button"
                    className="btn btn-fan btn-sm"
                    title="Copiar cita al portapapeles"
                    onMouseDown={quieto}
                    onClick={() => void copiarCita(r)}
                  >
                    <Icono n="documento" tam={13} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sec btn-sm"
                    title="Insertar texto de la definición"
                    onMouseDown={quieto}
                    onClick={() => insertarSoloDefinicion(r)}
                  >
                    Insertar
                  </button>
                  <button
                    type="button"
                    className="btn btn-pri btn-sm"
                    title="Insertar definición con cita doctrinal formal"
                    onMouseDown={quieto}
                    onClick={() => insertarCitaCompleta(r)}
                  >
                    Citar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
