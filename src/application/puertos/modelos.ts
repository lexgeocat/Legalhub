import type { ModeloVersion } from '../../domain/entidades';
import type { CampoEsquema } from './motorPlantillas';

export interface ManifiestoModelo {
    modelo: string;
    version: number;
    sha256: string;
    creadoEn: string;
    versionMinima: string;
}

export interface ContenidoPaquete {
    docx: Uint8Array;
    schema: CampoEsquema[];
    manifest: ManifiestoModelo;
}

export interface FormatoPaquete {
    empaquetar(c: ContenidoPaquete): Uint8Array;
    desempaquetar(bytes: Uint8Array): ContenidoPaquete;
}

export interface RepositorioModelos {
    obtenerVersion(id: string): Promise<ModeloVersion | null>;
    leerPlantilla(modeloVersionId: string): Promise<Uint8Array>;
}