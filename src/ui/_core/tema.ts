// src/ui/_core/tema.ts
import { useEffect, useState } from 'react';

export type TemaId = 'oxford' | 'slate' | 'rose';
export type Tema = TemaId | 'claro' | 'oscuro';

export interface InfoTema {
  id: TemaId;
  nombre: string;
  subtitulo: string;
  colorDot: string;
}

export const TEMAS_DISPONIBLES: InfoTema[] = [
  {
    id: 'oxford',
    nombre: 'Oxford Editorial',
    subtitulo: 'Claro Clásico & Distinguido',
    colorDot: '#1D4ED8'
  },
  {
    id: 'slate',
    nombre: 'Slate Dusk',
    subtitulo: 'Pizarra Suave Anti-fatiga',
    colorDot: '#60A5FA'
  },
  {
    id: 'rose',
    nombre: 'Rose Quartz Boutique',
    subtitulo: 'Ejecutivo Chic & Marfil Cálido',
    colorDot: '#9D4466'
  }
];

const CLAVE_TEMA = 'legalhub_tema';
const oyentes = new Set<(t: TemaId) => void>();

/** Normaliza alias anteriores ('claro' -> 'oxford', 'oscuro' -> 'slate'). */
export function normalizarTema(val: string | null | undefined): TemaId {
  if (val === 'rose' || val === 'rose-quartz') return 'rose';
  if (val === 'slate' || val === 'oscuro') return 'slate';
  return 'oxford';
}

/** Lee el tema actual desde localStorage o preferencia del sistema. */
export function obtenerTemaActual(): TemaId {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA) || localStorage.getItem('legalhub_active_theme');
    if (guardado) return normalizarTema(guardado);
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'slate';
    }
  } catch {
    // fallback seguro
  }
  return 'oxford';
}

/** Establece el tema en el documento y notifica a los componentes suscritos. */
export function fijarTema(nuevo: Tema): void {
  const norm = normalizarTema(nuevo);
  try {
    localStorage.setItem(CLAVE_TEMA, norm);
    localStorage.setItem('legalhub_active_theme', norm);
  } catch {
    // ignore
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-tema', norm);
  }
  oyentes.forEach((fn) => fn(norm));
}

/** Alterna cíclicamente entre Oxford -> Slate -> Rose -> Oxford. */
export function alternarTema(): TemaId {
  const actual = obtenerTemaActual();
  let siguiente: TemaId = 'oxford';
  if (actual === 'oxford') siguiente = 'slate';
  else if (actual === 'slate') siguiente = 'rose';
  else siguiente = 'oxford';

  fijarTema(siguiente);
  return siguiente;
}

/** Hook reactivo para acceder y modificar el tema en cualquier componente. */
export function useTema(): [TemaId, (t: Tema) => void, () => TemaId] {
  const [tema, setTemaState] = useState<TemaId>(obtenerTemaActual);

  useEffect(() => {
    const oyente = (t: TemaId) => setTemaState(t);
    oyentes.add(oyente);
    document.documentElement.setAttribute('data-tema', tema);
    return () => {
      oyentes.delete(oyente);
    };
  }, [tema]);

  return [tema, fijarTema, alternarTema];
}
