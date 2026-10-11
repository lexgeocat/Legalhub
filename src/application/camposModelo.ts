import { ROL_PENDIENTE, datoDeParteEnRuta, mismoRol } from '../domain/catalogo';
import type { CampoPropio, FuenteModelo, GrupoDatos, TipoCampo } from '../domain/fuenteModelo';
import { claveCampo, claveNormalizada, etiquetaRol, normalizarRol } from '../domain/texto';
import { ROLES_CONOCIDOS } from '../domain/tiposExpediente';
import type { CampoEsquema } from './puertos/motorPlantillas';
const USO_CASO = /\{\{\s*caso\.([\p{L}_][\p{L}\p{N}_]*)\s*(\?)?/giu;

const TIPO_DESDE_ESQUEMA: Record<string, TipoCampo> = {
    moneda: 'moneda', dolares: 'dolares', fecha: 'fecha', superficie: 'superficie', numero: 'numero',
};
export function esTextoLargo(clave: string): boolean {
    return /hechos|petitorio|descripcion|observacion|fundamento|consulta|conclusion|facultades|objeto/.test(claveNormalizada(clave));
}

export function tipoSugerido(clave: string): TipoCampo {
    const k = claveNormalizada(clave);
    if (/dolar|(^|_)(usd|sus|us)(_|$)/.test(k)) return 'dolares';
    if (/precio|monto|cuantia|importe|costo|honorario|canon/.test(k)) return 'moneda';
    if (/(^|_)fecha(_|$)/.test(k)) return 'fecha';
    if (/superficie/.test(k)) return 'superficie';
    return esTextoLargo(k) ? 'texto_largo' : 'texto';
}

export function esCampoCaso(path: string): boolean {
    return claveNormalizada(path.split('.')[0]) === 'caso';
}

/** Claves «caso.x» que usa el texto; `opcional` es true solo si todos sus usos llevan «?». */
export function usosCaso(texto: string): Map<string, { opcional: boolean }> {
    const usos = new Map<string, { opcional: boolean }>();
    for (const m of texto.matchAll(USO_CASO)) {
        const clave = claveNormalizada(m[1]);
        const opcional = m[2] === '?';
        const previo = usos.get(clave);
        usos.set(clave, { opcional: previo ? previo.opcional && opcional : opcional });
    }
    return usos;
}

export interface AnalisisCampos {
    errores: string[];
    advertencias: string[];
}

/** Datos de parte insertados pero aún sin asignar a una parte: «{{sin_parte.nombre}}». */
export function contarPendientes(texto: string): number {
    return [...texto.matchAll(new RegExp(`\\{\\{\\s*${ROL_PENDIENTE}\\.`, 'giu'))].length;
}
export function analizarCampos(fuente: Pick<FuenteModelo, 'texto' | 'campos'>): AnalisisCampos {
    const errores: string[] = [];
    const advertencias: string[] = [];
    const usos = usosCaso(fuente.texto);
    const vistas = new Set<string>();
    const pendientes = contarPendientes(fuente.texto);
    if (pendientes > 0) {
        // Si prefieres poder guardar borradores con pendientes, cambia «errores» por «advertencias».
        errores.push(
            `Hay ${pendientes} dato${pendientes === 1 ? '' : 's'} de parte sin asignar (se ven en ámbar). `
            + 'Clic derecho sobre cada uno → «Asignar a…», o usa «Asignarle los pendientes» en la pestaña Partes.',
        );
    }

    for (const c of fuente.campos) {
        const clave = claveCampo(c.clave);
        const nombre = c.etiqueta.trim() || c.clave || '(sin nombre)';
        if (!clave) {
            errores.push(`El campo «${nombre}» no tiene una clave válida`);
            continue;
        }
        if (vistas.has(clave)) {
            errores.push(`El campo «${clave}» está repetido`);
            continue;
        }
        vistas.add(clave);
        const uso = usos.get(clave);
        if (!uso) {
            advertencias.push(`El campo «${nombre}» está declarado pero no aparece en el texto`);
        } else if (!c.requerido && !uso.opcional) {
            advertencias.push(`«${nombre}» es opcional, pero el texto lo usa sin «?»: si queda vacío, la generación se detendrá`);
        }
    }
    for (const clave of usos.keys()) {
        if (!vistas.has(clave)) {
            advertencias.push(`«caso.${clave}» se usa en el texto pero no está declarado: se pedirá con un nombre automático`);
        }
    }
    return { errores, advertencias };
}

/** Aplica etiqueta y tipo de los campos declarados sobre el esquema escaneado. El filtro del marcador (moneda, fecha…) manda sobre el tipo declarado. */
/** Aplica etiqueta y tipo de los campos declarados sobre el esquema escaneado. El filtro del marcador (moneda, fecha…) manda sobre el tipo declarado. */
export function aplicarCampos(
    esquema: CampoEsquema[], campos: CampoPropio[], grupos: readonly GrupoDatos[] = [],
): CampoEsquema[] {
    const propios = new Map(campos.map((c) => [claveCampo(c.clave), c] as const));
    const propiosParte = new Map(
        grupos.flatMap((g) => g.datos).filter((d) => !d.ficha).map((d) => [claveCampo(d.clave), d] as const),
    );
    return esquema.map((e) => {
        const d = datoDeParteEnRuta(e.path, e.ambito ?? []);
        if (d) {
            const dp = propiosParte.get(d.clave);
            if (!dp) return e;
            return { ...e, etiqueta: dp.etiqueta.trim() || e.etiqueta, tipo: e.tipo === 'texto' ? dp.tipo : e.tipo };
        }
        const partes = e.path.split('.');
        if (partes.length !== 2 || claveNormalizada(partes[0]) !== 'caso') return e;
        const propio = propios.get(claveNormalizada(partes[1]));
        if (!propio) return e;
        return {
            ...e,
            etiqueta: propio.etiqueta.trim() || e.etiqueta,
            tipo: e.tipo === 'texto' ? propio.tipo : e.tipo,
        };
    });
}
/**
 * Campos que el formulario puede pedir: los de la raíz y los «caso.*» aunque estén
 * dentro de un bucle (el resolver los busca hacia arriba). Sin duplicados.
 */
export function camposParaFormulario(esquema: CampoEsquema[]): CampoEsquema[] {
    const salida = new Map<string, CampoEsquema>();
    for (const c of esquema) {
        if (c.path === '.') continue;
        if (c.ambito.length > 0 && !esCampoCaso(c.path)) continue;
        const clave = claveNormalizada(c.path);
        const previo = salida.get(clave);
        if (!previo) salida.set(clave, { ...c });
        else if (c.requerido) previo.requerido = true;
    }
    return [...salida.values()];
}

/** Deduce los campos propios de un modelo de Word a partir de su esquema (para convertirlo a editable). */
export function camposDesdeEsquema(esquema: CampoEsquema[]): CampoPropio[] {
    const salida = new Map<string, CampoPropio>();
    for (const c of esquema) {
        const partes = c.path.split('.');
        if (partes.length !== 2 || claveNormalizada(partes[0]) !== 'caso') continue;
        const clave = claveNormalizada(partes[1]);
        const previo = salida.get(clave);
        if (previo) {
            if (c.requerido) previo.requerido = true;
            continue;
        }
        salida.set(clave, {
            clave,
            etiqueta: c.etiqueta,
            tipo: TIPO_DESDE_ESQUEMA[c.tipo] ?? (esTextoLargo(clave) ? 'texto_largo' : 'texto'),
            requerido: c.requerido,
        });
    }
    return [...salida.values()];
}
/* ---------------- Ficha de un modelo: qué pide, para mostrarlo en el expediente ---------------- */
export interface DatoCasoFicha { clave: string; etiqueta: string; tipo: string; requerido: boolean }
export interface DatoParteFicha extends DatoCasoFicha { rol: string }
export interface FichaModelo {
    /** Roles (singular) que usa el modelo: vendedor, comprador… */
    roles: string[];
    /** Datos «caso.*» que pide el modelo. */
    caso: DatoCasoFicha[];
    /** Datos propios de las partes («vendedor.datos.x») que pide el modelo. */
    datosParte: DatoParteFicha[];
}

export function fichaDeModelo(esquema: CampoEsquema[], rolesDeclarados: readonly string[] = []): FichaModelo {
    const roles = new Set(rolesDeclarados.map(normalizarRol).filter(Boolean));
    const canonico = (texto: string): string => {
        const t = texto.replace(/^hay_/i, '');
        return [...roles, ...ROLES_CONOCIDOS].find((r) => mismoRol(r, t)) ?? '';
    };
    const caso = new Map<string, DatoCasoFicha>();
    const datosParte = new Map<string, DatoParteFicha>();

    for (const c of esquema) {
        const ambito = c.ambito ?? [];
        for (const a of ambito) {
            const r = canonico(a);
            if (r) roles.add(r);
        }
        const segs = c.path.split('.');
        const primero = canonico(segs[0]);
        if (primero) roles.add(primero);

        const d = datoDeParteEnRuta(c.path, ambito);
        if (d) {
            if (!d.rol) continue;
            const rol = canonico(d.rol) || normalizarRol(d.rol);
            roles.add(rol);
            const k = `${rol}|${d.clave}`;
            const previo = datosParte.get(k);
            if (previo) previo.requerido ||= c.requerido;
            else {
                datosParte.set(k, {
                    rol, clave: d.clave, etiqueta: c.etiqueta || etiquetaRol(d.clave),
                    tipo: c.tipo || 'texto', requerido: c.requerido,
                });
            }
            continue;
        }

        if (segs.length === 2 && claveNormalizada(segs[0]) === 'caso') {
            const clave = claveCampo(segs[1]);
            if (!clave) continue;
            const previo = caso.get(clave);
            if (previo) previo.requerido ||= c.requerido;
            else caso.set(clave, { clave, etiqueta: c.etiqueta || etiquetaRol(clave), tipo: c.tipo || 'texto', requerido: c.requerido });
        }
    }
    return { roles: [...roles], caso: [...caso.values()], datosParte: [...datosParte.values()] };
}