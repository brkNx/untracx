use serde_json::{json, Value};
use std::fs;
use std::io::{Read as _, Write as _};
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::Path;
use std::process::Command;

pub enum HelperAction {
    Start,
    Stop,
    Status,
}

pub fn run(action: HelperAction) -> Result<(), String> {
    match action {
        HelperAction::Start => start(),
        HelperAction::Stop => stop(),
        HelperAction::Status => {
            let v = status()?;
            println!("{}", serde_json::to_string_pretty(&v).unwrap_or_default());
            Ok(())
        }
    }
}

pub fn sock_path() -> String {
    let uid = unsafe { libc::getuid() };
    format!("/run/user/{}/untracx.sock", uid)
}

pub fn start() -> Result<(), String> {
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

pub fn stop() -> Result<(), String> {
    let path = sock_path();
    if Path::new(&path).exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
        println!("Helper durduruldu: {}", path);
    } else {
        println!("Helper calismiyor (socket yok).");
    }
    Ok(())
}

pub fn status() -> Result<Value, String> {
    let path = sock_path();
    if !Path::new(&path).exists() {
        return Ok(json!({"running": false, "socket": path}));
    }
    let mut stream = UnixStream::connect(&path).map_err(|e| e.to_string())?;
    let req = json!({"cmd": "status"});
    send_json(&mut stream, &req)?;
    let resp = recv_json(&mut stream)?;
    Ok(resp)
}

pub fn cmd_connect(path: &str) -> Result<Value, String> {
    let mut sock = UnixStream::connect(sock_path()).map_err(|e| e.to_string())?;
    let req = json!({"cmd": "connect", "path": path});
    send_json(&mut sock, &req)?;
    recv_json(&mut sock)
}

pub fn cmd_down(iface: &str) -> Result<Value, String> {
    let mut sock = UnixStream::connect(sock_path()).map_err(|e| e.to_string())?;
    let req = json!({"cmd": "down", "iface": iface});
    send_json(&mut sock, &req)?;
    recv_json(&mut sock)
}

pub fn cmd_status() -> Result<Value, String> {
    let mut sock = UnixStream::connect(sock_path()).map_err(|e| e.to_string())?;
    let req = json!({"cmd": "status"});
    send_json(&mut sock, &req)?;
    recv_json(&mut sock)
}

fn handle_client(mut stream: UnixStream) {
    match recv_json(&mut stream) {
        Ok(req) => {
            let resp = process_request(&req);
            let _ = send_json(&mut stream, &resp);
        }
        Err(e) => {
            eprintln!("JSON okuma hatasi: {}", e);
        }
    }
}

fn process_request(req: &Value) -> Value {
    let cmd = req.get("cmd").and_then(|v| v.as_str()).unwrap_or("");
    match cmd {
        "connect" => cmd_connect_req(req),
        "down" => cmd_down_req(req),
        "status" => cmd_status_req(),
        _ => json!({"ok": false, "error": format!("Bilinmeyen komut: {}", cmd)}),
    }
}

fn cmd_connect_req(req: &Value) -> Value {
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

fn cmd_down_req(req: &Value) -> Value {
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

fn cmd_status_req() -> Value {
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

fn allowed_config_dirs() -> Vec<String> {
    let mut dirs = vec!["/etc/wireguard".to_string()];
    if let Some(home) = std::env::var_os("HOME") {
        dirs.push(format!("{}/.config/untracx", home.to_string_lossy()));
    }
    dirs
}

fn is_valid_iface_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 15
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '+' || c == '=' || c == '.' || c == '-')
}

fn send_json(stream: &mut UnixStream, val: &Value) -> Result<(), String> {
    let data = serde_json::to_vec(val).map_err(|e| e.to_string())?;
    stream
        .write_all(&data)
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn recv_json(stream: &mut UnixStream) -> Result<Value, String> {
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
