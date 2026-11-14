// src/ui/_core/tema.ts
import { useEffect, useState } from 'react';

export type ColorScheme = 'light' | 'dark';
export type PrimaryId =
  | 'blue'
  | 'indigo'
  | 'emerald'
  | 'teal'
  | 'sky'
  | 'violet'
  | 'rose'
  | 'amber'
  | 'noir';
export type SurfaceId =
  | 'slate'
  | 'gray'
  | 'zinc'
  | 'neutral'
  | 'stone'
  | 'soho'
  | 'viva'
  | 'ocean'
  | 'rose';
export type PresetId = 'aura' | 'lara' | 'nora';
export type LayoutTheme = 'color-scheme' | 'primary';

export interface ConfigTema {
  colorScheme: ColorScheme;
  primary: PrimaryId;
  surface: SurfaceId;
  preset: PresetId;
  layoutTheme: LayoutTheme;
}

export interface InfoPrimario {
  id: PrimaryId;
  nombre: string;
  swatch: string;
  primario: string;
  primarioH: string;
  primarioOscuro: string;
  primarioHOscuro: string;
  primarioInkOscuro: string;
  rgb: string;
  dorado: string;
  doradoBg: string;
  doradoBorde: string;
  navBg: string;
  navSolido: string;
  navPopover: string;
  navBorde: string;
  navTexto: string;
  navTextoMutado: string;
  navTextoCab: string;
  navHover: string;
  navLogoBg: string;
  navLogoBorde: string;
  navLogoColor: string;
  barLightBg: string;
  barLightBg2: string;
  barLightBorde: string;
}

export interface EscalaSuperficie {
  bg: string;
  superficie: string;
  superficie2: string;
  superficie3: string;
  borde: string;
  bordeFuerte: string;
  texto: string;
  texto2: string;
  texto3: string;
  desk: string;
  reglaZona: string;
  reglaPapel: string;
  navBg: string;
  navSolido: string;
  navPopover: string;
  navBorde: string;
  navTexto: string;
  navMutado: string;
  navCab: string;
  navHover: string;
  navPillBg: string;
  barBg: string;
  barBg2: string;
  barBorde: string;
  barTexto: string;
  barTexto2: string;
  barTexto3: string;
}

export interface InfoSuperficie {
  id: SurfaceId;
  nombre: string;
  swatchFondo: string;
  swatchTarjeta: string;
  pgHojaClaro: string;
  pgHojaOscuro: string;
  claro: Omit<EscalaSuperficie, 'barBg' | 'barBg2' | 'barBorde' | 'barTexto' | 'barTexto2' | 'barTexto3'>;
  oscuro: EscalaSuperficie;
}

export interface InfoPreset {
  id: PresetId;
  nombre: string;
  descripcion: string;
  radioSm: string;
  radio: string;
  radioLg: string;
  sombraCardClaro: string;
  sombraCardOscuro: string;
}

export interface PerfilTema {
  id: string;
  nombre: string;
  subtitulo: string;
  config: ConfigTema;
}

const DORADO_INSTITUCIONAL = {
  dorado: '#b45309',
  doradoBg: 'rgba(217, 119, 6, 0.12)',
  doradoBorde: 'rgba(217, 119, 6, 0.30)',
} as const;

export const PRIMARIOS: InfoPrimario[] = [
  {
    id: 'blue',
    nombre: 'Cobalt',
    swatch: '#2563eb',
    primario: '#1d4ed8',
    primarioH: '#1e40af',
    primarioOscuro: '#2563eb',
    primarioHOscuro: '#3b82f6',
    primarioInkOscuro: '#60a5fa',
    rgb: '37, 99, 235',
    ...DORADO_INSTITUCIONAL,
    navBg: 'linear-gradient(180deg, #0e172f 0%, #080f21 100%)',
    navSolido: '#0e172f',
    navPopover: '#132042',
    navBorde: 'rgba(255, 255, 255, 0.09)',
    navTexto: '#d7e0f5',
    navTextoMutado: '#8a98bf',
    navTextoCab: '#9eadd6',
    navHover: 'rgba(255, 255, 255, 0.08)',
    navLogoBg: 'linear-gradient(135deg, #1e3a8a, #0b1329)',
    navLogoBorde: 'rgba(245, 158, 11, 0.45)',
    navLogoColor: '#fbbf24',
    barLightBg: '#122044',
    barLightBg2: '#1b2f61',
    barLightBorde: '#294485',
  },
  {
    id: 'indigo',
    nombre: 'Indigo',
    swatch: '#4f46e5',
    primario: '#4338ca',
    primarioH: '#3730a3',
    primarioOscuro: '#4f46e5',
    primarioHOscuro: '#6366f1',
    primarioInkOscuro: '#818cf8',
    rgb: '79, 70, 229',
    ...DORADO_INSTITUCIONAL,
    navBg: 'linear-gradient(180deg, #17153b 0%, #0f0e29 100%)',
    navSolido: '#17153b',
    navPopover: '#201d52',
    navBorde: 'rgba(224, 231, 255, 0.11)',
    navTexto: '#e0e7ff',
    navTextoMutado: '#9aa0d6',
    navTextoCab: '#b4bbf0',
    navHover: 'rgba(255, 255, 255, 0.08)',
    navLogoBg: 'linear-gradient(135deg, #3730a3, #17153b)',
    navLogoBorde: 'rgba(165, 180, 252, 0.48)',
    navLogoColor: '#c7d2fe',
    barLightBg: '#1c194a',
    barLightBg2: '#282466',
    barLightBorde: '#3d378f',
  },
  {
    id: 'emerald',
    nombre: 'Emerald',
    swatch: '#10b981',
    primario: '#047857',
    primarioH: '#065f46',
    primarioOscuro: '#059669',
    primarioHOscuro: '#10b981',
    primarioInkOscuro: '#34d399',
    rgb: '16, 185, 129',
    ...DORADO_INSTITUCIONAL,
    navBg: 'linear-gradient(180deg, #0b241d 0%, #061712 100%)',
    navSolido: '#0b241d',
    navPopover: '#11352b',
    navBorde: 'rgba(209, 250, 229, 0.11)',
    navTexto: '#d1fae5',
    navTextoMutado: '#7ebaa0',
    navTextoCab: '#9bd4bb',
    navHover: 'rgba(255, 255, 255, 0.08)',
    navLogoBg: 'linear-gradient(135deg, #065f46, #062119)',
    navLogoBorde: 'rgba(110, 231, 183, 0.45)',
    navLogoColor: '#6ee7b7',
    barLightBg: '#0c2b22',
    barLightBg2: '#133f32',
    barLightBorde: '#1e5c4a',
  },
  {
    id: 'teal',
    nombre: 'Teal',
    swatch: '#14b8a6',
    primario: '#0f766e',
    primarioH: '#115e59',
    primarioOscuro: '#0d9488',
    primarioHOscuro: '#14b8a6',
    primarioInkOscuro: '#2dd4bf',
    rgb: '20, 184, 166',
    ...DORADO_INSTITUCIONAL,
    navBg: 'linear-gradient(180deg, #0b2325 0%, #061617 100%)',
    navSolido: '#0b2325',
    navPopover: '#113336',
    navBorde: 'rgba(204, 251, 241, 0.11)',
    navTexto: '#ccfbf1',
    navTextoMutado: '#7db9b5',
    navTextoCab: '#9bd2ce',
    navHover: 'rgba(255, 255, 255, 0.08)',
    navLogoBg: 'linear-gradient(135deg, #115e59, #071e20)',
    navLogoBorde: 'rgba(94, 234, 212, 0.45)',
    navLogoColor: '#5eead4',
    barLightBg: '#0c2a2d',
    barLightBg2: '#133d41',
    barLightBorde: '#1f5a60',
  },
  {
    id: 'sky',
    nombre: 'Sky',
    swatch: '#0ea5e9',
    primario: '#0369a1',
    primarioH: '#075985',
    primarioOscuro: '#0284c7',
    primarioHOscuro: '#0ea5e9',
    primarioInkOscuro: '#38bdf8',
    rgb: '14, 165, 233',
    ...DORADO_INSTITUCIONAL,
    navBg: 'linear-gradient(180deg, #0b2136 0%, #071524 100%)',
    navSolido: '#0b2136',
    navPopover: '#11304d',
    navBorde: 'rgba(224, 242, 254, 0.11)',
    navTexto: '#e0f2fe',
    navTextoMutado: '#82b3d6',
    navTextoCab: '#a0cbe8',
    navHover: 'rgba(255, 255, 255, 0.08)',
    navLogoBg: 'linear-gradient(135deg, #075985, #081c2e)',
    navLogoBorde: 'rgba(125, 211, 252, 0.45)',
    navLogoColor: '#7dd3fc',
    barLightBg: '#0c2640',
    barLightBg2: '#13385c',
    barLightBorde: '#1d5285',
  },
  {
    id: 'violet',
    nombre: 'Violet',
    swatch: '#8b5cf6',
    primario: '#6d28d9',
    primarioH: '#5b21b6',
    primarioOscuro: '#7c3aed',
    primarioHOscuro: '#8b5cf6',
    primarioInkOscuro: '#a78bfa',
    rgb: '139, 92, 246',
    ...DORADO_INSTITUCIONAL,
    navBg: 'linear-gradient(180deg, #1d1438 0%, #130b26 100%)',
    navSolido: '#1d1438',
    navPopover: '#291c4f',
    navBorde: 'rgba(237, 233, 254, 0.11)',
    navTexto: '#ede9fe',
    navTextoMutado: '#a696d9',
    navTextoCab: '#c0b3ed',
    navHover: 'rgba(255, 255, 255, 0.08)',
    navLogoBg: 'linear-gradient(135deg, #5b21b6, #18102e)',
    navLogoBorde: 'rgba(196, 181, 253, 0.48)',
    navLogoColor: '#ddd6fe',
    barLightBg: '#231845',
    barLightBg2: '#322263',
    barLightBorde: '#4b338f',
  },
  {
    id: 'rose',
    nombre: 'Rose',
    swatch: '#b8466e',
    primario: '#9d4466',
    primarioH: '#833452',
    primarioOscuro: '#be406a',
    primarioHOscuro: '#d65681',
    primarioInkOscuro: '#f472b6',
    rgb: '190, 64, 106',
    dorado: '#a87650',
    doradoBg: 'rgba(200, 157, 124, 0.16)',
    doradoBorde: 'rgba(200, 157, 124, 0.35)',
    navBg: 'linear-gradient(180deg, #22111a 0%, #160810 100%)',
    navSolido: '#22111a',
    navPopover: '#2f1824',
    navBorde: 'rgba(244, 215, 222, 0.12)',
    navTexto: '#f3d6df',
    navTextoMutado: '#b8889a',
    navTextoCab: '#d1a3b4',
    navHover: 'rgba(244, 114, 182, 0.10)',
    navLogoBg: 'linear-gradient(135deg, #601e37, #1f0c16)',
    navLogoBorde: 'rgba(200, 157, 124, 0.60)',
    navLogoColor: '#fce7f3',
    barLightBg: '#2b1420',
    barLightBg2: '#3f1e2f',
    barLightBorde: '#5c2d45',
  },
  {
    id: 'amber',
    nombre: 'Amber',
    swatch: '#d97706',
    primario: '#b45309',
    primarioH: '#92400e',
    primarioOscuro: '#d97706',
    primarioHOscuro: '#f59e0b',
    primarioInkOscuro: '#fbbf24',
    rgb: '217, 119, 6',
    dorado: '#b45309',
    doradoBg: 'rgba(217, 119, 6, 0.16)',
    doradoBorde: 'rgba(217, 119, 6, 0.35)',
    navBg: 'linear-gradient(180deg, #24190d 0%, #170f07 100%)',
    navSolido: '#24190d',
    navPopover: '#332413',
    navBorde: 'rgba(254, 243, 199, 0.12)',
    navTexto: '#fef3c7',
    navTextoMutado: '#c7a474',
    navTextoCab: '#dfc092',
    navHover: 'rgba(255, 255, 255, 0.08)',
    navLogoBg: 'linear-gradient(135deg, #92400e, #24190d)',
    navLogoBorde: 'rgba(251, 191, 36, 0.5)',
    navLogoColor: '#fde68a',
    barLightBg: '#2d1e0f',
    barLightBg2: '#422c17',
    barLightBorde: '#634324',
  },
  {
    id: 'noir',
    nombre: 'Noir',
    swatch: '#334155',
    primario: '#1e293b',
    primarioH: '#0f172a',
    primarioOscuro: '#475569',
    primarioHOscuro: '#64748b',
    primarioInkOscuro: '#cbd5e1',
    rgb: '100, 116, 139',
    ...DORADO_INSTITUCIONAL,
    navBg: 'linear-gradient(180deg, #111318 0%, #090b0e 100%)',
    navSolido: '#111318',
    navPopover: '#1b1f27',
    navBorde: 'rgba(255, 255, 255, 0.10)',
    navTexto: '#e2e8f0',
    navTextoMutado: '#94a3b8',
    navTextoCab: '#b0bac9',
    navHover: 'rgba(255, 255, 255, 0.08)',
    navLogoBg: 'linear-gradient(135deg, #334155, #0f172a)',
    navLogoBorde: 'rgba(148, 163, 184, 0.45)',
    navLogoColor: '#f8fafc',
    barLightBg: '#161920',
    barLightBg2: '#232833',
    barLightBorde: '#373f4f',
  },
];

export const SUPERFICIES: InfoSuperficie[] = [
  {
    id: 'slate',
    nombre: 'Slate',
    swatchFondo: '#94a3b8',
    swatchTarjeta: '#f0f3f8',
    pgHojaClaro: '#f7f9fc',
    pgHojaOscuro: '#f8fafc',
    claro: {
      bg: '#e4e9f1',
      superficie: '#f0f3f8',
      superficie2: '#e6ebf3',
      superficie3: '#d7e0ec',
      borde: '#cbd5e3',
      bordeFuerte: '#b3c0d2',
      texto: '#131c2e',
      texto2: '#334155',
      texto3: '#52627a',
      desk: '#d2dae6',
      reglaZona: '#c5ccdc',
      reglaPapel: '#f0f3f8',
      navBg: 'linear-gradient(180deg, #f4f7fb 0%, #eaeff6 100%)',
      navSolido: '#eef2f8',
      navPopover: '#ffffff',
      navBorde: '#cbd5e3',
      navTexto: '#1e293b',
      navMutado: '#64748b',
      navCab: '#475569',
      navHover: 'rgba(15, 23, 42, 0.06)',
      navPillBg: 'rgba(15, 23, 42, 0.05)',
    },
    oscuro: {
      bg: '#0f172a',
      superficie: '#1e293b',
      superficie2: '#263349',
      superficie3: '#334155',
      borde: '#2f3d55',
      bordeFuerte: '#475569',
      texto: '#f1f5f9',
      texto2: '#cbd5e1',
      texto3: '#94a3b8',
      desk: '#131c2e',
      reglaZona: '#172033',
      reglaPapel: '#2b384e',
      navBg: 'linear-gradient(180deg, #162032 0%, #0f172a 100%)',
      navSolido: '#162032',
      navPopover: '#1e293b',
      navBorde: 'rgba(148, 163, 184, 0.16)',
      navTexto: '#e2e8f0',
      navMutado: '#94a3b8',
      navCab: '#94a3b8',
      navHover: 'rgba(255, 255, 255, 0.08)',
      navPillBg: 'rgba(255, 255, 255, 0.06)',
      barBg: '#182235',
      barBg2: '#24324a',
      barBorde: '#31415c',
      barTexto: '#f1f5f9',
      barTexto2: '#cbd5e1',
      barTexto3: '#94a3b8',
    },
  },
  {
    id: 'gray',
    nombre: 'Gray',
    swatchFondo: '#9ca3af',
    swatchTarjeta: '#f3f4f6',
    pgHojaClaro: '#f8f9fb',
    pgHojaOscuro: '#f9fafb',
    claro: {
      bg: '#e5e7eb',
      superficie: '#f3f4f6',
      superficie2: '#e9ebef',
      superficie3: '#dce0e6',
      borde: '#d1d5db',
      bordeFuerte: '#9ca3af',
      texto: '#111827',
      texto2: '#374151',
      texto3: '#6b7280',
      desk: '#d5d9e0',
      reglaZona: '#c7ccd4',
      reglaPapel: '#f3f4f6',
      navBg: 'linear-gradient(180deg, #f5f6f8 0%, #ebedf1 100%)',
      navSolido: '#f0f2f5',
      navPopover: '#ffffff',
      navBorde: '#d1d5db',
      navTexto: '#111827',
      navMutado: '#6b7280',
      navCab: '#4b5563',
      navHover: 'rgba(17, 24, 39, 0.06)',
      navPillBg: 'rgba(17, 24, 39, 0.05)',
    },
    oscuro: {
      bg: '#0d1117',
      superficie: '#161b22',
      superficie2: '#21262d',
      superficie3: '#2d333b',
      borde: '#30363d',
      bordeFuerte: '#484f58',
      texto: '#f3f4f6',
      texto2: '#d1d5db',
      texto3: '#9ca3af',
      desk: '#10141b',
      reglaZona: '#161b22',
      reglaPapel: '#29303a',
      navBg: 'linear-gradient(180deg, #141920 0%, #0b0e14 100%)',
      navSolido: '#141920',
      navPopover: '#1f2630',
      navBorde: 'rgba(209, 213, 219, 0.12)',
      navTexto: '#e5e7eb',
      navMutado: '#9ca3af',
      navCab: '#9ca3af',
      navHover: 'rgba(255, 255, 255, 0.08)',
      navPillBg: 'rgba(255, 255, 255, 0.06)',
      barBg: '#161b22',
      barBg2: '#21262d',
      barBorde: '#30363d',
      barTexto: '#f3f4f6',
      barTexto2: '#d1d5db',
      barTexto3: '#9ca3af',
    },
  },
  {
    id: 'zinc',
    nombre: 'Zinc',
    swatchFondo: '#a1a1aa',
    swatchTarjeta: '#f4f4f5',
    pgHojaClaro: '#f8f9fa',
    pgHojaOscuro: '#fafafa',
    claro: {
      bg: '#e5e6ea',
      superficie: '#f3f4f6',
      superficie2: '#e8eaee',
      superficie3: '#dcdfe5',
      borde: '#cfd3da',
      bordeFuerte: '#b6bcc6',
      texto: '#18181b',
      texto2: '#3f3f46',
      texto3: '#5a5a65',
      desk: '#d5d7dd',
      reglaZona: '#c8cbd3',
      reglaPapel: '#f3f4f6',
      navBg: 'linear-gradient(180deg, #f6f6f8 0%, #eceef2 100%)',
      navSolido: '#f1f2f5',
      navPopover: '#ffffff',
      navBorde: '#cfd3da',
      navTexto: '#18181b',
      navMutado: '#63636e',
      navCab: '#52525b',
      navHover: 'rgba(24, 24, 27, 0.06)',
      navPillBg: 'rgba(24, 24, 27, 0.05)',
    },
    oscuro: {
      bg: '#09090b',
      superficie: '#18181b',
      superficie2: '#232329',
      superficie3: '#2f2f37',
      borde: '#2e2e36',
      bordeFuerte: '#3f3f46',
      texto: '#fafafa',
      texto2: '#d4d4d8',
      texto3: '#a1a1aa',
      desk: '#111115',
      reglaZona: '#18181b',
      reglaPapel: '#2a2a32',
      navBg: 'linear-gradient(180deg, #141417 0%, #0c0c0f 100%)',
      navSolido: '#141417',
      navPopover: '#1e1e23',
      navBorde: 'rgba(255, 255, 255, 0.09)',
      navTexto: '#e4e4e7',
      navMutado: '#a1a1aa',
      navCab: '#a1a1aa',
      navHover: 'rgba(255, 255, 255, 0.08)',
      navPillBg: 'rgba(255, 255, 255, 0.06)',
      barBg: '#151519',
      barBg2: '#222228',
      barBorde: '#32323b',
      barTexto: '#fafafa',
      barTexto2: '#d4d4d8',
      barTexto3: '#a1a1aa',
    },
  },
  {
    id: 'neutral',
    nombre: 'Neutral',
    swatchFondo: '#a3a3a3',
    swatchTarjeta: '#f5f5f5',
    pgHojaClaro: '#fafafa',
    pgHojaOscuro: '#fafafa',
    claro: {
      bg: '#e5e5e5',
      superficie: '#f4f4f4',
      superficie2: '#eaeaea',
      superficie3: '#dcdcdc',
      borde: '#d4d4d4',
      bordeFuerte: '#a3a3a3',
      texto: '#171717',
      texto2: '#404040',
      texto3: '#666666',
      desk: '#d6d6d6',
      reglaZona: '#c8c8c8',
      reglaPapel: '#f4f4f4',
      navBg: 'linear-gradient(180deg, #f6f6f6 0%, #ececec 100%)',
      navSolido: '#f1f1f1',
      navPopover: '#ffffff',
      navBorde: '#d4d4d4',
      navTexto: '#171717',
      navMutado: '#666666',
      navCab: '#525252',
      navHover: 'rgba(23, 23, 23, 0.06)',
      navPillBg: 'rgba(23, 23, 23, 0.05)',
    },
    oscuro: {
      bg: '#0a0a0a',
      superficie: '#171717',
      superficie2: '#232323',
      superficie3: '#303030',
      borde: '#2e2e2e',
      bordeFuerte: '#454545',
      texto: '#f5f5f5',
      texto2: '#d4d4d4',
      texto3: '#a3a3a3',
      desk: '#111111',
      reglaZona: '#171717',
      reglaPapel: '#2a2a2a',
      navBg: 'linear-gradient(180deg, #141414 0%, #0b0b0b 100%)',
      navSolido: '#141414',
      navPopover: '#202020',
      navBorde: 'rgba(255, 255, 255, 0.10)',
      navTexto: '#e5e5e5',
      navMutado: '#a3a3a3',
      navCab: '#a3a3a3',
      navHover: 'rgba(255, 255, 255, 0.08)',
      navPillBg: 'rgba(255, 255, 255, 0.06)',
      barBg: '#161616',
      barBg2: '#242424',
      barBorde: '#333333',
      barTexto: '#f5f5f5',
      barTexto2: '#d4d4d4',
      barTexto3: '#a3a3a3',
    },
  },
  {
    id: 'stone',
    nombre: 'Stone',
    swatchFondo: '#a8a29e',
    swatchTarjeta: '#f5f3ef',
    pgHojaClaro: '#faf9f6',
    pgHojaOscuro: '#faf9f7',
    claro: {
      bg: '#e9e5dd',
      superficie: '#f5f3ef',
      superficie2: '#ebe7e0',
      superficie3: '#dfd9ce',
      borde: '#d4cdc1',
      bordeFuerte: '#bdb4a6',
      texto: '#1c1917',
      texto2: '#44403c',
      texto3: '#68615b',
      desk: '#d9d4cb',
      reglaZona: '#ccc6bc',
      reglaPapel: '#f5f3ef',
      navBg: 'linear-gradient(180deg, #f7f5f1 0%, #edeae3 100%)',
      navSolido: '#f2efe9',
      navPopover: '#fcfbf8',
      navBorde: '#d4cdc1',
      navTexto: '#1c1917',
      navMutado: '#68615b',
      navCab: '#57534e',
      navHover: 'rgba(28, 25, 23, 0.06)',
      navPillBg: 'rgba(28, 25, 23, 0.05)',
    },
    oscuro: {
      bg: '#12100e',
      superficie: '#1f1c19',
      superficie2: '#2b2723',
      superficie3: '#37322d',
      borde: '#35302b',
      bordeFuerte: '#4a433d',
      texto: '#f5f5f4',
      texto2: '#d6d3d1',
      texto3: '#a8a29e',
      desk: '#171412',
      reglaZona: '#1f1c19',
      reglaPapel: '#322d28',
      navBg: 'linear-gradient(180deg, #1a1715 0%, #110f0d 100%)',
      navSolido: '#1a1715',
      navPopover: '#26221e',
      navBorde: 'rgba(231, 229, 228, 0.10)',
      navTexto: '#e7e5e4',
      navMutado: '#a8a29e',
      navCab: '#a8a29e',
      navHover: 'rgba(255, 255, 255, 0.08)',
      navPillBg: 'rgba(255, 255, 255, 0.06)',
      barBg: '#1b1815',
      barBg2: '#292521',
      barBorde: '#3b352f',
      barTexto: '#f5f5f4',
      barTexto2: '#d6d3d1',
      barTexto3: '#a8a29e',
    },
  },
  {
    id: 'soho',
    nombre: 'Soho',
    swatchFondo: '#a59fc4',
    swatchTarjeta: '#f1eff8',
    pgHojaClaro: '#f8f7fc',
    pgHojaOscuro: '#faf9fc',
    claro: {
      bg: '#e5e3ef',
      superficie: '#f1eff8',
      superficie2: '#e7e4f2',
      superficie3: '#d8d4e8',
      borde: '#cbc6de',
      bordeFuerte: '#b2abc9',
      texto: '#18162a',
      texto2: '#393556',
      texto3: '#5a557a',
      desk: '#d5d2e3',
      reglaZona: '#c7c3d8',
      reglaPapel: '#f1eff8',
      navBg: 'linear-gradient(180deg, #f5f4fa 0%, #ebe9f4 100%)',
      navSolido: '#efedf7',
      navPopover: '#ffffff',
      navBorde: '#cbc6de',
      navTexto: '#18162a',
      navMutado: '#625d82',
      navCab: '#4a456b',
      navHover: 'rgba(24, 22, 42, 0.06)',
      navPillBg: 'rgba(24, 22, 42, 0.05)',
    },
    oscuro: {
      bg: '#12101c',
      superficie: '#1d1a2b',
      superficie2: '#28243b',
      superficie3: '#342f4d',
      borde: '#322d47',
      bordeFuerte: '#463f63',
      texto: '#f3f1fb',
      texto2: '#d2cee8',
      texto3: '#9f99bd',
      desk: '#161423',
      reglaZona: '#1d1a2b',
      reglaPapel: '#302b47',
      navBg: 'linear-gradient(180deg, #181526 0%, #100e1b 100%)',
      navSolido: '#181526',
      navPopover: '#231f36',
      navBorde: 'rgba(221, 214, 254, 0.11)',
      navTexto: '#e5e2f5',
      navMutado: '#9f99bd',
      navCab: '#a9a3c7',
      navHover: 'rgba(255, 255, 255, 0.08)',
      navPillBg: 'rgba(255, 255, 255, 0.06)',
      barBg: '#1a1729',
      barBg2: '#26223c',
      barBorde: '#383256',
      barTexto: '#f3f1fb',
      barTexto2: '#d2cee8',
      barTexto3: '#9f99bd',
    },
  },
  {
    id: 'viva',
    nombre: 'Viva',
    swatchFondo: '#8197b8',
    swatchTarjeta: '#eef3fa',
    pgHojaClaro: '#f8fafe',
    pgHojaOscuro: '#f8fafc',
    claro: {
      bg: '#dfe6f2',
      superficie: '#eef3fa',
      superficie2: '#e3ebf6',
      superficie3: '#d3dfef',
      borde: '#c4d2e6',
      bordeFuerte: '#9fb3d1',
      texto: '#111c33',
      texto2: '#314266',
      texto3: '#53678f',
      desk: '#cdd8ea',
      reglaZona: '#bfcce0',
      reglaPapel: '#eef3fa',
      navBg: 'linear-gradient(180deg, #f2f6fc 0%, #e7eef8 100%)',
      navSolido: '#ecf2fa',
      navPopover: '#ffffff',
      navBorde: '#c4d2e6',
      navTexto: '#111c33',
      navMutado: '#53678f',
      navCab: '#3b4e75',
      navHover: 'rgba(17, 28, 51, 0.06)',
      navPillBg: 'rgba(17, 28, 51, 0.05)',
    },
    oscuro: {
      bg: '#081224',
      superficie: '#0e1b33',
      superficie2: '#152544',
      superficie3: '#1e3259',
      borde: '#22365c',
      bordeFuerte: '#344f82',
      texto: '#eef4ff',
      texto2: '#c7d6f0',
      texto3: '#8da4cc',
      desk: '#0c162b',
      reglaZona: '#0e1b33',
      reglaPapel: '#21355c',
      navBg: 'linear-gradient(180deg, #0c182e 0%, #071020 100%)',
      navSolido: '#0c182e',
      navPopover: '#142442',
      navBorde: 'rgba(147, 197, 253, 0.16)',
      navTexto: '#e2ecff',
      navMutado: '#8da4cc',
      navCab: '#a3b8db',
      navHover: 'rgba(255, 255, 255, 0.08)',
      navPillBg: 'rgba(255, 255, 255, 0.06)',
      barBg: '#0d1930',
      barBg2: '#17294a',
      barBorde: '#273f6b',
      barTexto: '#eef4ff',
      barTexto2: '#c7d6f0',
      barTexto3: '#8da4cc',
    },
  },
  {
    id: 'ocean',
    nombre: 'Ocean',
    swatchFondo: '#6ba3b5',
    swatchTarjeta: '#ebf4f7',
    pgHojaClaro: '#f6fafb',
    pgHojaOscuro: '#f8fbfc',
    claro: {
      bg: '#dce9ee',
      superficie: '#edf5f7',
      superficie2: '#e1eef2',
      superficie3: '#d0e3ea',
      borde: '#bfd5de',
      bordeFuerte: '#96b8c7',
      texto: '#0f232b',
      texto2: '#2d4b57',
      texto3: '#4c6f7d',
      desk: '#cadde4',
      reglaZona: '#bbd1da',
      reglaPapel: '#edf5f7',
      navBg: 'linear-gradient(180deg, #f1f7f9 0%, #e5eff3 100%)',
      navSolido: '#eaf3f6',
      navPopover: '#ffffff',
      navBorde: '#bfd5de',
      navTexto: '#0f232b',
      navMutado: '#4c6f7d',
      navCab: '#335866',
      navHover: 'rgba(15, 35, 43, 0.06)',
      navPillBg: 'rgba(15, 35, 43, 0.05)',
    },
    oscuro: {
      bg: '#08161d',
      superficie: '#0e222c',
      superficie2: '#15303d',
      superficie3: '#1e4050',
      borde: '#213f4d',
      bordeFuerte: '#325a6e',
      texto: '#edf7fa',
      texto2: '#c2dfe8',
      texto3: '#87b2bf',
      desk: '#0c1c24',
      reglaZona: '#0e222c',
      reglaPapel: '#1f4152',
      navBg: 'linear-gradient(180deg, #0c1d26 0%, #071319 100%)',
      navSolido: '#0c1d26',
      navPopover: '#142d3b',
      navBorde: 'rgba(125, 211, 252, 0.15)',
      navTexto: '#e0f2f7',
      navMutado: '#87b2bf',
      navCab: '#9ec5d1',
      navHover: 'rgba(255, 255, 255, 0.08)',
      navPillBg: 'rgba(255, 255, 255, 0.06)',
      barBg: '#0d1f29',
      barBg2: '#163140',
      barBorde: '#244759',
      barTexto: '#edf7fa',
      barTexto2: '#c2dfe8',
      barTexto3: '#87b2bf',
    },
  },
  {
    id: 'rose',
    nombre: 'Rose Quartz',
    swatchFondo: '#c4a6ab',
    swatchTarjeta: '#f4eeec',
    pgHojaClaro: '#fbf8f7',
    pgHojaOscuro: '#fbf9f8',
    claro: {
      bg: '#ebe2e0',
      superficie: '#f4eeec',
      superficie2: '#ece4e1',
      superficie3: '#dfd3cf',
      borde: '#d3c2be',
      bordeFuerte: '#bfa9a4',
      texto: '#2a1820',
      texto2: '#543742',
      texto3: '#72525e',
      desk: '#dfd2ce',
      reglaZona: '#d1c1bd',
      reglaPapel: '#f4eeec',
      navBg: 'linear-gradient(180deg, #f7f2f0 0%, #efe6e3 100%)',
      navSolido: '#f3ecea',
      navPopover: '#fcf9f8',
      navBorde: '#d3c2be',
      navTexto: '#2a1820',
      navMutado: '#72525e',
      navCab: '#543742',
      navHover: 'rgba(42, 24, 32, 0.06)',
      navPillBg: 'rgba(42, 24, 32, 0.05)',
    },
    oscuro: {
      bg: '#160d12',
      superficie: '#24161e',
      superficie2: '#301e28',
      superficie3: '#3d2733',
      borde: '#3b2531',
      bordeFuerte: '#543646',
      texto: '#f8edf1',
      texto2: '#e2c6d1',
      texto3: '#b88f9f',
      desk: '#1b1116',
      reglaZona: '#24161e',
      reglaPapel: '#38232f',
      navBg: 'linear-gradient(180deg, #1f1119 0%, #140a10 100%)',
      navSolido: '#1f1119',
      navPopover: '#2c1923',
      navBorde: 'rgba(244, 215, 222, 0.12)',
      navTexto: '#f3d6df',
      navMutado: '#b88f9f',
      navCab: '#cfa3b3',
      navHover: 'rgba(255, 255, 255, 0.08)',
      navPillBg: 'rgba(255, 255, 255, 0.06)',
      barBg: '#20131a',
      barBg2: '#2f1c26',
      barBorde: '#452a38',
      barTexto: '#f8edf1',
      barTexto2: '#e2c6d1',
      barTexto3: '#b88f9f',
    },
  },
];

export const PRESETS: InfoPreset[] = [
  {
    id: 'aura',
    nombre: 'Aura',
    descripcion: 'Equilibrado moderno con bordes finos y sombras limpias.',
    radioSm: '6px',
    radio: '10px',
    radioLg: '14px',
    sombraCardClaro: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.06)',
    sombraCardOscuro: '0 3px 10px rgba(8, 13, 24, 0.26)',
  },
  {
    id: 'lara',
    nombre: 'Lara',
    descripcion: 'Suave clásico con tarjetas más redondeadas y relieve envolvente.',
    radioSm: '8px',
    radio: '13px',
    radioLg: '18px',
    sombraCardClaro: '0 3px 10px -1px rgba(15, 23, 42, 0.09), 0 1px 3px rgba(15, 23, 42, 0.06)',
    sombraCardOscuro: '0 6px 18px rgba(8, 13, 24, 0.34)',
  },
  {
    id: 'nora',
    nombre: 'Nora',
    descripcion: 'Ejecutivo compacto con trazos rectos y mayor definición.',
    radioSm: '4px',
    radio: '6px',
    radioLg: '9px',
    sombraCardClaro: '0 1px 2px rgba(15, 23, 42, 0.07)',
    sombraCardOscuro: '0 2px 6px rgba(8, 13, 24, 0.28)',
  },
];

export const PERFILES_TEMAS: PerfilTema[] = [
  {
    id: 'oxford',
    nombre: 'Oxford Editorial',
    subtitulo: 'Light · Cobalt + Oxford Navy',
    config: { colorScheme: 'light', primary: 'blue', surface: 'slate', preset: 'aura', layoutTheme: 'primary' },
  },
  {
    id: 'verona-light',
    nombre: 'Verona Minimalista',
    subtitulo: 'Light · Indigo + Color Scheme',
    config: { colorScheme: 'light', primary: 'indigo', surface: 'zinc', preset: 'aura', layoutTheme: 'color-scheme' },
  },
  {
    id: 'slate',
    nombre: 'Midnight Slate',
    subtitulo: 'Dark · Cobalt + Slate',
    config: { colorScheme: 'dark', primary: 'blue', surface: 'slate', preset: 'aura', layoutTheme: 'color-scheme' },
  },
  {
    id: 'emerald-counsel',
    nombre: 'Verona Aura Dark',
    subtitulo: 'Dark · Emerald + Zinc',
    config: { colorScheme: 'dark', primary: 'emerald', surface: 'zinc', preset: 'aura', layoutTheme: 'color-scheme' },
  },
  {
    id: 'rose',
    nombre: 'Rose Boutique',
    subtitulo: 'Light · Rose + Plum Wine',
    config: { colorScheme: 'light', primary: 'rose', surface: 'rose', preset: 'lara', layoutTheme: 'primary' },
  },
];

const CLAVE_CONFIG = 'legalhub_tema_config_v2';
const CLAVE_LEGACY = 'legalhub_tema';
const oyentes = new Set<(c: ConfigTema) => void>();

function validarId<T extends string>(lista: readonly { id: T }[], v: unknown, fallback: T): T {
  return lista.some((item) => item.id === v) ? (v as T) : fallback;
}

function normalizarConfigTema(raw: Partial<ConfigTema>): ConfigTema {
  return {
    colorScheme: raw.colorScheme === 'dark' ? 'dark' : 'light',
    primary: validarId(PRIMARIOS, raw.primary, 'blue'),
    surface: validarId(SUPERFICIES, raw.surface, 'slate'),
    preset: validarId(PRESETS, raw.preset, 'aura'),
    layoutTheme: raw.layoutTheme === 'color-scheme' ? 'color-scheme' : 'primary',
  };
}

/** Migra un nombre de tema legado (versions v1) al modelo completo de 5 ejes. */
export function migrarTemaLegacy(val: string | null | undefined): ConfigTema {
  if (val === 'rose' || val === 'rose-quartz') return { ...PERFILES_TEMAS[4].config };
  if (val === 'slate' || val === 'oscuro') return { ...PERFILES_TEMAS[2].config };
  return { ...PERFILES_TEMAS[0].config };
}

/** Lee la configuración de tema persistida o detecta preferencia del sistema. */
export function obtenerConfigTema(): ConfigTema {
  try {
    const raw = localStorage.getItem(CLAVE_CONFIG);
    if (raw) {
      return normalizarConfigTema(JSON.parse(raw) as Partial<ConfigTema>);
    }
    const legacy = localStorage.getItem(CLAVE_LEGACY) || localStorage.getItem('legalhub_active_theme');
    if (legacy) return migrarTemaLegacy(legacy);
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return { ...PERFILES_TEMAS[2].config };
    }
  } catch {
    // fallback seguro
  }
  return { ...PERFILES_TEMAS[0].config };
}

/** Aplica todos los design tokens CSS y atributos semánticos sobre <html>. */
export function aplicarTemaAlDocumento(cfg: ConfigTema): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const p = PRIMARIOS.find((x) => x.id === cfg.primary) ?? PRIMARIOS[0];
  const s = SUPERFICIES.find((x) => x.id === cfg.surface) ?? SUPERFICIES[0];
  const pr = PRESETS.find((x) => x.id === cfg.preset) ?? PRESETS[0];
  const esOscuro = cfg.colorScheme === 'dark';
  const navClaro = !esOscuro && cfg.layoutTheme === 'color-scheme';

  root.setAttribute('data-color-scheme', cfg.colorScheme);
  root.setAttribute('data-primary', cfg.primary);
  root.setAttribute('data-surface', cfg.surface);
  root.setAttribute('data-preset', cfg.preset);
  root.setAttribute('data-layout-theme', cfg.layoutTheme);
  if (navClaro) root.setAttribute('data-nav-claro', 'true');
  else root.removeAttribute('data-nav-claro');

  const st = root.style;
  st.colorScheme = cfg.colorScheme;

  /* 1. Geometría del Preset */
  st.setProperty('--radio-sm', pr.radioSm);
  st.setProperty('--radio', pr.radio);
  st.setProperty('--radio-lg', pr.radioLg);

  if (esOscuro) {
    /* MODO OSCURO: Estilo Verona PrimeReact (Superficies oscuras coherentes por escala) */
    const d = s.oscuro;
    st.setProperty('--bg', d.bg);
    st.setProperty('--superficie', d.superficie);
    st.setProperty('--superficie-2', d.superficie2);
    st.setProperty('--superficie-3', d.superficie3);
    st.setProperty('--borde', d.borde);
    st.setProperty('--borde-fuerte', d.bordeFuerte);
    st.setProperty('--texto', d.texto);
    st.setProperty('--texto-2', d.texto2);
    st.setProperty('--texto-3', d.texto3);
    st.setProperty('--ed-desk', d.desk);
    st.setProperty('--regla-zona', d.reglaZona);
    st.setProperty('--regla-papel', d.reglaPapel);
    st.setProperty('--pg-hoja', s.pgHojaOscuro);

    /* Acento Primario calibrado para contraste oscuro */
    st.setProperty('--primario', p.primarioOscuro);
    st.setProperty('--primario-h', p.primarioHOscuro);
    st.setProperty('--primario-texto', p.primarioInkOscuro);
    st.setProperty('--primario-claro', `rgba(${p.rgb}, 0.16)`);
    st.setProperty('--primario-borde', `rgba(${p.rgb}, 0.38)`);
    st.setProperty('--dorado', '#fbbf24');
    st.setProperty('--dorado-bg', 'rgba(245, 158, 11, 0.16)');
    st.setProperty('--dorado-borde', 'rgba(251, 191, 36, 0.36)');

    /* Semántica calibrada para tarjetas oscuras */
    st.setProperty('--ok', '#4ade80');
    st.setProperty('--ok-bg', 'rgba(34, 197, 94, 0.16)');
    st.setProperty('--ok-borde', 'rgba(74, 222, 128, 0.34)');
    st.setProperty('--adv', '#fbbf24');
    st.setProperty('--adv-bg', 'rgba(245, 158, 11, 0.16)');
    st.setProperty('--adv-borde', 'rgba(251, 191, 36, 0.34)');
    st.setProperty('--err', '#fb7185');
    st.setProperty('--err-bg', 'rgba(244, 63, 94, 0.16)');
    st.setProperty('--err-borde', 'rgba(251, 113, 133, 0.34)');
    st.setProperty('--info', p.primarioInkOscuro);
    st.setProperty('--info-bg', `rgba(${p.rgb}, 0.16)`);
    st.setProperty('--info-borde', `rgba(${p.rgb}, 0.36)`);
    st.setProperty('--violeta', '#c084fc');
    st.setProperty('--violeta-bg', 'rgba(168, 85, 247, 0.16)');
    st.setProperty('--violeta-borde', 'rgba(192, 132, 252, 0.34)');

    /* Barras estructurales y Sidebar en Dark Color Scheme */
    st.setProperty('--bar-bg', d.barBg);
    st.setProperty('--bar-bg-2', d.barBg2);
    st.setProperty('--bar-borde', d.barBorde);
    st.setProperty('--bar-texto', d.barTexto);
    st.setProperty('--bar-texto-2', d.barTexto2);
    st.setProperty('--bar-texto-3', d.barTexto3);

    st.setProperty('--nav-bg', d.navBg);
    st.setProperty('--nav-bg-solido', d.navSolido);
    st.setProperty('--nav-popover-bg', d.navPopover);
    st.setProperty('--nav-borde', d.navBorde);
    st.setProperty('--nav-texto', d.navTexto);
    st.setProperty('--nav-texto-mutado', d.navMutado);
    st.setProperty('--nav-texto-cab', d.navCab);
    st.setProperty('--nav-hover', d.navHover);
    st.setProperty('--nav-hover-texto', '#ffffff');
    st.setProperty('--nav-titulo', d.barTexto);
    st.setProperty('--nav-pill-bg', d.navPillBg);
    st.setProperty('--nav-pill-borde', d.navBorde);
    st.setProperty('--nav-activo-bg', `linear-gradient(135deg, ${p.primarioOscuro} 0%, ${p.primario} 100%)`);
    st.setProperty('--nav-activo-texto', '#ffffff');
    st.setProperty('--nav-activo-sombra', `0 2px 12px rgba(${p.rgb}, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.18)`);
    st.setProperty('--nav-focus', p.primarioInkOscuro);
    st.setProperty('--nav-focus-halo', `rgba(${p.rgb}, 0.30)`);
    st.setProperty('--nav-badge-bg', p.primarioOscuro);
    st.setProperty('--nav-logo-bg', p.navLogoBg);
    st.setProperty('--nav-logo-borde', p.navLogoBorde);
    st.setProperty('--nav-logo-color', p.navLogoColor);

    st.setProperty('--sombra-xs', '0 1px 2px rgba(2, 6, 23, 0.35)');
    st.setProperty('--sombra', pr.sombraCardOscuro);
    st.setProperty('--sombra-md', '0 8px 24px rgba(2, 6, 23, 0.45)');
    st.setProperty('--sombra-lg', '0 20px 48px rgba(2, 6, 23, 0.62), 0 0 0 1px rgba(255, 255, 255, 0.06)');
  } else {
    /* MODO CLARO: Surface + Layout Theme */
    const l = s.claro;
    st.setProperty('--bg', l.bg);
    st.setProperty('--superficie', l.superficie);
    st.setProperty('--superficie-2', l.superficie2);
    st.setProperty('--superficie-3', l.superficie3);
    st.setProperty('--borde', l.borde);
    st.setProperty('--borde-fuerte', l.bordeFuerte);
    st.setProperty('--texto', l.texto);
    st.setProperty('--texto-2', l.texto2);
    st.setProperty('--texto-3', l.texto3);
    st.setProperty('--ed-desk', l.desk);
    st.setProperty('--regla-zona', l.reglaZona);
    st.setProperty('--regla-papel', l.reglaPapel);
    st.setProperty('--pg-hoja', s.pgHojaClaro);

    st.setProperty('--primario', p.primario);
    st.setProperty('--primario-h', p.primarioH);
    st.setProperty('--primario-texto', p.primario);
    st.setProperty('--primario-claro', `rgba(${p.rgb}, 0.11)`);
    st.setProperty('--primario-borde', `rgba(${p.rgb}, 0.30)`);
    st.setProperty('--dorado', p.dorado);
    st.setProperty('--dorado-bg', p.doradoBg);
    st.setProperty('--dorado-borde', p.doradoBorde);

    st.setProperty('--ok', '#047857');
    st.setProperty('--ok-bg', 'rgba(5, 150, 105, 0.11)');
    st.setProperty('--ok-borde', 'rgba(5, 150, 105, 0.28)');
    st.setProperty('--adv', '#b45309');
    st.setProperty('--adv-bg', 'rgba(217, 119, 6, 0.12)');
    st.setProperty('--adv-borde', 'rgba(217, 119, 6, 0.30)');
    st.setProperty('--err', '#b91c1c');
    st.setProperty('--err-bg', 'rgba(220, 38, 38, 0.10)');
    st.setProperty('--err-borde', 'rgba(220, 38, 38, 0.26)');
    st.setProperty('--info', p.primario);
    st.setProperty('--info-bg', `rgba(${p.rgb}, 0.11)`);
    st.setProperty('--info-borde', `rgba(${p.rgb}, 0.28)`);
    st.setProperty('--violeta', '#6d28d9');
    st.setProperty('--violeta-bg', 'rgba(109, 40, 217, 0.10)');
    st.setProperty('--violeta-borde', 'rgba(109, 40, 217, 0.26)');

    st.setProperty('--nav-activo-bg', `linear-gradient(135deg, ${p.swatch} 0%, ${p.primarioH} 100%)`);
    st.setProperty('--nav-activo-texto', '#ffffff');
    st.setProperty('--nav-activo-sombra', `0 2px 12px rgba(${p.rgb}, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.2)`);
    st.setProperty('--nav-focus', p.swatch);
    st.setProperty('--nav-focus-halo', `rgba(${p.rgb}, 0.28)`);
    st.setProperty('--nav-badge-bg', p.primario);

    st.setProperty('--sombra-xs', '0 1px 2px rgba(15, 23, 42, 0.06)');
    st.setProperty('--sombra', pr.sombraCardClaro);
    st.setProperty('--sombra-md', '0 4px 10px -1px rgba(15, 23, 42, 0.10), 0 2px 4px -2px rgba(15, 23, 42, 0.06)');
    st.setProperty('--sombra-lg', '0 12px 30px -4px rgba(15, 23, 42, 0.18), 0 4px 6px -2px rgba(15, 23, 42, 0.06)');

    if (cfg.layoutTheme === 'primary') {
      st.setProperty('--nav-bg', p.navBg);
      st.setProperty('--nav-bg-solido', p.navSolido);
      st.setProperty('--nav-popover-bg', p.navPopover);
      st.setProperty('--nav-borde', p.navBorde);
      st.setProperty('--nav-texto', p.navTexto);
      st.setProperty('--nav-texto-mutado', p.navTextoMutado);
      st.setProperty('--nav-texto-cab', p.navTextoCab);
      st.setProperty('--nav-hover', p.navHover);
      st.setProperty('--nav-hover-texto', '#ffffff');
      st.setProperty('--nav-titulo', '#ffffff');
      st.setProperty('--nav-pill-bg', 'rgba(255, 255, 255, 0.06)');
      st.setProperty('--nav-pill-borde', p.navBorde);
      st.setProperty('--nav-logo-bg', p.navLogoBg);
      st.setProperty('--nav-logo-borde', p.navLogoBorde);
      st.setProperty('--nav-logo-color', p.navLogoColor);

      st.setProperty('--bar-bg', p.barLightBg);
      st.setProperty('--bar-bg-2', p.barLightBg2);
      st.setProperty('--bar-borde', p.barLightBorde);
      st.setProperty('--bar-texto', '#f8fafc');
      st.setProperty('--bar-texto-2', '#cbd5e1');
      st.setProperty('--bar-texto-3', '#94a3b8');
    } else {
      st.setProperty('--nav-bg', l.navBg);
      st.setProperty('--nav-bg-solido', l.navSolido);
      st.setProperty('--nav-popover-bg', l.navPopover);
      st.setProperty('--nav-borde', l.navBorde);
      st.setProperty('--nav-texto', l.navTexto);
      st.setProperty('--nav-texto-mutado', l.navMutado);
      st.setProperty('--nav-texto-cab', l.navCab);
      st.setProperty('--nav-hover', l.navHover);
      st.setProperty('--nav-hover-texto', p.primario);
      st.setProperty('--nav-titulo', l.texto);
      st.setProperty('--nav-pill-bg', l.navPillBg);
      st.setProperty('--nav-pill-borde', l.borde);
      st.setProperty('--nav-logo-bg', `linear-gradient(135deg, ${p.swatch} 0%, ${p.primarioH} 100%)`);
      st.setProperty('--nav-logo-borde', `rgba(${p.rgb}, 0.35)`);
      st.setProperty('--nav-logo-color', '#ffffff');

      st.setProperty('--bar-bg', l.superficie);
      st.setProperty('--bar-bg-2', l.superficie2);
      st.setProperty('--bar-borde', l.borde);
      st.setProperty('--bar-texto', l.texto);
      st.setProperty('--bar-texto-2', l.texto2);
      st.setProperty('--bar-texto-3', l.texto3);
    }
  }
}

/** Persiste y aplica una nueva configuración de tema notificando a los suscriptores. */
export function guardarConfigTema(nueva: ConfigTema): void {
  const normalizada = normalizarConfigTema(nueva);
  try {
    localStorage.setItem(CLAVE_CONFIG, JSON.stringify(normalizada));
  } catch {
    // ignore
  }
  aplicarTemaAlDocumento(normalizada);
  oyentes.forEach((fn) => fn(normalizada));
}

export function actualizarConfigTema(parcial: Partial<ConfigTema>): ConfigTema {
  const siguiente = { ...obtenerConfigTema(), ...parcial };
  guardarConfigTema(siguiente);
  return siguiente;
}

export function aplicarPerfilTema(perfilId: string): ConfigTema | null {
  const encontrado = PERFILES_TEMAS.find((p) => p.id === perfilId);
  if (!encontrado) return null;
  guardarConfigTema({ ...encontrado.config });
  return { ...encontrado.config };
}

export function alternarColorScheme(): ColorScheme {
  const actual = obtenerConfigTema();
  const nuevo: ColorScheme = actual.colorScheme === 'dark' ? 'light' : 'dark';
  guardarConfigTema({ ...actual, colorScheme: nuevo });
  return nuevo;
}

/** Hook reactivo para leer y modificar la configuración del sistema de temas. */
export function useConfigTema(): {
  config: ConfigTema;
  esOscuro: boolean;
  actualizar: (parcial: Partial<ConfigTema>) => void;
  aplicarPerfil: (id: string) => void;
  alternarEsquema: () => ColorScheme;
} {
  const [config, setConfig] = useState<ConfigTema>(obtenerConfigTema);

  useEffect(() => {
    const oyente = (c: ConfigTema) => setConfig(c);
    oyentes.add(oyente);
    aplicarTemaAlDocumento(config);
    return () => {
      oyentes.delete(oyente);
    };
  }, [config]);

  return {
    config,
    esOscuro: config.colorScheme === 'dark',
    actualizar: (parcial) => {
      actualizarConfigTema(parcial);
    },
    aplicarPerfil: (id) => {
      aplicarPerfilTema(id);
    },
    alternarEsquema: alternarColorScheme,
  };
}

// Aplicación síncrona inicial para evitar parpadeos de color al arrancar.
aplicarTemaAlDocumento(obtenerConfigTema());
