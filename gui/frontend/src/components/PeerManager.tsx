import { useState } from 'react'
import { peerAdd, peerRemove } from '../lib/helper'

export function PeerManager() {
  const [peerName, setPeerName] = useState('')
  const [peers, setPeers] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!peerName.trim()) return
    setLoading(true)
    try {
      const result = await peerAdd(peerName.trim())
      setStatus(result)
      setPeers((prev) => [...prev, peerName.trim()])
      setPeerName('')
    } catch (e) {
      setStatus(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (name: string) => {
    setLoading(true)
    try {
      const result = await peerRemove(name)
      setStatus(result)
      setPeers((prev) => prev.filter((p) => p !== name))
    } catch (e) {
      setStatus(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <h2>Peers</h2>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input
          placeholder="Peer name"
          value={peerName}
          onChange={(e) => setPeerName(e.target.value)}
          style={{ width: '200px' }}
        />
        <button onClick={handleAdd} disabled={loading || !peerName.trim()}>
          Add Peer
        </button>
      </div>
      <ul>
        {peers.map((peer) => (
          <li key={peer}>
            {peer}
            <button onClick={() => handleRemove(peer)} disabled={loading} style={{ marginLeft: '8px' }}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      {status && (
        <pre style={{ background: '#f5f5f5', padding: '8px', marginTop: '8px' }}>{status}</pre>
      )}
    </div>
  )
}