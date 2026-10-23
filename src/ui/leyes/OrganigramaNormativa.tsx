import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Ley, NodoConLey } from '../../application/casosDeUso/leyes';
import {
    ETIQUETA_NIVEL, etiquetaNodo, rangoArticulos, rutaDe,
    type ModoCita, type NivelLey, type NodoArbol, type NodoLey, type NodoOrg,
} from '../../domain/leyes/leyes';
import { Icono, Insignia, avisar } from '../_core/comunes';
import { useTema } from '../_core/tema';
import './leyes.css';

/* ================= Paleta y estilos por nivel ================= */
export interface EstiloNivel {
    fondo: string;
    borde: string;
    acento: string;
    texto: string;
    textoSuave: string;
    degrade: [string, string];
    badgeFondo: string;
    badgeTexto: string;

    // Tema oscuro (slate)
    fondoOscuro: string;
    bordeOscuro: string;
    acentoOscuro: string;
    textoOscuro: string;
    textoSuaveOscuro: string;
    degradeOscuro: [string, string];
    badgeFondoOscuro: string;
    badgeTextoOscuro: string;
}

export const ESTILO_NIVEL: Record<NivelLey | 'ley', EstiloNivel> = {
    ley: {
        fondo: '#0f172a',
        borde: '#3b82f6',
        acento: '#38bdf8',
        texto: '#ffffff', // Texto blanco puro de alto contraste sobre fondo oscuro
        textoSuave: '#cbd5e1', // Gris claro legible
        degrade: ['#1e293b', '#0f172a'],
        badgeFondo: '#2563eb',
        badgeTexto: '#ffffff',
        fondoOscuro: '#090d16',
        bordeOscuro: '#60a5fa',
        acentoOscuro: '#38bdf8',
        textoOscuro: '#ffffff',
        textoSuaveOscuro: '#cbd5e1',
        degradeOscuro: ['#1e293b', '#0b1120'],
        badgeFondoOscuro: '#2563eb',
        badgeTextoOscuro: '#ffffff',
    },
    parte: {
        fondo: '#fbf7ff',
        borde: '#9333ea',
        acento: '#7e22ce',
        texto: '#581c87',
        textoSuave: '#7e22ce',
        degrade: ['#faf5ff', '#f3e8ff'],
        badgeFondo: '#7e22ce',
        badgeTexto: '#ffffff',
        fondoOscuro: '#1e0533',
        bordeOscuro: '#c084fc',
        acentoOscuro: '#a855f7',
        textoOscuro: '#f5f3ff',
        textoSuaveOscuro: '#d8b4fe',
        degradeOscuro: ['#3b0764', '#1e0533'],
        badgeFondoOscuro: '#a855f7',
        badgeTextoOscuro: '#ffffff',
    },
    libro: {
        fondo: '#f0f7ff',
        borde: '#2563eb',
        acento: '#1d4ed8',
        texto: '#1e3a8a',
        textoSuave: '#2563eb',
        degrade: ['#eff6ff', '#dbeafe'],
        badgeFondo: '#1d4ed8',
        badgeTexto: '#ffffff',
        fondoOscuro: '#0c152d',
        bordeOscuro: '#60a5fa',
        acentoOscuro: '#3b82f6',
        textoOscuro: '#eff6ff',
        textoSuaveOscuro: '#93c5fd',
        degradeOscuro: ['#172554', '#0c152d'],
        badgeFondoOscuro: '#3b82f6',
        badgeTextoOscuro: '#ffffff',
    },
    titulo: {
        fondo: '#f0fdf7',
        borde: '#16a34a',
        acento: '#15803d',
        texto: '#14532d',
        textoSuave: '#16a34a',
        degrade: ['#f0fdf4', '#dcfce7'],
        badgeFondo: '#15803d',
        badgeTexto: '#ffffff',
        fondoOscuro: '#021a0d',
        bordeOscuro: '#34d399',
        acentoOscuro: '#10b981',
        textoOscuro: '#f0fdf4',
        textoSuaveOscuro: '#86efac',
        degradeOscuro: ['#052e16', '#021a0d'],
        badgeFondoOscuro: '#10b981',
        badgeTextoOscuro: '#ffffff',
    },
    capitulo: {
        fondo: '#fffdf5',
        borde: '#d97706',
        acento: '#b45309',
        texto: '#78350f',
        textoSuave: '#d97706',
        degrade: ['#fffbeb', '#fef3c7'],
        badgeFondo: '#b45309',
        badgeTexto: '#ffffff',
        fondoOscuro: '#270e02',
        bordeOscuro: '#fbbf24',
        acentoOscuro: '#f59e0b',
        textoOscuro: '#fffbeb',
        textoSuaveOscuro: '#fde68a',
        degradeOscuro: ['#451a03', '#270e02'],
        badgeFondoOscuro: '#f59e0b',
        badgeTextoOscuro: '#ffffff',
    },
    seccion: {
        fondo: '#fff5f7',
        borde: '#e11d48',
        acento: '#be123c',
        texto: '#881337',
        textoSuave: '#e11d48',
        degrade: ['#fff1f2', '#ffe4e6'],
        badgeFondo: '#be123c',
        badgeTexto: '#ffffff',
        fondoOscuro: '#2a020d',
        bordeOscuro: '#fb7185',
        acentoOscuro: '#f43f5e',
        textoOscuro: '#fff1f2',
        textoSuaveOscuro: '#fecdd3',
        degradeOscuro: ['#4c0519', '#2a020d'],
        badgeFondoOscuro: '#f43f5e',
        badgeTextoOscuro: '#ffffff',
    },
    subseccion: {
        fondo: '#f5f5ff',
        borde: '#4f46e5',
        acento: '#4338ca',
        texto: '#312e81',
        textoSuave: '#4f46e5',
        degrade: ['#eef2ff', '#e0e7ff'],
        badgeFondo: '#4338ca',
        badgeTexto: '#ffffff',
        fondoOscuro: '#100e2b',
        bordeOscuro: '#818cf8',
        acentoOscuro: '#6366f1',
        textoOscuro: '#eef2ff',
        textoSuaveOscuro: '#c7d2fe',
        degradeOscuro: ['#1e1b4b', '#100e2b'],
        badgeFondoOscuro: '#6366f1',
        badgeTextoOscuro: '#ffffff',
    },
    articulo: {
        fondo: '#ffffff',
        borde: '#64748b',
        acento: '#475569',
        texto: '#0f172a',
        textoSuave: '#64748b',
        degrade: ['#ffffff', '#f8fafc'],
        badgeFondo: '#475569',
        badgeTexto: '#ffffff',
        fondoOscuro: '#141923',
        bordeOscuro: '#94a3b8',
        acentoOscuro: '#cbd5e1',
        textoOscuro: '#f8fafc',
        textoSuaveOscuro: '#94a3b8',
        degradeOscuro: ['#1e2636', '#141923'],
        badgeFondoOscuro: '#64748b',
        badgeTextoOscuro: '#ffffff',
    },
};

const FUENTE_DIAGRAMA = '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif';

/** Divide texto en líneas de hasta `maxCar` caracteres sin cortar palabras. */
export function partirTexto(texto: string, maxCar = 24, maxLineas = 2): string[] {
    const t = texto.replace(/\s+/g, ' ').trim();
    if (!t) return [];
    const palabras = t.split(' ');
    const lineas: string[] = [];
    let actual = '';

    for (const p of palabras) {
        if (!actual) {
            actual = p;
        } else if (actual.length + 1 + p.length <= maxCar) {
            actual += ` ${p}`;
        } else {
            lineas.push(actual);
            actual = p;
            if (lineas.length === maxLineas - 1) break;
        }
    }
    if (actual && lineas.length < maxLineas) lineas.push(actual);

    const palabrasUsadas = lineas.join(' ').split(' ').length;
    if (palabrasUsadas < palabras.length && lineas.length > 0) {
        let ultima = lineas[lineas.length - 1];
        if (ultima.length > maxCar - 2) ultima = ultima.slice(0, maxCar - 3);
        lineas[lineas.length - 1] = `${ultima}…`;
    }

    return lineas;
}

/* ================= Tipos del Diagrama ================= */
export interface NodoDiagrama {
    id: string;
    esRaizLey?: boolean;
    esListaArticulos?: boolean;
    parentDivisionId?: string;
    articulosLista?: NodoOrg[];
    nodoOrg?: NodoOrg;
    nivel: NivelLey | 'ley';
    cab: string;
    titulo: string;
    meta: string;
    arts: number;
    pagina: number;
    w: number;
    h: number;
    x: number;
    y: number;
    wSub: number;
    hijos: NodoDiagrama[];
    plegado: boolean;
    totalHijos: number;
}

export interface EnlaceDiagrama {
    de: string;
    a: string;
    d: string;
}

export interface DisposicionOrganigrama {
    ancho: number;
    alto: number;
    nodos: NodoDiagrama[];
    enlaces: EnlaceDiagrama[];
}

/** Genera un conector ortogonal elegante con curvas Bézier suaves. */
function generarConector(pX: number, pY: number, cX: number, cY: number): string {
    const midY = Math.round((pY + cY) / 2);
    if (Math.abs(pX - cX) < 1.5) {
        return `M ${pX} ${pY} L ${cX} ${cY}`;
    }
    const r = Math.min(10, Math.abs(midY - pY) * 0.75, Math.abs(cX - pX) / 2);
    const dir = cX > pX ? 1 : -1;
    return `M ${pX} ${pY} ` +
        `L ${pX} ${midY - r} ` +
        `Q ${pX} ${midY} ${pX + dir * r} ${midY} ` +
        `L ${cX - dir * r} ${midY} ` +
        `Q ${cX} ${midY} ${cX} ${midY + r} ` +
        `L ${cX} ${cY}`;
}

/**
 * Calcula la disposición visual jerárquica tipo organigrama / flujograma.
 * Los artículos de cada división se agrupan en una única tarjeta de lista elegante.
 */
export function calcularOrganigrama({
    ley,
    raices,
    plegados,
    verArticulos,
    nivelMaximo,
    itemsPorPagina = 6,
}: {
    ley: Ley;
    raices: NodoOrg[];
    plegados: ReadonlySet<string>;
    verArticulos: boolean;
    nivelMaximo: 'todos' | 'capitulo' | 'titulo';
    itemsPorPagina?: number;
}): DisposicionOrganigrama {
    if (raices.length === 0) {
        return { ancho: 0, alto: 0, nodos: [], enlaces: [] };
    }

    const gapX = 26;
    const gapY = 54;
    const pad = 44;

    const filtroNivel = (n: NivelLey): boolean => {
        if (nivelMaximo === 'titulo') return n === 'parte' || n === 'libro' || n === 'titulo';
        if (nivelMaximo === 'capitulo') return n === 'parte' || n === 'libro' || n === 'titulo' || n === 'capitulo';
        return true;
    };

    function transformarNodo(o: NodoOrg): NodoDiagrama | null {
        if (!filtroNivel(o.n.nivel)) return null;

        const cab = o.n.numero ? `${ETIQUETA_NIVEL[o.n.nivel]} ${o.n.numero}` : ETIQUETA_NIVEL[o.n.nivel];
        const rango = rangoArticulos(o);
        const meta = rango ? `${rango}${o.arts > 1 ? ` · ${o.arts} arts.` : ''}` : `Pág. ${o.n.pagina}`;

        const w = (o.n.nivel === 'libro' || o.n.nivel === 'parte') ? 224 : 208;
        const h = 84;
        const plegado = plegados.has(o.n.id);

        const hijosFiltrados: NodoDiagrama[] = [];

        // 1. Sub-divisiones (libros, títulos, capítulos, secciones, subsecciones)
        const subDivisiones = o.hijos.filter((h) => h.n.nivel !== 'articulo');
        for (const h of subDivisiones) {
            const hDiag = transformarNodo(h);
            if (hDiag) hijosFiltrados.push(hDiag);
        }

        // 2. Artículos directos de esta división: se agrupan en un ÚNICO recuadro lista
        const articulosHijos = o.hijos.filter((h) => h.n.nivel === 'articulo');
        if (verArticulos && articulosHijos.length > 0) {
            const cantArt = articulosHijos.length;
            const itemsVisibles = Math.min(cantArt, itemsPorPagina);
            const altoTarjeta = 38 + itemsVisibles * 26 + (cantArt > itemsPorPagina ? 32 : 8);

            const cardArticulos: NodoDiagrama = {
                id: `arts-${o.n.id}`,
                parentDivisionId: o.n.id,
                esListaArticulos: true,
                articulosLista: articulosHijos,
                nivel: 'articulo',
                cab: `ARTÍCULOS (${cantArt})`,
                titulo: rangoArticulos(o) || `${cantArt} artículos`,
                meta: `Arts. ${articulosHijos[0].n.numero}–${articulosHijos[cantArt - 1].n.numero}`,
                arts: cantArt,
                pagina: articulosHijos[0].n.pagina,
                w: 240,
                h: altoTarjeta,
                x: 0,
                y: 0,
                wSub: 240,
                hijos: [],
                plegado: false,
                totalHijos: 0,
            };

            hijosFiltrados.push(cardArticulos);
        }

        return {
            id: o.n.id,
            nodoOrg: o,
            nivel: o.n.nivel,
            cab,
            titulo: o.n.titulo || '',
            meta,
            arts: o.arts,
            pagina: o.n.pagina,
            w,
            h,
            x: 0,
            y: 0,
            wSub: w,
            hijos: plegado ? [] : hijosFiltrados,
            plegado,
            totalHijos: hijosFiltrados.length,
        };
    }

    // 1. Nodo raíz representativo de la Ley/Normativa
    const hijosRaices: NodoDiagrama[] = [];
    for (const r of raices) {
        if (r.n.nivel === 'articulo') {
            continue; // Los artículos sueltos de la raíz se agruparán abajo
        }
        const d = transformarNodo(r);
        if (d) hijosRaices.push(d);
    }

    // Si la ley solo tiene artículos directos (sin libros ni títulos):
    const articulosDirectosRaiz = raices.filter((r) => r.n.nivel === 'articulo');
    if (verArticulos && articulosDirectosRaiz.length > 0) {
        const cantArt = articulosDirectosRaiz.length;
        const itemsVisibles = Math.min(cantArt, itemsPorPagina);
        const altoTarjeta = 38 + itemsVisibles * 26 + (cantArt > itemsPorPagina ? 32 : 8);

        hijosRaices.push({
            id: `arts-raiz`,
            parentDivisionId: `ley-${ley.id}`,
            esListaArticulos: true,
            articulosLista: articulosDirectosRaiz,
            nivel: 'articulo',
            cab: `ARTÍCULOS (${cantArt})`,
            titulo: `${cantArt} artículos`,
            meta: `Arts. ${articulosDirectosRaiz[0].n.numero}–${articulosDirectosRaiz[cantArt - 1].n.numero}`,
            arts: cantArt,
            pagina: articulosDirectosRaiz[0].n.pagina,
            w: 240,
            h: altoTarjeta,
            x: 0,
            y: 0,
            wSub: 240,
            hijos: [],
            plegado: false,
            totalHijos: 0,
        });
    }

    const raizPlegada = plegados.has(`ley-${ley.id}`);
    const raizLey: NodoDiagrama = {
        id: `ley-${ley.id}`,
        esRaizLey: true,
        nivel: 'ley',
        cab: (ley.tipo || 'Normativa').toUpperCase(),
        titulo: ley.nombre,
        meta: `${ley.numArticulos} artículos · ${ley.numPaginas} págs.`,
        arts: ley.numArticulos,
        pagina: 1,
        w: 254,
        h: 92,
        x: 0,
        y: 0,
        wSub: 254,
        hijos: raizPlegada ? [] : hijosRaices,
        plegado: raizPlegada,
        totalHijos: hijosRaices.length,
    };

    // 2. Medir subárboles de abajo hacia arriba (Bottom-up)
    function medir(n: NodoDiagrama): number {
        if (n.hijos.length === 0) {
            n.wSub = n.w;
            return n.w;
        }
        let anchoHijos = 0;
        for (let i = 0; i < n.hijos.length; i++) {
            anchoHijos += medir(n.hijos[i]);
            if (i > 0) anchoHijos += gapX;
        }
        n.wSub = Math.max(n.w, anchoHijos);
        return n.wSub;
    }
    medir(raizLey);

    // 3. Posicionar nodos de arriba hacia abajo (Top-down)
    function posicionar(n: NodoDiagrama, left: number, y: number): void {
        n.y = y;
        if (n.hijos.length === 0) {
            n.x = left + (n.wSub - n.w) / 2;
            return;
        }

        let anchoHijos = 0;
        for (let i = 0; i < n.hijos.length; i++) {
            anchoHijos += n.hijos[i].wSub;
            if (i > 0) anchoHijos += gapX;
        }

        const inicioHijos = left + Math.max(0, (n.wSub - anchoHijos) / 2);
        let curLeft = inicioHijos;

        for (const h of n.hijos) {
            posicionar(h, curLeft, y + n.h + gapY);
            curLeft += h.wSub + gapX;
        }

        const primerHijo = n.hijos[0];
        const ultimoHijo = n.hijos[n.hijos.length - 1];
        const centroHijos = (primerHijo.x + primerHijo.w / 2 + ultimoHijo.x + ultimoHijo.w / 2) / 2;
        n.x = Math.round(centroHijos - n.w / 2);
    }
    posicionar(raizLey, pad, pad);

    // 4. Aplanar nodos y calcular enlaces
    const todosNodos: NodoDiagrama[] = [];
    const enlaces: EnlaceDiagrama[] = [];

    function recorrer(n: NodoDiagrama): void {
        todosNodos.push(n);
        for (const h of n.hijos) {
            const pX = Math.round(n.x + n.w / 2);
            const pY = n.y + n.h;
            const cX = Math.round(h.x + h.w / 2);
            const cY = h.y;
            enlaces.push({ de: n.id, a: h.id, d: generarConector(pX, pY, cX, cY) });
            recorrer(h);
        }
    }
    recorrer(raizLey);

    // 5. Normalizar coordenadas
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of todosNodos) {
        if (n.x < minX) minX = n.x;
        if (n.x + n.w > maxX) maxX = n.x + n.w;
        if (n.y < minY) minY = n.y;
        if (n.y + n.h > maxY) maxY = n.y + n.h;
    }

    const correccionX = pad - minX;
    const correccionY = pad - minY;

    if (correccionX !== 0 || correccionY !== 0) {
        for (const n of todosNodos) {
            n.x += correccionX;
            n.y += correccionY;
        }
        for (const e of enlaces) {
            const deNodo = todosNodos.find((x) => x.id === e.de);
            const aNodo = todosNodos.find((x) => x.id === e.a);
            if (deNodo && aNodo) {
                e.d = generarConector(
                    Math.round(deNodo.x + deNodo.w / 2),
                    deNodo.y + deNodo.h,
                    Math.round(aNodo.x + aNodo.w / 2),
                    aNodo.y,
                );
            }
        }
    }

    const ancho = Math.max(800, maxX - minX + pad * 2);
    const alto = Math.max(500, maxY - minY + pad * 2);

    return { ancho, alto, nodos: todosNodos, enlaces };
}

/* ================= Componente Principal ================= */
interface Props {
    ley: Ley;
    raices: NodoOrg[];
    todosNodos: NodoArbol[];
    selId: string | null;
    nodoSeleccionado: NodoConLey | null;
    onElegir: (id: string, pagina: number) => void;
    onVerPdf: (pagina: number) => void;
    onCopiar: (modo: ModoCita) => void;
    onEditarNodo: (n: NodoLey) => void;
    onVerLector: () => void;
}

export function OrganigramaNormativa({
    ley,
    raices,
    todosNodos,
    selId,
    nodoSeleccionado,
    onElegir,
    onVerPdf,
    onCopiar,
    onEditarNodo,
    onVerLector,
}: Props) {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const [tema] = useTema();
    const esOscuro = tema === 'slate';
    const svgRef = useRef<SVGSVGElement>(null);
    const lienzoRef = useRef<HTMLDivElement>(null);

    // Controles de visualización
    const [verArticulos, setVerArticulos] = useState(true); // Activo por defecto con la lista compacta
    const [nivelMaximo, setNivelMaximo] = useState<'todos' | 'capitulo' | 'titulo'>('todos');
    const [filtroTexto, setFiltroTexto] = useState('');
    const [plegados, setPlegados] = useState<Set<string>>(() => new Set());
    const [pantallaCompleta, setPantallaCompleta] = useState(false);
    const [panelVisible, setPanelVisible] = useState(true);
    const [paginasArticulos, setPaginasArticulos] = useState<Record<string, number>>({});

    // Transformación de Pan & Zoom
    const [transform, setTransform] = useState<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
    const transformRef = useRef(transform);
    transformRef.current = transform;

    const [arrastrando, setArrastrando] = useState(false);
    const arrastrandoRef = useRef({ inicioMouseX: 0, inicioMouseY: 0, inicioPanX: 0, inicioPanY: 0, activo: false, seMovio: false });

    // Cálculo del organigrama
    const disp = useMemo(() => {
        return calcularOrganigrama({ ley, raices, plegados, verArticulos, nivelMaximo });
    }, [ley, raices, plegados, verArticulos, nivelMaximo]);

    // Resaltado de búsqueda en el organigrama
    const nodosCoincidentes = useMemo(() => {
        const q = filtroTexto.trim().toLowerCase();
        if (!q) return new Set<string>();
        const res = new Set<string>();
        for (const n of disp.nodos) {
            if (n.titulo.toLowerCase().includes(q) || n.cab.toLowerCase().includes(q) || n.meta.toLowerCase().includes(q)) {
                res.add(n.id);
            }
            if (n.esListaArticulos && n.articulosLista) {
                for (const art of n.articulosLista) {
                    if (art.n.titulo?.toLowerCase().includes(q) || art.n.numero?.toLowerCase().includes(q)) {
                        res.add(n.id);
                        res.add(art.n.id);
                    }
                }
            }
        }
        return res;
    }, [disp.nodos, filtroTexto]);

    const tieneFiltro = filtroTexto.trim() !== '';

    /* ----- Ajustar diagrama a pantalla ----- */
    const ajustarVista = () => {
        const el = lienzoRef.current;
        if (!el || disp.ancho === 0 || disp.alto === 0) return;
        const padding = 54;
        const fitW = (el.clientWidth - padding) / disp.ancho;
        const fitH = (el.clientHeight - padding) / disp.alto;
        const z = Math.min(1.2, Math.max(0.18, Math.min(fitW, fitH > 0 ? fitH : fitW)));
        const targetX = Math.round((el.clientWidth - disp.ancho * z) / 2);
        const targetY = Math.max(20, Math.round((el.clientHeight - disp.alto * z) / 2));
        const nueva = { x: targetX, y: targetY, zoom: Math.round(z * 100) / 100 };
        transformRef.current = nueva;
        setTransform(nueva);
    };

    const inicializadoRef = useRef(false);
    useEffect(() => {
        const el = lienzoRef.current;
        if (!el) return;
        const medir = () => {
            if (!inicializadoRef.current && el.clientWidth > 0 && disp.ancho > 0) {
                ajustarVista();
                inicializadoRef.current = true;
            }
        };
        medir();
        const obs = new ResizeObserver(medir);
        obs.observe(el);
        return () => obs.disconnect();
    }, [disp.ancho, disp.alto, pantallaCompleta, panelVisible]);

    function centrarEnNodo(id: string) {
        const n = disp.nodos.find((x) => x.id === id);
        const el = lienzoRef.current;
        if (!n || !el) return;
        const z = transformRef.current.zoom;
        const targetX = Math.round(el.clientWidth / 2 - (n.x + n.w / 2) * z);
        const targetY = Math.round(el.clientHeight / 2 - (n.y + n.h / 2) * z);
        const nueva = { x: targetX, y: targetY, zoom: z };
        transformRef.current = nueva;
        setTransform(nueva);
    }

    // Zoom focal con rueda del ratón
    useEffect(() => {
        const el = lienzoRef.current;
        if (!el) return;

        const alRueda = (e: WheelEvent) => {
            e.preventDefault();
            const cur = transformRef.current;
            const rect = el.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const factor = e.deltaY < 0 ? 1.12 : 0.89;
            const newZ = Math.min(3.0, Math.max(0.15, Math.round(cur.zoom * factor * 100) / 100));
            if (newZ === cur.zoom) return;

            const wx = (mx - cur.x) / cur.zoom;
            const wy = (my - cur.y) / cur.zoom;

            const newX = Math.round(mx - wx * newZ);
            const newY = Math.round(my - wy * newZ);

            const nueva = { x: newX, y: newY, zoom: newZ };
            transformRef.current = nueva;
            setTransform(nueva);
        };

        el.addEventListener('wheel', alRueda, { passive: false });
        return () => el.removeEventListener('wheel', alRueda);
    }, []);

    // Arrastre con ratón (Pan) - Solo activa arrastrando si hubo movimiento > 4px
    const alBajarMouse = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        arrastrandoRef.current = {
            inicioMouseX: e.clientX,
            inicioMouseY: e.clientY,
            inicioPanX: transformRef.current.x,
            inicioPanY: transformRef.current.y,
            activo: true,
            seMovio: false,
        };
    };

    const alMoverMouse = (e: React.MouseEvent) => {
        if (!arrastrandoRef.current.activo) return;
        const dx = e.clientX - arrastrandoRef.current.inicioMouseX;
        const dy = e.clientY - arrastrandoRef.current.inicioMouseY;

        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            arrastrandoRef.current.seMovio = true;
            if (!arrastrando) setArrastrando(true);

            const nueva = {
                ...transformRef.current,
                x: arrastrandoRef.current.inicioPanX + dx,
                y: arrastrandoRef.current.inicioPanY + dy,
            };
            transformRef.current = nueva;
            setTransform(nueva);
        }
    };

    const alSubirMouse = () => {
        if (arrastrandoRef.current.activo) {
            arrastrandoRef.current.activo = false;
            setArrastrando(false);
        }
    };

    // Alternar pliegue de un nodo
    const alternarPliegue = (id: string, ev?: React.MouseEvent) => {
        if (ev) {
            ev.stopPropagation();
            ev.preventDefault();
        }
        setPlegados((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const desplegarTodo = () => setPlegados(new Set());
    const plegarTodo = () => {
        const divisiones = disp.nodos.filter((n) => n.totalHijos > 0).map((n) => n.id);
        setPlegados(new Set(divisiones));
    };

    const teclasNodo = (e: KeyboardEvent<SVGGElement>, n: NodoDiagrama) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!n.esRaizLey && !n.esListaArticulos) onElegir(n.id, n.pagina);
        }
    };

    const exportarSvg = () => {
        if (!svgRef.current) return;
        try {
            const serializer = new XMLSerializer();
            let source = serializer.serializeToString(svgRef.current);
            if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
                source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
            }
            const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `organigrama_${ley.nombre.replace(/[^a-zA-Z0-9_-]/g, '_')}.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            avisar('Organigrama vectorial exportado con éxito');
        } catch {
            avisar('No se pudo exportar el diagrama', 'error');
        }
    };

    const primario = esOscuro ? '#38bdf8' : '#2563eb';
    const flechaId = `org${uid}`;

    // Nodo actual inspeccionado
    const indiceNodoSel = useMemo(() => todosNodos.findIndex((n) => n.id === selId), [todosNodos, selId]);
    const rutaSel = useMemo(() => (indiceNodoSel < 0 ? [] : rutaDe(todosNodos, indiceNodoSel)), [todosNodos, indiceNodoSel]);
    const anterior = indiceNodoSel > 0 ? todosNodos[indiceNodoSel - 1] : null;
    const siguiente = indiceNodoSel >= 0 && indiceNodoSel < todosNodos.length - 1 ? todosNodos[indiceNodoSel + 1] : null;
    const nodoOrgActual = useMemo(() => {
        if (!selId) return undefined;
        const buscar = (lista: NodoOrg[]): NodoOrg | undefined => {
            for (const item of lista) {
                if (item.n.id === selId) return item;
                const r = buscar(item.hijos);
                if (r) return r;
            }
            return undefined;
        };
        return buscar(raices);
    }, [selId, raices]);

    return (
        <div className={`org-layout${pantallaCompleta ? ' org-pantalla-completa' : ''}${panelVisible && selId ? ' con-panel' : ' sin-panel'}`}>
            <div className="org-escena">
                {/* Barra de herramientas superior */}
                <div className="org-barra">
                    <div className="org-barra-titulo">
                        <Icono n="flujo" tam={18} />
                        <span>Organigrama de la Normativa</span>
                    </div>

                    <div className="org-filtros-grupo">
                        <label className="casilla" style={{ fontSize: 12.5, fontWeight: 550, margin: 0 }}>
                            <input
                                type="checkbox"
                                checked={verArticulos}
                                onChange={(e) => setVerArticulos(e.target.checked)}
                            />
                            Ver lista de artículos
                        </label>

                        <select
                            className="org-select-nivel"
                            aria-label="Nivel de profundidad"
                            value={nivelMaximo}
                            onChange={(e) => setNivelMaximo(e.target.value as any)}
                        >
                            <option value="todos">Toda la estructura</option>
                            <option value="capitulo">Hasta Capítulos</option>
                            <option value="titulo">Hasta Títulos</option>
                        </select>
                    </div>

                    <div className="org-buscar-caja">
                        <Icono n="buscar" tam={14} />
                        <input
                            type="search"
                            placeholder="Buscar en el organigrama: art. 45, prescripción…"
                            value={filtroTexto}
                            onChange={(e) => setFiltroTexto(e.target.value)}
                        />
                        {filtroTexto && (
                            <span className="org-buscar-cuenta">
                                {nodosCoincidentes.size} coincidencia{nodosCoincidentes.size === 1 ? '' : 's'}
                            </span>
                        )}
                    </div>

                    <div className="org-acciones-arbol">
                        <button type="button" className="btn btn-fan btn-sm" onClick={plegarTodo} title="Colapsar todas las ramas">
                            Plegar todo
                        </button>
                        <button type="button" className="btn btn-fan btn-sm" onClick={desplegarTodo} title="Desplegar todas las ramas">
                            Desplegar todo
                        </button>
                    </div>

                    <div className="org-zoom-grupo">
                        <button
                            type="button"
                            className="btn-zoom"
                            onClick={() => {
                                const newZ = Math.max(0.15, Math.round((transformRef.current.zoom * 0.85) * 100) / 100);
                                setTransform((prev) => ({ ...prev, zoom: newZ }));
                            }}
                            title="Alejar (Zoom -)"
                        >
                            −
                        </button>
                        <button
                            type="button"
                            className="org-zoom-badge"
                            onClick={() => setTransform((prev) => ({ ...prev, zoom: 1 }))}
                            title="Restablecer zoom a 100%"
                        >
                            {Math.round(transform.zoom * 100)}%
                        </button>
                        <button
                            type="button"
                            className="btn-zoom"
                            onClick={() => {
                                const newZ = Math.min(3.0, Math.round((transformRef.current.zoom * 1.15) * 100) / 100);
                                setTransform((prev) => ({ ...prev, zoom: newZ }));
                            }}
                            title="Acercar (Zoom +)"
                        >
                            +
                        </button>
                        <button
                            type="button"
                            className="btn btn-fan btn-sm"
                            onClick={ajustarVista}
                            style={{ padding: '3px 8px', fontSize: 11.5 }}
                            title="Ajustar todo el organigrama a la pantalla"
                        >
                            Ajustar
                        </button>
                    </div>

                    <span className="espacio" />

                    <button
                        type="button"
                        className="btn btn-sec btn-sm"
                        onClick={exportarSvg}
                        title="Exportar organigrama como gráfico vectorial SVG"
                    >
                        Exportar SVG
                    </button>

                    <button
                        type="button"
                        className="btn btn-fan btn-icono btn-sm"
                        onClick={() => setPantallaCompleta((p) => !p)}
                        title={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
                        aria-label={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
                    >
                        <Icono n={pantallaCompleta ? 'minimizar' : 'maximizar'} tam={15} />
                    </button>
                </div>

                {/* Lienzo del Organigrama */}
                <div
                    ref={lienzoRef}
                    className={`org-lienzo${arrastrando ? ' arrastrando' : ''}`}
                    onMouseDown={alBajarMouse}
                    onMouseMove={alMoverMouse}
                    onMouseUp={alSubirMouse}
                    onMouseLeave={alSubirMouse}
                >
                    <div
                        className="org-lienzo-capa"
                        style={{
                            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
                        }}
                    >
                        <svg
                            ref={svgRef}
                            xmlns="http://www.w3.org/2000/svg"
                            role="group"
                            aria-label={`Organigrama de ${ley.nombre}`}
                            width={disp.ancho}
                            height={disp.alto}
                            viewBox={`0 0 ${disp.ancho} ${disp.alto}`}
                            fontFamily={FUENTE_DIAGRAMA}
                        >
                            <defs>
                                <filter id={`${flechaId}sombra`} x="-15%" y="-15%" width="130%" height="130%">
                                    <feDropShadow
                                        dx="0"
                                        dy="3"
                                        stdDeviation="3.5"
                                        floodColor={esOscuro ? '#000000' : '#0f172a'}
                                        floodOpacity={esOscuro ? 0.6 : 0.08}
                                    />
                                </filter>
                                <filter id={`${flechaId}sel`} x="-25%" y="-25%" width="150%" height="150%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="5.5" floodColor={primario} floodOpacity={esOscuro ? 0.9 : 0.6} />
                                    <feDropShadow dx="0" dy="2" stdDeviation="8" floodColor={primario} floodOpacity={esOscuro ? 0.45 : 0.3} />
                                </filter>

                                {(Object.keys(ESTILO_NIVEL) as (NivelLey | 'ley')[]).map((lvl) => {
                                    const col = ESTILO_NIVEL[lvl];
                                    const grad = esOscuro ? col.degradeOscuro : col.degrade;
                                    return (
                                        <linearGradient key={lvl} id={`${flechaId}grad-${lvl}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={grad[0]} />
                                            <stop offset="100%" stopColor={grad[1]} />
                                        </linearGradient>
                                    );
                                })}
                            </defs>

                            {/* Fondo del SVG */}
                            <rect width={disp.ancho} height={disp.alto} fill="transparent" />

                            {/* Conexiones / Enlaces ortogonales tipo flujograma */}
                            {disp.enlaces.map((e) => {
                                const coincideDe = tieneFiltro && nodosCoincidentes.has(e.de);
                                const coincideA = tieneFiltro && nodosCoincidentes.has(e.a);
                                const esActiva = selId === e.a || selId === e.de;
                                const opacidad = tieneFiltro ? (coincideDe || coincideA ? 1 : 0.18) : 1;

                                return (
                                    <path
                                        key={`${e.de}->${e.a}`}
                                        d={e.d}
                                        fill="none"
                                        stroke={esActiva ? primario : esOscuro ? '#475569' : '#cbd5e1'}
                                        strokeWidth={esActiva ? 2.6 : 1.7}
                                        opacity={opacidad}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        pointerEvents="none"
                                    />
                                );
                            })}

                            {/* Nodos del Organigrama */}
                            {disp.nodos.map((n) => {
                                const esSel = selId === n.id;
                                const col = ESTILO_NIVEL[n.nivel];
                                const coincide = tieneFiltro && nodosCoincidentes.has(n.id);
                                const opacidad = tieneFiltro ? (coincide ? 1 : 0.25) : 1;

                                const bordeColor = esSel ? primario : esOscuro ? col.bordeOscuro : col.borde;
                                const fondoFill = `url(#${flechaId}grad-${n.nivel})`;
                                const textoColor = esOscuro ? col.textoOscuro : col.texto;
                                const badgeFondo = esOscuro ? col.badgeFondoOscuro : col.badgeFondo;
                                const badgeTexto = esOscuro ? col.badgeTextoOscuro : col.badgeTexto;
                                const textoSuave = esOscuro ? col.textoSuaveOscuro : col.textoSuave;

                                /* ---------- RENDERIZADO: Recuadro con Lista de Artículos ---------- */
                                if (n.esListaArticulos && n.articulosLista) {
                                    const articulos = n.articulosLista;
                                    const cantArt = articulos.length;
                                    const itemsPorPag = 6;
                                    const totalPags = Math.ceil(cantArt / itemsPorPag);
                                    const pagActual = paginasArticulos[n.id] ?? 0;
                                    const inicio = pagActual * itemsPorPag;
                                    const visibles = articulos.slice(inicio, inicio + itemsPorPag);

                                    return (
                                        <g
                                            key={n.id}
                                            className="org-svg-nodo org-card-articulos"
                                            transform={`translate(${n.x} ${n.y})`}
                                            role="region"
                                            aria-label={`Lista de artículos de ${n.cab}`}
                                            opacity={opacidad}
                                            filter={`url(#${flechaId}sombra)`}
                                        >
                                            {/* Fondo de la tarjeta de artículos */}
                                            <rect
                                                width={n.w}
                                                height={n.h}
                                                rx={10}
                                                fill={esOscuro ? '#121824' : '#ffffff'}
                                                stroke={esOscuro ? '#2d3a4f' : '#cbd5e1'}
                                                strokeWidth={1.4}
                                            />

                                            {/* Cabecera del contenedor de artículos */}
                                            <rect
                                                x={0}
                                                y={0}
                                                width={n.w}
                                                height={32}
                                                rx={10}
                                                fill={esOscuro ? '#1a2232' : '#f1f5f9'}
                                            />
                                            <rect
                                                x={0}
                                                y={16}
                                                width={n.w}
                                                height={16}
                                                fill={esOscuro ? '#1a2232' : '#f1f5f9'}
                                            />
                                            <line
                                                x1={0}
                                                y1={32}
                                                x2={n.w}
                                                y2={32}
                                                stroke={esOscuro ? '#2d3a4f' : '#e2e8f0'}
                                                strokeWidth={1}
                                            />

                                            {/* Insignia y contador en cabecera */}
                                            <text
                                                x={10}
                                                y={21}
                                                fontSize={11}
                                                fontWeight={750}
                                                fill={primario}
                                                letterSpacing="0.03em"
                                            >
                                                ARTÍCULOS ({cantArt})
                                            </text>
                                            <text
                                                x={n.w - 10}
                                                y={21}
                                                textAnchor="end"
                                                fontSize={10}
                                                fontWeight={600}
                                                fill={textoSuave}
                                            >
                                                {n.meta}
                                            </text>

                                            {/* Lista de filas de artículos interactivos */}
                                            {visibles.map((art, idx) => {
                                                const esSelArt = selId === art.n.id;
                                                const rowY = 38 + idx * 26;
                                                const titArt = art.n.titulo || 'Sin rubro';
                                                const titRecortado = titArt.length > 20 ? `${titArt.slice(0, 19)}…` : titArt;

                                                return (
                                                    <g
                                                        key={art.n.id}
                                                        className="org-art-fila-svg"
                                                        transform={`translate(6, ${rowY})`}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onElegir(art.n.id, art.n.pagina);
                                                            setPanelVisible(true);
                                                        }}
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <rect
                                                            width={n.w - 12}
                                                            height={23}
                                                            rx={5}
                                                            fill={esSelArt ? primario : esOscuro ? '#182130' : '#f8fafc'}
                                                            stroke={esSelArt ? primario : esOscuro ? '#273449' : '#e2e8f0'}
                                                            strokeWidth={esSelArt ? 1.5 : 1}
                                                        />
                                                        {/* Número del artículo */}
                                                        <text
                                                            x={8}
                                                            y={15.5}
                                                            fontSize={11}
                                                            fontWeight={750}
                                                            fill={esSelArt ? '#ffffff' : primario}
                                                            pointerEvents="none"
                                                        >
                                                            {art.n.numero ? `Art. ${art.n.numero}` : 'Art.'}
                                                        </text>
                                                        {/* Título / Rubro del artículo */}
                                                        <text
                                                            x={54}
                                                            y={15.5}
                                                            fontSize={10.5}
                                                            fontWeight={600}
                                                            fill={esSelArt ? '#ffffff' : esOscuro ? '#e2e8f0' : '#1e293b'}
                                                            pointerEvents="none"
                                                        >
                                                            {titRecortado}
                                                        </text>
                                                        {/* Página */}
                                                        <text
                                                            x={n.w - 20}
                                                            y={15.5}
                                                            textAnchor="end"
                                                            fontSize={9.5}
                                                            fontWeight={500}
                                                            fill={esSelArt ? 'rgba(255,255,255,0.85)' : esOscuro ? '#8194b3' : '#64748b'}
                                                            pointerEvents="none"
                                                        >
                                                            p.{art.n.pagina}
                                                        </text>
                                                    </g>
                                                );
                                            })}

                                            {/* Paginación si supera el límite por página */}
                                            {totalPags > 1 && (
                                                <g transform={`translate(8, ${n.h - 25})`}>
                                                    <g
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (pagActual > 0) {
                                                                setPaginasArticulos((prev) => ({ ...prev, [n.id]: pagActual - 1 }));
                                                            }
                                                        }}
                                                        style={{ cursor: pagActual > 0 ? 'pointer' : 'default', opacity: pagActual > 0 ? 1 : 0.35 }}
                                                    >
                                                        <rect width={20} height={18} rx={4} fill={esOscuro ? '#222d3f' : '#e2e8f0'} />
                                                        <text x={10} y={13} textAnchor="middle" fontSize={12} fontWeight={800} fill={esOscuro ? '#cbd5e1' : '#334155'}>‹</text>
                                                    </g>
                                                    <text
                                                        x={n.w / 2 - 8}
                                                        y={13}
                                                        textAnchor="middle"
                                                        fontSize={10}
                                                        fontWeight={700}
                                                        fill={textoSuave}
                                                    >
                                                        {inicio + 1}–{Math.min(inicio + itemsPorPag, cantArt)} de {cantArt}
                                                    </text>
                                                    <g
                                                        transform={`translate(${n.w - 36}, 0)`}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (pagActual < totalPags - 1) {
                                                                setPaginasArticulos((prev) => ({ ...prev, [n.id]: pagActual + 1 }));
                                                            }
                                                        }}
                                                        style={{ cursor: pagActual < totalPags - 1 ? 'pointer' : 'default', opacity: pagActual < totalPags - 1 ? 1 : 0.35 }}
                                                    >
                                                        <rect width={20} height={18} rx={4} fill={esOscuro ? '#222d3f' : '#e2e8f0'} />
                                                        <text x={10} y={13} textAnchor="middle" fontSize={12} fontWeight={800} fill={esOscuro ? '#cbd5e1' : '#334155'}>›</text>
                                                    </g>
                                                </g>
                                            )}
                                        </g>
                                    );
                                }

                                /* ---------- RENDERIZADO: Nodos Estructurales (Ley, Libro, Título, Cap., Sec., Subsec.) ---------- */
                                const lineasTitulo = partirTexto(n.titulo, n.esRaizLey ? 28 : 22, 2);

                                return (
                                    <g
                                        key={n.id}
                                        className="org-svg-nodo"
                                        transform={`translate(${n.x} ${n.y})`}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`${n.cab}${n.titulo ? ` · ${n.titulo}` : ''}`}
                                        opacity={opacidad}
                                        filter={esSel ? `url(#${flechaId}sel)` : `url(#${flechaId}sombra)`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!n.esRaizLey) {
                                                onElegir(n.id, n.pagina);
                                                setPanelVisible(true);
                                            }
                                        }}
                                        onKeyDown={(e) => teclasNodo(e, n)}
                                        style={{ cursor: n.esRaizLey ? 'default' : 'pointer' }}
                                    >
                                        <title>{`${n.cab} ${n.titulo ? `· ${n.titulo} ` : ''}· Pág. ${n.pagina}${n.meta ? ` (${n.meta})` : ''}`}</title>

                                        {/* Tarjeta del nodo */}
                                        <rect
                                            width={n.w}
                                            height={n.h}
                                            rx={10}
                                            fill={fondoFill}
                                            stroke={bordeColor}
                                            strokeWidth={esSel ? 2.6 : 1.6}
                                        />

                                        {/* Barra superior de acento */}
                                        <rect
                                            x={0}
                                            y={0}
                                            width={n.w}
                                            height={3.5}
                                            rx={2}
                                            fill={bordeColor}
                                        />

                                        {/* Insignia de nivel (p. ej. "LIBRO I", "TÍTULO II") */}
                                        <rect
                                            x={10}
                                            y={10}
                                            width={Math.min(n.w - 60, Math.max(50, n.cab.length * 7 + 14))}
                                            height={18}
                                            rx={4}
                                            fill={badgeFondo}
                                        />
                                        <text
                                            x={17}
                                            y={23}
                                            fontSize={10.5}
                                            fontWeight={750}
                                            fill={badgeTexto}
                                            letterSpacing="0.04em"
                                            pointerEvents="none"
                                        >
                                            {n.cab.toUpperCase()}
                                        </text>

                                        {/* Pág. */}
                                        <text
                                            x={n.w - 12}
                                            y={23}
                                            textAnchor="end"
                                            fontSize={10.5}
                                            fontWeight={600}
                                            fill={textoSuave}
                                            pointerEvents="none"
                                        >
                                            pág. {n.pagina}
                                        </text>

                                        {/* Título de la norma o división (Texto Blanco para la raíz) */}
                                        <text
                                            x={12}
                                            y={45}
                                            fontSize={n.esRaizLey ? 13.5 : 12.5}
                                            fontWeight={750}
                                            fill={textoColor}
                                            pointerEvents="none"
                                        >
                                            {lineasTitulo.length === 0 ? (
                                                <tspan x={12} y={45} fontStyle="italic" fill={textoSuave} fontSize={11}>
                                                    Sin título especificado
                                                </tspan>
                                            ) : (
                                                lineasTitulo.map((l, i) => (
                                                    <tspan key={i} x={12} y={43 + i * 16}>
                                                        {l}
                                                    </tspan>
                                                ))
                                            )}
                                        </text>

                                        {/* Subtítulo / Rango de artículos (pie del nodo) */}
                                        {n.meta && (
                                            <text
                                                x={12}
                                                y={n.h - 10}
                                                fontSize={10}
                                                fontWeight={600}
                                                fill={textoSuave}
                                                pointerEvents="none"
                                            >
                                                {n.meta}
                                            </text>
                                        )}

                                        {/* Botón interactivo para plegar / desplegar ramas hijas (+ / −) */}
                                        {n.totalHijos > 0 && (
                                            <g
                                                className="org-nodo-btn-plegar"
                                                transform={`translate(${n.w - 30} ${n.h - 22})`}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={(e) => alternarPliegue(n.id, e)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <rect
                                                    x={-4}
                                                    y={-3}
                                                    width={26}
                                                    height={20}
                                                    rx={5}
                                                    fill={n.plegado ? primario : esOscuro ? '#1e2636' : '#e2e8f0'}
                                                    stroke={n.plegado ? primario : esOscuro ? '#475569' : '#cbd5e1'}
                                                    strokeWidth={1.2}
                                                />
                                                <text
                                                    x={9}
                                                    y={11.5}
                                                    textAnchor="middle"
                                                    fontSize={12}
                                                    fontWeight={850}
                                                    fill={n.plegado ? '#ffffff' : esOscuro ? '#cbd5e1' : '#1e293b'}
                                                    pointerEvents="none"
                                                >
                                                    {n.plegado ? '+' : '−'}
                                                </text>
                                            </g>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>

                    {/* Leyenda de colores por nivel (flotante inferior izquierda con Subsección) */}
                    <div className="org-leyenda">
                        <span className="org-leyenda-item" style={{ '--col': ESTILO_NIVEL.libro.borde } as any}>Libro</span>
                        <span className="org-leyenda-item" style={{ '--col': ESTILO_NIVEL.titulo.borde } as any}>Título</span>
                        <span className="org-leyenda-item" style={{ '--col': ESTILO_NIVEL.capitulo.borde } as any}>Capítulo</span>
                        <span className="org-leyenda-item" style={{ '--col': ESTILO_NIVEL.seccion.borde } as any}>Sección</span>
                        <span className="org-leyenda-item" style={{ '--col': ESTILO_NIVEL.subseccion.borde } as any}>Subsección</span>
                        {verArticulos && (
                            <span className="org-leyenda-item" style={{ '--col': ESTILO_NIVEL.articulo.borde } as any}>Artículos</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Panel lateral Inspector de nodo seleccionado */}
            {panelVisible && selId && (
                <aside className="org-inspector" aria-label="Inspector de normativa">
                    <div className="org-inspector-cab">
                        <div className="fila-chica">
                            <Insignia tono={nodoSeleccionado?.nivel === 'articulo' ? 'gris' : 'azul'}>
                                {nodoSeleccionado ? ETIQUETA_NIVEL[nodoSeleccionado.nivel] : 'Selección'}
                            </Insignia>
                            {nodoSeleccionado && <span className="suave">Pág. {nodoSeleccionado.pagina}</span>}
                            {nodoOrgActual && nodoSeleccionado?.nivel !== 'articulo' && (
                                <Insignia tono="verde">{rangoArticulos(nodoOrgActual)}</Insignia>
                            )}
                        </div>
                        <button
                            type="button"
                            className="btn btn-fan btn-icono btn-sm"
                            onClick={() => setPanelVisible(false)}
                            title="Ocultar inspector"
                            aria-label="Cerrar panel"
                        >
                            <Icono n="cerrar" tam={14} />
                        </button>
                    </div>

                    {/* Ruta de ancestros */}
                    {rutaSel.length > 0 && (
                        <nav className="ley-migas" aria-label="Ubicación en el organigrama">
                            {rutaSel.map((r) => (
                                <span key={r.id} className="ley-miga-par">
                                    <button
                                        type="button"
                                        className="ley-miga"
                                        title={etiquetaNodo(r)}
                                        onClick={() => {
                                            onElegir(r.id, r.pagina);
                                            centrarEnNodo(r.id);
                                        }}
                                    >
                                        {etiquetaNodo(r)}
                                    </button>
                                    <span aria-hidden="true">›</span>
                                </span>
                            ))}
                        </nav>
                    )}

                    <div className="org-inspector-titulo-bloque">
                        <h3>{nodoSeleccionado ? etiquetaNodo(nodoSeleccionado) : 'Cargando marcador…'}</h3>
                        {nodoSeleccionado?.titulo && (
                            <p className="org-inspector-rubro">{nodoSeleccionado.titulo}</p>
                        )}
                    </div>

                    {/* Acciones para citar y exportar */}
                    <div className="org-inspector-acciones">
                        <button type="button" className="btn btn-pri btn-sm" onClick={() => onCopiar('referencia')}>
                            Copiar referencia
                        </button>
                        <button type="button" className="btn btn-sec btn-sm" onClick={() => onCopiar('titulo')}>
                            Con título
                        </button>
                        <button
                            type="button"
                            className="btn btn-sec btn-sm"
                            disabled={!nodoSeleccionado?.texto}
                            onClick={() => onCopiar('texto')}
                        >
                            Texto citado
                        </button>
                        <button
                            type="button"
                            className="btn btn-fan btn-sm"
                            onClick={() => nodoSeleccionado && onVerPdf(nodoSeleccionado.pagina)}
                        >
                            Ver en PDF
                        </button>
                        {nodoSeleccionado && (
                            <button
                                type="button"
                                className="btn btn-fan btn-sm"
                                onClick={() => onEditarNodo(nodoSeleccionado)}
                            >
                                Editar
                            </button>
                        )}
                        <button type="button" className="btn btn-fan btn-sm" onClick={onVerLector} title="Abrir en visor lector">
                            Modo Lector
                        </button>
                    </div>

                    {/* Cuerpo del artículo o contenido de subdivisión */}
                    <div className="org-inspector-cuerpo">
                        {nodoSeleccionado?.nivel === 'articulo' ? (
                            nodoSeleccionado.texto ? (
                                <div className="ley-cuerpo">
                                    {nodoSeleccionado.texto
                                        .split('\n')
                                        .map((p) => p.trim())
                                        .filter(Boolean)
                                        .map((p, i) => (
                                            <p key={i} className={/^(?:\d{1,2}[.)°º]|[a-zñ]\)|[ivxl]+[.)]|[-•–—])\s/i.test(p) ? 'inciso' : undefined}>
                                                {p}
                                            </p>
                                        ))}
                                </div>
                            ) : (
                                <p className="suave" style={{ padding: '12px 0' }}>
                                    Este artículo no contiene texto extraído. Puedes pulsar «Editar» para pegarlo o «Ver en PDF».
                                </p>
                            )
                        ) : (
                            <div className="org-inspector-subelementos">
                                {nodoOrgActual && (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <h4 className="grupo-titulo" style={{ margin: 0 }}>
                                                Artículos en esta división ({nodoOrgActual.arts})
                                            </h4>
                                            <span className="suave" style={{ fontSize: 12 }}>
                                                {rangoArticulos(nodoOrgActual)}
                                            </span>
                                        </div>

                                        {/* Lista rápida de artículos contenidos */}
                                        <div className="ley-arts" style={{ maxHeight: 280, overflowY: 'auto' }}>
                                            {nodoOrgActual.hijos
                                                .filter((h) => h.n.nivel === 'articulo')
                                                .map((art) => (
                                                    <button
                                                        key={art.n.id}
                                                        type="button"
                                                        className={`ley-art${selId === art.n.id ? ' sel' : ''}`}
                                                        title={art.n.titulo || `Art. ${art.n.numero}`}
                                                        onClick={() => {
                                                            onElegir(art.n.id, art.n.pagina);
                                                            centrarEnNodo(art.n.id);
                                                        }}
                                                    >
                                                        <b>{art.n.numero}</b>
                                                        {art.n.titulo && <span>{art.n.titulo}</span>}
                                                    </button>
                                                ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Navegación anterior / siguiente */}
                    <div className="ley-nav">
                        <button
                            type="button"
                            className="btn btn-sec btn-sm"
                            disabled={!anterior}
                            onClick={() => {
                                if (anterior) {
                                    onElegir(anterior.id, anterior.pagina);
                                    centrarEnNodo(anterior.id);
                                }
                            }}
                        >
                            <span className="ley-nav-txt">← {anterior ? etiquetaNodo(anterior) : 'Anterior'}</span>
                        </button>
                        <button
                            type="button"
                            className="btn btn-sec btn-sm"
                            disabled={!siguiente}
                            onClick={() => {
                                if (siguiente) {
                                    onElegir(siguiente.id, siguiente.pagina);
                                    centrarEnNodo(siguiente.id);
                                }
                            }}
                        >
                            <span className="ley-nav-txt">{siguiente ? etiquetaNodo(siguiente) : 'Siguiente'} →</span>
                        </button>
                    </div>
                </aside>
            )}
        </div>
    );
}
