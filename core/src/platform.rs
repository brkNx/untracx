use std::path::PathBuf;

/// Returns whether the current process is running with administrative/root privileges.
pub fn is_root() -> bool {
    #[cfg(unix)]
    {
        // SAFETY: geteuid is a standard POSIX libc call with no preconditions or pointers.
        unsafe { libc::geteuid() == 0 }
    }
    #[cfg(windows)]
    {
        true
    }
}

/// Returns standard system binary search paths in order of trust (system root first).
pub fn trusted_search_paths() -> Vec<&'static str> {
    #[cfg(unix)]
    {
        vec![
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
            "/usr/local/bin",
            "/opt/homebrew/bin",
        ]
    }
    #[cfg(windows)]
    {
        vec![r"C:\Program Files\WireGuard", r"C:\Windows\System32"]
    }
}

/// Returns the helper socket path for the current user/system.
pub fn helper_sock_path() -> PathBuf {
    #[cfg(unix)]
    {
        // SAFETY: getuid is a standard POSIX libc call with no preconditions.
        let uid = unsafe { libc::getuid() };
        if uid == 0 {
            PathBuf::from("/run/untracx/helper.sock")
        } else {
            PathBuf::from(format!("/run/user/{}/untracx.sock", uid))
        }
    }
    #[cfg(windows)]
    {
        PathBuf::from(r"\\.\pipe\untracx-helper")
    }
}
