import React, { useState } from 'react';
import { vpnConnect, vpnDisconnect, vpnStatus } from '../lib/helper';

export default function ConnectionPanel() {
  const [configPath, setConfigPath] = useState('/etc/wireguard/wg0.conf');
  const [iface, setIface] = useState('wg0');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const result = await vpnConnect(configPath);
      setStatus(`Bağlandı: ${JSON.stringify(result)}`);
    } catch (e: any) {
      setStatus(`Hata: ${e}`);
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const result = await vpnDisconnect(iface);
      setStatus(`Bağlantı kesildi: ${JSON.stringify(result)}`);
    } catch (e: any) {
      setStatus(`Hata: ${e}`);
    }
    setLoading(false);
  };

  const handleCheckStatus = async () => {
    try {
      const result = await vpnStatus();
      setStatus(`Durum: ${JSON.stringify(result)}`);
    } catch (e: any) {
      setStatus(`Hata: ${e}`);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <h2>VPN Bağlantısı</h2>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={handleConnect} disabled={loading}>
          Bağlan
        </button>
        <button onClick={handleDisconnect} disabled={loading}>
          Kes
        </button>
        <button onClick={handleCheckStatus} disabled={loading}>
          Durum Kontrol
        </button>
      </div>
      {status && (
        <pre style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f5f5f5', borderRadius: '4px' }}>
          {status}
        </pre>
      )}
      <div style={{ marginTop: '0.5rem' }}>
        <label>
          Config yolu:
          <input
            type="text"
            value={configPath}
            onChange={(e) => setConfigPath(e.target.value)}
            style={{ marginLeft: '0.5rem', width: '300px' }}
          />
        </label>
      </div>
      <div style={{ marginTop: '0.25rem' }}>
        <label>
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