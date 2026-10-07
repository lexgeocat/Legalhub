import {
    aplicarCambios, leerTraza, marcarModelo, normalizar, proponerCambios,
    type AnalisisModelo, type CambioModelo,
} from '../../domain/edicionModelo';
import { ErrorDeDatos } from '../../domain/errores';
import { bloquesATexto } from '../../domain/fuenteModelo';
import type { GeneradorDocx, LectorDocx, RepositorioModelos } from '../puertos/modelos';
import type { MotorPlantillas } from '../puertos/motorPlantillas';
import type { ImportarModelo, ResultadoImportacion } from './importarModelo';

interface Dependencias {
    modelos: RepositorioModelos;
    generador: GeneradorDocx;
    lector: LectorDocx;
    motor: MotorPlantillas;
    importar: ImportarModelo;
}

export interface DatosModeloActual {
    modeloId: string;
    nombre: string;
    materia?: string;
    categoria?: string;
    descripcion?: string;
}

const SOLO_EDITOR = 'Este modelo viene de Word: conviértelo a editable desde su ficha para poder actualizarlo desde un documento.';

const sinFinalesVacios = (l: string[]): string[] => {
    const r = [...l];
    while (r.length > 0 && r[r.length - 1].trim() === '') r.pop();
    return r;
};

/** Lleva al modelo (como versión nueva) los cambios hechos a mano en un documento. */
export class ActualizarModeloDesdeDocumento {
    constructor(private readonly dep: Dependencias) { }

    /**
     * @param contexto datos con los que se completó el documento original
     * @param base texto del documento original (formato del editor)
     * @param editado texto del documento editado (formato del editor)
     * @param valores lo que el modelo insertó en el documento (para detectar datos del caso)
     */
    async analizar(
        modeloVersionId: string,
        contexto: Record<string, unknown>,
        base: string,
        editado: string,
        valores: readonly string[],
    ): Promise<AnalisisModelo> {
        const { modelos, generador, lector, motor } = this.dep;
        const paquete = await modelos.leerPaquete(modeloVersionId);
        if (!paquete.fuente) throw new ErrorDeDatos(SOLO_EDITOR);
        const lineasModelo = paquete.fuente.texto.split(/\r?\n/);

        // Se completa una copia marcada del modelo con los mismos datos: así cada párrafo dice de qué línea salió.
        const marcado = generador.generar({ ...paquete.fuente, texto: marcarModelo(lineasModelo) });
        const { docx } = await motor.renderizar(marcado, contexto);
        const trazadas = leerTraza(bloquesATexto(lector.aBloques(docx)).split('\n'));
        while (trazadas.length > 0 && trazadas[trazadas.length - 1].limpia.trim() === '') trazadas.pop();

        const lineasBase = sinFinalesVacios(base.split('\n'));
        if (trazadas.length !== lineasBase.length) {
            throw new ErrorDeDatos('No se pudo relacionar el documento con el modelo: la estructura cambió desde que se guardó. Edita el modelo directamente.');
        }
        const alineadas = trazadas.map((t, k) => (normalizar(t.limpia) === normalizar(lineasBase[k]) ? t : { ...t, origen: null }));

        return proponerCambios({
            modelo: lineasModelo,
            trazadas: alineadas,
            base: lineasBase,
            editado: sinFinalesVacios(editado.split('\n')),
            datos: valores,
        });
    }

    /** Guarda una versión nueva del modelo con los cambios elegidos. */
    async aplicar(modelo: DatosModeloActual, modeloVersionId: string, cambios: readonly CambioModelo[]): Promise<ResultadoImportacion> {
        if (cambios.length === 0) throw new ErrorDeDatos('Elige al menos un cambio para llevar al modelo');
        const { modelos, importar } = this.dep;
        const paquete = await modelos.leerPaquete(modeloVersionId);
        if (!paquete.fuente) throw new ErrorDeDatos(SOLO_EDITOR);

        const lineas = paquete.fuente.texto.split(/\r?\n/);
        for (const c of cambios) {
            if (c.tipo !== 'insertar' && lineas[c.linea] !== c.antes[0]) {
                throw new ErrorDeDatos('El modelo cambió mientras tanto. Vuelve a revisar los cambios.');
            }
        }
        const texto = aplicarCambios(lineas, cambios).join('\n');
        return importar.desdeFuente({
            modeloId: modelo.modeloId,
            nombre: modelo.nombre,
            materia: modelo.materia,
            categoria: modelo.categoria,
            descripcion: modelo.descripcion,
            notas: `Actualizado desde un documento (${cambios.length} cambio${cambios.length === 1 ? '' : 's'})`,
            fuente: { ...paquete.fuente, texto },
        });
    }
}