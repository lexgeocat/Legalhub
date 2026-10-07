/*
 * Lleva al modelo los cambios hechos a mano en un documento ya completado.
 *
 * Para saber de qué línea del modelo sale cada párrafo se genera una copia «marcada» del modelo
 * (cada línea con campos lleva su número y cada campo queda entre marcas invisibles), se completa con
 * los mismos datos y se lee el resultado: cada párrafo dice de qué línea salió y qué valor puso cada campo.
 */

const ABRE = '\u27E6';
const CIERRA = '\u27E7';

const PREFIJOS = '(?:\\[(?:c|d|i|j)\\]\\s?|#{1,2}\\s+){0,2}';
const RE_PREFIJO = new RegExp(`^(${PREFIJOS})`, 'i');
const RE_ORIGEN = new RegExp(`^${PREFIJOS}(?:\\*{1,3}|\\+\\+)*${ABRE}(\\d+)${CIERRA}`, 'i');
const RE_MARCA = new RegExp(`${ABRE}(\\d+|<|>)${CIERRA}`, 'g');
const MARCADOR = /\{\{[\s\S]*?\}\}/g;

const esSoloBloque = (l: string) => /^\s*\{\{\s*[#/][^}]*\}\}\s*$/.test(l);
const tieneBloque = (l: string) => /\{\{\s*[#/]/.test(l);

export const normalizar = (s: string): string => s.replace(/[\u200B\uFEFF]/g, '').replace(/\s+/g, ' ').trim();

const lineasNormalizadas = (t: string): string[] => {
    const l = t.split('\n').map(normalizar);
    while (l.length > 0 && l[l.length - 1] === '') l.pop();
    return l;
};

/** ¿Dos textos (formato del editor) dicen lo mismo, sin contar espacios sobrantes ni líneas vacías al final? */
export function mismoTexto(a: string, b: string): boolean {
    const x = lineasNormalizadas(a);
    const y = lineasNormalizadas(b);
    return x.length === y.length && x.every((v, i) => v === y[i]);
}

/* ---------------- Modelo marcado ---------------- */

/** Devuelve el texto del modelo con marcas: `⟦n⟧` al inicio de cada línea y `⟦<⟧{{campo}}⟦>⟧` en cada campo. */
export function marcarModelo(lineas: readonly string[]): string {
    return lineas
        .map((l, i) => {
            if (l.trim() === '===' || tieneBloque(l)) return l;
            const prefijo = RE_PREFIJO.exec(l)?.[1] ?? '';
            const resto = l
                .slice(prefijo.length)
                .replace(MARCADOR, (m) => `${ABRE}<${CIERRA}${m}${ABRE}>${CIERRA}`);
            return `${prefijo}${ABRE}${i}${CIERRA}${resto}`;
        })
        .join('\n');
}

export interface LineaTrazada {
    /** Línea del modelo de la que salió el párrafo (null si no se puede rastrear). */
    origen: number | null;
    /** El párrafo sin marcas. */
    limpia: string;
    /** Dónde quedó el valor de cada campo dentro de `limpia`: [inicio, fin). */
    spans: [number, number][];
}

/** Lee las líneas del documento completado a partir del modelo marcado. */
export function leerTraza(lineas: readonly string[]): LineaTrazada[] {
    return lineas.map((l) => {
        const m = RE_ORIGEN.exec(l);
        let limpia = '';
        const spans: [number, number][] = [];
        let ini = -1;
        let ult = 0;
        for (const t of l.matchAll(RE_MARCA)) {
            const pos = t.index ?? 0;
            limpia += l.slice(ult, pos);
            ult = pos + t[0].length;
            if (t[1] === '<') ini = limpia.length;
            else if (t[1] === '>') {
                if (ini >= 0) spans.push([ini, limpia.length]);
                ini = -1;
            }
        }
        limpia += l.slice(ult);
        return { origen: m ? Number(m[1]) : null, limpia, spans };
    });
}

/* ---------------- Diferencias entre dos textos ---------------- */

/** base[a..b) pasó a ser editado[c..d). */
export interface Diferencia { a: number; b: number; c: number; d: number }

export function diferencias(base: readonly string[], editado: readonly string[]): Diferencia[] {
    const A = base.map(normalizar);
    const B = editado.map(normalizar);
    let p = 0;
    while (p < A.length && p < B.length && A[p] === B[p]) p++;
    let s = 0;
    while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
    const n = A.length - p - s;
    const m = B.length - p - s;
    if (n === 0 && m === 0) return [];
    if (n === 0 || m === 0 || n * m > 4_000_000) return [{ a: p, b: p + n, c: p, d: p + m }];

    const w = m + 1;
    const t = new Uint16Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            t[i * w + j] = A[p + i] === B[p + j]
                ? t[(i + 1) * w + j + 1] + 1
                : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
        }
    }

    const salida: Diferencia[] = [];
    let i = 0;
    let j = 0;
    let ha = -1;
    let hc = -1;
    const cerrar = () => {
        if (ha < 0) return;
        salida.push({ a: p + ha, b: p + i, c: p + hc, d: p + j });
        ha = -1;
        hc = -1;
    };
    while (i < n && j < m) {
        if (A[p + i] === B[p + j]) {
            cerrar();
            i++;
            j++;
            continue;
        }
        if (ha < 0) {
            ha = i;
            hc = j;
        }
        if (t[(i + 1) * w + j] >= t[i * w + j + 1]) i++;
        else j++;
    }
    if (i < n || j < m) {
        if (ha < 0) {
            ha = i;
            hc = j;
        }
        i = n;
        j = m;
    }
    cerrar();
    return salida;
}

/* ---------------- Propuesta de cambios al modelo ---------------- */

export interface CambioModelo {
    id: string;
    tipo: 'editar' | 'insertar' | 'eliminar';
    /** editar / eliminar: línea del modelo. insertar: línea ANTES de la cual se agrega. */
    linea: number;
    antes: string[];
    despues: string[];
    /** La línea está dentro de un bloque (se repite o es condicional): el cambio afecta a todos los casos. */
    enBloque: boolean;
    /** El texto nuevo trae datos de este caso (se guardarían fijos en el modelo). */
    conDatos: boolean;
}

export interface NoPropagable { texto: string; motivo: string }
export interface AnalisisModelo { cambios: CambioModelo[]; descartes: NoPropagable[] }

export interface EntradaCambios {
    modelo: readonly string[];
    trazadas: readonly LineaTrazada[];
    base: readonly string[];
    editado: readonly string[];
    /** Valores que el modelo insertó en el documento (para detectar datos del caso). */
    datos: readonly string[];
}

interface Estructura { ini: number[]; fin: number[]; dentro: boolean[] }

function estructuraDeBloques(modelo: readonly string[]): Estructura {
    const ini = modelo.map((_, i) => i);
    const fin = modelo.map((_, i) => i);
    const pila: number[] = [];
    modelo.forEach((l, i) => {
        if (!esSoloBloque(l)) return;
        if (/^\s*\{\{\s*#/.test(l)) {
            pila.push(i);
            return;
        }
        const a = pila.pop();
        if (a !== undefined && pila.length === 0) {
            for (let k = a; k <= i; k++) {
                ini[k] = a;
                fin[k] = i;
            }
        }
    });
    return { ini, fin, dentro: modelo.map((_, i) => ini[i] !== i || fin[i] !== i) };
}

const resumen = (s: string): string => {
    const t = s.replace(/\u2028/g, ' ').replace(/\*\*|\+\+/g, '').trim();
    if (t === '') return '(párrafo vacío)';
    return t.length > 80 ? `${t.slice(0, 80)}…` : t;
};

const MOTIVO_SIN_ORIGEN = 'No sale de una línea simple del modelo (salto de página o línea con bloque): cámbialo en el modelo.';
const MOTIVO_DATO = 'Toca un dato que el modelo completa solo (nombre, C.I., fecha, monto…) o lo editaste en varias partes: cámbialo en el modelo.';
const MOTIVO_BLOQUE = 'Está dentro de un bloque que se repite o es condicional: quitarlo del modelo lo quitaría en todos los casos.';
const MOTIVO_CONFLICTO = 'La línea se repite y la editaste distinto en cada repetición.';

function traeDatos(lineas: readonly string[], datos: readonly string[]): boolean {
    const plano = lineas.join('\n').replace(/\\(.)/g, '$1').replace(/\u2028/g, ' ');
    return datos.some((v) => {
        const t = v.trim();
        return t.length >= 4 && plano.includes(t);
    });
}

/**
 * Devuelve la línea del modelo con los campos puestos de nuevo en el texto editado,
 * o null si el cambio toca el valor de un campo (o no se puede ubicar).
 */
function sustituirCampos(lineaModelo: string, t: LineaTrazada, editada: string): string | null {
    const marcadores = [...lineaModelo.matchAll(MARCADOR)].map((m) => m[0]);
    if (marcadores.length !== t.spans.length) return null;
    if (marcadores.length === 0) return editada;

    const A = t.limpia;
    let p = 0;
    while (p < A.length && p < editada.length && A[p] === editada[p]) p++;
    let s = 0;
    while (s < A.length - p && s < editada.length - p && A[A.length - 1 - s] === editada[editada.length - 1 - s]) s++;
    /** Posición en el texto editado de un punto del original, si cae fuera de la zona modificada. */
    const enEditada = (q: number): number | null => {
        if (q <= p) return q;
        if (q >= A.length - s) return editada.length - (A.length - q);
        return null;
    };

    const sitios: [number, number][] = [];
    let cursor = 0;
    for (const [a, b] of t.spans) {
        const v = A.slice(a, b);
        const previsto = enEditada(a);
        let ini: number;
        if (v === '') {
            if (previsto === null || previsto < cursor) return null;
            ini = previsto;
        } else if (previsto !== null && previsto >= cursor && editada.startsWith(v, previsto)) {
            ini = previsto;
        } else {
            ini = editada.indexOf(v, cursor);
            if (ini < 0) return null;
        }
        sitios.push([ini, ini + v.length]);
        cursor = ini + v.length;
    }

    let salida = '';
    let pos = 0;
    sitios.forEach(([ini, fin], k) => {
        salida += editada.slice(pos, ini) + marcadores[k];
        pos = fin;
    });
    return salida + editada.slice(pos);
}

/** Índice del modelo ANTES del cual se agrega un párrafo nuevo (prev / sig: párrafos vecinos del documento). */
function lugarDeInsercion(prev: number, sig: number, trazadas: readonly LineaTrazada[], est: Estructura, total: number): number {
    const origen = (k: number) => (k >= 0 && k < trazadas.length ? trazadas[k].origen : null);
    const p = origen(prev);
    if (p !== null) return est.fin[p] + 1;
    const s = origen(sig);
    if (s !== null) return est.ini[s];
    for (let k = prev - 1; k >= 0; k--) {
        const o = origen(k);
        if (o !== null) return est.fin[o] + 1;
    }
    for (let k = sig + 1; k < trazadas.length; k++) {
        const o = origen(k);
        if (o !== null) return est.ini[o];
    }
    return total;
}

export function proponerCambios(e: EntradaCambios): AnalisisModelo {
    const { modelo, trazadas, base, editado } = e;
    const est = estructuraDeBloques(modelo);
    const veces = new Map<number, number>();
    for (const t of trazadas) if (t.origen !== null) veces.set(t.origen, (veces.get(t.origen) ?? 0) + 1);

    const cambios: CambioModelo[] = [];
    const descartes: NoPropagable[] = [];
    const porLinea = new Map<number, CambioModelo>();
    const conflictos = new Set<number>();
    const descartar = (o: number, motivo: string) => descartes.push({ texto: resumen(base[o] ?? ''), motivo });

    for (const h of diferencias(base, editado)) {
        const nBase = h.b - h.a;
        const nEdit = h.d - h.c;
        const pares = Math.min(nBase, nEdit);

        // Párrafos que cambiaron
        for (let k = 0; k < pares; k++) {
            const o = h.a + k;
            const t = trazadas[o];
            if (!t || t.origen === null) {
                descartar(o, MOTIVO_SIN_ORIGEN);
                continue;
            }
            const i = t.origen;
            const nueva = sustituirCampos(modelo[i], t, editado[h.c + k]);
            if (nueva === null) {
                descartar(o, MOTIVO_DATO);
                continue;
            }
            if (nueva === modelo[i]) continue;
            const previo = porLinea.get(i);
            if (previo) {
                if (previo.despues[0] !== nueva) conflictos.add(i);
                continue;
            }
            const c: CambioModelo = {
                id: `e${i}`, tipo: 'editar', linea: i, antes: [modelo[i]], despues: [nueva],
                enBloque: est.dentro[i], conDatos: traeDatos([nueva], e.datos),
            };
            porLinea.set(i, c);
            cambios.push(c);
        }

        // Párrafos que quitaste
        for (let k = pares; k < nBase; k++) {
            const o = h.a + k;
            const t = trazadas[o];
            if (!t || t.origen === null) {
                descartar(o, MOTIVO_SIN_ORIGEN);
                continue;
            }
            const i = t.origen;
            if (est.dentro[i] || (veces.get(i) ?? 0) > 1) {
                descartar(o, MOTIVO_BLOQUE);
                continue;
            }
            if (porLinea.has(i)) continue;
            const c: CambioModelo = {
                id: `x${i}`, tipo: 'eliminar', linea: i, antes: [modelo[i]], despues: [],
                enBloque: false, conDatos: false,
            };
            porLinea.set(i, c);
            cambios.push(c);
        }

        // Párrafos que agregaste
        if (nEdit > pares) {
            const nuevas = editado.slice(h.c + pares, h.d);
            cambios.push({
                id: `i${cambios.length}`, tipo: 'insertar',
                linea: lugarDeInsercion(h.a + pares - 1, h.b, trazadas, est, modelo.length),
                antes: [], despues: [...nuevas], enBloque: false, conDatos: traeDatos(nuevas, e.datos),
            });
        }
    }

    for (const i of conflictos) descartes.push({ texto: resumen(modelo[i]), motivo: MOTIVO_CONFLICTO });
    return {
        cambios: cambios.filter((c) => c.tipo === 'insertar' || !conflictos.has(c.linea)),
        descartes,
    };
}

/** Aplica los cambios elegidos a las líneas del modelo. */
export function aplicarCambios(modelo: readonly string[], cambios: readonly CambioModelo[]): string[] {
    const reemplazos = new Map<number, string[]>();
    const antes = new Map<number, string[]>();
    for (const c of cambios) {
        if (c.tipo === 'insertar') antes.set(c.linea, [...(antes.get(c.linea) ?? []), ...c.despues]);
        else reemplazos.set(c.linea, c.despues);
    }
    const salida: string[] = [];
    for (let i = 0; i <= modelo.length; i++) {
        salida.push(...(antes.get(i) ?? []));
        if (i < modelo.length) salida.push(...(reemplazos.get(i) ?? [modelo[i]]));
    }
    return salida;
}