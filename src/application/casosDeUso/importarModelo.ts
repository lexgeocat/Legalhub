import { ErrorDeDatos } from '../../domain/errores';
import type { FuenteModelo } from '../../domain/fuenteModelo';
import { nuevoId } from '../../domain/id';
import { nombreSeguro } from '../../domain/nombreArchivo';
import { claveCampo } from '../../domain/texto';
import { VERSION_APP } from '../../domain/version';
import { analizarCampos, aplicarCampos } from '../camposModelo';
import type { ArchivosPuerto } from '../puertos/archivos';
import type { DbPuerto, Sentencia } from '../puertos/db';
import type { FormatoPaquete, GeneradorDocx, RepositorioModelos } from '../puertos/modelos';
import type { CampoEsquema, MotorPlantillas, ResultadoEscaneo } from '../puertos/motorPlantillas';
import { actualizar, insertar } from '../sql';

export interface DatosModelo {
    nombre: string;
    materia?: string;
    categoria?: string;
    descripcion?: string;
    notas?: string;
}

export interface EntradaImportacion extends DatosModelo {
    /** Si se indica, crea una versión nueva de ese modelo. */
    modeloId?: string;
    docx: Uint8Array;
}

export interface EntradaFuente extends DatosModelo {
    /** Si se indica, crea una versión nueva de ese modelo y actualiza sus datos. */
    modeloId?: string;
    fuente: FuenteModelo;
}

export interface ResultadoImportacion {
    modeloId: string;
    modeloVersionId: string;
    version: number;
    escaneo: ResultadoEscaneo;
}

export interface ResultadoValidacion {
    docx: Uint8Array;
    esquema: CampoEsquema[];
    errores: string[];
    advertencias: string[];
    info: string[];
}

interface Dependencias {
    db: DbPuerto;
    archivos: ArchivosPuerto;
    motor: MotorPlantillas;
    formato: FormatoPaquete;
    modelos: RepositorioModelos;
    generador: GeneradorDocx;
}

const pad = (n: number) => String(n).padStart(2, '0');
const nulo = (v?: string) => v?.trim() || null;
/** «word/document.xml: marcador inválido…» → «marcador inválido…» */
const limpiar = (m: string) => m.replace(/^word\/[^:]+:\s*/, '');

export class ImportarModelo {
    constructor(private readonly dep: Dependencias) { }

    /** Modelo de Word (.docx con marcadores). */
    async ejecutar(e: EntradaImportacion): Promise<ResultadoImportacion> {
        const escaneo = this.dep.motor.escanear(e.docx);
        if (!escaneo.esValido) throw new ErrorDeDatos(`El modelo tiene errores:\n- ${escaneo.errores.join('\n- ')}`);
        return this.publicar({ modeloId: e.modeloId, datos: e, docx: e.docx, escaneo, actualizarDatos: false });
    }

    /** Valida un modelo del editor sin guardar nada (botón «Verificar»). */
    validar(fuente: FuenteModelo): ResultadoValidacion {
        if (fuente.texto.trim() === '') {
            return {
                docx: new Uint8Array(), esquema: [], advertencias: [], info: [],
                errores: ['El modelo está vacío: escribe el texto del documento'],
            };
        }
        const previo = analizarCampos(fuente);
        const docx = this.dep.generador.generar(fuente);
        const escaneo = this.dep.motor.escanear(docx);
        return {
            docx,
            esquema: aplicarCampos(escaneo.esquema, fuente.campos),
            errores: [...previo.errores, ...escaneo.errores.map(limpiar)],
            advertencias: [...previo.advertencias, ...escaneo.advertencias.map(limpiar)],
            info: escaneo.info,
        };
    }

    /** Modelo creado o editado en el sistema: genera el .docx, lo valida y guarda una versión nueva. */
    async desdeFuente(e: EntradaFuente): Promise<ResultadoImportacion> {
        const fuente: FuenteModelo = {
            ...e.fuente,
            campos: e.fuente.campos.map((c) => ({ ...c, clave: claveCampo(c.clave), etiqueta: c.etiqueta.trim() })),
        };
        const r = this.validar(fuente);
        if (r.errores.length > 0) throw new ErrorDeDatos(`El modelo tiene errores:\n- ${r.errores.join('\n- ')}`);
        const escaneo: ResultadoEscaneo = {
            esValido: true, errores: [], advertencias: r.advertencias, info: r.info, esquema: r.esquema,
        };
        return this.publicar({ modeloId: e.modeloId, datos: e, docx: r.docx, escaneo, fuente, actualizarDatos: true });
    }

    private async publicar(p: {
        modeloId?: string;
        datos: DatosModelo;
        docx: Uint8Array;
        escaneo: ResultadoEscaneo;
        fuente?: FuenteModelo;
        actualizarDatos: boolean;
    }): Promise<ResultadoImportacion> {
        const { db, archivos, formato } = this.dep;
        const nombre = p.datos.nombre.trim();
        if (!nombre) throw new ErrorDeDatos('Falta el nombre del modelo');

        if (p.modeloId) {
            const [existe] = await db.consultar<{ id: string }>('SELECT id FROM modelo WHERE id = ?1', [p.modeloId]);
            if (!existe) throw new ErrorDeDatos('El modelo ya no existe');
        }
        const modeloId = p.modeloId ?? nuevoId();
        const [{ version }] = await db.consultar<{ version: number }>(
            'SELECT COALESCE(MAX(version), 0) + 1 AS version FROM modelo_version WHERE modelo_id = ?1',
            [modeloId],
        );
        const creadoEn = new Date().toISOString();
        const paquete = formato.empaquetar({
            docx: p.docx,
            schema: p.escaneo.esquema,
            fuente: p.fuente,
            manifest: {
                modelo: nombre, version, sha256: await archivos.sha256Bytes(p.docx), creadoEn,
                versionMinima: VERSION_APP, origen: p.fuente ? 'editor' : 'word',
            },
        });
        const ruta = await archivos.rutaModelo(`${nombreSeguro(nombre)}_v${pad(version)}_${nuevoId().slice(-6)}.lhmodel`);
        await archivos.crearNuevo(ruta, paquete);
        const sha256 = await archivos.sha256(ruta);

        const modeloVersionId = nuevoId();
        const datosModelo = {
            nombre, materia: nulo(p.datos.materia), categoria: nulo(p.datos.categoria), descripcion: nulo(p.datos.descripcion),
        };
        const sentencias: Sentencia[] = [];
        if (!p.modeloId) {
            sentencias.push(insertar('modelo', { id: modeloId, ...datosModelo, activo: 1, created_at: creadoEn }));
        } else if (p.actualizarDatos) {
            sentencias.push(actualizar('modelo', modeloId, datosModelo));
        }
        sentencias.push(
            insertar('modelo_version', {
                id: modeloVersionId, modelo_id: modeloId, version, ruta_paquete: ruta, sha256,
                schema_json: JSON.stringify(p.escaneo.esquema), editable: p.fuente ? 1 : 0,
                notas: nulo(p.datos.notas), created_at: creadoEn,
            }),
        );
        await db.transaccion(sentencias, [
            {
                accion: 'modelo.importar', entidad: 'modelo_version', entidadId: modeloVersionId,
                detalle: { version, editable: !!p.fuente, advertencias: p.escaneo.advertencias.length },
            },
        ]);
        return { modeloId, modeloVersionId, version, escaneo: p.escaneo };
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