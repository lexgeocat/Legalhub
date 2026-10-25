import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  FiltroBusquedaJurisprudencia,
  ModalidadBusquedaTsj,
  ResolucionJurisprudencia,
  ResultadoPaginadoJurisprudencia,
  SalaTsjCatalogo,
  SubcampoBusquedaTsj,
  TipoResolucionTsjCatalogo,
} from '../../domain/jurisprudencia/jurisprudencia';
import {
  formatearCitaJurisprudencial,
  sanearTextoExtracto,
} from '../../domain/jurisprudencia/jurisprudencia';
import { Aviso, Icono, Insignia, Pestanas, Vacio, avisar } from '../_core/comunes';
import { mensajeError, useServicios } from '../_core/servicios';
import { DetalleResolucionModal } from '../jurisprudencia/DetalleResolucionModal';
import { VincularExpedienteModal } from '../jurisprudencia/VincularExpedienteModal';
import '../jurisprudencia/jurisprudencia.css';

type PestanaPrincipal = 'en_linea' | 'biblioteca';

const PESTANAS: { id: PestanaPrincipal; etiqueta: string }[] = [
  { id: 'en_linea', etiqueta: 'Búsqueda en Línea (TSJ / TCP)' },
  { id: 'biblioteca', etiqueta: 'Mi Biblioteca Guardada' },
];

const ANIOS_GESTION = Array.from({ length: 27 }, (_, i) => 2026 - i);

export function Jurisprudencia() {
  const s = useServicios();
  const [pestana, setPestana] = useState<PestanaPrincipal>('en_linea');

  // Control de concurrencia y carrera (Q11)
  const idBusquedaRef = useRef(0);

  // ================= ESTADO DE BÚSQUEDA EN LÍNEA =================
  const [fuente, setFuente] = useState<'TSJ' | 'TCP' | 'TODOS'>('TSJ');
  const [modalidadTsj, setModalidadTsj] = useState<ModalidadBusquedaTsj>('simple');
  const [subcampoTsj, setSubcampoTsj] = useState<SubcampoBusquedaTsj>('resolucion');

  const [textoEnLinea, setTextoEnLinea] = useState('');
  const [nroResolucion, setNroResolucion] = useState('');
  const [nroExpediente, setNroExpediente] = useState('');
  const [partes, setPartes] = useState('');

  // idSalaTsj comienza en null para no filtrar silenciosamente a Sala Penal 1 (Q1)
  const [idSalaTsj, setIdSalaTsj] = useState<number | null>(null);

  // Consulta por gestión: año inicializado con el actual (Q2)
  const [gestionTsj, setGestionTsj] = useState<string>('2026');
  const [idSalaGestionTsj, setIdSalaGestionTsj] = useState<number | null>(null);
  const [idTipoResTsj, setIdTipoResTsj] = useState<number | null>(null);

  // Búsqueda avanzada
  const [palabrasTodas, setPalabrasTodas] = useState('');
  const [fraseExacta, setFraseExacta] = useState('');
  const [palabrasCualquiera, setPalabrasCualquiera] = useState('');
  const [palabrasExcluir, setPalabrasExcluir] = useState('');
  const [materiaAvanzada, setMateriaAvanzada] = useState('');
  const [gestionAvanzada, setGestionAvanzada] = useState('');

  // Filtros adicionales en línea
  const [mostrarFiltrosEnLinea, setMostrarFiltrosEnLinea] = useState(false);
  const [materiaEnLinea, setMateriaEnLinea] = useState('');
  const [gestionEnLinea, setGestionEnLinea] = useState('');

  const [paginaEnLinea, setPaginaEnLinea] = useState(1);
  const [resultadosEnLinea, setResultadosEnLinea] = useState<ResultadoPaginadoJurisprudencia | null>(null);
  const [buscandoEnLinea, setBuscandoEnLinea] = useState(false);
  const [errorEnLinea, setErrorEnLinea] = useState<string | null>(null);

  // ================= ESTADO DE BIBLIOTECA GUARDADA (Q6, Q7, Q10) =================
  const [textoBib, setTextoBib] = useState('');
  const [origenBib, setOrigenBib] = useState<'TODOS' | 'TSJ' | 'TCP'>('TODOS');
  const [materiaBib, setMateriaBib] = useState('');
  const [salaBib, setSalaBib] = useState('');
  const [gestionBib, setGestionBib] = useState('');
  const [paginaBib, setPaginaBib] = useState(1);
  const [resultadosBib, setResultadosBib] = useState<ResultadoPaginadoJurisprudencia | null>(null);
  const [buscandoBib, setBuscandoBib] = useState(false);
  const [errorBib, setErrorBib] = useState<string | null>(null);

  // Catálogos
  const [salasTsj, setSalasTsj] = useState<SalaTsjCatalogo[]>([]);
  const [tiposResTsj, setTiposResTsj] = useState<TipoResolucionTsjCatalogo[]>([]);

  // Modales
  const [resolucionDetalle, setResolucionDetalle] = useState<ResolucionJurisprudencia | null>(null);
  const [resolucionVincular, setResolucionVincular] = useState<ResolucionJurisprudencia | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  // Cargar salas y tipos sin preseleccionar idSalaTsj (Q1)
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

    s.jurisprudencia
      .obtenerTiposResolucionTsj()
      .then(setTiposResTsj)
      .catch(() => {});
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

    // Si la fuente no es TSJ, la modalidad siempre es simple (Q4)
    const modTsj = fuente === 'TSJ' ? (parametrosDirectos?.modalidadTsj ?? modalidadTsj) : 'simple';
    const subTsj = parametrosDirectos?.subcampoTsj ?? subcampoTsj;
    const nroResVal = parametrosDirectos?.nroResolucion ?? nroResolucion;

    const filtro: FiltroBusquedaJurisprudencia = {
      texto: parametrosDirectos?.texto ?? textoEnLinea.trim(),
      origen: fuente,
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
      idTipoResTsj: modTsj === 'gestion' ? idTipoResTsj : undefined,
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

  async function ejecutarBusquedaBiblioteca(pag = 1) {
    const idSecuencia = ++idBusquedaRef.current;
    setBuscandoBib(true);
    setErrorBib(null);
    setPaginaBib(pag);

    const filtro: FiltroBusquedaJurisprudencia = {
      texto: textoBib.trim(),
      origen: origenBib,
      materia: materiaBib || undefined,
      sala: salaBib.trim() || undefined, // Búsqueda de sala por texto en biblioteca (Q7)
      gestion: gestionBib.trim() || undefined,
      pagina: pag,
      limite: 15,
    };

    try {
      const res = await s.jurisprudencia.buscarLocal(filtro);
      if (idSecuencia === idBusquedaRef.current) {
        setResultadosBib(res);
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

  // Detección de N° de resolución en Búsqueda Simple (Q5)
  const patronResolucion = /(?:AS\/)?(\d{3,5}\/\d{4}(?:-[A-Za-z0-9]+)?)/i;
  const matchResolucion = textoEnLinea.match(patronResolucion);

  function cambiarABusquedaPorResolucion(resNum: string) {
    setModalidadTsj('campos');
    setSubcampoTsj('resolucion');
    setNroResolucion(resNum);
    ejecutarBusquedaEnLinea(1, {
      modalidadTsj: 'campos',
      subcampoTsj: 'resolucion',
      nroResolucion: resNum,
    });
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
        avisar('Eliminada de tu biblioteca local');
      } else {
        const guardada = await s.jurisprudencia.guardarEnBiblioteca(r);
        r.guardadaLocal = true;
        r.idLocal = guardada.idLocal;
        avisar('Resolución guardada en tu biblioteca local (offline)');
      }

      // Actualizar vista reactiva
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
        avisar('Abriendo archivo PDF oficial guardado');
        return;
      }
      const { buffer, nombreArchivo } = await s.jurisprudencia.descargarPdf(r);
      const ruta = await s.archivos.rutaJurisprudencia(nombreArchivo);
      await s.archivos.escribir(ruta, buffer);
      r.rutaPdf = ruta;
      avisar(`PDF guardado en disco: ${nombreArchivo}`);
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
    <div className="pagina">
      {/* Cabecera */}
      <div className="pagina-cab">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--primario)' }}>
              <Icono n="tribunal" tam={26} />
            </span>
            <h1>Jurisprudencia Boliviana</h1>
          </div>
          <p className="subtitulo">
            Consulta jurisprudencial conectada con los servicios públicos del{' '}
            <strong>Tribunal Supremo de Justicia (Génesis TSJ)</strong> y el{' '}
            <strong>Tribunal Constitucional Plurinacional (TCP)</strong>. Búsqueda exacta por Auto Supremo, expediente, gestión o términos clave, con almacenamiento local sin conexión.
          </p>
        </div>
      </div>

      {/* Pestañas principales */}
      <Pestanas items={PESTANAS} activa={pestana} cambiar={(id) => setPestana(id)} />

      {/* Panel de Filtros y Búsqueda */}
      <div className="juris-filtros-bar">
        {pestana === 'en_linea' ? (
          <>
            {/* Selector de Fuente */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div className="juris-pills-fuente">
                <span style={{ fontSize: '0.82rem', color: 'var(--texto-3)', marginRight: '4px' }}>
                  Fuente:
                </span>
                <button
                  type="button"
                  className={`juris-pill-btn ${fuente === 'TSJ' ? 'activa' : ''}`}
                  onClick={() => setFuente('TSJ')}
                >
                  🏛️ TSJ (Autos Supremos)
                </button>
                <button
                  type="button"
                  className={`juris-pill-btn ${fuente === 'TCP' ? 'activa' : ''}`}
                  onClick={() => setFuente('TCP')}
                >
                  ⚖️ TCP (Sentencias Constitucionales)
                </button>
                <button
                  type="button"
                  className={`juris-pill-btn ${fuente === 'TODOS' ? 'activa' : ''}`}
                  onClick={() => setFuente('TODOS')}
                >
                  🌐 Todas las fuentes
                </button>
              </div>

              {fuente === 'TSJ' && (
                <span style={{ fontSize: '0.8rem', color: 'var(--texto-3)' }}>
                  Génesis TSJ
                </span>
              )}
            </div>

            {/* Selector de Modalidades TSJ (visible únicamente cuando fuente es TSJ) */}
            {fuente === 'TSJ' && (
              <div className="juris-tsj-modalidades-nav">
                <button
                  type="button"
                  className={`juris-tsj-mod-btn ${modalidadTsj === 'simple' ? 'activo' : ''}`}
                  onClick={() => setModalidadTsj('simple')}
                >
                  <Icono n="buscar" tam={15} />
                  <span>Búsqueda Simple</span>
                  <span className="juris-tsj-mod-badge">Palabras clave</span>
                </button>

                <button
                  type="button"
                  className={`juris-tsj-mod-btn ${modalidadTsj === 'campos' ? 'activo' : ''}`}
                  onClick={() => setModalidadTsj('campos')}
                >
                  <Icono n="diana" tam={15} />
                  <span>Consulta por Campos</span>
                  <span className="juris-tsj-mod-badge">N° Res / Exp / Partes</span>
                </button>

                <button
                  type="button"
                  className={`juris-tsj-mod-btn ${modalidadTsj === 'gestion' ? 'activo' : ''}`}
                  onClick={() => setModalidadTsj('gestion')}
                >
                  <Icono n="calendario" tam={15} />
                  <span>Consulta por Gestión</span>
                  <span className="juris-tsj-mod-badge">Sala y Gestión</span>
                </button>

                <button
                  type="button"
                  className={`juris-tsj-mod-btn ${modalidadTsj === 'avanzada' ? 'activo' : ''}`}
                  onClick={() => setModalidadTsj('avanzada')}
                >
                  <Icono n="rayo" tam={15} />
                  <span>Búsqueda Avanzada</span>
                  <span className="juris-tsj-mod-badge">Múltiples filtros</span>
                </button>
              </div>
            )}

            {/* FORMULARIO DINÁMICO EN LÍNEA */}
            <form onSubmit={alEnviar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 1. Modalidad Simple / TCP / Ambos */}
              {(modalidadTsj === 'simple' || fuente !== 'TSJ') && (
                <div>
                  <div className="juris-busqueda-input-group">
                    <input
                      type="search"
                      className="buscar"
                      placeholder={
                        fuente === 'TCP'
                          ? 'Buscar sentencias del TCP: acción de amparo, debido proceso, 0812/2023-S3...'
                          : 'Buscar fallos: casación AND nulidad, prescripción adquisitiva, "debido proceso"...'
                      }
                      value={textoEnLinea}
                      onChange={(e) => setTextoEnLinea(e.target.value)}
                    />
                    <button type="submit" className="btn btn-pri" disabled={buscandoEnLinea}>
                      <Icono n="buscar" tam={16} /> {buscandoEnLinea ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>

                  {/* Sugerencia inteligente si escribió un N° de resolución en búsqueda simple */}
                  {fuente === 'TSJ' && matchResolucion && matchResolucion[1] && (
                    <div style={{ marginTop: '8px' }}>
                      <div className="juris-tip-box" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Icono n="diana" tam={16} />
                          <span>
                            Detectamos el número <strong>{matchResolucion[1]}</strong>. Puedes buscarlo directamente en «Consulta por Campos» para obtener el fallo exacto.
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-pri btn-sm"
                          onClick={() => cambiarABusquedaPorResolucion(matchResolucion[1])}
                        >
                          Buscar Resolución Exacta →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Chips de operadores */}
                  {fuente === 'TSJ' && (
                    <div className="juris-operadores-chips">
                      <span>Operadores:</span>
                      <button
                        type="button"
                        className="juris-chip-operador"
                        onClick={() => setTextoEnLinea((p) => `${p.trim()} AND `)}
                      >
                        + AND
                      </button>
                      <button
                        type="button"
                        className="juris-chip-operador"
                        onClick={() => setTextoEnLinea((p) => `${p.trim()} OR `)}
                      >
                        + OR
                      </button>
                      <button
                        type="button"
                        className="juris-chip-operador"
                        onClick={() => setTextoEnLinea((p) => `${p.trim()} NOT `)}
                      >
                        + NOT
                      </button>
                      <button
                        type="button"
                        className="juris-chip-operador"
                        onClick={() => setTextoEnLinea((p) => `"${p.replace(/^"|"$/g, '')}"`)}
                      >
                        + "Frase Exacta"
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Modalidad Por Campos TSJ */}
              {fuente === 'TSJ' && modalidadTsj === 'campos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="juris-subcampos-bar">
                    <span style={{ fontSize: '0.82rem', color: 'var(--texto-3)' }}>Campo:</span>
                    <button
                      type="button"
                      className={`juris-subcampo-btn ${subcampoTsj === 'resolucion' ? 'activo' : ''}`}
                      onClick={() => setSubcampoTsj('resolucion')}
                    >
                      <Icono n="documento" tam={14} /> N° de Resolución Exacto
                    </button>
                    <button
                      type="button"
                      className={`juris-subcampo-btn ${subcampoTsj === 'expediente' ? 'activo' : ''}`}
                      onClick={() => setSubcampoTsj('expediente')}
                    >
                      <Icono n="carpeta" tam={14} /> N° de Expediente
                    </button>
                    <button
                      type="button"
                      className={`juris-subcampo-btn ${subcampoTsj === 'partes' ? 'activo' : ''}`}
                      onClick={() => setSubcampoTsj('partes')}
                    >
                      <Icono n="personas" tam={14} /> Partes Procesales
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {subcampoTsj === 'resolucion' && (
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <input
                          type="search"
                          className="buscar"
                          placeholder="Ej: 0554/2026-FF, AS/0554/2026-FF, 0711/2018..."
                          value={nroResolucion}
                          onChange={(e) => setNroResolucion(e.target.value)}
                          autoFocus
                        />
                      </div>
                    )}

                    {subcampoTsj === 'expediente' && (
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <input
                          type="search"
                          className="buscar"
                          placeholder="Ej: 123/2023, 45/2022..."
                          value={nroExpediente}
                          onChange={(e) => setNroExpediente(e.target.value)}
                          autoFocus
                        />
                      </div>
                    )}

                    {subcampoTsj === 'partes' && (
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <input
                          type="search"
                          className="buscar"
                          placeholder="Nombre de demandante, demandado o recurrente..."
                          value={partes}
                          onChange={(e) => setPartes(e.target.value)}
                          autoFocus
                        />
                      </div>
                    )}

                    <div style={{ width: '220px' }}>
                      <select
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
                    </div>

                    <button type="submit" className="btn btn-pri" disabled={buscandoEnLinea}>
                      <Icono n="buscar" tam={16} /> {buscandoEnLinea ? 'Consultando...' : 'Buscar'}
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Modalidad Consulta por Gestión TSJ */}
              {fuente === 'TSJ' && modalidadTsj === 'gestion' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="juris-grid-gestion">
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                        Sala Institucional *
                      </label>
                      <select
                        value={idSalaGestionTsj ?? (salasTsj[0]?.id || '')}
                        onChange={(e) => setIdSalaGestionTsj(Number(e.target.value))}
                        required
                      >
                        {salasTsj.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                        Gestión (Año) *
                      </label>
                      <select
                        value={gestionTsj}
                        onChange={(e) => setGestionTsj(e.target.value)}
                        required
                      >
                        {ANIOS_GESTION.map((y) => (
                          <option key={y} value={String(y)}>
                            Gestión {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                        Tipo de Resolución
                      </label>
                      <select
                        value={idTipoResTsj ?? ''}
                        onChange={(e) => setIdTipoResTsj(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Todos los tipos</option>
                        {tiposResTsj.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button
                        type="submit"
                        className="btn btn-pri"
                        style={{ width: '100%', height: '38px' }}
                        disabled={buscandoEnLinea}
                      >
                        <Icono n="buscar" tam={16} /> {buscandoEnLinea ? 'Consultando...' : 'Consultar Gestión'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Modalidad Búsqueda Avanzada TSJ */}
              {fuente === 'TSJ' && modalidadTsj === 'avanzada' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="juris-grid-avanzada">
                    <div className="juris-campo-avanzado">
                      <label>
                        <span style={{ color: 'var(--primario)' }}>●</span> Todas estas palabras
                        <span className="sub">(Obligatorias · AND)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: contrato incumplimiento resolución"
                        value={palabrasTodas}
                        onChange={(e) => {
                          setPalabrasTodas(e.target.value);
                          if (e.target.value) {
                            setFraseExacta('');
                            setPalabrasCualquiera('');
                          }
                        }}
                      />
                    </div>

                    <div className="juris-campo-avanzado">
                      <label>
                        <span style={{ color: 'var(--exito, #16a34a)' }}>●</span> Esta palabra o frase exacta
                        <span className="sub">(Coincidencia literal)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: falta de legitimación pasiva"
                        value={fraseExacta}
                        onChange={(e) => {
                          setFraseExacta(e.target.value);
                          if (e.target.value) {
                            setPalabrasTodas('');
                            setPalabrasCualquiera('');
                          }
                        }}
                      />
                    </div>

                    <div className="juris-campo-avanzado">
                      <label>
                        <span style={{ color: 'var(--aviso, #d97706)' }}>●</span> Cualquiera de estas palabras
                        <span className="sub">(Alternativas · OR)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: usucapión prescripción posesión"
                        value={palabrasCualquiera}
                        onChange={(e) => {
                          setPalabrasCualquiera(e.target.value);
                          if (e.target.value) {
                            setPalabrasTodas('');
                            setFraseExacta('');
                          }
                        }}
                      />
                    </div>

                    <div className="juris-campo-avanzado">
                      <label>
                        <span style={{ color: 'var(--error, #dc2626)' }}>●</span> Ninguna de estas palabras
                        <span className="sub">(Exclusión · NOT)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: penal flagrancia detención"
                        value={palabrasExcluir}
                        onChange={(e) => setPalabrasExcluir(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                        Sala TSJ
                      </label>
                      <select
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
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                        Gestión (Año)
                      </label>
                      <select value={gestionAvanzada} onChange={(e) => setGestionAvanzada(e.target.value)}>
                        <option value="">Cualquier gestión</option>
                        {ANIOS_GESTION.map((y) => (
                          <option key={y} value={String(y)}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                        Materia
                      </label>
                      <select value={materiaAvanzada} onChange={(e) => setMateriaAvanzada(e.target.value)}>
                        <option value="">Todas las materias</option>
                        <option value="Civil">Civil</option>
                        <option value="Penal">Penal</option>
                        <option value="Social">Social</option>
                        <option value="Contencioso">Contencioso Administrativo</option>
                      </select>
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="btn btn-pri"
                        style={{ width: '100%', height: '38px' }}
                        disabled={buscandoEnLinea}
                      >
                        <Icono n="rayo" tam={16} /> {buscandoEnLinea ? 'Buscando...' : 'Búsqueda Avanzada'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Filtros colapsables para Búsqueda Simple */}
              {modalidadTsj === 'simple' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-fan"
                    onClick={() => setMostrarFiltrosEnLinea((p) => !p)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <Icono n="ajustes" tam={14} />{' '}
                    {mostrarFiltrosEnLinea ? 'Ocultar filtros adicionales' : 'Filtros adicionales'}
                  </button>
                </div>
              )}

              {mostrarFiltrosEnLinea && modalidadTsj === 'simple' && (
                <div className="juris-filtros-avanzados">
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                      Materia
                    </label>
                    <select value={materiaEnLinea} onChange={(e) => setMateriaEnLinea(e.target.value)}>
                      <option value="">Todas las materias</option>
                      <option value="Civil">Civil</option>
                      <option value="Penal">Penal</option>
                      <option value="Social">Social / Laboral</option>
                      <option value="Contencioso">Contencioso Administrativo</option>
                      <option value="Familia">Familia</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                      Gestión (Año)
                    </label>
                    <select value={gestionEnLinea} onChange={(e) => setGestionEnLinea(e.target.value)}>
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
            </form>
          </>
        ) : (
          /* ================= PANEL DE BÚSQUEDA EN BIBLIOTECA (Q6, Q7, Q10) ================= */
          <form onSubmit={alEnviar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="juris-busqueda-input-group">
              <input
                type="search"
                className="buscar"
                placeholder="Buscar en fallos guardados por texto, número de resolución o resumen..."
                value={textoBib}
                onChange={(e) => setTextoBib(e.target.value)}
              />
              <button type="submit" className="btn btn-pri" disabled={buscandoBib}>
                <Icono n="buscar" tam={16} /> {buscandoBib ? 'Buscando...' : 'Buscar en Biblioteca'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                  Origen
                </label>
                <select value={origenBib} onChange={(e) => setOrigenBib(e.target.value as 'TODOS' | 'TSJ' | 'TCP')}>
                  <option value="TODOS">Todos los orígenes (TSJ y TCP)</option>
                  <option value="TSJ">Tribunal Supremo (TSJ)</option>
                  <option value="TCP">Tribunal Constitucional (TCP)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                  Sala
                </label>
                <input
                  type="text"
                  placeholder="Ej: Sala Penal, Civil..."
                  value={salaBib}
                  onChange={(e) => setSalaBib(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                  Materia
                </label>
                <input
                  type="text"
                  placeholder="Ej: Civil, Penal, Amparo..."
                  value={materiaBib}
                  onChange={(e) => setMateriaBib(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                  Gestión (Año)
                </label>
                <input
                  type="text"
                  placeholder="Ej: 2024..."
                  value={gestionBib}
                  onChange={(e) => setGestionBib(e.target.value)}
                />
              </div>
            </div>
          </form>
        )}
      </div>

      {errorActual && <Aviso error={errorActual} />}

      {/* Resultados de Búsqueda */}
      {buscandoActual ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--texto-3)' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
            {pestana === 'en_linea' ? 'Consultando servidores de jurisprudencia...' : 'Buscando en tu base de datos local...'}
          </p>
          <span style={{ fontSize: '0.88rem' }}>Cargando resultados...</span>
        </div>
      ) : resultadosActuales && resultadosActuales.items.length > 0 ? (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
              color: 'var(--texto-3)',
              fontSize: '0.9rem',
            }}
          >
            <span>
              <strong>{resultadosActuales.total.toLocaleString()}</strong> resoluciones encontradas
            </span>
            <span>
              Página {resultadosActuales.pagina} de {resultadosActuales.totalPaginas}
            </span>
          </div>

          <div className="juris-lista-resultados">
            {resultadosActuales.items.map((r) => (
              <div key={`${r.origen}-${r.id}`} className="juris-tarjeta">
                <div className="juris-tarjeta-cab">
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <Insignia tono={r.origen === 'TSJ' ? 'ambar' : 'azul'}>
                        {r.origen === 'TSJ' ? 'TSJ' : 'TCP'} · {r.tipoResolucion}
                      </Insignia>
                      {r.sala && <Insignia tono="gris">{r.sala}</Insignia>}
                      {r.departamento && <Insignia tono="gris">{r.departamento}</Insignia>}
                      {r.guardadaLocal && <Insignia tono="verde">En Biblioteca</Insignia>}
                      {r.fechaEmision && (
                        <span style={{ fontSize: '0.82rem', color: 'var(--texto-3)' }}>
                          {r.fechaEmision}
                        </span>
                      )}
                    </div>

                    {/* Título de resolución con accesibilidad para teclado */}
                    <button
                      type="button"
                      className="juris-tarjeta-titulo"
                      style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => setResolucionDetalle(r)}
                      title="Ver resolución completa"
                    >
                      {r.tipoResolucion} {r.numeroResolucion}
                      {r.numeroExpediente && ` (Exp. ${r.numeroExpediente})`}
                    </button>
                  </div>
                </div>

                {/* Partes procesales si están presentes */}
                {(r.demandante || r.demandado) && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--texto-2)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {r.demandante && <span><strong>Demandante:</strong> {r.demandante}</span>}
                    {r.demandado && <span><strong>Demandado:</strong> {r.demandado}</span>}
                  </div>
                )}

                {/* Extracto resumido */}
                {r.resumen && (
                  <div
                    className="juris-tarjeta-extracto"
                    dangerouslySetInnerHTML={{ __html: sanearTextoExtracto(r.resumen) }}
                  />
                )}

                {/* Botonera de acciones rápidas */}
                <div className="juris-tarjeta-acciones">
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-sec btn-sm"
                      onClick={() => setResolucionDetalle(r)}
                      title="Leer resolución completa"
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
                      <Icono n="carpeta" tam={14} /> Vincular a Caso
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-sec btn-sm"
                      onClick={() => descargarPdf(r)}
                      disabled={procesandoId === r.id}
                      title="Descargar archivo PDF oficial"
                    >
                      <Icono n="documento" tam={14} /> {r.rutaPdf ? 'Abrir PDF' : 'Descargar PDF'}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${r.guardadaLocal ? 'btn-sec' : 'btn-pri'}`}
                      onClick={() => alternarGuardado(r)}
                      disabled={procesandoId === r.id}
                      title={r.guardadaLocal ? 'Quitar de mi biblioteca' : 'Guardar en mi biblioteca local'}
                    >
                      <Icono n={r.guardadaLocal ? 'ok' : 'mas'} tam={14} />{' '}
                      {r.guardadaLocal ? 'Guardada' : 'Guardar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Paginación */}
          {resultadosActuales.totalPaginas > 1 && (
            <div className="juris-paginacion">
              <button
                type="button"
                className="btn btn-sec"
                disabled={paginaActual <= 1}
                onClick={() =>
                  pestana === 'en_linea'
                    ? ejecutarBusquedaEnLinea(paginaActual - 1)
                    : ejecutarBusquedaBiblioteca(paginaActual - 1)
                }
              >
                ← Anterior
              </button>
              <span style={{ fontSize: '0.9rem', color: 'var(--texto-2)', padding: '0 8px' }}>
                Página {paginaActual} de {resultadosActuales.totalPaginas}
              </span>
              <button
                type="button"
                className="btn btn-sec"
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
          texto="No se encontraron fallos o autos supremos con los criterios indicados. Prueba ampliando la búsqueda o verificando los filtros."
          icono="buscar"
        />
      ) : pestana === 'biblioteca' ? (
        <Vacio
          titulo="Tu biblioteca de jurisprudencia está vacía"
          texto="Busca sentencias constitucionales o autos supremos en la pestaña «Búsqueda en Línea» y presiona «Guardar» para tenerlos disponibles sin conexión."
          icono="libro"
        />
      ) : (
        <Vacio
          titulo="Buscador de Jurisprudencia"
          texto="Ingresa términos jurídicos o selecciona una modalidad de consulta arriba para explorar resoluciones de los tribunales bolivianos."
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
            } else {
              ejecutarBusquedaEnLinea(paginaEnLinea);
            }
          }}
          abrirVincular={() => {
            const r = resolucionDetalle;
            setResolucionDetalle(null);
            setResolucionVincular(r);
          }}
        />
      )}

      {/* Modal para Vincular a Expediente */}
      {resolucionVincular && (
        <VincularExpedienteModal
          resolucion={resolucionVincular}
          cerrar={() => setResolucionVincular(null)}
          alVincular={() => {
            if (pestana === 'biblioteca') {
              ejecutarBusquedaBiblioteca(paginaBib);
            } else {
              setResultadosEnLinea((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  items: prev.items.map((it) =>
                    it.numeroResolucion === resolucionVincular.numeroResolucion && it.origen === resolucionVincular.origen
                      ? { ...it, guardadaLocal: true }
                      : it
                  ),
                };
              });
            }
          }}
        />
      )}
    </div>
  );
}
