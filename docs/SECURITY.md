# Güvenlik ve Tehdit Modeli (v1.2)

---

## 1. Güvenlik Tasarımı ve Kapsam

Untracx, kişisel VPN trafiğini korumak amacıyla aşağıdaki güvenlik garantilerini sunar:

### 1.1 Kriptografik İlkeler
- **Protokol**: WireGuard (Noise IKpsk2 protokolü).
- **Simetrik Şifreleme**: ChaCha20-Poly1305 AEAD.
- **Anahtar Değişimi**: Curve25519 (X25519 ECDH).
- **Hash Fonksiyonu**: BLAKE2s.
- **Kuantum Sonrası Koruma**: 256-bit Pre-shared Key (PSK) ile peer izolasyonu ve ileriye dönük gizlilik (Forward Secrecy).

### 1.2 Bellek ve Dosya Güvenliği
- **Zeroize Temizliği**: Özel anahtarlar, PSK değerleri ve hassas konfigürasyon metinleri kullanım sonrasında `Zeroize` ile bellekten silinir.
- **Atomik ve Güvenli Dosya Yazımı**: Dosyalar `fs_util::write_secret_file_atomic` aracılığıyla `create_new(true)`, `0600` izinleri, `O_NOFOLLOW` bayrağı ve `fsync` ile aynı dosya sisteminde geçici dosya açılarak atomik yeniden adlandırmayla yazılır.
- **Symlink ve TOCTOU Koruması**: Symlink saldırılarına karşı `O_NOFOLLOW` ve üst dizin izin denetimleri zorunlu tutulur.

---

## 2. Tehdit Modeli

### Korunan Tehditler (In-Scope)
- **Yerel Ağ Dinleme**: Ortak Wi-Fi, otel veya havalimanı ağlarında pasif paket koklama ve ARP zehirlenmesi.
- **ISP Trafik İzleme**: İnternet servis sağlayıcısının kullanıcı trafiğinin içeriğini ve ziyaret edilen IP'leri görmesi.
- **DNS Manipülasyonu**: ISP veya yerel ağın DNS sorgularını sansürlemesi/yönlendirmesi (Unbound DNSSEC ve QNAME minimisation ile korunur).
- **Cihaz Ayrımı**: Her peer için ayrı anahtar çifti ve PSK kullanıldığından bir cihazın kaybı diğer cihazları tehlikeye atmaz.

### Kapsam Dışı Tehditler (Out-of-Scope)
- **VPS Sağlayıcısı Güvenliği**: OCI hesabının veya sunucu root erişiminin ele geçirilmesi.
- **İstemci Cihaz Güvenliği**: İstemci cihazdaki malware, keylogger veya işletim sistemi düzeyindeki casus yazılımlar.
- **Gelişmiş Trafik Korelasyonu**: Global ağ düzeyinde paket boyut ve zaman korelasyonu yapan devlet düzeyindeki aktörler.
- **Webview / Tarayıcı Takibi**: Çerezler, tarayıcı fingerprinting veya oturum açılmış kullanıcı hesapları.

---

## 3. Kill-Switch ve Sızıntı Sınırları

- `AllowedIPs = 0.0.0.0/0, ::/0` rotalaması normal çalışmada tüm trafiği tünele gönderir.
- Tünelin beklenmedik şekilde çökmesi durumunda fiziksel arayüz sızıntısını engellemek için:
  - **Linux**: `scripts/killswitch-linux.sh` (nftables `inet` tablosunda `policy drop`).
  - **macOS / Windows**: Resmi WireGuard uygulamasının On-Demand ve entegre tünel rotalama mekanizması kullanılmalıdır.
- Sızıntı testleri `scripts/test-connection.sh` ile doğrulanmalıdır.
