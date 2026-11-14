import { describe, expect, it } from 'vitest';
import {
  PERFILES_TEMAS,
  PRESETS,
  PRIMARIOS,
  SUPERFICIES,
  migrarTemaLegacy,
} from '../src/ui/_core/tema';

describe('Sistema de temas estilo Verona', () => {
  it('migra correctamente identificadores y alias legados', () => {
    expect(migrarTemaLegacy('claro')).toEqual(PERFILES_TEMAS[0].config);
    expect(migrarTemaLegacy('oxford')).toEqual(PERFILES_TEMAS[0].config);
    expect(migrarTemaLegacy('oscuro')).toEqual(PERFILES_TEMAS[2].config);
    expect(migrarTemaLegacy('slate')).toEqual(PERFILES_TEMAS[2].config);
    expect(migrarTemaLegacy('rose')).toEqual(PERFILES_TEMAS[4].config);
    expect(migrarTemaLegacy('rose-quartz')).toEqual(PERFILES_TEMAS[4].config);
  });

  it('expone las colecciones de Primary, Surface, Presets y Perfiles rápidos sin duplicados', () => {
    expect(PRIMARIOS.length).toBe(9);
    expect(new Set(PRIMARIOS.map((p) => p.id)).size).toBe(PRIMARIOS.length);
    expect(SUPERFICIES.map((s) => s.id)).toEqual([
      'slate',
      'gray',
      'zinc',
      'neutral',
      'stone',
      'soho',
      'viva',
      'ocean',
      'rose',
    ]);
    expect(PRESETS.map((p) => p.id)).toEqual(['aura', 'lara', 'nora']);
    expect(PERFILES_TEMAS.length).toBe(5);
  });
});
