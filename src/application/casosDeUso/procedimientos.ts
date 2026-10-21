import { ErrorDeDatos } from '../../domain/errores';
import { normalizarMateria } from '../../domain/fuenteModelo';
import { nuevoId } from '../../domain/id';
import {
    leerFlujo, leerRequisitos, normalizarProcedimiento, renovarIds,
    type DatosProcedimiento, type Procedimiento, type ProcedimientoResumen,
} from '../../domain/procedimientos';
import { PROCEDIMIENTOS_INICIALES } from '../../domain/procedimientosIniciales';
import type { DbPuerto, Fila } from '../puertos/db';
import { actualizar, insertar } from '../sql';

const t = (v: unknown) => (v == null ? '' : String(v));
const nulo = (v: string) => v.trim() || null;
const json = (v: unknown): unknown => {
    try {
        return JSON.parse(t(v) || 'null');
    } catch {
        return null;
    }
};

const columnas = (d: DatosProcedimiento): Record<string, unknown> => ({
    nombre: d.nombre,
    materia: nulo(normalizarMateria(d.materia) ?? ''),
    descripcion: nulo(d.descripcion),
    base_legal: nulo(d.baseLegal),
    requisitos_json: JSON.stringify(d.requisitos),
    flujo_json: JSON.stringify(d.flujo),
});

const detalle = (d: DatosProcedimiento) => ({ requisitos: d.requisitos.length, pasos: d.flujo.pasos.length });

/** Requisitos de un trámite y su flujograma procedimental. */
export class Procedimientos {
    constructor(private readonly db: DbPuerto) { }

    async listar(): Promise<ProcedimientoResumen[]> {
        const filas = await this.db.consultar<Fila>(
            `SELECT id, nombre, materia, descripcion, base_legal, updated_at,
                    CASE WHEN json_valid(requisitos_json) THEN json_array_length(requisitos_json) ELSE 0 END AS n_req,
                    CASE WHEN json_valid(flujo_json) THEN COALESCE(json_array_length(flujo_json, '$.pasos'), 0) ELSE 0 END AS n_pasos
             FROM procedimiento WHERE deleted_at IS NULL ORDER BY nombre COLLATE NOCASE`,
        );
        return filas.map((f) => ({
            id: t(f.id), nombre: t(f.nombre), materia: t(f.materia), descripcion: t(f.descripcion),
            baseLegal: t(f.base_legal), numRequisitos: Number(f.n_req ?? 0), numPasos: Number(f.n_pasos ?? 0),
            actualizadoEn: t(f.updated_at),
        }));
    }

    async obtener(id: string): Promise<Procedimiento | null> {
        const [f] = await this.db.consultar<Fila>('SELECT * FROM procedimiento WHERE id = ?1 AND deleted_at IS NULL', [id]);
        if (!f) return null;
        const requisitos = leerRequisitos(json(f.requisitos_json));
        return {
            id: t(f.id), nombre: t(f.nombre), materia: t(f.materia), descripcion: t(f.descripcion),
            baseLegal: t(f.base_legal), requisitos, flujo: leerFlujo(json(f.flujo_json), requisitos),
            creadoEn: t(f.created_at), actualizadoEn: t(f.updated_at),
        };
    }

    async crear(entrada: DatosProcedimiento): Promise<string> {
        const d = normalizarProcedimiento(entrada);
        const id = nuevoId();
        const ahora = new Date().toISOString();
        await this.db.transaccion(
            [insertar('procedimiento', { id, ...columnas(d), created_at: ahora, updated_at: ahora })],
            [{ accion: 'procedimiento.crear', entidad: 'procedimiento', entidadId: id, detalle: detalle(d) }],
        );
        return id;
    }

    async guardar(id: string, entrada: DatosProcedimiento): Promise<void> {
        const d = normalizarProcedimiento(entrada);
        const [f] = await this.db.consultar<{ id: string }>(
            'SELECT id FROM procedimiento WHERE id = ?1 AND deleted_at IS NULL',
            [id],
        );
        if (!f) throw new ErrorDeDatos('El procedimiento ya no existe');
        await this.db.transaccion(
            [actualizar('procedimiento', id, { ...columnas(d), updated_at: new Date().toISOString() })],
            [{ accion: 'procedimiento.guardar', entidad: 'procedimiento', entidadId: id, detalle: detalle(d) }],
        );
    }

    async duplicar(id: string): Promise<string> {
        const p = await this.obtener(id);
        if (!p) throw new ErrorDeDatos('El procedimiento ya no existe');
        return this.crear(renovarIds({
            nombre: `Copia de ${p.nombre}`, materia: p.materia, descripcion: p.descripcion,
            baseLegal: p.baseLegal, requisitos: p.requisitos, flujo: p.flujo,
        }));
    }

    /** Borrado lógico. */
    async eliminar(id: string): Promise<void> {
        const [f] = await this.db.consultar<{ id: string }>(
            'SELECT id FROM procedimiento WHERE id = ?1 AND deleted_at IS NULL',
            [id],
        );
        if (!f) throw new ErrorDeDatos('El procedimiento ya no existe');
        await this.db.transaccion(
            [{ sql: 'UPDATE procedimiento SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1', params: [id, new Date().toISOString()] }],
            [{ accion: 'procedimiento.eliminar', entidad: 'procedimiento', entidadId: id }],
        );
    }

    async instalarInicial(indice: number): Promise<string> {
        const p = PROCEDIMIENTOS_INICIALES[indice];
        if (!p) throw new ErrorDeDatos('Plantilla no encontrada');
        return this.crear(renovarIds(p));
    }
}