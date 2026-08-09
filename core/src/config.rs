use std::fmt::Write as _;
use std::net::IpAddr;

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
    validate(cfg)?;

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

/// Üretilen config'e satır/sembol enjeksiyonunu (ör. `PostUp = ...` → root RCE)
/// ve geçersiz değerleri engellemek için tüm alanları sıkı doğrular.
pub fn validate(cfg: &ClientConfig) -> Result<(), String> {
    if cfg.client_private.is_empty() {
        return Err("client-private zorunlu (önce: untracx keygen)".into());
    }
    crate::keys::validate_private(cfg.client_private)?;

    if cfg.server_public.is_empty() {
        return Err("server-public zorunlu".into());
    }
    crate::keys::validate_public(cfg.server_public)?;

    if !valid_ip(cfg.server_ip) {
        return Err(format!(
            "server-ip geçersiz (IP adresi girin, DNS adı değil): {}",
            cfg.server_ip
        ));
    }

    let (ip, prefix) = cfg.client_ip.split_once('/').ok_or_else(|| {
        format!(
            "client-ip CIDR olmalı (ör. 10.66.66.2/32): {}",
            cfg.client_ip
        )
    })?;
    if !valid_ip(ip) {
        return Err(format!("client-ip geçersiz: {}", cfg.client_ip));
    }
    let prefix: u8 = prefix
        .parse()
        .map_err(|_| format!("client-ip alt ağ maskesi geçersiz: {}", cfg.client_ip))?;
    let max_prefix = if ip.contains(':') { 128 } else { 32 };
    if prefix == 0 || prefix > max_prefix {
        return Err(format!("client-ip maskesi aralık dışı: {}", cfg.client_ip));
    }

    for d in cfg.dns.split(',') {
        let d = d.trim();
        if d.is_empty() || !valid_ip(d) {
            return Err(format!(
                "dns geçersiz (virgülle ayrılmış IP'ler): {}",
                cfg.dns
            ));
        }
    }

    if !(576..=1500).contains(&cfg.mtu) {
        return Err(format!("mtu 576-1500 aralığında olmalı: {}", cfg.mtu));
    }
    if cfg.port == 0 {
        return Err("port 0 olamaz".into());
    }
    Ok(())
}

fn valid_ip(s: &str) -> bool {
    // Boşluk/whitespace içeren değerler asla geçerli sayılmaz.
    if s.trim() != s || s.contains(char::is_whitespace) {
        return false;
    }
    s.parse::<IpAddr>().is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keys;

    fn make<'a>(
        server_ip: &'a str,
        client_ip: &'a str,
        dns: &'a str,
        mtu: u16,
        port: u16,
    ) -> ClientConfig<'a> {
        let kp = keys::generate();
        let server = keys::generate();
        ClientConfig {
            client_private: Box::leak(kp.private.into_boxed_str()),
            server_public: Box::leak(server.public.into_boxed_str()),
            server_ip,
            client_ip,
            dns,
            mtu,
            port,
        }
    }

    #[test]
    fn valid_config_passes() {
        let cfg = make("1.2.3.4", "10.66.66.2/32", "10.66.66.1", 1420, 51820);
        assert!(validate(&cfg).is_ok());
        assert!(render(&cfg).is_ok());
    }

    #[test]
    fn rejects_newline_injection() {
        let cfg = make(
            "1.2.3.4\nPostUp = touch /tmp/pwned",
            "10.66.66.2/32",
            "10.66.66.1",
            1420,
            51820,
        );
        assert!(validate(&cfg).is_err());
        let cfg = make(
            "1.2.3.4",
            "10.66.66.2/32",
            "10.66.66.1\nDNS = 8.8.8.8",
            1420,
            51820,
        );
        assert!(validate(&cfg).is_err());
    }

    #[test]
    fn rejects_hostnames_and_whitespace() {
        assert!(validate(&make(
            "vpn.example.com",
            "10.66.66.2/32",
            "10.66.66.1",
            1420,
            51820
        ))
        .is_err());
        assert!(validate(&make(
            "1.2.3.4 ",
            "10.66.66.2/32",
            "10.66.66.1",
            1420,
            51820
        ))
        .is_err());
    }

    #[test]
    fn rejects_bad_cidr_dns_mtu_port() {
        assert!(validate(&make("1.2.3.4", "10.66.66.2", "10.66.66.1", 1420, 51820)).is_err());
        assert!(validate(&make("1.2.3.4", "10.66.66.2/64", "10.66.66.1", 1420, 51820)).is_err());
        assert!(validate(&make(
            "1.2.3.4",
            "10.66.66.2/32",
            "10.66.66.999",
            1420,
            51820
        ))
        .is_err());
        assert!(validate(&make("1.2.3.4", "10.66.66.2/32", "10.66.66.1", 50, 51820)).is_err());
        assert!(validate(&make("1.2.3.4", "10.66.66.2/32", "10.66.66.1", 1420, 0)).is_err());
    }
}
