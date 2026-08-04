use serde_json::{json, Value};
use std::fs;
use std::io::{Read as _, Write as _};
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::Path;
use std::process::Command;

const SOCK_PATH: &str = "/run/user/UNTRACX_UID/untracx.sock";

fn sock_path() -> String {
    let uid = unsafe { libc::getuid() };
    SOCK_PATH.replace("UNTRACX_UID", &uid.to_string())
}

fn allowed_config_dirs() -> Vec<String> {
    let mut dirs = vec!["/etc/wireguard".to_string()];
    if let Some(home) = std::env::var_os("HOME") {
        dirs.push(format!("{}/.config/untracx", home.to_string_lossy()));
    }
    dirs
}

pub fn run(action: super::HelperAction) -> Result<(), String> {
    match action {
        super::HelperAction::Start => start(),
        super::HelperAction::Stop => stop(),
        super::HelperAction::Status => status(),
    }
}

fn start() -> Result<(), String> {
    let path = sock_path();
    if Path::new(&path).exists() {
        return Err(format!("Socket zaten mevcut: {}", path));
    }
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let listener = UnixListener::bind(&path).map_err(|e| e.to_string())?;
    println!("Helper dinliyor: {}", path);
    println!("Ctrl+C ile durdurun.");
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => handle_client(stream),
            Err(e) => eprintln!("Baglanti hatasi: {}", e),
        }
    }
    Ok(())
}

fn stop() -> Result<(), String> {
    let path = sock_path();
    if Path::new(&path).exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
        println!("Helper durduruldu: {}", path);
    } else {
        println!("Helper calismiyor (socket yok).");
    }
    Ok(())
}

fn status() -> Result<(), String> {
    let path = sock_path();
    if Path::new(&path).exists() {
        let stream = UnixStream::connect(&path).map_err(|e| e.to_string())?;
        let req = json!({"cmd": "status"});
        send_json(&stream, &req)?;
        let resp = recv_json(&stream)?;
        println!("{}", serde_json::to_string_pretty(&resp).unwrap_or_default());
    } else {
        println!("Helper calismiyor (socket yok): {}", path);
    }
    Ok(())
}

fn handle_client(stream: UnixStream) {
    let peer = stream.peer_addr().ok().map(|a| a.to_string());
    match recv_json(&stream) {
        Ok(req) => {
            let resp = process_request(&req);
            let _ = send_json(&stream, &resp);
        }
        Err(e) => {
            eprintln!("{} JSON okuma hatasi: {}", peer.clone().unwrap_or_default(), e);
        }
    }
}

fn process_request(req: &Value) -> Value {
    let cmd = req.get("cmd").and_then(|v| v.as_str()).unwrap_or("");
    match cmd {
        "connect" => cmd_connect(req),
        "down" => cmd_down(req),
        "status" => cmd_status(),
        _ => json!({"ok": false, "error": format!("Bilinmeyen komut: {}", cmd)}),
    }
}

fn cmd_connect(req: &Value) -> Value {
    let path = match req.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return json!({"ok": false, "error": "path zorunlu"}),
    };
    if !is_allowed_config_path(path) {
        return json!({"ok": false, "error": "Konfig dosyasi yolu izin verilmiyor"});
    }
    if !Path::new(path).is_file() {
        return json!({"ok": false, "error": "Dosya bulunamadi"});
    }
    let iface = Path::new(path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    if iface.is_empty() {
        return json!({"ok": false, "error": "Gecersiz config dosya adi"});
    }
    let out = Command::new("wg-quick")
        .args(["up", &iface])
        .output();
    match out {
        Ok(o) if o.status.success() => json!({"ok": true, "iface": iface}),
        Ok(o) => json!({"ok": false, "error": String::from_utf8_lossy(&o.stderr).to_string()}),
        Err(e) => json!({"ok": false, "error": e.to_string()}),
    }
}

fn cmd_down(req: &Value) -> Value {
    let iface = match req.get("iface").and_then(|v| v.as_str()) {
        Some(i) => i,
        None => return json!({"ok": false, "error": "iface zorunlu"}),
    };
    if !is_valid_iface_name(iface) {
        return json!({"ok": false, "error": "Gecersiz arayuz adi"});
    }
    let out = Command::new("wg-quick")
        .args(["down", iface])
        .output();
    match out {
        Ok(o) if o.status.success() => json!({"ok": true, "iface": iface}),
        Ok(o) => json!({"ok": false, "error": String::from_utf8_lossy(&o.stderr).to_string()}),
        Err(e) => json!({"ok": false, "error": e.to_string()}),
    }
}

fn cmd_status() -> Value {
    let out = Command::new("wg").output();
    match out {
        Ok(o) => {
            let text = String::from_utf8_lossy(&o.stdout).to_string();
            if text.trim().is_empty() {
                json!({"ok": true, "connected": false})
            } else {
                json!({"ok": true, "connected": true, "output": text})
            }
        }
        Err(e) => json!({"ok": false, "error": e.to_string()}),
    }
}

fn is_allowed_config_path(path: &str) -> bool {
    let p = Path::new(path);
    for allowed in allowed_config_dirs() {
        let allow_p = Path::new(&allowed);
        if let Ok(stripped) = p.strip_prefix(allow_p) {
            let components: Vec<_> = stripped.components().collect();
            if components.len() == 1 {
                return true;
            }
        }
    }
    false
}

fn is_valid_iface_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 15
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '+' || c == '=' || c == '.' || c == '-')
}

fn send_json(stream: &UnixStream, val: &Value) -> Result<(), String> {
    let data = serde_json::to_vec(val).map_err(|e| e.to_string())?;
    stream
        .try_write(&data)
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn recv_json(stream: &UnixStream) -> Result<Value, String> {
    let mut buf = Vec::new();
    let mut tmp = [0u8; 4096];
    loop {
        let n = stream.read(&mut tmp).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&tmp[..n]);
        if buf.len() >= 65536 {
            return Err("JSON mesaji cok buyuk".into());
        }
    }
    let text = String::from_utf8(buf).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}
