# untracx

Kişisel kullanım için WireGuard tabanlı VPN projesi. Hedef; önce güvenli ve tekrar üretilebilir bir sunucu kurulumu, ardından Rust/Tauri tabanlı masaüstü istemcisidir.

> Durum: Aşama 1 tamamlandı. Sunucu Oracle Cloud Always Free (Ubuntu 24.04 x86_64) üzerinde kurulu ve çalışıyor; peer yönetimi, Rust CLI güvenlik sertleştirmesi, ayrıcalıklı helper protokolü, Tauri 2 + React GUI ve platforma özel kill-switch scriptleri hazır. Sıradaki adım gerçek cihazla handshake/egress testi ve GUI geliştirmesinin tamamlanması.

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

`gui/` dizinde Tauri 2 + React scaffold hazır.

### Kurulum

```bash
cd gui/frontend
npm install
npm run dev   # geliştirme sunucusu (http://localhost:5173)
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

### Yapılandırma

`gui/tauri.conf.json` ürün adını, versiyonunu ve pencere boyutlarını içerir. `gui/frontend/src/lib/helper.ts` Tauri API çağrılarını wrapper'lar.

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

## Geliştirici kontrolleri

```bash
./scripts/check.sh
```

Bu komut; shell scriptlerini (syntax + shellcheck), core ve GUI Rust kodunu (fmt, test, clippy) ve frontend'i (tsc + vite build) denetler.

## Yol haritası

- [x] Private repo ve ilk Rust CLI iskeleti
- [x] Güvenli/idempotent Ubuntu sunucu bootstrap
- [x] Oracle Cloud Always Free sunucu kurulumu (`158.180.50.114`, Ubuntu 24.04 x86_64)
- [x] Peer ekleme ve iptal etme
- [x] Rust CLI güvenlik sertleştirmesi (stdin okuma, private key gizleme, path traversal koruması, libc FFI)
- [x] Ayrıcalıklı helper protokolü (Unix socket + systemd servisi)
- [x] Tauri 2 + React GUI scaffold (gui/)
- [x] Kill-switch scriptleri (Linux nftables, macOS ApplicationFirewall, Windows WFP)
- [x] Paket imzalama ve release workflow (scripts/sign-package.sh, .github/workflows/release.yml)
- [ ] Gerçek cihazla WireGuard handshake ve IPv4/DNS egress testi (scripts/test-connection.sh hazır)
- [ ] GUI geliştirmesinin tamamlanması (bağlantı paneli, durum gösterimi, peer yönetimi)

## Lisans

MIT
