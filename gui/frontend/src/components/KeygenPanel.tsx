import { useState } from 'react';
import { keygen, publicFromPrivateKey, validatePrivateKey, validatePublicKey } from '../lib/helper';
import type { KeyPair, PublicKeyResult } from '../lib/types';
import Spinner from './ui/Spinner';
import Message from './ui/Message';

export default function KeygenPanel() {
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [derivedPublic, setDerivedPublic] = useState<PublicKeyResult | null>(null);
  const [privInput, setPrivInput] = useState('');
  const [pubInput, setPubInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [showPrivate, setShowPrivate] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const kp = await keygen();
      setKeyPair(kp);
      setMessage({
        type: 'success',
        text: 'New X25519 keypair and post-quantum PSK generated successfully.',
      });
    } catch (e) {
      setMessage({ type: 'error', text: `Generation error: ${e}` });
    }
    setLoading(false);
  };

  const handleDerive = async () => {
    if (!privInput.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await publicFromPrivateKey(privInput.trim());
      setDerivedPublic(result);
      setMessage({ type: 'success', text: 'Public key derived successfully.' });
    } catch (e) {
      setMessage({ type: 'error', text: `Derivation error: ${e}` });
    }
    setLoading(false);
  };

  const handleValidatePrivate = async () => {
    if (!privInput.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      await validatePrivateKey(privInput.trim());
      setMessage({ type: 'success', text: 'Private key is valid (32-byte Curve25519).' });
    } catch (e) {
      setMessage({ type: 'error', text: `Invalid private key: ${e}` });
    }
    setLoading(false);
  };

  const handleValidatePublic = async () => {
    if (!pubInput.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      await validatePublicKey(pubInput.trim());
      setMessage({ type: 'success', text: 'Public key is valid (32-byte Curve25519).' });
    } catch (e) {
      setMessage({ type: 'error', text: `Invalid public key: ${e}` });
    }
    setLoading(false);
  };

  const copyToClipboard = (text: string, label = 'Copied to clipboard.') => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'info', text: label });
  };

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <span className="card__title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 2l-2 2m-1-1l-3 3m5 0l-3-3m-6 8a5 5 0 1 1-7-7 5 5 0 0 1 7 7zm0 0l7 7-2 2-2-2-2 2-4-4" />
            </svg>
            Key Management &amp; Provisioning
          </span>
          <div className="card__subtitle">
            Generate ephemeral or static X25519 Curve25519 keys with post-quantum pre-shared keys.
          </div>
        </div>
        {loading && <Spinner />}
      </div>

      {message && <Message type={message.type} text={message.text} />}

      <div style={{ marginBottom: 18 }}>
        <button className="btn btn--primary" onClick={handleGenerate} disabled={loading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Generate New Key Pair
        </button>
      </div>

      {keyPair && (
        <div
          style={{
            marginBottom: 20,
            background: 'var(--bg-surface-elevated)',
            padding: 16,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="input-group">
            <label>Public Key (Server-side Identity)</label>
            <div className="code-box">
              <span className="code-box__text">{keyPair.publicKey}</span>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => copyToClipboard(keyPair.publicKey, 'Public key copied to clipboard.')}
              >
                Copy
              </button>
            </div>
          </div>

          {keyPair.privateKey && (
            <div className="input-group" style={{ marginTop: 14 }}>
              <label>
                <span>Private Key (Client Secret)</span>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setShowPrivate(!showPrivate)}
                >
                  {showPrivate ? 'Hide' : 'Show'}
                </button>
              </label>
              <div className="code-box">
                <span className="code-box__text">
                  {showPrivate ? keyPair.privateKey : '••••••••••••••••••••••••••••••••••••••••••••'}
                </span>
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={() => copyToClipboard(keyPair.privateKey!, 'Private key copied to clipboard.')}
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {keyPair.presharedKey && (
            <div className="input-group" style={{ marginTop: 14 }}>
              <label>Pre-Shared Key (Post-Quantum Guard)</label>
              <div className="code-box">
                <span className="code-box__text">{keyPair.presharedKey}</span>
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={() => copyToClipboard(keyPair.presharedKey!, 'PSK copied to clipboard.')}
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          <div className="info-callout" style={{ marginTop: 14 }}>
            🔒 <strong>Zero-Trust Architecture:</strong> Cryptographic keys are generated strictly on your local device. Share only your Public Key with server administrators.
          </div>
        </div>
      )}

      {/* Key Derivation & Validation */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 18, marginTop: 12 }}>
        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Derivation &amp; Verification
          </span>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Compute public keys deterministically from private keys or verify Base64 format integrity.
          </div>
        </div>

        <div className="input-group">
          <label>Derive public key from private key</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input input--mono"
              type="password"
              placeholder="X25519 private key (base64)"
              value={privInput}
              onChange={(e) => setPrivInput(e.target.value)}
            />
            <button
              className="btn btn--secondary btn--sm"
              onClick={handleDerive}
              disabled={loading || !privInput.trim()}
            >
              Derive
            </button>
            <button
              className="btn btn--secondary btn--sm"
              onClick={handleValidatePrivate}
              disabled={loading || !privInput.trim()}
            >
              Validate
            </button>
          </div>
        </div>

        {derivedPublic && (
          <div className="input-group" style={{ marginTop: 10 }}>
            <label>Derived Public Key</label>
            <div className="code-box">
              <span className="code-box__text">{derivedPublic.publicKey}</span>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => copyToClipboard(derivedPublic.publicKey, 'Derived public key copied.')}
              >
                Copy
              </button>
            </div>
          </div>
        )}

        <div className="input-group" style={{ marginTop: 14 }}>
          <label>Validate public key</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input input--mono"
              type="text"
              placeholder="X25519 public key (base64)"
              value={pubInput}
              onChange={(e) => setPubInput(e.target.value)}
            />
            <button
              className="btn btn--secondary btn--sm"
              onClick={handleValidatePublic}
              disabled={loading || !pubInput.trim()}
            >
              Validate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
