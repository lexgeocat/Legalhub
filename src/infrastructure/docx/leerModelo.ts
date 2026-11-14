import { strFromU8, unzipSync } from 'fflate';
import type { LectorDocx } from '../../application/puertos/modelos';
import { ErrorDeDatos } from '../../domain/comun/errores';
import type {
    Alineacion, Bloque, BloqueParrafo, BloqueTabla, CeldaTabla, ColorResaltado, EstiloParrafo, TipoLista, Tramo,
} from '../../domain/modelos/fuenteModelo';
import { normalizarCaracteres } from './gramatica';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

interface Formato {
    negrita: boolean;
    cursiva: boolean;
    subrayado: boolean;
    fuente?: string;
    tamanoPt?: number;
    resaltado?: ColorResaltado;
}
interface Letra { fuente?: string; tamanoPt?: number }
type Pieza = { tipo: 'texto'; texto: string; formato: Formato } | { tipo: 'salto' } | { tipo: 'columna' };

const HIGHLIGHT_MAP: Record<string, ColorResaltado> = {
    yellow: 'yellow',
    green: 'green',
    cyan: 'cyan',
    magenta: 'magenta',
    darkyellow: 'orange',
    red: 'magenta',
    blue: 'cyan',
    lightgray: 'gray',
    darkgray: 'gray',
};

const ESTILO_TITULO = /^(title|heading1|titulo1?|ttulo1?)$/i;
const ESTILO_SUBTITULO = /^(subtitle|heading2|subtitulo|subttulo|titulo2|ttulo2)$/i;
const ALINEACION: Record<string, Alineacion> = {
    left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', both: 'both', distribute: 'both',
};
const BASE: Record<EstiloParrafo, Alineacion> = { normal: 'both', titulo: 'center', subtitulo: 'left' };

function esW(n: Node, nombre: string): n is Element {
    return n.nodeType === 1 && (n as Element).namespaceURI === W && (n as Element).localName === nombre;
}

function hijoW(el: Element, nombre: string): Element | null {
    for (const n of Array.from(el.childNodes)) if (esW(n, nombre)) return n;
    return null;
}

const valorW = (el: Element | null): string | null => el?.getAttributeNS(W, 'val') || null;

function ancestroW(inicio: Node | null, nombre: string): Element | null {
    for (let x: Node | null = inicio; x; x = x.parentNode) if (esW(x, nombre)) return x;
    return null;
}

function dentroDeFallback(inicio: Node): boolean {
    for (let x: Node | null = inicio; x; x = x.parentNode) {
        if (x.nodeType === 1 && (x as Element).namespaceURI === MC && (x as Element).localName === 'Fallback') return true;
    }
    return false;
}

const apagado = (v: string | null) => ['0', 'false', 'off'].includes((v ?? '').toLowerCase());

/** Fuente y tamaño declarados en un <w:rPr>. */
function letraDe(rPr: Element | null): Letra {
    if (!rPr) return {};
    const rf = hijoW(rPr, 'rFonts');
    const fuente = rf ? (rf.getAttributeNS(W, 'ascii') || rf.getAttributeNS(W, 'hAnsi') || undefined) : undefined;
    const sz = Number(valorW(hijoW(rPr, 'sz')));
    return { fuente, tamanoPt: Number.isFinite(sz) && sz > 0 ? sz / 2 : undefined };
}

/** Fuente y tamaño base del documento (docDefaults + estilo Normal): solo lo que se aparte de ahí se considera propio. */
function letraBase(estilos: Document | null): Letra {
    if (!estilos) return {};
    let base: Letra = {};
    const dd = estilos.getElementsByTagNameNS(W, 'docDefaults')[0];
    const rPrDef = dd ? hijoW(dd, 'rPrDefault') : null;
    if (rPrDef) base = letraDe(hijoW(rPrDef, 'rPr'));
    for (const st of Array.from(estilos.getElementsByTagNameNS(W, 'style'))) {
        if (st.getAttributeNS(W, 'type') === 'paragraph' && st.getAttributeNS(W, 'default') === '1') {
            const l = letraDe(hijoW(st, 'rPr'));
            base = { fuente: l.fuente ?? base.fuente, tamanoPt: l.tamanoPt ?? base.tamanoPt };
        }
    }
    return base;
}

function formatoDe(r: Element, base: Letra, estilo: EstiloParrafo): Formato {
    const rPr = hijoW(r, 'rPr');
    if (!rPr) return { negrita: false, cursiva: false, subrayado: false };
    const activa = (nombre: string) => {
        const el = hijoW(rPr, nombre);
        return !!el && !apagado(valorW(el));
    };
    const u = hijoW(rPr, 'u');
    const hl = valorW(hijoW(rPr, 'highlight'))?.toLowerCase() ?? '';
    const resaltado = HIGHLIGHT_MAP[hl];
    const l = letraDe(rPr);
    const propiaFuente = !!l.fuente && l.fuente.toLowerCase() !== (base.fuente ?? '').toLowerCase();
    // Los títulos generados llevan base + 2 pt: no es un tamaño propio.
    const propioTam = !!l.tamanoPt && l.tamanoPt !== base.tamanoPt
        && !(estilo === 'titulo' && l.tamanoPt === (base.tamanoPt ?? 0) + 2);
    return {
        negrita: activa('b'),
        cursiva: activa('i'),
        subrayado: !!u && (valorW(u) ?? 'single').toLowerCase() !== 'none',
        ...(propiaFuente ? { fuente: l.fuente } : {}),
        ...(propioTam ? { tamanoPt: l.tamanoPt } : {}),
        ...(resaltado ? { resaltado } : {}),
    };
}

function piezasDe(p: Element, base: Letra, estilo: EstiloParrafo): Pieza[] {
    const piezas: Pieza[] = [];
    for (const r of Array.from(p.getElementsByTagNameNS(W, 'r'))) {
        if (ancestroW(r.parentNode, 'p') !== p) continue;
        const formato = formatoDe(r, base, estilo);
        let texto = '';
        const vaciar = () => {
            if (texto) piezas.push({ tipo: 'texto', texto, formato });
            texto = '';
        };
        for (const n of Array.from(r.childNodes)) {
            if (esW(n, 't')) texto += n.textContent ?? '';
            else if (esW(n, 'tab')) texto += '\t';
            else if (esW(n, 'cr')) texto += '\n';
            else if (esW(n, 'noBreakHyphen')) texto += '-';
            else if (esW(n, 'br')) {
                const tipoBr = n.getAttributeNS(W, 'type');
                if (tipoBr === 'page') {
                    vaciar();
                    piezas.push({ tipo: 'salto' });
                } else if (tipoBr === 'column') {
                    vaciar();
                    piezas.push({ tipo: 'columna' });
                } else texto += '\n';
            }
        }
        vaciar();
    }
    return piezas;
}

const mismoFormato = (a: Formato, b: Formato) =>
    a.negrita === b.negrita && a.cursiva === b.cursiva && a.subrayado === b.subrayado
    && a.fuente === b.fuente && a.tamanoPt === b.tamanoPt && a.resaltado === b.resaltado;

/** Une las corridas y reconstruye los marcadores {{…}} aunque Word los haya partido en varias. */
function aTramos(piezas: Pieza[]): Tramo[] {
    let texto = '';
    const formatos: Formato[] = [];
    for (const pz of piezas) {
        if (pz.tipo !== 'texto') continue;
        texto += pz.texto;
        for (let k = 0; k < pz.texto.length; k++) formatos.push(pz.formato);
    }

    const tramos: Tramo[] = [];
    let buf = '';
    let formatoBuf: Formato | null = null;
    const vaciar = () => {
        if (buf && formatoBuf) tramos.push({ texto: buf, ...formatoBuf, marcador: false });
        buf = '';
    };

    for (let i = 0; i < texto.length;) {
        if (texto.startsWith('{{', i)) {
            const fin = texto.indexOf('}}', i + 2);
            if (fin !== -1 && !texto.slice(i, fin).includes('\n')) {
                vaciar();
                tramos.push({ texto: normalizarCaracteres(texto.slice(i, fin + 2)), ...formatos[i], marcador: true });
                formatoBuf = null;
                i = fin + 2;
                continue;
            }
        }
        const f = formatos[i];
        if (formatoBuf && !mismoFormato(formatoBuf, f)) vaciar();
        formatoBuf = f;
        buf += texto[i];
        i += 1;
    }
    vaciar();
    return tramos;
}

interface Segmento { piezas: Pieza[]; antes: 'salto' | 'columna' | null }

function limpiarPrefijoLista(tramos: Tramo[]): { tramos: Tramo[]; lista?: TipoLista } {
    if (tramos.length === 0) return { tramos };
    const primero = tramos[0];
    if (primero.marcador) return { tramos };
    const mUl = /^(?:[•·▪◦]\s+|\uF0B7\s+)/.exec(primero.texto);
    if (mUl) {
        const resto = primero.texto.slice(mUl[0].length);
        const nuevos = resto ? [{ ...primero, texto: resto }, ...tramos.slice(1)] : tramos.slice(1);
        return { tramos: nuevos, lista: 'ul' };
    }
    const mOl = /^\d{1,3}\.\s+/.exec(primero.texto);
    if (mOl) {
        const resto = primero.texto.slice(mOl[0].length);
        const nuevos = resto ? [{ ...primero, texto: resto }, ...tramos.slice(1)] : tramos.slice(1);
        return { tramos: nuevos, lista: 'ol' };
    }
    return { tramos };
}

function bloquesDe(p: Element, base: Letra): Bloque[] {
    const pPr = hijoW(p, 'pPr');
    const idEstilo = (valorW(pPr ? hijoW(pPr, 'pStyle') : null) ?? '').replace(/[\s_-]/g, '');
    const estilo: EstiloParrafo = ESTILO_SUBTITULO.test(idEstilo) ? 'subtitulo' : ESTILO_TITULO.test(idEstilo) ? 'titulo' : 'normal';
    const jc = (valorW(pPr ? hijoW(pPr, 'jc') : null) ?? '').toLowerCase();
    const alineacion: Alineacion = ALINEACION[jc] ?? BASE[estilo];
    const tieneNumPr = Boolean(pPr && hijoW(pPr, 'numPr'));
    const ind = pPr ? hijoW(pPr, 'ind') : null;
    const tieneHanging = Boolean(ind && ind.getAttributeNS(W, 'hanging'));

    // Interlineado propio del párrafo (solo el proporcional: «automático»)
    const sp = pPr ? hijoW(pPr, 'spacing') : null;
    const linea = sp ? Number(sp.getAttributeNS(W, 'line')) : Number.NaN;
    const regla = (sp?.getAttributeNS(W, 'lineRule') || 'auto').toLowerCase();
    const interlineado = Number.isFinite(linea) && linea > 0 && regla === 'auto'
        ? Math.round((linea / 240) * 100) / 100
        : undefined;

    const salida: Bloque[] = [];
    const saltoAntes = pPr ? hijoW(pPr, 'pageBreakBefore') : null;
    if (saltoAntes && !apagado(valorW(saltoAntes))) salida.push({ tipo: 'salto' });

    const segmentos: Segmento[] = [{ piezas: [], antes: null }];
    for (const pz of piezasDe(p, base, estilo)) {
        if (pz.tipo === 'salto') {
            segmentos.push({ piezas: [], antes: 'salto' });
        } else if (pz.tipo === 'columna') {
            const ult = segmentos[segmentos.length - 1];
            if (ult.piezas.length === 0 && ult.antes === null) ult.antes = 'columna'; // al inicio del párrafo
            else segmentos.push({ piezas: [], antes: 'columna' });
        } else {
            segmentos[segmentos.length - 1].piezas.push(pz);
        }
    }
    segmentos.forEach((seg) => {
        if (seg.antes === 'salto') salida.push({ tipo: 'salto' });
        if (seg.piezas.length === 0 && segmentos.length > 1 && seg.antes !== 'columna') return;
        const tramosBase = aTramos(seg.piezas);
        const det = (tieneHanging || tieneNumPr) ? limpiarPrefijoLista(tramosBase) : { tramos: tramosBase };
        const lista = det.lista ?? (tieneNumPr ? 'ul' : undefined);
        const parrafo: BloqueParrafo = {
            tipo: 'parrafo', alineacion, estilo, tramos: det.tramos,
            ...(interlineado ? { interlineado } : {}),
            ...(seg.antes === 'columna' ? { nuevaColumna: true } : {}),
            ...(lista ? { lista } : {}),
        };
        salida.push(parrafo);
    });
    return salida;
}

function tablaDe(tbl: Element, base: Letra): BloqueTabla | null {
    const filas: CeldaTabla[][] = [];
    let encabezado = false;
    const trNodes = Array.from(tbl.childNodes).filter((n): n is Element => esW(n, 'tr'));
    trNodes.forEach((tr, rIdx) => {
        const trPr = hijoW(tr, 'trPr');
        if (rIdx === 0 && trPr && hijoW(trPr, 'tblHeader')) encabezado = true;
        const celdas: CeldaTabla[] = [];
        for (const tc of Array.from(tr.childNodes)) {
            if (!esW(tc, 'tc')) continue;
            const parrafos = Array.from(tc.getElementsByTagNameNS(W, 'p')).filter(
                (p) => ancestroW(p.parentNode, 'tc') === tc && !dentroDeFallback(p),
            );
            const piezas: Pieza[] = [];
            let alinCelda: Alineacion | undefined;
            parrafos.forEach((p, pIdx) => {
                if (pIdx > 0) piezas.push({ tipo: 'texto', texto: ' ', formato: { negrita: false, cursiva: false, subrayado: false } });
                const pPr = hijoW(p, 'pPr');
                const jc = (valorW(pPr ? hijoW(pPr, 'jc') : null) ?? '').toLowerCase();
                if (!alinCelda && ALINEACION[jc]) alinCelda = ALINEACION[jc];
                for (const pz of piezasDe(p, base, 'normal')) {
                    if (pz.tipo === 'texto') piezas.push(pz);
                }
            });
            celdas.push({
                tramos: aTramos(piezas),
                ...(alinCelda && alinCelda !== 'left' ? { alineacion: alinCelda } : {}),
            });
        }
        if (celdas.length > 0) filas.push(celdas);
    });
    if (filas.length === 0) return null;
    return { tipo: 'tabla', filas, ...(encabezado ? { encabezado: true } : {}) };
}

function columnasDe(sect: Element | null): number {
    const c = sect ? hijoW(sect, 'cols') : null;
    const n = c ? Number(c.getAttributeNS(W, 'num')) : 1;
    return Number.isFinite(n) && n > 1 ? 2 : 1;
}

function asignarColumnas(bloques: Bloque[], desde: number, n: number): void {
    if (n < 2) return;
    for (let k = desde; k < bloques.length; k++) {
        const b = bloques[k];
        if (b.tipo === 'parrafo') b.columnas = n;
    }
}

export class LectorDocxFflate implements LectorDocx {
    aBloques(docx: Uint8Array): Bloque[] {
        let partes: Record<string, Uint8Array>;
        try {
            partes = unzipSync(docx, { filter: (f) => f.name === 'word/document.xml' || f.name === 'word/styles.xml' });
        } catch {
            throw new ErrorDeDatos('El archivo no es un .docx válido');
        }
        const datos = partes['word/document.xml'];
        if (!datos) throw new ErrorDeDatos('El archivo no es un .docx válido');

        const xml = new DOMParser().parseFromString(strFromU8(datos), 'application/xml');
        if (xml.getElementsByTagName('parsererror').length > 0) throw new ErrorDeDatos('El documento tiene XML inválido');
        const estilos = partes['word/styles.xml']
            ? new DOMParser().parseFromString(strFromU8(partes['word/styles.xml']), 'application/xml')
            : null;
        const base = letraBase(estilos && estilos.getElementsByTagName('parsererror').length === 0 ? estilos : null);

        const bloques: Bloque[] = [];
        let desde = 0; // primer bloque de la sección en curso
        const cuerpo = xml.getElementsByTagNameNS(W, 'body')[0];
        const recorrerNodos = (contenedor: Element) => {
            for (const n of Array.from(contenedor.childNodes)) {
                if (dentroDeFallback(n)) continue;
                if (esW(n, 'tbl')) {
                    const t = tablaDe(n, base);
                    if (t) bloques.push(t);
                    continue;
                }
                if (esW(n, 'p')) {
                    const nuevos = bloquesDe(n, base);
                    const pPr = hijoW(n, 'pPr');
                    const sect = pPr ? hijoW(pPr, 'sectPr') : null;
                    if (!sect) {
                        bloques.push(...nuevos);
                        continue;
                    }
                    // Este párrafo cierra una sección. Si está vacío solo era el portador del salto de sección.
                    const vacio = nuevos.every((b) => b.tipo === 'parrafo' && b.tramos.length === 0);
                    if (!vacio) bloques.push(...nuevos);
                    asignarColumnas(bloques, desde, columnasDe(sect));
                    desde = bloques.length;
                    continue;
                }
                if (n.nodeType === 1) recorrerNodos(n as Element);
            }
        };
        if (cuerpo) recorrerNodos(cuerpo);
        asignarColumnas(bloques, desde, columnasDe(cuerpo ? hijoW(cuerpo, 'sectPr') : null));

        while (bloques.length > 0) {
            const ultimo = bloques[bloques.length - 1];
            if (ultimo.tipo === 'parrafo' && ultimo.tramos.length === 0) bloques.pop();
            else break;
        }
        return bloques;
    }
}