use untracx::helper;

#[tauri::command]
fn helper_start() -> Result<String, String> {
    helper::start().map(|_| "Helper başlatıldı".to_string())
}

#[tauri::command]
fn helper_stop() -> Result<String, String> {
    helper::stop().map(|_| "Helper durduruldu".to_string())
}

#[tauri::command]
fn helper_status() -> Result<serde_json::Value, String> {
    helper::status()
}

#[tauri::command]
fn vpn_connect(config_path: String) -> Result<serde_json::Value, String> {
    helper::cmd_connect(&config_path)
}

#[tauri::command]
fn vpn_down(iface: String) -> Result<serde_json::Value, String> {
    helper::cmd_down(&iface)
}

#[tauri::command]
fn vpn_status() -> Result<serde_json::Value, String> {
    helper::cmd_status()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            helper_start,
            helper_stop,
            helper_status,
            vpn_connect,
            vpn_down,
            vpn_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}