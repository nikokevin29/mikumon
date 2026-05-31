use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&app_dir).ok();

            let db_path = app_dir.join("mikumon.db");
            let migrations_path = app.path().resource_dir()
                .expect("failed to get resource dir")
                .join("migrations");

            // Spawn backend sidecar
            let sidecar = app.shell().sidecar("mikumon-api").expect("sidecar not found");
            let (_rx, _child) = sidecar
                .env("DATABASE_PATH", db_path.to_str().unwrap_or("mikumon.db"))
                .env("MIGRATIONS_PATH", migrations_path.to_str().unwrap_or("migrations"))
                .env("API_PORT", "3001")
                .env("JWT_SECRET", "mikumon-desktop-secret-key-32chars!")
                .env("ENCRYPTION_KEY", "mikumon-encrypt-key-32chars!!!!!")
                .spawn()
                .expect("failed to spawn backend");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
