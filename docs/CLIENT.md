# Client Setup & Connection Guide

untracx generates standard WireGuard configuration profiles that are 100% compatible with official WireGuard client software across desktop and mobile platforms.

---

## 1. Obtaining a Profile

### Method A: Zero-Trust Provisioning (Recommended)

1. Generate a cryptographic keypair and optional PSK locally on your machine:
   ```bash
   untracx keygen
   untracx genpsk
   ```
2. Submit your derived `PublicKey` and `PresharedKey` to the server:
   ```bash
   # On the server:
   sudo untracx-add-peer macbook <CLIENT_PUBLIC_KEY> <PRESHARED_KEY>
   ```
3. Generate the client configuration locally:
   ```bash
   untracx genconfig \
     --server-public "<SERVER_PUBLIC_KEY>" \
     --server-ip "<SERVER_PUBLIC_IP>" \
     --client-ip "10.66.66.X/32" \
     --preshared-key "<PRESHARED_KEY>" \
     --output macbook.conf
   ```

---

### Method B: Server-Side Quick Provisioning

1. Register the device directly on the server:
   ```bash
   sudo untracx-add-peer macbook
   ```
2. Transfer the generated configuration file to your local computer and delete the remote temporary copy:
   ```bash
   scp ubuntu@<SERVER_IP>:~/untracx-macbook.conf .
   ssh ubuntu@<SERVER_IP> 'rm -f ~/untracx-macbook.conf'
   ```

---

## 2. Platform Client Setup

### 2.1 macOS
1. Install **WireGuard** from the Mac App Store or [wireguard.com/install](https://www.wireguard.com/install/).
2. Open the application → click **Import tunnel(s) from file** → choose `untracx-macbook.conf`.
3. Allow the macOS VPN profile configuration dialog and toggle the tunnel **Active**.
4. *(Optional)* Enable "On-Demand" to automatically activate the tunnel on untrusted Wi-Fi networks.

### 2.2 Windows
1. Download and install the official WireGuard MSI installer from [wireguard.com/install](https://www.wireguard.com/install/).
2. Click **Add Tunnel** → select `untracx-windows.conf`.
3. Click **Activate** to start the tunnel.

### 2.3 iOS / Android (Mobile QR Code)
1. Install **WireGuard** from the App Store or Google Play Store.
2. Render a terminal QR code from your config file:
   ```bash
   qrencode -t ansiutf8 < untracx-phone.conf
   ```
3. In the WireGuard app, tap **+** → **Create from QR code**, scan the terminal code, and save the tunnel.

### 2.4 Linux (CLI)
```bash
sudo apt-get install -y wireguard wireguard-tools
sudo install -o root -g root -m 0600 untracx-linux.conf /etc/wireguard/wg0.conf
sudo systemctl start wg-quick@wg0
sudo systemctl enable wg-quick@wg0   # Enable autostart on boot (optional)
```

---

## 3. Verification & Leak Testing

Once the tunnel is up, perform these verification checks:

1. **IPv4 Egress Match**:
   ```bash
   curl -4 https://api.ipify.org
   ```
   *The returned IP should match your VPN server's public IP.*

2. **In-Tunnel DNS Resolution**:
   ```bash
   dig +short @10.66.66.1 google.com
   ```
   *The internal Unbound resolver should resolve the query over the tunnel.*

3. **Automated End-to-End Test**:
   ```bash
   export UNTRACX_SERVER="<SERVER_IP>"
   bash scripts/test-connection.sh macbook
   ```

---

## 4. Peer Revocation

If a device is lost, replaced, or decommissioned, revoke it on the server:
```bash
sudo untracx-remove-peer macbook
```
The revoked peer is immediately dropped from the live WireGuard interface and its keys are removed from the server configuration.
