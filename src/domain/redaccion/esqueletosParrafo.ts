// src/domain/redaccion/esqueletosParrafo.ts

export interface EsqueletoParrafo {
  id: string;
  nombre: string;
  objetivo: string;
  estructura: string[];
  plantillaTexto: string;
  conectoresSugeridos: string[];
  ejemploAplicado: string;
}

export const ESQUELETOS_PARRAFO: EsqueletoParrafo[] = [
  {
    id: 'subsuncion-juridica',
    nombre: 'Silogismo de Subsunción (Norma - Hecho - Conclusión)',
    objetivo: 'Articular la premisa mayor legal con la premisa menor fáctica para deducir la consecuencia jurídica obligatoria.',
    estructura: [
      '1. Premisa Mayor: Invocación de la norma o precepto legal aplicable.',
      '2. Premisa Menor: Relación fáctica del hecho probado en el caso concreto.',
      '3. Subsunción: Explicación de cómo el hecho encuadra exactamente en el tipo legal.',
      '4. Conclusión: Deducción de la consecuencia jurídica solicitada.',
    ],
    plantillaTexto:
      'Al amparo de lo dispuesto por el artículo [NÚMERO DE ARTÍCULO Y NORMA], que establece que [DESCRIPCIÓN DEL MANDATO LEGAL]; en la especie, se constata que [RELATO CONCRETO DEL HECHO ACREDITADO]; en consecuencia, al concurrir plenamente los presupuestos fácticos exigidos por la norma invocada, forzoso es concluir que [CONSECUENCIA JURÍDICA / PETITORIO].',
    conectoresSugeridos: ['Al amparo de', 'En la especie', 'Por consiguiente', 'Forzoso es concluir que'],
    ejemploAplicado:
      'Al amparo de lo dispuesto por el artículo 1286 del Código Civil, que otorga plena eficacia probatoria a los documentos públicos; en la especie, cursa a fojas 15 testimonio notarial de compraventa no tachado de falso; en consecuencia, al haberse acreditado la transferencia patrimonial, forzoso es declarar probada la tercería de dominio excluyente.',
  },
  {
    id: 'argumentativo-peel',
    nombre: 'Argumentativo PEEL (Punto - Evidencia - Explicación - Enlace)',
    objetivo: 'Construir un argumento hermético donde una afirmación fáctica esté respaldada por prueba fehaciente.',
    estructura: [
      '1. Point (Punto central): Tesis o afirmación concreta.',
      '2. Evidence (Evidencia): Documento, pericia o actuación que lo demuestra.',
      '3. Explanation (Explicación): Análisis crítico del porqué la prueba es concluyente.',
      '4. Link (Enlace): Conexión directa con la pretensión demandada.',
    ],
    plantillaTexto:
      'Resulta palmario e inconcuso que [AFIRMACIÓN CONCRETA]. En efecto, [CITA EXACTA DE LA PRUEBA / FOJAS] acredita de manera inequívoca que [CONTENIDO PROBATORIO]. Lo anterior cobra vital relevancia procesal toda vez que [EXPLICACIÓN DEL VALOR PROBATORIO FRENTE AL CONFLICTO]. De ahí que corresponda [PETICIÓN DIRECTA ENLAZADA].',
    conectoresSugeridos: ['Resulta palmario que', 'En efecto', 'Lo anterior cobra relevancia toda vez que', 'De ahí que'],
    ejemploAplicado:
      'Resulta palmario e inconcuso que la demandada incurrió en mora culpable. En efecto, la carta notariada de intimación cursante a fojas 22 acredita de manera inequívoca la conminatoria practicada en fecha 10 de marzo de 2026. Lo anterior cobra vital relevancia procesal toda vez que vencido el plazo legal jamás se efectivizó el pago comprometido. De ahí que corresponda declarar la resolución culpable del contrato con costas.',
  },
  {
    id: 'narrativo-hechos',
    nombre: 'Narrativa Fáctica Circunstanciada (Tiempo - Hecho - Consecuencia - Prueba)',
    objetivo: 'Relatar los antecedentes fácticos con rigor procesal evitando subjetividades o divagaciones.',
    estructura: [
      '1. Coordenada temporal y de lugar.',
      '2. Acción o hecho jurídicamente relevante.',
      '3. Efecto o daño producido.',
      '4. Remisión formal al medio probatorio de respaldo.',
    ],
    plantillaTexto:
      'Es el caso, Señor Juez, que en fecha [FECHA Y LUGAR], [DESCRIPCIÓN DEL ACTO O NEGOCIO JURÍDICO]. Posteriormente, [CONDUCTA O INCUMPLIMIENTO SUSCITADO], circunstancia que generó [PERJUICIO O LESIÓN AL DERECHO SUBJETIVO], tal como se acredita fehacientemente mediante [PRUEBA DOCUMENTAL DE FOJAS ...].',
    conectoresSugeridos: ['Es el caso que en fecha', 'Posteriormente', 'Circunstancia que generó', 'Tal como se acredita'],
    ejemploAplicado:
      'Es el caso, Señor Juez, que en fecha 12 de enero de 2025, el demandante entregó en calidad de depósito comercial mercadería por valor de $us. 20.000. Posteriormente, mediando requerimiento formal de restitución, la parte demandada se negó injustificadamente a devolver los bienes, circunstancia que ocasionó una lesión patrimonial directa, tal como se acredita fehacientemente mediante acta de recepción cursante a fojas 8.',
  },
  {
    id: 'refutacion-dialectica',
    nombre: 'Refutación y Desvirtuación de Alegatos Contrarios',
    objetivo: 'Demoler las excepciones o argumentos de la contraparte exponiendo su falta de sustento fáctico y normativo.',
    estructura: [
      '1. Resumen fiel de la tesis contraria.',
      '2. Concesión dialéctica o rechazo tajante.',
      '3. Demostración de la inconsistencia o contradicción.',
      '4. Desestimación formal del extremo alegado.',
    ],
    plantillaTexto:
      'Contrariamente a lo argüido por la parte adversa respecto a [TESIS O EXCEPCIÓN CONTRARIA]; cabe puntualizar que dicha postura carece por completo de asidero fáctico y legal. En efecto, aun en el supuesto jamás consentido de admitir [ALEGATO ADVERSO], [PRUEBA O PRECEPTO LEGAL QUE LO INVALIDA]. Por consiguiente, el argumento esgrimido deviene en manifiestamente infundado.',
    conectoresSugeridos: ['Contrariamente a lo argüido', 'Careciendo de asidero', 'En el supuesto jamás consentido', 'Deviene en infundado'],
    ejemploAplicado:
      'Contrariamente a lo argüido por la parte adversa respecto a la supuesta prescripción extintiva de la acción; cabe puntualizar que dicha postura carece de asidero fáctico y legal. En efecto, aun en el supuesto jamás consentido de computar el plazo originario, cursa a fojas 35 reconocimiento expreso de deuda que interrumpió el término prescriptivo. Por consiguiente, la excepción previa debe ser desestimada en el fondo.',
  },
  {
    id: 'transicion-agravios',
    nombre: 'Transición Estructural de Agravios (Recursos y Memoriales)',
    objetivo: 'Cerrar un punto impugnado y abrir el siguiente con orden y numeración precisa.',
    estructura: [
      '1. Síntesis resolutiva del primer punto de agravio.',
      '2. Conector de transición y orden secuencial.',
      '3. Enunciación clara del segundo agravio o vulneración.',
    ],
    plantillaTexto:
      'Conforme a los fundamentos precedentemente desarrollados, queda plenamente acreditado el primer agravio relativo a [TEMA DEL AGRAVIO RESUELTO]. Acto seguido, en un segundo orden de ideas, corresponde formular el segundo motivo de impugnación, consistente en [ENUNCIACIÓN DEL SEGUNDO AGRAVIO].',
    conectoresSugeridos: ['Queda acreditado que', 'Acto seguido', 'En un segundo orden de ideas', 'Corresponde examinar'],
    ejemploAplicado:
      'Conforme a los fundamentos precedentemente desarrollados, queda plenamente acreditado el primer agravio relativo a la vulneración del derecho a la defensa. Acto seguido, en un segundo orden de ideas, corresponde formular el segundo motivo de impugnación, consistente en la incongruencia omisiva del fallo de alzada.',
  },
];
