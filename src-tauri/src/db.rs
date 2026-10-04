use rusqlite::{
    backup::Backup,
    params_from_iter,
    types::{Value, ValueRef},
    Connection, OptionalExtension, TransactionBehavior,
};
use sha2::{Digest, Sha256};
use serde::{Deserialize, Serialize};
use serde_json::Value as Json;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};

pub const NOMBRE_DB: &str = "legalhub.db";

const MIGRACIONES: &[(i64, &str)] = &[
    (1, include_str!("../migrations/001_inicial.sql")),
    (2, include_str!("../migrations/002_fts.sql")),
    (3, include_str!("../migrations/003_configuracion.sql")),
];

pub struct EstadoDb {
    pub conexion: Mutex<Connection>,
}

pub type Fila = HashMap<String, Json>;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResultadoEjecucion {
    pub cambios: u64,
    pub ultimo_id_fila: Option<String>,
}

#[derive(Deserialize)]
pub struct Sentencia {
    pub sql: String,
    pub params: Vec<Json>,
}

pub fn ahora() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn esquema_actual() -> i64 {
    MIGRACIONES.iter().map(|m| m.0).max().unwrap_or(0)
}

pub fn dir_datos(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .local_data_dir()
        .map_err(|e| format!("No se pudo obtener %LOCALAPPDATA%: {e}"))?
        .join("LegalHub");
    std::fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear {}: {e}", dir.display()))?;
    Ok(dir)
}

fn copia_previa(conn: &Connection, destino: &Path) -> Result<(), String> {
    let mut dst = Connection::open(destino).map_err(|e| e.to_string())?;
    let b = Backup::new(conn, &mut dst).map_err(|e| e.to_string())?;
    b.run_to_completion(256, Duration::from_millis(5), None)
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn migrar(conn: &mut Connection, ruta: &Path) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY, aplicada_en TEXT NOT NULL);",
    )
    .map_err(|e| e.to_string())?;

    let actual: i64 = conn
        .query_row("SELECT COALESCE(MAX(version), 0) FROM schema_migrations", [], |f| f.get(0))
        .map_err(|e| e.to_string())?;

    if actual > esquema_actual() {
        return Err(format!(
            "La base de datos (v{actual}) es más nueva que esta versión de Legal-Hub (v{})",
            esquema_actual()
        ));
    }

    let pendientes: Vec<(i64, &str)> = MIGRACIONES
        .iter()
        .filter(|m| m.0 > actual)
        .map(|m| (m.0, m.1))
        .collect();
    if pendientes.is_empty() {
        return Ok(());
    }

    if actual > 0 {
        let previa = ruta.with_file_name(format!("legalhub.pre_migracion_v{actual}_{}.db", ahora()));
        copia_previa(conn, &previa)?;
    }

    for (version, sql) in pendientes {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute_batch(sql)
            .map_err(|e| format!("Migración {version}: {e}"))?;
        tx.execute(
            "INSERT INTO schema_migrations (version, aplicada_en)
             VALUES (?1, strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
            [version],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn abrir(ruta: &Path) -> Result<Connection, String> {
    let mut db = Connection::open(ruta).map_err(|e| format!("No se pudo abrir la base de datos: {e}"))?;
    db.pragma_update(None, "foreign_keys", "ON").map_err(|e| e.to_string())?;
    db.pragma_update(None, "journal_mode", "WAL").map_err(|e| e.to_string())?;
    db.pragma_update(None, "busy_timeout", 5000).map_err(|e| e.to_string())?;
    db.pragma_update(None, "synchronous", "NORMAL").map_err(|e| e.to_string())?;
    migrar(&mut db, ruta)?;
    Ok(db)
}

pub fn inicializar(app: &AppHandle) -> Result<EstadoDb, String> {
    let ruta = dir_datos(app)?.join(NOMBRE_DB);
    Ok(EstadoDb {
        conexion: Mutex::new(abrir(&ruta)?),
    })
}

fn convertir(params: Vec<Json>) -> Result<Vec<Value>, String> {
    params
        .into_iter()
        .map(|p| match p {
            Json::Null => Ok(Value::Null),
            Json::Bool(b) => Ok(Value::Integer(i64::from(b))),
            Json::Number(n) => match (n.as_i64(), n.as_f64()) {
                (Some(i), _) => Ok(Value::Integer(i)),
                (None, Some(f)) => Ok(Value::Real(f)),
                _ => Err(format!("Número fuera de rango: {n}")),
            },
            Json::String(s) => Ok(Value::Text(s)),
            otro => Ok(Value::Text(otro.to_string())),
        })
        .collect()
}

fn a_json(v: ValueRef) -> Json {
    match v {
        ValueRef::Null => Json::Null,
        ValueRef::Integer(i) => Json::from(i),
        ValueRef::Real(f) => serde_json::Number::from_f64(f).map(Json::Number).unwrap_or(Json::Null),
        ValueRef::Text(t) => Json::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => Json::String(hex::encode(b)),
    }
}

#[tauri::command(async)]
pub fn db_query(estado: State<'_, EstadoDb>, sql: String, params: Vec<Json>) -> Result<Vec<Fila>, String> {
    let valores = convertir(params)?;
    let conn = estado.conexion.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let columnas: Vec<String> = stmt.column_names().iter().map(|c| c.to_string()).collect();
    let mut filas = stmt
        .query(params_from_iter(valores.iter()))
        .map_err(|e| e.to_string())?;

    let mut salida = Vec::new();
    while let Some(fila) = filas.next().map_err(|e| e.to_string())? {
        let mut mapa = HashMap::with_capacity(columnas.len());
        for (i, nombre) in columnas.iter().enumerate() {
            mapa.insert(nombre.clone(), a_json(fila.get_ref(i).map_err(|e| e.to_string())?));
        }
        salida.push(mapa);
    }
    Ok(salida)
}

#[tauri::command(async)]
pub fn db_exec(estado: State<'_, EstadoDb>, sql: String, params: Vec<Json>) -> Result<ResultadoEjecucion, String> {
    let valores = convertir(params)?;
    let conn = estado.conexion.lock().map_err(|e| e.to_string())?;
    let cambios = conn
        .execute(&sql, params_from_iter(valores.iter()))
        .map_err(|e| e.to_string())?;
    Ok(ResultadoEjecucion {
        cambios: cambios as u64,
        ultimo_id_fila: Some(conn.last_insert_rowid().to_string()),
    })
}

fn es<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn hash_evento(prev: &str, ts: &str, accion: &str, entidad: &str, entidad_id: &str, detalle: &str) -> String {
    let mut h = Sha256::new();
    for parte in [prev, ts, accion, entidad, entidad_id, detalle] {
        h.update((parte.len() as u64).to_le_bytes());
        h.update(parte.as_bytes());
    }
    hex::encode(h.finalize())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventoAuditoria {
    pub accion: String,
    pub entidad: Option<String>,
    pub entidad_id: Option<String>,
    pub detalle: Option<Json>,
}

fn registrar_auditoria(tx: &rusqlite::Transaction<'_>, ev: &EventoAuditoria) -> Result<(), String> {
    let prev: String = tx
        .query_row("SELECT hash FROM auditoria ORDER BY id DESC LIMIT 1", [], |f| f.get(0))
        .optional()
        .map_err(es)?
        .unwrap_or_default();
    let ts: String = tx
        .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now')", [], |f| f.get(0))
        .map_err(es)?;
    let detalle = ev.detalle.as_ref().map(|d| d.to_string());
    let hash = hash_evento(
        &prev,
        &ts,
        &ev.accion,
        ev.entidad.as_deref().unwrap_or(""),
        ev.entidad_id.as_deref().unwrap_or(""),
        detalle.as_deref().unwrap_or(""),
    );
    tx.execute(
        "INSERT INTO auditoria (ts, accion, entidad, entidad_id, detalle_json, prev_hash, hash)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            ts,
            ev.accion,
            ev.entidad,
            ev.entidad_id,
            detalle,
            if prev.is_empty() { None } else { Some(&prev) },
            hash
        ],
    )
    .map_err(es)?;
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResultadoAuditoria {
    pub ok: bool,
    pub eventos: u64,
    pub primer_roto: Option<i64>,
}

#[tauri::command(async)]
pub fn auditoria_verificar(estado: State<'_, EstadoDb>) -> Result<ResultadoAuditoria, String> {
    let conn = estado.conexion.lock().map_err(es)?;
    let mut stmt = conn
        .prepare("SELECT id, ts, accion, entidad, entidad_id, detalle_json, prev_hash, hash FROM auditoria ORDER BY id")
        .map_err(es)?;
    let mut filas = stmt.query([]).map_err(es)?;
    let mut prev = String::new();
    let mut n = 0u64;
    while let Some(f) = filas.next().map_err(es)? {
        let id: i64 = f.get(0).map_err(es)?;
        let ts: String = f.get(1).map_err(es)?;
        let accion: String = f.get(2).map_err(es)?;
        let entidad: Option<String> = f.get(3).map_err(es)?;
        let entidad_id: Option<String> = f.get(4).map_err(es)?;
        let detalle: Option<String> = f.get(5).map_err(es)?;
        let prev_guardado: Option<String> = f.get(6).map_err(es)?;
        let hash: String = f.get(7).map_err(es)?;
        let esperado = hash_evento(
            &prev,
            &ts,
            &accion,
            entidad.as_deref().unwrap_or(""),
            entidad_id.as_deref().unwrap_or(""),
            detalle.as_deref().unwrap_or(""),
        );
        if prev_guardado.unwrap_or_default() != prev || hash != esperado {
            return Ok(ResultadoAuditoria { ok: false, eventos: n, primer_roto: Some(id) });
        }
        prev = hash;
        n += 1;
    }
    Ok(ResultadoAuditoria { ok: true, eventos: n, primer_roto: None })
}

#[tauri::command(async)]
pub fn db_tx(
    estado: State<'_, EstadoDb>,
    sentencias: Vec<Sentencia>,
    auditoria: Option<Vec<EventoAuditoria>>,
) -> Result<Vec<ResultadoEjecucion>, String> {
    let mut conn = estado.conexion.lock().map_err(|e| e.to_string())?;
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;

    let mut resultados = Vec::with_capacity(sentencias.len());
    for (i, s) in sentencias.into_iter().enumerate() {
        let valores = convertir(s.params)?;
        let cambios = tx
            .execute(&s.sql, params_from_iter(valores.iter()))
            .map_err(|e| format!("Sentencia {i}: {e}"))?;
        resultados.push(ResultadoEjecucion {
            cambios: cambios as u64,
            ultimo_id_fila: Some(tx.last_insert_rowid().to_string()),
        });
    }
    for ev in auditoria.unwrap_or_default() {
        registrar_auditoria(&tx, &ev)?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(resultados)
}