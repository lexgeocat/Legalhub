const RESERVADOS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function nombreSeguro(texto: string, maxLargo = 80): string {
    let n = texto
        .normalize('NFC')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/, '');
    if (!n) n = 'Documento';
    if (RESERVADOS.test(n.split('.')[0])) n = `_${n}`;
    n = n.slice(0, maxLargo).replace(/[. ]+$/, '');
    return n || 'Documento';
}