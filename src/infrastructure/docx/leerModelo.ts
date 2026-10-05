import { strFromU8, unzipSync } from 'fflate';
import type { LectorDocx } from '../../application/puertos/modelos';
import { ErrorDeDatos } from '../../domain/errores';
import type { Alineacion, Bloque, BloqueParrafo, EstiloParrafo, Tramo } from '../../domain/fuenteModelo';
import { normalizarCaracteres } from './gramatica';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

interface Formato { negrita: boolean; cursiva: boolean; subrayado: boolean }
type Pieza = { tipo: 'texto'; texto: string; formato: Formato } | { tipo: 'salto' };

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

function formatoDe(r: Element): Formato {
    const rPr = hijoW(r, 'rPr');
    if (!rPr) return { negrita: false, cursiva: false, subrayado: false };
    const activa = (nombre: string) => {
        const el = hijoW(rPr, nombre);
        return !!el && !apagado(valorW(el));
    };
    const u = hijoW(rPr, 'u');
    return { negrita: activa('b'), cursiva: activa('i'), subrayado: !!u && (valorW(u) ?? 'single').toLowerCase() !== 'none' };
}

function piezasDe(p: Element): Pieza[] {
    const piezas: Pieza[] = [];
    for (const r of Array.from(p.getElementsByTagNameNS(W, 'r'))) {
        if (ancestroW(r.parentNode, 'p') !== p) continue;
        const formato = formatoDe(r);
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
                if (n.getAttributeNS(W, 'type') === 'page') {
                    vaciar();
                    piezas.push({ tipo: 'salto' });
                } else texto += '\n';
            }
        }
        vaciar();
    }
    return piezas;
}

const mismoFormato = (a: Formato, b: Formato) =>
    a.negrita === b.negrita && a.cursiva === b.cursiva && a.subrayado === b.subrayado;

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

function bloquesDe(p: Element): Bloque[] {
    const pPr = hijoW(p, 'pPr');
    const idEstilo = (valorW(pPr ? hijoW(pPr, 'pStyle') : null) ?? '').replace(/[\s_-]/g, '');
    const estilo: EstiloParrafo = ESTILO_SUBTITULO.test(idEstilo) ? 'subtitulo' : ESTILO_TITULO.test(idEstilo) ? 'titulo' : 'normal';
    const jc = (valorW(pPr ? hijoW(pPr, 'jc') : null) ?? '').toLowerCase();
    const alineacion: Alineacion = ALINEACION[jc] ?? BASE[estilo];

    const salida: Bloque[] = [];
    const saltoAntes = pPr ? hijoW(pPr, 'pageBreakBefore') : null;
    if (saltoAntes && !apagado(valorW(saltoAntes))) salida.push({ tipo: 'salto' });

    const segmentos: Pieza[][] = [[]];
    for (const pz of piezasDe(p)) {
        if (pz.tipo === 'salto') segmentos.push([]);
        else segmentos[segmentos.length - 1].push(pz);
    }
    segmentos.forEach((seg, i) => {
        if (i > 0) salida.push({ tipo: 'salto' });
        if (seg.length === 0 && segmentos.length > 1) return;
        const parrafo: BloqueParrafo = { tipo: 'parrafo', alineacion, estilo, tramos: aTramos(seg) };
        salida.push(parrafo);
    });
    return salida;
}

/** Lectura simplificada: solo el cuerpo del documento. Se pierden encabezados, pies, tablas (cada celda queda como línea) e imágenes. */
export class LectorDocxFflate implements LectorDocx {
    aBloques(docx: Uint8Array): Bloque[] {
        let partes: Record<string, Uint8Array>;
        try {
            partes = unzipSync(docx, { filter: (f) => f.name === 'word/document.xml' });
        } catch {
            throw new ErrorDeDatos('El archivo no es un .docx válido');
        }
        const datos = partes['word/document.xml'];
        if (!datos) throw new ErrorDeDatos('El archivo no es un .docx válido');

        const xml = new DOMParser().parseFromString(strFromU8(datos), 'application/xml');
        if (xml.getElementsByTagName('parsererror').length > 0) throw new ErrorDeDatos('El documento tiene XML inválido');

        const bloques: Bloque[] = [];
        for (const p of Array.from(xml.getElementsByTagNameNS(W, 'p'))) {
            if (dentroDeFallback(p)) continue;
            bloques.push(...bloquesDe(p));
        }
        while (bloques.length > 0) {
            const ultimo = bloques[bloques.length - 1];
            if (ultimo.tipo === 'parrafo' && ultimo.tramos.length === 0) bloques.pop();
            else break;
        }
        return bloques;
    }
}