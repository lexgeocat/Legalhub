import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { ContenidoPaquete, FormatoPaquete } from '../../application/puertos/modelos';
import { ErrorDeDatos } from '../../domain/errores';
import { leerFuente } from '../../domain/fuenteModelo';

const OBLIGATORIAS = ['template.docx', 'schema.json', 'manifest.json'] as const;

export class FormatoPaqueteFflate implements FormatoPaquete {
    empaquetar(c: ContenidoPaquete): Uint8Array {
        const partes: Zippable = {
            'template.docx': [c.docx, { level: 0 }],
            'schema.json': strToU8(JSON.stringify(c.schema, null, 2)),
            'manifest.json': strToU8(JSON.stringify(c.manifest, null, 2)),
        };
        if (c.fuente) partes['fuente.json'] = strToU8(JSON.stringify(c.fuente, null, 2));
        return zipSync(partes);
    }

    desempaquetar(bytes: Uint8Array): ContenidoPaquete {
        let f: Record<string, Uint8Array>;
        try {
            f = unzipSync(bytes);
        } catch {
            throw new ErrorDeDatos('El paquete .lhmodel está dañado');
        }
        for (const n of OBLIGATORIAS) {
            if (!f[n]) throw new ErrorDeDatos(`El paquete .lhmodel no contiene ${n}`);
        }
        try {
            return {
                docx: f['template.docx'],
                schema: JSON.parse(strFromU8(f['schema.json'])),
                manifest: JSON.parse(strFromU8(f['manifest.json'])),
                fuente: f['fuente.json'] ? leerFuente(strFromU8(f['fuente.json'])) : undefined,
            };
        } catch {
            throw new ErrorDeDatos('El paquete .lhmodel tiene JSON inválido');
        }
    }
}