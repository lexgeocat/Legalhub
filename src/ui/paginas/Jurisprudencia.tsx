import { useEffect, useState, type FormEvent } from 'react';
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

type PestanaJuris = 'en_linea' | 'biblioteca';

const PESTANAS: { id: PestanaJuris; etiqueta: string }[] = [
  { id: 'en_linea', etiqueta: 'Búsqueda en Línea (TSJ / TCP)' },
  { id: 'biblioteca', etiqueta: 'Mi Biblioteca Guardada' },
];

const ANIOS_GESTION = Array.from({ length: 27 }, (_, i) => 2026 - i);

export function Jurisprudencia() {
  const s = useServicios();
  const [pestana, setPestana] = useState<PestanaJuris>('en_linea');

  // Fuente y filtros generales
  const [origen, setOrigen] = useState<'TODOS' | 'TSJ' | 'TCP'>('TSJ');
  const [texto, setTexto] = useState('');
  const [materia, setMateria] = useState('');
  const [sala, setSala] = useState('');
  const [gestion, setGestion] = useState('');
  const [pagina, setPagina] = useState(1);
  const [mostrarAvanzados, setMostrarAvanzados] = useState(false);

  // 4 Modalidades específicas de TSJ Génesis
  const [modalidadTsj, setModalidadTsj] = useState<ModalidadBusquedaTsj>('simple');
  const [subcampoTsj, setSubcampoTsj] = useState<SubcampoBusquedaTsj>('resolucion');
  const [nroResolucion, setNroResolucion] = useState('');
  const [nroExpediente, setNroExpediente] = useState('');
  const [partes, setPartes] = useState('');
  const [idSalaTsj, setIdSalaTsj] = useState<number | null>(null);
  const [idTipoResTsj, setIdTipoResTsj] = useState<number | null>(null);

  // Búsqueda Avanzada
  const [palabrasTodas, setPalabrasTodas] = useState('');
  const [fraseExacta, setFraseExacta] = useState('');
  const [palabrasCualquiera, setPalabrasCualquiera] = useState('');
  const [palabrasExcluir, setPalabrasExcluir] = useState('');

  // Catálogos TSJ
  const [salasTsj, setSalasTsj] = useState<SalaTsjCatalogo[]>([]);
  const [tiposResTsj, setTiposResTsj] = useState<TipoResolucionTsjCatalogo[]>([]);

  // Estados de consulta y resultados
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoPaginadoJurisprudencia | null>(null);

  const [resolucionDetalle, setResolucionDetalle] = useState<ResolucionJurisprudencia | null>(null);
  const [resolucionVincular, setResolucionVincular] = useState<ResolucionJurisprudencia | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  // Cargar catálogos de salas del TSJ al inicio
  useEffect(() => {
    s.jurisprudencia
      .obtenerSalasTsj()
      .then((salas) => {
        setSalasTsj(salas);
        // Si no hay sala seleccionada y se usa Gestión, preseleccionar la primera sala
        if (salas.length > 0 && !idSalaTsj) {
          setIdSalaTsj(salas[0].id);
        }
      })
      .catch(() => {});

    s.jurisprudencia
      .obtenerTiposResolucionTsj()
      .then(setTiposResTsj)
      .catch(() => {});
  }, [s]);

  // Cargar biblioteca cuando cambia a la pestaña 'biblioteca'
  useEffect(() => {
    if (pestana === 'biblioteca') {
      ejecutarBusqueda(1, 'biblioteca');
    }
  }, [pestana]);

  async function ejecutarBusqueda(
    pag = 1,
    modo: PestanaJuris = pestana,
    overrideModalidad?: ModalidadBusquedaTsj,
    overrideNroRes?: string
  ) {
    setBuscando(true);
    setError(null);
    setPagina(pag);

    const modTsj = overrideModalidad ?? modalidadTsj;
    const nroResVal = overrideNroRes !== undefined ? overrideNroRes : nroResolucion;

    const filtro: FiltroBusquedaJurisprudencia = {
      texto: texto.trim(),
      origen,
      materia: materia || undefined,
      sala: sala || undefined,
      gestion: gestion || undefined,
      pagina: pag,
      limite: 15,

      // Modalidades TSJ
      modalidadTsj: modTsj,
      subcampoTsj,
      nroResolucion: nroResVal.trim() || undefined,
      nroExpediente: nroExpediente.trim() || undefined,
      partes: partes.trim() || undefined,
      idSalaTsj: idSalaTsj || undefined,
      idTipoResTsj: idTipoResTsj || undefined,
      palabrasTodas: palabrasTodas.trim() || undefined,
      fraseExacta: fraseExacta.trim() || undefined,
      palabrasCualquiera: palabrasCualquiera.trim() || undefined,
      palabrasExcluir: palabrasExcluir.trim() || undefined,
    };

    try {
      if (modo === 'biblioteca') {
        const res = await s.jurisprudencia.buscarLocal(filtro);
        setResultados(res);
      } else {
        const res = await s.jurisprudencia.buscarEnLinea(filtro);
        setResultados(res);
      }
    } catch (err) {
      setError(mensajeError(err));
      setResultados(null);
    } finally {
      setBuscando(false);
    }
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    ejecutarBusqueda(1);
  }

  function insertarOperador(op: string) {
    setTexto((prev) => {
      const espacio = prev.endsWith(' ') || prev === '' ? '' : ' ';
      return `${prev}${espacio}${op} `;
    });
  }

  // Detección inteligente si el usuario escribió un N° de resolución en Búsqueda Simple
  const patronResolucion = /(?:AS\/)?(\d{3,5}\/\d{4}(?:-[A-Za-z0-9]+)?)/i;
  const matchResolucion = texto.match(patronResolucion);

  function cambiarABusquedaPorResolucion(resNum: string) {
    setModalidadTsj('campos');
    setSubcampoTsj('resolucion');
    setNroResolucion(resNum);
    ejecutarBusqueda(1, pestana, 'campos', resNum);
  }

  async function copiarCita(r: ResolucionJurisprudencia) {
    const cita = formatearCitaJurisprudencial(r);
    try {
      await navigator.clipboard.writeText(cita);
      avisar('Cita jurídica formal copiada al portapapeles');
    } catch {
      avisar('No se pudo copiar al portapapeles');
    }
  }

  async function alternarGuardado(r: ResolucionJurisprudencia) {
    setProcesandoId(r.id);
    try {
      if (r.guardadaLocal) {
        await s.jurisprudencia.eliminarDeBiblioteca(r.id);
        avisar('Eliminada de tu biblioteca local');
      } else {
        await s.jurisprudencia.guardarEnBiblioteca(r);
        avisar('Resolución guardada en tu biblioteca local (offline)');
      }
      if (resultados) {
        setResultados({
          ...resultados,
          items: resultados.items.map((it) =>
            it.id === r.id ? { ...it, guardadaLocal: !it.guardadaLocal } : it
          ),
        });
      }
      if (pestana === 'biblioteca') {
        ejecutarBusqueda(pagina, 'biblioteca');
      }
    } catch (err) {
      avisar(`Error: ${mensajeError(err)}`);
    } finally {
      setProcesandoId(null);
    }
  }

  async function descargarPdf(r: ResolucionJurisprudencia) {
    setProcesandoId(r.id);
    try {
      const { buffer, nombreArchivo } = await s.jurisprudencia.descargarPdf(r);
      const ruta = await s.archivos.rutaJurisprudencia(nombreArchivo);
      await s.archivos.escribir(ruta, buffer);
      avisar(`PDF descargado: ${nombreArchivo}`);
      await s.archivos.abrir(ruta);
    } catch (err) {
      avisar(`No se pudo descargar el PDF: ${mensajeError(err)}`);
    } finally {
      setProcesandoId(null);
    }
  }

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
            Módulo oficial de consulta jurisprudencial integrado con los servidores de{' '}
            <strong>Tribunal Supremo de Justicia (Génesis TSJ)</strong> y el{' '}
            <strong>Tribunal Constitucional Plurinacional (TCP)</strong>. Búsqueda exacta por Auto Supremo, expediente, gestión o palabras clave con descarga directa de PDF y almacenamiento local sin conexión.
          </p>
        </div>
      </div>

      {/* Pestañas de modo principal */}
      <Pestanas items={PESTANAS} activa={pestana} cambiar={(id) => setPestana(id)} />

      {/* Panel de Búsqueda y Filtros */}
      <div className="juris-filtros-bar">
        {/* Selector de Fuente institucional */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div className="juris-pills-fuente">
            <span style={{ fontSize: '0.82rem', color: 'var(--texto-3)', marginRight: '4px' }}>
              Fuente:
            </span>
            <button
              type="button"
              className={`juris-pill-btn ${origen === 'TSJ' ? 'activa' : ''}`}
              onClick={() => setOrigen('TSJ')}
            >
              🏛️ TSJ (Autos Supremos · Génesis)
            </button>
            <button
              type="button"
              className={`juris-pill-btn ${origen === 'TCP' ? 'activa' : ''}`}
              onClick={() => setOrigen('TCP')}
            >
              ⚖️ TCP (Sentencias Constitucionales)
            </button>
            <button
              type="button"
              className={`juris-pill-btn ${origen === 'TODOS' ? 'activa' : ''}`}
              onClick={() => setOrigen('TODOS')}
            >
              🌐 Todas las fuentes
            </button>
          </div>

          {pestana === 'en_linea' && origen === 'TSJ' && (
            <span style={{ fontSize: '0.8rem', color: 'var(--texto-3)' }}>
              Conexión directa a API Génesis TSJ
            </span>
          )}
        </div>

        {/* 4 MODALIDADES DE TSJ GÉNESIS (cuando TSJ está activo) */}
        {pestana === 'en_linea' && origen === 'TSJ' && (
          <div className="juris-tsj-modalidades-nav">
            <button
              type="button"
              className={`juris-tsj-mod-btn ${modalidadTsj === 'simple' ? 'activo' : ''}`}
              onClick={() => setModalidadTsj('simple')}
            >
              <Icono n="buscar" tam={15} />
              <span>Búsqueda Simple</span>
              <span className="juris-tsj-mod-badge">Palabras / Operadores</span>
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
              <span className="juris-tsj-mod-badge">Múltiples Criterios</span>
            </button>
          </div>
        )}

        {/* FORMULARIO DINÁMICO SEGÚN LA MODALIDAD */}
        <form onSubmit={alEnviar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* ================= 1. BÚSQUEDA SIMPLE (O MODO BIBLIOTECA O TCP/TODOS) ================= */}
          {(modalidadTsj === 'simple' || origen !== 'TSJ' || pestana === 'biblioteca') && (
            <div>
              <div className="juris-busqueda-input-group">
                <input
                  type="search"
                  className="buscar"
                  placeholder={
                    pestana === 'biblioteca'
                      ? 'Buscar en resoluciones guardadas: debido proceso, contrato, sala civil...'
                      : origen === 'TCP'
                      ? 'Buscar sentencias del TCP: acción de amparo, debido proceso, 0812/2023-S3...'
                      : 'Búsqueda por palabras clave o frases exactas: ej. casación AND nulidad, "debido proceso"...'
                  }
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
                <button type="submit" className="btn btn-pri" disabled={buscando}>
                  <Icono n="buscar" tam={16} /> {buscando ? 'Buscando...' : 'Buscar'}
                </button>
              </div>

              {/* Sugerencia inteligente si detecta número de resolución en búsqueda simple */}
              {origen === 'TSJ' && matchResolucion && matchResolucion[1] && (
                <div style={{ marginTop: '8px' }}>
                  <div className="juris-tip-box" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icono n="diana" tam={16} />
                      <span>
                        Detectamos el número <strong>{matchResolucion[1]}</strong>. En «Búsqueda Simple» se buscan coincidencias de texto. Para consultar el fallo exacto en milisegundos, usa <strong>Consulta por Campos</strong>.
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

              {/* Barra de operadores lógicos rápidos */}
              {origen === 'TSJ' && (
                <div className="juris-operadores-chips">
                  <span>Operadores TSJ:</span>
                  <button
                    type="button"
                    className="juris-chip-operador"
                    onClick={() => insertarOperador('AND')}
                    title="Ambos términos deben estar presentes obligatoriamente"
                  >
                    + AND
                  </button>
                  <button
                    type="button"
                    className="juris-chip-operador"
                    onClick={() => insertarOperador('OR')}
                    title="Cualquiera de los términos puede estar presente"
                  >
                    + OR
                  </button>
                  <button
                    type="button"
                    className="juris-chip-operador"
                    onClick={() => insertarOperador('NOT')}
                    title="Excluir resoluciones que contengan este término"
                  >
                    + NOT
                  </button>
                  <button
                    type="button"
                    className="juris-chip-operador"
                    onClick={() => setTexto((prev) => `"${prev.replace(/^"|"$/g, '')}"`)}
                    title="Buscar frase exacta entre comillas"
                  >
                    + "Frase Exacta"
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ================= 2. CONSULTA POR CAMPOS TSJ ================= */}
          {pestana === 'en_linea' && origen === 'TSJ' && modalidadTsj === 'campos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Segmentador de Subcampos */}
              <div className="juris-subcampos-bar">
                <span style={{ fontSize: '0.82rem', color: 'var(--texto-3)' }}>Campo específico:</span>
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

              {/* Inputs específicos para cada subcampo */}
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
                      placeholder="Nombre de demandante, demandado o recurrente (ej: Banco Mercantil, YPFB...)"
                      value={partes}
                      onChange={(e) => setPartes(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}

                {/* Filtro opcional de Sala */}
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

                <button type="submit" className="btn btn-pri" disabled={buscando}>
                  <Icono n="buscar" tam={16} /> {buscando ? 'Consultando...' : 'Buscar'}
                </button>
              </div>

              <div className="juris-tip-box">
                <Icono n="diana" tam={16} />
                <span>
                  {subcampoTsj === 'resolucion'
                    ? 'La búsqueda por N° de resolución consulta directamente el libro maestro del TSJ y devuelve el Auto Supremo exacto.'
                    : subcampoTsj === 'expediente'
                    ? 'Consulta todas las resoluciones dictadas en relación a un número de expediente procesal.'
                    : 'Filtra resoluciones del TSJ donde figuren los nombres o personas jurídicas indicadas.'}
                </span>
              </div>
            </div>
          )}

          {/* ================= 3. CONSULTA POR GESTIÓN TSJ ================= */}
          {pestana === 'en_linea' && origen === 'TSJ' && modalidadTsj === 'gestion' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="juris-grid-gestion">
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                    Sala Institucional (Requerido) *
                  </label>
                  <select
                    value={idSalaTsj ?? (salasTsj[0]?.id || '')}
                    onChange={(e) => setIdSalaTsj(Number(e.target.value))}
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
                    value={gestion || '2026'}
                    onChange={(e) => setGestion(e.target.value)}
                    required
                  >
                    {ANIOS_GESTION.map((y) => (
                      <option key={y} value={y}>
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
                  <button type="submit" className="btn btn-pri" style={{ width: '100%', height: '38px' }} disabled={buscando}>
                    <Icono n="buscar" tam={16} /> {buscando ? 'Consultando...' : 'Consultar Gestión'}
                  </button>
                </div>
              </div>

              <div className="juris-tip-box">
                <Icono n="calendario" tam={16} />
                <span>
                  Permite explorar sistemáticamente todos los Autos Supremos, Sentencias y Resoluciones dictadas por una Sala del Tribunal Supremo en un año de gestión judicial específico.
                </span>
              </div>
            </div>
          )}

          {/* ================= 4. BÚSQUEDA AVANZADA TSJ ================= */}
          {pestana === 'en_linea' && origen === 'TSJ' && modalidadTsj === 'avanzada' && (
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

              {/* Filtros complementarios para búsqueda avanzada */}
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
                  <select value={gestion} onChange={(e) => setGestion(e.target.value)}>
                    <option value="">Cualquier gestión</option>
                    {ANIOS_GESTION.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                    Materia
                  </label>
                  <select value={materia} onChange={(e) => setMateria(e.target.value)}>
                    <option value="">Todas las materias</option>
                    <option value="Civil">Civil</option>
                    <option value="Penal">Penal</option>
                    <option value="Social">Social</option>
                    <option value="Contencioso">Contencioso Administrativo</option>
                  </select>
                </div>

                <div>
                  <button type="submit" className="btn btn-pri" style={{ width: '100%', height: '38px' }} disabled={buscando}>
                    <Icono n="rayo" tam={16} /> {buscando ? 'Buscando...' : 'Búsqueda Avanzada'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Filtros avanzados adicionales para Búsqueda Simple o TCP */}
          {modalidadTsj === 'simple' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-fan"
                onClick={() => setMostrarAvanzados((prev) => !prev)}
                style={{ fontSize: '0.85rem' }}
              >
                <Icono n="ajustes" tam={14} />{' '}
                {mostrarAvanzados ? 'Ocultar filtros adicionales' : 'Filtros adicionales (Materia / Sala / Gestión)'}
              </button>
            </div>
          )}

          {mostrarAvanzados && modalidadTsj === 'simple' && (
            <div className="juris-filtros-avanzados">
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                  Materia
                </label>
                <select value={materia} onChange={(e) => setMateria(e.target.value)}>
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
                  Sala
                </label>
                {origen === 'TSJ' && salasTsj.length > 0 ? (
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
                ) : (
                  <input
                    type="text"
                    placeholder="Ej: Sala Primera, Sala Civil..."
                    value={sala}
                    onChange={(e) => setSala(e.target.value)}
                  />
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--texto-3)', display: 'block', marginBottom: '4px' }}>
                  Gestión (Año)
                </label>
                <select value={gestion} onChange={(e) => setGestion(e.target.value)}>
                  <option value="">Todas las gestiones</option>
                  {ANIOS_GESTION.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </form>
      </div>

      {error && <Aviso error={error} />}

      {/* Resultados de Búsqueda */}
      {buscando ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--texto-3)' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
            Consultando servidores oficiales de {origen === 'TODOS' ? 'TSJ y TCP' : origen}...
          </p>
          <span style={{ fontSize: '0.88rem' }}>Obteniendo resoluciones y precedentes...</span>
        </div>
      ) : resultados && resultados.items.length > 0 ? (
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
              <strong>{resultados.total.toLocaleString()}</strong> resoluciones encontradas
            </span>
            <span>
              Página {resultados.pagina} de {resultados.totalPaginas}
            </span>
          </div>

          <div className="juris-lista-resultados">
            {resultados.items.map((r) => (
              <div key={`${r.origen}-${r.id}`} className="juris-tarjeta">
                <div className="juris-tarjeta-cab">
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <Insignia tono={r.origen === 'TSJ' ? 'ambar' : 'azul'}>
                        {r.origen === 'TSJ' ? 'TSJ · Auto Supremo' : 'TCP · Sentencia Constitucional'}
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
                    <h3
                      className="juris-tarjeta-titulo"
                      onClick={() => setResolucionDetalle(r)}
                      title="Ver resolución completa"
                    >
                      {r.tipoResolucion} {r.numeroResolucion}
                      {r.numeroExpediente && ` (Exp. ${r.numeroExpediente})`}
                    </h3>
                  </div>
                </div>

                {/* Partes procesales si están presentes en la cabecera */}
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
                      <Icono n="documento" tam={14} /> Descargar PDF
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
          {resultados.totalPaginas > 1 && (
            <div className="juris-paginacion">
              <button
                type="button"
                className="btn btn-sec"
                disabled={pagina <= 1}
                onClick={() => ejecutarBusqueda(pagina - 1)}
              >
                ← Anterior
              </button>
              <span style={{ fontSize: '0.9rem', color: 'var(--texto-2)', padding: '0 8px' }}>
                Página {pagina} de {resultados.totalPaginas}
              </span>
              <button
                type="button"
                className="btn btn-sec"
                disabled={pagina >= resultados.totalPaginas}
                onClick={() => ejecutarBusqueda(pagina + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      ) : resultados ? (
        <Vacio
          titulo="Sin resultados coincidentes"
          texto="No se encontraron fallos o autos supremos con los términos y filtros indicados. Prueba ampliando los criterios o seleccionando otra Sala / Gestión."
          icono="buscar"
        />
      ) : pestana === 'biblioteca' ? (
        <Vacio
          titulo="Tu biblioteca de jurisprudencia está vacía"
          texto="Busca sentencias constitucionales o autos supremos en la pestaña «Búsqueda en Línea» y presiona «Guardar» para tenerlos disponibles sin conexión y vinculados a tus casos."
          icono="libro"
        />
      ) : (
        <Vacio
          titulo="Consulta de Jurisprudencia TSJ y TCP"
          texto="Selecciona la modalidad de búsqueda arriba (por número de resolución, por campos, por gestión o simple) para consultar directamente la base oficial de fallos judiciales."
          icono="tribunal"
        />
      )}

      {/* Modal de Detalle */}
      {resolucionDetalle && (
        <DetalleResolucionModal
          resolucion={resolucionDetalle}
          cerrar={() => setResolucionDetalle(null)}
          alCambiarGuardado={() => ejecutarBusqueda(pagina)}
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
        />
      )}
    </div>
  );
}
