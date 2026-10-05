import {
    useEffect, useImperativeHandle, useRef, useState,
    type ClipboardEvent, type CSSProperties, type FormEvent, type KeyboardEvent, type MouseEvent, type Ref,
} from 'react';
import {
    bloquesATexto, PAGINA_CM, margenesSeguros, parsearTexto, tramosDe,
    type Alineacion, type Bloque, type BloqueParrafo, type ConfigPagina, type EstiloParrafo, type Margenes, type Tramo,
} from '../domain/fuenteModelo';
import { Regla } from './Regla';
import { usePaginacion } from './Paginacion';
import './editorWord.css';
import { pilaCss } from '../domain/fuentes';
import { htmlABloques } from './pegadoHtml';

const PX_POR_CM = 37.7953;
const MARGEN_LIENZO = 48;
const TAB_CM = 1.25; // igual que el tabulador por defecto de Word (708 twips)

const BASE: Record<EstiloParrafo, Alineacion> = { normal: 'both', titulo: 'center', subtitulo: 'left' };
const TAG: Record<EstiloParrafo, string> = { normal: 'p', titulo: 'h1', subtitulo: 'h2' };
const DESDE_CSS: Record<string, Alineacion> = { left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', justify: 'both' };
const A_CSS: Record<Alineacion, string> = { left: 'left', center: 'center', right: 'right', both: 'justify' };
const BLOQUES = new Set(['P', 'H1', 'H2']);

type Atajo =
    | 'negrita' | 'cursiva' | 'subrayado' | 'izquierda' | 'centro' | 'derecha' | 'justificado'
    | 'todo' | 'deshacer' | 'rehacer';

const ATAJOS = new Map<string, Atajo>([
    ['n', 'negrita'], ['k', 'cursiva'], ['s', 'subrayado'],
    ['q', 'izquierda'], ['t', 'centro'], ['d', 'derecha'], ['j', 'justificado'],
    ['e', 'todo'], ['z', 'deshacer'], ['y', 'rehacer'],
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
}

export const FORMATO_INICIAL: FormatoActivo = {
    negrita: false, cursiva: false, subrayado: false, alineacion: 'both', estilo: 'normal',
};

export interface ControlHoja {
    leerTexto(): string;
    insertar(texto: string, bloque: boolean): void;
    comando(c: 'negrita' | 'cursiva' | 'subrayado'): void;
    alinear(a: Alineacion): void;
    estilo(e: 'titulo' | 'subtitulo'): void;
    saltoPagina(): void;
    deshacer(): void;
    rehacer(): void;
    enfocar(): void;
}

/* ================= DOM ⇄ bloques ================ */
interface Fmt { b: boolean; i: boolean; u: boolean }
interface Pieza { texto: string; f: Fmt; chip: boolean; br?: boolean }
const SIN_FMT: Fmt = { b: false, i: false, u: false };

const esSalto = (n: Node | null): boolean => n instanceof HTMLElement && n.dataset.salto !== undefined;
const esBr = (n: Node | null | undefined): boolean => !!n && n.nodeName === 'BR';
const estiloDe = (b: Element): EstiloParrafo => (b.tagName === 'H1' ? 'titulo' : b.tagName === 'H2' ? 'subtitulo' : 'normal');

function crearChip(texto: string): HTMLElement {
    const s = document.createElement('span');
    s.className = 'mk';
    s.contentEditable = 'false';
    s.dataset.mk = texto;
    s.textContent = texto;
    s.title = 'Doble clic para editar este campo';
    return s;
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
    const l = parsearTexto(texto).map((b: Bloque) => (b.tipo === 'salto' ? saltoADom() : parrafoADom(b)));
    return l.length > 0 ? l : [parrafoVacio()];
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
    const s = el.style;
    if (s.fontWeight) r.b = s.fontWeight === 'bold' || s.fontWeight === 'bolder' || Number(s.fontWeight) >= 600;
    if (s.fontStyle) r.i = s.fontStyle === 'italic' || s.fontStyle === 'oblique';
    const dec = s.textDecorationLine || s.textDecoration;
    if (dec) r.u = dec.includes('underline');
    return r;
}

function formatoEn(nodo: Node, hasta: HTMLElement): Fmt {
    const cadena: HTMLElement[] = [];
    for (let n: Node | null = nodo; n && n !== hasta; n = n.parentNode) if (n instanceof HTMLElement) cadena.unshift(n);
    return cadena.reduce((f, el) => formatoDe(el, f), SIN_FMT);
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
        if (!marcador && u && !u.marcador && u.negrita === f.b && u.cursiva === f.i && u.subrayado === f.u) u.texto += texto;
        else tramos.push({ texto, negrita: f.b, cursiva: f.i, subrayado: f.u, marcador });
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

function domABloques(raiz: HTMLElement): Bloque[] {
    const salida: Bloque[] = [];
    for (const n of Array.from(raiz.children)) {
        if (!(n instanceof HTMLElement)) continue;
        if (esSalto(n)) {
            salida.push({ tipo: 'salto' });
            continue;
        }
        const estilo = estiloDe(n);
        const piezas: Pieza[] = [];
        recolectar(n, SIN_FMT, piezas);
        // El último <br> del bloque es solo relleno, no un salto de línea.
        if (piezas.length > 0 && piezas[piezas.length - 1].br) piezas.pop();
        salida.push({ tipo: 'parrafo', alineacion: leerAlineacion(n) ?? BASE[estilo], estilo, tramos: aTramos(piezas) });
    }
    return salida;
}

/* ================= Selección ================= */
interface SelGuardada { a: number[]; ao: number; f: number[]; fo: number }
interface Snap { html: string; sel: SelGuardada | null }

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

function tomarSel(raiz: HTMLElement): SelGuardada | null {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || !s.anchorNode || !s.focusNode || !raiz.contains(s.anchorNode) || !raiz.contains(s.focusNode)) return null;
    const a = rutaDe(raiz, s.anchorNode);
    const f = rutaDe(raiz, s.focusNode);
    return a && f ? { a, ao: s.anchorOffset, f, fo: s.focusOffset } : null;
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
    const a = sel ? nodoDe(raiz, sel.a) : null;
    const f = sel ? nodoDe(raiz, sel.f) : null;
    if (sel && a && f) {
        s.setBaseAndExtent(a, Math.min(sel.ao, largo(a)), f, Math.min(sel.fo, largo(f)));
        return;
    }
    const ult = raiz.lastElementChild;
    ponerRango(ult instanceof HTMLElement ? alFinal(ult) : inicioDe(raiz));
}

function bloqueRaiz(raiz: HTMLElement, nodo: Node | null): HTMLElement | null {
    let n: Node | null = nodo;
    while (n && n.parentNode !== raiz) n = n.parentNode;
    return n instanceof HTMLElement ? n : null;
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
    const lista = Array.from(raiz.children).filter((el): el is HTMLElement => {
        if (!(el instanceof HTMLElement) || esSalto(el) || !r.intersectsNode(el)) return false;
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
    if (esSalto(b)) {
        b.after(...nuevos);
        return;
    }
    if (esVacio(b)) {
        b.replaceWith(...nuevos);
        return;
    }
    const pre = document.createRange();
    pre.selectNodeContents(b);
    pre.setEnd(r.startContainer, r.startOffset);
    const post = document.createRange();
    post.selectNodeContents(b);
    post.setStart(r.startContainer, r.startOffset);
    if (pre.toString() === '') {
        b.before(...nuevos);
        return;
    }
    if (post.toString() === '') {
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
    for (let n = destino.lastElementChild; n && /^(B|I|U)$/.test(n.tagName); n = destino.lastElementChild) {
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
    if (b.hasAttribute('style') && b.style.length > (b.style.textAlign ? 1 : 0)) {
        const alin = b.style.textAlign;
        b.removeAttribute('style');
        if (alin) b.style.textAlign = alin;
    }
    for (const e of Array.from(b.querySelectorAll<HTMLElement>('span:not(.mk)'))) {
        if (e.style.length === 0) continue;
        for (const p of ESTILOS_RUIDO) e.style.removeProperty(p);
        if (e.style.length === 0) e.removeAttribute('style');
    }
}

function limpiarBloque(b: HTMLElement): void {
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

function normalizar(el: HTMLElement, solo?: HTMLElement | null): void {
    let sueltos: Node[] = [];
    const cerrar = (antes: Node | null) => {
        if (sueltos.length === 0) return;
        const p = document.createElement('p');
        el.insertBefore(p, antes);
        for (const n of sueltos) p.appendChild(n);
        sueltos = [];
    };
    for (const n of Array.from(el.childNodes)) {
        if (n instanceof HTMLElement && (esSalto(n) || BLOQUES.has(n.tagName))) {
            cerrar(n);
            continue;
        }
        if (n instanceof HTMLElement && n.tagName === 'DIV') {
            cerrar(n);
            renombrar(n, 'p');
            continue;
        }
        if (n.nodeType === 3 && !(n as Text).data.trim() && sueltos.length === 0) {
            n.parentNode?.removeChild(n);
            continue;
        }
        sueltos.push(n);
    }
    cerrar(null);
    if (el.children.length === 0) el.appendChild(parrafoVacio());
    if (esSalto(el.lastElementChild)) el.appendChild(parrafoVacio());

    if (solo && solo.parentNode === el) {
        convertirMarcadores(solo);
        limpiarBloque(solo);
        return;
    }
    convertirMarcadores(el);
    for (const b of Array.from(el.children)) if (b instanceof HTMLElement && !esSalto(b)) limpiarBloque(b);
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
    const unico = bloques.length === 1 && bloques[0].tipo === 'parrafo' ? bloques[0] : null;

    if (unico && bloque && !esSalto(bloque) && !esVacio(bloque)) {
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

    const nuevos = bloques.map((b) => (b.tipo === 'salto' ? saltoADom() : parrafoADom(b)));
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

/* ================= Componente ================= */
const MAX_HISTORIAL = 200;
const MAX_HISTORIAL_CHARS = 24_000_000;
const PAUSA_HISTORIAL_MS = 450;
const MAX_AGRUPAR_MS = 4000;
/** Entradas que solo tocan el bloque del cursor: no hace falta revisar todo el documento. */
const RAPIDOS = /^(insertText|insertCompositionText|insertReplacementText|deleteContentBackward|deleteContentForward|deleteWordBackward|deleteWordForward)$/;

interface Historial { pila: Snap[]; i: number; t0: number; timer: number; pendiente: boolean }

/** HTML del documento sin las alturas que calcula la paginación (no son contenido: no deben ensuciar el historial). */
const instantanea = (el: HTMLElement) => el.innerHTML.replace(/ style="height: [\d.]+px;"/g, '');

export function HojaEditable({
    ref, textoInicial, config, onCambio, onFormato, onEditarCampo, onMargenes, onConfigurarPagina, onPaginas, onAmbito,
}: {
    ref?: Ref<ControlHoja>;
    textoInicial: string;
    config: ConfigPagina;
    onCambio: () => void;
    onFormato: (f: FormatoActivo) => void;
    onEditarCampo: (actual: string, aplicar: (nuevo: string) => void) => void;
    onMargenes: (lado: keyof Margenes, cm: number) => void;
    onConfigurarPagina: () => void;
    onPaginas: (n: number) => void;
    /** Bloques «{{#…}}» abiertos donde está el cursor (para que el panel ofrezca campos sin prefijo). */
    onAmbito?: (ambito: string[]) => void;
}) {
    const raizRef = useRef<HTMLDivElement>(null);
    const lienzo = useRef<HTMLDivElement>(null);
    const [ancho, setAncho] = useState(0);
    const guardada = useRef<Range | null>(null);
    const hist = useRef<Historial>({ pila: [], i: -1, t0: 0, timer: 0, pendiente: false });
    const ultimoFmt = useRef('');
    const ultimoAmbito = useRef('');
    const pegando = useRef(false);
    const cuadro = useRef(0);
    const cb = useRef({ onCambio, onFormato, onEditarCampo, onMargenes, onConfigurarPagina, onPaginas, onAmbito });
    const acc = useRef<{ deshacer(): void; rehacer(): void; parrafo(): void; salto(): void } | null>(null);

    /* ----- geometría y paginación ----- */
    const pag = PAGINA_CM[config.tamano] ?? PAGINA_CM.carta;
    const mg = margenesSeguros(config.margenes, config.tamano);
    const escala = ancho > 0 ? Math.min(1, Math.max(0.5, (ancho - MARGEN_LIENZO) / (pag.w * PX_POR_CM))) : 0.75;
    const pg = usePaginacion(raizRef, config, PX_POR_CM * escala);

    useEffect(() => {
        cb.current.onPaginas(pg.paginas);
    }, [pg.paginas]);

    /* ----- historial propio (deshacer / rehacer) ----- */
    function registrar() {
        const el = raizRef.current;
        if (!el) return;
        const h = hist.current;
        window.clearTimeout(h.timer);
        h.pendiente = false;
        const actual = h.pila[h.i];
        const s: Snap = { html: instantanea(el), sel: tomarSel(el) ?? actual?.sel ?? null };
        if (actual && actual.html === s.html) {
            actual.sel = s.sel;
            return;
        }
        h.pila = h.pila.slice(0, h.i + 1);
        h.pila.push(s);
        // Tope por cantidad y por tamaño total: con documentos largos cada instantánea pesa cientos de KB.
        while (
            h.pila.length > MAX_HISTORIAL
            || (h.pila.length > 10 && h.pila.reduce((a, x) => a + x.html.length, 0) > MAX_HISTORIAL_CHARS)
        ) {
            h.pila.shift();
        }
        h.i = h.pila.length - 1;
    }

    function programarSnapshot() {
        const h = hist.current;
        const ahora = Date.now();
        if (!h.pendiente) {
            h.pendiente = true;
            h.t0 = ahora;
        }
        window.clearTimeout(h.timer);
        h.timer = window.setTimeout(registrar, Math.max(0, Math.min(PAUSA_HISTORIAL_MS, MAX_AGRUPAR_MS - (ahora - h.t0))));
    }

    /* ----- estado hacia el padre (cinta y panel) ----- */
    function emitirFormato() {
        const el = raizRef.current;
        const s = window.getSelection();
        if (!el || !s || !s.anchorNode || !el.contains(s.anchorNode)) return;
        const b = bloqueRaiz(el, s.anchorNode);
        if (!b || esSalto(b)) return;
        const estilo = estiloDe(b);
        const q = (c: string) => {
            try {
                return document.queryCommandState(c);
            } catch {
                return false;
            }
        };
        const explicito = formatoEn(s.anchorNode, b);
        const f: FormatoActivo = {
            negrita: estilo === 'normal' ? q('bold') : explicito.b,
            cursiva: q('italic'),
            subrayado: q('underline'),
            alineacion: leerAlineacion(b) ?? BASE[estilo],
            estilo,
        };
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
        pg.remedir();
        if (inmediato) registrar();
        else programarSnapshot();
        cb.current.onCambio();
        programarEstado();
    }

    function restaurar(s: Snap) {
        const el = raizRef.current;
        if (!el) return;
        const h = hist.current;
        window.clearTimeout(h.timer);
        h.pendiente = false;
        el.innerHTML = s.html;
        el.focus({ preventScroll: true });
        ponerSel(el, s.sel);
        guardada.current = null;
        ultimoFmt.current = '';
        ultimoAmbito.current = '';
        pg.remedir();
        cb.current.onCambio();
        programarEstado();
    }

    function deshacer() {
        registrar();
        const h = hist.current;
        if (h.i <= 0) return;
        h.i -= 1;
        restaurar(h.pila[h.i]);
    }

    function rehacer() {
        const h = hist.current;
        if (h.i >= h.pila.length - 1) return;
        h.i += 1;
        restaurar(h.pila[h.i]);
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
        if (r.startContainer === el || r.endContainer === el) {
            const b = el.children[Math.min(r.startOffset, el.children.length - 1)];
            r = b instanceof HTMLElement ? inicioDe(b) : inicioDe(el);
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

    /** Borra la selección como Word: el borrado nativo une bien los bloques de los extremos. */
    function borrarSeleccion() {
        const s = window.getSelection();
        if (!s || s.rangeCount === 0 || s.isCollapsed) return;
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
        borrarSeleccion();
        const r = rangoActual();
        r.collapse(true);
        const bloque = bloqueRaiz(el, r.startContainer);
        if (!bloque || esSalto(bloque)) return;

        const trasBr = brAntesDe(r);
        const corte = document.createRange();
        corte.setStart(r.startContainer, r.startOffset);
        corte.setEnd(bloque, bloque.childNodes.length);
        const resto = corte.extractContents();

        const alFinBloque = restoVacio(resto);
        const tagOriginal = bloque.tagName.toLowerCase();
        const tag = estiloDe(bloque) !== 'normal' && alFinBloque ? 'p' : tagOriginal;
        const nuevo = document.createElement(tag);
        if (tag === tagOriginal && bloque.style.textAlign) nuevo.style.textAlign = bloque.style.textAlign;
        nuevo.appendChild(resto);
        bloque.after(nuevo);

        // Un salto suave justo antes del cursor queda ahora al final del párrafo original: necesita su relleno.
        if (trasBr) {
            const hojas = hojasDe(bloque);
            rellenarSaltoFinal(bloque, hojas[hojas.length - 1]);
        }
        limpiarBloque(bloque);
        limpiarBloque(nuevo);
        ponerRango(inicioProfundo(nuevo));
        tras(false, false);
        mostrarCursor(el);
    }

    /** Shift+Enter: salto de línea dentro del mismo párrafo. */
    function saltoSuave() {
        const el = raizRef.current;
        if (!el) return;
        borrarSeleccion();
        const r = rangoActual();
        r.collapse(true);
        const bloque = bloqueRaiz(el, r.startContainer);
        if (!bloque || esSalto(bloque)) return;
        const br = document.createElement('br');
        r.insertNode(br);
        rellenarSaltoFinal(bloque, br); // al final del párrafo hace falta un <br> de relleno detrás
        ponerRango(trasNodo(br));
        tras(false, false);
        mostrarCursor(el);
    }

    /** Tab: inserta una tabulación (en vez de sacar el foco del editor). */
    function tabulador() {
        if (!raizRef.current) return;
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

    function comando(c: 'negrita' | 'cursiva' | 'subrayado') {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const s = window.getSelection();
        const b = s?.anchorNode ? bloqueRaiz(el, s.anchorNode) : null;
        if (c === 'negrita' && b && estiloDe(b) !== 'normal') return; // títulos y subtítulos van siempre en negrita
        registrar();
        document.execCommand(c === 'negrita' ? 'bold' : c === 'cursiva' ? 'italic' : 'underline');
        tras(true);
    }

    function alinear(a: Alineacion) {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const bloques = bloquesSeleccionados(el);
        if (bloques.length === 0) return;
        registrar();
        for (const b of bloques) {
            if (a === BASE[estiloDe(b)]) b.style.removeProperty('text-align');
            else b.style.textAlign = A_CSS[a];
            if (!b.getAttribute('style')) b.removeAttribute('style');
        }
        tras(true);
    }

    /** Alterna título/subtítulo; si el bloque ya tiene ese estilo vuelve a párrafo normal. */
    function estilo(e: 'titulo' | 'subtitulo') {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const bloques = bloquesSeleccionados(el);
        if (bloques.length === 0) return;
        registrar();
        for (const b of bloques) {
            const nuevo: EstiloParrafo = estiloDe(b) === e ? 'normal' : e;
            const n = renombrar(b, TAG[nuevo]);
            if (n.style.textAlign === A_CSS[BASE[nuevo]]) n.style.removeProperty('text-align');
            if (!n.getAttribute('style')) n.removeAttribute('style');
        }
        tras(true);
    }

    function saltoPagina() {
        insertar('===', true);
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
        }
    }

    useImperativeHandle(
        ref,
        () => ({
            leerTexto, insertar, comando, alinear, estilo, saltoPagina, deshacer, rehacer, enfocar: foco,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    /* ----- ciclo de vida ----- */
    useEffect(() => {
        cb.current = { onCambio, onFormato, onEditarCampo, onMargenes, onConfigurarPagina, onPaginas, onAmbito };
        acc.current = { deshacer, rehacer, parrafo: nuevoParrafo, salto: saltoSuave };
    });

    useEffect(() => {
        const el = raizRef.current;
        if (!el) return;
        el.replaceChildren(...bloquesADom(textoInicial));
        normalizar(el);
        registrar();
        pg.remedir();
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
            const tipo = (e as InputEvent).inputType;
            const a = acc.current;
            if (!a) return;
            if (tipo === 'historyUndo') { e.preventDefault(); a.deshacer(); }
            else if (tipo === 'historyRedo') { e.preventDefault(); a.rehacer(); }
            else if (tipo === 'insertParagraph') { e.preventDefault(); a.parrafo(); }
            else if (tipo === 'insertLineBreak') { e.preventDefault(); a.salto(); }
        };
        el.addEventListener('beforeinput', f);
        return () => el.removeEventListener('beforeinput', f);
    }, []);

    useEffect(() => () => {
        window.clearTimeout(hist.current.timer);
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
        const tipo = (e.nativeEvent as InputEvent).inputType ?? '';
        tras(false, !RAPIDOS.test(tipo));
    }

    function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
        // No interferir con tildes por tecla muerta (´ + a) ni con IME.
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;

        if (e.key === 'Enter') {
            if (e.ctrlKey || e.metaKey) { e.preventDefault(); saltoPagina(); }       // Ctrl+Enter: salto de página
            else if (e.shiftKey) { e.preventDefault(); saltoSuave(); }              // Shift+Enter: salto de línea
            else if (!e.altKey) { e.preventDefault(); nuevoParrafo(); }             // Enter: párrafo nuevo
            return;
        }
        if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            tabulador();
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

    /** Doble clic en una etiqueta de campo: pide al padre que la edite. */
    function alDobleClic(e: MouseEvent<HTMLDivElement>) {
        const chip = e.target instanceof Element ? e.target.closest<HTMLElement>('.mk') : null;
        if (!chip) return;
        e.preventDefault();
        cb.current.onEditarCampo(chip.dataset.mk ?? chip.textContent ?? '', (nuevo) => {
            registrar();
            const limpio = nuevo.trim();
            if (!limpio) {
                chip.remove();
            } else {
                const marcador = /^\{\{[\s\S]*\}\}$/.test(limpio) ? limpio : `{{${limpio}}}`;
                chip.dataset.mk = marcador;
                chip.textContent = marcador;
            }
            tras(true);
        });
    }

    /* ----- render ----- */
    const cm = (n: number) => `${(n * escala).toFixed(3)}cm`;
    const pt = (n: number) => `${(n * escala).toFixed(2)}pt`;

    const estiloHoja = {
        ...pg.estiloRaiz,
        fontFamily: pilaCss(config.fuente),
        fontSize: pt(config.tamanoPt),
        lineHeight: config.interlineado,
        tabSize: cm(TAB_CM),
        '--esc': escala,
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
                    <div
                        ref={raizRef}
                        className={`hoja-ed${config.sangria ? ' con-sangria' : ''}`}
                        style={estiloHoja}
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck
                        lang="es"
                        role="textbox"
                        aria-multiline="true"
                        aria-label="Texto del documento"
                        onInput={alEscribir}
                        onKeyDown={alTeclear}
                        onPaste={alPegar}
                        onDoubleClick={alDobleClic}
                    />
                </div>
            </div>
        </div>
    );
}