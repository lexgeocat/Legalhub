use tauri::{AppHandle, Manager, State};
use rusqlite::{Connection, Error, Result, TransactionBehavior, types::{Value, ValueRef, Null}};
use std::sync::Mutex;
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::io::Read;
use std::time::SystemTime;
use hex;
use age;
use zip;
use sha2::{Sha256, Digest};

pub struct EstadoDb {
    conexion: Mutex<Connection>
}

#[derive(Debug, serde:Serialize)]
pub struct Fila {
    valores: HashMap<String, JsonValue>
}

#[derive(Debug, serde:Serialize)]
pub struct ResultadoEjecucion {
    cambios: u64,
    ultimo_id_fila: Option<String>
}

pub struct Sentencia {
    sql: String,
    params: Vec<JsonValue>
}

fn inicializar_db(ruta: &Path) -> Result<Connection, rusqlite::Error> {
    let db = Connection::open(ruta)?;
    db.execute(
        "PRAGMA foreign_keys = ON; 
         PRAGMA journal_mode = WAL; 
         PRAGMA busy_timeout = 5000",
        [],
    )?;
    Ok(db)
}

fn obtener_ruta_db(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let dir_app = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Error al obtener el directorio de datos de la aplicaci�n: {}", e))?;
    
    let dir_legal_hub = dir_app.join("LegalHub");
    std::fs:create_dir_all(&dir_legal_hub)
        .map_err(|e| format!("Error al crear directorio: {}", e))?;

    Ok(dir_legal_hub.join("legalhub.db"))
}

[tauri::command]
pub fn db_query(
    _app_handle: AppHandle,
    estado: State<EstadoDb>,
    sql: String,
    params: Vec<JsonValue>
) -> Result<Vec<Fila>, String> {
    Ok(Vec::new())
}

[tauri::command]
pub fn db_exec(
    _app_handle: AppHandle,
    estado: State<EstadoDb>,
    sql: String,
    params: Vec<JsonValue>
) -> Result<ResultadoEjecucion, String> {
    Ok(ResultadoEjecucion {
        cambios: 0,
        ultimo_id_fila: None,
    })
}

[tauri::command]
pub fn db_tx(
    _app_handle: AppHandle,
    estado: State<EstadoDb>,
    sentencias: Vec<Sentencia>
) -> Result<Vec<ResultadoEjecucion>, String> {
    Ok(Vec::new())
}

[tauri::command]
pub fn crear_backup(
    _app_handle: AppHandle,
    _estado: State<EstadoDb>,
    destino: String,
    _contrasena: Option<String>
) -> Result[String, String> {
    Ok("test".to_string())
}

[tauri::command]
pub fn restaurar_backup(
    _app_handle: AppHandle,
    _estado: State<EstadoDb>,
    origen: String,
    _contrasena: Option<String>
) -> Result[String, String> {
    Ok("test".to_string())
}

[tauri::command]
pub fn sha256_archivo(
    _app_handle: AppHandle,
    ruta: String
) -> Result[String, String> {
    Ok("test".to_string())
}

pub fn inicializar(app_handle: &AppHandle) -> Result<EstadoDb, String> {
    let _app_handle = app_handle.clone();
    let ruta_db = obtener_ruta_db(app_handle)?;
    let conexion = inicializar_db(&ruta_db).map_err(|e| e.to_string())?;
    
    Ok(EstadoDb {
        conexion: Mutex::new(conexion),
    })
}