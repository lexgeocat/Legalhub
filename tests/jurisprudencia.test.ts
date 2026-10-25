import { describe, it, expect } from 'vitest';
import {
  formatearCitaJurisprudencial,
  sanearTextoExtracto,
  sanearContenidoHtml,
  generarNombreArchivoPdf,
  mezclarDetalle,
  esPdfValido,
  formatearFechaIsoBolivia,
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

  it('sanitiza HTML eliminando enlaces, scripts e iframes potencialmente maliciosos (S1)', () => {
    const peligroso = `
      <p>Texto legítimo <b>importante</b></p>
      <script>alert('xss')</script>
      <a href="https://externo.com" onclick="hack()">Haz clic aquí</a>
      <iframe src="malware.html"></iframe>
    `;
    const saneado = sanearContenidoHtml(peligroso);
    expect(saneado).toContain('<p>Texto legítimo <b>importante</b></p>');
    expect(saneado).toContain('Haz clic aquí');
    expect(saneado).not.toContain('<script>');
    expect(saneado).not.toContain('<a href');
    expect(saneado).not.toContain('<iframe');
    expect(saneado).not.toContain('onclick');
  });

  it('genera nombres de archivo PDF deterministas y seguros (D6)', () => {
    expect(generarNombreArchivoPdf('TSJ', 'AS/0554/2026-FF')).toBe('TSJ_AS_0554_2026-FF.pdf');
    expect(generarNombreArchivoPdf('TCP', '0812/2023-S3')).toBe('TCP_0812_2023-S3.pdf');
  });

  it('valida cabecera mágica de PDF correctamente (D14)', () => {
    const valido = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
    const invalido = new Uint8Array([0x7b, 0x22, 0x65, 0x72, 0x72, 0x6f, 0x72]); // {"error...

    expect(esPdfValido(valido)).toBe(true);
    expect(esPdfValido(invalido)).toBe(false);
  });

  it('mezcla detalle sin sobreescribir campos válidos con undefined (D8)', () => {
    const base: ResolucionJurisprudencia = {
      id: '123',
      idLocal: 'ulid_local',
      origen: 'TSJ',
      tipoResolucion: 'Auto Supremo',
      numeroResolucion: 'AS/0554/2026-FF',
      fechaEmision: '2026-03-04',
      sala: 'Sala Penal',
      guardadaLocal: true,
    };

    const detalle: Partial<ResolucionJurisprudencia> = {
      contenidoHtml: '<p>Texto completo del fallo</p>',
      magistrado: 'Olvis Eguez Oliva',
      sala: undefined, // No debe pisar la sala base
    };

    const mezclado = mezclarDetalle(base, detalle);
    expect(mezclado.contenidoHtml).toBe('<p>Texto completo del fallo</p>');
    expect(mezclado.magistrado).toBe('Olvis Eguez Oliva');
    expect(mezclado.sala).toBe('Sala Penal');
    expect(mezclado.idLocal).toBe('ulid_local');
    expect(mezclado.guardadaLocal).toBe(true);
  });

  it('formatea fechas ISO bolivianas sin desfase UTC-4 (Q15)', () => {
    expect(formatearFechaIsoBolivia('2024-05-10')).toBe('10 de mayo de 2024');
  });
});
