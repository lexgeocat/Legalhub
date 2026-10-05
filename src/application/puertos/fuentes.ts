export interface IncrustadorFuentes {
    /** Devuelve el mismo .docx con las fuentes usadas incrustadas. Si algo falla, devuelve el original. */
    incrustar(docx: Uint8Array): Promise<Uint8Array>;
}