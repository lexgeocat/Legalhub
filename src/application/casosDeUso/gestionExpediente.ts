import { ErrorDeDatos } from '../../domain/errores';
import { claveCampo } from '../../domain/texto';
import { obtenerTipo } from '../../domain/tiposExpediente';
import type { DbPuerto } from '../puertos/db';
import { actualizar } from '../sql';

export const ESTADOS_VALIDOS = ['abierto', 'en_tramite', 'suspendido', 'cerrado', 'archivado'];

/** Normaliza las claves («Lugar de firma» → lugar_firma) y descarta vacíos. */
export function limpiarDatos(datos: Record<string, string>): Record<string, string> {
    const salida: Record<string, string> = {};
    for (const [k, v] of Object.entries(datos)) {
        const clave = claveCampo(k);
        const valor = String(v ?? '').trim();
        if (clave && valor) salida[clave] = valor;
    }
    return salida;
}

export interface CambiosExpediente {
    tipo?: string;
    materia?: string;
    referencia?: string;
    estado?: string;
    juzgado?: string;
    nroCausa?: string;
    clienteId?: string;
    /** Reemplaza todos los datos del caso. */
    datos?: Record<string, string>;
}

export class ActualizarExpediente {
    constructor(private readonly db: DbPuerto) { }

    async ejecutar(id: string, c: CambiosExpediente): Promise<void> {
        const v: Record<string, unknown> = {};
        if (c.materia !== undefined) {
            const m = c.materia.trim();
            if (!m) throw new ErrorDeDatos('El asunto no puede quedar vacío');
            v.materia = m;
        }
        if (c.tipo !== undefined) v.tipo = obtenerTipo(c.tipo).clave;
        if (c.referencia !== undefined) v.referencia = c.referencia.trim() || null;
        if (c.estado !== undefined) {
            if (!ESTADOS_VALIDOS.includes(c.estado)) throw new ErrorDeDatos(`Estado inválido: ${c.estado}`);
            v.estado = c.estado;
        }
        if (c.juzgado !== undefined) v.juzgado = c.juzgado.trim() || null;
        if (c.nroCausa !== undefined) v.nro_causa = c.nroCausa.trim() || null;
        if (c.clienteId !== undefined) {
            if (!c.clienteId) throw new ErrorDeDatos('Elige al cliente');
            v.cliente_id = c.clienteId;
        }
        if (c.datos !== undefined) v.datos_json = JSON.stringify(limpiarDatos(c.datos));

        const campos = Object.keys(v);
        if (campos.length === 0) return;
        v.updated_at = new Date().toISOString();
        await this.db.transaccion(
            [actualizar('expediente', id, v)],
            [{ accion: 'expediente.actualizar', entidad: 'expediente', entidadId: id, detalle: { campos } }],
        );
    }
}

export class QuitarParte {
    constructor(private readonly db: DbPuerto) { }

    async ejecutar(parteId: string): Promise<void> {
        await this.db.transaccion(
            [{ sql: 'DELETE FROM expediente_parte WHERE id = ?1', params: [parteId] }],
            [{ accion: 'parte.quitar', entidad: 'expediente_parte', entidadId: parteId }],
        );
    }
}

/** Guarda los datos propios de una parte (los que el abogado creó en sus modelos) dentro de datos_override_json. */
export class ActualizarDatosParte {
    constructor(private readonly db: DbPuerto) { }

    async ejecutar(parteId: string, datos: Record<string, string>): Promise<void> {
        const [f] = await this.db.consultar<{ datos_override_json: string | null }>(
            'SELECT datos_override_json FROM expediente_parte WHERE id = ?1',
            [parteId],
        );
        if (!f) throw new ErrorDeDatos('La parte ya no existe');
        let previo: Record<string, unknown> = {};
        try {
            const o: unknown = JSON.parse(f.datos_override_json || '{}');
            if (typeof o === 'object' && o !== null && !Array.isArray(o)) previo = o as Record<string, unknown>;
        } catch {
            /* JSON dañado: se reemplaza */
        }
        const limpios = limpiarDatos(datos);
        const nuevo: Record<string, unknown> = { ...previo };
        if (Object.keys(limpios).length > 0) nuevo.datos = limpios;
        else delete nuevo.datos;
        await this.db.transaccion(
            [actualizar('expediente_parte', parteId, { datos_override_json: JSON.stringify(nuevo) })],
            [{ accion: 'parte.datos', entidad: 'expediente_parte', entidadId: parteId, detalle: { campos: Object.keys(limpios).length } }],
        );
    }
}