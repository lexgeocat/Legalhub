// src/application/ai/groundingLeyes.ts
import type { Ley, Leyes } from '../casosDeUso/leyes';
import type { NodoArbol } from '../../domain/leyes/leyes';
import type { ArticuloContexto } from './proveedoresIa';

/** Leyes base de referencia procesal para grounding jurídico */
export const LEYES_MUESTRA_DEFAULT: {
  id: string;
  nombre: string;
  tipo: string;
  norma: string;
  numArticulos: number;
  articulosClave: { numero: string; titulo: string; texto: string }[];
}[] = [
  {
    id: 'muestra-cc',
    nombre: 'Código Civil (Decreto Ley N° 12760)',
    tipo: 'código',
    norma: 'Decreto Ley 12760',
    numArticulos: 1570,
    articulosClave: [
      {
        numero: '450',
        titulo: 'Noción del contrato',
        texto:
          'Hay contrato cuando dos o más personas se ponen de acuerdo para constituir, modificar o extinguir entre sí una relación jurídica patrimonial.'
      },
      {
        numero: '452',
        titulo: 'Requisitos del contrato',
        texto:
          'Son requisitos para la formación del contrato: 1) El consentimiento de las partes; 2) El objeto; 3) La causa; 4) La forma, siempre que sea legalmente exigible.'
      },
      {
        numero: '519',
        titulo: 'Eficacia del contrato',
        texto:
          'El contrato tiene fuerza de ley entre las partes contratantes. No puede ser disuelto sino por consentimiento mutuo o por las causas autorizadas por la ley.'
      },
      {
        numero: '520',
        titulo: 'Ejecución de buena fe e integración',
        texto:
          'El contrato debe ser ejecutado de buena fe y obliga no sólo a lo que en él se ha expresado, sino también a todos los efectos que se deriven conforme a su naturaleza, según la ley, los usos y la equidad.'
      },
      {
        numero: '537',
        titulo: 'Seña o arras confirmatorias',
        texto:
          'La suma de dinero o de cosas fungibles que como seña o arras se entrega por uno de los contratantes al otro, en caso de cumplimiento del contrato, debe ser devuelta o imputada a la prestación debida. Si la parte que dio las arras no cumple, la otra puede rescindir el contrato reteniendo las arras; y si quien las recibió incumple, la otra puede exigir el doble.'
      },
      {
        numero: '538',
        titulo: 'Arras penitenciales',
        texto:
          'Cuando en el contrato se hubiere reservado expresamente el derecho de rescisión mediante la entrega de arras, el contratante que las dio las pierde si rescinde el contrato; y el que las recibió debe devolver el doble.'
      },
      {
        numero: '568',
        titulo: 'Resolución por incumplimiento',
        texto:
          'En los contratos con prestaciones recíprocas, cuando una de las partes no cumple su obligación, la otra puede pedir a su elección el cumplimiento o la resolución del contrato, más el resarcimiento del daño.'
      },
      {
        numero: '584',
        titulo: 'Noción de la venta',
        texto:
          'La venta es un contrato por el cual el vendedor transfiere la propiedad de una cosa o un derecho al comprador por un precio en dinero.'
      },
      {
        numero: '614',
        titulo: 'Obligaciones del vendedor',
        texto:
          'El vendedor tiene las obligaciones principales de: 1) Entregar la cosa vendida; 2) Hacer adquirir la propiedad al comprador; 3) Responder por la evicción y los vicios ocultos de la cosa.'
      },
      {
        numero: '685',
        titulo: 'Noción del arrendamiento',
        texto:
          'El arrendamiento es el contrato por el cual una de las partes concede a la otra el uso o goce temporal de una cosa mueble o inmueble a cambio de un canon o merced conductiva en dinero.'
      },
      {
        numero: '984',
        titulo: 'Resarcimiento por hecho ilícito',
        texto:
          'Quien con un hecho doloso o culposo ocasiona a alguien un daño injusto, queda obligado al resarcimiento conforme a ley.'
      },
      {
        numero: '1492',
        titulo: 'Efecto extintivo de la prescripción',
        texto:
          'Los derechos se extinguen por la prescripción cuando su titular no los ejerce durante el tiempo fijado por la ley. Se salva los derechos indisponibles y los otros que la ley determine.'
      },
      {
        numero: '1507',
        titulo: 'Prescripción de cinco años',
        texto:
          'Los derechos patrimoniales se extinguen por la prescripción en el plazo de cinco años, salvo los casos para los cuales la ley dispone plazos más breves.'
      }
    ]
  },
  {
    id: 'muestra-cpc',
    nombre: 'Código Procesal Civil (Ley N° 439)',
    tipo: 'código',
    norma: 'Ley 439',
    numArticulos: 510,
    articulosClave: [
      {
        numero: '110',
        titulo: 'Forma y contenido de la demanda',
        texto:
          'La demanda será escrita, salvo disposición expresa en contrario, y señalará: 1) La designación de la autoridad judicial; 2) Nombre, domicilio y generales del demandante; 3) Nombre y domicilio del demandado; 4) El bien demandado; 5) Los hechos; 6) El derecho expuesto sucintamente; 7) La cuantía; 8) La petición en términos claros y positivos.'
      },
      {
        numero: '111',
        titulo: 'Prueba con la demanda',
        texto:
          'Se acompañará a la demanda la prueba documental relativa a la pretensión. Si no se tuviere a disposición, se indicará el lugar donde se encuentre.'
      },
      {
        numero: '125',
        titulo: 'Contestación a la demanda',
        texto:
          'La parte demandada contestará la demanda en el plazo establecido, pronunciándose sobre los hechos alegados y oponiendo todas las excepciones previas y perentorias que tuviere a su favor.'
      },
      {
        numero: '127',
        titulo: 'Excepciones previas',
        texto:
          'Son excepciones previas admisibles: 1) Incompetencia; 2) Incapacidad de la parte o personería insuficiente; 3) Litispendencia; 4) Demanda defectuosa; 5) Citación previa al garante de evicción; 6) Cosa juzgada; 7) Transacción; 8) Prescripción cuando pudiere resolverse de puro derecho.'
      },
      {
        numero: '250',
        titulo: 'Procedencia del recurso de apelación',
        texto:
          'El recurso de apelación procede contra las sentencias, autos definitivos y autos interlocutorios que causen gravamen irreparable en los plazos y formas previstos por este Código.'
      },
      {
        numero: '311',
        titulo: 'Procedencia de medidas cautelares',
        texto:
          'Las medidas cautelares podrán ser solicitadas antes o durante el proceso principal. Requieren acreditar la verosimilitud del derecho invocado (fumus boni iuris) y el peligro de perjuicio por la demora (periculum in mora).'
      },
      {
        numero: '325',
        titulo: 'Embargo preventivo y retención',
        texto:
          'Podrá pedir el embargo preventivo o la retención de fondos bancarios y cuentas el acreedor de deuda en dinero o en especie computable en dinero, siempre que justifique sumariamente su crédito.'
      },
      {
        numero: '375',
        titulo: 'Proceso ejecutivo y títulos ejecutivos',
        texto:
          'El proceso ejecutivo procede para el cobro de dinero líquido, exigible y de plazo vencido que conste en título ejecutivo auténtico: documentos públicos, privados reconocidos o pagarés y letras de cambio.'
      },
      {
        numero: '392',
        titulo: 'Régimen del proceso de desalojo',
        texto:
          'El proceso de desalojo en régimen de libre contratación procede por fenecimiento de contrato de arrendamiento o falta de pago de cánones de alquiler pactados, sustanciándose en la vía ordinaria o sumaria según corresponda.'
      }
    ]
  },
  {
    id: 'muestra-lgt',
    nombre: 'Ley General del Trabajo',
    tipo: 'ley',
    norma: 'Ley de 8 de Diciembre de 1942',
    numArticulos: 122,
    articulosClave: [
      {
        numero: '12',
        titulo: 'Contrato de trabajo y preaviso',
        texto:
          'El contrato de trabajo puede pactarse por tiempo indefinido, cierto tiempo o realización de obra o servicio. No podrá rescindirse sin aviso previo con la anticipación legal correspondiente.'
      },
      {
        numero: '13',
        titulo: 'Indemnización por retiro forzoso',
        texto:
          'Cuando fuere retirado el empleado u obrero por causal ajena a su voluntad, el patrono estará obligado a indemnizarle con un mes de sueldo por cada año de trabajo continuo, y en caso de servicios menores a un año, en forma duodecimal.'
      },
      {
        numero: '16',
        titulo: 'Causales de despido justificado',
        texto:
          'No habrá lugar a desahucio ni indemnización cuando exista perjuicio material causado con intención, revelación de secretos industriales, inasistencia injustificada de más de seis días continuos o incumplimiento total del contrato.'
      },
      {
        numero: '41',
        titulo: 'Jornada laboral y horas extraordinarias',
        texto:
          'La jornada efectiva de trabajo no excederá de 8 horas por día y de 48 por semana. El trabajo nocturno no excederá de 7 horas. Las horas extraordinarias se remunerarán con el 100% de recargo.'
      }
    ]
  }
];

const STOPWORDS_JURIDICAS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una',
  'su', 'al', 'lo', 'como', 'más', 'mas', 'pero', 'sus', 'le', 'ya', 'o', 'fue', 'este', 'ha', 'si', 'porque',
  'esta', 'son', 'entre', 'está', 'esta', 'cuando', 'muy', 'sin', 'sobre', 'ser', 'tiene', 'también', 'tambien',
  'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni',
  'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'mi', 'antes', 'algunos', 'qué', 'que',
  'dice', 'dime', 'explica', 'redacta', 'haz', 'quiero', 'favor', 'articulo', 'articulos', 'art', 'arts',
  'acerca', 'podrias', 'puedes', 'hacer', 'redactar', 'necesito', 'analiza', 'investiga', 'consulta'
]);

export interface ResultadoGrounding {
  articulos: ArticuloContexto[];
  leyesNombres: string[];
  terminosBuscados: string[];
}

/**
 * Investiga automáticamente y recopila los artículos más relevantes de las leyes seleccionadas
 * para fundamentar la respuesta de la IA (NotebookLM Legal Grounding).
 */
export async function recopilarGroundingLeyes(
  servicios: { leyes: Leyes },
  leyesSeleccionadasIds: Set<string>,
  textoConsulta: string,
  leyesDisponibles: Ley[]
): Promise<ResultadoGrounding> {
  const articulos: ArticuloContexto[] = [];
  const leyesNombres: string[] = [];
  const articulosDetectados = new Set<string>();

  // 1. Detectar números de artículo solicitados explícitamente (ej: "art. 568", "artículo 110", "art 24", "1283")
  const numerosExplicitos: string[] = [];
  const regexArt = /(?:arts?\.?|art[íi]culos?)\s*(\d{1,5}(?:\s*(?:bis|ter|qu[aá]ter))?)/gi;
  let mArt;
  while ((mArt = regexArt.exec(textoConsulta)) !== null) {
    const num = mArt[1].trim();
    if (!numerosExplicitos.includes(num)) numerosExplicitos.push(num);
  }

  // Detectar también números de 2 a 4 dígitos sueltos en el texto si no fueron capturados
  const regexNum = /\b(\d{2,4})\b/g;
  let mNum;
  while ((mNum = regexNum.exec(textoConsulta)) !== null) {
    if (!numerosExplicitos.includes(mNum[1])) numerosExplicitos.push(mNum[1]);
  }

  // 2. Extraer términos sustantivos de búsqueda (sin stopwords)
  const palabrasCrudas = textoConsulta
    .toLowerCase()
    .replace(/[^a-záéíóúñ0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS_JURIDICAS.has(w));

  const terminosBuscados = [...numerosExplicitos, ...palabrasCrudas].slice(0, 8);

  // Mapear leyes de muestra por id
  const mapaMuestras = new Map(LEYES_MUESTRA_DEFAULT.map((m) => [m.id, m]));

  for (const ley of leyesDisponibles) {
    if (!leyesSeleccionadasIds.has(ley.id)) continue;
    if (!leyesNombres.includes(ley.nombre)) leyesNombres.push(ley.nombre);

    // Caso A: Ley de Muestra Pre-cargada
    if (mapaMuestras.has(ley.id)) {
      const muestra = mapaMuestras.get(ley.id)!;
      let articulosElegidos: typeof muestra.articulosClave = [];

      // A1. Coincidencia exacta por número de artículo
      if (numerosExplicitos.length > 0) {
        articulosElegidos.push(
          ...muestra.articulosClave.filter((a) => numerosExplicitos.includes(a.numero))
        );
      }

      // A2. Coincidencia por términos clave en título o texto del artículo
      if (palabrasCrudas.length > 0) {
        const porPalabras = muestra.articulosClave.filter((a) => {
          const contenido = `${a.numero} ${a.titulo} ${a.texto}`.toLowerCase();
          return palabrasCrudas.some((p) => contenido.includes(p));
        });
        for (const art of porPalabras) {
          if (!articulosElegidos.some((e) => e.numero === art.numero)) {
            articulosElegidos.push(art);
          }
        }
      }

      // A3. Si no hubo coincidencia específica, proveer los 3 artículos fundamentales de la ley
      if (articulosElegidos.length === 0) {
        articulosElegidos = muestra.articulosClave.slice(0, 3);
      }

      // Agregar a la lista de contexto (máximo 4 por ley de muestra)
      for (const art of articulosElegidos.slice(0, 4)) {
        const claveUnica = `${ley.nombre}-art-${art.numero}`;
        if (!articulosDetectados.has(claveUnica)) {
          articulosDetectados.add(claveUnica);
          articulos.push({
            leyNombre: ley.nombre,
            numero: art.numero,
            titulo: art.titulo,
            texto: art.texto
          });
        }
      }
      continue;
    }

    // Caso B: Ley Real almacenada en SQLite (PDF subido y parseado)
    try {
      const nodosEncontrados: { id: string; numero: string; titulo: string }[] = [];
      const nodosIds = new Set<string>();

      // B1. Búsqueda directa de números de artículo solicitados
      for (const num of numerosExplicitos) {
        const res = await servicios.leyes.buscar(num, ley.id, 4);
        for (const r of res) {
          if (!nodosIds.has(r.id)) {
            nodosIds.add(r.id);
            nodosEncontrados.push({ id: r.id, numero: r.numero, titulo: r.titulo });
          }
        }
      }

      // B2. Búsqueda por frase sustantiva o palabras clave
      if (palabrasCrudas.length > 0) {
        const fraseCompuesta = palabrasCrudas.slice(0, 3).join(' ');
        const resFrase = await servicios.leyes.buscar(fraseCompuesta, ley.id, 5);
        for (const r of resFrase) {
          if (!nodosIds.has(r.id)) {
            nodosIds.add(r.id);
            nodosEncontrados.push({ id: r.id, numero: r.numero, titulo: r.titulo });
          }
        }

        // Si tenemos pocos resultados, buscar términos clave individuales
        if (nodosEncontrados.length < 3) {
          for (const pal of palabrasCrudas.slice(0, 4)) {
            if (nodosEncontrados.length >= 6) break;
            const resPal = await servicios.leyes.buscar(pal, ley.id, 3);
            for (const r of resPal) {
              if (!nodosIds.has(r.id)) {
                nodosIds.add(r.id);
                nodosEncontrados.push({ id: r.id, numero: r.numero, titulo: r.titulo });
              }
            }
          }
        }
      }

      // B3. Fallback: Si no hubo coincidencias de búsqueda, tomar los primeros artículos indexados
      if (nodosEncontrados.length === 0) {
        const arbol = await servicios.leyes.nodos(ley.id);
        const arts = arbol.filter((n: NodoArbol) => n.nivel === 'articulo').slice(0, 3);
        for (const a of arts) {
          nodosEncontrados.push({ id: a.id, numero: a.numero, titulo: a.titulo });
        }
      }

      // B4. Recuperar el texto íntegro de cada artículo (hasta 1200 caracteres para análisis profundo)
      for (const nodo of nodosEncontrados.slice(0, 5)) {
        const detalle = await servicios.leyes.obtenerNodo(nodo.id);
        if (detalle && detalle.texto) {
          const claveUnica = `${ley.nombre}-art-${detalle.numero}`;
          if (!articulosDetectados.has(claveUnica)) {
            articulosDetectados.add(claveUnica);
            articulos.push({
              leyNombre: ley.nombre,
              numero: detalle.numero,
              titulo: detalle.titulo,
              texto: detalle.texto.trim().slice(0, 1200)
            });
          }
        }
      }
    } catch (err) {
      console.warn(`Error investigando en ley real ${ley.nombre} (${ley.id}):`, err);
    }
  }

  return { articulos, leyesNombres, terminosBuscados };
}
