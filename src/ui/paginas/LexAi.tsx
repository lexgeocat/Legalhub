// src/ui/paginas/LexAi.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ley } from '../../application/casosDeUso/leyes';
import {
  recopilarGroundingLeyes
} from '../../application/ai/groundingLeyes';
import {
  buscarJurisprudenciaWeb,
  ETIQUETAS_AMBITO,
  type AmbitoJuridico
} from '../../application/ai/busquedaJuridicaWeb';
import {
  CAMPOS_IA,
  ORDEN_PROVEEDORES,
  PROVEEDORES_IA,
  consultarLexAi,
  guardarConfigIa,
  listarModelos,
  obtenerConfigIa,
  probarConexionProveedor,
  type ConfigIa,
  type MensajeChatLex,
  type ProveedorIaId
} from '../../application/ai/proveedoresIa';
import { Icono, Insignia, Modal, avisar } from '../_core/comunes';
import { useCargar, useServicios } from '../_core/servicios';
import './LexAi.css';

const SUGERENCIAS_PROMPT = [
  '¿Qué jurisprudencia del Tribunal Supremo de Bolivia rige para la resolución de contrato por incumplimiento?',
  'Fundamenta la garantía del debido proceso y plazo razonable citando el Pacto de San José y la Corte IDH.',
  'Redacta una demanda ejecutiva de cobro de dinero por pagaré impago con conminatoria de embargo de bienes.',
  '¿Cuáles son los requisitos de la prescripción adquisitiva según el Código Civil boliviano y Autos Supremos?'
];

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de Limpieza y Renderizado de Escritos Legales (Sin HTML ni asteriscos)
// ─────────────────────────────────────────────────────────────────────────────

/** Limpia etiquetas HTML residuales (<br>, &nbsp;, <p>, etc.) y normaliza texto */
export function limpiarEntidadesYHtml(raw: string): string {
  if (!raw) return '';
  let t = raw;
  // Convertir <br> o <br/> en saltos de línea reales
  t = t.replace(/<br\s*\/?>/gi, '\n');
  // Convertir <p> y </p> en saltos dobles
  t = t.replace(/<\/?p>/gi, '\n\n');
  t = t.replace(/<\/?div>/gi, '\n');
  // Reemplazar entidades HTML comunes
  t = t.replace(/&nbsp;/gi, ' ');
  t = t.replace(/&amp;/gi, '&');
  t = t.replace(/&quot;/gi, '"');
  t = t.replace(/&#39;/gi, "'");
  t = t.replace(/&lt;/gi, '<');
  t = t.replace(/&gt;/gi, '>');
  // Eliminar cualquier etiqueta HTML residual
  t = t.replace(/<\/?[a-zA-Z0-9_-]+(?:\s+[^>]*?)?>/g, '');
  return t;
}

/** Limpia markdown y códigos web para copiar al portapapeles en texto 100% plano y formal */
export function limpiarParaPortapapeles(raw: string): string {
  let t = limpiarEntidadesYHtml(raw);
  // Reemplazar divisores PRIMERO para que *** no interfiera con **negrita**
  t = t.replace(/^[*\-_]{3,}$/gm, '────────────────────────────────────────────────────────────');
  // Encabezados # Titulo -> Titulo
  t = t.replace(/^#{1,6}\s+/gm, '');
  // Quitar negritas y cursivas markdown
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
  t = t.replace(/__([^_]+)__/g, '$1');
  t = t.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3');
  // Limpiar cualquier residuo de asteriscos dobles sueltos
  t = t.replace(/\*\*/g, '');
  // Reducir saltos triples o más a doble salto
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

/** Genera un archivo HTML compatible con Microsoft Word (.doc) con formato jurídico procesal */
export function generarHtmlWord(raw: string): string {
  const limpio = limpiarEntidadesYHtml(raw);
  const bloques = limpio.split(/\n{2,}/);

  let cuerpoHtml = '';

  for (const bloque of bloques) {
    const b = bloque.trim();
    if (!b) continue;

    // Encabezado principal (# ...)
    if (b.startsWith('# ')) {
      const txt = b.replace(/^#\s+/, '').replace(/\*\*/g, '');
      cuerpoHtml += `<h1 style="text-align:center; font-size:14pt; font-weight:bold; text-transform:uppercase; margin-top:20pt; margin-bottom:12pt; font-family:'Times New Roman', serif;">${escapeHtml(txt)}</h1>\n`;
      continue;
    }

    // Subtítulo (## ...)
    if (b.startsWith('## ')) {
      const txt = b.replace(/^##\s+/, '').replace(/\*\*/g, '');
      cuerpoHtml += `<h2 style="font-size:12.5pt; font-weight:bold; margin-top:14pt; margin-bottom:6pt; font-family:'Times New Roman', serif;">${escapeHtml(txt)}</h2>\n`;
      continue;
    }

    // Sección (### ...)
    if (b.startsWith('### ')) {
      const txt = b.replace(/^###\s+/, '').replace(/\*\*/g, '');
      cuerpoHtml += `<h3 style="font-size:12pt; font-weight:bold; margin-top:10pt; margin-bottom:4pt; font-family:'Times New Roman', serif;">${escapeHtml(txt)}</h3>\n`;
      continue;
    }

    // Línea divisora
    if (/^[*\-_]{3,}$/.test(b)) {
      cuerpoHtml += `<hr style="border:0; border-top:1px solid #777; margin:16pt 0;" />\n`;
      continue;
    }

    // Bloque de firmas
    if (
      b.includes('______') ||
      (/firma/i.test(b) && (b.includes('C.I.') || /vendedor|comprador|abogado|demandante|demandado/i.test(b)))
    ) {
      const lineas = b.split('\n').filter((l) => l.trim().length > 0);
      const colIzq: string[] = [];
      const colDer: string[] = [];
      let esDobleColumna = false;

      for (const linea of lineas) {
        const partes = linea.trim().split(/\s{4,}/);
        if (partes.length >= 2) {
          esDobleColumna = true;
          colIzq.push(formatearTextoWord(partes[0]));
          colDer.push(formatearTextoWord(partes[1]));
        } else {
          colIzq.push(formatearTextoWord(linea));
        }
      }

      if (esDobleColumna && colDer.length > 0) {
        cuerpoHtml += `
<table style="width:100%; margin-top:40pt; margin-bottom:20pt; border-collapse:collapse; border:none; font-family:'Times New Roman', serif;">
  <tr>
    <td style="width:50%; text-align:center; vertical-align:top; border:none; padding:10pt;">
      ${colIzq.join('<br>')}
    </td>
    <td style="width:50%; text-align:center; vertical-align:top; border:none; padding:10pt;">
      ${colDer.join('<br>')}
    </td>
  </tr>
</table>\n`;
      } else {
        cuerpoHtml += `
<table style="width:60%; margin:40pt auto 20pt auto; border-collapse:collapse; border:none; font-family:'Times New Roman', serif;">
  <tr>
    <td style="text-align:center; vertical-align:top; border:none; padding:10pt;">
      ${colIzq.join('<br>')}
    </td>
  </tr>
</table>\n`;
      }
      continue;
    }

    // Listas ordenadas o con viñetas
    const lineasBloque = b.split('\n');
    if (lineasBloque.every((l) => /^\s*(\d+\.|[-*•])\s+/.test(l))) {
      const esOrdenada = /^\s*\d+\.\s+/.test(lineasBloque[0]);
      const tagLista = esOrdenada ? 'ol' : 'ul';
      cuerpoHtml += `<${tagLista} style="margin-top:6pt; margin-bottom:10pt; padding-left:24pt; font-family:'Times New Roman', serif;">\n`;
      for (const linea of lineasBloque) {
        const txtLi = linea.replace(/^\s*(\d+\.|[-*•])\s+/, '');
        cuerpoHtml += `  <li style="margin-bottom:4pt; text-align:justify;">${formatearTextoWord(txtLi)}</li>\n`;
      }
      cuerpoHtml += `</${tagLista}>\n`;
      continue;
    }

    // Nota o recomendación
    if (/^\*\*(?:RECOMENDACI[ÓO]N|NOTA|IMPORTANTE)/i.test(b) || b.startsWith('> ')) {
      const txt = b.replace(/^>\s*/, '');
      cuerpoHtml += `<div style="background-color:#f0f4f8; border-left:4px solid #1a56db; padding:10pt 14pt; margin:14pt 0; font-family:'Times New Roman', serif; font-size:11pt;">${formatearTextoWord(txt)}</div>\n`;
      continue;
    }

    // Párrafo procesal estándar
    cuerpoHtml += `<p style="margin-top:0; margin-bottom:8pt; text-align:justify; line-height:1.5; font-family:'Times New Roman', serif; text-indent:1.25cm;">${formatearTextoWord(b)}</p>\n`;
  }

  return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>Documento Jurídico - Lex AI</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
  @page {
    size: letter portrait;
    margin: 2.5cm 3cm 2.5cm 3cm;
  }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #000000;
  }
</style>
</head>
<body>
${cuerpoHtml}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatearTextoWord(str: string): string {
  let s = escapeHtml(str);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<i>$2</i>$3');
  s = s.replace(/(\[[A-Za-z0-9Á-ÿ\s/.,#°_\-:]+\])/g, '<span style="background-color:#fff2cc; font-weight:bold;">$1</span>');
  s = s.replace(/\n/g, '<br>');
  return s;
}

interface BloqueLegal {
  tipo: 'h1' | 'h2' | 'h3' | 'divisor' | 'firmas' | 'lista' | 'nota' | 'parrafo';
  contenido: string;
  items?: string[];
  listaOrdenada?: boolean;
  firmasIzquierda?: string[];
  firmasDerecha?: string[];
}

function parsearBloquesLegales(texto: string): BloqueLegal[] {
  const bloquesRaw = texto.split(/\n{2,}/);
  const resultado: BloqueLegal[] = [];

  for (const raw of bloquesRaw) {
    const b = raw.trim();
    if (!b) continue;

    // Divisor
    if (/^[*\-_]{3,}$/.test(b)) {
      resultado.push({ tipo: 'divisor', contenido: b });
      continue;
    }

    // Encabezado 1 (# ...)
    if (b.startsWith('# ')) {
      resultado.push({ tipo: 'h1', contenido: b.replace(/^#\s+/, '') });
      continue;
    }

    // Encabezado 2 (## ...)
    if (b.startsWith('## ')) {
      resultado.push({ tipo: 'h2', contenido: b.replace(/^##\s+/, '') });
      continue;
    }

    // Encabezado 3 (### ...)
    if (b.startsWith('### ')) {
      resultado.push({ tipo: 'h3', contenido: b.replace(/^###\s+/, '') });
      continue;
    }

    // Firmas
    if (
      b.includes('______') ||
      (/firma/i.test(b) && (b.includes('C.I.') || /vendedor|comprador|abogado|demandante|demandado/i.test(b)))
    ) {
      const lineas = b.split('\n').filter((l) => l.trim().length > 0);
      const colIzq: string[] = [];
      const colDer: string[] = [];
      let esDobleColumna = false;

      for (const linea of lineas) {
        const partes = linea.trim().split(/\s{4,}/);
        if (partes.length >= 2) {
          esDobleColumna = true;
          colIzq.push(partes[0].trim());
          colDer.push(partes[1].trim());
        } else {
          colIzq.push(linea.trim());
        }
      }

      resultado.push({
        tipo: 'firmas',
        contenido: b,
        firmasIzquierda: colIzq,
        firmasDerecha: esDobleColumna && colDer.length > 0 ? colDer : undefined
      });
      continue;
    }

    // Listas ordenadas o no ordenadas
    const lineas = b.split('\n');
    if (lineas.length > 0 && lineas.every((l) => /^\s*(\d+\.|[-*•])\s+/.test(l))) {
      const esOrdenada = /^\s*\d+\.\s+/.test(lineas[0]);
      const items = lineas.map((l) => l.replace(/^\s*(\d+\.|[-*•])\s+/, '').trim());
      resultado.push({
        tipo: 'lista',
        contenido: b,
        items,
        listaOrdenada: esOrdenada
      });
      continue;
    }

    // Notas o recomendaciones
    if (/^\*\*(?:RECOMENDACI[ÓO]N|NOTA|IMPORTANTE)/i.test(b) || b.startsWith('> ')) {
      resultado.push({
        tipo: 'nota',
        contenido: b.replace(/^>\s*/, '')
      });
      continue;
    }

    // Párrafo normal
    resultado.push({ tipo: 'parrafo', contenido: b });
  }

  return resultado;
}

function renderizarTextoInline(texto: string): React.ReactNode[] {
  const regex = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\[[A-Za-z0-9Á-ÿ\s/.,#°_\-:]+\]|\*[^*\n]+\*|\n)/g;
  const partes = texto.split(regex);

  return partes.map((parte, i) => {
    if (!parte) return null;
    if (parte === '\n') {
      return <br key={i} />;
    }
    // Negrita
    if ((parte.startsWith('**') && parte.endsWith('**')) || (parte.startsWith('__') && parte.endsWith('__'))) {
      const contenido = parte.slice(2, -2);
      if (contenido.startsWith('[') && contenido.endsWith(']')) {
        return (
          <strong key={i} className="lexai-doc-bold">
            <span className="lexai-doc-marcador">{contenido}</span>
          </strong>
        );
      }
      return (
        <strong key={i} className="lexai-doc-bold">
          {contenido}
        </strong>
      );
    }
    // Marcador [TEXTO]
    if (parte.startsWith('[') && parte.endsWith(']')) {
      return (
        <span key={i} className="lexai-doc-marcador" title="Campo a completar">
          {parte}
        </span>
      );
    }
    // Cursiva
    if (parte.startsWith('*') && parte.endsWith('*') && parte.length > 2) {
      const contenido = parte.slice(1, -1);
      return (
        <em key={i} className="lexai-doc-italic">
          {contenido}
        </em>
      );
    }
    return <span key={i}>{parte}</span>;
  });
}

/** Componente de renderizado de escritos procesales y documentos legales */
export function RenderizadorEscritoLegal({ texto }: { texto: string }) {
  const bloques = useMemo(() => {
    const limpio = limpiarEntidadesYHtml(texto);
    return parsearBloquesLegales(limpio);
  }, [texto]);

  return (
    <div className="lexai-doc-formateado">
      {bloques.map((b, idx) => {
        if (b.tipo === 'h1') {
          return (
            <h2 key={idx} className="lexai-doc-h1">
              {renderizarTextoInline(b.contenido)}
            </h2>
          );
        }
        if (b.tipo === 'h2') {
          return (
            <h3 key={idx} className="lexai-doc-h2">
              {renderizarTextoInline(b.contenido)}
            </h3>
          );
        }
        if (b.tipo === 'h3') {
          return (
            <h4 key={idx} className="lexai-doc-h3">
              {renderizarTextoInline(b.contenido)}
            </h4>
          );
        }
        if (b.tipo === 'divisor') {
          return <hr key={idx} className="lexai-doc-divisor" />;
        }
        if (b.tipo === 'firmas') {
          return (
            <div
              key={idx}
              className={`lexai-doc-firmas-grid${b.firmasDerecha && b.firmasDerecha.length > 0 ? ' doble-columna' : ' una-columna'}`}
            >
              <div className="lexai-doc-firma-col">
                {b.firmasIzquierda?.map((linea, lIdx) => (
                  <div key={lIdx} className="lexai-doc-firma-linea">
                    {renderizarTextoInline(linea)}
                  </div>
                ))}
              </div>
              {b.firmasDerecha && b.firmasDerecha.length > 0 && (
                <div className="lexai-doc-firma-col">
                  {b.firmasDerecha.map((linea, lIdx) => (
                    <div key={lIdx} className="lexai-doc-firma-linea">
                      {renderizarTextoInline(linea)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
        if (b.tipo === 'lista') {
          if (b.listaOrdenada) {
            return (
              <ol key={idx} className="lexai-doc-ol">
                {b.items?.map((it, iIdx) => (
                  <li key={iIdx}>{renderizarTextoInline(it)}</li>
                ))}
              </ol>
            );
          }
          return (
            <ul key={idx} className="lexai-doc-ul">
              {b.items?.map((it, iIdx) => (
                <li key={iIdx}>{renderizarTextoInline(it)}</li>
              ))}
            </ul>
          );
        }
        if (b.tipo === 'nota') {
          return (
            <div key={idx} className="lexai-doc-nota">
              <div className="lexai-doc-nota-icono">
                <Icono n="destello" tam={16} />
              </div>
              <div className="lexai-doc-nota-contenido">{renderizarTextoInline(b.contenido)}</div>
            </div>
          );
        }
        return (
          <p key={idx} className="lexai-doc-p">
            {renderizarTextoInline(b.contenido)}
          </p>
        );
      })}
    </div>
  );
}

export default function LexAi() {
  const s = useServicios();
  const listaLeyes = useCargar(() => s.leyes.listar(), []);

  // Configuración de IA
  const [configIa, setConfigIa] = useState<ConfigIa>(obtenerConfigIa);
  const [modalConfigAbierto, setModalConfigAbierto] = useState(false);

  // Leyes que provienen EXCLUSIVAMENTE del módulo Leyes
  const leyesDisponibles = useMemo<Ley[]>(() => {
    return listaLeyes.datos ?? [];
  }, [listaLeyes.datos]);

  // Selección de leyes para Grounding
  const [leyesSeleccionadas, setLeyesSeleccionadas] = useState<Set<string>>(() => new Set());
  const [filtroLeyes, setFiltroLeyes] = useState('');
  const [panelFuentesVisible, setPanelFuentesVisible] = useState(true);
  const inicializadoRef = useRef(false);

  // Inicializar selección de leyes una sola vez al cargar la lista de leyes del módulo
  useEffect(() => {
    if (!inicializadoRef.current && listaLeyes.datos && listaLeyes.datos.length > 0) {
      inicializadoRef.current = true;
      setLeyesSeleccionadas(new Set(listaLeyes.datos.map((l) => l.id)));
    }
  }, [listaLeyes.datos]);

  // Historial de conversación directa por prompts
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
  const [busquedaWebActiva, setBusquedaWebActiva] = useState(true);
  const [ambitoSeleccionado, setAmbitoSeleccionado] = useState<AmbitoJuridico>('bolivia');
  const [modoRawPorMensaje, setModoRawPorMensaje] = useState<Record<string, boolean>>({});
  const finalChatRef = useRef<HTMLDivElement | null>(null);

  // Guardar mensajes en la sesión
  useEffect(() => {
    try {
      sessionStorage.setItem('lexai_chat_mensajes', JSON.stringify(mensajes));
    } catch {
      // ignore
    }
  }, [mensajes]);

  // Auto-scroll al enviar o recibir mensajes
  useEffect(() => {
    if (mensajes.length > 0) {
      finalChatRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, generando]);

  const alternarLey = (id: string) => {
    setLeyesSeleccionadas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) {
        nuevo.delete(id);
      } else {
        nuevo.add(id);
      }
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

  // Enviar Prompt directo a Lex AI
  const handleEnviarPrompt = async (textoAEnviar?: string) => {
    const promptFinal = (textoAEnviar ?? promptInput).trim();
    if (!promptFinal) return;
    if (generando) return;

    const mensajeUsuario: MensajeChatLex = {
      id: `usr-${Date.now()}`,
      rol: 'usuario',
      texto: promptFinal,
      creadoEn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMensajes((prev) => [...prev, mensajeUsuario]);
    setPromptInput('');
    setGenerando(true);
    setProgresoInvestigacion('Analizando leyes y normativas locales...');

    try {
      // 1. Recopilar grounding de leyes seleccionadas
      const { articulos, leyesNombres } = await recopilarGroundingLeyes(
        s,
        leyesSeleccionadas,
        promptFinal,
        leyesDisponibles
      );

      // 2. Búsqueda jurídica en internet (jurisprudencia, tratados y doctrina)
      let resultadoWeb: { fuentes: any[]; terminoBuscado: string } | undefined;
      if (busquedaWebActiva) {
        setProgresoInvestigacion(
          `Buscando jurisprudencia y tratados en la web (${ETIQUETAS_AMBITO[ambitoSeleccionado].nombre})...`
        );
        try {
          const resBusqueda = await buscarJurisprudenciaWeb(promptFinal, ambitoSeleccionado);
          if (resBusqueda.fuentes.length > 0) {
            resultadoWeb = resBusqueda;
          }
        } catch (errWeb) {
          console.warn('Búsqueda web jurídica omitida:', errWeb);
        }
      }

      // 3. Historial de conversación previo
      const historial = mensajes.slice(-4).map((m) => ({
        rol: m.rol,
        texto: m.texto
      }));

      // 4. Ejecutar consulta por prompt
      setProgresoInvestigacion(
        `Fundamentando con Lex AI (${infoProveedor.nombre}: ${modeloActual || 'activo'})...`
      );
      const res = await consultarLexAi({
        prompt: promptFinal,
        historial,
        articulosContexto: articulos,
        leyesSeleccionadasNombres: leyesNombres,
        fuentesWeb: resultadoWeb?.fuentes,
        ambito: busquedaWebActiva ? ambitoSeleccionado : undefined
      });

      const mensajeAsistente: MensajeChatLex = {
        id: `asist-${Date.now()}`,
        rol: 'asistente',
        texto: res.texto,
        tiempoMs: res.tiempoMs,
        modeloUsado: res.modeloUsado,
        proveedorUsado: res.proveedorUsado,
        citasDetectadas: res.citasDetectadas,
        fuentesConsultadas: articulos,
        fuentesWeb: resultadoWeb?.fuentes,
        ambitoUsado: busquedaWebActiva ? ambitoSeleccionado : undefined,
        terminoWebBuscado: resultadoWeb?.terminoBuscado,
        creadoEn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMensajes((prev) => [...prev, mensajeAsistente]);
    } catch (err) {
      console.error(err);
      const msgError = err instanceof Error ? err.message : String(err);
      avisar(`Error de Lex AI: ${msgError}`, 'error');
      setMensajes((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          rol: 'asistente',
          texto: `⚠️ No se pudo completar la solicitud con el motor de IA:\n\n${msgError}\n\nPuedes revisar tu clave o cambiar de modelo en la Configuración de IAs.`,
          creadoEn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setGenerando(false);
      setProgresoInvestigacion(null);
    }
  };

  const copiarTexto = (txt: string) => {
    const textoLimpio = limpiarParaPortapapeles(txt);
    navigator.clipboard.writeText(textoLimpio);
    avisar('Texto limpio copiado al portapapeles');
  };

  const exportarWord = (txt: string) => {
    const htmlWord = generarHtmlWord(txt);
    const blob = new Blob(['\ufeff' + htmlWord], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Escrito_LexAI_${Date.now()}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    avisar('Documento descargado en formato Word (.doc)');
  };

  const limpiarConversacion = () => {
    if (mensajes.length === 0) return;
    if (window.confirm('¿Deseas iniciar una nueva conversación y limpiar los mensajes actuales?')) {
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
          </div>
          <p className="subtitulo">
            Asistente procesal directo mediante prompts. Analiza y redacta fundamentado en tus códigos y leyes activas.
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
                  <span>Carga tus códigos o leyes en PDF desde la sección "Leyes" para investigarlos aquí.</span>
                </div>
              ) : leyesFiltradas.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--texto-3)', fontSize: '12px' }}>
                  No hay coincidencias con «{filtroLeyes}»
                </div>
              ) : (
                leyesFiltradas.map((ley) => {
                  const activa = leyesSeleccionadas.has(ley.id);
                  return (
                    <label
                      key={ley.id}
                      className={`lexai-fuente-item${activa ? ' activa' : ''}`}
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
                          {ley.numArticulos > 0 && (
                            <>
                              <span>·</span>
                              <span className="articulos">{ley.numArticulos} arts.</span>
                            </>
                          )}
                          {ley.numPaginas > 0 && (
                            <>
                              <span>·</span>
                              <span>{ley.numPaginas} págs.</span>
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
                  Escribe libremente cualquier instrucción o pregunta jurídica. Todo se procesa directamente mediante
                  prompts, fundamentando con precisión en tus <b>{leyesSeleccionadas.size} leyes activas</b>.
                </p>

                <div className="lexai-sugerencias-directas">
                  <span className="lexai-sugerencias-titulo">Sugerencias de prompt para iniciar:</span>
                  <div className="lexai-sugerencias-grid">
                    {SUGERENCIAS_PROMPT.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        className="lexai-chip-prompt"
                        onClick={() => {
                          setPromptInput(sug);
                        }}
                      >
                        <Icono n="pluma" tam={13} />
                        <span>{sug}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="lexai-mensajes-flujo">
                {mensajes.map((msg) => {
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
                      <div className="lexai-msg-tarjeta-legal">
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
                          </div>

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
                              onClick={() => copiarTexto(msg.texto)}
                              title="Copiar texto limpio sin asteriscos ni etiquetas"
                            >
                              <Icono n="documento" tam={14} />
                              <span>Copiar</span>
                            </button>
                            <button
                              type="button"
                              className="lexai-btn-accion-icono"
                              onClick={() => exportarWord(msg.texto)}
                              title="Descargar en Word (.doc)"
                            >
                              <Icono n="pluma" tam={14} />
                              <span>Word (.doc)</span>
                            </button>
                          </div>
                        </div>

                        {/* Fuentes Web y Jurisprudencia en Vivo */}
                        {msg.fuentesWeb && msg.fuentesWeb.length > 0 && (
                          <details className="lexai-acordeon-fuentes-web" open={false}>
                            <summary className="lexai-summary-fuentes-web">
                              <div className="lexai-sum-web-izq">
                                <span className="lexai-icono-globo">🌐</span>
                                <span className="lexai-citas-titulo">
                                  <b>{msg.fuentesWeb.length} fuentes web y jurisprudencia consultadas:</b>
                                </span>
                                {msg.ambitoUsado && (
                                  <span className="lexai-tag-ambito-badge">
                                    {ETIQUETAS_AMBITO[msg.ambitoUsado]?.icono} {ETIQUETAS_AMBITO[msg.ambitoUsado]?.nombre}
                                  </span>
                                )}
                              </div>
                              <div className="lexai-sum-web-der">
                                {msg.fuentesWeb.slice(0, 3).map((fw, idx) => (
                                  <span key={idx} className={`lexai-chip-web-tipo ${fw.tipo}`}>
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
                                  🔍 Búsqueda realizada en internet: <code>{msg.terminoWebBuscado}</code>
                                </div>
                              )}
                              {msg.fuentesWeb.map((fw, idx) => (
                                <div key={idx} className="lexai-fuente-web-card">
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
                                      title="Abrir fuente jurídica externa"
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

                        {/* Fuentes y artículos investigados automáticamente en las leyes seleccionadas */}
                        {msg.fuentesConsultadas && msg.fuentesConsultadas.length > 0 && (
                          <details className="lexai-acordeon-fuentes" open={false}>
                            <summary className="lexai-summary-fuentes">
                              <span className="lexai-citas-titulo">
                                <Icono n="libro" tam={13} />
                                <b>{msg.fuentesConsultadas.length} artículos analizados en tus leyes:</b>
                              </span>
                              <span className="lexai-resumen-fuentes-chips">
                                {msg.fuentesConsultadas.slice(0, 4).map((f, idx) => (
                                  <span key={idx} className="lexai-chip-fuente-investigada">
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
                              {msg.fuentesConsultadas.map((art, idx) => (
                                <div key={idx} className="lexai-fuente-item-investigado">
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

                        {/* Citas detectadas en la respuesta procesal */}
                        {msg.citasDetectadas && msg.citasDetectadas.length > 0 && (
                          <div className="lexai-citas-flotantes">
                            <span className="lexai-citas-titulo">
                              <Icono n="destello" tam={13} /> Preceptos invocados en el escrito:
                            </span>
                            {msg.citasDetectadas.map((c, idx) => (
                              <span key={idx} className="lexai-cita-tag">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Texto del escrito */}
                        <div className="lexai-msg-texto-legal">
                          {modoRawPorMensaje[msg.id] ? (
                            <pre className="lexai-msg-pre-raw">{msg.texto}</pre>
                          ) : (
                            <RenderizadorEscritoLegal texto={msg.texto} />
                          )}
                        </div>
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
                          `Lex AI (${infoProveedor.nombre}: ${modeloActual || 'activo'}) está cotejando leyes y redactando...`}
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
              {/* Barra de herramientas para Búsqueda Web y Jurisdicción */}
              <div className="lexai-prompt-toolbar">
                <div className="lexai-prompt-toolbar-izq">
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
                      <span className="lexai-lbl-ambito">Ordenamiento:</span>
                      <select
                        className="lexai-select-ambito"
                        value={ambitoSeleccionado}
                        onChange={(e) => setAmbitoSeleccionado(e.target.value as AmbitoJuridico)}
                        title="Selecciona la jurisdicción u ordenamiento jurídico para la consulta"
                      >
                        {(Object.keys(ETIQUETAS_AMBITO) as AmbitoJuridico[]).map((key) => {
                          const amb = ETIQUETAS_AMBITO[key];
                          return (
                            <option key={key} value={key}>
                              {amb.icono} {amb.nombre}
                            </option>
                          );
                        })}
                      </select>
                      <span className="lexai-ambito-pista">
                        {ETIQUETAS_AMBITO[ambitoSeleccionado].descripcion}
                      </span>
                    </div>
                  )}
                </div>
              </div>

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
                placeholder="Escribe tu instrucción legal aquí... (ej: 'Redacta memorial', 'Fundamenta con jurisprudencia del TSJ', 'Analiza plazo razonable según la Corte IDH')..."
              />

              <div className="lexai-prompt-pie">
                <div className="lexai-prompt-info-contexto">
                  <Icono n="libro" tam={13} />
                  <span>
                    <b>{leyesSeleccionadas.size} leyes</b> locales
                    {busquedaWebActiva && (
                      <> · <span className="lexai-pie-web-tag">🌐 Web: {ETIQUETAS_AMBITO[ambitoSeleccionado].etiquetaCorta}</span></>
                    )}
                    {' '}· <b>Enter</b> para enviar
                  </span>
                </div>

                <button
                  type="button"
                  className="lexai-btn-enviar-prompt"
                  disabled={generando || !promptInput.trim()}
                  onClick={() => void handleEnviarPrompt()}
                >
                  {generando ? (
                    <>
                      <Icono n="flujo" tam={16} />
                      <span>Generando...</span>
                    </>
                  ) : (
                    <>
                      <Icono n="destello" tam={16} />
                      <span>Enviar Prompt</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modal de Configuración de IAs */}
      {modalConfigAbierto && (
        <ModalConfiguracionIa
          configActual={configIa}
          cerrar={() => setModalConfigAbierto(false)}
          alGuardar={(nueva) => {
            guardarConfigIa(nueva);
            setConfigIa(nueva);
            setModalConfigAbierto(false);
            avisar(`Motor guardado: ${PROVEEDORES_IA[nueva.proveedorActivo].nombre}`);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal de Configuración de IAs (Modelos reales en vivo)
// ─────────────────────────────────────────────────────────────

interface ModalConfigProps {
  configActual: ConfigIa;
  cerrar: () => void;
  alGuardar: (nueva: ConfigIa) => void;
}

function ModalConfiguracionIa({ configActual, cerrar, alGuardar }: ModalConfigProps) {
  const [cfg, setCfg] = useState<ConfigIa>({ ...configActual });
  const [tabActiva, setTabActiva] = useState<ProveedorIaId>(configActual.proveedorActivo);
  const [testResultado, setTestResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [probando, setProbando] = useState(false);

  // Modelos reales detectados en vivo por proveedor
  const [modelosPorProveedor, setModelosPorProveedor] = useState<Record<string, string[]>>({});
  const [cargandoModelos, setCargandoModelos] = useState(false);
  const [errorModelos, setErrorModelos] = useState<string | null>(null);

  const campos = CAMPOS_IA[tabActiva];
  const infoActual = PROVEEDORES_IA[tabActiva];
  const claveActual = (cfg[campos.clave] as string) || '';
  const modeloActual = (cfg[campos.modelo] as string) || '';

  // Función para consultar y verificar modelos reales en vivo
  const cargarModelos = async (prov: ProveedorIaId, conf: ConfigIa, silencioso = false) => {
    const info = PROVEEDORES_IA[prov];
    const key = (conf[CAMPOS_IA[prov].clave] as string).trim();
    if (info.claveParaListar && !key) {
      setErrorModelos('Pega tu API Key para ver tus modelos disponibles en vivo.');
      return;
    }

    setCargandoModelos(true);
    setErrorModelos(null);
    try {
      const lista = await listarModelos(prov, conf);
      setModelosPorProveedor((prev) => ({ ...prev, [prov]: lista }));
      // Si el modelo actual está vacío o no está en la lista recibida, auto-seleccionar el primero verificado
      const campoMod = CAMPOS_IA[prov].modelo;
      const modActual = conf[campoMod] as string;
      if (!modActual || !lista.includes(modActual)) {
        if (lista.length > 0) {
          setCfg((prev) => ({ ...prev, [campoMod]: lista[0] }));
        }
      }
      if (!silencioso) {
        avisar(`${lista.length} modelos reales activos detectados de ${info.nombre}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorModelos(msg);
      if (!silencioso) avisar(msg, 'error');
    } finally {
      setCargandoModelos(false);
    }
  };

  // Cargar modelos automáticamente al cambiar de pestaña
  useEffect(() => {
    setTestResultado(null);
    setErrorModelos(null);
    cargarModelos(tabActiva, cfg, true);
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

  const modelosDisponibles = modelosPorProveedor[tabActiva] || [];

  return (
    <Modal titulo="Configuración de IAs para Redacción Jurídica" cerrar={cerrar} ancho="grande">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Selector de pestañas de proveedores */}
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

          {/* Opciones específicas de Ollama (URL del servidor) */}
          {tabActiva === 'ollama' && (
            <>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--texto-sec)' }}>Presets de URL:</span>
                <button
                  type="button"
                  onClick={() => {
                    const nuevo = { ...cfg, ollamaUrl: 'https://ollama.com' };
                    setCfg(nuevo);
                    cargarModelos('ollama', nuevo);
                  }}
                  style={{
                    fontSize: '11.5px',
                    padding: '3px 9px',
                    borderRadius: '5px',
                    background: cfg.ollamaUrl.includes('ollama.com') ? 'var(--primario)' : 'var(--superficie-2)',
                    color: cfg.ollamaUrl.includes('ollama.com') ? '#ffffff' : 'var(--texto)',
                    border: '1px solid var(--borde)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  ☁️ Ollama Cloud (https://ollama.com)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nuevo = { ...cfg, ollamaUrl: 'http://localhost:11434' };
                    setCfg(nuevo);
                    cargarModelos('ollama', nuevo);
                  }}
                  style={{
                    fontSize: '11.5px',
                    padding: '3px 9px',
                    borderRadius: '5px',
                    background: cfg.ollamaUrl.includes('localhost') ? 'var(--primario)' : 'var(--superficie-2)',
                    color: cfg.ollamaUrl.includes('localhost') ? '#ffffff' : 'var(--texto)',
                    border: '1px solid var(--borde)',
                    cursor: 'pointer',
                    fontWeight: 600
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
                  onBlur={() => cargarModelos('ollama', cfg)}
                  placeholder="https://ollama.com o http://localhost:11434"
                />
              </div>
            </>
          )}

          {/* Campo de API Key / Token */}
          <div className="lexai-campo-fila">
            <label>API Key / Token de {infoActual.nombre}</label>
            <input
              type="password"
              value={claveActual}
              onChange={(e) => {
                const nuevo = { ...cfg, [campos.clave]: e.target.value };
                setCfg(nuevo);
              }}
              onBlur={() => cargarModelos(tabActiva, cfg)}
              placeholder={infoActual.placeholderClave}
            />
            <span className="campo-ayuda">
              Al ingresar tu token, se verifica y lista únicamente los modelos que responden activamente.
            </span>
          </div>

          {/* Selector de Modelos Reales Verificados */}
          <div className="lexai-campo-fila">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>
                Modelo en el Servidor{' '}
                {modelosDisponibles.length > 0 && (
                  <span style={{ fontSize: '11.5px', fontWeight: 'normal', color: 'var(--texto-sec)' }}>
                    ({modelosDisponibles.length} modelo{modelosDisponibles.length === 1 ? '' : 's'} disponible{modelosDisponibles.length === 1 ? '' : 's'})
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={() => cargarModelos(tabActiva, cfg)}
                disabled={cargandoModelos}
                style={{
                  fontSize: '11.5px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--primario)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline'
                }}
              >
                {cargandoModelos ? 'Verificando modelos...' : '🔄 Actualizar modelos'}
              </button>
            </div>

            {cargandoModelos ? (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '7px',
                  background: 'var(--superficie-2)',
                  border: '1px solid var(--borde)',
                  fontSize: '12.5px',
                  color: 'var(--texto-sec)'
                }}
              >
                ⏳ Verificando cuáles modelos responden activamente desde el servidor de {infoActual.nombre}...
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
                  style={{ width: '150px' }}
                  value={modeloActual}
                  onChange={(e) => setCfg({ ...cfg, [campos.modelo]: e.target.value })}
                  placeholder="Otro modelo..."
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
                      color: '#ef4444',
                      fontSize: '12px'
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
        <div className="lexai-test-fila">
          <button type="button" className="lexai-btn-test" disabled={probando} onClick={probarActual}>
            {probando ? 'Comprobando...' : 'Probar conexión y modelo'}
          </button>
          {testResultado && (
            <span className={`lexai-test-resultado ${testResultado.ok ? 'ok' : 'error'}`}>
              {testResultado.mensaje}
            </span>
          )}
        </div>

        {/* Ajustes Generales */}
        <div
          style={{
            marginTop: '8px',
            paddingTop: '12px',
            borderTop: '1px solid var(--borde)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <label style={{ fontSize: '12.5px', fontWeight: 600 }}>
            Temperatura Creativa: <span style={{ color: 'var(--primario)' }}>{cfg.temperatura}</span>
            <span style={{ fontSize: '11px', color: 'var(--texto-sec)', fontWeight: 'normal', marginLeft: '6px' }}>
              (0.1 = Máximo rigor jurídico procesal, 0.7 = Mayor variedad narrativa)
            </span>
          </label>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={cfg.temperatura}
            onChange={(e) => setCfg({ ...cfg, temperatura: parseFloat(e.target.value) })}
            style={{ width: '160px' }}
          />
        </div>

        {/* Acciones del Modal */}
        <div className="lexai-modal-pie-acciones">
          <button type="button" className="lexai-btn-accion-doc" onClick={cerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="lexai-btn-accion-doc primario"
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
