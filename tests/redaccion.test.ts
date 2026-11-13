import { describe, it, expect } from 'vitest';

describe('Compendio de Redacción Jurídica y Guía Forense', () => {
  describe('Compendio Forense y Fórmulas de Redacción Avanzada', () => {
    it('contiene las 4 funciones de introductores y fórmulas de apertura', async () => {
      const { INTRODUCTORES_APERTURA } = await import('../src/domain/redaccion/compendioForense');
      expect(INTRODUCTORES_APERTURA.length).toBe(4);
      expect(INTRODUCTORES_APERTURA[0].funcion).toBe('Apertura global del texto');
      expect(INTRODUCTORES_APERTURA[1].funcion).toBe('Presentación de antecedentes (Hechos)');
      expect(INTRODUCTORES_APERTURA[2].funcion).toBe('Introducción de un nuevo eje temático');
      expect(INTRODUCTORES_APERTURA[3].funcion).toBe('Invocación de leyes o normas');
      expect(INTRODUCTORES_APERTURA[0].juridicoAvanzado.length).toBeGreaterThan(3);
    });

    it('contiene las 8 categorías de conectores lógicos y argumentativos', async () => {
      const { CONECTORES_ARGUMENTATIVOS } = await import('../src/domain/redaccion/compendioForense');
      expect(CONECTORES_ARGUMENTATIVOS.length).toBe(8);
      expect(CONECTORES_ARGUMENTATIVOS.map((c) => c.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(CONECTORES_ARGUMENTATIVOS[0].nombre).toContain('Causa');
      expect(CONECTORES_ARGUMENTATIVOS[7].nombre).toContain('Orden');
    });

    it('contiene los engarces especiales de técnica jurídica', async () => {
      const { ENGARCES_TECNICA_JURIDICA } = await import('../src/domain/redaccion/compendioForense');
      expect(ENGARCES_TECNICA_JURIDICA.length).toBe(4);
      const titulos = ENGARCES_TECNICA_JURIDICA.map((e) => e.titulo);
      expect(titulos.some((t) => t.includes('Jurisprudencia'))).toBe(true);
      expect(titulos.some((t) => t.includes('Doctrina'))).toBe(true);
      expect(titulos.some((t) => t.includes('Subsunción'))).toBe(true);
      expect(titulos.some((t) => t.includes('Otrosíes'))).toBe(true);
    });

    it('contiene marcadores conclusivos y fórmulas de petitorio y fallo', async () => {
      const { MARCADORES_CONCLUSIVOS, CONSEJO_ESTILO } = await import('../src/domain/redaccion/compendioForense');
      expect(MARCADORES_CONCLUSIVOS.length).toBe(3);
      expect(CONSEJO_ESTILO.texto).toContain('lenguaje claro');
    });

    it('contiene las 4 categorías protocolares de saludos, solicitudes, agradecimientos y despedidas', async () => {
      const { PROTOCOLO_SOLICITUDES } = await import('../src/domain/redaccion/compendioForense');
      expect(PROTOCOLO_SOLICITUDES.length).toBe(4);
      const ambitos = PROTOCOLO_SOLICITUDES.map((p) => p.ambito);
      expect(ambitos.some((a) => a.includes('Saludos'))).toBe(true);
      expect(ambitos.some((a) => a.includes('Solicitud'))).toBe(true);
      expect(ambitos.some((a) => a.includes('Agradecimiento'))).toBe(true);
      expect(ambitos.some((a) => a.includes('Despedidas'))).toBe(true);

      const todasFormulas = PROTOCOLO_SOLICITUDES.flatMap((p) => p.grupos.flatMap((g) => g.formulas));
      expect(todasFormulas.some((f) => f.includes('De mi mayor consideración'))).toBe(true);
      expect(todasFormulas.some((f) => f.includes('Agradeciendo de antemano'))).toBe(true);
      expect(todasFormulas.some((f) => f.includes('Sin otro particular motivo'))).toBe(true);
    });
  });

  describe('Esqueletos, Vocabulario, Estructuras y Argumentación de la Guía', () => {
    it('provee esqueletos de párrafo forense con estructura y plantilla', async () => {
      const { ESQUELETOS_PARRAFO } = await import('../src/domain/redaccion/esqueletosParrafo');
      expect(ESQUELETOS_PARRAFO.length).toBeGreaterThanOrEqual(4);
      const nombres = ESQUELETOS_PARRAFO.map((e) => e.nombre);
      expect(nombres.some((n) => n.includes('Subsunción'))).toBe(true);
      expect(nombres.some((n) => n.includes('PEEL'))).toBe(true);
      expect(nombres.some((n) => n.includes('Refutación'))).toBe(true);
    });

    it('provee equivalencias coloquiales y latinismos jurídicos en cursiva', async () => {
      const { EQUIVALENCIAS_COLOQUIALES, LATINISMOS_JURIDICOS } = await import('../src/domain/redaccion/vocabularioForense');
      expect(EQUIVALENCIAS_COLOQUIALES.length).toBeGreaterThan(5);
      expect(LATINISMOS_JURIDICOS.length).toBeGreaterThan(8);
      expect(LATINISMOS_JURIDICOS.every((l) => l.requiereCursiva)).toBe(true);
    });

    it('define estructuras y checklists procesales obligatorios', async () => {
      const { ESTRUCTURAS_DOCUMENTO } = await import('../src/domain/redaccion/estructurasDocumento');
      expect(ESTRUCTURAS_DOCUMENTO.length).toBeGreaterThanOrEqual(3);
      const demanda = ESTRUCTURAS_DOCUMENTO.find((e) => e.id === 'demanda-ordinaria');
      expect(demanda).toBeDefined();
      expect(demanda?.requisitos.some((r) => r.titulo.includes('Petitorio') && r.obligatorio)).toBe(true);
    });

    it('provee los tipos de argumentos y checklist de falacias', async () => {
      const { TIPOS_ARGUMENTOS_JURIDICOS, FALACIAS_JURIDICAS } = await import('../src/domain/redaccion/argumentacionForense');
      expect(TIPOS_ARGUMENTOS_JURIDICOS.length).toBeGreaterThanOrEqual(10);
      expect(FALACIAS_JURIDICAS.length).toBeGreaterThanOrEqual(5);
    });
  });
});
