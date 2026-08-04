use untracx::helper;
use std::io::{BufRead as _, Write as _};

fn send_request(req: &str) -> Result<String, String> {
    let path = helper::socket_path();
    let stream = std::os::unix::net::UnixStream::connect(&path).map_err(|e| e.to_string())?;
    let mut stream = stream;
    writeln!(stream, "{}", req).map_err(|e| e.to_string())?;
    let mut reader = std::io::BufReader::new(&mut stream);
    let mut line = String::new();
    reader.read_line(&mut line).map_err(|e| e.to_string())?;
    Ok(line.trim().to_string())
}

#[tauri::command]
fn helper_start() -> Result<String, String> {
    let path = helper::socket_path();
    if path.exists() {
        return Ok("Helper already running".to_string());
    }
    std::thread::spawn(|| {
        let _ = helper::start_socket_listener();
    });
    Ok("Helper started".to_string())
}

#[tauri::command]
fn helper_stop() -> Result<String, String> {
    let path = helper::socket_path();
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
        Ok("Helper stopped".to_string())
    } else {
        Ok("Helper not running".to_string())
    }
}

#[tauri::command]
fn helper_status() -> Result<String, String> {
    let req = serde_json::json!({"method": "status"}).to_string();
    send_request(&req)
}

#[tauri::command]
fn vpn_connect(config: String) -> Result<String, String> {
    let req = serde_json::json!({"method": "start", "config": config}).to_string();
    send_request(&req)
}

#[tauri::command]
fn vpn_down(config: String) -> Result<String, String> {
    let req = serde_json::json!({"method": "stop", "config": config}).to_string();
    send_request(&req)
}

#[tauri::command]
fn peer_list() -> Result<String, String> {
    let req = serde_json::json!({"method": "status"}).to_string();
    send_request(&req)
}

#[tauri::command]
fn peer_add(name: String) -> Result<String, String> {
    let req = serde_json::json!({"method": "add_peer", "name": name}).to_string();
    send_request(&req)
}

#[tauri::command]
fn peer_remove(name: String) -> Result<String, String> {
    let req = serde_json::json!({"method": "remove_peer", "name": name}).to_string();
    send_request(&req)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            helper_start,
            helper_stop,
            helper_status,
            vpn_connect,
            vpn_down,
            peer_list,
            peer_add,
            peer_remove,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}