# İstemci kurulumu (cihaz başına)

Sunucuda `sudo untracx-add-peer <cihaz-adi>` çalıştırıldıktan sonra config dosyası
`~/untracx-<cihaz-adi>.conf` olarak (0600 izinle) oluşturulur. Bu dosyayı cihaza
güvenli bir kanaldan (scp, AirDrop, USB) aktarın ve **sunucudaki kopyayı silin**:

```bash
ssh ubuntu@<sunucu-ip> 'rm -f ~/untracx-<cihaz-adi>.conf'
```

Config dosyası özel anahtar içerir; e-posta/chat ile göndermeyin.

## QR kod (iOS / Android)

Resmi WireGuard uygulamaları config'i QR ile alabilir. Sunucuda veya yerelde:

```bash
qrencode -t ansiutf8 < ~/untracx-macbook.conf   # terminalde QR yazdırır
# veya görsel dosya olarak:
qrencode -o untracx-qr.png < ~/untracx-macbook.conf
```

`qrencode` yoksa: `sudo apt-get install -y qrencode` (Debian/Ubuntu)
veya `brew install qrencode` (macOS).

## macOS

1. App Store'dan veya <https://www.wireguard.com/install/> adresinden **WireGuard** uygulamasını kurun.
2. Uygulamayı açın → **Import tunnel(s) from file** → `untracx-<cihaz-adi>.conf`.
3. Tüneli açın; ilk istekte **VPN ayarlarına izin** istemi gelir, onaylayın.
4. İzleme: menü çubuğundaki simgeden aktif tüneli görün.

Komut satırı (wireguard-tools, Homebrew ile):

```bash
brew install wireguard-tools
sudo wg-quick up ~/untracx-macbook.conf
sudo wg-quick down untracx-macbook
```

Not: `System Settings → VPN` yerine WireGuard uygulamasının kendi arayüzünü kullanın.

## Windows

1. <https://www.wireguard.com/install/> adresinden **WireGuard** kurun.
2. **Import tunnel(s) from file** → config dosyası.
3. Tüneli **Activate** edin. Sürücü kurulum izni geldiyse onaylayın (ilk kurulum).

Sürücü sorunlarında: resmi kurulum sayfasındaki talimatların güncel sürümüyle uyumlu
WireGuard sürücüsünün yüklü olduğundan emin olun.

## Linux (wg-quick)

```bash
sudo apt-get install -y wireguard wireguard-tools   # veya dağıtıma uygun paket
sudo install -m 600 ~/untracx-macbook.conf /etc/wireguard/untracx-macbook.conf
sudo systemctl start wg-quick@untracx-macbook
sudo systemctl enable wg-quick@untracx-macbook      # açılışta bağlan (opsiyonel)
```

Bağlantı durumu: `sudo wg show` · Kapat: `sudo systemctl stop wg-quick@untracx-macbook`

Kill-switch isterseniz (önerilir): `sudo bash scripts/killswitch-linux.sh ac`

## Doğrulama (her platform)

Tünel açıkken dış IP sunucu endpoint'i olmalı ve DNS tünel içinden çözülmeli:

```bash
curl -4 https://api.ipify.org          # sunucu public IP'si dönmeli
dig +short @10.66.66.1 google.com      # VPN içi DNS cevap vermeli
```

DNS sorgularının ISP'ye sızıp sızmadığını kontrol etmek için
`docs/../scripts/test-connection.sh` scripti veya SECURITY.md'deki kill-switch notları kullanılabilir.

## Cihaz iptali

Cihaz kaybolduysa veya artık kullanılmayacaksa sunucuda:

```bash
sudo untracx-remove-peer <cihaz-adi>
```

İptal edilen cihazın eski config dosyası artık bağlanamaz; yeni config için
peer'i yeniden ekleyin.
