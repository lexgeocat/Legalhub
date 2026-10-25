import { describe, it, expect } from 'vitest';
import {
  formatearCitaJurisprudencial,
  formatearFichaJurisprudencial,
  sanearTextoExtracto,
  sanearContenidoHtml,
  generarNombreArchivoPdf,
  mezclarDetalle,
  esPdfValido,
  formatearFechaIsoBolivia,
  parsearFechaEmision,
  extraerNumeroResolucion,
  ordenarResolucionesPorFechaDesc,
  debeMostrarResumen,
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

  it('sanea extractos HTML reemplazando estilos de resaltado y etiquetas de TSJ con etiquetas mark', () => {
    const rawTcp = "dentro del <span style='background-color:#FFFF00;'><b>proceso</b></span> seguido";
    expect(sanearTextoExtracto(rawTcp)).toBe('dentro del <mark>proceso</mark> seguido');

    const rawTsj = 'del proceso de <b>Asistencia</b> <b>Familiar</b> seguido';
    expect(sanearTextoExtracto(rawTsj)).toBe('del proceso de <mark>Asistencia</mark> <mark>Familiar</mark> seguido');
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

  it('formatea la Ficha de Análisis Jurisprudencial completa con todos los campos necesarios', () => {
    const res: ResolucionJurisprudencia = {
      id: '32703',
      origen: 'TSJ',
      tipoResolucion: 'Auto Supremo',
      numeroResolucion: 'AS/0169/2019',
      numeroExpediente: 'O-4-19-Com.',
      fechaEmision: '27/02/2019',
      sala: 'Sala Civil',
      magistrado: 'Juan Carlos Berrios Albizu',
      formaResolucion: 'Legal',
      tipoJurisprudencia: 'Reiteradora',
      descriptor: 'Derecho Civil / Derecho Procesal Civil / Recursos / Recurso de Compulsa / Legal',
      restrictor: 'Por no aplicarse la ultractividad de la norma que permitia la concesión del recurso de casación',
      maxima: 'ULTRA ACTIVIDAD DE LA NORMA PROCESAL/La ley derogatoria en ciertos casos...',
      sintesis: 'El recurrente reclamó que el Tribunal Ad quem...',
      ratioDecidendi: '… de acuerdo a los antecedentes contenidos en la Sentencia Nº 057/2018...',
      precedente: 'Ley Nº 548, Código Niña, Niño y Adolescente...',
    };

    const fichaTexto = formatearFichaJurisprudencial(res);
    expect(fichaTexto).toContain('FICHA DE ANÁLISIS JURISPRUDENCIAL');
    expect(fichaTexto).toContain('Sala:                   Sala Civil');
    expect(fichaTexto).toContain('N° de Resolución:       Auto Supremo AS/0169/2019');
    expect(fichaTexto).toContain('MÁXIMA:');
    expect(fichaTexto).toContain('ULTRA ACTIVIDAD DE LA NORMA PROCESAL');
    expect(fichaTexto).toContain('EXTRACTO DE LA RATIO DECIDENDI:');
    expect(fichaTexto).toContain('DESCRIPTOR:');
    expect(fichaTexto).toContain('RESTRICTOR:');
    expect(fichaTexto).toContain('PRECEDENTE / NORMA APLICADA:');
    expect(fichaTexto).toContain('Forma de Resolución:    Legal');
    expect(fichaTexto).toContain('Tipo de Jurisprudencia: Reiteradora');
  });

  it('parsea correctamente fechas bolivianas en formatos DD/MM/YYYY, DD-MM-YYYY y YYYY-MM-DD', () => {
    const f1 = parsearFechaEmision('27/12/2024');
    const f2 = parsearFechaEmision('05-01/2024');
    const f3 = parsearFechaEmision('2024-06-15');

    expect(f1).toBeGreaterThan(f2);
    expect(f1).toBeGreaterThan(f3);
    expect(f3).toBeGreaterThan(f2);
    expect(parsearFechaEmision(undefined)).toBe(0);
    expect(parsearFechaEmision('')).toBe(0);
  });

  it('extrae el número correlativo de una resolución para desempates', () => {
    expect(extraerNumeroResolucion('AS/1471/2024-RI')).toBe(1471);
    expect(extraerNumeroResolucion('AS/0002/2024')).toBe(2);
    expect(extraerNumeroResolucion('3593/2026-S1')).toBe(3593);
    expect(extraerNumeroResolucion(undefined)).toBe(0);
  });

  it('ordena resoluciones por fecha de emisión en el más reciente (descendente)', () => {
    const lista: ResolucionJurisprudencia[] = [
      {
        id: '1',
        origen: 'TSJ',
        tipoResolucion: 'Auto Supremo',
        numeroResolucion: 'AS/0001/2024-RA',
        fechaEmision: '05/01/2024',
      },
      {
        id: '2',
        origen: 'TSJ',
        tipoResolucion: 'Auto Supremo',
        numeroResolucion: 'AS/1424/2024',
        fechaEmision: '27/12/2024',
      },
      {
        id: '3',
        origen: 'TSJ',
        tipoResolucion: 'Auto Supremo',
        numeroResolucion: 'AS/0500/2024',
        fechaEmision: '15/06/2024',
      },
      {
        id: '4',
        origen: 'TSJ',
        tipoResolucion: 'Auto Supremo',
        numeroResolucion: 'AS/1470/2024-RA',
        fechaEmision: '06/12/2024',
      },
      {
        id: '5',
        origen: 'TSJ',
        tipoResolucion: 'Auto Supremo',
        numeroResolucion: 'AS/1471/2024-RI',
        fechaEmision: '06/12/2024',
      },
    ];

    const ordenadas = ordenarResolucionesPorFechaDesc(lista);

    expect(ordenadas.map((r) => r.numeroResolucion)).toEqual([
      'AS/1424/2024',    // 27/12/2024 (el más reciente)
      'AS/1471/2024-RI', // 06/12/2024 (desempate por correlativo 1471 > 1470)
      'AS/1470/2024-RA', // 06/12/2024
      'AS/0500/2024',    // 15/06/2024
      'AS/0001/2024-RA', // 05/01/2024 (el más antiguo)
    ]);
  });

  it('debeMostrarResumen descarta resúmenes que sólo duplican el proceso y conserva descripciones válidas', () => {
    // Casos que duplican el proceso (devueltos por TSJ Génesis)
    expect(debeMostrarResumen('Proceso: Violación', 'Violación')).toBe(false);
    expect(debeMostrarResumen('proceso: violación', 'Violación')).toBe(false);
    expect(debeMostrarResumen('Violación', 'Violación')).toBe(false);
    expect(debeMostrarResumen('<b>Proceso: Violación</b>', 'Violación')).toBe(false);
    expect(debeMostrarResumen('Proceso:', 'Violación')).toBe(false);
    expect(debeMostrarResumen(undefined, 'Violación')).toBe(false);

    // Casos donde hay una descripción sustancial o coincidencia de búsqueda por palabras
    expect(
      debeMostrarResumen(
        'En los delitos contra la libertad sexual la declaración de la víctima adquiere relevancia...',
        'Violación'
      )
    ).toBe(true);
    expect(
      debeMostrarResumen(
        'El recurrente alega errónea valoración probatoria respecto al tipo penal de <mark>violación</mark>...',
        'Violación'
      )
    ).toBe(true);
  });
});


