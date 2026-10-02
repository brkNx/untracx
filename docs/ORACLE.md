# Oracle Cloud Infrastructure (OCI) Reference & Troubleshooting

---

## 1. Always Free Tier Eligibility

Oracle Cloud Infrastructure (OCI) Always Free tier includes:
- **x86_64**: `VM.Standard.E2.1.Micro` (1 OCPU, 1 GB RAM).
- **Arm (Ampere)**: `VM.Standard.A1.Flex` (up to 4 OCPUs and 24 GB RAM free).
- **Boot Volume**: Up to 200 GB total block storage.

> [!TIP]
> Always verify the **"Always Free Eligible"** badge when creating compute instances in the OCI Console. Setting up a budget alarm in *Billing & Cost Management* is recommended to prevent accidental charges.

---

## 2. OCI Network Security Architecture (Two-Tier)

OCI Virtual Cloud Networks operate with two firewall tiers:
1. **Cloud Tier**: VCN Security List / Network Security Group (NSG).
2. **Host Tier**: Operating system firewall inside the VM (`UFW` / `iptables`).

### Required Ingress Rules:

| Protocol | Port | Source CIDR | Description |
|---|---|---|---|
| **TCP** | `22` | Your Static IP `/32` (or restricted CIDR) | SSH administration. |
| **UDP** | `51820` | `0.0.0.0/0` | WireGuard VPN tunnel ingress. |

> [!CAUTION]
> **Never open Port 53 (DNS) to the public internet** in your OCI Security List. Unbound operates strictly within the WireGuard interface subnet (`10.66.66.1`).

---

## 3. SSH Connectivity & Timeout Troubleshooting

If you encounter `ssh: connect to host ... port 22: Operation timed out`:

1. **Instance Lifecycle**: Confirm the instance status in the OCI Console is `RUNNING`.
2. **Public IP**: Ensure an Ephemeral or Reserved Public IPv4 is attached to the primary VNIC.
3. **Security List**: Confirm the VCN Security List has an ingress rule permitting TCP port 22.
4. **Internet Gateway**: Ensure the VCN Route Table directs default route `0.0.0.0/0` to the Internet Gateway (IGW).
5. **Console Connection**: If SSH is unreachable, open a serial *Cloud Shell / Console Connection* directly from the OCI instance page to recover access.

---

## 4. Post-Deployment Service Health Verification

After running the deployment script, verify services on the instance:

```bash
# WireGuard interface status and handshakes
sudo wg show wg0

# WireGuard systemd service
sudo systemctl status wg-quick@wg0 --no-pager

# UDP listening socket
sudo ss -lunp | grep 51820

# Recursive DNS resolver
sudo systemctl status unbound --no-pager

# Host firewall status
sudo ufw status verbose
```
