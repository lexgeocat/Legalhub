import { nombrePersona } from '../../domain/personas';
import type { DbPuerto, Fila } from '../puertos/db';

export interface ResultadoBusqueda {
    tipo: 'persona' | 'expediente' | 'documento' | 'inmueble';
    id: string;
    titulo: string;
    detalle: string;
    expedienteId?: string;
}

const t = (v: unknown) => (v == null ? '' : String(v));
const tokens = (q: string) => q.split(/\s+/).map((x) => x.replace(/["']/g, '')).filter(Boolean);

export class Buscar {
    constructor(private readonly db: DbPuerto) { }

    async ejecutar(texto: string, limite = 20): Promise<ResultadoBusqueda[]> {
        const q = texto.trim();
        if (q.length < 2) return [];
        const toks = tokens(q);
        if (toks.length === 0) return [];
        const prefijo = toks.map((x) => `"${x}"*`).join(' ');
        const trigramas = toks.filter((x) => x.length >= 3).map((x) => `"${x}"`).join(' ');
        const like = `${q.replace(/[%_\\]/g, '\\$&')}%`;

        const salida = new Map<string, ResultadoBusqueda>();
        const agregar = (r: ResultadoBusqueda) => {
            const k = `${r.tipo}:${r.id}`;
            if (!salida.has(k)) salida.set(k, r);
        };
        const persona = (p: Fila) =>
            agregar({ tipo: 'persona', id: t(p.id), titulo: nombrePersona(p), detalle: [t(p.ci_numero), t(p.nit)].filter(Boolean).join(' · ') });
        const expediente = (e: Fila) =>
            agregar({ tipo: 'expediente', id: t(e.id), titulo: `${t(e.codigo)} · ${t(e.materia)}`, detalle: [t(e.juzgado), t(e.nro_causa)].filter(Boolean).join(' · '), expedienteId: t(e.id) });

        (await this.db.consultar<Fila>(
            `SELECT p.* FROM fts_persona JOIN persona p ON p.id = fts_persona.persona_id
       WHERE fts_persona MATCH ?1 AND p.deleted_at IS NULL ORDER BY bm25(fts_persona) LIMIT ?2`,
            [prefijo, limite],
        )).forEach(persona);
        (await this.db.consultar<Fila>(
            `SELECT * FROM persona WHERE deleted_at IS NULL AND (ci_numero LIKE ?1 ESCAPE '\\' OR nit LIKE ?1 ESCAPE '\\') LIMIT ?2`,
            [like, limite],
        )).forEach(persona);
        if (trigramas) {
            (await this.db.consultar<Fila>(
                `SELECT p.* FROM fts_persona_tri JOIN persona p ON p.id = fts_persona_tri.persona_id
         WHERE fts_persona_tri MATCH ?1 AND p.deleted_at IS NULL LIMIT ?2`,
                [trigramas, limite],
            )).forEach(persona);
        }

        (await this.db.consultar<Fila>(
            `SELECT d.id, d.titulo, d.expediente_id, e.codigo
       FROM fts_documento JOIN documento d ON d.id = fts_documento.documento_id
       JOIN expediente e ON e.id = d.expediente_id
       WHERE fts_documento MATCH ?1 AND d.deleted_at IS NULL AND e.deleted_at IS NULL
       ORDER BY bm25(fts_documento) LIMIT ?2`,
            [prefijo, limite],
        )).forEach((d) =>
            agregar({ tipo: 'documento', id: t(d.id), titulo: t(d.titulo), detalle: t(d.codigo), expedienteId: t(d.expediente_id) }),
        );
        (await this.db.consultar<Fila>(
            `SELECT * FROM expediente WHERE deleted_at IS NULL AND (codigo LIKE ?1 ESCAPE '\\' OR nro_causa LIKE ?1 ESCAPE '\\') LIMIT ?2`,
            [like, limite],
        )).forEach(expediente);

        (await this.db.consultar<Fila>(
            `SELECT i.id, i.matricula, i.codigo_catastral, i.ubicacion, e.id AS expediente_id
       FROM inmueble i
       LEFT JOIN expediente_inmueble ei ON ei.inmueble_id = i.id
       LEFT JOIN expediente e ON e.id = ei.expediente_id AND e.deleted_at IS NULL
       WHERE i.deleted_at IS NULL
         AND (i.matricula LIKE ?1 ESCAPE '\\' OR i.codigo_catastral LIKE ?1 ESCAPE '\\')
         AND (ei.expediente_id IS NULL OR e.id IS NOT NULL)
       LIMIT ?2`,
            [like, limite],
        )).forEach((i) =>
            agregar({ tipo: 'inmueble', id: t(i.id), titulo: `Matrícula ${t(i.matricula)}`, detalle: t(i.ubicacion), expedienteId: t(i.expediente_id) || undefined }),
        );

        return [...salida.values()].slice(0, limite);
    }
}