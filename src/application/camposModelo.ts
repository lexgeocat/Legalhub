import { datoDeParteEnRuta, mismoRol } from '../domain/catalogo';
import type { CampoParte, CampoPropio, FuenteModelo, TipoCampo } from '../domain/fuenteModelo';
import { claveCampo, claveNormalizada } from '../domain/texto';
import type { CampoEsquema } from './puertos/motorPlantillas';
const USO_CASO = /\{\{\s*caso\.([\p{L}_][\p{L}\p{N}_]*)\s*(\?)?/giu;

const TIPO_DESDE_ESQUEMA: Record<string, TipoCampo> = {
    moneda: 'moneda', fecha: 'fecha', superficie: 'superficie', numero: 'numero',
};

export function esTextoLargo(clave: string): boolean {
    return /hechos|petitorio|descripcion|observacion|fundamento|consulta|conclusion|facultades|objeto/.test(claveNormalizada(clave));
}

/** Tipo más probable de un campo «caso.x» según su nombre (precio → monto, fecha_hecho → fecha…). */
export function tipoSugerido(clave: string): TipoCampo {
    const k = claveNormalizada(clave);
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

export function analizarCampos(fuente: Pick<FuenteModelo, 'texto' | 'campos'>): AnalisisCampos {
    const errores: string[] = [];
    const advertencias: string[] = [];
    const usos = usosCaso(fuente.texto);
    const vistas = new Set<string>();

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
export function aplicarCampos(
    esquema: CampoEsquema[], campos: CampoPropio[], camposPartes: readonly CampoParte[] = [],
): CampoEsquema[] {
    const propios = new Map(campos.map((c) => [claveCampo(c.clave), c] as const));
    return esquema.map((e) => {
        const d = datoDeParteEnRuta(e.path, e.ambito ?? []);
        if (d) {
            const cp = camposPartes.find(
                (c) => !c.ficha && claveCampo(c.clave) === d.clave && (d.rol === null || mismoRol(c.rol, d.rol)),
            );
            if (!cp) return e;
            return { ...e, etiqueta: cp.etiqueta.trim() || e.etiqueta, tipo: e.tipo === 'texto' ? cp.tipo : e.tipo };
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