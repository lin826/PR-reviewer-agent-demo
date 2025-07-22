from .admin import router as admin_router
from .labels import router as labels_router
from .patches import router as patches_router
from .problems import router as problems_router
from .selectors import router as selectors_router

__all__ = [
    "problems_router",
    "patches_router",
    "labels_router",
    "selectors_router",
    "admin_router",
]
