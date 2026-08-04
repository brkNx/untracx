import React, { useState, useEffect } from 'react';
import { peerList, peerAdd, peerRemove } from '../lib/helper';

export default function PeerManager() {
  const [peers, setPeers] = useState<Array<{ publicKey: string }>>([]);
  const [newPeerName, setNewPeerName] = useState('');
  const [removeName, setRemoveName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const result = await peerList();
      setPeers(result?.peers ?? []);
    } catch (e: any) {
      setMessage(`Hata: ${e}`);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAdd = async () => {
    if (!newPeerName.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      await peerAdd(newPeerName.trim());
      setMessage(`Peer "${newPeerName}" eklendi ✓`);
      setNewPeerName('');
      setTimeout(refresh, 1000);
    } catch (e: any) {
      setMessage(`Hata: ${e}`);
    }
    setLoading(false);
  };

  const handleRemove = async () => {
    if (!removeName.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      await peerRemove(removeName.trim());
      setMessage(`Peer "${removeName}" kaldırıldı ✓`);
      setRemoveName('');
      setTimeout(refresh, 1000);
    } catch (e: any) {
      setMessage(`Hata: ${e}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <h2>Peer Yönetimi</h2>
      <button onClick={refresh} disabled={loading}>
        Yenile
      </button>
      <div style={{ marginTop: '0.5rem' }}>
        <strong>Aktif peer'ler ({peers.length}):</strong>
        {peers.length === 0 && <p>Peer yok</p>}
        <ul style={{ fontSize: '0.85em', wordBreak: 'break-all' }}>
          {peers.map((p, i) => (
            <li key={i}>{p.publicKey}</li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div>
          <input
            type="text"
            placeholder="Peer adı (eklemek için)"
            value={newPeerName}
            onChange={(e) => setNewPeerName(e.target.value)}
            style={{ width: '200px' }}
          />
          <button onClick={handleAdd} disabled={loading}>
            Ekle
          </button>
        </div>
        <div>
          <input
            type="text"
            placeholder="Peer adı (kaldırmak için)"
            value={removeName}
            onChange={(e) => setRemoveName(e.target.value)}
            style={{ width: '200px' }}
          />
          <button onClick={handleRemove} disabled={loading}>
            Kaldır
          </button>
        </div>
      </div>
      {message && (
        <pre style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f5f5f5', borderRadius: '4px', fontSize: '0.85em' }}>
          {message}
        </pre>
      )}
    </div>
  );
}