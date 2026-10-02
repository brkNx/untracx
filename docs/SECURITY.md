# Security & Threat Model (v1.2)

---

## 1. Security Architecture & Guarantees

untracx protects personal VPN traffic with the following verifiable cryptographic guarantees:

### 1.1 Cryptographic Foundations
- **Protocol**: WireGuard (Noise IKpsk2 protocol handshake).
- **Symmetric Encryption**: ChaCha20-Poly1305 AEAD.
- **Key Exchange**: Curve25519 (X25519 ECDH).
- **Hashing**: BLAKE2s.
- **Post-Quantum Forward Secrecy**: 256-bit Pre-shared Key (PSK) support providing isolation and quantum-resistant forward secrecy against future decrypt-later attacks.

### 1.2 Memory & Storage Protection
- **Zeroize Cleansing**: All private keys, PSKs, and decrypted sensitive buffers are cleared from system RAM via the `Zeroize` trait immediately upon drop.
- **Atomic File Writing**: Secrets are written using `fs_util::write_secret_file_atomic` with `create_new(true)`, `0600` POSIX mode, `O_NOFOLLOW` flag, and atomic `rename` preceded by `fsync`.
- **Symlink & TOCTOU Defense**: `O_NOFOLLOW` prevents symlink redirection and race conditions during file creation.

---

## 2. Threat Model

### Threats Protected Against (In-Scope)
- **Local Network Eavesdropping**: Passive packet sniffing, ARP spoofing, and malicious Wi-Fi access points in cafes, hotels, and airports.
- **ISP Traffic Inspection & Metadata Collection**: Prevents internet service providers from reading payload content, browsing destinations, and protocol patterns.
- **DNS Hijacking & Censorship**: Unbound recursive DNS resolver with full DNSSEC validation and QNAME minimization prevents external DNS spoofing and query interception.
- **Compromised Peer Isolation**: Separate keypairs and PSKs ensure that the compromise of one device does not expose traffic from other peers.

### Threats Outside Scope (Out-of-Scope)
- **Cloud Infrastructure Compromise**: Direct root access or hypervisor compromise by the cloud provider (e.g., OCI / VPS root).
- **Client-Side Host Malware**: Kernel-level keyloggers, screen grabbers, or compromised client operating systems.
- **Nation-State Global Traffic Analysis**: Advanced end-to-end packet timing and statistical flow correlation across global backbones.
- **Browser Fingerprinting & Account Tracking**: Cookies, Canvas fingerprinting, or active browser logins.

---

## 3. Kill-Switch & Leak Boundaries

- Setting `AllowedIPs = 0.0.0.0/0, ::/0` routes all standard system traffic through the WireGuard interface.
- In the event of abrupt tunnel disconnects:
  - **Linux**: Use `scripts/killswitch-linux.sh` (enforces nftables `inet` table `policy drop` with interface exemptions).
  - **macOS / Windows**: Rely on official WireGuard client's native On-Demand tunnel routing and block untunneled traffic settings.
- Verify leaks regularly using `scripts/test-connection.sh`.
