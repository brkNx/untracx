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
      setMessage({ type: 'success', text: 'VPN connected.' });
      setTimeout(onStatusChange, 1500);
    } catch (e) {
      setMessage({ type: 'error', text: `Connection error: ${e}` });
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await vpnDisconnect(iface);
      setMessage({ type: 'success', text: 'VPN disconnected.' });
      setTimeout(onStatusChange, 1000);
    } catch (e) {
      setMessage({ type: 'error', text: `Disconnection error: ${e}` });
    }
    setLoading(false);
  };

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <span className="card__title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            VPN Tunnel Connection
          </span>
          <div className="card__subtitle">Initiate or terminate encrypted WireGuard session</div>
        </div>
        {loading && <Spinner />}
      </div>

      {message && <Message type={message.type} text={message.text} />}

      <div className="grid-2">
        <div className="input-group">
          <label>Profile Config Path</label>
          <input
            className="input input--mono"
            type="text"
            value={configPath}
            onChange={(e) => setConfigPath(e.target.value)}
            placeholder="/etc/wireguard/wg0.conf"
          />
        </div>
        <div className="input-group">
          <label>Interface Name</label>
          <input
            className="input input--mono"
            type="text"
            value={iface}
            onChange={(e) => setIface(e.target.value)}
            placeholder="wg0"
            style={{ maxWidth: 160 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button
          className="btn btn--primary"
          onClick={handleConnect}
          disabled={loading || !configPath.trim()}
        >
          {loading ? 'Connecting...' : 'Connect'}
        </button>
        <button
          className="btn btn--danger"
          onClick={handleDisconnect}
          disabled={loading || !iface.trim()}
        >
          {loading ? 'Disconnecting...' : 'Disconnect'}
        </button>
      </div>

      <div className="info-callout">
        💡 <strong>Connection Architecture:</strong> Starting the tunnel directly from this desktop GUI requires
        the background helper service (<code>sudo untracx helper start</code>). Alternatively, you can import
        your generated <code>.conf</code> profile into the official WireGuard application.
      </div>
    </div>
  );
}
