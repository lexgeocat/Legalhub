import type {
  FiltroBusquedaJurisprudencia,
  OrigenJurisprudencia,
  ResolucionJurisprudencia,
  ResultadoPaginadoJurisprudencia,
} from '../../domain/jurisprudencia/jurisprudencia';
import type { IRepositorioJurisprudencia } from '../../application/puertos/jurisprudencia';
import type { ArchivosPuerto } from '../../application/puertos/archivos';
import type { DbPuerto, Fila } from '../../application/puertos/db';
import { nuevoId } from '../../domain/comun/id';
import { nombreSeguro } from '../../domain/comun/nombreArchivo';

const s = (v: unknown): string => (v == null ? '' : String(v));

const filaAResolucion = (f: Fila): ResolucionJurisprudencia => ({
  id: s(f.id),
  origen: s(f.origen) as OrigenJurisprudencia,
  tipoResolucion: s(f.tipo_resolucion),
  subtipoResolucion: f.subtipo_resolucion ? s(f.subtipo_resolucion) : undefined,
  numeroResolucion: s(f.numero_resolucion),
  numeroExpediente: f.numero_expediente ? s(f.numero_expediente) : undefined,
  fechaEmision: s(f.fecha_emision),
  sala: f.sala ? s(f.sala) : undefined,
  departamento: f.departamento ? s(f.departamento) : undefined,
  magistrado: f.magistrado ? s(f.magistrado) : undefined,
  demandante: f.demandante ? s(f.demandante) : undefined,
  demandado: f.demandado ? s(f.demandado) : undefined,
  materia: f.materia ? s(f.materia) : undefined,
  resumen: f.resumen ? s(f.resumen) : undefined,
  contenidoHtml: f.contenido_html ? s(f.contenido_html) : undefined,
  rutaPdf: f.ruta_pdf ? s(f.ruta_pdf) : undefined,
  guardadaLocal: true,
});

export class RepositorioJurisprudenciaSqlite implements IRepositorioJurisprudencia {
  constructor(
    private readonly db: DbPuerto,
    private readonly archivos: ArchivosPuerto
  ) {}

  async guardar(resolucion: ResolucionJurisprudencia, pdfBuffer?: Uint8Array): Promise<string> {
    const ahora = new Date().toISOString();

    // Comprobar si ya existe guardada por número y origen
    const existentes = await this.db.consultar<Fila>(
      'SELECT id, ruta_pdf FROM jurisprudencia_guardada WHERE numero_resolucion = ? AND origen = ?',
      [resolucion.numeroResolucion, resolucion.origen]
    );

    let id = existentes.length > 0 ? s(existentes[0].id) : nuevoId();
    let rutaPdf = existentes.length > 0 ? s(existentes[0].ruta_pdf) || null : null;

    if (pdfBuffer && pdfBuffer.length > 0) {
      const extension = '.pdf';
      const limpio = nombreSeguro(`${resolucion.origen}_${resolucion.numeroResolucion}`.replace(/[\/\\]/g, '-'));
      const nombreArchivo = `${limpio}${extension}`;
      const rutaCompleta = await this.archivos.rutaJurisprudencia(nombreArchivo);
      await this.archivos.escribir(rutaCompleta, pdfBuffer);
      rutaPdf = rutaCompleta;
    }

    if (existentes.length > 0) {
      await this.db.ejecutar(
        `UPDATE jurisprudencia_guardada SET
          tipo_resolucion = ?,
          subtipo_resolucion = ?,
          numero_expediente = ?,
          fecha_emision = ?,
          sala = ?,
          departamento = ?,
          magistrado = ?,
          demandante = ?,
          demandado = ?,
          materia = ?,
          resumen = ?,
          contenido_html = coalesce(?, contenido_html),
          ruta_pdf = coalesce(?, ruta_pdf),
          updated_at = ?
        WHERE id = ?`,
        [
          resolucion.tipoResolucion,
          resolucion.subtipoResolucion ?? null,
          resolucion.numeroExpediente ?? null,
          resolucion.fechaEmision ?? null,
          resolucion.sala ?? null,
          resolucion.departamento ?? null,
          resolucion.magistrado ?? null,
          resolucion.demandante ?? null,
          resolucion.demandado ?? null,
          resolucion.materia ?? null,
          resolucion.resumen ?? null,
          resolucion.contenidoHtml ?? null,
          rutaPdf,
          ahora,
          id,
        ]
      );
    } else {
      await this.db.ejecutar(
        `INSERT INTO jurisprudencia_guardada (
          id, origen, tipo_resolucion, subtipo_resolucion, numero_resolucion,
          numero_expediente, fecha_emision, sala, departamento, magistrado,
          demandante, demandado, materia, resumen, contenido_html, ruta_pdf,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          resolucion.origen,
          resolucion.tipoResolucion,
          resolucion.subtipoResolucion ?? null,
          resolucion.numeroResolucion,
          resolucion.numeroExpediente ?? null,
          resolucion.fechaEmision ?? null,
          resolucion.sala ?? null,
          resolucion.departamento ?? null,
          resolucion.magistrado ?? null,
          resolucion.demandante ?? null,
          resolucion.demandado ?? null,
          resolucion.materia ?? null,
          resolucion.resumen ?? null,
          resolucion.contenidoHtml ?? null,
          rutaPdf,
          ahora,
          ahora,
        ]
      );
    }

    return id;
  }

  async eliminar(id: string): Promise<void> {
    await this.db.ejecutar('DELETE FROM jurisprudencia_guardada WHERE id = ?', [id]);
  }

  async buscarLocal(filtro: FiltroBusquedaJurisprudencia): Promise<ResultadoPaginadoJurisprudencia> {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    let fromClausula = 'FROM jurisprudencia_guardada j';

    const texto = filtro.texto.trim();
    if (texto) {
      // Limpiar texto para FTS5
      const ftsToken = texto.replace(/["'*]/g, '').trim();
      if (ftsToken) {
        fromClausula = 'FROM jurisprudencia_guardada j JOIN fts_jurisprudencia fts ON fts.rowid = j.rowid';
        condiciones.push('fts MATCH ?');
        params.push(`"${ftsToken}"*`);
      }
    }

    if (filtro.origen && filtro.origen !== 'TODOS') {
      condiciones.push('j.origen = ?');
      params.push(filtro.origen);
    }

    if (filtro.materia) {
      condiciones.push('j.materia = ?');
      params.push(filtro.materia);
    }

    if (filtro.sala) {
      condiciones.push('j.sala LIKE ?');
      params.push(`%${filtro.sala}%`);
    }

    if (filtro.gestion) {
      condiciones.push('(j.fecha_emision LIKE ? OR j.numero_resolucion LIKE ?)');
      params.push(`%${filtro.gestion}%`, `%${filtro.gestion}%`);
    }

    const whereStr = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    // Contar total
    const conteo = await this.db.consultar<Fila>(
      `SELECT COUNT(*) as total ${fromClausula} ${whereStr}`,
      params
    );
    const total = Number(conteo[0]?.total ?? 0);

    const page = filtro.pagina ?? 1;
    const limit = filtro.limite ?? 20;
    const offset = (page - 1) * limit;

    const filas = await this.db.consultar<Fila>(
      `SELECT j.* ${fromClausula} ${whereStr} ORDER BY j.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      items: filas.map(filaAResolucion),
      total,
      pagina: page,
      totalPaginas: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async obtenerPorId(id: string): Promise<ResolucionJurisprudencia | null> {
    const filas = await this.db.consultar<Fila>(
      'SELECT * FROM jurisprudencia_guardada WHERE id = ?',
      [id]
    );
    if (filas.length === 0) return null;
    return filaAResolucion(filas[0]);
  }

  async vincularAExpediente(jurisprudenciaId: string, expedienteId: string, notas?: string): Promise<void> {
    const id = nuevoId();
    const ahora = new Date().toISOString();
    await this.db.ejecutar(
      `INSERT OR REPLACE INTO jurisprudencia_expediente (id, jurisprudencia_id, expediente_id, notas, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, jurisprudenciaId, expedienteId, notas ?? null, ahora]
    );
  }

  async desvincularDeExpediente(jurisprudenciaId: string, expedienteId: string): Promise<void> {
    await this.db.ejecutar(
      'DELETE FROM jurisprudencia_expediente WHERE jurisprudencia_id = ? AND expediente_id = ?',
      [jurisprudenciaId, expedienteId]
    );
  }

  async listarPorExpediente(expedienteId: string): Promise<ResolucionJurisprudencia[]> {
    const filas = await this.db.consultar<Fila>(
      `SELECT j.* FROM jurisprudencia_guardada j
       JOIN jurisprudencia_expediente je ON je.jurisprudencia_id = j.id
       WHERE je.expediente_id = ?
       ORDER BY je.created_at DESC`,
      [expedienteId]
    );
    return filas.map(filaAResolucion);
  }

  async esGuardada(numeroResolucion: string, origen: OrigenJurisprudencia): Promise<boolean> {
    const filas = await this.db.consultar<Fila>(
      'SELECT 1 FROM jurisprudencia_guardada WHERE numero_resolucion = ? AND origen = ? LIMIT 1',
      [numeroResolucion, origen]
    );
    return filas.length > 0;
  }
}
