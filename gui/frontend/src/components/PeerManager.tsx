import { useState, useEffect, useCallback } from 'react';
import { peerList, peerAdd, peerRemove } from '../lib/helper';
import type { Peer } from '../lib/types';
import Spinner from './ui/Spinner';
import Message from './ui/Message';

export default function PeerManager() {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [newName, setNewName] = useState('');
  const [removeName, setRemoveName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await peerList();
      setPeers(result.peers ?? []);
    } catch {
      setPeers([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      await peerAdd(newName.trim());
      setMessage({ type: 'success', text: `"${newName.trim()}" eklendi.` });
      setNewName('');
      setTimeout(refresh, 1000);
    } catch (e) {
      setMessage({ type: 'error', text: `Ekleme hatası: ${e}` });
    }
    setLoading(false);
  };

  const handleRemove = async () => {
    if (!removeName.trim()) return;
    if (!window.confirm(`"${removeName.trim()}" peer'ı kaldırılacak. Emin misin?`)) return;
    setLoading(true);
    setMessage(null);
    try {
      await peerRemove(removeName.trim());
      setMessage({ type: 'success', text: `"${removeName.trim()}" kaldırıldı.` });
      setRemoveName('');
      setTimeout(refresh, 1000);
    } catch (e) {
      setMessage({ type: 'error', text: `Kaldırma hatası: ${e}` });
    }
    setLoading(false);
  };

  return (
    <div className="card">
      <div className="card__header">
        <span className="card__title">Peer Yönetimi ({peers.length})</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && <Spinner />}
          <button className="btn btn--secondary btn--sm" onClick={refresh} disabled={loading}>
            Yenile
          </button>
        </div>
      </div>

      {message && <Message type={message.type} text={message.text} />}

      {peers.length === 0 ? (
        <div className="empty">Aktif peer yok.</div>
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
          <label>Peer ekle</label>
          <div className="input-row">
            <input
              className="input"
              type="text"
              placeholder="cihaz-adı"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              className="btn btn--primary btn--sm"
              onClick={handleAdd}
              disabled={loading || !newName.trim()}
            >
              Ekle
            </button>
          </div>
        </div>
        <div className="input-group">
          <label>Peer kaldır</label>
          <div className="input-row">
            <input
              className="input"
              type="text"
              placeholder="cihaz-adı"
              value={removeName}
              onChange={(e) => setRemoveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRemove()}
            />
            <button
              className="btn btn--danger btn--sm"
              onClick={handleRemove}
              disabled={loading || !removeName.trim()}
            >
              Kaldır
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
