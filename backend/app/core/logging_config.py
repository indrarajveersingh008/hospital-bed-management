import logging
import sys
import json
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    """
    Custom Formatter that serializes Python log records into JSON.
    Outputs standard keys including timestamp, level, message, logger, and file lines.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "filename": record.filename,
            "line_number": record.lineno,
            "function": record.funcName
        }

        # Include stack trace if exception info is present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry)


def setup_logging():
    """
    Configures root logging with StreamHandler outputting JSON logs to stdout.
    """
    root_logger = logging.getLogger()
    
    # Remove existing handlers to prevent duplicate output logs
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    # Output handler to stdout
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)
    
    # Silence third-party library logs noise
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
