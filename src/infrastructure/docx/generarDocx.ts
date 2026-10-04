import { strToU8, zipSync, type Zippable } from 'fflate';
import type { GeneradorDocx } from '../../application/puertos/modelos';
import {
    CONFIG_POR_DEFECTO, margenesSeguros, parsearTexto,
    type BloqueParrafo, type ConfigPagina, type FuenteModelo, type Tramo,
} from '../../domain/fuenteModelo';

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const CABECERA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const PAGINAS: Record<ConfigPagina['tamano'], { w: number; h: number }> = {
    carta: { w: 12240, h: 15840 },
    oficio: { w: 12240, h: 18720 },
    a4: { w: 11906, h: 16838 },
};

const limpiar = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
const escTexto = (s: string) => limpiar(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => escTexto(s).replace(/"/g, '&quot;');

const acotar = (n: number, min: number, max: number, defecto: number) =>
    Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defecto;

/** 1 cm = 566,929 twips (unidad de Word). */
const twips = (cm: number) => Math.round(cm * 566.929);

function configSegura(c: Partial<ConfigPagina> | undefined): ConfigPagina {
    const b = { ...CONFIG_POR_DEFECTO, ...(c ?? {}) };
    const tamano: ConfigPagina['tamano'] = b.tamano in PAGINAS ? b.tamano : 'carta';
    return {
        tamano,
        fuente: (b.fuente ?? '').trim() || CONFIG_POR_DEFECTO.fuente,
        tamanoPt: Math.round(acotar(Number(b.tamanoPt), 8, 24, 12) * 2) / 2,
        interlineado: acotar(Number(b.interlineado), 1, 3, 1.5),
        sangria: !!b.sangria,
        margenes: margenesSeguros(b.margenes, tamano),
    };
}

function corrida(t: Tramo, estilo: BloqueParrafo['estilo'], mediosPuntos: number): string {
    const negrita = t.negrita || estilo !== 'normal';
    const tamano = estilo === 'titulo' ? `<w:sz w:val="${mediosPuntos + 4}"/><w:szCs w:val="${mediosPuntos + 4}"/>` : '';
    const props =
        (negrita ? '<w:b/><w:bCs/>' : '') +
        (t.cursiva ? '<w:i/><w:iCs/>' : '') +
        tamano +
        (t.subrayado ? '<w:u w:val="single"/>' : '');
    return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${escTexto(t.texto)}</w:t></w:r>`;
}

function parrafo(b: BloqueParrafo, cfg: ConfigPagina): string {
    const mediosPuntos = Math.round(cfg.tamanoPt * 2);
    const pPr: string[] = [];
    if (b.estilo !== 'normal') pPr.push('<w:keepNext/>');
    if (b.estilo === 'titulo') pPr.push('<w:spacing w:before="240" w:after="240"/>');
    if (b.estilo === 'subtitulo') pPr.push('<w:spacing w:before="120" w:after="120"/>');
    if (cfg.sangria && b.estilo === 'normal' && (b.alineacion === 'both' || b.alineacion === 'left')) {
        pPr.push('<w:ind w:firstLine="709"/>');
    }
    pPr.push(`<w:jc w:val="${b.alineacion}"/>`);
    return `<w:p><w:pPr>${pPr.join('')}</w:pPr>${b.tramos.map((t) => corrida(t, b.estilo, mediosPuntos)).join('')}</w:p>`;
}

function documentoXml(fuente: FuenteModelo, cfg: ConfigPagina): string {
    const pag = PAGINAS[cfg.tamano];
    const cuerpo = parsearTexto(fuente.texto)
        .map((b) => (b.tipo === 'salto' ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : parrafo(b, cfg)))
        .join('');
    return (
        `${CABECERA}<w:document xmlns:w="${NS_W}"><w:body>${cuerpo || '<w:p/>'}` +
        `<w:sectPr><w:pgSz w:w="${pag.w}" w:h="${pag.h}"/>` +
        `<w:pgMar w:top="${twips(cfg.margenes.superior)}" w:right="${twips(cfg.margenes.derecho)}" ` +
        `w:bottom="${twips(cfg.margenes.inferior)}" w:left="${twips(cfg.margenes.izquierdo)}" ` +
        'w:header="709" w:footer="709" w:gutter="0"/>' +
        '</w:sectPr></w:body></w:document>'
    );
}

function estilosXml(cfg: ConfigPagina): string {
    const f = escAttr(cfg.fuente);
    const medios = Math.round(cfg.tamanoPt * 2);
    const linea = Math.round(240 * cfg.interlineado);
    return (
        `${CABECERA}<w:styles xmlns:w="${NS_W}"><w:docDefaults>` +
        `<w:rPrDefault><w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:eastAsia="${f}" w:cs="${f}"/>` +
        `<w:sz w:val="${medios}"/><w:szCs w:val="${medios}"/><w:lang w:val="es-BO"/></w:rPr></w:rPrDefault>` +
        `<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="${linea}" w:lineRule="auto"/></w:pPr></w:pPrDefault>` +
        '</w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>'
    );
}

const CONFIGURACION =
    `${CABECERA}<w:settings xmlns:w="${NS_W}"><w:defaultTabStop w:val="708"/>` +
    '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';

const TIPOS =
    `${CABECERA}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
    '</Types>';

const REL_RAIZ =
    `${CABECERA}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`;

const REL_DOCUMENTO =
    `${CABECERA}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/settings" Target="settings.xml"/></Relationships>`;

/** Construye el .docx de un modelo del editor. Cada marcador queda en una sola corrida, sin fragmentar. */
export class GeneradorDocxFflate implements GeneradorDocx {
    generar(fuente: FuenteModelo): Uint8Array {
        const cfg = configSegura(fuente.config);
        const partes: Zippable = {
            '[Content_Types].xml': strToU8(TIPOS),
            '_rels/.rels': strToU8(REL_RAIZ),
            'word/document.xml': strToU8(documentoXml(fuente, cfg)),
            'word/_rels/document.xml.rels': strToU8(REL_DOCUMENTO),
            'word/styles.xml': strToU8(estilosXml(cfg)),
            'word/settings.xml': strToU8(CONFIGURACION),
        };
        return zipSync(partes);
    }
}