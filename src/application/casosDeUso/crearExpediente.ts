import type { Expediente } from '../../domain/entidades';
import { nuevoId } from '../../domain/id';
import type { DbPuerto } from '../puertos/db';

export type DatosNuevoExpediente = Omit<
  Expediente,
  'id' | 'codigo' | 'estado' | 'creadoEn' | 'actualizadoEn' | 'eliminadoEn'
>;

export class CrearExpediente {
  constructor(private readonly db: DbPuerto) { }

  async ejecutar(datos: DatosNuevoExpediente): Promise<Expediente> {
    const ahora = new Date().toISOString();
    const anio = new Date().getFullYear();
    const id = nuevoId();

    await this.db.transaccion([
      {
        sql: `INSERT INTO contador (anio, ultimo) VALUES (?1, 1)
              ON CONFLICT(anio) DO UPDATE SET ultimo = ultimo + 1`,
        params: [anio],
      },
      {
        sql: `INSERT INTO expediente
                (id, codigo, materia, referencia, estado, juzgado, nro_causa, cliente_id, created_at, updated_at)
              VALUES
                (?2, 'LH-' || ?1 || '-' || printf('%04d', (SELECT ultimo FROM contador WHERE anio = ?1)),
                 ?3, ?4, 'abierto', ?5, ?6, ?7, ?8, ?8)`,
        params: [
          anio, id, datos.materia,
          datos.referencia ?? null, datos.juzgado ?? null, datos.nroCausa ?? null,
          datos.clienteId, ahora,
        ],
      },
    ], [{ accion: 'expediente.crear', entidad: 'expediente', entidadId: id }]);

    const [fila] = await this.db.consultar<{ codigo: string }>(
      'SELECT codigo FROM expediente WHERE id = ?1',
      [id],
    );

    return {
      id,
      codigo: fila.codigo,
      materia: datos.materia,
      referencia: datos.referencia,
      estado: 'abierto',
      juzgado: datos.juzgado,
      nroCausa: datos.nroCausa,
      clienteId: datos.clienteId,
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
  }
}