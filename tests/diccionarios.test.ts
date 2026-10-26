import { describe, it, expect } from 'vitest';
import {
  analizarDiccionario,
  formatearCitaDiccionario,
  sanearTextoDefinicion,
} from '../src/domain/diccionarios/diccionarios';

describe('Diccionarios Jurídicos Domain', () => {
  describe('sanearTextoDefinicion', () => {
    it('escapa caracteres HTML y resalta los términos de búsqueda', () => {
      const entrada = 'Acción <legal> de usucapión & prescripción adquisitiva.';
      const salida = sanearTextoDefinicion(entrada, 'usucapión');
      expect(salida).toContain('&lt;legal&gt;');
      expect(salida).toContain('&amp;');
      expect(salida).toContain('<mark>usucapión</mark>');
    });
  });

  describe('formatearCitaDiccionario', () => {
    it('genera una cita doctrinal formal completa con autor y página', () => {
      const cita = formatearCitaDiccionario(
        'USUCAPIÓN',
        'Modo de adquirir el dominio de una cosa mediante la posesión continuada durante el tiempo que exige la ley.',
        'Diccionario Jurídico Elemental',
        'Guillermo Cabanellas de Torres',
        412
      );

      expect(cita).toContain('«USUCAPIÓN: Modo de adquirir el dominio');
      expect(cita).toContain('Cfr. Guillermo Cabanellas de Torres, Diccionario Jurídico Elemental, pág. 412');
    });

    it('genera cita correctamente cuando no hay autor especificado', () => {
      const cita = formatearCitaDiccionario(
        'Violencia económica',
        'Toda acción u omisión que menoscaba los recursos económicos o patrimoniales de las mujeres.',
        'Glosario de Términos - Ley 348',
        undefined,
        45
      );

      expect(cita).toContain('«Violencia económica: Toda acción u omisión');
      expect(cita).toContain('Cfr. Glosario de Términos - Ley 348, pág. 45');
    });
  });

  describe('analizarDiccionario parser', () => {
    it('extrae términos de Cabanellas identificados con asterisco *', () => {
      const paginas: string[][] = [
        [
          '*AMOJONAMIENTO. El acto de señalar con mojones los términos o límites de alguna heredad o tierra.',
          '* A BENEFICIO DE INVENTARIO. Actitud sucesoria del heredero que limita su responsabilidad.',
        ],
      ];

      const terminos = analizarDiccionario(paginas);
      expect(terminos.length).toBe(2);
      expect(terminos[0].termino).toBe('AMOJONAMIENTO');
      expect(terminos[0].definicion).toContain('El acto de señalar');
      expect(terminos[1].termino).toBe('A BENEFICIO DE INVENTARIO');
      expect(terminos[1].definicion).toContain('Actitud sucesoria');
    });

    it('extrae términos de Manuel Ossorio en líneas cortas aisladas', () => {
      const paginas: string[][] = [
        ['Portada editorial sin terminos'],
        [
          'Abogado',
          'En latín se llamaba advocatus, de ad y vocatus, a quien se requería para asesorar en los asuntos judiciales.',
          'A beneficio de inventario',
          'Actitud sucesoria del heredero testamentario que no compromete su patrimonio personal.',
        ],
      ];

      const terminos = analizarDiccionario(paginas);
      expect(terminos.length).toBe(2);
      expect(terminos[0].termino).toBe('Abogado');
      expect(terminos[0].definicion).toContain('En latín se llamaba advocatus');
      expect(terminos[1].termino).toBe('A beneficio de inventario');
      expect(terminos[1].definicion).toContain('Actitud sucesoria');
    });

    it('extrae términos con formato Glosario Ley 348 (TÉRMINO (Art. X) Definición)', () => {
      const paginas: string[][] = [
        [
          'Aborto forzado (Art. 83 que modifica el Art. 267 bis del Código Penal)',
          'Quien mediante violencia física, psicológica o intimidación hiciere abortar a una mujer.',
          'Acceso a la justicia (Art. 45.1)',
          'Garantía que asiste a toda mujer en situación de violencia.',
        ],
      ];

      const terminos = analizarDiccionario(paginas);
      expect(terminos.length).toBe(2);
      expect(terminos[0].termino).toContain('Aborto forzado (Art. 83');
      expect(terminos[0].definicion).toContain('violencia física');
      expect(terminos[1].termino).toContain('Acceso a la justicia (Art. 45.1)');
    });

    it('continúa la definición del último término a través de múltiples páginas', () => {
      const paginas: string[][] = [
        [
          'HABEAS CORPUS:',
          'Acción constitucional extraordinaria que tutela la libertad personal y de locomoción',
        ],
        [
          'frente a privaciones ilegales, arbitrarias o indebidas de libertad.',
          'HERENCIA:',
          'Conjunto de bienes, derechos y obligaciones transmisibles que deja una persona al fallecer.',
        ],
      ];

      const terminos = analizarDiccionario(paginas);
      expect(terminos.length).toBe(2);
      expect(terminos[0].termino).toBe('HABEAS CORPUS');
      expect(terminos[0].definicion).toContain('frente a privaciones ilegales');
      expect(terminos[0].pagina).toBe(1);
      expect(terminos[1].termino).toBe('HERENCIA');
      expect(terminos[1].pagina).toBe(2);
    });

    it('genera términos por página si el documento no tiene formato estructurado', () => {
      const paginas: string[][] = [
        [
          'Texto de consideraciones generales sin ningún encabezado particular de término reconocido.',
        ],
      ];

      const terminos = analizarDiccionario(paginas);
      expect(terminos.length).toBe(1);
      expect(terminos[0].termino).toBe('Página 1');
      expect(terminos[0].pagina).toBe(1);
    });
  });
});
