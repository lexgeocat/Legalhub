import {
    useEffect, useImperativeHandle, useRef, useState,
    type ClipboardEvent, type CSSProperties, type FormEvent, type KeyboardEvent, type MouseEvent, type Ref,
} from 'react';
import {
    bloquesATexto, COLORES_RESALTADO, esColorResaltado, esListaOrdenada, esTipoLista, formatearMarcadorLista,
    PAGINA_CM, margenesSeguros, parsearTexto, tramosDe,
    type Alineacion, type Bloque, type BloqueParrafo, type BloqueTabla, type CeldaTabla, type ColorResaltado,
    type ConfigPagina, type EstiloParrafo, type Margenes, type TipoLista, type Tramo,
} from '../../domain/modelos/fuenteModelo';
import {
    agregarAlDiccionarioPersonal, analizarParrafoObservador, calcularMetricasDocumento, cargarDiccionarioPersonal,
    type CategoriaObservador, type HallazgoObservador, type MetricasDocumento,
} from '../../domain/redaccion/observadorRedaccion';
import { buscarSinonimos, type ResultadoSinonimos } from '../../domain/redaccion/tesauroForense';
import { Regla } from './Regla';
import { usePaginacion } from '../compartidos/Paginacion';
import './editorWord.css';
import { pilaCss } from '../../domain/fuentes/fuentes';
import { htmlABloques } from './pegadoHtml';
import { SIN_CONTEXTO, describirMarcador, type ContextoMarcadores } from '../../domain/modelos/marcadores';
import { lineaCss, useRazonLinea } from './metricasFuente';
import { datoAsignable } from '../../domain/modelos/camposParte';

const PX_POR_CM = 37.7953;
const MARGEN_LIENZO = 48;
const TAB_CM = 1.25; // igual que el tabulador por defecto de Word (708 twips)

const BASE: Record<EstiloParrafo, Alineacion> = { normal: 'both', titulo: 'center', subtitulo: 'left' };
const TAG: Record<EstiloParrafo, string> = { normal: 'p', titulo: 'h1', subtitulo: 'h2' };
const DESDE_CSS: Record<string, Alineacion> = { left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', justify: 'both' };
const A_CSS: Record<Alineacion, string> = { left: 'left', center: 'center', right: 'right', both: 'justify' };
const BLOQUES = new Set(['P', 'H1', 'H2']);

export type AccionTabla =
    | 'filaArriba'
    | 'filaAbajo'
    | 'colIzquierda'
    | 'colDerecha'
    | 'eliminarFila'
    | 'eliminarColumna'
    | 'alternarEncabezado'
    | 'eliminarTabla';

export interface EstadoObservador {
    activo: boolean;
    hallazgos: HallazgoObservador[];
    metricas: MetricasDocumento;
    palabraSeleccionada: string;
}

type Atajo =
    | 'negrita' | 'cursiva' | 'subrayado' | 'izquierda' | 'centro' | 'derecha' | 'justificado'
    | 'todo' | 'deshacer' | 'rehacer' | 'sinonimos';

const ATAJOS = new Map<string, Atajo>([
    ['n', 'negrita'], ['k', 'cursiva'], ['s', 'subrayado'],
    ['q', 'izquierda'], ['t', 'centro'], ['d', 'derecha'], ['j', 'justificado'],
    ['e', 'todo'], ['z', 'deshacer'], ['y', 'rehacer'], ['.', 'sinonimos'],
]);

function atajoDe(tecla: string, mayus: boolean): Atajo | null {
    const k = tecla.toLowerCase();
    if (k === 'z' && mayus) return 'rehacer'; // Ctrl+Mayús+Z, además de Ctrl+Y
    return mayus ? null : (ATAJOS.get(k) ?? null);
}

const ESTILOS_RUIDO = [
    'font', 'font-family', 'font-size', 'font-variant', 'color', 'background', 'background-color', 'line-height',
    'letter-spacing', 'word-spacing', 'white-space', 'text-indent', 'margin', 'padding', 'caret-color',
];
const RE_APERTURA = /^\{\{\s*#\s*([^|}\s?]+)/;
const RE_CIERRE = /^\{\{\s*\/\s*([^|}\s?]+)/;

export interface FormatoActivo {
    negrita: boolean;
    cursiva: boolean;
    subrayado: boolean;
    alineacion: Alineacion;
    estilo: EstiloParrafo;
    /** Fuente, tamaño (pt) e interlineado de la selección; null = los base del documento. */
    fuente: string | null;
    tamanoPt: number | null;
    interlineado: number | null;
    /** Columnas del párrafo donde está el cursor (1 = normal). */
    columnas: number;
    /** Color de resaltado en el cursor/selección (null = sin resaltado). */
    resaltado: ColorResaltado | null;
    /** Modo resaltador activo (como marcador de Word al arrastrar sobre el texto). */
    modoResaltado?: ColorResaltado | 'quitar' | null;
    /** Tipo de lista del párrafo actual ('ul' = viñetas, 'ol' = numerada, null = párrafo normal). */
    lista: TipoLista | null;
    /** true si el cursor está dentro de una celda de tabla. */
    enTabla: boolean;
}

export const FORMATO_INICIAL: FormatoActivo = {
    negrita: false, cursiva: false, subrayado: false, alineacion: 'both', estilo: 'normal',
    fuente: null, tamanoPt: null, interlineado: null, columnas: 1,
    resaltado: null, lista: null, enTabla: false,
};
export interface MenuCampoInfo {
    marcador: string;
    x: number;
    y: number;
    /** Bloques «{{#…}}» abiertos donde está el campo. */
    ambito: string[];
    /** Marcadores de los campos que toca la selección (solo si son más de uno y el campo clicado está dentro). */
    seleccion: string[];
    /** Reemplaza el campo por otro marcador ('' = quitarlo). */
    reemplazar: (nuevo: string) => void;
    reemplazarSeleccion: (fn: (marcador: string, ambito: string[]) => string | null) => number;
    editar: () => void;
}

/** Cómo se edita un dato directamente sobre el documento. */
export interface EdicionDirecta {
    /** Texto crudo (sin filtros) que se edita. */
    texto: string;
    /** El valor real se edita en su caja natural, pero se VE con esta transformación (filtros mayus / minus / titulo). */
    transformar?: 'mayus' | 'minus' | 'titulo';
    /** true: Enter inserta salto de línea y Ctrl+Enter confirma. */
    multilinea?: boolean;
    /** Formato esperado: se muestra mientras el campo está vacío. */
    pista?: string;
}

/** Selector que aparece junto al dato mientras se edita (p. ej. el género al escribir el nombre). */
export interface SelectorEdicion {
    titulo: string;
    /** Valor actual ('' = sin elegir). */
    valor: string;
    opciones: { valor: string; etiqueta: string; tecla?: string }[];
    cambiar(valor: string): void;
}
interface SelectorVisible extends SelectorEdicion {
    izq: number;
    arriba: number;
    elegir: (valor: string) => void;
}

/** Modo «llenar»: cada campo muestra el dato real del expediente y al hacer clic su propio texto se vuelve editable. */
export interface LlenadoHoja {
    /** Texto del dato: '' = falta, undefined = este campo no se llena aquí (queda como etiqueta). */
    valor(marcador: string, ambito: string[]): string | undefined;
    /** Texto crudo editable. Si no se define, se edita lo que se ve. */
    crudo?(marcador: string, ambito: string[]): EdicionDirecta | undefined;
    /** Recibe el texto escrito al confirmar. */
    guardar?(marcador: string, ambito: readonly string[], valor: string): void;
    /** Selector que se muestra junto al dato mientras se edita. */
    selector?(marcador: string, ambito: string[]): SelectorEdicion | undefined;
    /** Solo muestra valores de ejemplo: no se editan y los campos se siguen pudiendo editar como código. */
    soloVista?: boolean;
}

export interface EstadoHistorial {
    puedeDeshacer: boolean;
    puedeRehacer: boolean;
}

export interface ControlHoja {
    leerTexto(): string;
    insertar(texto: string, bloque: boolean): void;
    comando(c: 'negrita' | 'cursiva' | 'subrayado'): void;
    alinear(a: Alineacion): void;
    saltoPagina(): void;
    deshacer(): void;
    rehacer(): void;
    estadoHistorial(): EstadoHistorial;
    suscribirHistorial(fn: (e: EstadoHistorial) => void): () => void;
    enfocar(): void;
    contarPendientes(): number;
    /** Aplica `fn` a todos los campos del documento; si devuelve un marcador lo reemplaza. Devuelve cuántos cambió. */
    reasignar(fn: (marcador: string, ambito: string[]) => string | null): number;
    /** Solo para lo seleccionado (o lo que escribas desde el cursor / el párrafo del cursor). */
    fuente(nombre: string): void;
    tamano(pt: number): void;
    interlineado(v: number): void;
    columnas(n: number): void;
    saltoColumna(): void;
    /** Aplica o quita color de resaltado al texto seleccionado (null = quitar resaltado). */
    resaltar(color: ColorResaltado | null): void;
    /** Alterna o quita estilo de lista (viñetas o numeración) en los párrafos seleccionados. */
    lista(tipo: TipoLista | null): void;
    /** Inserta una tabla de `filas` × `columnas` en la posición del cursor. */
    insertarTabla(filas: number, columnas: number): void;
    /** Ejecuta una operación estructural sobre la tabla donde está el cursor. */
    accionTabla(accion: AccionTabla): void;
    /** Abre el asistente flotante de sinónimos y corrección sobre la palabra donde está el cursor. */
    abrirSinonimos(): void;
    /** Estado y suscripción del observador inteligente de redacción. */
    estadoObservador(): EstadoObservador;
    suscribirObservador(fn: (e: EstadoObservador) => void): () => void;
    alternarObservador(activo?: boolean): void;
    aplicarHallazgo(id: string, reemplazo: string): void;
    irAHallazgo(id: string): void;
    ignorarHallazgo(id: string): void;
    agregarPalabraDiccionario(palabra: string): void;
    reemplazarPalabraActual(reemplazo: string): void;
}

/* ================= DOM ⇄ bloques ================ */
interface Fmt { b: boolean; i: boolean; u: boolean; fam?: string; pt?: number; hl?: ColorResaltado }
interface Pieza { texto: string; f: Fmt; chip: boolean; br?: boolean }
const SIN_FMT: Fmt = { b: false, i: false, u: false };

const esSalto = (n: Node | null): boolean => n instanceof HTMLElement && n.dataset.salto !== undefined;
const esTabla = (n: Node | null | undefined): n is HTMLTableElement =>
    n instanceof HTMLTableElement && n.dataset.tabla !== undefined;
const esBr = (n: Node | null | undefined): boolean => !!n && n.nodeName === 'BR';
const estiloDe = (b: Element): EstiloParrafo => (b.tagName === 'H1' ? 'titulo' : b.tagName === 'H2' ? 'subtitulo' : 'normal');
/* ----- Regiones de columnas (secciones continuas de Word) ----- */
function esSeccion(n: Node | null | undefined): n is HTMLElement {
    return n instanceof HTMLElement && n.classList.contains('sec-cols');
}

function nuevaSeccion(columnas = 2): HTMLElement {
    const s = document.createElement('div');
    s.className = 'sec-cols';
    s.dataset.cols = String(columnas);
    return s;
}

/** Todos los bloques (p, h1, h2 y saltos) en orden, incluidos los que están dentro de una región de columnas. */
function todosBloques(raiz: HTMLElement): HTMLElement[] {
    const salida: HTMLElement[] = [];
    for (const n of Array.from(raiz.children)) {
        if (!(n instanceof HTMLElement)) continue;
        if (esSeccion(n)) {
            for (const h of Array.from(n.children)) if (h instanceof HTMLElement) salida.push(h);
        } else salida.push(n);
    }
    return salida;
}

/** Saca un párrafo de su región de columnas: lo anterior queda arriba y lo posterior forma otra región debajo. */
function extraerDeSeccion(b: HTMLElement): void {
    const sec = b.parentElement;
    if (!esSeccion(sec)) return;
    const despues: Node[] = [];
    for (let x = b.nextSibling; x; x = x.nextSibling) despues.push(x);
    if (despues.length > 0) {
        const nueva = nuevaSeccion(Number(sec.dataset.cols) || 2);
        nueva.append(...despues);
        sec.after(nueva);
    }
    sec.after(b);
}
interface Tip { izq: number; arriba: number | null; abajo: number | null; titulo: string; detalle: string; ejemplo: string; ayuda: string }

/** Etiquetas y colores del modelo que se está editando (lo fija el componente al montarse). */
let CONTEXTO: ContextoMarcadores = SIN_CONTEXTO;
/** Si está definido, los campos muestran su dato real (modo «llenar»). */
let LLENADO: LlenadoHoja | undefined;
/** Campo cuyo texto se está editando directamente (no se debe repintar mientras tanto). */
let CHIP_EDITANDO: HTMLElement | null = null;

/** Un campo se ve como etiqueta corta (o como su dato real al llenar); el código real vive en data-mk. */
function pintarChip(chip: HTMLElement, marcador: string, ambito: readonly string[] = []): void {
    if (chip === CHIP_EDITANDO) return; // se está editando: no se toca su contenido
    const i = describirMarcador(marcador, CONTEXTO);
    const v = LLENADO?.valor(marcador, [...ambito]);
    const tipo = v === undefined ? i.tipo : v === '' ? 'falta' : 'lleno';
    const corto = v ? v : i.corto;
    const clave = `${tipo}|${i.matiz}|${corto}`;
    if (chip.dataset.mk === marcador && chip.dataset.v === clave && chip.childElementCount === 2) return;
    chip.className = 'mk';
    chip.contentEditable = 'false';
    chip.dataset.mk = marcador;
    chip.dataset.k = tipo;
    chip.dataset.v = clave;
    chip.style.setProperty('--h', String(i.matiz));
    chip.setAttribute('aria-label', v ? `${i.titulo}: ${v}` : i.titulo);
    const etiqueta = document.createElement('span');
    etiqueta.className = 'mk-e';
    etiqueta.textContent = corto;
    const codigo = document.createElement('span');
    codigo.className = 'mk-c';
    codigo.textContent = marcador;
    chip.replaceChildren(etiqueta, codigo);
}

function crearChip(texto: string): HTMLElement {
    const s = document.createElement('span');
    pintarChip(s, texto);
    return s;
}

function repintar(raiz: HTMLElement): void {
    const pila: string[] = [];
    for (const chip of Array.from(raiz.querySelectorAll<HTMLElement>('.mk'))) {
        const m = chip.dataset.mk ?? '';
        pintarChip(chip, m, pila);
        const ap = RE_APERTURA.exec(m);
        if (ap) {
            pila.push(ap[1]);
            continue;
        }
        const ci = RE_CIERRE.exec(m);
        if (ci) {
            const k = ci[1].toLowerCase();
            for (let i = pila.length - 1; i >= 0; i--) {
                if (pila[i].toLowerCase() === k) {
                    pila.length = i;
                    break;
                }
            }
        }
    }
}

function envolver(tag: 'b' | 'i' | 'u', hijo: Node): HTMLElement {
    const e = document.createElement(tag);
    e.appendChild(hijo);
    return e;
}

/** Texto con «\n» (salto suave) → nodos de texto separados por <br>. */
function textoADom(texto: string): DocumentFragment {
    const frag = document.createDocumentFragment();
    texto.split('\n').forEach((linea, i) => {
        if (i > 0) frag.appendChild(document.createElement('br'));
        if (linea) frag.appendChild(document.createTextNode(linea));
    });
    return frag;
}

function tramoADom(t: Tramo): Node {
    let n: Node = t.marcador ? crearChip(t.texto) : textoADom(t.texto);
    if (t.subrayado) n = envolver('u', n);
    if (t.cursiva) n = envolver('i', n);
    if (t.negrita) n = envolver('b', n);
    if (t.fuente || t.tamanoPt || t.resaltado) {
        const s = spanLetra(t.fuente, t.tamanoPt, t.resaltado);
        s.appendChild(n);
        n = s;
    }
    return n;
}

function parrafoVacio(): HTMLElement {
    const p = document.createElement('p');
    p.appendChild(document.createElement('br'));
    return p;
}

function parrafoADom(b: BloqueParrafo): HTMLElement {
    const el = document.createElement(TAG[b.estilo]);
    if (b.alineacion !== BASE[b.estilo]) el.style.textAlign = A_CSS[b.alineacion];
    if (b.interlineado) {
        el.dataset.lh = String(b.interlineado);
        el.style.lineHeight = lineaCss(b.interlineado);
    }
    if (b.nuevaColumna) el.dataset.nc = '1';
    if (b.lista) el.dataset.lista = b.lista;
    if (b.tramos.length === 0) {
        el.appendChild(document.createElement('br'));
        return el;
    }
    for (const t of b.tramos) el.appendChild(tramoADom(t));
    // Un salto suave al final del párrafo necesita un <br> de relleno detrás para verse.
    const ultimo = b.tramos[b.tramos.length - 1];
    if (!ultimo.marcador && ultimo.texto.endsWith('\n')) el.appendChild(document.createElement('br'));
    return el;
}

function tablaADom(b: BloqueTabla): HTMLTableElement {
    const tbl = document.createElement('table');
    tbl.className = 'ed-tabla';
    tbl.dataset.tabla = '1';
    if (b.encabezado) tbl.dataset.encabezado = '1';
    const tbody = document.createElement('tbody');
    b.filas.forEach((fila, rIdx) => {
        const tr = document.createElement('tr');
        const esTh = rIdx === 0 && !!b.encabezado;
        fila.forEach((celda) => {
            const cell = document.createElement(esTh ? 'th' : 'td');
            if (celda.alineacion && celda.alineacion !== 'left') {
                cell.style.textAlign = A_CSS[celda.alineacion];
            }
            if (celda.tramos.length === 0) {
                cell.appendChild(document.createElement('br'));
            } else {
                for (const t of celda.tramos) cell.appendChild(tramoADom(t));
                const ult = celda.tramos[celda.tramos.length - 1];
                if (!ult.marcador && ult.texto.endsWith('\n')) cell.appendChild(document.createElement('br'));
            }
            tr.appendChild(cell);
        });
        tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    return tbl;
}

function saltoADom(): HTMLElement {
    const d = document.createElement('div');
    d.className = 'pg-salto';
    d.contentEditable = 'false';
    d.dataset.salto = '1';
    const s = document.createElement('span');
    s.textContent = 'Salto de página';
    d.appendChild(s);
    return d;
}

function bloquesADom(texto: string): HTMLElement[] {
    const salida: HTMLElement[] = [];
    let sec: HTMLElement | null = null;
    for (const b of parsearTexto(texto)) {
        if (b.tipo === 'salto') {
            salida.push(saltoADom());
            sec = null;
        } else if (b.tipo === 'tabla') {
            salida.push(tablaADom(b));
            sec = null;
        } else if (b.columnas && b.columnas > 1) {
            if (!sec) {
                sec = nuevaSeccion(2);
                salida.push(sec);
            }
            sec.appendChild(parrafoADom(b));
        } else {
            salida.push(parrafoADom(b));
            sec = null;
        }
    }
    return salida.length > 0 ? salida : [parrafoVacio()];
}

/** Texto de un nodo del editor: conserva «\n» y tabulaciones; quita invisibles. */
const limpiarTexto = (s: string) =>
    s.replace(/[\u200B\uFEFF]/g, '').replace(/\u00A0/g, ' ').replace(/[\u2028\u000B]/g, '\n').replace(/\r\n?/g, '\n');
const limpiarMarcador = (s: string) => limpiarTexto(s).replace(/\n/g, ' ');

function formatoDe(el: HTMLElement, f: Fmt): Fmt {
    const r = { ...f };
    const t = el.tagName;
    if (t === 'B' || t === 'STRONG') r.b = true;
    if (t === 'I' || t === 'EM') r.i = true;
    if (t === 'U') r.u = true;
    if (t === 'MARK') {
        const hl = el.dataset.hl;
        r.hl = esColorResaltado(hl) ? hl : 'yellow';
    }
    const s = el.style;
    if (s.fontWeight) r.b = s.fontWeight === 'bold' || s.fontWeight === 'bolder' || Number(s.fontWeight) >= 600;
    if (s.fontStyle) r.i = s.fontStyle === 'italic' || s.fontStyle === 'oblique';
    const dec = s.textDecorationLine || s.textDecoration;
    if (dec) r.u = dec.includes('underline');
    if (el.dataset.fam) r.fam = el.dataset.fam;
    const pt = Number(el.dataset.pt);
    if (pt > 0) r.pt = pt;
    if (esColorResaltado(el.dataset.hl)) r.hl = el.dataset.hl;
    return r;
}

function formatoEn(nodo: Node, hasta: HTMLElement): Fmt {
    const cadena: HTMLElement[] = [];
    for (let n: Node | null = nodo; n && n !== hasta; n = n.parentNode) if (n instanceof HTMLElement) cadena.unshift(n);
    return cadena.reduce((f, el) => formatoDe(el, f), SIN_FMT);
}

/* ================= Negrita, cursiva y subrayado también sobre los campos {{…}} ================= */
const CLAVE_FMT = { negrita: 'b', cursiva: 'i', subrayado: 'u' } as const;
type ComandoFmt = keyof typeof CLAVE_FMT;

/** Texto y campos que toca un rango. Los campos no son editables: el navegador no les aplica formato. */
function objetivosFormato(r: Range): { textos: Text[]; campos: HTMLElement[] } {
    const textos: Text[] = [];
    const campos: HTMLElement[] = [];
    const base = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
    if (!(base instanceof Element)) return { textos, campos };
    const dentro = base.closest<HTMLElement>('.mk');
    if (dentro) return { textos, campos: [dentro] };
    const w = document.createTreeWalker(base, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(n: Node): number {
            if (!r.intersectsNode(n)) return NodeFilter.FILTER_REJECT;
            if (n instanceof HTMLElement) {
                if (n.classList.contains('mk')) return NodeFilter.FILTER_ACCEPT;
                return n.dataset.salto !== undefined ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
            }
            if (n.nodeType === 3) {
                return (n as Text).parentElement?.closest('.mk, [data-salto]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
        },
    });
    for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n instanceof HTMLElement) {
            campos.push(n);
            continue;
        }
        const t = n as Text;
        const desde = t === r.startContainer ? r.startOffset : 0;
        const hasta = t === r.endContainer ? r.endOffset : t.length;
        if (hasta > desde && t.data.slice(desde, hasta).replace(/\u200B/g, '') !== '') textos.push(t);
    }
    return { textos, campos };
}

/** ¿Todo lo seleccionado (texto y campos) ya tiene ese formato? */
function formatoUniforme(raiz: HTMLElement, r: Range, c: ComandoFmt): boolean {
    const { textos, campos } = objetivosFormato(r);
    const k = CLAVE_FMT[c];
    const nodos: Node[] = [...textos, ...campos];
    return nodos.length > 0 && nodos.every((n) => formatoEn(n, raiz)[k]);
}

/** El ancestro más cercano (dentro del bloque) que aplica ese formato. */
function ancestroConFormato(nodo: Node, k: 'b' | 'i' | 'u', raiz: HTMLElement): HTMLElement | null {
    for (let n = nodo.parentElement; n && n !== raiz && !BLOQUES.has(n.tagName) && n.tagName !== 'TD' && n.tagName !== 'TH'; n = n.parentElement) {
        if (formatoDe(n, SIN_FMT)[k]) return n;
    }
    return null;
}

/** Saca `nodo` del ancestro `a`: lo anterior y lo posterior conservan el formato; el nodo queda sin él. */
function aislarDe(a: HTMLElement, nodo: Node): void {
    const antes = document.createRange();
    antes.setStart(a, 0);
    antes.setEndBefore(nodo);
    const despues = document.createRange();
    despues.setStartAfter(nodo);
    despues.setEnd(a, a.childNodes.length);
    const trasF = despues.extractContents();
    const previoF = antes.extractContents();
    const conFormato = (f: DocumentFragment): HTMLElement | null => {
        if ((f.textContent ?? '').replace(/\u200B/g, '') === '' && !f.querySelector('.mk, br')) return null;
        const c = a.cloneNode(false) as HTMLElement;
        c.appendChild(f);
        return c;
    };
    const ini = conFormato(previoF);
    const fin = conFormato(trasF);
    const piezas: Node[] = [];
    if (ini) piezas.push(ini);
    piezas.push(...Array.from(a.childNodes));
    if (fin) piezas.push(fin);
    a.replaceWith(...piezas);
}

/** Pone o quita el formato a un campo {{…}} envolviéndolo (o sacándolo) de <b>, <i> o <u>. */
function formatearCampo(raiz: HTMLElement, chip: HTMLElement, c: ComandoFmt, activar: boolean): void {
    const k = CLAVE_FMT[c];
    if (formatoEn(chip, raiz)[k] === activar) return;
    if (activar) {
        const e = document.createElement(k);
        chip.before(e);
        e.appendChild(chip);
        return;
    }
    for (let i = 0; i < 8 && formatoEn(chip, raiz)[k]; i++) {
        const a = ancestroConFormato(chip, k, raiz);
        if (!a) break;
        aislarDe(a, chip);
    }
}

function recolectar(nodo: Node, f: Fmt, salida: Pieza[]): void {
    for (const h of Array.from(nodo.childNodes)) {
        if (h.nodeType === 3) {
            const t = limpiarTexto((h as Text).data);
            if (t) salida.push({ texto: t, f, chip: false });
        } else if (h instanceof HTMLElement) {
            if (h.classList.contains('mk')) salida.push({ texto: limpiarMarcador(h.dataset.mk ?? h.textContent ?? ''), f, chip: true });
            else if (h.tagName === 'BR') salida.push({ texto: '\n', f, chip: false, br: true });
            else recolectar(h, formatoDe(h, f), salida);
        }
    }
}

/** Une las piezas y reconstruye los marcadores {{…}} aunque estén partidos en varios nodos. */
function aTramos(piezas: Pieza[]): Tramo[] {
    const tramos: Tramo[] = [];
    const poner = (texto: string, f: Fmt, marcador: boolean) => {
        const u = tramos[tramos.length - 1];
        if (
            !marcador && u && !u.marcador && u.negrita === f.b && u.cursiva === f.i && u.subrayado === f.u
            && u.fuente === f.fam && u.tamanoPt === f.pt && u.resaltado === f.hl
        ) u.texto += texto;
        else {
            tramos.push({
                texto, negrita: f.b, cursiva: f.i, subrayado: f.u, marcador,
                ...(f.fam ? { fuente: f.fam } : {}),
                ...(f.pt ? { tamanoPt: f.pt } : {}),
                ...(f.hl ? { resaltado: f.hl } : {}),
            });
        }
    };
    let corrida: Pieza[] = [];
    const vaciar = () => {
        let texto = '';
        const formatos: Fmt[] = [];
        for (const p of corrida) {
            texto += p.texto;
            for (let k = 0; k < p.texto.length; k++) formatos.push(p.f);
        }
        corrida = [];
        for (let i = 0; i < texto.length;) {
            if (texto.startsWith('{{', i)) {
                const fin = texto.indexOf('}}', i + 2);
                if (fin !== -1 && !texto.slice(i, fin).includes('\n')) {
                    poner(texto.slice(i, fin + 2), formatos[i], true);
                    i = fin + 2;
                    continue;
                }
            }
            poner(texto[i], formatos[i], false);
            i += 1;
        }
    };
    for (const p of piezas) {
        if (p.chip) {
            vaciar();
            poner(p.texto, p.f, true);
        } else corrida.push(p);
    }
    vaciar();
    return tramos;
}

function leerAlineacion(el: HTMLElement): Alineacion | null {
    const crudo = (el.style.textAlign || el.getAttribute('align') || '').toLowerCase();
    return DESDE_CSS[crudo] ?? null;
}

function bloqueDeElemento(n: HTMLElement, enColumnas: boolean): Bloque {
    if (esTabla(n)) return tablaDeElemento(n);
    const estilo = estiloDe(n);
    const piezas: Pieza[] = [];
    recolectar(n, SIN_FMT, piezas);
    // El último <br> del bloque es solo relleno, no un salto de línea.
    if (piezas.length > 0 && piezas[piezas.length - 1].br) piezas.pop();
    const lh = Number(n.dataset.lh);
    const lista: TipoLista | undefined = esTipoLista(n.dataset.lista) ? n.dataset.lista : undefined;
    return {
        tipo: 'parrafo', alineacion: leerAlineacion(n) ?? BASE[estilo], estilo, tramos: aTramos(piezas),
        ...(lh > 0 ? { interlineado: lh } : {}),
        ...(enColumnas ? { columnas: 2, ...(n.dataset.nc ? { nuevaColumna: true } : {}) } : {}),
        ...(lista ? { lista } : {}),
    };
}

function tablaDeElemento(tbl: HTMLTableElement): BloqueTabla {
    const filas: CeldaTabla[][] = [];
    const trs = Array.from(tbl.querySelectorAll('tr')).filter((tr) => tr.closest('table') === tbl);
    let encabezado = tbl.dataset.encabezado === '1';
    trs.forEach((tr, rIdx) => {
        const celdas: CeldaTabla[] = [];
        const hijos = Array.from(tr.children).filter(
            (ch): ch is HTMLTableCellElement => ch.tagName === 'TD' || ch.tagName === 'TH',
        );
        if (rIdx === 0 && hijos.some((ch) => ch.tagName === 'TH')) encabezado = true;
        for (const celda of hijos) {
            const piezas: Pieza[] = [];
            recolectar(celda, SIN_FMT, piezas);
            if (piezas.length > 0 && piezas[piezas.length - 1].br) piezas.pop();
            const alin = leerAlineacion(celda);
            celdas.push({
                tramos: aTramos(piezas),
                ...(alin && alin !== 'left' ? { alineacion: alin } : {}),
            });
        }
        if (celdas.length > 0) filas.push(celdas);
    });
    return {
        tipo: 'tabla',
        filas: filas.length > 0 ? filas : [[{ tramos: [] }]],
        ...(encabezado ? { encabezado: true } : {}),
    };
}

function domABloques(raiz: HTMLElement): Bloque[] {
    const salida: Bloque[] = [];
    for (const n of Array.from(raiz.children)) {
        if (!(n instanceof HTMLElement)) continue;
        if (esSalto(n)) {
            salida.push({ tipo: 'salto' });
        } else if (esTabla(n)) {
            salida.push(tablaDeElemento(n));
        } else if (esSeccion(n)) {
            for (const h of Array.from(n.children)) {
                if (!(h instanceof HTMLElement)) continue;
                salida.push(esSalto(h) ? { tipo: 'salto' } : bloqueDeElemento(h, true));
            }
        } else {
            salida.push(bloqueDeElemento(n, false));
        }
    }
    return salida;
}

/* ================= Selección ================= */
interface SelGuardada {
    a: number[]; ao: number;
    f: number[]; fo: number;
    /** Posición lógica por índice de bloque y desplazamiento de caracteres/átomos (inmune a fusión de nodos Text en innerHTML). */
    ba: number; ca: number;
    bf: number; cf: number;
}
interface Snap {
    html: string;
    /** Selección justo antes del cambio que creó esta instantánea (se restaura al deshacer este paso). */
    selAntes: SelGuardada | null;
    /** Selección justo después del cambio que creó esta instantánea (se restaura al rehacer este paso). */
    selDespues: SelGuardada | null;
}

function rutaDe(raiz: Node, nodo: Node): number[] | null {
    const r: number[] = [];
    let n: Node | null = nodo;
    while (n && n !== raiz) {
        const p: Node | null = n.parentNode;
        if (!p) return null;
        r.unshift(Array.prototype.indexOf.call(p.childNodes, n));
        n = p;
    }
    return n === raiz ? r : null;
}

function nodoDe(raiz: Node, ruta: number[]): Node | null {
    let n: Node | null = raiz;
    for (const i of ruta) {
        n = n?.childNodes[i] ?? null;
        if (!n) return null;
    }
    return n;
}

const largo = (n: Node) => (n.nodeType === 3 ? (n as Text).length : n.childNodes.length);

/** Desplazamiento lógico de `(destino, offset)` dentro de un bloque (cada carácter cuenta 1; cada `.mk` o `<br>` cuenta 1). */
function offsetEnBloque(b: HTMLElement, destino: Node, offset: number): number {
    let pos = 0;
    let encontrado = false;
    const pesoSubarbol = (n: Node): number => {
        if (n.nodeType === 3) return (n as Text).data.length;
        if (n instanceof HTMLElement) {
            if (n.classList.contains('mk') || n.tagName === 'BR') return 1;
            let s = 0;
            for (const h of Array.from(n.childNodes)) s += pesoSubarbol(h);
            return s;
        }
        return 0;
    };
    const rec = (n: Node) => {
        if (encontrado) return;
        if (n === destino) {
            if (n.nodeType === 3) {
                pos += Math.min(offset, (n as Text).data.length);
            } else {
                const hijos = n.childNodes;
                const lim = Math.min(offset, hijos.length);
                for (let i = 0; i < lim; i++) pos += pesoSubarbol(hijos[i]);
            }
            encontrado = true;
            return;
        }
        if (n.nodeType === 3) {
            pos += (n as Text).data.length;
            return;
        }
        if (n instanceof HTMLElement) {
            if (n.classList.contains('mk') || n.tagName === 'BR') {
                if (n.contains(destino)) {
                    pos += offset > 0 ? 1 : 0;
                    encontrado = true;
                    return;
                }
                pos += 1;
                return;
            }
            for (const h of Array.from(n.childNodes)) {
                if (encontrado) break;
                rec(h);
            }
        }
    };
    rec(b);
    return pos;
}

/** Convierte un desplazamiento lógico dentro del bloque `b` en un par `(nodo, offset)` válido para Selection. */
function puntoEnBloque(b: HTMLElement, posObjetivo: number): { nodo: Node; offset: number } {
    const hojas = hojasDe(b);
    if (hojas.length === 0) return { nodo: b, offset: 0 };
    let rest = Math.max(0, posObjetivo);
    for (let i = 0; i < hojas.length; i++) {
        const h = hojas[i];
        if (h.nodeType === 3) {
            const t = h as Text;
            const len = t.data.length;
            const sig = hojas[i + 1];
            if (rest < len || (rest === len && (!sig || sig.nodeType !== 3))) {
                return { nodo: t, offset: rest };
            }
            rest -= len;
        } else {
            const padre = h.parentNode;
            const idx = padre ? Array.prototype.indexOf.call(padre.childNodes, h) : 0;
            if (rest === 0 && padre) {
                return { nodo: padre, offset: idx };
            }
            if (rest === 1 && padre) {
                if (i === hojas.length - 1 && h.nodeName === 'BR') {
                    return { nodo: padre, offset: idx };
                }
                const sig = hojas[i + 1];
                if (!sig || sig.nodeType !== 3) {
                    return { nodo: padre, offset: idx + 1 };
                }
            }
            rest -= 1;
        }
    }
    const rFin = alFinal(b);
    return { nodo: rFin.startContainer, offset: rFin.startOffset };
}

function tomarSel(raiz: HTMLElement): SelGuardada | null {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || !s.anchorNode || !s.focusNode || !raiz.contains(s.anchorNode) || !raiz.contains(s.focusNode)) return null;
    const a = rutaDe(raiz, s.anchorNode);
    const f = rutaDe(raiz, s.focusNode);
    if (!a || !f) return null;
    const bloques = todosBloques(raiz);
    const bAncla = bloqueRaiz(raiz, s.anchorNode);
    const bFoco = bloqueRaiz(raiz, s.focusNode);
    const ba = bAncla ? bloques.indexOf(bAncla) : -1;
    const bf = bFoco ? bloques.indexOf(bFoco) : -1;
    const ca = bAncla && ba >= 0 ? offsetEnBloque(bAncla, s.anchorNode, s.anchorOffset) : 0;
    const cf = bFoco && bf >= 0 ? offsetEnBloque(bFoco, s.focusNode, s.focusOffset) : 0;
    return { a, ao: s.anchorOffset, f, fo: s.focusOffset, ba, ca, bf, cf };
}

function ponerRango(r: Range): void {
    const s = window.getSelection();
    if (!s) return;
    s.removeAllRanges();
    s.addRange(r);
}

function inicioDe(b: Node): Range {
    const r = document.createRange();
    r.selectNodeContents(b);
    r.collapse(true);
    return r;
}

/** Inicio del bloque, dentro de los <b>/<i>/<u> vacíos si los hay (así se conserva el formato al escribir). */
function inicioProfundo(b: HTMLElement): Range {
    const r = document.createRange();
    let n: Node = b;
    while (n.firstChild) {
        const h: Node = n.firstChild;
        if (h.nodeType === 3) {
            r.setStart(h, 0);
            r.collapse(true);
            return r;
        }
        if (h instanceof HTMLElement && h.tagName !== 'BR' && !h.classList.contains('mk')) n = h;
        else break;
    }
    r.setStart(n, 0);
    r.collapse(true);
    return r;
}

/** Final del bloque (antes del <br> de relleno). */
function alFinal(el: HTMLElement): Range {
    const r = document.createRange();
    let n: Node = el;
    while (n.lastChild) {
        const u: Node = n.lastChild;
        if (u instanceof HTMLElement && u.classList.contains('mk')) {
            r.setStartAfter(u);
            r.collapse(true);
            return r;
        }
        n = u;
    }
    if (n.nodeName === 'BR') r.setStartBefore(n);
    else if (n.nodeType === 3) r.setStart(n, (n as Text).length);
    else r.setStart(n, 0);
    r.collapse(true);
    return r;
}

function trasNodo(n: Node): Range {
    const r = document.createRange();
    if (n.nodeType === 3) r.setStart(n, (n as Text).length);
    else r.setStartAfter(n);
    r.collapse(true);
    return r;
}

function ponerSel(raiz: HTMLElement, sel: SelGuardada | null): void {
    const s = window.getSelection();
    if (!s) return;
    if (sel) {
        const bloques = todosBloques(raiz);
        if (sel.ba >= 0 && sel.bf >= 0 && bloques.length > 0) {
            const bA = bloques[Math.min(sel.ba, bloques.length - 1)];
            const bF = bloques[Math.min(sel.bf, bloques.length - 1)];
            if (bA && bF && !esSalto(bA) && !esSalto(bF) && !esTabla(bA) && !esTabla(bF)) {
                const pA = puntoEnBloque(bA, sel.ca);
                const pF = puntoEnBloque(bF, sel.cf);
                try {
                    s.setBaseAndExtent(pA.nodo, Math.min(pA.offset, largo(pA.nodo)), pF.nodo, Math.min(pF.offset, largo(pF.nodo)));
                    return;
                } catch {
                    /* respaldo por ruta de nodos */
                }
            }
        }
        const a = nodoDe(raiz, sel.a);
        const f = nodoDe(raiz, sel.f);
        if (a && f) {
            try {
                s.setBaseAndExtent(a, Math.min(sel.ao, largo(a)), f, Math.min(sel.fo, largo(f)));
                return;
            } catch {
                /* respaldo al final */
            }
        }
    }
    const ult = raiz.lastElementChild;
    ponerRango(ult instanceof HTMLElement ? alFinal(ult) : inicioDe(raiz));
}

interface SelNodos { an: Node; ao: number; fn: Node; fo: number }

/** Guarda la selección por nodos (no por rutas): sobrevive a mover párrafos de un contenedor a otro. */
function guardarNodos(): SelNodos | null {
    const s = window.getSelection();
    return s && s.rangeCount > 0 && s.anchorNode && s.focusNode
        ? { an: s.anchorNode, ao: s.anchorOffset, fn: s.focusNode, fo: s.focusOffset }
        : null;
}

function restaurarNodos(g: SelNodos | null): void {
    const s = window.getSelection();
    if (!s || !g || !g.an.isConnected || !g.fn.isConnected) return;
    try {
        s.setBaseAndExtent(g.an, Math.min(g.ao, largo(g.an)), g.fn, Math.min(g.fo, largo(g.fn)));
    } catch {
        /* sin efecto */
    }
}

function bloqueRaiz(raiz: HTMLElement, nodo: Node | null): HTMLElement | null {
    let n: Node | null = nodo;
    while (n && n.parentNode !== raiz && !(esSeccion(n.parentNode) && n.parentNode.parentNode === raiz)) n = n.parentNode;
    return n instanceof HTMLElement && !esSeccion(n) ? n : null;
}

/** Bloque de texto (p, h1, h2) donde está el cursor; null si no hay o es un salto de página. */
function bloqueActual(raiz: HTMLElement): HTMLElement | null {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || !s.anchorNode || !raiz.contains(s.anchorNode)) return null;
    const b = bloqueRaiz(raiz, s.anchorNode);
    return b && !esSalto(b) ? b : null;
}

function bloquesSeleccionados(raiz: HTMLElement): HTMLElement[] {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || !raiz.contains(s.anchorNode)) return [];
    const r = s.getRangeAt(0);
    const lista = todosBloques(raiz).filter((el) => {
        if (esSalto(el) || !r.intersectsNode(el)) return false;
        const terminaAlInicio = !r.collapsed && r.endOffset === 0 && !el.contains(r.startContainer) && (r.endContainer === el || el.contains(r.endContainer));
        return !terminaAlInicio;
    });
    if (lista.length > 0) return lista;
    const b = bloqueRaiz(raiz, s.anchorNode);
    return b && !esSalto(b) ? [b] : [];
}

/** Cambia la etiqueta de un bloque conservando atributos, contenido y selección. */
function renombrar(b: HTMLElement, tag: string): HTMLElement {
    if (b.tagName.toLowerCase() === tag) return b;
    const n = document.createElement(tag);
    for (const a of Array.from(b.attributes)) n.setAttribute(a.name, a.value);
    const s = window.getSelection();
    const g = s && s.rangeCount > 0 && s.anchorNode && s.focusNode
        ? { an: s.anchorNode, ao: s.anchorOffset, fn: s.focusNode, fo: s.focusOffset }
        : null;
    while (b.firstChild) n.appendChild(b.firstChild);
    b.replaceWith(n);
    if (s && g) {
        const mapa = (x: Node) => (x === b ? n : x);
        s.setBaseAndExtent(mapa(g.an), g.ao, mapa(g.fn), g.fo);
    }
    return n;
}

const esVacio = (b: HTMLElement) => (b.textContent ?? '').replace(/[\u200B\s]/g, '') === '';

/** Coloca bloques en el cursor: reemplaza un párrafo vacío, o los pone antes, después o partiendo el párrafo. */
function colocarBloques(raiz: HTMLElement, r: Range, nuevos: HTMLElement[]): void {
    if (!r.collapsed) r.deleteContents();
    const b = bloqueRaiz(raiz, r.startContainer);
    if (!b) {
        raiz.append(...nuevos);
        return;
    }
    if (esSalto(b) || esTabla(b)) {
        b.after(...nuevos);
        return;
    }
    if (esVacio(b) && !b.querySelector('.mk')) {
        b.replaceWith(...nuevos);
        return;
    }
    const pre = document.createRange();
    pre.selectNodeContents(b);
    pre.setEnd(r.startContainer, r.startOffset);
    const post = document.createRange();
    post.selectNodeContents(b);
    post.setStart(r.startContainer, r.startOffset);
    if (pre.toString() === '' && !pre.cloneContents().querySelector('.mk')) {
        b.before(...nuevos);
        return;
    }
    if (post.toString() === '' && !post.cloneContents().querySelector('.mk')) {
        b.after(...nuevos);
        return;
    }
    const resto = b.cloneNode(false) as HTMLElement;
    resto.appendChild(post.extractContents());
    b.after(...nuevos, resto);
}

function colocarCursor(nuevos: HTMLElement[]): void {
    for (const b of nuevos) {
        if (esSalto(b)) continue;
        const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
            const t = n as Text;
            const i = t.data.indexOf('…');
            if (i >= 0 && !t.parentElement?.closest('.mk')) {
                const r = document.createRange();
                r.setStart(t, i);
                r.setEnd(t, i + 1);
                ponerRango(r);
                return;
            }
        }
    }
    const ult = nuevos[nuevos.length - 1];
    if (!ult) return;
    if (esSalto(ult)) {
        const sig = ult.nextElementSibling;
        if (sig instanceof HTMLElement) ponerRango(inicioDe(sig));
        return;
    }
    ponerRango(alFinal(ult));
}

/* ================= Normalización ================= */
function hojasDe(b: HTMLElement): ChildNode[] {
    const salida: ChildNode[] = [];
    const rec = (n: Node) => {
        for (const h of Array.from(n.childNodes)) {
            if (h.nodeType === 3) {
                if ((h as Text).data !== '') salida.push(h);
            } else if (h instanceof HTMLElement) {
                if (h.classList.contains('mk') || h.tagName === 'BR') salida.push(h);
                else rec(h);
            }
        }
    };
    rec(b);
    return salida;
}

/** <br> de relleno para un bloque sin contenido; va dentro de los <b>/<i>/<u> vacíos para no perder el formato. */
function colocarRelleno(b: HTMLElement): void {
    let destino: HTMLElement = b;
    for (let n = destino.lastElementChild; n && /^(B|I|U|SPAN)$/.test(n.tagName); n = destino.lastElementChild) {
        destino = n as HTMLElement;
    }
    destino.appendChild(document.createElement('br'));
}

/** Si un salto suave quedó al final del bloque, necesita un <br> de relleno detrás para que la línea vacía se vea. */
function rellenarSaltoFinal(b: HTMLElement, br: Node | null): void {
    if (!br || !esBr(br)) return;
    const hojas = hojasDe(b);
    if (hojas[hojas.length - 1] === br) (br as ChildNode).after(document.createElement('br'));
}

function limpiarAtributos(b: HTMLElement): void {
    const alin = b.style.textAlign;
    const lh = b.dataset.lh ? b.style.lineHeight : '';
    const propios = (alin ? 1 : 0) + (lh ? 1 : 0);
    if (b.hasAttribute('style') && b.style.length > propios) {
        b.removeAttribute('style');
        if (alin) b.style.textAlign = alin;
        if (lh) b.style.lineHeight = lh;
    }
    for (const e of Array.from(b.querySelectorAll<HTMLElement>('span:not(.mk):not([data-fam]):not([data-pt]):not([data-hl])'))) {
        if (e.style.length === 0) continue;
        for (const p of ESTILOS_RUIDO) e.style.removeProperty(p);
        if (e.style.length === 0) e.removeAttribute('style');
    }
}

function limpiarCelda(celda: HTMLElement): void {
    const hojas = hojasDe(celda);
    const ultima = hojas[hojas.length - 1];
    if (!ultima) colocarRelleno(celda);
    else if (esBr(ultima) && hojas.length > 1 && !esBr(hojas[hojas.length - 2])) ultima.remove();
}

function limpiarBloque(b: HTMLElement): void {
    if (esTabla(b)) {
        b.classList.add('ed-tabla');
        for (const celda of Array.from(b.querySelectorAll<HTMLElement>('td, th'))) {
            limpiarAtributos(celda);
            limpiarCelda(celda);
        }
        return;
    }
    limpiarAtributos(b);
    const hojas = hojasDe(b);
    const ultima = hojas[hojas.length - 1];
    if (!ultima) colocarRelleno(b);
    else if (esBr(ultima) && hojas.length > 1 && !esBr(hojas[hojas.length - 2])) ultima.remove(); // relleno innecesario

    const chips = b.querySelectorAll<HTMLElement>('.mk');
    const texto = (b.textContent ?? '').replace(/\u200B/g, '');
    const solo = chips.length === 1
        && texto.trim() === (chips[0].textContent ?? '').trim()
        && /^\{\{\s*[#/]/.test(chips[0].dataset.mk ?? '');
    b.classList.toggle('mk-bloque', solo);
    // Una línea sin contenido tiene ancho 0: el navegador no la baja de las franjas de página (ver CSS .vacio).
    b.classList.toggle('linea-vacia', chips.length === 0 && texto.trim() === '');
    if (b.classList.length === 0) b.removeAttribute('class');
}

/** Numera consecutivamente los párrafos con lista ordenada para que el CSS `attr(data-num)` muestre 1., 1.1, I., a., etc. */
function numerarListas(raiz: HTMLElement): void {
    let contador = 0;
    let padre = 0;
    let sub = 0;
    let tipoActual = '';
    for (const b of todosBloques(raiz)) {
        const t = b.dataset.lista;
        if (t === 'ol') {
            padre = tipoActual === 'ol' || tipoActual === 'ol-sub' ? padre + 1 : 1;
            sub = 0;
            contador = padre;
            tipoActual = 'ol';
            b.dataset.num = formatearMarcadorLista('ol', padre);
        } else if (t === 'ol-sub') {
            if (tipoActual !== 'ol' && tipoActual !== 'ol-sub') padre = 1;
            else if (padre === 0) padre = 1;
            sub += 1;
            tipoActual = 'ol-sub';
            b.dataset.num = formatearMarcadorLista('ol-sub', sub, padre);
        } else if (esListaOrdenada(t)) {
            contador = tipoActual === t ? contador + 1 : 1;
            padre = 0;
            sub = 0;
            tipoActual = t;
            b.dataset.num = formatearMarcadorLista(t, contador);
        } else {
            contador = 0;
            padre = 0;
            sub = 0;
            tipoActual = '';
            if (b.dataset.num) delete b.dataset.num;
        }
    }
}

/** Convierte el texto «{{…}}» escrito a mano en etiquetas de campo. */
function convertirMarcadores(el: HTMLElement): void {
    if (!(el.textContent ?? '').includes('{{')) return;
    const nodos: Text[] = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n as Text;
        if (!t.parentElement?.closest('.mk') && /\{\{[^\n]*?\}\}/.test(t.data)) nodos.push(t);
    }
    if (nodos.length === 0) return;
    const s = window.getSelection();
    const colapsada = !!s && s.rangeCount > 0 && s.isCollapsed;
    let colocar: HTMLElement | null = null;
    for (const t of nodos) {
        const ancla = colapsada && s && s.anchorNode === t ? s.anchorOffset : -1;
        const marcas = Array.from(t.data.matchAll(/\{\{[^\n]*?\}\}/g));
        for (let k = marcas.length - 1; k >= 0; k--) {
            const m = marcas[k];
            const ini = m.index ?? 0;
            const fin = ini + m[0].length;
            const despues = t.splitText(fin);
            if (!despues.data) despues.remove();
            const medio = t.splitText(ini);
            const chip = crearChip(m[0]);
            medio.replaceWith(chip);
            if (fin === ancla) colocar = chip;
        }
        if (!t.data) t.remove();
    }
    if (colocar) {
        const r = document.createRange();
        const sig = colocar.nextSibling;
        if (!sig || sig.nodeName === 'BR') {
            // Chromium no deja el cursor tras un inline no editable si es lo último del párrafo.
            const zw = document.createTextNode('\u200B');
            colocar.parentNode?.insertBefore(zw, sig);
            r.setStart(zw, 1);
        } else {
            r.setStartAfter(colocar);
        }
        r.collapse(true);
        ponerRango(r);
    }
}

/** Lo que quede suelto en `cont` (texto, <span>, <div>…) pasa a ser párrafo. En la raíz se respetan las regiones de columnas y tablas. */
function agruparSueltos(cont: HTMLElement, raiz: boolean): boolean {
    let cambio = false;
    let sueltos: Node[] = [];
    const cerrar = (antes: Node | null) => {
        if (sueltos.length === 0) return;
        const p = document.createElement('p');
        cont.insertBefore(p, antes);
        for (const n of sueltos) p.appendChild(n);
        sueltos = [];
        cambio = true;
    };
    for (const n of Array.from(cont.childNodes)) {
        if (n instanceof HTMLElement && (esSalto(n) || esTabla(n) || BLOQUES.has(n.tagName) || (raiz && esSeccion(n)))) {
            cerrar(n);
            continue;
        }
        if (n instanceof HTMLElement && n.tagName === 'DIV') {
            cerrar(n);
            renombrar(n, 'p');
            cambio = true;
            continue;
        }
        if (n.nodeType === 3 && !(n as Text).data.trim() && sueltos.length === 0) {
            n.parentNode?.removeChild(n);
            cambio = true;
            continue;
        }
        sueltos.push(n);
    }
    cerrar(null);
    return cambio;
}

/** Un salto de página o tabla no cabe dentro de una región de columnas: la parte en dos y queda fuera. */
function sacarSaltos(sec: HTMLElement): boolean {
    let cambio = false;
    for (; ;) {
        const s = Array.from(sec.children).find((h) => esSalto(h) || esTabla(h));
        if (!s) return cambio;
        cambio = true;
        const despues: Node[] = [];
        for (let x = s.nextSibling; x; x = x.nextSibling) despues.push(x);
        if (despues.length > 0) {
            const nueva = nuevaSeccion(Number(sec.dataset.cols) || 2);
            nueva.append(...despues);
            sec.after(nueva);
        }
        if (s.previousSibling) sec.after(s);
        else sec.before(s);
    }
}

/**
 * Mantiene sanas las regiones de columnas después de cualquier edición (Retroceso, Supr, pegar…):
 * solo contienen párrafos, no quedan vacías y dos regiones pegadas se vuelven una sola.
 */
function repararSecciones(raiz: HTMLElement): boolean {
    const g = guardarNodos();
    let cambio = false;
    for (let i = 0; i < raiz.children.length; i++) {
        const sec = raiz.children[i];
        if (!esSeccion(sec)) continue;
        for (const h of Array.from(sec.children)) {
            if (!esSeccion(h)) continue;
            h.replaceWith(...Array.from(h.childNodes));
            cambio = true;
        }
        if (agruparSueltos(sec, false)) cambio = true;
        if (sacarSaltos(sec)) cambio = true;
    }
    for (const sec of Array.from(raiz.children)) {
        if (!esSeccion(sec)) continue;
        if (sec.childElementCount === 0) {
            sec.remove();
            cambio = true;
            continue;
        }
        const ant = sec.previousElementSibling;
        if (esSeccion(ant)) {
            ant.append(...Array.from(sec.childNodes));
            sec.remove();
            cambio = true;
        }
    }
    if (cambio) restaurarNodos(g);
    return cambio;
}

function normalizar(el: HTMLElement, solo?: HTMLElement | null): void {
    agruparSueltos(el, true);
    repararSecciones(el);
    if (el.children.length === 0) el.appendChild(parrafoVacio());
    // Detrás de un salto, tabla o región de columnas siempre hay un párrafo donde seguir escribiendo.
    if (esSalto(el.lastElementChild) || esTabla(el.lastElementChild) || esSeccion(el.lastElementChild)) {
        el.appendChild(parrafoVacio());
    }

    if (solo && (solo.parentNode === el || esSeccion(solo.parentNode))) {
        convertirMarcadores(solo);
        limpiarBloque(solo);
        numerarListas(el);
        return;
    }
    convertirMarcadores(el);
    for (const b of todosBloques(el)) if (!esSalto(b)) limpiarBloque(b);
    numerarListas(el);
}

/** Bloques abiertos («#rol») en la posición del cursor, según las etiquetas de campo que lo preceden. */
function ambitoEn(raiz: HTMLElement, nodo: Node, offset: number): string[] {
    const pila: string[] = [];
    const chips = raiz.querySelectorAll<HTMLElement>('.mk');
    if (chips.length === 0) return pila;
    const hasta = document.createRange();
    try {
        hasta.setStart(raiz, 0);
        hasta.setEnd(nodo, offset);
        for (const chip of Array.from(chips)) {
            const padre = chip.parentNode;
            if (!padre) continue;
            const pos = Array.prototype.indexOf.call(padre.childNodes, chip) + 1;
            if (hasta.comparePoint(padre, pos) > 0) break; // el cursor está antes del final de este campo
            const m = chip.dataset.mk ?? chip.textContent ?? '';
            const ap = RE_APERTURA.exec(m);
            if (ap) {
                pila.push(ap[1]);
                continue;
            }
            const ci = RE_CIERRE.exec(m);
            if (ci) {
                const k = ci[1].toLowerCase();
                for (let i = pila.length - 1; i >= 0; i--) {
                    if (pila[i].toLowerCase() === k) {
                        pila.length = i;
                        break;
                    }
                }
            }
        }
    } catch {
        return [];
    }
    return pila;
}

function ambitoDeChip(raiz: HTMLElement, chip: HTMLElement): string[] {
    const padre = chip.parentNode;
    return padre ? ambitoEn(raiz, padre, Array.prototype.indexOf.call(padre.childNodes, chip)) : [];
}

/** Campos que toca la selección actual; vacío si el cursor está colapsado. */
function chipsSeleccionados(raiz: HTMLElement): HTMLElement[] {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || s.isCollapsed || !s.anchorNode || !raiz.contains(s.anchorNode)) return [];
    const r = s.getRangeAt(0);
    return Array.from(raiz.querySelectorAll<HTMLElement>('.mk')).filter((c) => r.intersectsNode(c));
}

/* ================= Pegado ================= */
function lineasDePegado(crudo: string): string[] {
    const lineas = crudo
        .replace(/\u2029/g, '\n')
        .replace(/\u000B/g, '\u2028')
        .replace(/\u00A0/g, ' ')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000C\u000E-\u001F\u007F\uFFFE\uFFFF]/g, '')
        .split(/\r\n|\r|\n/);
    if (lineas.length > 1 && lineas[lineas.length - 1] === '') lineas.pop(); // «texto\n» no crea un párrafo extra
    return lineas;
}

function fragmentoDe(linea: string): DocumentFragment {
    const f = document.createDocumentFragment();
    linea.split('\u2028').forEach((parte, i) => {
        if (i > 0) f.appendChild(document.createElement('br'));
        if (parte) f.appendChild(document.createTextNode(parte));
    });
    return f;
}

const restoVacio = (f: DocumentFragment) =>
    (f.textContent ?? '').replace(/\u200B/g, '') === '' && !f.querySelector('.mk') && f.querySelectorAll('br').length <= 1;

/** ¿El cursor está justo detrás de un <br>? (entonces ese <br> es un salto suave real) */
function brAntesDe(r: Range): boolean {
    const c = r.startContainer;
    const o = r.startOffset;
    if (c.nodeType === 1) return esBr(c.childNodes[o - 1]);
    return c.nodeType === 3 && o === 0 && esBr(c.previousSibling);
}

function pegarTexto(raiz: HTMLElement, r: Range, lineas: string[]): void {
    r.collapse(true);
    const bloque = bloqueRaiz(raiz, r.startContainer);
    if (!bloque || esSalto(bloque)) return;

    if (lineas.length === 1) {
        const frag = fragmentoDe(lineas[0]);
        const ultimo = frag.lastChild;
        if (!ultimo) return;
        r.insertNode(frag);
        rellenarSaltoFinal(bloque, ultimo);
        ponerRango(trasNodo(ultimo));
        bloque.normalize();
        return;
    }

    const alineacion = estiloDe(bloque) === 'normal' ? bloque.style.textAlign : '';

    // 1) Lo que hay desde el cursor hasta el final del bloque se aparta (conserva negritas, etc.).
    const corte = document.createRange();
    corte.setStart(r.startContainer, r.startOffset);
    corte.setEnd(bloque, bloque.childNodes.length);
    const resto = corte.extractContents();

    // 2) La primera línea queda donde estaba el cursor.
    const primera = fragmentoDe(lineas[0]);
    const ultimaPrimera = primera.lastChild;
    if (ultimaPrimera) {
        r.insertNode(primera);
        rellenarSaltoFinal(bloque, ultimaPrimera);
    }

    // 3) Las demás líneas son párrafos nuevos; el último recibe el resto del párrafo original.
    const frag = document.createDocumentFragment();
    const finales: [HTMLElement, Node | null][] = [];
    let ultimoNodo: Node | null = null;
    for (let i = 1; i < lineas.length; i++) {
        const p = document.createElement('p');
        if (alineacion) p.style.textAlign = alineacion;
        const contenido = fragmentoDe(lineas[i]);
        ultimoNodo = contenido.lastChild;
        p.appendChild(contenido);
        finales.push([p, ultimoNodo]);
        frag.appendChild(p);
    }
    const ultimo = frag.lastElementChild as HTMLElement;
    ultimo.appendChild(resto);
    bloque.after(frag);
    for (const [p, n] of finales) rellenarSaltoFinal(p, n);

    // El rango se crea DESPUÉS de insertar: mover nodos desde un fragmento reubica los rangos que apuntan dentro.
    ponerRango(ultimoNodo ? trasNodo(ultimoNodo) : inicioDe(ultimo));
    bloque.normalize();
    ultimo.normalize();
}

function pegarBloques(raiz: HTMLElement, r: Range, bloques: Bloque[]): void {
    r.collapse(true);
    const bloque = bloqueRaiz(raiz, r.startContainer);
    const unico = bloques.length === 1 && bloques[0].tipo === 'parrafo' && !bloques[0].lista ? bloques[0] : null;

    if (unico && bloque && !esSalto(bloque) && !esTabla(bloque) && !esVacio(bloque)) {
        const frag = document.createDocumentFragment();
        for (const t of unico.tramos) frag.appendChild(tramoADom(t));
        const ultimo = frag.lastChild;
        if (!ultimo) return;
        r.insertNode(frag);
        rellenarSaltoFinal(bloque, ultimo);
        const sig = ultimo.nextSibling;
        if (!sig || sig.nodeName === 'BR') {
            // Chromium no deja el cursor tras un inline no editable al final del párrafo.
            const zw = document.createTextNode('\u200B');
            ultimo.parentNode?.insertBefore(zw, sig);
            r.setStart(zw, 1);
        } else {
            r.setStartAfter(ultimo);
        }
        r.collapse(true);
        ponerRango(r);
        return;
    }

    const nuevos = bloques.map((b) => (b.tipo === 'salto' ? saltoADom() : b.tipo === 'tabla' ? tablaADom(b) : parrafoADom(b)));
    colocarBloques(raiz, r, nuevos);
    const ult = nuevos[nuevos.length - 1];
    if (!ult) return;
    if (esSalto(ult)) {
        const sig = ult.nextElementSibling;
        if (sig instanceof HTMLElement) ponerRango(inicioDe(sig));
    } else {
        ponerRango(alFinal(ult));
    }
}

/** Mueve el scroll del lienzo para que el cursor quede visible (el DOM directo no lo hace solo). */
function mostrarCursor(raiz: HTMLElement): void {
    const s = window.getSelection();
    const cont = raiz.closest<HTMLElement>('.ed-pagina');
    if (!s || s.rangeCount === 0 || !cont) return;
    const r = s.getRangeAt(0);
    let rect: DOMRect | undefined = r.getClientRects()[0];
    if (!rect || (rect.width === 0 && rect.height === 0)) {
        rect = bloqueRaiz(raiz, r.startContainer)?.getBoundingClientRect();
    }
    if (!rect) return;
    const c = cont.getBoundingClientRect();
    const arriba = c.top + 56; // regla fija
    const abajo = c.bottom - 32;
    if (rect.bottom > abajo) cont.scrollTop += rect.bottom - abajo;
    else if (rect.top < arriba) cont.scrollTop -= arriba - rect.top;
}

/* ================= Fuente, tamaño, resaltado y párrafo (independientes por selección) ================= */
function spanLetra(fam?: string, pt?: number, hl?: ColorResaltado): HTMLElement {
    const s = document.createElement('span');
    if (fam) {
        s.dataset.fam = fam;
        s.style.fontFamily = pilaCss(fam);
    }
    if (pt) {
        s.dataset.pt = String(pt);
        // --esc es la escala de la hoja en pantalla: así el tamaño real (pt) se mantiene proporcional.
        s.style.fontSize = `calc(${pt}pt * var(--esc, 1))`;
    }
    if (hl) {
        s.dataset.hl = hl;
        s.classList.add('ed-hl');
    }
    return s;
}

/** Fuente, tamaño y resaltado efectivos en un punto del texto (el más cercano hacia arriba). */
function letraEn(nodo: Node, hasta: HTMLElement): { fam: string | null; pt: number | null; hl: ColorResaltado | null } {
    let fam: string | null = null;
    let pt: number | null = null;
    let hl: ColorResaltado | null = null;
    for (let n: Node | null = nodo; n && n !== hasta; n = n.parentNode) {
        if (!(n instanceof HTMLElement)) continue;
        if (fam === null && n.dataset.fam) fam = n.dataset.fam;
        if (pt === null && n.dataset.pt) pt = Number(n.dataset.pt) || null;
        if (hl === null && esColorResaltado(n.dataset.hl)) hl = n.dataset.hl;
    }
    return { fam, pt, hl };
}

/** Nodo donde empieza la selección (con selección, el primer texto dentro del punto de inicio). */
function nodoInicial(r: Range): Node {
    let n: Node = r.startContainer;
    if (n.nodeType === 1 && !r.collapsed) {
        let h: Node | null = n.childNodes[r.startOffset] ?? null;
        while (h && h.firstChild && !(h instanceof HTMLElement && h.classList.contains('mk'))) h = h.firstChild;
        if (h) n = h;
    }
    return n;
}

/** Envuelve en un <span> de fuente/tamaño/resaltado solo lo que toca la selección (texto y campos). */
function aplicarLetra(r: Range, c: { fam?: string; pt?: number; hl?: ColorResaltado }): void {
    const base = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
    if (!base) return;
    const sc = r.startContainer, so = r.startOffset, ec = r.endContainer, eo = r.endOffset;

    const objetivos: Node[] = [];
    const w = document.createTreeWalker(base, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(n: Node): number {
            if (!r.intersectsNode(n)) return NodeFilter.FILTER_REJECT;
            if (n.nodeType === 3) {
                return (n as Text).parentElement?.closest('.mk, [data-salto]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
            if (n instanceof HTMLElement) {
                if (n.classList.contains('mk')) return NodeFilter.FILTER_ACCEPT;
                if (n.dataset.salto !== undefined) return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_SKIP;
        },
    });
    for (let n = w.nextNode(); n; n = w.nextNode()) objetivos.push(n);

    const envueltos: HTMLElement[] = [];
    for (const n of objetivos) {
        let destino: Node = n;
        if (n.nodeType === 3) {
            let t = n as Text;
            const desde = t === sc ? so : 0;
            const hasta = t === ec ? eo : t.length;
            if (hasta <= desde) continue;
            if (hasta < t.length) t.splitText(hasta);
            if (desde > 0) t = t.splitText(desde);
            destino = t;
        }
        const sp = spanLetra(c.fam, c.pt, c.hl);
        destino.parentNode?.replaceChild(sp, destino);
        sp.appendChild(destino);
        envueltos.push(sp);
    }
    if (envueltos.length === 0) return;
    const nr = document.createRange();
    nr.setStartBefore(envueltos[0]);
    nr.setEndAfter(envueltos[envueltos.length - 1]);
    ponerRango(nr);
}

/** Quita el resaltado de los nodos de texto o campos dentro del rango `r`. */
function quitarResaltadoRango(raiz: HTMLElement, r: Range): void {
    const base = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
    if (!base) return;
    const sc = r.startContainer, so = r.startOffset, ec = r.endContainer, eo = r.endOffset;
    const objetivos: Node[] = [];
    const w = document.createTreeWalker(base, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(n: Node): number {
            if (!r.intersectsNode(n)) return NodeFilter.FILTER_REJECT;
            if (n.nodeType === 3) {
                return (n as Text).parentElement?.closest('.mk, [data-salto]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
            if (n instanceof HTMLElement) {
                if (n.classList.contains('mk')) return NodeFilter.FILTER_ACCEPT;
                if (n.dataset.salto !== undefined) return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_SKIP;
        },
    });
    for (let n = w.nextNode(); n; n = w.nextNode()) objetivos.push(n);

    const limpios: Node[] = [];
    for (const n of objetivos) {
        let destino: Node = n;
        if (n.nodeType === 3) {
            let t = n as Text;
            const desde = t === sc ? so : 0;
            const hasta = t === ec ? eo : t.length;
            if (hasta <= desde) continue;
            if (hasta < t.length) t.splitText(hasta);
            if (desde > 0) t = t.splitText(desde);
            destino = t;
        }
        // Sacar de todos los ancestros con data-hl o <mark>
        for (let i = 0; i < 8; i++) {
            let anc: HTMLElement | null = null;
            for (let p = destino.parentElement; p && p !== raiz && !BLOQUES.has(p.tagName) && p.tagName !== 'TD' && p.tagName !== 'TH'; p = p.parentElement) {
                if (p.dataset.hl || p.tagName === 'MARK') {
                    anc = p;
                    break;
                }
            }
            if (!anc) break;
            if (anc.dataset.fam || anc.dataset.pt) {
                // Tiene también fuente o tamaño: separar y quitar solo data-hl en la parte central
                aislarDe(anc, destino);
            } else {
                aislarDe(anc, destino);
            }
        }
        limpios.push(destino);
    }
    if (limpios.length > 0) {
        const nr = document.createRange();
        nr.setStartBefore(limpios[0]);
        nr.setEndAfter(limpios[limpios.length - 1]);
        ponerRango(nr);
    }
}

function heredarParrafo(de: HTMLElement, a: HTMLElement, alineacion: boolean): void {
    if (alineacion && de.style.textAlign) a.style.textAlign = de.style.textAlign;
    if (de.dataset.lh) {
        a.dataset.lh = de.dataset.lh;
        a.style.lineHeight = de.style.lineHeight;
    }
    if (de.dataset.lista) {
        a.dataset.lista = de.dataset.lista;
    }
}

/* ================= Edición directa de un dato (llenar) ================= */
type Salida = 'blur' | 'enter' | 'esc' | 'sig' | 'ant';

const TRANSFORMAR_CSS = { mayus: 'uppercase', minus: 'lowercase', titulo: 'capitalize' } as const;

function aplicarTransformacion(t: string, k?: EdicionDirecta['transformar']): string {
    if (k === 'mayus') return t.toUpperCase();
    if (k === 'minus') return t.toLowerCase();
    if (k === 'titulo') return t.replace(/(^|\s)(\p{L})/gu, (_m, s: string, c: string) => s + c.toUpperCase());
    return t;
}

/** Texto plano de lo escrito dentro del campo (soporta <br> y bloques que meta el navegador). */
function textoEditado(raiz: HTMLElement): string {
    let s = '';
    const rec = (n: Node) => {
        for (const h of Array.from(n.childNodes)) {
            if (h.nodeType === 3) s += (h as Text).data;
            else if (h.nodeName === 'BR') s += '\n';
            else if (h instanceof HTMLElement) {
                if ((h.tagName === 'DIV' || h.tagName === 'P') && s !== '' && !s.endsWith('\n')) s += '\n';
                rec(h);
            }
        }
    };
    rec(raiz);
    return s.replace(/[\u200B\uFEFF]/g, '').replace(/\u00A0/g, ' ').replace(/\r\n?/g, '\n');
}

const normalizarEntrada = (t: string, multilinea: boolean): string =>
    multilinea ? t.replace(/[ \t]+\n/g, '\n').trim() : t.replace(/\s+/g, ' ').trim();

/** Cursor justo detrás del campo (con el truco del carácter invisible si es lo último del párrafo). */
function cursorTras(chip: HTMLElement): Range {
    const r = document.createRange();
    const sig = chip.nextSibling;
    if (!sig || sig.nodeName === 'BR') {
        const zw = document.createTextNode('\u200B');
        chip.parentNode?.insertBefore(zw, sig);
        r.setStart(zw, 1);
    } else {
        r.setStartAfter(chip);
    }
    r.collapse(true);
    return r;
}

function caretEn(x: number, y: number): Range | null {
    const d = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
    return d.caretRangeFromPoint?.(x, y) ?? null;
}

/* ================= Componente ================= */
const MAX_HISTORIAL = 200;
const MAX_HISTORIAL_CHARS = 24_000_000;
const PAUSA_HISTORIAL_MS = 300;
const MAX_AGRUPAR_MS = 1500;
/** Entradas que solo tocan el bloque del cursor: no hace falta revisar todo el documento. */
const RAPIDOS = /^(insertText|insertCompositionText|insertReplacementText|deleteContentBackward|deleteContentForward|deleteWordBackward|deleteWordForward)$/;
const TECLAS_NAVEGACION = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

type TipoEdicion = 'insertar' | 'borrar' | 'otro' | null;

interface Historial {
    pila: Snap[];
    i: number;
    t0: number;
    timer: number;
    pendiente: boolean;
    tipoPendiente: TipoEdicion;
    /** Selección en el documento justo antes de iniciar la edición pendiente actual. */
    selAntesPendiente: SelGuardada | null;
    /** Última selección conocida en reposo (cuando !pendiente). */
    ultimaSel: SelGuardada | null;
}

/** HTML del documento sin las alturas que calcula la paginación (no son contenido: no deben ensuciar el historial). */
const instantanea = (el: HTMLElement) => el.innerHTML
    .replace(/ style="height: [\d.]+px;"/g, '')
    .replace(/ style="margin-top: [\d.]+px;"/g, '')
    .replace(/--lista-extra:\s*[\d.]+px;\s*/g, '')
    .replace(/ style=""/g, '');

interface SegmentoDom {
    ini: number;
    fin: number;
    nodo: Text;
}

interface HallazgoDom {
    hallazgo: HallazgoObservador;
    rango: Range;
    rects: { left: number; top: number; width: number; height: number }[];
}

interface PopoverObservadorInfo {
    izq: number;
    arriba: number;
    hallazgo?: HallazgoObservador;
    sinonimos?: ResultadoSinonimos | null;
    palabra: string;
    rangoPalabra?: Range;
}

function extraerTextoYMapa(contenedor: HTMLElement): { texto: string; mapa: SegmentoDom[] } {
    let texto = '';
    const mapa: SegmentoDom[] = [];
    const rec = (n: Node) => {
        for (const h of Array.from(n.childNodes)) {
            if (h.nodeType === 3) {
                const t = h as Text;
                const d = t.data;
                if (d.length > 0) {
                    const ini = texto.length;
                    texto += d;
                    mapa.push({ ini, fin: texto.length, nodo: t });
                }
            } else if (h instanceof HTMLElement) {
                if (h.classList.contains('mk')) {
                    texto += '{{campo}}';
                } else if (h.tagName === 'BR') {
                    texto += '\n';
                } else {
                    rec(h);
                }
            }
        }
    };
    rec(contenedor);
    return { texto, mapa };
}

function crearRangoDesdeMapa(mapa: SegmentoDom[], desde: number, hasta: number): Range | null {
    if (mapa.length === 0 || hasta <= desde) return null;
    const segIni = mapa.find((s) => desde >= s.ini && desde <= s.fin);
    const segFin = mapa.find((s) => hasta >= s.ini && hasta <= s.fin);
    if (!segIni || !segFin || !segIni.nodo.isConnected || !segFin.nodo.isConnected) return null;
    try {
        const r = document.createRange();
        r.setStart(segIni.nodo, Math.max(0, Math.min(desde - segIni.ini, segIni.nodo.length)));
        r.setEnd(segFin.nodo, Math.max(0, Math.min(hasta - segFin.ini, segFin.nodo.length)));
        return r;
    } catch {
        return null;
    }
}

function celdaActual(raiz: HTMLElement): HTMLTableCellElement | null {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || !s.anchorNode || !raiz.contains(s.anchorNode)) return null;
    const el = s.anchorNode.nodeType === 1 ? (s.anchorNode as Element) : s.anchorNode.parentElement;
    const td = el?.closest<HTMLTableCellElement>('td, th');
    return td && raiz.contains(td) ? td : null;
}

function extraerPalabraEnCursor(raiz: HTMLElement): { palabra: string; rango: Range } | null {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || !s.anchorNode || !raiz.contains(s.anchorNode)) return null;
    const r0 = s.getRangeAt(0);
    if (!r0.collapsed) {
        const txt = r0.toString().trim();
        if (txt && txt.length <= 45) return { palabra: txt, rango: r0.cloneRange() };
        return null;
    }
    if (s.anchorNode.nodeType !== 3) return null;
    const t = s.anchorNode as Text;
    if (t.parentElement?.closest('.mk')) return null;
    const data = t.data;
    const pos = s.anchorOffset;
    const esLetra = (ch: string) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(ch);
    let ini = pos;
    let fin = pos;
    while (ini > 0 && esLetra(data[ini - 1])) ini--;
    while (fin < data.length && esLetra(data[fin])) fin++;
    if (fin <= ini) return null;
    const r = document.createRange();
    r.setStart(t, ini);
    r.setEnd(t, fin);
    return { palabra: data.slice(ini, fin), rango: r };
}

const ETIQ_CAT_OBS: Record<CategoriaObservador, string> = {
    ortografia: 'Ortografía y acentuación',
    puntuacion: 'Signos de puntuación',
    gramatica: 'Gramática y concordancia',
    estilo: 'Estilo forense',
};

export function HojaEditable({
    ref, textoInicial, config, onCambio, onFormato, onEditarCampo, onMargenes, onConfigurarPagina, onPaginas, onAmbito,
    onMenuCampo, contexto, verCodigos, soloLectura, llenado, zoom = 1,
}: {
    ref?: Ref<ControlHoja>;
    textoInicial: string;
    config: ConfigPagina;
    onCambio: () => void;
    onFormato: (f: FormatoActivo) => void;
    onEditarCampo: (actual: string, aplicar: (nuevo: string) => void, ambito: string[]) => void;
    onMargenes: (lado: keyof Margenes, cm: number) => void;
    onConfigurarPagina: () => void;
    onPaginas: (n: number) => void;
    /** Bloques «{{#…}}» abiertos donde está el cursor. */
    onAmbito?: (ambito: string[]) => void;
    /** Nombres y colores de los campos del modelo (datos propios y partes). */
    contexto?: ContextoMarcadores;
    /** Muestra el código {{…}} de cada campo en vez de su etiqueta corta. */
    verCodigos?: boolean;
    onMenuCampo?: (info: MenuCampoInfo) => void;
    soloLectura?: boolean;
    llenado?: LlenadoHoja;
    /** Factor de zoom del editor (1 = 100%). */
    zoom?: number;
}) {
    const raizRef = useRef<HTMLDivElement>(null);
    const cfgRef = useRef(config);
    const lienzo = useRef<HTMLDivElement>(null);
    const [ancho, setAncho] = useState(0);
    const guardada = useRef<Range | null>(null);
    const hist = useRef<Historial>({
        pila: [], i: -1, t0: 0, timer: 0, pendiente: false,
        tipoPendiente: null, selAntesPendiente: null, ultimaSel: null,
    });
    const oyentesHist = useRef<Set<(e: EstadoHistorial) => void>>(new Set());
    const oyentesObs = useRef<Set<(e: EstadoObservador) => void>>(new Set());
    const ultimoFmt = useRef('');
    const ultimoAmbito = useRef('');
    const pegando = useRef(false);
    const cuadro = useRef(0);
    const timerObs = useRef(0);
    const edicion = useRef<{ chip: HTMLElement; cerrar: (confirmar: boolean, salida: Salida) => void } | null>(null);
    const cb = useRef({ onCambio, onFormato, onEditarCampo, onMargenes, onConfigurarPagina, onPaginas, onAmbito, onMenuCampo });
    const acc = useRef<{ deshacer(): void; rehacer(): void; parrafo(): void; salto(): void; antesDeEntrada(tipo: string, data: string): void } | null>(null);
    const [tip, setTip] = useState<Tip | null>(null);
    const chipTip = useRef<HTMLElement | null>(null);
    const [selector, setSelector] = useState<SelectorVisible | null>(null);

    /* ----- Estado del Observador de Ortografía, Puntuación, Gramática y Sinónimos ----- */
    const [obsActivo, setObsActivo] = useState(true);
    const obsActivoRef = useRef(true);
    const dicPersonalRef = useRef<Set<string>>(cargarDiccionarioPersonal());
    const ignoradosRef = useRef<Set<string>>(new Set());
    const hallazgosDomRef = useRef<HallazgoDom[]>([]);
    const [hallazgosDom, setHallazgosDom] = useState<HallazgoDom[]>([]);
    const metricasRef = useRef<MetricasDocumento>({
        palabras: 0, caracteres: 0, oraciones: 0, parrafos: 0,
        promedioPalabrasPorOracion: 0, oracionesLargas: 0, puntajeCalidad: 100, nivelClaridad: 'Excelente',
    });
    const palabraActualRef = useRef('');
    const rangoPalabraActualRef = useRef<Range | null>(null);
    const [popoverObs, setPopoverObs] = useState<PopoverObservadorInfo | null>(null);
    const [modoResaltado, setModoResaltadoState] = useState<ColorResaltado | 'quitar' | null>(null);
    const modoResaltadoRef = useRef<ColorResaltado | 'quitar' | null>(null);
    const setModoResaltado = (m: ColorResaltado | 'quitar' | null) => {
        modoResaltadoRef.current = m;
        setModoResaltadoState(m);
        programarEstado();
    };

    function estadoObservador(): EstadoObservador {
        return {
            activo: obsActivoRef.current,
            hallazgos: hallazgosDomRef.current.map((h) => h.hallazgo),
            metricas: metricasRef.current,
            palabraSeleccionada: palabraActualRef.current,
        };
    }

    function notificarObservador() {
        if (oyentesObs.current.size === 0) return;
        const est = estadoObservador();
        for (const fn of oyentesObs.current) fn(est);
    }

    function suscribirObservador(fn: (e: EstadoObservador) => void): () => void {
        oyentesObs.current.add(fn);
        return () => {
            oyentesObs.current.delete(fn);
        };
    }

    function recalcularObservador() {
        const el = raizRef.current;
        const flujo = pg.refFlujo.current;
        if (!el || !flujo) return;
        if (!obsActivoRef.current) {
            hallazgosDomRef.current = [];
            setHallazgosDom([]);
            notificarObservador();
            return;
        }
        const rectFlujo = flujo.getBoundingClientRect();
        const contenedores: HTMLElement[] = [];
        for (const b of todosBloques(el)) {
            if (esSalto(b)) continue;
            if (esTabla(b)) {
                for (const celda of Array.from(b.querySelectorAll<HTMLElement>('td, th'))) contenedores.push(celda);
            } else {
                contenedores.push(b);
            }
        }
        const nuevosHallazgos: HallazgoDom[] = [];
        const textosParrafos: string[] = [];

        contenedores.forEach((cont, idx) => {
            const { texto, mapa } = extraerTextoYMapa(cont);
            textosParrafos.push(texto);
            if (!texto.trim()) return;
            const lista = analizarParrafoObservador(texto, idx, dicPersonalRef.current);
            for (const h of lista) {
                if (ignoradosRef.current.has(h.id) || ignoradosRef.current.has(`${h.reglaId}:${h.fragmento.toLowerCase()}`)) {
                    continue;
                }
                const r = crearRangoDesdeMapa(mapa, h.desde, h.hasta);
                if (!r) continue;
                const clientRects = Array.from(r.getClientRects());
                const rects = clientRects
                    .filter((cr) => cr.width > 1 && cr.height > 1)
                    .map((cr) => ({
                        left: cr.left - rectFlujo.left,
                        top: cr.top - rectFlujo.top,
                        width: cr.width,
                        height: cr.height,
                    }));
                if (rects.length > 0) {
                    nuevosHallazgos.push({ hallazgo: h, rango: r, rects });
                }
            }
        });

        hallazgosDomRef.current = nuevosHallazgos;
        metricasRef.current = calcularMetricasDocumento(
            textosParrafos,
            nuevosHallazgos.map((x) => x.hallazgo),
        );
        setHallazgosDom(nuevosHallazgos);
        notificarObservador();
    }

    function programarObservador(delayMs = 160) {
        window.clearTimeout(timerObs.current);
        timerObs.current = window.setTimeout(recalcularObservador, delayMs);
    }

    function ocultarTip() {
        chipTip.current = null;
        setTip(null);
    }

    function alPasar(e: MouseEvent<HTMLDivElement>) {
        const chip = e.target instanceof Element ? e.target.closest<HTMLElement>('.mk') : null;
        if (!chip) {
            if (chipTip.current) ocultarTip();
            return;
        }
        if (chip.classList.contains('mk-editando')) {
            if (chipTip.current) ocultarTip();
            return;
        }
        if (chipTip.current === chip) return;
        chipTip.current = chip;
        const m = chip.dataset.mk ?? '';
        const i = describirMarcador(m, CONTEXTO);
        const el = raizRef.current;
        const amb = el ? ambitoDeChip(el, chip) : [];
        const ll = LLENADO;
        const llenando = !!ll && !ll.soloVista;
        const llena = !!ll && !ll.soloVista && ll.valor(m, amb) !== undefined;
        const asignable = !llenando && datoAsignable(m, CONTEXTO.partes ?? [], amb) !== null;
        const r = chip.getBoundingClientRect();
        const debajo = r.top < 120;
        setTip({
            izq: Math.max(8, Math.min(r.left, window.innerWidth - 350)),
            arriba: debajo ? r.bottom + 8 : null,
            abajo: debajo ? null : window.innerHeight - r.top + 8,
            titulo: i.titulo, detalle: i.detalle, ejemplo: i.ejemplo ?? '',
            ayuda: llenando
                ? (llena ? 'Clic para llenar este dato' : '')
                : asignable ? 'Doble clic para editar o asignar a una parte' : 'Doble clic para editar',
        });
    }

    /* ----- geometría y paginación ----- */
    const pag = PAGINA_CM[config.tamano] ?? PAGINA_CM.carta;
    const mg = margenesSeguros(config.margenes, config.tamano);
    const escalaBase = ancho > 0 ? Math.min(1, Math.max(0.5, (ancho - MARGEN_LIENZO) / (pag.w * PX_POR_CM))) : 0.75;
    const escala = Math.max(0.3, Math.min(2.4, escalaBase * zoom));
    const pg = usePaginacion(raizRef, config, PX_POR_CM * escala);
    const razon = useRazonLinea(config.fuente);

    useEffect(() => {
        cb.current.onPaginas(pg.paginas);
    }, [pg.paginas]);

    // Interlineado, espaciado, zoom o métricas de fuente cambian la altura del texto: hay que volver a paginar.
    useEffect(() => {
        pg.remedir();
        programarObservador(80);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [razon, config.interlineado, config.espacioAntes, config.espacioDespues, config.fuente, config.tamanoPt, ancho, zoom]);

    /* ----- historial propio (deshacer / rehacer) ----- */
    function estadoHistorial(): EstadoHistorial {
        const h = hist.current;
        return {
            puedeDeshacer: h.i > 0 || h.pendiente,
            puedeRehacer: !h.pendiente && h.i >= 0 && h.i < h.pila.length - 1,
        };
    }

    function notificarHistorial() {
        if (oyentesHist.current.size === 0) return;
        const est = estadoHistorial();
        for (const fn of oyentesHist.current) fn(est);
    }

    function suscribirHistorial(fn: (e: EstadoHistorial) => void): () => void {
        oyentesHist.current.add(fn);
        return () => {
            oyentesHist.current.delete(fn);
        };
    }

    function registrar() {
        if (CHIP_EDITANDO) return; // mientras se edita un dato el DOM está a medias: no se toma instantánea
        const el = raizRef.current;
        if (!el) return;
        const h = hist.current;
        window.clearTimeout(h.timer);
        const estabaPendiente = h.pendiente;
        const selAntes = estabaPendiente ? (h.selAntesPendiente ?? h.ultimaSel) : h.ultimaSel;
        h.pendiente = false;
        h.tipoPendiente = null;

        const actual = h.pila[h.i];
        const html = instantanea(el);
        const selDespues = tomarSel(el) ?? actual?.selDespues ?? null;
        if (selDespues) {
            h.ultimaSel = selDespues;
            h.selAntesPendiente = selDespues;
        }
        if (actual && actual.html === html) {
            if (selDespues) actual.selDespues = selDespues;
            notificarHistorial();
            return;
        }
        h.pila = h.pila.slice(0, h.i + 1);
        h.pila.push({
            html,
            selAntes: selAntes ?? actual?.selDespues ?? selDespues,
            selDespues,
        });
        // Tope por cantidad y por tamaño total: con documentos largos cada instantánea pesa cientos de KB.
        while (
            h.pila.length > MAX_HISTORIAL
            || (h.pila.length > 10 && h.pila.reduce((a, x) => a + x.html.length, 0) > MAX_HISTORIAL_CHARS)
        ) {
            h.pila.shift();
        }
        h.i = h.pila.length - 1;
        notificarHistorial();
    }

    function programarSnapshot() {
        const h = hist.current;
        const ahora = Date.now();
        if (!h.pendiente) {
            h.pendiente = true;
            h.t0 = ahora;
            if (!h.selAntesPendiente) h.selAntesPendiente = h.ultimaSel ?? (raizRef.current ? tomarSel(raizRef.current) : null);
        }
        // Cualquier edición nueva descarta de inmediato los estados futuros de «rehacer».
        if (h.i < h.pila.length - 1) {
            h.pila = h.pila.slice(0, h.i + 1);
        }
        window.clearTimeout(h.timer);
        h.timer = window.setTimeout(registrar, Math.max(0, Math.min(PAUSA_HISTORIAL_MS, MAX_AGRUPAR_MS - (ahora - h.t0))));
        notificarHistorial();
    }

    /** Se ejecuta en `beforeinput` antes de que el navegador altere el DOM: separa palabras, inserciones vs borrados y selecciones. */
    function antesDeEntrada(tipo: string, data: string) {
        const el = raizRef.current;
        if (!el) return;
        const h = hist.current;
        const selActual = tomarSel(el);
        const haySeleccion = !!selActual && (selActual.ba !== selActual.bf || selActual.ca !== selActual.cf);
        const cat: TipoEdicion = tipo.startsWith('insert')
            ? 'insertar'
            : tipo.startsWith('delete')
                ? 'borrar'
                : 'otro';

        // Al empezar una nueva palabra tras un espacio o tabulación, se cierra el paso anterior como en Word.
        let nuevaPalabra = false;
        if (cat === 'insertar' && h.pendiente && h.tipoPendiente === 'insertar' && data && !/^\s+$/.test(data)) {
            const s = window.getSelection();
            if (s && s.isCollapsed && s.anchorNode?.nodeType === 3 && s.anchorOffset > 0) {
                const previo = (s.anchorNode as Text).data[s.anchorOffset - 1];
                if (previo === ' ' || previo === '\t' || previo === '\u00A0') {
                    nuevaPalabra = true;
                }
            }
        }

        if (h.pendiente && (haySeleccion || cat !== h.tipoPendiente || cat === 'otro' || nuevaPalabra)) {
            registrar();
        }
        if (!h.pendiente) {
            h.selAntesPendiente = selActual ?? h.ultimaSel;
            h.tipoPendiente = cat;
        }
    }

    /* ----- estado hacia el padre (cinta y panel) ----- */
    function emitirFormato() {
        const el = raizRef.current;
        const s = window.getSelection();
        if (!el || !s || !s.anchorNode || !el.contains(s.anchorNode)) return;
        const b = bloqueRaiz(el, s.anchorNode);
        if (!b || esSalto(b)) return;
        const celda = celdaActual(el);
        const estilo = esTabla(b) ? 'normal' : estiloDe(b);
        const q = (c: string) => {
            try {
                return document.queryCommandState(c);
            } catch {
                return false;
            }
        };
        const explicito = formatoEn(s.anchorNode, celda ?? b);
        const rango = s.getRangeAt(0);
        const letra = letraEn(nodoInicial(rango), el);
        // Con campos {{…}} seleccionados el navegador no conoce su formato: se calcula aparte.
        const conCampos = !s.isCollapsed && objetivosFormato(rango).campos.length > 0;
        const activo = (c: ComandoFmt, nativo: string) => (conCampos ? formatoUniforme(el, rango, c) : q(nativo));
        const lh = Number(b.dataset.lh);
        const padre = b.parentNode;
        const listaActiva: TipoLista | null = esTipoLista(b.dataset.lista) ? b.dataset.lista : null;
        const f: FormatoActivo = {
            negrita: estilo === 'normal' ? activo('negrita', 'bold') : explicito.b,
            cursiva: activo('cursiva', 'italic'),
            subrayado: activo('subrayado', 'underline'),
            alineacion: leerAlineacion(celda ?? b) ?? BASE[estilo],
            estilo,
            fuente: letra.fam,
            tamanoPt: letra.pt,
            interlineado: lh > 0 ? lh : null,
            columnas: esSeccion(padre) ? 2 : 1,
            resaltado: letra.hl,
            modoResaltado: modoResaltadoRef.current,
            lista: listaActiva,
            enTabla: Boolean(celda),
        };
        const pal = extraerPalabraEnCursor(el);
        const nuevaPal = pal?.palabra ?? '';
        if (nuevaPal !== palabraActualRef.current) {
            palabraActualRef.current = nuevaPal;
            rangoPalabraActualRef.current = pal?.rango ?? null;
            notificarObservador();
        } else if (pal?.rango) {
            rangoPalabraActualRef.current = pal.rango;
        }
        const clave = JSON.stringify(f);
        if (clave === ultimoFmt.current) return;
        ultimoFmt.current = clave;
        cb.current.onFormato(f);
    }

    function emitirAmbito() {
        const el = raizRef.current;
        const s = window.getSelection();
        if (!el || !s || !s.anchorNode || !el.contains(s.anchorNode)) return;
        const a = ambitoEn(el, s.anchorNode, s.anchorOffset);
        const clave = a.join('>');
        if (clave === ultimoAmbito.current) return;
        ultimoAmbito.current = clave;
        cb.current.onAmbito?.(a);
    }

    function emitirEstado() {
        emitirFormato();
        emitirAmbito();
    }

    /** Agrupa varias notificaciones en un solo cuadro de animación. */
    function programarEstado() {
        cancelAnimationFrame(cuadro.current);
        cuadro.current = requestAnimationFrame(emitirEstado);
    }

    function tras(inmediato: boolean, completo = true) {
        const el = raizRef.current;
        if (!el) return;
        normalizar(el, completo ? null : bloqueActual(el));
        if (LLENADO) repintar(el);
        pg.remedir();
        if (inmediato) registrar();
        else programarSnapshot();
        cb.current.onCambio();
        programarEstado();
        programarObservador(inmediato ? 60 : 180);
    }

    function restaurar(s: Snap, selObjetivo: SelGuardada | null) {
        const el = raizRef.current;
        if (!el) return;
        edicion.current?.cerrar(false, 'blur');
        setPopoverObs(null);
        const h = hist.current;
        window.clearTimeout(h.timer);
        h.pendiente = false;
        h.tipoPendiente = null;
        el.innerHTML = s.html;
        repintar(el);
        numerarListas(el);
        s.html = instantanea(el);
        el.focus({ preventScroll: true });
        ponerSel(el, selObjetivo ?? s.selDespues);
        const selActual = tomarSel(el);
        h.ultimaSel = selActual;
        h.selAntesPendiente = selActual;
        guardada.current = null;
        ultimoFmt.current = '';
        ultimoAmbito.current = '';
        pg.remedir();
        mostrarCursor(el);
        cb.current.onCambio();
        programarEstado();
        notificarHistorial();
        programarObservador(60);
    }

    function deshacer() {
        const h = hist.current;
        const el = raizRef.current;
        if (el && (h.pendiente || (h.i === h.pila.length - 1 && instantanea(el) !== h.pila[h.i]?.html))) {
            registrar();
        }
        if (h.i <= 0) return;
        const pasoDeshecho = h.pila[h.i];
        h.i -= 1;
        restaurar(h.pila[h.i], pasoDeshecho?.selAntes ?? h.pila[h.i].selDespues);
    }

    function rehacer() {
        const h = hist.current;
        if (h.pendiente) registrar();
        if (h.i >= h.pila.length - 1) return;
        h.i += 1;
        const pasoRehecho = h.pila[h.i];
        restaurar(pasoRehecho, pasoRehecho.selDespues);
    }

    /* ----- foco y cursor ----- */
    function foco() {
        const el = raizRef.current;
        if (!el) return;
        if (document.activeElement !== el) {
            el.focus({ preventScroll: true });
            const g = guardada.current;
            if (g && el.contains(g.commonAncestorContainer)) ponerRango(g.cloneRange());
        }
    }

    function rangoActual(): Range {
        const el = raizRef.current as HTMLElement;
        const s = window.getSelection();
        let r: Range | null = null;
        if (s && s.rangeCount > 0 && s.anchorNode && el.contains(s.anchorNode)) r = s.getRangeAt(0).cloneRange();
        else if (guardada.current && el.contains(guardada.current.commonAncestorContainer)) r = guardada.current.cloneRange();
        if (!r) {
            const u = el.lastElementChild;
            r = u instanceof HTMLElement ? alFinal(u) : inicioDe(el);
        }
        const cont = [r.startContainer, r.endContainer].find((n) => n === el || esSeccion(n));
        if (cont instanceof HTMLElement) {
            const hijos = cont.children;
            const b = hijos[Math.min(cont === r.startContainer ? r.startOffset : r.endOffset, hijos.length - 1)];
            const destino = esSeccion(b) ? b.firstElementChild : b;
            r = destino instanceof HTMLElement ? inicioDe(destino) : inicioDe(el);
        }
        const base = r.startContainer.nodeType === 1 ? (r.startContainer as Element) : r.startContainer.parentElement;
        const chip = base?.closest('.mk');
        if (chip) {
            r.setStartAfter(chip);
            r.collapse(true);
        }
        const bloque = bloqueRaiz(el, r.startContainer);
        if (bloque && esSalto(bloque)) {
            const sig = bloque.nextElementSibling;
            if (sig instanceof HTMLElement) r = inicioDe(sig);
            else {
                const p = parrafoVacio();
                bloque.after(p);
                r = inicioDe(p);
            }
        }
        return r;
    }

    /** Borra la selección como Word: el borrado nativo une bien los bloques de los extremos, respetando tablas. */
    function borrarSeleccion() {
        const el = raizRef.current;
        const s = window.getSelection();
        if (!el || !s || s.rangeCount === 0 || s.isCollapsed) return;
        const r = s.getRangeAt(0);
        const elAncla = s.anchorNode?.nodeType === 1 ? (s.anchorNode as Element) : s.anchorNode?.parentElement;
        const elFoco = s.focusNode?.nodeType === 1 ? (s.focusNode as Element) : s.focusNode?.parentElement;
        const tdAncla = elAncla?.closest<HTMLTableCellElement>('td, th');
        const tdFoco = elFoco?.closest<HTMLTableCellElement>('td, th');
        // Si la selección cruza distintas celdas de tabla (o entra/sale de una tabla), vaciamos las celdas tocadas sin destruir <tr>/<td>
        if ((tdAncla || tdFoco) && tdAncla !== tdFoco) {
            const celdas = Array.from(el.querySelectorAll<HTMLTableCellElement>('td, th')).filter((c) => r.intersectsNode(c));
            for (const c of celdas) {
                c.replaceChildren(document.createElement('br'));
            }
            const destino = tdAncla ?? celdas[0];
            if (destino) ponerRango(inicioDe(destino));
            return;
        }
        pegando.current = true; // su evento input se ignora: tras() corre al final de la operación
        try {
            document.execCommand('delete');
        } finally {
            pegando.current = false;
        }
    }

    /* ----- Enter, Shift+Enter, Tab ----- */
    function nuevoParrafo() {
        const el = raizRef.current;
        if (!el) return;
        const celda = celdaActual(el);
        if (celda) {
            // Dentro de una celda de tabla, Enter inserta salto de línea limpio dentro de la celda
            saltoSuave();
            return;
        }
        registrar();
        borrarSeleccion();
        const r = rangoActual();
        r.collapse(true);
        const bloque = bloqueRaiz(el, r.startContainer);
        if (!bloque || esSalto(bloque) || esTabla(bloque)) return;

        // Si el párrafo actual es un elemento de lista vacío y se presiona Enter, salir de la lista (como en Word)
        if (bloque.dataset.lista && esVacio(bloque)) {
            delete bloque.dataset.lista;
            delete bloque.dataset.num;
            numerarListas(el);
            tras(true, false);
            return;
        }

        const trasBr = brAntesDe(r);
        const corte = document.createRange();
        corte.setStart(r.startContainer, r.startOffset);
        corte.setEnd(bloque, bloque.childNodes.length);
        const resto = corte.extractContents();

        const alFinBloque = restoVacio(resto);
        const tagOriginal = bloque.tagName.toLowerCase();
        const tag = estiloDe(bloque) !== 'normal' && alFinBloque ? 'p' : tagOriginal;
        const nuevo = document.createElement(tag);
        heredarParrafo(bloque, nuevo, tag === tagOriginal);
        nuevo.appendChild(resto);
        bloque.after(nuevo);
        if (bloque.dataset.nc && esVacio(bloque)) {
            // Enter al inicio de un párrafo que abre columna: el salto de columna se va con el texto.
            nuevo.dataset.nc = bloque.dataset.nc;
            delete bloque.dataset.nc;
        }

        // Un salto suave justo antes del cursor queda ahora al final del párrafo original: necesita su relleno.
        if (trasBr) {
            const hojas = hojasDe(bloque);
            rellenarSaltoFinal(bloque, hojas[hojas.length - 1]);
        }
        limpiarBloque(bloque);
        limpiarBloque(nuevo);
        numerarListas(el);
        ponerRango(inicioProfundo(nuevo));
        tras(true, false);
        mostrarCursor(el);
    }

    /** Shift+Enter: salto de línea dentro del mismo párrafo o celda. */
    function saltoSuave() {
        const el = raizRef.current;
        if (!el) return;
        registrar();
        borrarSeleccion();
        const r = rangoActual();
        r.collapse(true);
        const celda = celdaActual(el);
        const bloque = celda ?? bloqueRaiz(el, r.startContainer);
        if (!bloque || esSalto(bloque)) return;
        const br = document.createElement('br');
        r.insertNode(br);
        rellenarSaltoFinal(bloque, br); // al final del párrafo hace falta un <br> de relleno detrás
        ponerRango(trasNodo(br));
        tras(true, false);
        mostrarCursor(el);
    }

    /** Tab: en tabla navega entre celdas (o agrega fila al final); en párrafo inserta tabulación. */
    function tabulador(inverso = false) {
        const el = raizRef.current;
        if (!el) return;
        const celda = celdaActual(el);
        if (celda) {
            const tbl = celda.closest<HTMLTableElement>('table');
            if (!tbl) return;
            const celdas = Array.from(tbl.querySelectorAll<HTMLTableCellElement>('td, th'));
            const idx = celdas.indexOf(celda);
            if (idx < 0) return;
            if (!inverso && idx === celdas.length - 1) {
                // Estamos en la última celda: agregar una nueva fila automáticamente como en Word
                accionTabla('filaAbajo');
                return;
            }
            const destino = celdas[inverso ? Math.max(0, idx - 1) : Math.min(celdas.length - 1, idx + 1)];
            if (destino) {
                ponerRango(alFinal(destino));
                mostrarCursor(el);
                programarEstado();
            }
            return;
        }
        if (inverso) return;
        registrar();
        document.execCommand('insertText', false, '\t');
    }

    /* ----- operaciones públicas ----- */
    function leerTexto(): string {
        const el = raizRef.current;
        return el ? bloquesATexto(domABloques(el)) : textoInicial;
    }

    function insertar(texto: string, bloque: boolean) {
        const el = raizRef.current;
        if (!el) return;
        foco();
        registrar(); // deja en el historial lo escrito antes de esta acción
        borrarSeleccion();
        const r = rangoActual();
        const lineas = texto.split('\n');
        if (!bloque && lineas.length === 1) {
            const frag = document.createDocumentFragment();
            for (const t of tramosDe(lineas[0])) frag.appendChild(tramoADom(t));
            const ult = frag.lastChild;
            if (!ult) return;
            r.insertNode(frag);
            const sig = ult.nextSibling;
            if (!sig || sig.nodeName === 'BR') {
                const zw = document.createTextNode('\u200B');
                ult.parentNode?.insertBefore(zw, sig);
                r.setStart(zw, 1);
            } else {
                r.setStartAfter(ult);
            }
            r.collapse(true);
            ponerRango(r);
        } else {
            const nuevos = bloquesADom(texto);
            colocarBloques(el, r, nuevos);
            normalizar(el); // antes de colocar el cursor: así un salto al final ya tiene párrafo siguiente
            colocarCursor(nuevos);
        }
        tras(true);
        mostrarCursor(el);
    }

    function comando(c: ComandoFmt) {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const s = window.getSelection();
        const b = s?.anchorNode ? bloqueRaiz(el, s.anchorNode) : null;
        if (c === 'negrita' && b && !esTabla(b) && estiloDe(b) !== 'normal') return; // títulos y subtítulos van siempre en negrita
        registrar();

        // Los campos {{…}} no son editables: el navegador no les aplica formato, se hace aparte.
        const r0 = s && s.rangeCount > 0 && !s.isCollapsed && el.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
        const camposSel = r0 ? objetivosFormato(r0).campos : [];
        const activarAntes = !!r0 && !formatoUniforme(el, r0, c);

        document.execCommand(c === 'negrita' ? 'bold' : c === 'cursiva' ? 'italic' : 'underline');

        if (camposSel.length > 0) {
            const s2 = window.getSelection();
            const textos = s2 && s2.rangeCount > 0 && el.contains(s2.anchorNode) ? objetivosFormato(s2.getRangeAt(0)).textos : [];
            const k = CLAVE_FMT[c];
            // Con texto en la selección, los campos siguen lo que hizo el navegador con el texto.
            const activar = textos.length > 0 ? textos.every((n) => formatoEn(n, el)[k]) : activarAntes;
            const g = guardarNodos();
            const vivos = camposSel.filter((x) => x.isConnected);
            for (const chip of vivos) formatearCampo(el, chip, c, activar);
            if (textos.length === 0 && vivos.length > 0) {
                const r = document.createRange();
                r.setStartBefore(vivos[0]);
                r.setEndAfter(vivos[vivos.length - 1]);
                ponerRango(r);
            } else restaurarNodos(g);
        }
        tras(true);
    }

    function alinear(a: Alineacion) {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const celda = celdaActual(el);
        if (celda) {
            registrar();
            celda.style.textAlign = A_CSS[a];
            tras(true);
            return;
        }
        const bloques = bloquesSeleccionados(el).filter((b) => !esTabla(b));
        if (bloques.length === 0) return;
        registrar();
        for (const b of bloques) {
            if (a === BASE[estiloDe(b)]) b.style.removeProperty('text-align');
            else b.style.textAlign = A_CSS[a];
            if (!b.getAttribute('style')) b.removeAttribute('style');
        }
        tras(true);
    }

    function saltoPagina() {
        insertar('===', true);
    }

    /** Fuente o tamaño: solo lo seleccionado; sin selección, lo que escribas desde el cursor (como en Word). */
    function formatoLetra(c: { fam?: string; pt?: number }) {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const s = window.getSelection();
        if (!s || s.rangeCount === 0 || !s.anchorNode || !el.contains(s.anchorNode)) return;
        registrar();
        const r = s.getRangeAt(0);
        if (r.collapsed) {
            const r2 = rangoActual();
            r2.collapse(true);
            const sp = spanLetra(c.fam, c.pt);
            const zw = document.createTextNode('\u200B');
            sp.appendChild(zw);
            r2.insertNode(sp);
            const nr = document.createRange();
            nr.setStart(zw, 1);
            nr.collapse(true);
            ponerRango(nr);
        } else {
            aplicarLetra(r, c);
        }
        tras(true);
    }

    const ponerFuente = (nombre: string) => formatoLetra({ fam: nombre });
    const ponerTamano = (pt: number) => {
        if (pt > 0) formatoLetra({ pt });
    };

    /** Resaltado de texto: si hay selección, la resalta; si no, activa/alterna el cursor de resaltado (como en Word). */
    function resaltar(color: ColorResaltado | null) {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const s = window.getSelection();
        if (!s || s.rangeCount === 0 || !s.anchorNode || !el.contains(s.anchorNode) || s.isCollapsed) {
            const objetivo: ColorResaltado | 'quitar' = color ?? 'quitar';
            setModoResaltado(modoResaltadoRef.current === objetivo ? null : objetivo);
            return;
        }
        const r = s.getRangeAt(0);
        registrar();
        const actual = letraEn(nodoInicial(r), el).hl;
        if (color === null || actual === color) {
            quitarResaltadoRango(el, r);
        } else {
            quitarResaltadoRango(el, r);
            const s2 = window.getSelection();
            if (s2 && s2.rangeCount > 0) aplicarLetra(s2.getRangeAt(0), { hl: color });
        }
        tras(true);
    }

    /** Al soltar el ratón con el modo resaltador activo, resalta la selección recién hecha. */
    function alSoltarMouse() {
        const modo = modoResaltadoRef.current;
        const el = raizRef.current;
        if (!modo || !el || soloLectura) return;
        const s = window.getSelection();
        if (!s || s.rangeCount === 0 || s.isCollapsed || !s.anchorNode || !el.contains(s.anchorNode)) return;
        const r = s.getRangeAt(0);
        if (!r.toString().trim()) return;
        registrar();
        quitarResaltadoRango(el, r);
        if (modo !== 'quitar') {
            const s2 = window.getSelection();
            if (s2 && s2.rangeCount > 0) aplicarLetra(s2.getRangeAt(0), { hl: modo });
        }
        const sFin = window.getSelection();
        if (sFin && sFin.rangeCount > 0) {
            const rFin = sFin.getRangeAt(0).cloneRange();
            rFin.collapse(false);
            ponerRango(rFin);
            guardada.current = rFin.cloneRange();
        }
        tras(true);
    }

    /** Alterna o quita lista con viñetas o numeración en los párrafos seleccionados. */
    function ponerLista(tipo: TipoLista | null) {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const bloques = bloquesSeleccionados(el).filter((b) => !esTabla(b) && !esSalto(b));
        if (bloques.length === 0) return;
        registrar();
        const g = guardarNodos();
        const quitar = tipo === null || bloques.every((b) => b.dataset.lista === tipo);
        const resultantes: HTMLElement[] = [];
        for (const b of bloques) {
            if (quitar) {
                delete b.dataset.lista;
                delete b.dataset.num;
                resultantes.push(b);
            } else {
                const p = b.tagName !== 'P' ? renombrar(b, 'p') : b;
                p.dataset.lista = tipo;
                resultantes.push(p);
            }
        }
        numerarListas(el);
        // Si el cursor estaba en un bloque vacío (o colapsado tras renombrar), aseguramos posición limpia al inicio del contenido
        const s = window.getSelection();
        if (resultantes.length === 1 && esVacio(resultantes[0])) {
            const rng = inicioProfundo(resultantes[0]);
            ponerRango(rng);
            guardada.current = rng.cloneRange();
        } else {
            restaurarNodos(g);
            if (s && s.rangeCount > 0 && el.contains(s.anchorNode)) {
                guardada.current = s.getRangeAt(0).cloneRange();
            }
        }
        tras(true);
        mostrarCursor(el);
    }

    /** Inserta una tabla nueva en la posición del cursor. */
    function insertarTabla(filas: number, columnas: number) {
        const el = raizRef.current;
        if (!el) return;
        const nFilas = Math.max(1, Math.min(20, Math.round(filas)));
        const nCols = Math.max(1, Math.min(10, Math.round(columnas)));
        foco();
        registrar();
        borrarSeleccion();
        const r = rangoActual();
        const bTabla: BloqueTabla = {
            tipo: 'tabla',
            encabezado: true,
            filas: Array.from({ length: nFilas }, (_, rIdx) =>
                Array.from({ length: nCols }, () => ({
                    tramos: [],
                    ...(rIdx === 0 ? { alineacion: 'center' as Alineacion } : {}),
                })),
            ),
        };
        const domTabla = tablaADom(bTabla);
        const b = bloqueRaiz(el, r.startContainer);
        if (b && esSeccion(b.parentElement)) {
            extraerDeSeccion(b);
        }
        colocarBloques(el, r, [domTabla]);
        normalizar(el);
        const primeraCelda = domTabla.querySelector<HTMLElement>('th, td');
        if (primeraCelda) {
            const rng = inicioDe(primeraCelda);
            ponerRango(rng);
            guardada.current = rng.cloneRange();
        }
        tras(true);
        mostrarCursor(el);
    }

    /** Ejecuta una acción de edición estructural sobre la tabla actual (filas/columnas/encabezado/eliminar). */
    function accionTabla(accion: AccionTabla) {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const celda = celdaActual(el);
        const tbl = celda?.closest<HTMLTableElement>('table');
        if (!celda || !tbl) return;
        const tr = celda.closest('tr');
        const tbody = tbl.querySelector('tbody') ?? tbl;
        if (!tr) return;

        const filasTr = Array.from(tbl.querySelectorAll('tr')).filter((row) => row.closest('table') === tbl);
        const filaIdx = filasTr.indexOf(tr);
        const celdasFila = Array.from(tr.children).filter((c): c is HTMLTableCellElement => c.tagName === 'TD' || c.tagName === 'TH');
        const colIdx = celdasFila.indexOf(celda);
        const numCols = Math.max(1, celdasFila.length);

        registrar();

        if (accion === 'eliminarTabla') {
            const p = parrafoVacio();
            tbl.replaceWith(p);
            ponerRango(inicioDe(p));
            tras(true);
            return;
        }

        if (accion === 'alternarEncabezado') {
            const tenia = tbl.dataset.encabezado === '1';
            if (tenia) delete tbl.dataset.encabezado;
            else tbl.dataset.encabezado = '1';
            const primera = filasTr[0];
            if (primera) {
                for (const c of Array.from(primera.children)) {
                    if (c instanceof HTMLElement) renombrar(c, tenia ? 'td' : 'th');
                }
            }
            tras(true);
            return;
        }

        if (accion === 'filaArriba' || accion === 'filaAbajo') {
            const insertarEnEncabezado = accion === 'filaArriba' && filaIdx === 0 && tbl.dataset.encabezado === '1';
            if (insertarEnEncabezado) {
                // Convertir la antigua primera fila en td y la nueva en th
                for (const c of Array.from(tr.children)) {
                    if (c instanceof HTMLElement) renombrar(c, 'td');
                }
            }
            const nuevaTr = document.createElement('tr');
            const tagCelda = insertarEnEncabezado ? 'th' : 'td';
            for (let k = 0; k < numCols; k++) {
                const td = document.createElement(tagCelda);
                td.appendChild(document.createElement('br'));
                nuevaTr.appendChild(td);
            }
            if (accion === 'filaArriba') tr.before(nuevaTr);
            else tr.after(nuevaTr);
            const primera = nuevaTr.querySelector<HTMLElement>('td, th');
            if (primera) ponerRango(inicioDe(primera));
            tras(true);
            return;
        }

        if (accion === 'eliminarFila') {
            if (filasTr.length <= 1) {
                const p = parrafoVacio();
                tbl.replaceWith(p);
                ponerRango(inicioDe(p));
                tras(true);
                return;
            }
            const sigTr = filasTr[filaIdx + 1] ?? filasTr[filaIdx - 1];
            tr.remove();
            if (filaIdx === 0 && tbl.dataset.encabezado === '1' && sigTr) {
                for (const c of Array.from(sigTr.children)) {
                    if (c instanceof HTMLElement) renombrar(c, 'th');
                }
            }
            const celdaDestino = sigTr?.children[Math.min(colIdx, sigTr.children.length - 1)] as HTMLElement | undefined;
            if (celdaDestino) ponerRango(inicioDe(celdaDestino));
            tras(true);
            return;
        }

        if (accion === 'colIzquierda' || accion === 'colDerecha') {
            filasTr.forEach((row, rIdx) => {
                const esTh = rIdx === 0 && tbl.dataset.encabezado === '1';
                const nuevaCelda = document.createElement(esTh ? 'th' : 'td');
                nuevaCelda.appendChild(document.createElement('br'));
                const refCelda = row.children[colIdx];
                if (refCelda) {
                    if (accion === 'colIzquierda') refCelda.before(nuevaCelda);
                    else refCelda.after(nuevaCelda);
                } else {
                    row.appendChild(nuevaCelda);
                }
            });
            const nuevaEnFila = tr.children[accion === 'colIzquierda' ? colIdx : colIdx + 1] as HTMLElement | undefined;
            if (nuevaEnFila) ponerRango(inicioDe(nuevaEnFila));
            tras(true);
            return;
        }

        if (accion === 'eliminarColumna') {
            if (numCols <= 1) {
                const p = parrafoVacio();
                tbl.replaceWith(p);
                ponerRango(inicioDe(p));
                tras(true);
                return;
            }
            filasTr.forEach((row) => {
                const c = row.children[colIdx];
                if (c) c.remove();
            });
            const destino = tr.children[Math.max(0, Math.min(colIdx, tr.children.length - 1))] as HTMLElement | undefined;
            if (destino) ponerRango(inicioDe(destino));
            else if (tbody) ponerRango(inicioDe(tbody));
            tras(true);
        }
    }

    /** Interlineado de los párrafos seleccionados (o del párrafo del cursor). */
    function ponerInterlineado(v: number) {
        const el = raizRef.current;
        if (!el || !(v > 0)) return;
        foco();
        const bloques = bloquesSeleccionados(el);
        if (bloques.length === 0) return;
        registrar();
        const base = cfgRef.current.interlineado;
        for (const b of bloques) {
            if (Math.abs(v - base) < 0.005) {
                delete b.dataset.lh;
                b.style.removeProperty('line-height');
            } else {
                b.dataset.lh = String(v);
                b.style.lineHeight = lineaCss(v);
            }
            if (!b.getAttribute('style')) b.removeAttribute('style');
        }
        tras(true);
    }

    /**
     * Como en Word: lo seleccionado pasa a 1 o 2 columnas y el resto del documento no cambia.
     * Sin selección y pidiendo 1 columna, se deshace toda la región donde está el cursor.
     */
    function ponerColumnas(n: number) {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const s = window.getSelection();
        let objetivo = bloquesSeleccionados(el).filter((b) => !esTabla(b));
        if (objetivo.length === 0) return;
        if (n < 2 && s?.isCollapsed) {
            const sec = objetivo[0].parentElement;
            if (esSeccion(sec)) {
                objetivo = Array.from(sec.children).filter((h): h is HTMLElement => h instanceof HTMLElement && !esSalto(h));
            }
        }
        registrar();
        const g = guardarNodos();
        for (const b of objetivo) {
            if (n >= 2) {
                if (!esSeccion(b.parentElement)) {
                    const sec = nuevaSeccion(2);
                    b.replaceWith(sec);
                    sec.appendChild(b);
                }
            } else {
                delete b.dataset.nc;
                extraerDeSeccion(b);
            }
        }
        repararSecciones(el); // une las regiones que quedaron pegadas
        restaurarNodos(g);
        tras(true);
    }

    /** Ctrl+Mayús+Enter: lo que sigue al cursor pasa a la columna siguiente. Solo dentro de columnas. */
    function saltoColumna() {
        const el = raizRef.current;
        if (!el) return;
        foco();
        let b = bloqueActual(el);
        if (!b || !esSeccion(b.parentElement)) return;
        const r = rangoActual();
        const pre = document.createRange();
        pre.selectNodeContents(b);
        pre.setEnd(r.startContainer, r.startOffset);
        const alInicio = pre.toString().replace(/\u200B/g, '') === '' && !pre.cloneContents().querySelector('.mk');
        registrar();
        if (alInicio) {
            // Al inicio del párrafo: se activa o se quita el salto de ese párrafo.
            if (b.dataset.nc) delete b.dataset.nc;
            else b.dataset.nc = '1';
            tras(true);
            return;
        }
        nuevoParrafo();
        b = bloqueActual(el);
        if (b) b.dataset.nc = '1';
        tras(true);
    }

    /* ----- Acciones del Observador y Sinónimos ----- */
    function alternarObservador(forzar?: boolean) {
        const nuevo = forzar !== undefined ? forzar : !obsActivoRef.current;
        obsActivoRef.current = nuevo;
        setObsActivo(nuevo);
        setPopoverObs(null);
        recalcularObservador();
    }

    function reemplazarRangoTexto(rango: Range, reemplazo: string) {
        const el = raizRef.current;
        if (!el || !rango.startContainer.isConnected) return;
        foco();
        registrar();
        rango.deleteContents();
        if (reemplazo) {
            const nodoTxt = document.createTextNode(reemplazo);
            rango.insertNode(nodoTxt);
            ponerRango(trasNodo(nodoTxt));
        } else {
            ponerRango(rango);
        }
        setPopoverObs(null);
        tras(true, false);
        recalcularObservador();
    }

    function aplicarHallazgo(id: string, reemplazo: string) {
        const item = hallazgosDomRef.current.find((x) => x.hallazgo.id === id);
        if (!item) return;
        reemplazarRangoTexto(item.rango, reemplazo);
    }

    function irAHallazgo(id: string) {
        const el = raizRef.current;
        const item = hallazgosDomRef.current.find((x) => x.hallazgo.id === id);
        if (!el || !item || !item.rango.startContainer.isConnected) return;
        foco();
        ponerRango(item.rango.cloneRange());
        mostrarCursor(el);
        const rect = item.rango.getBoundingClientRect();
        const pal = item.hallazgo.fragmento.trim();
        setPopoverObs({
            izq: Math.max(12, Math.min(rect.left, window.innerWidth - 360)),
            arriba: rect.bottom + 8 + 260 < window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - 240),
            hallazgo: item.hallazgo,
            sinonimos: buscarSinonimos(pal),
            palabra: pal,
            rangoPalabra: item.rango.cloneRange(),
        });
    }

    function ignorarHallazgo(id: string) {
        const item = hallazgosDomRef.current.find((x) => x.hallazgo.id === id);
        if (item) {
            ignoradosRef.current.add(id);
            ignoradosRef.current.add(`${item.hallazgo.reglaId}:${item.hallazgo.fragmento.toLowerCase()}`);
        } else {
            ignoradosRef.current.add(id);
        }
        setPopoverObs(null);
        recalcularObservador();
    }

    function agregarPalabraDiccionario(palabra: string) {
        dicPersonalRef.current = agregarAlDiccionarioPersonal(palabra);
        setPopoverObs(null);
        recalcularObservador();
    }

    function reemplazarPalabraActual(reemplazo: string) {
        const r = popoverObs?.rangoPalabra ?? rangoPalabraActualRef.current;
        if (!r || !r.startContainer.isConnected) return;
        reemplazarRangoTexto(r, reemplazo);
    }

    function abrirSinonimos() {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const extraida = extraerPalabraEnCursor(el);
        if (!extraida) return;
        const rect = extraida.rango.getBoundingClientRect();
        // Ver si además hay un hallazgo activo que toque este rango
        const itemHallazgo = hallazgosDomRef.current.find((x) => {
            try {
                return x.rango.intersectsNode(extraida.rango.startContainer)
                    && x.rango.compareBoundaryPoints(Range.END_TO_START, extraida.rango) <= 0
                    && x.rango.compareBoundaryPoints(Range.START_TO_END, extraida.rango) >= 0;
            } catch {
                return false;
            }
        });
        setPopoverObs({
            izq: Math.max(12, Math.min(rect.left, window.innerWidth - 360)),
            arriba: rect.bottom + 8 + 260 < window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - 240),
            hallazgo: itemHallazgo?.hallazgo,
            sinonimos: buscarSinonimos(extraida.palabra),
            palabra: extraida.palabra,
            rangoPalabra: extraida.rango,
        });
    }

    /** Ctrl+E: selecciona todo el documento (igual que el Ctrl+A nativo: la selección queda dentro de los bloques). */
    function seleccionarTodo() {
        foco();
        document.execCommand('selectAll');
    }

    function ejecutarAtajo(a: Atajo) {
        switch (a) {
            case 'negrita':
            case 'cursiva':
            case 'subrayado': comando(a); break;
            case 'izquierda': alinear('left'); break;
            case 'centro': alinear('center'); break;
            case 'derecha': alinear('right'); break;
            case 'justificado': alinear('both'); break;
            case 'todo': seleccionarTodo(); break;
            case 'deshacer': deshacer(); break;
            case 'rehacer': rehacer(); break;
            case 'sinonimos': abrirSinonimos(); break;
        }
    }

    useImperativeHandle(
        ref,
        () => ({
            leerTexto, insertar, comando, alinear, saltoPagina, deshacer, rehacer,
            estadoHistorial, suscribirHistorial, enfocar: foco,
            fuente: ponerFuente, tamano: ponerTamano, interlineado: ponerInterlineado, columnas: ponerColumnas, saltoColumna,
            resaltar, lista: ponerLista, insertarTabla, accionTabla,
            abrirSinonimos, estadoObservador, suscribirObservador, alternarObservador,
            aplicarHallazgo, irAHallazgo, ignorarHallazgo, agregarPalabraDiccionario, reemplazarPalabraActual,
            contarPendientes: () => raizRef.current?.querySelectorAll('.mk[data-k="pendiente"]').length ?? 0,
            reasignar: (fn) => {
                const el = raizRef.current;
                return el ? reemplazarVarios(Array.from(el.querySelectorAll<HTMLElement>('.mk')), fn) : 0;
            },
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    /* ----- ciclo de vida ----- */
    useEffect(() => {
        cfgRef.current = config;
        cb.current = { onCambio, onFormato, onEditarCampo, onMargenes, onConfigurarPagina, onPaginas, onAmbito, onMenuCampo };
        acc.current = { deshacer, rehacer, parrafo: nuevoParrafo, salto: saltoSuave, antesDeEntrada };
    });

    useEffect(() => {
        CONTEXTO = contexto ?? SIN_CONTEXTO;
        LLENADO = llenado;
        const el = raizRef.current;
        if (el) {
            repintar(el);
            pg.remedir();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contexto, llenado]);

    useEffect(() => () => {
        edicion.current?.cerrar(true, 'blur'); // si se cierra la ventana con un dato a medias, no se pierde
        CONTEXTO = SIN_CONTEXTO;
        LLENADO = undefined;
        CHIP_EDITANDO = null;
    }, []);

    useEffect(() => {
        pg.remedir();
        programarObservador(80);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verCodigos]);

    useEffect(() => {
        const f = () => {
            if (chipTip.current) {
                chipTip.current = null;
                setTip(null);
            }
            setPopoverObs(null);
        };
        window.addEventListener('scroll', f, true);
        return () => window.removeEventListener('scroll', f, true);
    }, []);

    useEffect(() => {
        const el = raizRef.current;
        if (!el) return;
        el.replaceChildren(...bloquesADom(textoInicial));
        normalizar(el);
        repintar(el);
        registrar();
        pg.remedir();
        programarObservador(100);
        try {
            document.execCommand('defaultParagraphSeparator', false, 'p');
        } catch {
            /* sin efecto */
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const f = () => {
            const el = raizRef.current;
            const s = window.getSelection();
            if (!el || !s || s.rangeCount === 0 || !s.anchorNode || !el.contains(s.anchorNode)) return;
            guardada.current = s.getRangeAt(0).cloneRange();
            if (!hist.current.pendiente) {
                const selActual = tomarSel(el);
                if (selActual) hist.current.ultimaSel = selActual;
            }
            programarEstado();
        };
        document.addEventListener('selectionchange', f);
        return () => document.removeEventListener('selectionchange', f);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* Entradas que el navegador resuelve por su cuenta (menú contextual, teclados virtuales…). */
    useEffect(() => {
        const el = raizRef.current;
        if (!el) return;
        const f = (e: Event) => {
            const ev = e as InputEvent;
            const tipo = ev.inputType ?? '';
            const a = acc.current;
            if (!a) return;
            if (tipo === 'historyUndo') { e.preventDefault(); a.deshacer(); return; }
            if (tipo === 'historyRedo') { e.preventDefault(); a.rehacer(); return; }
            if (tipo === 'insertParagraph') { e.preventDefault(); a.parrafo(); return; }
            if (tipo === 'insertLineBreak') { e.preventDefault(); a.salto(); return; }
            if (pegando.current || CHIP_EDITANDO) return;
            a.antesDeEntrada(tipo, ev.data ?? '');
        };
        el.addEventListener('beforeinput', f);
        return () => el.removeEventListener('beforeinput', f);
    }, []);

    useEffect(() => () => {
        window.clearTimeout(hist.current.timer);
        window.clearTimeout(timerObs.current);
        cancelAnimationFrame(cuadro.current);
    }, []);

    useEffect(() => {
        const el = lienzo.current;
        if (!el) return;
        const medir = () => setAncho(el.clientWidth);
        medir();
        const o = new ResizeObserver(medir);
        o.observe(el);
        return () => o.disconnect();
    }, []);

    /* ----- eventos ----- */
    function alEscribir(e: FormEvent<HTMLDivElement>) {
        if (pegando.current) return;
        setPopoverObs(null);
        const el = raizRef.current;
        const ev = e.nativeEvent as InputEvent;
        const tipo = ev.inputType ?? '';
        // Auto-lista al escribir "- ", "* ", "1. ", "1) ", "a. ", "A. ", "I. " al inicio de un párrafo normal
        if (el && tipo === 'insertText' && ev.data === ' ') {
            const b = bloqueActual(el);
            const s = window.getSelection();
            if (b && b.tagName === 'P' && !b.dataset.lista && s && s.isCollapsed && s.anchorNode && b.contains(s.anchorNode)) {
                const rPre = document.createRange();
                rPre.setStart(b, 0);
                rPre.setEnd(s.anchorNode, s.anchorOffset);
                const preTxt = rPre.toString().replace(/\u200B/g, '');
                let autoTipo: TipoLista | null = null;
                if (/^[-•*]\s$/.test(preTxt)) autoTipo = 'ul';
                else if (/^1\.1\.?\s$/.test(preTxt)) autoTipo = 'ol-sub';
                else if (/^1\.\s$/.test(preTxt)) autoTipo = 'ol';
                else if (/^1\)\s$/.test(preTxt)) autoTipo = 'ol-paren';
                else if (/^a\.\s$/.test(preTxt)) autoTipo = 'ol-letra-min';
                else if (/^A\.\s$/.test(preTxt)) autoTipo = 'ol-letra';
                else if (/^I\.\s$/.test(preTxt)) autoTipo = 'ol-romano';
                else if (/^i\.\s$/.test(preTxt)) autoTipo = 'ol-romano-min';
                if (autoTipo) {
                    rPre.deleteContents();
                    b.dataset.lista = autoTipo;
                    limpiarBloque(b);
                    numerarListas(el);
                    const rng = inicioProfundo(b);
                    ponerRango(rng);
                    guardada.current = rng.cloneRange();
                    tras(true, false);
                    mostrarCursor(el);
                    return;
                }
            }
        }
        tras(false, !RAPIDOS.test(tipo));
    }

    function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
        // No interferir con tildes por tecla muerta (´ + a) ni con IME.
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (chipTip.current) ocultarTip();
        if (e.key === 'Escape') {
            if (popoverObs) {
                setPopoverObs(null);
                return;
            }
            if (modoResaltadoRef.current) {
                e.preventDefault();
                setModoResaltado(null);
                return;
            }
        }

        if (TECLAS_NAVEGACION.has(e.key) && hist.current.pendiente) {
            registrar();
        }

        // Protección de estructura de celdas en tablas y listas con Backspace / Delete
        if ((e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const el = raizRef.current;
            const s = window.getSelection();
            if (el && s && s.rangeCount > 0 && s.anchorNode) {
                const celda = celdaActual(el);
                if (celda) {
                    if (!s.isCollapsed) {
                        const elFoco = s.focusNode?.nodeType === 1 ? (s.focusNode as Element) : s.focusNode?.parentElement;
                        const celdaFoco = elFoco?.closest<HTMLTableCellElement>('td, th');
                        if (celdaFoco !== celda) {
                            e.preventDefault();
                            registrar();
                            borrarSeleccion();
                            tras(true, false);
                            return;
                        }
                    } else if (e.key === 'Backspace') {
                        if (offsetEnBloque(celda, s.anchorNode, s.anchorOffset) === 0) {
                            e.preventDefault();
                            return;
                        }
                    } else if (e.key === 'Delete') {
                        const fin = alFinal(celda);
                        const maxOff = offsetEnBloque(celda, fin.startContainer, fin.startOffset);
                        if (offsetEnBloque(celda, s.anchorNode, s.anchorOffset) >= maxOff) {
                            e.preventDefault();
                            return;
                        }
                    }
                } else if (e.key === 'Backspace' && s.isCollapsed) {
                    const b = bloqueActual(el);
                    if (b && b.dataset.lista && offsetEnBloque(b, s.anchorNode, s.anchorOffset) === 0) {
                        e.preventDefault();
                        registrar();
                        delete b.dataset.lista;
                        delete b.dataset.num;
                        numerarListas(el);
                        tras(true, false);
                        return;
                    }
                    // Evitar que Backspace al inicio de un párrafo justo después de una tabla destruya la última celda de la tabla
                    if (b && offsetEnBloque(b, s.anchorNode, s.anchorOffset) === 0 && esTabla(b.previousElementSibling)) {
                        e.preventDefault();
                        const tblPrev = b.previousElementSibling as HTMLElement;
                        const celdasPrev = tblPrev.querySelectorAll<HTMLElement>('td, th');
                        const ultCelda = celdasPrev[celdasPrev.length - 1];
                        if (ultCelda) {
                            if (esVacio(b) && el.children.length > 2) {
                                registrar();
                                b.remove();
                                normalizar(el);
                            }
                            ponerRango(alFinal(ultCelda));
                            mostrarCursor(el);
                            programarEstado();
                        }
                        return;
                    }
                } else if (e.key === 'Delete' && s.isCollapsed) {
                    const b = bloqueActual(el);
                    if (b && esTabla(b.nextElementSibling)) {
                        const fin = alFinal(b);
                        const maxOff = offsetEnBloque(b, fin.startContainer, fin.startOffset);
                        if (offsetEnBloque(b, s.anchorNode, s.anchorOffset) >= maxOff) {
                            e.preventDefault();
                            return;
                        }
                    }
                }
            }
        }

        if (e.key === 'Enter') {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (e.shiftKey) saltoColumna();   // Ctrl+Mayús+Enter: salto de columna
                else saltoPagina();               // Ctrl+Enter: salto de página
            }
            else if (e.shiftKey) { e.preventDefault(); saltoSuave(); }              // Shift+Enter: salto de línea
            else if (!e.altKey) { e.preventDefault(); nuevoParrafo(); }             // Enter: párrafo nuevo
            return;
        }
        if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            tabulador(e.shiftKey);
            return;
        }

        // Ctrl+Alt = AltGr en teclados latinoamericanos ({ } @ …): no es un atajo.
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const atajo = atajoDe(e.key, e.shiftKey);
        if (!atajo) return; // Ctrl+C/X/V/A, Ctrl+G (guardar)… suben o siguen su curso
        e.preventDefault();
        e.stopPropagation(); // aquí Ctrl+K es cursiva, no el buscador global
        ejecutarAtajo(atajo);
    }

    function alPegar(e: ClipboardEvent<HTMLDivElement>) {
        e.preventDefault();
        const el = raizRef.current;
        if (!el) return;

        const html = e.clipboardData.getData('text/html');
        if (html) {
            let bloques: Bloque[] = [];
            try {
                bloques = htmlABloques(html);
            } catch {
                bloques = [];
            }
            if (bloques.length > 0) {
                foco();
                registrar();
                borrarSeleccion();
                pegarBloques(el, rangoActual(), bloques);
                tras(true);
                mostrarCursor(el);
                return;
            }
        }

        const lineas = lineasDePegado(e.clipboardData.getData('text/plain'));
        if (lineas.every((l) => l === '')) return;
        foco();
        registrar();
        borrarSeleccion();
        pegarTexto(el, rangoActual(), lineas);
        tras(true);
        mostrarCursor(el);
    }

    /** Reemplaza un campo del texto (o lo quita si `nuevo` está vacío). */
    function reemplazarChip(chip: HTMLElement, nuevo: string) {
        if (!raizRef.current?.contains(chip)) return;
        registrar();
        const limpio = nuevo.trim();
        if (!limpio) chip.remove();
        else pintarChip(chip, /^\{\{[\s\S]*\}\}$/.test(limpio) ? limpio : `{{${limpio}}}`);
        tras(true);
    }

    function reemplazarVarios(chips: HTMLElement[], fn: (marcador: string, ambito: string[]) => string | null): number {
        const el = raizRef.current;
        if (!el) return 0;
        const cambios: [HTMLElement, string][] = [];
        for (const chip of chips) {
            if (!el.contains(chip)) continue;
            const nuevo = fn(chip.dataset.mk ?? '', ambitoDeChip(el, chip));
            if (nuevo) cambios.push([chip, nuevo]);
        }
        if (cambios.length === 0) return 0;
        registrar();
        for (const [chip, nuevo] of cambios) pintarChip(chip, nuevo);
        tras(true);
        return cambios.length;
    }

    function editarChip(chip: HTMLElement) {
        const el = raizRef.current;
        cb.current.onEditarCampo(
            chip.dataset.mk ?? '',
            (nuevo) => reemplazarChip(chip, nuevo),
            el ? ambitoDeChip(el, chip) : [],
        );
    }

    /**
     * Edición directa: el propio texto del campo se vuelve editable (contenteditable), como en Word.
     * Enter confirma · Esc cancela · Tab / Mayús+Tab saltan al siguiente / anterior dato · al perder el foco se guarda.
     */
    function iniciarEdicion(chip: HTMLElement, origen?: { x: number; y: number }): boolean {
        const el = raizRef.current;
        const ll = LLENADO;
        if (!el || !ll?.guardar || ll.soloVista || !chip.isConnected) return false;
        if (CHIP_EDITANDO === chip) return true;
        const etiqueta = chip.querySelector<HTMLElement>(':scope > .mk-e');
        if (!etiqueta) return false;

        const marcador = chip.dataset.mk ?? '';
        const ambito = ambitoDeChip(el, chip);
        const mostrado = ll.valor(marcador, ambito);
        if (mostrado === undefined) return false;

        edicion.current?.cerrar(true, 'blur');

        const info = describirMarcador(marcador, CONTEXTO);
        const edit: EdicionDirecta = ll.crudo?.(marcador, ambito) ?? { texto: mostrado };
        const multilinea = !!edit.multilinea;
        const original = normalizarEntrada(edit.texto, multilinea);
        const visible = etiqueta.textContent ?? '';

        // El texto del campo pasa a ser editable.
        CHIP_EDITANDO = chip;
        chip.classList.add('mk-editando');
        etiqueta.textContent = edit.texto;
        etiqueta.dataset.ph = edit.pista ?? info.corto;
        etiqueta.spellcheck = multilinea;
        etiqueta.setAttribute('role', 'textbox');
        etiqueta.setAttribute('aria-label', info.titulo);
        if (edit.transformar) etiqueta.style.textTransform = TRANSFORMAR_CSS[edit.transformar];
        try {
            etiqueta.contentEditable = 'plaintext-only'; // sin formato ni pegado enriquecido
        } catch {
            etiqueta.contentEditable = 'true';
        }

        const sel = ll.selector?.(marcador, ambito);
        const ubicar = () => {
            const r = chip.getBoundingClientRect();
            const abajo = r.bottom + 54 < window.innerHeight;
            return {
                izq: Math.max(8, Math.min(r.left, window.innerWidth - 340)),
                arriba: abajo ? r.bottom + 6 : Math.max(8, r.top - 46),
            };
        };
        const reubicar = () => setSelector((p) => (p ? { ...p, ...ubicar() } : p));
        const elegir = (v: string) => {
            sel?.cambiar(v);
            setSelector((p) => (p ? { ...p, valor: v } : p));
        };
        let cerrado = false;
        let raf = 0;
        const ac = new AbortController();
        const op = { signal: ac.signal };

        const cerrar = (confirmar: boolean, salida: Salida) => {
            if (cerrado) return;
            cerrado = true;
            ac.abort();
            cancelAnimationFrame(raf);
            setSelector(null);
            if (edicion.current?.chip === chip) edicion.current = null;
            if (CHIP_EDITANDO === chip) CHIP_EDITANDO = null;

            const nuevo = normalizarEntrada(textoEditado(etiqueta), multilinea);
            const cambio = confirmar && nuevo !== original;

            for (const a of ['contenteditable', 'data-ph', 'role', 'aria-label', 'spellcheck']) etiqueta.removeAttribute(a);
            etiqueta.style.removeProperty('text-transform');
            chip.classList.remove('mk-editando');
            // Pintado provisional hasta que React vuelva a renderizar con el dato nuevo.
            etiqueta.textContent = cambio ? (nuevo ? aplicarTransformacion(nuevo, edit.transformar) : info.corto) : visible;
            chip.dataset.v = ''; // fuerza el repintado real en el siguiente ciclo

            if (cambio) LLENADO?.guardar?.(marcador, ambito, nuevo);
            pg.remedir();

            const tras = document.createRange();
            tras.setStartAfter(chip);
            tras.collapse(true);
            guardada.current = tras;

            if (salida === 'enter' || salida === 'esc') {
                el.focus({ preventScroll: true });
                ponerRango(cursorTras(chip));
            } else if (salida === 'sig' || salida === 'ant') {
                const todos = Array.from(el.querySelectorAll<HTMLElement>('.mk'));
                const paso = salida === 'sig' ? 1 : -1;
                let destino: HTMLElement | null = null;
                for (let k = todos.indexOf(chip) + paso; k >= 0 && k < todos.length; k += paso) {
                    const c = todos[k];
                    if (LLENADO?.valor(c.dataset.mk ?? '', ambitoDeChip(el, c)) !== undefined) {
                        destino = c;
                        break;
                    }
                }
                if (destino) {
                    const d = destino;
                    window.setTimeout(() => iniciarEdicion(d), 0); // espera a que React aplique el dato anterior
                } else {
                    el.focus({ preventScroll: true });
                    ponerRango(cursorTras(chip));
                }
            }
        };

        etiqueta.addEventListener('blur', () => cerrar(true, 'blur'), op);

        etiqueta.addEventListener('keydown', (ev) => {
            ev.stopPropagation(); // el editor del documento no debe ver estas teclas
            if (ev.isComposing || ev.keyCode === 229) return;
            const ctrl = ev.ctrlKey || ev.metaKey;
            const k = ev.key.toLowerCase();
            if (sel && ev.altKey && !ctrl) {
                const o = sel.opciones.find((x) => x.tecla === k);
                if (o) {
                    ev.preventDefault();
                    elegir(o.valor);
                    return;
                }
            }
            if (ev.key === 'Escape') {
                ev.preventDefault();
                cerrar(false, 'esc');
            } else if (ev.key === 'Enter') {
                ev.preventDefault();
                if (multilinea && !ctrl) {
                    if (!document.execCommand('insertLineBreak')) document.execCommand('insertText', false, '\n');
                } else cerrar(true, 'enter');
            } else if (ev.key === 'Tab' && !ctrl && !ev.altKey) {
                ev.preventDefault();
                cerrar(true, ev.shiftKey ? 'ant' : 'sig');
            } else if (ctrl && !ev.altKey && !ev.shiftKey && (k === 'g' || k === 's')) {
                // Guardar datos: se confirma el campo y se relanza el atajo cuando React ya aplicó el valor.
                ev.preventDefault();
                cerrar(true, 'enter');
                window.setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true })), 0);
            }
        }, op);

        etiqueta.addEventListener('input', (ev) => {
            ev.stopPropagation();
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                pg.remedir(); // el texto crece: se vuelven a calcular las páginas
                if (sel) reubicar();
            });
        }, op);

        etiqueta.addEventListener('paste', (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            let t = ev.clipboardData?.getData('text/plain') ?? '';
            t = multilinea ? t.replace(/\r\n?/g, '\n') : t.replace(/\s*[\r\n]+\s*/g, ' ');
            if (t) document.execCommand('insertText', false, t);
        }, op);

        edicion.current = { chip, cerrar };
        if (sel) {
            setSelector({ ...sel, ...ubicar(), elegir });
            window.addEventListener('scroll', reubicar, { signal: ac.signal, capture: true });
        }

        // Cursor: donde se hizo clic (si el texto no cambió) o todo seleccionado para reemplazar de una vez.
        etiqueta.focus({ preventScroll: true });
        const mismoTexto = edit.texto.toLowerCase() === visible.toLowerCase();
        const punto = origen && mismoTexto ? caretEn(origen.x, origen.y) : null;
        if (punto && etiqueta.contains(punto.startContainer)) ponerRango(punto);
        else {
            const r = document.createRange();
            r.selectNodeContents(etiqueta);
            ponerRango(r);
        }
        mostrarCursor(el);
        return true;
    }

    /** Llenar: mousedown sobre un dato → su texto pasa a ser editable en el mismo lugar. */
    function alMouseDown(e: MouseEvent<HTMLDivElement>) {
        if (hist.current.pendiente) registrar();
        const ll = LLENADO;
        const el = raizRef.current;
        const chip = e.target instanceof Element ? e.target.closest<HTMLElement>('.mk') : null;
        if (!ll?.guardar || ll.soloVista || !el || !chip) return;
        if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
        if (chip === CHIP_EDITANDO) return; // ya se edita: el navegador coloca el cursor donde se hizo clic
        if (ll.valor(chip.dataset.mk ?? '', ambitoDeChip(el, chip)) === undefined) return; // no se llena aquí
        e.preventDefault();
        ocultarTip();
        const origen = { x: e.clientX, y: e.clientY };
        if (edicion.current) {
            // Se confirma el campo anterior y se espera a que React aplique su valor antes de abrir el nuevo.
            edicion.current.cerrar(true, 'blur');
            window.setTimeout(() => iniciarEdicion(chip, origen), 0);
        } else {
            iniciarEdicion(chip, origen);
        }
    }

    /** Al hacer clic sobre una palabra subrayada por el observador (o Alt+Clic en cualquier palabra), abre el popover inteligente. */
    function alClickHoja(e: MouseEvent<HTMLDivElement>) {
        if (soloLectura || CHIP_EDITANDO) return;
        const chip = e.target instanceof Element ? e.target.closest<HTMLElement>('.mk') : null;
        if (chip) {
            setPopoverObs(null);
            return;
        }
        const flujo = pg.refFlujo.current;
        if (!flujo) return;
        const rectFlujo = flujo.getBoundingClientRect();
        const xRel = e.clientX - rectFlujo.left;
        const yRel = e.clientY - rectFlujo.top;

        // Buscar si el clic cayó sobre el subrayado de algún hallazgo activo
        const tocado = hallazgosDomRef.current.find((item) =>
            item.rects.some(
                (r) => xRel >= r.left - 4 && xRel <= r.left + r.width + 4 && yRel >= r.top - 4 && yRel <= r.top + r.height + 6,
            ),
        );
        if (tocado) {
            const r = tocado.rango.getBoundingClientRect();
            const pal = tocado.hallazgo.fragmento.trim();
            setPopoverObs({
                izq: Math.max(12, Math.min(r.left, window.innerWidth - 360)),
                arriba: r.bottom + 8 + 260 < window.innerHeight ? r.bottom + 8 : Math.max(12, r.top - 240),
                hallazgo: tocado.hallazgo,
                sinonimos: buscarSinonimos(pal),
                palabra: pal,
                rangoPalabra: tocado.rango.cloneRange(),
            });
            return;
        }

        if (e.altKey) {
            abrirSinonimos();
            return;
        }
        if (popoverObs) setPopoverObs(null);
    }

    /** Doble clic en un campo del texto: pide al padre que lo edite (no aplica al llenar). */
    function alDobleClic(e: MouseEvent<HTMLDivElement>) {
        if (LLENADO && !LLENADO.soloVista) return;
        const chip = e.target instanceof Element ? e.target.closest<HTMLElement>('.mk') : null;
        if (!chip) return;
        e.preventDefault();
        ocultarTip();
        editarChip(chip);
    }

    /** Clic derecho en un campo: menú para asignarlo a una parte, editarlo o quitarlo. */
    function alMenuContextual(e: MouseEvent<HTMLDivElement>) {
        const abrir = cb.current.onMenuCampo;
        const el = raizRef.current;
        const chip = e.target instanceof Element ? e.target.closest<HTMLElement>('.mk') : null;
        if (!abrir || !el || !chip) return;
        e.preventDefault();
        ocultarTip();
        const sel = chipsSeleccionados(el);
        const grupo = sel.length > 1 && sel.includes(chip) ? sel : [];
        abrir({
            marcador: chip.dataset.mk ?? '',
            x: e.clientX,
            y: e.clientY,
            ambito: ambitoDeChip(el, chip),
            seleccion: grupo.map((c) => c.dataset.mk ?? ''),
            reemplazar: (nuevo) => reemplazarChip(chip, nuevo),
            reemplazarSeleccion: (fn) => reemplazarVarios(grupo, fn),
            editar: () => editarChip(chip),
        });
    }
    /* ----- render ----- */
    const cm = (n: number) => `${(n * escala).toFixed(3)}cm`;
    const pt = (n: number) => `${(n * escala).toFixed(2)}pt`;

    const estiloHoja = {
        ...pg.estiloRaiz,
        fontFamily: pilaCss(config.fuente),
        fontSize: pt(config.tamanoPt),
        lineHeight: lineaCss(config.interlineado),
        tabSize: cm(TAB_CM),
        '--esc': escala,
        '--rl': razon,
        '--antes': pt(config.espacioAntes),
        '--despues': pt(config.espacioDespues),
        '--pt-titulo': pt(config.tamanoPt + 2),
        '--sangria': cm(1.25),
    } as CSSProperties;

    const cambiarMargen = (lado: keyof Margenes, v: number) => cb.current.onMargenes(lado, v);
    const abrirPagina = () => cb.current.onConfigurarPagina();

    return (
        <div className="ed-lienzo" ref={lienzo}>
            <div className="ed-regla-barra">
                <div style={{ width: pg.geo.ancho, margin: '0 auto' }}>
                    <Regla
                        orientacion="h" largoCm={pag.w} escala={escala}
                        ini={mg.izquierdo} fin={mg.derecho} ladoIni="izquierdo" ladoFin="derecho"
                        onCambio={cambiarMargen} onAbrir={abrirPagina}
                    />
                </div>
            </div>

            <div className="ed-caja pg-caja" style={pg.estiloCaja}>
                <div className="ed-regla-v">
                    <Regla
                        orientacion="v" largoCm={pag.h} escala={escala}
                        ini={mg.superior} fin={mg.inferior} ladoIni="superior" ladoFin="inferior"
                        onCambio={cambiarMargen} onAbrir={abrirPagina}
                    />
                </div>

                {pg.fondos}

                <div className="pg-flujo" ref={pg.refFlujo}>
                    <div className="pg-excl" ref={pg.refExcl} aria-hidden="true" />
                    {obsActivo && hallazgosDom.length > 0 && (
                        <div className="ed-capa-observador" aria-hidden="true">
                            {hallazgosDom.map((item) =>
                                item.rects.map((r, rIdx) => (
                                    <span
                                        key={`${item.hallazgo.id}-${rIdx}`}
                                        className={`ed-subrayado-obs ed-obs-${item.hallazgo.categoria}`}
                                        style={{
                                            left: `${r.left}px`,
                                            top: `${r.top + r.height - 3}px`,
                                            width: `${Math.max(6, r.width)}px`,
                                        }}
                                    />
                                )),
                            )}
                        </div>
                    )}
                    <div
                        ref={raizRef}
                        className={`hoja-ed${config.sangria ? ' con-sangria' : ''}${verCodigos ? ' ver-codigos' : ''}${modoResaltado ? ' modo-resaltado' : ''}`}
                        data-hl-cursor={modoResaltado ?? undefined}
                        style={estiloHoja}
                        contentEditable={!soloLectura}
                        suppressContentEditableWarning
                        spellCheck={!obsActivo}
                        lang="es"
                        role="textbox"
                        aria-multiline="true"
                        aria-label="Texto del documento"
                        onInput={alEscribir}
                        onKeyDown={alTeclear}
                        onPaste={alPegar}
                        onMouseDown={alMouseDown}
                        onMouseUp={alSoltarMouse}
                        onClick={alClickHoja}
                        onDoubleClick={alDobleClic}
                        onContextMenu={alMenuContextual}
                        onMouseOver={alPasar}
                        onMouseLeave={ocultarTip}
                    />
                </div>
            </div>
            {popoverObs && (
                <div
                    className="ed-pop-observador"
                    role="dialog"
                    aria-label="Sugerencias de redacción y sinónimos"
                    style={{ left: popoverObs.izq, top: popoverObs.arriba }}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <div className="ed-pop-obs-cab">
                        {popoverObs.hallazgo ? (
                            <span className={`ed-pop-obs-badge ed-badge-${popoverObs.hallazgo.categoria}`}>
                                {ETIQ_CAT_OBS[popoverObs.hallazgo.categoria]}
                            </span>
                        ) : (
                            <span className="ed-pop-obs-badge ed-badge-sinonimos">
                                Sinónimos y Léxico Forense
                            </span>
                        )}
                        <button
                            type="button"
                            className="ed-pop-obs-cerrar"
                            title="Cerrar (Esc)"
                            onClick={() => setPopoverObs(null)}
                        >
                            ×
                        </button>
                    </div>

                    {popoverObs.hallazgo && (
                        <div className="ed-pop-obs-bloque">
                            <strong className="ed-pop-obs-titulo">{popoverObs.hallazgo.titulo}</strong>
                            <p className="ed-pop-obs-exp">{popoverObs.hallazgo.explicacion}</p>
                            {popoverObs.hallazgo.sugerencias.length > 0 && (
                                <div className="ed-pop-obs-sugs">
                                    {popoverObs.hallazgo.sugerencias.map((sug, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            className="ed-pop-obs-btn-sug"
                                            onClick={() => aplicarHallazgo(popoverObs.hallazgo!.id, sug)}
                                        >
                                            {sug || '(Eliminar)'}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="ed-pop-obs-acciones">
                                <button
                                    type="button"
                                    className="ed-pop-obs-accion"
                                    onClick={() => ignorarHallazgo(popoverObs.hallazgo!.id)}
                                >
                                    Ignorar
                                </button>
                                {popoverObs.hallazgo.categoria === 'ortografia' && !popoverObs.hallazgo.fragmento.includes(' ') && (
                                    <button
                                        type="button"
                                        className="ed-pop-obs-accion"
                                        onClick={() => agregarPalabraDiccionario(popoverObs.hallazgo!.fragmento)}
                                    >
                                        + Añadir al diccionario
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {popoverObs.sinonimos ? (
                        <div className="ed-pop-obs-sinonimos">
                            <div className="ed-pop-obs-sin-enc">
                                <span>Sinónimos para <b>«{popoverObs.sinonimos.terminoOriginal}»</b></span>
                                <small>{popoverObs.sinonimos.definicionBreve}</small>
                            </div>
                            {popoverObs.sinonimos.grupos.map((g, gi) => (
                                <div key={gi} className="ed-pop-obs-grupo-sin">
                                    <span className={`ed-pop-obs-reg ed-reg-${g.registro}`}>{g.etiqueta}</span>
                                    <div className="ed-pop-obs-sugs">
                                        {g.opciones.map((op, oi) => (
                                            <button
                                                key={oi}
                                                type="button"
                                                className={`ed-pop-obs-btn-sin${g.registro === 'antonimo' ? ' es-ant' : ''}`}
                                                title={`Lema: ${op.base}`}
                                                onClick={() => reemplazarPalabraActual(op.reemplazo)}
                                            >
                                                {op.reemplazo}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : !popoverObs.hallazgo ? (
                        <div className="ed-pop-obs-vacio">
                            No se encontraron sinónimos directos para «{popoverObs.palabra}». Usa el panel de Redacción y Tesauro para explorar términos jurídicos afines.
                        </div>
                    ) : null}
                </div>
            )}
            {tip && (
                <div className="mk-tip" role="tooltip"
                    style={{ left: tip.izq, top: tip.arriba ?? undefined, bottom: tip.abajo ?? undefined }}>
                    <b>{tip.titulo}</b>
                    {tip.detalle && <span>{tip.detalle}</span>}
                    {tip.ejemplo && <span className="mk-ej">Ej.: {tip.ejemplo}</span>}
                    {tip.ayuda && <em>{tip.ayuda}</em>}
                </div>
            )}
            {selector && (
                <div
                    className={`mk-selector${selector.valor === '' ? ' falta' : ''}`}
                    role="group"
                    aria-label={selector.titulo}
                    style={{ left: selector.izq, top: selector.arriba }}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <span>{selector.titulo}</span>
                    {selector.opciones.map((o) => (
                        <button
                            key={o.valor}
                            type="button"
                            className={o.valor === selector.valor ? 'on' : ''}
                            aria-pressed={o.valor === selector.valor}
                            title={o.tecla ? `Alt+${o.tecla.toUpperCase()}` : undefined}
                            onClick={() => selector.elegir(o.valor)}
                        >
                            {o.etiqueta}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
export { COLORES_RESALTADO };