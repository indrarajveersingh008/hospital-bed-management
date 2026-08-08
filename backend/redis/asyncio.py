class RedisError(Exception):
    pass


class ConnectionError(RedisError):
    pass


class MockRedis:
    def __init__(self, *args, **kwargs):
        pass

    def pubsub(self, *args, **kwargs):
        raise ConnectionError("Redis server connection offline")

    async def publish(self, *args, **kwargs):
        raise ConnectionError("Redis server connection offline")


class AsyncioModule:
    Redis = MockRedis

    @staticmethod
    def from_url(*args, **kwargs):
        raise ConnectionError("Redis not installed. Falling back to local in-memory broadcast.")


def from_url(*args, **kwargs):
    raise ConnectionError("Redis not installed. Falling back to local in-memory broadcast.")
