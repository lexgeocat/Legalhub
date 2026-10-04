import {
    useEffect, useImperativeHandle, useRef, useState,
    type ClipboardEvent, type CSSProperties, type FormEvent, type KeyboardEvent, type MouseEvent, type Ref,
} from 'react';
import {
    bloquesATexto, PAGINA_CM, margenesSeguros, parsearTexto, tramosDe,
    type Alineacion, type Bloque, type BloqueParrafo, type ConfigPagina, type EstiloParrafo, type Margenes, type Tramo,
} from '../domain/fuenteModelo';
import { Regla } from './Regla';
import './editorWord.css';

const PX_POR_CM = 37.7953;
const MARGEN_LIENZO = 48;

const BASE: Record<EstiloParrafo, Alineacion> = { normal: 'both', titulo: 'center', subtitulo: 'left' };
const TAG: Record<EstiloParrafo, string> = { normal: 'p', titulo: 'h1', subtitulo: 'h2' };
const DESDE_CSS: Record<string, Alineacion> = { left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', justify: 'both' };
const A_CSS: Record<Alineacion, string> = { left: 'left', center: 'center', right: 'right', both: 'justify' };
const BLOQUES = new Set(['P', 'H1', 'H2']);

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

/* ---------------- DOM ⇄ bloques ---------------- */
interface Fmt { b: boolean; i: boolean; u: boolean }
interface Pieza { texto: string; f: Fmt; chip: boolean }
const SIN_FMT: Fmt = { b: false, i: false, u: false };

const esSalto = (n: Node | null): n is HTMLElement => n instanceof HTMLElement && n.dataset.salto !== undefined;
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

function tramoADom(t: Tramo): Node {
    let n: Node = t.marcador ? crearChip(t.texto) : document.createTextNode(t.texto);
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
    if (b.tramos.length === 0) el.appendChild(document.createElement('br'));
    else for (const t of b.tramos) el.appendChild(tramoADom(t));
    return el;
}

function saltoADom(): HTMLElement {
    const d = document.createElement('div');
    d.className = 'salto-pagina';
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

const limpiarTexto = (s: string) => s.replace(/[\u200B\uFEFF]/g, '').replace(/\u00A0/g, ' ').replace(/[\r\n]+/g, ' ');

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
            if (h.classList.contains('mk')) salida.push({ texto: limpiarTexto(h.dataset.mk ?? h.textContent ?? ''), f, chip: true });
            else if (h.tagName !== 'BR') recolectar(h, formatoDe(h, f), salida);
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
                if (fin !== -1) {
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
        salida.push({ tipo: 'parrafo', alineacion: leerAlineacion(n) ?? BASE[estilo], estilo, tramos: aTramos(piezas) });
    }
    return salida;
}

/* ---------------- Selección ---------------- */
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

function alFinal(el: HTMLElement): Range {
    const r = document.createRange();
    r.selectNodeContents(el);
    const ult = el.lastChild;
    if (ult && ult.nodeName === 'BR') r.setEndBefore(ult);
    r.collapse(false);
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

function bloquesSeleccionados(raiz: HTMLElement): HTMLElement[] {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || !raiz.contains(s.anchorNode)) return [];
    const r = s.getRangeAt(0);
    const lista = Array.from(raiz.children).filter((el): el is HTMLElement => {
        if (!(el instanceof HTMLElement) || esSalto(el) || !r.intersectsNode(el)) return false;
        const b = el as HTMLElement;
        const terminaAlInicio = !r.collapsed && r.endOffset === 0 && !b.contains(r.startContainer) && (r.endContainer === b || b.contains(r.endContainer));
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
        (b as HTMLElement).replaceWith(...nuevos);
        return;
    }
    const pre = document.createRange();
    pre.selectNodeContents(b as HTMLElement);
    pre.setEnd(r.startContainer, r.startOffset);
    const post = document.createRange();
    post.selectNodeContents(b as HTMLElement);
    post.setStart(r.startContainer, r.startOffset);
    if (pre.toString() === '') {
        (b as HTMLElement).before(...nuevos);
        return;
    }
    if (post.toString() === '') {
        (b as HTMLElement).after(...nuevos);
        return;
    }
    const resto = (b as HTMLElement).cloneNode(false) as HTMLElement;
    resto.appendChild(post.extractContents());
    (b as HTMLElement).after(...nuevos, resto);
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

/* ---------------- Normalización ---------------- */
/** Convierte el texto «{{…}}» escrito a mano en etiquetas de campo. */
function convertirMarcadores(el: HTMLElement): void {
    if (!(el.textContent ?? '').includes('{{')) return;
    const nodos: Text[] = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n as Text;
        if (!t.parentElement?.closest('.mk') && /\{\{[\s\S]*?\}\}/.test(t.data)) nodos.push(t);
    }
    if (nodos.length === 0) return;
    const s = window.getSelection();
    const colapsada = !!s && s.rangeCount > 0 && s.isCollapsed;
    let colocar: HTMLElement | null = null;
    for (const t of nodos) {
        const ancla = colapsada && s && s.anchorNode === t ? s.anchorOffset : -1;
        const marcas = Array.from(t.data.matchAll(/\{\{[\s\S]*?\}\}/g));
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
        r.setStartAfter(colocar);
        r.collapse(true);
        ponerRango(r);
    }
}

function limpiarBloque(b: HTMLElement): void {
    const chips = b.querySelectorAll<HTMLElement>('.mk');
    const texto = b.textContent ?? '';
    if (texto !== '' || chips.length > 0) b.querySelectorAll('br').forEach((br) => br.remove());
    else if (!b.querySelector('br')) b.appendChild(document.createElement('br'));
    const solo = chips.length === 1
        && texto.trim() === (chips[0].textContent ?? '').trim()
        && /^\{\{\s*[#/]/.test(chips[0].dataset.mk ?? '');
    b.classList.toggle('mk-bloque', solo);
    if (b.classList.length === 0) b.removeAttribute('class');
}

/** Deja la página con la estructura esperada: solo <p>, <h1>, <h2> y saltos de página. */
function normalizar(el: HTMLElement): void {
    let sueltos: Node[] = [];
    const cerrar = (antes: Node | null) => {
        if (sueltos.length === 0) return;
        const p = document.createElement('p');
        el.insertBefore(p, antes);
        for (const n of sueltos) p.appendChild(n);
        sueltos = [];
    };
    for (const n of Array.from(el.childNodes)) {
        if (n instanceof HTMLElement && (esSalto(n) || BLOQUES.has((n as HTMLElement).tagName))) {
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
    convertirMarcadores(el);
    for (const b of Array.from(el.children)) if (b instanceof HTMLElement && !esSalto(b)) limpiarBloque(b);
}

/* ---------------- Componente ---------------- */
export function HojaEditable({
    ref, textoInicial, config, onCambio, onFormato, onEditarCampo, onMargenes, onConfigurarPagina, onPaginas,
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
}) {
    const raizRef = useRef<HTMLDivElement>(null);
    const lienzo = useRef<HTMLDivElement>(null);
    const [ancho, setAncho] = useState(0);
    const [paginas, setPaginas] = useState(1);
    const nPaginas = useRef(1);
    const medida = useRef({ padSup: 0, util: 1 });
    const guardada = useRef<Range | null>(null);
    const hist = useRef<{ pila: Snap[]; i: number; t: number; t0: number }>({ pila: [], i: -1, t: 0, t0: 0 });
    const ultimoFmt = useRef('');
    const pegando = useRef(false);
    const cb = useRef({ onCambio, onFormato, onEditarCampo, onMargenes, onConfigurarPagina, onPaginas });

    useEffect(() => {
        cb.current = { onCambio, onFormato, onEditarCampo, onMargenes, onConfigurarPagina, onPaginas };
    });
    /* ----- historial propio (deshacer / rehacer) ----- */
    function registrar(forzar: boolean) {
        const el = raizRef.current;
        if (!el) return;
        const h = hist.current;
        const s: Snap = { html: el.innerHTML, sel: tomarSel(el) };
        const actual = h.pila[h.i];
        if (actual && actual.html === s.html) {
            actual.sel = s.sel;
            return;
        }
        const ahora = Date.now();
        if (!forzar && h.i > 0 && h.i === h.pila.length - 1 && ahora - h.t < 700 && ahora - h.t0 < 4000) {
            h.pila[h.i] = s;
        } else {
            h.pila = h.pila.slice(0, h.i + 1);
            h.pila.push(s);
            if (h.pila.length > 200) h.pila.shift();
            h.i = h.pila.length - 1;
            h.t0 = ahora;
        }
        h.t = ahora;
    }

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

    function tras(forzar: boolean) {
        const el = raizRef.current;
        if (!el) return;
        normalizar(el);
        registrar(forzar);
        cb.current.onCambio();
        emitirFormato();
    }

    function restaurar(s: Snap) {
        const el = raizRef.current;
        if (!el) return;
        el.innerHTML = s.html;
        el.focus({ preventScroll: true });
        ponerSel(el, s.sel);
        guardada.current = null;
        ultimoFmt.current = '';
        cb.current.onCambio();
        emitirFormato();
    }

    function deshacer() {
        registrar(true);
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
        try {
            document.execCommand('defaultParagraphSeparator', false, 'p');
        } catch {
            /* sin efecto */
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
        if (esSalto(bloque)) {
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

    /* ----- operaciones públicas ----- */
    function leerTexto(): string {
        const el = raizRef.current;
        return el ? bloquesATexto(domABloques(el)) : textoInicial;
    }

    function insertar(texto: string, bloque: boolean) {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const r = rangoActual();
        const lineas = texto.split('\n');
        if (!bloque && lineas.length === 1) {
            const frag = document.createDocumentFragment();
            for (const t of tramosDe(lineas[0])) frag.appendChild(tramoADom(t));
            const ult = frag.lastChild;
            if (!ult) return;
            if (!r.collapsed) r.deleteContents();
            r.insertNode(frag);
            const sig = ult.nextSibling;
            if (!sig || sig.nodeName === 'BR') {
                // Chromium no deja el cursor tras un inline no editable si es lo último del párrafo:
                // se añade un carácter invisible (limpiarTexto lo descarta al leer).
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
    }

    function comando(c: 'negrita' | 'cursiva' | 'subrayado') {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const s = window.getSelection();
        const b = s?.anchorNode ? bloqueRaiz(el, s.anchorNode) : null;
        if (c === 'negrita' && b && estiloDe(b) !== 'normal') return; // títulos y subtítulos van siempre en negrita
        document.execCommand(c === 'negrita' ? 'bold' : c === 'cursiva' ? 'italic' : 'underline');
        tras(true);
    }

    function alinear(a: Alineacion) {
        const el = raizRef.current;
        if (!el) return;
        foco();
        const bloques = bloquesSeleccionados(el);
        if (bloques.length === 0) return;
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
        const el = raizRef.current;
        if (!el) return;
        el.replaceChildren(...bloquesADom(textoInicial));
        normalizar(el);
        registrar(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const f = () => {
            const el = raizRef.current;
            const s = window.getSelection();
            if (!el || !s || s.rangeCount === 0 || !s.anchorNode || !el.contains(s.anchorNode)) return;
            guardada.current = s.getRangeAt(0).cloneRange();
            emitirFormato();
        };
        document.addEventListener('selectionchange', f);
        return () => document.removeEventListener('selectionchange', f);
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
    function alEscribir(_e: FormEvent<HTMLDivElement>) {
        if (pegando.current) return;
        tras(false);
    }

    function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
        if (!(e.ctrlKey || e.metaKey)) return;
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); deshacer(); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); rehacer(); }
        else if (k === 'b') { e.preventDefault(); comando('negrita'); }
        else if (k === 'i') { e.preventDefault(); comando('cursiva'); }
        else if (k === 'u') { e.preventDefault(); comando('subrayado'); }
        // Ctrl+S se deja subir hasta la ventana, que guarda.
    }

    /** Pega siempre como texto plano (los {{…}} se convierten en etiquetas al normalizar). */
    function alPegar(e: ClipboardEvent<HTMLDivElement>) {
        e.preventDefault();
        const lineas = e.clipboardData.getData('text/plain').replace(/\u00A0/g, ' ').split(/\r?\n/);
        if (lineas.every((l) => l === '')) return;
        foco();
        pegando.current = true;
        try {
            lineas.forEach((l, i) => {
                if (i > 0) document.execCommand('insertParagraph');
                if (l) document.execCommand('insertText', false, l);
            });
        } finally {
            pegando.current = false;
        }
        tras(true);
    }

    /** Doble clic en una etiqueta de campo: pide al padre que la edite. */
    function alDobleClic(e: MouseEvent<HTMLDivElement>) {
        const chip = e.target instanceof Element ? e.target.closest<HTMLElement>('.mk') : null;
        if (!chip) return;
        e.preventDefault();
        cb.current.onEditarCampo(chip.dataset.mk ?? chip.textContent ?? '', (nuevo) => {
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
    const pag = PAGINA_CM[config.tamano] ?? PAGINA_CM.carta;
    const mg = margenesSeguros(config.margenes, config.tamano);
    const escala = ancho > 0 ? Math.min(1, Math.max(0.5, (ancho - MARGEN_LIENZO) / (pag.w * PX_POR_CM))) : 0.75;
    const pxCm = PX_POR_CM * escala;
    const padSup = mg.superior * pxCm;
    const util = (pag.h - mg.superior - mg.inferior) * pxCm;
    const cm = (n: number) => `${(n * escala).toFixed(3)}cm`;
    const pt = (n: number) => `${(n * escala).toFixed(2)}pt`;

    /** Páginas aproximadas: alto usado por el texto ÷ alto útil de una página. */
    function medirPaginas() {
        const el = raizRef.current;
        if (!el) return;
        const { padSup: sup, util: u } = medida.current;
        const ult = el.lastElementChild;
        const usado = ult instanceof HTMLElement ? ult.offsetTop + ult.offsetHeight - sup : 0;
        const n = Math.max(1, Math.ceil((usado - 2) / u));
        if (n === nPaginas.current) return;
        nPaginas.current = n;
        setPaginas(n);
        cb.current.onPaginas(n);
    }

    useEffect(() => {
        const el = raizRef.current;
        if (!el) return;
        const o = new ResizeObserver(() => medirPaginas());
        o.observe(el);
        return () => o.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        medida.current = { padSup, util };
        medirPaginas();
    });

    const estiloHoja = {
        position: 'relative',
        width: cm(pag.w),
        minHeight: cm(pag.h),
        padding: `${cm(mg.superior)} ${cm(mg.derecho)} ${cm(mg.inferior)} ${cm(mg.izquierdo)}`,
        fontFamily: `"${config.fuente}", "Times New Roman", serif`,
        fontSize: pt(config.tamanoPt),
        lineHeight: config.interlineado,
        '--esc': escala,
        '--pt-titulo': pt(config.tamanoPt + 2),
        '--sangria': cm(1.25),
    } as CSSProperties;

    const cambiarMargen = (lado: keyof Margenes, v: number) => cb.current.onMargenes(lado, v);
    const abrirPagina = () => cb.current.onConfigurarPagina();

    return (
        <div className="ed-lienzo" ref={lienzo}>
            <div className="ed-regla-barra">
                <div style={{ width: cm(pag.w), margin: '0 auto' }}>
                    <Regla
                        orientacion="h" largoCm={pag.w} escala={escala}
                        ini={mg.izquierdo} fin={mg.derecho} ladoIni="izquierdo" ladoFin="derecho"
                        onCambio={cambiarMargen} onAbrir={abrirPagina}
                    />
                </div>
            </div>

            <div className="ed-caja" style={{ width: cm(pag.w) }}>
                <div className="ed-regla-v">
                    <Regla
                        orientacion="v" largoCm={pag.h} escala={escala}
                        ini={mg.superior} fin={mg.inferior} ladoIni="superior" ladoFin="inferior"
                        onCambio={cambiarMargen} onAbrir={abrirPagina}
                    />
                </div>

                <div
                    ref={raizRef}
                    className={`hoja hoja-ed${config.sangria ? ' con-sangria' : ''}`}
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

                {/* Guías de corte de página (hermanas de la hoja: no forman parte del contenido editable) */}
                {Array.from({ length: paginas - 1 }, (_, i) => (
                    <div key={i} className="ed-corte" style={{ top: `${padSup + (i + 1) * util}px` }}>
                        <span>Pág. {i + 2}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}