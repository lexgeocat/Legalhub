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
        simetricos: !!b.simetricos,
    };
}

const rFuentes = (f: string) => {
    const e = escAttr(f);
    return `<w:rFonts w:ascii="${e}" w:hAnsi="${e}" w:eastAsia="${e}" w:cs="${e}"/>`;
};

function corrida(t: Tramo, estilo: BloqueParrafo['estilo'], mediosPuntos: number): string {
    const negrita = t.negrita || estilo !== 'normal';
    const sz = t.tamanoPt ? Math.round(acotar(t.tamanoPt, 4, 96, 12) * 2) : estilo === 'titulo' ? mediosPuntos + 4 : 0;
    const tamano = sz ? `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` : '';
    const props =
        (t.fuente ? rFuentes(t.fuente) : '') +
        (negrita ? '<w:b/><w:bCs/>' : '') +
        (t.cursiva ? '<w:i/><w:iCs/>' : '') +
        tamano +
        (t.subrayado ? '<w:u w:val="single"/>' : '');
    const rPr = props ? `<w:rPr>${props}</w:rPr>` : '';

    // Los marcadores van siempre en una sola corrida, sin partir.
    if (t.marcador) return `<w:r>${rPr}<w:t xml:space="preserve">${escTexto(t.texto)}</w:t></w:r>`;

    // Texto normal: «\n» = salto de línea (Shift+Enter), «\t» = tabulación.
    return t.texto
        .split(/(\n|\t)/)
        .filter((x) => x !== '')
        .map((x) =>
            x === '\n' ? `<w:r>${rPr}<w:br/></w:r>`
                : x === '\t' ? `<w:r>${rPr}<w:tab/></w:r>`
                    : `<w:r>${rPr}<w:t xml:space="preserve">${escTexto(x)}</w:t></w:r>`,
        )
        .join('');
}

function parrafo(b: BloqueParrafo, cfg: ConfigPagina): string {
    const mediosPuntos = Math.round(cfg.tamanoPt * 2);

    const pPr: string[] = [];
    if (b.estilo === 'titulo') pPr.push('<w:pStyle w:val="Title"/>');
    else if (b.estilo === 'subtitulo') pPr.push('<w:pStyle w:val="Subtitle"/>');
    if (b.estilo !== 'normal') pPr.push('<w:keepNext/>');
    if (b.interlineado) {
        pPr.push(`<w:spacing w:line="${Math.round(240 * acotar(b.interlineado, 0.5, 5, cfg.interlineado))}" w:lineRule="auto"/>`);
    }
    pPr.push(`<w:jc w:val="${b.alineacion}"/>`);
    // Salto de columna: va primero y lo que sigue empieza en la columna siguiente (solo tiene sentido dentro de columnas).
    const salto = b.nuevaColumna && (b.columnas ?? 1) > 1 ? '<w:r><w:br w:type="column"/></w:r>' : '';
    return `<w:p><w:pPr>${pPr.join('')}</w:pPr>${salto}${b.tramos.map((t) => corrida(t, b.estilo, mediosPuntos)).join('')}</w:p>`;
}

/** Propiedades de una sección. La primera no lleva «type»; las demás empiezan de forma continua (sin cambiar de hoja). */
function sectPr(cfg: ConfigPagina, columnas: number, continua: boolean): string {
    const pag = PAGINAS[cfg.tamano];
    return (
        `<w:sectPr>${continua ? '<w:type w:val="continuous"/>' : ''}` +
        `<w:pgSz w:w="${pag.w}" w:h="${pag.h}"/>` +
        `<w:pgMar w:top="${twips(cfg.margenes.superior)}" w:right="${twips(cfg.margenes.derecho)}" ` +
        `w:bottom="${twips(cfg.margenes.inferior)}" w:left="${twips(cfg.margenes.izquierdo)}" ` +
        'w:header="709" w:footer="709" w:gutter="0"/>' +
        (columnas > 1 ? `<w:cols w:num="${columnas}" w:space="708"/>` : '') +
        '</w:sectPr>'
    );
}

const MINIMO = '<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>';
/** Párrafo diminuto (1 pt) que cierra una sección. Va fuera de los bloques {{#…}}, así el motor no lo repite ni lo quita. */
const portadora = (cfg: ConfigPagina, columnas: number, continua: boolean) =>
    `<w:p><w:pPr>${MINIMO}<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>${sectPr(cfg, columnas, continua)}</w:pPr></w:p>`;

function documentoXml(fuente: FuenteModelo, cfg: ConfigPagina): string {
    const secciones: { columnas: number; xml: string[] }[] = [];
    let columnas = 1;
    for (const b of parsearTexto(fuente.texto)) {
        if (b.tipo === 'parrafo') columnas = (b.columnas ?? 1) > 1 ? 2 : 1;
        const xml = b.tipo === 'salto' ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : parrafo(b, cfg);
        const ultima = secciones[secciones.length - 1];
        if (ultima && ultima.columnas === columnas) ultima.xml.push(xml);
        else secciones.push({ columnas, xml: [xml] });
    }
    if (secciones.length === 0) secciones.push({ columnas: 1, xml: ['<w:p/>'] });
    // Si las columnas quedan al final, se agrega una sección de 1 columna detrás: así Word las equilibra.
    if (secciones[secciones.length - 1].columnas > 1) {
        secciones.push({ columnas: 1, xml: [`<w:p><w:pPr>${MINIMO}</w:pPr></w:p>`] });
    }

    let cuerpo = '';
    let final = '';
    secciones.forEach((s, i) => {
        cuerpo += s.xml.join('');
        if (i < secciones.length - 1) cuerpo += portadora(cfg, s.columnas, i > 0);
        else final = sectPr(cfg, s.columnas, i > 0);
    });
    return `${CABECERA}<w:document xmlns:w="${NS_W}"><w:body>${cuerpo}${final}</w:body></w:document>`;
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
        '</w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/></w:style></w:styles>'
    );
}

/** Con márgenes simétricos Word usa `izquierdo` como margen interior y `derecho` como exterior, y los alterna por hoja. */
function configuracionXml(cfg: ConfigPagina): string {
    return (
        `${CABECERA}<w:settings xmlns:w="${NS_W}">` +
        // CT_Settings es una secuencia: mirrorMargins debe ir antes de defaultTabStop.
        (cfg.simetricos ? '<w:mirrorMargins/>' : '') +
        '<w:defaultTabStop w:val="708"/>' +
        '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>'
    );
}
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
            'word/settings.xml': strToU8(configuracionXml(cfg)),
        };
        return zipSync(partes);
    }
}