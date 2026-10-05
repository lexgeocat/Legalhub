import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { IncrustadorFuentes } from '../../application/puertos/fuentes';
import { buscarFuente } from '../../domain/fuentes';

export interface CargadorFuentes {
    familiasDisponibles(): Promise<string[]>;
    /** TrueType listo para incrustar, o null si esa variante no existe. */
    ttf(familia: string, negrita: boolean, cursiva: boolean): Promise<Uint8Array | null>;
}

type TipoEmbed = 'Regular' | 'Bold' | 'Italic' | 'BoldItalic';
interface Incrustada { familia: string; estilos: { tipo: TipoEmbed; ttf: Uint8Array }[] }

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CABECERA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL_FUENTE = `${NS_R}/font`;
const REL_TABLA = `${NS_R}/fontTable`;
const REL_AJUSTES = `${NS_R}/settings`;
const TIPO_ODTTF = 'application/vnd.openxmlformats-officedocument.obfuscatedFont';
const TIPO_TABLA = 'application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml';
const TIPO_AJUSTES = 'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml';

const PARTES_USO = /^word\/(document|styles|header\d*|footer\d*|footnotes|endnotes)\.xml$/;
const RE_FUENTE = /w:(?:ascii|hAnsi|cs|eastAsia)="([^"]+)"/g;
const RE_NEGRITA = /<w:b(\s[^>]*)?\/?>/;
const RE_CURSIVA = /<w:i(\s[^>]*)?\/?>/;

/** Elementos de CT_Settings que van ANTES de embedTrueTypeFonts. */
const ANTES_DE_EMBED = new Set([
    'writeProtection', 'view', 'zoom', 'removePersonalInformation', 'removeDateAndTime',
    'doNotDisplayPageBoundaries', 'displayBackgroundShape', 'printPostScriptOverText',
    'printFractionalCharacterWidth', 'printFormsData',
]);

function nuevoGuid(): string {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    return `{${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}}`;
}

/** Ofuscación de fuentes de Word (ECMA-376 §17.8.1): XOR de los 32 primeros bytes con el GUID en orden inverso. */
function ofuscar(ttf: Uint8Array, guid: string): Uint8Array {
    const hex = guid.replace(/[{}-]/g, '');
    const clave = new Uint8Array(16);
    for (let i = 0; i < 16; i++) clave[i] = Number.parseInt(hex.slice(30 - i * 2, 32 - i * 2), 16);
    const salida = ttf.slice();
    for (let i = 0; i < 32 && i < salida.length; i++) salida[i] ^= clave[i % 16];
    return salida;
}

function parsear(xml: string): Document {
    const d = new DOMParser().parseFromString(xml, 'application/xml');
    if (d.getElementsByTagName('parsererror').length > 0) throw new Error('XML inválido');
    return d;
}

const serializar = (d: Document): string => CABECERA + new XMLSerializer().serializeToString(d.documentElement);

export class IncrustadorFuentesDocx implements IncrustadorFuentes {
    constructor(private readonly cargador: CargadorFuentes) { }

    async incrustar(docx: Uint8Array): Promise<Uint8Array> {
        try {
            return (await this.procesar(docx)) ?? docx;
        } catch (e) {
            // Nunca debe impedir la generación del documento.
            console.warn('No se pudieron incrustar las fuentes en el .docx:', e);
            return docx;
        }
    }

    private async procesar(docx: Uint8Array): Promise<Uint8Array | null> {
        const partes = unzipSync(docx);
        const tipos = partes['[Content_Types].xml'];
        const relsDoc = partes['word/_rels/document.xml.rels'];
        if (!partes['word/document.xml'] || !tipos || !relsDoc) return null;

        // 1) Qué fuentes (y qué estilos) usa el documento
        const xml = Object.entries(partes)
            .filter(([nombre]) => PARTES_USO.test(nombre))
            .map(([, datos]) => strFromU8(datos))
            .join('\n');
        const usadas = new Set<string>();
        for (const m of xml.matchAll(RE_FUENTE)) usadas.add(m[1].toLowerCase());
        const objetivo = (await this.cargador.familiasDisponibles()).filter((f) => usadas.has(f.toLowerCase()));
        if (objetivo.length === 0) return null;

        const combos: [TipoEmbed, boolean, boolean][] = [['Regular', false, false]];
        const negrita = RE_NEGRITA.test(xml);
        const cursiva = RE_CURSIVA.test(xml);
        if (negrita) combos.push(['Bold', true, false]);
        if (cursiva) combos.push(['Italic', false, true]);
        if (negrita && cursiva) combos.push(['BoldItalic', true, true]);

        const incrustadas: Incrustada[] = [];
        for (const familia of objetivo) {
            const estilos: Incrustada['estilos'] = [];
            for (const [tipo, n, c] of combos) {
                const ttf = await this.cargador.ttf(familia, n, c);
                if (ttf) estilos.push({ tipo, ttf });
            }
            if (estilos.length > 0) incrustadas.push({ familia, estilos });
        }
        if (incrustadas.length === 0) return null;

        // 2) Partes .odttf + relaciones de la tabla de fuentes
        const salida: Zippable = { ...partes };
        const sufijo = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, '0')).join('');
        const relsFuentes: string[] = [];
        const asignadas = new Map<string, { id: string; clave: string; tipo: TipoEmbed }[]>();
        let n = 0;
        for (const { familia, estilos } of incrustadas) {
            const lista: { id: string; clave: string; tipo: TipoEmbed }[] = [];
            for (const { tipo, ttf } of estilos) {
                n += 1;
                const id = `rIdLh${n}`;
                const clave = nuevoGuid();
                const destino = `fonts/lh${sufijo}${n}.odttf`;
                salida[`word/${destino}`] = [ofuscar(ttf, clave), { level: 0 }];
                relsFuentes.push(`<Relationship Id="${id}" Type="${REL_FUENTE}" Target="${destino}"/>`);
                lista.push({ id, clave, tipo });
            }
            asignadas.set(familia, lista);
        }

        // 3) fontTable.xml
        const tablaXml = partes['word/fontTable.xml']
            ? strFromU8(partes['word/fontTable.xml'])
            : `${CABECERA}<w:fonts xmlns:w="${NS_W}" xmlns:r="${NS_R}"/>`;
        const tabla = parsear(tablaXml);
        const raizTabla = tabla.documentElement;
        for (const [familia, lista] of asignadas) {
            let f = Array.from(raizTabla.getElementsByTagNameNS(NS_W, 'font')).find(
                (e) => (e.getAttributeNS(NS_W, 'name') ?? '').toLowerCase() === familia.toLowerCase(),
            );
            if (!f) {
                f = tabla.createElementNS(NS_W, 'w:font');
                f.setAttributeNS(NS_W, 'w:name', familia);
                const serif = buscarFuente(familia)?.generica !== 'sans-serif';
                for (const [t, val] of [['charset', '00'], ['family', serif ? 'roman' : 'swiss'], ['pitch', 'variable']]) {
                    const e = tabla.createElementNS(NS_W, `w:${t}`);
                    e.setAttributeNS(NS_W, 'w:val', val);
                    f.appendChild(e);
                }
                raizTabla.appendChild(f);
            }
            for (const t of ['embedRegular', 'embedBold', 'embedItalic', 'embedBoldItalic']) {
                for (const e of Array.from(f.getElementsByTagNameNS(NS_W, t))) e.remove();
            }
            for (const { id, clave, tipo } of lista) {
                const e = tabla.createElementNS(NS_W, `w:embed${tipo}`);
                e.setAttributeNS(NS_R, 'r:id', id);
                e.setAttributeNS(NS_W, 'w:fontKey', clave);
                f.appendChild(e);
            }
        }
        salida['word/fontTable.xml'] = strToU8(serializar(tabla));

        // 4) fontTable.xml.rels
        const nombreRels = 'word/_rels/fontTable.xml.rels';
        let rels = partes[nombreRels]
            ? strFromU8(partes[nombreRels])
            : `${CABECERA}<Relationships xmlns="${NS_REL}"></Relationships>`;
        rels = rels
            .replace(/<Relationships([^>]*?)\/>/, '<Relationships$1></Relationships>')
            .replace('</Relationships>', `${relsFuentes.join('')}</Relationships>`);
        salida[nombreRels] = strToU8(rels);

        // 5) settings.xml → <w:embedTrueTypeFonts/> (en su posición del esquema)
        const ajustesXml = partes['word/settings.xml']
            ? strFromU8(partes['word/settings.xml'])
            : `${CABECERA}<w:settings xmlns:w="${NS_W}"/>`;
        const ajustes = parsear(ajustesXml);
        const raizAjustes = ajustes.documentElement;
        const previo = raizAjustes.getElementsByTagNameNS(NS_W, 'embedTrueTypeFonts')[0];
        if (previo) previo.removeAttributeNS(NS_W, 'val');
        else {
            const e = ajustes.createElementNS(NS_W, 'w:embedTrueTypeFonts');
            const referencia = Array.from(raizAjustes.children).find((h) => !ANTES_DE_EMBED.has(h.localName)) ?? null;
            raizAjustes.insertBefore(e, referencia);
        }
        salida['word/settings.xml'] = strToU8(serializar(ajustes));

        // 6) relaciones del documento y tipos de contenido
        let relsDocXml = strFromU8(relsDoc);
        const agregarRel = (id: string, tipo: string, destino: string) => {
            if (relsDocXml.includes(`Target="${destino}"`)) return;
            relsDocXml = relsDocXml.replace('</Relationships>', `<Relationship Id="${id}" Type="${tipo}" Target="${destino}"/></Relationships>`);
        };
        agregarRel('rIdLhFt', REL_TABLA, 'fontTable.xml');
        agregarRel('rIdLhSt', REL_AJUSTES, 'settings.xml');
        salida['word/_rels/document.xml.rels'] = strToU8(relsDocXml);

        let ct = strFromU8(tipos);
        if (!/Extension="odttf"/i.test(ct)) {
            ct = ct.replace('</Types>', `<Default Extension="odttf" ContentType="${TIPO_ODTTF}"/></Types>`);
        }
        const sobreescribir = (parte: string, tipo: string) => {
            if (!ct.includes(`PartName="${parte}"`)) {
                ct = ct.replace('</Types>', `<Override PartName="${parte}" ContentType="${tipo}"/></Types>`);
            }
        };
        sobreescribir('/word/fontTable.xml', TIPO_TABLA);
        sobreescribir('/word/settings.xml', TIPO_AJUSTES);
        salida['[Content_Types].xml'] = strToU8(ct);

        return zipSync(salida);
    }
}