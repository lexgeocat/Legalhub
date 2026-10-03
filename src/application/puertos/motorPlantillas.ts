
// application/puertos.ts
export interface MotorPlantillas {
  escanear(plantilla: Uint8Array): Promise<any>;
  renderizar(plantilla: Uint8Array, contexto: any): Promise<Uint8Array>;
}
