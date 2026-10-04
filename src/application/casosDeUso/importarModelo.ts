import { ErrorDeDatos } from '../../domain/errores';
import { nuevoId } from '../../domain/id';
import { nombreSeguro } from '../../domain/nombreArchivo';
import { VERSION_APP } from '../../domain/version';
import type { ArchivosPuerto } from '../puertos/archivos';
import type { DbPuerto, Sentencia } from '../puertos/db';
import type { FormatoPaquete, RepositorioModelos } from '../puertos/modelos';
import type { MotorPlantillas, ResultadoEscaneo } from '../puertos/motorPlantillas';
import { insertar } from '../sql';

export interface EntradaImportacion {
    /** Si se indica, crea una versión nueva de ese modelo. */
    modeloId?: string;
    nombre: string;
    materia?: string;
    categoria?: string;
    docx: Uint8Array;
    notas?: string;
}

export interface ResultadoImportacion {
    modeloId: string;
    modeloVersionId: string;
    version: number;
    escaneo: ResultadoEscaneo;
}

interface Dependencias {
    db: DbPuerto;
    archivos: ArchivosPuerto;
    motor: MotorPlantillas;
    formato: FormatoPaquete;
    modelos: RepositorioModelos;
}

const pad = (n: number) => String(n).padStart(2, '0');

export class ImportarModelo {
    constructor(private readonly dep: Dependencias) { }

    async ejecutar(e: EntradaImportacion): Promise<ResultadoImportacion> {
        const { db, archivos, motor, formato } = this.dep;
        const nombre = e.nombre.trim();
        if (!nombre) throw new ErrorDeDatos('Falta el nombre del modelo');

        const escaneo = motor.escanear(e.docx);
        if (!escaneo.esValido) throw new ErrorDeDatos(`El modelo tiene errores:\n- ${escaneo.errores.join('\n- ')}`);

        const modeloId = e.modeloId ?? nuevoId();
        const [{ version }] = await db.consultar<{ version: number }>(
            'SELECT COALESCE(MAX(version), 0) + 1 AS version FROM modelo_version WHERE modelo_id = ?1',
            [modeloId],
        );
        const creadoEn = new Date().toISOString();
        const paquete = formato.empaquetar({
            docx: e.docx,
            schema: escaneo.esquema,
            manifest: { modelo: nombre, version, sha256: await archivos.sha256Bytes(e.docx), creadoEn, versionMinima: VERSION_APP },
        });
        const ruta = await archivos.rutaModelo(`${nombreSeguro(nombre)}_v${pad(version)}.lhmodel`);
        await archivos.crearNuevo(ruta, paquete);
        const sha256 = await archivos.sha256(ruta);

        const modeloVersionId = nuevoId();
        const sentencias: Sentencia[] = [];
        if (!e.modeloId) {
            sentencias.push(insertar('modelo', { id: modeloId, nombre, materia: e.materia ?? null, categoria: e.categoria ?? null, activo: 1, created_at: creadoEn }));
        }
        sentencias.push(
            insertar('modelo_version', {
                id: modeloVersionId, modelo_id: modeloId, version, ruta_paquete: ruta, sha256,
                schema_json: JSON.stringify(escaneo.esquema), notas: e.notas ?? null, created_at: creadoEn,
            }),
        );
        await db.transaccion(sentencias, [
            { accion: 'modelo.importar', entidad: 'modelo_version', entidadId: modeloVersionId, detalle: { version, advertencias: escaneo.advertencias.length } },
        ]);
        return { modeloId, modeloVersionId, version, escaneo };
    }

    /** Copia editable en Modelos\_trabajo, abierta con la aplicación predeterminada del sistema. */
    async copiaDeTrabajo(modeloVersionId: string): Promise<string> {
        const { archivos, modelos } = this.dep;
        const v = await modelos.obtenerVersion(modeloVersionId);
        if (!v) throw new Error(`Versión de modelo no encontrada: ${modeloVersionId}`);
        const docx = await modelos.leerPlantilla(modeloVersionId);
        const ruta = await archivos.rutaTrabajo(`modelo_v${pad(v.version)}_${Date.now()}.docx`);
        await archivos.crearNuevo(ruta, docx);
        await archivos.abrir(ruta);
        return ruta;
    }
}