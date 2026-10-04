import { TemplateHandler, type TemplateData } from 'easy-template-x';
import type {
  EntradaVerificacion, MotorPlantillas, ResultadoEscaneo, ResultadoRender,
} from '../../../application/puertos/motorPlantillas';
import { ErrorDeDatos } from '../../../domain/filtros';
import { resolverCerrado } from '../resolver/resolverCerrado';
import { escanear, type OpcionesEscaneo } from '../scanner/escanner';
import { textoPlano } from '../textoPlano';

export class MotorDocx implements MotorPlantillas {
  constructor(private readonly opciones: OpcionesEscaneo = {}) { }

  escanear(plantilla: Uint8Array): ResultadoEscaneo {
    return escanear(plantilla, this.opciones);
  }

  textoPlano(docx: Uint8Array): string {
    return textoPlano(docx);
  }

  async renderizar(plantilla: Uint8Array, contexto: Record<string, unknown>): Promise<ResultadoRender> {
    const escaneo = escanear(plantilla, this.opciones);
    if (!escaneo.esValido) throw new ErrorDeDatos(`Modelo inválido: ${escaneo.errores.join('; ')}`);

    const verificacion: EntradaVerificacion[] = [];
    const handler = new TemplateHandler({
      delimiters: { tagStart: '{{', tagEnd: '}}', containerTagOpen: '#', containerTagClose: '/' },
      scopeDataResolver: resolverCerrado({ bitacora: verificacion }),
    });
    const entrada = plantilla.slice().buffer as ArrayBuffer;
    const salida = await handler.process(entrada, contexto as TemplateData);
    return { docx: new Uint8Array(salida), verificacion };
  }
}