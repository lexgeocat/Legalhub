import { describe, expect, it } from 'vitest';
import { bloquesATexto, parsearTexto } from '../src/domain/modelos/fuenteModelo';
import { analizarParrafoObservador, calcularMetricasDocumento } from '../src/domain/redaccion/observadorRedaccion';
import { adaptarReemplazo, buscarSinonimos } from '../src/domain/redaccion/tesauroForense';

describe('Formato enriquecido: resaltado, listas y tablas (fuenteModelo)', () => {
    it('serializa y parsea tramos con resaltado de colores', () => {
        const original = 'Texto normal y ⟪||yellow⟫importante⟪/⟫ con ⟪Arial|14|green⟫énfasis verde⟪/⟫.';
        const bloques = parsearTexto(original);
        expect(bloques).toHaveLength(1);
        const b = bloques[0];
        expect(b.tipo).toBe('parrafo');
        if (b.tipo === 'parrafo') {
            expect(b.tramos[1].resaltado).toBe('yellow');
            expect(b.tramos[1].texto).toBe('importante');
            expect(b.tramos[3].resaltado).toBe('green');
            expect(b.tramos[3].fuente).toBe('Arial');
            expect(b.tramos[3].tamanoPt).toBe(14);
        }
        expect(bloquesATexto(bloques)).toBe(original);
    });

    it('serializa y parsea listas con viñetas [ul] y numeración [ol]', () => {
        const original = '[ul] Primer punto de prueba\n[ul] Segundo punto\n[ol] Primero numerado\n[ol] Segundo numerado';
        const bloques = parsearTexto(original);
        expect(bloques).toHaveLength(4);
        expect(bloques[0].tipo === 'parrafo' && bloques[0].lista).toBe('ul');
        expect(bloques[2].tipo === 'parrafo' && bloques[2].lista).toBe('ol');
        expect(bloquesATexto(bloques)).toBe(original);
    });

    it('serializa y parsea tablas [th] y [tr] con celdas separadas por │', () => {
        const original = '[th] Nro. │ Documento │ Fecha\n[tr] 1 │ Contrato de préstamo │ 12/05/2025\n[tr] 2 │ Recibo de pago │ 14/06/2025';
        const bloques = parsearTexto(original);
        expect(bloques).toHaveLength(1);
        const t = bloques[0];
        expect(t.tipo).toBe('tabla');
        if (t.tipo === 'tabla') {
            expect(t.encabezado).toBe(true);
            expect(t.filas).toHaveLength(3);
            expect(t.filas[0][1].tramos[0].texto).toBe('Documento');
            expect(t.filas[1][1].tramos[0].texto).toBe('Contrato de préstamo');
        }
        expect(bloquesATexto(bloques)).toBe(original);
    });
});

describe('Observador inteligente de ortografía, puntuación, gramática y estilo', () => {
    it('detecta errores ortográficos y tildes omitidas en léxico jurídico', () => {
        const hallazgos = analizarParrafoObservador('Solicito que se dicte resolucion en la apelacion.', 0);
        const fragmentos = hallazgos.map((h) => h.fragmento.toLowerCase());
        expect(fragmentos).toContain('resolucion');
        expect(fragmentos).toContain('apelacion');
        const hRes = hallazgos.find((h) => h.fragmento.toLowerCase() === 'resolucion');
        expect(hRes?.sugerencias).toContain('resolución');
    });

    it('detecta homófonos y parónimos según el contexto («a presentado», «infringir un daño»)', () => {
        const hallazgos = analizarParrafoObservador('El demandado a presentado pruebas tras infringir un daño grave.', 0);
        const reglas = hallazgos.map((h) => h.reglaId);
        expect(reglas).toContain('ort-a-part');
        expect(reglas).toContain('ort-infringir-dano');
    });

    it('detecta signos de puntuación mal empleados o inconclusos', () => {
        const hallazgos = analizarParrafoObservador('Sin embargo no asistió a la audiencia , por qué no compareció?', 0);
        const reglas = hallazgos.map((h) => h.reglaId);
        expect(reglas).toContain('punt-coma-conector');
        expect(reglas).toContain('punt-espacio-antes');
        expect(reglas).toContain('punt-falta-apertura-interrogacion');
    });

    it('detecta cacofonía y concordancia gramatical («y igual», «la acta», «los demandado»)', () => {
        const hallazgos = analizarParrafoObservador('Se suscribió la acta con los demandado de forma justa y igual.', 0);
        const reglas = hallazgos.map((h) => h.reglaId);
        expect(reglas).toContain('gram-la-acta');
        expect(reglas).toContain('gram-discordancia-plural-sing');
        expect(reglas).toContain('gram-cacofonia-y-i');
    });

    it('calcula métricas de calidad y claridad del documento', () => {
        const texto = 'Por tanto, solicito a Su Autoridad admitir la presente demanda en todas sus partes.';
        const h = analizarParrafoObservador(texto, 0);
        const m = calcularMetricasDocumento([texto], h);
        expect(m.palabras).toBeGreaterThan(10);
        expect(m.puntajeCalidad).toBeGreaterThanOrEqual(90);
    });
});

describe('Tesauro forense inteligente con adaptación morfológica', () => {
    it('conjuga automáticamente los sinónimos verbales según la forma original', () => {
        const sinPidio = buscarSinonimos('pidió');
        expect(sinPidio).not.toBeNull();
        const todosPidio = sinPidio!.grupos.flatMap((g) => g.opciones.map((o) => o.reemplazo));
        expect(todosPidio).toContain('solicitó');
        expect(todosPidio).toContain('impetró');

        const sinDiciendo = buscarSinonimos('diciendo');
        expect(sinDiciendo).not.toBeNull();
        const todosDiciendo = sinDiciendo!.grupos.flatMap((g) => g.opciones.map((o) => o.reemplazo));
        expect(todosDiciendo).toContain('manifestando');
    });

    it('preserva mayúsculas iniciales y sostenidas al reemplazar sinónimos', () => {
        expect(adaptarReemplazo('Pidió', 'solicitar', 'verbo')).toBe('Solicitó');
        expect(adaptarReemplazo('PAGAR', 'abonar', 'verbo')).toBe('ABONAR');
    });
});
