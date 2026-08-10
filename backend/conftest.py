import pytest
import sys
import os

# Ensure backend directory is in Python path for test execution
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
from app.middleware.rate_limit import RateLimitMiddleware


@pytest.fixture(autouse=True)
def clear_rate_limits():
    """
    Autouse fixture that clears the sliding window IP history in RateLimitMiddleware
    before each test. This prevents cross-test pollution and avoids 429 Too Many Requests
    responses during bulk pytest execution.
    """
    curr = getattr(app, "middleware_stack", None)
    while curr is not None:
        if isinstance(curr, RateLimitMiddleware):
            curr.ip_history.clear()
            break
        curr = getattr(curr, "app", None)
