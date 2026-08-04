import { useState } from 'react'
import { vpnConnect, vpnDown } from '../lib/helper'

interface ConnectionPanelProps {
  helperRunning: boolean
  setHelperRunning: (running: boolean) => void
}

export function ConnectionPanel({ helperRunning, setHelperRunning }: ConnectionPanelProps) {
  const [configPath, setConfigPath] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    try {
      const result = await vpnConnect(configPath)
      setStatus(result)
    } catch (e) {
      setStatus(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      const result = await vpnDown(configPath)
      setStatus(result)
    } catch (e) {
      setStatus(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleHelperToggle = async () => {
    if (helperRunning) {
      await helperStop()
      setHelperRunning(false)
    } else {
      await helperStart()
      setHelperRunning(true)
    }
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <h2>Connection</h2>
      <button onClick={handleHelperToggle}>
        {helperRunning ? 'Stop Helper' : 'Start Helper'}
      </button>
      <div style={{ marginTop: '8px' }}>
        <input
          placeholder="Config path (e.g. client.conf)"
          value={configPath}
          onChange={(e) => setConfigPath(e.target.value)}
          style={{ width: '300px' }}
        />
        <button onClick={handleConnect} disabled={loading || !configPath}>
          Connect
        </button>
        <button onClick={handleDisconnect} disabled={loading || !configPath}>
          Disconnect
        </button>
      </div>
      {status && (
        <pre style={{ background: '#f5f5f5', padding: '8px', marginTop: '8px' }}>{status}</pre>
      )}
    </div>
  )
}