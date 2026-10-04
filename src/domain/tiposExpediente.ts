import { normalizarRol } from './texto';

export type GrupoTipo = 'Procesos judiciales' | 'Contratos y documentos' | 'Trámites y asesoría';
export const GRUPOS_TIPO: GrupoTipo[] = ['Procesos judiciales', 'Contratos y documentos', 'Trámites y asesoría'];

export interface CampoSugerido { clave: string; etiqueta: string }

export interface TipoExpediente {
    clave: string;
    etiqueta: string;
    grupo: GrupoTipo;
    /** Muestra juzgado y N° de causa. */
    judicial: boolean;
    roles: string[];
    campos: CampoSugerido[];
}

const PROCESO: CampoSugerido[] = [
    { clave: 'cuantia', etiqueta: 'Cuantía (Bs.)' },
    { clave: 'hechos', etiqueta: 'Hechos' },
    { clave: 'petitorio', etiqueta: 'Petitorio' },
];
const ACTO: CampoSugerido[] = [
    { clave: 'lugar_firma', etiqueta: 'Lugar de firma' },
    { clave: 'objeto', etiqueta: 'Objeto' },
    { clave: 'precio', etiqueta: 'Precio / monto (Bs.)' },
    { clave: 'plazo', etiqueta: 'Plazo' },
    { clave: 'forma_pago', etiqueta: 'Forma de pago' },
];

export const TIPOS_EXPEDIENTE: readonly TipoExpediente[] = [
    { clave: 'civil', etiqueta: 'Proceso civil', grupo: 'Procesos judiciales', judicial: true, roles: ['demandante', 'demandado', 'tercero'], campos: PROCESO },
    {
        clave: 'penal', etiqueta: 'Proceso penal', grupo: 'Procesos judiciales', judicial: true,
        roles: ['denunciante', 'querellante', 'imputado', 'acusado', 'victima', 'tercero'],
        campos: [
            { clave: 'delito', etiqueta: 'Delito(s)' }, { clave: 'fecha_hecho', etiqueta: 'Fecha del hecho' },
            { clave: 'hechos', etiqueta: 'Hechos' }, { clave: 'petitorio', etiqueta: 'Petitorio' },
        ],
    },
    { clave: 'familiar', etiqueta: 'Proceso familiar', grupo: 'Procesos judiciales', judicial: true, roles: ['demandante', 'demandado', 'tercero'], campos: PROCESO },
    { clave: 'laboral', etiqueta: 'Proceso laboral', grupo: 'Procesos judiciales', judicial: true, roles: ['demandante', 'demandado', 'tercero'], campos: PROCESO },
    { clave: 'administrativo', etiqueta: 'Proceso administrativo', grupo: 'Procesos judiciales', judicial: true, roles: ['demandante', 'demandado', 'tercero'], campos: PROCESO },
    {
        clave: 'contrato', etiqueta: 'Contrato / minuta', grupo: 'Contratos y documentos', judicial: false,
        roles: ['vendedor', 'comprador', 'arrendador', 'arrendatario', 'mutuante', 'mutuario', 'donante', 'donatario', 'cedente', 'cesionario', 'fiador', 'contratante', 'contratista'],
        campos: ACTO,
    },
    { clave: 'documento_privado', etiqueta: 'Documento privado', grupo: 'Contratos y documentos', judicial: false, roles: ['otorgante', 'contratante', 'testigo'], campos: ACTO },
    {
        clave: 'poder', etiqueta: 'Poder / mandato', grupo: 'Contratos y documentos', judicial: false, roles: ['poderdante', 'apoderado'],
        campos: [{ clave: 'lugar_firma', etiqueta: 'Lugar de firma' }, { clave: 'facultades', etiqueta: 'Facultades conferidas' }, { clave: 'vigencia', etiqueta: 'Vigencia' }],
    },
    {
        clave: 'tramite', etiqueta: 'Trámite administrativo', grupo: 'Trámites y asesoría', judicial: false, roles: ['solicitante', 'tercero'],
        campos: [{ clave: 'entidad', etiqueta: 'Entidad / oficina' }, { clave: 'objeto', etiqueta: 'Objeto' }, { clave: 'fecha_limite', etiqueta: 'Fecha límite' }],
    },
    {
        clave: 'asesoria', etiqueta: 'Asesoría / consulta', grupo: 'Trámites y asesoría', judicial: false, roles: ['solicitante', 'interesado'],
        campos: [{ clave: 'consulta', etiqueta: 'Consulta' }, { clave: 'conclusion', etiqueta: 'Conclusión' }],
    },
    { clave: 'otro', etiqueta: 'Otro', grupo: 'Trámites y asesoría', judicial: false, roles: ['interesado', 'tercero', 'testigo'], campos: [] },
];

export const TIPO_POR_DEFECTO = 'civil';

export function obtenerTipo(clave: string): TipoExpediente {
    return TIPOS_EXPEDIENTE.find((t) => t.clave === clave) ?? TIPOS_EXPEDIENTE[TIPOS_EXPEDIENTE.length - 1];
}

const EXTRA = ['demandante', 'demandado', 'tercero', 'acusado', 'denunciante', 'empleador', 'trabajador', 'socio'];

/** Todos los roles que el contexto y el catálogo reconocen (singular). */
export const ROLES_CONOCIDOS: readonly string[] = [
    ...new Set([...EXTRA, ...TIPOS_EXPEDIENTE.flatMap((t) => t.roles)].map(normalizarRol)),
];