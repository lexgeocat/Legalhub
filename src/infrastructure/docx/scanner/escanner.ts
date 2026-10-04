import { strFromU8, unzipSync } from 'fflate';
import type { CampoEsquema, ResultadoEscaneo } from '../../../application/puertos/motorPlantillas';
import { FILTROS } from '../../../domain/filtros';
import { claveNormalizada, mensaje, normalizarCaracteres, parsearToken, type Token } from '../gramatica';

export interface OpcionesEscaneo {
  validarRuta?: (ruta: string, ambito: readonly string[]) => { valida: boolean; aviso?: string };
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const PARTES = /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/;
const MARCADOR = /\{\{([\s\S]*?)\}\}/g;

const TIPO_POR_FILTRO: Record<string, string> = {
  moneda: 'moneda', fecha: 'fecha', superficie: 'superficie', literal: 'numero',
  ci: 'ci', lista: 'lista', concordar: 'texto', mayus: 'texto', minus: 'texto', titulo: 'texto',
};

function invalido(error: string): ResultadoEscaneo {
  return { esValido: false, errores: [error], advertencias: [], info: [], esquema: [] };
}

function ubicar(t: Element): { parrafo: Element | null; enCuadro: boolean } {
  let n: Node | null = t.parentNode;
  let parrafo: Element | null = null;
  let enCuadro = false;
  while (n && n.nodeType === 1) {
    const el = n as Element;
    if (el.namespaceURI === W) {
      if (el.localName === 'p' && !parrafo) parrafo = el;
      if (el.localName === 'txbxContent') enCuadro = true;
    }
    n = el.parentNode;
  }
  return { parrafo, enCuadro };
}

function etiquetaDe(ruta: string): string {
  const ultimo = ruta.split('.').pop() ?? ruta;
  const t = ultimo.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function escanear(plantilla: Uint8Array, opciones: OpcionesEscaneo = {}): ResultadoEscaneo {
  let partes: Record<string, Uint8Array>;
  try {
    partes = unzipSync(plantilla, { filter: (f) => PARTES.test(f.name) });
  } catch {
    return invalido('El archivo no es un .docx válido (ZIP dañado)');
  }
  if (!partes['word/document.xml']) return invalido('El .docx no contiene word/document.xml');

  const errores: string[] = [];
  const advertencias: string[] = [];
  const esquema: CampoEsquema[] = [];
  const vistos = new Set<string>();
  let totalMarcadores = 0;
  let contenedores = 0;
  let tablas = 0;

  for (const [nombre, datos] of Object.entries(partes)) {
    if (nombre === 'word/comments.xml') {
      advertencias.push('El modelo contiene comentarios');
      continue;
    }
    const xml = new DOMParser().parseFromString(strFromU8(datos), 'application/xml');
    if (xml.getElementsByTagName('parsererror').length > 0) {
      errores.push(`${nombre}: XML inválido`);
      continue;
    }

    for (const rev of ['ins', 'del', 'moveFrom', 'moveTo']) {
      if (xml.getElementsByTagNameNS(W, rev).length > 0) {
        errores.push(`${nombre}: tiene cambios controlados pendientes (acéptalos o recházalos en Word)`);
        break;
      }
    }
    if (xml.getElementsByTagNameNS(W, 'fldSimple').length + xml.getElementsByTagNameNS(W, 'instrText').length > 0) {
      advertencias.push(`${nombre}: contiene campos de Word`);
    }
    tablas += xml.getElementsByTagNameNS(W, 'tbl').length;

    const parrafos = new Map<Element, { texto: string; enCuadro: boolean }>();
    for (const t of Array.from(xml.getElementsByTagNameNS(W, 't'))) {
      const { parrafo, enCuadro } = ubicar(t);
      if (!parrafo) continue;
      const previo = parrafos.get(parrafo);
      parrafos.set(parrafo, {
        texto: (previo?.texto ?? '') + (t.textContent ?? ''),
        enCuadro: enCuadro || !!previo?.enCuadro,
      });
    }

    const tokens: Token[] = [];
    let heredado = false;
    let enCuadros = false;

    for (const { texto: original, enCuadro } of parrafos.values()) {
      const texto = normalizarCaracteres(original);
      for (const m of texto.matchAll(MARCADOR)) {
        const idx = m.index ?? 0;
        if (/[“”‘’«»„\u00A0]/.test(original.slice(idx, idx + m[0].length))) heredado = true;
        if (enCuadro) enCuadros = true;
        try {
          const token = parsearToken(m[1]);
          if (token.tipo === 'valor') {
            for (const f of token.filtros) {
              if (!Object.hasOwn(FILTROS, f.nombre)) errores.push(`${nombre}: filtro desconocido «${f.nombre}» en ${m[0]}`);
            }
          }
          tokens.push(token);
        } catch (e) {
          errores.push(`${nombre}: marcador inválido ${m[0]}: ${mensaje(e)}`);
        }
      }
      const resto = texto.replace(MARCADOR, '');
      if (/\{\{|\}\}/.test(resto)) {
        errores.push(`${nombre}: marcador incompleto o partido entre párrafos o celdas cerca de «${resto.trim().slice(0, 60)}»`);
      } else if (/[{}]/.test(resto)) {
        advertencias.push(`${nombre}: hay llaves que no son marcadores cerca de «${resto.trim().slice(0, 60)}»`);
      }
    }

    if (heredado) advertencias.push(`${nombre}: se normalizaron comillas tipográficas o espacios duros dentro de marcadores`);
    if (enCuadros) advertencias.push(`${nombre}: hay marcadores dentro de cuadros de texto`);

    const pila: string[] = [];
    const abiertos: string[] = [];
    for (const token of tokens) {
      totalMarcadores++;
      if (token.tipo === 'apertura') {
        contenedores++;
        pila.push(token.ruta);
        abiertos.push(token.ruta);
        continue;
      }
      if (token.tipo === 'cierre') {
        const tope = pila.pop();
        abiertos.pop();
        if (tope === undefined) errores.push(`${nombre}: cierre «/${token.ruta}» sin apertura`);
        else if (claveNormalizada(tope) !== claveNormalizada(token.ruta)) {
          errores.push(`${nombre}: el cierre «/${token.ruta}» no coincide con la apertura «#${tope}»`);
        }
        continue;
      }
      if (token.ruta === '.') continue;
      if (opciones.validarRuta && token.ruta !== '.') {
        const r = opciones.validarRuta(token.ruta, abiertos);
        if (!r.valida) errores.push(`${nombre}: campo desconocido «${token.ruta}»`);
        else if (r.aviso && !advertencias.includes(r.aviso)) advertencias.push(r.aviso);
      }
      const clave = `${abiertos.map(claveNormalizada).join('>')}|${claveNormalizada(token.ruta)}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      const tipo = token.filtros.map((f) => TIPO_POR_FILTRO[f.nombre]).find(Boolean) ?? 'texto';
      esquema.push({ path: token.ruta, tipo, requerido: true, etiqueta: etiquetaDe(token.ruta), ambito: [...abiertos] });
    }
    for (const sinCerrar of pila) errores.push(`${nombre}: apertura «#${sinCerrar}» sin cierre`);
  }

  return {
    esValido: errores.length === 0,
    errores,
    advertencias,
    info: [`${totalMarcadores} marcadores · ${contenedores} bloques · ${tablas} tablas`],
    esquema,
  };
}

export function lint(plantilla: Uint8Array): { errores: string[]; advertencias: string[] } {
  const r = escanear(plantilla);
  return { errores: r.errores, advertencias: r.advertencias };
}