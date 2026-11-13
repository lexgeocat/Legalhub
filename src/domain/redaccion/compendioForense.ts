// src/domain/redaccion/compendioForense.ts

export interface ItemComparativo {
  funcion: string;
  general: string[];
  juridicoAvanzado: string[];
}

export interface CategoriaConectores {
  id: string;
  numero: number;
  nombre: string;
  descripcion: string;
  general: string[];
  juridicoAvanzado: string[];
}

export interface EngarceEspecial {
  id: string;
  titulo: string;
  descripcion: string;
  formulas: { etiqueta?: string; texto: string }[];
}

export interface SeccionCierre {
  nivel: string;
  general: string[];
  juridicoAvanzado: { contexto?: string; formulas: string[] }[];
}

export interface ItemProtocolar {
  id: string;
  ambito: string;
  descripcion: string;
  grupos: {
    titulo: string;
    formulas: string[];
  }[];
}

export const INTRODUCTORES_APERTURA: ItemComparativo[] = [
  {
    funcion: 'Apertura global del texto',
    general: [
      'El propósito de este documento es...',
      'A través del presente análisis se aborda...',
      'Como punto de partida, cabe señalar que...',
      'En primera instancia, resulta pertinente examinar...',
    ],
    juridicoAvanzado: [
      'En mérito a los antecedentes que se pasan a exponer...',
      'Haciendo uso de la facultad conferida por el art. [...]',
      'Comparezco ante su autoridad a objeto de...',
      'En tiempo y forma oportunos, interpongo / formulo...',
      'Preliminarmente, corresponde delimitar el thema decidendum...',
    ],
  },
  {
    funcion: 'Presentación de antecedentes (Hechos)',
    general: [
      'En cuanto al contexto previo...',
      'Los hechos se desarrollaron de la siguiente manera:',
      'Para comprender la situación actual, es necesario remontarse a...',
      'Todo comenzó cuando...',
    ],
    juridicoAvanzado: [
      'De la compulsa de obrados se desprende que...',
      'Conforme consta en los antecedentes procesales...',
      'Es el caso, Señor Juez, que en fecha...',
      'Atendiendo a la relación fáctica de los hechos...',
      'De acuerdo con el cuaderno procesal / expediente...',
    ],
  },
  {
    funcion: 'Introducción de un nuevo eje temático',
    general: [
      'Respecto a... / En lo referente a...',
      'Pasando al análisis de...',
      'En lo que concierne a...',
      'Otro aspecto fundamental radica en...',
    ],
    juridicoAvanzado: [
      'En lo atinente a... / En lo tocante a...',
      'Respecto al agravio consistente en...',
      'Abordando el presupuesto procesal relativo a...',
      'En cuanto a la legitimación activa/pasiva...',
      'Ingresando al análisis de fondo de la controversia...',
    ],
  },
  {
    funcion: 'Invocación de leyes o normas',
    general: [
      'Según lo establecido por la normativa...',
      'De acuerdo con las reglas vigentes...',
      'Tal como indica la ley sobre este tema...',
    ],
    juridicoAvanzado: [
      'Al amparo de lo preceptuado por el artículo...',
      'En estricta observancia del mandato constitucional...',
      'Conforme al tenor literal del precepto legal contenido en...',
      'A la luz de las disposiciones vigentes en materia de...',
      'En sujeción al principio de legalidad consagrado en...',
    ],
  },
];

export const CONECTORES_ARGUMENTATIVOS: CategoriaConectores[] = [
  {
    id: 'causa-motivo',
    numero: 1,
    nombre: 'Causa, Motivo y Fundamentación',
    descripcion: 'Explicar el porqué fáctico o jurídico de una postura.',
    general: [
      'Porque',
      'ya que',
      'dado que',
      'puesto que',
      'a causa de',
      'debido a que',
      'en vista de que',
      'gracias a que',
      'considerando que',
    ],
    juridicoAvanzado: [
      'Habida cuenta de que',
      'toda vez que',
      'en atención a que',
      'en mérito a que',
      'por cuanto',
      'en virtud de que',
      'atendiendo a la razón de que',
      'derivado del hecho de que',
      'teniendo como presupuesto fáctico que',
    ],
  },
  {
    id: 'consecuencia-deduccion',
    numero: 2,
    nombre: 'Consecuencia, Efecto y Deducción Silogística',
    descripcion: 'Extraer el resultado inexorable de las premisas demostradas.',
    general: [
      'Por lo tanto',
      'en consecuencia',
      'por consiguiente',
      'así pues',
      'de modo que',
      'por ende',
      'como resultado',
      'de ahí que',
    ],
    juridicoAvanzado: [
      'De lo que se colige que',
      'de donde se infiere inequívocamente que',
      'razón por la cual deviene en...',
      'lo que acarrea como efecto jurídico...',
      'aparejando consigo la nulidad/improcedencia...',
      'deviniendo en consecuencia aplicable...',
      'forzoso es concluir que',
    ],
  },
  {
    id: 'oposicion-contraste',
    numero: 3,
    nombre: 'Oposición, Contraste y Refutación',
    descripcion: 'Contraargumentar, desvirtuar o impugnar los alegatos contrarios.',
    general: [
      'Sin embargo',
      'no obstante',
      'pero',
      'por el contrario',
      'en cambio',
      'a pesar de ello',
      'aunque',
      'aun cuando',
      'mientras que',
    ],
    juridicoAvanzado: [
      'Empero',
      'a contrario sensu (en sentido contrario)',
      'lejos de lo aseverado por la adversa',
      'contrariamente a lo argüido por la contraparte',
      'careciendo de asidero fáctico y legal lo manifestado respecto a...',
      'sin que obste para ello el hecho de que...',
      'en franca contradicción con las constancias procesales',
    ],
  },
  {
    id: 'concesion-hipotesis',
    numero: 4,
    nombre: 'Concesión e Hipótesis Negada',
    descripcion: 'Aceptar temporalmente una premisa ajena solo para demostrar su inviabilidad.',
    general: [
      'Si bien es cierto que...',
      'aunque se aceptara que...',
      'aun admitiendo que...',
      'independientemente de que...',
    ],
    juridicoAvanzado: [
      'En el supuesto jamás consentido (o en el supuesto negado) de que...',
      'aun en la hipótesis de admitir prima facie que...',
      'sin que ello implique reconocimiento alguno de...',
      'aun concediendo a efectos meramente dialécticos que...',
      'maguer que (arcaísmo forense en doctrina clásica)',
    ],
  },
  {
    id: 'adicion-acumulacion',
    numero: 5,
    nombre: 'Adición y Acumulación Argumentativa',
    descripcion: 'Sumar pruebas, antecedentes o fundamentos concurrentes.',
    general: [
      'Además',
      'asimismo',
      'también',
      'igualmente',
      'del mismo modo',
      'por otra parte',
      'sumado a esto',
      'en la misma línea',
    ],
    juridicoAvanzado: [
      'A mayor abundamiento',
      'adicionalmente a lo ya esgrimido',
      'en concordancia con lo anterior',
      'de igual guisa',
      'en idéntico sentido',
      'aunado a las probanzas ya merituadas',
      'coadyuvando a esta postura',
      'bajo esa misma tesitura',
    ],
  },
  {
    id: 'enfasis-certeza',
    numero: 6,
    nombre: 'Énfasis, Certeza y Fuerza Retórica',
    descripcion: 'Destacar puntos neurálgicos, agravios o vulneraciones manifiestas.',
    general: [
      'Sobre todo',
      'especialmente',
      'cabe destacar',
      'es importante subrayar',
      'sin duda alguna',
      'ciertamente',
      'lo más relevante es que',
    ],
    juridicoAvanzado: [
      'Resulta palmario e inconcuso que...',
      'es menester hacer hincapié en que...',
      'salta a la vista la evidente vulneración de...',
      'resulta de meridiana claridad que...',
      'es un hecho notorio y exento de prueba que...',
      'cobra vital relevancia jurídica el hecho de que...',
    ],
  },
  {
    id: 'aclaracion-precision',
    numero: 7,
    nombre: 'Aclaración, Precisión Técnica y Reformulación',
    descripcion: 'Explicar el alcance dogmático exacto o delimitar institutos jurídicos.',
    general: [
      'Es decir',
      'o sea',
      'en otras palabras',
      'dicho de otro modo',
      'esto es',
      'mejor dicho',
      'para ser más precisos',
    ],
    juridicoAvanzado: [
      'Vale decir',
      'dicho en términos estrictamente técnico-jurídicos',
      'lo que se traduce en el plano procesal como...',
      'precisando el alcance normativo de...',
      'entendiendo por tal instituto jurídico...',
      'mutatis mutandis (cambiando lo que se deba cambiar)',
    ],
  },
  {
    id: 'orden-secuencia',
    numero: 8,
    nombre: 'Orden, Secuencia y Transición Estructural',
    descripcion: 'Estructurar los agravios, capítulos o presupuestos del memorial.',
    general: [
      'Primero / En primer lugar',
      'en segundo lugar',
      'a continuación',
      'posteriormente',
      'por un lado / por otro lado',
      'finalmente',
    ],
    juridicoAvanzado: [
      'Ab initio (desde el inicio)',
      'como primer punto de agravio',
      'en un segundo orden de ideas',
      'acto seguido',
      'correlativamente',
      'en lo que atañe al segundo presupuesto',
      'como corolario de este apartado',
    ],
  },
];

export const ENGARCES_TECNICA_JURIDICA: EngarceEspecial[] = [
  {
    id: 'jurisprudencia-precedentes',
    titulo: 'Para introducir Jurisprudencia y Precedentes Vinculantes',
    descripcion: 'Enlace doctrinal y jurisprudencial con citas vinculantes del TCP o TSJ.',
    formulas: [
      { texto: 'Siguiendo la línea jurisprudencial modulada por el Tribunal a través de la Sentencia...' },
      { texto: 'Conforme a la ratio decidendi (razón de la decisión) contenida en el fallo...' },
      { texto: 'Criterio que ha sido uniformemente sostenido por la jurisprudencia aplicable al establecer que:' },
      { texto: 'Invocando el precedente vinculante sentado en..., cuya subregla determina que:' },
      { texto: 'En cabal aplicación de la doctrina legal aplicable emanada del Auto Supremo...' },
    ],
  },
  {
    id: 'doctrina-autores',
    titulo: 'Para introducir Doctrina de Autores (Argumento de Autoridad)',
    descripcion: 'Cita a tratadistas, juristas clásicos y dogmática jurídica contemporánea.',
    formulas: [
      { texto: 'Como bien enseña la doctrina autorizada en la materia, representada por el tratadista [Nombre]...' },
      { texto: 'En palabras del insigne jurista [Nombre], quien al comentar esta figura sostiene que:' },
      { texto: 'Acudiendo a la dogmática jurídica contemporánea, existe consenso doctrinal en afirmar que...' },
      { texto: 'A decir de la doctrina mayoritaria, dicho instituto procesal se define como...' },
    ],
  },
  {
    id: 'subsuncion-probatoria',
    titulo: 'Para la Subsunción y Valoración Probatoria (Hechos + Prueba + Derecho)',
    descripcion: 'Articular la premisa menor fáctica con el caudal probatorio y el tipo legal.',
    formulas: [
      { texto: 'Subsumiendo los antecedentes fácticos en el tipo legal descrito, se advierte que...' },
      { texto: 'De la valoración integral de la prueba documental aparejada a fojas [...], se acredita fehacientemente que...' },
      { texto: 'Contrastando el caudal probatorio con la hipótesis normativa, queda plenamente demostrado que...' },
      { texto: 'Prueba que hace plena fe conforme a lo dispuesto por el artículo...' },
      { texto: 'Al no haber la contraparte desvirtuado la carga probatoria (onus probandi) que le incumbía...' },
    ],
  },
  {
    id: 'otrosies-accesorias',
    titulo: 'Para Transiciones Accesorias (Otrosíes / Peticiones Secundarias)',
    descripcion: 'Fórmulas procesales para peticiones secundarias, domicilio y honorarios.',
    formulas: [
      {
        etiqueta: 'Otrosí Primero (Domicilio procesal)',
        texto: 'A efectos de conocer ulteriores diligencias y notificaciones, señalo como domicilio procesal...',
      },
      {
        etiqueta: 'Otrosí Segundo (Acompaña prueba)',
        texto: 'En calidad de prueba preconstituida, adjunto al presente memorial en fojas [...] útiles...',
      },
      {
        etiqueta: 'Más Otrosí (Honorarios)',
        texto: 'En lo concerniente a los honorarios profesionales, el suscrito letrado se atiene a...',
      },
    ],
  },
];

export const MARCADORES_CONCLUSIVOS: SeccionCierre[] = [
  {
    nivel: 'Cierre parcial (Fin de un argumento o sección)',
    general: [
      'En resumen, este punto demuestra que...',
      'Así queda claro que...',
      'Todo lo anterior confirma la idea de que...',
    ],
    juridicoAvanzado: [
      {
        formulas: [
          'De todo lo cual se desprende la manifiesta improcedencia de...',
          'Quedando así desvirtuado el extremo invocado por...',
          'Con lo que queda suficientemente acreditado el primer requisito de...',
        ],
      },
    ],
  },
  {
    nivel: 'Síntesis global antes del cierre',
    general: [
      'En conclusión... / Para concluir...',
      'En síntesis... / En definitiva...',
      'Recapitulando los puntos expuestos...',
      'A modo de cierre, se puede afirmar que...',
    ],
    juridicoAvanzado: [
      {
        formulas: [
          'En mérito a todo lo ampliamente expuesto y fundamentado...',
          'Como corolario de los fundamentos de hecho y de derecho esgrimidos...',
          'A la luz de las consideraciones fácticas, probatorias y doctrinales precedentes...',
          'Por las razones jurídicas abundantemente detalladas...',
        ],
      },
    ],
  },
  {
    nivel: 'Fórmulas de Petitorio y Fallo (Cierre definitivo)',
    general: [
      'Por todo ello, se sugiere / recomienda...',
      'En vista de lo anterior, solicitamos...',
      'Quedo a la espera de una respuesta favorable.',
    ],
    juridicoAvanzado: [
      {
        contexto: 'En memoriales / demandas:',
        formulas: [
          'Por tanto, a su Autoridad pido se sirva admitir la presente [...] y, previos los trámites de rigor, declarar probada...',
        ],
      },
      {
        contexto: 'Cierre de cortesía forense:',
        formulas: [
          'Será justicia.',
          'Es cuanto pido en estricta justicia.',
          'Con costas y costos.',
        ],
      },
      {
        contexto: 'En dictámenes / informes:',
        formulas: [
          'Es cuanto informo a los fines consiguientes.',
          'Tal es el criterio legal salvo mejor parecer.',
        ],
      },
      {
        contexto: 'En resoluciones judiciales:',
        formulas: [
          'Por tanto, la autoridad suscrita, administrando justicia en primera instancia, FALLA declarando...',
        ],
      },
    ],
  },
];

export const PROTOCOLO_SOLICITUDES: ItemProtocolar[] = [
  {
    id: 'saludos-encabezamientos',
    ambito: 'Saludos y Encabezamientos Protocolares',
    descripcion: 'Fórmulas de apertura para cartas notariales, notas oficiales y memoriales ante estrados judiciales.',
    grupos: [
      {
        titulo: 'Correspondencia Institucional, Cartas y Solicitudes Notariales',
        formulas: [
          'De mi mayor consideración y estima:',
          'De mi mayor consideración:',
          'Tengo a bien dirigirme a su digna autoridad a fin de...',
          'Mediante la presente, reciba un cordial y respetuoso saludo institucional a nombre de...',
          'Es sumamente grato dirigirme a usted con el propósito de poner en su superior conocimiento...',
          'Distinguidas autoridades:',
          'Distinguido(a) Señor(a) Director(a) / Notario(a) / Representante Legal:',
          'Por medio de la presente nota formal, me dirijo a su despacho para...',
        ],
      },
      {
        titulo: 'Encabezamientos Formales en Memoriales Judiciales y Fiscalía',
        formulas: [
          'SEÑOR JUEZ PÚBLICO EN MATERIA CIVIL Y COMERCIAL DE TURNO DE LA CAPITAL.',
          'SEÑOR FISCAL DE MATERIA ASIGNADO A LA DIVISIÓN CORRUPCIÓN / ECONÓMICOS / PERSONAS.',
          'SEÑORES VOCALES DE LA SALA CONSTITUCIONAL DEL TRIBUNAL DEPARTAMENTAL DE JUSTICIA.',
          'Apersonamiento formal, con el debido respeto procesal expongo y pido:',
          'En atención a la providencia judicial de fecha [...], ante vuestra probidad con el mayor respeto expongo y solicito:',
          'Comparezco ante su digna autoridad en tiempo y forma oportunos a objeto de...',
        ],
      },
      {
        titulo: 'Fórmulas Notariales y Extrajudiciales',
        formulas: [
          'Señor Notario de Fe Pública de Primera Clase de este Distrito Judicial:',
          'Por el presente requerimiento notarial con valor probatorio pleno, tengo a bien intimar formalmente a...',
          'Señor Registrador de Derechos Reales de la Capital:',
          'Presente. De nuestra consideración:',
        ],
      },
    ],
  },
  {
    id: 'formulas-solicitud',
    ambito: 'Fórmulas de Solicitud y Requerimiento Formal',
    descripcion: 'Expresiones precisas para formular peticiones, conminatorias, desglose y medidas procesales.',
    grupos: [
      {
        titulo: 'Peticiones Procesales y Judiciales',
        formulas: [
          'Por lo expuesto, muy respetuosamente solicito a su autoridad se digne admitir...',
          'Acudo a su probidad a objeto de impetrar la tutela efectiva e inmediata de...',
          'Pido a su autoridad se sirva disponer en el día el libramiento de mandamiento de...',
          'Solicito a su autoridad la concesión de un plazo prudencial y perentorio a efectos de...',
          'Ruego a su probidad ordenar el desglose de los documentos originales aparejados a fojas [...] bajo constancia de ley.',
          'Peticiono a su autoridad se sirva fijar día y hora de audiencia pública presencial/virtual...',
          'Impetro a su autoridad pronunciamiento expreso y pronto despacho conforme al principio de celeridad procesal.',
          'Solicito se conmine a la parte contraria para que dentro del plazo improrrogable de [...] días proceda a...',
        ],
      },
      {
        titulo: 'Solicitudes Administrativas, Certificaciones e Informes',
        formulas: [
          'Solicito formalmente a su despacho la extensión de certificación circunstanciada relativa a...',
          'Al amparo del derecho fundamental de petición consagrado en el art. 24 de la CPE, solicito se me extienda fotocopia legalizada de...',
          'Requiero respetuosamente la remisión del informe técnico y antecedentes administrativos que dieron mérito a...',
          'Pongo a consideración de su autoridad la presente solicitud de convalidación / rectificación de registro...',
          'Solicito la inmediata subsanación del error material evidente cursante en el folio / resolución...',
        ],
      },
    ],
  },
  {
    id: 'agradecimientos-institucionales',
    ambito: 'Fórmulas de Agradecimiento y Reconocimiento',
    descripcion: 'Fórmulas de cortesía institucional para corresponder la atención y valorar la celeridad funcional.',
    grupos: [
      {
        titulo: 'Agradecimiento Previo a la Atención y Colaboración',
        formulas: [
          'Agradeciendo de antemano la debida atención y gentil colaboración que se sirva prestar a la presente solicitud...',
          'Seguro de contar con su valiosa cooperación y deferencia institucional, expreso mis sinceros agradecimientos...',
          'Anticipando mi sincera gratitud por la favorable acogida que merezca la presente solicitud...',
          'Agradezco por anticipado la gentileza y esmero en la consideración del presente requerimiento...',
        ],
      },
      {
        titulo: 'Reconocimiento por Celeridad y Probidad Funcional',
        formulas: [
          'Conocedor del celo funcionario y vocación de justicia de su digno despacho, expreso mi sincero reconocimiento...',
          'Reiterando mis distinguidos agradecimientos por la pronta y oportuna atención brindada a los actuados...',
          'Vaya por delante el testimonio de mi profundo agradecimiento por la celeridad y diligencia demostradas en el trámite...',
        ],
      },
    ],
  },
  {
    id: 'despedidas-cierres',
    ambito: 'Despedidas y Fórmulas de Cierre Protocolar',
    descripcion: 'Cierres de correspondencia, notas formales, memoriales y fórmulas de estado.',
    grupos: [
      {
        titulo: 'Despedidas Epistolares y de Correspondencia Oficial',
        formulas: [
          'Sin otro particular motivo, me despido de su autoridad con las consideraciones más distinguidas.',
          'Sin otro motivo a que hacer referencia, saludo a su autoridad con mi mayor consideración y estima personal.',
          'A la espera de una respuesta favorable, saludo a usted con mi más atento respeto.',
          'Con este grato motivo, reitero a su autoridad las seguridades de mi más alta y distinguida consideración.',
          'Esperando una pronta y favorable determinación, me despido con atentos saludos.',
          'Quedo a la entera disposición de su digno despacho para cuanta aclaración o información adicional estime menester.',
        ],
      },
      {
        titulo: 'Fórmulas Solemnes Forenses y Cancillerescas',
        formulas: [
          'Será justicia.',
          'Es cuanto pido en estricto derecho y justicia.',
          'Dios guarde a usted.',
          'Con costas y costos procesales de rigor.',
          'Proveer de conformidad será acto de estricta justicia.',
          'Respetuosamente / Atentamente.',
        ],
      },
    ],
  },
];

export const CONSEJO_ESTILO = {
  titulo: 'Consejo Práctico de Estilo Forense (Lenguaje Claro)',
  texto:
    'En la redacción jurídica moderna (tendencia del lenguaje claro), el secreto del nivel avanzado no está en saturar un mismo párrafo con cinco arcaísmos seguidos, sino en combinar un conector lógico preciso («Toda vez que...») con un verbo técnico exacto («...la pretensión deviene en infundada al carecer de sustento probatorio»).',
};
