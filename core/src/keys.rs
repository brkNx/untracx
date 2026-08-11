use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use x25519_dalek::{PublicKey, StaticSecret};
use zeroize::Zeroize;

/// A secure key pair where the private key is automatically zeroized on drop.
/// The private key bytes are stored as zeroized Vec<u8> to ensure
/// secure memory cleanup when the struct goes out of scope.
pub struct KeyPair {
    /// Private key as base64 string — zeroized on drop
    private: ZeroizedString,
    /// Public key as base64 string (safe to keep in memory)
    public: String,
}

impl KeyPair {
    /// Returns the public key as a string reference.
    pub fn public(&self) -> &str {
        &self.public
    }

    /// Returns the private key as a string reference.
    /// Use this only when you need to pass it to a function and
    /// ensure it's zeroized after use.
    pub fn private(&self) -> &str {
        &self.private
    }
}

/// Wrapper around String that implements Zeroize on drop for secure memory cleanup.
#[derive(Zeroize)]
#[zeroize(drop)]
struct ZeroizedString(String);

impl std::ops::Deref for ZeroizedString {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl ZeroizedString {
    fn new(s: String) -> Self {
        ZeroizedString(s)
    }
}

pub fn generate() -> KeyPair {
    let secret = StaticSecret::random_from_rng(rand::rngs::OsRng);
    let public = PublicKey::from(&secret);
    KeyPair {
        private: ZeroizedString::new(B64.encode(secret.to_bytes())),
        public: B64.encode(public.as_bytes()),
    }
}

/// Decodes a base64-encoded private key and returns the raw 32 bytes.
/// The returned array is zeroized by the caller after use.
pub fn validate_private(private_b64: &str) -> Result<[u8; 32], String> {
    let mut raw = B64.decode(private_b64.trim()).map_err(|e| e.to_string())?;
    let result: [u8; 32] = raw[..].try_into()
        .map_err(|_| "Özel anahtar 32 bayt olmalı (base64)".to_string())?;
    raw.zeroize();
    Ok(result)
}

pub fn public_from_private(private_b64: &str) -> Result<String, String> {
    let mut raw = validate_private(private_b64)?;
    let secret = StaticSecret::from(raw);
    let public = PublicKey::from(&secret);
    raw.zeroize();
    Ok(B64.encode(public.as_bytes()))
}

pub fn validate_public(public_b64: &str) -> Result<(), String> {
    let decoded = B64.decode(public_b64.trim()).map_err(|e| e.to_string())?;
    if decoded.len() != 32 {
        return Err("Genel anahtar 32 bayt olmalı".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const ZERO_KEY: &str = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const SHORT_KEY: &str = "AAAA"; // 3 bayt -> 4 karakter
    const NOT_B64: &str = "!!!not-base64!!!";

    #[test]
    fn generated_keys_are_valid_and_distinct() {
        let a = generate();
        let b = generate();
        assert_ne!(a.private(), b.private());
        assert_ne!(a.public(), b.public());
        assert!(validate_private(a.private()).is_ok());
        assert!(validate_public(a.public()).is_ok());
    }

    #[test]
    fn public_from_private_matches_generate() {
        let kp = generate();
        let derived = public_from_private(kp.private()).unwrap();
        assert_eq!(derived, kp.public());
    }

    #[test]
    fn public_from_private_is_deterministic() {
        let a = public_from_private(ZERO_KEY).unwrap();
        let b = public_from_private(ZERO_KEY).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn validates_public_key() {
        assert!(validate_public(generate().public()).is_ok());
        assert!(validate_public(ZERO_KEY).is_ok());
        assert!(validate_public(SHORT_KEY).is_err());
        assert!(validate_public(NOT_B64).is_err());
    }

    #[test]
    fn rejects_invalid_private_keys() {
        assert!(validate_private(SHORT_KEY).is_err());
        assert!(validate_private(NOT_B64).is_err());
        assert!(public_from_private(SHORT_KEY).is_err());
        assert!(public_from_private("").is_err());
    }

    #[test]
    fn trims_whitespace() {
        let kp = generate();
        let derived = public_from_private(&format!("  {}\n", kp.private())).unwrap();
        assert_eq!(derived, kp.public());
    }
}
