import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  FiltroBusquedaJurisprudencia,
  ModalidadBusquedaTsj,
  ResolucionJurisprudencia,
  ResultadoPaginadoJurisprudencia,
  SalaTsjCatalogo,
  SubcampoBusquedaTsj,
} from '../../domain/jurisprudencia/jurisprudencia';
import {
  debeMostrarResumen,
  formatearCitaJurisprudencial,
  sanearTextoExtracto,
} from '../../domain/jurisprudencia/jurisprudencia';
import { Aviso, Icono, Vacio, avisar } from '../_core/comunes';
import { mensajeError, useServicios } from '../_core/servicios';
import { DetalleResolucionModal } from '../jurisprudencia/DetalleResolucionModal';
import { VincularExpedienteModal } from '../jurisprudencia/VincularExpedienteModal';
import '../jurisprudencia/jurisprudencia.css';

type PestanaPrincipal = 'en_linea' | 'biblioteca';

const ANIOS_GESTION = Array.from({ length: 27 }, (_, i) => 2026 - i);

function clasificarForma(forma?: string): 'exito' | 'error' | 'aviso' | 'azul' | 'gris' {
  if (!forma) return 'gris';
  const f = forma.toLowerCase();
  if (f.includes('concede') || f.includes('legal') || f.includes('procedente') || f.includes('admite')) {
    return 'exito';
  }
  if (
    f.includes('infundad') ||
    f.includes('deniega') ||
    f.includes('improbada') ||
    f.includes('improcedente') ||
    f.includes('anula') ||
    f.includes('inadmisible')
  ) {
    return 'error';
  }
  if (f.includes('revoca') || f.includes('modifica') || f.includes('parcial')) {
    return 'aviso';
  }
  return 'azul';
}

export function Jurisprudencia() {
  const s = useServicios();
  const [pestana, setPestana] = useState<PestanaPrincipal>('en_linea');

  // Control de concurrencia y carrera
  const idBusquedaRef = useRef(0);

  // Conteo total en biblioteca para badge
  const [totalGuardadas, setTotalGuardadas] = useState(0);

  // ================= ESTADO DE BÚSQUEDA EN LÍNEA =================
  const [fuente, setFuente] = useState<'TSJ' | 'TCP' | 'TODOS'>('TSJ');
  const [modalidadTsj, setModalidadTsj] = useState<ModalidadBusquedaTsj>('simple');
  const [subcampoTsj, setSubcampoTsj] = useState<SubcampoBusquedaTsj>('resolucion');

  const [textoEnLinea, setTextoEnLinea] = useState('');
  const [nroResolucion, setNroResolucion] = useState('');
  const [nroExpediente, setNroExpediente] = useState('');
  const [partes, setPartes] = useState('');
  const [idSalaTsj, setIdSalaTsj] = useState<number | null>(null);

  // Consulta por gestión TSJ
  const [gestionTsj, setGestionTsj] = useState<string>('2026');
  const [idSalaGestionTsj, setIdSalaGestionTsj] = useState<number | null>(null);

  // Búsqueda avanzada TSJ
  const [palabrasTodas, setPalabrasTodas] = useState('');
  const [fraseExacta, setFraseExacta] = useState('');
  const [palabrasCualquiera, setPalabrasCualquiera] = useState('');
  const [palabrasExcluir, setPalabrasExcluir] = useState('');
  const [materiaAvanzada, setMateriaAvanzada] = useState('');
  const [gestionAvanzada, setGestionAvanzada] = useState('');

  // Filtros adicionales colapsables
  const [mostrarFiltrosEnLinea, setMostrarFiltrosEnLinea] = useState(false);
  const [materiaEnLinea, setMateriaEnLinea] = useState('');
  const [gestionEnLinea, setGestionEnLinea] = useState('');

  const [paginaEnLinea, setPaginaEnLinea] = useState(1);
  const [resultadosEnLinea, setResultadosEnLinea] = useState<ResultadoPaginadoJurisprudencia | null>(null);
  const [buscandoEnLinea, setBuscandoEnLinea] = useState(false);
  const [errorEnLinea, setErrorEnLinea] = useState<string | null>(null);

  // ================= ESTADO DE BIBLIOTECA GUARDADA =================
  const [textoBib, setTextoBib] = useState('');
  const [origenBib, setOrigenBib] = useState<'TODOS' | 'TSJ' | 'TCP'>('TODOS');
  const [materiaBib, setMateriaBib] = useState('');
  const [gestionBib, setGestionBib] = useState('');
  const [paginaBib, setPaginaBib] = useState(1);
  const [resultadosBib, setResultadosBib] = useState<ResultadoPaginadoJurisprudencia | null>(null);
  const [buscandoBib, setBuscandoBib] = useState(false);
  const [errorBib, setErrorBib] = useState<string | null>(null);

  // Catálogos
  const [salasTsj, setSalasTsj] = useState<SalaTsjCatalogo[]>([]);

  // Modales
  const [resolucionDetalle, setResolucionDetalle] = useState<ResolucionJurisprudencia | null>(null);
  const [resolucionVincular, setResolucionVincular] = useState<ResolucionJurisprudencia | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  // Cargar salas TSJ al montar
  useEffect(() => {
    s.jurisprudencia
      .obtenerSalasTsj()
      .then((salas) => {
        setSalasTsj(salas);
        if (salas.length > 0 && !idSalaGestionTsj) {
          setIdSalaGestionTsj(salas[0].id);
        }
      })
      .catch(() => {});
  }, [s]);

  // Actualizar conteo de biblioteca
  const actualizarConteoBiblioteca = async () => {
    try {
      const res = await s.jurisprudencia.buscarLocal({ texto: '', origen: 'TODOS', limite: 1 });
      setTotalGuardadas(res.total);
    } catch {
      // Ignorar
    }
  };

  useEffect(() => {
    actualizarConteoBiblioteca();
  }, [s]);

  // Ejecutar búsqueda local al pasar a biblioteca
  useEffect(() => {
    if (pestana === 'biblioteca') {
      ejecutarBusquedaBiblioteca(1);
    }
  }, [pestana]);

  async function ejecutarBusquedaEnLinea(
    pag = 1,
    parametrosDirectos?: Partial<FiltroBusquedaJurisprudencia>
  ) {
    const idSecuencia = ++idBusquedaRef.current;
    setBuscandoEnLinea(true);
    setErrorEnLinea(null);
    setPaginaEnLinea(pag);

    const origenEfectivo = parametrosDirectos?.origen ?? fuente;
    const modTsj = origenEfectivo === 'TSJ' ? (parametrosDirectos?.modalidadTsj ?? modalidadTsj) : 'simple';
    const subTsj = parametrosDirectos?.subcampoTsj ?? subcampoTsj;
    const nroResVal = parametrosDirectos?.nroResolucion ?? nroResolucion;

    const filtro: FiltroBusquedaJurisprudencia = {
      texto: parametrosDirectos?.texto ?? textoEnLinea.trim(),
      origen: origenEfectivo,
      materia: materiaEnLinea || undefined,
      sala: undefined,
      gestion: modTsj === 'gestion' ? gestionTsj : (gestionEnLinea || undefined),
      pagina: pag,
      limite: 15,

      // Modalidades TSJ
      modalidadTsj: modTsj,
      subcampoTsj: subTsj,
      nroResolucion: nroResVal.trim() || undefined,
      nroExpediente: nroExpediente.trim() || undefined,
      partes: partes.trim() || undefined,
      idSalaTsj: modTsj === 'gestion' ? idSalaGestionTsj : idSalaTsj,
      palabrasTodas: palabrasTodas.trim() || undefined,
      fraseExacta: fraseExacta.trim() || undefined,
      palabrasCualquiera: palabrasCualquiera.trim() || undefined,
      palabrasExcluir: palabrasExcluir.trim() || undefined,
    };

    try {
      const res = await s.jurisprudencia.buscarEnLinea(filtro);
      if (idSecuencia === idBusquedaRef.current) {
        setResultadosEnLinea(res);
      }
    } catch (err) {
      if (idSecuencia === idBusquedaRef.current) {
        setErrorEnLinea(mensajeError(err));
        setResultadosEnLinea(null);
      }
    } finally {
      if (idSecuencia === idBusquedaRef.current) {
        setBuscandoEnLinea(false);
      }
    }
  }

  function cambiarFuenteEnLinea(nuevaFuente: 'TSJ' | 'TCP' | 'TODOS') {
    setFuente(nuevaFuente);
    const tieneCriterio = !!(
      textoEnLinea.trim() ||
      nroResolucion.trim() ||
      nroExpediente.trim() ||
      partes.trim() ||
      palabrasTodas.trim() ||
      fraseExacta.trim() ||
      palabrasCualquiera.trim() ||
      (nuevaFuente === 'TSJ' && modalidadTsj === 'gestion' && idSalaGestionTsj)
    );

    if (tieneCriterio) {
      ejecutarBusquedaEnLinea(1, { origen: nuevaFuente });
    }
  }

  async function ejecutarBusquedaBiblioteca(
    pag = 1,
    parametrosDirectos?: Partial<FiltroBusquedaJurisprudencia>
  ) {
    const idSecuencia = ++idBusquedaRef.current;
    setBuscandoBib(true);
    setErrorBib(null);
    setPaginaBib(pag);

    const origenVal = parametrosDirectos?.origen ?? origenBib;

    const filtro: FiltroBusquedaJurisprudencia = {
      texto: parametrosDirectos?.texto ?? textoBib.trim(),
      origen: origenVal,
      materia: materiaBib || undefined,
      gestion: gestionBib.trim() || undefined,
      pagina: pag,
      limite: 15,
    };

    try {
      const res = await s.jurisprudencia.buscarLocal(filtro);
      if (idSecuencia === idBusquedaRef.current) {
        setResultadosBib(res);
        setTotalGuardadas(res.total);
      }
    } catch (err) {
      if (idSecuencia === idBusquedaRef.current) {
        setErrorBib(mensajeError(err));
        setResultadosBib(null);
      }
    } finally {
      if (idSecuencia === idBusquedaRef.current) {
        setBuscandoBib(false);
      }
    }
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (pestana === 'en_linea') {
      ejecutarBusquedaEnLinea(1);
    } else {
      ejecutarBusquedaBiblioteca(1);
    }
  }

  async function copiarCita(r: ResolucionJurisprudencia) {
    const cita = formatearCitaJurisprudencial(r);
    try {
      await navigator.clipboard.writeText(cita);
      avisar('Cita jurídica formal copiada al portapapeles');
    } catch {
      avisar('No se pudo copiar automáticamente al portapapeles', 'error');
    }
  }

  async function alternarGuardado(r: ResolucionJurisprudencia) {
    setProcesandoId(r.id);
    try {
      if (r.guardadaLocal) {
        await s.jurisprudencia.eliminarDeBiblioteca(r);
        r.guardadaLocal = false;
        r.idLocal = undefined;
        setTotalGuardadas((prev) => Math.max(0, prev - 1));
        avisar('Eliminada de tu biblioteca local');
      } else {
        const guardada = await s.jurisprudencia.guardarEnBiblioteca(r);
        r.guardadaLocal = true;
        r.idLocal = guardada.idLocal;
        setTotalGuardadas((prev) => prev + 1);
        avisar('Resolución guardada en tu biblioteca local (offline)');
      }

      if (resultadosEnLinea) {
        setResultadosEnLinea({
          ...resultadosEnLinea,
          items: resultadosEnLinea.items.map((it) => (it.id === r.id ? { ...it, ...r } : it)),
        });
      }
      if (pestana === 'biblioteca') {
        ejecutarBusquedaBiblioteca(paginaBib);
      }
    } catch (err) {
      avisar(`Error: ${mensajeError(err)}`, 'error');
    } finally {
      setProcesandoId(null);
    }
  }

  async function descargarPdf(r: ResolucionJurisprudencia) {
    setProcesandoId(r.id);
    try {
      if (r.rutaPdf) {
        await s.archivos.abrir(r.rutaPdf);
        avisar('Abriendo archivo PDF oficial');
        return;
      }
      const { buffer, nombreArchivo } = await s.jurisprudencia.descargarPdf(r);
      const ruta = await s.archivos.rutaJurisprudencia(nombreArchivo);
      await s.archivos.escribir(ruta, buffer);
      r.rutaPdf = ruta;
      avisar(`PDF guardado: ${nombreArchivo}`);
      await s.archivos.abrir(ruta);
    } catch (err) {
      avisar(`No se pudo descargar el PDF: ${mensajeError(err)}`, 'error');
    } finally {
      setProcesandoId(null);
    }
  }

  const resultadosActuales = pestana === 'en_linea' ? resultadosEnLinea : resultadosBib;
  const buscandoActual = pestana === 'en_linea' ? buscandoEnLinea : buscandoBib;
  const errorActual = pestana === 'en_linea' ? errorEnLinea : errorBib;
  const paginaActual = pestana === 'en_linea' ? paginaEnLinea : paginaBib;

  return (
    <div className="pagina juris-modulo-rediseñado">
      {/* Cabecera compacta y moderna */}
      <div className="juris-cabecera-principal">
        <div className="juris-titular-area">
          <div className="juris-icono-titular">
            <Icono n="tribunal" tam={22} />
          </div>
          <div>
            <h1 className="juris-titulo">Jurisprudencia Boliviana</h1>
            <p className="juris-bajada">
              Acceso directo a fallos del <strong>TSJ</strong> y <strong>TCP</strong> con orden cronológico actualizado y archivo local sin conexión.
            </p>
          </div>
        </div>

        {/* Selector de Pestaña Principal (En Línea vs Biblioteca) */}
        <div className="juris-selector-pestanas">
          <button
            type="button"
            className={`juris-pestana-btn ${pestana === 'en_linea' ? 'activa' : ''}`}
            onClick={() => setPestana('en_linea')}
          >
            <Icono n="buscar" tam={15} />
            <span>Búsqueda en Línea</span>
          </button>
          <button
            type="button"
            className={`juris-pestana-btn ${pestana === 'biblioteca' ? 'activa' : ''}`}
            onClick={() => setPestana('biblioteca')}
          >
            <Icono n="libro" tam={15} />
            <span>Mi Biblioteca</span>
            {totalGuardadas > 0 && <span className="juris-badge-conteo">{totalGuardadas}</span>}
          </button>
        </div>
      </div>

      {/* PANEL DE CONTROL COMPACTO */}
      <div className="juris-panel-busqueda">
        {pestana === 'en_linea' ? (
          <div className="juris-enlinea-flow">
            {/* Fila superior: Selector de Fuente + Modalidad TSJ */}
            <div className="juris-toolbar-superior">
              {/* Selector de Fuente institucional */}
              <div className="juris-grupo-fuentes">
                <button
                  type="button"
                  className={`juris-btn-fuente ${fuente === 'TSJ' ? 'activa' : ''}`}
                  onClick={() => cambiarFuenteEnLinea('TSJ')}
                >
                  🏛️ TSJ (Autos Supremos)
                </button>
                <button
                  type="button"
                  className={`juris-btn-fuente ${fuente === 'TCP' ? 'activa' : ''}`}
                  onClick={() => cambiarFuenteEnLinea('TCP')}
                >
                  ⚖️ TCP (Sentencias Const.)
                </button>
                <button
                  type="button"
                  className={`juris-btn-fuente ${fuente === 'TODOS' ? 'activa' : ''}`}
                  onClick={() => cambiarFuenteEnLinea('TODOS')}
                >
                  🌐 Ambas Fuentes
                </button>
              </div>

              {/* Selector de modalidades TSJ (compacto en una sola fila) */}
              {fuente === 'TSJ' && (
                <div className="juris-grupo-modalidades">
                  <button
                    type="button"
                    className={`juris-btn-mod ${modalidadTsj === 'simple' ? 'activa' : ''}`}
                    onClick={() => setModalidadTsj('simple')}
                    title="Búsqueda por palabras clave o términos jurídicos"
                  >
                    🔍 General
                  </button>
                  <button
                    type="button"
                    className={`juris-btn-mod ${modalidadTsj === 'campos' ? 'activa' : ''}`}
                    onClick={() => setModalidadTsj('campos')}
                    title="Búsqueda exacta por N° de resolución, expediente o partes procesales"
                  >
                    🎯 N° / Exp.
                  </button>
                  <button
                    type="button"
                    className={`juris-btn-mod ${modalidadTsj === 'gestion' ? 'activa' : ''}`}
                    onClick={() => setModalidadTsj('gestion')}
                    title="Resoluciones por sala y año ordenadas por fecha más reciente"
                  >
                    📅 Por Gestión
                  </button>
                  <button
                    type="button"
                    className={`juris-btn-mod ${modalidadTsj === 'avanzada' ? 'activa' : ''}`}
                    onClick={() => setModalidadTsj('avanzada')}
                    title="Búsqueda con operadores lógicos y exclusión"
                  >
                    ⚡ Avanzada
                  </button>
                </div>
              )}
            </div>

            {/* FORMULARIO PUNTUAL SEGÚN MODALIDAD */}
            <form onSubmit={alEnviar} className="juris-formulario-principal">
              {/* 1. Modalidad General (TSJ simple, TCP o Ambas) */}
              {(modalidadTsj === 'simple' || fuente !== 'TSJ') && (
                <div className="juris-input-box">
                  <div className="juris-input-search-row">
                    <div className="juris-input-wrapper">
                      <span className="juris-input-icon">
                        <Icono n="buscar" tam={16} />
                      </span>
                      <input
                        type="search"
                        className="juris-input-texto"
                        placeholder={
                          fuente === 'TCP'
                            ? 'Buscar sentencias TCP: debido proceso, acción de amparo, 3593/2026-S1...'
                            : 'Buscar resoluciones: usucapión, prescripción adquisitiva, difamación, "debido proceso"...'
                        }
                        value={textoEnLinea}
                        onChange={(e) => setTextoEnLinea(e.target.value)}
                        autoFocus
                      />
                      {textoEnLinea && (
                        <button
                          type="button"
                          className="juris-input-clear"
                          onClick={() => setTextoEnLinea('')}
                          title="Limpiar"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      className={`juris-btn-filtros-toggle ${mostrarFiltrosEnLinea ? 'activo' : ''}`}
                      onClick={() => setMostrarFiltrosEnLinea((p) => !p)}
                      title="Filtros de materia y gestión"
                    >
                      <Icono n="ajustes" tam={14} /> Filtros
                    </button>

                    <button type="submit" className="btn btn-pri juris-btn-submit" disabled={buscandoEnLinea}>
                      <Icono n="buscar" tam={15} /> {buscandoEnLinea ? 'Consultando...' : 'Buscar'}
                    </button>
                  </div>

                  {mostrarFiltrosEnLinea && (
                    <div className="juris-filtros-inline">
                      <div>
                        <label className="juris-mini-label">Materia</label>
                        <select
                          value={materiaEnLinea}
                          onChange={(e) => setMateriaEnLinea(e.target.value)}
                          className="juris-mini-select"
                        >
                          <option value="">Todas las materias</option>
                          <option value="Civil">Civil</option>
                          <option value="Penal">Penal</option>
                          <option value="Social">Social / Laboral</option>
                          <option value="Contencioso">Contencioso Administrativo</option>
                          <option value="Familia">Familia</option>
                        </select>
                      </div>

                      <div>
                        <label className="juris-mini-label">Gestión (Año)</label>
                        <select
                          value={gestionEnLinea}
                          onChange={(e) => setGestionEnLinea(e.target.value)}
                          className="juris-mini-select"
                        >
                          <option value="">Todas las gestiones</option>
                          {ANIOS_GESTION.map((y) => (
                            <option key={y} value={String(y)}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Modalidad Por Campos TSJ (N° / Exp / Partes) */}
              {fuente === 'TSJ' && modalidadTsj === 'campos' && (
                <div className="juris-campos-container">
                  <div className="juris-campos-row">
                    <select
                      className="juris-select-subcampo"
                      value={subcampoTsj}
                      onChange={(e) => setSubcampoTsj(e.target.value as SubcampoBusquedaTsj)}
                    >
                      <option value="resolucion">N° de Resolución</option>
                      <option value="expediente">N° de Expediente</option>
                      <option value="partes">Partes Procesales</option>
                    </select>

                    <div className="juris-input-wrapper" style={{ flex: 1 }}>
                      {subcampoTsj === 'resolucion' && (
                        <input
                          type="search"
                          className="juris-input-texto"
                          placeholder="Ej: AS/0554/2026-FF, 0711/2018, 0169/2019..."
                          value={nroResolucion}
                          onChange={(e) => setNroResolucion(e.target.value)}
                          autoFocus
                        />
                      )}
                      {subcampoTsj === 'expediente' && (
                        <input
                          type="search"
                          className="juris-input-texto"
                          placeholder="Ej: LP-1-24-S, 123/2023..."
                          value={nroExpediente}
                          onChange={(e) => setNroExpediente(e.target.value)}
                          autoFocus
                        />
                      )}
                      {subcampoTsj === 'partes' && (
                        <input
                          type="search"
                          className="juris-input-texto"
                          placeholder="Nombre del demandante, demandado o recurrente..."
                          value={partes}
                          onChange={(e) => setPartes(e.target.value)}
                          autoFocus
                        />
                      )}
                    </div>

                    <select
                      className="juris-select-sala"
                      value={idSalaTsj ?? ''}
                      onChange={(e) => setIdSalaTsj(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Todas las salas TSJ</option>
                      {salasTsj.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>

                    <button type="submit" className="btn btn-pri juris-btn-submit" disabled={buscandoEnLinea}>
                      <Icono n="buscar" tam={15} /> {buscandoEnLinea ? 'Buscando...' : 'Consultar'}
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Modalidad Consulta por Gestión TSJ */}
              {fuente === 'TSJ' && modalidadTsj === 'gestion' && (
                <div className="juris-gestion-container">
                  <div className="juris-gestion-row">
                    <div className="juris-gestion-item">
                      <label className="juris-mini-label">Sala Institucional *</label>
                      <select
                        value={idSalaGestionTsj ?? (salasTsj[0]?.id || '')}
                        onChange={(e) => setIdSalaGestionTsj(Number(e.target.value))}
                        required
                        className="juris-select-gestion"
                      >
                        {salasTsj.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="juris-gestion-item">
                      <label className="juris-mini-label">Gestión (Año) *</label>
                      <select
                        value={gestionTsj}
                        onChange={(e) => setGestionTsj(e.target.value)}
                        required
                        className="juris-select-gestion"
                      >
                        {ANIOS_GESTION.map((y) => (
                          <option key={y} value={String(y)}>
                            Gestión {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="juris-gestion-item juris-gestion-btn-col">
                      <button
                        type="submit"
                        className="btn btn-pri juris-btn-submit"
                        disabled={buscandoEnLinea}
                      >
                        <Icono n="calendario" tam={15} /> {buscandoEnLinea ? 'Consultando...' : 'Consultar Gestión'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Modalidad Búsqueda Avanzada TSJ */}
              {fuente === 'TSJ' && modalidadTsj === 'avanzada' && (
                <div className="juris-avanzada-box">
                  <div className="juris-avanzada-grid-campos">
                    <div>
                      <label className="juris-mini-label">Todas estas palabras (AND)</label>
                      <input
                        type="text"
                        placeholder="Ej: contrato incumplimiento"
                        value={palabrasTodas}
                        onChange={(e) => setPalabrasTodas(e.target.value)}
                        className="juris-input-compacto"
                      />
                    </div>

                    <div>
                      <label className="juris-mini-label">Frase exacta ("...")</label>
                      <input
                        type="text"
                        placeholder="Ej: falta de legitimación pasiva"
                        value={fraseExacta}
                        onChange={(e) => setFraseExacta(e.target.value)}
                        className="juris-input-compacto"
                      />
                    </div>

                    <div>
                      <label className="juris-mini-label">Cualquiera de estas palabras (OR)</label>
                      <input
                        type="text"
                        placeholder="Ej: usucapión prescripción posesión"
                        value={palabrasCualquiera}
                        onChange={(e) => setPalabrasCualquiera(e.target.value)}
                        className="juris-input-compacto"
                      />
                    </div>

                    <div>
                      <label className="juris-mini-label">Ninguna de estas palabras (NOT)</label>
                      <input
                        type="text"
                        placeholder="Ej: penal flagrancia detención"
                        value={palabrasExcluir}
                        onChange={(e) => setPalabrasExcluir(e.target.value)}
                        className="juris-input-compacto"
                      />
                    </div>
                  </div>

                  <div className="juris-avanzada-filtros-row">
                    <div>
                      <label className="juris-mini-label">Sala</label>
                      <select
                        value={idSalaTsj ?? ''}
                        onChange={(e) => setIdSalaTsj(e.target.value ? Number(e.target.value) : null)}
                        className="juris-mini-select"
                      >
                        <option value="">Todas las salas TSJ</option>
                        {salasTsj.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="juris-mini-label">Gestión</label>
                      <select
                        value={gestionAvanzada}
                        onChange={(e) => setGestionAvanzada(e.target.value)}
                        className="juris-mini-select"
                      >
                        <option value="">Cualquier año</option>
                        {ANIOS_GESTION.map((y) => (
                          <option key={y} value={String(y)}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="juris-mini-label">Materia</label>
                      <select
                        value={materiaAvanzada}
                        onChange={(e) => setMateriaAvanzada(e.target.value)}
                        className="juris-mini-select"
                      >
                        <option value="">Todas las materias</option>
                        <option value="Civil">Civil</option>
                        <option value="Penal">Penal</option>
                        <option value="Social">Social / Laboral</option>
                        <option value="Contencioso">Contencioso Administrativo</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-pri juris-btn-submit"
                      disabled={buscandoEnLinea}
                    >
                      <Icono n="rayo" tam={15} /> {buscandoEnLinea ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        ) : (
          /* ================= PANEL DE BIBLIOTECA LOCAL ================= */
          <div className="juris-biblioteca-flow">
            <form onSubmit={alEnviar} className="juris-bib-form">
              <div className="juris-bib-topbar">
                {/* Selector rápido de origen en biblioteca */}
                <div className="juris-grupo-fuentes">
                  <button
                    type="button"
                    className={`juris-btn-fuente ${origenBib === 'TODOS' ? 'activa' : ''}`}
                    onClick={() => {
                      setOrigenBib('TODOS');
                      ejecutarBusquedaBiblioteca(1, { origen: 'TODOS' });
                    }}
                  >
                    🌐 Todos ({totalGuardadas})
                  </button>
                  <button
                    type="button"
                    className={`juris-btn-fuente ${origenBib === 'TSJ' ? 'activa' : ''}`}
                    onClick={() => {
                      setOrigenBib('TSJ');
                      ejecutarBusquedaBiblioteca(1, { origen: 'TSJ' });
                    }}
                  >
                    🏛️ TSJ
                  </button>
                  <button
                    type="button"
                    className={`juris-btn-fuente ${origenBib === 'TCP' ? 'activa' : ''}`}
                    onClick={() => {
                      setOrigenBib('TCP');
                      ejecutarBusquedaBiblioteca(1, { origen: 'TCP' });
                    }}
                  >
                    ⚖️ TCP
                  </button>
                </div>

                <span className="juris-bib-stats">
                  💾 Resoluciones guardadas offline en tu disco local
                </span>
              </div>

              <div className="juris-bib-search-row">
                <div className="juris-input-wrapper" style={{ flex: 1 }}>
                  <span className="juris-input-icon">
                    <Icono n="buscar" tam={16} />
                  </span>
                  <input
                    type="search"
                    className="juris-input-texto"
                    placeholder="Buscar en tu biblioteca por texto, número de resolución, magistrado o proceso..."
                    value={textoBib}
                    onChange={(e) => setTextoBib(e.target.value)}
                  />
                  {textoBib && (
                    <button
                      type="button"
                      className="juris-input-clear"
                      onClick={() => setTextoBib('')}
                      title="Limpiar"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Materia (ej: Civil, Amparo)..."
                  value={materiaBib}
                  onChange={(e) => setMateriaBib(e.target.value)}
                  className="juris-mini-input"
                  style={{ width: '180px' }}
                />

                <input
                  type="text"
                  placeholder="Gestión (año)..."
                  value={gestionBib}
                  onChange={(e) => setGestionBib(e.target.value)}
                  className="juris-mini-input"
                  style={{ width: '120px' }}
                />

                <button type="submit" className="btn btn-pri juris-btn-submit" disabled={buscandoBib}>
                  <Icono n="buscar" tam={15} /> {buscandoBib ? 'Buscando...' : 'Filtrar'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {errorActual && <Aviso error={errorActual} />}

      {/* ESTADO DE CARGA */}
      {buscandoActual ? (
        <div className="juris-cargando-estado">
          <div className="juris-spinner" />
          <p className="juris-cargando-texto">
            {pestana === 'en_linea'
              ? 'Consultando fuentes jurisprudenciales en tiempo real...'
              : 'Consultando biblioteca local...'}
          </p>
        </div>
      ) : resultadosActuales && resultadosActuales.items.length > 0 ? (
        <div className="juris-resultados-contenedor">
          {/* Cabecera de resultados */}
          <div className="juris-resultados-header">
            <div className="juris-resultados-contador">
              <span className="juris-conteo-num">{resultadosActuales.total.toLocaleString()}</span>
              <span>resoluciones encontradas</span>
              <span className="juris-badge-orden">📅 Más recientes primero</span>
            </div>

            <span className="juris-paginacion-info">
              Página {resultadosActuales.pagina} de {resultadosActuales.totalPaginas}
            </span>
          </div>

          {/* LISTADO DE TARJETAS REDISEÑADAS */}
          <div className="juris-lista-tarjetas">
            {resultadosActuales.items.map((r) => {
              const forma = r.formaResolucion?.trim();
              const tonoForma = clasificarForma(forma);

              return (
                <article
                  key={`${r.origen}-${r.id}`}
                  className={`juris-tarjeta-item juris-tarjeta-${r.origen.toLowerCase()}`}
                >
                  {/* Topbar de la tarjeta: Identificador y FECHA DESTACADA */}
                  <div className="juris-tarjeta-topbar">
                    <div className="juris-tarjeta-etiquetas">
                      <span className={`juris-chip-origen juris-chip-${r.origen.toLowerCase()}`}>
                        {r.origen === 'TSJ' ? '🏛️ TSJ' : '⚖️ TCP'}
                      </span>
                      {r.sala && <span className="juris-chip-sala">{r.sala}</span>}
                      {r.guardadaLocal && (
                        <span className="juris-chip-guardada">
                          <Icono n="ok" tam={12} /> Guardada
                        </span>
                      )}
                    </div>

                    {/* FECHA DE EMISIÓN DESTACADA */}
                    {r.fechaEmision && (
                      <div className="juris-fecha-destacada" title="Fecha oficial de emisión">
                        <Icono n="calendario" tam={14} />
                        <span className="juris-fecha-valor">{r.fechaEmision}</span>
                      </div>
                    )}
                  </div>

                  {/* Título: Solo el N° de Resolución (sin repetir 'Auto Supremo') y Expediente */}
                  <div className="juris-tarjeta-cabecera">
                    <button
                      type="button"
                      className="juris-tarjeta-titulo-btn"
                      onClick={() => setResolucionDetalle(r)}
                      title="Abrir resolución completa"
                    >
                      <span className="juris-tarjeta-num">{r.numeroResolucion}</span>
                      {r.numeroExpediente && (
                        <span className="juris-expediente-badge">Exp. {r.numeroExpediente}</span>
                      )}
                    </button>

                    {/* Partes procesales compactas */}
                    {(r.demandante || r.demandado) && (
                      <div className="juris-partes-fila">
                        {r.demandante && (
                          <span className="juris-parte-item">
                            <strong>Dte:</strong> {r.demandante}
                          </span>
                        )}
                        {r.demandante && r.demandado && <span className="juris-vs">vs</span>}
                        {r.demandado && (
                          <span className="juris-parte-item">
                            <strong>Ddo:</strong> {r.demandado}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ================= FILA COMPACTA DE METADATOS CLAVE ================= */}
                  {/* Forma de Resolución | Proceso | Departamento | Magistrado */}
                  <div className="juris-meta-fila-compacta">
                    {forma && (
                      <div className="juris-meta-item">
                        <span className="juris-meta-k">Forma:</span>
                        <span className={`juris-forma-chip juris-forma-${tonoForma}`}>
                          {forma}
                        </span>
                      </div>
                    )}

                    {r.proceso && (
                      <div className="juris-meta-item" title={r.proceso}>
                        <span className="juris-meta-k">Proceso:</span>
                        <span className="juris-meta-v">📋 {r.proceso}</span>
                      </div>
                    )}

                    {r.departamento && (
                      <div className="juris-meta-item">
                        <span className="juris-meta-k">Distrito:</span>
                        <span className="juris-meta-v">📍 {r.departamento}</span>
                      </div>
                    )}

                    {r.magistrado && (
                      <div className="juris-meta-item" title={r.magistrado}>
                        <span className="juris-meta-k">Magistrado:</span>
                        <span className="juris-meta-v">👨‍⚖️ {r.magistrado}</span>
                      </div>
                    )}
                  </div>

                  {/* Máxima jurisprudencial o descripción de búsqueda (filtrando duplicados de Proceso) */}
                  {r.maxima ? (
                    <div className="juris-tarjeta-maxima-caja">
                      <strong className="juris-maxima-rotulo">Máxima:</strong>{' '}
                      <span
                        className="juris-maxima-cuerpo"
                        dangerouslySetInnerHTML={{
                          __html: sanearTextoExtracto(r.maxima, pestana === 'en_linea' ? textoEnLinea : textoBib),
                        }}
                      />
                    </div>
                  ) : debeMostrarResumen(r.resumen, r.proceso) ? (
                    <div
                      className="juris-tarjeta-resumen-caja"
                      dangerouslySetInnerHTML={{
                        __html: sanearTextoExtracto(r.resumen!, pestana === 'en_linea' ? textoEnLinea : textoBib),
                      }}
                    />
                  ) : null}

                  {/* Botonera de acciones compacta en una sola fila */}
                  <div className="juris-tarjeta-acciones-fila">
                    <div className="juris-acciones-primarias">
                      <button
                        type="button"
                        className="btn btn-pri btn-sm"
                        onClick={() => setResolucionDetalle(r)}
                        title="Ver texto completo y ficha de análisis"
                      >
                        <Icono n="libro" tam={14} /> Ver Resolución
                      </button>
                      <button
                        type="button"
                        className="btn btn-sec btn-sm"
                        onClick={() => copiarCita(r)}
                        title="Copiar cita formal al portapapeles"
                      >
                        <Icono n="documento" tam={14} /> Copiar Cita
                      </button>
                      <button
                        type="button"
                        className="btn btn-sec btn-sm"
                        onClick={() => setResolucionVincular(r)}
                        title="Vincular a un caso del despacho"
                      >
                        <Icono n="carpeta" tam={14} /> Vincular
                      </button>
                    </div>

                    <div className="juris-acciones-secundarias">
                      <button
                        type="button"
                        className="btn btn-sec btn-sm"
                        onClick={() => descargarPdf(r)}
                        disabled={procesandoId === r.id}
                        title={r.rutaPdf ? 'Abrir archivo PDF oficial guardado' : 'Descargar PDF oficial'}
                      >
                        <Icono n="documento" tam={14} /> {r.rutaPdf ? 'Abrir PDF' : 'Descargar PDF'}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${r.guardadaLocal ? 'btn-sec juris-btn-guardada-activa' : 'btn-pri'}`}
                        onClick={() => alternarGuardado(r)}
                        disabled={procesandoId === r.id}
                        title={r.guardadaLocal ? 'Quitar de la biblioteca' : 'Guardar offline en la biblioteca'}
                      >
                        <Icono n={r.guardadaLocal ? 'ok' : 'mas'} tam={14} />
                        {r.guardadaLocal ? 'Guardada' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Paginación limpia */}
          {resultadosActuales.totalPaginas > 1 && (
            <div className="juris-paginador-barra">
              <button
                type="button"
                className="btn btn-sec btn-sm"
                disabled={paginaActual <= 1}
                onClick={() =>
                  pestana === 'en_linea'
                    ? ejecutarBusquedaEnLinea(paginaActual - 1)
                    : ejecutarBusquedaBiblioteca(paginaActual - 1)
                }
              >
                ← Anterior
              </button>
              <span className="juris-paginador-texto">
                Página <strong>{paginaActual}</strong> de {resultadosActuales.totalPaginas}
              </span>
              <button
                type="button"
                className="btn btn-sec btn-sm"
                disabled={paginaActual >= resultadosActuales.totalPaginas}
                onClick={() =>
                  pestana === 'en_linea'
                    ? ejecutarBusquedaEnLinea(paginaActual + 1)
                    : ejecutarBusquedaBiblioteca(paginaActual + 1)
                }
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      ) : resultadosActuales ? (
        <Vacio
          titulo="Sin resultados coincidentes"
          texto="No se encontraron fallos o autos supremos con los criterios indicados. Intenta ampliar el término o revisar los filtros."
          icono="buscar"
        />
      ) : pestana === 'biblioteca' ? (
        <Vacio
          titulo="Tu biblioteca de jurisprudencia está vacía"
          texto="Busca autos supremos o sentencias constitucionales en la pestaña «Búsqueda en Línea» y presiona «Guardar» para disponer de ellos offline."
          icono="libro"
        />
      ) : (
        <Vacio
          titulo="Buscador de Jurisprudencia Boliviana"
          texto="Escribe términos jurídicos, selecciona una sala o introduce un número de resolución para explorar fallos oficiales."
          icono="tribunal"
        />
      )}

      {/* Modal de Detalle */}
      {resolucionDetalle && (
        <DetalleResolucionModal
          resolucion={resolucionDetalle}
          cerrar={() => setResolucionDetalle(null)}
          alCambiarGuardado={() => {
            if (pestana === 'biblioteca') {
              ejecutarBusquedaBiblioteca(paginaBib);
            } else if (resultadosEnLinea) {
              setResultadosEnLinea({
                ...resultadosEnLinea,
                items: resultadosEnLinea.items.map((it) =>
                  it.id === resolucionDetalle.id ? { ...it, guardadaLocal: !it.guardadaLocal } : it
                ),
              });
            }
          }}
        />
      )}

      {/* Modal de Vincular a Caso */}
      {resolucionVincular && (
        <VincularExpedienteModal
          resolucion={resolucionVincular}
          cerrar={() => setResolucionVincular(null)}
          alVincular={() => {
            avisar('Resolución vinculada al caso con éxito');
          }}
        />
      )}
    </div>
  );
}
