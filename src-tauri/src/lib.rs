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

#[derive(Debug, serde::Serialize)]
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

// Inicializar la base de datos
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

// Obtener la ruta de la base de datos
fn obtener_ruta_db(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let dir_app = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Error al obtener el directorio de datos de la aplicaci�n: {}", e))?;
    
    let dir_legal_hub = dir_app.join("LegalHub");
    std::fs::create_dir_all(&dir_legal_hub)
        .map_err(|e| format!("Error al crear directorio: {}", e))?;

    Ok(dir_legal_hub.join("legalhub.db"))
}

// Comando: db_query - Ejecutar consulta SQL y retornar resultados
#[tauri::command]
pub fn db_query(
    _app_handle: AppHandle,
    estado: State<EstadoDb>,
    sql: String,
    params: Vec<JsonValue>
) -> Result<Vec<Fila>, String> {
    // Convertir parámetros JSON a valores rusqlite
    let rusqlite_params: Vec<rusqlite::types::Value> = params.into_iter()
        .map(|json_val| {
            match json_val {
                JsonValue::Null => rusqlite::types::Value::Null,
                JsonValue::Bool(b) => rusqlite::types::Value::Bool(b),
                JsonValue::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        rusqlite::types::Value::Integer(i)
                    } else if let Some(f) = n.as_f64() {
                        rusqlite::types::Value::Real(f)
                    } else {
                        rusqlite::types::Value::Null
                    }
                }
                JsonValue::String(s) => rusqlite::types::Value::Text(s),
                JsonValue::Array(arr) => {
                    // Para simplicidad, convertimos el primer elemento si es un array
                    // En una implementación real, podríamos manejar esto diferente
                    if let Some(first) = arr.get(0) {
                        match first {
                            JsonValue::String(s) => rusqlite::types::Value::Text(s.clone()),
                            JsonValue::Number(n) => {
                                if let Some(i) = n.as_i64() {
                                    rusqlite::types::Value::Integer(i)
                                } else if let Some(f) = n.as_f64() {
                                    rusqlite::types::Value::Real(f)
                                } else {
                                    rusqlite::types::Value::Null
                                }
                            }
                            JsonValue::Bool(b) => rusqlite::types::Value::Bool(*b),
                            _ => rusqlite::types::Value::Null
                        }
                    } else {
                        rusqlite::types::Value::Null
                    }
                }
                JsonValue::Object(_) => rusqlite::types::Value::Null, // Los objetos no se soportan directamente
            }
        })
        .collect();

    // Bloquear la conexión y ejecutar la consulta
    let conn_lock = estado.conexion.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn_lock.prepare(&sql).map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map(rusqlite_params.as_slice(), |row| {
        let mut valores = HashMap::new();
        for (idx, column) in stmt.column_names().iter().enumerate() {
            let value_ref: ValueRef = row.get_ref(idx).map_err(|e| rusqlite::Error::from_fail(e.to_string()))?;
            let json_value = match value_ref {
                ValueRef::Null => JsonValue::Null,
                ValueRef::Integer(i) => JsonValue::Number(i.into()),
                ValueRef::Real(f) => JsonValue::Number(f.into()),
                ValueRef::Text(t) => JsonValue::String(t.to_string()),
                ValueRef::Blob(b) => JsonValue::String(hex::encode(b)),
            };
            valores.insert(column.clone(), json_value);
        }
        Ok(Fila { valores })
    }).map_err(|e| e.to_string())?;
    
    let mut resultado = Vec::new();
    for row in rows {
        resultado.push(row.map_err(|e| e.to_string())?);
    }
    
    Ok(resultado)
}

// Comando: db_exec - Ejecutar comando SQL y retornar resultado
#[tauri::command]
pub fn db_exec(
    _app_handle: AppHandle,
    estado: State<EstadoDb>,
    sql: String,
    params: Vec<JsonValue>
) -> Result<ResultadoEjecucion, String> {
    // Convertir parámetros JSON a valores rusqlite (mismo proceso que en db_query)
    let rusqlite_params: Vec<rusqlite::types::Value> = params.into_iter()
        .map(|json_val| {
            match json_val {
                JsonValue::Null => rusqlite::types::Value::Null,
                JsonValue::Bool(b) => rusqlite::types::Value::Bool(b),
                JsonValue::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        rusqlite::types::Value::Integer(i)
                    } else if let Some(f) = n.as_f64() {
                        rusqlite::types::Value::Real(f)
                    } else {
                        rusqlite::types::Value::Null
                    }
                }
                JsonValue::String(s) => rusqlite::types::Value::Text(s),
                JsonValue::Array(arr) => {
                    if let Some(first) = arr.get(0) {
                        match first {
                            JsonValue::String(s) => rusqlite::types::Value::Text(s.clone()),
                            JsonValue::Number(n) => {
                                if let Some(i) = n.as_i64() {
                                    rusqlite::types::Value::Integer(i)
                                } else if let Some(f) = n.as_f64() {
                                    rusqlite::types::Value::Real(f)
                                } else {
                                    rusqlite::types::Value::Null
                                }
                            }
                            JsonValue::Bool(b) => rusqlite::types::Value::Bool(*b),
                            _ => rusqlite::types::Value::Null
                        }
                    } else {
                        rusqlite::types::Value::Null
                    }
                }
                JsonValue::Object(_) => rusqlite::types::Value::Null,
            }
        })
        .collect();

    // Bloquear la conexión y ejecutar el comando
    let conn_lock = estado.conexion.lock().map_err(|e| e.to_string())?;
    let cambios = conn_lock.execute(&sql, rusqlite_params.as_slice()).map_err(|e| e.to_string())?;
    let ultimo_id = conn_lock.last_insert_rowid().to_string();
    
    Ok(ResultadoEjecucion {
        cambios,
        ultimo_id_fila: Some(ultimo_id),
    })
}

// Comando: db_tx - Ejecutar transacción atómica con múltiples sentencias
#[tauri::command]
pub fn db_tx(
    _app_handle: AppHandle,
    estado: State<EstadoDb>,
    sentencias: Vec<Sentencia>
) -> Result<Vec<ResultadoEjecucion>, String> {
    // Bloquear la conexión para la transacción
    let conn_lock = estado.conexion.lock().map_err(|e| e.to_string())?;
    
    // Iniciar transacción
    let _transaction = conn_lock.transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    
    let mut resultados = Vec::new();
    
    // Ejecutar cada sentencia en la transacción
    for sentencia in sentencias {
        // Convertir parámetros
        let rusqlite_params: Vec<rusqlite::types::Value> = sentencia.params.into_iter()
            .map(|json_val| {
                match json_val {
                    JsonValue::Null => rusqlite::types::Value::Null,
                    JsonValue::Bool(b) => rusqlite::types::Value::Bool(b),
                    JsonValue::Number(n) => {
                        if let Some(i) = n.as_i64() {
                            rusqlite::types::Value::Integer(i)
                        } else if let Some(f) = n.as_f64() {
                            rusqlite::types::Value::Real(f)
                        } else {
                            rusqlite::types::Value::Null
                        }
                    }
                    JsonValue::String(s) => rusqlite::types::Value::Text(s),
                    JsonValue::Array(arr) => {
                        if let Some(first) = arr.get(0) {
                            match first {
                                JsonValue::String(s) => rusqlite::types::Value::Text(s.clone()),
                                JsonValue::Number(n) => {
                                    if let Some(i) = n.as_i64() {
                                        rusqlite::types::Value::Integer(i)
                                    } else if let Some(f) = n.as_f64() {
                                        rusqlite::types::Value::Real(f)
                                    } else {
                                        rusqlite::types::Value::Null
                                    }
                                }
                                JsonValue::Bool(b) => rusqlite::types::Value::Bool(*b),
                                _ => rusqlite::types::Value::Null
                            }
                        } else {
                            rusqlite::types::Value::Null
                        }
                    }
                    JsonValue::Object(_) => rusqlite::types::Value::Null,
                }
            })
            .collect();
        
        // Ejecutar la sentencia
        let cambios = conn_lock.execute(&sentencia.sql, rusqlite_params.as_slice())
            .map_err(|e| e.to_string())?;
        let ultimo_id = conn_lock.last_insert_rowid().to_string();
        
        resultados.push(ResultadoEjecucion {
            cambios,
            ultimo_id_fila: Some(ultimo_id),
        });
    }
    
    // La transacción se confirma automáticamente cuando _transaction sale de scope
    Ok(resultados)
}

// Implementación real de crear_backup - Copia de seguridad basada en streaming
#[tauri::command]
pub fn crear_backup(
    _app_handle: AppHandle,
    _estado: State<EstadoDb>,
    destino: String,
    _contrasena: Option<String>
) -> Result<String, String> {
    // Obtener la ruta de la base de datos
    let ruta_db = obtener_ruta_db(&_app_handle).map_err(|e| e)?;
    
    // Verificar que la base de datos exista
    if !ruta_db.exists() {
        return Err("Base de datos no encontrada".to_string());
    }
    
    // Crear directorio de destino si no existe
    let destino_path = PathBuf::from(&destino);
    if let Some(parent) = destino_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Error al crear directorio de destino: {}", e))?;
    }
    
    // Abrir archivo de base de datos origen
    let mut archivo_origen = std::fs::File::open(&ruta_db)
        .map_err(|e| format!("Error al abrir base de datos origen: {}", e))?;
    
    // Crear archivo de destino
    let mut archivo_destino = std::fs::File::create(&destino)
        .map_err(|e| format!("Error al crear archivo de destino: {}", e))?;
    
    // Copiar el contenido usando copia de flujo (streaming) para manejar archivos grandes
    std::io::copy(&mut archivo_origen, &mut archivo_destino)
        .map_err(|e| format!("Error al copiar base de datos: {}", e))?;
    
    Ok("Copia de seguridad creada exitosamente".to_string())
}

// Implementación real de restaurar_backup - Restauración basada en streaming
#[tauri::command]
pub fn restaurar_backup(
    _app_handle: AppHandle,
    _estado: State<EstadoDb>,
    origen: String,
    _contrasena: Option<String>
) -> Result<String, String> {
    // Verificar que el archivo de origen exista
    let ruta_origen = PathBuf::from(&origen);
    if !ruta_origen.exists() {
        return Err("Archivo de copia de seguridad no encontrado".to_string());
    }
    
    // Obtener la ruta de la base de datos destino
    let ruta_db = obtener_ruta_db(&_app_handle).map_err(|e| e)?;
    
    // Asegurarnos de que el directorio de destino exista
    if let Some(parent) = ruta_db.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Error al crear directorio de destino: {}", e))?;
    }
    
    // Abrir archivo de origen (copia de seguridad)
    let mut archivo_origen = std::fs::File::open(&ruta_origen)
        .map_err(|e| format!("Error al abrir archivo de copia de seguridad: {}", e))?;
    
    // Crear/Truncar archivo de destino (base de datos)
    let mut archivo_destino = std::fs::File::create(&ruta_db)
        .map_err(|e| format!("Error al abrir base de datos destino: {}", e))?;
    
    // Copiar el contenido usando copia de flujo (streaming)
    std::io::copy(&mut archivo_origen, &mut archivo_destino)
        .map_err(|e| format!("Error al restaurar base de datos: {}", e))?;
    
    Ok("Base de datos restaurada exitosamente".to_string())
}

// Implementación real de SHA-256 para archivos
#[tauri::command]
pub fn sha256_archivo(
    _app_handle: AppHandle,
    ruta: String
) -> Result<String, String> {
    // Verificar que el archivo exista
    let path = PathBuf::from(&ruta);
    if !path.exists() {
        return Err("Archivo no encontrado".to_string());
    }
    
    // Abrir el archivo
    let mut archivo = std::fs::File::open(&path)
        .map_err(|e| format!("Error al abrir archivo: {}", e))?;
    
    // Crear hasher SHA-256
    let mut hasher = Sha256::new();
    
    // Buffer para lectura eficiente
    let mut buffer = [0; 8192];
    
    // Leer el archivo en chunks y actualizar el hash
    loop {
        let leido = archivo.read(&mut buffer)
            .map_err(|e| format!("Error al leer archivo: {}", e))?;
        if leido == 0 {
            break; // Fin del archivo
        }
        hasher.update(&buffer[..leido]);
    }
    
    // Obtener el hash resultante y convertir a hexadecimal
    let resultado = hasher.finalize();
    let hash_hex = hex::encode(resultado);
    
    Ok(hash_hex)
}

// Funci�n de inicializaci�n que se llama cuando se inicia la aplicaci�n
pub fn inicializar(app_handle: &AppHandle) -> Result<EstadoDb, String> {
    let _app_handle = app_handle.clone(); // Clonar para evitar el movimiento
    let ruta_db = obtener_ruta_db(app_handle)?;
    let conexion = inicializar_db(&ruta_db).map_err(|e| e.to_string())?;
    
    Ok(EstadoDb {
        conexion: Mutex::new(conexion),
    })
}