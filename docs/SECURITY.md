# Güvenlik ve mahremiyet modeli (v1.1, 2026-08-11)

## Korunan tehditler

- Ortak Wi-Fi üzerinde pasif dinleme ve yerel ağ gözlemi
- ISP'nin cihaz ile VPN sunucusu arasındaki uygulama trafiğini doğrudan görmesi
- Her cihaz için ayrı anahtar sayesinde tek cihaz kaybında sınırlı iptal
- Public DNS resolver'a doğrudan istemci sorgusu yerine tünel içi recursive DNS

## Korunmayan tehditler

- Oracle hesabının veya VM root hesabının ele geçirilmesi
- Kötü amaçlı ya da zaten ele geçirilmiş istemci cihaz
- Tarayıcı fingerprinting, çerezler ve oturum açılmış hesaplarla kimlik ilişkilendirme
- HTTPS uç noktalarının ve trafik zamanlamasının VPS sağlayıcısı tarafından gözlenmesi
- Uygulama katmanında takip, phishing veya malware
- Trafik korelasyonu yapan güçlü küresel gözlemci

Bu sistem bir anonimlik ağı değildir ve Tor'un yerini tutmaz.

## Kill-switch durumu

`AllowedIPs = 0.0.0.0/0, ::/0` tam tünel rotasıdır; tek başına kill-switch değildir. Arayüz kapanınca işletim sistemi normal default route'a dönebilir. Bu nedenle:

- Aşama 1 profilleri “bağlantı varken tam tünel” sağlar.
- Gerçek kill-switch ancak Linux nftables/iptables, Windows Filtering Platform ve macOS Network Extension/firewall davranışı ayrı ayrı test edildikten sonra tamamlanmış sayılır.
- Kill-switch testi; tünel process'ini zorla durdurma, ağ değiştirme, sleep/wake, Wi-Fi/Ethernet geçişi, DNS ve IPv6 senaryolarını kapsamalıdır.

Ubuntu `wg-quick` için resmi man page bir iptables kill-switch örneği verir, fakat bu kural Windows/macOS'a taşınamaz: <https://manpages.ubuntu.com/manpages/noble/man8/wg-quick.8.html>

## Anahtarlar

- Her cihazın ayrı WireGuard key pair ve preshared key'i vardır.
- Sunucu private key'i `/etc/wireguard` altında root 0600 kalır.
- İstemci config'i stdout'a yazılmaz; `sudo` çağrısını yapan kullanıcının home dizinine 0600 yazılır.
- İstemciye aktarıldıktan sonra sunucudaki export kopyası silinir.
- Kayıp cihaz `sudo untracx-remove-peer <ad>` ile iptal edilir.
- Repo `*.conf` ve `*.key` dosyalarını ignore eder; yine de commit öncesi secret taraması yapılmalıdır.

## Log politikası

Uygulama logları private key, preshared key, tam config veya ziyaret edilen domainleri içermeyecektir. Sunucuda ek trafik loglaması varsayılan olarak kapalıdır; sistem/journal ve Oracle altyapı loglarının ayrı saklama politikaları olabilir.

## Yayınlama öncesi kapılar

- Üç platformda kill-switch + DNS + IPv6 leak testi
- Helper IPC kimlik doğrulaması ve yetki sınırı incelemesi
- Bağımlılık ve supply-chain taraması
- İmzalı paket/güncelleme tasarımı
- Tehdit modeli ve mahremiyet beyanının güncellenmesi
