export interface HelperStatus {
  running: boolean;
  socketExists: boolean;
  socketPath: string;
  systemctlStatus: string;
}

export interface VpnResult {
  ok: boolean;
  iface?: string;
  error?: string;
}

export interface VpnStatus {
  ok: boolean;
  connected: boolean;
  output?: string;
  error?: string;
}

export interface Peer {
  publicKey: string;
}

export interface PeerListResult {
  ok: boolean;
  peers: Peer[];
  error?: string;
}

export interface PeerActionResult {
  ok: boolean;
  output?: string;
  error?: string;
}

export interface CommandResult {
  ok: boolean;
  message?: string;
  error?: string;
}

export interface KeyPair {
  ok: boolean;
  publicKey: string;
}

export interface PublicKeyResult {
  ok: boolean;
  publicKey: string;
}

export interface ValidateResult {
  ok: boolean;
  valid: boolean;
}

export interface ConfigResult {
  ok: boolean;
  config: string;
}

export interface SaveConfigResult {
  ok: boolean;
  path: string;
}

export interface AppSettings {
  configPath: string;
  interfaceName: string;
  serverIp: string;
  serverPort: number;
}
