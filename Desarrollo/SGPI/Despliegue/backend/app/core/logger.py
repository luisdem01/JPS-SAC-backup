import os
import logging
import logging.handlers
import contextvars
from app.core.config import settings

# Context variable to hold the unique ID for each request
correlation_id: contextvars.ContextVar[str] = contextvars.ContextVar("correlation_id", default="-")

class CorrelationIdFilter(logging.Filter):
    """
    Filter to inject the current correlation_id from contextvars into the log record.
    If the context variable is not set, it defaults to a hyphen.
    """
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id.get()
        return True

def setup_logging() -> None:
    """
    Configures standard Python logging to write to stdout and a rotating file.
    Intercepts Uvicorn loggers to direct their output through the same pipeline.
    """
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    # 1. Resolve path and create logs folder if missing
    log_file = settings.LOG_FILE_PATH
    log_dir = os.path.dirname(log_file)
    if log_dir:
        os.makedirs(log_dir, exist_ok=True)
        
    # 2. Configure Formatter
    log_format = (
        "[%(asctime)s] [%(levelname)s] [%(name)s:%(filename)s:%(lineno)d] "
        "[Correlation-ID: %(correlation_id)s] - %(message)s"
    )
    formatter = logging.Formatter(log_format)
    
    # 3. Create handlers
    # Stream Handler (Stdout)
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    stream_handler.addFilter(CorrelationIdFilter())
    
    # Rotating File Handler
    file_handler = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=settings.LOG_MAX_BYTES,
        backupCount=settings.LOG_BACKUP_COUNT,
        encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    file_handler.addFilter(CorrelationIdFilter())
    
    # 4. Configure Root Logger
    root_logger = logging.getLogger()
    # Clear any pre-existing handlers
    for h in root_logger.handlers[:]:
        root_logger.removeHandler(h)
        
    root_logger.setLevel(log_level)
    root_logger.addHandler(stream_handler)
    root_logger.addHandler(file_handler)
    
    # 5. Intercept other framework loggers
    intercept_loggers = ["uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"]
    for logger_name in intercept_loggers:
        framework_logger = logging.getLogger(logger_name)
        framework_logger.handlers = []
        framework_logger.propagate = True
        framework_logger.setLevel(log_level)
        
    # 6. Silence watchfiles log loop (watchfiles.main: 1 change detected)
    # Since watchfiles detects changes in logs/sgpi.log when writing logs,
    # it generates an infinite loop of "1 change detected" log lines.
    # We set watchfiles logger level to WARNING to prevent these INFO logs.
    logging.getLogger("watchfiles").setLevel(logging.WARNING)

    logging.info("Centralized logging system initialized successfully.")

# Expose a default system logger
logger = logging.getLogger("sgpi.app")

# ---------------------------------------------------------------------------
# Specialized diagnostic logging helpers
# ---------------------------------------------------------------------------

def log_connection_error(
    service_name: str,
    url: str,
    exception: Exception,
    details: str = ""
) -> None:
    """
    Logs a standardized diagnostic error message for network connection failures,
    unreachable APIs, or connector loader failures.
    """
    error_msg = (
        f"CONNECTION_FAILURE to service: [{service_name}] at URL: [{url}]. "
        f"Exception: {type(exception).__name__}: {str(exception)}. "
        f"Details: {details if details else 'None'}"
    )
    logger.error(error_msg, exc_info=True)

def log_connector_status(
    connector_name: str,
    status: str,
    duration: float,
    processed_records: int = 0,
    errors: int = 0,
    details: str = ""
) -> None:
    """
    Logs a standardized diagnostic message tracking the loading, execution,
    and completion status of an ETL connector.
    
    :param connector_name: Name of the connector (e.g., 'SGPI-CSAPIREN', 'SGPI-CI')
    :param status: Status of operation ('START', 'SUCCESS', 'FAILED', 'DEGRADED')
    :param duration: Execution time in seconds
    :param processed_records: Count of records successfully processed/imported
    :param errors: Count of validation errors or rows rejected
    :param details: Optional additional context or error messages
    """
    log_msg = (
        f"CONNECTOR_STATUS: [{connector_name}] - Status: [{status}] - "
        f"Duration: {duration:.3f}s - Processed: {processed_records} - "
        f"Errors: {errors}. Details: {details if details else 'None'}"
    )
    if status == "FAILED":
        logger.error(log_msg)
    elif status == "DEGRADED" or errors > 0:
        logger.warning(log_msg)
    else:
        logger.info(log_msg)
