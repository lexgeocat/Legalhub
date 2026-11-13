// src/domain/redaccion/vocabularioForense.ts

export interface EquivalenciaColoquial {
  coloquial: string;
  sugerenciasFormale: string[];
  contexto: string;
}

export interface LatinismoJuridico {
  latinismo: string;
  traduccion: string;
  significadoForense: string;
  ejemplo: string;
  requiereCursiva: boolean;
}

export const EQUIVALENCIAS_COLOQUIALES: EquivalenciaColoquial[] = [
  {
    coloquial: 'pelea / pleito informal',
    sugerenciasFormale: ['litis', 'controversia', 'contienda judicial', 'conflicto de intereses'],
    contexto: 'Al referirse al litigio entre las partes.',
  },
  {
    coloquial: 'hacer caso',
    sugerenciasFormale: ['dar estricto cumplimiento', 'acatar', 'obedecer el mandato judicial'],
    contexto: 'Al referirse a resoluciones o mandamientos.',
  },
  {
    coloquial: 'pedir',
    sugerenciasFormale: ['impetrar', 'peticionar', 'solicitar respetuosamente', 'demandar en justicia'],
    contexto: 'En petitorios y solicitudes de fondo.',
  },
  {
    coloquial: 'dar la razón',
    sugerenciasFormale: ['acoger la pretensión', 'declarar probada la demanda', 'conceder la tutela'],
    contexto: 'Al solicitar la sentencia estimatoria.',
  },
  {
    coloquial: 'tener que',
    sugerenciasFormale: ['corresponder en estricto derecho', 'devenir en imperativo legal', 'hallarse constreñido a'],
    contexto: 'Obligaciones procesales o normativas.',
  },
  {
    coloquial: 'cosa',
    sugerenciasFormale: ['bien litigioso', 'objeto de la pretensión', 'materia controvertida', 'instituto jurídico'],
    contexto: 'Sustantivo vago en alegatos jurídicos.',
  },
  {
    coloquial: 'echar la culpa',
    sugerenciasFormale: ['atribuir responsabilidad civil/penal', 'imputar dolo o culpa', 'endilgar el incumplimiento'],
    contexto: 'Al fundamentar la culpa del adversario.',
  },
  {
    coloquial: 'plata / dinero',
    sugerenciasFormale: ['monto adeudado', 'capital litigioso', 'acreencia dineraria', 'prestación patrimonial'],
    contexto: 'En demandas ejecutivas o coactivas.',
  },
  {
    coloquial: 'papeles',
    sugerenciasFormale: ['prueba instrumental', 'cuaderno procesal', 'actuados judiciales', 'antecedentes fácticos'],
    contexto: 'Al citar documentos del proceso.',
  },
  {
    coloquial: 'mentira',
    sugerenciasFormale: ['extremo desvirtuado', 'afirmación carente de veracidad', 'postura palmariamente falsa'],
    contexto: 'Al refutar alegatos contrarios sin usar lenguaje ofensivo.',
  },
  {
    coloquial: 'por culpa de',
    sugerenciasFormale: ['a consecuencia de', 'a causa de', 'en virtud del hecho lesivo de'],
    contexto: 'Nexo causal del daño.',
  },
];

export const LATINISMOS_JURIDICOS: LatinismoJuridico[] = [
  {
    latinismo: 'a contrario sensu',
    traduccion: 'En sentido contrario',
    significadoForense: 'Argumento lógico por el cual la regulación de un caso excluye válidamente la solución opuesta para los demás.',
    ejemplo: 'Si la ley reserva la apelación solo a la sentencia, a contrario sensu el auto de mero trámite no es apelable.',
    requiereCursiva: true,
  },
  {
    latinismo: 'a fortiori',
    traduccion: 'Con mayor razón',
    significadoForense: 'Argumento que concluye que si una norma se aplica a un caso leve o menor, con mucha mayor fuerza debe aplicarse a un caso grave.',
    ejemplo: 'Si el juez tiene facultad para anular obrados, a fortiori puede conceder un plazo adicional para sanear el defecto.',
    requiereCursiva: true,
  },
  {
    latinismo: 'in dubio pro reo',
    traduccion: 'En caso de duda, a favor del procesado',
    significadoForense: 'Principio garantista que obliga a absolver cuando la prueba de cargo no alcanza convicción plena.',
    ejemplo: 'Al no existir certeza probatoria sobre la autoría, en aplicación del in dubio pro reo corresponde la absolución.',
    requiereCursiva: true,
  },
  {
    latinismo: 'onus probandi',
    traduccion: 'Carga de la prueba',
    significadoForense: 'Obligación procesal que pesa sobre quien afirma un hecho para demostrarlo válidamente en juicio.',
    ejemplo: 'El actor no relevó el onus probandi que le impone el código procesal respecto al daño reclamado.',
    requiereCursiva: true,
  },
  {
    latinismo: 'prima facie',
    traduccion: 'A primera vista',
    significadoForense: 'Apreciación inicial o provisional de una pretensión o verosimilitud del derecho antes de entrar al fondo.',
    ejemplo: 'El título ejecutivo presentado acredita prima facie la liquidez y exigibilidad de la obligación.',
    requiereCursiva: true,
  },
  {
    latinismo: 'mutatis mutandis',
    traduccion: 'Cambiando lo que se deba cambiar',
    significadoForense: 'Fórmula para aplicar un razonamiento, precedente o norma a una situación similar con las adaptaciones precisas.',
    ejemplo: 'La doctrina sentada para la rescisión contractual es aplicable, mutatis mutandis, a la resolución por incumplimiento.',
    requiereCursiva: true,
  },
  {
    latinismo: 'fumus boni iuris',
    traduccion: 'Humo de buen derecho / Apariencia de derecho',
    significadoForense: 'Presupuesto imprescindible para solicitar medidas cautelares o precautorias.',
    ejemplo: 'Se justifica la anotación preventiva toda vez que se halla plenamente acreditado el fumus boni iuris.',
    requiereCursiva: true,
  },
  {
    latinismo: 'periculum in mora',
    traduccion: 'Peligro en la demora',
    significadoForense: 'Riesgo inminente de que el paso del tiempo torne ineficaz la sentencia futura.',
    ejemplo: 'El periculum in mora se acredita ante la evidente disposición de bienes que realiza el deudor demandado.',
    requiereCursiva: true,
  },
  {
    latinismo: 'thema decidendum',
    traduccion: 'Materia o tema a decidir',
    significadoForense: 'Delimitación exacta de los puntos en controversia sobre los cuales el juez debe pronunciarse.',
    ejemplo: 'El thema decidendum en apelación queda estrictamente restringido a los puntos expuestos en el memorial de agravios.',
    requiereCursiva: true,
  },
  {
    latinismo: 'non bis in idem',
    traduccion: 'No dos veces por lo mismo',
    significadoForense: 'Prohibición constitucional de juzgar o sancionar a una persona dos veces por los mismos hechos, sujeto y fundamento.',
    ejemplo: 'Habiendo recaído sobreseimiento ejecutoriado, la reapertura del proceso infringe la garantía del non bis in idem.',
    requiereCursiva: true,
  },
  {
    latinismo: 'iura novit curia',
    traduccion: 'El juez conoce el derecho',
    significadoForense: 'Facultad del juzgador de calificar jurídicamente los hechos aun cuando las partes hayan invocado normas erróneas.',
    ejemplo: 'En mérito al principio iura novit curia, corresponde al tribunal aplicar la norma sustantiva pertinente a los hechos alegados.',
    requiereCursiva: true,
  },
];
