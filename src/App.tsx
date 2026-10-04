import { useEffect, useState } from 'react';
import { Buscador } from './ui/Buscador';
import { Configuracion } from './ui/paginas/Configuracion';
import { Expediente } from './ui/paginas/Expediente';
import { Expedientes } from './ui/paginas/Expedientes';
import { Modelos } from './ui/paginas/Modelos';
import { Personas } from './ui/paginas/Personas';

type Simple = 'expedientes' | 'personas' | 'modelos' | 'config';
type Vista = { n: Simple } | { n: 'expediente'; id: string };

const MENU: [Simple, string][] = [
  ['expedientes', 'Expedientes'], ['personas', 'Personas'], ['modelos', 'Modelos'], ['config', 'Configuración'],
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

  return (
    <div className="app">
      <nav>
        <h1>LEGAL-HUB</h1>
        <button onClick={() => setBuscando(true)}>Buscar (Ctrl+K)</button>
        {MENU.map(([n, etiqueta]) => (
          <button
            key={n}
            className={vista.n === n || (n === 'expedientes' && vista.n === 'expediente') ? 'activo' : ''}
            onClick={() => setVista({ n })}
          >
            {etiqueta}
          </button>
        ))}
      </nav>
      <main>
        {vista.n === 'expedientes' && <Expedientes abrir={(id) => setVista({ n: 'expediente', id })} />}
        {vista.n === 'expediente' && <Expediente id={vista.id} volver={() => setVista({ n: 'expedientes' })} />}
        {vista.n === 'personas' && <Personas />}
        {vista.n === 'modelos' && <Modelos />}
        {vista.n === 'config' && <Configuracion />}
      </main>
      {buscando && (
        <Buscador
          cerrar={() => setBuscando(false)}
          elegir={(r) => {
            setBuscando(false);
            if (r.expedienteId) setVista({ n: 'expediente', id: r.expedienteId });
            else setVista({ n: r.tipo === 'persona' ? 'personas' : 'expedientes' });
          }}
        />
      )}
    </div>
  );
}