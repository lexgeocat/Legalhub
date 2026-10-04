import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { ContenidoPaquete, FormatoPaquete } from '../../application/puertos/modelos';
import { ErrorDeDatos } from '../../domain/errores';

const PARTES = ['template.docx', 'schema.json', 'manifest.json'] as const;

export class FormatoPaqueteFflate implements FormatoPaquete {
    empaquetar(c: ContenidoPaquete): Uint8Array {
        return zipSync({
            'template.docx': [c.docx, { level: 0 }],
            'schema.json': strToU8(JSON.stringify(c.schema, null, 2)),
            'manifest.json': strToU8(JSON.stringify(c.manifest, null, 2)),
        });
    }

    desempaquetar(bytes: Uint8Array): ContenidoPaquete {
        let f: Record<string, Uint8Array>;
        try {
            f = unzipSync(bytes);
        } catch {
            throw new ErrorDeDatos('El paquete .lhmodel está dañado');
        }
        for (const n of PARTES) {
            if (!f[n]) throw new ErrorDeDatos(`El paquete .lhmodel no contiene ${n}`);
        }
        try {
            return {
                docx: f['template.docx'],
                schema: JSON.parse(strFromU8(f['schema.json'])),
                manifest: JSON.parse(strFromU8(f['manifest.json'])),
            };
        } catch {
            throw new ErrorDeDatos('El paquete .lhmodel tiene JSON inválido');
        }
    }
}