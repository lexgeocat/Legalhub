// src/domain/redaccion/argumentacionForense.ts

export interface TipoArgumentoJuridico {
  numero: number;
  nombre: string;
  definicion: string;
  cuandoUsarlo: string;
  conectoresTipicos: string[];
  ejemplo: string;
}

export interface FalaciaJuridica {
  nombre: string;
  familia: string;
  definicion: string;
  preguntaControl: string;
  ejemploInvalido: string;
}

export const TIPOS_ARGUMENTOS_JURIDICOS: TipoArgumentoJuridico[] = [
  {
    numero: 1,
    nombre: 'Literal o Gramatical',
    definicion: 'Interpreta la norma según el sentido propio y natural de sus palabras en el lenguaje común o técnico-jurídico.',
    cuandoUsarlo: 'Cuando el texto de la ley es claro y no presenta ambigüedad.',
    conectoresTipicos: ['a tenor de', 'del tenor literal de', 'conforme al sentido propio de las palabras'],
    ejemplo: 'A tenor literal del artículo 452 del Código Civil, el consentimiento debe ser libre y expreso.',
  },
  {
    numero: 2,
    nombre: 'Sistemático',
    definicion: 'Interpreta la norma en armonía y coherencia con el conjunto del ordenamiento jurídico y los principios constitucionales.',
    cuandoUsarlo: 'Cuando una norma aislada parece contradecir otra disposición o derecho fundamental.',
    conectoresTipicos: ['de una lectura armónica', 'en concordancia con', 'en el marco del ordenamiento'],
    ejemplo: 'De una lectura armónica entre el Código Procesal y el art. 115 constitucional, el plazo no puede computarse en días inhábiles.',
  },
  {
    numero: 3,
    nombre: 'Teleológico (Finalista)',
    definicion: 'Atiende a los fines y objetivos sustanciales protegidos por el legislador (ratio legis).',
    cuandoUsarlo: 'Para evitar interpretaciones formalistas que frustren el bien jurídico tutelado.',
    conectoresTipicos: ['con miras a', 'en aras de', 'la finalidad perseguida por el precepto'],
    ejemplo: 'La conminatoria de reincorporación laboral persigue, con miras a la estabilidad, la subsistencia inmediata del trabajador.',
  },
  {
    numero: 4,
    nombre: 'A contrario sensu (Sentido Contrario)',
    definicion: 'Deduce que si la ley atribuye una consecuencia a un supuesto expreso, no se aplica al supuesto opuesto.',
    cuandoUsarlo: 'Para delimitar taxativamente facultades regladas o requisitos excluyentes.',
    conectoresTipicos: ['a contrario sensu', 'por el contrario', 'se colige en sentido opuesto'],
    ejemplo: 'Si la nulidad solo procede por causal expresa en la ley, a contrario sensu no puede decretarse nulidad por mera discrepancia de forma.',
  },
  {
    numero: 5,
    nombre: 'A fortiori (Con Mayor Razón)',
    definicion: 'Si el precepto alcanza a la situación menor (o mayor), con mayor razón forzosa debe alcanzar a la otra.',
    cuandoUsarlo: 'Para extender una protección o prohibición cuando la gravedad del caso lo exige.',
    conectoresTipicos: ['con mayor razón', 'a fortiori', 'a mayor abundamiento'],
    ejemplo: 'Si el juez no puede rechazar una demanda formal sin conminatoria previa de subsanación, a fortiori no puede rechazarla in límine por cuestiones de fondo.',
  },
  {
    numero: 6,
    nombre: 'Por Analogía (A pari / A simili)',
    definicion: 'Aplica la solución de un caso regulado a otro no previsto cuando existe idéntica razón fundamental.',
    cuandoUsarlo: 'Ante lagunas normativas donde concurre la misma razón jurídica (ubi eadem ratio, ibi eadem iuris dispositio).',
    conectoresTipicos: ['por analogía', 'en idéntico sentido', 'en razón de similar naturaleza'],
    ejemplo: 'Ante el vacío adjetivo en el trámite cautelar voluntario, procede aplicar por analogía las normas del proceso monitorio.',
  },
  {
    numero: 7,
    nombre: 'Reducción al Absurdo (Ad absurdum)',
    definicion: 'Demuestra que la interpretación pretendida por la contraparte conduce a un resultado ilógico, inicuo o impracticable.',
    cuandoUsarlo: 'Para demoler tesis forzadas del adversario exponiendo sus consecuencias absurdas.',
    conectoresTipicos: ['de aceptarse dicha tesis', 'conduciría al absurdo de', 'resultaría jurídicamente insostenible'],
    ejemplo: 'De aceptarse la postura del demandado, se llegaría al absurdo de permitir que el deudor elija cuándo empezar a computar su propia prescripción.',
  },
  {
    numero: 8,
    nombre: 'De Precedente Vinculante (Jurisprudencial)',
    definicion: 'Funda la pretensión en la ratio decidendi obligatoria emanada de los tribunales de cierre (TCP o TSJ).',
    cuandoUsarlo: 'Para acreditar que la interpretación invocada ya constituye doctrina legal uniforme.',
    conectoresTipicos: ['conforme a la línea jurisprudencial uniforme', 'siguiendo el precedente vinculante', 'según la subregla sentada en'],
    ejemplo: 'Conforme al precedente vinculante sentado en la SCP 0012/2021, la falta de motivación vulnera directamente la garantía del debido proceso.',
  },
  {
    numero: 9,
    nombre: 'De Autoridad (Doctrinal)',
    definicion: 'Se apoya en la doctrina jurídica autorizada y el consenso de la dogmática contemporánea.',
    cuandoUsarlo: 'Para esclarecer institutos complejos, lagunas o la naturaleza jurídica de un contrato.',
    conectoresTipicos: ['la doctrina autorizada coincide en que', 'en palabras del tratadista', 'conforme a la dogmática jurídica'],
    ejemplo: 'Como enseña la doctrina procesal clásica, la legitimación pasiva constituye un presupuesto de fondo indispensable para trabar la litis.',
  },
  {
    numero: 10,
    nombre: 'Principialista / Constitucional',
    definicion: 'Invoca principios generales del derecho o valores supremos (buena fe, tutela judicial efectiva, pro persona).',
    cuandoUsarlo: 'Cuando la ley formal genera una injusticia notoria o desprotección arbitraria.',
    conectoresTipicos: ['al amparo del principio de', 'en resguardo de la garantía de', 'haciendo prevalecer el principio pro homine'],
    ejemplo: 'Al amparo del principio de verdad material consagrado en el art. 180 constitucional, la forma procesal debe supeditarse a la justicia sustantiva.',
  },
];

export const FALACIAS_JURIDICAS: FalaciaJuridica[] = [
  {
    nombre: 'Ad Hominem (Ataque personal)',
    familia: 'De relevancia',
    definicion: 'Atacar la conducta, moral o profesión del abogado o de la parte en lugar de refutar los argumentos jurídicos.',
    preguntaControl: '¿Estoy desvirtuando la norma y la prueba, o solo desacreditando a la persona?',
    ejemploInvalido: '«El demandante no tiene solvencia moral para reclamar, puesto que se dedica a actividades dudosas».',
  },
  {
    nombre: 'Hombre de Paja (Caricaturización)',
    familia: 'De relevancia',
    definicion: 'Distorsionar o exagerar la postura del adversario para atacarla con mayor facilidad.',
    preguntaControl: '¿Estoy respondiendo a lo que la contraparte realmente afirmó en su memorial?',
    ejemploInvalido: '«El demandado pretende que ningún ciudadano pague jamás sus deudas bancarias en el país».',
  },
  {
    nombre: 'Petición de Principio (Círculo vicioso)',
    familia: 'De presunción',
    definicion: 'Dar por demostrado en la premisa lo que precisamente se debe probar en la conclusión.',
    preguntaControl: '¿Aporté prueba del hecho controvertido o simplemente lo repetí con otras palabras?',
    ejemploInvalido: '«El documento es falso porque fue redactado falsamente por personas que mienten».',
  },
  {
    nombre: 'Falsa Causa (Post hoc ergo propter hoc)',
    familia: 'De causalidad',
    definicion: 'Asumir que porque un hecho ocurrió después de otro, fue necesariamente causado por él.',
    preguntaControl: '¿Acredité el nexo causal técnico o pericial entre la conducta y el daño sufrido?',
    ejemploInvalido: '«El contrato se firmó en mayo y la empresa quebró en junio, ergo el contrato quebró a la empresa».',
  },
  {
    nombre: 'Falso Dilema (Falsa dicotomía)',
    familia: 'De presunción',
    definicion: 'Presentar dos opciones extremas como las únicas posibles ignorando alternativas procesales válidas.',
    preguntaControl: '¿Existen otras salidas legales, excepciones o interpretaciones intermedias?',
    ejemploInvalido: '«O se declara la nulidad total de la escritura pública, o se avala el fraude procesal».',
  },
  {
    nombre: 'Apelación a la Autoridad Indebida (Ad verecundiam)',
    familia: 'De autoridad',
    definicion: 'Citar opiniones de tratadistas o jurisprudencia no vinculante de otra materia que no aplican al caso concreto.',
    preguntaControl: '¿El precedente o autor citado resuelve verdaderamente el supuesto de hecho debatido?',
    ejemploInvalido: '«Como afirmó un célebre economista en su blog, este contrato vulnera la legislación civil».',
  },
];
