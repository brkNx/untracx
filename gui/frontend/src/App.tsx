import React, { useState, useEffect, useCallback } from 'react';
import {
  helperStart,
  helperStop,
  helperStatus,
  vpnConnect,
  vpnDisconnect,
  vpnStatus,
} from './lib/helper';
import ConnectionPanel from './components/ConnectionPanel';
import StatusPanel from './components/StatusPanel';
import PeerManager from './components/PeerManager';

function App() {
  const [helperRunning, setHelperRunning] = useState<boolean | null>(null);
  const [helperSocket, setHelperSocket] = useState<string>('');
  const [vpnConnected, setVpnConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshHelperStatus = useCallback(async () => {
    try {
      const result = await helperStatus();
      setHelperRunning(result?.running ?? false);
      setHelperSocket(result?.socketPath ?? '');
    } catch (e: any) {
      setHelperRunning(false);
    }
  }, []);

  const refreshVpnStatus = useCallback(async () => {
    try {
      const result = await vpnStatus();
      setVpnConnected(result?.connected ?? false);
    } catch {
      setVpnConnected(null);
    }
  }, []);

  useEffect(() => {
    refreshHelperStatus();
    refreshVpnStatus();
  }, [refreshHelperStatus, refreshVpnStatus]);

  const handleStartHelper = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await helperStart();
      setMessage('Helper servisi başlatıldı.');
      setTimeout(refreshHelperStatus, 1000);
    } catch (e: any) {
      setMessage(`Hata: ${e}`);
    }
    setLoading(false);
  };

  const handleStopHelper = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await helperStop();
      setMessage('Helper servisi durduruldu.');
      setTimeout(refreshHelperStatus, 1000);
    } catch (e: any) {
      setMessage(`Hata: ${e}`);
    }
    setLoading(false);
  };

  const handleConnect = async (configPath: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await vpnConnect(configPath);
      setMessage(`Bağlandı: ${JSON.stringify(result)}`);
      setTimeout(refreshVpnStatus, 2000);
    } catch (e: any) {
      setMessage(`Hata: ${e}`);
    }
    setLoading(false);
  };

  const handleDisconnect = async (iface: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await vpnDisconnect(iface);
      setMessage(`Bağlantı kesildi: ${JSON.stringify(result)}`);
      setTimeout(refreshVpnStatus, 1000);
    } catch (e: any) {
      setMessage(`Hata: ${e}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>untracx</h1>
      <p>
        Helper:{' '}
        <strong>
          {helperRunning === null
            ? 'Yükleniyor...'
            : helperRunning
              ? 'Çalışıyor'
              : 'Durduruldu'}
        </strong>
        {helperSocket && <span style={{ marginLeft: '0.5rem', fontSize: '0.85em', color: '#666' }}>({helperSocket})</span>}
      </p>
      <p>
        VPN:{' '}
        <strong>
          {vpnConnected === null
            ? 'Belirsiz'
            : vpnConnected
              ? 'Bağlı'
              : 'Bağlı değil'}
        </strong>
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button onClick={handleStartHelper} disabled={loading || helperRunning === true}>
          Helper Başlat
        </button>
        <button onClick={handleStopHelper} disabled={loading || helperRunning !== true}>
          Helper Durdur
        </button>
        <button onClick={refreshHelperStatus} disabled={loading}>
          Yenile
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '0.5rem',
            marginBottom: '1rem',
            background: message.startsWith('Hata') ? '#fee' : '#efe',
            borderRadius: '4px',
          }}
        >
          {message}
        </div>
      )}

      <StatusPanel onRefresh={refreshVpnStatus} />
      <ConnectionPanel onConnect={handleConnect} onDisconnect={handleDisconnect} loading={loading} />
      <PeerManager />
    </div>
  );
}

export default App;