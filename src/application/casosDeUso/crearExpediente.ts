import type { Expediente } from '../../domain/entidades';
import { ErrorDeDatos } from '../../domain/errores';
import { nuevoId } from '../../domain/id';
import { obtenerTipo } from '../../domain/tiposExpediente';
import type { DbPuerto } from '../puertos/db';
import { limpiarDatos } from './gestionExpediente';

export interface DatosNuevoExpediente {
  tipo: string;
  materia: string;
  referencia?: string;
  juzgado?: string;
  nroCausa?: string;
  clienteId: string;
  datos?: Record<string, string>;
}

const vacioANulo = (v?: string) => (v ?? '').trim() || null;

export class CrearExpediente {
  constructor(private readonly db: DbPuerto) { }

  async ejecutar(datos: DatosNuevoExpediente): Promise<Expediente> {
    const materia = (datos.materia ?? '').trim();
    if (!materia) throw new ErrorDeDatos('Falta el asunto del expediente');
    if (!datos.clienteId) throw new ErrorDeDatos('Elige al cliente');

    const tipo = obtenerTipo(datos.tipo).clave;
    const extra = limpiarDatos(datos.datos ?? {});
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
                (id, codigo, tipo, materia, referencia, estado, juzgado, nro_causa, cliente_id, datos_json, created_at, updated_at)
              VALUES
                (?2, 'LH-' || ?1 || '-' || printf('%04d', (SELECT ultimo FROM contador WHERE anio = ?1)),
                 ?3, ?4, ?5, 'abierto', ?6, ?7, ?8, ?9, ?10, ?10)`,
        params: [
          anio, id, tipo, materia,
          vacioANulo(datos.referencia), vacioANulo(datos.juzgado), vacioANulo(datos.nroCausa),
          datos.clienteId, JSON.stringify(extra), ahora,
        ],
      },
    ], [{ accion: 'expediente.crear', entidad: 'expediente', entidadId: id, detalle: { tipo } }]);

    const [fila] = await this.db.consultar<{ codigo: string }>(
      'SELECT codigo FROM expediente WHERE id = ?1',
      [id],
    );

    return {
      id,
      codigo: fila.codigo,
      tipo,
      materia,
      referencia: vacioANulo(datos.referencia) ?? undefined,
      estado: 'abierto',
      juzgado: vacioANulo(datos.juzgado) ?? undefined,
      nroCausa: vacioANulo(datos.nroCausa) ?? undefined,
      clienteId: datos.clienteId,
      datos: extra,
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
  }
}