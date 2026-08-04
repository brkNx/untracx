# untracx

Ücretsiz kişisel VPN — **WireGuard** + **Rust** çekirdek + **Tauri/React** GUI.
Türkiye & Azerbaycan odaklı kullanım; maliyet: **0 ₺** (Oracle Cloud Always Free).

## Mimari

```
React GUI → Tauri (Rust) → core CLI → root helper → wireguard-go → VPS (Frankfurt)
```

## Sunucu (bir kez, Oracle Cloud Always Free ARM)

1. Oracle Cloud'ta Always Free ARM VM açın (Ubuntu 22.04/24.04, AMD64 değil ARM!)
2. Frankfurt bölgesi seçin (TR ~35ms, AZ ~55ms)
3. VM'e SSH olun ve çalıştırın:

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/brkNx/untracx/main/server/setup.sh)"
```

4. Sunucu `PublicKey` ve genel IP'yi not edin.
5. Her cihaz için: `sudo bash add-peer.sh macbook` → `/root/untracx-macbook.conf` çıkar, `scp` ile cihaza kopyalayın, **sonra sunucudan silin**.

## İstemci (macOS / Linux / Windows)

```bash
cd core
cargo build --release

# 1. Anahtar üret
./target/release/untracx keygen

# 2. Config üret (sunucu çıktısındaki bilgilerle)
./target/release/untracx genconfig \
  --client-private <yukarıdaki PrivateKey> \
  --server-public  <sunucu PublicKey> \
  --server-ip      <sunucu genel IP> \
  -o client.conf

# 3. Bağlan (Linux/macOS: wg-quick gerekir; yoksa: bash scripts/fetch-wireguard-go.sh)
sudo ./target/release/untracx connect client.conf

# 4. Durum / kapat
untracx status
sudo untracx down client.conf
```

## Güvenlik

- Kill-switch: `AllowedIPs = 0.0.0.0/0, ::/0` — bağlantı koparsa trafik durur
- DNS tünel içinden (10.66.66.1), sızıntı olmaz
- Sunucu özel anahtarı yalnızca sunucuda; istemci anahtarları repo'ya asla (`*.conf` gitignore)
- ufw: yalnızca SSH + UDP 51820; fail2ban + otomatik güvenlik yamaları

## Yol Haritası

- [x] Aşama 1: Repo + sunucu scriptleri + core CLI (keygen/genconfig)
- [ ] Aşama 2: kill-switch doğrulaması, IPv6, bağlantı testleri
- [ ] Aşama 3: Tauri + React GUI (bağlan/kop, durum, profiller, tepsi)
- [ ] Aşama 4: root helper (Windows admin/service, macOS launchd, Linux pkexec)
- [ ] Aşama 5: Paketleme (MSI/AppImage/DMG, imzasız kişisel)

## Lisans

MIT
