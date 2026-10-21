import { MARGENES_MEMORIAL, type CampoPropio, type Margenes } from './fuenteModelo';

export interface PlantillaInicial {
    nombre: string;
    categoria: string;
    materia: string;
    descripcion: string;
    texto: string;
    campos: CampoPropio[];
    margenes?: Margenes;
}
const COMPRAVENTA = [
    '# MINUTA DE COMPRAVENTA DE INMUEBLE',
    '',
    '**SEÑOR NOTARIO DE FE PÚBLICA:**',
    '',
    'En el registro de escrituras públicas a su cargo, sírvase insertar la presente minuta de compraventa de bien inmueble, al tenor de las siguientes cláusulas:',
    '',
    '**PRIMERA.- (DE LAS PARTES).-** Intervienen en este contrato:',
    '{{#vendedores}}',
    '{{nombre | mayus}}, con C.I. N° {{ci}}, {{nacionalidad}}, {{estado_civil}}, con domicilio en {{domicilio}}, en calidad de VENDEDOR;',
    '{{/vendedores}}',
    '{{#compradores}}',
    '{{nombre | mayus}}, con C.I. N° {{ci}}, {{nacionalidad}}, {{estado_civil}}, con domicilio en {{domicilio}}, en calidad de COMPRADOR;',
    '{{/compradores}}',
    '',
    '**SEGUNDA.- (ANTECEDENTES).-** {{vendedores | lista}} es propietario del inmueble ubicado en {{caso.ubicacion}}, con matrícula N° {{caso.matricula}} y una superficie de {{caso.superficie | superficie}}.',
    '**TERCERA.- (OBJETO Y PRECIO).-** Por el presente contrato se transfiere, a título de compraventa, el inmueble descrito en la cláusula anterior en favor de {{compradores | lista}}, por el precio total y definitivo de {{caso.precio | moneda}}, que se paga {{caso.forma_pago}}.',
    '',
    '**CUARTA.- (CONFORMIDAD).-** Las partes declaran su plena conformidad con el contenido de las cláusulas precedentes y firman en señal de ello.',
    '',
    '{{caso.lugar_firma}}, {{hoy | fecha}}.',
    '',
    '{{#vendedores}}',
    '[c] ______________________________',
    '[c] {{nombre | mayus}}',
    '[c] C.I. {{ci}}',
    '{{/vendedores}}',
    '{{#compradores}}',
    '[c] ______________________________',
    '[c] {{nombre | mayus}}',
    '[c] C.I. {{ci}}',
    '{{/compradores}}',
].join('\n');

const MEMORIAL = [
    '[d] **Ref.:** {{expediente.referencia?}}',
    '[d] **Proceso:** {{expediente.materia}}',
    '[d] **N° de causa:** {{expediente.nro_causa?}}',
    '',
    '**SEÑOR JUEZ:** {{expediente.juzgado | mayus}}',
    '',
    '{{#demandantes}}',
    '{{nombre | mayus}}, con C.I. N° {{ci}}, {{estado_civil}}, {{nacionalidad}}, con domicilio en {{domicilio}};',
    '{{/demandantes}}',
    '{{demandantes | concordar:"mayor de edad":"mayor de edad":"mayores de edad":"mayores de edad"}}, ante su autoridad respetuosamente exponemos y pedimos:',
    '',
    '**I.- (HECHOS).-** {{caso.hechos}}',
    '',
    '**II.- (PETITORIO).-** {{caso.petitorio}}',
    '',
    '**OTROSÍ.-** Señalamos domicilio procesal en {{abogado.domicilio_procesal}}.',
    '',
    '{{hoy | fecha}}',
].join('\n');

export const PLANTILLAS_INICIALES: PlantillaInicial[] = [
    {
        nombre: 'Minuta de compraventa de inmueble', categoria: 'Contrato (Minuta)', materia: 'civil',
        descripcion: 'Borrador de ejemplo. Requiere roles vendedor/comprador y los datos del inmueble, precio, forma de pago y lugar.',
        texto: COMPRAVENTA,
        campos: [
            { clave: 'ubicacion', etiqueta: 'Ubicación del inmueble', tipo: 'texto', requerido: true },
            { clave: 'matricula', etiqueta: 'Matrícula (Derechos Reales)', tipo: 'texto', requerido: true },
            { clave: 'superficie', etiqueta: 'Superficie (m²)', tipo: 'superficie', requerido: true },
            { clave: 'precio', etiqueta: 'Precio (Bs.)', tipo: 'moneda', requerido: true },
            { clave: 'forma_pago', etiqueta: 'Forma de pago', tipo: 'texto', requerido: true },
            { clave: 'lugar_firma', etiqueta: 'Lugar de firma', tipo: 'texto', requerido: true },
        ],
    },
    {
        nombre: 'Memorial (esqueleto)', categoria: 'Escrito judicial', materia: 'civil',
        descripcion: 'Estructura básica de un escrito con partes, hechos y petitorio. Revísalo antes de usarlo.',
        texto: MEMORIAL,
        margenes: MARGENES_MEMORIAL,
        campos: [
            { clave: 'hechos', etiqueta: 'Hechos', tipo: 'texto_largo', requerido: true },
            { clave: 'petitorio', etiqueta: 'Petitorio', tipo: 'texto_largo', requerido: true },
        ],
    },
];