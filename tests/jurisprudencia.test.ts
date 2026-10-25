import { describe, it, expect } from 'vitest';
import {
  formatearCitaJurisprudencial,
  sanearTextoExtracto,
  type ResolucionJurisprudencia,
} from '../src/domain/jurisprudencia/jurisprudencia';

describe('Jurisprudencia Domain', () => {
  it('formatea correctamente una cita de Auto Supremo del TSJ', () => {
    const resolucion: ResolucionJurisprudencia = {
      id: '31557',
      origen: 'TSJ',
      tipoResolucion: 'Auto Supremo',
      numeroResolucion: 'AS/0711/2018',
      fechaEmision: '23/07/2018',
      sala: 'Sala Civil',
      magistrado: 'Marco Ernesto Jaimes Molina',
    };

    const cita = formatearCitaJurisprudencial(resolucion);
    expect(cita).toBe(
      'Cfr. Auto Supremo N° AS/0711/2018 de 23/07/2018, Sala Civil, Tribunal Supremo de Justicia, Magistrado Relator: Marco Ernesto Jaimes Molina.'
    );
  });

  it('formatea correctamente una cita de Sentencia Constitucional del TCP', () => {
    const resolucion: ResolucionJurisprudencia = {
      id: '221924',
      origen: 'TCP',
      tipoResolucion: 'Sentencia Constitucional Plurinacional',
      numeroResolucion: '3593/2026-S1',
      fechaEmision: '5 de octubre de 2026',
      sala: 'Sala Primera Especializada',
    };

    const cita = formatearCitaJurisprudencial(resolucion);
    expect(cita).toBe(
      'Cfr. Sentencia Constitucional Plurinacional 3593/2026-S1 de 5 de octubre de 2026, Sala Primera Especializada, Tribunal Constitucional Plurinacional de Bolivia.'
    );
  });

  it('sanea extractos HTML reemplazando estilos de resaltado con etiquetas mark', () => {
    const raw = "dentro del <span style='background-color:#FFFF00;'><b>proceso</b></span> seguido";
    const limpio = sanearTextoExtracto(raw);
    expect(limpio).toBe('dentro del <mark><b>proceso</b></mark> seguido');
  });

  it('formatea correctamente cita con Auto Supremo exacto como AS/0554/2026-FF', () => {
    const resolucion: ResolucionJurisprudencia = {
      id: '97159',
      origen: 'TSJ',
      tipoResolucion: 'Auto Supremo',
      numeroResolucion: 'AS/0554/2026-FF',
      fechaEmision: '04/03/2026',
      sala: 'Sala Penal',
    };

    const cita = formatearCitaJurisprudencial(resolucion);
    expect(cita).toBe('Cfr. Auto Supremo N° AS/0554/2026-FF de 04/03/2026, Sala Penal, Tribunal Supremo de Justicia.');
  });
});
