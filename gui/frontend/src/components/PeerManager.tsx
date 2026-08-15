import { useState, useEffect, useCallback } from 'react';
import { peerList, peerAdd, peerRemove } from '../lib/helper';
import type { Peer } from '../lib/types';
import Spinner from './ui/Spinner';
import Message from './ui/Message';

export default function PeerManager() {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [newName, setNewName] = useState('');
  const [removeName, setRemoveName] = useState('');
  const [customPubkey, setCustomPubkey] = useState('');
  const [generatedCmd, setGeneratedCmd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [interfaceName, setInterfaceName] = useState('wg0');

  const refresh = useCallback(async () => {
    try {
      const result = await peerList(interfaceName);
      setPeers(result.peers ?? []);
    } catch {
      setPeers([]);
    }
  }, [interfaceName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await peerAdd(newName.trim());
      const cmd = customPubkey.trim()
        ? `sudo untracx-add-peer ${newName.trim()} ${customPubkey.trim()}`
        : result.output
          ? result.output.replace(/^Sunucuda çalıştırmak için: /, '')
          : `sudo untracx-add-peer ${newName.trim()}`;
      setGeneratedCmd(cmd);
      setMessage({ type: 'success', text: `Sunucu komutu hazırlandı: "${newName.trim()}"` });
      setNewName('');
      setCustomPubkey('');
    } catch (e) {
      setMessage({ type: 'error', text: `Komut oluşturma hatası: ${e}` });
    }
    setLoading(false);
  };

  const handleRemove = async () => {
    if (!removeName.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await peerRemove(removeName.trim());
      const cmd = result.output
        ? result.output.replace(/^Sunucuda çalıştırmak için: /, '')
        : `sudo untracx-remove-peer ${removeName.trim()}`;
      setGeneratedCmd(cmd);
      setMessage({
        type: 'success',
        text: `Sunucu kaldırma komutu hazırlandı: "${removeName.trim()}"`,
      });
      setRemoveName('');
    } catch (e) {
      setMessage({ type: 'error', text: `Komut oluşturma hatası: ${e}` });
    }
    setLoading(false);
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setMessage({
      type: 'info',
      text: 'Komut panoya kopyalandı! Sunucu SSH terminalinize yapıştırın.',
    });
  };

  return (
    <div className="card">
      <div className="card__header">
        <span className="card__title">Sunucu Peer Yönetimi &amp; Komut Üretici</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && <Spinner />}
          <button className="btn btn--secondary btn--sm" onClick={refresh} disabled={loading}>
            Yenile
          </button>
        </div>
      </div>

      {message && <Message type={message.type} text={message.text} />}

      <div
        style={{
          background: 'var(--bg-input)',
          padding: 12,
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          💡 <strong>Peer Ekleme Rehberi:</strong> WireGuard peer yetkilendirmesi güvenlik gereği
          doğrudan sunucunuzda (Ubuntu) çalıştırılır. Aşağıdaki formdan cihaz adı girerek sunucuda
          çalıştıracağınız güvenli tek satırlık komutu oluşturabilirsiniz.
        </p>
      </div>

      {generatedCmd && (
        <div
          style={{
            marginBottom: 16,
            background: 'rgba(59, 130, 246, 0.08)',
            padding: 12,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
          }}
        >
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--accent-blue)',
              display: 'block',
              marginBottom: 6,
            }}
          >
            📋 Sunucuda Çalıştırılacak Komut:
          </label>
          <div className="key-display" style={{ color: '#fff', fontWeight: 500 }}>
            {generatedCmd}
            <button
              className="btn btn--primary btn--sm key-display__copy"
              onClick={() => copyCommand(generatedCmd)}
            >
              Kopyala
            </button>
          </div>
        </div>
      )}

      <div className="input-group">
        <label>Yerel Arayüz</label>
        <input
          className="input"
          type="text"
          value={interfaceName}
          onChange={(e) => setInterfaceName(e.target.value)}
          style={{ maxWidth: 120 }}
        />
      </div>

      {peers.length === 0 ? (
        <div className="empty" style={{ padding: '12px 0' }}>
          Sunucuda kayıtlı yerel önbellek peer kaydı yok.
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Genel Anahtar</th>
            </tr>
          </thead>
          <tbody>
            {peers.map((p, i) => (
              <tr key={p.publicKey}>
                <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                <td className="key">{p.publicKey}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="input-group">
          <label>Yeni Cihaz / Peer Ekle</label>
          <div className="input-row">
            <input
              className="input"
              type="text"
              placeholder="cihaz-adı (örn. macbook)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              className="btn btn--primary btn--sm"
              onClick={handleAdd}
              disabled={loading || !newName.trim()}
            >
              Komut Üret
            </button>
          </div>
          <input
            className="input"
            type="text"
            placeholder="Opsiyonel: İstemci Genel Anahtarı (Zero-Trust)"
            value={customPubkey}
            onChange={(e) => setCustomPubkey(e.target.value)}
            style={{ marginTop: 6, fontSize: 12 }}
          />
        </div>

        <div className="input-group">
          <label>Cihaz İptal Et / Peer Kaldır</label>
          <div className="input-row">
            <input
              className="input"
              type="text"
              placeholder="cihaz-adı (örn. eski-telefon)"
              value={removeName}
              onChange={(e) => setRemoveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRemove()}
            />
            <button
              className="btn btn--danger btn--sm"
              onClick={handleRemove}
              disabled={loading || !removeName.trim()}
            >
              Komut Üret
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
