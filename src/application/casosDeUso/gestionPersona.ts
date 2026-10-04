import { ErrorDeDatos } from '../../domain/errores';
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