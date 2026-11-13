// src/ui/editor/ModalGuiaRedaccion.tsx
import { useMemo, useState } from 'react';
import {
  INTRODUCTORES_APERTURA,
  CONECTORES_ARGUMENTATIVOS,
  MARCADORES_CONCLUSIVOS,
  PROTOCOLO_SOLICITUDES,
  CONSEJO_ESTILO,
} from '../../domain/redaccion/compendioForense';
import { ESQUELETOS_PARRAFO } from '../../domain/redaccion/esqueletosParrafo';
import { EQUIVALENCIAS_COLOQUIALES, LATINISMOS_JURIDICOS } from '../../domain/redaccion/vocabularioForense';
import { ESTRUCTURAS_DOCUMENTO } from '../../domain/redaccion/estructurasDocumento';
import { TIPOS_ARGUMENTOS_JURIDICOS, FALACIAS_JURIDICAS } from '../../domain/redaccion/argumentacionForense';
import { Modal, Icono } from '../_core/comunes';
import './redaccion.css';

type SeccionGuia =
  | 'aperturas'
  | 'conectores'
  | 'esqueletos'
  | 'vocabulario'
  | 'estructuras'
  | 'argumentacion'
  | 'cierres'
  | 'protocolo';

export function ModalGuiaRedaccion({ cerrar }: { cerrar: () => void }) {
  const [seccion, setSeccion] = useState<SeccionGuia>('aperturas');
  const [filtro, setFiltro] = useState('');

  const q = filtro.trim().toLowerCase();

  // Filtrado reactivo en todo el compendio
  const introductoresFiltrados = useMemo(() => {
    if (!q) return INTRODUCTORES_APERTURA;
    return INTRODUCTORES_APERTURA.filter(
      (item) =>
        item.funcion.toLowerCase().includes(q) ||
        item.general.some((g) => g.toLowerCase().includes(q)) ||
        item.juridicoAvanzado.some((j) => j.toLowerCase().includes(q))
    );
  }, [q]);

  const conectoresFiltrados = useMemo(() => {
    if (!q) return CONECTORES_ARGUMENTATIVOS;
    return CONECTORES_ARGUMENTATIVOS.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.descripcion.toLowerCase().includes(q) ||
        c.general.some((g) => g.toLowerCase().includes(q)) ||
        c.juridicoAvanzado.some((j) => j.toLowerCase().includes(q))
    );
  }, [q]);

  const esqueletosFiltrados = useMemo(() => {
    if (!q) return ESQUELETOS_PARRAFO;
    return ESQUELETOS_PARRAFO.filter(
      (e) =>
        e.nombre.toLowerCase().includes(q) ||
        e.objetivo.toLowerCase().includes(q) ||
        e.plantillaTexto.toLowerCase().includes(q) ||
        e.ejemploAplicado.toLowerCase().includes(q)
    );
  }, [q]);

  const vocabularioFiltrado = useMemo(() => {
    if (!q) return { coloquial: EQUIVALENCIAS_COLOQUIALES, latinismos: LATINISMOS_JURIDICOS };
    return {
      coloquial: EQUIVALENCIAS_COLOQUIALES.filter(
        (c) =>
          c.coloquial.toLowerCase().includes(q) ||
          c.contexto.toLowerCase().includes(q) ||
          c.sugerenciasFormale.some((s) => s.toLowerCase().includes(q))
      ),
      latinismos: LATINISMOS_JURIDICOS.filter(
        (l) =>
          l.latinismo.toLowerCase().includes(q) ||
          l.traduccion.toLowerCase().includes(q) ||
          l.significadoForense.toLowerCase().includes(q) ||
          l.ejemplo.toLowerCase().includes(q)
      ),
    };
  }, [q]);

  const estructurasFiltradas = useMemo(() => {
    if (!q) return ESTRUCTURAS_DOCUMENTO;
    return ESTRUCTURAS_DOCUMENTO.filter(
      (e) =>
        e.tipo.toLowerCase().includes(q) ||
        e.materia.toLowerCase().includes(q) ||
        e.requisitos.some(
          (r) =>
            r.titulo.toLowerCase().includes(q) ||
            r.descripcion.toLowerCase().includes(q) ||
            r.pistas.some((p) => p.toLowerCase().includes(q))
        )
    );
  }, [q]);

  const argumentacionFiltrada = useMemo(() => {
    if (!q) return { argumentos: TIPOS_ARGUMENTOS_JURIDICOS, falacias: FALACIAS_JURIDICAS };
    return {
      argumentos: TIPOS_ARGUMENTOS_JURIDICOS.filter(
        (a) =>
          a.nombre.toLowerCase().includes(q) ||
          a.definicion.toLowerCase().includes(q) ||
          a.conectoresTipicos.some((c) => c.toLowerCase().includes(q)) ||
          a.ejemplo.toLowerCase().includes(q)
      ),
      falacias: FALACIAS_JURIDICAS.filter(
        (f) =>
          f.nombre.toLowerCase().includes(q) ||
          f.definicion.toLowerCase().includes(q) ||
          f.preguntaControl.toLowerCase().includes(q) ||
          f.ejemploInvalido.toLowerCase().includes(q)
      ),
    };
  }, [q]);

  const cierresFiltrados = useMemo(() => {
    if (!q) return MARCADORES_CONCLUSIVOS;
    return MARCADORES_CONCLUSIVOS.filter(
      (c) =>
        c.nivel.toLowerCase().includes(q) ||
        c.general.some((g) => g.toLowerCase().includes(q)) ||
        c.juridicoAvanzado.some((j) =>
          j.formulas.some((f) => f.toLowerCase().includes(q)) ||
          (j.contexto && j.contexto.toLowerCase().includes(q))
        )
    );
  }, [q]);

  const protocoloFiltrado = useMemo(() => {
    if (!q) return PROTOCOLO_SOLICITUDES;
    return PROTOCOLO_SOLICITUDES.filter(
      (p) =>
        p.ambito.toLowerCase().includes(q) ||
        p.descripcion.toLowerCase().includes(q) ||
        p.grupos.some(
          (g) =>
            g.titulo.toLowerCase().includes(q) ||
            g.formulas.some((f) => f.toLowerCase().includes(q))
        )
    );
  }, [q]);

  return (
    <Modal titulo="Compendio de Redacción Jurídica y Forense (Las 8 Áreas)" ancho="grande" cerrar={cerrar}>
      <div className="mgr-contenedor">
        {/* Barra superior de navegación y buscador */}
        <div className="mgr-cabecera-filtros">
          <div className="mgr-tabs">
            <button
              type="button"
              className={`mgr-tab-btn${seccion === 'aperturas' ? ' activo' : ''}`}
              onClick={() => setSeccion('aperturas')}
            >
              <Icono n="documento" tam={13} /> I. Aperturas y Hechos
            </button>
            <button
              type="button"
              className={`mgr-tab-btn${seccion === 'conectores' ? ' activo' : ''}`}
              onClick={() => setSeccion('conectores')}
            >
              <Icono n="flujo" tam={13} /> II. Conectores Lógicos
            </button>
            <button
              type="button"
              className={`mgr-tab-btn${seccion === 'esqueletos' ? ' activo' : ''}`}
              onClick={() => setSeccion('esqueletos')}
            >
              <Icono n="pluma" tam={13} /> III. Esqueletos de Párrafo
            </button>
            <button
              type="button"
              className={`mgr-tab-btn${seccion === 'vocabulario' ? ' activo' : ''}`}
              onClick={() => setSeccion('vocabulario')}
            >
              <Icono n="libro" tam={13} /> IV. Vocabulario y Latinismos
            </button>
            <button
              type="button"
              className={`mgr-tab-btn${seccion === 'estructuras' ? ' activo' : ''}`}
              onClick={() => setSeccion('estructuras')}
            >
              <Icono n="tribunal" tam={13} /> V. Estructuras Procesales
            </button>
            <button
              type="button"
              className={`mgr-tab-btn${seccion === 'argumentacion' ? ' activo' : ''}`}
              onClick={() => setSeccion('argumentacion')}
            >
              <Icono n="balanza" tam={13} /> VI. Argumentos y Falacias
            </button>
            <button
              type="button"
              className={`mgr-tab-btn${seccion === 'cierres' ? ' activo' : ''}`}
              onClick={() => setSeccion('cierres')}
            >
              <Icono n="ok" tam={13} /> VII. Cierres y Petitorio
            </button>
            <button
              type="button"
              className={`mgr-tab-btn${seccion === 'protocolo' ? ' activo' : ''}`}
              onClick={() => setSeccion('protocolo')}
            >
              <Icono n="personas" tam={13} /> VIII. Protocolo y Solicitudes
            </button>
          </div>

          <div className="mgr-buscador">
            <span className="mgr-buscador-icono">
              <Icono n="buscar" tam={13} />
            </span>
            <input
              type="text"
              placeholder="Buscar en todo el compendio..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="mgr-input-buscar"
            />
            {filtro && (
              <button
                type="button"
                className="mgr-btn-limpiar"
                onClick={() => setFiltro('')}
                title="Limpiar búsqueda"
              >
                <Icono n="cerrar" tam={12} />
              </button>
            )}
          </div>
        </div>

        {/* Contenido con scroll */}
        <div className="mgr-cuerpo-scroll">
          {/* SECCIÓN I: APERTURAS Y HECHOS */}
          {seccion === 'aperturas' && (
            <div className="mgr-seccion">
              <div className="mgr-intro-bloque">
                <h3>I. Introductores y Fórmulas de Apertura</h3>
                <p>
                  Definen el tono del escrito desde la primera línea: aperturas del texto general,
                  relación de antecedentes fácticos e invocación del ordenamiento jurídico aplicable.
                </p>
              </div>

              {introductoresFiltrados.length === 0 ? (
                <div className="mgr-vacio">No se encontraron fórmulas para esta búsqueda.</div>
              ) : (
                introductoresFiltrados.map((item, idx) => (
                  <div key={idx} className="mgr-tarjeta-comparativa">
                    <div className="mgr-tarjeta-titulo">
                      <span className="mgr-etiqueta-funcion">{item.funcion}</span>
                    </div>

                    <div className="mgr-columnas-comparativas">
                      <div className="mgr-col-general">
                        <div className="mgr-col-cabecera">
                          <span className="mgr-badge-general">Redacción General / Académica</span>
                        </div>
                        <ul className="mgr-lista-items">
                          {item.general.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mgr-col-juridica">
                        <div className="mgr-col-cabecera">
                          <span className="mgr-badge-juridica">Redacción Jurídica Avanzada (Forense / Doctrinal)</span>
                        </div>
                        <ul className="mgr-lista-items forense">
                          {item.juridicoAvanzado.map((j, i) => (
                            <li key={i}>{j}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* SECCIÓN II: CONECTORES LÓGICOS (1-8) */}
          {seccion === 'conectores' && (
            <div className="mgr-seccion">
              <div className="mgr-intro-bloque">
                <h3>II. Conectores Lógicos y Argumentativos</h3>
                <p>
                  Articulan las premisas del silogismo judicial: premisa mayor normativa, premisa menor
                  fáctica y deducción concluyente.
                </p>
              </div>

              {conectoresFiltrados.length === 0 ? (
                <div className="mgr-vacio">No se encontraron conectores para esta búsqueda.</div>
              ) : (
                <div className="mgr-rejilla-conectores">
                  {conectoresFiltrados.map((cat) => (
                    <div key={cat.id} className="mgr-tarjeta-conector-cat">
                      <div className="mgr-cat-cab">
                        <span className="mgr-cat-num">{cat.numero}</span>
                        <div>
                          <h4 className="mgr-cat-nombre">{cat.nombre}</h4>
                          <span className="mgr-cat-desc">{cat.descripcion}</span>
                        </div>
                      </div>

                      <div className="mgr-cat-bloque">
                        <span className="mgr-badge-general">Uso Común / General</span>
                        <div className="mgr-chips-wrap">
                          {cat.general.map((gen, i) => (
                            <span key={i} className="mgr-chip general">
                              {gen}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mgr-cat-bloque">
                        <span className="mgr-badge-juridica">Jurídico Avanzado / Forense</span>
                        <div className="mgr-chips-wrap">
                          {cat.juridicoAvanzado.map((jur, i) => (
                            <span key={i} className="mgr-chip juridica">
                              {jur}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN III: ESQUELETOS DE PÁRRAFO */}
          {seccion === 'esqueletos' && (
            <div className="mgr-seccion">
              <div className="mgr-intro-bloque">
                <h3>III. Esqueletos de Párrafo Forense</h3>
                <p>
                  Estructuras predefinidas para redactar párrafos procesales sólidos: silogismo de subsunción,
                  afirmaciones con prueba (PEEL), narrativa fáctica circunstanciada y refutación dialéctica.
                </p>
              </div>

              {esqueletosFiltrados.length === 0 ? (
                <div className="mgr-vacio">No se encontraron esqueletos para esta búsqueda.</div>
              ) : (
                <div className="mgr-rejilla-protocolo">
                  {esqueletosFiltrados.map((esq) => (
                    <div key={esq.id} className="mgr-tarjeta-protocolo">
                      <div className="mgr-protocolo-cab">
                        <h4 className="mgr-protocolo-titulo">{esq.nombre}</h4>
                        <p className="mgr-protocolo-desc">{esq.objetivo}</p>
                      </div>

                      <div className="mgr-protocolo-grupos">
                        <div className="mgr-protocolo-subgrupo">
                          <span className="mgr-protocolo-subtitulo">Estructura del Párrafo:</span>
                          <ul className="mgr-lista-items">
                            {esq.estructura.map((paso, pi) => (
                              <li key={pi}>{paso}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="mgr-protocolo-subgrupo">
                          <span className="mgr-protocolo-subtitulo">Plantilla Guiada con Marcadores:</span>
                          <div className="mgr-formula-item forense">
                            <span className="mgr-formula-texto" style={{ fontFamily: 'inherit', lineHeight: 1.5 }}>
                              {esq.plantillaTexto}
                            </span>
                          </div>
                        </div>

                        <div className="mgr-protocolo-subgrupo">
                          <span className="mgr-protocolo-subtitulo">Ejemplo Práctico Aplicado:</span>
                          <p style={{ fontSize: '11.5px', fontStyle: 'italic', color: 'var(--texto-2)', margin: 0, padding: '6px 10px', background: 'var(--superficie-2)', borderRadius: '4px' }}>
                            «{esq.ejemploAplicado}»
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN IV: VOCABULARIO Y LATINISMOS */}
          {seccion === 'vocabulario' && (
            <div className="mgr-seccion">
              <div className="mgr-intro-bloque">
                <h3>IV. Vocabulario Formal y Latinismos Jurídicos</h3>
                <p>
                  Sustituye expresiones coloquiales o ambiguas por léxico forense riguroso y consulta latinismos clásicos con su traducción procesal.
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--texto)', marginBottom: '8px' }}>
                  Tabla de Equivalencias: Coloquial ➔ Forense Formal
                </h4>
                <div className="mgr-rejilla-conectores">
                  {vocabularioFiltrado.coloquial.map((v, vi) => (
                    <div key={vi} className="mgr-tarjeta-conector-cat">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 650, color: 'var(--err, #dc2626)' }}>
                          «{v.coloquial}»
                        </span>
                        <span className="mgr-badge-general">{v.contexto}</span>
                      </div>
                      <div className="mgr-chips-wrap" style={{ marginTop: '4px' }}>
                        {v.sugerenciasFormale.map((s, si) => (
                          <span key={si} className="mgr-chip juridica">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--texto)', marginBottom: '8px' }}>
                  Catálogo de Latinismos Jurídicos (En Cursiva)
                </h4>
                <div className="mgr-rejilla-protocolo">
                  {vocabularioFiltrado.latinismos.map((lat, li) => (
                    <div key={li} className="mgr-tarjeta-protocolo">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontStyle: 'italic', fontWeight: 700, fontSize: '13px', color: 'var(--primario)' }}>
                          {lat.latinismo}
                        </span>
                        <span className="mgr-badge-juridica">{lat.traduccion}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--texto-2)', margin: '4px 0 0 0' }}>
                        {lat.significadoForense}
                      </p>
                      <p style={{ fontSize: '11.5px', fontStyle: 'italic', color: 'var(--texto-3)', margin: '4px 0 0 0' }}>
                        Ejemplo: «{lat.ejemplo}»
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN V: ESTRUCTURAS PROCESALES */}
          {seccion === 'estructuras' && (
            <div className="mgr-seccion">
              <div className="mgr-intro-bloque">
                <h3>V. Estructuras Documentales y Checklists</h3>
                <p>
                  Requisitos de admisibilidad y secciones indispensables para demandas, contestaciones y recursos de apelación.
                </p>
              </div>

              {estructurasFiltradas.map((est) => (
                <div key={est.id} className="mgr-tarjeta-protocolo" style={{ marginBottom: '14px' }}>
                  <div className="mgr-protocolo-cab">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <h4 className="mgr-protocolo-titulo">{est.tipo}</h4>
                      <span className="mgr-badge-general">{est.materia}</span>
                    </div>
                    <p className="mgr-protocolo-desc">{est.descripcion}</p>
                  </div>

                  <ul className="mgr-lista-formulas">
                    {est.requisitos.map((req, ri) => (
                      <li key={ri} className="mgr-formula-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Icono n="ok" tam={12} />
                          <b style={{ fontSize: '12px', color: req.obligatorio ? 'var(--primario)' : 'var(--texto)' }}>
                            {req.titulo}
                          </b>
                          {req.obligatorio && (
                            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', background: 'var(--err-bg, rgba(239, 68, 68, 0.1))', color: 'var(--err, #dc2626)', fontWeight: 700 }}>
                              OBLIGATORIO
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11.5px', color: 'var(--texto-2)' }}>{req.descripcion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* SECCIÓN VI: ARGUMENTOS Y FALACIAS */}
          {seccion === 'argumentacion' && (
            <div className="mgr-seccion">
              <div className="mgr-intro-bloque">
                <h3>VI. Tipos de Argumentación y Detección de Falacias</h3>
                <p>
                  Los métodos clásicos de argumentación forense y el catálogo de control de falacias lógicas para asegurar silogismos invulnerables.
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--texto)', marginBottom: '8px' }}>
                  Tipos de Argumentos Jurídicos Clásicos
                </h4>
                <div className="mgr-rejilla-protocolo">
                  {argumentacionFiltrada.argumentos.map((arg) => (
                    <div key={arg.numero} className="mgr-tarjeta-protocolo">
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span className="mgr-cat-num">{arg.numero}</span>
                        <h4 style={{ margin: 0, fontSize: '13.5px', color: 'var(--primario)' }}>{arg.nombre}</h4>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--texto)', margin: '4px 0 0 0' }}>{arg.definicion}</p>
                      <p style={{ fontSize: '11.5px', color: 'var(--texto-3)', margin: '2px 0 0 0' }}>
                        <b>Cuándo usarlo:</b> {arg.cuandoUsarlo}
                      </p>
                      <p style={{ fontSize: '11.5px', fontStyle: 'italic', color: 'var(--texto-2)', margin: '4px 0 0 0' }}>
                        Ejemplo: «{arg.ejemplo}»
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--texto)', marginBottom: '8px' }}>
                  Checklist de Falacias Lógicas y Forenses a Evitar
                </h4>
                <div className="mgr-rejilla-conectores">
                  {argumentacionFiltrada.falacias.map((fal, fi) => (
                    <div key={fi} className="mgr-tarjeta-conector-cat">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--err, #dc2626)' }}>
                          {fal.nombre}
                        </span>
                        <span className="mgr-badge-general">{fal.familia}</span>
                      </div>
                      <p style={{ fontSize: '11.5px', color: 'var(--texto-2)', margin: '4px 0 0 0' }}>{fal.definicion}</p>
                      <div style={{ background: 'var(--superficie-2)', padding: '5px 8px', borderRadius: '4px', marginTop: '4px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 650, color: 'var(--primario)' }}>
                          Pregunta de Control:
                        </span>
                        <p style={{ fontSize: '11px', color: 'var(--texto)', margin: 0 }}>{fal.preguntaControl}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN VII: CIERRES Y PETITORIO */}
          {seccion === 'cierres' && (
            <div className="mgr-seccion">
              <div className="mgr-intro-bloque">
                <h3>VII. Marcadores Conclusivos y Fórmulas de Cierre</h3>
                <p>
                  Sintetizan la argumentación y fundamentan el petitorio procesal (en demandas y recursos)
                  o la parte resolutiva (en informes y fallos).
                </p>
              </div>

              {cierresFiltrados.length === 0 ? (
                <div className="mgr-vacio">No se encontraron fórmulas de cierre para esta búsqueda.</div>
              ) : (
                cierresFiltrados.map((cie, idx) => (
                  <div key={idx} className="mgr-tarjeta-comparativa">
                    <div className="mgr-tarjeta-titulo">
                      <span className="mgr-etiqueta-funcion">{cie.nivel}</span>
                    </div>

                    <div className="mgr-columnas-comparativas">
                      <div className="mgr-col-general">
                        <div className="mgr-col-cabecera">
                          <span className="mgr-badge-general">Redacción General / Académica</span>
                        </div>
                        <ul className="mgr-lista-items">
                          {cie.general.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mgr-col-juridica">
                        <div className="mgr-col-cabecera">
                          <span className="mgr-badge-juridica">Redacción Jurídica Avanzada (Forense / Resolutivo)</span>
                        </div>
                        <div className="mgr-bloques-cierre">
                          {cie.juridicoAvanzado.map((j, i) => (
                            <div key={i} className="mgr-subbloque-cierre">
                              {j.contexto && <span className="mgr-cierre-ctx">{j.contexto}</span>}
                              <ul className="mgr-lista-items forense">
                                {j.formulas.map((f, fi) => (
                                  <li key={fi}>{f}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* SECCIÓN VIII: PROTOCOLO, SALUDOS, SOLICITUDES Y DESPEDIDAS */}
          {seccion === 'protocolo' && (
            <div className="mgr-seccion">
              <div className="mgr-intro-bloque">
                <h3>VIII. Protocolo, Saludos, Solicitudes y Despedidas</h3>
                <p>
                  Fórmulas de cortesía para cartas notariales, notas oficiales, peticiones procesales ante estrados judiciales,
                  agradecimientos y despedidas formales.
                </p>
              </div>

              {protocoloFiltrado.length === 0 ? (
                <div className="mgr-vacio">No se encontraron fórmulas protocolares para esta búsqueda.</div>
              ) : (
                <div className="mgr-rejilla-protocolo">
                  {protocoloFiltrado.map((p) => (
                    <div key={p.id} className="mgr-tarjeta-protocolo">
                      <div className="mgr-protocolo-cab">
                        <h4 className="mgr-protocolo-titulo">{p.ambito}</h4>
                        <p className="mgr-protocolo-desc">{p.descripcion}</p>
                      </div>

                      <div className="mgr-protocolo-grupos">
                        {p.grupos.map((g, gi) => (
                          <div key={gi} className="mgr-protocolo-subgrupo">
                            <span className="mgr-protocolo-subtitulo">{g.titulo}</span>
                            <ul className="mgr-lista-formulas">
                              {g.formulas.map((f, fi) => (
                                <li key={fi} className="mgr-formula-item forense">
                                  <span className="mgr-formula-texto">{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CONSEJO PRÁCTICO DE ESTILO FORENSE (SIEMPRE VISIBLE AL FINAL) */}
          <div className="mgr-banner-estilo">
            <div className="mgr-banner-icono">💡</div>
            <div className="mgr-banner-cuerpo">
              <h4 className="mgr-banner-titulo">{CONSEJO_ESTILO.titulo}</h4>
              <p className="mgr-banner-texto">{CONSEJO_ESTILO.texto}</p>
            </div>
          </div>
        </div>

        {/* Pie informativo */}
        <div className="mgr-pie">
          <span className="mgr-pie-nota">
            Compendio de consulta forense (8 Áreas de Redacción) · Solo lectura y visualización directa
          </span>
          <button type="button" className="btn btn-pri" onClick={cerrar}>
            Cerrar (Esc)
          </button>
        </div>
      </div>
    </Modal>
  );
}
