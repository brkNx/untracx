# Oracle Cloud Infrastructure (OCI) Deployment Guide

This guide details how to deploy, configure, and manage the **untracx** WireGuard VPN server on an Oracle Cloud Infrastructure (OCI) Compute Instance (supporting both Always Free and standard tiers, x86_64 & Ampere A1 ARM64).

---

## 1. OCI Network & Ingress Security Rules

Oracle Cloud Virtual Cloud Networks (VCN) default to allowing only `TCP 22` (SSH). For WireGuard VPN traffic to pass through, `UDP 51820` must be permitted in the VCN Ingress Rules.

### Adding the Ingress Rule:
1. Log in to the **OCI Console**.
2. Navigate to **Networking** -> **Virtual Cloud Networks (VCN)**.
3. Select your VCN and click on the **Default Security List** (or your subnet's associated Security List / Network Security Group).
4. Click **Add Ingress Rules**:
   - **Source CIDR:** `0.0.0.0/0`
   - **IP Protocol:** `UDP`
   - **Destination Port Range:** `51820`
   - **Description:** `untracx WireGuard UDP Ingress`
5. Click **Add Ingress Rules** to save.

> [!WARNING]
> **Do not open Port 53 (DNS) to the public internet.** The Unbound recursive DNS resolver only listens on the internal WireGuard tunnel interface (`10.66.66.1:53`).

---

## 2. SSH Configuration

Configure SSH access in your local `~/.ssh/config` file:

```sshconfig
Host oracle
    HostName <YOUR_ORACLE_PUBLIC_IP>
    User ubuntu
    IdentityFile ~/.ssh/id_oracle.key
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

Verify connectivity:
```bash
ssh oracle "uname -a"
```

---

## 3. Automated One-Command Deployment

You can deploy the complete untracx server and automatically fetch your initial client profile in one step from your local machine.

### Linux / macOS (Bash):
```bash
# Server setup only:
bash scripts/deploy-oracle.sh oracle

# Server setup + automatically provision and download client profile:
bash scripts/deploy-oracle.sh oracle pc-client
```

### Windows (PowerShell):
```powershell
# Server setup only:
.\scripts\deploy-oracle.ps1 -Target oracle

# Server setup + automatically provision and download client profile:
.\scripts\deploy-oracle.ps1 -Target oracle -Peer pc-client
```

The script will:
1. Validate SSH connectivity and detect remote architecture (e.g., `aarch64` / `x86_64`).
2. Upload the `server/` components to the instance.
3. Run `setup.sh` to install WireGuard, Unbound DNS, UFW, and fail2ban.
4. Verify OCI host firewall rules (`iptables` / `ufw`).
5. Provision the client profile (if specified) and securely download `untracx-<peer>.conf` to your local folder.

---

## 4. Peer Management (Adding & Revoking Devices)

Once deployed, you can manage devices at any time over SSH:

### Add a New Device:
```bash
ssh oracle "sudo untracx-add-peer my-phone"
scp oracle:~/untracx-my-phone.conf ./
ssh oracle "rm -f ~/untracx-my-phone.conf"
```

### Revoke a Device:
```bash
ssh oracle "sudo untracx-remove-peer my-phone"
```

### Check Server & Peer Status:
```bash
ssh oracle "sudo wg show wg0"
```

---

## 5. Client Connection

Import the generated `.conf` profile:
- **Official WireGuard Client:** Click "Add Tunnel" -> select `untracx-<peer>.conf` -> Activate.
- **Untracx Desktop GUI:** Use "Import Profile" in the Tauri application.
