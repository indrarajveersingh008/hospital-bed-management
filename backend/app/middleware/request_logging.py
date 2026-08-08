import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response

# Request Logger namespace
logger = logging.getLogger("request_logger")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that intercept all incoming requests, measures response latencies,
    and logs request metrics in structured JSON format.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()

        client_ip = request.client.host if request.client else "unknown"
        method = request.method
        path = request.url.path

        try:
            response = await call_next(request)
            latency = time.time() - start_time
            status_code = response.status_code

            # Log standard HTTP request metrics
            logger.info(
                f"HTTP {method} {path} from {client_ip} - Status: {status_code} - Latency: {latency:.4f}s"
            )
            return response
        except Exception as e:
            latency = time.time() - start_time
            # Log backend runtime errors alongside stack traces
            logger.exception(
                f"HTTP {method} {path} from {client_ip} - FAILED - Latency: {latency:.4f}s - Error: {str(e)}"
            )
            raise e
