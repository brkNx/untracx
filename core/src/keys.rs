use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use x25519_dalek::{PublicKey, StaticSecret};
use zeroize::Zeroize;

pub struct KeyPair {
    pub private: String,
    pub public: String,
}

pub fn generate() -> KeyPair {
    let secret = StaticSecret::random_from_rng(rand::rngs::OsRng);
    let public = PublicKey::from(&secret);
    KeyPair {
        private: B64.encode(secret.to_bytes()),
        public: B64.encode(public.as_bytes()),
    }
}

pub fn validate_private(private_b64: &str) -> Result<[u8; 32], String> {
    let raw = B64.decode(private_b64.trim()).map_err(|e| e.to_string())?;
    raw.try_into()
        .map_err(|_| "Özel anahtar 32 bayt olmalı (base64)".to_string())
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
        assert_ne!(a.private, b.private);
        assert_ne!(a.public, b.public);
        assert!(validate_private(&a.private).is_ok());
        assert!(validate_public(&a.public).is_ok());
    }

    #[test]
    fn public_from_private_matches_generate() {
        let kp = generate();
        let derived = public_from_private(&kp.private).unwrap();
        assert_eq!(derived, kp.public);
    }

    #[test]
    fn public_from_private_is_deterministic() {
        let a = public_from_private(ZERO_KEY).unwrap();
        let b = public_from_private(ZERO_KEY).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn validates_public_key() {
        assert!(validate_public(&generate().public).is_ok());
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
        let derived = public_from_private(&format!("  {}\n", kp.private)).unwrap();
        assert_eq!(derived, kp.public);
    }
}
