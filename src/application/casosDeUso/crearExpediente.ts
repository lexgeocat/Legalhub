
// application/casosDeUso/crearExpediente.ts
import { Expediente } from '../entidades/expediente';

// Definimos la interfaz del puerto de base de datos que este caso de uso necesita
export interface DbPuertos {
  ejecutar(sql: string, params: any[]): Promise<{ cambios: number; lastInsertRowid?: string }>;
  transaccion(sentencias: Array<{ sql: string; params: any[] }>): Promise<Array<{ cambios: number }>>;
}

/**
 * Caso de uso para crear un nuevo expediente
 * No depende de frameworks específicos (React, Tauri, etc.)
 */
export class CrearExpediente {
  constructor(private dbPuertos: DbPuertos) {}

  async ejecutar(datos: Omit<Expediente, 'id' | 'codigo' | 'creadoEn' | 'actualizadoEn'>): Promise<Expediente> {
    const ahora = new Date().toISOString();
    
    // Primero, actualizamos o creamos el contador para el año actual
    const año = new Date().getFullYear();
    await this.dbPuertos.ejecutar(
      INSERT INTO contador (anio, ultimo) VALUES (?, 1) 
       ON CONFLICT(anio) DO UPDATE SET ultimo = ultimo + 1,
      [año]
    );
    
    // Luego, obtenemos el valor actual del contador para generar el código
    const resultadoContador = await this.dbPuertos.ejecutar(
      SELECT ultimo FROM contador WHERE anio = ?,
      [año]
    );
    
    // En una implementación real, obtendríamos el valor del resultado
    // Por ahora, usamos un valor placeholder
    const numeroSecuencial = 1; // Esto vendría del resultadoContador
    
    // Generamos el código del expediente: LH-AAAA-NNNN
    const codigo = LH--;
    
    // Creamos el expediente
    const expediente: Expediente = {
      id: this.generarId(), // En una implementación real, usaríamos ULID
      codigo,
      materia: datos.materia,
      referencia: datos.referencia ?? '',
      estado: 'abierto', // Siempre comienza como abierto
      juzgado: datos.juzgado ?? '',
      nroCausa: datos.nroCausa ?? '',
      clienteId: datos.clienteId,
      creadoEn: ahora,
      actualizadoEn: ahora
    };
    
    // Guardamos en la base de datos
    await this.dbPuertos.ejecutar(
      INSERT INTO expediente (
        id, codigo, materia, referencia, estado, juzgado, nro_causa, 
        cliente_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      [
        expediente.id,
        expediente.codigo,
        expediente.materia,
        expediente.referencia,
        expediente.estado,
        expediente.juzgado,
        expediente.nroCausa,
        expediente.clienteId,
        expediente.creadoEn,
        expediente.actualizadoEn
      ]
    );
    
    return expediente;
  }
  
  /**
   * Genera un ID único (en una implementación real sería ULID)
   * Placeholder para ahora
   */
  private generarId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}
