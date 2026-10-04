export interface ArchivosPuerto {
    rutaDocumento(codigoExpediente: string, nombreArchivo: string): Promise<string>;
    rutaModelo(nombreArchivo: string): Promise<string>;
    rutaTrabajo(nombreArchivo: string): Promise<string>;
    leer(ruta: string): Promise<Uint8Array>;
    /** Falla si el archivo ya existe (nunca se sobrescribe). */
    crearNuevo(ruta: string, contenido: Uint8Array): Promise<void>;
    sha256(ruta: string): Promise<string>;
    sha256Bytes(datos: Uint8Array): Promise<string>;
    abrir(ruta: string): Promise<void>;
    mostrarEnCarpeta(ruta: string): Promise<void>;
}