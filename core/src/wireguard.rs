use std::path::Path;
use std::process::Command;

pub struct ConnInfo {
    pub interface: String,
    pub config_path: String,
}

pub fn connect(config_path: &str) -> Result<(), String> {
    if unsafe { libc_geteuid() } != 0 {
        return Err("root/yönetici hakları gerekli: sudo untracx connect <conf>".into());
    }
    let conn = resolve_interface(config_path)?;
    let iface = &conn.interface;

    if command_exists("wg-quick") {
        let out = Command::new("wg-quick")
            .args(["up", iface])
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            println!("✓ {} yukarı (wg-quick)", iface);
            return Ok(());
        }
        return Err(String::from_utf8_lossy(&out.stderr).into());
    }

    if command_exists("wireguard-go") {
        let out = Command::new("wireguard-go")
            .arg(&conn.config_path)
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            println!("✓ {} yukarı (wireguard-go)", iface);
            return Ok(());
        }
        return Err(String::from_utf8_lossy(&out.stderr).into());
    }

    Err("Ne wg-quick ne wireguard-go bulunamadı. Kurulum: bash scripts/fetch-wireguard-go.sh".into())
}

pub fn down(config_path: &str) -> Result<(), String> {
    if unsafe { libc_geteuid() } != 0 {
        return Err("root/yönetici hakları gerekli: sudo untracx down".into());
    }
    let conn = resolve_interface(config_path)?;
    let iface = &conn.interface;

    if command_exists("wg-quick") {
        let out = Command::new("wg-quick")
            .args(["down", iface])
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            println!("✓ {} aşağı", iface);
            return Ok(());
        }
        return Err(String::from_utf8_lossy(&out.stderr).into());
    }
    Err("wg-quick bulunamadı — arayüzü manuel kapatın".into())
}

pub fn status() -> Result<(), String> {
    if !command_exists("wg") {
        return Err("wg aracı bulunamadı (wireguard-tools kurun)".into());
    }
    let out = Command::new("wg").output().map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&out.stdout).to_string();
    if text.trim().is_empty() {
        println!("VPN bağlı değil.");
    } else {
        print!("{}", text);
    }
    Ok(())
}

fn resolve_interface(config_path: &str) -> Result<ConnInfo, String> {
    let p = Path::new(config_path);
    let stem = p
        .file_stem()
        .ok_or("Geçersiz config yolu")?
        .to_string_lossy()
        .to_string();
    if stem.contains('/') || stem.contains(' ') || stem.is_empty() {
        return Err("Config dosya adı geçersiz".into());
    }
    Ok(ConnInfo {
        interface: stem,
        config_path: config_path.to_string(),
    })
}

fn command_exists(cmd: &str) -> bool {
    Command::new("which")
        .arg(cmd)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(unix)]
unsafe fn libc_geteuid() -> u32 {
    let uid = std::process::Command::new("id")
        .arg("-u")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().parse().unwrap_or(0))
        .unwrap_or(0);
    uid
}

#[cfg(windows)]
unsafe fn libc_geteuid() -> u32 {
    use std::process::Command;
    let out = Command::new("net")
        .args(["session"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    if out { 0 } else { 1 }
}
