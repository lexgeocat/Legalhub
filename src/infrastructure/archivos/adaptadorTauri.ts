import { invoke } from '@tauri-apps/api/core';
import { dirname, join } from '@tauri-apps/api/path';
import { mkdir, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import type { ArchivosPuerto } from '../../application/puertos/archivos';

export class ArchivosTauri implements ArchivosPuerto {
    constructor(private readonly raiz: string) { }

    rutaDocumento(codigoExpediente: string, nombreArchivo: string): Promise<string> {
        return join(this.raiz, 'Expedientes', codigoExpediente, 'Documentos', nombreArchivo);
    }
    rutaModelo(nombreArchivo: string): Promise<string> {
        return join(this.raiz, 'Modelos', nombreArchivo);
    }
    rutaTrabajo(nombreArchivo: string): Promise<string> {
        return join(this.raiz, 'Modelos', '_trabajo', nombreArchivo);
    }
    leer(ruta: string): Promise<Uint8Array> {
        return readFile(ruta);
    }
    async crearNuevo(ruta: string, contenido: Uint8Array): Promise<void> {
        await mkdir(await dirname(ruta), { recursive: true });
        await writeFile(ruta, contenido, { createNew: true });
    }
    sha256(ruta: string): Promise<string> {
        return invoke<string>('sha256_archivo', { ruta });
    }
    async sha256Bytes(datos: Uint8Array): Promise<string> {
        const h = await crypto.subtle.digest('SHA-256', datos.slice().buffer as ArrayBuffer);
        return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('');
    }
    abrir(ruta: string): Promise<void> {
        return openPath(ruta);
    }
    mostrarEnCarpeta(ruta: string): Promise<void> {
        return revealItemInDir(ruta);
    }
}