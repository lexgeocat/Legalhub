import { ErrorDeDatos } from '../../domain/errores';
import { nuevoId } from '../../domain/id';
import {
    NIVELES_LEY, analizarLey,
    type NivelLey, type NodoArbol, type NodoBorrador, type NodoLey,
} from '../../domain/leyes';
import { nombreSeguro } from '../../domain/nombreArchivo';
import { claveNormalizada } from '../../domain/texto';
import type { ArchivosPuerto } from '../puertos/archivos';
import type { DbPuerto, Fila, Sentencia } from '../puertos/db';
import type { LectorPdf } from '../puertos/pdf';
import { actualizar, insertar } from '../sql';

export interface DatosLey { nombre: string; tipo?: string; norma?: string }
export interface Ley {
    id: string; nombre: string; tipo: string; norma: string; rutaPdf: string; sha256: string;
    numPaginas: number; numArticulos: number; creadaEn: string;
}
export interface NodoConLey extends NodoLey { leyNombre: string }
export interface DatosNodo {
    id?: string; leyId: string; nivel: NivelLey; numero: string; titulo: string; pagina: number; texto: string;
}
export interface ResultadoBusquedaLey {
    id: string; leyId: string; leyNombre: string; nivel: NivelLey; numero: string; titulo: string; pagina: number; extracto: string;
}
export interface ResultadoImportacionLey { leyId: string; nodos: number; articulos: number; sinTexto: boolean }

interface Dependencias { db: DbPuerto; archivos: ArchivosPuerto; lector: LectorPdf }

const t = (v: unknown) => (v == null ? '' : String(v));
const nulo = (v?: string) => v?.trim() || null;

const SQL_LEY = `
  SELECT l.id, l.nombre, l.tipo, l.norma, l.ruta_pdf, l.sha256, l.num_paginas, l.created_at,
         (SELECT COUNT(*) FROM ley_nodo n WHERE n.ley_id = l.id AND n.nivel = 'articulo') AS n_articulos
  FROM ley l WHERE l.deleted_at IS NULL`;

const aLey = (f: Fila): Ley => ({
    id: t(f.id), nombre: t(f.nombre), tipo: t(f.tipo), norma: t(f.norma), rutaPdf: t(f.ruta_pdf), sha256: t(f.sha256),
    numPaginas: Number(f.num_paginas), numArticulos: Number(f.n_articulos), creadaEn: t(f.created_at),
});
const aArbol = (f: Fila): NodoArbol => ({
    id: t(f.id), leyId: t(f.ley_id), nivel: t(f.nivel) as NivelLey, numero: t(f.numero), titulo: t(f.titulo),
    pagina: Number(f.pagina), orden: Number(f.orden),
});

const COLS_RES = `n.id, n.ley_id, l.nombre AS ley_nombre, n.nivel, n.numero, n.titulo, n.pagina, substr(n.texto, 1, 200) AS extracto`;
const aResultado = (f: Fila): ResultadoBusquedaLey => ({
    id: t(f.id), leyId: t(f.ley_id), leyNombre: t(f.ley_nombre), nivel: t(f.nivel) as NivelLey,
    numero: t(f.numero), titulo: t(f.titulo), pagina: Number(f.pagina), extracto: t(f.extracto),
});

const COLS_NODO = ['id', 'ley_id', 'nivel', 'numero', 'titulo', 'pagina', 'orden', 'texto'];

/** INSERT de varias filas por sentencia (una ley grande tiene miles de marcadores). */
function sentenciasNodos(leyId: string, nodos: readonly NodoBorrador[]): Sentencia[] {
    const salida: Sentencia[] = [];
    for (let i = 0; i < nodos.length; i += 60) {
        const params: unknown[] = [];
        const filas = nodos.slice(i, i + 60).map((n, k) => {
            const base = params.length;
            params.push(nuevoId(), leyId, n.nivel, n.numero, n.titulo, n.pagina, i + k, n.texto);
            return `(${COLS_NODO.map((_, c) => `?${base + c + 1}`).join(', ')})`;
        });
        salida.push({ sql: `INSERT INTO ley_nodo (${COLS_NODO.join(', ')}) VALUES ${filas.join(', ')}`, params });
    }
    return salida;
}

export class Leyes {
    constructor(private readonly dep: Dependencias) { }

    async listar(): Promise<Ley[]> {
        const filas = await this.dep.db.consultar<Fila>(`${SQL_LEY} ORDER BY l.nombre COLLATE NOCASE`);
        return filas.map(aLey);
    }

    async obtener(id: string): Promise<Ley | null> {
        const [f] = await this.dep.db.consultar<Fila>(`${SQL_LEY} AND l.id = ?1`, [id]);
        return f ? aLey(f) : null;
    }

    /** Marcadores en orden de lectura, sin el texto (el texto se pide por nodo). */
    async nodos(leyId: string): Promise<NodoArbol[]> {
        const filas = await this.dep.db.consultar<Fila>(
            'SELECT id, ley_id, nivel, numero, titulo, pagina, orden FROM ley_nodo WHERE ley_id = ?1 ORDER BY orden',
            [leyId],
        );
        return filas.map(aArbol);
    }

    async obtenerNodo(id: string): Promise<NodoConLey | null> {
        const [f] = await this.dep.db.consultar<Fila>(
            `SELECT n.*, l.nombre AS ley_nombre FROM ley_nodo n JOIN ley l ON l.id = n.ley_id
             WHERE n.id = ?1 AND l.deleted_at IS NULL`,
            [id],
        );
        return f ? { ...aArbol(f), texto: t(f.texto), leyNombre: t(f.ley_nombre) } : null;
    }

    async importar(pdf: Uint8Array, d: DatosLey): Promise<ResultadoImportacionLey> {
        const { db, archivos, lector } = this.dep;
        const nombre = d.nombre.trim();
        if (!nombre) throw new ErrorDeDatos('Falta el nombre de la ley');

        const hash = await archivos.sha256Bytes(pdf);
        const [dup] = await db.consultar<{ nombre: string }>(
            'SELECT nombre FROM ley WHERE sha256 = ?1 AND deleted_at IS NULL', [hash],
        );
        if (dup) throw new ErrorDeDatos(`Este PDF ya está cargado como «${dup.nombre}»`);

        const paginas = await lector.extraerLineas(pdf);
        if (paginas.length === 0) throw new ErrorDeDatos('El PDF no tiene páginas');
        const caracteres = paginas.reduce((a, p) => a + p.join('').length, 0);
        const nodos = analizarLey(paginas);

        const id = nuevoId();
        const ruta = await archivos.rutaLey(`${nombreSeguro(nombre)}_${id.slice(-6)}.pdf`);
        await archivos.crearNuevo(ruta, pdf);
        const sha256 = await archivos.sha256(ruta);
        const ahora = new Date().toISOString();

        await db.transaccion(
            [
                insertar('ley', {
                    id, nombre, tipo: nulo(d.tipo), norma: nulo(d.norma), ruta_pdf: ruta, sha256,
                    num_paginas: paginas.length, created_at: ahora, updated_at: ahora,
                }),
                ...sentenciasNodos(id, nodos),
            ],
            [{ accion: 'ley.importar', entidad: 'ley', entidadId: id, detalle: { paginas: paginas.length, nodos: nodos.length } }],
        );
        return {
            leyId: id,
            nodos: nodos.length,
            articulos: nodos.filter((n) => n.nivel === 'articulo').length,
            sinTexto: caracteres < 40 * paginas.length,
        };
    }

    /** Vuelve a detectar la estructura del PDF. Reemplaza TODOS los marcadores (también los editados a mano). */
    async reanalizar(leyId: string): Promise<number> {
        const { db, archivos, lector } = this.dep;
        const ley = await this.obtener(leyId);
        if (!ley) throw new ErrorDeDatos('La ley ya no existe');
        const nodos = analizarLey(await lector.extraerLineas(await archivos.leer(ley.rutaPdf)));
        await db.transaccion(
            [
                { sql: 'DELETE FROM ley_nodo WHERE ley_id = ?1', params: [leyId] },
                ...sentenciasNodos(leyId, nodos),
                actualizar('ley', leyId, { updated_at: new Date().toISOString() }),
            ],
            [{ accion: 'ley.reanalizar', entidad: 'ley', entidadId: leyId, detalle: { nodos: nodos.length } }],
        );
        return nodos.length;
    }

    async editarDatos(id: string, d: DatosLey): Promise<void> {
        const nombre = d.nombre.trim();
        if (!nombre) throw new ErrorDeDatos('Falta el nombre de la ley');
        await this.dep.db.transaccion(
            [actualizar('ley', id, { nombre, tipo: nulo(d.tipo), norma: nulo(d.norma), updated_at: new Date().toISOString() })],
            [{ accion: 'ley.editar', entidad: 'ley', entidadId: id }],
        );
    }

    /** Borrado lógico: el PDF queda en disco. */
    async eliminar(id: string): Promise<void> {
        const ley = await this.obtener(id);
        if (!ley) throw new ErrorDeDatos('La ley ya no existe');
        await this.dep.db.transaccion(
            [{ sql: 'UPDATE ley SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1', params: [id, new Date().toISOString()] }],
            [{ accion: 'ley.eliminar', entidad: 'ley', entidadId: id }],
        );
    }

    /**
     * Crea o edita un marcador. Uno nuevo se coloca por su página: las divisiones (libro, título…) al INICIO
     * de esa página y los artículos al FINAL de ella.
     */
    async guardarNodo(d: DatosNodo): Promise<string> {
        const { db } = this.dep;
        if (!NIVELES_LEY.includes(d.nivel)) throw new ErrorDeDatos('Nivel inválido');
        const numero = d.numero.trim();
        const titulo = d.titulo.trim();
        if (d.nivel === 'articulo' && !numero) throw new ErrorDeDatos('Falta el número del artículo');
        if (!numero && !titulo) throw new ErrorDeDatos('Indica el número o el título');
        const pagina = Math.max(1, Math.round(Number(d.pagina) || 1));
        const texto = d.texto.trim();

        if (d.id) {
            await db.transaccion(
                [actualizar('ley_nodo', d.id, { nivel: d.nivel, numero, titulo, pagina, texto })],
                [{ accion: 'ley.nodo.editar', entidad: 'ley_nodo', entidadId: d.id }],
            );
            return d.id;
        }
        const [{ o }] = await db.consultar<{ o: number }>(
            `SELECT COALESCE(MAX(orden), -1) + 1 AS o FROM ley_nodo WHERE ley_id = ?1 AND pagina ${d.nivel === 'articulo' ? '<=' : '<'} ?2`,
            [d.leyId, pagina],
        );
        const id = nuevoId();
        await db.transaccion(
            [
                { sql: 'UPDATE ley_nodo SET orden = orden + 1 WHERE ley_id = ?1 AND orden >= ?2', params: [d.leyId, Number(o)] },
                insertar('ley_nodo', { id, ley_id: d.leyId, nivel: d.nivel, numero, titulo, pagina, orden: Number(o), texto }),
            ],
            [{ accion: 'ley.nodo.crear', entidad: 'ley_nodo', entidadId: id }],
        );
        return id;
    }

    async eliminarNodo(id: string): Promise<void> {
        await this.dep.db.transaccion(
            [{ sql: 'DELETE FROM ley_nodo WHERE id = ?1', params: [id] }],
            [{ accion: 'ley.nodo.eliminar', entidad: 'ley_nodo', entidadId: id }],
        );
    }

    /** «1283», «art. 45» → artículo exacto primero; luego búsqueda de texto. */
    async buscar(texto: string, leyId?: string, limite = 30): Promise<ResultadoBusquedaLey[]> {
        const q = texto.trim();
        if (!q) return [];
        const lim = Math.max(1, Math.floor(limite));
        const filtro = leyId ? ' AND n.ley_id = ?2' : '';
        const con = (p: unknown) => (leyId ? [p, leyId] : [p]);
        const salida = new Map<string, ResultadoBusquedaLey>();
        const agregar = (f: Fila) => {
            const r = aResultado(f);
            if (!salida.has(r.id)) salida.set(r.id, r);
        };

        const num = /^(?:art(?:[ií]culos?)?\.?\s*)?(\d{1,5})(?:\s*(bis|ter|qu[aá]ter))?$/i.exec(q);
        if (num) {
            const numero = `${Number(num[1])}${num[2] ? ` ${claveNormalizada(num[2])}` : ''}`;
            (await this.dep.db.consultar<Fila>(
                `SELECT ${COLS_RES} FROM ley_nodo n JOIN ley l ON l.id = n.ley_id
                 WHERE n.nivel = 'articulo' AND n.numero = ?1 AND l.deleted_at IS NULL${filtro}
                 ORDER BY l.nombre COLLATE NOCASE, n.orden LIMIT ${lim}`,
                con(numero),
            )).forEach(agregar);
        }

        const toks = q.split(/\s+/).map((x) => x.replace(/["']/g, '')).filter((x) => /[\p{L}\p{N}]/u.test(x));
        if (toks.length > 0) {
            (await this.dep.db.consultar<Fila>(
                `SELECT ${COLS_RES} FROM fts_ley_nodo
                 JOIN ley_nodo n ON n.rowid = fts_ley_nodo.rowid
                 JOIN ley l ON l.id = n.ley_id
                 WHERE fts_ley_nodo MATCH ?1 AND l.deleted_at IS NULL${filtro}
                 ORDER BY bm25(fts_ley_nodo) LIMIT ${lim}`,
                con(toks.map((x) => `"${x}"*`).join(' ')),
            )).forEach(agregar);
        }
        return [...salida.values()].slice(0, lim);
    }
}