import hashlib


class FileScanService:
    """
    Mock ClamAV document scanner for verifying uploaded hospital credentials.
    Detects standard virus test signatures like the EICAR string.
    """

    # Standard EICAR test signature
    EICAR_SIGNATURE = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"

    @staticmethod
    def calculate_checksum(file_bytes: bytes) -> str:
        """
        Compute SHA-256 checksum hash of the file bytes.
        """
        return hashlib.sha256(file_bytes).hexdigest()

    @classmethod
    def scan_file(cls, file_bytes: bytes) -> str:
        """
        Scan document bytes. Returns 'INFECTED' if EICAR signature is detected,
        otherwise returns 'CLEAN'.
        """
        if cls.EICAR_SIGNATURE in file_bytes:
            return "INFECTED"
        return "CLEAN"
