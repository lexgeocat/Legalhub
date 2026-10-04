import Decimal from 'decimal.js';
import { toCardinal } from 'n2words/es';
import { ErrorDeDatos } from '../errores';

export function aDecimal(valor: unknown, etiqueta = 'número'): Decimal {
    if (valor === null || valor === undefined || valor === '') {
        throw new ErrorDeDatos(`Falta el ${etiqueta}`);
    }
    if (typeof valor !== 'string' && typeof valor !== 'number' && !(valor instanceof Decimal)) {
        throw new ErrorDeDatos(`Valor no numérico: ${String(valor)}`);
    }
    try {
        const d = new Decimal(typeof valor === 'string' ? valor.trim() : valor);
        if (!d.isFinite()) throw new Error('no finito');
        return d;
    } catch {
        throw new ErrorDeDatos(`Valor numérico inválido: "${String(valor)}"`);
    }
}

export function agruparMiles(entero: string): string {
    return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function capitalizar(texto: string): string {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function cardinalEntero(entero: string): string {
    return toCardinal(entero);
}