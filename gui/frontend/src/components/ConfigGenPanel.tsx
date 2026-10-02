import { useState } from 'react';
import { generateConfig, saveConfig } from '../lib/helper';
import Spinner from './ui/Spinner';
import Message from './ui/Message';

export default function ConfigGenPanel() {
  const [clientPrivate, setClientPrivate] = useState('');
  const [serverPublic, setServerPublic] = useState('');
  const [serverIp, setServerIp] = useState('');
  const [clientIp, setClientIp] = useState('10.66.66.2/32');
  const [dns, setDns] = useState('10.66.66.1');
  const [mtu, setMtu] = useState(1420);
  const [port, setPort] = useState(51820);
  const [generatedConfig, setGeneratedConfig] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setMessage(null);
    setGeneratedConfig('');
    try {
      const result = await generateConfig(
        clientPrivate.trim(),
        serverPublic.trim(),
        serverIp.trim(),
        clientIp.trim(),
        dns.trim(),
        mtu,
        port,
      );
      setGeneratedConfig(result.config);
      setMessage({ type: 'success', text: 'Configuration profile generated successfully.' });
    } catch (e) {
      setMessage({ type: 'error', text: `Generation error: ${e}` });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!generatedConfig) return;
    setLoading(true);
    setMessage(null);
    try {
      const path = await showSaveDialog();
      if (!path) {
        setLoading(false);
        return;
      }
      await saveConfig(generatedConfig, path);
      setMessage({ type: 'success', text: `Saved to: ${path}` });
    } catch (e) {
      setMessage({ type: 'error', text: `Save error: ${e}` });
    }
    setLoading(false);
  };

  const showSaveDialog = async (): Promise<string | null> => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({
        defaultPath: '/etc/wireguard/wg0.conf',
        filters: [{ name: 'WireGuard Config', extensions: ['conf'] }],
      });
      return path;
    } catch {
      const fallback = prompt('Config destination path:', '/etc/wireguard/wg0.conf');
      return fallback;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'info', text: 'Copied to clipboard.' });
  };

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <span className="card__title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Configuration Generator
          </span>
          <div className="card__subtitle">
            Generate hardened client configuration profiles (wg0.conf) for your tunnel endpoints.
          </div>
        </div>
        {loading && <Spinner />}
      </div>

      {message && <Message type={message.type} text={message.text} />}

      <div className="grid-2">
        <div className="input-group">
          <label>Client Private Key</label>
          <input
            className="input input--mono"
            type="password"
            placeholder="X25519 private key (base64)"
            value={clientPrivate}
            onChange={(e) => setClientPrivate(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Server Public Key</label>
          <input
            className="input input--mono"
            type="text"
            placeholder="X25519 public key (base64)"
            value={serverPublic}
            onChange={(e) => setServerPublic(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Server Endpoint / IP</label>
          <input
            className="input input--mono"
            type="text"
            placeholder="10.0.0.1"
            value={serverIp}
            onChange={(e) => setServerIp(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Client Tunnel IP (CIDR)</label>
          <input
            className="input input--mono"
            type="text"
            placeholder="10.66.66.2/32"
            value={clientIp}
            onChange={(e) => setClientIp(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>DNS Resolvers</label>
          <input
            className="input input--mono"
            type="text"
            placeholder="10.66.66.1"
            value={dns}
            onChange={(e) => setDns(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Server Port (UDP)</label>
          <input
            className="input input--mono"
            type="number"
            placeholder="51820"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v) && v > 0 && v <= 65535) setPort(v);
            }}
          />
        </div>
        <div className="input-group">
          <label>MTU (576–1500)</label>
          <input
            className="input input--mono"
            type="number"
            min={576}
            max={1500}
            value={mtu}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v) && v >= 576 && v <= 1500) setMtu(v);
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button
          className="btn btn--primary"
          onClick={handleGenerate}
          disabled={loading || !clientPrivate.trim() || !serverPublic.trim() || !serverIp.trim()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </svg>
          Generate Profile
        </button>
        {generatedConfig && (
          <>
            <button className="btn btn--secondary" onClick={() => copyToClipboard(generatedConfig)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy to Clipboard
            </button>
            <button className="btn btn--secondary" onClick={handleSave} disabled={loading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Save to File
            </button>
          </>
        )}
      </div>

      {generatedConfig && (
        <div style={{ marginTop: 18 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              display: 'block',
              marginBottom: 6,
            }}
          >
            Generated Profile Output
          </label>
          <div className="pre-block">{generatedConfig}</div>
        </div>
      )}
    </div>
  );
}
