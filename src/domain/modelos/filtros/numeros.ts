import Decimal from 'decimal.js';
import { toCardinal } from 'n2words/es';
import { ErrorDeDatos } from '../errores';

/**
 * Acepta «15000,50», «15.000,50», «15,000.50» y «15.000» (miles).
 * Con `miles: false` solo convierte la coma decimal (para porcentajes, que pueden llevar 3 decimales).
 */
export function normalizarNumeroTexto(texto: string, miles = true): string {
    const t = texto.trim().replace(/\s/g, '');
    const punto = t.lastIndexOf('.');
    const coma = t.lastIndexOf(',');
    if (!miles) return coma >= 0 && punto < 0 ? t.replace(',', '.') : t;
    if (punto >= 0 && coma >= 0) {
        return coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
    }
    if (coma >= 0) {
        return /^[+-]?[1-9]\d{0,2}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
    }
    if (punto >= 0 && /^[+-]?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) return t.replace(/\./g, '');
    return t;
}

export function aDecimal(valor: unknown, etiqueta = 'número', opciones: { miles?: boolean } = {}): Decimal {
    if (valor === null || valor === undefined || valor === '') {
        throw new ErrorDeDatos(`Falta el ${etiqueta}`);
    }
    if (typeof valor !== 'string' && typeof valor !== 'number' && !(valor instanceof Decimal)) {
        throw new ErrorDeDatos(`Valor no numérico: ${String(valor)}`);
    }
    try {
        const d = new Decimal(typeof valor === 'string' ? normalizarNumeroTexto(valor, opciones.miles ?? true) : valor);
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