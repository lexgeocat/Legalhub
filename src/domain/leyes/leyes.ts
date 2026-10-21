import { claveNormalizada } from '../comun/texto';

/* ================= Niveles y tipos ================= */
export const NIVELES_LEY = ['parte', 'libro', 'titulo', 'capitulo', 'seccion', 'subseccion', 'articulo'] as const;
export type NivelLey = (typeof NIVELES_LEY)[number];

export const RANGO_NIVEL: Readonly<Record<NivelLey, number>> = {
    parte: 0, libro: 1, titulo: 2, capitulo: 3, seccion: 4, subseccion: 5, articulo: 6,
};
export const ETIQUETA_NIVEL: Readonly<Record<NivelLey, string>> = {
    parte: 'Parte', libro: 'Libro', titulo: 'Título', capitulo: 'Capítulo',
    seccion: 'Sección', subseccion: 'Subsección', articulo: 'Artículo',
};
export const TIPOS_LEY = ['Constitución', 'Código', 'Ley', 'Decreto', 'Reglamento', 'Otro'] as const;

export interface NodoArbol {
    id: string; leyId: string; nivel: NivelLey; numero: string; titulo: string; pagina: number; orden: number;
}
export interface NodoLey extends NodoArbol { texto: string }
export type NodoBorrador = Pick<NodoLey, 'nivel' | 'numero' | 'titulo' | 'pagina' | 'texto'>;

export function etiquetaNodo(n: Pick<NodoArbol, 'nivel' | 'numero' | 'titulo'>): string {
    if (n.nivel === 'articulo') return `Art. ${n.numero}${n.titulo ? ` — ${n.titulo}` : ''}`;
    const cab = n.numero ? `${ETIQUETA_NIVEL[n.nivel]} ${n.numero}` : '';
    return [cab, n.titulo].filter(Boolean).join(' · ') || ETIQUETA_NIVEL[n.nivel];
}

/** Ancestros (Libro › Título › Capítulo…) del nodo en `indice`. */
export function rutaDe<T extends { nivel: NivelLey }>(nodos: readonly T[], indice: number): T[] {
    const ruta: T[] = [];
    let tope = RANGO_NIVEL[nodos[indice].nivel];
    for (let i = indice - 1; i >= 0 && tope > 0; i--) {
        const r = RANGO_NIVEL[nodos[i].nivel];
        if (r < tope) {
            ruta.unshift(nodos[i]);
            tope = r;
        }
    }
    return ruta;
}

/* ================= Detección de la estructura ================= */
const ORDINAL = /^(?:primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|s[eé]ptim[oa]|octav[oa]|noven[oa]|d[eé]cim[oa]|und[eé]cim[oa]|duod[eé]cim[oa]|vig[eé]sim[oa]|preliminar|[uú]nic[oa]|final|complementari[oa])$/i;
const COMPUESTO = /^(?:und[eé]cim|duod[eé]cim|d[eé]cim|vig[eé]sim)[oa]$/i;
const ORDINAL_UNIDAD = /^(?:primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|s[eé]ptim[oa]|octav[oa]|noven[oa])$/i;
const ROMANO = /^(?=[IVXLCDM])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/i;
const ARABIGO = /^\d{1,3}[a-z]?$/i;
const PUNTUACION_FINAL = /[.:\-–—°º,]+$/;

const RE_ENCABEZADO = /^(PARTE|LIBRO|T[IÍ]TULO|CAP[IÍ]TULO|SUBSECCI[OÓ]N|SECCI[OÓ]N)\s+(.+)$/i;
const RE_DISPOSICION = /^DISPOSICI[OÓ]N(?:ES)?\s+[A-ZÁÉÍÓÚÑ ,]{3,60}$/;
const RE_ARTICULO =
    /^(?:art[ií]culo|art\.?)\s*(\d{1,5})\s*(?:\.?[°ºª])?\s*(bis|ter|qu[aá]ter|quinquies|sexies|septies)?\s*(?:$|[.\-–—:)]|(?=\())[\s.\-–—:)]*(.*)$/i;

export interface Encabezado { nivel: NivelLey; numero: string; titulo: string }
interface Abierto extends Encabezado { pagina: number }

function normalizarNumeral(w: string): string {
    return ROMANO.test(w) || ARABIGO.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** «CAPÍTULO II – DE LA CAPACIDAD» → { capitulo, II, DE LA CAPACIDAD }. */
export function leerEncabezado(linea: string): Encabezado | null {
    const t = linea.trim();
    if (t.length > 140 || !/^[A-ZÁÉÍÓÚÑ]/.test(t)) return null;
    if (RE_DISPOSICION.test(t)) return { nivel: 'titulo', numero: '', titulo: t };
    const m = RE_ENCABEZADO.exec(t);
    if (!m) return null;
    const nivel = claveNormalizada(m[1]) as NivelLey;
    const palabras = m[2].trim().split(/\s+/);
    let w = palabras[0].replace(PUNTUACION_FINAL, '');
    const valido = (x: string) =>
        ROMANO.test(x) || ARABIGO.test(x) || ORDINAL.test(x) || (nivel === 'parte' && /^(general|especial)$/i.test(x));
    if (!valido(w)) return null;
    let usadas = 1;
    const sig = (palabras[1] ?? '').replace(PUNTUACION_FINAL, '');
    if (COMPUESTO.test(w) && ORDINAL_UNIDAD.test(sig)) {
        w = `${w} ${sig}`;
        usadas = 2;
    }
    const titulo = palabras.slice(usadas).join(' ').replace(/^[\s.\-–—:°º]+/, '').trim();
    return { nivel, numero: normalizarNumeral(w), titulo };
}

/** «Artículo 12.- (Objeto) Texto…» → { 12, «(Objeto) Texto…» }. Solo si la línea EMPIEZA así (evita referencias dentro del texto). */
export function leerArticulo(linea: string): { numero: string; resto: string } | null {
    const t = linea.trim();
    if (!/^A/.test(t)) return null;
    const m = RE_ARTICULO.exec(t);
    if (!m) return null;
    const sufijo = m[2] ? ` ${claveNormalizada(m[2])}` : '';
    return { numero: `${Number(m[1])}${sufijo}`, resto: m[3].trim() };
}

const clavePie = (l: string) => l.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

/** Quita encabezados y pies de página que se repiten en muchas hojas (títulos corridos, «Página 3 de 120»…). */
export function quitarRepetidas(paginas: readonly (readonly string[])[]): string[][] {
    const n = paginas.length;
    if (n < 3) return paginas.map((p) => [...p]);
    const conteo = new Map<string, number>();
    const bordes = (p: readonly string[]) => [...p.slice(0, 3), ...p.slice(-3)];
    for (const p of paginas) {
        for (const k of new Set(bordes(p).map(clavePie))) conteo.set(k, (conteo.get(k) ?? 0) + 1);
    }
    const minimo = Math.max(3, Math.ceil(n * 0.3));
    const repetidas = new Set([...conteo].filter(([, c]) => c >= minimo).map(([k]) => k));
    return paginas.map((p) =>
        p.filter((l, i) => {
            const borde = i < 3 || i >= p.length - 3;
            return !(borde && repetidas.has(clavePie(l)) && !leerArticulo(l) && !leerEncabezado(l));
        }),
    );
}

/** Página de índice (muchos puntos guía o casi todo encabezados): se ignora para no duplicar marcadores. */
function esPaginaIndice(lineas: readonly string[]): boolean {
    const utiles = lineas.filter((l) => l.trim() !== '');
    if (utiles.length < 6) return false;
    const conPuntos = utiles.filter((l) => /(?:\.\s?){4,}\s*\d+\s*$|…+\s*\d+\s*$/.test(l)).length;
    if (conPuntos >= 4) return true;
    const estructura = utiles.filter((l) => leerArticulo(l) || leerEncabezado(l)).length;
    return utiles.length >= 12 && estructura / utiles.length >= 0.85;
}

const esTituloEnMayusculas = (t: string) =>
    t.length <= 100 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(t);

/** Une las líneas del PDF en párrafos (quita guiones de fin de línea y respeta listas e incisos). */
export function reflujo(lineas: readonly string[]): string {
    const l = lineas.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (l.length === 0) return '';
    const largos = l.map((x) => x.length).sort((a, b) => a - b);
    const ref = largos[Math.floor((largos.length - 1) * 0.85)];
    let salida = l[0];
    for (let i = 1; i < l.length; i++) {
        const prev = l[i - 1];
        const cur = l[i];
        if (/[a-záéíóúñ]-$/i.test(prev) && /^[a-záéíóúñ]/.test(cur)) {
            salida = salida.slice(0, -1) + cur;
            continue;
        }
        const lista = /^(?:\d{1,2}[.)°º]|[a-zñ]\)|[ivxl]+[.)]|[-•–—])\s/i.test(cur);
        const finFrase = /[.:;]$/.test(prev);
        const corta = l.length >= 3 && prev.length < ref * 0.7;
        salida += (finFrase && (corta || lista) ? '\n' : ' ') + cur;
    }
    return salida;
}

/** Líneas de cada página → lista ordenada de marcadores (con el texto de cada uno). */
export function analizarLey(paginasCrudas: readonly (readonly string[])[]): NodoBorrador[] {
    const paginas = quitarRepetidas(paginasCrudas);
    const salida: NodoBorrador[] = [];
    const st: { actual: { enc: Abierto; lineas: string[]; lineasTitulo: number } | null } = { actual: null };

    const cerrar = () => {
        const a = st.actual;
        if (!a) return;
        let titulo = a.enc.titulo;
        let texto = reflujo(a.lineas);
        if (a.enc.nivel === 'articulo' && !titulo) {
            const r = /^\(([^()]{1,200})\)\s*\.?\s*/.exec(texto); // «(Objeto)» al inicio = rubro del artículo
            if (r) {
                titulo = r[1].trim();
                texto = texto.slice(r[0].length);
            }
        }
        salida.push({ nivel: a.enc.nivel, numero: a.enc.numero, titulo, pagina: a.enc.pagina, texto });
        st.actual = null;
    };

    for (const [pi, lineas] of paginas.entries()) {
        if (esPaginaIndice(lineas)) continue;
        for (const cruda of lineas) {
            const t = cruda.replace(/\s+/g, ' ').trim();
            if (!t) continue;

            const art = leerArticulo(t);
            if (art) {
                cerrar();
                st.actual = {
                    enc: { nivel: 'articulo', numero: art.numero, titulo: '', pagina: pi + 1 },
                    lineas: art.resto ? [art.resto] : [],
                    lineasTitulo: 0,
                };
                continue;
            }
            const enc = leerEncabezado(t);
            if (enc) {
                cerrar();
                st.actual = { enc: { ...enc, pagina: pi + 1 }, lineas: [], lineasTitulo: enc.titulo ? 1 : 0 };
                continue;
            }

            const a = st.actual;
            if (!a) continue; // preámbulo: antes del primer marcador
            // «CAPÍTULO I» y el nombre en la línea de abajo (hasta 2 líneas en mayúsculas)
            if (
                a.enc.nivel !== 'articulo' && a.lineas.length === 0 && a.lineasTitulo < 2
                && esTituloEnMayusculas(t) && !/\.$/.test(a.enc.titulo)
            ) {
                a.enc.titulo = a.enc.titulo ? `${a.enc.titulo} ${t}` : t;
                a.lineasTitulo += 1;
                continue;
            }
            a.lineas.push(t);
        }
    }
    cerrar();
    return salida;
}

/* ================= Citas ================= */
export type ModoCita = 'referencia' | 'titulo' | 'texto';

/** «Código Civil» → «del Código Civil»; «Ley 439» → «de la Ley 439». */
export function conDe(nombre: string): string {
    const n = nombre.trim();
    const primera = (/^\S+/.exec(n)?.[0] ?? '').toLowerCase();
    const resto = n.slice(primera.length).trim();
    if (primera === 'el') return `del ${resto}`;
    if (primera === 'la') return `de la ${resto}`;
    if (primera === 'los') return `de los ${resto}`;
    if (primera === 'las') return `de las ${resto}`;
    return /^(?:ley|.*(?:a|i[oó]n|dad))$/.test(primera) ? `de la ${n}` : `del ${n}`;
}

export function referenciaNodo(n: Pick<NodoArbol, 'nivel' | 'numero' | 'titulo'>, conTitulo = false): string {
    const base = n.nivel === 'articulo'
        ? `artículo ${n.numero}`
        : n.numero ? `${ETIQUETA_NIVEL[n.nivel].toLowerCase()} ${n.numero}` : n.titulo;
    return conTitulo && n.titulo && (n.nivel === 'articulo' || n.numero) ? `${base} (${n.titulo})` : base;
}

export function citar(ley: { nombre: string }, n: NodoLey, modo: ModoCita): string {
    const de = conDe(ley.nombre);
    const ref = `${referenciaNodo(n, modo === 'titulo')} ${de}`;
    if (modo !== 'texto') return ref;
    const cab = n.nivel === 'articulo' ? `Artículo ${n.numero}.-${n.titulo ? ` (${n.titulo})` : ''}` : etiquetaNodo(n);
    const t = n.texto.trim();
    return `"${t ? `${cab} ${t}` : cab}" (${referenciaNodo(n)} ${de})`;
}

/** Escapa un texto para el editor (su sintaxis usa **, *, ++, {{ }}, [c], #, ===). */
export function aTextoDeModelo(texto: string): string {
    return texto
        .split('\n')
        .map((l) => {
            const e = l.replace(/[\\*\u27EA]/g, '\\$&').replace(/\+\+/g, '\\+\\+').replace(/\{\{/g, '\\{{');
            return /^(#|\[(?:[cdij]\]|int=|col=|nc\])|===\s*$)/i.test(e) ? `\\${e}` : e;
        })
        .join('\n');
}

/** Cita lista para el editor: escapada y en un solo párrafo (los saltos de línea pasan a saltos suaves). */
export const citaParaEditor = (texto: string): string => aTextoDeModelo(texto).replace(/\n/g, '\u2028');

/* ================= Árbol (organigrama) ================= */
export interface NodoOrg<T extends NodoArbol = NodoArbol> {
    n: T;
    hijos: NodoOrg<T>[];
    /** Artículos dentro de esta división (1 si es un artículo). */
    arts: number;
    /** Primer y último artículo en orden de lectura ('' si no hay). */
    desde: string;
    hasta: string;
}

/** Lista ordenada de marcadores → árbol anidado (según `nivel`), con el conteo y rango de artículos de cada división. */
export function construirOrg<T extends NodoArbol>(nodos: readonly T[]): { raices: NodoOrg<T>[]; porId: Map<string, NodoOrg<T>> } {
    const raices: NodoOrg<T>[] = [];
    const porId = new Map<string, NodoOrg<T>>();
    const pila: NodoOrg<T>[] = [];
    for (const n of nodos) {
        const item: NodoOrg<T> = { n, hijos: [], arts: 0, desde: '', hasta: '' };
        porId.set(n.id, item);
        const r = RANGO_NIVEL[n.nivel];
        while (pila.length > 0 && RANGO_NIVEL[pila[pila.length - 1].n.nivel] >= r) pila.pop();
        (pila.length > 0 ? pila[pila.length - 1].hijos : raices).push(item);
        pila.push(item);
    }
    const calcular = (o: NodoOrg<T>): void => {
        if (o.n.nivel === 'articulo') {
            o.arts = 1;
            o.desde = o.n.numero;
            o.hasta = o.n.numero;
            return;
        }
        for (const h of o.hijos) {
            calcular(h);
            o.arts += h.arts;
            if (h.desde && !o.desde) o.desde = h.desde;
            if (h.hasta) o.hasta = h.hasta;
        }
    };
    raices.forEach(calcular);
    return { raices, porId };
}

/** «Arts. 1–45» / «Art. 12» / '' si la división no tiene artículos. */
export function rangoArticulos(o: Pick<NodoOrg, 'arts' | 'desde' | 'hasta'>): string {
    if (o.arts === 0 || !o.desde) return '';
    return o.desde === o.hasta ? `Art. ${o.desde}` : `Arts. ${o.desde}–${o.hasta}`;
}