import { ErrorDeDatos } from '../../domain/errores';
import {
    bloquesATexto, CONFIG_POR_DEFECTO, fuenteVacia, parsearTexto,
    type Bloque, type ConfigPagina, type FuenteModelo,
} from '../../domain/fuenteModelo';
import { PLANTILLAS_INICIALES } from '../../domain/plantillasIniciales';
import { camposDesdeEsquema } from '../camposModelo';
import type { DbPuerto, Fila } from '../puertos/db';
import type { LectorDocx, RepositorioModelos } from '../puertos/modelos';
import type { CampoEsquema } from '../puertos/motorPlantillas';
import { actualizar } from '../sql';
import type { ImportarModelo, ResultadoImportacion } from './importarModelo';

const t = (v: unknown) => (v == null ? '' : String(v));

async function datosDe(db: DbPuerto, modeloId: string) {
    const [m] = await db.consultar<Fila>('SELECT nombre, materia, categoria, descripcion FROM modelo WHERE id = ?1', [modeloId]);
    if (!m) throw new ErrorDeDatos('El modelo ya no existe');
    return {
        nombre: t(m.nombre),
        materia: t(m.materia) || undefined,
        categoria: t(m.categoria) || undefined,
        descripcion: t(m.descripcion) || undefined,
    };
}

export interface ModeloVisible {
    versionId: string;
    version: number;
    editable: boolean;
    bloques: Bloque[];
    config: ConfigPagina;
    fuente: FuenteModelo | null;
    esquema: CampoEsquema[];
}

/** Contenido de una versión de modelo, listo para el visor o el editor. */
export class VerModelo {
    constructor(private readonly dep: { modelos: RepositorioModelos; lector: LectorDocx }) { }

    async ejecutar(modeloVersionId: string): Promise<ModeloVisible> {
        const { modelos, lector } = this.dep;
        const v = await modelos.obtenerVersion(modeloVersionId);
        if (!v) throw new ErrorDeDatos('Versión de modelo no encontrada');
        const p = await modelos.leerPaquete(modeloVersionId);
        return {
            versionId: v.id,
            version: v.version,
            editable: !!p.fuente,
            bloques: p.fuente ? parsearTexto(p.fuente.texto) : lector.aBloques(p.docx),
            config: p.fuente?.config ?? { ...CONFIG_POR_DEFECTO },
            fuente: p.fuente ?? null,
            esquema: p.schema,
        };
    }
}

export class EditarDatosModelo {
    constructor(private readonly db: DbPuerto) { }

    async ejecutar(
        id: string,
        d: { nombre: string; materia?: string; categoria?: string; descripcion?: string },
    ): Promise<void> {
        const nombre = d.nombre.trim();
        if (!nombre) throw new ErrorDeDatos('Falta el nombre del modelo');
        await this.db.transaccion(
            [actualizar('modelo', id, {
                nombre,
                materia: d.materia?.trim() || null,
                categoria: d.categoria?.trim() || null,
                descripcion: d.descripcion?.trim() || null,
            })],
            [{ accion: 'modelo.editar', entidad: 'modelo', entidadId: id }],
        );
    }
}

export class AlternarModeloActivo {
    constructor(private readonly db: DbPuerto) { }

    async ejecutar(id: string, activo: boolean): Promise<void> {
        await this.db.transaccion(
            [actualizar('modelo', id, { activo: activo ? 1 : 0 })],
            [{ accion: activo ? 'modelo.restaurar' : 'modelo.archivar', entidad: 'modelo', entidadId: id }],
        );
    }
}

export class DuplicarModelo {
    constructor(private readonly dep: { db: DbPuerto; modelos: RepositorioModelos; importar: ImportarModelo }) { }

    async ejecutar(modeloVersionId: string): Promise<ResultadoImportacion> {
        const { db, modelos, importar } = this.dep;
        const v = await modelos.obtenerVersion(modeloVersionId);
        if (!v) throw new ErrorDeDatos('Versión de modelo no encontrada');
        const m = await datosDe(db, v.modeloId);
        const paquete = await modelos.leerPaquete(modeloVersionId);
        const datos = { ...m, nombre: `Copia de ${m.nombre}`, notas: `Copiado de «${m.nombre}» v${v.version}` };
        return paquete.fuente
            ? importar.desdeFuente({ ...datos, fuente: paquete.fuente })
            : importar.ejecutar({ ...datos, docx: paquete.docx });
    }
}

/** Convierte un modelo de Word en editable (crea una versión nueva; la de Word se conserva). Simplifica el formato. */
export class ConvertirModeloAEditable {
    constructor(private readonly dep: { db: DbPuerto; modelos: RepositorioModelos; lector: LectorDocx; importar: ImportarModelo }) { }

    async ejecutar(modeloVersionId: string): Promise<ResultadoImportacion> {
        const { db, modelos, lector, importar } = this.dep;
        const v = await modelos.obtenerVersion(modeloVersionId);
        if (!v) throw new ErrorDeDatos('Versión de modelo no encontrada');
        const paquete = await modelos.leerPaquete(modeloVersionId);
        if (paquete.fuente) throw new ErrorDeDatos('Este modelo ya es editable');
        const fuente: FuenteModelo = {
            version: 1,
            config: { ...CONFIG_POR_DEFECTO },
            texto: bloquesATexto(lector.aBloques(paquete.docx)),
            campos: camposDesdeEsquema(paquete.schema),
        };
        const m = await datosDe(db, v.modeloId);
        return importar.desdeFuente({
            ...m, modeloId: v.modeloId, fuente,
            notas: `Convertido desde Word (v${v.version}); se simplificó el formato`,
        });
    }
}

export class InstalarPlantillaInicial {
    constructor(private readonly importar: ImportarModelo) { }

    async ejecutar(indice: number): Promise<ResultadoImportacion> {
        const p = PLANTILLAS_INICIALES[indice];
        if (!p) throw new ErrorDeDatos('Plantilla no encontrada');
        const base = fuenteVacia();
        return this.importar.desdeFuente({
            nombre: p.nombre, materia: p.materia, categoria: p.categoria, descripcion: p.descripcion,
            notas: 'Plantilla inicial',
            fuente: {
                ...base,
                config: { ...base.config, ...(p.margenes ? { margenes: { ...p.margenes } } : {}) },
                texto: p.texto,
                campos: p.campos,
            },
        });
    }
}