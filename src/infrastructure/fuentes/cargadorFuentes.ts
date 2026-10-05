import type { CargadorFuentes } from '../docx/incrustarFuentes';
import { woffATtf } from './woff';

type Manifiesto = Record<string, Record<string, string>>;

/** Lee las fuentes empaquetadas en /fuentes (las que genera `pnpm fuentes`). */
export class CargadorFuentesWeb implements CargadorFuentes {
    private manifiesto: Promise<Manifiesto> | null = null;
    private readonly cache = new Map<string, Promise<Uint8Array | null>>();

    constructor(private readonly base = '/fuentes') { }

    private leerManifiesto(): Promise<Manifiesto> {
        this.manifiesto ??= fetch(`${this.base}/manifiesto.json`)
            .then((r) => (r.ok ? (r.json() as Promise<Manifiesto>) : {}))
            .catch(() => ({}));
        return this.manifiesto;
    }

    async familiasDisponibles(): Promise<string[]> {
        return Object.keys(await this.leerManifiesto());
    }

    ttf(familia: string, negrita: boolean, cursiva: boolean): Promise<Uint8Array | null> {
        const clave = `${familia}|${negrita}|${cursiva}`;
        let p = this.cache.get(clave);
        if (!p) {
            p = this.cargar(familia, negrita, cursiva).catch(() => null);
            this.cache.set(clave, p);
        }
        return p;
    }

    private async cargar(familia: string, negrita: boolean, cursiva: boolean): Promise<Uint8Array | null> {
        const m = await this.leerManifiesto();
        const archivo = m[familia]?.[`${negrita ? 700 : 400}-${cursiva ? 'italic' : 'normal'}`];
        if (!archivo) return null;
        const r = await fetch(`${this.base}/${archivo}`);
        if (!r.ok) return null;
        return woffATtf(new Uint8Array(await r.arrayBuffer()), { familia, negrita, cursiva });
    }
}