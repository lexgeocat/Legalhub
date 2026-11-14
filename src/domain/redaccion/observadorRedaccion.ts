export type CategoriaObservador = 'ortografia' | 'puntuacion' | 'gramatica' | 'estilo';
export type SeveridadObservador = 'error' | 'aviso' | 'sugerencia';

interface ReglaForense {
    id: string;
    categoria: 'Gramática' | 'Régimen Preposicional' | 'Pleonasmos' | 'Estilo Forense';
    gravedad: 'error' | 'advertencia' | 'sugerencia';
    patron: RegExp;
    explicacion: string;
    sugerencias: string[];
}

const REGLAS_GRAMATICA_ESTILO: ReglaForense[] = [
    {
        id: 'dequeismo-declarativo',
        categoria: 'Gramática',
        gravedad: 'error',
        patron: /\b(manifestó|expresó|señaló|indicó|sostuvo|afirmó|alegó|considero|consideramos|pienso|estimamos)\s+de\s+que\b/gi,
        explicacion: 'Dequeísmo: los verbos de lengua y pensamiento («manifestar», «señalar», «alegar», «considerar») no rigen la preposición «de» antes de «que».',
        sugerencias: ['manifestó que', 'señaló que', 'alegó que'],
    },
    {
        id: 'queismo-advertir-convencer',
        categoria: 'Régimen Preposicional',
        gravedad: 'error',
        patron: /\b(darse\s+cuenta|me\s+di\s+cuenta|se\s+dio\s+cuenta|estoy\s+seguro|convencido|consciente)\s+que\b/gi,
        explicacion: 'Queísmo: estas construcciones exigen la preposición «de» antes de la conjunción «que» («darse cuenta de que», «seguro de que»).',
        sugerencias: ['darse cuenta de que', 'consciente de que'],
    },
    {
        id: 'regimen-en-base-a',
        categoria: 'Régimen Preposicional',
        gravedad: 'advertencia',
        patron: /\ben\s+base\s+a\b/gi,
        explicacion: 'La locución «en base a» es censurada en prosa jurídica cuidada; prefiera «con base en», «sobre la base de» o «en mérito a».',
        sugerencias: ['con base en', 'sobre la base de', 'en mérito a'],
    },
    {
        id: 'regimen-de-acuerdo-a',
        categoria: 'Régimen Preposicional',
        gravedad: 'advertencia',
        patron: /\bde\s+acuerdo\s+a\b/gi,
        explicacion: 'En el registro jurídico formal, cuando introduce cosas o normas se prefiere «de acuerdo con» o «conforme a».',
        sugerencias: ['de acuerdo con', 'conforme a', 'al tenor de'],
    },
    {
        id: 'regimen-en-relacion-a',
        categoria: 'Régimen Preposicional',
        gravedad: 'advertencia',
        patron: /\ben\s+relación\s+a\b/gi,
        explicacion: 'Cruce impropio entre «en relación con» y «con relación a».',
        sugerencias: ['en relación con', 'con relación a', 'respecto de'],
    },
    {
        id: 'regimen-bajo-el-punto',
        categoria: 'Régimen Preposicional',
        gravedad: 'advertencia',
        patron: /\bbajo\s+el\s+punto\s+de\s+vista\b/gi,
        explicacion: 'Galicismo preposicional; lo propio en español es «desde el punto de vista».',
        sugerencias: ['desde el punto de vista'],
    },
    {
        id: 'pleonasmo-lapso-tiempo',
        categoria: 'Pleonasmos',
        gravedad: 'sugerencia',
        patron: /\blapso\s+de\s+tiempo\b/gi,
        explicacion: 'Redundancia léxica: un «lapso» ya es, por definición, un transcurso o espacio de tiempo.',
        sugerencias: ['lapso', 'plazo', 'período'],
    },
    {
        id: 'pleonasmo-erario-publico',
        categoria: 'Pleonasmos',
        gravedad: 'sugerencia',
        patron: /\berario\s+público\b/gi,
        explicacion: 'Pleonasmo jurídico: el sustantivo «erario» significa precisamente tesoro público del Estado.',
        sugerencias: ['erario', 'tesoro público', 'patrimonio estatal'],
    },
    {
        id: 'pleonasmo-pero-sin-embargo',
        categoria: 'Pleonasmos',
        gravedad: 'advertencia',
        patron: /\bpero\s+sin\s+embargo\b/gi,
        explicacion: 'Acumulación redundante de dos conectores adversativos equivalentes.',
        sugerencias: ['sin embargo,', 'no obstante,', 'pero'],
    },
    {
        id: 'estilo-a-nivel-de',
        categoria: 'Estilo Forense',
        gravedad: 'sugerencia',
        patron: /\ba\s+nivel\s+de\b/gi,
        explicacion: 'Muletilla coloquial impropia del lenguaje forense cuando no existe jerarquía o escala real.',
        sugerencias: ['en el ámbito de', 'en sede', 'respecto de'],
    },
];

export interface HallazgoObservador {
    id: string;
    reglaId: string;
    categoria: CategoriaObservador;
    severidad: SeveridadObservador;
    /** Índice del bloque dentro de la lista de bloques o líneas (cuando aplica). */
    parrafoIndex: number;
    /** Offset inicial dentro del texto analizado. */
    desde: number;
    /** Offset final dentro del texto analizado. */
    hasta: number;
    fragmento: string;
    titulo: string;
    explicacion: string;
    sugerencias: string[];
}

export interface MetricasDocumento {
    palabras: number;
    caracteres: number;
    oraciones: number;
    parrafos: number;
    promedioPalabrasPorOracion: number;
    oracionesLargas: number;
    puntajeCalidad: number;
    nivelClaridad: 'Excelente' | 'Bueno' | 'Mejorable' | 'Complejo';
}

const CLAVE_DICCIONARIO_PERSONAL = 'legal_hub_diccionario_personal_v1';

export function cargarDiccionarioPersonal(): Set<string> {
    try {
        const raw = localStorage.getItem(CLAVE_DICCIONARIO_PERSONAL);
        if (!raw) return new Set();
        const arr: unknown = JSON.parse(raw);
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr.filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase()));
    } catch {
        return new Set();
    }
}

export function agregarAlDiccionarioPersonal(palabra: string): Set<string> {
    const actual = cargarDiccionarioPersonal();
    const limpia = palabra.trim().toLowerCase();
    if (limpia) {
        actual.add(limpia);
        try {
            localStorage.setItem(CLAVE_DICCIONARIO_PERSONAL, JSON.stringify([...actual]));
        } catch {
            // Ignorar si localStorage no está disponible
        }
    }
    return actual;
}

/**
 * Diccionario de errores ortográficos, vulgarismos verbales y omisiones de tilde frecuentes en redacción jurídica y general.
 */
const DICCIONARIO_ORTOGRAFIA: Record<string, { correccion: string; motivo: string }> = {
    // Tildes en léxico jurídico y administrativo frecuente
    articulo: { correccion: 'artículo', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    articulos: { correccion: 'artículos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    clausula: { correccion: 'cláusula', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    clausulas: { correccion: 'cláusulas', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    codigo: { correccion: 'código', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    codigos: { correccion: 'códigos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    parrafo: { correccion: 'párrafo', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    parrafos: { correccion: 'párrafos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    paragrafo: { correccion: 'parágrafo', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    paragrafos: { correccion: 'parágrafos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    termino: { correccion: 'término', motivo: 'Sustantivo esdrújulo («término procesal»). Si es verbo en presente («yo termino»), agrégala al diccionario.' },
    terminos: { correccion: 'términos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    caracter: { correccion: 'carácter', motivo: 'Palabra llana terminada en -r: lleva tilde.' },
    prorroga: { correccion: 'prórroga', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    prorrogas: { correccion: 'prórrogas', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    conyuge: { correccion: 'cónyuge', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    conyuges: { correccion: 'cónyuges', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    legitimo: { correccion: 'legítimo', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    legitima: { correccion: 'legítima', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    legitimos: { correccion: 'legítimos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    legitimas: { correccion: 'legítimas', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    ilicito: { correccion: 'ilícito', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    ilicita: { correccion: 'ilícita', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    ilicitos: { correccion: 'ilícitos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    juridico: { correccion: 'jurídico', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    juridica: { correccion: 'jurídica', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    juridicos: { correccion: 'jurídicos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    juridicas: { correccion: 'jurídicas', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    publico: { correccion: 'público', motivo: 'Como adjetivo o sustantivo («Ministerio Público», «instrumento público») es esdrújula.' },
    publica: { correccion: 'pública', motivo: 'En contexto forense suele ser el adjetivo esdrújulo «pública» (escritura pública, fe pública).' },
    publicos: { correccion: 'públicos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    publicas: { correccion: 'públicas', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    tramite: { correccion: 'trámite', motivo: 'Como sustantivo («en trámite») es palabra esdrújula.' },
    tramites: { correccion: 'trámites', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    cedula: { correccion: 'cédula', motivo: 'Palabra esdrújula («cédula de identidad»): lleva tilde siempre.' },
    cedulas: { correccion: 'cédulas', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    organo: { correccion: 'órgano', motivo: 'Palabra esdrújula («órgano judicial»): lleva tilde siempre.' },
    organos: { correccion: 'órganos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    titulo: { correccion: 'título', motivo: 'Como sustantivo («título ejecutivo») es palabra esdrújula.' },
    titulos: { correccion: 'títulos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    credito: { correccion: 'crédito', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    creditos: { correccion: 'créditos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    debito: { correccion: 'débito', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    valido: { correccion: 'válido', motivo: 'Como adjetivo («acto válido») es palabra esdrújula.' },
    valida: { correccion: 'válida', motivo: 'Como adjetivo («notificación válida») es palabra esdrújula.' },
    validos: { correccion: 'válidos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    validas: { correccion: 'válidas', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    invalido: { correccion: 'inválido', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    invalida: { correccion: 'inválida', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    fisico: { correccion: 'físico', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    fisica: { correccion: 'física', motivo: 'Palabra esdrújula («persona física»): lleva tilde siempre.' },
    economico: { correccion: 'económico', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    economica: { correccion: 'económica', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    unico: { correccion: 'único', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    unica: { correccion: 'única', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    numero: { correccion: 'número', motivo: 'Como sustantivo («número de expediente») es palabra esdrújula.' },
    numeros: { correccion: 'números', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    pagina: { correccion: 'página', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    paginas: { correccion: 'páginas', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    regimen: { correccion: 'régimen', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    especimen: { correccion: 'espécimen', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    indice: { correccion: 'índice', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    limite: { correccion: 'límite', motivo: 'Como sustantivo («límite legal») es palabra esdrújula.' },
    limites: { correccion: 'límites', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    habito: { correccion: 'hábito', motivo: 'Como sustantivo es palabra esdrújula.' },
    deposito: { correccion: 'depósito', motivo: 'Como sustantivo («depósito judicial») es palabra esdrújula.' },
    depositos: { correccion: 'depósitos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    proposito: { correccion: 'propósito', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    propositos: { correccion: 'propósitos', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    analisis: { correccion: 'análisis', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    hipotesis: { correccion: 'hipótesis', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    sintesis: { correccion: 'síntesis', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    fasis: { correccion: 'énfasis', motivo: '¿Quisiste escribir «énfasis»?' },
    enfasis: { correccion: 'énfasis', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    catalogo: { correccion: 'catálogo', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    computo: { correccion: 'cómputo', motivo: 'Como sustantivo («cómputo de plazos») es palabra esdrújula.' },
    autentico: { correccion: 'auténtico', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    autentica: { correccion: 'auténtica', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    apocrifo: { correccion: 'apócrifo', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    apocrifa: { correccion: 'apócrifa', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    equivoco: { correccion: 'equívoco', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    inequivoco: { correccion: 'inequívoco', motivo: 'Palabra esdrújula: lleva tilde siempre.' },
    inequivoca: { correccion: 'inequívoca', motivo: 'Palabra esdrújula: lleva tilde siempre.' },

    // Adverbios, preposiciones y conectores sin tilde
    tambien: { correccion: 'también', motivo: 'Palabra aguda terminada en -n: lleva tilde.' },
    ademas: { correccion: 'además', motivo: 'Palabra aguda terminada en -s: lleva tilde.' },
    segun: { correccion: 'según', motivo: 'Palabra aguda terminada en -n: lleva tilde.' },
    despues: { correccion: 'después', motivo: 'Palabra aguda terminada en -s: lleva tilde.' },
    atras: { correccion: 'atrás', motivo: 'Palabra aguda terminada en -s: lleva tilde.' },
    detras: { correccion: 'detrás', motivo: 'Palabra aguda terminada en -s: lleva tilde.' },
    jamas: { correccion: 'jamás', motivo: 'Palabra aguda terminada en -s: lleva tilde.' },
    ningun: { correccion: 'ningún', motivo: 'Palabra aguda terminada en -n: lleva tilde.' },
    algun: { correccion: 'algún', motivo: 'Palabra aguda terminada en -n: lleva tilde.' },
    comun: { correccion: 'común', motivo: 'Palabra aguda terminada en -n: lleva tilde.' },
    interes: { correccion: 'interés', motivo: 'Palabra aguda terminada en -s: lleva tilde.' },
    atraz: { correccion: 'atrás', motivo: 'Se escribe con «s» final y tilde: «atrás».' },
    atravez: { correccion: 'a través', motivo: 'Se escribe en dos palabras, con «v» y «s»: «a través».' },
    atraves: { correccion: 'a través', motivo: 'La locución correcta se escribe en dos palabras y con tilde: «a través».' },
    quizas: { correccion: 'quizás', motivo: 'Palabra aguda terminada en -s: lleva tilde.' },
    facil: { correccion: 'fácil', motivo: 'Palabra llana terminada en -l: lleva tilde.' },
    dificil: { correccion: 'difícil', motivo: 'Palabra llana terminada en -l: lleva tilde.' },
    util: { correccion: 'útil', motivo: 'Palabra llana terminada en -l: lleva tilde («día útil / hábil»).' },
    inutil: { correccion: 'inútil', motivo: 'Palabra llana terminada en -l: lleva tilde.' },
    habil: { correccion: 'hábil', motivo: 'Palabra llana terminada en -l: lleva tilde («día hábil»).' },
    inhabil: { correccion: 'inhábil', motivo: 'Palabra llana terminada en -l: lleva tilde («día inhábil»).' },
    movil: { correccion: 'móvil', motivo: 'Palabra llana terminada en -l: lleva tilde.' },
    inmovil: { correccion: 'inmóvil', motivo: 'Palabra llana terminada en -l: lleva tilde.' },
    debil: { correccion: 'débil', motivo: 'Palabra llana terminada en -l: lleva tilde.' },
    docil: { correccion: 'dócil', motivo: 'Palabra llana terminada en -l: lleva tilde.' },

    // Hiatos frecuentes sin tilde
    dia: { correccion: 'día', motivo: 'Hiato de vocal cerrada tónica (í) y abierta: lleva tilde.' },
    dias: { correccion: 'días', motivo: 'Hiato de vocal cerrada tónica (í) y abierta: lleva tilde.' },
    habia: { correccion: 'había', motivo: 'Pretérito imperfecto con hiato (í-a): lleva tilde.' },
    habian: { correccion: 'habían', motivo: 'Pretérito imperfecto con hiato (í-a): lleva tilde.' },
    seria: { correccion: 'sería', motivo: 'Si es condicional del verbo ser («sería»), lleva tilde por hiato.' },
    estaria: { correccion: 'estaría', motivo: 'Condicional con hiato (í-a): lleva tilde.' },
    podria: { correccion: 'podría', motivo: 'Condicional con hiato (í-a): lleva tilde.' },
    podrian: { correccion: 'podrían', motivo: 'Condicional con hiato (í-a): lleva tilde.' },
    deberia: { correccion: 'debería', motivo: 'Condicional con hiato (í-a): lleva tilde.' },
    deberian: { correccion: 'deberían', motivo: 'Condicional con hiato (í-a): lleva tilde.' },
    tendria: { correccion: 'tendría', motivo: 'Condicional con hiato (í-a): lleva tilde.' },
    tendrian: { correccion: 'tendrían', motivo: 'Condicional con hiato (í-a): lleva tilde.' },
    haria: { correccion: 'haría', motivo: 'Condicional con hiato (í-a): lleva tilde.' },
    actua: { correccion: 'actúa', motivo: 'Hiato de vocal cerrada tónica (ú-a): lleva tilde.' },
    actuan: { correccion: 'actúan', motivo: 'Hiato de vocal cerrada tónica (ú-a): lleva tilde.' },
    efectua: { correccion: 'efectúa', motivo: 'Hiato de vocal cerrada tónica (ú-a): lleva tilde.' },
    continua: { correccion: 'continúa', motivo: 'Si es verbo («continúa»), lleva tilde en la «ú».' },
    evalua: { correccion: 'evalúa', motivo: 'Hiato de vocal cerrada tónica (ú-a): lleva tilde.' },
    cuantia: { correccion: 'cuantía', motivo: 'Hiato de vocal cerrada tónica (í-a): lleva tilde («menor cuantía»).' },
    garantia: { correccion: 'garantía', motivo: 'Hiato de vocal cerrada tónica (í-a): lleva tilde.' },
    garantias: { correccion: 'garantías', motivo: 'Hiato de vocal cerrada tónica (í-a): lleva tilde.' },
    notaria: { correccion: 'notaría', motivo: 'Como oficio o despacho («Notaría de Fe Pública») lleva tilde en la «í».' },
    secretaria: { correccion: 'secretaría', motivo: 'Como oficina o despacho («Secretaría del Juzgado») lleva tilde en la «í».' },
    fiscalia: { correccion: 'fiscalía', motivo: 'Hiato de vocal cerrada tónica (í-a): lleva tilde.' },
    defensoria: { correccion: 'defensoría', motivo: 'Hiato de vocal cerrada tónica (í-a): lleva tilde.' },
    policia: { correccion: 'policía', motivo: 'Hiato de vocal cerrada tónica (í-a): lleva tilde.' },
    alcaldia: { correccion: 'alcaldía', motivo: 'Hiato de vocal cerrada tónica (í-a): lleva tilde.' },
    auditoria: { correccion: 'auditoría', motivo: 'Hiato de vocal cerrada tónica (í-a): lleva tilde.' },
    asesoria: { correccion: 'asesoría', motivo: 'Hiato de vocal cerrada tónica (í-a): lleva tilde.' },
    tutoria: { correccion: 'tutoría', motivo: 'Hiato de vocal cerrada tónica (í-a): lleva tilde.' },
    mayoria: { correccion: 'mayoría', motivo: 'Hiato de vocal cerrada tónica (í-a): lleva tilde.' },
    minoria: { correccion: 'minoría', motivo: 'Hiato de vocal cerrada tónica (í-a): lleva tilde.' },

    // Monosílabos con tilde indebida (Ortografía RAE 2010)
    'fué': { correccion: 'fue', motivo: 'Los monosílabos nunca llevan tilde salvo tilde diacrítica («fue» se escribe sin tilde).' },
    'fuí': { correccion: 'fui', motivo: 'Los monosílabos nunca llevan tilde («fui» se escribe sin tilde).' },
    'vió': { correccion: 'vio', motivo: 'Monosílabo ortográfico: «vio» se escribe sin tilde.' },
    'dió': { correccion: 'dio', motivo: 'Monosílabo ortográfico: «dio» se escribe sin tilde.' },
    'guión': { correccion: 'guion', motivo: 'Según la Ortografía de la RAE (2010), «guion» es monosílabo y se escribe sin tilde.' },
    'tí': { correccion: 'ti', motivo: 'El pronombre «ti» nunca lleva tilde (no existe homógrafo tónico).' },
    'fé': { correccion: 'fe', motivo: 'El monosílabo «fe» («fe pública», «buena fe») nunca lleva tilde.' },
    'dá': { correccion: 'da', motivo: 'El monosílabo «da» del verbo dar nunca lleva tilde.' },

    // Errores ortográficos y barbarismos verbales frecuentes
    prevee: { correccion: 'prevé', motivo: 'El verbo «prever» se conjuga como «ver» (prevé), no como «proveer» (*prevee).' },
    preveer: { correccion: 'prever', motivo: 'La grafía correcta es «prever» (con una sola «e»), conjugado como «ver».' },
    preveyendo: { correccion: 'previendo', motivo: 'El gerundio de «prever» es «previendo», no *preveyendo.' },
    preveyo: { correccion: 'previó', motivo: 'El pretérito de «prever» es «previó».' },
    satisfacio: { correccion: 'satisfizo', motivo: '«Satisfacer» se conjuga como «hacer»: «satisfizo», no *satisfació.' },
    satisfació: { correccion: 'satisfizo', motivo: '«Satisfacer» se conjuga como «hacer»: «satisfizo», no *satisfació.' },
    satisfaciera: { correccion: 'satisficiera', motivo: '«Satisfacer» se conjuga como «hacer»: «satisficiera».' },
    satisfacieron: { correccion: 'satisficieron', motivo: '«Satisfacer» se conjuga como «hacer»: «satisficieron».' },
    conducio: { correccion: 'condujo', motivo: 'El pretérito de «conducir» es irregular: «condujo».' },
    condució: { correccion: 'condujo', motivo: 'El pretérito de «conducir» es irregular: «condujo».' },
    deducio: { correccion: 'dedujo', motivo: 'El pretérito de «deducir» es irregular: «dedujo».' },
    dedució: { correccion: 'dedujo', motivo: 'El pretérito de «deducir» es irregular: «dedujo».' },
    producio: { correccion: 'produjo', motivo: 'El pretérito de «producir» es irregular: «produjo».' },
    produció: { correccion: 'produjo', motivo: 'El pretérito de «producir» es irregular: «produjo».' },
    interponio: { correccion: 'interpuso', motivo: '«Interponer» se conjuga como «poner»: «interpuso».' },
    interponió: { correccion: 'interpuso', motivo: '«Interponer» se conjuga como «poner»: «interpuso».' },
    proponio: { correccion: 'propuso', motivo: '«Proponer» se conjuga como «poner»: «propuso».' },
    proponió: { correccion: 'propuso', motivo: '«Proponer» se conjuga como «poner»: «propuso».' },
    disponio: { correccion: 'dispuso', motivo: '«Disponer» se conjuga como «poner»: «dispuso».' },
    disponió: { correccion: 'dispuso', motivo: '«Disponer» se conjuga como «poner»: «dispuso».' },
    abstenio: { correccion: 'abstuvo', motivo: '«Abstenerse» se conjuga como «tener»: «se abstuvo».' },
    abstenió: { correccion: 'abstuvo', motivo: '«Abstenerse» se conjuga como «tener»: «se abstuvo».' },
    contravenio: { correccion: 'contravino', motivo: '«Contravenir» se conjuga como «venir»: «contravino».' },
    contravenió: { correccion: 'contravino', motivo: '«Contravenir» se conjuga como «venir»: «contravino».' },
    dijieron: { correccion: 'dijeron', motivo: 'Tras «j» no se escribe «i» en el pretérito: «dijeron».' },
    trajieron: { correccion: 'trajeron', motivo: 'Tras «j» no se escribe «i» en el pretérito: «trajeron».' },
    produjieron: { correccion: 'produjeron', motivo: 'Tras «j» no se escribe «i» en el pretérito: «produjeron».' },
    condujieron: { correccion: 'condujeron', motivo: 'Tras «j» no se escribe «i» en el pretérito: «condujeron».' },
    haiga: { correccion: 'haya', motivo: 'El presente de subjuntivo del verbo «haber» es «haya», nunca *haiga.' },
    haigan: { correccion: 'hayan', motivo: 'El presente de subjuntivo del verbo «haber» es «hayan», nunca *haigan.' },
    hubieron: { correccion: 'hubo', motivo: 'El verbo «haber» impersonal se usa siempre en singular: «hubo».' },
    habemos: { correccion: 'somos', motivo: 'Evite «habemos» para referirse a un grupo en primera persona; use «somos» o «estamos».' },
    conyugue: { correccion: 'cónyuge', motivo: 'Se escribe sin «u» después de la «g» y con tilde: «cónyuge».' },
    conyugues: { correccion: 'cónyuges', motivo: 'Se escribe sin «u» después de la «g» y con tilde: «cónyuges».' },
    inmueblez: { correccion: 'inmuebles', motivo: 'El plural de «inmueble» se escribe con «s»: «inmuebles».' },
    excencion: { correccion: 'exención', motivo: 'Se escribe sin «c» intermedia y con tilde: «exención».' },
    excepcion: { correccion: 'excepción', motivo: 'Palabra aguda terminada en -n: lleva tilde («excepción»).' },
    indemnisacion: { correccion: 'indemnización', motivo: 'Se escribe con «z» y tilde: «indemnización».' },
    indemnizacion: { correccion: 'indemnización', motivo: 'Palabra aguda terminada en -n: lleva tilde («indemnización»).' },
    desicion: { correccion: 'decisión', motivo: 'Se escribe primero con «c» y luego con «s»: «decisión».' },
    desición: { correccion: 'decisión', motivo: 'Se escribe primero con «c» y luego con «s»: «decisión».' },
    decision: { correccion: 'decisión', motivo: 'Palabra aguda terminada en -n: lleva tilde («decisión»).' },
    posesion: { correccion: 'posesión', motivo: 'Palabra aguda terminada en -n: lleva tilde («posesión»).' },
    prescripcion: { correccion: 'prescripción', motivo: 'Palabra aguda terminada en -n: lleva tilde («prescripción»).' },
    jurisdiccion: { correccion: 'jurisdicción', motivo: 'Palabra aguda terminada en -n: lleva tilde («jurisdicción»).' },
    apelacion: { correccion: 'apelación', motivo: 'Palabra aguda terminada en -n: lleva tilde («apelación»).' },
    casacion: { correccion: 'casación', motivo: 'Palabra aguda terminada en -n: lleva tilde («casación»).' },
    notificacion: { correccion: 'notificación', motivo: 'Palabra aguda terminada en -n: lleva tilde («notificación»).' },
    contestacion: { correccion: 'contestación', motivo: 'Palabra aguda terminada en -n: lleva tilde («contestación»).' },
    resolucion: { correccion: 'resolución', motivo: 'Palabra aguda terminada en -n: lleva tilde («resolución»).' },
    ejecucion: { correccion: 'ejecución', motivo: 'Palabra aguda terminada en -n: lleva tilde («ejecución»).' },
};

/** Conectores que exigen coma obligatoria cuando van al inicio de oración o tras punto y coma. */
const CONECTORES_CON_COMA = [
    'sin embargo',
    'no obstante',
    'por lo tanto',
    'por tanto',
    'en consecuencia',
    'por consiguiente',
    'por ende',
    'es decir',
    'esto es',
    'en efecto',
    'asimismo',
    'además',
    'en primer lugar',
    'en segundo lugar',
    'en tercer lugar',
    'finalmente',
    'por último',
    'a mayor abundamiento',
    'en conclusión',
    'en definitiva',
    'de igual modo',
    'de igual manera',
    'por otra parte',
    'por otro lado',
    'en cambio',
    'ahora bien',
    'en tal sentido',
    'en este sentido',
    'así pues',
    'con todo',
];

const RE_CONECTOR_INICIO = new RegExp(
    `(?:^|[.;]\\s+)(${CONECTORES_CON_COMA.map((c) => c.replace(/\s+/g, '\\s+')).join('|')})(?=\\s+[a-záéíóúñ])`,
    'gi',
);

const ABREVIATURAS_CON_PUNTO = new Set([
    'art', 'arts', 'inc', 'num', 'núm', 'no', 'nro', 'fs', 'fjs', 'pág', 'págs', 'dr', 'dra', 'sr', 'sra', 'srta',
    'lic', 'abg', 'abog', 'ing', 'arq', 'gral', 'cnl', 'cap', 'tte', 'bs', 'usd', 'us', 'etc', 'ej', 'aprox',
    'atte', 'atto', 'ci', 'nit', 'srl', 'sa', 'ltda', 'cia', 'cía', 'vs', 'vda', 'pdo', 'pda', 'dto', 'dpto',
]);

function preservarCaso(original: string, sugerencia: string): string {
    if (!original || !sugerencia) return sugerencia;
    const todoMayus = original.length > 1 && original === original.toUpperCase() && original !== original.toLowerCase();
    if (todoMayus) return sugerencia.toUpperCase();
    const primeraMayus = original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase();
    if (primeraMayus) return sugerencia.charAt(0).toUpperCase() + sugerencia.slice(1);
    return sugerencia;
}

/** Rango ocupado por marcadores `{{...}}` para nunca señalarlos como error. */
function rangosMarcadores(texto: string): [number, number][] {
    const rangos: [number, number][] = [];
    for (const m of texto.matchAll(/\{\{[\s\S]*?\}\}/g)) {
        const ini = m.index ?? 0;
        rangos.push([ini, ini + m[0].length]);
    }
    return rangos;
}

function enMarcador(desde: number, hasta: number, marcadores: [number, number][]): boolean {
    return marcadores.some(([a, b]) => desde < b && hasta > a);
}

/**
 * Analiza un párrafo (texto plano de ese bloque) y devuelve todos los hallazgos de ortografía,
 * puntuación, gramática y estilo forense con posiciones exactas [desde, hasta].
 */
export function analizarParrafoObservador(
    texto: string,
    parrafoIndex = 0,
    diccionarioPersonal?: Set<string>,
): HallazgoObservador[] {
    if (!texto || !texto.trim()) return [];
    const hallazgos: HallazgoObservador[] = [];
    const marcadores = rangosMarcadores(texto);
    const dic = diccionarioPersonal ?? new Set<string>();

    const ocupados: [number, number][] = [];
    const ocupado = (d: number, h: number) => ocupados.some(([a, b]) => d < b && h > a);
    const registrar = (h: Omit<HallazgoObservador, 'id'>) => {
        if (h.desde < 0 || h.hasta <= h.desde) return;
        if (enMarcador(h.desde, h.hasta, marcadores)) return;
        const fragMinus = h.fragmento.trim().toLowerCase();
        if (dic.has(fragMinus)) return;
        if (ocupado(h.desde, h.hasta)) return;
        ocupados.push([h.desde, h.hasta]);
        hallazgos.push({
            ...h,
            id: `${parrafoIndex}-${h.desde}-${h.hasta}-${h.reglaId}`,
        });
    };

    // 1. REGLAS CONTEXTUALES DE HOMÓFONOS Y PARÓNIMOS JURÍDICOS (Ortografía contextual)
    const reglasContextualesOrtografia: {
        id: string;
        patron: RegExp;
        titulo: string;
        explicacion: string;
        reemplazar: (m: RegExpExecArray) => string[];
    }[] = [
        {
            id: 'ort-a-part',
            patron: /\b(a)\s+((?:sido|hecho|dicho|visto|escrito|puesto|interpuesto|expuesto|dispuesto|propuesto|compuesto|abierto|cubierto|descubierto|resuelto|suscrito|inscrito|prescrito|proscrito|satisfecho|impreso|provisto|[a-záéíóúñ]{3,}(?:ado|ido)))\b/gi,
            titulo: 'Auxiliar «ha» con «h» ante participio',
            explicacion: 'Ante un participio verbal («sido», «manifestado», «interpuesto»...) corresponde la forma del verbo haber «ha» con «h», no la preposición «a».',
            reemplazar: (m) => [`${preservarCaso(m[1], 'ha')} ${m[2]}`],
        },
        {
            id: 'ort-haber-a-ver',
            patron: /\b(va\s+a|debe|puede|tiene\s+que|habría\s+de|suele|pueda|deba)\s+(a\s+ver)\b/gi,
            titulo: 'Confusión entre «a ver» y «haber»',
            explicacion: 'En perífrasis verbales («debe haber», «puede haber», «va a haber») se emplea el infinitivo «haber».',
            reemplazar: (m) => [`${m[1]} haber`],
        },
        {
            id: 'ort-sin-prejuicio',
            patron: /\b(sin\s+prejuicio\s+de|daños\s+y\s+prejuicios)\b/gi,
            titulo: 'Confusión paronímica: «perjuicio» vs. «prejuicio»',
            explicacion: '«Perjuicio» significa daño o menoscabo patrimonial/jurídico; «prejuicio» es un juicio previo.',
            reemplazar: (m) => [
                m[0].toLowerCase().startsWith('sin')
                    ? preservarCaso(m[0], 'sin perjuicio de')
                    : preservarCaso(m[0], 'daños y perjuicios'),
            ],
        },
        {
            id: 'ort-infligir-ley',
            patron: /\b(inflig(?:ir|ió|ieron|e|en|iendo))\s+(la\s+ley|la\s+norma|el\s+artículo|el\s+precepto|el\s+contrato|el\s+deber|las\s+normas)\b/gi,
            titulo: 'Confusión paronímica: «infringir» vs. «infligir»',
            explicacion: '«Infringir» significa quebrantar leyes, normas o pactos; «infligir» significa causar un daño o imponer un castigo.',
            reemplazar: (m) => [`${m[1].replace(/inflig/i, (x) => preservarCaso(x, 'infring'))} ${m[2]}`],
        },
        {
            id: 'ort-infringir-dano',
            patron: /\b(infring(?:ir|ió|ieron|e|en|iendo))\s+(un\s+daño|daños|un\s+perjuicio|un\s+agravio|un\s+castigo|una\s+lesión)\b/gi,
            titulo: 'Confusión paronímica: «infligir» vs. «infringir»',
            explicacion: 'Para referirse a causar un daño, agravio o castigo debe emplearse «infligir», no «infringir».',
            reemplazar: (m) => [`${m[1].replace(/infring/i, (x) => preservarCaso(x, 'inflig'))} ${m[2]}`],
        },
        {
            id: 'ort-de-echo',
            patron: /\b(de\s+echo|el\s+echo\s+de|los\s+echos\s+expuestos)\b/gi,
            titulo: 'Sustantivo «hecho» se escribe con «h»',
            explicacion: 'Cuando equivale a suceso, acontecimiento o circunstancia fáctica («de hecho», «el hecho de»), se escribe con «h».',
            reemplazar: (m) => [m[0].replace(/echo/i, (x) => preservarCaso(x, 'hecho'))],
        },
        {
            id: 'ort-palabra-repetida',
            patron: /\b(el|la|los|las|un|una|de|del|al|en|por|para|con|sin|que|se|no|es|son|como|más|o|y)\s+\1\b/gi,
            titulo: 'Palabra duplicada accidentalmente',
            explicacion: 'Se detectó la repetición consecutiva involuntaria de la misma palabra.',
            reemplazar: (m) => [m[1]],
        },
    ];

    for (const r of reglasContextualesOrtografia) {
        const re = new RegExp(r.patron.source, r.patron.flags);
        let m: RegExpExecArray | null;
        while ((m = re.exec(texto)) !== null) {
            const desde = m.index;
            const hasta = desde + m[0].length;
            registrar({
                reglaId: r.id,
                categoria: 'ortografia',
                severidad: 'error',
                parrafoIndex,
                desde,
                hasta,
                fragmento: m[0],
                titulo: r.titulo,
                explicacion: r.explicacion,
                sugerencias: r.reemplazar(m),
            });
        }
    }

    // 2. GRAMÁTICA Y CONCORDANCIA (Concordancia nominal, cacofonía y/e, o/u)
    const reglasConcordanciaGramatica: {
        id: string;
        patron: RegExp;
        titulo: string;
        explicacion: string;
        reemplazar: (m: RegExpExecArray) => string[];
    }[] = [
        {
            id: 'gram-cacofonia-y-i',
            patron: /\b(y)\s+(h?(?:i[a-zñáéíóú]+|í[a-zñáéíóú]*))\b/gi,
            titulo: 'Cacofonía: use «e» ante palabras que inician con sonido /i/',
            explicacion: 'La conjunción copulativa «y» toma la forma «e» ante palabras que empiezan por el sonido vocálico /i/ (salvo diptongo «hia-», «hie-»).',
            reemplazar: (m) => [`${preservarCaso(m[1], 'e')} ${m[2]}`],
        },
        {
            id: 'gram-cacofonia-o-u',
            patron: /\b(o)\s+(h?(?:o[a-zñáéíóú]+|ó[a-zñáéíóú]*))\b/gi,
            titulo: 'Cacofonía: use «u» ante palabras que inician con sonido /o/',
            explicacion: 'La conjunción disyuntiva «o» toma la forma «u» ante palabras que empiezan por el sonido /o/ («u otro», «u obligación»).',
            reemplazar: (m) => [`${preservarCaso(m[1], 'u')} ${m[2]}`],
        },
        {
            id: 'gram-la-acta',
            patron: /\b(la|una)\s+(acta|agua|área|arma|águila|hacha|hambre)\b/gi,
            titulo: 'Sustantivo femenino con «a-» tónica: use «el / un»',
            explicacion: 'Ante sustantivos femeninos que comienzan con /a/ tónica («acta», «área», «arma») debe emplearse el artículo «el» o «un» para evitar el hiato.',
            reemplazar: (m) => {
                const det = m[1].toLowerCase() === 'la' ? preservarCaso(m[1], 'el') : preservarCaso(m[1], 'un');
                return [`${det} ${m[2]}`];
            },
        },
        {
            id: 'gram-discordancia-plural-sing',
            patron: /\b(los|las)\s+(demandado|demandada|actor|actora|documento|cláusula|requisito|artículo|contrato|parte|prueba|testigo|juez|plazo|monto|hecho|derecho)\b/gi,
            titulo: 'Discordancia de número entre artículo y sustantivo',
            explicacion: 'El artículo plural («los / las») no concuerda con el sustantivo en singular.',
            reemplazar: (m) => {
                const sust = m[2];
                const plural = /z$/i.test(sust)
                    ? `${sust.slice(0, -1)}ces`
                    : /[aeiouáéó]$/i.test(sust)
                        ? `${sust}s`
                        : `${sust}es`;
                return [`${m[1]} ${plural}`, `${m[1].toLowerCase() === 'los' ? preservarCaso(m[1], 'el') : preservarCaso(m[1], 'la')} ${sust}`];
            },
        },
        {
            id: 'gram-discordancia-sing-plural',
            patron: /\b(el|la|un|una)\s+(demandados|demandadas|documentos|cláusulas|requisitos|artículos|contratos|partes|pruebas|testigos|plazos|montos|hechos|derechos)\b/gi,
            titulo: 'Discordancia de número entre determinante y sustantivo',
            explicacion: 'El determinante singular («el / la / un / una») no concuerda con el sustantivo en plural.',
            reemplazar: (m) => {
                const detMinus = m[1].toLowerCase();
                const detPlural = detMinus === 'el' ? 'los' : detMinus === 'la' ? 'las' : detMinus === 'un' ? 'unos' : 'unas';
                const sing = m[2].replace(/s$/i, '');
                return [`${preservarCaso(m[1], detPlural)} ${m[2]}`, `${m[1]} ${sing}`];
            },
        },
    ];

    for (const r of reglasConcordanciaGramatica) {
        const re = new RegExp(r.patron.source, r.patron.flags);
        let m: RegExpExecArray | null;
        while ((m = re.exec(texto)) !== null) {
            // Excluir diptongo hia-/hie-/hio- en cacofonía y-i
            if (r.id === 'gram-cacofonia-y-i' && /^hi[aeo]/i.test(m[2])) continue;
            const desde = m.index;
            const hasta = desde + m[0].length;
            registrar({
                reglaId: r.id,
                categoria: 'gramatica',
                severidad: 'error',
                parrafoIndex,
                desde,
                hasta,
                fragmento: m[0],
                titulo: r.titulo,
                explicacion: r.explicacion,
                sugerencias: r.reemplazar(m),
            });
        }
    }

    // 3. REGLAS DEL COMPENDIO FORENSE (Gramática, régimen, pleonasmos, estilo forense)
    for (const regla of REGLAS_GRAMATICA_ESTILO) {
        const re = new RegExp(regla.patron.source, regla.patron.flags);
        let match: RegExpExecArray | null;
        while ((match = re.exec(texto)) !== null) {
            const fragmento = match[0];
            const desde = match.index;
            const hasta = desde + fragmento.length;
            const cat: CategoriaObservador =
                regla.categoria === 'Gramática' || regla.categoria === 'Régimen Preposicional'
                    ? 'gramatica'
                    : 'estilo';
            const sev: SeveridadObservador =
                regla.gravedad === 'error' ? 'error' : regla.gravedad === 'advertencia' ? 'aviso' : 'sugerencia';
            registrar({
                reglaId: regla.id,
                categoria: cat,
                severidad: sev,
                parrafoIndex,
                desde,
                hasta,
                fragmento,
                titulo: `${regla.categoria}: «${fragmento}»`,
                explicacion: regla.explicacion,
                sugerencias: regla.sugerencias.map((s) => preservarCaso(fragmento, s)),
            });
        }
    }

    // 4. ORTOGRAFÍA PALABRA POR PALABRA (Diccionario + Heurística de acentuación en -ción/-sión/-xión)
    const rePalabra = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/g;
    let mp: RegExpExecArray | null;
    while ((mp = rePalabra.exec(texto)) !== null) {
        const palabra = mp[0];
        const desde = mp.index;
        const hasta = desde + palabra.length;
        const minus = palabra.toLowerCase();

        const entradaDic = DICCIONARIO_ORTOGRAFIA[minus];
        if (entradaDic) {
            // Para palabras como "publico", "termino", "limite", "numero", "titulo", "deposito", "computo", "continua", "seria":
            // Si van precedidas de "yo " no las marcamos como sustantivo/adjetivo sin tilde.
            const antes = texto.slice(Math.max(0, desde - 5), desde).toLowerCase();
            if (/\byo\s+$/.test(antes)) continue;

            registrar({
                reglaId: `ort-dic-${minus}`,
                categoria: 'ortografia',
                severidad: 'error',
                parrafoIndex,
                desde,
                hasta,
                fragmento: palabra,
                titulo: `Ortografía: «${palabra}» → «${preservarCaso(palabra, entradaDic.correccion)}»`,
                explicacion: entradaDic.motivo,
                sugerencias: [preservarCaso(palabra, entradaDic.correccion)],
            });
            continue;
        }

        // Heurística determinista: palabras agudas de >= 6 letras terminadas en -cion, -sion, -xion sin tilde
        if (palabra.length >= 6 && /(?:cion|sion|xion)$/i.test(minus) && !/[áéíóú]/i.test(minus)) {
            const corregidaMinus = minus.replace(/ion$/i, 'ión');
            const corregida = preservarCaso(palabra, corregidaMinus);
            registrar({
                reglaId: 'ort-tilde-ion',
                categoria: 'ortografia',
                severidad: 'error',
                parrafoIndex,
                desde,
                hasta,
                fragmento: palabra,
                titulo: `Falta de tilde aguda: «${corregida}»`,
                explicacion: 'Las palabras agudas terminadas en «-ción», «-sión» o «-xión» llevan tilde en la «ó» por terminar en «-n».',
                sugerencias: [corregida],
            });
        }
    }

    // 5. SIGNOS DE PUNTUACIÓN Y MECÁNICA DEL TEXTO
    // 5a. Conector sin coma posterior
    const reCon = new RegExp(RE_CONECTOR_INICIO.source, RE_CONECTOR_INICIO.flags);
    let mc: RegExpExecArray | null;
    while ((mc = reCon.exec(texto)) !== null) {
        const conector = mc[1];
        const offsetInterno = mc[0].lastIndexOf(conector);
        const desde = mc.index + offsetInterno;
        const hasta = desde + conector.length;
        registrar({
            reglaId: 'punt-coma-conector',
            categoria: 'puntuacion',
            severidad: 'aviso',
            parrafoIndex,
            desde,
            hasta,
            fragmento: conector,
            titulo: `Falta coma tras el conector «${conector}»`,
            explicacion: 'Los conectores discursivos e ilativos al inicio de oración o cláusula deben aislarse mediante coma.',
            sugerencias: [`${conector},`],
        });
    }

    // 5b. Espacio indebido antes de coma, punto, punto y coma o dos puntos
    const reEspacioAntes = /(\s+)([,.;:!?])/g;
    let mea: RegExpExecArray | null;
    while ((mea = reEspacioAntes.exec(texto)) !== null) {
        const desde = mea.index;
        const hasta = desde + mea[0].length;
        registrar({
            reglaId: 'punt-espacio-antes',
            categoria: 'puntuacion',
            severidad: 'aviso',
            parrafoIndex,
            desde,
            hasta,
            fragmento: mea[0],
            titulo: `Espacio indebido antes de «${mea[2]}»`,
            explicacion: 'Los signos de puntuación de cierre se escriben pegados a la palabra precedente, sin espacio intermedio.',
            sugerencias: [mea[2]],
        });
    }

    // 5c. Falta de espacio después de coma o punto y coma
    const reSinEspacio = /([,;])([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g;
    let mse: RegExpExecArray | null;
    while ((mse = reSinEspacio.exec(texto)) !== null) {
        const desde = mse.index;
        const hasta = desde + mse[0].length;
        registrar({
            reglaId: 'punt-sin-espacio',
            categoria: 'puntuacion',
            severidad: 'error',
            parrafoIndex,
            desde,
            hasta,
            fragmento: mse[0],
            titulo: `Falta espacio después de «${mse[1]}»`,
            explicacion: 'Después de coma o punto y coma debe dejarse un espacio en blanco antes de la siguiente palabra.',
            sugerencias: [`${mse[1]} ${mse[2]}`],
        });
    }

    // 5d. Signos de puntuación duplicados (,, ;; :: .. ??)
    const reDuplicados = /(,{2,}|;{2,}|:{2,}|\?{2,}|!{2,}|(?<!\.)\.{2}(?!\.))/g;
    let mdup: RegExpExecArray | null;
    while ((mdup = reDuplicados.exec(texto)) !== null) {
        const desde = mdup.index;
        const hasta = desde + mdup[0].length;
        const signo = mdup[0][0];
        const sug = signo === '.' ? [signo, '...'] : [signo];
        registrar({
            reglaId: 'punt-duplicado',
            categoria: 'puntuacion',
            severidad: 'error',
            parrafoIndex,
            desde,
            hasta,
            fragmento: mdup[0],
            titulo: `Signo de puntuación duplicado («${mdup[0]}»)`,
            explicacion: 'En español no se duplican las comas, puntos y comas, dos puntos ni signos de cierre; los puntos suspensivos son exactamente tres («...»).',
            sugerencias: sug,
        });
    }

    // 5e. Minúscula después de punto seguido (excluyendo abreviaturas comunes)
    const reMinusTrasPunto = /\b([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,})\.\s+([a-záéíóúñ]{2,})\b/g;
    let mmp: RegExpExecArray | null;
    while ((mmp = reMinusTrasPunto.exec(texto)) !== null) {
        const palabraAntes = mmp[1].toLowerCase();
        if (ABREVIATURAS_CON_PUNTO.has(palabraAntes)) continue;
        const palabraDespues = mmp[2];
        const offsetPalabraDespues = mmp[0].lastIndexOf(palabraDespues);
        const desde = mmp.index + offsetPalabraDespues;
        const hasta = desde + palabraDespues.length;
        const capitalizada = palabraDespues.charAt(0).toUpperCase() + palabraDespues.slice(1);
        registrar({
            reglaId: 'punt-mayus-tras-punto',
            categoria: 'puntuacion',
            severidad: 'error',
            parrafoIndex,
            desde,
            hasta,
            fragmento: palabraDespues,
            titulo: 'Mayúscula inicial tras punto y seguido',
            explicacion: 'La primera palabra después de un punto y seguido debe escribirse con mayúscula inicial.',
            sugerencias: [capitalizada],
        });
    }

    // 5f. Signos de interrogación, exclamación y paréntesis desbalanceados
    const contar = (ch: string) => {
        let c = 0;
        for (let i = 0; i < texto.length; i++) {
            if (texto[i] === ch && !enMarcador(i, i + 1, marcadores)) c++;
        }
        return c;
    };
    if (contar('?') > contar('¿')) {
        const idx = texto.lastIndexOf('?');
        if (idx >= 0) {
            // Buscar el inicio de la cláusula u oración para sugerir abrir «¿»
            registrar({
                reglaId: 'punt-falta-apertura-interrogacion',
                categoria: 'puntuacion',
                severidad: 'error',
                parrafoIndex,
                desde: idx,
                hasta: idx + 1,
                fragmento: '?',
                titulo: 'Falta el signo de apertura «¿»',
                explicacion: 'En español es obligatorio abrir la interrogación con «¿» al inicio de la pregunta.',
                sugerencias: ['?'],
            });
        }
    }
    if (contar('!') > contar('¡')) {
        const idx = texto.lastIndexOf('!');
        if (idx >= 0) {
            registrar({
                reglaId: 'punt-falta-apertura-exclamacion',
                categoria: 'puntuacion',
                severidad: 'error',
                parrafoIndex,
                desde: idx,
                hasta: idx + 1,
                fragmento: '!',
                titulo: 'Falta el signo de apertura «¡»',
                explicacion: 'En español es obligatorio abrir la exclamación con «¡» al inicio del enunciado exclamativo.',
                sugerencias: ['!'],
            });
        }
    }
    if (contar('(') !== contar(')')) {
        const faltaCerrar = contar('(') > contar(')');
        const ch = faltaCerrar ? '(' : ')';
        const idx = texto.lastIndexOf(ch);
        if (idx >= 0) {
            registrar({
                reglaId: 'punt-parentesis-desbalanceado',
                categoria: 'puntuacion',
                severidad: 'error',
                parrafoIndex,
                desde: idx,
                hasta: idx + 1,
                fragmento: ch,
                titulo: faltaCerrar ? 'Paréntesis «(» sin cerrar' : 'Paréntesis «)» sin apertura',
                explicacion: 'Todo paréntesis abierto dentro del párrafo debe contar con su correspondiente paréntesis de cierre.',
                sugerencias: [faltaCerrar ? `${ch})` : ''],
            });
        }
    }

    hallazgos.sort((a, b) => a.desde - b.desde);
    return hallazgos;
}

/**
 * Calcula métricas de legibilidad, extensión y calidad general del documento.
 */
export function calcularMetricasDocumento(parrafosTexto: string[], hallazgos: HallazgoObservador[]): MetricasDocumento {
    const noVacios = parrafosTexto.map((p) => p.trim()).filter((p) => p.length > 0);
    const unido = noVacios.join(' ');
    const palabrasArr = unido.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/g) ?? [];
    const palabras = palabrasArr.length;
    const caracteres = unido.length;

    const oracionesArr = noVacios
        .flatMap((p) => p.split(/(?<=[.!?])\s+/))
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
    const oraciones = Math.max(oracionesArr.length, palabras > 0 ? 1 : 0);
    const promedioPalabrasPorOracion = palabras > 0 ? Math.round((palabras / oraciones) * 10) / 10 : 0;

    let oracionesLargas = 0;
    for (const o of oracionesArr) {
        const nPal = (o.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/g) ?? []).length;
        if (nPal > 45) oracionesLargas++;
    }

    const penalizacionHallazgos = hallazgos.reduce(
        (acc, h) => acc + (h.severidad === 'error' ? 4 : h.severidad === 'aviso' ? 2 : 1),
        0,
    );
    const penalizacionExtension = oracionesLargas * 2;
    const puntajeCalidad = palabras === 0 ? 100 : Math.max(20, Math.min(100, 100 - penalizacionHallazgos - penalizacionExtension));

    const nivelClaridad: MetricasDocumento['nivelClaridad'] =
        puntajeCalidad >= 90
            ? 'Excelente'
            : puntajeCalidad >= 75
                ? 'Bueno'
                : puntajeCalidad >= 55
                    ? 'Mejorable'
                    : 'Complejo';

    return {
        palabras,
        caracteres,
        oraciones,
        parrafos: noVacios.length,
        promedioPalabrasPorOracion,
        oracionesLargas,
        puntajeCalidad,
        nivelClaridad,
    };
}
