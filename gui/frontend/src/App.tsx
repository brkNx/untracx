import { useState } from 'react'
import { ConnectionPanel } from './components/ConnectionPanel.tsx'
import { StatusPanel } from './components/StatusPanel.tsx'
import { PeerManager } from './components/PeerManager.tsx'

function App() {
  const [helperRunning, setHelperRunning] = useState(false)

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif' }}>
      <h1>untracx</h1>
      <StatusPanel />
      <ConnectionPanel helperRunning={helperRunning} setHelperRunning={setHelperRunning} />
      <PeerManager />
    </div>
  )
}

export default App