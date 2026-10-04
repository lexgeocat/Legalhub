import { documentDir, join } from '@tauri-apps/api/path';
import { Configuracion } from '../application/configuracion';
import { Consultas } from '../application/consultas';
import { AdjuntarVersionEditada } from '../application/casosDeUso/adjuntarVersionEditada';
import { AgregarParte } from '../application/casosDeUso/agregarParte';
import { Buscar } from '../application/casosDeUso/buscar';
import { CrearExpediente } from '../application/casosDeUso/crearExpediente';
import { CrearInmueble } from '../application/casosDeUso/crearInmueble';
import { CrearPersona } from '../application/casosDeUso/crearPersona';
import { GenerarDocumento } from '../application/casosDeUso/generarDocumento';
import { ImportarModelo } from '../application/casosDeUso/importarModelo';
import { validarRutaCatalogo } from '../domain/catalogo';
import { ArchivosTauri } from './archivos/adaptadorTauri';
import { ConstructorContextoDb } from './db/constructorContexto';
import { DbTauri } from './db/adaptadorTauri';
import { RepositorioModelosDb } from './db/repositorioModelos';
import { MotorDocx } from './docx/motor/motor';
import { FormatoPaqueteFflate } from './docx/paqueteModelo';

export interface Servicios {
    raiz: string;
    db: DbTauri;
    archivos: ArchivosTauri;
    config: Configuracion;
    consultas: Consultas;
    contexto: ConstructorContextoDb;
    crearExpediente: CrearExpediente;
    crearPersona: CrearPersona;
    agregarParte: AgregarParte;
    crearInmueble: CrearInmueble;
    importarModelo: ImportarModelo;
    generarDocumento: GenerarDocumento;
    adjuntarVersion: AdjuntarVersionEditada;
    buscar: Buscar;
}

export async function crearServicios(): Promise<Servicios> {
    const db = new DbTauri();
    const config = new Configuracion(db);
    const cfg = await config.cargar();
    const raiz = cfg.carpetaRaiz ?? (await join(await documentDir(), 'Legal-Hub'));

    const archivos = new ArchivosTauri(raiz);
    const motor = new MotorDocx({ validarRuta: validarRutaCatalogo });
    const formato = new FormatoPaqueteFflate();
    const modelos = new RepositorioModelosDb(db, archivos, formato);
    const contexto = new ConstructorContextoDb(db, config);

    return {
        raiz, db, archivos, config, contexto,
        consultas: new Consultas(db),
        crearExpediente: new CrearExpediente(db),
        crearPersona: new CrearPersona(db),
        agregarParte: new AgregarParte(db),
        crearInmueble: new CrearInmueble(db),
        importarModelo: new ImportarModelo({ db, archivos, motor, formato, modelos }),
        generarDocumento: new GenerarDocumento({ db, archivos, modelos, contexto, motor }),
        adjuntarVersion: new AdjuntarVersionEditada({ db, archivos, motor }),
        buscar: new Buscar(db),
    };
}