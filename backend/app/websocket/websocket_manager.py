import json
import asyncio
import logging
from typing import Dict, List
from fastapi import WebSocket
import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

REDIS_CHANNEL = "hospital_bed_updates"


class ConnectionManager:
    def __init__(self):
        # Maps hospital_id -> list of active WebSocket connections
        self.active_connections: Dict[int, List[WebSocket]] = {}
        self.redis_client: Optional[aioredis.Redis] = None
        self.pubsub_task: Optional[asyncio.Task] = None
        self.redis_available = False

        # Initialize Redis client asynchronously
        try:
            self.redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            self.redis_available = True
            logger.info("Created async Redis client for WebSockets")
        except Exception as e:
            logger.warning(f"Could not connect to Redis: {e}. Falling back to in-memory broadcasting.")
            self.redis_available = False

    async def connect(self, websocket: WebSocket, hospital_id: int):
        await websocket.accept()
        if hospital_id not in self.active_connections:
            self.active_connections[hospital_id] = []
        self.active_connections[hospital_id].append(websocket)
        logger.info(f"WebSocket client connected to hospital {hospital_id}")

    def disconnect(self, websocket: WebSocket, hospital_id: int):
        if hospital_id in self.active_connections:
            if websocket in self.active_connections[hospital_id]:
                self.active_connections[hospital_id].remove(websocket)
            if not self.active_connections[hospital_id]:
                del self.active_connections[hospital_id]
        logger.info(f"WebSocket client disconnected from hospital {hospital_id}")

    async def broadcast_to_hospital(self, hospital_id: int, message: dict):
        """
        Sends message to all WebSocket connections listening to a specific hospital.
        """
        if hospital_id in self.active_connections:
            disconnected_sockets = []
            for connection in self.active_connections[hospital_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Error sending WebSocket message: {e}")
                    disconnected_sockets.append(connection)
            
            # Clean up stale connections
            for conn in disconnected_sockets:
                self.disconnect(conn, hospital_id)

    async def publish_bed_update(self, hospital_id: int, data: dict):
        """
        Publishes a bed update event. If Redis is available, it publishes to the channel
        so all backend instances receive it. Otherwise, it broadcasts directly (single instance fallback).
        """
        event_message = {
            "event": "BED_AVAILABILITY_UPDATED",
            "hospital_id": hospital_id,
            "data": data
        }

        # Local fallback if Redis is disabled or failed
        if not self.redis_available or not self.redis_client:
            logger.debug(f"Redis unavailable, broadcasting locally for hospital {hospital_id}")
            await self.broadcast_to_hospital(hospital_id, event_message)
            return

        try:
            # Publish to Redis channel
            await self.redis_client.publish(REDIS_CHANNEL, json.dumps(event_message))
        except Exception as e:
            logger.error(f"Failed to publish update to Redis: {e}. Falling back to local broadcast.")
            await self.broadcast_to_hospital(hospital_id, event_message)

    async def _redis_listener_loop(self):
        """
        Background listener task running on each server instance. Subscribes to the Redis
        updates channel and broadcasts messages to connected local WebSocket clients.
        """
        if not self.redis_client:
            return
            
        pubsub = self.redis_client.pubsub()
        try:
            await pubsub.subscribe(REDIS_CHANNEL)
            logger.info(f"Subscribed to Redis channel: {REDIS_CHANNEL}")
            
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        hospital_id = int(data.get("hospital_id", 0))
                        if hospital_id:
                            await self.broadcast_to_hospital(hospital_id, data)
                    except (json.JSONDecodeError, ValueError) as e:
                        logger.error(f"Error parsing Redis message payload: {e}")
        except asyncio.CancelledError:
            logger.info("Redis listener task cancelled")
        except Exception as e:
            logger.error(f"Error in Redis listener loop: {e}")
            self.redis_available = False
        finally:
            await pubsub.unsubscribe(REDIS_CHANNEL)

    def start_listener(self):
        """
        Starts the background Redis listener loop.
        """
        if self.redis_available and not self.pubsub_task:
            self.pubsub_task = asyncio.create_task(self._redis_listener_loop())
            logger.info("Started WebSocket Redis listener background task")

    async def stop_listener(self):
        """
        Cancels the listener task on application shutdown.
        """
        if self.pubsub_task:
            self.pubsub_task.cancel()
            try:
                await self.pubsub_task
            except asyncio.CancelledError:
                pass
            self.pubsub_task = None
            logger.info("Stopped WebSocket Redis listener background task")


# Single global instance of connection manager
manager = ConnectionManager()
