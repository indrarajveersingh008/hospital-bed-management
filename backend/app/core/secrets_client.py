import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class SecretsClient:
    """
    Client for retrieving secrets from managed secrets managers in production
    or falling back to environment/local configuration in development.
    """

    def __init__(self):
        self.provider = settings.SECRETS_PROVIDER.lower()
        self._vault_client = None
        self._aws_client = None

        if self.provider == "vault":
            # Vault implementation would typically require hvac library
            try:
                import hvac
                self._vault_client = hvac.Client(
                    url=settings.SECRETS_VAULT_URL,
                    token=settings.SECRETS_VAULT_TOKEN
                )
                logger.info("Initialized HashiCorp Vault secrets client")
            except ImportError:
                logger.warning("hvac library not installed, Vault integration disabled")
        elif self.provider == "aws":
            # AWS implementation would require boto3
            try:
                import boto3
                self._aws_client = boto3.client(
                    "secretsmanager",
                    region_name=settings.SECRETS_AWS_REGION
                )
                logger.info("Initialized AWS Secrets Manager client")
            except ImportError:
                logger.warning("boto3 library not installed, AWS Secrets Manager integration disabled")

    def get_secret(self, secret_key: str, default: Optional[str] = None) -> Optional[str]:
        """
        Retrieves a secret by key. Falls back to default or settings attribute if provider is local.
        """
        if self.provider == "local":
            return getattr(settings, secret_key, default)

        if self.provider == "vault" and self._vault_client:
            try:
                # Vault kv-v2 read implementation
                read_response = self._vault_client.secrets.kv.v2.read_secret_version(
                    path="hospital-bed-system",
                    mount_point="secret"
                )
                return read_response["data"]["data"].get(secret_key, default)
            except Exception as e:
                logger.error(f"Error fetching secret '{secret_key}' from Vault: {e}")
                return getattr(settings, secret_key, default)

        if self.provider == "aws" and self._aws_client:
            try:
                # AWS Secrets Manager get secret value
                response = self._aws_client.get_secret_value(SecretId="hospital-bed-system")
                if "SecretString" in response:
                    import json
                    secrets = json.loads(response["SecretString"])
                    return secrets.get(secret_key, default)
            except Exception as e:
                logger.error(f"Error fetching secret '{secret_key}' from AWS Secrets Manager: {e}")
                return getattr(settings, secret_key, default)

        return getattr(settings, secret_key, default)


secrets_client = SecretsClient()
