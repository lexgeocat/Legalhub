import { ask } from '@tauri-apps/plugin-dialog';
import { useEffect, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import type { CampoEsquema } from '../application/puertos/motorPlantillas';
import { CATEGORIAS_MODELO } from '../domain/fuenteModelo';
import { GRUPOS_TIPO, TIPOS_EXPEDIENTE } from '../domain/tiposExpediente';

/* ---------------- Iconos ---------------- */
const ICONOS = {
    carpeta: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    personas: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
    documento: 'M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6',
    ajustes: 'M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 4v6 M9 14v6',
    buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M21 21l-4.5-4.5',
    mas: 'M12 5v14 M5 12h14',
    papelera: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3',
    copiar: 'M9 9h11v11H9z M5 15V4h11',
    editar: 'M4 20h4L19 9l-4-4L4 16z M13 7l4 4',
    ok: 'M5 12l5 5 9-10',
    cerrar: 'M6 6l12 12 M18 6L6 18',
    atras: 'M19 12H5 M11 6l-6 6 6 6',
    alerta: 'M12 4l9 16H3z M12 10v4 M12 17h.01',
    balanza: 'M12 3v18 M6 21h12 M5 7h14 M5 7l-3 7a3 3 0 0 0 6 0z M19 7l-3 7a3 3 0 0 0 6 0z',
} as const;

export type NombreIcono = keyof typeof ICONOS;

export function Icono({ n, tam = 18 }: { n: NombreIcono; tam?: number }) {
    return (
        <svg className="icono" width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={ICONOS[n]} />
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
            {GRUPOS_TIPO.map((g) => (
                <optgroup key={g} label={g}>
                    {TIPOS_EXPEDIENTE.filter((t) => t.grupo === g).map((t) => (
                        <option key={t.clave} value={t.clave}>{t.etiqueta}</option>
                    ))}
                </optgroup>
            ))}
            {actual && !TIPOS_EXPEDIENTE.some((t) => t.clave === actual) && <option value={actual}>{actual}</option>}
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
    titulo: string; cerrar: () => void; children: ReactNode; pie?: ReactNode; ancho?: 'chica' | 'media' | 'grande';
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

export async function copiarConAviso(texto: string): Promise<void> {
    const ok = await copiarTexto(texto);
    avisar(ok ? 'Marcador copiado al portapapeles' : 'No se pudo copiar', ok ? 'ok' : 'error');
}

export async function confirmar(mensaje: string, titulo = 'Confirmar'): Promise<boolean> {
    try {
        return await ask(mensaje, { title: titulo, kind: 'warning', okLabel: 'Aceptar', cancelLabel: 'Cancelar' });
    } catch {
        return window.confirm(mensaje);
    }
}

export function fechaHora(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function fechaCorta(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-BO', { dateStyle: 'medium' });
}

export function iniciales(nombre: string): string {
    return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
}