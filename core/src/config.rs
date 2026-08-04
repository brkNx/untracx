use std::fmt::Write as _;

pub struct ClientConfig<'a> {
    pub client_private: &'a str,
    pub server_public: &'a str,
    pub server_ip: &'a str,
    pub client_ip: &'a str,
    pub dns: &'a str,
    pub mtu: u16,
    pub port: u16,
}

impl Default for ClientConfig<'_> {
    fn default() -> Self {
        ClientConfig {
            client_private: "",
            server_public: "",
            server_ip: "",
            client_ip: "10.66.66.2/32",
            dns: "10.66.66.1",
            mtu: 1420,
            port: 51820,
        }
    }
}

pub fn render(cfg: &ClientConfig) -> Result<String, String> {
    if cfg.client_private.is_empty() {
        return Err("client-private zorunlu (önce: untracx keygen)".into());
    }
    if cfg.server_public.is_empty() {
        return Err("server-public zorunlu".into());
    }
    if cfg.server_ip.is_empty() {
        return Err("server-ip zorunlu (sunucunun genel IP'si)".into());
    }
    crate::keys::validate_public(cfg.server_public)?;

    let mut out = String::new();
    writeln!(out, "[Interface]").unwrap();
    writeln!(out, "PrivateKey = {}", cfg.client_private).unwrap();
    writeln!(out, "Address = {}", cfg.client_ip).unwrap();
    writeln!(out, "DNS = {}", cfg.dns).unwrap();
    writeln!(out, "MTU = {}", cfg.mtu).unwrap();
    writeln!(out).unwrap();
    writeln!(out, "[Peer]").unwrap();
    writeln!(out, "PublicKey = {}", cfg.server_public).unwrap();
    writeln!(out, "Endpoint = {}:{}", cfg.server_ip, cfg.port).unwrap();
    writeln!(out, "AllowedIPs = 0.0.0.0/0, ::/0").unwrap();
    writeln!(out, "PersistentKeepalive = 25").unwrap();
    Ok(out)
}
