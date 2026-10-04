import { ci } from './ci';
import { concordar } from './concordar';
import { fecha } from './fecha';
import { lista } from './lista';
import { literal } from './literal';
import { mayus, minus } from './mayus-minus';
import { moneda } from './moneda';
import { superficie } from './superficie';
import { titulo } from './titulo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Filtro = (valor: any, ...args: string[]) => string;

export const FILTROS: Readonly<Record<string, Filtro>> = Object.freeze({
    mayus, minus, titulo, lista, concordar, literal, fecha, moneda, superficie, ci,
});