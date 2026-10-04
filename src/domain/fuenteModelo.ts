export type TipoCampo = 'texto' | 'texto_largo' | 'fecha' | 'moneda' | 'numero' | 'superficie';

export const TIPOS_CAMPO: { valor: TipoCampo; etiqueta: string }[] = [
    { valor: 'texto', etiqueta: 'Texto corto' },
    { valor: 'texto_largo', etiqueta: 'Texto largo' },
    { valor: 'fecha', etiqueta: 'Fecha' },
    { valor: 'moneda', etiqueta: 'Monto (Bs.)' },
    { valor: 'numero', etiqueta: 'Número' },
    { valor: 'superficie', etiqueta: 'Superficie (m²)' },
];

export interface CampoPropio { clave: string; etiqueta: string; tipo: TipoCampo; requerido: boolean }

export type TamanoPagina = 'carta' | 'oficio' | 'a4';

export interface ConfigPagina {
    tamano: TamanoPagina;
    fuente: string;
    tamanoPt: number;
    interlineado: number;
    sangria: boolean;
}

export interface FuenteModelo { version: 1; config: ConfigPagina; texto: string; campos: CampoPropio[] }

export const FUENTES_PAGINA = ['Times New Roman', 'Arial', 'Calibri', 'Cambria', 'Garamond', 'Georgia', 'Verdana'];
export const CATEGORIAS_MODELO = ['Escrito judicial', 'Contrato', 'Minuta', 'Documento privado', 'Poder', 'Carta o notificación', 'Otro'];

export const CONFIG_POR_DEFECTO: ConfigPagina = { tamano: 'carta', fuente: 'Times New Roman', tamanoPt: 12, interlineado: 1.5, sangria: false };

export const fuenteVacia = (): FuenteModelo => ({ version: 1, config: { ...CONFIG_POR_DEFECTO }, texto: '', campos: [] });

export function leerFuente(json: string): FuenteModelo {
    const o: unknown = JSON.parse(json);
    const r = (typeof o === 'object' && o !== null ? o : {}) as Partial<FuenteModelo>;
    return {
        version: 1,
        config: { ...CONFIG_POR_DEFECTO, ...(r.config ?? {}) },
        texto: typeof r.texto === 'string' ? r.texto : '',
        campos: Array.isArray(r.campos) ? r.campos.filter((c) => c && typeof c.clave === 'string') : [],
    };
}

const FILTRO_POR_TIPO: Partial<Record<TipoCampo, string>> = { moneda: ' | moneda', fecha: ' | fecha', superficie: ' | superficie' };

export function marcadorDeCampo(c: CampoPropio): string {
    return `{{caso.${c.clave}${c.requerido ? '' : '?'}${FILTRO_POR_TIPO[c.tipo] ?? ''}}}`;
}

/** {{x | f}} → {{x? | f}} */
export function hacerOpcional(marcador: string): string {
    return marcador.replace(
        /^\{\{\s*([^|}#/?]+?)\s*(\||\}\})/,
        (_m, ruta: string, sep: string) => `{{${ruta}?${sep === '|' ? ' |' : '}}'}`,
    );
}

/* ---------- Sintaxis del editor ----------
   Cada línea es un párrafo.  **negrita**  *cursiva*  ++subrayado++
   # Título (centrado)   ## Subtítulo   [c] centrado  [d] derecha  [i] izquierda  [j] justificado
   === salto de página   \* para un asterisco literal                                   */

export type Alineacion = 'left' | 'center' | 'right' | 'both';
export type EstiloParrafo = 'normal' | 'titulo' | 'subtitulo';

export interface Tramo { texto: string; negrita: boolean; cursiva: boolean; subrayado: boolean; marcador: boolean }

export type Bloque =
    | { tipo: 'salto' }
    | { tipo: 'parrafo'; alineacion: Alineacion; estilo: EstiloParrafo; tramos: Tramo[] };
export type BloqueParrafo = Extract<Bloque, { tipo: 'parrafo' }>;

const POR_LETRA: Record<string, Alineacion> = { c: 'center', d: 'right', i: 'left', j: 'both' };
const LETRA: Record<Alineacion, string> = { center: 'c', right: 'd', left: 'i', both: 'j' };
const ALINEACION_BASE: Record<EstiloParrafo, Alineacion> = { normal: 'both', titulo: 'center', subtitulo: 'left' };

export function tramosDe(linea: string): Tramo[] {
    const tramos: Tramo[] = [];
    let negrita = false, cursiva = false, subrayado = false, buf = '';
    const vaciar = () => {
        if (buf) tramos.push({ texto: buf, negrita, cursiva, subrayado, marcador: false });
        buf = '';
    };
    for (let i = 0; i < linea.length;) {
        if (linea.startsWith('{{', i)) {
            const fin = linea.indexOf('}}', i + 2);
            if (fin !== -1) {
                vaciar();
                tramos.push({ texto: linea.slice(i, fin + 2), negrita, cursiva, subrayado, marcador: true });
                i = fin + 2;
                continue;
            }
        }
        if (linea[i] === '\\' && i + 1 < linea.length) { buf += linea[i + 1]; i += 2; continue; }
        if (linea.startsWith('**', i)) { vaciar(); negrita = !negrita; i += 2; continue; }
        if (linea.startsWith('++', i)) { vaciar(); subrayado = !subrayado; i += 2; continue; }
        if (linea[i] === '*') { vaciar(); cursiva = !cursiva; i += 1; continue; }
        buf += linea[i];
        i += 1;
    }
    vaciar();
    return tramos;
}

export function parsearTexto(texto: string): Bloque[] {
    const lineas = texto.split(/\r?\n/);
    while (lineas.length > 0 && lineas[lineas.length - 1].trim() === '') lineas.pop();
    return lineas.map((linea): Bloque => {
        if (linea.trim() === '===') return { tipo: 'salto' };
        let resto = linea;
        let alineacion: Alineacion | null = null;
        let estilo: EstiloParrafo = 'normal';
        for (let n = 0; n < 2; n++) {
            const a = /^\[(c|d|i|j)\]\s?/i.exec(resto);
            if (a) { alineacion = POR_LETRA[a[1].toLowerCase()]; resto = resto.slice(a[0].length); continue; }
            const h = /^(#{1,2})\s+/.exec(resto);
            if (h) { estilo = h[1].length === 1 ? 'titulo' : 'subtitulo'; resto = resto.slice(h[0].length); continue; }
            break;
        }
        return { tipo: 'parrafo', alineacion: alineacion ?? ALINEACION_BASE[estilo], estilo, tramos: tramosDe(resto) };
    });
}

function tramoATexto(t: Tramo): string {
    let o = t.marcador ? t.texto : t.texto.replace(/[\\*]/g, '\\$&').replace(/\+\+/g, '\\+\\+');
    if (t.subrayado) o = `++${o}++`;
    if (t.cursiva) o = `*${o}*`;
    if (t.negrita) o = `**${o}**`;
    return o;
}

export function bloquesATexto(bloques: Bloque[]): string {
    return bloques
        .map((b) => {
            if (b.tipo === 'salto') return '===';
            let pref = '';
            if (b.alineacion !== ALINEACION_BASE[b.estilo]) pref += `[${LETRA[b.alineacion]}] `;
            if (b.estilo === 'titulo') pref += '# ';
            if (b.estilo === 'subtitulo') pref += '## ';
            const cuerpo = b.tramos.map(tramoATexto).join('');
            const seguro = /^(#|\[[cdij]\]|===\s*$)/i.test(cuerpo) ? `\\${cuerpo}` : cuerpo;
            return pref + seguro;
        })
        .join('\n');
}