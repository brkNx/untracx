# untracx

Kişisel kullanım için WireGuard tabanlı VPN projesi. Hedef; önce güvenli ve tekrar üretilebilir bir sunucu kurulumu, ardından Rust/Tauri tabanlı masaüstü istemcisidir.

> Durum: Aşama 1 sürüyor. Sunucu bootstrap ve peer yönetimi hazır; platformlara özel gerçek kill-switch ve GUI henüz tamamlanmadı.

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

## Geliştirici kontrolleri

```bash
./scripts/check.sh
```

## Yol haritası

- [x] Private repo ve ilk Rust CLI iskeleti
- [x] Güvenli/idempotent Ubuntu sunucu bootstrap
- [x] Peer ekleme ve iptal etme
- [x] Rust CLI güvenlik sertleştirmesi (stdin private key, path traversal, libc FFI, secret zeroing)
- [x] Ayrıcalıklı helper protokolü (Unix socket + systemd service)
- [ ] Gerçek cihazla WireGuard handshake ve IPv4/DNS egress testi
- [ ] Linux/macOS/Windows için ayrı ayrı kill-switch ve DNS leak testleri
- [ ] Tauri 2 + React GUI
- [ ] İmzasız kişisel paketler; dağıtım yapılırsa kod imzalama

## Lisans

MIT
