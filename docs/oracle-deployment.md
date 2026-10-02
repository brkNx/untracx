# Oracle Cloud Infrastructure (OCI) Deployment Guide

Bu rehber, **untracx** WireGuard VPN sunucusunu Oracle Cloud (Always Free veya standart) Ubuntu Compute Instance üzerinde kurmak, yapılandırmak ve yönetmek için hazırlanmıştır.

---

## 1. OCI Ağ ve Güvenlik Listesi Ayarı (Ingress Rule)

Oracle Cloud Sanal Bulut Ağları (VCN) varsayılan olarak yalnızca `TCP 22` portuna izin verir. WireGuard tünelinin çalışabilmesi için `UDP 51820` portuna izin verilmelidir.

1. **OCI Console** -> **Networking** -> **Virtual Cloud Networks (VCN)** bölümüne gidin.
2. Sunucunuzun bağlı olduğu alt ağın (Subnet) **Default Security List** ayarlarına tıklayın.
3. **Add Ingress Rules** butonuna tıklayın:
   - **Source CIDR:** `0.0.0.0/0`
   - **IP Protocol:** `UDP`
   - **Destination Port Range:** `51820`
   - **Description:** `untracx WireGuard UDP port`
4. Değişikliği kaydedin.

---

## 2. SSH Bağlantı Yapılandırması

Yerel makinenizde `~/.ssh/config` dosyanıza Oracle sunucu bilginizi ekleyin:

```sshconfig
Host oracle
    HostName <ORACLE_PUBLIC_IP>
    User ubuntu
    IdentityFile ~/.ssh/id_rsa_oracle
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

Bağlantıyı test edin:
```bash
ssh oracle "uname -a"
```

---

## 3. Otomatik Kurulum (Tek Komutla Dağıtım)

Projeyi yerel bilgisayarınızdan Oracle sunucunuza tek komutla kurabilirsiniz:

### Linux / macOS:
```bash
# Sadece sunucu kurulumu:
bash scripts/deploy-oracle.sh oracle

# Sunucu kurulumu + ilk cihaz profilini otomatik üretip indirme:
bash scripts/deploy-oracle.sh oracle pc-brk
```

### Windows (PowerShell):
```powershell
# Sadece sunucu kurulumu:
.\scripts\deploy-oracle.ps1 -Target oracle

# Sunucu kurulumu + ilk cihaz profilini otomatik üretip indirme:
.\scripts\deploy-oracle.ps1 -Target oracle -Peer pc-brk
```

---

## 4. Cihaz Yönetimi (Peer Management)

Kurulum tamamlandıktan sonra istediğiniz zaman yeni cihazlar ekleyebilir veya silebilirsiniz:

### Yeni Cihaz Profili Üretme:
```bash
ssh oracle "sudo untracx-add-peer telefon"
scp oracle:~/untracx-telefon.conf ./
ssh oracle "rm -f ~/untracx-telefon.conf"
```

### Cihazı İptal Etme (Revocation):
```bash
ssh oracle "sudo untracx-remove-peer telefon"
```

### Sunucu Durumunu İzleme:
```bash
ssh oracle "sudo wg show wg0"
```

---

## 5. İstemcide Kullanım

Üretilen `.conf` dosyasını:
- **Resmi WireGuard İstemcisi:** "Add Tunnel" -> `untracx-xxx.conf` seçerek doğrudan bağlanın.
- **Untracx Desktop GUI:** Tauri arayüzü üzerinden "Import Profile" seçeneğiyle yükleyip tüneli başlatın.
