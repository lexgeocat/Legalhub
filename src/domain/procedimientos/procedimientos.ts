import { ErrorDeDatos } from '../comun/errores';
import { nuevoId } from '../comun/id';
import { claveNormalizada } from '../comun/texto';

/* ================= Requisitos ================= */
export const FORMATOS_REQUISITO = [
    { valor: '', etiqueta: 'Sin especificar' },
    { valor: 'original', etiqueta: 'Original' },
    { valor: 'fotocopia', etiqueta: 'Fotocopia simple' },
    { valor: 'legalizada', etiqueta: 'Fotocopia legalizada' },
    { valor: 'digital', etiqueta: 'Digital' },
] as const;
export type FormatoRequisito = (typeof FORMATOS_REQUISITO)[number]['valor'];
export const etiquetaFormato = (f: FormatoRequisito): string =>
    FORMATOS_REQUISITO.find((x) => x.valor === f)?.etiqueta ?? '';

export interface Requisito {
    id: string;
    /** «Del beneficiario», «Capacidad económica»… */
    grupo: string;
    nombre: string;
    detalle: string;
    /** Quién lo aporta (demandante, demandado, abogado…). */
    quien: string;
    formato: FormatoRequisito;
    /** Dónde se obtiene (Registro Cívico, empleador…). */
    donde: string;
    obligatorio: boolean;
}

/* ================= Flujo ================= */
export const TIPOS_PASO = ['inicio', 'accion', 'documento', 'decision', 'espera', 'fin'] as const;
export type TipoPaso = (typeof TIPOS_PASO)[number];
export const ETIQUETA_PASO: Record<TipoPaso, string> = {
    inicio: 'Inicio',
    accion: 'Actuación',
    documento: 'Escrito o documento',
    decision: 'Decisión',
    espera: 'Plazo o espera',
    fin: 'Fin',
};

export interface Salida { a: string; etiqueta: string }

export interface Paso {
    id: string;
    tipo: TipoPaso;
    titulo: string;
    detalle: string;
    /** Define el carril del flujograma. */
    responsable: string;
    plazo: string;
    baseLegal: string;
    /** Ids de los requisitos que se necesitan en este paso. */
    requisitos: string[];
    siguientes: Salida[];
}

export interface Flujo {
    /** Orden de los carriles (izquierda → derecha). Los que no figuren van después, por orden de aparición. */
    carriles: string[];
    pasos: Paso[];
}

export interface Procedimiento {
    id: string;
    nombre: string;
    materia: string;
    descripcion: string;
    baseLegal: string;
    requisitos: Requisito[];
    flujo: Flujo;
    creadoEn: string;
    actualizadoEn: string;
}

export type DatosProcedimiento = Pick<Procedimiento, 'nombre' | 'materia' | 'descripcion' | 'baseLegal' | 'requisitos' | 'flujo'>;

export interface ProcedimientoResumen {
    id: string;
    nombre: string;
    materia: string;
    descripcion: string;
    baseLegal: string;
    numRequisitos: number;
    numPasos: number;
    actualizadoEn: string;
}

/* ================= Lectura y limpieza ================= */
const txt = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const esObjeto = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

export function leerRequisitos(v: unknown): Requisito[] {
    if (!Array.isArray(v)) return [];
    const ids = new Set<string>();
    const salida: Requisito[] = [];
    for (const x of v) {
        if (!esObjeto(x)) continue;
        const nombre = txt(x.nombre);
        if (!nombre) continue;
        let id = txt(x.id);
        if (!id || ids.has(id)) id = nuevoId();
        ids.add(id);
        const formato = FORMATOS_REQUISITO.some((f) => f.valor === x.formato) ? (x.formato as FormatoRequisito) : '';
        salida.push({
            id, grupo: txt(x.grupo), nombre, detalle: txt(x.detalle), quien: txt(x.quien),
            formato, donde: txt(x.donde), obligatorio: x.obligatorio !== false,
        });
    }
    return salida;
}

export function leerFlujo(v: unknown, requisitos: readonly Requisito[] = []): Flujo {
    const o: Record<string, unknown> = esObjeto(v) ? v : {};
    const crudos = Array.isArray(o.pasos) ? o.pasos.filter(esObjeto) : [];
    const ids = new Set<string>();
    const pares = crudos.map((x): [Paso, Record<string, unknown>] => {
        let id = txt(x.id);
        if (!id || ids.has(id)) id = nuevoId();
        ids.add(id);
        const tipo = TIPOS_PASO.find((k) => k === x.tipo) ?? 'accion';
        return [{
            id, tipo, titulo: txt(x.titulo) || ETIQUETA_PASO[tipo], detalle: txt(x.detalle),
            responsable: txt(x.responsable), plazo: txt(x.plazo), baseLegal: txt(x.baseLegal),
            requisitos: [], siguientes: [],
        }, x];
    });

    const validos = new Set(pares.map(([p]) => p.id));
    const reqs = new Set(requisitos.map((r) => r.id));
    for (const [p, x] of pares) {
        for (const s of Array.isArray(x.siguientes) ? x.siguientes : []) {
            if (!esObjeto(s)) continue;
            const a = txt(s.a);
            if (!validos.has(a) || a === p.id || p.siguientes.some((e) => e.a === a)) continue;
            p.siguientes.push({ a, etiqueta: txt(s.etiqueta) });
        }
        p.requisitos = [...new Set((Array.isArray(x.requisitos) ? x.requisitos : []).map(txt).filter((i) => reqs.has(i)))];
    }

    const carriles: string[] = [];
    for (const c of Array.isArray(o.carriles) ? o.carriles : []) {
        const n = txt(c);
        if (n && !carriles.some((x) => claveNormalizada(x) === claveNormalizada(n))) carriles.push(n);
    }
    return { carriles, pasos: pares.map(([p]) => p) };
}

export function normalizarProcedimiento(d: DatosProcedimiento): DatosProcedimiento {
    const nombre = d.nombre.trim();
    if (!nombre) throw new ErrorDeDatos('Falta el nombre del procedimiento');
    const requisitos = leerRequisitos(d.requisitos);
    return {
        nombre,
        materia: d.materia.trim(),
        descripcion: d.descripcion.trim(),
        baseLegal: d.baseLegal.trim(),
        requisitos,
        flujo: leerFlujo(d.flujo, requisitos),
    };
}

/** Ids nuevos para todo (copias y plantillas): evita que dos procedimientos compartan ids. */
export function renovarIds(d: DatosProcedimiento): DatosProcedimiento {
    const rq = new Map(d.requisitos.map((r) => [r.id, nuevoId()] as const));
    const ps = new Map(d.flujo.pasos.map((p) => [p.id, nuevoId()] as const));
    return {
        ...d,
        requisitos: d.requisitos.map((r) => ({ ...r, id: rq.get(r.id) as string })),
        flujo: {
            ...d.flujo,
            pasos: d.flujo.pasos.map((p) => ({
                ...p,
                id: ps.get(p.id) as string,
                requisitos: p.requisitos.map((i) => rq.get(i)).filter((i): i is string => !!i),
                siguientes: p.siguientes.flatMap((s) => {
                    const a = ps.get(s.a);
                    return a ? [{ ...s, a }] : [];
                }),
            })),
        },
    };
}

/* ================= Utilidades de edición ================= */
export function nuevoPaso(tipo: TipoPaso, titulo: string): Paso {
    return { id: nuevoId(), tipo, titulo, detalle: '', responsable: '', plazo: '', baseLegal: '', requisitos: [], siguientes: [] };
}

/** Inicio → Primera actuación → Fin. */
export function flujoBase(): Paso[] {
    const fin = nuevoPaso('fin', 'Fin');
    const medio = { ...nuevoPaso('accion', 'Primera actuación'), siguientes: [{ a: fin.id, etiqueta: '' }] };
    const inicio = { ...nuevoPaso('inicio', 'Inicio'), siguientes: [{ a: medio.id, etiqueta: '' }] };
    return [inicio, medio, fin];
}

export function sinPaso(pasos: readonly Paso[], id: string): Paso[] {
    return pasos.filter((p) => p.id !== id).map((p) => ({ ...p, siguientes: p.siguientes.filter((s) => s.a !== id) }));
}

export function sinRequisito(pasos: readonly Paso[], id: string): Paso[] {
    return pasos.map((p) => (p.requisitos.includes(id) ? { ...p, requisitos: p.requisitos.filter((r) => r !== id) } : p));
}

export function agruparRequisitos(lista: readonly Requisito[]): { grupo: string; items: Requisito[] }[] {
    const m = new Map<string, { grupo: string; items: Requisito[] }>();
    for (const r of lista) {
        const k = claveNormalizada(r.grupo);
        const g = m.get(k);
        if (g) g.items.push(r);
        else m.set(k, { grupo: r.grupo, items: [r] });
    }
    return [...m.values()];
}

/** Lista de requisitos como texto para enviar al cliente (lo que está en `omitir` ya se recibió). */
export function textoRequisitos(nombre: string, lista: readonly Requisito[], omitir: ReadonlySet<string> = new Set()): string {
    const faltan = lista.filter((r) => !omitir.has(r.id));
    const lineas = [`REQUISITOS · ${nombre}`];
    for (const g of agruparRequisitos(faltan)) {
        lineas.push('', (g.grupo || 'Otros').toUpperCase());
        for (const r of g.items) {
            const extra = [
                r.formato ? etiquetaFormato(r.formato) : '',
                r.quien ? `aporta: ${r.quien}` : '',
                r.donde ? `dónde: ${r.donde}` : '',
            ].filter(Boolean).join(' · ');
            lineas.push(`☐ ${r.nombre}${r.obligatorio ? '' : ' (opcional)'}${extra ? ` — ${extra}` : ''}`);
        }
    }
    return lineas.join('\n');
}

/** Recorta un título en varias líneas de `max` caracteres (para dibujarlo dentro de una figura). */
export function partirLineas(texto: string, max: number, maxLineas: number): string[] {
    const palabras = texto.trim().split(/\s+/).filter(Boolean);
    const lineas: string[] = [];
    let actual = '';
    for (const p of palabras) {
        const prueba = actual ? `${actual} ${p}` : p;
        if (!actual || prueba.length <= max) {
            actual = prueba;
        } else {
            lineas.push(actual);
            actual = p;
        }
    }
    if (actual) lineas.push(actual);
    const corta = (l: string) => (l.length > max ? `${l.slice(0, max - 1)}…` : l);
    const visibles = lineas.slice(0, maxLineas).map(corta);
    if (lineas.length > maxLineas) {
        const u = visibles[maxLineas - 1];
        visibles[maxLineas - 1] = u.endsWith('…') ? u : `${u.length >= max ? u.slice(0, max - 1) : u}…`;
    }
    return visibles;
}

/* ================= Revisión del flujo ================= */
export interface HallazgoFlujo { nivel: 'error' | 'aviso'; texto: string; pasoId?: string }

export function revisarFlujo(pasos: readonly Paso[]): HallazgoFlujo[] {
    const h: HallazgoFlujo[] = [];
    if (pasos.length === 0) return h;
    const inicios = pasos.filter((p) => p.tipo === 'inicio');
    if (inicios.length === 0) h.push({ nivel: 'error', texto: 'Falta un paso de «Inicio».' });
    if (inicios.length > 1) h.push({ nivel: 'aviso', texto: `Hay ${inicios.length} pasos de «Inicio»; normalmente es uno.` });
    if (!pasos.some((p) => p.tipo === 'fin')) h.push({ nivel: 'aviso', texto: 'Falta al menos un paso de «Fin».' });

    for (const p of pasos) {
        if (p.tipo === 'decision') {
            if (p.siguientes.length < 2) {
                h.push({ nivel: 'aviso', texto: `La decisión «${p.titulo}» necesita al menos dos salidas (Sí / No).`, pasoId: p.id });
            } else if (p.siguientes.some((s) => !s.etiqueta)) {
                h.push({ nivel: 'aviso', texto: `Pon etiqueta a las salidas de «${p.titulo}» (Sí, No, Observada…).`, pasoId: p.id });
            }
        } else if (p.tipo === 'fin') {
            if (p.siguientes.length > 0) h.push({ nivel: 'aviso', texto: `«${p.titulo}» es un fin y no debería tener salidas.`, pasoId: p.id });
        } else if (p.siguientes.length === 0) {
            h.push({ nivel: 'aviso', texto: `«${p.titulo}» no tiene salida: conéctalo con el paso siguiente.`, pasoId: p.id });
        }
    }

    if (inicios.length > 0) {
        const mapa = new Map(pasos.map((p) => [p.id, p] as const));
        const vistos = new Set<string>();
        const pila = inicios.map((p) => p.id);
        while (pila.length > 0) {
            const id = pila.pop() as string;
            if (vistos.has(id)) continue;
            vistos.add(id);
            for (const s of mapa.get(id)?.siguientes ?? []) pila.push(s.a);
        }
        for (const p of pasos) {
            if (!vistos.has(p.id)) h.push({ nivel: 'aviso', texto: `«${p.titulo}» no se alcanza desde el inicio.`, pasoId: p.id });
        }
    }
    return h;
}

/* ================= Disposición automática del flujograma ================= */
export const ANCHO_NODO = 200;
const ALTO_FILA = 128;
const SEP_X = 28;
const ALTO_NODO: Record<TipoPaso, number> = { inicio: 44, fin: 44, accion: 66, documento: 70, espera: 66, decision: 100 };

export interface PosPaso { id: string; x: number; y: number; w: number; h: number; carril: number; rango: number }
export interface Enlace { de: string; a: string; etiqueta: string; d: string; retorno: boolean; lx: number; ly: number }
export interface CarrilFlujo { nombre: string; x: number; w: number }
export interface DisposicionFlujo {
    ancho: number;
    alto: number;
    /** Alto de la franja con los nombres de los carriles (0 = sin franja). */
    cabecera: number;
    carriles: CarrilFlujo[];
    nodos: PosPaso[];
    enlaces: Enlace[];
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Polilínea con las esquinas redondeadas. */
function trazar(pts: [number, number][], radio = 9): string {
    let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const l1 = Math.hypot(x1 - x0, y1 - y0);
        const l2 = Math.hypot(x2 - x1, y2 - y1);
        const rr = Math.min(radio, l1 / 2, l2 / 2);
        if (rr < 1) {
            d += `L${r1(x1)} ${r1(y1)}`;
            continue;
        }
        const ax = x1 + ((x0 - x1) / l1) * rr;
        const ay = y1 + ((y0 - y1) / l1) * rr;
        const bx = x1 + ((x2 - x1) / l2) * rr;
        const by = y1 + ((y2 - y1) / l2) * rr;
        d += `L${r1(ax)} ${r1(ay)}Q${r1(x1)} ${r1(y1)} ${r1(bx)} ${r1(by)}`;
    }
    const f = pts[pts.length - 1];
    return `${d}L${r1(f[0])} ${r1(f[1])}`;
}

/**
 * Filas = pasos más lejanos del inicio; carriles = responsables.
 * Los lazos (p. ej. «Faltan documentos» → «Reunir requisitos») se dibujan como retornos por los costados.
 */
export function calcularFlujo(pasos: readonly Paso[], ordenCarriles: readonly string[] = []): DisposicionFlujo {
    const n = pasos.length;
    if (n === 0) return { ancho: 0, alto: 0, cabecera: 0, carriles: [], nodos: [], enlaces: [] };

    /* 1) Conexiones válidas, sin repetir */
    interface Arista { de: number; a: number; etiqueta: string; retorno: boolean }
    const indice = new Map(pasos.map((p, i) => [p.id, i] as const));
    const aristas: Arista[] = [];
    const repetidas = new Set<string>();
    pasos.forEach((p, i) => {
        for (const s of p.siguientes) {
            const j = indice.get(s.a);
            if (j === undefined || j === i || repetidas.has(`${i}>${j}`)) continue;
            repetidas.add(`${i}>${j}`);
            aristas.push({ de: i, a: j, etiqueta: s.etiqueta, retorno: false });
        }
    });
    const salientes: Arista[][] = pasos.map(() => []);
    for (const a of aristas) salientes[a.de].push(a);

    /* 2) Lazos: una conexión que vuelve a un paso aún abierto en la búsqueda es de retorno */
    const estado = new Array<number>(n).fill(0); // 0 sin ver · 1 en curso · 2 listo
    const visitar = (u: number): void => {
        estado[u] = 1;
        for (const a of salientes[u]) {
            if (estado[a.a] === 1) a.retorno = true;
            else if (estado[a.a] === 0) visitar(a.a);
        }
        estado[u] = 2;
    };
    const todos = Array.from({ length: n }, (_, i) => i);
    const raices = todos.filter((i) => pasos[i].tipo === 'inicio');
    for (const i of [...raices, ...todos]) if (estado[i] === 0) visitar(i);

    /* 3) Fila de cada paso (camino más largo desde el inicio) */
    const grado = new Array<number>(n).fill(0);
    const preds: number[][] = pasos.map(() => []);
    for (const a of aristas) {
        if (a.retorno) continue;
        grado[a.a] += 1;
        preds[a.a].push(a.de);
    }
    const rango = new Array<number>(n).fill(0);
    const cola = todos.filter((i) => grado[i] === 0);
    for (let k = 0; k < cola.length; k++) {
        const u = cola[k];
        for (const a of salientes[u]) {
            if (a.retorno) continue;
            rango[a.a] = Math.max(rango[a.a], rango[u] + 1);
            grado[a.a] -= 1;
            if (grado[a.a] === 0) cola.push(a.a);
        }
    }

    /* 4) Carriles */
    const claveCarril = (c: string) => claveNormalizada(c.trim() || 'General');
    const porRango = todos.slice().sort((a, b) => rango[a] - rango[b] || a - b);
    const nombres = new Map<string, string>();
    for (const i of porRango) {
        const k = claveCarril(pasos[i].responsable);
        if (!nombres.has(k)) nombres.set(k, pasos[i].responsable.trim() || 'General');
    }
    const orden: string[] = [];
    for (const c of ordenCarriles) {
        const k = claveCarril(c);
        if (nombres.has(k) && !orden.includes(k)) orden.push(k);
    }
    for (const k of nombres.keys()) if (!orden.includes(k)) orden.push(k);
    const carrilDe = pasos.map((p) => orden.indexOf(claveCarril(p.responsable)));
    const cabecera = orden.length > 1 || nombres.get(orden[0]) !== 'General' ? 34 : 0;

    /* 5) Ancho de cada carril: tantos huecos como pasos comparten fila dentro de él */
    const grupos = new Map<string, number[]>();
    for (const i of porRango) {
        const k = `${carrilDe[i]}:${rango[i]}`;
        const g = grupos.get(k);
        if (g) g.push(i);
        else grupos.set(k, [i]);
    }
    const maxHuecos = orden.map(() => 1);
    for (const [k, g] of grupos) {
        const c = Number(k.split(':')[0]);
        maxHuecos[c] = Math.max(maxHuecos[c], g.length);
    }
    const nRetornos = aristas.filter((a) => a.retorno).length;
    const margen = 44 + nRetornos * 12;
    const carriles: CarrilFlujo[] = [];
    let cursor = margen;
    orden.forEach((k, c) => {
        const w = maxHuecos[c] * (ANCHO_NODO + SEP_X) + SEP_X;
        carriles.push({ nombre: nombres.get(k) ?? '', x: cursor, w });
        cursor += w;
    });
    const izquierda = margen;
    const derecha = cursor;
    const top0 = cabecera + 14;
    const centroFila = (r: number) => top0 + r * ALTO_FILA + ALTO_FILA / 2;
    const borde = (r: number) => top0 + (r + 1) * ALTO_FILA;
    const maxRango = Math.max(...rango);

    /* 6) Posición de cada paso (dentro de una misma fila y carril se ordenan según sus predecesores) */
    const pos: PosPaso[] = new Array(n);
    const centro = new Array<number>(n).fill(0);
    for (const r of [...new Set(rango)].sort((a, b) => a - b)) {
        for (let c = 0; c < orden.length; c++) {
            const g = grupos.get(`${c}:${r}`);
            if (!g) continue;
            const peso = (i: number) => (preds[i].length > 0
                ? preds[i].reduce((s, p) => s + centro[p], 0) / preds[i].length
                : carriles[c].x + carriles[c].w / 2);
            g.sort((a, b) => peso(a) - peso(b) || a - b);
            const total = g.length * ANCHO_NODO + (g.length - 1) * SEP_X;
            let px = carriles[c].x + (carriles[c].w - total) / 2;
            for (const i of g) {
                const h = ALTO_NODO[pasos[i].tipo];
                pos[i] = { id: pasos[i].id, x: px, y: centroFila(r) - h / 2, w: ANCHO_NODO, h, carril: c, rango: r };
                centro[i] = px + ANCHO_NODO / 2;
                px += ANCHO_NODO + SEP_X;
            }
        }
    }

    /* 7) Conexiones */
    const choques = (x1: number, x2: number, y1: number, y2: number, omitir: number[]): number =>
        pos.reduce((s, p, i) => (
            !omitir.includes(i) && p.x - 6 < x2 && p.x + p.w + 6 > x1 && p.y - 4 < y2 && p.y + p.h + 4 > y1 ? s + 1 : s
        ), 0);

    const enlaces: Enlace[] = [];
    let canal = 0;
    for (const a of aristas) {
        const u = pos[a.de];
        const v = pos[a.a];
        const par = [a.de, a.a];
        const sx = u.x + u.w / 2;
        const sy = u.y + u.h;
        const ex = v.x + v.w / 2;
        const ey = v.y;
        let pts: [number, number][];
        let lx: number;
        let ly: number;

        if (!a.retorno) {
            if (Math.abs(sx - ex) < 0.5) {
                pts = [[sx, sy], [ex, ey]];
                lx = sx + 16;
                ly = sy + 16;
            } else {
                let yh = borde(u.rango);
                if (v.rango - u.rango > 1) {
                    // Salto de varias filas: se elige la ruta que no atraviesa otros pasos.
                    const tarde = borde(v.rango - 1);
                    if (choques(sx - 1, sx + 1, sy, tarde, par) < choques(ex - 1, ex + 1, yh, ey, par)) yh = tarde;
                }
                pts = [[sx, sy], [sx, yh], [ex, yh], [ex, ey]];
                lx = sx + Math.sign(ex - sx) * Math.min(48, Math.abs(ex - sx) / 2);
                ly = yh - 7;
            }
        } else {
            const uy = u.y + u.h / 2;
            const vy = v.y + v.h / 2;
            const costoDer = choques(u.x + u.w, derecha, uy - 1, uy + 1, par) + choques(v.x + v.w, derecha, vy - 1, vy + 1, par);
            const costoIzq = choques(izquierda, u.x, uy - 1, uy + 1, par) + choques(izquierda, v.x, vy - 1, vy + 1, par);
            const der = costoDer <= costoIzq;
            const ch = der ? derecha + 16 + canal * 12 : izquierda - 16 - canal * 12;
            canal += 1;
            pts = [[der ? u.x + u.w : u.x, uy], [ch, uy], [ch, vy], [der ? v.x + v.w : v.x, vy]];
            lx = ch;
            ly = (uy + vy) / 2;
        }
        enlaces.push({
            de: pasos[a.de].id, a: pasos[a.a].id, etiqueta: a.etiqueta, d: trazar(pts),
            retorno: a.retorno, lx: r1(lx), ly: r1(ly),
        });
    }

    return {
        ancho: derecha + margen,
        alto: top0 + (maxRango + 1) * ALTO_FILA + 14,
        cabecera, carriles, nodos: pos, enlaces,
    };
}

/** Pasos y conexiones del camino desde el inicio hasta `id` (sin contar los retornos). */
export function caminoHasta(enlaces: readonly Enlace[], id: string): { nodos: Set<string>; aristas: Set<string> } {
    const nodos = new Set<string>([id]);
    const aristas = new Set<string>();
    const pila = [id];
    while (pila.length > 0) {
        const v = pila.pop() as string;
        for (const e of enlaces) {
            if (e.retorno || e.a !== v) continue;
            aristas.add(`${e.de}>${e.a}`);
            if (!nodos.has(e.de)) {
                nodos.add(e.de);
                pila.push(e.de);
            }
        }
    }
    return { nodos, aristas };
}