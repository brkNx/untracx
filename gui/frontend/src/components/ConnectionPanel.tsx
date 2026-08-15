import { useState } from 'react';
import { vpnConnect, vpnDisconnect } from '../lib/helper';
import Spinner from './ui/Spinner';
import Message from './ui/Message';

interface Props {
  onStatusChange: () => void;
}

export default function ConnectionPanel({ onStatusChange }: Props) {
  const [configPath, setConfigPath] = useState('/etc/wireguard/wg0.conf');
  const [iface, setIface] = useState('wg0');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await vpnConnect(configPath);
      setMessage({ type: 'success', text: 'VPN bağlantısı kuruldu.' });
      setTimeout(onStatusChange, 1500);
    } catch (e) {
      setMessage({ type: 'error', text: `Bağlantı hatası: ${e}` });
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await vpnDisconnect(iface);
      setMessage({ type: 'success', text: 'VPN bağlantısı kesildi.' });
      setTimeout(onStatusChange, 1000);
    } catch (e) {
      setMessage({ type: 'error', text: `Bağlantı kesme hatası: ${e}` });
    }
    setLoading(false);
  };

  return (
    <div className="card">
      <div className="card__header">
        <span className="card__title">VPN Bağlantısı</span>
        {loading && <Spinner />}
      </div>

      {message && <Message type={message.type} text={message.text} />}

      <div className="grid-2">
        <div className="input-group">
          <label>Config yolu</label>
          <input
            className="input"
            type="text"
            value={configPath}
            onChange={(e) => setConfigPath(e.target.value)}
            placeholder="/etc/wireguard/wg0.conf"
          />
        </div>
        <div className="input-group">
          <label>Arayüz adı</label>
          <input
            className="input"
            type="text"
            value={iface}
            onChange={(e) => setIface(e.target.value)}
            placeholder="wg0"
            style={{ maxWidth: 120 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          className="btn btn--primary"
          onClick={handleConnect}
          disabled={loading || !configPath.trim()}
        >
          {loading ? 'Bağlanıyor...' : 'Bağlan'}
        </button>
        <button
          className="btn btn--danger"
          onClick={handleDisconnect}
          disabled={loading || !iface.trim()}
        >
          {loading ? 'Kesiliyor...' : 'Bağlantıyı Kes'}
        </button>
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}
      >
        💡 <strong>Bağlantı Yöntemi:</strong> GUI üzerinden tek tıkla bağlanmak için ayrıcalıklı
        helper servisinin (<code>sudo untracx helper start</code>) çalışması gerekir. Dilerseniz
        oluşturduğunuz <code>.conf</code> dosyasını resmi WireGuard uygulamasına aktararak da
        doğrudan kullanabilirsiniz.
      </div>
    </div>
  );
}
