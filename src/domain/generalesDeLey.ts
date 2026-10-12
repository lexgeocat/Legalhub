import { ci } from './filtros/ci';
import { titulo } from './filtros/titulo';
import { atributoConcordado, estadoCivilConcordado } from './personas';
import { claveNormalizada } from './texto';

export interface Generales {
    tipo?: string;
    nombres?: string; apellidoPaterno?: string; apellidoMaterno?: string; apellidoCasada?: string;
    ciNumero?: string; ciComplemento?: string; ciExpedido?: string;
    genero?: string; estadoCivil?: string; nacionalidad?: string; profesion?: string;
    fechaNacimiento?: string; domicilio?: string;
    razonSocial?: string; nit?: string;
}

const SIGLAS = ['LP', 'CB', 'SC', 'OR', 'PT', 'CH', 'TJ', 'BN', 'PD', 'QR'];
const DEPARTAMENTOS: Record<string, string> = {
    'la paz': 'LP', cochabamba: 'CB', 'santa cruz': 'SC', oruro: 'OR', potosi: 'PT',
    chuquisaca: 'CH', sucre: 'CH', tarija: 'TJ', beni: 'BN', pando: 'PD',
};
const ESTADOS: Record<string, string> = {
    soltero: 'soltero', soltera: 'soltero', casado: 'casado', casada: 'casado',
    divorciado: 'divorciado', divorciada: 'divorciado', viudo: 'viudo', viuda: 'viudo', 'union libre': 'union libre',
};
const NACIONALIDADES = [
    'boliviano', 'peruano', 'argentino', 'chileno', 'brasileño', 'paraguayo', 'colombiano',
    'ecuatoriano', 'venezolano', 'uruguayo', 'mexicano', 'cubano', 'italiano',
];
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los']);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const RE_NAC = new RegExp(`\\b(${NACIONALIDADES.map((n) => `${n.slice(0, -1)}[oa]`).join('|')})\\b`, 'i');
const RE_CI = /(?:\bc\.?\s?i\.?|\bc[eé]dula(?:\s+de\s+identidad)?|\bcarn[eé]t(?:\s+de\s+identidad)?)\s*(?:n[°ºo]\.?\s*)?:?\s*(\d[\d.]*\d)(?:\s*-\s*(\d[A-Za-z]))?/i;
const RE_EXPEDIDO = /^\s*,?\s*(?:expedid[oa]\s+en\s+|exp\.?\s*)?(LP|CB|SC|OR|PT|CH|TJ|BN|PD|QR|La Paz|Santa Cruz|Cochabamba|Oruro|Potos[íi]|Chuquisaca|Sucre|Tarija|Beni|Pando)\b/i;
const RE_ESTADO = /\b(soltero|soltera|casado|casada|divorciado|divorciada|viudo|viuda|uni[oó]n\s+libre)\b/i;
const RE_DOMICILIO = /(?:domiciliad[oa]\s+en|con\s+domicilio\s+(?:real\s+|legal\s+)?en|con\s+domicilio\s*:|domicilio\s+en|vecin[oa]\s+de|residente\s+en)\s*(.+)$/i;
const RE_PROFESION = /(?:de\s+profesi[oó]n|de\s+ocupaci[oó]n|de\s+oficio|profesi[oó]n|ocupaci[oó]n|oficio)\s*:?\s*([^,;.]+)/i;
const RE_NACIDO = /nacid[oa]\s+(?:el\s+)?(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de|del)\s+(\d{4})/i;
const NO_PROFESION = /c\.?\s?i\b|c[eé]dula|domicili|vecin|resident|mayor|h[aá]bil|nacid|natural|nacionalidad|^con\s|^de\s/i;

export function partirNombre(completo: string): Pick<Generales, 'nombres' | 'apellidoPaterno' | 'apellidoMaterno'> {
    const unidas: string[] = [];
    let prefijo = '';
    for (const p of completo.split(/\s+/).filter(Boolean)) {
        if (PARTICULAS.has(p.toLowerCase()) && unidas.length > 0) {
            prefijo += `${p} `;
            continue;
        }
        unidas.push(prefijo + p);
        prefijo = '';
    }
    if (prefijo) unidas.push(prefijo.trim());
    const n = unidas.length;
    if (n === 0) return {};
    if (n === 1) return { nombres: unidas[0] };
    if (n === 2) return { nombres: unidas[0], apellidoPaterno: unidas[1] };
    return { nombres: unidas.slice(0, n - 2).join(' '), apellidoPaterno: unidas[n - 2], apellidoMaterno: unidas[n - 1] };
}

/**
 * «Juan Pérez Gómez, mayor de edad, boliviano, casado, comerciante, con C.I. 1234567 LP, domiciliado en …»
 * → datos para rellenar la ficha. Es una ayuda: la persona siempre revisa antes de guardar.
 */
export function leerGeneralesDeLey(entrada: string): Generales {
    const texto = entrada.replace(/\s+/g, ' ').trim();
    const r: Generales = {};
    if (!texto) return r;
    let genero: 'M' | 'F' | undefined;

    // Nombre: lo que va antes de la primera coma (o de «con», «mayor de edad»…)
    const tratamiento = /^(?:el\s+|la\s+)?(se[ñn]ora|se[ñn]or|sra\.?|sr\.?|don|do[ñn]a)\s+/i.exec(texto);
    if (tratamiento) genero = /^(se[ñn]ora|sra|do[ñn]a)/i.test(tratamiento[1]) ? 'F' : 'M';
    const inicio = tratamiento ? texto.slice(tratamiento[0].length) : texto;
    const crudo = inicio.split(',')[0].split(/\s+(?:con|mayor|portador[a]?|titular|natural|de\s+nacionalidad)\b/i)[0].trim();
    if (/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'. -]{3,}$/.test(crudo) && !/^(mayor|con|natural|h[aá]bil|de\s+nacionalidad)\b/i.test(crudo)) {
        Object.assign(r, partirNombre(titulo(crudo)));
    }

    // C.I.
    const mCi = RE_CI.exec(texto);
    if (mCi) {
        r.ciNumero = mCi[1].replace(/\./g, '');
        if (mCi[2]) r.ciComplemento = mCi[2].toUpperCase();
        const mExp = RE_EXPEDIDO.exec(texto.slice(mCi.index + mCi[0].length));
        if (mExp) {
            const v = mExp[1].toUpperCase();
            r.ciExpedido = SIGLAS.includes(v) ? v : DEPARTAMENTOS[claveNormalizada(mExp[1]).replace(/\s+/g, ' ')];
        }
    }

    // Estado civil (y de ahí el género si viene marcado: soltera / casado…)
    const mEc = RE_ESTADO.exec(texto);
    if (mEc) {
        const k = claveNormalizada(mEc[1]).replace(/\s+/g, ' ');
        r.estadoCivil = ESTADOS[k];
        genero = /a$/.test(k) ? 'F' : /o$/.test(k) ? 'M' : genero;
    }

    // Nacionalidad (se guarda en masculino: la app la concuerda sola)
    const mNac = RE_NAC.exec(texto);
    if (mNac) {
        const v = mNac[1].toLowerCase();
        r.nacionalidad = v.endsWith('a') ? `${v.slice(0, -1)}o` : v;
        genero ??= v.endsWith('a') ? 'F' : 'M';
    }
    if (genero) r.genero = genero;

    // Profesión: explícita («de profesión abogado») o el dato que sigue al estado civil
    let prof = RE_PROFESION.exec(texto)?.[1]?.trim();
    if (!prof && mEc) {
        const segs = texto.split(',').map((x) => x.trim());
        const i = segs.findIndex((x) => RE_ESTADO.test(x));
        const cand = i >= 0 ? segs[i + 1] : undefined;
        if (cand && cand.length <= 40 && !/\d/.test(cand) && !NO_PROFESION.test(cand) && !RE_NAC.test(cand)) prof = cand;
    }
    if (prof) r.profesion = prof.toLowerCase();

    // Nacimiento y domicilio
    const mNacido = RE_NACIDO.exec(texto);
    if (mNacido) {
        const mes = MESES.indexOf(claveNormalizada(mNacido[2]));
        if (mes >= 0) r.fechaNacimiento = `${mNacido[3]}-${String(mes + 1).padStart(2, '0')}-${mNacido[1].padStart(2, '0')}`;
    }
    const mDom = RE_DOMICILIO.exec(texto);
    if (mDom) r.domicilio = mDom[1].split(';')[0].replace(/[.\s]+$/, '').trim();

    return r;
}

/** Arma la línea de generales de ley lista para pegar en Word. */
export function escribirGeneralesDeLey(d: Generales): string {
    const t = (v?: string) => (v ?? '').trim();
    if (d.tipo === 'juridica') {
        if (!t(d.razonSocial)) return '';
        return [
            t(d.razonSocial).toUpperCase(),
            t(d.nit) && `con NIT N° ${t(d.nit)}`,
            t(d.domicilio) && `con domicilio en ${t(d.domicilio)}`,
        ].filter(Boolean).join(', ');
    }
    const base = [t(d.nombres), t(d.apellidoPaterno), t(d.apellidoMaterno)].filter(Boolean).join(' ');
    if (!base) return '';
    const nombre = t(d.apellidoCasada) ? `${base} de ${t(d.apellidoCasada)}` : base;
    const g = d.genero === 'F' || d.genero === 'M' ? d.genero : null;
    const cedula = t(d.ciNumero) ? ci([t(d.ciNumero), t(d.ciComplemento), t(d.ciExpedido)]) : '';
    return [
        nombre.toUpperCase(),
        'mayor de edad',
        atributoConcordado(d.nacionalidad, g),
        estadoCivilConcordado(d.estadoCivil, g),
        atributoConcordado(d.profesion, g),
        cedula && `con C.I. N° ${cedula}`,
        t(d.domicilio) && `${g === 'F' ? 'domiciliada' : 'domiciliado'} en ${t(d.domicilio)}`,
    ].filter(Boolean).join(', ');
}