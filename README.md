# untracx

Kişisel kullanım için WireGuard tabanlı VPN projesi. Hedef; önce güvenli ve tekrar üretilebilir bir sunucu kurulumu, ardından Rust/Tauri tabanlı masaüstü istemcisidir.

> Durum: Aşama 1 ve Aşama 2 tamamlandı. Sunucu Oracle Cloud Always Free (Ubuntu 24.04 x86_64) üzerinde kurulu ve çalışıyor; peer yönetimi, Rust CLI güvenlik sertleştirmesi, ayrıcalıklı helper protokolü, Tauri 2 + React GUI (tam fonksiyonel — anahtar üretimi, config oluşturma, peer yönetimi, ayarlar) ve platforma özel kill-switch scriptleri hazır. Sıradaki adım gerçek cihazla handshake/egress testi.

## Canlı sunucu

| Alan | Değer |
|---|---|
| Provider | Oracle Cloud Always Free |
| OS | Ubuntu 24.04 (x86_64) |
| Public IP | `158.180.50.114` |
| Endpoint | `158.180.50.114:51820/udp` |
| VPN alt ağı | `10.66.66.0/24` |
| VPN DNS | `10.66.66.1` (Unbound, yalnız VPN alt ağı) |
| Durum | Kurulum tamam; gerçek cihaz testi bekleniyor |

## Ne sağlar, ne sağlamaz?

- Cihaz ile Oracle VM arasındaki trafiği WireGuard ile şifreler.
- Ortak Wi-Fi veya yerel ISP'nin bu tünelin içeriğini görmesini engeller.
- İnternet trafiği Oracle VM'nin bulunduğu bölgeden çıkar.
- Anonimlik sağlamaz: Oracle, hedef servisler ve oturum açtığınız hesaplar sizi farklı yollarla ilişkilendirebilir.
- Türkiye veya Azerbaycan çıkış IP'si sağlamaz; bunun için o ülkelerde bir sunucu gerekir.
- `AllowedIPs` tek başına kill-switch değildir. Platforma özel sızıntı engelleme Aşama 2 kapsamındadır.

Detaylı sınırlar için [docs/SECURITY.md](docs/SECURITY.md) belgesine bakın.

## Mevcut mimari

```text
Resmi WireGuard istemcisi / wg-quick
              |
        WireGuard tüneli
              |
Ubuntu 24.04 VM -> kernel WireGuard -> UFW/NAT -> Internet
              |
      Unbound recursive DNS
```

Planlanan masaüstü katmanı:

```text
React GUI -> Tauri/Rust -> ayrıcalıklı, dar kapsamlı helper -> işletim sistemi WireGuard backend'i
```

## Ücretsiz kullanım notu

Oracle'ın güncel Always Free sınırları seçilen shape ve home region'a bağlıdır. x86_64 `VM.Standard.E2.1.Micro` ve Arm `VM.Standard.A1.Flex` seçenekleri farklı kapasitelere sahiptir. VM, boot volume ve ağ kaynaklarında **Always Free-eligible** etiketini Oracle Console'da doğrulamadan “0 maliyet” varsaymayın. Bütçe alarmı açmanız önerilir.

Bu repo hem Ubuntu 24.04 x86_64 hem arm64 sunucuyu destekler.

## 1. Oracle ağ kuralları

Kurulumdan önce OCI Network Security Group veya Security List üzerinde:

| Yön | Protokol/port | Kaynak | Amaç |
|---|---|---|---|
| Ingress | TCP 22 | Mümkünse kendi public IP'niz `/32` | SSH yönetimi |
| Ingress | UDP 51820 | Seyahatte kullanacaksanız `0.0.0.0/0` | WireGuard |

TCP 53 veya UDP 53'ü internete açmayın; DNS yalnız VPN alt ağından kabul edilir. Ayrıntılı adımlar: [docs/ORACLE.md](docs/ORACLE.md).

## 2. Sunucu dosyalarını yükleme

Repo private olduğu için `raw.githubusercontent.com/.../setup.sh` komutu kimlik doğrulamasız çalışmaz. Yerel checkout'tan bütün `server/` klasörünü yükleyin:

```bash
scp -r server ubuntu@158.180.50.114:/tmp/untracx-server
ssh ubuntu@158.180.50.114
```

Sunucuda:

```bash
cd /tmp/untracx-server
sudo PUBLIC_ENDPOINT=158.180.50.114 bash setup.sh
```

Script şunları yapar:

- WireGuard, UFW, fail2ban ve unattended-upgrades kurar.
- OCI dış ağ arayüzünü otomatik bulur; `eth0` varsaymaz.
- Sunucu anahtarını ilk çalıştırmada üretir, sonraki çalıştırmalarda korur.
- Peer kayıtlarını yeniden çalıştırmada silmez.
- `10.66.66.1` üzerinde yalnız VPN alt ağına açık Unbound DNS kurar.
- `untracx-add-peer` ve `untracx-remove-peer` komutlarını yükler.

## 3. İlk cihazı ekleme

Sunucuda:

```bash
sudo untracx-add-peer macbook
```

Komut config dosyasını `sudo` çağrısını yapan kullanıcının home dizinine 0600 izinle yazar. Yerel bilgisayarda:

```bash
scp ubuntu@158.180.50.114:~/untracx-macbook.conf .
```

Dosyayı resmi WireGuard uygulamasına aktarın. Aktardıktan sonra sunucudaki geçici kopyayı silin:

```bash
ssh ubuntu@158.180.50.114 'rm -f ~/untracx-macbook.conf'
```

Kaybolan veya artık kullanılmayan cihazı iptal etmek için:

```bash
sudo untracx-remove-peer macbook
```

## 4. Doğrulama

Sunucuda:

```bash
sudo systemctl status wg-quick@wg0 --no-pager
sudo wg show wg0
sudo systemctl status unbound --no-pager
sudo ufw status verbose
```

İstemci bağlandıktan sonra:

```bash
curl -4 https://api.ipify.org
```

Çıktı sunucu endpoint'i olmalıdır. DNS ve kill-switch testleri tamamlanmadan istemciyi “sızıntısız” kabul etmeyin.

## GUI (Tauri 2 + React)

`gui/` dizinde tam fonksiyonel Tauri 2 + React GUI mevcut. Dark tema, tab navigasyonu, tip güvenli API çağrıları ve test coverage ile.

### Özellikler

- **Durum** — WireGuard durumu, otomatik yenileme (10 sn)
- **Bağlantı** — Config yolu seçimi, arayüz adı, bağlan/kes
- **Yönetim** — Peer listesi, ekleme/kaldırma (onaylı), tablo görünümü
- **Anahtarlar** — X25519 anahtar üretimi, public key türetme, validasyon
- **Config Üretici** — WireGuard config oluşturma, dosyaya kaydetme (0600 izinli)
- **Ayarlar** — Varsayılan config yolu, arayüz adı, sunucu bilgileri (kalıcı)

### Kurulum

```bash
cd gui/frontend
npm install
npm run dev   # geliştirme sunucusu (http://localhost:5173)
```

Veya Makefile üzerinden:

```bash
make dev-gui    # geliştirme modu
make build-gui  # production derleme
make test-gui   # frontend testleri
make lint-gui   # ESLint + Prettier kontrolü
```

### Tauri komutları

| Komut | Açıklama |
|---|---|
| `helper_start` | systemd user service olarak helper'ı başlat |
| `helper_stop` | helper servisini durdur |
| `helper_status` | helper durumu + socket bilgisi |
| `vpn_connect` | Config dosyasıyla VPN bağlantısı |
| `vpn_down` | Arayüz adıyla VPN bağlantısını kes |
| `vpn_status` | WireGuard durumunu sorgula |
| `peer_list` | Aktif peer'leri listele |
| `peer_add` | Yeni peer ekle |
| `peer_remove` | Peer'ı kaldır |
| `keygen` | Yeni X25519 anahtar çifti üret |
| `public_from_private` | Özel anahtardan genel anahtar türet |
| `validate_private_key` | Özel anahtarı doğrula |
| `validate_public_key` | Genel anahtarı doğrula |
| `generate_config` | WireGuard config üret |
| `save_config` | Config'ı dosyaya kaydet (0600 izinli) |

### Yapılandırma

- `gui/tauri.conf.json` — ürün adı, versiyon, pencere boyutları, CSP
- `gui/capabilities/default.json` — Tauri 2 capabilities (core, dialog, store izinleri)
- `gui/frontend/src/lib/types.ts` — tüm API tipleri
- `gui/frontend/src/lib/helper.ts` — tip güvenli Tauri invoke wrapper'ları
- `gui/frontend/src/styles.css` — dark tema, BEM isimlendirme

## Kill-switch ve DNS leak koruması

Kill-switch, VPN tüneli kesildiğinde internet trafiğinin VPN dışına sızmasını engeller. Platformlara özel kill-switch scriptleri `scripts/` klasöründe bulunur:

| Platform | Script | Mekanizma |
|---|---|---|
| Linux | `scripts/killswitch-linux.sh` | nftables (forward/output chain) |
| macOS | `scripts/killswitch-macos.sh` | ApplicationFirewall (socketfilterfw) |
| Windows | `scripts/killswitch-windows.ps1` | Windows Filtering Platform (New-NetFirewallRule) |

Kullanım:

```bash
# Linux
sudo bash scripts/killswitch-linux.sh ac
sudo bash scripts/killswitch-linux.sh kapat
sudo bash scripts/killswitch-linux.sh durum

# macOS
sudo bash scripts/killswitch-macos.sh ac
sudo bash scripts/killswitch-macos.sh kapat
sudo bash scripts/killswitch-macos.sh durum

# Windows (PowerShell, yönetici)
.\scripts\killswitch-windows.ps1 ac
.\scripts\killswitch-windows.ps1 kapat
.\scripts\killswitch-windows.ps1 durum
```

### DNS leak koruması

Sunucu DNS'i yalnız VPN alt ağından kabul eder (`10.66.66.0/24`). Public 53 kapalıdır. İstemci tarafında `DNS = 10.66.66.1` ayarı tüm DNS sorgularını tünelden yönlendirir.

Kill-switch aktifken DNS sorgularının ISP DNS sunucusuna sızmadığını doğrulayın:

```bash
# Linux/macOS
dig +short myip.opendns.com @resolver1.opendns.com

# Windows
Resolve-DnsName myip.opendns.com -Server 208.67.222.222
```

Sonuç VPN sunucunun IP'sini göstermeli, ISP DNS sunucusunu göstermemelidir. VPN kesildikten sonra `dig @10.66.66.1 google.com` timeout olmalı (leak yok).

## Geliştirici komutları

```bash
# Tüm kontroller (shell, Rust, frontend)
./scripts/check.sh

# Makefile üzerinden
make check       # tüm kalite kontrolleri
make test        # Rust + frontend testleri
make lint        # ESLint + Prettier
make build       # CLI + GUI derleme
make clean       # build temizliği
make release     # cross-platform imzalı paket
```

Bu komutlar; shell scriptlerini (syntax + shellcheck), core ve GUI Rust kodunu (fmt, test, clippy) ve frontend'i (tsc + vite build + vitest + eslint + prettier) denetler.

## Yol haritası

- [x] Private repo ve ilk Rust CLI iskeleti
- [x] Güvenli/idempotent Ubuntu sunucu bootstrap
- [x] Oracle Cloud Always Free sunucu kurulumu (`158.180.50.114`, Ubuntu 24.04 x86_64)
- [x] Peer ekleme ve iptal etme
- [x] Rust CLI güvenlik sertleştirmesi (stdin okuma, private key gizleme, path traversal koruması, libc FFI)
- [x] Ayrıcalıklı helper protokolü (Unix socket + systemd servisi)
- [x] Tauri 2 + React GUI (tam fonksiyonel — 16 Tauri komutu, 5 sekme, dark tema)
- [x] Kill-switch scriptleri (Linux nftables + IPv6, macOS ApplicationFirewall, Windows WFP)
- [x] Paket imzalama ve release workflow (scripts/sign-package.sh, .github/workflows/release.yml)
- [x] CI kalite kapısı (fmt, test, clippy, shellcheck, frontend build)
- [x] Dependabot (cargo/npm/GitHub-actions)
- [x] Unit testler (Rust: 15 test, Frontend: 20 test)
- [x] Frontend linting (ESLint + Prettier)
- [x] Makefile (build, test, lint, check, clean, release)
- [ ] Gerçek cihazla WireGuard handshake ve IPv4/DNS egress testi (scripts/test-connection.sh hazır)
- [ ] System tray entegrasyonu
- [ ] Klavye kısayolları

## Lisans

MIT
