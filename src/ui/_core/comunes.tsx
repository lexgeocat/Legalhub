import { ask } from '@tauri-apps/plugin-dialog';
import type { SVGProps } from 'react';
import { useEffect, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import type { CampoEsquema } from '../../application/puertos/motorPlantillas';
import { CATEGORIAS_MODELO, MATERIAS_MODELO } from '../../domain/modelos/fuenteModelo';
import { TIPOS_EXPEDIENTE } from '../../domain/expedientes/tiposExpediente';
type DefIcono = { d: string; a?: string | true };
/* ---------------- Iconos ---------------- */
export const ICONOS = {
    carpeta: { d: 'M3 10h18 M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z', a: 'M3 10h18v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z' },
    personas: { d: 'M9.5 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z M3 20v-1.5A3.5 3.5 0 0 1 6.5 15h6a3.5 3.5 0 0 1 3.5 3.5V20 M18.5 15.2A3.5 3.5 0 0 1 21 18.5V20 M15.5 4.7a3.5 3.5 0 0 1 0 6.6', a: 'M9.5 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z' },
    documento: { d: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v4a1 1 0 0 0 1 1h4 M9 13h6 M9 17h4', a: 'M14 3v4a1 1 0 0 0 1 1h4z' },
    ajustes: { d: 'M4 7h6.5 M15.5 7H20 M4 17h1.5 M10.5 17H20 M13 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M8 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', a: 'M13 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M8 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
    engranaje: { d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z', a: true },
    buscar: { d: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20.5 20.5L16 16', a: true },
    mas: { d: 'M12 5v14 M5 12h14' },
    papelera: { d: 'M4 7h16 M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M6 7l.8 11.2A2 2 0 0 0 8.8 20h6.4a2 2 0 0 0 2-1.8L18 7 M10 11v5 M14 11v5', a: 'M6 7h12l-.8 11.2a2 2 0 0 1-2 1.8H8.8a2 2 0 0 1-2-1.8z' },
    editar: { d: 'M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5z M14.5 6l3.5 3.5', a: true },
    ok: { d: 'M5 12.5l4.5 4.5L19 7.5' },
    cerrar: { d: 'M6 6l12 12 M18 6L6 18' },
    atras: { d: 'M19 12H5 M11 6l-6 6 6 6' },
    alerta: { d: 'M21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z M12 9v4 M12 17h.01', a: true },
    balanza: { d: 'M12 4v16 M8 20h8 M4 7.5h16 M6 7.5L3 15a3 3 0 0 0 6 0z M18 7.5L15 15a3 3 0 0 0 6 0z', a: 'M3 15h6a3 3 0 0 1-6 0z M15 15h6a3 3 0 0 1-6 0z' },
    libro: { d: 'M5 5.5A2.5 2.5 0 0 1 7.5 3H19v14H7.5A2.5 2.5 0 0 0 5 19.5z M5 19.5A2.5 2.5 0 0 0 7.5 22H19v-5 M9 7.5h6 M9 11h4', a: 'M5 5.5A2.5 2.5 0 0 1 7.5 3H19v14H7.5A2.5 2.5 0 0 0 5 19.5z' },
    diccionarios: { d: 'M5 5.5A2.5 2.5 0 0 1 7.5 3H19v18H7.5A2.5 2.5 0 0 1 5 18.5z M5 18.5A2.5 2.5 0 0 1 7.5 16H19 M9.5 12.5L12 6.5l2.5 6 M10.4 10.5h3.2', a: 'M5 18.5A2.5 2.5 0 0 1 7.5 16H19v5H7.5A2.5 2.5 0 0 1 5 18.5z' },
    flujo: { d: 'M6 8.5v7 M18 8.5V10a5 5 0 0 1-5 5H6 M6 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M18 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M6 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', a: 'M6 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M18 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M6 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
    chevronIzquierda: { d: 'M15 6l-6 6 6 6' },
    chevronDerecha: { d: 'M9 6l6 6-6 6' },
    chevronAbajo: { d: 'M6 9l6 6 6-6' },
    panelColapsar: { d: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M9 4v16 M16 9l-3 3 3 3', a: 'M5 4h4v16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
    panelExpandir: { d: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M9 4v16 M13 9l3 3-3 3', a: 'M5 4h4v16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
    sol: { d: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2.5v2 M12 19.5v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2.5 12h2 M19.5 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4', a: true },
    luna: { d: 'M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a8 8 0 0 0 10.7 10.7z', a: true },
    pluma: { d: 'M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z M12 19l7-7 3 3-7 7z M2 2l7.6 7.6 M11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', a: 'M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z' },
    maximizar: { d: 'M8 3H5a2 2 0 0 0-2 2v3 M16 3h3a2 2 0 0 1 2 2v3 M8 21H5a2 2 0 0 1-2-2v-3 M16 21h3a2 2 0 0 0 2-2v-3' },
    minimizar: { d: 'M8 3v3a2 2 0 0 1-2 2H3 M21 8h-3a2 2 0 0 1-2-2V3 M3 16h3a2 2 0 0 1 2 2v3 M16 21v-3a2 2 0 0 1 2-2h3' },
    tribunal: { d: 'M12 3L3 8.5h18z M7 11.5V18 M12 11.5V18 M17 11.5V18 M5 18h14 M3 21h18', a: 'M12 3L3 8.5h18z' },
    calendario: { d: 'M7 3v3 M17 3v3 M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M3 10h18 M8 15h.01 M12 15h.01 M16 15h.01', a: 'M5 5h14a2 2 0 0 1 2 2v3H3V7a2 2 0 0 1 2-2z' },
    filtro: { d: 'M3 4.5h18l-7 8.2V19l-4 2v-8.3z', a: true },
    rayo: { d: 'M13 2.5L4.5 13.5H11l-1 8L19.5 10.5H13z', a: true },
} satisfies Record<string, DefIcono>;
export type NombreIcono = keyof typeof ICONOS;

interface IconoProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
    n: NombreIcono;
    tam?: number | string;
    trazo?: number;
    variante?: 'duotono' | 'lineal';
    titulo?: string;
}

export function Icono({ n, tam = 20, trazo = 1.5, variante = 'duotono', titulo, ...resto }: IconoProps) {
    const { d, a }: DefIcono = ICONOS[n];
    const acento = a === true ? d : a;
    return (
        <svg
            viewBox="0 0 24 24"
            width={tam}
            height={tam}
            fill="none"
            stroke="currentColor"
            strokeWidth={trazo}
            strokeLinecap="round"
            strokeLinejoin="round"
            role={titulo ? 'img' : undefined}
            aria-hidden={titulo ? undefined : true}
            {...resto}
        >
            {titulo && <title>{titulo}</title>}
            {variante === 'duotono' && acento && (
                <path d={acento} fill="currentColor" fillOpacity={0.16} stroke="none" fillRule="evenodd" />
            )}
            <path d={d} />
        </svg>
    );
}

/* ---------------- Insignias ---------------- */
export type Tono = 'azul' | 'verde' | 'ambar' | 'rojo' | 'gris' | 'violeta';

export function Insignia({ tono = 'gris', children }: { tono?: Tono; children: ReactNode }) {
    return <span className={`insignia i-${tono}`}>{children}</span>;
}

export const ESTADOS = ['abierto', 'en_tramite', 'suspendido', 'cerrado', 'archivado'];
export const ETIQUETA_ESTADO: Record<string, string> = {
    abierto: 'Abierto', en_tramite: 'En trámite', suspendido: 'Suspendido', cerrado: 'Cerrado', archivado: 'Archivado',
};
const TONO_ESTADO: Record<string, Tono> = {
    abierto: 'azul', en_tramite: 'violeta', suspendido: 'ambar', cerrado: 'gris', archivado: 'gris',
};

export function EstadoInsignia({ estado }: { estado: string }) {
    return <Insignia tono={TONO_ESTADO[estado] ?? 'gris'}>{ETIQUETA_ESTADO[estado] ?? estado}</Insignia>;
}

export const etiquetaTipo = (clave: string): string => TIPOS_EXPEDIENTE.find((t) => t.clave === clave)?.etiqueta ?? clave;
export const etiquetaMateria = (clave: string): string =>
    MATERIAS_MODELO.find((m) => m.clave === clave)?.etiqueta ?? etiquetaTipo(clave);

/* ---------------- Avisos ---------------- */
export function Aviso({ error }: { error: string | null }) {
    return error ? (
        <div className="aviso aviso-error" role="alert">
            <Icono n="alerta" tam={16} />
            <span>{error}</span>
        </div>
    ) : null;
}

export function Alerta({ tipo, children }: { tipo: 'ok' | 'adv' | 'info' | 'error'; children: ReactNode }) {
    return (
        <div className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : undefined}>
            <Icono n={tipo === 'ok' ? 'ok' : 'alerta'} tam={16} />
            <div>{children}</div>
        </div>
    );
}

interface Notificacion { id: number; tipo: 'ok' | 'error' | 'info'; texto: string }
const oyentes = new Set<(n: Notificacion) => void>();
let siguiente = 0;

export function avisar(texto: string, tipo: Notificacion['tipo'] = 'ok'): void {
    const n: Notificacion = { id: ++siguiente, tipo, texto };
    oyentes.forEach((f) => f(n));
}

export function Notificaciones() {
    const [lista, setLista] = useState<Notificacion[]>([]);
    useEffect(() => {
        const f = (n: Notificacion) => {
            setLista((l) => [...l, n]);
            window.setTimeout(() => setLista((l) => l.filter((x) => x.id !== n.id)), n.tipo === 'error' ? 8000 : 3800);
        };
        oyentes.add(f);
        return () => {
            oyentes.delete(f);
        };
    }, []);
    return (
        <div className="toasts" aria-live="polite">
            {lista.map((n) => (
                <div key={n.id} className={`toast t-${n.tipo}`}>
                    <Icono n={n.tipo === 'error' ? 'alerta' : 'ok'} tam={16} />
                    <span>{n.texto}</span>
                </div>
            ))}
        </div>
    );
}

/* ---------------- Formularios ---------------- */
export function Campo({ etiqueta, children, ayuda, ancho }: { etiqueta: string; children: ReactNode; ayuda?: string; ancho?: boolean }) {
    return (
        <label className={`campo${ancho ? ' ancho' : ''}`}>
            <span className="campo-etiq">{etiqueta}</span>
            {children}
            {ayuda && <span className="campo-ayuda">{ayuda}</span>}
        </label>
    );
}

/** Campos del formulario sin los vacíos, con espacios recortados. */
export function datosDeForm(form: HTMLFormElement): Record<string, string> {
    return Object.fromEntries(
        [...new FormData(form)]
            .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
            .map(([k, v]) => [k, String(v).trim()]),
    );
}

/** «1234,50» → «1234.50» (solo si usa coma y no tiene punto). */
export function normalizarNumero(v: string): string {
    const t = v.trim().replace(/\s/g, '');
    return t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t;
}

export function SelectMateria(props: SelectHTMLAttributes<HTMLSelectElement>) {
    const actual = String(props.value ?? props.defaultValue ?? '');
    return (
        <select {...props}>
            <option value="">(cualquiera)</option>
            {MATERIAS_MODELO.map((m) => <option key={m.clave} value={m.clave}>{m.etiqueta}</option>)}
            {actual && !MATERIAS_MODELO.some((m) => m.clave === actual) && <option value={actual}>{etiquetaMateria(actual)}</option>}
        </select>
    );
}

export function SelectCategoria(props: SelectHTMLAttributes<HTMLSelectElement>) {
    const actual = String(props.value ?? props.defaultValue ?? '');
    return (
        <select {...props}>
            <option value="">(sin categoría)</option>
            {CATEGORIAS_MODELO.map((c) => <option key={c} value={c}>{c}</option>)}
            {actual && !CATEGORIAS_MODELO.includes(actual) && <option value={actual}>{actual}</option>}
        </select>
    );
}

export function Segmentado<T extends string>({ opciones, valor, cambiar }: {
    opciones: { id: T; etiqueta: string }[]; valor: T; cambiar: (v: T) => void;
}) {
    return (
        <div className="segmentado" role="group">
            {opciones.map((o) => (
                <button key={o.id} type="button" className={`seg-op${o.id === valor ? ' activa' : ''}`} onClick={() => cambiar(o.id)}>
                    {o.etiqueta}
                </button>
            ))}
        </div>
    );
}

/* ---------------- Estructura ---------------- */
export function Modal({ titulo, cerrar, children, pie, ancho = 'media' }: {
    titulo: string; cerrar: () => void; children: ReactNode; pie?: ReactNode;
    ancho?: 'chica' | 'media' | 'grande';
}) {
    useEffect(() => {
        const f = (e: KeyboardEvent) => {
            if (e.key === 'Escape') cerrar();
        };
        window.addEventListener('keydown', f);
        return () => window.removeEventListener('keydown', f);
    }, [cerrar]);
    return (
        <div className="modal-fondo" role="dialog" aria-modal="true" aria-label={titulo}>
            <div className={`modal-caja m-${ancho}`}>
                <header className="modal-cab">
                    <h2>{titulo}</h2>
                    <button type="button" className="btn btn-fan btn-icono" onClick={cerrar} aria-label="Cerrar">
                        <Icono n="cerrar" />
                    </button>
                </header>
                <div className="modal-cuerpo">{children}</div>
                {pie && <footer className="modal-pie">{pie}</footer>}
            </div>
        </div>
    );
}

export interface ItemPestana<T extends string> { id: T; etiqueta: string; contador?: number }

export function Pestanas<T extends string>({ items, activa, cambiar }: {
    items: ItemPestana<T>[]; activa: T; cambiar: (id: T) => void;
}) {
    return (
        <div className="pestanas" role="tablist">
            {items.map((i) => (
                <button key={i.id} type="button" role="tab" aria-selected={i.id === activa}
                    className={`pestana${i.id === activa ? ' activa' : ''}`} onClick={() => cambiar(i.id)}>
                    {i.etiqueta}
                    {i.contador !== undefined && <span className="contador">{i.contador}</span>}
                </button>
            ))}
        </div>
    );
}

export function Vacio({ titulo, texto, icono = 'documento', children }: {
    titulo: string; texto?: string; icono?: NombreIcono; children?: ReactNode;
}) {
    return (
        <div className="vacio">
            <div className="vacio-icono"><Icono n={icono} tam={22} /></div>
            <h3>{titulo}</h3>
            {texto && <p className="suave">{texto}</p>}
            {children && <div className="acciones">{children}</div>}
        </div>
    );
}

export function TablaEsquema({ esquema }: { esquema: CampoEsquema[] }) {
    if (esquema.length === 0) return <p className="suave">El modelo no usa ningún campo.</p>;
    return (
        <div className="tabla-wrap">
            <table className="tabla tabla-densa">
                <thead><tr><th>Campo</th><th>Tipo</th><th>Dónde</th><th /></tr></thead>
                <tbody>
                    {esquema.map((c, i) => (
                        <tr key={`${c.ambito.join('>')}|${c.path}|${i}`}>
                            <td><code>{c.path}</code></td>
                            <td>{c.tipo}</td>
                            <td className="suave">{c.ambito.length > 0 ? `dentro de ${c.ambito.map((a) => `#${a}`).join(' › ')}` : 'General'}</td>
                            <td>{c.requerido ? <Insignia>Obligatorio</Insignia> : <Insignia tono="ambar">Opcional</Insignia>}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ---------------- Utilidades ---------------- */
export async function copiarTexto(texto: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    } catch {
        /* respaldo */
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}

export async function confirmar(mensaje: string, titulo = 'Confirmar'): Promise<boolean> {
    try {
        return await ask(mensaje, { title: titulo, kind: 'warning', okLabel: 'Aceptar', cancelLabel: 'Cancelar' });
    } catch {
        return window.confirm(mensaje);
    }
}
/* ---------------- Cambios sin guardar (guarda de navegación) ---------------- */
let cambiosPendientes = false;
export const hayCambiosPendientes = (): boolean => cambiosPendientes;
export const marcarCambiosPendientes = (v: boolean): void => {
    cambiosPendientes = v;
};

/** true si se puede salir: no hay cambios pendientes o la persona aceptó descartarlos. */
export async function permitirSalir(): Promise<boolean> {
    if (!cambiosPendientes) return true;
    return confirmar('Hay cambios sin guardar. Quedará un borrador para restaurarlos al volver. ¿Salir?', 'Cambios sin guardar');
}

export function fechaHora(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function fechaCorta(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-BO', { dateStyle: 'medium' });
}