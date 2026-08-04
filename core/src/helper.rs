use serde::{Deserialize, Serialize};
use std::io::{Read as _, Write as _};
use std::os::unix::net::UnixListener;
use std::path::PathBuf;
use std::process::Command;

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "method", rename_all = "snake_case")]
pub enum HelperRequest {
    Start { config: String },
    Stop { config: String },
    Status,
    AddPeer { name: String },
    RemovePeer { name: String },
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum HelperResponse {
    Ok { output: String },
    Error { message: String },
}

pub fn socket_path() -> PathBuf {
    let uid = unsafe { libc::getuid() };
    PathBuf::from(format!("/run/user/{}/untracx.sock", uid))
}

pub fn handle_request(req: &str) -> String {
    let request: HelperRequest = match serde_json::from_str(req) {
        Ok(r) => r,
        Err(e) => {
            return serde_json::to_string(&HelperResponse::Error {
                message: format!("Geçersiz istek: {}", e),
            })
            .unwrap();
        }
    };

    let response = match request {
        HelperRequest::Start { config } => {
            if !validate_config_path(&config) {
                HelperResponse::Error {
                    message: "Geçersiz config yolu".into(),
                }
            } else {
                match run_wg_quick("up", &config) {
                    Ok(output) => HelperResponse::Ok { output },
                    Err(e) => HelperResponse::Error { message: e },
                }
            }
        }
        HelperRequest::Stop { config } => {
            if !validate_config_path(&config) {
                HelperResponse::Error {
                    message: "Geçersiz config yolu".into(),
                }
            } else {
                match run_wg_quick("down", &config) {
                    Ok(output) => HelperResponse::Ok { output },
                    Err(e) => HelperResponse::Error { message: e },
                }
            }
        }
        HelperRequest::Status => match run_wg_show() {
            Ok(output) => HelperResponse::Ok { output },
            Err(e) => HelperResponse::Error { message: e },
        },
        HelperRequest::AddPeer { name } => {
            if !validate_peer_name(&name) {
                HelperResponse::Error {
                    message: "Geçersiz peer adı".into(),
                }
            } else {
                match run_add_peer(&name) {
                    Ok(output) => HelperResponse::Ok { output },
                    Err(e) => HelperResponse::Error { message: e },
                }
            }
        }
        HelperRequest::RemovePeer { name } => {
            if !validate_peer_name(&name) {
                HelperResponse::Error {
                    message: "Geçersiz peer adı".into(),
                }
            } else {
                match run_remove_peer(&name) {
                    Ok(output) => HelperResponse::Ok { output },
                    Err(e) => HelperResponse::Error { message: e },
                }
            }
        }
    };

    serde_json::to_string(&response).unwrap()
}

pub fn start_socket_listener() -> Result<(), String> {
    let path = socket_path();
    if path.exists() {
        let _ = std::fs::remove_file(&path);
    }

    let listener = UnixListener::bind(&path).map_err(|e| e.to_string())?;
    std::fs::set_permissions(&path, std::os::unix::fs::PermissionsExt::from_mode(0o600))
        .map_err(|e| e.to_string())?;

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let mut buf = String::new();
                let mut reader = std::io::BufReader::new(&stream);
                if reader.read_to_string(&mut buf).is_ok() && !buf.trim().is_empty() {
                    let response = handle_request(buf.trim());
                    let _ = stream
                        .peer_addr()
                        .and_then(|_| stream.try_clone())
                        .and_then(|mut s| s.write_all(response.as_bytes()));
                }
            }
            Err(_) => continue,
        }
    }

    Ok(())
}

fn run_wg_quick(action: &str, config: &str) -> Result<String, String> {
    let output = Command::new("wg-quick")
        .args([action, config])
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn run_wg_show() -> Result<String, String> {
    let output = Command::new("wg")
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn run_add_peer(name: &str) -> Result<String, String> {
    let output = Command::new("untracx-add-peer")
        .arg(name)
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn run_remove_peer(name: &str) -> Result<String, String> {
    let output = Command::new("untracx-remove-peer")
        .arg(name)
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn validate_config_path(path: &str) -> bool {
    let p = std::path::Path::new(path);
    if p.components().count() > 1 {
        for comp in p.components() {
            let s = comp.as_os_str().to_string_lossy();
            if s == ".." {
                return false;
            }
        }
    }
    p.file_stem()
        .map(|s| {
            let stem = s.to_string_lossy();
            !stem.contains('/') && !stem.contains(' ') && !stem.is_empty()
        })
        .unwrap_or(false)
}

fn validate_peer_name(name: &str) -> bool {
    name.len() >= 1
        && name.len() <= 32
        && name.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '_' || c == '-')
}