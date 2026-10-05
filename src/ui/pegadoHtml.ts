import type { Alineacion, Bloque, EstiloParrafo, Tramo } from '../domain/fuenteModelo';

interface Fmt { b: boolean; i: boolean; u: boolean }
interface Pieza { texto: string; f: Fmt }
interface Parrafo { piezas: Pieza[]; alineacion: Alineacion | null; estilo: EstiloParrafo }
interface Lista { ordenada: boolean; n: number; nivel: number }
interface Ctx { f: Fmt; alin: Alineacion | null; enLinea: boolean; lista?: Lista }
type Decl = Record<string, string>;
type Reglas = Map<string, Decl>;

const SIN_FMT: Fmt = { b: false, i: false, u: false };
const BASE: Record<EstiloParrafo, Alineacion> = { normal: 'both', titulo: 'center', subtitulo: 'left' };
const ALIN: Partial<Record<string, Alineacion>> = {
    left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', justify: 'both',
};
const IGNORAR = new Set([
    'STYLE', 'SCRIPT', 'META', 'LINK', 'TITLE', 'HEAD', 'XML', 'NOSCRIPT', 'TEMPLATE', 'O:P',
    'IMG', 'SVG', 'CANVAS', 'IFRAME', 'OBJECT', 'BUTTON', 'SELECT', 'INPUT', 'TEXTAREA',
]);
const PARRAFO = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'DT', 'DD', 'CAPTION']);
const BLOQUE = new Set([
    ...PARRAFO, 'DIV', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'BLOCKQUOTE', 'SECTION',
    'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'NAV', 'MAIN', 'FORM', 'FIELDSET', 'CENTER', 'DL', 'FIGURE',
]);
/** Viñetas que Word escribe con fuentes Symbol/Wingdings. */
const VINETA = /^[·•o§\uF0B7\uF0A7\uF0D8\uF076\uF0FC\u25CF\u25AA]$/;
const RE_SALTO = /page-break-before\s*:\s*always|break-before\s*:\s*page/;

/* ---------- CSS mínimo ---------- */
function parseDecl(css: string): Decl {
    const d: Decl = {};
    for (const par of css.split(';')) {
        const i = par.indexOf(':');
        if (i < 0) continue;
        const k = par.slice(0, i).trim().toLowerCase();
        const v = par.slice(i + 1).trim().toLowerCase().replace(/\s*!important$/, '');
        if (k) d[k] = v;
    }
    return d;
}

/** Reglas por clase del <style> (Word define ahí p.MsoNormal, span.Strong…). */
function leerReglas(doc: Document): Reglas {
    const reglas: Reglas = new Map();
    for (const s of Array.from(doc.querySelectorAll('style'))) {
        const css = (s.textContent ?? '').replace(/<!--|-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
            const decl = parseDecl(m[2]);
            for (const sel of m[1].split(',')) {
                const c = /\.([\w-]+)\s*$/.exec(sel.trim());
                if (!c) continue;
                const k = c[1].toLowerCase();
                reglas.set(k, { ...(reglas.get(k) ?? {}), ...decl });
            }
        }
    }
    return reglas;
}

function declaraciones(el: Element, reglas: Reglas): Decl {
    const d: Decl = {};
    for (const c of (el.getAttribute('class') ?? '').split(/\s+/)) {
        const r = reglas.get(c.toLowerCase());
        if (r) Object.assign(d, r);
    }
    return Object.assign(d, parseDecl(el.getAttribute('style') ?? ''));
}

function alineacionDe(el: Element, d: Decl): Alineacion | null {
    if (el.tagName === 'CENTER') return 'center';
    return ALIN[d['text-align'] ?? ''] ?? ALIN[(el.getAttribute('align') ?? '').toLowerCase()] ?? null;
}

function estiloDe(el: Element): EstiloParrafo {
    const t = el.tagName;
    if (t === 'H1') return 'titulo';
    if (/^H[2-6]$/.test(t)) return 'subtitulo';
    const clase = (el.getAttribute('class') ?? '').toLowerCase();
    if (clase.includes('msotitle')) return 'titulo';
    if (clase.includes('msosubtitle')) return 'subtitulo';
    return 'normal';
}

function formato(el: Element, d: Decl, previo: Fmt): Fmt {
    const f = { ...previo };
    const t = el.tagName;
    if (t === 'B' || t === 'STRONG') f.b = true;
    if (t === 'I' || t === 'EM' || t === 'CITE' || t === 'DFN') f.i = true;
    if (t === 'U' || t === 'INS') f.u = true;
    const peso = d['font-weight'];
    if (peso) f.b = peso === 'bold' || peso === 'bolder' || Number(peso) >= 600;
    const estilo = d['font-style'];
    if (estilo) f.i = estilo === 'italic' || estilo === 'oblique';
    const deco = d['text-decoration-line'] ?? d['text-decoration'];
    if (deco?.includes('underline')) f.u = true;
    return f;
}

/* ---------- Párrafo → Bloque ---------- */
// eslint-disable-next-line no-control-regex
const limpiar = (s: string) => s.replace(/\u00A0/g, ' ').replace(/[\u200B\uFEFF\u00AD]/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

/** Une las piezas y reconstruye los marcadores {{…}} aunque vengan partidos. */
function aTramos(piezas: Pieza[], sinNegrita: boolean): Tramo[] {
    let texto = '';
    const formatos: Fmt[] = [];
    for (const p of piezas) {
        const t = limpiar(p.texto);
        texto += t;
        for (let k = 0; k < t.length; k++) formatos.push(p.f);
    }
    const tramos: Tramo[] = [];
    const poner = (t: string, f: Fmt, marcador: boolean) => {
        const u = tramos[tramos.length - 1];
        const negrita = f.b && !sinNegrita;
        if (!marcador && u && !u.marcador && u.negrita === negrita && u.cursiva === f.i && u.subrayado === f.u) u.texto += t;
        else tramos.push({ texto: t, negrita, cursiva: f.i, subrayado: f.u, marcador });
    };
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
    return tramos;
}

function aBloque(p: Parrafo, esWord: boolean): Bloque {
    const piezas = p.piezas.map((x) => ({ ...x }));
    while (piezas.length > 0) {
        const u = piezas[piezas.length - 1];
        u.texto = u.texto.replace(/[ \t\n\u00A0]+$/, '');
        if (u.texto === '') piezas.pop();
        else break;
    }
    // Word no escribe la alineación cuando es la normal (izquierda): sin dato, se respeta eso.
    const defecto: Alineacion = esWord ? 'left' : BASE[p.estilo];
    return {
        tipo: 'parrafo',
        alineacion: p.alineacion ?? defecto,
        estilo: p.estilo,
        tramos: aTramos(piezas, p.estilo !== 'normal'),
    };
}

/**
 * HTML del portapapeles → bloques del editor.
 * Conserva: negrita, cursiva, subrayado, alineación, títulos, saltos de línea y de página,
 * tabulaciones, listas (como texto con viñeta/número) y tablas (una fila por línea, celdas con tabulación).
 */
export function htmlABloques(html: string): Bloque[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const reglas = leerReglas(doc);
    const esWord = /urn:schemas-microsoft-com:office:word|class=["']?Mso/i.test(html);
    const salida: Bloque[] = [];
    const st = { actual: null as Parrafo | null, pendiente: null as string | null };

    function cerrar(): void {
        if (!st.actual) return;
        salida.push(aBloque(st.actual, esWord));
        st.actual = null;
    }

    function abrir(alineacion: Alineacion | null, estilo: EstiloParrafo = 'normal'): Parrafo {
        cerrar();
        const p: Parrafo = { piezas: [], alineacion, estilo };
        if (st.pendiente) {
            p.piezas.push({ texto: `${st.pendiente}\t`, f: SIN_FMT });
            st.pendiente = null;
        }
        st.actual = p;
        return p;
    }

    function salto(): void {
        cerrar();
        const u = salida[salida.length - 1];
        if (!u || u.tipo !== 'salto') salida.push({ tipo: 'salto' });
    }

    function poner(t: string, f: Fmt, alin: Alineacion | null): void {
        (st.actual ?? abrir(alin)).piezas.push({ texto: t, f });
    }

    function texto(t: string, f: Fmt, alin: Alineacion | null): void {
        let s = t.replace(/[ \t\r\n\f]+/g, ' ');
        if (s === '') return;
        if (!st.actual && s.trim() === '') return; // espacios entre bloques
        const p = st.actual ?? abrir(alin);
        const previo = p.piezas.length > 0 ? p.piezas[p.piezas.length - 1].texto : '';
        if (s.startsWith(' ') && (previo === '' || /[ \t\n]$/.test(previo))) s = s.slice(1);
        if (s !== '') p.piezas.push({ texto: s, f });
    }

    function recorrer(nodo: Node, c: Ctx): void {
        for (const h of Array.from(nodo.childNodes)) {
            if (h.nodeType === 3) texto((h as Text).data, c.f, c.alin);
            else if (h.nodeType === 1) elemento(h as Element, c);
        }
    }

    function elemento(el: Element, c: Ctx): void {
        const tag = el.tagName;
        if (IGNORAR.has(tag)) return;
        const d = declaraciones(el, reglas);
        if (d['display'] === 'none' || d['mso-hide'] === 'all') return;

        // Marcador de lista de Word («1.», «·»…): se conserva como texto + tabulación.
        if (d['mso-list'] === 'ignore') {
            const marca = (el.textContent ?? '').replace(/[\s\u00A0]+/g, ' ').trim();
            if (marca) poner(`${VINETA.test(marca) ? '•' : marca}\t`, SIN_FMT, c.alin);
            return;
        }
        if (d['mso-tab-count'] !== undefined) {
            poner('\t', c.f, c.alin);
            return;
        }
        if (tag === 'BR') {
            if (RE_SALTO.test((el.getAttribute('style') ?? '').toLowerCase())) {
                if (!c.enLinea) salto();
            } else if (st.actual) {
                st.actual.piezas.push({ texto: c.enLinea ? ' ' : '\n', f: c.f });
            } else {
                abrir(c.alin);
            }
            return;
        }
        if (BLOQUE.has(tag)) {
            bloque(el, c, d);
            return;
        }
        recorrer(el, { ...c, f: formato(el, d, c.f) });
    }

    function bloque(el: Element, c: Ctx, d: Decl): void {
        const tag = el.tagName;
        const f = formato(el, d, c.f);
        const alin = alineacionDe(el, d) ?? c.alin;

        if (c.enLinea) {
            // Dentro de una celda todo va en el mismo párrafo.
            texto(' ', f, alin);
            recorrer(el, { ...c, f, alin });
            texto(' ', f, alin);
            return;
        }
        if (d['page-break-before'] === 'always' || d['break-before'] === 'page') salto();

        if (tag === 'TR') {
            abrir(alin);
            let primera = true;
            for (const celda of Array.from(el.children)) {
                if (celda.tagName !== 'TD' && celda.tagName !== 'TH') continue;
                if (!primera) poner('\t', f, alin);
                primera = false;
                recorrer(celda, { f: formato(celda, declaraciones(celda, reglas), f), alin: null, enLinea: true });
            }
            cerrar();
            return;
        }

        if (tag === 'UL' || tag === 'OL') {
            cerrar();
            const inicio = Number.parseInt(el.getAttribute('start') ?? '', 10);
            const lista: Lista = {
                ordenada: tag === 'OL',
                n: Number.isFinite(inicio) ? inicio - 1 : 0,
                nivel: c.lista ? c.lista.nivel + 1 : 0,
            };
            recorrer(el, { ...c, f, alin, lista });
            cerrar();
            return;
        }

        if (tag === 'LI') {
            const l = c.lista;
            const marca = l ? (l.ordenada ? `${(l.n += 1)}.` : '•') : '•';
            st.pendiente = '\t'.repeat(l?.nivel ?? 0) + marca;
            // Si el <li> contiene bloques (Google Docs: <li><p>…), la viñeta la toma su primer párrafo.
            if (!Array.from(el.children).some((h) => BLOQUE.has(h.tagName))) abrir(alin);
            recorrer(el, { ...c, f, alin });
            st.pendiente = null;
            cerrar();
            return;
        }

        if (PARRAFO.has(tag)) {
            const p = abrir(alin, estiloDe(el));
            const nivel = /level(\d+)/.exec(d['mso-list'] ?? '');
            if (nivel && Number(nivel[1]) > 1) p.piezas.push({ texto: '\t'.repeat(Number(nivel[1]) - 1), f: SIN_FMT });
            recorrer(el, { ...c, f, alin });
            cerrar();
            return;
        }

        // Contenedor (div, table, section…)
        cerrar();
        recorrer(el, { ...c, f, alin });
        cerrar();
    }

    recorrer(doc.body, { f: SIN_FMT, alin: null, enLinea: false });
    cerrar();

    while (salida.length > 0) {
        const u = salida[salida.length - 1];
        if (u.tipo === 'salto' || u.tramos.length === 0) salida.pop();
        else break;
    }
    return salida;
}