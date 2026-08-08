import base64
import hashlib
import hmac
import random
import struct
import time
from urllib.parse import quote


class TOTP:
    """
    Pure Python RFC 6238 Time-Based One-Time Password (TOTP) implementation.
    Does not require external dependencies like pyotp.
    """

    @staticmethod
    def generate_secret() -> str:
        """
        Generate a random 16-character Base32 secret key.
        """
        alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
        return "".join(random.choice(alphabet) for _ in range(16))

    @staticmethod
    def generate_provisioning_uri(secret: str, email: str, issuer: str = "HospBed") -> str:
        """
        Generate standard OTP provisioning URI for scanner apps.
        """
        label = f"{issuer}:{email}"
        return f"otpauth://totp/{quote(label)}?secret={secret}&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period=30"

    @classmethod
    def _hotp(cls, secret_bytes: bytes, counter: int) -> str:
        """
        Internal HMAC-Based OTP calculation.
        """
        # Pack counter into an 8-byte big-endian integer
        msg = struct.pack(">Q", counter)
        
        # Calculate HMAC-SHA1 digest
        hs = hmac.new(secret_bytes, msg, hashlib.sha1).digest()
        
        # Truncation logic (RFC 4226)
        offset = hs[19] & 0xf
        bin_code = (
            ((hs[offset] & 0x7f) << 24) |
            ((hs[offset + 1] & 0xff) << 16) |
            ((hs[offset + 2] & 0xff) << 8) |
            (hs[offset + 3] & 0xff)
        )
        
        code = bin_code % 1000000
        return str(code).zfill(6)

    @classmethod
    def verify_totp(cls, secret: str, code: str, tolerance: int = 1) -> bool:
        """
        Verify the TOTP code matching current, past, and future steps (tolerance).
        """
        if not secret or not code:
            return False
            
        try:
            # Clean base32 string padding
            secret = secret.strip().upper()
            missing_padding = len(secret) % 8
            if missing_padding:
                secret += "=" * (8 - missing_padding)
                
            key = base64.b32decode(secret, casefold=True)
        except Exception:
            return False

        # Current time step count
        current_time = int(time.time())
        current_step = current_time // 30

        # Check tolerance windows to match time skews
        for step_offset in range(-tolerance, tolerance + 1):
            target_step = current_step + step_offset
            calculated_code = cls._hotp(key, target_step)
            if calculated_code == code.strip():
                return True
                
        return False
