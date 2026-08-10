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
      setMessage({ type: 'success', text: 'Config üretildi.' });
    } catch (e) {
      setMessage({ type: 'error', text: `Üretim hatası: ${e}` });
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
      setMessage({ type: 'success', text: `Kaydedildi: ${path}` });
    } catch (e) {
      setMessage({ type: 'error', text: `Kaydetme hatası: ${e}` });
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
      const fallback = prompt('Config yolu:', '/etc/wireguard/wg0.conf');
      return fallback;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'info', text: 'Panoya kopyalandı.' });
  };

  return (
    <div className="card">
      <div className="card__header">
        <span className="card__title">Config Üretici</span>
        {loading && <Spinner />}
      </div>

      {message && <Message type={message.type} text={message.text} />}

      <div className="grid-2">
        <div className="input-group">
          <label>İstemci özel anahtarı</label>
          <input
            className="input"
            type="text"
            placeholder="X25519 private key (base64)"
            value={clientPrivate}
            onChange={(e) => setClientPrivate(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Sunucu genel anahtarı</label>
          <input
            className="input"
            type="text"
            placeholder="X25519 public key (base64)"
            value={serverPublic}
            onChange={(e) => setServerPublic(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Sunucu IP</label>
          <input
            className="input"
            type="text"
            placeholder="158.180.50.114"
            value={serverIp}
            onChange={(e) => setServerIp(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>İstemci IP (CIDR)</label>
          <input
            className="input"
            type="text"
            placeholder="10.66.66.2/32"
            value={clientIp}
            onChange={(e) => setClientIp(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>DNS</label>
          <input
            className="input"
            type="text"
            placeholder="10.66.66.1"
            value={dns}
            onChange={(e) => setDns(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Port</label>
          <input
            className="input"
            type="number"
            placeholder="51820"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
          />
        </div>
        <div className="input-group">
          <label>MTU (576–1500)</label>
          <input
            className="input"
            type="number"
            min={576}
            max={1500}
            value={mtu}
            onChange={(e) => setMtu(Number(e.target.value))}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="btn btn--primary"
          onClick={handleGenerate}
          disabled={loading || !clientPrivate.trim() || !serverPublic.trim() || !serverIp.trim()}
        >
          Config Üret
        </button>
        {generatedConfig && (
          <>
            <button className="btn btn--secondary" onClick={() => copyToClipboard(generatedConfig)}>
              Panoya Kopyala
            </button>
            <button className="btn btn--secondary" onClick={handleSave} disabled={loading}>
              Dosyaya Kaydet
            </button>
          </>
        )}
      </div>

      {generatedConfig && (
        <div style={{ marginTop: 12 }}>
          <label
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              display: 'block',
              marginBottom: 4,
            }}
          >
            Üretilen config
          </label>
          <div className="pre-block">{generatedConfig}</div>
        </div>
      )}
    </div>
  );
}
