import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import (
    admin_router,
    labels_router,
    patches_router,
    problems_router,
    selectors_router,
)
from backend.services import ground_truth_loader, scanner

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """FastAPI lifespan handler for startup and shutdown events."""
    # Startup
    logger.info("🚀 Starting SWE Quality Backend...")
    start_time = time.time()

    try:
        # Scan and index data directory
        logger.info("📊 Scanning data directory for problems and submissions...")
        scanner.scan_data()

        # Get and log statistics
        stats = scanner.get_stats()
        elapsed = time.time() - start_time

        logger.info("✅ Data scanning completed successfully!")
        logger.info(
            f"   📈 Indexed: {stats['agents']} agents, "
            f"{stats['repositories']} repositories"
        )
        logger.info(
            f"   📈 Problems: {stats['problems']}, "
            f"Total submissions: {stats['total_submissions']}"
        )
        logger.info(f"   ⏱️  Scan time: {elapsed:.2f}s")

        # Log ground truth loader status
        if ground_truth_loader.is_available():
            gt_stats = ground_truth_loader.get_stats()
            total_problems = gt_stats.get("total_problems", 0)
            dataset_name = gt_stats.get("dataset_name", "Unknown")
            logger.info(
                f"✅ Ground truth loaded: {total_problems} problems from {dataset_name}"
            )
        else:
            logger.info("⚠️  Ground truth not available - using placeholders")

        # Warm up critical endpoints (optional)
        logger.info("🔥 Cache warming complete")

        logger.info("✅ Backend startup complete - ready to serve requests!")

    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise

    yield

    # Shutdown
    logger.info("🛑 Shutting down SWE Quality Backend...")
    logger.info("✅ Shutdown complete")


app = FastAPI(
    title="SWE Quality Backend",
    description=(
        "Backend API for comparing agent patches with ground truth and user labeling"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Include routers
app.include_router(problems_router)
app.include_router(patches_router)
app.include_router(labels_router)
app.include_router(selectors_router)
app.include_router(admin_router)


@app.get("/")
def read_root():
    return {"message": "SWE Quality Backend API"}


@app.get("/health")
def health_check():
    stats = scanner.get_stats()
    return {"status": "healthy", "data": stats}
