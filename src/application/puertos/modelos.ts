import type { ModeloVersion } from '../../domain/entidades';
import type { Bloque, FuenteModelo } from '../../domain/fuenteModelo';
import type { CampoEsquema } from './motorPlantillas';

export interface ManifiestoModelo {
    modelo: string;
    version: number;
    /** SHA-256 de template.docx */
    sha256: string;
    creadoEn: string;
    versionMinima: string;
    origen?: 'word' | 'editor';
    materia?: string;
    categoria?: string;
    descripcion?: string;
}

export interface ContenidoPaquete {
    docx: Uint8Array;
    schema: CampoEsquema[];
    manifest: ManifiestoModelo;
    /** Solo en modelos creados en el editor (se guarda como fuente.json). */
    fuente?: FuenteModelo;
}

export interface FormatoPaquete {
    empaquetar(c: ContenidoPaquete): Uint8Array;
    desempaquetar(bytes: Uint8Array): ContenidoPaquete;
}

export interface RepositorioModelos {
    obtenerVersion(id: string): Promise<ModeloVersion | null>;
    /** Devuelve solo template.docx, con verificación de hashes. */
    leerPlantilla(modeloVersionId: string): Promise<Uint8Array>;
    /** Devuelve el paquete completo (docx, esquema, manifiesto y fuente si existe), con verificación de hashes. */
    leerPaquete(modeloVersionId: string): Promise<ContenidoPaquete>;
}

/** Construye el .docx de un modelo creado en el editor. */
export interface GeneradorDocx {
    generar(fuente: FuenteModelo): Uint8Array;
}

/** Lee un .docx existente como bloques simples (visor y conversión a editable). */
export interface LectorDocx {
    aBloques(docx: Uint8Array): Bloque[];
}