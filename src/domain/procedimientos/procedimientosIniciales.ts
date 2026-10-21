import type { DatosProcedimiento, Paso, Requisito, TipoPaso } from './procedimientos';

const req = (id: string, grupo: string, nombre: string, extra: Partial<Requisito> = {}): Requisito => ({
    id, grupo, nombre, detalle: '', quien: '', formato: '', donde: '', obligatorio: true, ...extra,
});

const paso = (
    id: string, tipo: TipoPaso, titulo: string, responsable: string,
    siguientes: [string, string?][] = [], extra: Partial<Paso> = {},
): Paso => ({
    id, tipo, titulo, responsable, detalle: '', plazo: '', baseLegal: '', requisitos: [],
    ...extra,
    siguientes: siguientes.map(([a, etiqueta]) => ({ a, etiqueta: etiqueta ?? '' })),
});

const REQUISITOS: Requisito[] = [
    req('r-nac', 'Del beneficiario', 'Certificado de nacimiento del beneficiario', {
        quien: 'Demandante', formato: 'original', donde: 'Oficialía de Registro Cívico (SERECI)',
        detalle: 'Confirma si el juzgado pide original o fotocopia legalizada.',
    }),
    req('r-ci-ben', 'Del beneficiario', 'Fotocopia de C.I. del beneficiario', {
        quien: 'Demandante', formato: 'fotocopia', obligatorio: false, detalle: 'Si es mayor de edad o ya cuenta con cédula.',
    }),
    req('r-estudios', 'Del beneficiario', 'Certificado de estudios o boleta de matrícula', {
        quien: 'Demandante', donde: 'Unidad educativa', obligatorio: false,
    }),
    req('r-ci-dte', 'De las partes', 'Fotocopia de C.I. del demandante', { quien: 'Demandante', formato: 'fotocopia' }),
    req('r-ci-ddo', 'De las partes', 'Fotocopia de C.I. del demandado', {
        quien: 'Demandante', formato: 'fotocopia', detalle: 'Si no se tiene, anota los datos de identificación que se conozcan.',
    }),
    req('r-domicilio', 'De las partes', 'Domicilio del demandado y croquis de ubicación', {
        quien: 'Demandante', detalle: 'Es necesario para citarlo.',
    }),
    req('r-poder', 'De las partes', 'Poder a favor del abogado', {
        quien: 'Demandante', donde: 'Notaría', obligatorio: false, detalle: 'Según cómo se patrocine el caso.',
    }),
    req('r-alquiler', 'Capacidad económica y gastos', 'Contrato de alquiler de la vivienda del beneficiario', {
        quien: 'Demandante', obligatorio: false, detalle: 'Acredita el gasto de vivienda.',
    }),
    req('r-ingresos', 'Capacidad económica y gastos', 'Prueba de ingresos del demandado', {
        quien: 'Demandante', obligatorio: false, detalle: 'Boletas de pago, contrato de trabajo, certificado de ingresos, NIT…',
    }),
    req('r-gastos', 'Capacidad económica y gastos', 'Comprobantes de gastos del beneficiario', {
        quien: 'Demandante', obligatorio: false, detalle: 'Alimentación, salud, vestimenta, transporte, servicios básicos.',
    }),
    req('r-demanda', 'Documentos del proceso', 'Demanda escrita (memorial)', {
        quien: 'Abogado', detalle: 'Se redacta en Legal-Hub desde un modelo.',
    }),
    req('r-copias', 'Documentos del proceso', 'Copias de traslado para el demandado', { quien: 'Abogado', formato: 'fotocopia' }),
];

const PASOS: Paso[] = [
    paso('p-inicio', 'inicio', 'El cliente solicita asesoría', 'Cliente', [['p-entrevista']]),
    paso('p-entrevista', 'accion', 'Entrevista y análisis del caso', 'Abogado', [['p-reunir']], {
        detalle: 'Se recogen los hechos y se explican el proceso y los requisitos.',
    }),
    paso('p-reunir', 'accion', 'Reunir requisitos y prueba', 'Cliente', [['p-completa']], {
        requisitos: ['r-nac', 'r-ci-ben', 'r-estudios', 'r-ci-dte', 'r-ci-ddo', 'r-domicilio', 'r-poder', 'r-alquiler', 'r-ingresos', 'r-gastos'],
    }),
    paso('p-completa', 'decision', '¿Documentación completa?', 'Abogado', [['p-redactar', 'Sí'], ['p-reunir', 'Faltan documentos']]),
    paso('p-redactar', 'documento', 'Redactar la demanda de asistencia familiar', 'Abogado', [['p-presentar']], {
        requisitos: ['r-demanda', 'r-copias'],
    }),
    paso('p-presentar', 'accion', 'Presentar la demanda en el juzgado', 'Abogado', [['p-admite']]),
    paso('p-admite', 'decision', '¿El juzgado admite la demanda?', 'Juzgado', [['p-admision', 'Sí'], ['p-subsanar', 'Observada']]),
    paso('p-subsanar', 'documento', 'Subsanar las observaciones', 'Abogado', [['p-admite']]),
    paso('p-admision', 'accion', 'Admisión y citación al demandado', 'Juzgado', [['p-contesta']]),
    paso('p-contesta', 'accion', 'Respuesta del demandado', 'Demandado', [['p-audiencia']]),
    paso('p-audiencia', 'accion', 'Audiencia', 'Juzgado', [['p-acuerdo']], {
        detalle: 'Se intenta la conciliación entre las partes.',
    }),
    paso('p-acuerdo', 'decision', '¿Hay acuerdo?', 'Juzgado', [['p-homologa', 'Sí'], ['p-prueba', 'No']]),
    paso('p-homologa', 'accion', 'Homologación del acuerdo', 'Juzgado', [['p-fin']]),
    paso('p-prueba', 'accion', 'Producción de prueba y alegatos', 'Juzgado', [['p-sentencia']]),
    paso('p-sentencia', 'accion', 'Sentencia', 'Juzgado', [['p-apela']]),
    paso('p-apela', 'decision', '¿Se apela?', 'Abogado', [['p-recurso', 'Sí'], ['p-ejecucion', 'No']]),
    paso('p-recurso', 'documento', 'Recurso de apelación', 'Abogado', [['p-ejecucion']]),
    paso('p-ejecucion', 'accion', 'Ejecución y cobro de la asistencia', 'Juzgado', [['p-fin']]),
    paso('p-fin', 'fin', 'Asistencia familiar fijada', 'Juzgado'),
];

export const PROCEDIMIENTOS_INICIALES: DatosProcedimiento[] = [
    {
        nombre: 'Fijación de asistencia familiar',
        materia: 'familiar',
        descripcion: 'Borrador de ejemplo: requisitos y flujo general. Ajústalo a la práctica de tu juzgado antes de usarlo.',
        baseLegal: 'Código de las Familias y del Proceso Familiar (Ley N° 603). Verifica la norma vigente y los plazos.',
        requisitos: REQUISITOS,
        flujo: { carriles: ['Cliente', 'Abogado', 'Juzgado', 'Demandado'], pasos: PASOS },
    },
];