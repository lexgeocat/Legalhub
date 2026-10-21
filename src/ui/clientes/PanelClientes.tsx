import { useEffect, useMemo, useRef, useState } from 'react';
import { claveNormalizada } from '../../domain/comun/texto';
import { ETIQUETA_ESTADO, Icono, iniciales } from '../_core/comunes';
import { useCargar, useServicios } from '../_core/servicios';

interface PanelClientesProps {
  /** Expediente abierto ahora: se resalta y su cliente se despliega. */
  activo: string | null;
  abrir: (expedienteId: string) => void;
  ficha: (personaId: string) => void;
  colapsado?: boolean;
  onExpandirNav?: () => void;
  onTooltip?: (e: React.MouseEvent, texto: string) => void;
  onOcultarTooltip?: () => void;
}

/** Clientes asignados a los expedientes (barra lateral). Cada cliente se despliega con sus expedientes. */
export function PanelClientes({
  activo,
  abrir,
  ficha,
  colapsado = false,
  onExpandirNav,
  onTooltip,
  onOcultarTooltip,
}: PanelClientesProps) {
  const s = useServicios();
  const lista = useCargar(() => s.consultas.listarClientes(), []);
  const recargar = useRef(lista.recargar);
  const [q, setQ] = useState('');
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set());
  const [popoverAbierto, setPopoverAbierto] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const clientes = useMemo(() => lista.datos ?? [], [lista.datos]);

  useEffect(() => {
    recargar.current = lista.recargar;
  });

  // Se refresca solo cuando algo se guarda en la base (asignar cliente, editar una persona, crear o borrar expedientes…).
  useEffect(() => s.db.suscribir(() => recargar.current()), [s]);

  useEffect(() => {
    if (!activo) return;
    const c = clientes.find((x) => x.expedientes.some((e) => e.id === activo));
    if (c) setAbiertos((prev) => (prev.has(c.id) ? prev : new Set(prev).add(c.id)));
  }, [activo, clientes]);

  // Cierra el popover con clic afuera o con Escape
  useEffect(() => {
    if (!popoverAbierto) return;
    const clickAfuera = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverAbierto(false);
      }
    };
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverAbierto(false);
    };
    window.addEventListener('pointerdown', clickAfuera);
    window.addEventListener('keydown', teclado);
    return () => {
      window.removeEventListener('pointerdown', clickAfuera);
      window.removeEventListener('keydown', teclado);
    };
  }, [popoverAbierto]);

  const k = claveNormalizada(q.trim());
  const visibles = useMemo(
    () =>
      !k
        ? clientes
        : clientes.filter((c) =>
            claveNormalizada(
              `${c.nombre} ${c.documento} ${c.expedientes.map((e) => `${e.codigo} ${e.materia}`).join(' ')}`,
            ).includes(k),
          ),
    [clientes, k],
  );

  const alternar = (id: string) =>
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const alternarTodos = () => {
    if (abiertos.size >= visibles.length && visibles.length > 0) {
      setAbiertos(new Set());
    } else {
      setAbiertos(new Set(visibles.map((v) => v.id)));
    }
  };

  const seleccionarExpediente = (id: string) => {
    abrir(id);
    if (popoverAbierto) setPopoverAbierto(false);
  };

  const verFicha = (id: string) => {
    ficha(id);
    if (popoverAbierto) setPopoverAbierto(false);
  };

  // Renderizado del contenido de la lista de clientes (reutilizado en modo expandido y en el popover)
  const renderListaClientes = () => (
    <div className="nav-clientes-lista">
      {lista.error && <p className="nav-clientes-vacio">{lista.error}</p>}
      {!lista.error && lista.datos && clientes.length === 0 && (
        <p className="nav-clientes-vacio">Aquí aparecen los clientes asignados a tus expedientes.</p>
      )}
      {k !== '' && clientes.length > 0 && visibles.length === 0 && (
        <p className="nav-clientes-vacio">Sin resultados para «{q}».</p>
      )}

      {visibles.map((c) => {
        const abierto = k !== '' || abiertos.has(c.id);
        const tieneActivo = Boolean(activo && c.expedientes.some((e) => e.id === activo));
        return (
          <div key={c.id} className={`nav-cliente${tieneActivo ? ' tiene-activo' : ''}`}>
            <div className="nav-cliente-fila">
              <button
                type="button"
                className="nav-cliente-btn"
                aria-expanded={abierto}
                title={c.documento ? `${c.nombre} · ${c.documento}` : c.nombre}
                onClick={() => alternar(c.id)}
              >
                <span className="nav-cliente-chevron">
                  <Icono n={abierto ? 'chevronAbajo' : 'chevronDerecha'} tam={12} />
                </span>
                <span className="nav-avatar">{iniciales(c.nombre)}</span>
                <span className="nav-cliente-nombre">{c.nombre || 'Sin nombre'}</span>
                <span
                  className="nav-contador"
                  title={`${c.activos} activo(s) de ${c.expedientes.length} expediente(s)`}
                >
                  {c.expedientes.length}
                </span>
              </button>
              <button
                type="button"
                className="nav-cliente-ficha"
                aria-label={`Ficha de ${c.nombre}`}
                title="Ver ficha de persona"
                onClick={() => verFicha(c.id)}
              >
                <Icono n="editar" tam={14} />
              </button>
            </div>

            {abierto && (
              <div className="nav-cliente-exps">
                {c.expedientes.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    className={`nav-exp${x.id === activo ? ' activo' : ''}`}
                    title={`${x.codigo} · ${x.materia} (${ETIQUETA_ESTADO[x.estado] ?? x.estado})`}
                    onClick={() => seleccionarExpediente(x.id)}
                  >
                    <span className={`nav-punto e-${x.estado}`} />
                    <span className="nav-exp-cod">{x.codigo}</span>
                    <span className="nav-exp-txt">{x.materia}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  /* ===== VISTA EN MODO COLAPSADO (RAIL) ===== */
  if (colapsado) {
    return (
      <section className="nav-clientes colapsada" aria-label="Clientes">
        <div className="nav-clientes-colapsado">
          <button
            type="button"
            className={`nav-clientes-colapsado-btn${popoverAbierto ? ' activo' : ''}`}
            onClick={() => setPopoverAbierto((v) => !v)}
            onMouseEnter={(e) => onTooltip?.(e, `Clientes (${clientes.length})`)}
            onMouseLeave={onOcultarTooltip}
            aria-label={`Ver clientes (${clientes.length})`}
            title="Clientes"
          >
            <Icono n="personas" tam={18} />
            {clientes.length > 0 && <span className="nav-colapsado-badge">{clientes.length}</span>}
          </button>

          {clientes.length > 0 && (
            <div className="nav-clientes-colapsado-avatars">
              {clientes.slice(0, 3).map((c) => {
                const tieneActivo = activo && c.expedientes.some((e) => e.id === activo);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`nav-avatar-btn${tieneActivo ? ' activo' : ''}`}
                    onClick={() => {
                      if (c.expedientes[0]) seleccionarExpediente(c.expedientes[0].id);
                      else verFicha(c.id);
                    }}
                    onMouseEnter={(e) => onTooltip?.(e, `${c.nombre} (${c.expedientes.length} exp.)`)}
                    onMouseLeave={onOcultarTooltip}
                    aria-label={`Cliente ${c.nombre}`}
                  >
                    <span className="nav-avatar">{iniciales(c.nombre)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Popover flotante al hacer clic en clientes cuando la barra está colapsada */}
        {popoverAbierto && (
          <div className="nav-clientes-popover" ref={popoverRef} role="dialog" aria-label="Lista de clientes">
            <div className="nav-popover-cab">
              <Icono n="personas" tam={16} />
              <span>Clientes asignados</span>
              <span className="nav-contador">{clientes.length}</span>
              <div className="nav-popover-acciones">
                <button
                  type="button"
                  className="nav-popover-btn"
                  onClick={() => setPopoverAbierto(false)}
                  title="Cerrar (Esc)"
                  aria-label="Cerrar"
                >
                  <Icono n="cerrar" tam={14} />
                </button>
              </div>
            </div>

            {clientes.length > 3 && (
              <div className="nav-clientes-buscar-wrap">
                <Icono n="buscar" tam={14} />
                <input
                  className="nav-clientes-buscar"
                  type="search"
                  placeholder="Filtrar clientes o expedientes…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  autoFocus
                />
                {q && (
                  <button
                    type="button"
                    className="nav-buscar-limpiar"
                    onClick={() => setQ('')}
                    title="Limpiar búsqueda"
                  >
                    <Icono n="cerrar" tam={12} />
                  </button>
                )}
              </div>
            )}

            {renderListaClientes()}

            {onExpandirNav && (
              <div className="nav-popover-pie">
                <button
                  type="button"
                  className="nav-popover-expandir-btn"
                  onClick={() => {
                    setPopoverAbierto(false);
                    onExpandirNav();
                  }}
                >
                  <Icono n="panelExpandir" tam={14} />
                  <span>Expandir barra lateral</span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  /* ===== VISTA EN MODO EXPANDIDO ===== */
  return (
    <section className="nav-clientes" aria-label="Clientes">
      <div className="nav-clientes-cab">
        <Icono n="personas" tam={15} />
        <span>Clientes</span>
        <span className="nav-contador">{clientes.length}</span>
        {clientes.length > 1 && (
          <button
            type="button"
            className="nav-btn-accion-cab"
            onClick={alternarTodos}
            title={abiertos.size >= visibles.length && visibles.length > 0 ? 'Colapsar todos' : 'Desplegar todos'}
            aria-label="Alternar todos los clientes"
          >
            <Icono n={abiertos.size >= visibles.length && visibles.length > 0 ? 'chevronAbajo' : 'chevronDerecha'} tam={13} />
          </button>
        )}
      </div>

      {clientes.length > 3 && (
        <div className="nav-clientes-buscar-wrap">
          <Icono n="buscar" tam={14} />
          <input
            className="nav-clientes-buscar"
            type="search"
            placeholder="Filtrar clientes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              type="button"
              className="nav-buscar-limpiar"
              onClick={() => setQ('')}
              title="Limpiar búsqueda"
            >
              <Icono n="cerrar" tam={12} />
            </button>
          )}
        </div>
      )}

      {renderListaClientes()}
    </section>
  );
}