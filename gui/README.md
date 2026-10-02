# untracx Desktop Client & GUI

Tauri 2 + React 19 + TypeScript frontend with a modern Linear/Tailscale dark design system for the untracx WireGuard VPN client.

## Development Setup

```bash
cd gui/frontend
npm install
npm run dev    # Starts Vite dev server at http://localhost:5173
npm run build  # Typechecks and builds production bundle -> dist/
```

## Tauri Production Builds

```bash
# macOS (universal or architecture specific)
npm run tauri build

# Linux (Debian / RPM / AppImage)
npm run tauri build -- --target x86_64-unknown-linux-gnu

# Windows (MSI / NSIS installer)
npm run tauri build -- --target x86_64-pc-windows-msvc
```

## Visual Architecture & Interface

<p align="center">
  <img src="../docs/gui-screenshot.png" alt="Untracx GUI Overview" width="750">
</p>

## Tauri IPC Commands

| Command | Arguments | Description |
|---|---|---|
| `helper_start` | — | Starts the untracx privileged helper daemon |
| `helper_stop` | — | Gracefully stops the privileged helper service |
| `helper_status` | — | Inspects helper lifecycle and Unix domain socket / named pipe |
| `vpn_connect` | `configPath` | Activates WireGuard tunnel using specified configuration path |
| `vpn_down` | `iface` | Tears down active tunnel interface |
| `vpn_status` | — | Queries real-time WireGuard link state, endpoint, and bandwidth telemetry |
| `peer_list` | `iface?` | Retrieves active peer configuration from server/client interface |
| `peer_add` | `name` | Generates safe server-side peer provisioning instructions |
| `peer_remove` | `name` | Generates safe server-side peer revocation instructions |
| `keygen` | — | Generates ephemeral or static Curve25519 keypair and post-quantum PSK |
| `public_from_private` | `privateKey` | Derives X25519 public key from private key deterministically |
| `validate_private_key` | `privateKey` | Validates Base64 Curve25519 private key formatting and length |
| `validate_public_key` | `publicKey` | Validates Base64 Curve25519 public key formatting and length |
| `generate_config` | `clientPrivate`, `serverPublic`, `serverIp`, `clientIp`, `dns`, `mtu`, `port`, `presharedKey?` | Generates injection-proof WireGuard client profile |
| `save_config` | `content`, `path` | Atomically writes configuration file with strict `0600` permissions |

## Testing & Quality Assurance

```bash
# Run unit & integration tests (Vitest)
npm --prefix gui/frontend run test

# Frontend linting and code formatting
npm --prefix gui/frontend run lint
npm --prefix gui/frontend run format:check

# Automated UI screenshot capture
node gui/frontend/capture-all.js
```

## Security Model

- **Least Privilege:** GUI frontend never executes as root or administrator.
- **Privilege Separation:** Privileged helper daemon strictly restricts operations to pre-whitelisted interface names and paths.
- **Zero-Trust Ephemeral Keys:** Private keys are zeroized in memory and never transmitted to remote servers.
- **Atomic Operations:** Configuration files are written atomically using safe file operations (`O_NOFOLLOW`, `0600` permissions) to prevent symlink attacks and race conditions.
