import { invoke } from '@tauri-apps/api/core'

export async function helperStart(): Promise<string> {
  return invoke<string>('helper_start')
}

export async function helperStop(): Promise<string> {
  return invoke<string>('helper_stop')
}

export async function helperStatus(): Promise<string> {
  return invoke<string>('helper_status')
}

export async function vpnConnect(config: string): Promise<string> {
  return invoke<string>('vpn_connect', { config })
}

export async function vpnDown(config: string): Promise<string> {
  return invoke<string>('vpn_down', { config })
}

export async function peerList(): Promise<string> {
  return invoke<string>('peer_list')
}

export async function peerAdd(name: string): Promise<string> {
  return invoke<string>('peer_add', { name })
}

export async function peerRemove(name: string): Promise<string> {
  return invoke<string>('peer_remove', { name })
}