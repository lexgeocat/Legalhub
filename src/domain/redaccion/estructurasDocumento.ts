// src/domain/redaccion/estructurasDocumento.ts

export interface RequisitoSeccion {
  titulo: string;
  obligatorio: boolean;
  descripcion: string;
  pistas: string[];
}

export interface EstructuraDocumento {
  id: string;
  tipo: string;
  materia: string;
  descripcion: string;
  requisitos: RequisitoSeccion[];
}

export const ESTRUCTURAS_DOCUMENTO: EstructuraDocumento[] = [
  {
    id: 'demanda-ordinaria',
    tipo: 'Demanda Ordinaria / Escrito Inicial',
    materia: 'Civil / Comercial / Familiar / Laboral',
    descripcion: 'Estructura procesal de demanda conforme a los códigos procesales vigentes.',
    requisitos: [
      {
        titulo: 'Suma o Síntesis de la Acción',
        obligatorio: true,
        descripcion: 'Encabezado con el tipo de acción y la pretensión concreta.',
        pistas: ['SEÑOR JUEZ', 'SUMA:', 'INTERPONE DEMANDA ORDINARIA'],
      },
      {
        titulo: 'Identificación y Legitimación de las Partes',
        obligatorio: true,
        descripcion: 'Nombres completos, cédula, estado civil, profesión y domicilio real y procesal.',
        pistas: ['mayor de edad', 'con C.I.', 'domicilio real en', 'en contra de'],
      },
      {
        titulo: 'Relación Fáctica y Cronológica de los Hechos',
        obligatorio: true,
        descripcion: 'Relato claro, preciso y numerado de los hechos que sustentan la pretensión.',
        pistas: ['I. ANTECEDENTES DE HECHO', 'ANTECEDENTES FÁCTICOS', 'Es el caso que en fecha'],
      },
      {
        titulo: 'Fundamentación Jurídica y Doctrinal',
        obligatorio: true,
        descripcion: 'Cita de las normas sustantivas, adjetivas y jurisprudencia que amparan el derecho.',
        pistas: ['II. FUNDAMENTOS DE DERECHO', 'DERECHO APLICABLE', 'Al amparo de lo dispuesto'],
      },
      {
        titulo: 'Ofrecimiento y Señalamiento de la Prueba',
        obligatorio: true,
        descripcion: 'Inventario de prueba documental, testifical, pericial o de inspección judicial.',
        pistas: ['III. MEDIOS DE PRUEBA', 'OFRECE PRUEBA', 'PRUEBA PRECONSTITUIDA'],
      },
      {
        titulo: 'Petitorio Claro, Líquido y Exigible',
        obligatorio: true,
        descripcion: 'Pronunciamiento judicial concreto que se demanda en la sentencia.',
        pistas: ['PETITORIO', 'POR TANTO', 'pido se sirva declarar probada'],
      },
      {
        titulo: 'Otrosíes (Peticiones Accesorias)',
        obligatorio: false,
        descripcion: 'Domicilio procesal electrónico, medidas cautelares, desglose y honorarios profesionales.',
        pistas: ['Otrosí 1ro', 'Otrosí 2do', 'OTROSÍ.-'],
      },
    ],
  },
  {
    id: 'contestacion-excepciones',
    tipo: 'Contestación y Excepciones Previas',
    materia: 'Procesal General',
    descripcion: 'Estructura de respuesta a la demanda con planteamiento de defensas y excepciones.',
    requisitos: [
      {
        titulo: 'Encabezamiento y Apersonamiento',
        obligatorio: true,
        descripcion: 'Invocación del juzgado y citación con la demanda.',
        pistas: ['SEÑOR JUEZ', 'CONTESTA DEMANDA', 'OPONE EXCEPCIONES PREVIAS'],
      },
      {
        titulo: 'Pronunciamiento Expreso sobre los Hechos (Negación Categórica)',
        obligatorio: true,
        descripcion: 'Aceptación o rechazo categórico de cada uno de los hechos de la demanda.',
        pistas: ['NEGAR CATEGÓRICAMENTE', 'EN CUANTO A LOS HECHOS', 'desvirtúa los extremos'],
      },
      {
        titulo: 'Planteamiento de Excepciones Previas',
        obligatorio: false,
        descripcion: 'Incompetencia, impersonería, litispendencia, falta de legitimación o prescripción.',
        pistas: ['EXCEPCIÓN PREVIA DE', 'falta de legitimación', 'prescripción extintiva'],
      },
      {
        titulo: 'Fundamentos de Derecho de la Oposición',
        obligatorio: true,
        descripcion: 'Marco legal que desvirtúa la pretensión actora.',
        pistas: ['FUNDAMENTOS DE DERECHO', 'carece de asidero', 'en estricto derecho'],
      },
      {
        titulo: 'Ofrecimiento de Prueba de Descargo',
        obligatorio: true,
        descripcion: 'Acreditación de las excepciones y de la contestación.',
        pistas: ['PRUEBA DE DESCARGO', 'ofrezco como prueba'],
      },
      {
        titulo: 'Petitorio de Desestimación',
        obligatorio: true,
        descripcion: 'Solicitud expresa de declarar improbada la demanda con condenación en costas.',
        pistas: ['declarar improbada la demanda', 'con costas y costos'],
      },
    ],
  },
  {
    id: 'recurso-apelacion',
    tipo: 'Recurso de Apelación con Expresión de Agravios',
    materia: 'Recursiva / Segunda Instancia',
    descripcion: 'Estructura de impugnación ordinaria contra autos definitivos o sentencias.',
    requisitos: [
      {
        titulo: 'Resolución Impugnada y Plazo Oportuno',
        obligatorio: true,
        descripcion: 'Identificación de la sentencia/auto y cómputo del plazo de notificación.',
        pistas: ['INTERPONE RECURSO DE APELACIÓN', 'contra la Sentencia N°', 'en tiempo y forma oportunos'],
      },
      {
        titulo: 'Relación Circunstanciada de los Agravios',
        obligatorio: true,
        descripcion: 'Identificación punto por punto del error de hecho o de derecho del juzgador a quo.',
        pistas: ['PRIMER AGRAVIO', 'SEGUNDO AGRAVIO', 'EXPRESIÓN DE AGRAVIOS'],
      },
      {
        titulo: 'Normas y Precedentes Violados o Erróneamente Aplicados',
        obligatorio: true,
        descripcion: 'Demostración de la falta de fundamentación, error in judicando o error in procedendo.',
        pistas: ['error in judicando', 'falta de motivación', 'vulneración del debido proceso'],
      },
      {
        titulo: 'Perjuicio Concreto Ocasionado',
        obligatorio: true,
        descripcion: 'Acreditación del gravamen irreparable o perjuicio patrimonial/procesal.',
        pistas: ['gravamen irreparable', 'lesión directa', 'perjuicio sufrido'],
      },
      {
        titulo: 'Petitorio al Tribunal de Alzada',
        obligatorio: true,
        descripcion: 'Solicitud de revocatoria total/parcial o anulación de obrados.',
        pistas: ['revocar totalmente la resolución', 'anular obrados hasta'],
      },
    ],
  },
];
