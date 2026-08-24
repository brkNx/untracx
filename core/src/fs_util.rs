use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use zeroize::Zeroize;

/// Config/çıktı yolu path traversal'a karşı doğrular:
/// ".." bileşeni reddedilir, dosya adı boş/whitespace/slash içeremez.
pub fn validate_safe_path(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    for comp in p.components() {
        if let std::path::Component::ParentDir = comp {
            return Err(format!("Yol '..' içeremez: {path}"));
        }
    }
    let stem = p
        .file_stem()
        .ok_or("Geçersiz dosya yolu")?
        .to_string_lossy();
    if stem.is_empty() || stem.contains('/') || stem.contains(char::is_whitespace) {
        return Err(format!("Dosya adı geçersiz: {path}"));
    }
    Ok(())
}

/// Writes secret content to a file atomically with 0600 permissions.
/// Prevents symlink hijacking, race conditions, and world-readable exposure.
pub fn write_secret_file_atomic(dest_path: &Path, content: &mut str) -> Result<(), String> {
    let parent = dest_path.parent().unwrap_or_else(|| Path::new("."));
    if !parent.as_os_str().is_empty() && !parent.exists() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Dizin oluşturulamadı: {e}"))?;
    }

    let rand_id: u64 = rand::random();
    let temp_name = format!(".tmp-secret-{rand_id}");
    let temp_path = parent.join(temp_name);

    let write_res = (|| -> Result<(), String> {
        #[cfg(unix)]
        let mut options = OpenOptions::new();
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.write(true).create_new(true);
            options.mode(0o600);
            options.custom_flags(libc::O_NOFOLLOW | libc::O_CLOEXEC);
        }

        #[cfg(not(unix))]
        let mut options = OpenOptions::new();
        #[cfg(not(unix))]
        options.write(true).create_new(true);

        let mut file = options
            .open(&temp_path)
            .map_err(|e| format!("Geçici dosya açılamadı ({temp_path:?}): {e}"))?;

        file.write_all(content.as_bytes())
            .map_err(|e| format!("Yazma hatası: {e}"))?;

        file.sync_all().map_err(|e| format!("Fsync hatası: {e}"))?;

        drop(file);

        // Atomic replace
        std::fs::rename(&temp_path, dest_path).map_err(|e| {
            format!(
                "Atomik yeniden adlandırma başarısız ({} -> {}): {e}",
                temp_path.display(),
                dest_path.display()
            )
        })?;

        Ok(())
    })();

    if write_res.is_err() {
        let _ = std::fs::remove_file(&temp_path);
    }

    content.zeroize();
    write_res
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_safe_path_accepts_normal_paths() {
        assert!(validate_safe_path("client.conf").is_ok());
        assert!(validate_safe_path("/home/user/.config/untracx/wg0.conf").is_ok());
        assert!(validate_safe_path("~/wg0.conf").is_ok());
    }

    #[test]
    fn validate_safe_path_rejects_traversal_and_bad_names() {
        assert!(validate_safe_path("../pwn.conf").is_err());
        assert!(validate_safe_path("/tmp/../etc/passwd").is_err());
        assert!(validate_safe_path("/etc/../../pwn.conf").is_err());
        assert!(validate_safe_path("a b.conf").is_err());
        assert!(validate_safe_path("a\tb.conf").is_err());
        assert!(validate_safe_path("/").is_err());
    }

    #[test]
    fn atomic_secret_write_works_and_zeroizes() {
        let dir = std::env::temp_dir().join(format!("untracx-fs-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("secret.conf");

        let mut secret = "PRIVATE_KEY_DATA_12345".to_string();
        assert!(write_secret_file_atomic(&target, &mut secret).is_ok());
        assert_eq!(secret, "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0");

        let read_back = std::fs::read_to_string(&target).unwrap();
        assert_eq!(read_back, "PRIVATE_KEY_DATA_12345");

        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            let meta = std::fs::metadata(&target).unwrap();
            assert_eq!(meta.mode() & 0o777, 0o600);
        }

        let _ = std::fs::remove_dir_all(&dir);
    }
}
