# Oracle Cloud kontrol listesi

## Ücretsiz kaynak doğrulaması

Oracle Console'da instance ve boot volume için **Always Free-eligible** etiketini doğrulayın. Ücretsiz sınırlar zamanla değişebilir; billing budget ve düşük eşikli alarm açın.

Resmi kaynaklar:

- <https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm>
- <https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm>

## Ağ

OCI iki ayrı firewall katmanına sahiptir:

1. VCN üzerindeki Network Security Group veya subnet Security List
2. VM içindeki UFW/iptables

İkisinin de trafiğe izin vermesi gerekir. Oracle, instance bazlı kurallar için NSG kullanımını önerir.

Önerilen ingress:

| Protokol | Destination port | Source CIDR | Not |
|---|---:|---|---|
| TCP | 22 | Yönetim yaptığınız public IP `/32` | SSH; mümkünse dünyaya açmayın |
| UDP | 51820 | `0.0.0.0/0` | Mobil/seyahat istemcileri değişken IP kullanır |

Egress varsayılan olarak açık kalabilir. DNS portu 53 için public ingress eklemeyin.

Resmi ağ referansı: <https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/network/security-list.html>

## SSH zaman aşımı teşhisi

`ssh: connect to host ... port 22: Operation timed out` hatası anahtar doğrulamasından önce oluşur. Sırayla kontrol edin:

1. Instance `RUNNING` durumda mı?
2. Public IP doğru VNIC üzerinde mi?
3. NSG/Security List TCP 22 ingress içeriyor mu?
4. Source CIDR mevcut bağlantınızın public IP'sini kapsıyor mu?
5. VM içindeki UFW/iptables TCP 22'yi kabul ediyor mu?
6. Farklı bir SSH portu seçildiyse `SSH_PORT` ve OCI kuralı aynı mı?

Mümkünse kalıcı `0.0.0.0/0:22` yerine kendi IP'nizi `/32` kullanın. IP'niz değişirse kuralı güncellemeniz gerekir.

## WireGuard kurulumu sonrası

OCI Console'da UDP 51820 kuralını ekledikten sonra sunucuda:

```bash
sudo ss -lunp | grep 51820
sudo wg show wg0
sudo ufw status verbose
```

İstemciden handshake oluşmuyorsa önce OCI kuralını ve public endpoint'i kontrol edin; handshake var ama internet yoksa forwarding/NAT ve DNS durumuna bakın.
