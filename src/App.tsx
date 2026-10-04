import { useEffect, useState } from 'react';
import { VERSION_APP } from './domain/version';
import { Buscador } from './ui/Buscador';
import { Icono, Notificaciones, type NombreIcono } from './ui/comunes';
import { Configuracion } from './ui/paginas/Configuracion';
import { Expediente } from './ui/paginas/Expediente';
import { Expedientes } from './ui/paginas/Expedientes';
import { Modelos } from './ui/paginas/Modelos';
import { Personas } from './ui/paginas/Personas';

type Item = 'expedientes' | 'personas' | 'modelos' | 'config';
type Vista =
  | { n: 'expedientes' | 'modelos' | 'config' }
  | { n: 'expediente'; id: string }
  | { n: 'personas'; id?: string };

const MENU: { id: Item; etiqueta: string; icono: NombreIcono }[] = [
  { id: 'expedientes', etiqueta: 'Expedientes', icono: 'carpeta' },
  { id: 'personas', etiqueta: 'Personas', icono: 'personas' },
  { id: 'modelos', etiqueta: 'Modelos', icono: 'documento' },
  { id: 'config', etiqueta: 'Configuración', icono: 'ajustes' },
];

export default function App() {
  const [vista, setVista] = useState<Vista>({ n: 'expedientes' });
  const [buscando, setBuscando] = useState(false);

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

  const ir = (n: Item) => setVista(n === 'personas' ? { n: 'personas' } : { n });

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
        {vista.n === 'expedientes' && (
          <Expedientes abrir={(id) => setVista({ n: 'expediente', id })} irPersonas={() => setVista({ n: 'personas' })} />
        )}
        {vista.n === 'expediente' && <Expediente key={vista.id} id={vista.id} volver={() => setVista({ n: 'expedientes' })} />}
        {vista.n === 'personas' && <Personas key={vista.id ?? 'lista'} inicial={vista.id} />}
        {vista.n === 'modelos' && <Modelos />}
        {vista.n === 'config' && <Configuracion />}
      </main>

      {buscando && (
        <Buscador
          cerrar={() => setBuscando(false)}
          elegir={(r) => {
            setBuscando(false);
            if (r.tipo === 'persona') setVista({ n: 'personas', id: r.id });
            else if (r.expedienteId) setVista({ n: 'expediente', id: r.expedienteId });
            else setVista({ n: 'expedientes' });
          }}
        />
      )}
      <Notificaciones />
    </div>
  );
}