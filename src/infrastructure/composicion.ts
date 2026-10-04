import { documentDir, join } from '@tauri-apps/api/path';
import { AdjuntarVersionEditada } from '../application/casosDeUso/adjuntarVersionEditada';
import {
    AlternarModeloActivo, ConvertirModeloAEditable, DuplicarModelo, EditarDatosModelo,
    InstalarPlantillaInicial, VerModelo,
} from '../application/casosDeUso/administrarModelos';
import { AgregarParte } from '../application/casosDeUso/agregarParte';
import { Buscar } from '../application/casosDeUso/buscar';
import { CrearExpediente } from '../application/casosDeUso/crearExpediente';
import { CrearInmueble } from '../application/casosDeUso/crearInmueble';
import { CrearPersona } from '../application/casosDeUso/crearPersona';
import { GenerarDocumento } from '../application/casosDeUso/generarDocumento';
import { ActualizarExpediente, QuitarParte } from '../application/casosDeUso/gestionExpediente';
import { ActualizarPersona, EliminarPersona } from '../application/casosDeUso/gestionPersona';
import { ImportarModelo } from '../application/casosDeUso/importarModelo';
import { Configuracion } from '../application/configuracion';
import { Consultas } from '../application/consultas';
import { validarRutaCatalogo } from '../domain/catalogo';
import { ArchivosTauri } from './archivos/adaptadorTauri';
import { DbTauri } from './db/adaptadorTauri';
import { ConstructorContextoDb } from './db/constructorContexto';
import { RepositorioModelosDb } from './db/repositorioModelos';
import { GeneradorDocxFflate } from './docx/generarDocx';
import { LectorDocxFflate } from './docx/leerModelo';
import { MotorDocx } from './docx/motor/motor';
import { FormatoPaqueteFflate } from './docx/paqueteModelo';
import { EliminarDocumento, EliminarExpediente, EliminarModelo } from '../application/casosDeUso/eliminar';

export interface Servicios {
    raiz: string;
    db: DbTauri;
    archivos: ArchivosTauri;
    config: Configuracion;
    consultas: Consultas;
    contexto: ConstructorContextoDb;
    crearExpediente: CrearExpediente;
    actualizarExpediente: ActualizarExpediente;
    crearPersona: CrearPersona;
    actualizarPersona: ActualizarPersona;
    eliminarPersona: EliminarPersona;
    agregarParte: AgregarParte;
    quitarParte: QuitarParte;
    crearInmueble: CrearInmueble;
    importarModelo: ImportarModelo;
    verModelo: VerModelo;
    editarDatosModelo: EditarDatosModelo;
    alternarModeloActivo: AlternarModeloActivo;
    duplicarModelo: DuplicarModelo;
    convertirModelo: ConvertirModeloAEditable;
    instalarPlantilla: InstalarPlantillaInicial;
    generarDocumento: GenerarDocumento;
    adjuntarVersion: AdjuntarVersionEditada;
    buscar: Buscar;
    eliminarDocumento: EliminarDocumento;
    eliminarExpediente: EliminarExpediente;
    eliminarModelo: EliminarModelo;
}

export async function crearServicios(): Promise<Servicios> {
    const db = new DbTauri();
    const config = new Configuracion(db);
    const cfg = await config.cargar();
    const raiz = cfg.carpetaRaiz ?? (await join(await documentDir(), 'Legal-Hub'));

    const archivos = new ArchivosTauri(raiz);
    const motor = new MotorDocx({ validarRuta: validarRutaCatalogo });
    const formato = new FormatoPaqueteFflate();
    const generador = new GeneradorDocxFflate();
    const lector = new LectorDocxFflate();
    const modelos = new RepositorioModelosDb(db, archivos, formato);
    const contexto = new ConstructorContextoDb(db, config);
    const importarModelo = new ImportarModelo({ db, archivos, motor, formato, modelos, generador });

    return {
        raiz, db, archivos, config, contexto,
        consultas: new Consultas(db),
        crearExpediente: new CrearExpediente(db),
        actualizarExpediente: new ActualizarExpediente(db),
        crearPersona: new CrearPersona(db),
        actualizarPersona: new ActualizarPersona(db),
        eliminarPersona: new EliminarPersona(db),
        agregarParte: new AgregarParte(db),
        quitarParte: new QuitarParte(db),
        crearInmueble: new CrearInmueble(db),
        importarModelo,
        verModelo: new VerModelo({ modelos, lector }),
        editarDatosModelo: new EditarDatosModelo(db),
        alternarModeloActivo: new AlternarModeloActivo(db),
        duplicarModelo: new DuplicarModelo({ db, modelos, importar: importarModelo }),
        convertirModelo: new ConvertirModeloAEditable({ db, modelos, lector, importar: importarModelo }),
        instalarPlantilla: new InstalarPlantillaInicial(importarModelo),
        generarDocumento: new GenerarDocumento({ db, archivos, modelos, contexto, motor }),
        adjuntarVersion: new AdjuntarVersionEditada({ db, archivos, motor }),
        buscar: new Buscar(db),
        eliminarDocumento: new EliminarDocumento(db),
        eliminarExpediente: new EliminarExpediente(db),
        eliminarModelo: new EliminarModelo(db),
    };
}