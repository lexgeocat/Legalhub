import { ErrorDeDatos } from '../../domain/errores';
import { aDecimal } from '../../domain/filtros/numeros';
import { nuevoId } from '../../domain/id';
import type { DbPuerto, Sentencia } from '../puertos/db';
import { insertar } from '../sql';

export interface DatosInmueble {
    tipo?: string; departamento?: string; provincia?: string; municipio?: string; localidad?: string;
    superficieM2?: string; matricula?: string; codigoCatastral?: string; ubicacion?: string;
    colindancias?: Partial<Record<'norte' | 'sur' | 'este' | 'oeste', string>>;
    gravamenes?: string; observaciones?: string;
    titulares?: { personaId: string; porcentaje?: string }[];
    expedienteId?: string;
}

export class CrearInmueble {
    constructor(private readonly db: DbPuerto) { }

    async ejecutar(d: DatosInmueble): Promise<string> {
        let superficie: string | null = null;
        if (d.superficieM2) {
            const s = aDecimal(d.superficieM2, 'valor de superficie');
            if (s.isNegative() || s.decimalPlaces() > 2) throw new ErrorDeDatos('Superficie inválida (≥ 0, máximo 2 decimales)');
            superficie = s.toString();
        }
        for (const t of d.titulares ?? []) {
            if (!t.porcentaje) continue;
            const p = aDecimal(t.porcentaje, 'porcentaje');
            if (p.isNegative() || p.greaterThan(100)) throw new ErrorDeDatos('El porcentaje debe estar entre 0 y 100');
        }
        const id = nuevoId();
        const ahora = new Date().toISOString();
        const sentencias: Sentencia[] = [
            insertar('inmueble', {
                id, tipo: d.tipo, departamento: d.departamento, provincia: d.provincia, municipio: d.municipio,
                localidad: d.localidad, superficie_m2: superficie, matricula: d.matricula,
                codigo_catastral: d.codigoCatastral, ubicacion: d.ubicacion,
                colindancias_json: JSON.stringify(d.colindancias ?? {}),
                gravamenes: d.gravamenes, observaciones: d.observaciones, created_at: ahora, updated_at: ahora,
            }),
            ...(d.titulares ?? []).map((t) =>
                insertar('inmueble_titular', { inmueble_id: id, persona_id: t.personaId, porcentaje: t.porcentaje ?? null }),
            ),
        ];
        if (d.expedienteId) sentencias.push(insertar('expediente_inmueble', { expediente_id: d.expedienteId, inmueble_id: id }));
        await this.db.transaccion(sentencias, [{ accion: 'inmueble.crear', entidad: 'inmueble', entidadId: id }]);
        return id;
    }
}