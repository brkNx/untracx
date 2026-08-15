# Mimari ve Tasarım İlkeleri

Untracx, kişisel kullanım için yüksek güvenlikli, doğrulanabilir ve sürdürülebilir bir WireGuard VPN ürünüdür.

---

## 1. Ağ ve Sunucu Mimarisi (Server Core)

```text
┌────────────────────────────────────────────────────────┐
│                   İstemci Cihazı                      │
│ (Resmi WireGuard İstemcisi / iOS / Android / Desktop) │
└──────────────────────────┬─────────────────────────────┘
                           │ WireGuard (UDP 51820)
                           ▼
┌────────────────────────────────────────────────────────┐
│          Ubuntu 22.04 / 24.04 Sunucu (OCI / VPS)       │
│                                                        │
│  Kernel WireGuard (wg0: 10.66.66.1/24)                │
│  ├── UFW Firewall (Fail-Closed Default Deny)          │
│  │   ├── Ingress: UDP 51820 (Tüm IP'ler)              │
│  │   ├── Ingress: TCP 22 (Yönetim IP /32)             │
│  │   └── In-Tunnel: TCP/UDP 53 (Yalnızca wg0 -> IP)   │
│  ├── Unbound DNS Resolver (10.66.66.1:53)              │
│  │   └── QNAME Minimisation + DNSSEC Validating       │
│  └── Egress: iptables NAT Masquerade -> Internet       │
└────────────────────────────────────────────────────────┘
```

- **Ağ İzolasyonu**: Sunucu DNS resolver'ı genel internete kapalıdır (`0.0.0.0/0 refuse`), yalnızca `10.66.66.0/24` WireGuard arayüzünden gelen sorguları kabul eder.
- **Dinamik Ağ Tespiti**: Kurulum scripti (`setup.sh`) varsayılan rotadaki çıkış arayüzünü (`ip route show default`) otomatik tespit eder (`eth0` varsayımı yapmaz).
- **Yeniden Üretilebilirlik**: Kurulum idempotendir; tekrar çalıştırıldığında mevcut sunucu özel anahtarını ve kayıtlı peer'ları ezmez.

---

## 2. Peer ve Provizyon Modeli (Zero-Trust)

Untracx iki ayrı provizyon akışını destekler:

1. **Zero-Trust İstemci Provizyonu (Önerilen)**:
   - İstemci özel anahtarı (`PrivateKey`) yalnızca istemcinin yerel cihazında üretilir.
   - Sunucuya yalnızca istemci genel anahtarı (`PublicKey`) ve ortak `PresharedKey` iletilir:
     `sudo untracx-add-peer <cihaz> <client-public-key> [preshared-key]`
   - Sunucuda hiçbir zaman istemci özel anahtarı barındırılmaz.
2. **Sunucu Taraflı Provizyon (Hızlı Başlangıç)**:
   - Sunucu istemci anahtarını ve konfigürasyonunu `~/untracx-<cihaz>.conf` olarak `0600` izinleriyle oluşturur.
   - İstemci dosyayı çektikten sonra sunucu kopyasını siler.

---

## 3. Veri ve Dosya Bütünlüğü (Atomik Transactions)

- **Atomik Peer Silme**: `server/remove-peer.sh`, `[Peer]` sınırlarını ve hedef genel anahtarı eşleyen deterministik ayrıştırıcı kullanır. Araya eklenmiş manuel peer'ları veya diğer istemcileri kesinlikle silmez.
- **Atomik Peer Ekleme**: `server/add-peer.sh`, sunucu konfigürasyonu, metadata ve canlı `wg syncconf` adımlarını tek bir transaction olarak yürütür. Herhangi bir aşamada kesinti veya sinyal gelirse geri alma (rollback) tetiklenir.
- **Güvenli Dosya Yazımı**: Core ve GUI katmanlarında özel anahtar içeren dosyalar `fs_util::write_secret_file_atomic` ile `0600`, `O_NOFOLLOW`, `create_new`, `fsync` ve atomik rename ile yazılır.

---

## 4. Masaüstü ve İstemci Mimarisi (v1 GUI)

- **Tauri 2 + React**: Masaüstü arayüzü normal kullanıcı yetkisinde çalışır.
- **Bellek Temizliği**: Özel anahtar ve PSK verileri `Zeroize` trait'i ile bellekten anında silinir.
- **Resmi İstemci Entegrasyonu**: v1'de güvensiz sahte wrapper veya root IPC helper'ları yerine, standart `.conf` ve QR kod ile resmi WireGuard istemcilerine güvenli aktarım esastır.

---

## 5. Değiştirilmeyecek Güvenlik Prensipleri

1. Özel anahtar ve PSK hiçbir zaman stdout'a, loglara veya terminal çıktılarına yazılmaz.
2. GUI asla root/Admin yetkisiyle başlatılmaz.
3. Kanıtlanmamış veya sahte güvenlik özellikleri arayüzde varmış gibi gösterilmez.
4. Kayıp bir cihaz için tüm sunucu yeniden kurulmaz; yalnızca ilgili peer iptal edilir.
