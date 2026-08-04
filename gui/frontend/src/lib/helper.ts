import { invoke } from '@tauri-apps/api/core';

export async function helperStart(): Promise<any> {
  return invoke('helper_start');
}

export async function helperStop(): Promise<any> {
  return invoke('helper_stop');
}

export async function helperStatus(): Promise<any> {
  return invoke('helper_status');
}

export async function vpnConnect(configPath: string): Promise<any> {
  return invoke('vpn_connect', { configPath });
}

export async function vpnDisconnect(iface: string): Promise<any> {
  return invoke('vpn_down', { iface });
}

export async function vpnStatus(): Promise<any> {
  return invoke('vpn_status');
}

export async function peerList(): Promise<any> {
  return invoke('peer_list');
}

export async function peerAdd(name: string): Promise<any> {
  return invoke('peer_add', { name });
}

export async function peerRemove(name: string): Promise<any> {
  return invoke('peer_remove', { name });
}