import { NOMBRES_FUENTES } from '../fuentes/fuentes';
export type TipoCampo = 'texto' | 'texto_largo' | 'fecha' | 'fechalarga' | 'moneda' | 'dolares' | 'numero' | 'superficie';

export const TIPOS_CAMPO: { valor: TipoCampo; etiqueta: string }[] = [
    { valor: 'texto', etiqueta: 'Texto corto' },
    { valor: 'texto_largo', etiqueta: 'Texto largo' },
    { valor: 'fecha', etiqueta: 'Fecha (9 de octubre de 2026)' },
    { valor: 'fechalarga', etiqueta: 'Fecha completa (nueve (9) días del mes de…)' },
    { valor: 'moneda', etiqueta: 'Monto (Bs.)' },
    { valor: 'dolares', etiqueta: 'Monto (US$)' },
    { valor: 'numero', etiqueta: 'Número' },
    { valor: 'superficie', etiqueta: 'Superficie (m²)' },
];

export interface CampoPropio {
    clave: string;
    etiqueta: string;
    tipo: TipoCampo;
    requerido: boolean;
    ejemplo?: string;
    grupo?: string;
}
/** Un dato que se pide de las partes (nombre, C.I., lugar de nacimiento…). Sirve para cualquier parte: se elige de quién al insertarlo. */
export interface DatoParte {
    clave: string;
    etiqueta: string;
    tipo: TipoCampo;
    requerido: boolean;
    ficha?: boolean;
    mayus?: boolean;
    ejemplo?: string;
}

/** Categoría de datos de las partes: «Generales de ley», «Datos del vehículo»… */
export interface GrupoDatos { id: string; nombre: string; datos: DatoParte[] }

export type TamanoPagina = 'carta' | 'oficio' | 'a4';

export interface Margenes { superior: number; inferior: number; izquierdo: number; derecho: number }

export interface ConfigPagina {
    tamano: TamanoPagina;
    fuente: string;
    tamanoPt: number;
    interlineado: number;
    sangria: boolean;
    margenes: Margenes;
    simetricos: boolean;
    /** Espacio (pt) antes y después de cada párrafo normal: Word → Párrafo → Espaciado. */
    espacioAntes: number;
    espacioDespues: number;
}

export interface FuenteModelo {
    version: 1; config: ConfigPagina; texto: string; campos: CampoPropio[];
    partes?: string[]; grupos?: GrupoDatos[];
}

export const FUENTES_PAGINA: string[] = NOMBRES_FUENTES;
export const CATEGORIAS_MODELO = [
    'Escrito judicial',
    'Contrato (Minuta)',
    'Contrato (Documento privado)',
    'Instructiva de poder',
    'Carta de solicitud o notificación',
    'Demanda',
    'Querella',
    'Denuncia',
    'Apersonamiento',
    'Contestación',
    'Recurso',
    'Incidente o excepción',
    'Acción constitucional',
    'Declaración jurada',
    'Acta',
    'Convenio o transacción',
    'Informe o dictamen legal',
    'Otro',
];

/** Materias del derecho para clasificar modelos. */
export const MATERIAS_MODELO: readonly { clave: string; etiqueta: string }[] = [
    { clave: 'penal', etiqueta: 'Penal' },
    { clave: 'civil', etiqueta: 'Civil' },
    { clave: 'notarial', etiqueta: 'Notarial' },
    { clave: 'laboral', etiqueta: 'Laboral' },
    { clave: 'administrativo', etiqueta: 'Administrativo' },
    { clave: 'familiar', etiqueta: 'Familiar' },
    { clave: 'minero', etiqueta: 'Minero' },
    { clave: 'corporativo', etiqueta: 'Corporativo' },
    { clave: 'municipal', etiqueta: 'Municipal' },
    { clave: 'constitucional', etiqueta: 'Constitucional' },
    { clave: 'agroambiental', etiqueta: 'Agroambiental' },
    { clave: 'comercial', etiqueta: 'Comercial' },
    { clave: 'tributario', etiqueta: 'Tributario' },
    { clave: 'aduanero', etiqueta: 'Aduanero' },
    { clave: 'registral', etiqueta: 'Registral' },
];

/** Tipos de expediente que no coinciden uno a uno con una materia. */
const MATERIAS_POR_TIPO: Record<string, readonly string[]> = {
    contrato: ['civil', 'comercial', 'notarial', 'corporativo'],
    documento_privado: ['civil', 'comercial'],
    poder: ['notarial'],
    tramite: ['administrativo', 'municipal', 'registral', 'tributario', 'aduanero'],
};

/** ¿La materia del modelo conviene a este tipo de expediente? (para el distintivo «Recomendado») */
export const esMateriaRecomendada = (materia: string, tipoExpediente: string): boolean =>
    materia !== '' && (materia === tipoExpediente || (MATERIAS_POR_TIPO[tipoExpediente] ?? []).includes(materia));

const CATEGORIAS_ANTIGUAS: Record<string, string> = {
    contrato: 'Contrato (Minuta)',
    minuta: 'Contrato (Minuta)',
    'documento privado': 'Contrato (Documento privado)',
    poder: 'Instructiva de poder',
};
const MATERIAS_ANTIGUAS: Record<string, string> = {
    contrato: 'civil', documento_privado: 'civil', poder: 'notarial', tramite: 'administrativo', asesoria: '', otro: '',
};

/** Convierte valores de la lista anterior (p. ej. «Minuta», «Poder») a la nueva. */
export function normalizarCategoria(v?: string): string | undefined {
    const t = (v ?? '').trim();
    if (!t) return undefined;
    return CATEGORIAS_ANTIGUAS[t.toLowerCase()] ?? t;
}

export function normalizarMateria(v?: string): string | undefined {
    const t = (v ?? '').trim();
    if (!t) return undefined;
    const k = t.toLowerCase();
    return Object.hasOwn(MATERIAS_ANTIGUAS, k) ? (MATERIAS_ANTIGUAS[k] || undefined) : t;
}

export const PAGINA_CM: Record<TamanoPagina, { w: number; h: number }> = {
    carta: { w: 21.59, h: 27.94 },
    oficio: { w: 21.59, h: 33.02 },
    a4: { w: 21, h: 29.7 },
};

export const AREA_MIN_CM = 5;
export const MARGEN_MAX_CM = 15;

export const MARGENES_BASE: Margenes = { superior: 2.5, inferior: 2.5, izquierdo: 3, derecho: 2.5 };
export const MARGENES_MEMORIAL: Margenes = { superior: 5.5, inferior: 2, izquierdo: 4, derecho: 2 };

export interface PresetMargenes { id: string; etiqueta: string; margenes: Margenes; simetricos: boolean }

export const PRESETS_MARGENES: PresetMargenes[] = [
    { id: 'base', etiqueta: 'Predeterminado', margenes: MARGENES_BASE, simetricos: false },
    { id: 'memorial', etiqueta: 'Memorial (simétrico)', margenes: MARGENES_MEMORIAL, simetricos: true },
    { id: 'word', etiqueta: 'Word (2,54)', margenes: { superior: 2.54, inferior: 2.54, izquierdo: 2.54, derecho: 2.54 }, simetricos: false },
    { id: 'moderado', etiqueta: 'Moderado', margenes: { superior: 2.54, inferior: 2.54, izquierdo: 1.91, derecho: 1.91 }, simetricos: false },
    { id: 'estrecho', etiqueta: 'Estrecho', margenes: { superior: 1.27, inferior: 1.27, izquierdo: 1.27, derecho: 1.27 }, simetricos: false },
    { id: 'ancho', etiqueta: 'Ancho', margenes: { superior: 2.54, inferior: 2.54, izquierdo: 5.08, derecho: 5.08 }, simetricos: false },
    { id: 'simetrico', etiqueta: 'Simétrico (Word)', margenes: { superior: 2.54, inferior: 2.54, izquierdo: 3.18, derecho: 2.54 }, simetricos: true },
];

const casi = (a: number, b: number) => Math.abs(a - b) < 0.005;

export const margenesIguales = (a: Margenes, b: Margenes) =>
    casi(a.superior, b.superior) && casi(a.inferior, b.inferior) && casi(a.izquierdo, b.izquierdo) && casi(a.derecho, b.derecho);

export const presetDe = (m: Margenes, simetricos?: boolean) =>
    PRESETS_MARGENES.find((p) => margenesIguales(p.margenes, m) && (simetricos === undefined || p.simetricos === simetricos));

const redondear = (n: number) => Math.round(n * 100) / 100;
const bajar = (n: number) => Math.floor(n * 100) / 100;

function limitar(v: unknown, defecto: number): number {
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
    return Number.isFinite(n) ? Math.min(MARGEN_MAX_CM, Math.max(0, redondear(n))) : defecto;
}

function ajustarPar(a: number, b: number, total: number): [number, number] {
    const max = Math.max(0, total - AREA_MIN_CM);
    if (a + b <= max) return [a, b];
    const f = max / (a + b);
    return [bajar(a * f), bajar(b * f)];
}

export function margenesSeguros(m: Partial<Margenes> | null | undefined, tamano: TamanoPagina): Margenes {
    const p = PAGINA_CM[tamano] ?? PAGINA_CM.carta;
    const o = (m ?? {}) as Partial<Record<keyof Margenes, unknown>>;
    const [izquierdo, derecho] = ajustarPar(
        limitar(o.izquierdo, MARGENES_BASE.izquierdo), limitar(o.derecho, MARGENES_BASE.derecho), p.w,
    );
    const [superior, inferior] = ajustarPar(
        limitar(o.superior, MARGENES_BASE.superior), limitar(o.inferior, MARGENES_BASE.inferior), p.h,
    );
    return { superior, inferior, izquierdo, derecho };
}

export const ESPACIO_MAX_PT = 72;
/** Espacio fijo de títulos (#) y subtítulos (##): igual en la vista y en los estilos Title/Subtitle del .docx. */
export const ESPACIO_TITULO_PT = 12;
export const ESPACIO_SUBTITULO_PT = 6;

export function espacioSeguro(v: unknown, defecto: number): number {
    if (v === null || v === undefined || v === '') return defecto;
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
    return Number.isFinite(n) ? Math.min(ESPACIO_MAX_PT, Math.max(0, Math.round(n * 10) / 10)) : defecto;
}

export const CONFIG_POR_DEFECTO: ConfigPagina = {
    tamano: 'carta', fuente: 'Times New Roman', tamanoPt: 12, interlineado: 1.5, sangria: false,
    margenes: { ...MARGENES_BASE }, simetricos: false,
    espacioAntes: 0, espacioDespues: 6,
};

export const fuenteVacia = (): FuenteModelo => ({
    version: 1,
    config: { ...CONFIG_POR_DEFECTO, margenes: { ...CONFIG_POR_DEFECTO.margenes } },
    texto: '',
    campos: [],
    partes: [],
    grupos: [],
});

const textoLimpio = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function leerDato(x: unknown): DatoParte | null {
    if (typeof x !== 'object' || x === null) return null;
    const d = x as Record<string, unknown>;
    const clave = textoLimpio(d.clave);
    const etiqueta = textoLimpio(d.etiqueta);
    if (!clave || !etiqueta) return null;
    const tipo = TIPOS_CAMPO.some((t) => t.valor === d.tipo) ? (d.tipo as TipoCampo) : 'texto';
    const ejemplo = textoLimpio(d.ejemplo);
    return {
        clave, etiqueta, tipo, requerido: d.requerido !== false,
        ...(d.ficha === true ? { ficha: true } : {}),
        ...(d.mayus === true ? { mayus: true } : {}),
        ...(ejemplo ? { ejemplo } : {}),
    };
}

function leerGrupos(grupos: unknown, antiguos: unknown): GrupoDatos[] {
    if (Array.isArray(grupos)) {
        return grupos.flatMap((g, i): GrupoDatos[] => {
            if (typeof g !== 'object' || g === null) return [];
            const o = g as Record<string, unknown>;
            const datos = (Array.isArray(o.datos) ? o.datos : []).map(leerDato).filter((d): d is DatoParte => d !== null);
            return [{ id: textoLimpio(o.id) || `g${i + 1}`, nombre: textoLimpio(o.nombre) || 'Datos', datos }];
        });
    }
    // Modelos de la versión anterior (datos por rol): se juntan en un solo grupo, sin repetidos.
    if (Array.isArray(antiguos)) {
        const vistos = new Map<string, DatoParte>();
        for (const x of antiguos) {
            const d = leerDato(x);
            if (!d) continue;
            const k = `${d.ficha ? 'f' : 'd'}:${d.clave}`;
            if (!vistos.has(k)) vistos.set(k, d);
        }
        if (vistos.size > 0) return [{ id: 'g1', nombre: 'Datos de las partes', datos: [...vistos.values()] }];
    }
    return [];
}
export function leerFuente(json: string): FuenteModelo {
    const o: unknown = JSON.parse(json);
    const r = (typeof o === 'object' && o !== null ? o : {}) as Partial<FuenteModelo> & { camposPartes?: unknown };
    const config = { ...CONFIG_POR_DEFECTO, ...(r.config ?? {}) };
    config.margenes = margenesSeguros(r.config?.margenes, config.tamano);
    config.simetricos = r.config?.simetricos === true;
    config.espacioAntes = espacioSeguro(r.config?.espacioAntes, CONFIG_POR_DEFECTO.espacioAntes);
    config.espacioDespues = espacioSeguro(r.config?.espacioDespues, CONFIG_POR_DEFECTO.espacioDespues);
    return {
        version: 1,
        config,
        texto: typeof r.texto === 'string' ? r.texto : '',
        campos: Array.isArray(r.campos) ? r.campos.filter((c) => c && typeof c.clave === 'string') : [],
        partes: Array.isArray(r.partes) ? r.partes.filter((p): p is string => typeof p === 'string' && p.trim() !== '') : [],
        grupos: leerGrupos(r.grupos, r.camposPartes),
    };
}

const FILTRO_POR_TIPO: Partial<Record<TipoCampo, string>> = { moneda: ' | moneda', dolares: ' | dolares', fecha: ' | fecha', fechalarga: ' | fechalarga', superficie: ' | superficie' };

export function marcadorDeCampo(c: CampoPropio): string {
    return `{{caso.${c.clave}${c.requerido ? '' : '?'}${FILTRO_POR_TIPO[c.tipo] ?? ''}}}`;
}

export type Alineacion = 'left' | 'center' | 'right' | 'both';
export type EstiloParrafo = 'normal' | 'titulo' | 'subtitulo';

export interface Tramo {
    texto: string; negrita: boolean; cursiva: boolean; subrayado: boolean; marcador: boolean;
    /** Fuente y tamaño propios de este fragmento (sin valor = los base del documento). */
    fuente?: string;
    tamanoPt?: number;
}

export type Bloque =
    | { tipo: 'salto' }
    | {
        tipo: 'parrafo'; alineacion: Alineacion; estilo: EstiloParrafo; tramos: Tramo[];
        /** Interlineado propio del párrafo (sin valor = el base del documento). */
        interlineado?: number;
        /** 2 = el párrafo está en una región de dos columnas; sin valor = una columna. */
        columnas?: number;
        /** Solo en columnas: el párrafo empieza en la columna siguiente (salto de columna). */
        nuevaColumna?: boolean;
    };
export type BloqueParrafo = Extract<Bloque, { tipo: 'parrafo' }>;

/** Marcas de fuente/tamaño dentro de una línea del texto fuente: ⟪Arial|14⟫texto⟪/⟫ */
export const ABRE_LETRA = '\u27EA';
export const CIERRA_LETRA = '\u27EB';

const POR_LETRA: Record<string, Alineacion> = { c: 'center', d: 'right', i: 'left', j: 'both' };
const LETRA: Record<Alineacion, string> = { center: 'c', right: 'd', left: 'i', both: 'j' };
const ALINEACION_BASE: Record<EstiloParrafo, Alineacion> = { normal: 'both', titulo: 'center', subtitulo: 'left' };

export function tramosDe(linea: string): Tramo[] {
    const tramos: Tramo[] = [];
    let negrita = false, cursiva = false, subrayado = false, buf = '';
    let fuente: string | undefined;
    let tam: number | undefined;
    const letra = () => ({ ...(fuente ? { fuente } : {}), ...(tam ? { tamanoPt: tam } : {}) });
    const vaciar = () => {
        if (buf) tramos.push({ texto: buf, negrita, cursiva, subrayado, marcador: false, ...letra() });
        buf = '';
    };
    for (let i = 0; i < linea.length;) {
        if (linea.startsWith('{{', i)) {
            const fin = linea.indexOf('}}', i + 2);
            if (fin !== -1) {
                vaciar();
                tramos.push({ texto: linea.slice(i, fin + 2), negrita, cursiva, subrayado, marcador: true, ...letra() });
                i = fin + 2;
                continue;
            }
        }
        if (linea[i] === '\u2028') { buf += '\n'; i += 1; continue; }
        if (linea[i] === '\\' && i + 1 < linea.length) { buf += linea[i + 1]; i += 2; continue; }
        if (linea[i] === ABRE_LETRA) {
            const fin = linea.indexOf(CIERRA_LETRA, i + 1);
            if (fin !== -1) {
                vaciar();
                const cuerpo = linea.slice(i + 1, fin);
                if (cuerpo === '/') {
                    fuente = undefined;
                    tam = undefined;
                } else {
                    const [f = '', t = ''] = cuerpo.split('|');
                    fuente = f.trim() || undefined;
                    const n = Number(t.replace(',', '.'));
                    tam = Number.isFinite(n) && n > 0 ? n : undefined;
                }
                i = fin + 1;
                continue;
            }
        }
        if (linea.startsWith('**', i)) { vaciar(); negrita = !negrita; i += 2; continue; }
        if (linea.startsWith('++', i)) { vaciar(); subrayado = !subrayado; i += 2; continue; }
        if (linea[i] === '*') { vaciar(); cursiva = !cursiva; i += 1; continue; }
        buf += linea[i];
        i += 1;
    }
    vaciar();
    return tramos;
}

export function parsearTexto(texto: string): Bloque[] {
    const lineas = texto.split(/\r?\n/);
    while (lineas.length > 0 && lineas[lineas.length - 1].trim() === '') lineas.pop();
    return lineas.map((linea): Bloque => {
        if (linea.trim() === '===') return { tipo: 'salto' };
        let resto = linea;
        let alineacion: Alineacion | null = null;
        let estilo: EstiloParrafo = 'normal';
        let interlineado: number | undefined;
        let columnas = false;
        let nuevaColumna = false;
        for (let n = 0; n < 8; n++) {
            const a = /^\[(c|d|i|j)\]\s?/i.exec(resto);
            if (a) { alineacion = POR_LETRA[a[1].toLowerCase()]; resto = resto.slice(a[0].length); continue; }
            const l = /^\[int=(\d+(?:[.,]\d+)?)\]\s?/i.exec(resto);
            if (l) { interlineado = Number(l[1].replace(',', '.')); resto = resto.slice(l[0].length); continue; }
            // Los modelos con 3 o 4 columnas (versión anterior) se leen como 2.
            const c = /^\[col=[2-4]\]\s?/i.exec(resto);
            if (c) { columnas = true; resto = resto.slice(c[0].length); continue; }
            const k = /^\[nc\]\s?/i.exec(resto);
            if (k) { nuevaColumna = true; resto = resto.slice(k[0].length); continue; }
            const h = /^(#{1,2})\s+/.exec(resto);
            if (h) { estilo = h[1].length === 1 ? 'titulo' : 'subtitulo'; resto = resto.slice(h[0].length); continue; }
            break;
        }
        return {
            tipo: 'parrafo', alineacion: alineacion ?? ALINEACION_BASE[estilo], estilo, tramos: tramosDe(resto),
            ...(interlineado && interlineado > 0 ? { interlineado } : {}),
            ...(columnas ? { columnas: 2, ...(nuevaColumna ? { nuevaColumna: true } : {}) } : {}),
        };
    });
}

function tramoATexto(t: Tramo): string {
    let o = t.marcador
        ? t.texto
        : t.texto.replace(/[\\*\u27EA]/g, '\\$&').replace(/\+\+/g, '\\+\\+').replace(/\n/g, '\u2028');
    if (t.subrayado) o = `++${o}++`;
    if (t.cursiva) o = `*${o}*`;
    if (t.negrita) o = `**${o}**`;
    return o;
}

/** Agrupa los tramos consecutivos con la misma fuente/tamaño dentro de una sola marca. */
function tramosATexto(tramos: Tramo[]): string {
    let salida = '';
    let abierto = '';
    for (const t of tramos) {
        const k = t.fuente || t.tamanoPt ? `${t.fuente ?? ''}|${t.tamanoPt ?? ''}` : '';
        if (k !== abierto) {
            if (abierto) salida += `${ABRE_LETRA}/${CIERRA_LETRA}`;
            if (k) salida += `${ABRE_LETRA}${k}${CIERRA_LETRA}`;
            abierto = k;
        }
        salida += tramoATexto(t);
    }
    if (abierto) salida += `${ABRE_LETRA}/${CIERRA_LETRA}`;
    return salida;
}

const numTxt = (n: number) => String(Math.round(n * 100) / 100);

export function bloquesATexto(bloques: Bloque[]): string {
    return bloques
        .map((b) => {
            if (b.tipo === 'salto') return '===';
            let pref = '';
            if (b.columnas && b.columnas > 1) {
                pref += '[col=2] ';
                if (b.nuevaColumna) pref += '[nc] ';
            }
            if (b.interlineado) pref += `[int=${numTxt(b.interlineado)}] `;
            if (b.alineacion !== ALINEACION_BASE[b.estilo]) pref += `[${LETRA[b.alineacion]}] `;
            if (b.estilo === 'titulo') pref += '# ';
            if (b.estilo === 'subtitulo') pref += '## ';
            const cuerpo = tramosATexto(b.tramos);
            const seguro = /^(#|\[(?:[cdij]\]|int=|col=|nc\])|===\s*$)/i.test(cuerpo) ? `\\${cuerpo}` : cuerpo;
            return pref + seguro;
        })
        .join('\n');
}