import { strFromU8, unzipSync } from 'fflate';
import { ErrorDeDatos } from '../../domain/errores';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const PARTES = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;

export function textoPlano(docx: Uint8Array): string {
    let partes: Record<string, Uint8Array>;
    try {
        partes = unzipSync(docx, { filter: (f) => PARTES.test(f.name) });
    } catch {
        throw new ErrorDeDatos('El archivo no es un .docx válido');
    }
    if (!partes['word/document.xml']) throw new ErrorDeDatos('El archivo no es un .docx válido');

    const lineas: string[] = [];
    for (const datos of Object.values(partes)) {
        const xml = new DOMParser().parseFromString(strFromU8(datos), 'application/xml');
        for (const p of Array.from(xml.getElementsByTagNameNS(W, 'p'))) {
            const texto = Array.from(p.getElementsByTagNameNS(W, 't')).map((n) => n.textContent ?? '').join('');
            if (texto.trim()) lineas.push(texto);
        }
    }
    return lineas.join('\n');
}