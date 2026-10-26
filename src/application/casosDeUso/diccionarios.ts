import { ErrorDeDatos } from '../../domain/comun/errores';
import { nuevoId } from '../../domain/comun/id';
import { nombreSeguro } from '../../domain/comun/nombreArchivo';
import {
  analizarDiccionario,
  type DatosDiccionario,
  type Diccionario,
  type ResultadoBusquedaDiccionario,
  type ResultadoImportacionDiccionario,
  type TerminoBorrador,
  type TerminoDiccionario,
} from '../../domain/diccionarios/diccionarios';
import type { ArchivosPuerto } from '../puertos/archivos';
import type { DbPuerto, Fila, Sentencia } from '../puertos/db';
import type { LectorPdf } from '../puertos/pdf';
import { insertar } from '../sql';

interface Dependencias {
  db: DbPuerto;
  archivos: ArchivosPuerto;
  lector: LectorPdf;
}

const t = (v: unknown) => (v == null ? '' : String(v));
const nulo = (v?: string) => v?.trim() || null;

const SQL_DICCIONARIO = `
  SELECT d.id, d.nombre, d.autor, d.descripcion, d.ruta_pdf, d.sha256, d.num_paginas, d.created_at,
         (SELECT COUNT(*) FROM diccionario_termino dt WHERE dt.diccionario_id = d.id) AS num_terminos
  FROM diccionario d WHERE d.deleted_at IS NULL`;

const aDiccionario = (f: Fila): Diccionario => ({
  id: t(f.id),
  nombre: t(f.nombre),
  autor: f.autor ? t(f.autor) : undefined,
  descripcion: f.descripcion ? t(f.descripcion) : undefined,
  rutaPdf: t(f.ruta_pdf),
  sha256: t(f.sha256),
  numPaginas: Number(f.num_paginas) || 0,
  numTerminos: Number(f.num_terminos) || 0,
  creadaEn: t(f.created_at),
});

const aTermino = (f: Fila): TerminoDiccionario => ({
  id: t(f.id),
  diccionarioId: t(f.diccionario_id),
  termino: t(f.termino),
  definicion: t(f.definicion),
  pagina: Number(f.pagina) || 1,
  orden: Number(f.orden) || 0,
});

const COLS_TERMINO = ['id', 'diccionario_id', 'termino', 'definicion', 'pagina', 'orden'];

function sentenciasTerminos(diccionarioId: string, terminos: readonly TerminoBorrador[]): Sentencia[] {
  const salida: Sentencia[] = [];
  for (let i = 0; i < terminos.length; i += 50) {
    const params: unknown[] = [];
    const filas = terminos.slice(i, i + 50).map((term, k) => {
      const base = params.length;
      params.push(nuevoId(), diccionarioId, term.termino, term.definicion, term.pagina, i + k);
      return `(${COLS_TERMINO.map((_, c) => `?${base + c + 1}`).join(', ')})`;
    });
    salida.push({
      sql: `INSERT INTO diccionario_termino (${COLS_TERMINO.join(', ')}) VALUES ${filas.join(', ')}`,
      params,
    });
  }
  return salida;
}

export class Diccionarios {
  constructor(private readonly dep: Dependencias) {}

  async listar(): Promise<Diccionario[]> {
    const filas = await this.dep.db.consultar<Fila>(`${SQL_DICCIONARIO} ORDER BY d.nombre COLLATE NOCASE`);
    return filas.map(aDiccionario);
  }

  async obtener(id: string): Promise<Diccionario | null> {
    const [f] = await this.dep.db.consultar<Fila>(`${SQL_DICCIONARIO} AND d.id = ?1`, [id]);
    return f ? aDiccionario(f) : null;
  }

  async importar(
    pdf: Uint8Array,
    d: DatosDiccionario
  ): Promise<ResultadoImportacionDiccionario> {
    const { db, archivos, lector } = this.dep;
    const nombre = d.nombre.trim();
    if (!nombre) throw new ErrorDeDatos('Falta el nombre del diccionario');

    const hash = await archivos.sha256Bytes(pdf);
    const [dup] = await db.consultar<{ nombre: string }>(
      'SELECT nombre FROM diccionario WHERE sha256 = ?1 AND deleted_at IS NULL',
      [hash]
    );
    if (dup) throw new ErrorDeDatos(`Este PDF ya está cargado como «${dup.nombre}»`);

    const paginas = await lector.extraerLineas(pdf);
    if (paginas.length === 0) throw new ErrorDeDatos('El archivo PDF no tiene páginas legibles');

    const caracteres = paginas.reduce((a, p) => a + p.join('').length, 0);
    const terminos = analizarDiccionario(paginas);

    const id = nuevoId();
    const ruta = await archivos.rutaDiccionario(`${nombreSeguro(nombre)}_${id.slice(-6)}.pdf`);
    await archivos.crearNuevo(ruta, pdf);
    const sha256 = await archivos.sha256(ruta);
    const ahora = new Date().toISOString();

    await db.transaccion(
      [
        insertar('diccionario', {
          id,
          nombre,
          autor: nulo(d.autor),
          descripcion: nulo(d.descripcion),
          ruta_pdf: ruta,
          sha256,
          num_paginas: paginas.length,
          created_at: ahora,
          updated_at: ahora,
        }),
        ...sentenciasTerminos(id, terminos),
      ],
      [
        {
          accion: 'diccionario.importar',
          entidad: 'diccionario',
          entidadId: id,
          detalle: { paginas: paginas.length, terminos: terminos.length },
        },
      ]
    );

    return {
      diccionarioId: id,
      numPaginas: paginas.length,
      numTerminos: terminos.length,
      sinTexto: caracteres < 30 * paginas.length,
    };
  }

  async eliminar(id: string): Promise<void> {
    const dicc = await this.obtener(id);
    if (!dicc) throw new ErrorDeDatos('El diccionario ya no existe');
    await this.dep.db.transaccion(
      [
        {
          sql: 'UPDATE diccionario SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1',
          params: [id, new Date().toISOString()],
        },
      ],
      [{ accion: 'diccionario.eliminar', entidad: 'diccionario', entidadId: id }]
    );
  }

  async buscar(
    texto: string,
    diccionarioId?: string,
    limite = 40
  ): Promise<ResultadoBusquedaDiccionario[]> {
    const q = texto.trim();
    if (!q) return [];
    const lim = Math.max(1, Math.floor(limite));
    const filtro = diccionarioId ? ' AND dt.diccionario_id = ?2' : '';
    const con = (p: unknown) => (diccionarioId ? [p, diccionarioId] : [p]);
    const salida = new Map<string, ResultadoBusquedaDiccionario>();

    const COLS = `dt.id, dt.diccionario_id, d.nombre AS diccionario_nombre, d.autor AS diccionario_autor,
                  dt.termino, dt.definicion, dt.pagina, substr(dt.definicion, 1, 280) AS extracto`;

    const agregar = (f: Fila) => {
      const id = t(f.id);
      if (!salida.has(id)) {
        salida.set(id, {
          id,
          diccionarioId: t(f.diccionario_id),
          diccionarioNombre: t(f.diccionario_nombre),
          diccionarioAutor: f.diccionario_autor ? t(f.diccionario_autor) : undefined,
          termino: t(f.termino),
          definicion: t(f.definicion),
          pagina: Number(f.pagina) || 1,
          extracto: t(f.extracto) || t(f.definicion).slice(0, 200),
        });
      }
    };

    // 1. Coincidencia estricta en el TÉRMINO (no dentro de la definición):
    // Prioridad A: Términos exactamente iguales o que comienzan con la frase (ej. "A beneficio...", "Prescripción...")
    const resPrefijo = await this.dep.db.consultar<Fila>(
      `SELECT ${COLS} FROM diccionario_termino dt
       JOIN diccionario d ON d.id = dt.diccionario_id
       WHERE (dt.termino LIKE ?1 OR dt.termino LIKE ?1 || '%')
         AND d.deleted_at IS NULL${filtro}
       ORDER BY 
         CASE WHEN dt.termino LIKE ?1 THEN 0 ELSE 1 END,
         LENGTH(dt.termino),
         dt.termino COLLATE NOCASE
       LIMIT ${lim}`,
      con(q)
    );
    resPrefijo.forEach(agregar);

    // Prioridad B: Términos que contienen la palabra o frase en cualquier parte del TÉRMINO (ej. "inventario" -> "A beneficio de inventario")
    if (salida.size < lim) {
      const resContiene = await this.dep.db.consultar<Fila>(
        `SELECT ${COLS} FROM diccionario_termino dt
         JOIN diccionario d ON d.id = dt.diccionario_id
         WHERE dt.termino LIKE '%' || ?1 || '%'
           AND d.deleted_at IS NULL${filtro}
         ORDER BY LENGTH(dt.termino), dt.termino COLLATE NOCASE
         LIMIT ${lim}`,
        con(q)
      );
      resContiene.forEach(agregar);
    }

    // Prioridad C: Búsqueda FTS5 ÚNICAMENTE en la columna `termino` (nunca en la definición)
    const toks = q
      .split(/\s+/)
      .map((x) => x.replace(/["'*]/g, ''))
      .filter((x) => /[\p{L}\p{N}]/u.test(x));

    if (toks.length > 0 && salida.size < lim) {
      const matchQuery = `termino: ${toks.map((x) => `"${x}"*`).join(' ')}`;
      try {
        const ftsResultados = await this.dep.db.consultar<Fila>(
          `SELECT ${COLS} FROM fts_diccionario_termino
           JOIN diccionario_termino dt ON dt.rowid = fts_diccionario_termino.rowid
           JOIN diccionario d ON d.id = dt.diccionario_id
           WHERE fts_diccionario_termino MATCH ?1
             AND d.deleted_at IS NULL${filtro}
           ORDER BY LENGTH(dt.termino), bm25(fts_diccionario_termino) LIMIT ${lim}`,
          con(matchQuery)
        );
        ftsResultados.forEach(agregar);
      } catch {
        // En caso de sintaxis compleja de FTS5
      }
    }

    return [...salida.values()].slice(0, lim);
  }

  async listarTerminos(
    diccionarioId: string,
    pagina = 1,
    limite = 50
  ): Promise<{ items: TerminoDiccionario[]; total: number }> {
    const lim = Math.max(1, limite);
    const pag = Math.max(1, pagina);
    const offset = (pag - 1) * lim;

    const [conteo] = await this.dep.db.consultar<{ total: number }>(
      'SELECT COUNT(*) AS total FROM diccionario_termino WHERE diccionario_id = ?1',
      [diccionarioId]
    );
    const total = Number(conteo?.total) || 0;

    const filas = await this.dep.db.consultar<Fila>(
      `SELECT id, diccionario_id, termino, definicion, pagina, orden
       FROM diccionario_termino
       WHERE diccionario_id = ?1
       ORDER BY orden, pagina
       LIMIT ?2 OFFSET ?3`,
      [diccionarioId, lim, offset]
    );

    return {
      items: filas.map(aTermino),
      total,
    };
  }

  async obtenerPdfBytes(diccionarioId: string): Promise<Uint8Array> {
    const dicc = await this.obtener(diccionarioId);
    if (!dicc) throw new ErrorDeDatos('El diccionario no existe');
    return this.dep.archivos.leer(dicc.rutaPdf);
  }
}
