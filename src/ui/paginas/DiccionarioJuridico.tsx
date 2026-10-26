import { useEffect, useMemo, useState } from 'react';
import type { Diccionario, ResultadoBusquedaDiccionario, TerminoDiccionario } from '../../domain/diccionarios/diccionarios';
import {
  formatearCitaDiccionario,
  sanearTextoDefinicion,
} from '../../domain/diccionarios/diccionarios';
import { Aviso, Icono, Insignia, Vacio, avisar, copiarTexto } from '../_core/comunes';
import { mensajeError, useCargar, useServicios } from '../_core/servicios';
import { ModalSubirDiccionario } from '../diccionarios/ModalSubirDiccionario';
import { useBuscarDiccionarios } from '../diccionarios/useBuscarDiccionarios';
import '../diccionarios/diccionarios.css';

const SUGERENCIAS = [
  'A beneficio de inventario',
  'Usucapión',
  'Dolo',
  'Prescripción',
  'Acción reivindicatoria',
  'Fuerza mayor',
  'Amojonamiento',
  'Violencia económica',
];

export function DiccionarioJuridico() {
  const s = useServicios();
  const listaDiccionarios = useCargar(() => s.diccionarios.listar(), []);
  const [diccId, setDiccId] = useState<string>('');
  const [q, setQ] = useState('');
  const [modalSubir, setModalSubir] = useState(false);
  const [importandoPredeterminados, setImportandoPredeterminados] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);

  const diccionarios = listaDiccionarios.datos ?? [];

  // Diccionario actualmente seleccionado en el filtro
  const diccionarioActivo = useMemo<Diccionario | null>(() => {
    if (diccId) {
      return diccionarios.find((d) => d.id === diccId) || null;
    }
    return diccionarios.length > 0 ? diccionarios[0] : null;
  }, [diccId, diccionarios]);

  // Búsqueda reactiva centrada exclusivamente en términos
  const busqueda = useBuscarDiccionarios(q, diccId || undefined, 50);

  // Lista de términos por defecto (cuando no hay consulta de búsqueda)
  const [terminosDefecto, setTerminosDefecto] = useState<TerminoDiccionario[]>([]);
  const [cargandoDefecto, setCargandoDefecto] = useState(false);

  useEffect(() => {
    let montado = true;
    if (q.trim() !== '' || !diccionarioActivo) {
      setTerminosDefecto([]);
      return;
    }

    setCargandoDefecto(true);
    s.diccionarios
      .listarTerminos(diccionarioActivo.id, 1, 80)
      .then((res) => {
        if (montado) {
          setTerminosDefecto(res.items);
          setCargandoDefecto(false);
        }
      })
      .catch(() => {
        if (montado) setCargandoDefecto(false);
      });

    return () => {
      montado = false;
    };
  }, [q, diccionarioActivo, s.diccionarios]);

  // ID del término seleccionado por el usuario
  const [idSeleccionado, setIdSeleccionado] = useState<string | null>(null);

  // Al cambiar la consulta de búsqueda o el diccionario seleccionado, reiniciar la selección explícita
  useEffect(() => {
    setIdSeleccionado(null);
  }, [q, diccId]);

  const itemsMostrados: (ResultadoBusquedaDiccionario | TerminoDiccionario)[] =
    q.trim() !== '' ? busqueda.res : terminosDefecto;

  // Término actualmente seleccionado para lectura
  const terminoSeleccionado = useMemo(() => {
    if (itemsMostrados.length === 0) return null;
    const encontrado = idSeleccionado ? itemsMostrados.find((it) => it.id === idSeleccionado) : null;
    const item = encontrado || itemsMostrados[0];
    const dictNombre =
      'diccionarioNombre' in item
        ? item.diccionarioNombre
        : diccionarioActivo?.nombre || 'Diccionario';
    const dictAutor =
      'diccionarioAutor' in item
        ? item.diccionarioAutor
        : diccionarioActivo?.autor;

    return {
      id: item.id,
      termino: item.termino,
      definicion: item.definicion,
      pagina: item.pagina,
      diccionarioId: item.diccionarioId,
      diccionarioNombre: dictNombre,
      diccionarioAutor: dictAutor,
    };
  }, [itemsMostrados, idSeleccionado, diccionarioActivo]);


  async function copiarDefinicion() {
    if (!terminoSeleccionado) return;
    const ok = await copiarTexto(terminoSeleccionado.definicion);
    if (ok) avisar('Definición copiada al portapapeles');
    else avisar('Error al copiar', 'error');
  }

  async function copiarCitaCompleta() {
    if (!terminoSeleccionado) return;
    const cita = formatearCitaDiccionario(
      terminoSeleccionado.termino,
      terminoSeleccionado.definicion,
      terminoSeleccionado.diccionarioNombre,
      terminoSeleccionado.diccionarioAutor,
      terminoSeleccionado.pagina
    );
    const ok = await copiarTexto(cita);
    if (ok) avisar('Cita doctrinal formal copiada al portapapeles');
    else avisar('Error al copiar', 'error');
  }

  async function importarColeccionBase() {
    setImportandoPredeterminados(true);
    setErrorGlobal(null);
    try {
      // Los 3 diccionarios esenciales en F:/Apps_web/legal-hub/diccionarios
      const coleccion = [
        {
          archivo: 'DICCIONARIO JURIDICO ELEMENTAL - Guillermo Cabanellas de Torres.pdf',
          nombre: 'Diccionario Jurídico Elemental',
          autor: 'Guillermo Cabanellas de Torres',
          descripcion: 'Definiciones esenciales de derecho civil, penal, laboral, procesal y constitucional.',
        },
        {
          archivo: 'DICCIONARIO JURIDICO_MANUEL OSORIO.pdf',
          nombre: 'Diccionario de Ciencias Jurídicas, Políticas y Sociales',
          autor: 'Manuel Ossorio',
          descripcion: 'Compendio doctrinal latinoamericano de conceptos jurídicos y procesales.',
        },
        {
          archivo: 'GLOSARIO DE TÉRMINOS PARA LA IMPLEMENTACIÓN DE LA LEY INTEGRAL PARA GARANTIZAR A LAS MUJERES UNA VIDA LIBRE DE VIOLENCIA.pdf',
          nombre: 'Glosario de Términos - Ley 348',
          autor: 'Ministerio de Justicia del Estado Plurinacional de Bolivia',
          descripcion: 'Definiciones técnico-jurídicas para la aplicación de la Ley 348.',
        },
      ];

      let importados = 0;
      for (const item of coleccion) {
        try {
          const ruta = `F:/Apps_web/legal-hub/diccionarios/${item.archivo}`;
          const bytes = await s.archivos.leer(ruta);
          await s.diccionarios.importar(bytes, {
            nombre: item.nombre,
            autor: item.autor,
            descripcion: item.descripcion,
          });
          importados++;
        } catch {
          // Omitir si ya existía o error individual
        }
      }

      listaDiccionarios.recargar();
      avisar(`Se importaron ${importados} diccionarios jurídicos a la base.`);
    } catch (err) {
      setErrorGlobal(`Error al importar: ${mensajeError(err)}`);
    } finally {
      setImportandoPredeterminados(false);
    }
  }

  return (
    <div className="dicc-pagina">
      {/* Cabecera Principal */}
      <div className="dicc-cabecera">
        <div className="dicc-cabecera-izq">
          <h1>Diccionario Jurídico</h1>
          <p className="dicc-subtitulo">
            Consulta doctrinal rápida de conceptos, términos y definiciones esenciales con citas listas para memoriales.
          </p>
        </div>

        <div className="dicc-acciones-top">
          {diccionarios.length === 0 && (
            <button
              type="button"
              className="btn btn-sec btn-sm"
              onClick={importarColeccionBase}
              disabled={importandoPredeterminados}
              title="Importar automáticamente los 3 diccionarios esenciales de la carpeta diccionarios"
            >
              <Icono n="libro" tam={14} />
              {importandoPredeterminados ? 'Importando obras...' : 'Cargar 3 Obras Esenciales'}
            </button>
          )}

          <button
            type="button"
            className="btn btn-pri btn-sm"
            onClick={() => setModalSubir(true)}
            title="Subir un nuevo archivo PDF doctrinal para indexar sus términos"
          >
            <Icono n="mas" tam={14} />
            Subir Diccionario…
          </button>
        </div>
      </div>

      <Aviso error={errorGlobal ?? listaDiccionarios.error ?? busqueda.error} />

      {/* Barra de Filtros y Búsqueda */}
      <div className="dicc-barra-filtros">
        <select
          aria-label="Seleccionar Obra o Diccionario"
          className="dicc-select-obra"
          value={diccId}
          onChange={(e) => {
            setDiccId(e.target.value);
            setIdSeleccionado(null);
          }}
        >
          <option value="">Todas las obras ({diccionarios.length})</option>
          {diccionarios.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre} {d.autor ? `(${d.autor})` : ''}
            </option>
          ))}
        </select>

        <div className="dicc-buscador-wrapper">
          <div className="dicc-buscador-icono">
            <Icono n="buscar" tam={16} />
          </div>
          <input
            type="search"
            aria-label="Buscar término jurídico"
            className="dicc-input-buscar"
            placeholder="Buscar término jurídico: «A beneficio de inventario», «Usucapión», «Dolo»…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              type="button"
              className="dicc-btn-limpiar"
              onClick={() => setQ('')}
              title="Limpiar búsqueda"
            >
              <Icono n="cerrar" tam={12} />
            </button>
          )}
        </div>
      </div>

      {diccionarios.length === 0 ? (
        <Vacio
          icono="libro"
          titulo="Aún no hay diccionarios jurídicos cargados"
          texto="Sube un archivo PDF (Cabanellas, Manuel Ossorio, Glosario Ley 348...) o importa la colección base para explorar conceptos e insertarlos en tus documentos."
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-sec"
              onClick={importarColeccionBase}
              disabled={importandoPredeterminados}
            >
              {importandoPredeterminados ? 'Importando...' : 'Importar Colección Base (3 Obras)'}
            </button>
            <button type="button" className="btn btn-pri" onClick={() => setModalSubir(true)}>
              Subir Diccionario (PDF)
            </button>
          </div>
        </Vacio>
      ) : (
        /* Cuerpo en dos columnas: Lista de términos a la izquierda y Estudio de lectura a la derecha */
        <div className="dicc-cuerpo-split">
          {/* Columna Izquierda: Lista de Términos */}
          <div className="dicc-panel-lista">
            <div className="dicc-lista-cab">
              <span>{q.trim() !== '' ? `Términos encontrados (${itemsMostrados.length})` : 'Índice de la obra'}</span>
              {busqueda.cargando && <span className="suave">Buscando...</span>}
            </div>

            <div className="dicc-scroll-resultados">
              {cargandoDefecto && q.trim() === '' ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--texto-3)' }}>
                  Cargando términos...
                </div>
              ) : itemsMostrados.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--texto-3)' }}>
                  {q.trim() !== '' ? `No se encontraron términos para «${q}»` : 'No hay términos registrados.'}
                </div>
              ) : (
                itemsMostrados.map((item) => {
                  const estaActivo = terminoSeleccionado?.id === item.id;
                  const dictNombre =
                    'diccionarioNombre' in item
                      ? item.diccionarioNombre
                      : diccionarioActivo?.nombre || 'Diccionario';

                  return (
                    <button
                      key={`${item.diccionarioId}-${item.id}`}
                      type="button"
                      className={`dicc-item-termino ${estaActivo ? 'activo' : ''}`}
                      onClick={() => setIdSeleccionado(item.id)}
                    >
                      <div className="dicc-item-cab">
                        <span className="dicc-item-titulo">{item.termino}</span>
                        <Insignia tono="azul">Pág. {item.pagina}</Insignia>
                      </div>
                      <div className="dicc-item-meta">
                        <span>{dictNombre}</span>
                      </div>
                      <div
                        className="dicc-item-extracto"
                        dangerouslySetInnerHTML={{
                          __html: sanearTextoDefinicion(
                            item.definicion.slice(0, 160),
                            q
                          ),
                        }}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Columna Derecha: Lectura Doctrinal en Grande, Limpio y Sin Visor Lento */}
          <div className="dicc-panel-lectura">
            {terminoSeleccionado ? (
              <>
                <div className="dicc-lectura-cab">
                  <div className="dicc-lectura-info">
                    <div className="dicc-lectura-meta">
                      <span className="dicc-lectura-obra-badge">
                        <Icono n="libro" tam={14} />
                        {terminoSeleccionado.diccionarioNombre}
                        {terminoSeleccionado.diccionarioAutor ? ` · ${terminoSeleccionado.diccionarioAutor}` : ''}
                      </span>
                      <Insignia tono="azul">Página {terminoSeleccionado.pagina}</Insignia>
                    </div>
                    <h2 className="dicc-lectura-titulo">{terminoSeleccionado.termino}</h2>
                  </div>

                  <div className="dicc-lectura-acciones">
                    <button
                      type="button"
                      className="btn btn-sec btn-sm"
                      onClick={copiarDefinicion}
                      title="Copiar texto de la definición al portapapeles"
                    >
                      <Icono n="documento" tam={14} /> Copiar Definición
                    </button>
                    <button
                      type="button"
                      className="btn btn-pri btn-sm"
                      onClick={copiarCitaCompleta}
                      title="Copiar cita doctrinal con formato académico para memoriales"
                    >
                      <Icono n="libro" tam={14} /> Citar con Fuente
                    </button>
                  </div>
                </div>

                <div
                  className="dicc-lectura-cuerpo"
                  dangerouslySetInnerHTML={{
                    __html: sanearTextoDefinicion(terminoSeleccionado.definicion, q),
                  }}
                />

                <div className="dicc-cita-box">
                  <div className="dicc-cita-box-cab">
                    <span className="dicc-cita-box-etiq">
                      <Icono n="balanza" tam={15} />
                      Cita Doctrinal Formal (lista para pegar en memoriales o contratos)
                    </span>
                    <button
                      type="button"
                      className="btn btn-fan btn-sm"
                      onClick={copiarCitaCompleta}
                      title="Copiar esta cita al portapapeles"
                    >
                      <Icono n="documento" tam={13} /> Copiar Cita
                    </button>
                  </div>
                  <p className="dicc-cita-box-texto">
                    {formatearCitaDiccionario(
                      terminoSeleccionado.termino,
                      terminoSeleccionado.definicion,
                      terminoSeleccionado.diccionarioNombre,
                      terminoSeleccionado.diccionarioAutor,
                      terminoSeleccionado.pagina
                    )}
                  </p>
                </div>
              </>
            ) : (
              <div className="dicc-vacio-lectura">
                <div className="dicc-vacio-icono">
                  <Icono n="libro" tam={30} />
                </div>
                <h3 className="dicc-vacio-titulo">Explorador Doctrinal de Términos</h3>
                <p className="dicc-vacio-desc">
                  Selecciona un término del índice a la izquierda o escribe un concepto arriba para ver su definición completa y cita doctrinal en este panel.
                </p>
                <div className="dicc-sugerencias-chips">
                  {SUGERENCIAS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      className="dicc-chip-btn"
                      onClick={() => setQ(sug)}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modalSubir && (
        <ModalSubirDiccionario
          cerrar={() => setModalSubir(false)}
          alImportar={() => {
            listaDiccionarios.recargar();
          }}
        />
      )}
    </div>
  );
}
