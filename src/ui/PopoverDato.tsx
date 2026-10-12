import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function PopoverDato({ x, y, titulo, cerrar, children }: {
    x: number; y: number; titulo: string; cerrar: () => void; children: ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ left: x, top: y });

    useLayoutEffect(() => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        setPos({
            left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
            top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
        });
    }, [x, y]);

    useEffect(() => {
        ref.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    }, []);

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
        <div ref={ref} className="mk-pop" role="dialog" aria-label={titulo} style={pos}>
            <span className="mk-pop-tit">{titulo}</span>
            {children}
        </div>
    );
}