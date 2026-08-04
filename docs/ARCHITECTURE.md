# Mimari

## Aşama 1: çalışan MVP

```text
WireGuard istemcisi
  -> UDP 51820
Ubuntu 24.04 VM
  -> kernel WireGuard (wg0: 10.66.66.1/24)
  -> UFW + dar kapsamlı forwarding/NAT
  -> OCI public network interface
  -> Internet

VPN istemcisi -> 10.66.66.1:53 -> Unbound recursive DNS
```

Sunucu x86_64 ve arm64 üzerinde aynı Ubuntu paketlerini kullanır. Dış ağ arayüzü default route üzerinden bulunur; `eth0` sabitlenmez.

## Aşama 2+: masaüstü istemcisi

```text
React GUI (normal kullanıcı)
  -> Tauri/Rust uygulaması
  -> kimliği doğrulanmış yerel IPC
  -> küçük, ayrıcalıklı helper
  -> işletim sisteminin WireGuard backend'i
  -> platform firewall + DNS yönetimi
```

GUI hiçbir platformda root/Admin olarak çalıştırılmayacaktır. Helper yalnız önceden tanımlı profil ve ağ işlemlerini kabul edecek; serbest komut veya serbest dosya yolu çalıştırmayacaktır.

## Güven sınırları

| Sınır | Güven kararı |
|---|---|
| GUI -> helper | Karşı uç kimliği ve mesaj şeması doğrulanmalı |
| Client config | 0600/OS key store; loglarda secret yok |
| VPS | Sunucu private key yalnız `/etc/wireguard`, root 0600 |
| Peer yaşam döngüsü | Her cihaz ayrı key + PSK; kayıp cihaz tek başına iptal edilir |
| DNS | Yalnız `10.66.66.0/24` erişebilir; public 53 kapalıdır |
| Güncelleme | İmzalı uygulama güncellemesi olmadan otomatik update yok |

## Platform matrisi

| Platform | Tünel backend'i | Ayrıcalık modeli | Kill-switch hedefi |
|---|---|---|---|
| Windows | WireGuardNT / resmi WireGuard service | Windows service + named pipe ACL | Windows Filtering Platform |
| macOS | Network Extension veya resmi WireGuard entegrasyonu | imzalı helper/entitlement | Network Extension kuralları |
| Linux | kernel WireGuard + wg-quick | polkit + systemd helper | nftables/iptables policy |

Platform backend'i seçimi uygulama koduna başlanmadan küçük PoC'lerle doğrulanacaktır. `wireguard-go` tüm platformlarda aynı şekilde paketlenecek varsayımı yapılmamıştır.

## Ağ kararları

- İlk sürüm IPv4 internet çıkışı sağlar.
- İstemci profili `::/0` rotasını tünele yollar; sunucu IPv6 çıkışı sağlamadığı için aktif tünelde IPv6 interneti çalışmayabilir.
- Tünel düştüğünde leak engellemek yalnız rota ayarıyla garanti edilmez; platform firewall'ı gereklidir.
- Varsayılan MTU 1420'dir; mobil ağ testlerinde gerekirse düşürülecektir.
- `PersistentKeepalive = 25` yalnız istemci tarafında kullanılır.

## Değiştirilmeyecek güvenlik ilkeleri

- Private key veya PSK stdout/log/telemetry'ye yazılmaz.
- GUI root/Admin çalıştırılmaz.
- Sunucu bootstrap mevcut peer config'ini sessizce ezmez.
- Kayıp cihaz için tüm sunucuyu yeniden kurmak yerine tek peer iptal edilir.
- “Bağlandı” göstergesi yalnız process durumuna değil, güncel handshake ve egress testine dayanır.
