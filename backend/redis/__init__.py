# Mock Redis package init
from redis.asyncio import RedisError, ConnectionError, from_url

__all__ = [
    "RedisError",
    "ConnectionError",
    "from_url",
]
