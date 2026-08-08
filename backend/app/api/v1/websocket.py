from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging

from app.websocket.websocket_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/hospitals/{hospital_id}")
async def hospital_websocket_endpoint(websocket: WebSocket, hospital_id: int):
    """
    WebSocket endpoint for real-time bed updates on a specific hospital.
    """
    await manager.connect(websocket, hospital_id)
    try:
        while True:
            # Keep connection open and listen for messages or heartbeat ping
            # Under standard WebSocket flow, the client only listens to updates
            data = await websocket.receive_text()
            # Echo or heartbeat check if needed
            await websocket.send_text(f"Received: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, hospital_id)
    except Exception as e:
        logger.error(f"Error in WebSocket session for hospital {hospital_id}: {e}")
        manager.disconnect(websocket, hospital_id)
