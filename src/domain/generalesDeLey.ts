const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los']);

export function partirNombre(completo: string): { nombres?: string; apellidoPaterno?: string; apellidoMaterno?: string } {
    const unidas: string[] = [];
    let prefijo = '';
    for (const p of completo.split(/\s+/).filter(Boolean)) {
        if (PARTICULAS.has(p.toLowerCase()) && unidas.length > 0) {
            prefijo += `${p} `;
            continue;
        }
        unidas.push(prefijo + p);
        prefijo = '';
    }
    if (prefijo) unidas.push(prefijo.trim());
    const n = unidas.length;
    if (n === 0) return {};
    if (n === 1) return { nombres: unidas[0] };
    if (n === 2) return { nombres: unidas[0], apellidoPaterno: unidas[1] };
    return { nombres: unidas.slice(0, n - 2).join(' '), apellidoPaterno: unidas[n - 2], apellidoMaterno: unidas[n - 1] };
}