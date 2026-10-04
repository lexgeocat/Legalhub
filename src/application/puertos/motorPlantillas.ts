export interface CampoEsquema {
  path: string;
  tipo: string;
  requerido: boolean;
  etiqueta: string;
  ambito: string[];
}

export interface ResultadoEscaneo {
  esValido: boolean;
  errores: string[];
  advertencias: string[];
  info: string[];
  esquema: CampoEsquema[];
}

export interface EntradaVerificacion {
  ruta: string;
  valor: string;
  opcionalVacio?: boolean;
}

export interface ResultadoRender {
  docx: Uint8Array;
  verificacion: EntradaVerificacion[];
}

export interface MotorPlantillas {
  escanear(plantilla: Uint8Array): ResultadoEscaneo;
  renderizar(plantilla: Uint8Array, contexto: Record<string, unknown>): Promise<ResultadoRender>;
  /** Texto plano de un .docx (para búsqueda). Lanza si el archivo no es un .docx válido. */
  textoPlano(docx: Uint8Array): string;
}