import { EQUIVALENCIAS_COLOQUIALES } from './vocabularioForense';

export interface GrupoSinonimos {
    registro: 'forense' | 'formal' | 'conector' | 'antonimo';
    etiqueta: string;
    terminos: string[];
}

export interface EntradaTesauro {
    lema: string;
    categoria: 'verbo' | 'sustantivo' | 'adjetivo' | 'conector' | 'locucion';
    definicionBreve: string;
    grupos: GrupoSinonimos[];
    /** Formas flexionadas adicionales asociadas a este lema. */
    formas?: string[];
}

export interface ResultadoSinonimos {
    terminoOriginal: string;
    lema: string;
    categoria: EntradaTesauro['categoria'];
    definicionBreve: string;
    grupos: {
        registro: GrupoSinonimos['registro'];
        etiqueta: string;
        /** Cada opción incluye el lema base y la forma ya conjugada/adaptada al texto seleccionado. */
        opciones: { base: string; reemplazo: string }[];
    }[];
}

const TESAURO_BASE: EntradaTesauro[] = [
    {
        lema: 'pedir',
        categoria: 'verbo',
        definicionBreve: 'Instar o reclamar ante la autoridad judicial o administrativa una resolución o actuación.',
        formas: ['pido', 'pide', 'piden', 'pidió', 'pidieron', 'pidiendo', 'pedido', 'solicito', 'solicita', 'solicitan', 'solicitó', 'solicitando'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['impetrar', 'instar', 'peticionar', 'recabar', 'exhortar'] },
            { registro: 'formal', etiqueta: 'Formal / Procesal', terminos: ['solicitar', 'requerir', 'reclamar', 'demandar', 'pretender'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['desistir', 'renunciar', 'rehusar', 'declinar'] },
        ],
    },
    {
        lema: 'decir',
        categoria: 'verbo',
        definicionBreve: 'Exponer hechos, argumentos o declaraciones en un acto o escrito.',
        formas: ['digo', 'dice', 'dicen', 'dijo', 'dijeron', 'diciendo', 'dicho', 'expongo', 'expone', 'manifiesto', 'manifiesta'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['manifestar', 'aseverar', 'alegar', 'esgrimir', 'aducir', 'argüir'] },
            { registro: 'formal', etiqueta: 'Formal / Expositivo', terminos: ['exponer', 'expresar', 'señalar', 'referir', 'sostener', 'indicar'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['callar', 'omitir', 'silenciar', 'reservar'] },
        ],
    },
    {
        lema: 'mostrar',
        categoria: 'verbo',
        definicionBreve: 'Poner de manifiesto un hecho, documento o medio probatorio.',
        formas: ['muestro', 'muestra', 'muestran', 'mostró', 'mostraron', 'mostrando', 'mostrado', 'demuestra', 'demuestran', 'demostró'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['acreditar', 'evidenciar', 'aparejar', 'exhibir', 'patentizar'] },
            { registro: 'formal', etiqueta: 'Formal / Probatorio', terminos: ['demostrar', 'probar', 'constatar', 'corroborar', 'revelar', 'reflejar'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['ocultar', 'encubrir', 'desvirtuar', 'contradecir'] },
        ],
    },
    {
        lema: 'probar',
        categoria: 'verbo',
        definicionBreve: 'Demostrar la verdad de una proposición fáctica mediante medios legales.',
        formas: ['pruebo', 'prueba', 'prueban', 'probó', 'probaron', 'probando', 'probado', 'acredito', 'acredita', 'acreditan', 'acreditó'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['acreditar', 'justificar', 'adverar', 'compulsar'] },
            { registro: 'formal', etiqueta: 'Formal / Procesal', terminos: ['demostrar', 'corroborar', 'verificar', 'confirmar', 'constatar'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['desvirtuar', 'infirmar', 'refutar', 'redargüir'] },
        ],
    },
    {
        lema: 'rechazar',
        categoria: 'verbo',
        definicionBreve: 'Oponerse a una pretensión, prueba o resolución por improcedente o infundada.',
        formas: ['rechazo', 'rechaza', 'rechazan', 'rechazó', 'rechazaron', 'rechazando', 'rechazado', 'niego', 'niega', 'niegan', 'negó'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['desestimar', 'denegar', 'repeler', 'inadmitir', 'impugnar', 'objetar'] },
            { registro: 'formal', etiqueta: 'Formal / Procesal', terminos: ['rebatir', 'refutar', 'contradecir', 'controvertir', 'descartar'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['admitir', 'acoger', 'estimar', 'allanarse', 'consentir'] },
        ],
    },
    {
        lema: 'dar',
        categoria: 'verbo',
        definicionBreve: 'Entregar, conceder o conferir un derecho, documento o prestación.',
        formas: ['doy', 'da', 'dan', 'dio', 'dieron', 'dando', 'dado', 'entrego', 'entrega', 'otorga', 'otorgó'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['otorgar', 'conferir', 'conceder', 'dispensar', 'suministrar'] },
            { registro: 'formal', etiqueta: 'Formal / Contractual', terminos: ['entregar', 'proporcionar', 'transferir', 'facilitar', 'adjudicar'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['retener', 'revocar', 'privar', 'retirar'] },
        ],
    },
    {
        lema: 'hacer',
        categoria: 'verbo',
        definicionBreve: 'Realizar, ejecutar o celebrar un acto jurídico o material.',
        formas: ['hago', 'hace', 'hacen', 'hizo', 'hicieron', 'haciendo', 'hecho', 'realiza', 'realizó', 'efectúa', 'efectuó'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['celebrar', 'formalizar', 'perfeccionar', 'incoar', 'sustanciar', 'evacuar'] },
            { registro: 'formal', etiqueta: 'Formal / Técnico', terminos: ['efectuar', 'realizar', 'ejecutar', 'practicar', 'elaborar', 'verificar'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['omitir', 'abstenerse', 'deshacer', 'inobservar'] },
        ],
    },
    {
        lema: 'anular',
        categoria: 'verbo',
        definicionBreve: 'Dejar sin efecto jurídico un acto, contrato o resolución.',
        formas: ['anulo', 'anula', 'anulan', 'anuló', 'anularon', 'anulando', 'anulado', 'revoca', 'revocó'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['invalidar', 'revocar', 'rescindir', 'resolver', 'casar', 'abrogar', 'derogar'] },
            { registro: 'formal', etiqueta: 'Formal / Procesal', terminos: ['dejar sin efecto', 'suprimir', 'extinguir', 'cancelar'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['convalidar', 'confirmar', 'ratificar', 'subsanar'] },
        ],
    },
    {
        lema: 'incumplir',
        categoria: 'verbo',
        definicionBreve: 'Quebrantar una obligación contractual, deber legal o mandato judicial.',
        formas: ['incumplo', 'incumple', 'incumplen', 'incumplió', 'incumplieron', 'incumpliendo', 'incumplido', 'viola', 'violó', 'vulnera', 'vulneró'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['contravenir', 'infringir', 'quebrantar', 'transgredir', 'inobservar', 'conculcar'] },
            { registro: 'formal', etiqueta: 'Formal / Jurídico', terminos: ['vulnerar', 'violar', 'desatender', 'desacatar', 'desobedecer'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['cumplir', 'acatar', 'observar', 'honrar', 'satisfacer'] },
        ],
    },
    {
        lema: 'pagar',
        categoria: 'verbo',
        definicionBreve: 'Cumplir una prestación pecuniaria o extinguir una obligación dineraria.',
        formas: ['pago', 'paga', 'pagan', 'pagó', 'pagaron', 'pagando', 'pagado', 'cancela', 'canceló', 'abona', 'abonó'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['sufragar', 'erogar', 'resarcir', 'indemnizar', 'oblacionar', 'consignar'] },
            { registro: 'formal', etiqueta: 'Formal / Financiero', terminos: ['abonar', 'cancelar', 'liquidar', 'satisfacer', 'desembolsar', 'solventar'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['adeudar', 'deber', 'impagar', 'constituirse en mora'] },
        ],
    },
    {
        lema: 'firmar',
        categoria: 'verbo',
        definicionBreve: 'Estampar la firma o celebrar un instrumento público o privado.',
        formas: ['firmo', 'firma', 'firman', 'firmó', 'firmaron', 'firmando', 'firmado', 'suscribe', 'suscribió', 'suscribieron'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['suscribir', 'rubricar', 'signar', 'refrendar', 'otorgar'] },
            { registro: 'formal', etiqueta: 'Formal / Contractual', terminos: ['celebrar', 'formalizar', 'autorizar', 'ratificar'] },
        ],
    },
    {
        lema: 'obligar',
        categoria: 'verbo',
        definicionBreve: 'Imponer o asumir un vínculo jurídico o deber de cumplimiento.',
        formas: ['obligo', 'obliga', 'obligan', 'obligó', 'obligaron', 'obligando', 'obligado', 'compromete', 'comprometió'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['compeler', 'constreñir', 'conminar', 'apremiar', 'vincular'] },
            { registro: 'formal', etiqueta: 'Formal / Contractual', terminos: ['comprometer', 'sujetar', 'exigir', 'imponer'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['eximir', 'exonerar', 'dispensar', 'liberar'] },
        ],
    },
    {
        lema: 'resolver',
        categoria: 'verbo',
        definicionBreve: 'Emitir decisión fundada sobre una controversia o petición.',
        formas: ['resuelvo', 'resuelve', 'resuelven', 'resolvió', 'resolvieron', 'resolviendo', 'resuelto', 'decide', 'decidió', 'dispone', 'dispuso'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['dirimir', 'fallar', 'proveer', 'laudar', 'decretar', 'pronunciarse'] },
            { registro: 'formal', etiqueta: 'Formal / Judicial', terminos: ['decidir', 'determinar', 'disponer', 'establecer', 'dictaminar'] },
        ],
    },
    {
        lema: 'notificar',
        categoria: 'verbo',
        definicionBreve: 'Poner en conocimiento formal de una parte una actuación o resolución.',
        formas: ['notifico', 'notifica', 'notifican', 'notificó', 'notificaron', 'notificando', 'notificado', 'comunica', 'comunicó'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['emplazar', 'citar', 'intimar', 'hacer saber', 'trasladar'] },
            { registro: 'formal', etiqueta: 'Formal / Procesal', terminos: ['comunicar', 'informar', 'participar', 'poner en conocimiento'] },
        ],
    },
    {
        lema: 'contrato',
        categoria: 'sustantivo',
        definicionBreve: 'Acuerdo de voluntades que crea, modifica o extingue relaciones jurídicas.',
        formas: ['contratos', 'convenio', 'convenios', 'acuerdo', 'acuerdos', 'pacto', 'pactos'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['convención', 'negocio jurídico', 'instrumento contractual', 'estipulación'] },
            { registro: 'formal', etiqueta: 'Formal / Contractual', terminos: ['convenio', 'acuerdo', 'pacto', 'compromiso', 'concierto'] },
        ],
    },
    {
        lema: 'documento',
        categoria: 'sustantivo',
        definicionBreve: 'Escrito o soporte material que acredita un hecho o acto jurídico.',
        formas: ['documentos', 'escrito', 'escritos', 'constancia', 'constancias', 'papel', 'papeles'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['instrumento', 'documental', 'literal', 'atestado', 'actuado', 'pieza procesal'] },
            { registro: 'formal', etiqueta: 'Formal / Administrativo', terminos: ['constancia', 'certificación', 'escrito', 'título', 'comprobante', 'antecedente'] },
        ],
    },
    {
        lema: 'demanda',
        categoria: 'sustantivo',
        definicionBreve: 'Acto procesal introductorio mediante el cual se ejercita la acción.',
        formas: ['demandas', 'memorial', 'memoriales', 'petición', 'peticiones'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['libelo', 'pretensión', 'acción', 'escrito postulatorio', 'memorial'] },
            { registro: 'formal', etiqueta: 'Formal / Procesal', terminos: ['reclamación', 'petición', 'solicitud', 'requerimiento'] },
        ],
    },
    {
        lema: 'juez',
        categoria: 'sustantivo',
        definicionBreve: 'Autoridad investida de potestad jurisdiccional para conocer y resolver litigios.',
        formas: ['jueces', 'jueza', 'tribunal', 'autoridad'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['juzgador', 'autoridad jurisdiccional', 'magistrado', 'operador de justicia', 'órgano judicial'] },
            { registro: 'formal', etiqueta: 'Formal / Institucional', terminos: ['tribunal', 'autoridad judicial', 'juzgado'] },
        ],
    },
    {
        lema: 'sentencia',
        categoria: 'sustantivo',
        definicionBreve: 'Resolución judicial que pone fin al litigio decidiendo el fondo.',
        formas: ['sentencias', 'fallo', 'fallos', 'resolución', 'resoluciones'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['fallo', 'pronunciamiento', 'decisorio', 'veredicto', 'ejecutoria', 'auto definitivo'] },
            { registro: 'formal', etiqueta: 'Formal / Judicial', terminos: ['resolución', 'decisión judicial', 'determinación', 'providencia'] },
        ],
    },
    {
        lema: 'ley',
        categoria: 'sustantivo',
        definicionBreve: 'Norma jurídica de carácter general y obligatorio.',
        formas: ['leyes', 'norma', 'normas', 'regla', 'reglas'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['precepto legal', 'disposición normativa', 'ordenamiento jurídico', 'prescripción legal', 'cuerpo normativo'] },
            { registro: 'formal', etiqueta: 'Formal / Técnico', terminos: ['norma', 'normativa', 'regulación', 'estatuto', 'legislación'] },
        ],
    },
    {
        lema: 'daño',
        categoria: 'sustantivo',
        definicionBreve: 'Detrimento o menoscabo patrimonial o extrapatrimonial sufrido por una persona.',
        formas: ['daños', 'perjuicio', 'perjuicios', 'afectación', 'menoscabo'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['menoscabo', 'detrimento', 'agravio', 'lesión patrimonial', 'quebranto', 'gravamen'] },
            { registro: 'formal', etiqueta: 'Formal / Jurídico', terminos: ['perjuicio', 'afectación', 'deterioro', 'pérdida'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['beneficio', 'provecho', 'resarcimiento', 'reparación'] },
        ],
    },
    {
        lema: 'error',
        categoria: 'sustantivo',
        definicionBreve: 'Falso conocimiento de la realidad o defecto en una actuación procesal.',
        formas: ['errores', 'equivocación', 'equivocaciones', 'falla', 'fallas', 'defecto', 'defectos'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['vicio', 'yerro', 'defecto procesal', 'inobservancia', 'irregularidad', 'óbito'] },
            { registro: 'formal', etiqueta: 'Formal / Técnico', terminos: ['inexactitud', 'imprecisión', 'desacierto', 'equívoco', 'falencia'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['acierto', 'exactitud', 'regularidad', 'validez'] },
        ],
    },
    {
        lema: 'plazo',
        categoria: 'sustantivo',
        definicionBreve: 'Lapso legal o convencional fijado para la realización de un acto.',
        formas: ['plazos', 'término', 'términos', 'tiempo', 'periodo', 'período'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['término procesal', 'término perentorio', 'lapso legal', 'emplazamiento'] },
            { registro: 'formal', etiqueta: 'Formal / General', terminos: ['término', 'período', 'lapso', 'vencimiento', 'vigencia'] },
        ],
    },
    {
        lema: 'dinero',
        categoria: 'sustantivo',
        definicionBreve: 'Suma monetaria objeto de una obligación o prestación.',
        formas: ['monto', 'montos', 'suma', 'sumas', 'importe', 'importes', 'plata'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['peculio', 'numerario', 'caudal', 'cuantía', 'prestación dineraria', 'erogación'] },
            { registro: 'formal', etiqueta: 'Formal / Económico', terminos: ['importe', 'monto', 'suma', 'capital', 'fondos', 'efectivo'] },
        ],
    },
    {
        lema: 'deuda',
        categoria: 'sustantivo',
        definicionBreve: 'Obligación pendiente de pago o cumplimiento a favor de un acreedor.',
        formas: ['deudas', 'adeudo', 'adeudos', 'obligación', 'obligaciones'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['acreencia', 'crédito exigible', 'obligación insoluta', 'pasivo', 'débito'] },
            { registro: 'formal', etiqueta: 'Formal / Financiero', terminos: ['adeudo', 'obligación pendiente', 'saldo deudor', 'compromiso de pago'] },
        ],
    },
    {
        lema: 'claro',
        categoria: 'adjetivo',
        definicionBreve: 'Que no admite duda ni ambigüedad en su apreciación.',
        formas: ['clara', 'claros', 'claras', 'evidente', 'evidentes', 'obvio', 'obvia'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['fehaciente', 'indubitable', 'palmario', 'inconcuso', 'manifiesto', 'patente'] },
            { registro: 'formal', etiqueta: 'Formal / Expositivo', terminos: ['evidente', 'notorio', 'inequívoco', 'explícito', 'categórico', 'ostensible'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['ambiguo', 'equívoco', 'dudoso', 'incierto', 'controvertido'] },
        ],
    },
    {
        lema: 'falso',
        categoria: 'adjetivo',
        definicionBreve: 'Contrario a la verdad o carente de autenticidad.',
        formas: ['falsa', 'falsos', 'falsas', 'mentira'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['apócrifo', 'mendaz', 'espurio', 'falaz', 'simulado', 'fraudulento'] },
            { registro: 'formal', etiqueta: 'Formal / Crítico', terminos: ['inexacto', 'infundado', 'inverosímil', 'incierto', 'erróneo'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['auténtico', 'fidedigno', 'veraz', 'fehaciente', 'genuino'] },
        ],
    },
    {
        lema: 'importante',
        categoria: 'adjetivo',
        definicionBreve: 'De gran relevancia o entidad para la resolución del asunto.',
        formas: ['importantes', 'relevante', 'relevantes', 'grave', 'graves'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['sustancial', 'trascendental', 'dirimente', 'capital', 'imperativo', 'cardinal'] },
            { registro: 'formal', etiqueta: 'Formal / Académico', terminos: ['relevante', 'significativo', 'primordial', 'esencial', 'fundamental', 'preponderante'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['accesorio', 'intrascendente', 'nimio', 'baladí', 'secundario'] },
        ],
    },
    {
        lema: 'obligatorio',
        categoria: 'adjetivo',
        definicionBreve: 'De cumplimiento forzoso e inexcusable por mandato legal o contractual.',
        formas: ['obligatoria', 'obligatorios', 'obligatorias', 'forzoso', 'forzosa'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['imperativo', 'coercitivo', 'vinculante', 'inexcusable', 'perentorio', 'de orden público'] },
            { registro: 'formal', etiqueta: 'Formal / Normativo', terminos: ['preceptivo', 'exigible', 'forzoso', 'ineludible', 'imprescindible'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['facultativo', 'potestativo', 'discrecional', 'voluntario'] },
        ],
    },
    {
        lema: 'válido',
        categoria: 'adjetivo',
        definicionBreve: 'Que reúne los requisitos legales para producir efectos jurídicos.',
        formas: ['válida', 'válidos', 'válidas', 'eficaz', 'eficaces', 'vigente', 'vigentes'],
        grupos: [
            { registro: 'forense', etiqueta: 'Jurídico Forense', terminos: ['eficaz', 'legítimo', 'procedente', 'firme', 'subsistente', 'exigible'] },
            { registro: 'formal', etiqueta: 'Formal / Jurídico', terminos: ['vigente', 'admisible', 'idóneo', 'regular'] },
            { registro: 'antonimo', etiqueta: 'Contraste / Antónimos', terminos: ['nulo', 'ineficaz', 'inválido', 'improcedente', ' írrito'] },
        ],
    },
    {
        lema: 'pero',
        categoria: 'conector',
        definicionBreve: 'Conector adversativo para contraponer un argumento o salvedad.',
        formas: ['sin embargo', 'no obstante', 'empero', 'aunque', 'mas'],
        grupos: [
            { registro: 'conector', etiqueta: 'Conectores Adversativos Forenses', terminos: ['no obstante', 'sin embargo', 'empero', 'ahora bien', 'con todo', 'aun así'] },
            { registro: 'forense', etiqueta: 'Locuciones Restrictivas', terminos: ['sin perjuicio de ello', 'salvo mejor parecer', 'pese a lo expuesto'] },
        ],
    },
    {
        lema: 'además',
        categoria: 'conector',
        definicionBreve: 'Conector aditivo para sumar un argumento de refuerzo.',
        formas: ['asimismo', 'igualmente', 'también'],
        grupos: [
            { registro: 'forense', etiqueta: 'Conectores Forenses de Refuerzo', terminos: ['a mayor abundamiento', 'asimismo', 'en adición a lo expuesto', 'por añadidura'] },
            { registro: 'conector', etiqueta: 'Conectores Aditivos Formales', terminos: ['de igual modo', 'igualmente', 'del mismo modo', 'análogamente'] },
        ],
    },
    {
        lema: 'porque',
        categoria: 'conector',
        definicionBreve: 'Conector causal para fundamentar la razón jurídica de una proposición.',
        formas: ['ya que', 'puesto que', 'dado que', 'comoquiera que'],
        grupos: [
            { registro: 'forense', etiqueta: 'Conectores Causales Forenses', terminos: ['habida cuenta de que', 'toda vez que', 'en mérito a que', 'por cuanto', 'atento a que'] },
            { registro: 'conector', etiqueta: 'Conectores Causales Formales', terminos: ['dado que', 'puesto que', 'en virtud de que', 'en razón de que'] },
        ],
    },
    {
        lema: 'por eso',
        categoria: 'conector',
        definicionBreve: 'Conector ilativo para introducir la consecuencia lógica o jurídica.',
        formas: ['por lo tanto', 'por tanto', 'por ende', 'en consecuencia', 'por consiguiente'],
        grupos: [
            { registro: 'forense', etiqueta: 'Conectores Consecutivos Forenses', terminos: ['en mérito a lo expuesto', 'por consiguiente', 'de ahí que', 'en tal virtud'] },
            { registro: 'conector', etiqueta: 'Conectores Ilativos Formales', terminos: ['por lo tanto', 'en consecuencia', 'por ende', 'así pues'] },
        ],
    },
];

// Enriquecer también con entradas de EQUIVALENCIAS_COLOQUIALES de vocabularioForense.ts
for (const eq of EQUIVALENCIAS_COLOQUIALES) {
    if (!eq.sugerenciasFormale || eq.sugerenciasFormale.length === 0) continue;
    const variantes = eq.coloquial.split('/').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const lemaPrincipal = variantes[0];
    if (!lemaPrincipal || TESAURO_BASE.some((e) => e.lema.toLowerCase() === lemaPrincipal)) continue;
    TESAURO_BASE.push({
        lema: lemaPrincipal,
        categoria: /[aei]r$/.test(lemaPrincipal) ? 'verbo' : lemaPrincipal.includes(' ') ? 'locucion' : 'sustantivo',
        definicionBreve: eq.contexto,
        formas: variantes.slice(1),
        grupos: [
            {
                registro: 'forense',
                etiqueta: 'Jurídico Forense',
                terminos: [...eq.sugerenciasFormale],
            },
        ],
    });
}

function quitarTildes(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

type MorfologiaVerbal =
    | 'infinitivo'
    | 'gerundio'
    | 'participio_ms'
    | 'participio_fs'
    | 'participio_mp'
    | 'participio_fp'
    | 'pres_1s'
    | 'pres_3s'
    | 'pres_3p'
    | 'pret_3s'
    | 'pret_3p';

function detectarMorfologiaVerbal(palabraMinus: string): MorfologiaVerbal | null {
    if (/[aei]r$/.test(palabraMinus)) return 'infinitivo';
    if (/(?:ando|iendo|yendo)$/.test(palabraMinus)) return 'gerundio';
    if (/(?:ados|idos|tos|chos)$/.test(palabraMinus)) return 'participio_mp';
    if (/(?:adas|idas|tas|chas)$/.test(palabraMinus)) return 'participio_fp';
    if (/(?:ada|ida|ta|cha)$/.test(palabraMinus)) return 'participio_fs';
    if (/(?:ado|ido|to|cho)$/.test(palabraMinus)) return 'participio_ms';
    if (/(?:ó|ió|o)$/.test(palabraMinus) && /(?:ó|ió)$/.test(palabraMinus)) return 'pret_3s';
    if (/(?:aron|ieron|yeron)$/.test(palabraMinus)) return 'pret_3p';
    if (/(?:an|en)$/.test(palabraMinus)) return 'pres_3p';
    if (palabraMinus.endsWith('o')) return 'pres_1s';
    if (/(?:a|e)$/.test(palabraMinus)) return 'pres_3s';
    return null;
}

function conjugarVerboRegular(infinitivo: string, morf: MorfologiaVerbal): string {
    // Si es una locución verbal (ej. "dejar sin efecto"), conjugamos la primera palabra
    const partes = infinitivo.split(' ');
    if (partes.length > 1) {
        return [conjugarVerboRegular(partes[0], morf), ...partes.slice(1)].join(' ');
    }
    if (infinitivo.endsWith('se')) {
        const base = infinitivo.slice(0, -2);
        if (morf === 'infinitivo') return infinitivo;
        return `se ${conjugarVerboRegular(base, morf)}`;
    }
    if (!/[aei]r$/.test(infinitivo) || morf === 'infinitivo') return infinitivo;
    const raiz = infinitivo.slice(0, -2);
    const conj = infinitivo.slice(-2); // ar | er | ir
    const esAr = conj === 'ar';
    switch (morf) {
        case 'gerundio':
            return esAr ? `${raiz}ando` : `${raiz}iendo`;
        case 'participio_ms':
            return esAr ? `${raiz}ado` : `${raiz}ido`;
        case 'participio_fs':
            return esAr ? `${raiz}ada` : `${raiz}ida`;
        case 'participio_mp':
            return esAr ? `${raiz}ados` : `${raiz}idos`;
        case 'participio_fp':
            return esAr ? `${raiz}adas` : `${raiz}idas`;
        case 'pres_1s':
            return `${raiz}o`;
        case 'pres_3s':
            return esAr ? `${raiz}a` : `${raiz}e`;
        case 'pres_3p':
            return esAr ? `${raiz}an` : `${raiz}en`;
        case 'pret_3s': {
            if (esAr) {
                if (raiz.endsWith('c')) return `${raiz.slice(0, -1)}có`;
                if (raiz.endsWith('g')) return `${raiz.slice(0, -1)}gó`;
                if (raiz.endsWith('z')) return `${raiz.slice(0, -1)}zó`;
                return `${raiz}ó`;
            }
            return `${raiz}ió`;
        }
        case 'pret_3p':
            return esAr ? `${raiz}aron` : `${raiz}ieron`;
    }
}

function pluralizarSustantivoAdjetivo(base: string): string {
    if (base.includes(' ')) return base; // locución: mantener intacta para no deformar
    if (/[aeiouáéó]$/i.test(base)) return `${base}s`;
    if (/z$/i.test(base)) return `${base.slice(0, -1)}ces`;
    if (/[íú]$/i.test(base)) return `${base}es`;
    const sinTildeFinal = base
        .replace(/ón$/i, 'ones')
        .replace(/án$/i, 'anes')
        .replace(/én$/i, 'enes')
        .replace(/ín$/i, 'ines')
        .replace(/ún$/i, 'unes');
    if (sinTildeFinal !== base) return sinTildeFinal;
    return `${base}es`;
}

/**
 * Adapta la sugerencia (en forma base/lema) a la flexión (tiempo/plural/género)
 * y capitalización (MAYÚSCULAS, Capitalizada, minúsculas) de la palabra original.
 */
export function adaptarReemplazo(original: string, sugerenciaBase: string, categoria?: EntradaTesauro['categoria']): string {
    const origLimpio = original.trim();
    const sugLimpia = sugerenciaBase.trim();
    if (!origLimpio || !sugLimpia) return sugLimpia;

    const minus = origLimpio.toLowerCase();
    const catEfectiva = categoria ?? (/^[a-záéíóúñ]+[aei]r$/i.test(sugLimpia) ? 'verbo' : 'sustantivo');
    let adaptada = sugLimpia;

    if (catEfectiva === 'verbo' && !minus.includes(' ')) {
        const morf = detectarMorfologiaVerbal(minus);
        if (morf && morf !== 'infinitivo') {
            adaptada = conjugarVerboRegular(sugLimpia, morf);
        }
    } else if ((catEfectiva === 'sustantivo' || catEfectiva === 'adjetivo') && !minus.includes(' ') && !sugLimpia.includes(' ')) {
        const esPlural = /(?:s|es)$/.test(minus) && !/(?:sis|tis|xis)$/.test(minus);
        const esFemenino = /(?:a|as)$/.test(minus);
        if (catEfectiva === 'adjetivo' && esFemenino && adaptada.endsWith('o')) {
            adaptada = `${adaptada.slice(0, -1)}a`;
        }
        if (esPlural && !adaptada.endsWith('s')) {
            adaptada = pluralizarSustantivoAdjetivo(adaptada);
        }
    }

    // Preservar capitalización del original
    const todoMayus = origLimpio.length > 1 && origLimpio === origLimpio.toUpperCase() && origLimpio !== origLimpio.toLowerCase();
    const primeraMayus = origLimpio[0] === origLimpio[0].toUpperCase() && origLimpio[0] !== origLimpio[0].toLowerCase();

    if (todoMayus) return adaptada.toUpperCase();
    if (primeraMayus) return adaptada.charAt(0).toUpperCase() + adaptada.slice(1);
    return adaptada;
}

function coincidePalabraConEntrada(palabraNorm: string, entrada: EntradaTesauro): boolean {
    const lemaNorm = entrada.lema.toLowerCase();
    if (palabraNorm === lemaNorm || quitarTildes(palabraNorm) === quitarTildes(lemaNorm)) return true;
    if (entrada.formas?.some((f) => f.toLowerCase() === palabraNorm || quitarTildes(f.toLowerCase()) === quitarTildes(palabraNorm))) {
        return true;
    }
    for (const g of entrada.grupos) {
        if (g.registro === 'antonimo') continue;
        for (const t of g.terminos) {
            const tn = t.toLowerCase();
            if (tn === palabraNorm || quitarTildes(tn) === quitarTildes(palabraNorm)) return true;
        }
    }
    // Heurística de raíz verbal o plural nominal
    if (entrada.categoria === 'verbo' && /[aei]r$/.test(lemaNorm) && lemaNorm.length >= 5) {
        const raiz = lemaNorm.slice(0, -2);
        if (raiz.length >= 4 && palabraNorm.startsWith(raiz) && palabraNorm.length <= raiz.length + 5) return true;
    }
    if ((entrada.categoria === 'sustantivo' || entrada.categoria === 'adjetivo') && lemaNorm.length >= 4) {
        if (palabraNorm === `${lemaNorm}s` || palabraNorm === `${lemaNorm}es`) return true;
        if (lemaNorm.endsWith('o') && (palabraNorm === `${lemaNorm.slice(0, -1)}a` || palabraNorm === `${lemaNorm.slice(0, -1)}as`)) {
            return true;
        }
    }
    return false;
}

/**
 * Busca sinónimos inteligentes y mejoras de registro forense para una palabra o locución.
 */
export function buscarSinonimos(termino: string): ResultadoSinonimos | null {
    const limpio = termino.replace(/^[.,;:¡!¿?"«»()[\]]+|[.,;:¡!¿?"«»()[\]]+$/g, '').trim();
    if (!limpio) return null;
    const norm = limpio.toLowerCase();

    let entrada = TESAURO_BASE.find((e) => e.lema.toLowerCase() === norm);
    if (!entrada) {
        entrada = TESAURO_BASE.find((e) => coincidePalabraConEntrada(norm, e));
    }
    if (!entrada) return null;

    const grupos = entrada.grupos
        .map((g) => {
            // Si el usuario buscó un sinónimo que está dentro de este grupo, incluir también el lema base como alternativa
            const candidatos = new Set<string>(g.terminos);
            if (g.registro !== 'antonimo' && entrada.lema.toLowerCase() !== norm) {
                candidatos.add(entrada.lema);
            }
            const opciones = [...candidatos]
                .filter((c) => c.toLowerCase() !== norm)
                .map((base) => ({
                    base,
                    reemplazo: adaptarReemplazo(limpio, base, entrada.categoria),
                }));
            return {
                registro: g.registro,
                etiqueta: g.etiqueta,
                opciones,
            };
        })
        .filter((g) => g.opciones.length > 0);

    if (grupos.length === 0) return null;

    return {
        terminoOriginal: limpio,
        lema: entrada.lema,
        categoria: entrada.categoria,
        definicionBreve: entrada.definicionBreve,
        grupos,
    };
}

/**
 * Devuelve sugerencias de entradas del tesauro al buscar libremente en el panel.
 */
export function explorarTesauro(consulta: string): ResultadoSinonimos[] {
    const q = consulta.trim().toLowerCase();
    if (!q) {
        return TESAURO_BASE.slice(0, 12)
            .map((e) => buscarSinonimos(e.lema))
            .filter((r): r is ResultadoSinonimos => r !== null);
    }
    const qSin = quitarTildes(q);
    const exacto = buscarSinonimos(consulta);
    const resultados: ResultadoSinonimos[] = exacto ? [exacto] : [];
    const vistos = new Set<string>(exacto ? [exacto.lema] : []);

    for (const e of TESAURO_BASE) {
        if (vistos.has(e.lema)) continue;
        const coincideLema = quitarTildes(e.lema).includes(qSin);
        const coincideTerm = e.grupos.some((g) => g.terminos.some((t) => quitarTildes(t.toLowerCase()).includes(qSin)));
        const coincideDef = quitarTildes(e.definicionBreve.toLowerCase()).includes(qSin);
        if (coincideLema || coincideTerm || coincideDef) {
            const r = buscarSinonimos(e.lema);
            if (r) {
                resultados.push(r);
                vistos.add(e.lema);
                if (resultados.length >= 15) break;
            }
        }
    }
    return resultados;
}
