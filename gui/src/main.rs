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

// ── Helper servis komutları ──

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

// ── VPN komutları ──

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

// ── Peer yönetimi ──

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

// ── Anahtar yönetimi ──

#[tauri::command]
fn keygen() -> Result<serde_json::Value, String> {
    let kp = untracx::keys::generate();
    Ok(serde_json::json!({
        "ok": true,
        "privateKey": kp.private,
        "publicKey": kp.public,
    }))
}

#[tauri::command]
fn public_from_private(private_key: String) -> Result<serde_json::Value, String> {
    let public = untracx::keys::public_from_private(&private_key)?;
    Ok(serde_json::json!({
        "ok": true,
        "publicKey": public,
    }))
}

#[tauri::command]
fn validate_private_key(private_key: String) -> Result<serde_json::Value, String> {
    untracx::keys::validate_private(&private_key)?;
    Ok(serde_json::json!({"ok": true, "valid": true}))
}

#[tauri::command]
fn validate_public_key(public_key: String) -> Result<serde_json::Value, String> {
    untracx::keys::validate_public(&public_key)?;
    Ok(serde_json::json!({"ok": true, "valid": true}))
}

// ── Config üretimi ──

#[tauri::command]
fn generate_config(
    client_private: String,
    server_public: String,
    server_ip: String,
    client_ip: String,
    dns: String,
    mtu: u16,
    port: u16,
) -> Result<serde_json::Value, String> {
    let cfg = untracx::config::ClientConfig {
        client_private: &client_private,
        server_public: &server_public,
        server_ip: &server_ip,
        client_ip: &client_ip,
        dns: &dns,
        mtu,
        port,
    };
    let rendered = untracx::config::render(&cfg)?;
    Ok(serde_json::json!({
        "ok": true,
        "config": rendered,
    }))
}

#[tauri::command]
fn save_config(content: String, path: String) -> Result<serde_json::Value, String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }
    Ok(serde_json::json!({"ok": true, "path": path}))
}

// ── App giriş noktası ──

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
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
            keygen,
            public_from_private,
            validate_private_key,
            validate_public_key,
            generate_config,
            save_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}

fn main() {
    run();
}
