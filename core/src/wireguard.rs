use std::path::Path;
use std::process::Command;

#[derive(Debug)]
pub struct ConnInfo {
    pub interface: String,
    pub config_path: String,
}

pub fn connect(config_path: &str) -> Result<(), String> {
    if unsafe { libc::geteuid() } != 0 {
        return Err("root/yönetici hakları gerekli: sudo untracx connect <conf>".into());
    }
    let conn = resolve_interface(config_path)?;
    let iface = &conn.interface;

    if command_exists("wg-quick") {
        let out = wg_cmd("wg-quick")
            .args(["up", &conn.config_path])
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            println!("✓ {} yukarı (wg-quick)", iface);
            return Ok(());
        }
        return Err(String::from_utf8_lossy(&out.stderr).into());
    }

    if command_exists("wireguard-go") {
        let out = wg_cmd("wireguard-go")
            .arg(&conn.config_path)
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            println!("✓ {} yukarı (wireguard-go)", iface);
            return Ok(());
        }
        return Err(String::from_utf8_lossy(&out.stderr).into());
    }

    Err(
        "Ne wg-quick ne wireguard-go bulunamadı. Kurulum: bash scripts/fetch-wireguard-go.sh"
            .into(),
    )
}

pub fn down(config_path: &str) -> Result<(), String> {
    if unsafe { libc::geteuid() } != 0 {
        return Err("root/yönetici hakları gerekli: sudo untracx down".into());
    }
    let conn = resolve_interface(config_path)?;
    let iface = &conn.interface;

    if command_exists("wg-quick") {
        let out = wg_cmd("wg-quick")
            .args(["down", &conn.config_path])
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
    let out = wg_cmd("wg").output().map_err(|e| e.to_string())?;
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
    for component in p.components() {
        if let std::path::Component::ParentDir = component {
            return Err("Config dosya yolu '..' içeremez".into());
        }
    }
    let stem = p
        .file_stem()
        .ok_or("Geçersiz config yolu")?
        .to_string_lossy()
        .to_string();
    if !valid_interface_name(&stem) {
        return Err(format!(
            "Config dosya adı arayüz adı olarak geçersiz (15 karakter, [A-Za-z0-9_.=+-]): {stem}"
        ));
    }
    if !p.is_file() {
        return Err(format!("Config dosyası bulunamadı: {config_path}"));
    }
    check_config_perms(p)?;
    Ok(ConnInfo {
        interface: stem,
        config_path: config_path.to_string(),
    })
}

fn valid_interface_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 15
        && name != "."
        && !name.contains("..")
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '=' | '+' | '.'))
}

/// Config içinde özel anahtar var; başkaları okuyamamalı (0600 gerekir).
#[cfg(unix)]
fn check_config_perms(p: &Path) -> Result<(), String> {
    use std::os::unix::fs::MetadataExt;
    let meta = p.metadata().map_err(|e| e.to_string())?;
    if meta.mode() & 0o077 != 0 {
        return Err(format!(
            "{} başkaları tarafından okunabilir (izin: {:o}). chmod 600 {} yapın",
            p.display(),
            meta.mode() & 0o777,
            p.display()
        ));
    }
    Ok(())
}

#[cfg(not(unix))]
fn check_config_perms(_p: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write as _;

    #[test]
    fn interface_name_whitelist() {
        for ok in [
            "wg0",
            "client",
            "macbook-air",
            "tun_1",
            "if1+",
            "a=b",
            "x.y",
        ] {
            assert!(valid_interface_name(ok), "geçerli olmalı: {ok}");
        }
        for bad in [
            "",
            "a b",
            "a/b",
            "a..b",
            "a;b",
            "a$b",
            "a`b",
            "a\nb",
            "abcdefghijklmnopq", // 17 karakter
        ] {
            assert!(!valid_interface_name(bad), "geçersiz olmalı: {bad:?}");
        }
    }

    #[test]
    fn resolve_rejects_parent_dir_traversal() {
        let err = resolve_interface("/tmp/../etc/passwd").unwrap_err();
        assert!(err.contains("'..'"), "err: {err}");
    }

    #[test]
    fn resolve_rejects_loose_stem() {
        // "a/b.conf" dosya adı yok ama kök /tmp var; stem denetimi önce çalışır.
        let err = resolve_interface("/tmp/a;b.conf").unwrap_err();
        assert!(err.contains("geçersiz"), "err: {err}");
    }

    #[test]
    fn resolve_rejects_missing_file() {
        let err = resolve_interface("/tmp/kesinlikle-yok.conf").unwrap_err();
        assert!(err.contains("bulunamadı"), "err: {err}");
    }

    #[cfg(unix)]
    #[test]
    fn perms_check_rejects_world_readable() {
        let dir = std::env::temp_dir().join(format!("untracx-perms-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("loose.conf");
        {
            let mut f = std::fs::File::create(&path).unwrap();
            f.write_all(b"dummy").unwrap();
        }
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
        assert!(check_config_perms(&path).is_err());

        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();
        assert!(check_config_perms(&path).is_ok());

        std::fs::remove_dir_all(&dir).unwrap();
    }
}

fn command_exists(cmd: &str) -> bool {
    PATH_EXTENSIONS.iter().any(|dir| {
        let path = Path::new(dir).join(cmd);
        path.is_file() && is_executable(&path)
    })
}

fn wg_cmd(cmd: &str) -> Command {
    let mut c = Command::new(cmd);
    let path = std::env::var("PATH").unwrap_or_default();
    let extended = format!("{}:{}", PATH_EXTENSIONS.join(":"), path);
    c.env("PATH", extended);
    c
}

const PATH_EXTENSIONS: [&str; 2] = ["/opt/homebrew/bin", "/usr/local/bin"];

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    path.metadata()
        .map(|m| m.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(windows)]
fn is_executable(path: &Path) -> bool {
    path.exists()
}
