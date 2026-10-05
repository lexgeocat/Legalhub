import { unzlibSync } from 'fflate';

const TAG_NAME = 0x6e616d65; // 'name'
const TAG_HEAD = 0x68656164; // 'head'

export interface NombreFuente {
    familia: string;
    negrita: boolean;
    cursiva: boolean;
}

function utf16be(s: string): Uint8Array {
    const b = new Uint8Array(s.length * 2);
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        b[2 * i] = c >> 8;
        b[2 * i + 1] = c & 0xff;
    }
    return b;
}

function suma(datos: Uint8Array): number {
    let s = 0;
    for (let i = 0; i < datos.length; i += 4) {
        const v = ((datos[i] ?? 0) << 24) | ((datos[i + 1] ?? 0) << 16) | ((datos[i + 2] ?? 0) << 8) | (datos[i + 3] ?? 0);
        s = (s + v) >>> 0;
    }
    return s;
}

/**
 * Tabla `name` con familia/estilo garantizados (Word enlaza la fuente incrustada por ese nombre).
 * Conserva derechos de autor y licencia del original (registros Windows/inglés).
 */
function construirName(original: Uint8Array | null, n: NombreFuente): Uint8Array {
    const sub = n.negrita ? (n.cursiva ? 'Bold Italic' : 'Bold') : n.cursiva ? 'Italic' : 'Regular';
    const propios = new Map<number, string>([
        [1, n.familia],
        [2, sub],
        [3, `${n.familia} ${sub}`],
        [4, `${n.familia} ${sub}`],
        [6, `${n.familia.replace(/\s+/g, '')}-${sub.replace(/\s+/g, '')}`],
    ]);
    const SUSTITUIDOS = new Set([16, 17, 21, 22, 25]);
    const registros: { id: number; datos: Uint8Array }[] = [];

    if (original && original.length >= 6) {
        const v = new DataView(original.buffer, original.byteOffset, original.byteLength);
        const cuenta = v.getUint16(2);
        const almacen = v.getUint16(4);
        for (let i = 0; i < cuenta; i++) {
            const o = 6 + i * 12;
            if (o + 12 > original.length) break;
            const plataforma = v.getUint16(o);
            const codificacion = v.getUint16(o + 2);
            const idioma = v.getUint16(o + 4);
            const id = v.getUint16(o + 6);
            const largo = v.getUint16(o + 8);
            const desde = v.getUint16(o + 10);
            if (plataforma !== 3 || codificacion !== 1 || idioma !== 0x409) continue;
            if (propios.has(id) || SUSTITUIDOS.has(id)) continue;
            if (almacen + desde + largo > original.length) continue;
            registros.push({ id, datos: original.slice(almacen + desde, almacen + desde + largo) });
        }
    }
    for (const [id, s] of propios) registros.push({ id, datos: utf16be(s) });
    registros.sort((a, b) => a.id - b.id);

    const cab = 6 + registros.length * 12;
    let total = cab;
    for (const r of registros) total += r.datos.length;
    const out = new Uint8Array(total);
    const dv = new DataView(out.buffer);
    dv.setUint16(0, 0);
    dv.setUint16(2, registros.length);
    dv.setUint16(4, cab);
    let pos = 0;
    registros.forEach((r, i) => {
        const o = 6 + i * 12;
        dv.setUint16(o, 3);
        dv.setUint16(o + 2, 1);
        dv.setUint16(o + 4, 0x409);
        dv.setUint16(o + 6, r.id);
        dv.setUint16(o + 8, r.datos.length);
        dv.setUint16(o + 10, pos);
        out.set(r.datos, cab + pos);
        pos += r.datos.length;
    });
    return out;
}

/** WOFF 1 → TrueType (sfnt). Con `nombre` reescribe la tabla `name`. */
export function woffATtf(woff: Uint8Array, nombre?: NombreFuente): Uint8Array {
    if (woff.length < 44) throw new Error('Archivo WOFF inválido');
    const v = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
    if (v.getUint32(0) !== 0x774f4646) throw new Error('Archivo WOFF inválido');
    const flavor = v.getUint32(4);
    const n = v.getUint16(12);

    const tablas: { tag: number; datos: Uint8Array; sum: number }[] = [];
    for (let i = 0; i < n; i++) {
        const o = 44 + i * 20;
        const tag = v.getUint32(o);
        const desde = v.getUint32(o + 4);
        const comp = v.getUint32(o + 8);
        const orig = v.getUint32(o + 12);
        const sum = v.getUint32(o + 16);
        const bruto = woff.subarray(desde, desde + comp);
        const datos = comp < orig ? unzlibSync(bruto) : bruto;
        if (datos.length !== orig) throw new Error('Tabla WOFF dañada');
        tablas.push({ tag, datos, sum });
    }

    if (nombre) {
        const i = tablas.findIndex((t) => t.tag === TAG_NAME);
        const nuevo = construirName(i >= 0 ? tablas[i].datos : null, nombre);
        const t = { tag: TAG_NAME, datos: nuevo, sum: suma(nuevo) };
        if (i >= 0) tablas[i] = t;
        else {
            tablas.push(t);
            tablas.sort((a, b) => a.tag - b.tag);
        }
    }

    const nt = tablas.length;
    let total = 12 + nt * 16;
    for (const t of tablas) total += (t.datos.length + 3) & ~3;
    const out = new Uint8Array(total);
    const dv = new DataView(out.buffer);

    let pot = 1;
    let log2 = 0;
    while (pot * 2 <= nt) {
        pot *= 2;
        log2 += 1;
    }
    dv.setUint32(0, flavor);
    dv.setUint16(4, nt);
    dv.setUint16(6, pot * 16);
    dv.setUint16(8, log2);
    dv.setUint16(10, nt * 16 - pot * 16);

    let pos = 12 + nt * 16;
    let posHead = -1;
    tablas.forEach((t, i) => {
        const e = 12 + i * 16;
        dv.setUint32(e, t.tag);
        dv.setUint32(e + 4, t.sum);
        dv.setUint32(e + 8, pos);
        dv.setUint32(e + 12, t.datos.length);
        out.set(t.datos, pos);
        if (t.tag === TAG_HEAD) posHead = pos;
        pos += (t.datos.length + 3) & ~3;
    });

    if (posHead >= 0 && out.length >= posHead + 12) {
        dv.setUint32(posHead + 8, 0);
        dv.setUint32(posHead + 8, (0xb1b0afba - suma(out)) >>> 0);
    }
    return out;
}