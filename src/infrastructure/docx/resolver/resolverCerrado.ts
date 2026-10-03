
// infrastructure/docx/resolver/resolverCerrado.ts
import { FILTROS } from '../../domain/filtros';

// Definir los tipos para el contexto
export type Genero = 'M' | 'F';

export interface Persona {
  genero: Genero | null;
  // otros campos...
}

export interface Contexto {
  expediente: {
    codigo: string;
    materia: string;
    referencia: string;
    juzgado: string;
    nro_causa: string;
    estado: string;
  };
  partes: {
    demandantes: Persona[];
    demandados: Persona[];
    terceros: Persona[];
    // otros roles...
  };
  cliente: Persona;
  abogado: Persona & { 
    matriculaProfesional: string;
    domicilioProcesal: string;
  };
  inmuebles: Array<{
    titulares: string[]; // IDs de personas
    superficie: string; // en m2
    matricula: string;
    colindancias: { norte: string; sur: string; este: string; oeste: string };
  }>;
  caso: {
    hechos: string;
    cuantia: number | string;
    petitorio: string;
    // otros campos libres...
  };
  hoy: string; // fecha ISO
}

/**
 * Resolver cerrado que solo permite operaciones específicas
 * No ejecuta código arbitrario, solo aplica filtros predefinidos
 */
export function resolverCerrado(filtrosDisponibles: Record<string, Function>) {
  return function (scope: Contexto, key: string): any {
    // Esta es una implementación simplificada
    // En una implementación completa, esto haría el parsing de la sintaxis de marcadores
    // y aplicaría los filtros correspondientes
    
    // Por ahora, devolvemos una función que lanzará error si se intenta acceder
    // a propiedades no permitidas o se usan filtros no autorizados
    return () => {
      throw new Error(Acceso no permitido a '' en el resolver cerrado);
    };
  };
}

// Exponer los filtros disponibles para usar en el resolver
export const FILTROS = {
  // Desde domain/filtros
  mayus: (texto: string) => texto.toUpperCase(),
  minus: (texto: string) => texto.toLowerCase(),
  titulo: (texto: string) => {
    if (!texto) return texto;
    const minusculas = ['de', 'del', 'la', 'las', 'los', 'y', 'o', 'u', 'ni', 'por', 'para', 'con'];
    return texto
      .split(' ')
      .map((palabra, indice) => {
        const lower = palabra.toLowerCase();
        if (indice === 0 || !minusculas.includes(lower)) {
          return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
        }
        return lower;
      })
      .join(' ');
  },
  lista: (array: string[]) => {
    if (array.length === 0) return '';
    if (array.length === 1) return array[0];
    if (array.length === 2) return array[0] + ' y ' + array[1];
    return array.slice(0, -1).join(', ') + ' y ' + array[array.length - 1];
  },
  literal: (numero: number | string) => {
    // Esta sería la implementación usando n2words
    // Por ahora, retornamos el número como string
    return String(numero);
  },
  fecha: (fechaISO: string) => {
    if (!fechaISO) return '';
    const fecha = new Date(fechaISO);
    if (isNaN(fecha.getTime())) return '';
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(fecha);
  },
  moneda: (monto: number | string, simbolo: string = 'Bs.') => {
    // Implementación simplificada
    return \\ \\;
  },
  superficie: (valor: number | string) => {
    const num = Number(valor);
    return \\ m² (\ metros cuadrados)\;
  },
  ci: (datos: [string, string, string]) => {
    const [numero, complemento, expedido] = datos;
    let resultado = numero.trim();
    if (complemento?.trim()) resultado += '-' + complemento.trim();
    if (expedido?.trim()) resultado += ' ' + expedido.trim();
    return resultado;
  },
  concordar: (partes: { genero: Genero | null }[], singM: string, singF: string, plurM?: string, plurF?: string): string => {
    if (partes.length === 0) return '';
    if (partes.some(p => p.genero === null)) {
      throw new Error('Falta el género de una de las partes');
    }
    const pm = plurM ?? singM + 's';
    const pf = plurF ?? singF + 's';
    const todasF = partes.every(p => p.genero === 'F');
    if (partes.length === 1) return todasF ? singF : singM;
    return todasF ? pf : pm;
  }
};
