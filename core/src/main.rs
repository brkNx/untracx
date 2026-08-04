mod config;
mod keys;
mod wireguard;

use clap::{Parser, Subcommand};
use std::fs;
use std::path::Path;

#[derive(Parser)]
#[command(name = "untracx", version, about = "Ücretsiz kişisel VPN — WireGuard çekirdek CLI")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Yeni istemci anahtar çifti üret (base64)
    Keygen,
    /// Özel anahtardan genel anahtar türet
    Pubkey { private_key: String },
    /// İstemci WireGuard config dosyası üret
    #[command(name = "genconfig")]
    GenConfig {
        #[arg(long)]
        client_private: String,
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
    /// VPN'i bağla (root gerekir):  sudo untracx connect client.conf
    Connect { config: String },
    /// VPN'i kapat (root gerekir)
    Down { config: String },
    /// Bağlantı durumunu göster
    Status,
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
            println!("PrivateKey: {}", kp.private);
            println!("PublicKey: {}", kp.public);
        }
        Commands::Pubkey { private_key } => {
            println!("{}", keys::public_from_private(&private_key)?);
        }
        Commands::GenConfig {
            client_private,
            server_public,
            server_ip,
            client_ip,
            dns,
            mtu,
            port,
            output,
        } => {
            let cfg = config::ClientConfig {
                client_private: &client_private,
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
        }
        Commands::Connect { config } => wireguard::connect(&config)?,
        Commands::Down { config } => wireguard::down(&config)?,
        Commands::Status => wireguard::status()?,
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
