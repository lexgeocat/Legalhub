import { ci } from './ci';
import { concordar } from './concordar';
import { fecha, fechalarga } from './fecha';
import { lista } from './lista';
import { literal } from './literal';
import { mayus, minus } from './mayus-minus';
import { dolares, moneda } from './moneda';
import { superficie } from './superficie';
import { titulo } from './titulo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Filtro = (valor: any, ...args: string[]) => string;

export const FILTROS: Readonly<Record<string, Filtro>> = Object.freeze({
    mayus, minus, titulo, lista, concordar, literal, fecha, fechalarga, moneda, dolares, superficie, ci,
});