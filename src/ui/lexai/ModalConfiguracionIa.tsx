// src/ui/lexai/ModalConfiguracionIa.tsx
import { useEffect, useState } from 'react';
import {
  CAMPOS_IA,
  ORDEN_PROVEEDORES,
  PROVEEDORES_IA,
  listarModelosCacheado,
  probarConexionProveedor,
  verificarModelosOllama,
  type ConfigIa,
  type ProveedorIaId,
} from '../../application/ai/proveedoresIa';
import { Icono, Modal, avisar } from '../_core/comunes';

interface Props {
  configActual: ConfigIa;
  cerrar: () => void;
  alGuardar: (cfg: ConfigIa) => void;
}

export function ModalConfiguracionIa({ configActual, cerrar, alGuardar }: Props) {
  const [cfg, setCfg] = useState<ConfigIa>({ ...configActual });
  const [tabActiva, setTabActiva] = useState<ProveedorIaId>(configActual.proveedorActivo);
  const [testResultado, setTestResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [probando, setProbando] = useState(false);
  const [verificandoOllama, setVerificandoOllama] = useState(false);

  const [modelosPorProveedor, setModelosPorProveedor] = useState<Record<string, string[]>>({});
  const [cargandoModelos, setCargandoModelos] = useState(false);
  const [errorModelos, setErrorModelos] = useState<string | null>(null);

  const campos = CAMPOS_IA[tabActiva];
  const infoActual = PROVEEDORES_IA[tabActiva];
  const claveActual = (cfg[campos.clave] as string) || '';
  const modeloActual = (cfg[campos.modelo] as string) || '';

  const cargarModelos = async (prov: ProveedorIaId, conf: ConfigIa, forzar = false, silencioso = false) => {
    const info = PROVEEDORES_IA[prov];
    const key = (conf[CAMPOS_IA[prov].clave] as string).trim();
    if (info.claveParaListar && !key) {
      setErrorModelos('Pega tu API Key para ver tus modelos disponibles.');
      return;
    }

    setCargandoModelos(true);
    setErrorModelos(null);
    try {
      const lista = await listarModelosCacheado(prov, conf, forzar);
      setModelosPorProveedor((prev) => ({ ...prev, [prov]: lista }));

      // Si el modelo actual está vacío, auto-seleccionar el primero de la lista
      const campoMod = CAMPOS_IA[prov].modelo;
      const modActual = conf[campoMod] as string;
      if (!modActual && lista.length > 0) {
        setCfg((prev) => ({ ...prev, [campoMod]: lista[0] }));
      }
      if (!silencioso) {
        avisar(`${lista.length} modelos detectados para ${info.nombre}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorModelos(msg);
      if (!silencioso) avisar(msg, 'error');
    } finally {
      setCargandoModelos(false);
    }
  };

  useEffect(() => {
    setTestResultado(null);
    setErrorModelos(null);
    cargarModelos(tabActiva, cfg, false, true);
  }, [tabActiva]);

  const probarActual = async () => {
    setProbando(true);
    setTestResultado(null);
    try {
      const res = await probarConexionProveedor(tabActiva, cfg);
      setTestResultado(res);
      if (res.modelos && res.modelos.length > 0) {
        setModelosPorProveedor((prev) => ({ ...prev, [tabActiva]: res.modelos! }));
      }
      if (res.ok) avisar('Conexión y generación verificada exitosamente');
    } finally {
      setProbando(false);
    }
  };

  const verificarOllamaCloud = async () => {
    const modelos = modelosPorProveedor['ollama'] || [];
    if (modelos.length === 0) return;
    setVerificandoOllama(true);
    try {
      const validos = await verificarModelosOllama(cfg, modelos);
      setModelosPorProveedor((prev) => ({ ...prev, ollama: validos }));
      avisar(`${validos.length} modelos de Ollama Cloud responden 200 OK`);
    } catch (err) {
      avisar(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setVerificandoOllama(false);
    }
  };

  const modelosDisponibles = modelosPorProveedor[tabActiva] || [];

  return (
    <Modal titulo="Configuración de IAs para Redacción Jurídica" cerrar={cerrar} ancho="grande">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Pestañas de proveedores */}
        <div className="lexai-modal-tabs">
          {ORDEN_PROVEEDORES.map((provId) => {
            const info = PROVEEDORES_IA[provId];
            const esActivo = tabActiva === provId;
            return (
              <button
                key={provId}
                type="button"
                className={`lexai-modal-tab-btn${esActivo ? ' activo' : ''}`}
                onClick={() => setTabActiva(provId)}
              >
                <span style={{ fontWeight: 700 }}>{info.nombre}</span>
                <span className="lexai-tab-badge-gratis">{info.etiqueta}</span>
              </button>
            );
          })}
        </div>

        {/* Cuerpo del proveedor activo */}
        <div className="lexai-proveedor-cuerpo">
          <div className="lexai-banner-info">
            <Icono n="destello" tam={18} />
            <div style={{ flex: 1 }}>
              <b>{infoActual.nombre}:</b> {infoActual.descripcion}{' '}
              {infoActual.urlClave && (
                <a
                  href={infoActual.urlClave}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--primario)', textDecoration: 'underline', fontWeight: 600, marginLeft: '6px' }}
                >
                  Obtener API Key ↗
                </a>
              )}
            </div>
          </div>

          {/* Opciones específicas de Ollama */}
          {tabActiva === 'ollama' && (
            <>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--texto-2)' }}>Presets de URL:</span>
                <button
                  type="button"
                  onClick={() => {
                    const nuevo = { ...cfg, ollamaUrl: 'https://ollama.com' };
                    setCfg(nuevo);
                    cargarModelos('ollama', nuevo, true);
                  }}
                  style={{
                    fontSize: '11.5px',
                    padding: '3px 9px',
                    borderRadius: '5px',
                    background: cfg.ollamaUrl.includes('ollama.com') ? 'var(--primario)' : 'var(--superficie-2)',
                    color: cfg.ollamaUrl.includes('ollama.com') ? '#ffffff' : 'var(--texto)',
                    border: '1px solid var(--borde)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  ☁️ Ollama Cloud (https://ollama.com)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nuevo = { ...cfg, ollamaUrl: 'http://localhost:11434' };
                    setCfg(nuevo);
                    cargarModelos('ollama', nuevo, true);
                  }}
                  style={{
                    fontSize: '11.5px',
                    padding: '3px 9px',
                    borderRadius: '5px',
                    background: cfg.ollamaUrl.includes('localhost') ? 'var(--primario)' : 'var(--superficie-2)',
                    color: cfg.ollamaUrl.includes('localhost') ? '#ffffff' : 'var(--texto)',
                    border: '1px solid var(--borde)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  💻 Localhost (http://localhost:11434)
                </button>
              </div>

              <div className="lexai-campo-fila">
                <label>URL del Endpoint API</label>
                <input
                  type="text"
                  value={cfg.ollamaUrl}
                  onChange={(e) => setCfg({ ...cfg, ollamaUrl: e.target.value })}
                  placeholder="https://ollama.com o http://localhost:11434"
                />
              </div>
            </>
          )}

          {/* Campo de API Key */}
          <div className="lexai-campo-fila">
            <label>API Key / Token de {infoActual.nombre}</label>
            <input
              type="password"
              value={claveActual}
              onChange={(e) => setCfg({ ...cfg, [campos.clave]: e.target.value })}
              placeholder={infoActual.placeholderClave}
            />
          </div>

          {/* Selector de Modelos */}
          <div className="lexai-campo-fila">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>
                Modelo en el Servidor{' '}
                {modelosDisponibles.length > 0 && (
                  <span style={{ fontSize: '11.5px', fontWeight: 'normal', color: 'var(--texto-2)' }}>
                    ({modelosDisponibles.length} disponible{modelosDisponibles.length === 1 ? '' : 's'})
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {tabActiva === 'ollama' && cfg.ollamaUrl.includes('ollama.com') && (
                  <button
                    type="button"
                    onClick={verificarOllamaCloud}
                    disabled={verificandoOllama || cargandoModelos}
                    style={{
                      fontSize: '11.5px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--primario)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      textDecoration: 'underline',
                    }}
                  >
                    {verificandoOllama ? 'Verificando cuotas...' : '⚡ Filtrar solo activos (200 OK)'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => cargarModelos(tabActiva, cfg, true)}
                  disabled={cargandoModelos}
                  style={{
                    fontSize: '11.5px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--primario)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline',
                  }}
                >
                  {cargandoModelos ? 'Consultando...' : '🔄 Actualizar modelos'}
                </button>
              </div>
            </div>

            {cargandoModelos ? (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '7px',
                  background: 'var(--superficie-2)',
                  border: '1px solid var(--borde)',
                  fontSize: '12.5px',
                  color: 'var(--texto-2)',
                }}
              >
                ⏳ Obteniendo modelos disponibles de {infoActual.nombre}...
              </div>
            ) : modelosDisponibles.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={modeloActual}
                  onChange={(e) => setCfg({ ...cfg, [campos.modelo]: e.target.value })}
                  style={{ flex: 1 }}
                >
                  {modelosDisponibles.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  style={{ width: '160px' }}
                  value={modeloActual}
                  onChange={(e) => setCfg({ ...cfg, [campos.modelo]: e.target.value })}
                  placeholder="Modelo manual..."
                  title="Escribe un modelo específico si lo prefieres"
                />
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={modeloActual}
                  onChange={(e) => setCfg({ ...cfg, [campos.modelo]: e.target.value })}
                  placeholder="Pega tu API Key para ver la lista de modelos..."
                />
                {errorModelos && (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: 'var(--err)',
                      fontSize: '12px',
                    }}
                  >
                    {errorModelos}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fila de Prueba de Conexión */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sec btn-sm" disabled={probando} onClick={probarActual}>
            {probando ? 'Comprobando...' : 'Probar conexión y modelo'}
          </button>
          {testResultado && (
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 600,
                color: testResultado.ok ? 'var(--ok)' : 'var(--err)',
              }}
            >
              {testResultado.mensaje}
            </span>
          )}
        </div>

        {/* Ajustes Avanzados */}
        <div
          style={{
            marginTop: '6px',
            paddingTop: '12px',
            borderTop: '1px solid var(--borde)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div className="lexai-campo-fila">
            <label>
              API Key de Tavily (Búsqueda Web Jurídica Profesional - Opcional)
              <a
                href="https://tavily.com"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--primario)', textDecoration: 'underline', fontWeight: 600, marginLeft: '6px' }}
              >
                Cuenta gratuita en tavily.com ↗
              </a>
            </label>
            <input
              type="password"
              value={cfg.tavilyApiKey}
              onChange={(e) => setCfg({ ...cfg, tavilyApiKey: e.target.value })}
              placeholder="tvly-..."
            />
            <span className="campo-ayuda">
              Si se deja vacío, la búsqueda web usará DuckDuckGo automáticamente sin requerir registro.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Temperatura:</span>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={cfg.temperatura}
                onChange={(e) => setCfg({ ...cfg, temperatura: parseFloat(e.target.value) })}
                style={{ width: '120px' }}
              />
              <span style={{ color: 'var(--primario)', minWidth: '32px' }}>{cfg.temperatura}</span>
            </label>

            <label style={{ fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Longitud máxima (tokens):</span>
              <input
                type="number"
                min={512}
                max={16384}
                step={512}
                value={cfg.maxTokens}
                onChange={(e) => setCfg({ ...cfg, maxTokens: parseInt(e.target.value, 10) || 8192 })}
                style={{ width: '90px' }}
              />
            </label>

            <label style={{ fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={cfg.protegerDatos}
                onChange={(e) => setCfg({ ...cfg, protegerDatos: e.target.checked })}
              />
              <span>Proteger datos personales (C.I., NIT, teléfonos)</span>
            </label>
          </div>
        </div>

        {/* Acciones del Modal */}
        <div className="acciones" style={{ marginTop: '12px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-sec" onClick={cerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-pri"
            onClick={() => {
              alGuardar({ ...cfg, proveedorActivo: tabActiva });
            }}
          >
            Guardar y Usar {infoActual.nombre}
          </button>
        </div>
      </div>
    </Modal>
  );
}
