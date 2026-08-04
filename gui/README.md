# untracx GUI

Tauri 2 + React TypeScript frontend for the untracx VPN.

## Kurulum

```bash
cd gui/frontend
npm install
npm run dev    # http://localhost:5173
npm run build  # prod build → dist/
```

## Tauri Build

```bash
# macOS
npm run tauri build

# Linux
npm run tauri build -- --target x86_64-unknown-linux-gnu

# Windows
npm run tauri build -- --target x86_64-pc-windows-msvc
```

## Tauri Komutları

| Komut | Parametre | Açıklama |
|---|---|---|
| `helper_start` | — | systemd user service olarak helper'ı başlat |
| `helper_stop` | — | helper servisini durdur |
| `helper_status` | — | helper durumu + socket bilgisi |
| `vpn_connect` | `configPath` | Config dosyasıyla VPN bağlantısı |
| `vpn_down` | `iface` | Arayüz adıyla VPN bağlantısını kes |
| `vpn_status` | — | WireGuard durumunu sorgula |

## Güvenlik

- GUI root/Admin olarak çalıştırılmaz
- Helper yalnız önceden tanımlı profil ve ağ işlemlerini kabul eder
- Serbest komut veya serbest dosya yolu çalıştırılmaz
- Config dosyaları `~/.config/untracx/` veya `/etc/wireguard/` içinden olmalıdır
