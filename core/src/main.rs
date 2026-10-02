use clap::{Parser, Subcommand};
use std::io::{self, Read as _};
use std::path::Path;
use untracx::{config, fs_util, helper, keys, wireguard};
use zeroize::Zeroize;

#[derive(Parser)]
#[command(
    name = "untracx",
    version,
    about = "Free personal VPN — WireGuard core CLI"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate new client keypair (outputs Curve25519 base64 private key)
    Keygen {
        /// Print both public and private keys
        #[arg(long)]
        both: bool,
        /// Output in JSON format (privateKey, publicKey, presharedKey)
        #[arg(long)]
        json: bool,
    },
    /// Generate new pre-shared key (32 bytes base64)
    Genpsk,
    /// Derive public key from private key (reads from stdin)
    Pubkey,
    /// Generate client WireGuard config file (reads private key from stdin)
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
    /// Connect VPN (requires root/admin): sudo untracx connect client.conf
    Connect { config: String },
    /// Connect VPN; private key is read from stdin (requires root/admin)
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
    /// Disconnect VPN (requires root/admin)
    Down { config: String },
    /// Display connection status
    Status,
    /// Start/manage privileged helper service (requires root/admin)
    #[command(name = "helper")]
    Helper {
        #[command(subcommand)]
        action: HelperAction,
    },
}

#[derive(Subcommand)]
enum HelperAction {
    /// Start helper service
    Start,
    /// Stop helper service
    Stop,
    /// Display helper service status
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
        eprintln!("ERROR: {e}");
        std::process::exit(1);
    }
}

fn run(cli: Cli) -> Result<(), String> {
    match cli.command {
        Commands::Keygen { both, json } => {
            let kp = keys::generate();
            let psk = keys::generate_psk();
            if json {
                println!(
                    "{}",
                    serde_json::json!({
                        "privateKey": kp.private(),
                        "publicKey": kp.public(),
                        "presharedKey": psk,
                    })
                );
            } else if both {
                println!("Private Key : {}", kp.private());
                println!("Public Key  : {}", kp.public());
                println!("Pre-shared  : {}", psk);
            } else {
                println!("{}", kp.private());
            }
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
                return Err("stdin is empty; pipe private key into command".into());
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
                return Err("stdin is empty; pipe private key into command".into());
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
            fs_util::validate_safe_path(&output)?;
            fs_util::write_secret_file_atomic(Path::new(&output), &mut rendered)?;
            println!("✓ {output} written (0600)");
            println!("To connect: sudo untracx connect {output}");
        }
        Commands::Connect { config } => {
            fs_util::validate_safe_path(&config)?;
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
            fs_util::validate_safe_path(&output)?;
            fs_util::write_secret_file_atomic(Path::new(&output), &mut rendered)?;
            println!("✓ {output} written (0600, using private key from stdin)");
            println!("To connect: sudo untracx connect {output}");
        }
        Commands::Down { config } => {
            fs_util::validate_safe_path(&config)?;
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
        return Err("stdin is empty; provide private key".into());
    }
    Ok(key)
}
