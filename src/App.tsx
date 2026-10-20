import { useEffect, useState } from 'react';
import { VERSION_APP } from './domain/version';
import { Buscador } from './ui/Buscador';
import { Icono, Notificaciones, avisar, permitirSalir, type NombreIcono } from './ui/comunes';
import { FormularioPersona } from './ui/FormularioPersona';
import { Configuracion } from './ui/paginas/Configuracion';
import { Expediente } from './ui/paginas/Expediente';
import { Expedientes } from './ui/paginas/Expedientes';
import { Modelos } from './ui/paginas/Modelos';
import { PanelClientes } from './ui/PanelClientes';
import { useCargar, useServicios } from './ui/servicios';
import { Personas } from './ui/paginas/Personas';
import { Leyes } from './ui/paginas/Leyes';

type Item = 'expedientes' | 'personas' | 'modelos' | 'leyes' | 'config';
type Vista = { n: Item } | { n: 'expediente'; id: string };

const MENU: { id: Item; etiqueta: string; icono: NombreIcono }[] = [
  { id: 'expedientes', etiqueta: 'Expedientes', icono: 'carpeta' },
  { id: 'personas', etiqueta: 'Personas', icono: 'personas' },
  { id: 'modelos', etiqueta: 'Modelos', icono: 'documento' },
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

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setBuscando(true);
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
    <div className="app">
      <nav className="nav">
        <div className="nav-marca">
          <span className="logo"><Icono n="balanza" tam={18} /></span>
          LEGAL-HUB
        </div>
        <button type="button" className="nav-buscar" onClick={() => setBuscando(true)}>
          <Icono n="buscar" tam={16} /> Buscar <kbd>Ctrl K</kbd>
        </button>
        {MENU.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`nav-item${vista.n === m.id || (m.id === 'expedientes' && vista.n === 'expediente') ? ' activo' : ''}`}
            onClick={() => ir(m.id)}
          >
            <Icono n={m.icono} /> {m.etiqueta}
          </button>
        ))}

        <PanelClientes
          activo={expedienteActivo}
          abrir={(id) => void navegar({ n: 'expediente', id })}
          ficha={setPersona}
        />

        <div className="nav-pie">Versión {VERSION_APP}</div>
      </nav>

      <main className="contenido">
        {vista.n === 'expedientes' && <Expedientes abrir={(id) => void navegar({ n: 'expediente', id })} />}
        {vista.n === 'expediente' && (
          <Expediente key={vista.id} id={vista.id} volver={() => void navegar({ n: 'expedientes' })} />
        )}
        {vista.n === 'personas' && <Personas abrirExpediente={(id) => void navegar({ n: 'expediente', id })} />}
        {vista.n === 'modelos' && <Modelos />}
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