use clap::{Parser, Subcommand};
use std::io::{self, Read as _};
use std::path::Path;
use untracx::{config, fs_util, helper, keys, wireguard};
use zeroize::Zeroize;

#[derive(Parser)]
#[command(
    name = "untracx",
    version,
    about = "Ücretsiz kişisel VPN — WireGuard çekirdek CLI"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Yeni istemci anahtar çifti üret (base64). Özel anahtar stdout'a yazılmaz.
    Keygen,
    /// Yeni pre-shared key üret (32 bayt base64).
    Genpsk,
    /// Özel anahtardan genel anahtar türet (stdin'den okur)
    Pubkey,
    /// İstemci WireGuard config dosyası üret (stdin'den private key okur)
    #[command(name = "genconfig")]
    GenConfig {
        #[arg(long)]
        server_public: String,
        #[arg(long)]
        server_ip: String,
        #[arg(long, default_value = "10.66.66.2/32")]
        client_ip: String,
        #[arg(long, default_value = "10.66.66.1")]
        dns: String,
        #[arg(long, default_value_t = 1420)]
        mtu: u16,
        #[arg(long, default_value_t = 51820)]
        port: u16,
        #[arg(long)]
        preshared_key: Option<String>,
        #[arg(short, long, default_value = "client.conf")]
        output: String,
    },
    /// VPN'i bağla (root gerekir): sudo untracx connect client.conf
    Connect { config: String },
    /// VPN'i bağla; özel anahtar stdin'den okunur (root gerekir)
    #[command(name = "connect-stdin")]
    ConnectStdin {
        #[arg(long)]
        server_public: String,
        #[arg(long)]
        server_ip: String,
        #[arg(long, default_value = "10.66.66.2/32")]
        client_ip: String,
        #[arg(long, default_value = "10.66.66.1")]
        dns: String,
        #[arg(long, default_value_t = 1420)]
        mtu: u16,
        #[arg(long, default_value_t = 51820)]
        port: u16,
        #[arg(long)]
        preshared_key: Option<String>,
        #[arg(short, long, default_value = "stdin.conf")]
        output: String,
    },
    /// VPN'i kapat (root gerekir)
    Down { config: String },
    /// Bağlantı durumunu göster
    Status,
    /// Ayrıcalıklı helper servisini başlat/kontrol et (root gerekir)
    #[command(name = "helper")]
    Helper {
        #[command(subcommand)]
        action: HelperAction,
    },
}

#[derive(Subcommand)]
enum HelperAction {
    /// Helper servisini başlat
    Start,
    /// Helper servisini durdur
    Stop,
    /// Helper servisi durumunu göster
    Status,
}

impl From<HelperAction> for helper::HelperAction {
    fn from(a: HelperAction) -> Self {
        match a {
            HelperAction::Start => helper::HelperAction::Start,
            HelperAction::Stop => helper::HelperAction::Stop,
            HelperAction::Status => helper::HelperAction::Status,
        }
    }
}

fn main() {
    let cli = Cli::parse();
    if let Err(e) = run(cli) {
        eprintln!("HATA: {e}");
        std::process::exit(1);
    }
}

fn run(cli: Cli) -> Result<(), String> {
    match cli.command {
        Commands::Keygen => {
            let kp = keys::generate();
            eprintln!("Özel anahtar stdout'a yazılmadı; güvenli şekilde kaydedin.");
            println!("{}", kp.public());
        }
        Commands::Genpsk => {
            let psk = keys::generate_psk();
            println!("{psk}");
        }
        Commands::Pubkey => {
            let mut private_b64 = String::new();
            io::stdin()
                .take(65536)
                .read_to_string(&mut private_b64)
                .map_err(|e| e.to_string())?;
            let trimmed = private_b64.trim();
            if trimmed.is_empty() {
                private_b64.zeroize();
                return Err("stdin boş; özel anahtarı pipe ile gönderin".into());
            }
            let result = keys::public_from_private(trimmed);
            private_b64.zeroize();
            let pubkey = result?;
            println!("{pubkey}");
        }
        Commands::GenConfig {
            server_public,
            server_ip,
            client_ip,
            dns,
            mtu,
            port,
            preshared_key,
            output,
        } => {
            let mut private_b64 = String::new();
            io::stdin()
                .take(65536)
                .read_to_string(&mut private_b64)
                .map_err(|e| e.to_string())?;
            let trimmed = private_b64.trim();
            if trimmed.is_empty() {
                private_b64.zeroize();
                return Err("stdin boş; özel anahtarı pipe ile gönderin".into());
            }
            {
                let mut raw = keys::validate_private(trimmed)?;
                raw.zeroize();
            }
            let cfg = config::ClientConfig {
                client_private: trimmed,
                server_public: &server_public,
                server_ip: &server_ip,
                client_ip: &client_ip,
                dns: &dns,
                mtu,
                port,
                preshared_key: preshared_key.as_deref(),
            };
            let result = config::render(&cfg);
            private_b64.zeroize();
            let mut rendered = result?;
            validate_output_path(&output)?;
            fs_util::write_secret_file_atomic(Path::new(&output), &mut rendered)?;
            println!("✓ {output} yazıldı (0600)");
            println!("Bağlanmak için: sudo untracx connect {output}");
        }
        Commands::Connect { config } => {
            validate_config_path(&config)?;
            wireguard::connect(&config)?
        }
        Commands::ConnectStdin {
            server_public,
            server_ip,
            client_ip,
            dns,
            mtu,
            port,
            preshared_key,
            output,
        } => {
            let mut private_key = read_private_key_from_stdin()?;
            let cfg = config::ClientConfig {
                client_private: &private_key,
                server_public: &server_public,
                server_ip: &server_ip,
                client_ip: &client_ip,
                dns: &dns,
                mtu,
                port,
                preshared_key: preshared_key.as_deref(),
            };
            let mut rendered = config::render(&cfg)?;
            private_key.zeroize();
            validate_output_path(&output)?;
            fs_util::write_secret_file_atomic(Path::new(&output), &mut rendered)?;
            println!("✓ {output} yazıldı (0600, stdin'den okunan private key kullanıldı)");
            println!("Bağlanmak için: sudo untracx connect {output}");
        }
        Commands::Down { config } => {
            validate_config_path(&config)?;
            wireguard::down(&config)?
        }
        Commands::Status => wireguard::status()?,
        Commands::Helper { action } => helper::run(helper::HelperAction::from(action))?,
    }
    Ok(())
}

fn read_private_key_from_stdin() -> Result<String, String> {
    let mut buf = String::new();
    io::stdin()
        .take(65536)
        .read_to_string(&mut buf)
        .map_err(|e| e.to_string())?;
    let key = buf.trim().to_string();
    buf.zeroize();
    if key.is_empty() {
        return Err("stdin boş kaldı; private key sağlayın".into());
    }
    Ok(key)
}

fn validate_config_path(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    let stem = p
        .file_stem()
        .ok_or("Geçersiz config yolu")?
        .to_string_lossy();
    if stem.contains('/') || stem.contains(' ') || stem.is_empty() {
        return Err("Config dosya adı geçersiz (path traversal riski)".into());
    }
    if p.components().count() > 1 {
        let parent = p.parent().unwrap_or(Path::new(""));
        for comp in parent.components() {
            let s = comp.as_os_str().to_string_lossy();
            if s == ".." {
                return Err("Config yolu '..' içeremez".into());
            }
        }
    }
    Ok(())
}

fn validate_output_path(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    let stem = p
        .file_stem()
        .ok_or("Geçersiz çıktı yolu")?
        .to_string_lossy();
    if stem.contains('/') || stem.contains(' ') || stem.is_empty() {
        return Err("Çıkış dosya adı geçersiz (path traversal riski)".into());
    }
    if p.components().count() > 1 {
        let parent = p.parent().unwrap_or(Path::new(""));
        for comp in parent.components() {
            let s = comp.as_os_str().to_string_lossy();
            if s == ".." {
                return Err("Çıkış yolu '..' içeremez".into());
            }
        }
    }
    Ok(())
}
