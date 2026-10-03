
// domain/filtros/ci.ts
export function ci(datos: [string, string, string]): string {
  const [numero, complemento, expedido] = datos;
  
  if (!numero) return '';
  
  let resultado = numero.trim();
  
  if (complemento && complemento.trim() !== '') {
    resultado += '-' + complemento.trim();
  }
  
  if (expedido && expedido.trim() !== '') {
    resultado += ' ' + expedido.trim();
  }
  
  return resultado;
}
