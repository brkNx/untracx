use untracx::{config, fs_util, helper, keys};
use zeroize::Zeroize;

/// Validates a WireGuard interface/peer name against Linux naming rules.
/// Allows: alphanumeric, underscore, hyphen, equals, plus, dot (max 15 chars)
fn is_valid_iface_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 15
        && name != "."
        && !name.contains("..")
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '=' | '+' | '.'))
}

#[cfg(unix)]
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
    #[cfg(unix)]
    {
        run_systemctl(&["--user", "start", "untracx-helper"])
            .map(|_| "Helper servisi başlatıldı".to_string())
    }
    #[cfg(not(unix))]
    {
        Err("Helper servisi bu işletim sisteminde doğrudan desteklenmiyor".into())
    }
}

#[tauri::command]
fn helper_stop() -> Result<String, String> {
    #[cfg(unix)]
    {
        run_systemctl(&["--user", "stop", "untracx-helper"])
            .map(|_| "Helper servisi durduruldu".to_string())
    }
    #[cfg(not(unix))]
    {
        Err("Helper servisi bu işletim sisteminde doğrudan desteklenmiyor".into())
    }
}

#[tauri::command]
fn helper_status() -> Result<serde_json::Value, String> {
    #[cfg(unix)]
    {
        let active = run_systemctl(&["--user", "is-active", "untracx-helper"]).unwrap_or_default();
        let running = active == "active";
        let sock = helper::sock_path();
        let sock_exists = sock.exists();
        Ok(serde_json::json!({
            "running": running,
            "socketExists": sock_exists,
            "socketPath": sock.display().to_string(),
            "systemctlStatus": active,
        }))
    }
    #[cfg(not(unix))]
    {
        Ok(serde_json::json!({
            "running": false,
            "socketExists": false,
            "socketPath": "",
            "systemctlStatus": "unsupported",
        }))
    }
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

// ── Peer yönetimi (Local preview / helper) ──

#[tauri::command]
fn peer_list(iface: Option<String>) -> Result<serde_json::Value, String> {
    let iface = iface.unwrap_or_else(|| "wg0".to_string());
    if !is_valid_iface_name(&iface) {
        return Err(format!("Geçersiz arayüz adı: {}", iface));
    }
    Ok(serde_json::json!({
        "ok": true,
        "peers": [],
        "interface": iface,
        "note": "Peer yönetimi sunucu tarafında 'sudo untracx-add-peer' komutu ile yapılır."
    }))
}

#[tauri::command]
fn peer_add(name: String) -> Result<serde_json::Value, String> {
    if !is_valid_iface_name(&name) {
        return Err(format!("Geçersiz cihaz adı: {}", name));
    }
    Ok(serde_json::json!({
        "ok": true,
        "output": format!("Sunucuda çalıştırmak için: sudo untracx-add-peer {name}")
    }))
}

#[tauri::command]
fn peer_remove(name: String) -> Result<serde_json::Value, String> {
    if !is_valid_iface_name(&name) {
        return Err(format!("Geçersiz cihaz adı: {}", name));
    }
    Ok(serde_json::json!({
        "ok": true,
        "output": format!("Sunucuda çalıştırmak için: sudo untracx-remove-peer {name}")
    }))
}

// ── Anahtar yönetimi ──

#[tauri::command]
fn keygen() -> Result<serde_json::Value, String> {
    let kp = keys::generate();
    let psk = keys::generate_psk();
    Ok(serde_json::json!({
        "ok": true,
        "publicKey": kp.public(),
        "privateKey": kp.private(),
        "presharedKey": psk,
    }))
}

#[tauri::command]
fn public_from_private(private_key: String) -> Result<serde_json::Value, String> {
    let public = keys::public_from_private(&private_key)?;
    Ok(serde_json::json!({
        "ok": true,
        "publicKey": public,
    }))
}

#[tauri::command]
fn validate_private_key(private_key: String) -> Result<serde_json::Value, String> {
    let mut raw = keys::validate_private(&private_key)?;
    raw.zeroize();
    Ok(serde_json::json!({"ok": true, "valid": true}))
}

#[tauri::command]
fn validate_public_key(public_key: String) -> Result<serde_json::Value, String> {
    keys::validate_public(&public_key)?;
    Ok(serde_json::json!({"ok": true, "valid": true}))
}

// ── Config üretimi ──

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn generate_config(
    client_private: String,
    server_public: String,
    server_ip: String,
    client_ip: String,
    dns: String,
    mtu: u16,
    port: u16,
    preshared_key: Option<String>,
) -> Result<serde_json::Value, String> {
    let cfg = config::ClientConfig {
        client_private: &client_private,
        server_public: &server_public,
        server_ip: &server_ip,
        client_ip: &client_ip,
        dns: &dns,
        mtu,
        port,
        preshared_key: preshared_key.as_deref(),
    };
    let rendered = config::render(&cfg)?;
    Ok(serde_json::json!({
        "ok": true,
        "config": rendered,
    }))
}

#[tauri::command]
fn save_config(mut content: String, path: String) -> Result<serde_json::Value, String> {
    validate_output_path(&path)?;
    fs_util::write_secret_file_atomic(std::path::Path::new(&path), &mut content)?;
    Ok(serde_json::json!({"ok": true, "path": path}))
}

/// Validates output path to prevent path traversal attacks.
fn validate_output_path(path: &str) -> Result<(), String> {
    use std::path::Path;
    let p = Path::new(path);
    let stem = p
        .file_stem()
        .ok_or("Geçersiz çıktı yolu")?
        .to_string_lossy();
    if stem.contains('/') || stem.contains(' ') || stem.is_empty() {
        return Err("Çıkış dosya adı geçersiz (path traversal riski)".into());
    }
    if p.components().count() > 1 {
        let parent = p.parent().unwrap_or(Path::new(""));
        for comp in parent.components() {
            let s = comp.as_os_str().to_string_lossy();
            if s == ".." {
                return Err("Çıkış yolu '..' içeremez".into());
            }
        }
    }
    Ok(())
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
