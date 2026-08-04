# Mimari

```
┌─────────────────────────────────────────────┐
│ React GUI (Tauri webview)                   │
├─────────────────────────────────────────────┤
│ Tauri Rust backend                          │
├─────────────────────────────────────────────┤
│ core CLI (bu repo)                          │
│  keys / config / connect / status / down    │
├─────────────────────────────────────────────┤
│ Yükseltilmiş helper (root/admin)            │
│  wg-quick  VEYA  wireguard-go               │
├─────────────────────────────────────────────┤
│ TUN arayüzü + sistem rotaları               │
└─────────────────────────────────────────────┘
```

## Kararlar

| Karar | Seçim | Neden |
|---|---|---|
| Protokol | WireGuard | En hızlı, modern, ~4k satır, her platformda |
| Çekirdek | Rust | Güvenli, tek kod tabanı, Tauri ile aynı dil |
| Sunucu | Oracle Always Free ARM | Ömür boyu ücretsiz, 10 TB/ay trafik |
| Bölge | Frankfurt | TR ~35ms, AZ ~55ms dengeli gecikme |
| GUI | Tauri 2 + React | Hafif, sistem tepsis, üç platforma tek paket |
| Ayrıcalık | Ayrı helper process | GUI root'ta çalışmaz; yalnız küçük helper yükselir |

## Platform yükseltme matrisi

| Platform | Yöntem | Paket |
|---|---|---|
| Windows | Admin token + service / named pipe | MSI |
| macOS | launchd root helper (AuthorizationServices) | DMG |
| Linux | pkexec/polkit + systemd | .deb/.rpm/AppImage |

## Anahtar hijyeni

- Sunucu PrivateKey: yalnızca `/etc/wireguard/wg0.private.key` (chmod 600)
- İstemci anahtarları: `*.conf` ve `*.key` gitignore'da — repo'ya asla girmez
- `genconfig` çıktıyı 0600 izniyle yazar
- add-peer çıktısını cihaza kopyaladıktan sonra sunucudan silin

## Ağ detayları

- Alt ağ: `10.66.66.0/24`, sunucu `.1`, istemciler `.2`'den itibaren otomatik
- DNS: tünel içi 10.66.66.1 (sızıntı koruması)
- MTU: 1420 (Orta Doğu/AVR ağları için güvenli)
- PersistentKeepalive: 25s (NAT arkası cihazlar için zorunlu)
