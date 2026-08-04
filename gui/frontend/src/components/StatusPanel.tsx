import { useState } from 'react'
import { helperStatus } from '../lib/helper'

export function StatusPanel() {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const result = await helperStatus()
      setStatus(result)
    } catch (e) {
      setStatus(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <h2>Status</h2>
      <button onClick={handleRefresh} disabled={loading}>
        {loading ? 'Checking...' : 'Refresh'}
      </button>
      {status && (
        <pre style={{ background: '#f5f5f5', padding: '8px', marginTop: '8px' }}>{status}</pre>
      )}
    </div>
  )
}