import { ROL_PENDIENTE, etiquetaCampoCaso } from '../expedientes/catalogo';
import { formasConcordancia, type FormasConcordancia } from './concordancia';
import { hoyISO } from './filtros/fecha';
import { FILTROS } from './filtros/registro';
import type { FuenteModelo, TipoCampo } from './fuenteModelo';
import { claveCampo, claveNormalizada, etiquetaRol, normalizarRol, pluralRol } from '../comun/texto';
import { ROLES_CONOCIDOS } from '../expedientes/tiposExpediente';

/* ---------------- Análisis de un marcador {{…}} ---------------- */
export interface FiltroMarcador { nombre: string; args: string[] }
export interface MarcadorAnalizado {
    tipo: 'valor' | 'apertura' | 'cierre';
    ruta: string;
    opcional: boolean;
    filtros: FiltroMarcador[];
}

const comillas = (s: string) => s.replace(/[“”«»„]/g, '"').replace(/[‘’]/g, "'").replace(/\u00A0/g, ' ');

function dividir(s: string, sep: string): string[] {
    const partes: string[] = [];
    let actual = '';
    let dentro = false;
    for (const ch of s) {
        if (ch === '"') dentro = !dentro;
        if (ch === sep && !dentro) {
            partes.push(actual);
            actual = '';
        } else {
            actual += ch;
        }
    }
    partes.push(actual);
    return partes;
}

export function analizarMarcador(crudo: string): MarcadorAnalizado | null {
    const m = /^\{\{([\s\S]*)\}\}$/.exec(crudo.trim());
    if (!m) return null;
    const s = comillas(m[1]).trim();
    if (s.startsWith('#')) return { tipo: 'apertura', ruta: s.slice(1).trim(), opcional: false, filtros: [] };
    if (s.startsWith('/')) return { tipo: 'cierre', ruta: s.slice(1).trim(), opcional: false, filtros: [] };
    const [rutaTxt, ...filtrosTxt] = dividir(s, '|');
    let ruta = rutaTxt.trim();
    const opcional = ruta.endsWith('?');
    if (opcional) ruta = ruta.slice(0, -1).trim();
    const filtros = filtrosTxt.map((f) => {
        const [nombre, ...args] = dividir(f, ':').map((p) => p.trim());
        return { nombre: nombre.toLowerCase(), args: args.map((a) => /^"([\s\S]*)"$/.exec(a)?.[1] ?? a) };
    });
    return { tipo: 'valor', ruta, opcional, filtros };
}

export function armarMarcador(a: { ruta: string; opcional?: boolean; filtros?: FiltroMarcador[] }): string {
    const f = (a.filtros ?? [])
        .map((x) => ` | ${x.nombre}${x.args.map((g) => `:"${g.replace(/"/g, '')}"`).join('')}`)
        .join('');
    return `{{${a.ruta}${a.opcional ? '?' : ''}${f}}}`;
}

export interface ContextoMarcadores {
    /** clave de «caso.*» → etiqueta que le puso el abogado. */
    campos?: Readonly<Record<string, string>>;
    /** Roles propios del modelo (vendedor, comprador…): su orden decide el color. */
    partes?: readonly string[];
    /** clave de un dato propio de una parte → etiqueta que le puso el abogado. */
    camposPartes?: Readonly<Record<string, string>>;
    /** clave de «caso.*» → ejemplo (placeholder). */
    ejemplos?: Readonly<Record<string, string>>;
    /** clave de un dato propio de una parte → ejemplo (placeholder). */
    ejemplosPartes?: Readonly<Record<string, string>>;
}
export const SIN_CONTEXTO: ContextoMarcadores = {};

/* ---------------- Ejemplos (placeholders) ---------------- */
const EJEMPLO_TIPO: Partial<Record<TipoCampo, string>> = {
    fecha: '2026-03-15', fechalarga: '2026-03-15', moneda: '1500', dolares: '1500', superficie: '250', numero: '12',
};
/** Ejemplo por defecto de un tipo de campo (vacío si no hay uno razonable). */
export const ejemploPorTipo = (t: TipoCampo): string => EJEMPLO_TIPO[t] ?? '';

const EJEMPLO_PERSONA: Readonly<Record<string, string>> = {
    nombre: 'Juan Carlos Pérez Gómez', nombre_completo: 'Juan Carlos Pérez Gómez', nombres: 'Juan Carlos',
    apellido_paterno: 'Pérez', apellido_materno: 'Gómez', apellido_casada: 'López',
    ci: '1234567 LP', ci_datos: '1234567 LP', ci_numero: '1234567', ci_complemento: '1A', ci_expedido: 'LP',
    genero: 'Masculino', estado_civil: 'casado', nacionalidad: 'boliviano', profesion: 'abogado',
    fecha_nacimiento: '1985-03-15', domicilio: 'Calle Sucre N° 123, zona Central, La Paz',
    telefono: '70123456', correo: 'juan.perez@correo.com', razon_social: 'Comercial Andina S.R.L.', nit: '1023456789',
    poder_ref: 'Poder N° 123/2025', domicilio_procesal: 'Calle Mercado N° 45, Of. 3, La Paz', porcentaje: '50 %',
    representante: 'Ana María Rojas Quispe', matricula_profesional: '12345',
};
const EJEMPLO_EXPEDIENTE: Readonly<Record<string, string>> = {
    materia: 'Cumplimiento de contrato', juzgado: 'Juzgado Público Civil y Comercial N° 3 de La Paz',
    nro_causa: '1234/2026', referencia: 'Proceso ordinario', codigo: 'LH-2026-0001', tipo: 'civil', estado: 'abierto',
};

const ej = (t: Readonly<Record<string, string>> | undefined, k: string): string =>
    t && Object.hasOwn(t, k) ? t[k] : '';

/** Aplica al ejemplo los mismos filtros del marcador (mayús, fecha, moneda…) para mostrar cómo saldrá. */
function ejemploConFiltros(base: string, filtros: readonly FiltroMarcador[]): string {
    let v = base;
    for (const f of filtros) {
        if (!Object.hasOwn(FILTROS, f.nombre) || ['concordar', 'lista', 'ci'].includes(f.nombre)) continue;
        try {
            v = FILTROS[f.nombre](v, ...f.args);
        } catch {
            return base;
        }
    }
    return v;
}

/** Nombres, colores y ejemplos de los campos de un modelo (para tooltips, etiquetas y menús). */
export function contextoDeFuente(
    f: Pick<FuenteModelo, 'campos' | 'partes' | 'grupos'>,
): ContextoMarcadores {
    const campos = f.campos ?? [];
    const propios = (f.grupos ?? []).flatMap((g) => g.datos).filter((d) => !d.ficha);
    const etiqueta = (e: string, clave: string) => e.trim() || etiquetaRol(claveCampo(clave));
    const sinVacios = (l: [string, string][]) => Object.fromEntries(l.filter(([, v]) => v !== ''));
    return {
        campos: Object.fromEntries(campos.map((c) => [claveCampo(c.clave), etiqueta(c.etiqueta, c.clave)])),
        camposPartes: Object.fromEntries(propios.map((d) => [claveCampo(d.clave), etiqueta(d.etiqueta, d.clave)])),
        ejemplos: sinVacios(campos.map((c): [string, string] => [claveCampo(c.clave), c.ejemplo?.trim() || ejemploPorTipo(c.tipo)])),
        ejemplosPartes: sinVacios(propios.map((d): [string, string] => [claveCampo(d.clave), d.ejemplo?.trim() || ejemploPorTipo(d.tipo)])),
        partes: f.partes ?? [],
    };
}
const MATIZ_CASO = 215;
const MATIZ_SISTEMA = 165;
export const MATIZ_CLIENTE = 28;
export const MATIZ_ABOGADO = 262;
const MATIZ_NEUTRO = 232;
const MATIZ_PENDIENTE = 45;
const MATIZ_COND = 40;
const PALETA = [340, 90, 190, 300, 55, 130, 10];

const claveRol = (k: string) => claveNormalizada(k).replace(/(?:es|s)$/, '').replace(/[aeiou]$/, '');

export function matizDeRol(rol: string, ctx: ContextoMarcadores = SIN_CONTEXTO): number {
    const base = claveRol(rol);
    const i = (ctx.partes ?? []).findIndex((p) => claveRol(p) === base);
    if (i >= 0) return PALETA[i % PALETA.length];
    let h = 0;
    for (const ch of base) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETA[h % PALETA.length];
}

/** Color de una tarjeta del panel (id de rol, «@cliente» o «@abogado»). */
export function matizDePersona(id: string, partes: readonly string[]): number {
    if (id === '@cliente') return MATIZ_CLIENTE;
    if (id === '@abogado') return MATIZ_ABOGADO;
    return matizDeRol(id, { partes });
}

export interface RolResuelto { rol: string; plural: boolean; fijo: boolean }

/** «vendedores» → {vendedor, plural}; «cliente» y «abogado» son fijos. */
export function resolverRol(seg: string, ctx: ContextoMarcadores = SIN_CONTEXTO): RolResuelto | null {
    const k = claveNormalizada(seg);
    if (k === 'cliente' || k === 'abogado') return { rol: k, plural: false, fijo: true };
    for (const r of [...(ctx.partes ?? []), ...ROLES_CONOCIDOS]) {
        if (normalizarRol(r) === k) return { rol: normalizarRol(r), plural: false, fijo: false };
        if (pluralRol(r) === k) return { rol: normalizarRol(r), plural: true, fijo: false };
    }
    return null;
}

/* ---------------- Etiqueta corta de concordancia: el/la/l@s ---------------- */
const MAX_CORTO = 22;
const recortar = (s: string, n = MAX_CORTO) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function unirPar(m: string, f: string): string {
    if (m === f) return m;
    if (m.length === f.length) {
        let pos = -1;
        for (let i = 0; i < m.length; i++) {
            if (m[i] !== f[i]) {
                if (pos >= 0) {
                    pos = -2;
                    break;
                }
                pos = i;
            }
        }
        if (pos >= 0) return `${m.slice(0, pos)}@${m.slice(pos + 1)}`;
    }
    if (f.toLowerCase().startsWith(m.toLowerCase())) return `${m}/${f.slice(m.length)}`;
    return `${m}/${f}`;
}

/** el/la/los/las → «el/la/l@s» · señor/señora/señores/señoras → «señor/a/señor@s» · legítimo… → «legítim@(s)». */
export function compactarGenero(f: FormasConcordancia, varias: boolean): string {
    const s = unirPar(f.sm, f.sf);
    if (!varias) return s;
    if (f.pm === f.sm && f.pf === f.sf) return s;
    if (f.sm === f.sf && f.pm === f.pf) {
        const largo = `${f.sm}/${f.pm}`;
        return largo.length <= MAX_CORTO ? largo : `${f.sm}/pl.`;
    }
    const p = unirPar(f.pm, f.pf);
    if (p.toLowerCase() === `${s}s`.toLowerCase()) return `${s}(s)`;
    return `${s}/${p}`;
}

/* ---------------- Descripción para el documento y el tooltip ---------------- */
export interface InfoMarcador {
    tipo: 'dato' | 'persona' | 'genero' | 'bloque' | 'cierre' | 'sistema' | 'pendiente' | 'otro';
    corto: string;
    titulo: string;
    detalle: string;
    matiz: number;
    ejemplo?: string;
}

const PERSONA_CAMPO: Record<string, [string, string]> = {
    nombre: ['nombre', 'Nombre completo'], nombre_completo: ['nombre', 'Nombre completo'],
    nombres: ['nombres', 'Nombres'], apellido_paterno: ['ap. paterno', 'Apellido paterno'],
    apellido_materno: ['ap. materno', 'Apellido materno'], apellido_casada: ['ap. casada', 'Apellido de casada'],
    ci: ['C.I.', 'Cédula de identidad'], ci_datos: ['C.I.', 'Cédula de identidad'],
    ci_numero: ['C.I. n°', 'N° de la cédula'], ci_complemento: ['complemento', 'Complemento de la cédula'],
    ci_expedido: ['expedido', 'Lugar de expedición'], genero: ['género', 'Género'],
    estado_civil: ['estado civil', 'Estado civil'], nacionalidad: ['nacionalidad', 'Nacionalidad'],
    profesion: ['profesión', 'Profesión'], fecha_nacimiento: ['nacimiento', 'Fecha de nacimiento'],
    domicilio: ['domicilio', 'Domicilio'], telefono: ['teléfono', 'Teléfono'], correo: ['correo', 'Correo electrónico'],
    razon_social: ['razón social', 'Razón social'], nit: ['NIT', 'NIT'], poder_ref: ['poder', 'Poder del representante'],
    domicilio_procesal: ['dom. procesal', 'Domicilio procesal'], porcentaje: ['%', 'Porcentaje'],
    representante: ['representante', 'Representante'], matricula_profesional: ['matrícula', 'Matrícula profesional'],
};
const EXPEDIENTE_CAMPO: Record<string, [string, string]> = {
    materia: ['asunto', 'Asunto'], juzgado: ['juzgado', 'Juzgado o tribunal'], nro_causa: ['n° causa', 'N° de causa'],
    referencia: ['referencia', 'Referencia'], codigo: ['código', 'Código interno'], tipo: ['tipo', 'Tipo de expediente'],
    estado: ['estado', 'Estado'],
};
const FILTRO_TXT: Record<string, string> = {
    mayus: 'en MAYÚSCULAS', minus: 'en minúsculas', titulo: 'con Mayúscula Inicial',
    fecha: 'fecha en letras', fechalarga: 'fecha: nueve (9) días del mes de…',
    moneda: 'monto con su literal', dolares: 'monto en dólares con su literal',
    superficie: 'superficie con su literal',
    literal: 'número en letras', lista: 'nombres en una línea', ci: 'C.I. completa',
};

const esTrans = (n: string) => n === 'mayus' || n === 'minus' || n === 'titulo';
const humano = (s: string) => etiquetaRol(s).toLowerCase();

function conTrans(corto: string, nombre?: string): string {
    if (nombre === 'mayus') return corto.toUpperCase();
    if (nombre === 'minus') return corto.toLowerCase();
    if (nombre === 'titulo') return corto.replace(/(^|\s)(\p{L})/gu, (_m, s: string, c: string) => s + c.toUpperCase());
    return corto;
}

function describirBloque(abre: boolean, ruta: string, ctx: ContextoMarcadores): InfoMarcador {
    const k = claveNormalizada(ruta);
    let quien: string;
    let regla: string;
    let matiz = MATIZ_NEUTRO;
    if (k === 'hay_conyuge') {
        quien = 'si hay cónyuge';
        regla = 'Solo aparece si la primera parte es casada';
        matiz = MATIZ_COND;
    } else if (k.startsWith('hay_')) {
        const rol = k.slice(4).replace(/_/g, ' ');
        quien = `si hay ${rol}`;
        regla = `Solo aparece si el expediente tiene ${rol}`;
        matiz = MATIZ_COND;
    } else if (k === 'inmuebles') {
        quien = 'cada inmueble';
        regla = 'Se repite por cada inmueble del expediente';
        matiz = MATIZ_SISTEMA;
    } else if (k === 'titulares') {
        quien = 'cada titular';
        regla = 'Se repite por cada titular del inmueble';
        matiz = MATIZ_SISTEMA;
    } else {
        const r = resolverRol(k, ctx);
        const s = (r ? r.rol : k).replace(/_/g, ' ');
        quien = `cada ${s}`;
        regla = `Se repite por cada ${s}`;
        if (r) matiz = r.fijo ? (r.rol === 'cliente' ? MATIZ_CLIENTE : MATIZ_ABOGADO) : matizDeRol(r.rol, ctx);
    }
    return abre
        ? {
            tipo: 'bloque', corto: recortar(`▸ ${quien}`, 28), titulo: `Inicio · ${quien}`,
            detalle: `${regla}. Escribe el texto entre este inicio y su cierre.`, matiz,
        }
        : { tipo: 'cierre', corto: '◂ fin', titulo: `Fin · ${quien}`, detalle: 'Cierra el bloque anterior.', matiz };
}

export function describirMarcador(crudo: string, ctx: ContextoMarcadores = SIN_CONTEXTO): InfoMarcador {
    const codigo = crudo.trim();
    const a = analizarMarcador(codigo);
    if (!a || !a.ruta) {
        const bruto = codigo.replace(/^\{\{\s*|\s*\}\}$/g, '');
        return {
            tipo: 'otro', corto: recortar(bruto || '…'), titulo: 'Campo sin reconocer',
            detalle: 'Revisa el código: doble clic para editarlo.', matiz: MATIZ_NEUTRO,
        };
    }
    if (a.tipo !== 'valor') return describirBloque(a.tipo === 'apertura', a.ruta, ctx);

    const segs = a.ruta.split('.').map((s) => s.trim()).filter(Boolean);
    const raiz = claveNormalizada(segs[0] ?? '');
    const trans = a.filtros.find((f) => esTrans(f.nombre))?.nombre;
    const conc = a.filtros.find((f) => f.nombre === 'concordar');
    const notasFiltro = a.filtros
        .filter((f) => f.nombre !== 'concordar')
        .map((f) => FILTRO_TXT[f.nombre])
        .filter(Boolean);
    const notaOpcional = a.opcional ? 'opcional (queda en blanco si falta)' : '';
    const sufijo = a.opcional ? '?' : '';
    /** `base`: ejemplo sin filtros; con él se muestra cómo saldrá y se omiten las notas de filtros. */
    const hecho = (tipo: InfoMarcador['tipo'], corto: string, titulo: string, matiz: number, base = ''): InfoMarcador => ({
        tipo, corto: recortar(conTrans(corto, trans) + sufijo), titulo,
        detalle: [...(base ? [] : notasFiltro), notaOpcional].filter(Boolean).join(' · '),
        matiz,
        ejemplo: base ? ejemploConFiltros(base, a.filtros) : '',
    });
    const matizFijo = (r: RolResuelto) =>
        r.fijo ? (r.rol === 'cliente' ? MATIZ_CLIENTE : MATIZ_ABOGADO) : matizDeRol(r.rol, ctx);

    // Dato de parte sin asignar: {{sin_parte.nombre}} o {{sin_parte.datos.lugar}}
    if (raiz === ROL_PENDIENTE && segs.length >= 2 && segs.length <= 3) {
        const propio = segs.length === 3 && claveNormalizada(segs[1]) === 'datos';
        const clave = claveCampo(segs[segs.length - 1]);
        let corto: string;
        let largo: string;
        if (propio) {
            largo = ctx.camposPartes?.[clave] ?? humano(clave);
            corto = largo.replace(/\s*\(.*?\)\s*/g, ' ').trim();
        } else {
            [corto, largo] = PERSONA_CAMPO[clave] ?? [humano(clave), etiquetaRol(clave)];
        }
        const base = propio ? ej(ctx.ejemplosPartes, clave) : ej(EJEMPLO_PERSONA, clave);
        return hecho('pendiente', corto, `Sin asignar · ${largo}`, MATIZ_PENDIENTE, base);
    }
    // Dato propio de una parte: {{vendedor.datos.lugar}} o, dentro de un bloque, {{datos.lugar}}
    if (segs.length >= 2 && claveNormalizada(segs[segs.length - 2]) === 'datos') {
        const clave = claveCampo(segs[segs.length - 1]);
        const etiqueta = ctx.camposPartes?.[clave] ?? humano(clave);
        const corto = etiqueta.replace(/\s*\(.*?\)\s*/g, ' ').trim();
        const base = ej(ctx.ejemplosPartes, clave);
        if (segs.length === 3) {
            const r = resolverRol(segs[0], ctx);
            const rol = r?.rol ?? normalizarRol(segs[0]);
            return hecho('persona', corto, `${etiquetaRol(rol)} · ${etiqueta}`, r ? matizFijo(r) : matizDeRol(rol, ctx), base);
        }
        if (segs.length === 2) {
            return hecho('persona', corto, `${etiqueta} · de cada persona del bloque`, MATIZ_NEUTRO, base);
        }
    }

    // Concordancia de género: «el/la/l@s»
    if (conc) {
        const r = resolverRol(raiz, ctx) ?? { rol: raiz, plural: /s$/.test(raiz), fijo: false };
        const [sm = '', sf = '', pm, pf] = conc.args;
        const f: FormasConcordancia = { sm, sf, pm: pm ?? `${sm}s`, pf: pf ?? `${sf}s` };
        const nombre = etiquetaRol(r.plural ? pluralRol(r.rol) : r.rol);
        return {
            tipo: 'genero',
            corto: recortar(compactarGenero(f, r.plural)),
            titulo: `${nombre} (género)`,
            detalle: r.plural
                ? `hombre → ${f.sm} · mujer → ${f.sf} · varios → ${f.pm} · varias → ${f.pf}`
                : `hombre → ${f.sm} · mujer → ${f.sf}`,
            matiz: matizFijo(r),
        };
    }

    // Nombres en una línea: {{vendedores | lista}}
    if (a.filtros.some((f) => f.nombre === 'lista') && segs.length === 1) {
        const r = resolverRol(raiz, ctx);
        const palabra = r ? (r.plural ? pluralRol(r.rol) : r.rol) : raiz;
        return hecho(
            'persona', palabra.replace(/_/g, ' '), `${etiquetaRol(palabra)} · nombres`, r ? matizFijo(r) : MATIZ_NEUTRO,
            'Juan Carlos Pérez Gómez y María López Rojas',
        );
    }

    // Dato de una persona: {{vendedor.nombre}}
    const r = segs.length >= 2 ? resolverRol(raiz, ctx) : null;
    if (r) {
        const ult = claveNormalizada(segs[segs.length - 1]);
        const [corto, largo] = PERSONA_CAMPO[ult] ?? [humano(ult), etiquetaRol(ult)];
        const rep = segs.length >= 3 && claveNormalizada(segs[1]) === 'representante';
        return hecho(
            'persona', rep ? `rep. ${corto}` : corto,
            `${etiquetaRol(r.rol)} · ${largo}${rep ? ' del representante' : ''}`, matizFijo(r),
            ej(EJEMPLO_PERSONA, ult),
        );
    }

    // Dato propio del documento: {{caso.precio}}
    if (raiz === 'caso' && segs.length >= 2) {
        const clave = claveCampo(segs[1]);
        const etiqueta = ctx.campos?.[clave] ?? etiquetaCampoCaso(clave);
        return hecho('dato', etiqueta.replace(/\s*\(.*?\)\s*/g, ' ').trim(), `Dato del caso · ${etiqueta}`, MATIZ_CASO, ej(ctx.ejemplos, clave));
    }

    if (raiz === 'hoy') return hecho('sistema', 'hoy', 'Fecha de hoy', MATIZ_SISTEMA, hoyISO());
    if (raiz === 'expediente' && segs.length === 2) {
        const k = claveNormalizada(segs[1]);
        const [corto, largo] = EXPEDIENTE_CAMPO[k] ?? [humano(segs[1]), etiquetaRol(segs[1])];
        return hecho('sistema', corto, `Expediente · ${largo}`, MATIZ_SISTEMA, ej(EJEMPLO_EXPEDIENTE, k));
    }

    // Dentro de un bloque: {{nombre}}, {{ci}}…
    if (segs.length === 1 && PERSONA_CAMPO[raiz]) {
        const [corto, largo] = PERSONA_CAMPO[raiz];
        return hecho('persona', corto, `${largo} · de cada persona del bloque`, MATIZ_NEUTRO, ej(EJEMPLO_PERSONA, raiz));
    }

    const ult = segs[segs.length - 1] ?? a.ruta;
    return hecho('otro', humano(ult), `Campo · ${a.ruta}`, MATIZ_NEUTRO);
}

/* ---------------- Edición guiada ---------------- */
export type Transformacion = '' | 'mayus' | 'minus' | 'titulo';
export type Formato = '' | 'fecha' | 'fechalarga' | 'moneda' | 'dolares' | 'superficie' | 'literal';

export const TRANSFORMACIONES: { valor: Transformacion; etiqueta: string }[] = [
    { valor: '', etiqueta: 'Tal como está escrito' },
    { valor: 'mayus', etiqueta: 'MAYÚSCULAS' },
    { valor: 'minus', etiqueta: 'minúsculas' },
    { valor: 'titulo', etiqueta: 'Mayúscula Inicial' },
];

const FORMATOS_FILTRO: { valor: Formato; etiqueta: string }[] = [
    { valor: '', etiqueta: 'Tal cual' },
    { valor: 'fecha', etiqueta: 'Fecha en letras (9 de octubre de 2026)' },
    { valor: 'fechalarga', etiqueta: 'Fecha completa (nueve (9) días del mes de octubre del año 2026)' },
    { valor: 'moneda', etiqueta: 'Monto con su literal (Bs. 1.500,00 …)' },
    { valor: 'dolares', etiqueta: 'Monto en dólares con su literal ($us. 1.500,00 …)' },
    { valor: 'superficie', etiqueta: 'Superficie con su literal (250 m² …)' },
    { valor: 'literal', etiqueta: 'Número en letras (doce)' },
];

export function formatosPara(ruta: string, actual: Formato = ''): { valor: Formato; etiqueta: string }[] {
    const segs = ruta.split('.');
    const ult = claveNormalizada(segs[segs.length - 1] ?? '');
    const propio = claveNormalizada(segs[0] ?? '') === 'caso' || segs.some((s) => claveNormalizada(s) === 'datos');
    const esFecha = ult === 'fecha_nacimiento' || claveNormalizada(segs[0] ?? '') === 'hoy';
    let l = FORMATOS_FILTRO;
    if (!propio) l = esFecha ? FORMATOS_FILTRO.slice(0, 3) : FORMATOS_FILTRO.slice(0, 1);
    return actual && !l.some((f) => f.valor === actual) ? [...l, ...FORMATOS_FILTRO.filter((f) => f.valor === actual)] : l;
}

export type EdicionMarcador =
    | { n: 'genero'; ruta: string; formas: FormasConcordancia }
    | { n: 'dato'; ruta: string; opcional: boolean; transformacion: Transformacion; formato: Formato }
    | { n: 'bloque'; abre: boolean; ruta: string }
    | { n: 'libre' };

export function editarMarcador(crudo: string): EdicionMarcador {
    const a = analizarMarcador(crudo);
    if (!a || !a.ruta) return { n: 'libre' };
    if (a.tipo !== 'valor') return { n: 'bloque', abre: a.tipo === 'apertura', ruta: a.ruta };
    const conc = a.filtros.find((f) => f.nombre === 'concordar');
    if (conc) {
        if (a.filtros.length !== 1 || conc.args.length < 2) return { n: 'libre' };
        const [sm, sf, pm, pf] = conc.args;
        return { n: 'genero', ruta: a.ruta, formas: { sm, sf, pm: pm ?? `${sm}s`, pf: pf ?? `${sf}s` } };
    }
    const trans = a.filtros.filter((f) => esTrans(f.nombre));
    const forma = a.filtros.filter((f) => (['fecha', 'fechalarga', 'moneda', 'dolares', 'superficie', 'literal'] as string[]).includes(f.nombre));
    if (
        trans.length + forma.length !== a.filtros.length || trans.length > 1 || forma.length > 1
        || a.filtros.some((f) => f.args.length > 0)
    ) return { n: 'libre' };
    return {
        n: 'dato', ruta: a.ruta, opcional: a.opcional,
        transformacion: (trans[0]?.nombre ?? '') as Transformacion,
        formato: (forma[0]?.nombre ?? '') as Formato,
    };
}

export function armarDato(e: { ruta: string; opcional: boolean; transformacion: Transformacion; formato: Formato }): string {
    const filtros: FiltroMarcador[] = [];
    if (e.formato) filtros.push({ nombre: e.formato, args: [] });
    if (e.transformacion) filtros.push({ nombre: e.transformacion, args: [] });
    return armarMarcador({ ruta: e.ruta, opcional: e.opcional, filtros });
}

export function armarGenero(ruta: string, f: FormasConcordancia, varias: boolean): string {
    const q = (s: string) => `"${s.replace(/"/g, '').trim()}"`;
    const auto = formasConcordancia(f.sm);
    const args = varias
        ? [f.sm, f.sf, f.pm.trim() || auto.pm, f.pf.trim() || auto.pf]
        : [f.sm, f.sf];
    return `{{${ruta} | concordar:${args.map(q).join(':')}}}`;
}