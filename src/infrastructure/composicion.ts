import { documentDir, join } from '@tauri-apps/api/path';
import { ActualizarModeloDesdeDocumento } from '../application/casosDeUso/actualizarModeloDesdeDocumento';
import { AdjuntarVersionEditada } from '../application/casosDeUso/adjuntarVersionEditada';
import {
    AlternarModeloActivo, ConvertirModeloAEditable, DuplicarModelo, EditarDatosModelo,
    InstalarPlantillaInicial, VerModelo,
} from '../application/casosDeUso/administrarModelos';
import { AgregarParte } from '../application/casosDeUso/agregarParte';
import { Buscar } from '../application/casosDeUso/buscar';
import { CrearExpediente } from '../application/casosDeUso/crearExpediente';
import { CrearPersona } from '../application/casosDeUso/crearPersona';
import { EliminarDocumento, EliminarExpediente, EliminarModelo } from '../application/casosDeUso/eliminar';
import { GenerarDocumento } from '../application/casosDeUso/generarDocumento';
import { ActualizarDatosParte, ActualizarExpediente, QuitarParte } from '../application/casosDeUso/gestionExpediente';
import { ActualizarPersona, EliminarPersona, LimpiarPersonasSinVinculos, UnificarPersonas } from '../application/casosDeUso/gestionPersona';
import { ImportarModelo } from '../application/casosDeUso/importarModelo';
import { Configuracion } from '../application/configuracion';
import { Consultas } from '../application/consultas';
import type { LectorDocx } from '../application/puertos/modelos';
import { validarRutaCatalogo } from '../domain/expedientes/catalogo';
import { ArchivosTauri } from './archivos/adaptadorTauri';
import { DbTauri } from './db/adaptadorTauri';
import { ConstructorContextoDb } from './db/constructorContexto';
import { RepositorioModelosDb } from './db/repositorioModelos';
import { DbObservable } from './db/dbObservable';
import { GeneradorDocxFflate } from './docx/generarDocx';
import { IncrustadorFuentesDocx } from './docx/incrustarFuentes';
import { LectorDocxFflate } from './docx/leerModelo';
import { MotorDocx } from './docx/motor/motor';
import { FormatoPaqueteFflate } from './docx/paqueteModelo';
import { CargadorFuentesWeb } from './fuentes/cargadorFuentes';
import { Plantillas } from '../application/casosDeUso/plantillas';
import { Leyes } from '../application/casosDeUso/leyes';
import { LectorPdfPdfjs } from './pdf/lectorPdf';
import { Procedimientos } from '../application/casosDeUso/procedimientos';


export interface Servicios {
    raiz: string;
    db: DbObservable;
    archivos: ArchivosTauri;
    config: Configuracion;
    consultas: Consultas;
    contexto: ConstructorContextoDb;
    lector: LectorDocx;
    crearExpediente: CrearExpediente;
    actualizarExpediente: ActualizarExpediente;
    crearPersona: CrearPersona;
    actualizarPersona: ActualizarPersona;
    eliminarPersona: EliminarPersona;
    limpiarPersonas: LimpiarPersonasSinVinculos;
    unificarPersonas: UnificarPersonas;
    agregarParte: AgregarParte;
    quitarParte: QuitarParte;
    actualizarDatosParte: ActualizarDatosParte;
    importarModelo: ImportarModelo;
    verModelo: VerModelo;
    editarDatosModelo: EditarDatosModelo;
    alternarModeloActivo: AlternarModeloActivo;
    duplicarModelo: DuplicarModelo;
    convertirModelo: ConvertirModeloAEditable;
    instalarPlantilla: InstalarPlantillaInicial;
    plantillas: Plantillas;
    actualizarModelo: ActualizarModeloDesdeDocumento;
    generarDocumento: GenerarDocumento;
    adjuntarVersion: AdjuntarVersionEditada;
    buscar: Buscar;
    eliminarDocumento: EliminarDocumento;
    eliminarExpediente: EliminarExpediente;
    eliminarModelo: EliminarModelo;
    leyes: Leyes;
    procedimientos: Procedimientos;
}

export async function crearServicios(): Promise<Servicios> {
    const db = new DbObservable(new DbTauri());
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
    const incrustador = new IncrustadorFuentesDocx(new CargadorFuentesWeb());
    const importarModelo = new ImportarModelo({ db, archivos, motor, formato, modelos, generador });

    return {
        raiz, db, archivos, config, contexto, lector,
        consultas: new Consultas(db),
        crearExpediente: new CrearExpediente(db),
        actualizarExpediente: new ActualizarExpediente(db),
        crearPersona: new CrearPersona(db),
        actualizarPersona: new ActualizarPersona(db),
        eliminarPersona: new EliminarPersona(db),
        limpiarPersonas: new LimpiarPersonasSinVinculos(db),
        unificarPersonas: new UnificarPersonas(db),
        agregarParte: new AgregarParte(db),
        quitarParte: new QuitarParte(db),
        actualizarDatosParte: new ActualizarDatosParte(db),
        importarModelo,
        verModelo: new VerModelo({ modelos, lector }),
        editarDatosModelo: new EditarDatosModelo(db),
        alternarModeloActivo: new AlternarModeloActivo(db),
        duplicarModelo: new DuplicarModelo({ db, modelos, importar: importarModelo }),
        convertirModelo: new ConvertirModeloAEditable({ db, modelos, lector, importar: importarModelo }),
        instalarPlantilla: new InstalarPlantillaInicial(importarModelo),
        plantillas: new Plantillas({ db, archivos, modelos, formato, importar: importarModelo }),
        actualizarModelo: new ActualizarModeloDesdeDocumento({ modelos, generador, lector, motor, importar: importarModelo }),
        generarDocumento: new GenerarDocumento({ db, archivos, modelos, contexto, motor, incrustador, generador }),
        adjuntarVersion: new AdjuntarVersionEditada({ db, archivos, motor }),
        buscar: new Buscar(db),
        eliminarDocumento: new EliminarDocumento(db),
        eliminarExpediente: new EliminarExpediente(db),
        eliminarModelo: new EliminarModelo(db),
        leyes: new Leyes({ db, archivos, lector: new LectorPdfPdfjs() }),
        procedimientos: new Procedimientos(db),
    };
}