const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function nuevoId(ahora: number = Date.now()): string {
    let t = ahora;
    let tiempo = '';
    for (let i = 0; i < 10; i++) {
        tiempo = ALFABETO[t % 32] + tiempo;
        t = Math.floor(t / 32);
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    let aleatorio = '';
    for (let i = 0; i < 16; i++) aleatorio += ALFABETO[bytes[i] & 31];
    return tiempo + aleatorio;
}