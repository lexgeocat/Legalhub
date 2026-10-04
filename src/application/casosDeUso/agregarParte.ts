import { ErrorDeDatos } from '../../domain/errores';
import { nuevoId } from '../../domain/id';
import { normalizarRol } from '../../domain/texto';
import type { DbPuerto } from '../puertos/db';
import { insertar } from '../sql';

export interface DatosParte {
    expedienteId: string;
    personaId: string;
    rol: string;
    domicilioProcesal?: string;
    representanteId?: string;
    datosOverride?: Record<string, unknown>;
}

export class AgregarParte {
    constructor(private readonly db: DbPuerto) { }

    async ejecutar(d: DatosParte): Promise<string> {
        const rol = normalizarRol(d.rol ?? '');
        if (!rol) throw new ErrorDeDatos('Falta el rol de la parte');
        if (!d.personaId) throw new ErrorDeDatos('Elige una persona');
        const [{ orden }] = await this.db.consultar<{ orden: number }>(
            'SELECT COALESCE(MAX(orden), -1) + 1 AS orden FROM expediente_parte WHERE expediente_id = ?1 AND rol = ?2',
            [d.expedienteId, rol],
        );
        const id = nuevoId();
        await this.db.transaccion(
            [
                insertar('expediente_parte', {
                    id, expediente_id: d.expedienteId, persona_id: d.personaId, rol, orden,
                    domicilio_procesal: d.domicilioProcesal ?? null,
                    representante_id: d.representanteId ?? null,
                    datos_override_json: JSON.stringify(d.datosOverride ?? {}),
                }),
            ],
            [{ accion: 'parte.agregar', entidad: 'expediente_parte', entidadId: id, detalle: { expedienteId: d.expedienteId, rol } }],
        );
        return id;
    }
}