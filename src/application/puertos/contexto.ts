export interface ConstructorContexto {
    construir(expedienteId: string, datosFormulario: Record<string, unknown>): Promise<Record<string, unknown>>;
}