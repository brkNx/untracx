mod config;
mod helper;
mod keys;
mod wireguard;

use clap::{Parser, Subcommand};
use std::fs;
use std::io::{self, Read as _};
use std::path::Path;
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
        #[arg(short, long, default_value = "client.conf")]
        output: String,
    },
    /// VPN'i bağla (root gerekir): sudo untracx connect client.conf
    Connect { config: String },
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
    /// Helper servisini başlat (systemd user service)
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
            println!("{}", kp.public);
        }
        Commands::Pubkey => {
            let mut private_b64 = String::new();
            io::stdin()
                .read_to_string(&mut private_b64)
                .map_err(|e| e.to_string())?;
            let trimmed = private_b64.trim();
            if trimmed.is_empty() {
                private_b64.zeroize();
                return Err("stdin boş; özel anahtarı pipe ile gönderin".into());
            }
            let pubkey = keys::public_from_private(trimmed)?;
            private_b64.zeroize();
            println!("{}", pubkey);
        }
        Commands::GenConfig {
            server_public,
            server_ip,
            client_ip,
            dns,
            mtu,
            port,
            output,
        } => {
            let mut private_b64 = String::new();
            io::stdin()
                .read_to_string(&mut private_b64)
                .map_err(|e| e.to_string())?;
            let trimmed = private_b64.trim();
            if trimmed.is_empty() {
                private_b64.zeroize();
                return Err("stdin boş; özel anahtarı pipe ile gönderin".into());
            }
            keys::validate_private(trimmed)?;
            let cfg = config::ClientConfig {
                client_private: trimmed,
                server_public: &server_public,
                server_ip: &server_ip,
                client_ip: &client_ip,
                dns: &dns,
                mtu,
                port,
            };
            let rendered = config::render(&cfg)?;
            fs::write(&output, rendered).map_err(|e| e.to_string())?;
            set_perms_600(&output);
            println!("✓ {output} yazıldı");
            println!("Bağlanmak için: sudo untracx connect {output}");
            private_b64.zeroize();
        }
        Commands::Connect { config } => wireguard::connect(&config)?,
        Commands::Down { config } => wireguard::down(&config)?,
        Commands::Status => wireguard::status()?,
        Commands::Helper { action } => helper::run(helper::HelperAction::from(action))?,
    }
    Ok(())
}

fn set_perms_600(path: &str) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(Path::new(path), fs::Permissions::from_mode(0o600));
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
}
