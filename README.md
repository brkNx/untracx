# untracx

Untracx, kişisel kullanım için güvenli, doğrulanabilir ve sürdürülebilir bir WireGuard VPN çözümüdür. Öncelikli odak; hatasız sunucu kurulumu, güvenli anahtar ve profil provizyonu ve resmi WireGuard istemcilerine sorunsuz profil aktarımıdır.

---

## 1. Desteklenen Platform Matrisi (v1)

| Katman | Platform / Ortam | Destek Durumu | Notlar |
|---|---|---|---|
| **Sunucu** | Ubuntu 22.04 / 24.04 LTS (x86_64 & arm64) | **Destekleniyor (Stable)** | Otomatik bootstrap (`setup.sh`), Unbound DNS, UFW, fail2ban, atomik peer yönetimi. |
| **İstemci Provizyonu** | Resmi WireGuard İstemcileri (macOS, Windows, Linux, iOS, Android) | **Destekleniyor (Stable)** | Standart `.conf` profil üretimi, QR kod aktarımı, Zero-Trust anahtar desteği. |
| **Masaüstü GUI** | macOS / Windows / Linux (Tauri 2 + React) | **Beta / Profil Yöneticisi** | Anahtar üretimi, Zero-Trust konfigürasyon oluşturma, profil kaydetme (0600) ve ayarlar. |
| **Yerel Kill-Switch** | Linux (nftables) | **Beta** | `inet` fail-closed output filtresi (`policy drop`), DHCP/tünel istisnaları. |
| **Yerel Kill-Switch** | macOS (`pf`) / Windows (WFP) | **Deneysel (Experimental)** | Resmi WireGuard uygulamasının yerel `AllowedIPs = 0.0.0.0/0, ::/0` sızıntı engellemesi önerilir. |

---

## 2. Masaüstü GUI ve Arayüz Görünümü

Untracx, **Tauri 2 + React 18 + TypeScript** altyapısıyla geliştirilmiş yerel masaüstü arayüzüne sahiptir. Özel anahtarlarınızı güvenle üretmenizi, istemci konfigürasyonlarını atomik olarak (`0600` dosya izinleriyle) kaydetmenizi ve tünel durumunu izlemenizi sağlar.

<p align="center">
  <img src="docs/gui-screenshot.png" alt="Untracx GUI Overview" width="850">
</p>

### 📸 Modül Ekran Görüntüleri

| Modül | Ekran Görüntüsü | Açıklama |
|---|---|---|
| **1. Durum (Status)** | <img src="docs/screenshots/01_status_panel.png" width="380" alt="WireGuard Durumu"> | Aktif arayüz, handshake süresi, transfer edilen veri ve canlı bağlantı durumu. |
| **2. Bağlantı (Connection)** | <img src="docs/screenshots/02_connection_panel.png" width="380" alt="VPN Bağlantısı"> | Konfigürasyon dosyasından tek tıkla bağlantı başlatma ve bağlantıyı kesme. |
| **3. Yönetim (Peer Management)** | <img src="docs/screenshots/03_peer_management.png" width="380" alt="Peer Yönetimi"> | Kayıtlı cihaz genel anahtarları, cihaz ekleme ve iptal komutları. |
| **4. Anahtar Yönetimi (Keys)** | <img src="docs/screenshots/04_key_management.png" width="380" alt="Anahtar Yönetimi"> | X25519 Curve25519 anahtar çifti üretimi, genel anahtar türetme ve doğrulama. |
| **5. Config Üretici (Generator)** | <img src="docs/screenshots/05_config_generator.png" width="380" alt="Config Üretici"> | İstemci parametreleriyle standart WireGuard `.conf` üretimi ve atomik kaydetme. |
| **6. Ayarlar (Settings)** | <img src="docs/screenshots/06_settings_panel.png" width="380" alt="Ayarlar Paneli"> | Varsayılan profil yolları, arayüz adı ve sunucu endpoint yapılandırması. |

---

## 3. Güvenlik ve Gizlilik Prensipleri (Ne Sağlar, Ne Sağlamaz?)

### Sağlanan Güvenlik
- **Güçlü Şifreleme**: WireGuard (Noise Protocol Framework, Curve25519, ChaCha20-Poly1305, BLAKE2s) ile uçtan uca şifreleme.
- **Kuantum Sonrası Güvenlik (PSK)**: Tüm peer'lar için opsiyonel ve sunucu tarafında zorunlu 256-bit Pre-shared Key (PSK) koruması.
- **Özel DNS Resolver**: Sunucu içinde Unbound recursive DNS resolver (`10.66.66.1:53`). Yalnızca WireGuard tüneli içinden erişilebilir, dış internete kapalıdır.
- **Güvenli Dosya İşlemleri**: Özel anahtarlar bellekten anında silinir (`Zeroize`), konfigürasyon dosyaları diskte `0600` izinleri, `O_NOFOLLOW` ve atomik temp+rename ile yazılır.
- **Zero-Trust Anahtar Üretimi**: İstemci özel anahtarı istemci cihazında üretilir; sunucu istemcinin özel anahtarını bilmez ve depolamaz.

### Sınırlar ve Bilinen Kısıtlar
- **Anonimlik Sağlamaz**: VPN servis sağlayıcısı (örn. Oracle Cloud) veya hedef internet servisleri çıkış IP'nizi ve bağlantı zaman damgalarını görebilir.
- **Coğrafi Konum**: Çıkış IP'si sunucunun barındığı veri merkezine aittir (Türkiye/Azerbaycan çıkışı için o ülkelerde sunucu gerekir).
- **Yerel Sızıntılar**: İşletim sistemi düzeyinde kill-switch aktif edilmeden veya resmi istemci kullanılmadan tünel çökmesi durumunda yerel trafik sızabilir.

---

## 4. Sunucu Kurulumu (Ubuntu 22.04 / 24.04)

### 4.1 Ön Gereksinimler ve OCI Güvenlik Listesi
Kurulum yapılacak sunucuda aşağıdaki portların açık olması gerekir:
- **SSH (TCP 22)**: Mümkünse yalnızca yönetim yapacağınız statik IP'ye açık olmalıdır.
- **WireGuard (UDP 51820)**: İstemcilerin bağlanabilmesi için genel erişime açık olmalıdır.
- **DNS (TCP/UDP 53)**: Dış internete **kesinlikle açılmamalıdır** (setup script'i tünel içinden otomatik izin verir).

### 4.2 Kurulum Adımları
Sunucu dosyalarını sunucuya aktarın:
```bash
scp -r server ubuntu@<SUNUCU_IP>:/tmp/untracx-server
ssh ubuntu@<SUNUCU_IP>
```

Sunucu üzerinde bootstrap scriptini çalıştırın:
```bash
cd /tmp/untracx-server
sudo PUBLIC_ENDPOINT=<SUNUCU_IP> bash setup.sh
```

---

## 5. Peer Yönetimi (Cihaz Ekleme & Silme)

### 5.1 Standart Profil Oluşturma (Sunucu Taraflı)
```bash
sudo untracx-add-peer macbook
```
Oluşturulan `~/untracx-macbook.conf` dosyasını bilgisayarınıza indirin ve resmi WireGuard uygulamasına aktarın:
```bash
scp ubuntu@<SUNUCU_IP>:~/untracx-macbook.conf .
ssh ubuntu@<SUNUCU_IP> 'rm -f ~/untracx-macbook.conf'
```

### 5.2 Zero-Trust Profil Ekleme (İstemci Anahtarlı)
İstemcide üretilen genel anahtar ile sunucuda peer kaydı açma:
```bash
sudo untracx-add-peer telefon <CLIENT_PUBLIC_KEY> [PRESHARED_KEY]
```
Bu modda sunucuda hiçbir zaman istemci özel anahtarı bulunmaz.

### 5.3 Cihaz İptal Etme (Revocation)
```bash
sudo untracx-remove-peer macbook
```
Sunucu konfigürasyonu atomik olarak güncellenir, hedef peer anında tünelden düşürülür ve manuel peer kayıtları korunur.

---

## 6. Doğrulama ve Test Suite'i

### 6.1 Yerel Kalite ve Güvenlik Testleri
```bash
# Tüm kontrolleri çalıştır (Rust, Shell, Frontend, Fixture Testleri)
bash scripts/check.sh
```

### 6.2 Gerçek Cihaz Bağlantı Testi
```bash
export UNTRACX_SERVER=<SUNUCU_IP>
bash scripts/test-connection.sh testclient
```
Bu test:
1. Sunucuda güvenli geçici test peer'ı oluşturur.
2. Tüneli ayağa kaldırır.
3. IPv4 çıkış IP'sini, Unbound DNS çözümlemesini ve sayısal handshake zaman damgasını doğrular.
4. Test bitiminde istemci ve sunucudaki tüm geçici kayıtları temizler.

---

## 7. Geliştirici & Lisans

- **Lisans**: MIT
- **Teknoloji**: Rust 2021, Tauri 2, React 18, TypeScript, Vite, WireGuard.
