import { useEffect, useState } from 'react';
import { hayCambiosPendientes, permitirSalir } from './comunes';

export function useControlVentana() {
  const [maximizada, setMaximizada] = useState(false);
  const esTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  useEffect(() => {
    if (!esTauri) return;
    let cancelado = false;

    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => {
        const appWindow = getCurrentWindow();
        appWindow
          .isMaximized()
          .then((m) => {
            if (!cancelado) setMaximizada(m);
          })
          .catch(() => {});

        const unlistenPromise = appWindow.onResized(() => {
          appWindow
            .isMaximized()
            .then((m) => {
              if (!cancelado) setMaximizada(m);
            })
            .catch(() => {});
        });

        return () => {
          cancelado = true;
          unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
        };
      })
      .catch(() => {});
  }, [esTauri]);

  const minimizar = async () => {
    if (!esTauri) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch (e) {
      console.warn('Error al minimizar:', e);
    }
  };

  const alternarMaximizar = async () => {
    if (!esTauri) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().toggleMaximize();
      const m = await getCurrentWindow().isMaximized();
      setMaximizada(m);
    } catch (e) {
      console.warn('Error al alternar maximizar:', e);
    }
  };

  const cerrar = async () => {
    if (!esTauri) return;
    try {
      if (hayCambiosPendientes() && !(await permitirSalir())) return;
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch (e) {
      console.warn('Error al cerrar ventana:', e);
    }
  };

  return { maximizada, minimizar, alternarMaximizar, cerrar, esTauri };
}

export function ControlesVentana({ variante = 'normal' }: { variante?: 'normal' | 'editor' | 'nav' }) {
  const { maximizada, minimizar, alternarMaximizar, cerrar } = useControlVentana();

  // Si no está en el entorno Tauri (ej. preview web), se muestran botones simulados accesibles
  return (
    <div className={`controles-ventana cv-${variante}`} data-tauri-drag-region="false">
      <button
        type="button"
        className="cv-btn cv-minimizar"
        onClick={() => void minimizar()}
        title="Minimizar"
        aria-label="Minimizar ventana"
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>

      <button
        type="button"
        className="cv-btn cv-maximizar"
        onClick={() => void alternarMaximizar()}
        title={maximizada ? 'Restaurar tamaño' : 'Maximizar'}
        aria-label={maximizada ? 'Restaurar ventana' : 'Maximizar ventana'}
      >
        {maximizada ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M3 2h5v5H3V2z"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
            <path
              d="M2 3.5V8h4.5"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect
              x="0.5"
              y="0.5"
              width="9"
              height="9"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        )}
      </button>

      <button
        type="button"
        className="cv-btn cv-cerrar"
        onClick={() => void cerrar()}
        title="Cerrar"
        aria-label="Cerrar ventana"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M1 1L9 9M9 1L1 9"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
