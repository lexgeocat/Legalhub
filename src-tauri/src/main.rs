// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Manager, State};
use legal_hub_lib::{inicializar, EstadoDb};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Inicializar la base de datos y almacenarla en el estado
            let estado_db = inicializar(app.handle())
                .expect("Failed to initialize database");
            app.manage(estado_db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            legal_hub_lib::db_query,
            legal_hub_lib::db_exec,
            legal_hub_lib::db_tx,
            legal_hub_lib::crear_backup,
            legal_hub_lib::restaurar_backup,
            legal_hub_lib::sha256_archivo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}