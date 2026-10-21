import { useEffect, useState } from 'react';
import { VERSION_APP } from './domain/comun/version';
import { Buscador } from './ui/compartidos/Buscador';
import { Icono, Notificaciones, avisar, permitirSalir, type NombreIcono } from './ui/_core/comunes';
import { FormularioPersona } from './ui/compartidos/FormularioPersona';
import { Configuracion } from './ui/paginas/Configuracion';
import { Expediente } from './ui/paginas/Expediente';
import { Expedientes } from './ui/paginas/Expedientes';
import { Modelos } from './ui/paginas/Modelos';
import { PanelClientes } from './ui/clientes/PanelClientes';
import { useCargar, useServicios } from './ui/_core/servicios';
import { Personas } from './ui/paginas/Personas';
import { Leyes } from './ui/paginas/Leyes';
import { Procedimientos } from './ui/paginas/Procedimientos';

type Item = 'expedientes' | 'personas' | 'modelos' | 'procedimientos' | 'leyes' | 'config';
type Vista = { n: Item } | { n: 'expediente'; id: string };

const MENU: { id: Item; etiqueta: string; icono: NombreIcono }[] = [
  { id: 'expedientes', etiqueta: 'Expedientes', icono: 'carpeta' },
  { id: 'personas', etiqueta: 'Personas', icono: 'personas' },
  { id: 'modelos', etiqueta: 'Modelos', icono: 'documento' },
  { id: 'procedimientos', etiqueta: 'Procedimientos', icono: 'flujo' },
  { id: 'leyes', etiqueta: 'Leyes', icono: 'libro' },
  { id: 'config', etiqueta: 'Configuración', icono: 'ajustes' },
];

/** Ficha de una persona abierta desde el buscador o desde el panel de clientes. */
function FichaPersona({ id, cerrar }: { id: string; cerrar: () => void }) {
  const s = useServicios();
  const lista = useCargar(() => s.consultas.listarPersonas(), []);
  if (!lista.datos) return null;
  return (
    <FormularioPersona
      id={id}
      personas={lista.datos}
      cerrar={cerrar}
      guardado={() => { cerrar(); avisar('Persona actualizada'); }}
    />
  );
}

export default function App() {
  const [vista, setVista] = useState<Vista>({ n: 'expedientes' });
  const [buscando, setBuscando] = useState(false);
  const [persona, setPersona] = useState<string | null>(null);
  const [colapsado, setColapsado] = useState<boolean>(() => {
    try {
      return localStorage.getItem('legalhub_panel_colapsado') === 'true';
    } catch {
      return false;
    }
  });
  const [tooltip, setTooltip] = useState<{ texto: string; top: number } | null>(null);

  const alternarColapso = () => {
    setColapsado((prev) => {
      const nuevo = !prev;
      try {
        localStorage.setItem('legalhub_panel_colapsado', String(nuevo));
      } catch {
        // ignore
      }
      return nuevo;
    });
    setTooltip(null);
  };

  const mostrarTooltip = (e: React.MouseEvent, texto: string) => {
    if (!colapsado) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ texto, top: rect.top + rect.height / 2 });
  };

  const ocultarTooltip = () => {
    setTooltip(null);
  };

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setBuscando(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        alternarColapso();
      }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  /** Toda navegación pasa por aquí: si hay datos sin guardar en un expediente, pregunta antes de salir. */
  async function navegar(destino: Vista) {
    if (destino.n === 'expediente' && vista.n === 'expediente' && vista.id === destino.id) return;
    if (!(await permitirSalir())) return;
    setVista(destino);
  }

  const ir = (n: Item) => void navegar({ n });
  const expedienteActivo = vista.n === 'expediente' ? vista.id : null;

  return (
    <div className={`app${colapsado ? ' nav-colapsado' : ''}`}>
      <nav className={`nav${colapsado ? ' colapsada' : ''}`} aria-label="Navegación principal">
        <div className={`nav-marca${colapsado ? ' colapsada' : ''}`}>
          {colapsado ? (
            <button
              type="button"
              className="nav-marca-logo-btn"
              onClick={alternarColapso}
              onMouseEnter={(e) => mostrarTooltip(e, 'LEGAL-HUB · Expandir panel (Ctrl+B)')}
              onMouseLeave={ocultarTooltip}
              aria-label="Expandir panel"
            >
              <span className="logo">
                <Icono n="balanza" tam={18} />
              </span>
            </button>
          ) : (
            <>
              <div className="nav-marca-info">
                <span className="logo" title="LEGAL-HUB">
                  <Icono n="balanza" tam={18} />
                </span>
                <span className="nav-marca-texto">LEGAL-HUB</span>
              </div>
              <button
                type="button"
                className="nav-btn-colapsar"
                onClick={alternarColapso}
                title="Colapsar panel (Ctrl+B)"
                aria-label="Colapsar panel"
              >
                <Icono n="chevronIzquierda" tam={15} />
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          className={`nav-buscar${colapsado ? ' colapsado' : ''}`}
          onClick={() => setBuscando(true)}
          onMouseEnter={(e) => mostrarTooltip(e, 'Buscar (Ctrl+K)')}
          onMouseLeave={ocultarTooltip}
          aria-label="Buscar"
          title={colapsado ? undefined : 'Buscar (Ctrl+K)'}
        >
          <Icono n="buscar" tam={16} />
          {!colapsado && (
            <>
              <span>Buscar</span>
              <kbd>Ctrl K</kbd>
            </>
          )}
        </button>

        {MENU.map((m) => {
          const activo = vista.n === m.id || (m.id === 'expedientes' && vista.n === 'expediente');
          return (
            <button
              key={m.id}
              type="button"
              className={`nav-item${activo ? ' activo' : ''}${colapsado ? ' colapsado' : ''}`}
              onClick={() => ir(m.id)}
              onMouseEnter={(e) => mostrarTooltip(e, m.etiqueta)}
              onMouseLeave={ocultarTooltip}
              aria-label={m.etiqueta}
            >
              <Icono n={m.icono} tam={18} />
              {!colapsado && <span className="nav-item-texto">{m.etiqueta}</span>}
            </button>
          );
        })}

        <PanelClientes
          activo={expedienteActivo}
          abrir={(id) => void navegar({ n: 'expediente', id })}
          ficha={setPersona}
          colapsado={colapsado}
          onExpandirNav={() => setColapsado(false)}
          onTooltip={mostrarTooltip}
          onOcultarTooltip={ocultarTooltip}
        />

        <div className={`nav-pie${colapsado ? ' colapsado' : ''}`}>
          {colapsado ? (
            <button
              type="button"
              className="nav-pie-colapsar colapsado"
              onClick={alternarColapso}
              onMouseEnter={(e) => mostrarTooltip(e, 'Expandir panel (Ctrl+B)')}
              onMouseLeave={ocultarTooltip}
              aria-label="Expandir panel"
              title="Expandir panel (Ctrl+B)"
            >
              <Icono n="chevronDerecha" tam={16} />
            </button>
          ) : (
            <>
              <span className="nav-pie-version" title={`Legal-Hub versión ${VERSION_APP}`}>
                v{VERSION_APP}
              </span>
              <button
                type="button"
                className="nav-pie-colapsar"
                onClick={alternarColapso}
                title="Colapsar panel (Ctrl+B)"
                aria-label="Colapsar panel"
              >
                <Icono n="chevronIzquierda" tam={13} />
                <span>Colapsar</span>
                <kbd>Ctrl B</kbd>
              </button>
            </>
          )}
        </div>
      </nav>

      {colapsado && tooltip && (
        <div className="nav-tooltip-flotante" style={{ top: tooltip.top }} role="tooltip">
          {tooltip.texto}
        </div>
      )}

      <main className="contenido">
        {vista.n === 'expedientes' && <Expedientes abrir={(id) => void navegar({ n: 'expediente', id })} />}
        {vista.n === 'expediente' && (
          <Expediente key={vista.id} id={vista.id} volver={() => void navegar({ n: 'expedientes' })} />
        )}
        {vista.n === 'personas' && <Personas abrirExpediente={(id) => void navegar({ n: 'expediente', id })} />}
        {vista.n === 'modelos' && <Modelos />}
        {vista.n === 'procedimientos' && <Procedimientos />}
        {vista.n === 'leyes' && <Leyes />}
        {vista.n === 'config' && <Configuracion />}
      </main>

      {buscando && (
        <Buscador
          cerrar={() => setBuscando(false)}
          elegir={(r) => {
            setBuscando(false);
            if (r.tipo === 'persona') setPersona(r.id);
            else if (r.expedienteId) void navegar({ n: 'expediente', id: r.expedienteId });
            else void navegar({ n: 'expedientes' });
          }}
        />
      )}
      {persona && <FichaPersona id={persona} cerrar={() => setPersona(null)} />}
      <Notificaciones />
    </div>
  );
}