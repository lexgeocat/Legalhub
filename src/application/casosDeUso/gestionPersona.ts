import { ErrorDeDatos } from '../../domain/comun/errores';
import type { DbPuerto } from '../puertos/db';
import { actualizar } from '../sql';
import { columnasPersona, validarPersona, type DatosPersona } from './crearPersona';

export class ActualizarPersona {
    constructor(private readonly db: DbPuerto) { }

    async ejecutar(id: string, entrada: DatosPersona): Promise<void> {
        const d = validarPersona(entrada);
        await this.db.transaccion(
            [actualizar('persona', id, { ...columnasPersona(d), updated_at: new Date().toISOString() })],
            [{ accion: 'persona.actualizar', entidad: 'persona', entidadId: id }],
        );
    }
}

export class EliminarPersona {
    constructor(private readonly db: DbPuerto) { }

    /** Borrado lógico. Se bloquea si la persona está vinculada, para no perder partes en silencio. */
    async ejecutar(id: string): Promise<void> {
        const [abogado] = await this.db.consultar<{ valor: string }>(
            "SELECT valor FROM configuracion WHERE clave = 'abogado_persona_id'",
        );
        if (abogado?.valor === id) {
            throw new ErrorDeDatos('Es tu ficha de abogado (Configuración): no se puede eliminar.');
        }
        const [{ n }] = await this.db.consultar<{ n: number }>(
            `SELECT (SELECT COUNT(*) FROM expediente_parte ep
                       JOIN expediente e ON e.id = ep.expediente_id
                      WHERE ep.persona_id = ?1 AND e.deleted_at IS NULL)
                  + (SELECT COUNT(*) FROM expediente WHERE cliente_id = ?1 AND deleted_at IS NULL)
                  + (SELECT COUNT(*) FROM inmueble_titular it
                       JOIN inmueble i ON i.id = it.inmueble_id
                      WHERE it.persona_id = ?1 AND i.deleted_at IS NULL)
                  + (SELECT COUNT(*) FROM persona WHERE representante_id = ?1 AND deleted_at IS NULL) AS n`,
            [id],
        );
        if (n > 0) {
            throw new ErrorDeDatos('No se puede eliminar: la persona figura en expedientes, inmuebles o como representante. Quítala de ahí primero.');
        }
        const ahora = new Date().toISOString();
        await this.db.transaccion(
            [{ sql: 'UPDATE persona SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1', params: [id, ahora] }],
            [{ accion: 'persona.eliminar', entidad: 'persona', entidadId: id }],
        );
    }
}

/** Personas vigentes que no figuran en ningún expediente, inmueble ni como representante. ?1 = persona a conservar. */
const SIN_VINCULOS = `
    p.deleted_at IS NULL
    AND p.id <> ?1
    AND NOT EXISTS (SELECT 1 FROM expediente_parte ep JOIN expediente e ON e.id = ep.expediente_id
                    WHERE ep.persona_id = p.id AND e.deleted_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM expediente e WHERE e.cliente_id = p.id AND e.deleted_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM inmueble_titular it JOIN inmueble i ON i.id = it.inmueble_id
                    WHERE it.persona_id = p.id AND i.deleted_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM persona r WHERE r.representante_id = p.id AND r.deleted_at IS NULL)`;

/** Borrado lógico masivo de personas huérfanas (p. ej. tras eliminar expedientes). */
export class LimpiarPersonasSinVinculos {
    constructor(private readonly db: DbPuerto) { }

    /** `conservar`: persona que no se toca (la ficha del abogado). */
    async contar(conservar: string | null): Promise<number> {
        const [f] = await this.db.consultar<{ n: number }>(
            `SELECT COUNT(*) AS n FROM persona p WHERE ${SIN_VINCULOS}`,
            [conservar ?? ''],
        );
        return Number(f?.n ?? 0);
    }

    async ejecutar(conservar: string | null): Promise<number> {
        const n = await this.contar(conservar);
        if (n === 0) return 0;
        const ahora = new Date().toISOString();
        await this.db.transaccion(
            [{
                sql: `UPDATE persona SET deleted_at = ?2, updated_at = ?2
                      WHERE id IN (SELECT p.id FROM persona p WHERE ${SIN_VINCULOS})`,
                params: [conservar ?? '', ahora],
            }],
            [{ accion: 'persona.limpiar', detalle: { personas: n } }],
        );
        return n;
    }
}

/** Pasa todos los vínculos de una ficha repetida a la que se conserva y quita la repetida de las listas. */
export class UnificarPersonas {
    constructor(private readonly db: DbPuerto) { }

    async ejecutar(principalId: string, repetidaId: string): Promise<void> {
        if (!principalId || principalId === repetidaId) throw new ErrorDeDatos('Elige dos personas distintas');
        const vivas = await this.db.consultar<{ id: string }>(
            'SELECT id FROM persona WHERE id IN (?1, ?2) AND deleted_at IS NULL',
            [principalId, repetidaId],
        );
        if (vivas.length !== 2) throw new ErrorDeDatos('Alguna de las personas ya no existe');
        const par = [principalId, repetidaId];
        const ahora = new Date().toISOString();
        await this.db.transaccion(
            [
                // Si la principal ya figura con ese rol en el mismo expediente, se descarta la fila repetida.
                {
                    sql: `DELETE FROM expediente_parte
                          WHERE persona_id = ?2
                            AND EXISTS (SELECT 1 FROM expediente_parte x
                                        WHERE x.expediente_id = expediente_parte.expediente_id
                                          AND x.rol = expediente_parte.rol AND x.persona_id = ?1)`,
                    params: par,
                },
                { sql: 'UPDATE expediente_parte SET persona_id = ?1 WHERE persona_id = ?2', params: par },
                { sql: 'UPDATE expediente_parte SET representante_id = ?1 WHERE representante_id = ?2', params: par },
                { sql: 'UPDATE expediente SET cliente_id = ?1, updated_at = ?3 WHERE cliente_id = ?2', params: [...par, ahora] },
                { sql: 'UPDATE persona SET representante_id = ?1 WHERE representante_id = ?2 AND id <> ?1', params: par },
                {
                    sql: `DELETE FROM inmueble_titular WHERE persona_id = ?2
                          AND inmueble_id IN (SELECT inmueble_id FROM inmueble_titular WHERE persona_id = ?1)`,
                    params: par,
                },
                { sql: 'UPDATE inmueble_titular SET persona_id = ?1 WHERE persona_id = ?2', params: par },
                { sql: "UPDATE configuracion SET valor = ?1 WHERE clave = 'abogado_persona_id' AND valor = ?2", params: par },
                { sql: 'UPDATE persona SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1', params: [repetidaId, ahora] },
            ],
            [{ accion: 'persona.unificar', entidad: 'persona', entidadId: principalId, detalle: { repetida: repetidaId } }],
        );
    }
}