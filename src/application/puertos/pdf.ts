export interface LectorPdf {
    /** Líneas de texto de cada página (índice 0 = página 1). Lanza ErrorDeDatos si no es un PDF legible. */
    extraerLineas(pdf: Uint8Array): Promise<string[][]>;
}