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
          ? result.output.replace(/^(Sunucuda çalıştırmak için|To run on server): /, '')
          : `sudo untracx-add-peer ${newName.trim()}`;
      setGeneratedCmd(cmd);
      setMessage({ type: 'success', text: `Server command prepared: "${newName.trim()}"` });
      setNewName('');
      setCustomPubkey('');
    } catch (e) {
      setMessage({ type: 'error', text: `Failed to create command: ${e}` });
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
        ? result.output.replace(/^(Sunucuda çalıştırmak için|To run on server): /, '')
        : `sudo untracx-remove-peer ${removeName.trim()}`;
      setGeneratedCmd(cmd);
      setMessage({
        type: 'info',
        text: `Server revocation command prepared: "${removeName.trim()}"`,
      });
      setRemoveName('');
    } catch (e) {
      setMessage({ type: 'error', text: `Failed to create command: ${e}` });
    }
    setLoading(false);
  };

  const copyCommand = () => {
    if (generatedCmd) {
      navigator.clipboard.writeText(generatedCmd);
      setMessage({
        type: 'info',
        text: 'Command copied to clipboard! Paste into your server SSH terminal.',
      });
    }
  };

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <span className="card__title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Server Peer Management &amp; Command Builder
          </span>
          <div className="card__subtitle">
            Manage authorized client devices on your WireGuard server
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && <Spinner />}
          <input
            className="input input--mono"
            type="text"
            value={interfaceName}
            onChange={(e) => setInterfaceName(e.target.value)}
            placeholder="wg0"
            style={{ width: 80, padding: '4px 8px', fontSize: 11 }}
          />
        </div>
      </div>

      <div className="info-callout" style={{ marginTop: 0, marginBottom: 16 }}>
        🔐 <strong>Security Note:</strong> For maximum isolation, peer records and IP routing are managed directly
        on your Ubuntu server. Enter a device name below to generate the exact atomic shell command to execute on your server.
      </div>

      {message && <Message type={message.type} text={message.text} />}

      {generatedCmd && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
            📋 Command to Run on Server:
          </label>
          <div className="code-box">
            <span className="code-box__text">{generatedCmd}</span>
            <button className="btn btn--primary btn--sm" onClick={copyCommand}>
              Copy Command
            </button>
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Add Peer Card */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
          }}
        >
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>
            + Add New Peer
          </h4>
          <div className="input-group">
            <label>Device Name</label>
            <input
              className="input input--mono"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="device-name (e.g. macbook)"
            />
          </div>
          <div className="input-group">
            <label>Client Public Key (Optional)</label>
            <input
              className="input input--mono"
              type="text"
              value={customPubkey}
              onChange={(e) => setCustomPubkey(e.target.value)}
              placeholder="Optional: Client Public Key (Zero-Trust)"
            />
          </div>
          <button
            className="btn btn--primary btn--sm"
            onClick={handleAdd}
            disabled={loading || !newName.trim()}
            style={{ width: '100%' }}
          >
            Generate Command
          </button>
        </div>

        {/* Remove Peer Card */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
          }}
        >
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--rose)' }}>
            - Revoke Peer
          </h4>
          <div className="input-group">
            <label>Device Name to Revoke</label>
            <input
              className="input input--mono"
              type="text"
              value={removeName}
              onChange={(e) => setRemoveName(e.target.value)}
              placeholder="device-name (e.g. old-phone)"
            />
          </div>
          <div style={{ height: 50, display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Atomically drops the peer and invalidates its profile.
            </span>
          </div>
          <button
            className="btn btn--danger btn--sm"
            onClick={handleRemove}
            disabled={loading || !removeName.trim()}
            style={{ width: '100%' }}
          >
            Generate Command
          </button>
        </div>
      </div>

      {/* Peer List */}
      <div style={{ marginTop: 24 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>
          Active Peers Cache
        </h4>
        {peers.length === 0 ? (
          <div className="empty-state">No cached local peer records found on server.</div>
        ) : (
          <div>
            {peers.map((peer, i) => (
              <div key={i} className="peer-card">
                <div className="peer-card__info">
                  <div className="peer-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600 }}>
                      {peer.name || `peer-${i + 1}`}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {peer.publicKey}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {peer.endpoint && (
                    <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {peer.endpoint}
                    </span>
                  )}
                  <span className="indicator indicator--active">
                    <span className="indicator__dot"></span>
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
