mod backup;
mod db;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let estado = db::inicializar(app.handle())?;
            app.manage(estado);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::db_query,
            db::db_exec,
            db::db_tx,
            db::auditoria_verificar,
            backup::crear_backup,
            backup::restaurar_backup,
            backup::sha256_archivo
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Legal-Hub");
}