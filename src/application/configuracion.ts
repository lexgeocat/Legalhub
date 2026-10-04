import type { DbPuerto } from './puertos/db';

export interface ConfigApp {
    carpetaRaiz: string | null;
    abogadoPersonaId: string | null;
    abogadoMatricula: string;
    abogadoDomicilioProcesal: string;
}

const CLAVES: Record<keyof ConfigApp, string> = {
    carpetaRaiz: 'carpeta_raiz',
    abogadoPersonaId: 'abogado_persona_id',
    abogadoMatricula: 'abogado_matricula',
    abogadoDomicilioProcesal: 'abogado_domicilio_procesal',
};

export class Configuracion {
    constructor(private readonly db: DbPuerto) { }

    async cargar(): Promise<ConfigApp> {
        const filas = await this.db.consultar<{ clave: string; valor: string }>('SELECT clave, valor FROM configuracion');
        const m = new Map(filas.map((f) => [f.clave, f.valor]));
        return {
            carpetaRaiz: m.get(CLAVES.carpetaRaiz) || null,
            abogadoPersonaId: m.get(CLAVES.abogadoPersonaId) || null,
            abogadoMatricula: m.get(CLAVES.abogadoMatricula) ?? '',
            abogadoDomicilioProcesal: m.get(CLAVES.abogadoDomicilioProcesal) ?? '',
        };
    }

    async guardar(parcial: Partial<ConfigApp>): Promise<void> {
        const claves = (Object.keys(parcial) as (keyof ConfigApp)[]).filter((k) => parcial[k] !== undefined);
        if (claves.length === 0) return;
        await this.db.transaccion(
            claves.map((k) => ({
                sql: 'INSERT INTO configuracion (clave, valor) VALUES (?1, ?2) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
                params: [CLAVES[k], parcial[k] ?? ''],
            })),
            [{ accion: 'config.guardar', detalle: { claves } }],
        );
    }
}