"""Agent Lab — Encryption services for sensitive data (API keys)."""

from pathlib import Path

from cryptography.fernet import Fernet


def get_or_create_key(key_path: Path) -> bytes:
    """
    Read rotation key from file or generate a new one if it doesn't exist.
    """
    if key_path.exists():
        return key_path.read_bytes()
    
    # Ensure parent directory exists
    key_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Generate new key
    key = Fernet.generate_key()
    key_path.write_bytes(key)
    return key


def encrypt_value(value: str, key: bytes) -> str:
    """
    Encrypt a string value using the provided Fernet key.
    Returns a base64 encoded string.
    """
    if not value:
        return ""
    
    f = Fernet(key)
    return f.encrypt(value.encode()).decode()


def decrypt_value(encrypted: str, key: bytes) -> str:
    """
    Decrypt a base64 encoded string using the provided Fernet key.
    Returns the original plaintext string.
    """
    if not encrypted:
        return ""
    
    f = Fernet(key)
    return f.decrypt(encrypted.encode()).decode()
