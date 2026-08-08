# Import Base class for inheritance by all models
from app.core.database import Base

# Export it so other models can import it from here
__all__ = ["Base"]
