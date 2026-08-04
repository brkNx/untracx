use untracx::helper;

fn run_systemctl(args: &[&str]) -> Result<String, String> {
    let output = std::process::Command::new("systemctl")
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

#[tauri::command]
fn helper_start() -> Result<String, String> {
    run_systemctl(&["--user", "start", "untracx-helper"])
        .map(|_| "Helper servisi başlatıldı".to_string())
}

#[tauri::command]
fn helper_stop() -> Result<String, String> {
    run_systemctl(&["--user", "stop", "untracx-helper"])
        .map(|_| "Helper servisi durduruldu".to_string())
}

#[tauri::command]
fn helper_status() -> Result<serde_json::Value, String> {
    let active = run_systemctl(&["--user", "is-active", "untracx-helper"]).unwrap_or_default();
    let running = active == "active";
    let sock = helper::sock_path();
    let sock_exists = std::path::Path::new(&sock).exists();
    Ok(serde_json::json!({
        "running": running,
        "socketExists": sock_exists,
        "socketPath": sock,
        "systemctlStatus": active,
    }))
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

#[tauri::command]
fn peer_list() -> Result<serde_json::Value, String> {
    let output = std::process::Command::new("sudo")
        .args(["wg", "show", "wg0", "peers"])
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout).to_string();
        let peers: Vec<serde_json::Value> = text
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| serde_json::json!({"publicKey": l.trim()}))
            .collect();
        Ok(serde_json::json!({"ok": true, "peers": peers}))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn peer_add(name: String) -> Result<serde_json::Value, String> {
    let output = std::process::Command::new("sudo")
        .args(["untracx-add-peer", &name])
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(
            serde_json::json!({"ok": true, "output": String::from_utf8_lossy(&output.stdout).to_string()}),
        )
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn peer_remove(name: String) -> Result<serde_json::Value, String> {
    let output = std::process::Command::new("sudo")
        .args(["untracx-remove-peer", &name])
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(
            serde_json::json!({"ok": true, "output": String::from_utf8_lossy(&output.stdout).to_string()}),
        )
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            helper_start,
            helper_stop,
            helper_status,
            vpn_connect,
            vpn_down,
            vpn_status,
            peer_list,
            peer_add,
            peer_remove,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}

fn main() {
    run();
}
