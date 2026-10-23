// src/ui/paginas/LexAi.tsx
import { save } from '@tauri-apps/plugin-dialog';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ley } from '../../application/casosDeUso/leyes';
import { recopilarGroundingLeyes } from '../../application/ai/groundingLeyes';
import {
  buscarJurisprudenciaWeb,
  ETIQUETAS_AMBITO,
  type AmbitoJuridico,
} from '../../application/ai/busquedaJuridicaWeb';
import {
  CAMPOS_IA,
  PROVEEDORES_IA,
  consultarLexAi,
  guardarConfigIa,
  obtenerConfigIa,
  type ConfigIa,
  type MensajeChatLex,
  type ModoUsuario,
} from '../../application/ai/proveedoresIa';
import { crearProtector } from '../../application/ai/textoConsulta';
import { Icono, Insignia, avisar } from '../_core/comunes';
import { useCargar, useServicios } from '../_core/servicios';
import { ModalConfiguracionIa } from '../lexai/ModalConfiguracionIa';
import { ModalGuardarEnExpediente } from '../lexai/ModalGuardarEnExpediente';
import { RenderEscrito } from '../lexai/RenderEscrito';
import { construirDocx, limpiarParaPortapapeles } from '../lexai/escrito';
import './LexAi.css';

const SUGERENCIAS_PROMPT: { modo: ModoUsuario; texto: string }[] = [
  {
    modo: 'consulta',
    texto: '¿Qué jurisprudencia del Tribunal Supremo de Bolivia rige para la resolución de contrato por incumplimiento?',
  },
  {
    modo: 'consulta',
    texto: 'Fundamenta la garantía del debido proceso y plazo razonable citando el Pacto de San José y la Corte IDH.',
  },
  {
    modo: 'redaccion',
    texto: 'Redacta una demanda ejecutiva de cobro de dinero por pagaré impago con conminatoria de embargo de bienes.',
  },
  {
    modo: 'consulta',
    texto: '¿Cuáles son los requisitos de la prescripción adquisitiva según el Código Civil boliviano y Autos Supremos?',
  },
  {
    modo: 'revision',
    texto: 'Revisa este proyecto de memorial de excepción previa de incompetencia e indícame riesgos procesales y normas aplicables.',
  },
];

export default function LexAi() {
  const s = useServicios();
  const listaLeyes = useCargar(() => s.leyes.listar(), []);

  // Configuración de IA
  const [configIa, setConfigIa] = useState<ConfigIa>(obtenerConfigIa);
  const [modalConfigAbierto, setModalConfigAbierto] = useState(false);
  const [modalExpedienteTexto, setModalExpedienteTexto] = useState<string | null>(null);

  // Leyes que provienen del módulo Leyes
  const leyesDisponibles = useMemo<Ley[]>(() => {
    return listaLeyes.datos ?? [];
  }, [listaLeyes.datos]);

  // Selección de leyes para Grounding (con persistencia en sesión)
  const [leyesSeleccionadas, setLeyesSeleccionadas] = useState<Set<string>>(() => {
    try {
      const guardado = sessionStorage.getItem('lexai_leyes_seleccionadas');
      return guardado ? new Set(JSON.parse(guardado)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [filtroLeyes, setFiltroLeyes] = useState('');
  const [panelFuentesVisible, setPanelFuentesVisible] = useState(true);
  const inicializadoLeyesRef = useRef(false);

  // Inicializar selección solo si no había nada guardado
  useEffect(() => {
    if (!inicializadoLeyesRef.current && leyesDisponibles.length > 0) {
      inicializadoLeyesRef.current = true;
      if (leyesSeleccionadas.size === 0) {
        // Seleccionar por defecto leyes que tienen artículos reales estructurados
        const conArticulos = leyesDisponibles.filter((l) => (l.numArticulos ?? 0) > 0);
        const iniciales = conArticulos.length > 0 ? conArticulos : leyesDisponibles;
        setLeyesSeleccionadas(new Set(iniciales.map((l) => l.id)));
      }
    }
  }, [leyesDisponibles, leyesSeleccionadas.size]);

  // Persistir selección de leyes
  useEffect(() => {
    try {
      sessionStorage.setItem('lexai_leyes_seleccionadas', JSON.stringify([...leyesSeleccionadas]));
    } catch {
      // ignore
    }
  }, [leyesSeleccionadas]);

  // Modo de interacción (Consulta, Redacción, Revisión)
  const [modoUsuario, setModoUsuario] = useState<ModoUsuario>(() => {
    try {
      return (sessionStorage.getItem('lexai_modo_usuario') as ModoUsuario) || 'consulta';
    } catch {
      return 'consulta';
    }
  });

  const cambiarModoUsuario = (m: ModoUsuario) => {
    setModoUsuario(m);
    try {
      sessionStorage.setItem('lexai_modo_usuario', m);
    } catch {
      // ignore
    }
  };

  // Historial de conversación
  const [mensajes, setMensajes] = useState<MensajeChatLex[]>(() => {
    try {
      const guardado = sessionStorage.getItem('lexai_chat_mensajes');
      return guardado ? JSON.parse(guardado) : [];
    } catch {
      return [];
    }
  });

  const [promptInput, setPromptInput] = useState('');
  const [generando, setGenerando] = useState(false);
  const [progresoInvestigacion, setProgresoInvestigacion] = useState<string | null>(null);

  // Búsqueda web y ámbito
  const [busquedaWebActiva, setBusquedaWebActiva] = useState(() => {
    try {
      return sessionStorage.getItem('lexai_web_activa') !== 'false';
    } catch {
      return true;
    }
  });

  const [ambitoSeleccionado, setAmbitoSeleccionado] = useState<AmbitoJuridico>(() => {
    try {
      return (sessionStorage.getItem('lexai_ambito_web') as AmbitoJuridico) || 'bolivia';
    } catch {
      return 'bolivia';
    }
  });

  const [modoRawPorMensaje, setModoRawPorMensaje] = useState<Record<string, boolean>>({});
  const finalChatRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Guardar mensajes en sesión
  useEffect(() => {
    try {
      sessionStorage.setItem('lexai_chat_mensajes', JSON.stringify(mensajes));
    } catch {
      // ignore
    }
  }, [mensajes]);

  // Persistir ajustes web
  useEffect(() => {
    try {
      sessionStorage.setItem('lexai_web_activa', String(busquedaWebActiva));
      sessionStorage.setItem('lexai_ambito_web', ambitoSeleccionado);
    } catch {
      // ignore
    }
  }, [busquedaWebActiva, ambitoSeleccionado]);

  // Scroll suave al llegar mensajes o generar
  useEffect(() => {
    if (mensajes.length > 0 && generando) {
      finalChatRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, generando]);

  const alternarLey = (id: string) => {
    setLeyesSeleccionadas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const seleccionarTodasLeyes = () => {
    setLeyesSeleccionadas(new Set(leyesDisponibles.map((l) => l.id)));
  };

  const desmarcarTodasLeyes = () => {
    setLeyesSeleccionadas(new Set());
  };

  const leyesFiltradas = useMemo(() => {
    const q = filtroLeyes.trim().toLowerCase();
    if (!q) return leyesDisponibles;
    return leyesDisponibles.filter(
      (l) => l.nombre.toLowerCase().includes(q) || l.norma.toLowerCase().includes(q)
    );
  }, [leyesDisponibles, filtroLeyes]);

  // Cancelar generación en curso
  const cancelarGeneracion = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setGenerando(false);
      setProgresoInvestigacion(null);
      avisar('Generación cancelada por el usuario', 'info');
    }
  };

  // Enviar Prompt a Lex AI con Streaming y Protección de Datos
  const handleEnviarPrompt = async (textoAEnviar?: string, modoContinuar = false) => {
    const promptCrudo = (textoAEnviar ?? promptInput).trim();
    if (!promptCrudo && !modoContinuar) return;
    if (generando) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Enmascarar datos personales si está habilitado
    const protector = crearProtector(configIa.protegerDatos);
    const promptProtegido = protector.proteger(promptCrudo);

    if (!modoContinuar) {
      const mensajeUsuario: MensajeChatLex = {
        id: `usr-${Date.now()}`,
        rol: 'usuario',
        texto: promptCrudo, // Se muestra sin enmascarar en la burbuja del usuario
        creadoEn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMensajes((prev) => [...prev, mensajeUsuario]);
      setPromptInput('');
    }

    const asistenteId = `asist-${Date.now()}`;
    const placeholderAsistente: MensajeChatLex = {
      id: asistenteId,
      rol: 'asistente',
      texto: '',
      creadoEn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMensajes((prev) => [...prev, placeholderAsistente]);
    setGenerando(true);
    setProgresoInvestigacion('Analizando leyes y normativas locales...');

    try {
      // 1. Recopilar grounding de leyes
      const { articulos, leyesNombres } = await recopilarGroundingLeyes(
        s,
        leyesSeleccionadas,
        promptProtegido,
        leyesDisponibles
      );

      // 2. Búsqueda jurídica en internet
      let resultadoWeb: { fuentes: any[]; terminoBuscado: string } | undefined;
      if (busquedaWebActiva && !modoContinuar) {
        setProgresoInvestigacion(
          `Buscando jurisprudencia y tratados en la web (${ETIQUETAS_AMBITO[ambitoSeleccionado].nombre})...`
        );
        try {
          const resBusqueda = await buscarJurisprudenciaWeb(promptProtegido, ambitoSeleccionado, {
            signal: controller.signal,
            tavilyKey: configIa.tavilyApiKey,
          });
          if (resBusqueda.fuentes.length > 0) {
            resultadoWeb = resBusqueda;
          }
        } catch (errWeb) {
          if (controller.signal.aborted) throw errWeb;
          console.warn('Búsqueda web jurídica omitida:', errWeb);
        }
      }

      // 3. Historial de conversación (excluye mensajes de error y limita tamaño)
      const historialValido = mensajes
        .filter((m) => !m.esError && m.texto.trim().length > 0)
        .slice(-6)
        .map((m) => ({
          rol: m.rol,
          texto: m.texto,
        }));

      // 4. Ejecutar consulta con streaming
      setProgresoInvestigacion(
        `Generando respuesta con ${infoProveedor.nombre} (${modeloActual || 'activo'})...`
      );

      const res = await consultarLexAi(
        {
          prompt: modoContinuar ? 'Continúa la redacción exactamente donde quedó cortada.' : promptProtegido,
          historial: historialValido,
          articulosContexto: articulos,
          leyesSeleccionadasNombres: leyesNombres,
          fuentesWeb: resultadoWeb?.fuentes,
          ambito: busquedaWebActiva ? ambitoSeleccionado : undefined,
          modo: modoContinuar ? 'continuar' : modoUsuario,
          datosProtegidos: protector.activo(),
        },
        {
          signal: controller.signal,
          onTexto: (parcial) => {
            const textoDesprotegido = protector.restaurar(parcial);
            setMensajes((prev) =>
              prev.map((m) => (m.id === asistenteId ? { ...m, texto: textoDesprotegido } : m))
            );
          },
        }
      );

      const textoFinal = protector.restaurar(res.texto);
      setMensajes((prev) =>
        prev.map((m) =>
          m.id === asistenteId
            ? {
                ...m,
                texto: textoFinal,
                tiempoMs: res.tiempoMs,
                modeloUsado: res.modeloUsado,
                proveedorUsado: res.proveedorUsado,
                citas: res.citas,
                fuentesConsultadas: articulos,
                fuentesWeb: resultadoWeb?.fuentes,
                ambitoUsado: busquedaWebActiva ? ambitoSeleccionado : undefined,
                terminoWebBuscado: resultadoWeb?.terminoBuscado,
                truncado: res.truncado,
              }
            : m
        )
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      const msgError = err instanceof Error ? err.message : String(err);
      avisar(`Error de Lex AI: ${msgError}`, 'error');
      // Si falló, devolver el prompt al input para que el usuario no pierda lo escrito
      if (!modoContinuar && promptCrudo) {
        setPromptInput(promptCrudo);
      }
      setMensajes((prev) =>
        prev.map((m) =>
          m.id === asistenteId
            ? {
                ...m,
                texto: `⚠️ No se pudo completar la consulta con ${infoProveedor.nombre}:\n\n${msgError}\n\nPuedes revisar tu API Key o probar otro modelo en la Configuración de IA.`,
                esError: true,
              }
            : m
        )
      );
    } finally {
      setGenerando(false);
      setProgresoInvestigacion(null);
      abortControllerRef.current = null;
    }
  };

  const copiarTexto = async (txt: string) => {
    try {
      const textoLimpio = limpiarParaPortapapeles(txt);
      await navigator.clipboard.writeText(textoLimpio);
      avisar('Texto limpio copiado al portapapeles');
    } catch {
      avisar('No se pudo acceder al portapapeles', 'error');
    }
  };

  const exportarWord = async (txt: string) => {
    try {
      const docx = construirDocx(s.generador, txt);
      const destino = await save({
        defaultPath: `Escrito_LexAI_${Date.now()}.docx`,
        filters: [{ name: 'Documento Word (.docx)', extensions: ['docx'] }],
      });
      if (!destino) return;
      await s.archivos.escribir(destino, docx);
      avisar('Documento Word (.docx) exportado exitosamente');
    } catch (err) {
      // Fallback a descarga por Blob si falla el diálogo nativo
      try {
        const docx = construirDocx(s.generador, txt);
        const blob = new Blob([docx as unknown as BlobPart], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Escrito_LexAI_${Date.now()}.docx`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        avisar('Documento Word (.docx) descargado');
      } catch (e2) {
        avisar(`Error al exportar Word: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
  };

  const limpiarConversacion = () => {
    if (mensajes.length === 0) return;
    if (window.confirm('¿Deseas iniciar una nueva consulta y limpiar el historial actual?')) {
      setMensajes([]);
      sessionStorage.removeItem('lexai_chat_mensajes');
      avisar('Conversación reiniciada');
    }
  };

  const infoProveedor = PROVEEDORES_IA[configIa.proveedorActivo] || PROVEEDORES_IA.ollama;
  const modeloActual = (configIa[CAMPOS_IA[configIa.proveedorActivo].modelo] as string) || '';

  return (
    <div className="lexai-contenedor">
      {/* Cabecera Principal */}
      <header className="lexai-cab">
        <div>
          <div className="lexai-titulo-fila">
            <Icono n="destello" tam={26} />
            <h1>Lex AI</h1>
            <span className="lexai-badge-ia">Grounding Jurídico</span>
            {configIa.protegerDatos && (
              <span className="insignia i-verde" title="Datos personales protegidos automáticamente">
                🔒 Privacidad ON
              </span>
            )}
          </div>
          <p className="subtitulo">
            Asistente procesal con investigación de leyes locales, jurisprudencia vinculante y redacción en tiempo real.
          </p>
        </div>

        <div className="lexai-acciones-cab">
          <button
            type="button"
            className={`lexai-btn-panel-toggle${panelFuentesVisible ? ' activo' : ''}`}
            onClick={() => setPanelFuentesVisible((prev) => !prev)}
            title="Mostrar u ocultar panel de fuentes jurídicas"
          >
            <Icono n="libro" tam={15} />
            <span>Leyes ({leyesSeleccionadas.size})</span>
          </button>

          {mensajes.length > 0 && (
            <button
              type="button"
              className="lexai-btn-sec"
              onClick={limpiarConversacion}
              title="Iniciar una nueva conversación"
            >
              <Icono n="papelera" tam={14} />
              <span>Nueva consulta</span>
            </button>
          )}

          <button
            type="button"
            className="lexai-btn-config"
            onClick={() => setModalConfigAbierto(true)}
            title="Configurar motor de IA (Ollama, Gemini, Groq, Claude)"
          >
            <span className="lexai-dot-status" />
            <span>
              {infoProveedor.nombre}
              {modeloActual ? ` (${modeloActual})` : ''}
            </span>
            <Icono n="ajustes" tam={14} />
          </button>
        </div>
      </header>

      {/* Workspace Principal */}
      <div className={`lexai-grid-workspace${panelFuentesVisible ? ' con-fuentes' : ' sin-fuentes'}`}>
        {/* Panel Lateral: Fuentes de Leyes (Grounding) */}
        {panelFuentesVisible && (
          <aside className="lexai-panel-fuentes" aria-label="Fuentes de leyes">
            <div className="lexai-fuentes-cab">
              <h3>
                <Icono n="libro" tam={17} />
                <span>Fuentes de Leyes</span>
              </h3>
              <Insignia tono="azul">{leyesSeleccionadas.size} en memoria</Insignia>
            </div>
            <p className="lexai-fuentes-sub">
              Lex AI cotejará los artículos de estas leyes para citar y fundamentar cada escrito.
            </p>

            <div className="lexai-fuentes-buscar">
              <Icono n="buscar" tam={14} />
              <input
                type="search"
                placeholder="Filtrar leyes..."
                value={filtroLeyes}
                onChange={(e) => setFiltroLeyes(e.target.value)}
              />
            </div>

            <div className="lexai-fuentes-acciones-rapidas">
              <button type="button" className="lexai-btn-enlace" onClick={seleccionarTodasLeyes}>
                Seleccionar todas
              </button>
              <button type="button" className="lexai-btn-enlace" onClick={desmarcarTodasLeyes}>
                Desmarcar todas
              </button>
            </div>

            <div className="lexai-fuentes-lista">
              {leyesDisponibles.length === 0 ? (
                <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--texto-3)', fontSize: '12px' }}>
                  <Icono n="libro" tam={26} />
                  <p style={{ margin: '8px 0 4px', fontWeight: 650, color: 'var(--texto-2)' }}>
                    Sin leyes en el módulo
                  </p>
                  <span>Carga tus códigos o leyes en la sección "Leyes" para investigarlos aquí.</span>
                </div>
              ) : leyesFiltradas.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--texto-3)', fontSize: '12px' }}>
                  No hay coincidencias con «{filtroLeyes}»
                </div>
              ) : (
                leyesFiltradas.map((ley) => {
                  const activa = leyesSeleccionadas.has(ley.id);
                  const sinArts = !ley.numArticulos || ley.numArticulos === 0;
                  return (
                    <label
                      key={ley.id}
                      className={`lexai-fuente-item${activa ? ' activa' : ''}${sinArts ? ' sin-arts' : ''}`}
                      title={sinArts ? 'Esta ley no tiene artículos estructurados' : undefined}
                    >
                      <input
                        type="checkbox"
                        className="lexai-fuente-checkbox"
                        checked={activa}
                        onChange={() => alternarLey(ley.id)}
                        aria-label={`Seleccionar ${ley.nombre}`}
                      />
                      <div className="lexai-fuente-info">
                        <span className="lexai-fuente-nombre">{ley.nombre}</span>
                        <div className="lexai-fuente-meta">
                          <span>{ley.norma || ley.tipo || 'Norma'}</span>
                          {ley.numArticulos > 0 ? (
                            <>
                              <span>·</span>
                              <span className="articulos">{ley.numArticulos} arts.</span>
                            </>
                          ) : (
                            <>
                              <span>·</span>
                              <span className="suave">Texto sin indexar</span>
                            </>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* Panel Central: Chat Directo por Prompts */}
        <main className="lexai-panel-chat">
          <div className="lexai-chat-historial">
            {mensajes.length === 0 ? (
              <div className="lexai-chat-vacio">
                <div className="lexai-vacio-icono">
                  <Icono n="destello" tam={40} />
                </div>
                <h2>¿Qué documento o consulta jurídica abordamos hoy?</h2>
                <p>
                  Escribe libremente cualquier instrucción procesal. Respuestas en tiempo real fundamentadas en tus{' '}
                  <b>{leyesSeleccionadas.size} leyes activas</b> y en jurisprudencia web vinculante.
                </p>

                <div className="lexai-sugerencias-directas">
                  <span className="lexai-sugerencias-titulo">Sugerencias para iniciar:</span>
                  <div className="lexai-sugerencias-grid">
                    {SUGERENCIAS_PROMPT.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        className="lexai-chip-prompt"
                        onClick={() => {
                          cambiarModoUsuario(sug.modo);
                          setPromptInput(sug.texto);
                        }}
                      >
                        <Icono n="pluma" tam={13} />
                        <span>{sug.texto}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="lexai-mensajes-flujo">
                {mensajes.map((msg, idx) => {
                  if (msg.rol === 'usuario') {
                    return (
                      <div key={msg.id} className="lexai-msg-fila usuario">
                        <div className="lexai-msg-burbuja usuario">
                          <div className="lexai-msg-cab">
                            <span className="lexai-msg-autor">Tú</span>
                            <span className="lexai-msg-hora">{msg.creadoEn}</span>
                          </div>
                          <div className="lexai-msg-cuerpo">{msg.texto}</div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="lexai-msg-fila asistente">
                      <div className={`lexai-msg-tarjeta-legal${msg.esError ? ' con-error' : ''}`}>
                        <div className="lexai-msg-cab-asistente">
                          <div className="lexai-msg-meta-ia">
                            <Icono n="destello" tam={16} />
                            <b>Lex AI</b>
                            {msg.modeloUsado && (
                              <span className="lexai-msg-badge-modelo">
                                {msg.proveedorUsado} · {msg.modeloUsado}
                              </span>
                            )}
                            {msg.tiempoMs !== undefined && (
                              <span className="lexai-msg-tiempo">({(msg.tiempoMs / 1000).toFixed(1)}s)</span>
                            )}
                            {msg.truncado && (
                              <span className="insignia i-ambar" title="La respuesta alcanzó el límite de tokens">
                                Cortado por longitud
                              </span>
                            )}
                          </div>

                          {!msg.esError && msg.texto && (
                            <div className="lexai-msg-acciones-doc">
                              <button
                                type="button"
                                className={`lexai-btn-accion-icono${modoRawPorMensaje[msg.id] ? ' activo' : ''}`}
                                onClick={() =>
                                  setModoRawPorMensaje((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                                }
                                title={modoRawPorMensaje[msg.id] ? 'Ver formato procesal' : 'Ver texto sin formato'}
                              >
                                <Icono n={modoRawPorMensaje[msg.id] ? 'destello' : 'documento'} tam={14} />
                                <span>{modoRawPorMensaje[msg.id] ? 'Formato' : 'Texto plano'}</span>
                              </button>
                              <button
                                type="button"
                                className="lexai-btn-accion-icono"
                                onClick={() => void copiarTexto(msg.texto)}
                                title="Copiar texto limpio sin asteriscos ni etiquetas"
                              >
                                <Icono n="documento" tam={14} />
                                <span>Copiar</span>
                              </button>
                              <button
                                type="button"
                                className="lexai-btn-accion-icono"
                                onClick={() => void exportarWord(msg.texto)}
                                title="Descargar como documento Word (.docx) real"
                              >
                                <Icono n="pluma" tam={14} />
                                <span>Word (.docx)</span>
                              </button>
                              <button
                                type="button"
                                className="lexai-btn-accion-icono"
                                onClick={() => setModalExpedienteTexto(msg.texto)}
                                title="Guardar versión de este escrito en un expediente"
                              >
                                <Icono n="carpeta" tam={14} />
                                <span>En Expediente</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Fuentes Web consultadas */}
                        {msg.fuentesWeb && msg.fuentesWeb.length > 0 && (
                          <details className="lexai-acordeon-fuentes-web" open={false}>
                            <summary className="lexai-summary-fuentes-web">
                              <div className="lexai-sum-web-izq">
                                <span className="lexai-icono-globo">🌐</span>
                                <span className="lexai-citas-titulo">
                                  <b>{msg.fuentesWeb.length} fuentes web y jurisprudencia:</b>
                                </span>
                                {msg.ambitoUsado && (
                                  <span className="lexai-tag-ambito-badge">
                                    {ETIQUETAS_AMBITO[msg.ambitoUsado]?.icono} {ETIQUETAS_AMBITO[msg.ambitoUsado]?.nombre}
                                  </span>
                                )}
                              </div>
                              <div className="lexai-sum-web-der">
                                {msg.fuentesWeb.slice(0, 3).map((fw, fIdx) => (
                                  <span key={fIdx} className={`lexai-chip-web-tipo ${fw.tipo}`}>
                                    {fw.tipo === 'jurisprudencia' ? '⚖️ Jurisprudencia' : fw.tipo === 'tratado' ? '📜 Tratado' : '📚 Doctrina'}
                                  </span>
                                ))}
                                {msg.fuentesWeb.length > 3 && (
                                  <span className="lexai-chip-fuente-investigada mas">
                                    +{msg.fuentesWeb.length - 3} más
                                  </span>
                                )}
                              </div>
                            </summary>
                            <div className="lexai-fuentes-web-desglose">
                              {msg.terminoWebBuscado && (
                                <div className="lexai-web-query-nota">
                                  🔍 Consulta web realizada: <code>{msg.terminoWebBuscado}</code>
                                </div>
                              )}
                              {msg.fuentesWeb.map((fw, fIdx) => (
                                <div key={fIdx} className="lexai-fuente-web-card">
                                  <div className="lexai-fuente-web-encab">
                                    <span className={`lexai-badge-tipo-web ${fw.tipo}`}>
                                      {fw.tipo === 'jurisprudencia'
                                        ? '⚖️ JURISPRUDENCIA'
                                        : fw.tipo === 'tratado'
                                        ? '📜 TRATADO INTERNACIONAL'
                                        : '📚 DOCTRINA Y ANÁLISIS'}
                                    </span>
                                    <a
                                      href={fw.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="lexai-fuente-web-enlace"
                                      title="Abrir enlace externo"
                                    >
                                      {fw.titulo} ↗
                                    </a>
                                  </div>
                                  <p className="lexai-fuente-web-snippet">{fw.resumen}</p>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}

                        {/* Artículos analizados */}
                        {msg.fuentesConsultadas && msg.fuentesConsultadas.length > 0 && (
                          <details className="lexai-acordeon-fuentes" open={false}>
                            <summary className="lexai-summary-fuentes">
                              <span className="lexai-citas-titulo">
                                <Icono n="libro" tam={13} />
                                <b>{msg.fuentesConsultadas.length} artículos cotejados en tus leyes:</b>
                              </span>
                              <span className="lexai-resumen-fuentes-chips">
                                {msg.fuentesConsultadas.slice(0, 4).map((f, aIdx) => (
                                  <span key={aIdx} className="lexai-chip-fuente-investigada">
                                    {f.leyNombre.split(' ')[0]} Art. {f.numero}
                                  </span>
                                ))}
                                {msg.fuentesConsultadas.length > 4 && (
                                  <span className="lexai-chip-fuente-investigada mas">
                                    +{msg.fuentesConsultadas.length - 4} más
                                  </span>
                                )}
                              </span>
                            </summary>
                            <div className="lexai-fuentes-desglose">
                              {msg.fuentesConsultadas.map((art, aIdx) => (
                                <div key={aIdx} className="lexai-fuente-item-investigado">
                                  <div className="lexai-fuente-item-encab">
                                    <span className="lexai-fuente-item-ley">{art.leyNombre}</span>
                                    <span className="lexai-fuente-item-art">
                                      Artículo {art.numero} {art.titulo ? `· ${art.titulo}` : ''}
                                    </span>
                                  </div>
                                  <p className="lexai-fuente-item-cuerpo">«{art.texto}»</p>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}

                        {/* Citas detectadas */}
                        {msg.citas && msg.citas.length > 0 && (
                          <div className="lexai-citas-flotantes">
                            <span className="lexai-citas-titulo">
                              <Icono n="destello" tam={13} /> Preceptos invocados:
                            </span>
                            {msg.citas.map((c, cIdx) => (
                              <span
                                key={cIdx}
                                className={`lexai-cita-tag${c.verificada ? ' verificada' : ''}`}
                                title={c.verificada ? 'Cita verificada en el contexto suministrado' : 'Cita general generada por la IA'}
                              >
                                {c.verificada ? '✓ ' : ''}{c.texto}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Texto del escrito */}
                        <div className="lexai-msg-texto-legal">
                          {modoRawPorMensaje[msg.id] ? (
                            <pre className="lexai-msg-pre-raw">{msg.texto}</pre>
                          ) : (
                            <RenderEscrito texto={msg.texto} />
                          )}
                        </div>

                        {/* Acciones al pie del mensaje si quedó truncado o en el último mensaje */}
                        {msg.truncado && !generando && (
                          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              className="btn btn-sec btn-sm"
                              onClick={() => void handleEnviarPrompt('', true)}
                            >
                              <Icono n="pluma" tam={14} /> Continuar redactando
                            </button>
                          </div>
                        )}

                        {msg.esError && !generando && idx === mensajes.length - 1 && (
                          <div style={{ marginTop: '12px' }}>
                            <button
                              type="button"
                              className="btn btn-sec btn-sm"
                              onClick={() => {
                                const anteriorUsuario = mensajes.slice(0, idx).reverse().find((m) => m.rol === 'usuario');
                                if (anteriorUsuario) void handleEnviarPrompt(anteriorUsuario.texto);
                              }}
                            >
                              🔄 Reintentar consulta
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {generando && (
                  <div className="lexai-msg-fila asistente">
                    <div className="lexai-msg-cargando">
                      <span className="lexai-spinner-punto" />
                      <span>
                        {progresoInvestigacion ||
                          `Lex AI (${infoProveedor.nombre}: ${modeloActual || 'activo'}) está redactando...`}
                      </span>
                    </div>
                  </div>
                )}

                <div ref={finalChatRef} />
              </div>
            )}
          </div>

          {/* Área de Prompt Fijo Inferior */}
          <div className="lexai-prompt-area">
            <div className="lexai-prompt-caja">
              {/* Barra de herramientas superior del prompt */}
              <div className="lexai-prompt-toolbar">
                <div className="lexai-prompt-toolbar-izq">
                  {/* Selector de Modo */}
                  <div className="lexai-modo-selector">
                    <button
                      type="button"
                      className={`lexai-btn-modo${modoUsuario === 'consulta' ? ' activo' : ''}`}
                      onClick={() => cambiarModoUsuario('consulta')}
                      title="Modo Consulta: Respuestas directas, concisas y fundamentadas"
                    >
                      💬 Consulta
                    </button>
                    <button
                      type="button"
                      className={`lexai-btn-modo${modoUsuario === 'redaccion' ? ' activo' : ''}`}
                      onClick={() => cambiarModoUsuario('redaccion')}
                      title="Modo Redacción: Escrito procesal íntegro formal listo para firma"
                    >
                      📝 Redacción
                    </button>
                    <button
                      type="button"
                      className={`lexai-btn-modo${modoUsuario === 'revision' ? ' activo' : ''}`}
                      onClick={() => cambiarModoUsuario('revision')}
                      title="Modo Revisión: Análisis crítico de riesgos, plazos y fundamentación"
                    >
                      🔍 Revisión
                    </button>
                  </div>

                  {/* Toggle Web */}
                  <button
                    type="button"
                    className={`lexai-btn-web-toggle${busquedaWebActiva ? ' activo' : ''}`}
                    onClick={() => setBusquedaWebActiva((p) => !p)}
                    title={
                      busquedaWebActiva
                        ? 'Búsqueda web activa: Consulta jurisprudencia y tratados en vivo'
                        : 'Activar consulta web de jurisprudencia y tratados internacionales'
                    }
                  >
                    <span className="lexai-web-punto" />
                    <span>Búsqueda Web {busquedaWebActiva ? 'ON' : 'OFF'}</span>
                  </button>

                  {busquedaWebActiva && (
                    <div className="lexai-selector-ambito-wrap">
                      <select
                        className="lexai-selector-ambito"
                        value={ambitoSeleccionado}
                        onChange={(e) => setAmbitoSeleccionado(e.target.value as AmbitoJuridico)}
                        title="Jurisdicción de búsqueda web"
                      >
                        <option value="bolivia">🇧🇴 Bolivia (TSJ / TCP)</option>
                        <option value="tratados">🌐 Tratados / CIDH</option>
                        <option value="comparado">🌎 Derecho Comparado</option>
                        <option value="general">⚖️ General / Doctrina</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="lexai-prompt-toolbar-der">
                  <span className="lexai-contador-fuentes" title="Leyes seleccionadas activas en memoria">
                    {leyesSeleccionadas.size} leyes activas
                  </span>
                </div>
              </div>

              {/* Textarea de Entrada */}
              <div className="lexai-prompt-input-fila">
                <textarea
                  className="lexai-prompt-textarea"
                  rows={2}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleEnviarPrompt();
                    }
                  }}
                  placeholder={
                    modoUsuario === 'redaccion'
                      ? 'Indica qué escrito deseas redactar (ej: Demanda ordinaria de resolución de contrato por falta de pago)...'
                      : modoUsuario === 'revision'
                      ? 'Pega el borrador o memorial para que Lex AI lo audite e identifique riesgos y mejoras...'
                      : 'Escribe tu consulta jurídica procesal o institucional...'
                  }
                  disabled={generando}
                />

                <div className="lexai-prompt-botones">
                  {generando ? (
                    <button
                      type="button"
                      className="btn btn-sec btn-sm"
                      onClick={cancelarGeneracion}
                      style={{ color: 'var(--err)', borderColor: 'var(--err-borde)' }}
                      title="Detener la generación"
                    >
                      ■ Detener
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="lexai-btn-enviar"
                      onClick={() => void handleEnviarPrompt()}
                      disabled={!promptInput.trim()}
                      title="Enviar consulta (Enter)"
                    >
                      <span>Enviar</span>
                      <Icono n="pluma" tam={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modal de Configuración de IA */}
      {modalConfigAbierto && (
        <ModalConfiguracionIa
          configActual={configIa}
          cerrar={() => setModalConfigAbierto(false)}
          alGuardar={(nueva) => {
            setConfigIa(nueva);
            guardarConfigIa(nueva);
            setModalConfigAbierto(false);
            avisar(`Configuración guardada: motor ${PROVEEDORES_IA[nueva.proveedorActivo]?.nombre}`);
          }}
        />
      )}

      {/* Modal Guardar en Expediente */}
      {modalExpedienteTexto && (
        <ModalGuardarEnExpediente
          texto={modalExpedienteTexto}
          cerrar={() => setModalExpedienteTexto(null)}
        />
      )}
    </div>
  );
}
