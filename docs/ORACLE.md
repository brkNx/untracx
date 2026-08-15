# Oracle Cloud (OCI) Kurulum ve Sorun Giderme Rehberi

---

## 1. Always Free Kaynak Uygunluğu

Oracle Cloud Infrastructure (OCI) Always Free katmanında ücretsiz kaynaklar şunlardır:
- **x86_64**: `VM.Standard.E2.1.Micro` (1 OCPU, 1 GB RAM).
- **Arm (Ampere)**: `VM.Standard.A1.Flex` (4 OCPU'ya ve 24 GB RAM'e kadar ücretsiz).
- **Boot Volume**: 200 GB'a kadar toplam blok depolama.

> **Önemli**: OCI Console üzerinde kaynak oluştururken **"Always Free Eligible"** rozetini mutlaka doğrulayın. Bütçe aşımını önlemek için *Billing & Cost Management* menüsünden bütçe ve e-posta alarmı kurmanız şiddetle önerilir.

---

## 2. OCI Ağ Güvenlik Kuralları (Ingress / Egress)

OCI sanal bulut ağlarında iki kademeli güvenlik mekanizması bulunur:
1. **VCN Security List / Network Security Group (NSG)**: OCI bulut katmanı.
2. **UFW / iptables**: Ubuntu VM içi işletim sistemi güvenlik duvarı.

### Gerekli Ingress Kuralları:

| Protokol | Port | Kaynak (Source CIDR) | Açıklama |
|---|---|---|---|
| **TCP** | `22` | Kendi Statik IP'niz `/32` | SSH erişimi (mümkünse 0.0.0.0/0 açmayın). |
| **UDP** | `51820` | `0.0.0.0/0` | WireGuard tünel ingress portu. |

> **UYARI**: Port 53 (DNS) için OCI Security List'e **kesinlikle genel internet ingress kuralı eklemeyin**. Unbound yalnızca WireGuard tünel arayüzü (`10.66.66.1`) üzerinden hizmet verir.

---

## 3. SSH Bağlantı ve Zaman Aşımı Sorunları

Eğer `ssh: connect to host ... port 22: Operation timed out` hatası alıyorsanız:

1. **Instance Durumu**: OCI Console'da instance'ın `RUNNING` durumunda olduğunu teyit edin.
2. **Public IP**: Instance'a bağlı VNIC üzerinde Public IPv4 adresi atandığından emin olun.
3. **Security List**: İlgili subnet'in Security List veya NSG kurallarında TCP 22 ingress izni olduğunu kontrol edin.
4. **OCI Virtual Router / IGW**: VCN Route Table içinde `0.0.0.0/0` rotasının Internet Gateway'e (IGW) yönlendirildiğini doğrulayın.
5. **Console Connection**: SSH tamamen kilitlendiyse OCI Console'dan *Console Connection / Cloud Shell* başlatarak serial bağlantı ile erişim sağlayabilirsiniz.

---

## 4. Kurulum Sonrası Servis Sağlık Denetimi

Sunucuda kurulum yapıldıktan sonra servisleri doğrulayın:

```bash
# WireGuard servis durumu
sudo systemctl status wg-quick@wg0 --no-pager

# Dinleyen UDP portları
sudo ss -lunp | grep 51820

# DNS resolver durumu
sudo systemctl status unbound --no-pager

# UFW kuralları
sudo ufw status verbose
```
