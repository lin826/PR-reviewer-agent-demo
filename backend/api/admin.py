import time

from fastapi import APIRouter

from backend.services import scanner

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/refresh")
def refresh_data() -> dict[str, str | float | dict[str, int]]:
    """
    Refresh/reload data from the submissions directory.

    Useful for development or when new data is added without restarting the server.
    """
    start_time = time.time()

    # Re-scan the data
    scanner.scan_data()

    # Get updated statistics
    stats = scanner.get_stats()
    elapsed = time.time() - start_time

    return {
        "message": "Data refresh completed successfully",
        "scan_time": round(elapsed, 3),
        "stats": stats,
    }


@router.get("/status")
def get_system_status() -> dict[str, str | dict[str, int]]:
    """
    Get current system status and data statistics.

    Useful for monitoring and health checks.
    """
    stats = scanner.get_stats()

    return {
        "status": "healthy",
        "message": "System is operational",
        "data_stats": stats,
    }
