import type { LectorPdf } from '../../application/puertos/pdf';
import { ErrorDeDatos } from '../../domain/errores';
import { getDocument, type PDFDocumentProxy } from './pdfjs';

interface Trozo { str: string; x: number; y: number; w: number; h: number }

/** Junta los fragmentos de texto de pdf.js en líneas (misma altura Y = misma línea). */
export function agruparLineas(trozos: readonly Trozo[]): string[] {
    const lineas: string[] = [];
    let actual = '';
    let yActual = Number.NaN;
    let xFin = 0;
    const cerrar = () => {
        const t = actual.replace(/\s+/g, ' ').trim();
        if (t) lineas.push(t);
        actual = '';
    };
    for (const t of trozos) {
        if (t.str === '') continue;
        if (Number.isNaN(yActual) || Math.abs(t.y - yActual) > Math.max(2, t.h * 0.5)) {
            cerrar();
            yActual = t.y;
            actual = t.str;
        } else {
            const pegado = actual.endsWith(' ') || t.str.startsWith(' ');
            actual += (!pegado && t.x - xFin > Math.max(1, t.h * 0.15) ? ' ' : '') + t.str;
        }
        xFin = t.x + t.w;
    }
    cerrar();
    return lineas;
}

export class LectorPdfPdfjs implements LectorPdf {
    async extraerLineas(bytes: Uint8Array): Promise<string[][]> {
        // pdf.js se queda con el buffer: se le pasa una copia.
        const tarea = getDocument({ data: bytes.slice() });
        let doc: PDFDocumentProxy;
        try {
            doc = await tarea.promise;
        } catch {
            await tarea.destroy();
            throw new ErrorDeDatos('El archivo no es un PDF válido (o está protegido con contraseña)');
        }
        try {
            const salida: string[][] = [];
            for (let i = 1; i <= doc.numPages; i++) {
                const pagina = await doc.getPage(i);
                const contenido = await pagina.getTextContent();
                const trozos: Trozo[] = [];
                for (const it of contenido.items) {
                    if (!('str' in it)) continue;
                    trozos.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height });
                }
                salida.push(agruparLineas(trozos));
                pagina.cleanup();
            }
            return salida;
        } finally {
            await tarea.destroy();
        }
    }
}