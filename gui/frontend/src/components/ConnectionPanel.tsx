import React, { useState } from 'react';

interface Props {
  onConnect: (configPath: string) => Promise<void>;
  onDisconnect: (iface: string) => Promise<void>;
  loading: boolean;
}

export default function ConnectionPanel({ onConnect, onDisconnect, loading }: Props) {
  const [configPath, setConfigPath] = useState('/etc/wireguard/wg0.conf');
  const [iface, setIface] = useState('wg0');
  const [status, setStatus] = useState<string | null>(null);

  const handleConnect = async () => {
    setStatus('Bağlanıyor...');
    try {
      await onConnect(configPath);
      setStatus('Bağlandı ✓');
    } catch (e: any) {
      setStatus(`Hata: ${e}`);
    }
  };

  const handleDisconnect = async () => {
    setStatus('Bağlantı kesiliyor...');
    try {
      await onDisconnect(iface);
      setStatus('Bağlantı kesildi ✓');
    } catch (e: any) {
      setStatus(`Hata: ${e}`);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <h2>VPN Bağlantısı</h2>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <button onClick={handleConnect} disabled={loading}>
          Bağlan
        </button>
        <button onClick={handleDisconnect} disabled={loading}>
          Kes
        </button>
      </div>
      {status && (
        <pre style={{ padding: '0.5rem', background: '#f5f5f5', borderRadius: '4px', fontSize: '0.9em' }}>
          {status}
        </pre>
      )}
      <div style={{ marginTop: '0.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.25rem' }}>
          Config yolu:
          <input
            type="text"
            value={configPath}
            onChange={(e) => setConfigPath(e.target.value)}
            style={{ marginLeft: '0.5rem', width: '350px' }}
          />
        </label>
      </div>
      <div style={{ marginTop: '0.25rem' }}>
        <label style={{ display: 'block', marginBottom: '0.25rem' }}>
          Arayüz adı:
          <input
            type="text"
            value={iface}
            onChange={(e) => setIface(e.target.value)}
            style={{ marginLeft: '0.5rem', width: '100px' }}
          />
        </label>
      </div>
    </div>
  );
}