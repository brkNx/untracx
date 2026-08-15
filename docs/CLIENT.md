# İstemci Kurulum ve Bağlantı Kılavuzu

Untracx profilleri standart WireGuard formatındadır ve resmi WireGuard istemcileriyle %100 uyumludur.

---

## 1. Profil Edinme

### Yöntem A: Zero-Trust Provizyon (Önerilen)
1. Kendi bilgisayarınızda bir anahtar çifti ve PSK üretin:
   ```bash
   untracx keygen
   untracx genpsk
   ```
2. Genel anahtarınızı (`PublicKey`) ve PSK'yı sunucu yöneticisine iletin:
   ```bash
   # Sunucuda:
   sudo untracx-add-peer macbook <CLIENT_PUBLIC_KEY> <PRESHARED_KEY>
   ```
3. Kendi cihazınızda istemci konfigürasyonunu oluşturun:
   ```bash
   untracx genconfig \
     --server-public "<SERVER_PUBLIC_KEY>" \
     --server-ip "<SERVER_PUBLIC_IP>" \
     --client-ip "10.66.66.X/32" \
     --preshared-key "<PRESHARED_KEY>" \
     --output macbook.conf
   ```

### Yöntem B: Sunucu Taraflı Hızlı Provizyon
1. Sunucuda cihaz kaydı oluşturun:
   ```bash
   sudo untracx-add-peer macbook
   ```
2. Konfigürasyonu bilgisayarınıza çekin ve sunucudaki geçici kopyayı silin:
   ```bash
   scp ubuntu@<SUNUCU_IP>:~/untracx-macbook.conf .
   ssh ubuntu@<SUNUCU_IP> 'rm -f ~/untracx-macbook.conf'
   ```

---

## 2. Platformlara Göre İstemci Kurulumu

### 2.1 macOS
1. Mac App Store'dan veya [wireguard.com/install](https://www.wireguard.com/install/) adresinden **WireGuard** uygulamasını kurun.
2. Uygulamayı açın → **Import tunnel(s) from file** → `untracx-macbook.conf` dosyasını seçin.
3. İlk bağlantıda macOS VPN izin istemini onaylayın ve tüneli aktifleştirin.
4. **On-Demand**: İsteğe bağlı olarak "On-Demand" seçeneğini işaretleyerek Wi-Fi bağlantılarında otomatik açılmasını sağlayabilirsiniz.

### 2.2 Windows
1. [wireguard.com/install](https://www.wireguard.com/install/) adresinden resmi WireGuard MSI yükleyicisini kurun.
2. **Add Tunnel** → `untracx-windows.conf` dosyasını içe aktarın.
3. **Activate** butonuna tıklayarak bağlantıyı başlatın.

### 2.3 iOS / Android (Mobil QR Kod)
1. App Store veya Google Play Store'dan resmi **WireGuard** uygulamasını indirin.
2. Sunucuda veya yerel terminalinizde QR kod oluşturun:
   ```bash
   qrencode -t ansiutf8 < untracx-telefon.conf
   ```
3. WireGuard uygulamasında **+** → **Scan from QR code** ile kamerayı yöneltin ve tüneli kaydedin.

### 2.4 Linux (CLI)
```bash
sudo apt-get install -y wireguard wireguard-tools
sudo install -o root -g root -m 0600 untracx-linux.conf /etc/wireguard/wg0.conf
sudo systemctl start wg-quick@wg0
sudo systemctl enable wg-quick@wg0   # Açılışta otomatik başlat (opsiyonel)
```

---

## 3. Bağlantı ve Sızıntı Doğrulaması

Bağlantı kurulduktan sonra aşağıdaki kontrolleri gerçekleştirin:

1. **IPv4 Çıkış IP'si**:
   ```bash
   curl -4 https://api.ipify.org
   ```
   *Çıktı VPN sunucunuzun public IP'si olmalıdır.*

2. **In-Tunnel DNS Çözümlemesi**:
   ```bash
   dig +short @10.66.66.1 google.com
   ```
   *VPN içindeki Unbound resolver başarıyla cevap dönmelidir.*

3. **Otomatik Bağlantı Testi**:
   ```bash
   export UNTRACX_SERVER="<SUNUCU_IP>"
   bash scripts/test-connection.sh macbook
   ```

---

## 4. Cihaz İptali (Revocation)

Cihaz kaybolduğunda veya tünel erişimi sonlandırılmak istendiğinde sunucuda:
```bash
sudo untracx-remove-peer macbook
```
İptal edilen cihazın anahtarları canlı arayüzden anında düşürülür ve konfigürasyon dosyası geçersiz kılınır.
