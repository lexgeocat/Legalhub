import { claveNormalizada } from '../../domain/comun/texto';

const STOPWORDS = new Set(
  `de la el en y a los del se las por un para con no una su al lo como más mas pero sus le ya o fue este ha si porque
   esta son entre está cuando muy sin sobre ser tiene también tambien me hasta hay donde quien desde todo nos durante
   todos uno les ni contra otros ese eso ante ellos e esto mí mi antes algunos qué que dice dime explica redacta haz
   quiero favor articulo articulos art arts acerca podrias puedes hacer redactar necesito analiza investiga consulta
   elabora prepara genera dame escribe cual cuales cuál cuáles segun según cómo`.split(/\s+/),
);

/** Palabras sustantivas de una consulta (sin conectores, verbos de orden ni números). */
export function extraerTerminos(texto: string, max = 8): string[] {
  const vistos = new Set<string>();
  for (const w of texto.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)) {
    if (w.length < 3 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
    vistos.add(w);
    if (vistos.size >= max) break;
  }
  return [...vistos];
}

/** Solo números citados como artículo: «art. 568», «artículos 12 bis y 45». Ignora años y montos. */
export function numerosDeArticulo(texto: string): string[] {
  const salida = new Set<string>();
  const re = /\b(?:arts?\.?|art[íi]culos?)\s*((?:\d{1,5}(?:\s*(?:bis|ter|qu[aá]ter))?(?:\s*(?:,|y|e|al|-|–)\s*)?)+)/gi;
  for (const m of texto.matchAll(re)) {
    for (const n of m[1].matchAll(/(\d{1,5})(?:\s*(bis|ter|qu[aá]ter))?/gi)) {
      salida.add(`${Number(n[1])}${n[2] ? ` ${claveNormalizada(n[2])}` : ''}`);
    }
  }
  return [...salida].slice(0, 6);
}

/* ---------- Protección de datos: C.I./NIT, teléfonos y correos se enmascaran antes de salir ---------- */
const PATRONES: { re: RegExp; marca: string }[] = [
  {
    re: /(\b(?:C\.?\s?I\.?|c[eé]dula(?:\s+de\s+identidad)?|NIT|carnet)\s*(?:N[°º.]*\s*)?[:-]?\s*)(\d{5,12}(?:\s?-\s?\d[A-Za-z])?(?:\s+(?:LP|CB|SC|OR|PT|CH|TJ|BN|PD|QR)\b)?)/gi,
    marca: 'DOC',
  },
  { re: /(\b(?:tel[eé]fono|celular|cel\.?|tel\.?|whatsapp)\s*[:-]?\s*)(\+?\d[\d\s-]{6,14}\d)/gi, marca: 'TEL' },
  { re: /()\b([\w.+-]+@[\w-]+\.[\w.-]+)\b/g, marca: 'CORREO' },
];

export interface Protector {
  proteger: (texto: string) => string;
  restaurar: (texto: string) => string;
  /** true si se enmascaró algo (hay que avisarle a la IA que conserve los marcadores). */
  activo: () => boolean;
}

export function crearProtector(habilitado = true): Protector {
  if (!habilitado) return { proteger: (t) => t, restaurar: (t) => t, activo: () => false };
  const porToken = new Map<string, string>();
  const porValor = new Map<string, string>();
  let n = 0;
  return {
    proteger: (texto) => PATRONES.reduce(
      (acc, { re, marca }) => acc.replace(re, (_m, pre: string, dato: string) => {
        const k = `${marca}:${dato}`;
        let token = porValor.get(k);
        if (!token) {
          token = `[${marca}_${++n}]`;
          porValor.set(k, token);
          porToken.set(token, dato);
        }
        return `${pre}${token}`;
      }),
      texto,
    ),
    restaurar: (texto) => texto.replace(/\[(?:DOC|TEL|CORREO)_\d+\]/g, (k) => porToken.get(k) ?? k),
    activo: () => n > 0,
  };
}
