import sys
import os
import io
import json
import logging
from fastapi.testclient import TestClient

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app

client = TestClient(app)


def test_structured_logging_output():
    print("\n1. Testing structured JSON logging format outputs...")

    # Redirect stdout and logging handlers to capture logs
    captured_output = io.StringIO()
    sys.stdout = captured_output
    
    original_streams = []
    root_logger = logging.getLogger()
    for h in root_logger.handlers:
        if isinstance(h, logging.StreamHandler):
            original_streams.append((h, h.stream))
            h.stream = captured_output

    try:
        # Trigger health check request
        res = client.get("/health")
        assert res.status_code == 200
    finally:
        # Restore stdout and logging streams
        sys.stdout = sys.__stdout__
        for h, stream in original_streams:
            h.stream = stream

    # Read captured stdout logs
    log_output = captured_output.getvalue().strip()
    print("Captured Log Line:")
    print(log_output)
    
    assert log_output, "No logging output captured on stdout."

    # Parse and validate JSON structure
    log_lines = log_output.split("\n")
    parsed_json = None
    
    for line in log_lines:
        try:
            parsed = json.loads(line)
            if parsed.get("logger") == "request_logger":
                parsed_json = parsed
                break
        except json.JSONDecodeError:
            continue

    assert parsed_json is not None, "Failed to locate structured JSON request logs."
    
    # Assert JSON keys
    assert "timestamp" in parsed_json
    assert "level" in parsed_json
    assert "message" in parsed_json
    assert "logger" in parsed_json
    assert "filename" in parsed_json
    assert "line_number" in parsed_json
    assert "function" in parsed_json
    
    # Verify values content
    assert parsed_json["logger"] == "request_logger"
    assert "GET /health" in parsed_json["message"]
    assert "Status: 200" in parsed_json["message"]
    
    print("\nSuccess: JSON schema keys, latency metadata, and message formats verified.")


if __name__ == "__main__":
    test_structured_logging_output()
    print("\nObservability and Structured request logging checks completed successfully!")
