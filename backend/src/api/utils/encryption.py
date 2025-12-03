"""
encryption utility - see adr-003-encryption-choice.md
"""

import os
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken
from api.utils.logger import log


class EncryptionService:
    """
    encrypt and decrypt data using Fernet.

    NOTE: singleton pattern used, as I need to ensure Fernet instance initialized once only
    otherwise, with encryption key loaded multiple times, this won't work
    """

    _instance: Optional["EncryptionService"] = None
    _fernet: Optional[Fernet] = None

    def __new__(cls) -> "EncryptionService":
        """singleton pattern to ensure single instance"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self) -> None:
        encryption_key = os.environ.get("ENCRYPTION_KEY")

        if not encryption_key:
            raise ValueError(
                "ENCRYPTION_KEY environment variable is required for encryption. "
                "Please set it in your environment or .env file."
            )

        try:
            self._fernet = Fernet(encryption_key.encode())
        except Exception as e:
            raise ValueError(
                f"Failed to initialize encryption service. "
                f"ENCRYPTION_KEY must be a valid Fernet key (32 bytes, base64-encoded). "
                f"Error: {e}"
            ) from e

    def encrypt(self, plaintext: Optional[str]) -> Optional[str]:
        if plaintext is None:
            return None

        if self._fernet is None:
            raise RuntimeError("Encryption service not initialized")

        try:
            encrypted_bytes = self._fernet.encrypt(plaintext.encode("utf-8"))
            return encrypted_bytes.decode("utf-8")
        except Exception as e:
            log.error(f"Encryption failed: {e}")
            raise ValueError(f"Failed to encrypt data: {e}") from e

    def decrypt(self, ciphertext: Optional[str]) -> Optional[str]:
        if ciphertext is None:
            return None

        if self._fernet is None:
            raise RuntimeError("Encryption service not initialized")

        try:
            decrypted_bytes = self._fernet.decrypt(ciphertext.encode("utf-8"))
            return decrypted_bytes.decode("utf-8")
        except InvalidToken as e:
            log.error(
                f"Decryption failed: Invalid token (wrong key or corrupted data): {e}"
            )
            raise ValueError(
                "Failed to decrypt data. This may indicate corrupted data or an incorrect encryption key."
            ) from e
        except Exception as e:
            log.error(f"Decryption failed: {e}")
            raise ValueError(f"Failed to decrypt data: {e}") from e


def get_encryption_service() -> EncryptionService:
    """
    get the singleton EncryptionService instance
    this is just convenience - makes easier to ensure one instance only if this func used elsewhere
    """
    return EncryptionService()
