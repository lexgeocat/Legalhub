import type { ArchivosPuerto } from '../../application/puertos/archivos';
import type { DbPuerto, Fila } from '../../application/puertos/db';
import type { FormatoPaquete, RepositorioModelos } from '../../application/puertos/modelos';
import type { ModeloVersion } from '../../domain/entidades';
import { ErrorDeDatos } from '../../domain/errores';

const t = (v: unknown) => (v == null ? '' : String(v));

export class RepositorioModelosDb implements RepositorioModelos {
    constructor(
        private readonly db: DbPuerto,
        private readonly archivos: ArchivosPuerto,
        private readonly formato: FormatoPaquete,
    ) { }

    async obtenerVersion(id: string): Promise<ModeloVersion | null> {
        const [f] = await this.db.consultar<Fila>('SELECT * FROM modelo_version WHERE id = ?1', [id]);
        if (!f) return null;
        return {
            id: t(f.id), modeloId: t(f.modelo_id), version: Number(f.version), rutaPaquete: t(f.ruta_paquete),
            sha256: t(f.sha256), schemaJson: t(f.schema_json), notas: f.notas == null ? undefined : t(f.notas),
            creadoEn: t(f.created_at),
        };
    }

    async leerPlantilla(modeloVersionId: string): Promise<Uint8Array> {
        const v = await this.obtenerVersion(modeloVersionId);
        if (!v) throw new Error(`Versión de modelo no encontrada: ${modeloVersionId}`);
        const bytes = await this.archivos.leer(v.rutaPaquete);
        if ((await this.archivos.sha256Bytes(bytes)) !== v.sha256) {
            throw new ErrorDeDatos('El paquete del modelo cambió o está dañado (el hash no coincide)');
        }
        const { docx, manifest } = this.formato.desempaquetar(bytes);
        if ((await this.archivos.sha256Bytes(docx)) !== manifest.sha256) {
            throw new ErrorDeDatos('La plantilla del paquete está dañada (el hash no coincide)');
        }
        return docx;
    }
}