import { useEffect, useState } from 'react';
import { VERSION_APP } from './domain/version';
import { Buscador } from './ui/Buscador';
import { Icono, Notificaciones, avisar, type NombreIcono } from './ui/comunes';
import { FormularioPersona } from './ui/FormularioPersona';
import { Configuracion } from './ui/paginas/Configuracion';
import { Expediente } from './ui/paginas/Expediente';
import { Expedientes } from './ui/paginas/Expedientes';
import { Modelos } from './ui/paginas/Modelos';
import { useCargar, useServicios } from './ui/servicios';

type Item = 'expedientes' | 'modelos' | 'config';
type Vista = { n: Item } | { n: 'expediente'; id: string };

const MENU: { id: Item; etiqueta: string; icono: NombreIcono }[] = [
  { id: 'expedientes', etiqueta: 'Expedientes', icono: 'carpeta' },
  { id: 'modelos', etiqueta: 'Modelos', icono: 'documento' },
  { id: 'config', etiqueta: 'Configuración', icono: 'ajustes' },
];

/** Ficha de una persona abierta desde el buscador (ya no hay página «Personas»). */
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

  const ir = (n: Item) => setVista({ n });

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
        <div className="nav-pie">Versión {VERSION_APP}</div>
      </nav>

      <main className="contenido">
        {vista.n === 'expedientes' && <Expedientes abrir={(id) => setVista({ n: 'expediente', id })} />}
        {vista.n === 'expediente' && <Expediente key={vista.id} id={vista.id} volver={() => setVista({ n: 'expedientes' })} />}
        {vista.n === 'modelos' && <Modelos />}
        {vista.n === 'config' && <Configuracion />}
      </main>

      {buscando && (
        <Buscador
          cerrar={() => setBuscando(false)}
          elegir={(r) => {
            setBuscando(false);
            if (r.tipo === 'persona') setPersona(r.id);
            else if (r.expedienteId) setVista({ n: 'expediente', id: r.expedienteId });
            else setVista({ n: 'expedientes' });
          }}
        />
      )}
      {persona && <FichaPersona id={persona} cerrar={() => setPersona(null)} />}
      <Notificaciones />
    </div>
  );
}