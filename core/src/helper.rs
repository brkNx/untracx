use serde_json::{json, Value};
#[cfg(unix)]
use std::path::Path;
use std::path::PathBuf;

#[cfg(unix)]
use std::fs;
#[cfg(unix)]
use std::io::{BufRead, BufReader, Write as _};
#[cfg(unix)]
use std::os::unix::net::{UnixListener, UnixStream};
#[cfg(unix)]
use std::process::Command;
#[cfg(unix)]
use std::time::Duration;

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

pub fn sock_path() -> PathBuf {
    crate::platform::helper_sock_path()
}

#[cfg(unix)]
pub fn start() -> Result<(), String> {
    let path = sock_path();
    if path.exists() {
        return Err(format!("Socket zaten mevcut: {}", path.display()));
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let listener = UnixListener::bind(&path).map_err(|e| e.to_string())?;
    println!("Helper dinliyor: {}", path.display());
    println!("Ctrl+C ile durdurun.");
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => handle_client(stream),
            Err(e) => eprintln!("Baglanti hatasi: {e}"),
        }
    }
    Ok(())
}

#[cfg(not(unix))]
pub fn start() -> Result<(), String> {
    Err("Helper servisi bu platformda desteklenmiyor".into())
}

#[cfg(unix)]
pub fn stop() -> Result<(), String> {
    let path = sock_path();
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
        println!("Helper durduruldu: {}", path.display());
    } else {
        println!("Helper calismiyor (socket yok).");
    }
    Ok(())
}

#[cfg(not(unix))]
pub fn stop() -> Result<(), String> {
    Err("Helper servisi bu platformda desteklenmiyor".into())
}

#[cfg(unix)]
pub fn status() -> Result<Value, String> {
    let path = sock_path();
    if !path.exists() {
        return Ok(json!({"running": false, "socket": path.display().to_string()}));
    }
    let mut stream = UnixStream::connect(&path).map_err(|e| e.to_string())?;
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;

    let req = json!({"cmd": "status"});
    send_json(&mut stream, &req)?;
    let resp = recv_json(&mut stream)?;
    Ok(resp)
}

#[cfg(not(unix))]
pub fn status() -> Result<Value, String> {
    Ok(json!({"running": false, "supported": false}))
}

#[cfg(unix)]
pub fn cmd_connect(path: &str) -> Result<Value, String> {
    let mut sock = UnixStream::connect(sock_path()).map_err(|e| e.to_string())?;
    sock.set_read_timeout(Some(Duration::from_secs(10)))
        .map_err(|e| e.to_string())?;
    sock.set_write_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;
    let req = json!({"cmd": "connect", "path": path});
    send_json(&mut sock, &req)?;
    recv_json(&mut sock)
}

#[cfg(not(unix))]
pub fn cmd_connect(_path: &str) -> Result<Value, String> {
    Err("Platform desteklenmiyor".into())
}

#[cfg(unix)]
pub fn cmd_down(iface: &str) -> Result<Value, String> {
    let mut sock = UnixStream::connect(sock_path()).map_err(|e| e.to_string())?;
    sock.set_read_timeout(Some(Duration::from_secs(10)))
        .map_err(|e| e.to_string())?;
    sock.set_write_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;
    let req = json!({"cmd": "down", "iface": iface});
    send_json(&mut sock, &req)?;
    recv_json(&mut sock)
}

#[cfg(not(unix))]
pub fn cmd_down(_iface: &str) -> Result<Value, String> {
    Err("Platform desteklenmiyor".into())
}

#[cfg(unix)]
pub fn cmd_status() -> Result<Value, String> {
    let mut sock = UnixStream::connect(sock_path()).map_err(|e| e.to_string())?;
    sock.set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;
    sock.set_write_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| e.to_string())?;
    let req = json!({"cmd": "status"});
    send_json(&mut sock, &req)?;
    recv_json(&mut sock)
}

#[cfg(not(unix))]
pub fn cmd_status() -> Result<Value, String> {
    Err("Platform desteklenmiyor".into())
}

#[cfg(unix)]
fn handle_client(mut stream: UnixStream) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));
    match recv_json(&mut stream) {
        Ok(req) => {
            let resp = process_request(&req);
            let _ = send_json(&mut stream, &resp);
        }
        Err(e) => {
            eprintln!("JSON okuma hatasi: {e}");
        }
    }
}

#[cfg(unix)]
fn process_request(req: &Value) -> Value {
    let cmd = req.get("cmd").and_then(|v| v.as_str()).unwrap_or("");
    match cmd {
        "connect" => cmd_connect_req(req),
        "down" => cmd_down_req(req),
        "status" => cmd_status_req(),
        _ => json!({"ok": false, "error": format!("Bilinmeyen komut: {}", cmd)}),
    }
}

#[cfg(unix)]
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
    if !is_valid_iface_name(&iface) {
        return json!({"ok": false, "error": format!("Gecersiz arayuz adi: {}", iface)});
    }
    let out = Command::new("wg-quick").args(["up", path]).output();
    match out {
        Ok(o) if o.status.success() => json!({"ok": true, "iface": iface}),
        Ok(o) => json!({"ok": false, "error": String::from_utf8_lossy(&o.stderr).to_string()}),
        Err(e) => json!({"ok": false, "error": e.to_string()}),
    }
}

#[cfg(unix)]
fn cmd_down_req(req: &Value) -> Value {
    let iface = match req.get("iface").and_then(|v| v.as_str()) {
        Some(i) => i,
        None => return json!({"ok": false, "error": "iface zorunlu"}),
    };
    if !is_valid_iface_name(iface) {
        return json!({"ok": false, "error": "Gecersiz arayuz adi"});
    }
    let out = Command::new("wg-quick").args(["down", iface]).output();
    match out {
        Ok(o) if o.status.success() => json!({"ok": true, "iface": iface}),
        Ok(o) => json!({"ok": false, "error": String::from_utf8_lossy(&o.stderr).to_string()}),
        Err(e) => json!({"ok": false, "error": e.to_string()}),
    }
}

#[cfg(unix)]
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

#[cfg(unix)]
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

#[cfg(unix)]
fn allowed_config_dirs() -> Vec<String> {
    let mut dirs = vec!["/etc/wireguard".to_string()];
    if let Some(home) = std::env::var_os("HOME") {
        dirs.push(format!("{}/.config/untracx", home.to_string_lossy()));
    }
    dirs
}

#[cfg(unix)]
fn is_valid_iface_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 15
        && name.chars().all(|c| {
            c.is_ascii_alphanumeric() || c == '_' || c == '+' || c == '=' || c == '.' || c == '-'
        })
}

#[cfg(unix)]
fn send_json(stream: &mut UnixStream, val: &Value) -> Result<(), String> {
    let mut data = serde_json::to_vec(val).map_err(|e| e.to_string())?;
    data.push(b'\n'); // Newline delimiter for framing
    stream.write_all(&data).map_err(|e| e.to_string())?;
    stream.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(unix)]
fn recv_json(stream: &mut UnixStream) -> Result<Value, String> {
    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    const MAX_SIZE: usize = 65536;

    let n = reader.read_line(&mut line).map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Baglanti kapandi".into());
    }
    if line.len() > MAX_SIZE {
        return Err("JSON mesaji cok buyuk".into());
    }
    serde_json::from_str(line.trim()).map_err(|e| e.to_string())
}
