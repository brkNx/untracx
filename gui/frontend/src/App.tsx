import React, { useState, useEffect } from 'react';
import { initTauri } from './lib/helper';
import ConnectionPanel from './components/ConnectionPanel';
import StatusPanel from './components/StatusPanel';

function App() {
  const [ready, setReady] = useState(false);
  const [helperRunning, setHelperRunning] = useState(false);

  useEffect(() => {
    initTauri().then(() => {
      setReady(true);
      checkHelperStatus();
    });
  }, []);

  const checkHelperStatus = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result: any = await invoke('helper_status');
      setHelperRunning(result?.running ?? false);
    } catch {
      setHelperRunning(false);
    }
  };

  if (!ready) {
    return <div>Yükleniyor...</div>;
  }

  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>untracx</h1>
      <p>
        Helper durumu:{' '}
        <strong>{helperRunning ? 'Çalışıyor' : 'Durduruldu'}</strong>
      </p>
      <StatusPanel />
      <ConnectionPanel />
    </div>
  );
}

export default App;