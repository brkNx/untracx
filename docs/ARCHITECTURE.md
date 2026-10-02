# Architecture & System Design Principles

**untracx** is a high-security, verifiable, and sustainable WireGuard personal VPN solution.

---

## 1. Network & Server Architecture (Server Core)

```text
┌────────────────────────────────────────────────────────┐
│                     Client Device                      │
│ (Official WireGuard Client / iOS / Android / Desktop)  │
└──────────────────────────┬─────────────────────────────┘
                           │ WireGuard (UDP 51820)
                           ▼
┌────────────────────────────────────────────────────────┐
│         Ubuntu 22.04 / 24.04 Server (OCI / VPS)        │
│                                                        │
│  Kernel WireGuard (wg0: 10.66.66.1/24)                │
│  ├── UFW Firewall (Fail-Closed Default Deny)          │
│  │   ├── Ingress: UDP 51820 (Any IPv4/IPv6)           │
│  │   ├── Ingress: TCP 22 (Management IP /32)          │
│  │   └── In-Tunnel: TCP/UDP 53 (Only wg0 -> 10.66.66.1)│
│  ├── Unbound DNS Resolver (10.66.66.1:53)              │
│  │   └── QNAME Minimisation + DNSSEC Validating        │
│  └── Egress: iptables NAT Masquerade -> Internet       │
└────────────────────────────────────────────────────────┘
```

- **Network Isolation**: The server DNS resolver is blocked from the public internet (`0.0.0.0/0 refuse`) and exclusively answers queries originating from the WireGuard tunnel (`10.66.66.0/24`).
- **Dynamic Interface Detection**: The bootstrap script (`setup.sh`) detects the default outbound routing interface (`ip route show default`) dynamically without hardcoding assumptions like `eth0`.
- **Idempotent Operations**: Repeated executions of `setup.sh` safely preserve existing server private keys and configured peers without overwriting state.

---

## 2. Peer & Provisioning Model (Zero-Trust)

untracx provides two distinct provisioning workflows:

1. **Zero-Trust Client Provisioning (Recommended)**:
   - The client private key (`PrivateKey`) is generated exclusively on the client's local machine.
   - Only the derived client public key (`PublicKey`) and an optional shared `PresharedKey` are submitted to the server:
     `sudo untracx-add-peer <device> <client-public-key> [preshared-key]`
   - The server never possesses or stores the client's private key.
2. **Server-Side Provisioning (Quick-Start)**:
   - The server generates the keypair and configures `~/untracx-<device>.conf` with restricted `0600` permissions.
   - The client downloads the `.conf` file and the server-side temporary copy is immediately deleted.

---

## 3. Data & File Integrity (Atomic Transactions)

- **Atomic Peer Removal**: `server/remove-peer.sh` parses `[Peer]` block boundaries and target public keys deterministically. Manual peer entries and other clients are strictly preserved.
- **Atomic Peer Addition**: `server/add-peer.sh` conducts configuration updates, metadata tracking, and live `wg syncconf` execution as a single transactional unit with rollback on failure.
- **Secure File Writing**: Sensitive files containing cryptographic keys are written via `fs_util::write_secret_file_atomic` with `0600` mode, `O_NOFOLLOW` flag, `create_new(true)`, `fsync`, and atomic rename operations.

---

## 4. Desktop & Client Architecture (v1 GUI)

- **Tauri 2 + React**: The desktop interface runs entirely under standard user privileges without requiring root or elevated capabilities.
- **Memory Hygiene**: Private keys and PSKs are zeroized in RAM immediately after use via the `Zeroize` trait.
- **Standard Protocol Compatibility**: Rather than fragile custom wrappers, untracx produces standard `.conf` files and QR codes that seamlessly integrate into official WireGuard client software across all operating systems.

---

## 5. Non-Negotiable Security Principles

1. Private keys and PSKs are never emitted to stdout, logs, or terminal streams.
2. The desktop GUI application is never launched with root/administrator privileges.
3. No speculative or unproven security mechanisms are displayed in the user interface.
4. If a single client device is lost or compromised, individual peer revocation is performed without needing to rebuild the entire server.
