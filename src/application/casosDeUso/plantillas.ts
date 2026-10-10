import { ErrorDeDatos } from '../../domain/errores';
import { nuevoId } from '../../domain/id';
import { nombreSeguro } from '../../domain/nombreArchivo';
import { VERSION_APP } from '../../domain/version';
import type { ArchivosPuerto } from '../puertos/archivos';
import type { DbPuerto, Fila } from '../puertos/db';
import type { ContenidoPaquete, FormatoPaquete, RepositorioModelos } from '../puertos/modelos';
import { insertar } from '../sql';
import type { ImportarModelo, ResultadoImportacion } from './importarModelo';

export interface PlantillaGuardada {
    id: string;
    nombre: string;
    materia: string;
    categoria: string;
    descripcion: string;
    editable: boolean;
    numCampos: number;
    creadaEn: string;
}

interface DatosPlantilla { nombre: string; materia?: string; categoria?: string; descripcion?: string }

interface Dependencias {
    db: DbPuerto;
    archivos: ArchivosPuerto;
    modelos: RepositorioModelos;
    formato: FormatoPaquete;
    importar: ImportarModelo;
}

const t = (v: unknown) => (v == null ? '' : String(v));
const opc = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
const nulo = (v?: string) => v?.trim() || null;

/**
 * Empaqueta un modelo terminado (.lhmodel: documento, campos, grupos y partes) para guardarlo en «Mis plantillas»,
 * llevarlo a otra PC o instalarlo después como un modelo nuevo.
 */
export class Plantillas {
    constructor(private readonly dep: Dependencias) { }

    async listar(): Promise<PlantillaGuardada[]> {
        const filas = await this.dep.db.consultar<Fila>(
            `SELECT id, nombre, materia, categoria, descripcion, editable, num_campos, created_at
             FROM plantilla WHERE deleted_at IS NULL ORDER BY nombre COLLATE NOCASE`,
        );
        return filas.map((f) => ({
            id: t(f.id), nombre: t(f.nombre), materia: t(f.materia), categoria: t(f.categoria),
            descripcion: t(f.descripcion), editable: Number(f.editable) === 1,
            numCampos: Number(f.num_campos), creadaEn: t(f.created_at),
        }));
    }

    private async leerModelo(modeloVersionId: string): Promise<{ paquete: ContenidoPaquete; datos: DatosPlantilla }> {
        const { db, modelos } = this.dep;
        const v = await modelos.obtenerVersion(modeloVersionId);
        if (!v) throw new ErrorDeDatos('Versión de modelo no encontrada');
        const [m] = await db.consultar<Fila>(
            'SELECT nombre, materia, categoria, descripcion FROM modelo WHERE id = ?1',
            [v.modeloId],
        );
        if (!m) throw new ErrorDeDatos('El modelo ya no existe');
        return {
            paquete: await modelos.leerPaquete(modeloVersionId),
            datos: { nombre: t(m.nombre), materia: opc(m.materia), categoria: opc(m.categoria), descripcion: opc(m.descripcion) },
        };
    }

    private empaquetar(p: ContenidoPaquete, d: DatosPlantilla): Uint8Array {
        return this.dep.formato.empaquetar({
            ...p,
            manifest: {
                ...p.manifest,
                modelo: d.nombre, materia: d.materia, categoria: d.categoria, descripcion: d.descripcion,
                creadoEn: new Date().toISOString(), versionMinima: VERSION_APP,
            },
        });
    }

    /** Copia el paquete a la carpeta de plantillas y lo anota en la base. */
    private async registrar(bytes: Uint8Array, p: ContenidoPaquete, d: DatosPlantilla): Promise<string> {
        const { db, archivos } = this.dep;
        const id = nuevoId();
        const ruta = await archivos.rutaPlantilla(`${nombreSeguro(d.nombre)}_${id.slice(-6)}.lhmodel`);
        await archivos.crearNuevo(ruta, bytes);
        const sha256 = await archivos.sha256(ruta);
        await db.transaccion(
            [insertar('plantilla', {
                id, nombre: d.nombre, materia: nulo(d.materia), categoria: nulo(d.categoria),
                descripcion: nulo(d.descripcion), ruta_paquete: ruta, sha256,
                editable: p.fuente ? 1 : 0, num_campos: p.schema.length, created_at: new Date().toISOString(),
            })],
            [{ accion: 'plantilla.guardar', entidad: 'plantilla', entidadId: id, detalle: { editable: !!p.fuente } }],
        );
        return id;
    }

    /** Guarda el modelo (la versión indicada) en «Mis plantillas». */
    async guardar(modeloVersionId: string): Promise<string> {
        const { paquete, datos } = await this.leerModelo(modeloVersionId);
        return this.registrar(this.empaquetar(paquete, datos), paquete, datos);
    }

    /** Escribe un archivo .lhmodel donde la persona eligió. */
    async exportar(modeloVersionId: string, destino: string): Promise<void> {
        const { archivos, db } = this.dep;
        const { paquete, datos } = await this.leerModelo(modeloVersionId);
        await archivos.escribir(destino, this.empaquetar(paquete, datos));
        await db.transaccion([], [{ accion: 'plantilla.exportar', entidad: 'modelo_version', entidadId: modeloVersionId }]);
    }

    /** Lee un .lhmodel (de otra PC, por ejemplo), lo verifica y lo agrega a «Mis plantillas». */
    async agregarDeArchivo(ruta: string): Promise<string> {
        const { archivos, formato } = this.dep;
        const paquete = formato.desempaquetar(await archivos.leer(ruta));
        if ((await archivos.sha256Bytes(paquete.docx)) !== paquete.manifest?.sha256) {
            throw new ErrorDeDatos('La plantilla del archivo está dañada (el hash no coincide)');
        }
        const m = paquete.manifest;
        const datos: DatosPlantilla = {
            nombre: opc(m.modelo) ?? 'Plantilla importada',
            materia: opc(m.materia), categoria: opc(m.categoria), descripcion: opc(m.descripcion),
        };
        return this.registrar(this.empaquetar(paquete, datos), paquete, datos);
    }

    /** Crea un modelo nuevo a partir de una plantilla guardada. */
    async instalar(id: string): Promise<ResultadoImportacion> {
        const { db, archivos, formato, importar } = this.dep;
        const [f] = await db.consultar<Fila>('SELECT * FROM plantilla WHERE id = ?1 AND deleted_at IS NULL', [id]);
        if (!f) throw new ErrorDeDatos('La plantilla ya no existe');
        const bytes = await archivos.leer(t(f.ruta_paquete));
        if ((await archivos.sha256Bytes(bytes)) !== t(f.sha256)) {
            throw new ErrorDeDatos('El archivo de la plantilla cambió o está dañado (el hash no coincide)');
        }
        const p = formato.desempaquetar(bytes);
        if ((await archivos.sha256Bytes(p.docx)) !== p.manifest?.sha256) {
            throw new ErrorDeDatos('La plantilla está dañada (el hash no coincide)');
        }
        const datos = {
            nombre: t(f.nombre),
            materia: opc(f.materia), categoria: opc(f.categoria), descripcion: opc(f.descripcion),
            notas: `Instalada desde la plantilla «${t(f.nombre)}»`,
        };
        const r = p.fuente
            ? await importar.desdeFuente({ ...datos, fuente: p.fuente })
            : await importar.ejecutar({ ...datos, docx: p.docx });
        await db.transaccion([], [{ accion: 'plantilla.instalar', entidad: 'plantilla', entidadId: id, detalle: { modeloId: r.modeloId } }]);
        return r;
    }

    /** Borrado lógico: los modelos ya instalados no cambian. */
    async eliminar(id: string): Promise<void> {
        const { db } = this.dep;
        const [f] = await db.consultar<{ id: string }>('SELECT id FROM plantilla WHERE id = ?1 AND deleted_at IS NULL', [id]);
        if (!f) throw new ErrorDeDatos('La plantilla ya no existe');
        await db.transaccion(
            [{ sql: 'UPDATE plantilla SET deleted_at = ?2 WHERE id = ?1', params: [id, new Date().toISOString()] }],
            [{ accion: 'plantilla.eliminar', entidad: 'plantilla', entidadId: id }],
        );
    }
}