import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Muestra los inputs del campo directamente sobre el chip en el texto del documento.
 * No hay título, no hay tarjeta popup — los inputs flotan exactamente donde está el campo.
 */
export function EditorInline({ x, y, chip, cerrar, children }: {
    x: number; y: number; chip: HTMLElement; cerrar: () => void; children: ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);

    /* Posiciona el overlay alineado al inicio del chip, en la misma línea */
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const chipRect = chip.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        // Por defecto: alineado a la izquierda del chip, en la misma línea vertical
        let left = chipRect.left;
        let top = chipRect.top;
        // Ajustar si se sale por la derecha
        if (left + elRect.width > window.innerWidth - 8) {
            left = Math.max(8, window.innerWidth - elRect.width - 8);
        }
        // Ajustar si se sale por abajo: aparecer encima del chip
        if (top + elRect.height > window.innerHeight - 8) {
            top = chipRect.top - elRect.height - 4;
        }
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    }, [chip, x, y]);

    /* Enfoca el primer input al montar */
    useEffect(() => {
        ref.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    }, []);

    /* Cierra al hacer clic fuera o al presionar Escape / Enter */
    useEffect(() => {
        const abierto = Date.now();
        const fuera = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) cerrar();
        };
        const tecla = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement))) {
                e.preventDefault();
                cerrar();
            }
        };
        const desplazar = () => {
            if (Date.now() - abierto > 250) cerrar();
        };
        window.addEventListener('mousedown', fuera, true);
        window.addEventListener('keydown', tecla, true);
        window.addEventListener('resize', cerrar);
        window.addEventListener('scroll', desplazar, true);
        return () => {
            window.removeEventListener('mousedown', fuera, true);
            window.removeEventListener('keydown', tecla, true);
            window.removeEventListener('resize', cerrar);
            window.removeEventListener('scroll', desplazar, true);
        };
    }, [cerrar]);

    return (
        <div ref={ref} className="mk-inline-ed" role="group" aria-label="Editar dato">
            <div className="mk-pop-fila">
                {children}
            </div>
        </div>
    );
}
