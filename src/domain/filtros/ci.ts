import { ErrorDeDatos } from '../errores';

export function ci(datos: unknown): string {
  if (!Array.isArray(datos)) {
    throw new ErrorDeDatos('El filtro ci espera [número, complemento, expedido]');
  }
  const [numero, complemento, expedido] = (datos as unknown[]).map((v) => String(v ?? '').trim());
  if (!numero) throw new ErrorDeDatos('C.I. sin número');
  return numero + (complemento ? `-${complemento}` : '') + (expedido ? ` ${expedido}` : '');
}